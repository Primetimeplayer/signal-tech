import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter, mdToHtml } from '../scripts/lib/blog-markdown.js';
import {
  SITE, buildFeed, readChrome, newsletterBox, loadBlogPosts, blogIndexPage, blogPostPage,
} from '../scripts/build-static-pages.js';

const chrome = readChrome(fs.readFileSync(new URL('../public/digests.html', import.meta.url), 'utf8'));

test('front matter and markdown stay a safe subset', () => {
  const { meta, body } = parseFrontMatter(`---
title: "Hello & co"
description: "A guide"
date: 2026-11-05
tags: [ai, agents]
draft: false
image: ""
---
# Title

See <script>alert(1)</script> and [site](/blog/x) plus [ext](https://example.com/a?b=1&c=2) and [bad](javascript:alert(1)).

- **Scope.** One

1. First

> A quote

---

\`inline\`

\`\`\`
<script>no</script>
\`\`\`
`);
  assert.equal(meta.title, 'Hello & co');
  assert.equal(meta.draft, false);
  assert.deepEqual(meta.tags, ['ai', 'agents']);
  const html = mdToHtml(body);
  assert.match(html, /<h2>Title<\/h2>/);
  assert.doesNotMatch(html, /<h1[\s>]|<script|javascript:/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /href="\/blog\/x"/);
  assert.match(html, /href="https:\/\/example\.com\/a\?b=1&amp;c=2" rel="noopener"/);
  assert.match(html, /<strong>Scope\.<\/strong>/);
  assert.match(html, /<ol>\n<li>First<\/li>/);
  assert.match(html, /<blockquote>\n<p>A quote<\/p>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<code>inline<\/code>/);
  assert.match(html, /<pre><code>&lt;script&gt;no&lt;\/script&gt;<\/code><\/pre>/);
});

test('markdown tables stay escaped and allow safe links', () => {
  const html = mdToHtml('| Situation | Prefer |\n| --- | --- |\n| Secrets in the tree | Local |\n| A hard design | [Cloud](https://example.com/a) |\n\n<script>alert(1)</script>');
  assert.match(html, /<table>/);
  assert.match(html, /<th>Situation<\/th><th>Prefer<\/th>/);
  assert.match(html, /<td>Local<\/td>/);
  assert.match(html, /href="https:\/\/example\.com\/a" rel="noopener"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|javascript:/i);
});

test('loadBlogPosts skips drafts and reads the published sample', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-'));
  fs.writeFileSync(path.join(dir, '2026-11-05-visible.md'), '---\ntitle: Visible\ndate: 2026-11-05\ndraft: false\n---\nHello\n');
  fs.writeFileSync(path.join(dir, '2026-11-04-hidden.md'), '---\ntitle: Hidden\ndate: 2026-11-04\ndraft: true\n---\nSkip\n');
  assert.deepEqual(loadBlogPosts(dir).map((post) => post.slug), ['visible']);

  const posts = loadBlogPosts(fileURLToPath(new URL('../content/blog', import.meta.url)));
  const sample = posts.find((post) => post.slug === 'how-to-review-ai-agent-pull-requests');
  assert.ok(sample);
  assert.equal(sample.date, '2026-11-05');
  assert.equal(sample.title, 'How to review AI agent pull requests without becoming the bottleneck');
  assert.match(sample.body, /\/issues\//);
  assert.match(sample.body, /\/digests\//);
  assert.match(sample.body, /\/editorial/);
  assert.match(sample.body, /about five minutes/);
});

test('buildFeed includes a blog post and stays deterministic', () => {
  const issues = [{ issueNumber: 1, title: 'A & B', date: '2026-01-02', stories: [] }];
  const digests = [{ id: '2026-01-05', title: 'Weekly', generatedAt: '2026-01-05T14:00:00Z', dateRange: 'Dec 29–Jan 5', itemCount: 9 }];
  const posts = [{ slug: 'how-to-review', title: 'Review agents', description: 'A guide', date: '2026-11-05' }];
  const feed = buildFeed(issues, digests, posts);
  assert.equal(feed, buildFeed(issues, digests, posts));
  assert.match(feed, new RegExp(`<link>${SITE}/blog/how-to-review</link>`));
  assert.match(feed, /<category>Blog<\/category>/);
  assert.match(feed, /original blog guides/);
  assert.ok(feed.indexOf('/blog/how-to-review') < feed.indexOf('/digests/2026-01-05'), 'newest item first');
});

test('blog pages have one h1, canonical URLs, JSON-LD and the beehiiv box', () => {
  const post = {
    slug: 'how-to-review-ai-agent-pull-requests',
    title: 'How to review AI agent pull requests',
    description: 'A short guide.',
    date: '2026-11-05',
    image: '',
    body: '## Section\n\nHello.\n',
  };
  const index = blogIndexPage(chrome, [post]);
  const page = blogPostPage(chrome, post, [post]);
  for (const html of [index, page]) {
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.match(html, /https:\/\/embeds\.beehiiv\.com\/272d8e40-805d-4008-b4c0-75c73e67d0ef\?slim=true/);
    assert.match(html, /utm_source=signaltechnews&amp;utm_medium=blog/);
    const json = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
    assert.ok(json);
    JSON.parse(json[1]);
  }
  assert.match(index, /rel="canonical" href="https:\/\/signaltechnews\.com\/blog"/);
  assert.match(index, /CollectionPage/);
  assert.match(index, /utm_campaign=signup_box/);
  assert.match(page, /rel="canonical" href="https:\/\/signaltechnews\.com\/blog\/how-to-review-ai-agent-pull-requests"/);
  assert.match(page, /"@type": "BlogPosting"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /utm_campaign=how-to-review-ai-agent-pull-requests/);
  assert.match(page, /class="issue-body blog-body"/);
  assert.match(page, /href="\/blog">All posts/);

  const same = newsletterBox(chrome, 'issue_page');
  assert.match(same, /utm_medium=issue_page&amp;utm_campaign=signup_box/);
  const custom = newsletterBox(chrome, 'blog', { campaign: 'custom-slug' });
  assert.match(custom, /utm_medium=blog&amp;utm_campaign=custom-slug/);
});
