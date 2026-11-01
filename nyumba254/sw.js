/* Nyumba254 service worker
 * - Pages: network-first. HTML is never cached, so dashboards, chats and
 *   account pages are never stored on the device. Offline shows offline.html.
 * - Images and fonts: cache-first (no repeat downloads; the cache is replaced when VERSION is bumped).
 * - CSS and JS: network-first with cache fallback, so new deploys are never
 *   masked by stale code.
 * - Cross-origin requests (Supabase, Cloudinary, Google Maps, M-Pesa, Brevo,
 *   Gemini) and all non-GET requests are left completely alone.
 *
 * App context: pages opened by the Android app shell (?source=app, an android-app://
 * referrer, or a page that announced itself with nk-context.js) get their own offline
 * page (/offline-app.html). Website visitors never see it and the app never sees
 * /offline.html. The native Expo app does not use this worker at all.
 *
 * Bump VERSION whenever you change this file or the precache list.
 */
const VERSION = 'v5';
const SHELL_CACHE = `nyumba254-shell-${VERSION}`;
const ASSET_CACHE = `nyumba254-assets-${VERSION}`;

const PRECACHE = [
  '/manifest.webmanifest',
  '/offline-app.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Paths that must always go straight to the network.
const NEVER_CACHE = [
  '/.well-known/',
  '/sw.js',
  '/admin',
  '/api/'
];

const APP_CLIENTS = new Map();
self.addEventListener('message', (event) => {
  const d = event.data;
  if (d && d.type === 'nk-ctx' && event.source && event.source.id) APP_CLIENTS.set(event.source.id, d.ctx === 'app');
});
function isAppNavigation(req, url, event) {
  if (url.searchParams.get('source') === 'app') return true;
  if ((req.referrer || '').startsWith('android-app://')) return true;
  return !!(event.clientId && APP_CLIENTS.get(event.clientId));
}

async function cacheOfflinePage(cache) {
  // Cloudflare may redirect /offline.html to /offline, and a redirected
  // response can't be used for a page navigation, so store a clean copy.
  const res = await fetch('/offline.html');
  if (!res.ok) throw new Error('offline page not available');
  const html = await res.text();
  await cache.put('/offline.html', new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.all([cache.addAll(PRECACHE), cacheOfflinePage(cache)]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('nyumba254-') && k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range') || req.destination === 'video' || req.destination === 'audio') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;

  // 1. Page navigations: network only, offline page as fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(isAppNavigation(req, url, event) ? '/offline-app.html' : '/offline.html'))
    );
    return;
  }

  const dest = req.destination;

  // 2. Images and fonts: cache-first.
  if (dest === 'image' || dest === 'font') {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 3. CSS and JS: network-first, cache as fallback.
  if (dest === 'style' || dest === 'script') {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.status === 200) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(ASSET_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}