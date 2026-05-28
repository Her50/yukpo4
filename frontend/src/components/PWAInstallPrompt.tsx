import React, { useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  appName: string;
  themeColor: string;
  storageKey: string;
}

/**
 * 2026-05-26 — Refonte pour résoudre "rien ne se passe au clic Installer" :
 *
 * 1. Le service worker est TOUJOURS enregistré, même en mode standalone
 *    (avant : skip en standalone → si une PWA fantôme reste, le SW n'est
 *    jamais réenregistré → beforeinstallprompt ne fire plus).
 * 2. Délai fallback augmenté à 5s (avant 2.5s) pour laisser le navigateur
 *    le temps de fire beforeinstallprompt après l'activation du SW.
 * 3. alert() remplacé par un modal in-app — sur Chrome Android les alert()
 *    après gesture timeout sont bloqués silencieusement.
 * 4. Logs diag visibles dans DevTools (chercher [PWA] dans la console).
 * 5. iOS : section dédiée avec instructions visuelles "Partager → Sur l'écran d'accueil".
 */
const PWAInstallPrompt: React.FC<Props> = ({ appName, themeColor, storageKey }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const swRegistered = useRef(false);

  useEffect(() => {
    // Détection plateforme (avant tout pour orienter le rendu)
    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(ios);

    // 1. ENREGISTRE TOUJOURS le service worker, même si l'app est déjà
    //    installée (sinon le SW reste désactivé après un kill-switch +
    //    Chrome ne fire plus beforeinstallprompt).
    if ('serviceWorker' in navigator && !swRegistered.current) {
      swRegistered.current = true;
      navigator.serviceWorker
        .register('/sw.js')
        .then(reg => {
          // eslint-disable-next-line no-console
          console.log('[PWA] SW enregistré scope:', reg.scope);
        })
        .catch(err => {
          // eslint-disable-next-line no-console
          console.warn('[PWA] SW register échec:', err);
        });
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone;
    if (isStandalone) {
      // eslint-disable-next-line no-console
      console.log('[PWA] App ouverte en mode standalone — bandeau masqué');
      return;
    }

    // 2. Gère la fenêtre de silence après dismissal
    const stored = localStorage.getItem(storageKey);
    if (stored && stored.startsWith('dismissed:')) {
      const ts = parseInt(stored.slice('dismissed:'.length), 10);
      const ONE_HOUR_MS = 60 * 60 * 1000;
      if (!Number.isNaN(ts) && Date.now() - ts < ONE_HOUR_MS) {
        // eslint-disable-next-line no-console
        console.log('[PWA] Dans fenêtre de silence (1h)');
        return;
      }
      localStorage.removeItem(storageKey);
    } else if (stored === 'dismissed') {
      localStorage.removeItem(storageKey);
    }
    if (stored === 'installed') localStorage.removeItem(storageKey);

    window.addEventListener('appinstalled', () => {
      // eslint-disable-next-line no-console
      console.log('[PWA] App installée');
      localStorage.setItem(storageKey, 'installed');
      setShow(false);
    });

    const handler = (e: Event) => {
      e.preventDefault();
      // eslint-disable-next-line no-console
      console.log('[PWA] beforeinstallprompt reçu — install dispo');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 3. Fallback : affiche le bandeau après 5s même sans beforeinstallprompt
    //    (sur Android le timer est plus long pour laisser le SW s'activer).
    const fallbackTimer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('[PWA] Fallback timer — affiche bandeau (deferredPrompt:', !!deferredPrompt, ')');
      setShow(true);
    }, ios ? 1000 : 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
    };
  }, [storageKey]);

  const onInstall = async () => {
    if (!deferredPrompt) {
      // eslint-disable-next-line no-console
      console.log('[PWA] Pas de deferredPrompt — affiche modal instructions');
      setShowFallbackModal(true);
      return;
    }
    try {
      // eslint-disable-next-line no-console
      console.log('[PWA] Déclenche prompt natif');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      // eslint-disable-next-line no-console
      console.log('[PWA] install outcome:', outcome);
      if (outcome === 'accepted') {
        localStorage.setItem(storageKey, 'installed');
      } else {
        localStorage.setItem(storageKey, `dismissed:${Date.now()}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[PWA] install error:', e);
      setShowFallbackModal(true);
    } finally {
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  const onDismiss = () => {
    localStorage.setItem(storageKey, `dismissed:${Date.now()}`);
    setShow(false);
  };

  if (!show && !showFallbackModal) return null;

  return (
    <>
      {show && (
        <div
          className="fixed top-3 left-3 right-3 z-[100] rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-down-attention"
          style={{
            background: 'white',
            borderTop: `4px solid ${themeColor}`,
            boxShadow: `0 10px 30px -5px ${themeColor}55, 0 4px 12px rgba(0,0,0,0.15)`,
          }}
        >
          <div
            className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
            style={{ background: themeColor }}
          >
            📱
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-gray-900">Installer {appName}</div>
            <div className="text-xs text-gray-600 mt-0.5">
              {isIOS
                ? 'Touchez Partager puis « Sur l\'écran d\'accueil »'
                : 'Ajoutez à votre écran d\'accueil pour un accès rapide'}
            </div>
          </div>
          <button
            onClick={isIOS ? () => setShowFallbackModal(true) : onInstall}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ background: themeColor }}
          >
            {isIOS ? 'Voir comment' : 'Installer'}
          </button>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 text-lg"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      )}

      {/* Modal d'instructions manuelles (utilisé si beforeinstallprompt absent
          ou pour iOS qui n'a pas d'API d'installation programmatique). */}
      {showFallbackModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setShowFallbackModal(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 pb-8 sm:pb-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
                style={{ background: themeColor }}
              >
                📱
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-base leading-tight">
                  Installer {appName}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  L'app sera ajoutée à votre écran d'accueil comme une application native.
                </p>
              </div>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs"
                    style={{ background: themeColor }}
                  >
                    1
                  </span>
                  <div>
                    Touchez le bouton <strong>Partager</strong> en bas de Safari
                    <div className="text-xs text-gray-500 mt-0.5">
                      (carré avec une flèche vers le haut ↑)
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs"
                    style={{ background: themeColor }}
                  >
                    2
                  </span>
                  <div>
                    Faites défiler et touchez <strong>« Sur l'écran d'accueil »</strong>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs"
                    style={{ background: themeColor }}
                  >
                    3
                  </span>
                  <div>
                    Touchez <strong>« Ajouter »</strong> en haut à droite
                  </div>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs"
                    style={{ background: themeColor }}
                  >
                    1
                  </span>
                  <div>
                    Touchez le menu <strong>⋮</strong> en haut à droite de Chrome
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs"
                    style={{ background: themeColor }}
                  >
                    2
                  </span>
                  <div>
                    Touchez <strong>« Installer l'application »</strong> ou
                    <strong> « Ajouter à l'écran d'accueil »</strong>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs"
                    style={{ background: themeColor }}
                  >
                    3
                  </span>
                  <div>
                    Confirmez <strong>« Installer »</strong> dans la fenêtre qui s'ouvre
                  </div>
                </li>
              </ol>
            )}

            <button
              onClick={() => {
                setShowFallbackModal(false);
                onDismiss();
              }}
              className="mt-5 w-full py-3 rounded-xl text-white font-bold text-sm"
              style={{ background: themeColor }}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;
