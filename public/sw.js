// Zumra Hotels RMS - Service Worker for Offline-First PWA
// Version bumped to invalidate old caches on deploy
const CACHE_VERSION = 'zumra-rms-v24';
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

// Activate: clean ALL old caches (including v1, v2)
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

  // HTML pages (SPA): STRICT network-first, never serve stale HTML
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
        .catch(() => {
          // Only serve cached HTML if truly offline (no network at all)
          return caches.match('/index.html').then((r) => r || new Response('Offline - Zumra Hotels RMS. Please check your internet connection and reload.', { status: 503, headers: { 'Content-Type': 'text/html' } }));
        })
    );
    return;
  }

  // Hashed static assets: network-first with cache fallback (prevents stale chunk trap)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — try cache
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Final fallback for JS: trigger page reload to get fresh HTML
            if (url.pathname.endsWith('.js')) {
              self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => client.navigate(client.url + '?_=' + Date.now()));
              });
              return new Response('// Stale chunk — reloading', { headers: { 'Content-Type': 'application/javascript' } });
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
