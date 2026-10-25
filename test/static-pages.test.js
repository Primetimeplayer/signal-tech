import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SITE, sanitiseHtml, extractPostBody, mergeArchive, parseDigest, buildFeed, buildSitemap,
  readChrome, newsletterBox,
} from '../scripts/build-static-pages.js';

test('sanitiseHtml keeps safe tags and http(s) links only', () => {
  const out = sanitiseHtml('<h1 class="x">Hi</h1><script>alert(1)</script><p style="c" onclick="x()">A <a href="javascript:alert(1)">bad</a> <a href="https://example.com/a?b=1&amp;c=2">good</a></p><img src="x.png"><iframe src="y"></iframe>');
  assert.match(out, /<h2>Hi<\/h2>/);
  assert.doesNotMatch(out, /script|onclick|style=|javascript:|<img|<iframe/i);
  assert.match(out, /<p>A bad <a href="https:\/\/example\.com\/a\?b=1&amp;c=2" rel="noopener">good<\/a><\/p>/);
});

test('extractPostBody stops at "Keep reading" and needs real text', () => {
  const text = 'Real issue text. '.repeat(20);
  const page = `<main><div id="content-blocks"><p>${text}</p><h3><span>Keep reading</span></h3><p>Other post</p></div></main>`;
  const body = extractPostBody(page);
  assert.match(body, /Real issue text/);
  assert.doesNotMatch(body, /Other post|Keep reading/);
  assert.equal(extractPostBody('<div id="content-blocks"><p>Too short</p></div>'), '');
  assert.equal(extractPostBody('<p>No content blocks</p>'), '');
});

test('mergeArchive never drops old issues and keeps fetched text', () => {
  const archive = { issues: [{ date: '2026-01-02', url: 'https://x.beehiiv.com/p/a', title: 'Old', html: '<p>kept</p>', fetchedAt: '2026-01-02T09:00:00Z' }] };
  const merged = mergeArchive(archive, [
    { date: '2026-01-09', url: 'https://x.beehiiv.com/p/b', title: 'New', issueNumber: 2, stories: [] },
    { date: '2026-01-02', url: 'https://x.beehiiv.com/p/a', title: 'Old (edited)', issueNumber: 1, stories: [] },
    { date: 'not-a-date', url: 'https://x.beehiiv.com/p/c', title: 'Bad' },
  ]);
  assert.deepEqual(merged.issues.map((i) => i.date), ['2026-01-09', '2026-01-02']);
  assert.equal(merged.issues[1].html, '<p>kept</p>');
  assert.equal(merged.issues[1].title, 'Old (edited)');
});

test('parseDigest reads sections and items', () => {
  const d = parseDigest('# Signal Weekly\n*Jan 1–Jan 8, 2026*\nIntro line\n## Tech news\n- **[A story](https://example.com/a)** (The Register) — Why it matters\n---\nOutro');
  assert.equal(d.title, 'Signal Weekly');
  assert.equal(d.range, 'Jan 1–Jan 8, 2026');
  assert.deepEqual(d.intro, ['Intro line']);
  assert.equal(d.sections[0].items[0].source, 'The Register');
  assert.deepEqual(d.outro, ['Outro']);
});

test('feed and sitemap are valid-looking and deterministic', () => {
  const issues = [{ issueNumber: 1, title: 'A & B', date: '2026-01-02', stories: [] }];
  const digests = [{ id: '2026-01-05', title: 'Weekly', generatedAt: '2026-01-05T14:00:00Z', dateRange: 'Dec 29–Jan 5', itemCount: 9 }];
  const feed = buildFeed(issues, digests);
  assert.equal(feed, buildFeed(issues, digests));
  assert.match(feed, /<title>Issue #1: A &amp; B<\/title>/);
  assert.match(feed, new RegExp(`<link>${SITE}/digests/2026-01-05</link>`));
  assert.ok(feed.indexOf('2026-01-05') < feed.indexOf('/issues/2026-01-02'), 'newest item first');
  assert.match(feed, /<lastBuildDate>Mon, 05 Jan 2026 14:00:00 GMT<\/lastBuildDate>/);
  const map = buildSitemap([{ loc: `${SITE}/`, lastmod: '2026-01-05' }]);
  assert.match(map, /<loc>https:\/\/signaltechnews\.com\/<\/loc>\n {4}<lastmod>2026-01-05<\/lastmod>/);
});

test('newsletterBox adds the Friday copy and a UTM-tagged beehiiv link', () => {
  const chrome = readChrome(fs.readFileSync(new URL('../public/digests.html', import.meta.url), 'utf8'));
  const box = newsletterBox(chrome, 'issue_page');
  assert.match(box, /<h2 id="newsletterTitle">Get Signal Tech every Friday<\/h2>/);
  assert.match(box, /One big story, quick hits and a Tool of the Week\. Free, 5-minute read\./);
  assert.match(box, /embeds\.beehiiv\.com/);
  assert.match(box, /href="https:\/\/dailysignaltech\.beehiiv\.com\/subscribe\?utm_source=signaltechnews&amp;utm_medium=issue_page&amp;utm_campaign=signup_box"/);
  assert.match(box, /<\/p>\n  <\/section>$/);
});

test('newsletter copy uses the current format everywhere', () => {
  for (const file of ['../public/index.html', '../public/digests.html', '../public/issues.html', '../scripts/build-static-pages.js']) {
    const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /sourced stories|practical takeaway/i, file);
  }
  assert.match(fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /one big story, quick hits and a Tool of the Week/);
});
