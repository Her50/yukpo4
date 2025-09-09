// src/serviceWorkerRegistration.ts

// Si votre application nécessite un service worker (PWA)
const isLocalhost = Boolean(
  window.location.hostname === 'localhost'
      || window.location.hostname === '[::1]'
      || window.location.hostname.match(
        /^127(\.[0-9]{1,3}){3}$/,
      ),
);

export function register() {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // Utilise le service worker en production
    const publicUrl = new URL(process.env.PUBLIC_URL ?? "/", window.location.href);

    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        checkValidServiceWorker(swUrl);
      } else {
        registerValidSW(swUrl);
      }
    });
  }
}

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('Service Worker enregistré : ', registration);
    })
    .catch((error) => {
      console.error('Erreur d’enregistrement du service worker : ', error);
    });
}

function checkValidServiceWorker(swUrl: string) {
  fetch(swUrl)
    .then((response) => {
      if (
        response.status === 404
          || response.headers.get('content-type')?.indexOf('javascript') === -1
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister();
        });
      } else {
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      console.log('Aucun service worker trouvé. Peut-être que vous êtes hors ligne ?');
    });
}
