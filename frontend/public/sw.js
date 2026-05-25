// Service Worker — Yukpo Lite apps
// Strategy: network-first pour HTML + JS + CSS (sécurise les nouveaux deploys),
//           cache-first uniquement pour images/fonts (rarement changeantes).
// + Notifications push persistantes/sonores pour la PWA pharmacie (workflow
//   RFQ : un patient cherche un médicament, le pharmacien reçoit des relances
//   échelonnées qui doivent réveiller le téléphone même en veille).
// Bumper CACHE_NAME force la purge des anciens caches au prochain "activate".

const CACHE_NAME = 'yukpo-bourse-v12';
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

// ============================================================================
// Web Push notifications (pour PWA pharmacie : workflow RFQ alertes)
// ============================================================================
//
// Le backend envoie un payload JSON sur la subscription Web Push. Le SW :
//   - extrait title/body/data du payload
//   - affiche la notification avec les flags persistance/son/vibreur
//     consommés par Android Chrome / iOS PWA installée
//   - sur clic : focus l'onglet existant si ouvert, sinon ouvre le deep_link
//
// Tag = "yukpo-alert-{id}" : si une 2e/3e relance arrive pour la même alerte,
// elle REMPLACE la précédente au lieu d'empiler (renotify: true rejoue le
// son/vibreur). Cela évite que le pharmacien voie 3 notifications identiques
// pour une seule demande.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Yukpo', body: event.data ? event.data.text() : '' };
  }

  // Compat : le backend peut envoyer { title, body, data: {...} }
  // ou directement les flags à plat (priority, tag, requireInteraction…).
  const data = payload.data || payload;
  const title = payload.title || data.title || 'Yukpo Pharmacie';
  const body = payload.body || data.body || '';

  const options = {
    body,
    icon: '/icons-pharmacie/icon-192.png',
    badge: '/icons-pharmacie/icon-192.png',
    tag: data.tag || `yukpo-${data.alert_id || Date.now()}`,
    renotify: data.renotify === true,
    requireInteraction: data.requireInteraction === true,
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [500, 200, 500],
    silent: false,
    timestamp: Date.now(),
    data: {
      // Conservé pour le notificationclick handler
      deep_link: data.deep_link || '/',
      alert_id: data.alert_id,
      pharmacy_id: data.pharmacy_id,
      type: data.type || 'generic',
      attempt: data.attempt,
      remaining_minutes: data.remaining_minutes,
    },
    actions: data.type === 'medication_alert'
      ? [
          { action: 'open', title: 'Voir la demande' },
          { action: 'dismiss', title: 'Ignorer' },
        ]
      : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const deepLink = event.notification.data?.deep_link || '/';
  const url = new URL(deepLink, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si un onglet de l'app est déjà ouvert sur la même origine → focus + navigate
      for (const client of clients) {
        const sameOrigin = new URL(client.url).origin === self.location.origin;
        if (sameOrigin && 'focus' in client) {
          client.postMessage({ type: 'notification_click', url: deepLink, data: event.notification.data });
          client.navigate?.(url).catch(() => {});
          return client.focus();
        }
      }
      // Sinon, ouvre une nouvelle fenêtre
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return null;
    }),
  );
});

// Re-subscribe automatiquement si l'abonnement push a expiré (rare mais possible
// après mise à jour browser). Le backend re-stockera le nouvel endpoint au
// prochain register_push_token côté front.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then((sub) => {
        // Notifie le client pour qu'il appelle l'endpoint d'enregistrement.
        return self.clients.matchAll().then((clients) =>
          clients.forEach((c) =>
            c.postMessage({ type: 'push_subscription_renewed', subscription: sub }),
          ),
        );
      })
      .catch(() => {}),
  );
});
