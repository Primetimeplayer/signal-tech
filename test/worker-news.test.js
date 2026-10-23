import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../cloudflare-worker/worker.js';
import {
  googleNewsUrl,
  newsLocaleFallbacks,
  normalizeLanguage,
  normalizeRegion,
  PREBUILT_NEWS_LOCALES,
} from '../scripts/lib/news-locale.js';
import { collectFeeds, pushFeeds } from '../scripts/push-news-locales.js';

const SITE = 'https://signaltechnews.com';
const TOKEN = 'test-ingest-token';

function memoryKv() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value, options) { map.set(key, value); map.set(`ttl:${key}`, options && options.expirationTtl); },
  };
}

function env(extra = {}) {
  return {
    SAVED_KV: memoryKv(),
    NEWS_INGEST_TOKEN: TOKEN,
    ALLOWED_ORIGIN: 'https://signaltechnews.com,https://primetimeplayer.github.io',
    SITE_URL: 'https://signaltechnews.com/',
    GOOGLE_CLIENT_ID: 'client-id',
    ...extra,
  };
}

function item(n) {
  return { title: `Story ${n}`, link: `https://example.com/${n}`, source: 'Example', published: '2026-10-23T08:00:00.000Z' };
}

function ingest(e, body, token = TOKEN) {
  return worker.fetch(new Request(`${SITE}/api/news/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), e);
}

function news(e, region, language) {
  return worker.fetch(new Request(`${SITE}/api/news?region=${region}&language=${language}`), e);
}

test('prebuilt locale list has 27 unique, valid feeds', () => {
  assert.equal(PREBUILT_NEWS_LOCALES.length, 27);
  const keys = PREBUILT_NEWS_LOCALES.map((l) => `${l.region}:${l.language}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const { region, language } of PREBUILT_NEWS_LOCALES) {
    assert.equal(normalizeRegion(region), region);
    assert.equal(normalizeLanguage(language), language);
  }
  for (const key of ['US:en-US', 'DE:de', 'JP:ja', 'IN:hi', 'CA:fr', 'US:zh-CN', 'INT:en-US']) {
    assert.ok(keys.includes(key), key);
  }
});

test('fallback order: exact, US same language, region language, US English', () => {
  assert.deepEqual(newsLocaleFallbacks('DE', 'fr'), ['DE:fr', 'US:fr', 'DE:de', 'US:en-US']);
  assert.deepEqual(newsLocaleFallbacks('US', 'en-US'), ['US:en-US']);
  assert.deepEqual(newsLocaleFallbacks('xx', 'yy'), ['US:en-US']);
});

test('GET /api/news fails fast with 503 when nothing is stored', async () => {
  const started = Date.now();
  const res = await news(env(), 'US', 'en-US');
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.ok(Date.now() - started < 200);
});

test('ingest rejects missing or wrong tokens and unconfigured workers', async () => {
  const body = { feeds: [{ region: 'US', language: 'en-US', items: [item(1)] }] };
  assert.equal((await ingest(env(), body, '')).status, 401);
  assert.equal((await ingest(env(), body, 'wrong-token-value')).status, 401);
  assert.equal((await ingest(env({ NEWS_INGEST_TOKEN: '' }), body, 'anything')).status, 503);
  const get = await worker.fetch(new Request(`${SITE}/api/news/ingest`), env());
  assert.equal(get.status, 405);
});

test('ingest validates the body', async () => {
  const e = env();
  assert.equal((await ingest(e, 'not json')).status, 400);
  assert.equal((await ingest(e, { feeds: [] })).status, 400);
  assert.equal((await ingest(e, 'x'.repeat(1024 * 1024 + 1))).status, 413);
  const res = await ingest(e, { feeds: [
    { region: 'XX', language: 'en-US', items: [item(1)] },
    { region: 'US', language: 'en-US', items: [{ title: 'no link' }] },
  ] });
  assert.equal(res.status, 400);
  assert.deepEqual((await res.json()).rejected, ['XX:en-US', 'US:en-US']);
  assert.equal(e.SAVED_KV.map.size, 0);
});

test('ingest stores feeds and GET serves them with the fallback order', async () => {
  const e = env();
  const res = await ingest(e, { feeds: [
    { region: 'US', language: 'en-US', feedUrl: googleNewsUrl('US', 'en-US'), updated: '2026-10-23T10:00:00.000Z', items: [item(1), item(2)] },
    { region: 'US', language: 'fr', items: [item(3)] },
    { region: 'DE', language: 'de', items: Array.from({ length: 80 }, (_, i) => item(i)) },
  ] });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, { ok: true, stored: ['US:en-US', 'US:fr', 'DE:de'], rejected: [] });
  assert.equal(e.SAVED_KV.map.get('ttl:news:v1:US:en-US'), 259200);

  const exact = await news(e, 'US', 'en-US');
  assert.equal(exact.status, 200);
  assert.equal(exact.headers.get('X-News-Locale'), 'US:en-US');
  assert.equal(exact.headers.get('Cache-Control'), 'public, max-age=300');
  const payload = await exact.json();
  assert.equal(payload.source, 'prebuilt');
  assert.equal(payload.updated, '2026-10-23T10:00:00.000Z');
  assert.deepEqual(payload.items.map((i) => i.title), ['Story 1', 'Story 2']);

  assert.equal((await news(e, 'DE', 'de')).headers.get('X-News-Locale'), 'DE:de');
  assert.equal((await (await news(e, 'DE', 'de')).json()).items.length, 50);
  assert.equal((await news(e, 'DE', 'fr')).headers.get('X-News-Locale'), 'US:fr');
  assert.equal((await news(e, 'DE', 'ja')).headers.get('X-News-Locale'), 'DE:de');
  assert.equal((await news(e, 'JP', 'ko')).headers.get('X-News-Locale'), 'US:en-US');
});

test('sign-in uses the callback on the host that started it', async () => {
  const e = env({ SIGNAL_DB: { prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) } });
  for (const origin of [SITE, 'https://signal-sync.primetimeplayer-signal-sync.workers.dev']) {
    const res = await worker.fetch(new Request(`${origin}/auth/google`), e);
    assert.equal(res.status, 302);
    const location = new URL(res.headers.get('Location'));
    assert.equal(location.hostname, 'accounts.google.com');
    assert.equal(location.searchParams.get('redirect_uri'), `${origin}/auth/callback`);
  }
});

test('sign-out returns to the site root, not /tech-dashboard/', async () => {
  const e = env({ SIGNAL_DB: { prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) } });
  const res = await worker.fetch(new Request(`${SITE}/auth/logout`), e);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), 'https://signaltechnews.com/');
});

test('account CORS allows each listed origin and nothing else', async () => {
  const e = env();
  for (const origin of ['https://signaltechnews.com', 'https://primetimeplayer.github.io']) {
    const res = await worker.fetch(new Request(`${SITE}/api/me`, { method: 'OPTIONS', headers: { Origin: origin } }), e);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
  }
  const bad = await worker.fetch(new Request(`${SITE}/api/me`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), e);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
});

test('push script fetches each locale and posts one authenticated batch', async () => {
  const xml = '<rss><channel><item><title>Big story - Example</title><link>https://news.google.com/a</link><pubDate>Fri, 23 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>';
  const seen = [];
  const fakeGoogle = async (url) => {
    seen.push(url);
    if (url.includes('ceid=JP:ja')) return new Response('nope', { status: 503 });
    return new Response(xml, { status: 200 });
  };
  const locales = [{ region: 'US', language: 'en-US' }, { region: 'JP', language: 'ja' }, { region: 'DE', language: 'de' }];
  const { feeds, failed } = await collectFeeds(locales, fakeGoogle);
  assert.equal(seen.length, 3);
  assert.deepEqual(failed.map((f) => f.key), ['JP:ja']);
  assert.equal(feeds.length, 2);
  assert.equal(feeds[0].items[0].title, 'Big story');

  const e = env();
  const viaWorker = (url, init) => worker.fetch(new Request(url, init), e);
  const result = await pushFeeds(feeds, { url: `${SITE}/api/news/ingest`, token: TOKEN }, viaWorker);
  assert.deepEqual(result.stored.sort(), ['DE:de', 'US:en-US']);
  await assert.rejects(pushFeeds(feeds, { url: `${SITE}/api/news/ingest`, token: 'bad' }, viaWorker), /ingest 401/);
});
