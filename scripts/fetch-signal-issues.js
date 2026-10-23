// scripts/fetch-signal-issues.js
// Keeps public/data/signal-issues.json in step with the Signal Tech
// newsletter on beehiiv. It reads the publication's sitemap, and for every
// /p/ post that is not in the file yet it reads the post page and adds an
// issue: number, title, date, link and up to three short stories.
// Issues already in the file are never rewritten, so a hand-edited entry
// (like issue #1) stays exactly as it is. Newest issue first.
// Any network or parse failure leaves the file untouched and exits 0.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decodeEntities } from './lib/decode-entities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'signal-issues.json');
export const PUBLICATION = 'https://dailysignaltech.beehiiv.com';
const USER_AGENT = 'signal-personal-dashboard/1.0 (+https://github.com/Primetimeplayer/signal-tech)';
const MAX_ISSUES = 12;
const WHY_MAX = 110;

function plain(html = '') {
  return decodeEntities(String(html).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

// Drop leading/trailing emoji and symbols ("📡 The Big Signal: …" -> "The Big Signal: …").
function trimSymbols(text = '') {
  return String(text)
    .replace(/^[^\p{L}\p{N}"'(]+/u, '')
    .replace(/[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/u, '')
    .trim();
}

function firstSentence(text = '') {
  const match = /^(.+?[.!?])(?=\s|$)/.exec(String(text).trim());
  return (match ? match[1] : String(text)).trim();
}

function shorten(text = '', max = WHY_MAX) {
  const clean = String(text).trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[\s,;:.–—-]+$/, '')}…`;
}

function capitalise(text = '') {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function parseSitemap(xml = '') {
  const urls = [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return [...new Set(urls.filter((u) => /\/p\/[^/?#]+\/?$/.test(u)))];
}

// Reads a beehiiv post page. Stories follow the Signal Tech template:
// "The Big Signal" (with a "Why it matters:" line), the first Quick Hit
// (bold lead + first sentence) and "Tool of the Week".
export function parseIssuePage(html = '', url = '') {
  const ld = [...String(html).matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .find((d) => d && d['@type'] === 'Article');
  const meta = (name) => {
    const m = new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`, 'i').exec(html);
    return m ? decodeEntities(m[1]) : '';
  };
  const title = trimSymbols(decodeEntities((ld && ld.headline) || meta('og:title')));
  const published = (ld && ld.datePublished) || meta('article:published_time');
  const description = decodeEntities((ld && ld.description) || meta('og:description') || '').trim();
  const link = (ld && ld.url) || url;
  if (!title || !published || !link) return null;

  const start = html.indexOf('id="content-blocks"');
  const body = (start >= 0 ? html.slice(start) : html).replace(/<(script|style)[^>]*>.*?<\/\1>/gs, '');
  const blocks = [...body.matchAll(/<(h2|h3|p)\b[^>]*>(.*?)<\/\1>/gs)].map((m) => ({
    tag: m[1],
    html: m[2],
    text: plain(m[2]),
  })).filter((b) => b.text);

  const sections = [];
  blocks.forEach((b) => {
    if (b.tag === 'h2' || b.tag === 'h3') sections.push({ heading: trimSymbols(b.text), paras: [] });
    else if (sections.length) sections[sections.length - 1].paras.push(b);
  });
  const find = (re) => sections.find((s) => re.test(s.heading));
  const stories = [];

  const big = find(/^the big signal\b/i);
  if (big) {
    const headline = big.heading.replace(/^the big signal\s*[:–—-]\s*/i, '').trim();
    const whyPara = big.paras.find((p) => /^why it matters\s*:/i.test(p.text));
    const why = whyPara ? firstSentence(whyPara.text.replace(/^why it matters\s*:\s*/i, '')) : firstSentence((big.paras[0] || {}).text || '');
    if (headline) stories.push({ headline: shorten(headline, 80), whyItMatters: shorten(capitalise(why)) });
  }
  const hits = find(/^quick hits\b/i);
  const hit = hits && hits.paras.find((p) => /<(b|strong)\b/i.test(p.html));
  if (hit) {
    const lead = plain((/<(b|strong)\b[^>]*>(.*?)<\/\1>/s.exec(hit.html) || [])[2] || '');
    const rest = hit.text.slice(hit.text.indexOf(lead) + lead.length).trim();
    if (lead) stories.push({ headline: shorten(lead.replace(/[.:]\s*$/, ''), 80), whyItMatters: shorten(firstSentence(rest)) });
  }
  const tool = find(/^tool of the week\b/i);
  if (tool) {
    const name = tool.heading.replace(/^tool of the week\s*[:–—-]\s*/i, '').trim();
    const why = firstSentence((tool.paras[0] || {}).text || '');
    if (name) stories.push({ headline: `Tool of the week: ${name}`, whyItMatters: shorten(why) });
  }
  if (!stories.length && description) stories.push({ headline: shorten(description, 80), whyItMatters: '' });
  if (!stories.length) return null;

  const numberMatch = /\bissue\s*#\s*(\d+)\b/i.exec(blocks.map((b) => b.text).join(' ')) || /\bissue\s*#\s*(\d+)\b/i.exec(title);
  return {
    issueNumber: numberMatch ? Number(numberMatch[1]) : null,
    title,
    date: String(published).slice(0, 10),
    url: link,
    stories: stories.slice(0, 3),
  };
}

function readIssues(outputPath) {
  try {
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    return Array.isArray(data.issues) ? data.issues : [];
  } catch {
    return [];
  }
}

const sameUrl = (a, b) => String(a || '').replace(/\/+$/, '') === String(b || '').replace(/\/+$/, '');

export function mergeIssues(existing, found) {
  const issues = existing.slice();
  found
    .filter((issue) => issue && !issues.some((old) => sameUrl(old.url, issue.url)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((issue) => {
      const highest = issues.reduce((max, old) => Math.max(max, Number(old.issueNumber) || 0), 0);
      const taken = issues.some((old) => Number(old.issueNumber) === issue.issueNumber);
      issues.push({ ...issue, issueNumber: issue.issueNumber && !taken ? issue.issueNumber : highest + 1 });
    });
  return issues
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.issueNumber) - Number(a.issueNumber)))
    .slice(0, MAX_ISSUES);
}

export async function runSignalIssues({ request = fetch, outputPath = OUT_PATH, now = () => new Date() } = {}) {
  const get = async (url) => {
    const res = await request(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  };
  const existing = readIssues(outputPath);
  const urls = parseSitemap(await get(`${PUBLICATION}/sitemap.xml`));
  const missing = urls.filter((url) => !existing.some((issue) => sameUrl(issue.url, url)));
  const found = [];
  for (const url of missing) {
    try {
      const issue = parseIssuePage(await get(url), url);
      if (issue) found.push(issue);
    } catch (err) {
      console.error(`[signal-issues] Skipped ${url}: ${err.message}`);
    }
  }
  if (!found.length) {
    console.log(`[signal-issues] No new issues (${existing.length} on file).`);
    return existing;
  }
  const issues = mergeIssues(existing, found);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ updated: now().toISOString(), issues }, null, 2)}\n`);
  console.log(`[signal-issues] Added ${found.length} issue(s); ${issues.length} on file.`);
  return issues;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSignalIssues().catch((err) => {
    console.error(`[signal-issues] ${err.message}; keeping existing data.`);
  });
}
