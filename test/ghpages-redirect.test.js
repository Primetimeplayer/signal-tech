import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildRedirectSite, targetFor } from '../scripts/build-ghpages-redirect.js';

test('GitHub Pages redirect build covers every page plus 404 and sw.js', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'ghpages-'));
  const pages = await buildRedirectSite(out);
  const publicPages = (await readdir(new URL('../public/', import.meta.url))).filter((f) => f.endsWith('.html') && f !== '404.html');
  assert.deepEqual(pages, publicPages.sort());
  assert.ok(pages.includes('index.html') && pages.includes('about.html') && pages.includes('digests.html'));
  const files = (await readdir(out)).sort();
  assert.deepEqual(files, [...pages, '404.html', 'sw.js'].sort());

  const about = await readFile(path.join(out, 'about.html'), 'utf8');
  assert.match(about, /<link rel="canonical" href="https:\/\/signaltechnews\.com\/about">/);
  assert.match(about, /<meta http-equiv="refresh" content="0; url=https:\/\/signaltechnews\.com\/about">/);
  assert.match(about, /location\.replace\("https:\/\/signaltechnews\.com\/about" \+ location\.search \+ location\.hash\)/);
  assert.doesNotMatch(about, /noindex/);

  const index = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(index, /url=https:\/\/signaltechnews\.com\/"/);

  const notFound = await readFile(path.join(out, '404.html'), 'utf8');
  assert.match(notFound, /noindex/);
  assert.match(notFound, /'https:\/\/signaltechnews\.com' \+ p \+ location\.search \+ location\.hash/);

  const sw = await readFile(path.join(out, 'sw.js'), 'utf8');
  assert.match(sw, /key\.startsWith\('signal-tech'\)/);
  assert.match(sw, /self\.registration\.unregister\(\)/);
  assert.doesNotMatch(sw, /addEventListener\('fetch'/);
});

test('redirect targets use the extensionless Cloudflare URLs', () => {
  assert.equal(targetFor('index.html'), 'https://signaltechnews.com/');
  assert.equal(targetFor('offline.html'), 'https://signaltechnews.com/');
  assert.equal(targetFor('privacy.html'), 'https://signaltechnews.com/privacy');
});

test('catch-all 404 maps old project paths to the new domain', async () => {
  const { CATCH_ALL } = await import('../scripts/build-ghpages-redirect.js');
  const script = CATCH_ALL.match(/<script>([\s\S]*?)<\/script>/)[1];
  const map = (pathname, search = '', hash = '') => {
    let target = '';
    const location = { pathname, search, hash, replace: (u) => { target = u; } };
    new Function('location', script)(location);
    return target;
  };
  assert.equal(map('/signal-tech/'), 'https://signaltechnews.com/');
  assert.equal(map('/signal-tech'), 'https://signaltechnews.com/');
  assert.equal(map('/signal-tech/index.html'), 'https://signaltechnews.com/');
  assert.equal(map('/signal-tech/editorial.html', '?a=1', '#x'), 'https://signaltechnews.com/editorial?a=1#x');
  assert.equal(map('/signal-tech/tech-dashboard/'), 'https://signaltechnews.com/tech-dashboard/');
  assert.equal(map('/signal-tech/data/news.json'), 'https://signaltechnews.com/data/news.json');
});
