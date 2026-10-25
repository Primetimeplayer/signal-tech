import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Parser from 'rss-parser';

import { cleanTitle } from '../scripts/lib/clean-title.js';
import { runNewsFetcher } from '../scripts/fetch-news.js';
import { parseGoogleNewsXml } from '../scripts/lib/parse-google-news.js';

const REGISTER_ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Register</title>
  <entry>
    <title type="html">&lt;span data-lab-italic_desktop=&quot;italic&quot; class=&quot;italic m-italic&quot;&gt;Reg&lt;/span&gt; readers land on &amp;apos;Binface&amp;apos; as name for UK space cleanup mission</title>
    <link href="https://www.theregister.com/2026/10/25/binface/"/>
    <updated>2026-10-25T10:00:00Z</updated>
    <summary type="html">A space junk satellite gets a name.</summary>
  </entry>
</feed>`;

test('cleanTitle strips feed markup and decodes entities', () => {
  assert.equal(
    cleanTitle('<span data-lab-italic_desktop="italic" class="italic m-italic">Reg</span> readers land on &apos;Binface&apos;'),
    "Reg readers land on 'Binface'",
  );
  assert.equal(cleanTitle('&lt;em&gt;Doom&lt;/em&gt; runs on a fridge'), 'Doom runs on a fridge');
  assert.equal(cleanTitle('AT&amp;amp;T &#8217;s 5G'), 'AT&T \u2019s 5G');
  assert.equal(cleanTitle('Chip<br>news'), 'Chip news');
  assert.equal(cleanTitle('<img src=x onerror=alert(1)>Chip <b>news</b>'), 'Chip news');
  assert.equal(cleanTitle('  <span></span>  '), '');
});

test('cleanTitle keeps angle brackets that are not HTML tags', () => {
  assert.equal(cleanTitle('Rust &lt;T&gt; generics and why a < b > c'), 'Rust <T> generics and why a < b > c');
  assert.equal(cleanTitle('Plain headline'), 'Plain headline');
});

test('news fetcher stores The Register atom title without markup', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'signal-clean-title-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, 'news.json');
  const parser = new Parser();
  await runNewsFetcher({
    outputPath,
    now: () => new Date('2026-10-25T12:00:00Z'),
    feeds: [{ name: 'The Register', category: 'news', url: 'https://fixture.invalid/headlines.atom' }],
    parseFeed: () => parser.parseString(REGISTER_ATOM),
  });
  const data = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].title, "Reg readers land on 'Binface' as name for UK space cleanup mission");
  assert.doesNotMatch(JSON.stringify(data), /<span|data-lab/);
});

test('Google News items pushed to KV have plain-text titles', () => {
  const xml = `<rss><channel><item>
    <title>&lt;b&gt;Nvidia&lt;/b&gt; ships a new GPU &amp;amp; driver - The Example</title>
    <link>https://news.google.com/articles/abc</link>
    <pubDate>Sun, 25 Oct 2026 10:00:00 GMT</pubDate>
  </item></channel></rss>`;
  const [item] = parseGoogleNewsXml(xml);
  assert.equal(item.title, 'Nvidia ships a new GPU & driver');
  assert.equal(item.source, 'The Example');
});

test('the browser copy of the title rules matches scripts/lib/clean-title.js', async () => {
  const lib = await readFile(new URL('../scripts/lib/clean-title.js', import.meta.url), 'utf8');
  const home = await readFile(new URL('../public/assets/home.js', import.meta.url), 'utf8');
  const libTag = lib.match(/const HTML_TAG = (\/.+\/gi);/)[1];
  const homeTag = home.match(/const TITLE_TAG = (\/.+\/gi);/)[1];
  assert.equal(homeTag, libTag);
});
