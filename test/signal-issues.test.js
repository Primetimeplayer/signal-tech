import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSitemap, parseIssuePage, mergeIssues, runSignalIssues } from '../scripts/fetch-signal-issues.js';

const POST = `<html><head>
<script type="application/ld+json">{"@type":"Article","url":"https://dailysignaltech.beehiiv.com/p/issue-two","headline":"Chips get chatty 📡","description":"This week in AI and chips.","datePublished":"2026-10-23T07:00:00.000Z"}</script>
</head><body><div id="content-blocks">
<h2>📡 The Big Signal: Arm ships a new core</h2><p>Arm announced it on Tuesday.</p><p>Why it matters: phones get faster at the same battery life. More later.</p>
<h2>⚡ Quick Hits</h2><p><b>RISC-V lands in cars.</b> Two makers signed up this week. More detail.</p>
<h2>🛠️ Tool of the Week: Zed</h2><p>A fast editor that now runs on Windows. It is free.</p>
<p>That&#x27;s issue #2! Reply and tell us.</p>
</div></body></html>`;

test('signal issues: sitemap lists only /p/ posts', () => {
  const xml = '<urlset><url><loc>https://x.beehiiv.com/</loc></url><url><loc>https://x.beehiiv.com/p/one</loc></url><url><loc>https://x.beehiiv.com/archive</loc></url></urlset>';
  assert.deepEqual(parseSitemap(xml), ['https://x.beehiiv.com/p/one']);
});

test('signal issues: a post page becomes an issue with three stories', () => {
  const issue = parseIssuePage(POST, 'https://dailysignaltech.beehiiv.com/p/issue-two');
  assert.equal(issue.issueNumber, 2);
  assert.equal(issue.title, 'Chips get chatty');
  assert.equal(issue.date, '2026-10-23');
  assert.deepEqual(issue.stories.map((s) => s.headline), ['Arm ships a new core', 'RISC-V lands in cars', 'Tool of the week: Zed']);
  assert.equal(issue.stories[0].whyItMatters, 'Phones get faster at the same battery life.');
});

test('signal issues: existing entries are kept as they are and newest comes first', () => {
  const one = { issueNumber: 1, title: 'One', date: '2026-10-16', url: 'https://a/p/one', stories: [{ headline: 'h', whyItMatters: 'hand-written' }] };
  const merged = mergeIssues([one], [{ ...one, title: 'Changed' }, { issueNumber: null, title: 'Two', date: '2026-10-23', url: 'https://a/p/two', stories: [{ headline: 'x', whyItMatters: '' }] }]);
  assert.deepEqual(merged.map((i) => [i.issueNumber, i.title]), [[2, 'Two'], [1, 'One']]);
  assert.equal(merged[1].stories[0].whyItMatters, 'hand-written');
});

test('signal issues: a failed fetch leaves the file untouched', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-issues-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'signal-issues.json');
  fs.writeFileSync(out, '{"issues":[]}');
  await assert.rejects(runSignalIssues({ request: async () => ({ ok: false, status: 503, text: async () => '' }), outputPath: out }));
  assert.equal(fs.readFileSync(out, 'utf8'), '{"issues":[]}');
});

test('signal issues: new posts from the sitemap are added', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-issues-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'signal-issues.json');
  fs.writeFileSync(out, JSON.stringify({ issues: [{ issueNumber: 1, title: 'One', date: '2026-10-16', url: 'https://dailysignaltech.beehiiv.com/p/one', stories: [{ headline: 'h', whyItMatters: 'w' }] }] }));
  const pages = {
    'https://dailysignaltech.beehiiv.com/sitemap.xml': '<urlset><url><loc>https://dailysignaltech.beehiiv.com/p/one</loc></url><url><loc>https://dailysignaltech.beehiiv.com/p/issue-two</loc></url></urlset>',
    'https://dailysignaltech.beehiiv.com/p/issue-two': POST,
  };
  const request = async (url) => ({ ok: url in pages, status: url in pages ? 200 : 404, text: async () => pages[url] });
  const issues = await runSignalIssues({ request, outputPath: out, now: () => new Date('2026-10-23T08:00:00Z') });
  assert.deepEqual(issues.map((i) => i.issueNumber), [2, 1]);
  assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).issues[0].url, 'https://dailysignaltech.beehiiv.com/p/issue-two');
});
