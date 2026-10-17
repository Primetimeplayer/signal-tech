/* Signal Tech service worker.
   Paths are relative to the registration scope so the same file works at
   /signal-tech/ on GitHub Pages and at / when served locally. */
const VERSION = 'signal-tech-v1';
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
  './assets/favicon.svg',
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
    await cache.addAll(SHELL.map((path) => scopeUrl(path).href));
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
  const cached = await caches.match(request);
  if (cached) return cached;
  const url = new URL(request.url);
  if (url.pathname.endsWith('/')) return caches.match(scopeUrl('./index.html'));
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
  if (response && response.ok) return response;
  const cached = await matchPage(request);
  if (cached) return cached;
  const offline = await caches.match(scopeUrl('./offline.html'));
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
