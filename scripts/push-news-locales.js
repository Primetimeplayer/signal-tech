#!/usr/bin/env node
// Fetch the Google News locale feeds on the GitHub Actions runner and push
// them to the worker's KV store through POST /api/news/ingest. Google News
// does not answer requests from Cloudflare Workers, so the worker no longer
// fetches it live; it serves what this script stores.
//
// Env:
//   NEWS_INGEST_TOKEN  required. Same value as the worker secret. If it is
//                      missing the script logs and exits 0 (forks, local runs).
//   NEWS_INGEST_URL    optional. Defaults to the workers.dev ingest URL,
//                      which works with or without the domain routes.

import { pathToFileURL } from 'node:url';
import { googleNewsUrl, PREBUILT_NEWS_LOCALES } from './lib/news-locale.js';
import { parseGoogleNewsXml } from './lib/parse-google-news.js';

export const DEFAULT_INGEST_URL = 'https://signal-sync.primetimeplayer-signal-sync.workers.dev/api/news/ingest';
const FETCH_MS = 10000;
const PUSH_MS = 20000;
const CONCURRENCY = 4;
const USER_AGENT = 'Mozilla/5.0 (compatible; SignalTechBot/1.0; +https://signaltechnews.com/)';

export async function fetchLocale({ region, language }, request = fetch) {
  const feedUrl = googleNewsUrl(region, language);
  const response = await request(feedUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_MS),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  });
  if (!response.ok) throw new Error(`Google News ${response.status}`);
  const xml = await response.text();
  if (!/<(rss|feed|item)\b/i.test(xml)) throw new Error('Google News returned invalid XML');
  const items = parseGoogleNewsXml(xml);
  if (!items.length) throw new Error('Google News returned no items');
  return { region, language, feedUrl, updated: new Date().toISOString(), items };
}

export async function collectFeeds(locales = PREBUILT_NEWS_LOCALES, request = fetch) {
  const feeds = [];
  const failed = [];
  let next = 0;
  async function worker() {
    while (next < locales.length) {
      const locale = locales[next++];
      try {
        feeds.push(await fetchLocale(locale, request));
      } catch (err) {
        failed.push({ key: `${locale.region}:${locale.language}`, error: (err && err.message) || String(err) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, locales.length) }, worker));
  return { feeds, failed };
}

export async function pushFeeds(feeds, { url = DEFAULT_INGEST_URL, token }, request = fetch) {
  const response = await request(url, {
    method: 'POST',
    signal: AbortSignal.timeout(PUSH_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ feeds }),
  });
  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(`ingest ${response.status}: ${(data && data.error) || 'no JSON body'}`);
  }
  return data;
}

async function main() {
  const token = process.env.NEWS_INGEST_TOKEN || '';
  const url = process.env.NEWS_INGEST_URL || DEFAULT_INGEST_URL;
  if (!token) {
    console.log('NEWS_INGEST_TOKEN is not set; skipping the news push.');
    return;
  }
  const { feeds, failed } = await collectFeeds();
  for (const f of failed) console.warn(`  ${f.key} failed: ${f.error}`);
  console.log(`Fetched ${feeds.length}/${feeds.length + failed.length} Google News feeds.`);
  if (!feeds.length) {
    process.exitCode = 1;
    return;
  }
  const result = await pushFeeds(feeds, { url, token });
  console.log(`Stored ${result.stored.length} feeds in the worker.`);
  if (result.rejected && result.rejected.length) {
    console.warn(`Rejected: ${result.rejected.join(', ')}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error('News push failed:', (err && err.message) || err);
    process.exitCode = 1;
  });
}
