// service-worker.js — 2026-06-28 v3
//
// AVANT (v1) : cache-first sur tout, JAMAIS d'invalidation → après chaque
// déploiement Netlify, les utilisateurs continuaient à voir l'ancienne UI
// pendant des heures/jours (jusqu'à désinstall manuelle).
//
// MAINTENANT (v3) :
//   * CACHE_NAME bumpé → invalide automatiquement v1/v2 au prochain visite.
//   * Network-first sur /index.html (et toute requête HTML) → la page racine
//     vient toujours du serveur. Si réseau KO → fallback cache.
//   * Cache-first sur les assets statiques (icons, manifest) → rapide.
//   * skipWaiting + clients.claim → le nouveau SW s'active IMMÉDIATEMENT
//     sans attendre la fermeture de tous les onglets.

const CACHE_NAME = 'yukpo-cache-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first pour les navigations (HTML) — garantit que toute mise à
  // jour Netlify est visible au prochain reload sans cache stale.
  if (
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Mise à jour du cache en arrière-plan
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/')),
        ),
    );
    return;
  }

  // Cache-first pour les assets statiques (icons, manifest)
  if (STATIC_ASSETS.some((p) => url.pathname === p)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request)),
    );
    return;
  }

  // Pour le reste (JS/CSS hashés Vite, images uploadées, API) : pas de cache
  // SW — on laisse le browser cache HTTP standard faire son job.
  // Les bundles Vite ont un hash dans le nom → invalidation automatique.
});

// Permet à la page de forcer l'update du SW si besoin (postMessage).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
