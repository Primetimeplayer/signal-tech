// scripts/fetch-news.js
// Pulls recent articles from dedicated tech RSS feeds, keeps stories that
// match the topic allow-list, and writes them to public/data/news.json.

import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { excerpt } from './lib/excerpt.js';
import { storyImage } from './lib/story-image.js';
import { applyLocaleParams } from './lib/news-locale.js';
import { splitGoogleTitle } from './lib/parse-google-news.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'news.json');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'signal-personal-dashboard/1.0 (+https://github.com/Primetimeplayer/tech-dashboard)',
    // Ask every feed for a fresh copy. A query-string cache buster 404s on
    // some publishers, so the request headers carry the TTL instead.
    'Cache-Control': 'no-cache, max-age=0',
    'Pragma': 'no-cache',
  },
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail'],
      ['description', 'description'],
    ],
  },
});

// Dedicated tech sources only. Google News is not added here.
const FEEDS = [
  { name: 'The Verge', category: 'news', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', category: 'news', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'TechCrunch', category: 'news', url: 'https://techcrunch.com/feed/' },
  { name: 'Wired', category: 'news', url: 'https://www.wired.com/feed/rss' },
  { name: 'The Register', category: 'news', url: 'https://www.theregister.com/headlines.atom' },
  { name: 'MIT Technology Review', category: 'news', url: 'https://www.technologyreview.com/feed/' },
  { name: "Tom's Hardware", category: 'news', url: 'https://www.tomshardware.com/feeds.xml' },
  { name: 'NASA', category: 'news', url: 'https://www.nasa.gov/news-release/feed/' },
  { name: 'Krebs on Security', category: 'news', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'GitHub Blog', category: 'news', url: 'https://github.blog/feed/' },
  { name: 'SpaceNews', category: 'news', url: 'https://spacenews.com/feed/' },
  { name: 'IEEE Spectrum', category: 'news', url: 'https://spectrum.ieee.org/feeds/feed.rss' },
  { name: 'PC Gamer', category: 'news', url: 'https://www.pcgamer.com/feeds.xml' },
];

export function buildNewsFeeds(region, language, baseFeeds = FEEDS) {
  return baseFeeds.map((feed) => ({
    ...feed,
    url: applyLocaleParams(feed.url, region, language),
  }));
}

// Software, AI, chips, gaming, space, cybersecurity, hardware, technology.
// A story is kept only when the title or summary clearly hits one of these.
// Broad words (security, model, game, hack, phone, review, funding, launch)
// are omitted so politics, crime, and lifestyle do not slip through.
const TOPIC_TERMS = [
  'software', 'developer', 'programmer', 'programming', 'open source', 'github',
  'devops', 'sdk', 'compiler', 'kubernetes', 'linux', 'api',
  'ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'claude',
  'grok', 'openai', 'chatbot', 'generative', 'neural network', 'language model',
  'chip', 'semiconductor', 'silicon', 'gpu', 'cpu', 'tpu', 'nvidia', 'amd', 'intel',
  'arm', 'foundry', 'wafer', 'process node',
  'gaming', 'gamer', 'video game', 'steam', 'playstation', 'xbox', 'nintendo', 'esports',
  'space', 'rocket', 'satellite', 'nasa', 'spacex', 'orbit', 'spacecraft', 'astronaut',
  'space station', 'spaceflight',
  'cybersecurity', 'cyber security', 'cyberattack', 'hacker', 'hacking', 'malware',
  'ransomware', 'vulnerability', 'encryption', 'encrypted', 'infosec', 'zero-day',
  'zero day', 'phishing', 'data breach',
  'hardware', 'gadget', 'laptop', 'smartphone', 'iphone', 'android', 'macbook',
  'data center', 'pc',
  'technology', 'robotics', 'robot', 'quantum',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termMatcher(term) {
  if (term === 'ai') return /\bai(?:'s|s)?\b|\ba\.i\.?\b/i;
  if (term === 'arm') return /\barm(?:64|v\d+|\d+)?\b/i;
  if (term === 'pc') return /\bpcs?\b|\bpcie\b/i;
  if (term === 'gpt') return /gpt/i;
  if (term === 'chip') return /\b(?:micro)?chips?(?:set)?\b/i;
  if (term === 'technology') return /\b(?:fin|bio|clean|deep|high[- ])?tech(?:nolog(?:y|ies))?\b/i;
  // "office space" and "parking space" are not the space topic.
  if (term === 'space') {
    return /\b(?<!office\s|green\s|safe\s|parking\s|breathing\s|white\s|public\s|floor\s|storage\s|shelf\s|crawl\s|personal\s|living\s|closet\s|retail\s)space(?:craft|flight|ship|suit|walk|s)?\b/i;
  }
  if (term === 'vulnerability') return /\bvulnerabilit(?:y|ies)\b/i;
  if (term === 'esports') return /\be-?sports?\b/i;
  if (term === 'api' || term === 'llm' || term === 'amd' || term === 'intel') {
    return new RegExp(`\\b${term}s?\\b`, 'i');
  }
  if (term.includes(' ')) {
    const words = term.split(/\s+/).map(escapeRegExp);
    const last = words.pop();
    const head = words.length ? `${words.join('[\\s-]+')}[\\s-]+` : '';
    return new RegExp(`\\b${head}${last}s?\\b`, 'i');
  }
  if (term.endsWith('y')) {
    return new RegExp(`\\b${escapeRegExp(term.slice(0, -1))}(?:y|ies)\\b`, 'i');
  }
  return new RegExp(`\\b${escapeRegExp(term)}s?\\b`, 'i');
}

const TOPIC_MATCHERS = TOPIC_TERMS.map(termMatcher);

export function storyMatchesTopics(item) {
  const title = item?.title || '';
  const summary = item?.summary || '';
  return TOPIC_MATCHERS.some((matcher) => matcher.test(title) || matcher.test(summary));
}

const ITEMS_PER_FEED = 12;

function cleanSummary(raw = '') {
  return excerpt(raw, 240);
}

async function fetchFeed(feed, parseFeed) {
  try {
    const parsed = await parseFeed(feed);
    const google = feed.url.includes('news.google.com');
    return parsed.items.slice(0, ITEMS_PER_FEED).map((item) => {
      const image = storyImage(item);
      const rawTitle = item.title?.trim() || '(untitled)';
      const headline = google ? splitGoogleTitle(rawTitle) : { title: rawTitle, source: feed.name };
      const rawSummary = item.contentSnippet ?? item.content ?? '';
      const summary = google ? '' : cleanSummary(rawSummary);
      return {
        source: headline.source,
        category: feed.category,
        title: headline.title,
        link: item.link,
        published: item.pubDate ?? item.isoDate ?? null,
        summary,
        ...(image ? { image } : {}),
      };
    });
  } catch (err) {
    console.error(`[fetch-news] Failed to fetch ${feed.name}: ${err.message}`);
    return null;
  }
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.title || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runNewsFetcher({
  feeds,
  region = process.env.SIGNAL_REGION,
  language = process.env.SIGNAL_LANGUAGE,
  parseFeed = (feed) => parser.parseURL(feed.url),
  outputPath = OUT_PATH,
  now = () => new Date(),
} = {}) {
  const list = feeds || buildNewsFeeds(region, language);
  console.log(`[fetch-news] Fetching ${list.length} feeds...`);
  const feedResults = await Promise.all(list.map((feed) => fetchFeed(feed, parseFeed)));
  const successfulFeeds = feedResults.filter((items) => items !== null);
  if (!successfulFeeds.length) {
    throw new Error('All news feeds failed; keeping existing data.');
  }

  const results = successfulFeeds.flat();
  const items = dedupe(results)
    .filter(storyMatchesTopics)
    .sort((a, b) => new Date(b.published ?? 0) - new Date(a.published ?? 0));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      { updated: now().toISOString(), count: items.length, items },
      null,
      2
    )
  );
  console.log(`[fetch-news] Wrote ${items.length} topic items to ${outputPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runNewsFetcher().catch((err) => {
    console.error('[fetch-news] Failed:', err.message);
    process.exit(1);
  });
}
