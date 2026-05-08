// Service Worker — Yukpo Lite apps
// Strategy: network-first pour HTML + JS + CSS (sécurise les nouveaux deploys),
//           cache-first uniquement pour images/fonts (rarement changeantes).
// Bumper CACHE_NAME force la purge des anciens caches au prochain "activate".

const CACHE_NAME = 'yukpo-bourse-v9';
const STATIC_ASSETS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  // Permet au front de forcer la reprise du contrôle (ex: après MAJ).
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API / auth / ai / ws → network only (jamais de cache)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/ai/')  || url.pathname.startsWith('/ws/')) {
    return;
  }

  // HTML navigation → network-first, fallback cache index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return resp;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JS/CSS/JSON (bundles hashés) → network-first avec fallback cache (pour offline)
  if (request.method === 'GET' && (
    url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json') || url.pathname.endsWith('.mjs')
  )) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images / fonts → cache-first (changent rarement, gain offline notable)
  if (request.method === 'GET' && (
    url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') || url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') || url.pathname.endsWith('.ttf')
  )) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return resp;
        });
      })
    );
  }
});
