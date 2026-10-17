import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HTTP_URL = /^https?:\/\//i;
const DEFAULT_CACHE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.cache',
  'og-images.json'
);
const LOOKUP_MS = 5000;
const MAX_LOOKUPS = 20;
const SKIP_IMAGE = /(?:^|[/?=_&.-])(?:favicon|logo|logos|sprite|badge|pixel|spacer|blank|1x1|tracking)(?:[./?=_&-]|$)|favicon\.ico|google-analytics|doubleclick|facebook\.com\/tr|pixel\.gif|\.svg(?:$|\?)/i;

let lookupsThisRun = 0;
let memoryCache = null;

function cleanUrl(value) {
  if (!value) return '';
  let url = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/g, '&')
    .replace(/&#x0*26;/gi, '&')
    .trim();
  if (url.startsWith('//')) url = `https:${url}`;
  return HTTP_URL.test(url) ? url : '';
}

function fromMedia(node) {
  if (!node) return '';
  if (typeof node === 'string') return cleanUrl(node);
  if (Array.isArray(node)) {
    for (const entry of node) {
      const url = fromMedia(entry);
      if (url) return url;
    }
    return '';
  }
  return cleanUrl(node.url || node.$?.url || node.href);
}

// First usable http(s) image on an RSS or Reddit item. Empty when the feed
// has no image, so the card can omit the thumbnail.
export function storyImage(item = {}) {
  const enclosure = item.enclosure;
  const enclosureType = String(enclosure?.type || '');
  if (!enclosureType || enclosureType.startsWith('image/')) {
    const enclosed = fromMedia(enclosure);
    if (enclosed) return enclosed;
  }

  const media = fromMedia(item['media:content'] || item.mediaContent);
  if (media) return media;

  const thumb = fromMedia(item['media:thumbnail'] || item.mediaThumbnail || item.thumbnail);
  if (thumb) return thumb;

  const html = [item['content:encoded'], item.content, item.description, item.summary]
    .filter((part) => typeof part === 'string')
    .join(' ');
  const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match ? cleanUrl(match[1]) : '';
}

function dimension(url, names) {
  const match = String(url).match(new RegExp(`[?&](?:${names})=(\\d+)`, 'i'));
  return match ? Number(match[1]) : 0;
}

// Logos, tracking pixels, and icons are not story photos.
export function isUsableStoryImage(url) {
  const cleaned = cleanUrl(url);
  if (!cleaned || SKIP_IMAGE.test(cleaned)) return false;
  const width = dimension(cleaned, 'w|width');
  const height = dimension(cleaned, 'h|height');
  if ((width && width < 200) || (height && height < 200)) return false;
  return true;
}

function reservedHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host.endsWith('.example') || host.endsWith('.invalid') || host.endsWith('.test');
  } catch (err) {
    return true;
  }
}

function metaContent(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[2] ?? match[3] ?? '') : '';
}

function metaImage(html, base) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  const wanted = ['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'];
  for (const key of wanted) {
    for (const tag of tags) {
      const prop = (metaContent(tag, 'property') || metaContent(tag, 'name')).toLowerCase();
      if (prop !== key) continue;
      const content = metaContent(tag, 'content');
      if (!content) continue;
      let absolute = cleanUrl(content);
      if (!absolute) {
        try {
          absolute = cleanUrl(new URL(content, base).href);
        } catch (err) {
          absolute = '';
        }
      }
      if (isUsableStoryImage(absolute)) return absolute;
    }
  }
  return '';
}

function loadCache(cachePath) {
  if (memoryCache && memoryCache.path === cachePath) return memoryCache.data;
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (err) {
    data = {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  memoryCache = { path: cachePath, data };
  return data;
}

function saveCache(cachePath, data) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data));
  memoryCache = { path: cachePath, data };
}

export function resetStoryImageLookups() {
  lookupsThisRun = 0;
  memoryCache = null;
}

// When the RSS item has no usable media:content, media:thumbnail, or
// enclosure, read og:image / twitter:image from the article page.
// At most ~20 page reads per process. Results are cached by article URL.
export async function enrichStoryImage(item = {}, link = '', options = {}) {
  const direct = storyImage(item);
  if (direct && isUsableStoryImage(direct)) return direct;

  const pageUrl = cleanUrl(link || item.link || '');
  if (!pageUrl || reservedHost(pageUrl)) return '';
  if (!options.fetchImpl && process.env.NODE_TEST_CONTEXT) return '';

  const cachePath = options.cachePath || DEFAULT_CACHE;
  const cache = loadCache(cachePath);
  if (Object.prototype.hasOwnProperty.call(cache, pageUrl)) {
    return isUsableStoryImage(cache[pageUrl]) ? cache[pageUrl] : '';
  }

  const maxLookups = options.maxLookups ?? MAX_LOOKUPS;
  if (lookupsThisRun >= maxLookups) return '';
  lookupsThisRun += 1;

  const fetcher = options.fetchImpl || globalThis.fetch;
  let image = '';
  try {
    const response = await fetcher(pageUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs ?? LOOKUP_MS),
      headers: {
        'User-Agent': 'signal-personal-dashboard/1.0 (+https://github.com/Primetimeplayer/signal-tech)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (response && response.ok) {
      const html = await response.text();
      image = metaImage(String(html).slice(0, 500000), pageUrl);
    }
  } catch (err) {
    image = '';
  }

  cache[pageUrl] = image;
  try {
    saveCache(cachePath, cache);
  } catch (err) {
    memoryCache = { path: cachePath, data: cache };
  }
  return image;
}
