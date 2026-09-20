/* Nyumba254 service worker
 * - Pages: network-first. HTML is never cached, so dashboards, chats and
 *   account pages are never stored on the device. Offline shows offline.html.
 * - Images and fonts: stale-while-revalidate (fast, and refreshed in background).
 * - CSS and JS: network-first with cache fallback, so new deploys are never
 *   masked by stale code.
 * - Cross-origin requests (Supabase, Cloudinary, Google Maps, M-Pesa, Brevo,
 *   Gemini) and all non-GET requests are left completely alone.
 *
 * Bump VERSION whenever you change this file or the precache list.
 */
const VERSION = 'v1';
const SHELL_CACHE = `nyumba254-shell-${VERSION}`;
const ASSET_CACHE = `nyumba254-assets-${VERSION}`;

const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
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

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;

  // 1. Page navigations: network only, offline page as fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  const dest = req.destination;

  // 2. Images and fonts: stale-while-revalidate.
  if (dest === 'image' || dest === 'font') {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 3. CSS and JS: network-first, cache as fallback.
  if (dest === 'style' || dest === 'script') {
    event.respondWith(networkFirst(req));
  }
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || refresh;
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
