import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { alreadySummarized, processFile } from '../scripts/summarize.js';

test('alreadySummarized requires both summary and whyItMatters', () => {
  assert.equal(alreadySummarized({ summary: 'Done.', whyItMatters: 'Because.' }), true);
  assert.equal(alreadySummarized({ summary: 'Excerpt only.' }), false);
  assert.equal(alreadySummarized({ summary: '   ', whyItMatters: 'Because.' }), false);
  assert.equal(alreadySummarized({ whyItMatters: 'Because.' }), false);
});

test('summarize skips items that already have both notes and still calls for fresh ones', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'summarize-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const original = {
    items: [
      { title: 'Already done', summary: 'Kept summary.', whyItMatters: 'Kept reason.' },
      { title: 'Fresh excerpt', summary: 'Raw excerpt.' },
      { title: 'No notes' },
    ],
  };
  await writeFile(path.join(directory, 'news.json'), JSON.stringify(original, null, 2));

  const calls = [];
  let sleeps = 0;
  await processFile('news.json', {
    name: 'Test',
    call: async (title, excerpt) => {
      calls.push({ title, excerpt });
      return { summary: `Summary of ${title}`, why_it_matters: `Why ${title}` };
    },
  }, {
    dataDir: directory,
    sleep: async () => {
      sleeps += 1;
    },
  });

  assert.deepEqual(calls, [
    { title: 'Fresh excerpt', excerpt: 'Raw excerpt.' },
    { title: 'No notes', excerpt: undefined },
  ]);
  assert.equal(sleeps, 2);

  const written = JSON.parse(await readFile(path.join(directory, 'news.json'), 'utf8'));
  assert.equal(written.items[0].summary, 'Kept summary.');
  assert.equal(written.items[0].whyItMatters, 'Kept reason.');
  assert.equal(written.items[1].summary, 'Summary of Fresh excerpt');
  assert.equal(written.items[1].whyItMatters, 'Why Fresh excerpt');
  assert.equal(written.items[2].summary, 'Summary of No notes');
  assert.equal(written.items[2].whyItMatters, 'Why No notes');
});

test('summarize does not rewrite a file when every item is already summarized', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'summarize-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const body = `${JSON.stringify({
    items: [{ title: 'Done', summary: 'S', whyItMatters: 'W' }],
  }, null, 2)}\n`;
  const file = path.join(directory, 'papers.json');
  await writeFile(file, body);

  let calls = 0;
  await processFile('papers.json', {
    name: 'Test',
    call: async () => {
      calls += 1;
      return { summary: 'new', why_it_matters: 'new' };
    },
  }, {
    dataDir: directory,
    sleep: async () => {
      throw new Error('sleep should not run when nothing is called');
    },
  });

  assert.equal(calls, 0);
  assert.equal(await readFile(file, 'utf8'), body);
});
