// Region and language choices for the news feeds.
// Google News wants hl, gl, and ceid on the RSS URL. Other publishers get the
// same gl and hl query when they tolerate it. The Verge 404s if a query
// string is added, so that host is left untouched.

export const DEFAULT_REGION = 'US';
export const DEFAULT_LANGUAGE = 'en-US';

export const REGIONS = [
  { id: 'US', label: 'Worldwide / US' },
  { id: 'GB', label: 'United Kingdom' },
  { id: 'INT', label: 'Global / International' },
  { id: 'DE', label: 'Germany' },
  { id: 'FR', label: 'France' },
  { id: 'JP', label: 'Japan' },
  { id: 'IN', label: 'India' },
  { id: 'ES', label: 'Spain' },
  { id: 'BR', label: 'Brazil' },
  { id: 'MX', label: 'Mexico' },
  { id: 'CA', label: 'Canada' },
  { id: 'AU', label: 'Australia' },
  { id: 'KR', label: 'South Korea' },
  { id: 'IT', label: 'Italy' },
  { id: 'NL', label: 'Netherlands' },
];

export const LANGUAGES = [
  { id: 'en-US', label: 'English' },
  { id: 'es-419', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'ja', label: 'Japanese' },
  { id: 'pt-BR', label: 'Portuguese' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ko', label: 'Korean' },
  { id: 'zh-CN', label: 'Chinese' },
  { id: 'it', label: 'Italian' },
  { id: 'nl', label: 'Dutch' },
];

const QUERY_BLOCKLIST = new Set(['www.theverge.com', 'theverge.com']);

// Google serves these English editions directly. hl=en-US with another gl
// often redirects, and that redirect comes back as 503 from some networks.
const ENGLISH_HL = {
  US: 'en-US',
  GB: 'en-GB',
  IN: 'en-IN',
  AU: 'en-AU',
  CA: 'en-CA',
};

function ceidLanguage(language) {
  if (language.startsWith('en')) return 'en';
  if (language === 'pt-BR') return 'pt-419';
  if (language === 'zh-CN') return 'zh-Hans';
  return language;
}

function headlineLanguage(region, language) {
  if (language.startsWith('en')) return ENGLISH_HL[region] || 'en-US';
  return language;
}

export function normalizeRegion(value) {
  const id = String(value || '').trim().toUpperCase();
  return REGIONS.some((region) => region.id === id) ? id : DEFAULT_REGION;
}

export function normalizeLanguage(value) {
  const id = String(value || '').trim();
  return LANGUAGES.some((language) => language.id === id) ? id : DEFAULT_LANGUAGE;
}

// Google News RSS: https://news.google.com/rss?hl=${lang}&gl=${region}&ceid=${region}:${lang}
// hl is the language, gl is the edition, ceid is region:language.
// ceid uses the language tag Google actually serves (en, not en-US). Global /
// International has no gl code, so it uses the world topic and a US edition.
export function googleNewsUrl(region, language) {
  const gl = normalizeRegion(region);
  const selected = normalizeLanguage(language);
  const edition = gl === 'INT' ? 'US' : gl;
  const hl = headlineLanguage(edition, selected);
  const lang = ceidLanguage(selected);
  if (gl === 'INT') {
    return `https://news.google.com/rss/headlines/section/topic/WORLD?hl=${hl}&gl=US&ceid=US:${lang}`;
  }
  return `https://news.google.com/rss?hl=${hl}&gl=${edition}&ceid=${edition}:${lang}`;
}

export function applyLocaleParams(url, region, language) {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    return String(url || '');
  }
  if (parsed.hostname === 'news.google.com') return googleNewsUrl(region, language);
  if (QUERY_BLOCKLIST.has(parsed.hostname)) return parsed.toString();
  const gl = normalizeRegion(region);
  const hl = normalizeLanguage(language);
  parsed.searchParams.set('gl', gl === 'INT' ? 'US' : gl);
  parsed.searchParams.set('hl', hl);
  return parsed.toString();
}

// Feeds the update-data job fetches on the GitHub runner and pushes to the
// worker (scripts/push-news-locales.js). Each region in its own language,
// India also in Hindi, Canada also in French, and the US edition in every
// language: 27 feeds. 27 KV writes x 12 runs a day stays under the Workers
// KV free tier of 1,000 writes a day.
export const REGION_LANGUAGE = {
  US: 'en-US',
  GB: 'en-US',
  INT: 'en-US',
  DE: 'de',
  FR: 'fr',
  JP: 'ja',
  IN: 'en-US',
  ES: 'es-419',
  BR: 'pt-BR',
  MX: 'es-419',
  CA: 'en-US',
  AU: 'en-US',
  KR: 'ko',
  IT: 'it',
  NL: 'nl',
};

export const PREBUILT_NEWS_LOCALES = (() => {
  const list = [];
  const seen = new Set();
  const add = (region, language) => {
    const key = `${region}:${language}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ region, language });
  };
  for (const region of REGIONS) add(region.id, REGION_LANGUAGE[region.id] || DEFAULT_LANGUAGE);
  add('IN', 'hi');
  add('CA', 'fr');
  for (const language of LANGUAGES) add(DEFAULT_REGION, language.id);
  return list;
})();

// KV keys the worker tries, in order, for a requested locale: the exact
// feed, the US edition in the same language, the region in its own
// language, then US English.
export function newsLocaleFallbacks(region, language) {
  const r = normalizeRegion(region);
  const l = normalizeLanguage(language);
  const keys = [];
  const add = (a, b) => {
    const key = `${a}:${b}`;
    if (!keys.includes(key)) keys.push(key);
  };
  add(r, l);
  add(DEFAULT_REGION, l);
  add(r, REGION_LANGUAGE[r] || DEFAULT_LANGUAGE);
  add(DEFAULT_REGION, DEFAULT_LANGUAGE);
  return keys;
}
