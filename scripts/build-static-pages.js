#!/usr/bin/env node
// scripts/build-static-pages.js
// Writes the static, crawlable pages that Cloudflare Pages serves straight
// from public/ (there is no build step there, so the output is committed):
//
//   public/issues/YYYY-MM-DD.html   one page per newsletter issue  -> /issues/YYYY-MM-DD
//   public/issues.html              newsletter archive              -> /issues
//   public/digests/YYYY-MM-DD.html  one page per weekly digest      -> /digests/YYYY-MM-DD
//   public/feed.xml                 RSS 2.0 for issues and digests  -> /feed.xml
//   public/sitemap.xml              every public page, real lastmod dates
//
// Issue text comes from the beehiiv post (the #content-blocks part, up to
// "Keep reading"), cleaned down to plain headings, paragraphs, lists and
// links. It is fetched once per issue and kept in public/data/issue-archive.json,
// which also remembers issues that have dropped out of signal-issues.json
// (that file keeps only the newest 12), so no issue page ever disappears.
// If beehiiv cannot be reached the page uses the issue's short stories and
// is filled in on a later run.
//
// The header, footer, newsletter card and cookie banner are copied from
// public/digests.html (between the <!-- shared:... --> markers), so the
// pages always match the rest of the site.
//
// Usage: node scripts/build-static-pages.js [--offline]
// Run by update-data.yml (every 3 hours) and generate-digest.yml (Mondays).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
export const SITE = 'https://signaltechnews.com';
const NEWSLETTER = 'https://dailysignaltech.beehiiv.com';
const USER_AGENT = 'signal-personal-dashboard/1.0 (+https://github.com/Primetimeplayer/signal-tech)';
const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;

export const ORGANIZATION = {
  '@type': 'NewsMediaOrganization',
  '@id': `${SITE}/#organization`,
  name: 'Signal Tech',
  url: `${SITE}/`,
  logo: { '@type': 'ImageObject', url: `${SITE}/assets/icon-512.png`, width: 512, height: 512 },
  sameAs: ['https://x.com/SignalTechNews', 'https://www.linkedin.com/company/signaltechnews', NEWSLETTER],
};

// Top-level pages in the sitemap, in order. 404 and offline are left out.
const STATIC_PAGES = [
  ['/', 'index.html'],
  ['/digests', 'digests.html'],
  ['/issues', null],
  ['/about', 'about.html'],
  ['/editorial', 'editorial.html'],
  ['/advertise', 'advertise.html'],
  ['/contact', 'contact.html'],
  ['/privacy', 'privacy.html'],
  ['/terms', 'terms.html'],
];

// ---------- small helpers ----------

export function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function day(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function maxDay(...values) {
  return values.filter(Boolean).sort().pop() || '';
}

function longDate(id) {
  return new Date(`${id}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function shortDate(id) {
  return new Date(`${id}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function jsonLd(graph) {
  // "</" must not appear inside a <script> block.
  return `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/<\//g, '<\\/')}\n</script>`;
}

function writeIfChanged(file, content) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

// ---------- beehiiv post text ----------

const KEEP = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'hr', 'strong', 'b', 'em', 'i', 'br', 'a', 'blockquote']);
const DROP_WITH_CONTENT = /<(script|style|svg|iframe|noscript|button|form|select|textarea|template|figure|picture|video|audio)\b[\s\S]*?<\/\1\s*>/gi;
const VOID = new Set(['hr', 'br']);

function safeHref(href) {
  try {
    const u = new URL(href.replace(/&amp;/g, '&'));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch { return ''; }
}

// Turns beehiiv post HTML into a small, safe subset: headings (h1 becomes h2,
// h5/h6 become h4), paragraphs, lists, quotes, rules, bold, italics, line
// breaks and http(s) links. Every attribute except a link's href is dropped.
export function sanitiseHtml(html = '') {
  let out = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_, close, rawTag, attrs) => {
    let tag = rawTag.toLowerCase();
    if (tag === 'h1') tag = 'h2';
    if (tag === 'h5' || tag === 'h6') tag = 'h4';
    if (!KEEP.has(tag)) return '';
    if (close) return VOID.has(tag) ? '' : `</${tag}>`;
    if (tag === 'a') {
      const m = /\shref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const href = m ? safeHref(m[2] ?? m[3] ?? '') : '';
      return href ? `<a href="${esc(href)}" rel="noopener">` : '<a>';
    }
    return `<${tag}>`;
  });
  // Links without a usable href become plain text.
  out = out.replace(/<a>([\s\S]*?)<\/a>/g, '$1');
  // Empty blocks left over from beehiiv's wrappers.
  for (let i = 0; i < 3; i++) out = out.replace(/<(p|li|h2|h3|h4|strong|em|b|i|blockquote|ul|ol)>\s*(?:<br>\s*)*<\/\1>/g, '');
  out = out.replace(/[ \t]*\n[ \t\n]*/g, '\n').replace(/>\s+</g, (m) => (m.includes('\n') ? '>\n<' : m));
  return out.trim();
}

// Pulls the readable body out of a beehiiv post page: everything inside
// #content-blocks, stopping before the "Keep reading" block.
export function extractPostBody(page = '') {
  const start = page.search(/<div[^>]*\bid=["']content-blocks["'][^>]*>/i);
  if (start < 0) return '';
  let body = page.slice(start);
  body = body.slice(body.indexOf('>') + 1);
  const stop = body.search(/<h[1-6][^>]*>(?:\s*<[^>]+>)*\s*Keep reading/i);
  if (stop >= 0) body = body.slice(0, stop);
  else {
    const end = body.search(/<footer\b|<\/main>/i);
    if (end >= 0) body = body.slice(0, end);
  }
  const clean = sanitiseHtml(body);
  return clean.replace(/<[^>]+>/g, '').trim().length >= 200 ? clean : '';
}

// Archive of every issue ever seen, newest first. Entries from
// signal-issues.json win for metadata; fetched text is kept.
export function mergeArchive(archive = {}, issues = []) {
  const byDate = new Map((archive.issues || []).map((i) => [i.date, i]));
  for (const issue of issues) {
    if (!issue || !DATE_ID.test(issue.date || '')) continue;
    const prev = byDate.get(issue.date) || {};
    byDate.set(issue.date, {
      issueNumber: issue.issueNumber, title: issue.title, date: issue.date, url: issue.url,
      stories: issue.stories || [],
      html: prev.url === issue.url ? prev.html || '' : '',
      fetchedAt: prev.url === issue.url ? prev.fetchedAt || '' : '',
    });
  }
  return { issues: [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)) };
}

async function fillIssueText(archive, { request = fetch, offline = false, log = console.log } = {}) {
  if (offline) return;
  for (const issue of archive.issues) {
    if (issue.html || !/^https:\/\/[^/]*beehiiv\.com\/p\//.test(issue.url || '')) continue;
    try {
      const res = await request(issue.url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = extractPostBody(await res.text());
      if (!html) throw new Error('no #content-blocks text found');
      issue.html = html;
      issue.fetchedAt = new Date().toISOString();
      log(`issue ${issue.date}: fetched full text`);
    } catch (err) {
      log(`issue ${issue.date}: using the short stories for now (${err.message})`);
    }
  }
}

// ---------- weekly digest markdown (same format as assets/digests.js) ----------

const ITEM = /^- \*\*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\*\*(?: \(([^)]*)\))?(?: — (.*))?$/;

function sourceLabel(source, url) {
  try { if (/(^|\.)arxiv\.org$/i.test(new URL(url).hostname)) return 'arXiv'; } catch {}
  return source || 'Source';
}

export function parseDigest(md = '') {
  const out = { title: '', range: '', intro: [], sections: [], outro: [] };
  let section = null;
  let after = false;
  for (const raw of String(md).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^---+$/.test(line)) { after = true; section = null; continue; }
    if (/^# /.test(line)) { out.title = line.slice(2).trim(); continue; }
    if (/^## /.test(line)) { section = { name: line.slice(3).trim(), items: [] }; out.sections.push(section); after = false; continue; }
    const m = ITEM.exec(line);
    if (m && section) {
      section.items.push({ title: m[1], url: m[2], source: sourceLabel((m[3] || '').trim(), m[2]), summary: (m[4] || '').trim() });
      continue;
    }
    if (!out.range && !section && /^\*[^*].*\*$/.test(line)) { out.range = line.slice(1, -1); continue; }
    if (after) out.outro.push(line);
    else if (!section) out.intro.push(line);
  }
  return out;
}

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// ---------- shared page chrome ----------

export function readChrome(digestsHtml) {
  const block = (name) => {
    const m = new RegExp(`<!-- shared:${name}[^>]*-->([\\s\\S]*?)<!-- /shared:${name} -->`).exec(digestsHtml);
    if (!m) throw new Error(`public/digests.html is missing the <!-- shared:${name} --> block`);
    return m[1].trim();
  };
  const head = /^([\s\S]*?)<title>/.exec(digestsHtml);
  const assets = /(<link rel="icon"[\s\S]*?)<\/head>/.exec(digestsHtml);
  const newsletter = /<template id="newsletterTemplate">([\s\S]*?)<\/template>/.exec(digestsHtml);
  if (!head || !assets || !newsletter) throw new Error('public/digests.html does not have the expected head or newsletter template');
  return {
    preamble: head[1].trimEnd(),
    assets: assets[1].replace(/<link rel="preload"[^>]*>\s*/g, '').trimEnd(),
    mast: block('mast').replace(/\s+aria-current="page"/, ''),
    footer: block('footer'),
    cookie: block('cookie'),
    newsletter: newsletter[1].trim(),
  };
}

// The newsletter card on the generated pages: the shared beehiiv card from
// digests.html with a reader-facing heading and note, plus a plain link to
// the beehiiv subscribe page for browsers that block the embedded form. The
// link carries UTM tags so beehiiv shows which page each signup came from.
export function newsletterBox(chrome, medium) {
  const link = `${NEWSLETTER}/subscribe?utm_source=signaltechnews&utm_medium=${medium}&utm_campaign=signup_box`;
  return chrome.newsletter
    .replace(/(<h2 id="newsletterTitle">)[\s\S]*?(<\/h2>)/, '$1Get Signal Tech every Friday$2')
    .replace(/(<p class="newsletter-note">)[\s\S]*?(<\/p>)/, '$1One big story, quick hits and a Tool of the Week. Free, 5-minute read.$2')
    .replace(/\s*<\/section>\s*$/, `\n    <p class="newsletter-alt"><a href="${esc(link)}" target="_blank" rel="noopener">Or subscribe on beehiiv &rarr;</a></p>\n  </section>`);
}

function page(chrome, { title, description, url, ogType = 'article', graph, bodyClass, main, scripts = [] }) {
  const t = esc(title);
  const d = esc(description);
  return `${chrome.preamble}
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="author" content="Signal Tech">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/rss+xml" title="Signal Tech: newsletter issues and weekly digests" href="${SITE}/feed.xml">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Signal Tech">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og-preview.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@SignalTechNews">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${SITE}/assets/og-preview.png">
${jsonLd(graph)}
${chrome.assets}
</head>
<body class="site-page ${bodyClass}">

${chrome.mast}

<div class="wrap page-wrap">
  <main class="page-main" id="main">
${main}
  </main>

  ${chrome.footer}
</div>

${chrome.cookie}
<script src="/assets/site-chrome.js" defer></script>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}

function storiesText(issue) {
  return (issue.stories || []).map((s) => s.headline).filter(Boolean).join(' · ');
}

function issueDescription(issue) {
  const first = (issue.stories || [])[0];
  const text = first ? `${first.headline}. ${first.whyItMatters || ''}` : issue.title;
  return `Signal Tech newsletter #${issue.issueNumber}: ${text}`.replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function issuePage(chrome, issue, older, newer) {
  const url = `${SITE}/issues/${issue.date}`;
  const body = issue.html
    ? `<div class="issue-body">\n${issue.html}\n</div>`
    : `<div class="issue-body">
<p>This week's stories in short. The full issue is on beehiiv.</p>
<ul>
${(issue.stories || []).map((s) => `<li><strong>${esc(s.headline)}.</strong> ${esc(s.whyItMatters || '')}</li>`).join('\n')}
</ul>
</div>`;
  const nav = [
    older ? `<a class="page-btn" rel="prev" href="/issues/${older.date}">&larr; Issue #${esc(older.issueNumber)}</a>` : '',
    `<a class="page-btn" href="/issues">All issues</a>`,
    newer ? `<a class="page-btn" rel="next" href="/issues/${newer.date}">Issue #${esc(newer.issueNumber)} &rarr;</a>` : '',
  ].filter(Boolean).join('\n        ');
  const main = `    <article class="issue-article">
      <header class="page-head">
        <p class="page-kicker">Signal newsletter · Issue #${esc(issue.issueNumber)}</p>
        <h1 class="page-title">${esc(issue.title)}</h1>
        <p class="page-sub"><time datetime="${issue.date}">${esc(longDate(issue.date))}</time></p>
        <div class="page-actions">
          <a class="page-btn page-btn-primary" href="#newsletterCard">Subscribe free</a>
          <a class="page-btn" href="${esc(issue.url)}" rel="noopener">Read on beehiiv</a>
        </div>
      </header>
${body}
      <p class="issue-source">First sent by email on ${esc(longDate(issue.date))}. <a href="${esc(issue.url)}" rel="noopener">View this issue on beehiiv</a>.</p>
      ${newsletterBox(chrome, 'issue_page')}
      <nav class="page-actions issue-nav" aria-label="More issues">
        ${nav}
      </nav>
    </article>`;
  const graph = [
    ORGANIZATION,
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: String(issue.title).slice(0, 110),
      description: issueDescription(issue),
      datePublished: `${issue.date}T08:00:00+01:00`,
      dateModified: `${issue.date}T08:00:00+01:00`,
      inLanguage: 'en-GB',
      url,
      mainEntityOfPage: url,
      image: `${SITE}/assets/og-preview.png`,
      author: { '@id': ORGANIZATION['@id'] },
      publisher: { '@id': ORGANIZATION['@id'] },
      isPartOf: { '@type': 'CollectionPage', '@id': `${SITE}/issues#page`, url: `${SITE}/issues` },
    },
  ];
  return page(chrome, {
    title: `${issue.title} — Signal Tech #${issue.issueNumber}`,
    description: issueDescription(issue),
    url, graph, bodyClass: 'issue-page', main,
  });
}

export function issuesIndexPage(chrome, issues) {
  const url = `${SITE}/issues`;
  const cards = issues.map((i) => `          <a class="latest-card digest-card" href="/issues/${i.date}">
            <div class="cat">Issue #${esc(i.issueNumber)} · ${esc(shortDate(i.date))}</div>
            <h3>${esc(i.title)}</h3>
            <p class="digest-card-summary">${esc(storiesText(i))}</p>
          </a>`).join('\n');
  const main = `    <header class="page-head">
      <p class="page-kicker">Every Friday</p>
      <h1 class="page-title">Signal newsletter archive</h1>
      <p class="page-sub">Every issue of the Friday Signal Briefing, newest first: 4 sourced stories and 1 practical takeaway in plain English.</p>
      <div class="page-actions">
        <a class="page-btn page-btn-primary" href="#newsletterCard">Subscribe free</a>
        <a class="page-btn" href="/digests">Weekly digests</a>
      </div>
    </header>
    <section class="digest-section" aria-labelledby="issues-all">
      <h2 class="digest-section-title" id="issues-all">All issues</h2>
      <div class="digest-grid">
${cards || '          <p class="digest-empty">The first issue is on its way.</p>'}
      </div>
    </section>
    ${newsletterBox(chrome, 'issues_archive')}`;
  const graph = [
    ORGANIZATION,
    {
      '@type': 'CollectionPage',
      '@id': `${url}#page`,
      name: 'Signal newsletter archive',
      url,
      publisher: { '@id': ORGANIZATION['@id'] },
      hasPart: issues.map((i) => ({ '@type': 'Article', headline: i.title, url: `${SITE}/issues/${i.date}`, datePublished: i.date })),
    },
  ];
  return page(chrome, {
    title: 'Signal newsletter archive — Signal Tech',
    description: 'Every issue of the Signal Tech newsletter: 4 sourced stories on AI, chips and dev tools and 1 practical takeaway, every Friday.',
    url, ogType: 'website', graph, bodyClass: 'issues-page', main,
  });
}

export function digestPage(chrome, entry, data, entries) {
  const url = `${SITE}/digests/${entry.id}`;
  const d = parseDigest(data.markdown);
  const title = d.title || entry.title || 'Signal Weekly';
  const range = d.range || entry.dateRange || '';
  const count = d.sections.reduce((n, s) => n + s.items.length, 0) || entry.itemCount || 0;
  const i = entries.findIndex((e) => e.id === entry.id);
  const older = entries[i + 1];
  const newer = i > 0 ? entries[i - 1] : null;
  let content = '';
  if (d.intro.length) content += `<div class="digest-intro">${d.intro.map((p) => `<p>${inline(p)}</p>`).join('')}</div>\n`;
  d.sections.forEach((s, n) => {
    content += `<section class="digest-section" aria-labelledby="digest-s${n}">
<h2 class="digest-section-title" id="digest-s${n}">${esc(s.name)}</h2>
<div class="digest-grid">
${s.items.map((it) => `<a class="latest-card digest-card" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer"><div class="cat">${esc(it.source)} · ${esc(s.name)}</div><h3>${esc(it.title)}</h3>${it.summary ? `<p class="digest-card-summary">${esc(it.summary)}</p>` : ''}</a>`).join('\n')}
</div>
</section>\n`;
    if (n === 0) content += `${newsletterBox(chrome, 'digest_page')}\n`;
  });
  if (!d.sections.length) content += `${newsletterBox(chrome, 'digest_page')}\n`;
  if (d.outro.length) content += `<div class="digest-outro">${d.outro.map((p) => `<p>${inline(p)}</p>`).join('')}</div>\n`;
  const chips = entries.map((e) => `<a class="digest-chip${e.id === entry.id ? ' is-active" aria-current="page' : ''}" href="/digests/${e.id}">${esc(e.dateRange || e.id)}</a>`).join('');
  const main = `    <header class="page-head">
      <p class="page-kicker">Signal Weekly</p>
      <h1 class="page-title">${esc(title)}</h1>
      <p class="page-sub page-sub-fixed">${esc(range)}${count ? ` · ${count} stories` : ''}</p>
      <div class="page-actions">
        ${older ? `<a class="page-btn" id="digestPrev" rel="prev" href="/digests/${older.id}">&larr; Previous week</a>` : '<a class="page-btn" id="digestPrev" rel="prev" hidden>&larr; Previous week</a>'}
        ${newer ? `<a class="page-btn" id="digestNext" rel="next" href="/digests/${newer.id}">Next week &rarr;</a>` : '<a class="page-btn" id="digestNext" rel="next" hidden>Next week &rarr;</a>'}
        <button type="button" class="page-btn page-btn-primary" id="digestShare">Share</button>
        <span class="page-status" id="digestShareStatus" role="status" aria-live="polite"></span>
      </div>
    </header>

    <div class="digest-layout">
      <nav class="digest-dates" aria-label="Digest archive">
        <h2 class="digest-dates-title">Archive</h2>
        <div class="digest-chips" id="digestList">${chips}</div>
      </nav>
      <div class="digest-content digest-content-static" id="digestContent" data-digest-id="${entry.id}">
${content}      </div>
    </div>`;
  const description = `${title}: ${count} of the week's most useful tech stories from the Signal Tech dashboard, grouped by section with the source for each.`;
  const graph = [
    ORGANIZATION,
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: title.slice(0, 110),
      description,
      datePublished: entry.generatedAt,
      dateModified: entry.generatedAt,
      inLanguage: 'en-GB',
      url,
      mainEntityOfPage: url,
      image: `${SITE}/assets/og-preview.png`,
      author: { '@id': ORGANIZATION['@id'] },
      publisher: { '@id': ORGANIZATION['@id'] },
      isPartOf: { '@type': 'CollectionPage', '@id': `${SITE}/digests#page`, url: `${SITE}/digests` },
    },
  ];
  return page(chrome, {
    title: `${title} — Signal Tech`, description, url, graph,
    bodyClass: 'digests-page', main, scripts: ['/assets/digests.js'],
  });
}

// ---------- feed and sitemap ----------

function rfc822(value) {
  return new Date(value).toUTCString();
}

export function buildFeed(issues, digests) {
  const items = [
    ...issues.map((i) => ({
      title: `Issue #${i.issueNumber}: ${i.title}`,
      link: `${SITE}/issues/${i.date}`,
      date: `${i.date}T07:00:00Z`,
      description: (i.stories || []).map((s) => `${s.headline}: ${s.whyItMatters || ''}`.trim()).join(' · ') || i.title,
      category: 'Newsletter',
    })),
    ...digests.map((d) => ({
      title: d.title,
      link: `${SITE}/digests/${d.id}`,
      date: d.generatedAt,
      description: `${d.dateRange}: ${d.itemCount} of the week's most useful tech stories, grouped by section.`,
      category: 'Weekly digest',
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);
  const built = items.length ? rfc822(items[0].date) : rfc822('2026-01-01T00:00:00Z');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Signal Tech</title>
    <link>${SITE}/</link>
    <description>The Signal Tech newsletter and weekly digests: AI engineering, chips and dev tools in plain English.</description>
    <language>en-gb</language>
    <lastBuildDate>${built}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE}/assets/icon-192.png</url>
      <title>Signal Tech</title>
      <link>${SITE}/</link>
    </image>
${items.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${it.link}</link>
      <guid isPermaLink="true">${it.link}</guid>
      <pubDate>${rfc822(it.date)}</pubDate>
      <category>${esc(it.category)}</category>
      <description>${esc(it.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
}

export function buildSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>
`;
}

// Last commit date of a file. Needs full history (checkout fetch-depth: 0);
// in a shallow clone every file looks "changed today", so the previous
// sitemap's date is reused instead.
function gitDay(file) {
  try {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (shallow === 'true') return '';
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch { return ''; }
}

function previousLastmods() {
  const xml = fs.existsSync(path.join(PUBLIC, 'sitemap.xml')) ? fs.readFileSync(path.join(PUBLIC, 'sitemap.xml'), 'utf8') : '';
  const map = new Map();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) map.set(m[1], m[2]);
  return map;
}

// ---------- main ----------

export async function buildStaticPages({ offline = false, request = fetch, log = console.log } = {}) {
  const chrome = readChrome(fs.readFileSync(path.join(PUBLIC, 'digests.html'), 'utf8'));
  const archivePath = path.join(PUBLIC, 'data', 'issue-archive.json');
  const current = readJson(path.join(PUBLIC, 'data', 'signal-issues.json'), { issues: [] });
  const archive = mergeArchive(readJson(archivePath, { issues: [] }), current.issues || []);
  await fillIssueText(archive, { request, offline, log });
  const issues = archive.issues;
  const written = [];
  const put = (rel, content) => { if (writeIfChanged(path.join(PUBLIC, rel), content)) written.push(rel); };

  put('data/issue-archive.json', `${JSON.stringify(archive, null, 2)}\n`);
  issues.forEach((issue, i) => put(`issues/${issue.date}.html`, issuePage(chrome, issue, issues[i + 1], i > 0 ? issues[i - 1] : null)));
  put('issues.html', issuesIndexPage(chrome, issues));

  const digests = (readJson(path.join(PUBLIC, 'digests', 'index.json'), []) || []).filter((e) => e && DATE_ID.test(e.id || ''));
  const builtDigests = [];
  for (const entry of digests) {
    const data = readJson(path.join(PUBLIC, 'digests', `${entry.id}.json`), null);
    if (!data || !data.markdown) { log(`digest ${entry.id}: no markdown, skipped`); continue; }
    put(`digests/${entry.id}.html`, digestPage(chrome, entry, data, digests));
    builtDigests.push(entry);
  }

  put('feed.xml', buildFeed(issues, builtDigests));

  const prev = previousLastmods();
  const dataDay = maxDay(...['news', 'papers', 'reviews', 'signal-issues'].map((n) => day(readJson(path.join(PUBLIC, 'data', `${n}.json`), {}).updated)));
  const newestIssue = issues[0] ? issues[0].date : '';
  const newestDigest = builtDigests[0] ? day(builtDigests[0].generatedAt) : '';
  const extra = { '/': dataDay, '/digests': newestDigest, '/issues': newestIssue };
  const urls = STATIC_PAGES.map(([loc, file]) => {
    const full = `${SITE}${loc}`;
    const fromGit = file ? gitDay(`public/${file}`) : '';
    return { loc: full, lastmod: maxDay(fromGit || prev.get(full), extra[loc]) || prev.get(full) || '' };
  });
  issues.forEach((i) => urls.push({ loc: `${SITE}/issues/${i.date}`, lastmod: maxDay(i.date, day(i.fetchedAt)) }));
  builtDigests.forEach((d) => urls.push({ loc: `${SITE}/digests/${d.id}`, lastmod: day(d.generatedAt) }));
  put('sitemap.xml', buildSitemap(urls));

  log(written.length ? `wrote ${written.length} file(s): ${written.join(', ')}` : 'static pages already up to date');
  return { issues: issues.length, digests: builtDigests.length, written };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  buildStaticPages({ offline: process.argv.includes('--offline') }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
