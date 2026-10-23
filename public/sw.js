/* Signal Tech service worker.
   Paths are relative to the registration scope so the same file works at
   / on signaltechnews.com (Cloudflare Pages), at /signal-tech/ on GitHub
   Pages, and at / when served locally. Cloudflare Pages answers /page.html
   with a 308 to /page, so redirects are passed through to the browser and
   cached copies are stored without the redirected flag. */
const VERSION = 'signal-tech-v11';
const CACHE = VERSION;
const IMAGE_CACHE = VERSION + '-images';
const IMAGE_LIMIT = 60;
const HTML_TIMEOUT_MS = 3000;

const SHELL = [
  './',
  './index.html',
  './about.html',
  './advertise.html',
  './contact.html',
  './digests.html',
  './editorial.html',
  './offline.html',
  './privacy.html',
  './terms.html',
  './assets/home.css',
  './assets/home.js',
  './ui-i18n.js',
  './recent-items.js',
  './feed-cache.js',
  './site.webmanifest',
  './assets/favicon.ico',
  './assets/favicon.svg',
  './assets/favicon-16x16.png',
  './assets/favicon-32x32.png',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-192-maskable.png',
  './assets/icon-512-maskable.png',
  './data/news.json',
  './data/papers.json',
  './data/reviews.json',
  './data/reddit.json',
  './data/signal-issue.json',
];

function scopeUrl(path) {
  return new URL(path, self.registration.scope);
}

// A response that followed a redirect cannot answer a navigation, so keep a
// copy without the redirected flag.
async function plain(response) {
  if (!response || !response.redirected) return response;
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

// /about and /about.html are the same page: Cloudflare Pages serves the
// first, GitHub Pages and local servers serve the second.
function pageKeys(url) {
  const keys = [url.href];
  const path = url.pathname;
  if (path.endsWith('.html')) {
    const pretty = new URL(url.href);
    pretty.pathname = path.slice(0, -5);
    pretty.search = '';
    pretty.hash = '';
    keys.push(pretty.href);
  } else if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) {
    const html = new URL(url.href);
    html.pathname = path + '.html';
    html.search = '';
    html.hash = '';
    keys.push(html.href);
  }
  return keys;
}

function isSkipped(url) {
  const host = url.hostname;
  if (host === 'beehiiv.com' || host.endsWith('.beehiiv.com')) return true;
  if (host === 'google-analytics.com' || host.endsWith('.google-analytics.com')) return true;
  if (host === 'googletagmanager.com' || host.endsWith('.googletagmanager.com')) return true;
  if (host === 'analytics.google.com' || host.endsWith('.analytics.google.com')) return true;
  if (host === 'doubleclick.net' || host.endsWith('.doubleclick.net')) return true;
  if (host === 'px-cloud.net' || host.endsWith('.px-cloud.net')) return true;
  return false;
}

function isFont(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

function isHtml(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  const path = url.pathname;
  return path.endsWith('.html') || path.endsWith('/');
}

function isDataJson(url) {
  return url.origin === self.location.origin && /\/data\/[^/]+\.json$/i.test(url.pathname);
}

function isNewsApi(url) {
  if (!url.pathname.includes('/api/news')) return false;
  if (url.hostname === 'signal-sync.primetimeplayer-signal-sync.workers.dev') return true;
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  if (isFont(url)) return true;
  if (url.origin !== self.location.origin) return false;
  return /\.(?:css|js|mjs|png|svg|webp|ico|woff2?|ttf|otf|webmanifest)$/i.test(url.pathname);
}

function isStoryImage(request, url) {
  if (url.origin === self.location.origin || isFont(url)) return false;
  if (request.destination === 'image') return true;
  return /\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(url.pathname);
}

function canCache(response, allowOpaque) {
  if (!response || response.status === 206) return false;
  if (response.type === 'opaque') return allowOpaque === true;
  if (response.type === 'opaqueredirect' || response.type === 'error') return false;
  return response.ok;
}

async function put(cacheName, request, response) {
  if (!response) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (path) => {
      const href = scopeUrl(path).href;
      const response = await fetch(href, { cache: 'reload' });
      if (!response.ok) throw new Error('Precache failed: ' + href);
      await cache.put(href, await plain(response));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key !== CACHE && key !== IMAGE_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function matchPage(request) {
  const url = new URL(request.url);
  for (const key of pageKeys(url)) {
    const cached = await caches.match(key, { ignoreSearch: key !== url.href });
    if (cached) return plain(cached);
  }
  if (url.pathname.endsWith('/')) return plain(await caches.match(scopeUrl('./index.html')));
  return null;
}

function remember(event, request, response) {
  if (!canCache(response, false)) return;
  const job = put(CACHE, request, response.clone()).catch(() => {});
  try { event.waitUntil(job); } catch (err) { /* The response was already sent. */ }
}

async function networkFirstHtml(event, request) {
  const networked = fetch(request).then((response) => {
    remember(event, request, response);
    return response;
  }).catch(() => null);
  let response = null;
  try {
    response = await Promise.race([
      networked,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), HTML_TIMEOUT_MS)),
    ]);
  } catch (err) {
    response = null;
  }
  // Pass redirects (Cloudflare Pages /page.html -> /page) and real 404 pages
  // straight to the browser.
  if (response && (response.ok || response.type === 'opaqueredirect' || response.status === 404)) return response;
  const cached = await matchPage(request);
  if (cached) return cached;
  const offline = await plain(await caches.match(scopeUrl('./offline.html')));
  if (offline) return offline;
  if (response) return response;
  return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (canCache(response, false)) await put(CACHE, request, response.clone());
    if (response && response.ok) return response;
    const cached = await caches.match(request);
    if (cached) return cached;
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

function staleWhileRevalidate(event, request, allowOpaque) {
  const refresh = caches.open(CACHE).then(async (cache) => {
    try {
      const response = await fetch(request);
      if (canCache(response, allowOpaque)) await cache.put(request, response.clone());
      return response;
    } catch (err) {
      return null;
    }
  });
  event.waitUntil(refresh.catch(() => {}));
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return refresh.then((response) => response || Response.error());
  });
}

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Opaque responses have no status. A resolved opaque body is kept; a
    // failed fetch throws and is not stored.
    if (canCache(response, true)) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > IMAGE_LIMIT) {
        await Promise.all(keys.slice(0, keys.length - IMAGE_LIMIT).map((key) => cache.delete(key)));
      }
    }
    return response;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isSkipped(url)) return;

  if (isHtml(request, url)) {
    event.respondWith(networkFirstHtml(event, request));
    return;
  }
  if (isDataJson(url) || isNewsApi(url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event, request, isFont(url)));
    return;
  }
  if (isStoryImage(request, url)) {
    event.respondWith(cacheFirstImage(request));
  }
});
