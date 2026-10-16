import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Parser from 'rss-parser';

import { runNewsFetcher, storyMatchesTopics } from '../scripts/fetch-news.js';
import { runReviewsFetcher } from '../scripts/fetch-reviews.js';
import { runRedditFetcher } from '../scripts/fetch-reddit.js';
import { runPapersFetcher } from '../scripts/fetch-papers.js';
import { excerpt } from '../scripts/lib/excerpt.js';
import { storyImage } from '../scripts/lib/story-image.js';

const FIXED_TIME = '2025-01-02T03:04:05.000Z';
const TEST_OPTIONS = { now: () => new Date(FIXED_TIME) };

async function createOutput(t, filename) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tech-dashboard-fetcher-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return path.join(directory, filename);
}

async function seedOutput(t, filename) {
  const outputPath = await createOutput(t, filename);
  const sentinel = `existing ${filename} data\nwith distinctive bytes\0`;
  await writeFile(outputPath, sentinel);
  return { outputPath, sentinel };
}

async function readJson(outputPath) {
  return JSON.parse(await readFile(outputPath, 'utf8'));
}

const rssFixture = await readFile(new URL('./fixtures/rss-sample.xml', import.meta.url), 'utf8');
const rssParser = new Parser();

test('news preserves existing output when every feed request fails', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'news.json');

  await assert.rejects(
    runNewsFetcher({
      ...TEST_OPTIONS,
      outputPath,
      feeds: [{ name: 'Fixture News', category: 'news', url: 'https://fixture.invalid/rss' }],
      parseFeed: async () => { throw new Error('simulated offline request'); },
    }),
    /All news feeds failed; keeping existing data\./
  );

  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});

test('news drops fixture stories that sit outside the topic allow-list', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'news.json');
  let requestedFeed;

  await runNewsFetcher({
    ...TEST_OPTIONS,
    outputPath,
    feeds: [{ name: 'Fixture News', category: 'news', url: 'https://fixture.invalid/rss' }],
    parseFeed: async (feed) => {
      requestedFeed = feed;
      return rssParser.parseString(rssFixture);
    },
  });

  assert.notEqual(await readFile(outputPath, 'utf8'), sentinel);
  const result = await readJson(outputPath);
  assert.equal(requestedFeed.name, 'Fixture News');
  assert.equal(result.updated, FIXED_TIME);
  assert.equal(result.count, 0);
  assert.deepEqual(result.items, []);
});

test('news keeps topic stories, including a summary-only match, and sorts by date', async (t) => {
  const outputPath = await createOutput(t, 'news.json');

  await runNewsFetcher({
    ...TEST_OPTIONS,
    outputPath,
    feeds: [{ name: 'Fixture News', category: 'news', url: 'https://fixture.invalid/rss' }],
    parseFeed: async () => ({
      items: [
        {
          title: 'Email from the farm',
          link: 'https://fixture.example/articles/farm',
          pubDate: 'Fri, 03 Jan 2025 18:00:00 GMT',
          contentSnippet: 'A campaign said the army would remodel the barn.',
        },
        {
          title: 'Weekly roundup',
          link: 'https://fixture.example/articles/roundup',
          pubDate: 'Fri, 03 Jan 2025 12:00:00 GMT',
          contentSnippet: 'Ransomware hit a hospital network.',
        },
        {
          title: 'OpenAI releases a coding model',
          link: 'https://fixture.example/articles/ai',
          pubDate: 'Wed, 01 Jan 2025 12:00:00 GMT',
          contentSnippet: 'A short note about the model.',
        },
        {
          title: 'Nvidia ships a new GPU',
          link: 'https://fixture.example/articles/gpu',
          pubDate: 'Tue, 31 Dec 2024 12:00:00 GMT',
          contentSnippet: 'The chip is built for developers.',
        },
      ],
    }),
  });

  const result = await readJson(outputPath);
  assert.equal(result.updated, FIXED_TIME);
  assert.equal(result.count, 3);
  assert.deepEqual(result.items.map((item) => item.title), [
    'Weekly roundup',
    'OpenAI releases a coding model',
    'Nvidia ships a new GPU',
  ]);
  assert.equal(result.items[0].summary, 'Ransomware hit a hospital network.');
  assert.equal(result.items[2].category, 'news');
  assert.equal(result.items[2].source, 'Fixture News');
  assert.equal(result.items[2].link, 'https://fixture.example/articles/gpu');
  assert.equal(result.items[2].summary, 'The chip is built for developers.');
});

test('topic allow-list matches words, not substrings inside unrelated words', () => {
  const matches = (title, summary = '') => storyMatchesTopics({ title, summary });

  assert.equal(matches('Email from the farm'), false);
  assert.equal(matches('The army armed the camp'), false);
  assert.equal(matches('A campaign said it was available'), false);
  assert.equal(matches('Intelligence agencies remodel the encoder'), false);
  assert.equal(matches('Barcode saxophone and chipotle'), false);
  assert.equal(matches('Namespace spec for the card catalog'), false);

  assert.equal(matches('OpenAI ships a model'), true);
  assert.equal(matches('A.I. researchers train an LLM'), true);
  assert.equal(matches('ChatGPT codes on ARM64 and PCIe'), true);
  assert.equal(matches('Intel launches a CPU'), true);
  assert.equal(matches('Cybersecurity teams patch vulnerabilities'), true);
  assert.equal(matches('iPhone review covers the new chipset'), true);
  assert.equal(matches('Open-source libraries for data centers'), true);
  assert.equal(matches('E-sports league uses a quantum startup'), true);
  assert.equal(matches('Fintech funding hits a new process node'), true);
  assert.equal(matches('Weekly roundup', 'A ransomware breach'), true);
  assert.equal(matches(''), false);
});

test('reviews preserves existing output when every feed request fails', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'reviews.json');

  await assert.rejects(
    runReviewsFetcher({
      ...TEST_OPTIONS,
      outputPath,
      feeds: [{ name: 'Fixture Reviews', url: 'https://fixture.invalid/reviews.xml' }],
      parseFeed: async () => { throw new Error('simulated offline request'); },
    }),
    /All review feeds failed; keeping existing data\./
  );

  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});

test('reviews writes parsed fixture data after a successful feed request', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'reviews.json');

  await runReviewsFetcher({
    ...TEST_OPTIONS,
    outputPath,
    feeds: [{ name: 'Fixture Reviews', url: 'https://fixture.invalid/reviews.xml' }],
    parseFeed: async () => rssParser.parseString(rssFixture),
  });

  assert.notEqual(await readFile(outputPath, 'utf8'), sentinel);
  const result = await readJson(outputPath);
  assert.equal(result.updated, FIXED_TIME);
  assert.equal(result.count, 2);
  assert.equal(result.items[0].source, 'Fixture Reviews');
  assert.equal(result.items[0].title, 'Fixture article');
  assert.equal(result.items[0].category, undefined);
});

test('Reddit preserves existing output when every subreddit request fails', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'reddit.json');

  await assert.rejects(
    runRedditFetcher({
      ...TEST_OPTIONS,
      outputPath,
      subreddits: ['fixture'],
      request: async () => { throw new Error('simulated offline request'); },
    }),
    /All subreddit requests failed; keeping existing data\./
  );

  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});

test('Reddit writes successful mocked posts and filters stickied posts', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'reddit.json');
  let requestedUrl;
  const posts = [
    {
      stickied: false,
      title: 'Fixture Reddit post',
      permalink: '/r/fixture/comments/one',
      created_utc: 1735732800,
      selftext: 'A deterministic post body.',
      ups: 10,
      num_comments: 2,
    },
    {
      stickied: true,
      title: 'Pinned post should be omitted',
      permalink: '/r/fixture/comments/pinned',
      created_utc: 1735732800,
      selftext: '',
      ups: 20,
      num_comments: 4,
    },
  ];

  await runRedditFetcher({
    ...TEST_OPTIONS,
    outputPath,
    subreddits: ['fixture'],
    request: async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => ({ data: { children: posts.map((data) => ({ data })) } }) };
    },
  });

  assert.notEqual(await readFile(outputPath, 'utf8'), sentinel);
  const result = await readJson(outputPath);
  assert.match(requestedUrl, /\/r\/fixture\/top\/\.json\?/);
  assert.equal(result.updated, FIXED_TIME);
  assert.equal(result.count, 1);
  assert.equal(result.items[0].source, 'r/fixture');
  assert.equal(result.items[0].title, 'Fixture Reddit post');
  assert.equal(result.items[0].link, 'https://reddit.com/r/fixture/comments/one');
  assert.equal(result.items[0].summary, 'A deterministic post body.');
});

test('Reddit uses the vote line when a post has no body', async (t) => {
  const outputPath = await createOutput(t, 'reddit.json');

  await runRedditFetcher({
    ...TEST_OPTIONS,
    outputPath,
    subreddits: ['fixture'],
    request: async () => ({
      ok: true,
      json: async () => ({
        data: {
          children: [{
            data: {
              stickied: false,
              title: 'Link post',
              permalink: '/r/fixture/comments/link',
              created_utc: 1735732800,
              selftext: '   ',
              ups: 10,
              num_comments: 2,
            },
          }],
        },
      }),
    }),
  });

  const result = await readJson(outputPath);
  assert.equal(result.items[0].summary, '10 upvotes · 2 comments');
});

test('excerpts keep short text and only ellipsize real cutoffs', () => {
  assert.equal(excerpt(''), '');
  assert.equal(excerpt('Hello world.'), 'Hello world.');
  const long = 'alpha '.repeat(80).trim();
  const cut = excerpt(long, 40);
  assert.ok(cut.endsWith('…'));
  assert.ok(cut.length < long.length);
  assert.equal(cut.includes('alpha'), true);
  assert.equal(cut.slice(0, -1).endsWith(' '), false);
});

test('story images keep http(s) pictures and drop everything else', () => {
  assert.equal(storyImage({}), '');
  assert.equal(storyImage({ thumbnail: 'self' }), '');
  assert.equal(storyImage({ thumbnail: 'javascript:alert(1)' }), '');
  assert.equal(
    storyImage({ enclosure: { url: 'https://cdn.example/a.jpg', type: 'image/jpeg' } }),
    'https://cdn.example/a.jpg'
  );
  assert.equal(
    storyImage({ enclosure: { url: 'https://cdn.example/audio.mp3', type: 'audio/mpeg' } }),
    ''
  );
  assert.equal(
    storyImage({ 'media:thumbnail': { $: { url: 'https://cdn.example/thumb.jpg' } } }),
    'https://cdn.example/thumb.jpg'
  );
  assert.equal(
    storyImage({ content: '<p>Hi</p><img src="https://cdn.example/body.jpg&amp;w=80" alt="">' }),
    'https://cdn.example/body.jpg&w=80'
  );
  assert.equal(
    storyImage({ description: '<img src="https://cdn.example/d.jpg?a=1&#038;b=2">' }),
    'https://cdn.example/d.jpg?a=1&b=2'
  );
});

test('papers writes a valid mocked arXiv response', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'papers.json');
  const xml = await readFile(new URL('./fixtures/arxiv-success.xml', import.meta.url), 'utf8');
  let requestedUrl;

  await runPapersFetcher({
    ...TEST_OPTIONS,
    outputPath,
    request: async (url) => {
      requestedUrl = url;
      return { ok: true, text: async () => xml };
    },
  });

  assert.notEqual(await readFile(outputPath, 'utf8'), sentinel);
  const result = await readJson(outputPath);
  assert.match(requestedUrl, /^http:\/\/export\.arxiv\.org\/api\/query\?/);
  assert.equal(result.updated, FIXED_TIME);
  assert.equal(result.count, 1);
  assert.equal(result.items[0].title, 'Fixture paper title');
  assert.equal(result.items[0].link, 'https://arxiv.org/abs/2501.00001');
  assert.deepEqual(result.items[0].authors, ['Example Author']);
  assert.deepEqual(result.items[0].categories, ['cs.AI']);
  assert.equal(result.items[0].summary, 'A deterministic paper abstract for fetcher tests.');
});

test('papers preserves existing output after an HTTP/API failure', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'papers.json');

  await assert.rejects(
    runPapersFetcher({
      ...TEST_OPTIONS,
      outputPath,
      request: async () => ({ ok: false, status: 503 }),
    }),
    /arXiv API returned 503/
  );

  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});

test('papers preserves existing output after malformed XML', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'papers.json');
  const xml = await readFile(new URL('./fixtures/arxiv-malformed.xml', import.meta.url), 'utf8');

  await assert.rejects(
    runPapersFetcher({
      ...TEST_OPTIONS,
      outputPath,
      request: async () => ({ ok: true, text: async () => xml }),
    })
  );

  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});

test('papers preserves existing output after an invalid result count', async (t) => {
  const { outputPath, sentinel } = await seedOutput(t, 'papers.json');
  const xml = await readFile(new URL('./fixtures/arxiv-invalid-count.xml', import.meta.url), 'utf8');

  await assert.rejects(
    runPapersFetcher({
      ...TEST_OPTIONS,
      outputPath,
      request: async () => ({ ok: true, text: async () => xml }),
    }),
    /invalid total result count/
  );

  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});
