import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  appName: string;
  themeColor: string;
  storageKey: string;
}

const PWAInstallPrompt: React.FC<Props> = ({ appName, themeColor, storageKey }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isStandalone) return; // app déjà installée et ouverte en mode app

    const stored = localStorage.getItem(storageKey);
    // ✅ 2026-05-17 — Fenêtre de silence réduite à 1h (au lieu de 7j) :
    // si l'utilisateur ferme la croix par accident, il a une chance de revoir
    // le bandeau dès sa prochaine session (au lieu de devoir vider le cache
    // pour le récupérer). 1h = compromis entre "n'embête pas l'user qui dit
    // explicitement non" et "ne disparaît pas définitivement par accident".
    // Format stocké : 'dismissed:<timestamp_ms>' (legacy 'dismissed' = permanent).
    if (stored && stored.startsWith('dismissed:')) {
      const ts = parseInt(stored.slice('dismissed:'.length), 10);
      const ONE_HOUR_MS = 60 * 60 * 1000;
      if (!Number.isNaN(ts) && Date.now() - ts < ONE_HOUR_MS) {
        return; // encore dans la fenêtre de silence
      }
      // expiré → on retire et on laisse réafficher
      localStorage.removeItem(storageKey);
    } else if (stored === 'dismissed') {
      // Legacy : ancien format permanent → on retire pour redonner sa chance.
      localStorage.removeItem(storageKey);
    }
    // Si marqué 'installed' mais pas en standalone → app désinstallée, réafficher le prompt
    if (stored === 'installed') localStorage.removeItem(storageKey);

    window.addEventListener('appinstalled', () => {
      localStorage.setItem(storageKey, 'installed');
      setShow(false);
    });

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const fallbackTimer = setTimeout(() => setShow(true), ios ? 800 : 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
    };
  }, [storageKey]);

  const onInstall = async () => {
    if (!deferredPrompt) {
      // ✅ 2026-05-17 — Pas de deferredPrompt = navigateur n'a jamais envoyé
      // beforeinstallprompt (déjà installé ailleurs, conditions PWA non
      // remplies, ou utilisateur l'a déjà rejeté récemment côté navigateur).
      // On informe l'utilisateur et on bascule vers les instructions manuelles.
      alert(
        "Votre navigateur n'a pas proposé l'installation automatique.\n\n" +
        'Pour installer manuellement :\n' +
        '• Chrome / Edge : menu ⋮ → "Installer l\'application"\n' +
        '• Safari iOS : Partager ↑ → "Sur l\'écran d\'accueil"\n' +
        '• Firefox : menu ⋮ → "Installer"',
      );
      return;
    }
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] install outcome:', outcome);
      if (outcome === 'accepted') {
        localStorage.setItem(storageKey, 'installed');
      } else {
        // L'utilisateur a refusé dans le prompt natif → on note un dismissal
        // léger pour ne pas le re-spammer dans la même session.
        localStorage.setItem(storageKey, `dismissed:${Date.now()}`);
      }
    } catch (e) {
      console.warn('[PWA] install error:', e);
      alert("L'installation a échoué. Essayez via le menu ⋮ du navigateur.");
    } finally {
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  const onDismiss = () => {
    // ✅ 2026-05-15 : stocke le timestamp pour expiration auto à 7 jours.
    localStorage.setItem(storageKey, `dismissed:${Date.now()}`);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed top-3 left-3 right-3 z-[100] rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-down-attention"
      style={{
        background: 'white',
        borderTop: `4px solid ${themeColor}`,
        boxShadow: `0 10px 30px -5px ${themeColor}55, 0 4px 12px rgba(0,0,0,0.15)`,
      }}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl" style={{ background: themeColor }}>
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
      {!isIOS && (
        <button
          onClick={onInstall}
          className="flex-shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold"
          style={{ background: themeColor }}
        >
          Installer
        </button>
      )}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 text-lg"
        aria-label="Fermer"
      >
        ×
      </button>
    </div>
  );
};

export default PWAInstallPrompt;
