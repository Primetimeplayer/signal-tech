import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OPTIONAL_TIMEOUT_MS, REQUIRED_TIMEOUT_MS, runAll, runStep, steps } from '../scripts/fetch-all.js';

async function tempDir(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fetch-all-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writeScript(directory, name, source) {
  const file = path.join(directory, name);
  await writeFile(file, source);
  return file;
}

test('fetch-all gives news 90s and every other step 60s', () => {
  assert.equal(REQUIRED_TIMEOUT_MS, 90_000);
  assert.equal(OPTIONAL_TIMEOUT_MS, 60_000);
  assert.deepEqual(
    steps.map((step) => [step.script, step.required]),
    [
      ['fetch-news.js', true],
      ['fetch-papers.js', false],
      ['fetch-reviews.js', false],
      ['fetch-reddit.js', false],
      ['summarize.js', false],
    ]
  );
});

test('fetch-all kills a step that exceeds its timeout and continues', async (t) => {
  const directory = await tempDir(t);
  const flag = path.join(directory, 'second-ran');
  const hang = await writeScript(
    directory,
    'hang.js',
    'setInterval(() => {}, 1000);\n'
  );
  const next = await writeScript(
    directory,
    'next.js',
    `import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(flag)}, 'ok');\n`
  );

  const started = Date.now();
  const failed = await runAll([
    { script: 'hang.js', required: false, timeoutMs: 300, file: hang },
    { script: 'next.js', required: false, timeoutMs: 5000, file: next },
  ]);
  const elapsed = Date.now() - started;

  assert.equal(failed, false);
  assert.equal(await readFile(flag, 'utf8'), 'ok');
  assert.ok(elapsed < 5000, `optional timeout took ${elapsed}ms`);
});

test('fetch-all fails the run when a required step times out', async (t) => {
  const directory = await tempDir(t);
  const hang = await writeScript(
    directory,
    'hang.js',
    'setInterval(() => {}, 1000);\n'
  );

  const started = Date.now();
  const failed = await runAll([
    { script: 'fetch-news.js', required: true, timeoutMs: 300, file: hang },
  ]);

  assert.equal(failed, true);
  assert.ok(Date.now() - started < 5000);
});

test('fetch-all only fails the run when a required step exits non-zero', async (t) => {
  const directory = await tempDir(t);
  const bad = await writeScript(directory, 'bad.js', 'process.exit(1);\n');
  const good = await writeScript(directory, 'good.js', 'process.exit(0);\n');

  const optionalFailed = await runAll([
    { script: 'fetch-papers.js', required: false, timeoutMs: 5000, file: bad },
    { script: 'fetch-reviews.js', required: false, timeoutMs: 5000, file: good },
  ]);
  const requiredFailed = await runAll([
    { script: 'fetch-news.js', required: true, timeoutMs: 5000, file: bad },
  ]);

  assert.equal(optionalFailed, false);
  assert.equal(requiredFailed, true);
});

test('fetch-all reports a successful step', async (t) => {
  const directory = await tempDir(t);
  const good = await writeScript(directory, 'good.js', 'process.exit(0);\n');
  const result = await runStep({
    script: 'fetch-reddit.js',
    required: false,
    timeoutMs: 5000,
    file: good,
  });
  assert.equal(result.timedOut, false);
  assert.equal(result.code, 0);
});
