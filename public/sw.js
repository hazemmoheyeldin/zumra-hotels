// Zumra Hotels RMS - Service Worker for Offline-First PWA
// Version bumped to invalidate old caches on deploy
const CACHE_VERSION = 'zumra-rms-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json',
];

// Install: cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches (including v1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler with intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Never cache Firebase/Auth/API calls
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('firebasestorage.googleapis.com') ||
      url.hostname.includes('googleusercontent.com') ||
      url.pathname.startsWith('/api/')) {
    return; // Let browser handle natively
  }

  // HTML pages (SPA): network-first, cache fallback
  if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || new Response('Offline - Zumra Hotels RMS', { status: 503 })))
    );
    return;
  }

  // Hashed static assets (JS/CSS/images with content hash): cache-first, immutable
  // These files have unique names like index-DULQDROE.js so they never go stale
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // If a JS chunk fails to load (stale reference from old index.html),
          // force reload the page to get fresh HTML with new chunk references
          if (url.pathname.endsWith('.js')) {
            return caches.match('/index.html').then(r => {
              if (r) {
                // Signal the page to reload
                return new Response('/* STALE_CHUNK_RELOAD */', {
                  headers: { 'Content-Type': 'application/javascript', 'X-Stale-Chunk': 'true' }
                });
              }
              return new Response('', { status: 404 });
            });
          }
          return new Response('', { status: 404 });
        });
      })
    );
    return;
  }

  // Other assets (images, fonts, manifest): cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/))) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
