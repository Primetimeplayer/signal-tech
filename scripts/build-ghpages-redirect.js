#!/usr/bin/env node
// Builds what GitHub Pages serves after the move to https://signaltechnews.com/:
// one redirect page per public/*.html (canonical link, instant meta refresh,
// and a script that keeps ?query and #hash), a catch-all 404.html for every
// other old URL, and a sw.js that deletes the old Signal Tech caches and
// unregisters itself so returning visitors stop getting the cached copy.
//
// Usage: node scripts/build-ghpages-redirect.js [outDir]   (default _ghpages)

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SITE = 'https://signaltechnews.com/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function targetFor(file) {
  if (file === 'index.html' || file === 'offline.html') return SITE;
  return SITE + file.replace(/\.html$/, '');
}

export function redirectPage(target) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Signal Tech has moved</title>
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</head>
<body>
<p>Signal Tech has moved to <a href="${target}">${target}</a>.</p>
</body>
</html>
`;
}

export const CATCH_ALL = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Signal Tech has moved</title>
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>
(function () {
  var p = location.pathname
    .replace(/^\\/signal-tech(\\/|$)/, '/')
    .replace(/\\/index\\.html$/, '/')
    .replace(/\\.html$/, '');
  location.replace('https://signaltechnews.com' + p + location.search + location.hash);
})();
</script>
</head>
<body>
<p>Signal Tech has moved to <a href="${SITE}">${SITE}</a>.</p>
</body>
</html>
`;

export const KILL_SWITCH_SW = `/* Signal Tech moved to https://signaltechnews.com/. This worker replaces the
   old offline worker on primetimeplayer.github.io/signal-tech/: it deletes
   the Signal Tech caches (only those; other github.io projects share this
   origin), unregisters itself and reloads open tabs, which then follow the
   redirect pages. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('signal-tech')).map((key) => caches.delete(key)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => {})));
  })());
});
`;

export async function buildRedirectSite(outDir, publicDir = path.join(ROOT, 'public')) {
  const pages = (await readdir(publicDir)).filter((f) => f.endsWith('.html') && f !== '404.html').sort();
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const file of pages) {
    await writeFile(path.join(outDir, file), redirectPage(targetFor(file)));
  }
  await writeFile(path.join(outDir, '404.html'), CATCH_ALL);
  await writeFile(path.join(outDir, 'sw.js'), KILL_SWITCH_SW);
  return pages;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const out = path.resolve(process.argv[2] || '_ghpages');
  buildRedirectSite(out).then((pages) => {
    console.log(`Wrote ${pages.length} redirect pages, 404.html and sw.js to ${out}`);
  }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
