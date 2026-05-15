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
    // ✅ 2026-05-15 : 'dismissed' expire après 7 jours pour redonner une chance.
    // Format stocké : 'dismissed:<timestamp_ms>' (legacy 'dismissed' = permanent).
    if (stored && stored.startsWith('dismissed:')) {
      const ts = parseInt(stored.slice('dismissed:'.length), 10);
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(ts) && Date.now() - ts < SEVEN_DAYS_MS) {
        return; // encore dans la fenêtre de silence
      }
      // expiré → on retire et on laisse réafficher
      localStorage.removeItem(storageKey);
    } else if (stored === 'dismissed') {
      // Legacy : ancien format permanent → on convertit en expirable et on respecte 7j.
      localStorage.setItem(storageKey, `dismissed:${Date.now()}`);
      return;
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
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(storageKey, 'installed');
    }
    setDeferredPrompt(null);
    setShow(false);
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
      {!isIOS && deferredPrompt && (
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
