import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEEDS as NEWS_FEEDS } from '../scripts/fetch-news.js';
import { FEEDS as REVIEW_FEEDS } from '../scripts/fetch-reviews.js';
import { CATEGORIES } from '../scripts/fetch-papers.js';
import { SUBREDDITS } from '../scripts/fetch-reddit.js';

test('methodology page lists configured sources and the real score', () => {
  const html = fs.readFileSync(new URL('../public/methodology.html', import.meta.url), 'utf8');
  assert.match(html, /rel="canonical" href="https:\/\/signaltechnews\.com\/methodology"/);
  assert.match(html, /Innocent Ncube, based in Poland/);
  assert.match(html, /no boosts for particular people or companies/);
  assert.match(html, /simple score that favours recent stories/);
  assert.doesNotMatch(html, /scripts\/fetch-news\.js|score\.js|\+28/);
  assert.match(html, /Why it matters/);
  assert.equal(NEWS_FEEDS.length, 22);
  assert.match(html, /News feeds \(22\)/);
  assert.equal(html.includes('nasa.gov'), false);
  assert.equal(html.includes('spacenews.com'), false);
  for (const feed of NEWS_FEEDS) assert.ok(html.includes(feed.url), feed.name);
  for (const feed of REVIEW_FEEDS) assert.ok(html.includes(feed.url), feed.name);
  for (const code of CATEGORIES) assert.ok(html.includes(code), code);
  for (const sub of SUBREDDITS) assert.ok(html.includes(`r/${sub}`), sub);
  assert.equal(html.includes('Hacker News'), false);
  assert.match(html, /embeds\.beehiiv\.com\/272d8e40-805d-4008-b4c0-75c73e67d0ef/);
});
