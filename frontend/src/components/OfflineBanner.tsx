// Bandeau global qui s'affiche quand la connexion est dégradée ou rompue.
// Utilise useOnlineStatus pour détecter l'état (heartbeat 30s + events
// online/offline natifs).
//
// 3 états visuels :
//   - online (normal) → bandeau caché
//   - slow → bandeau orange "Connexion lente, certaines actions peuvent tarder"
//   - offline → bandeau rouge "Hors ligne, les actions seront réessayées"

import { CloudOff, Loader2 } from 'lucide-react';
import React from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const OfflineBanner: React.FC = () => {
  const { status } = useOnlineStatus();

  if (status === 'online') return null;

  const isOffline = status === 'offline';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[60] px-3 py-1.5 text-center text-xs font-semibold inline-flex items-center justify-center gap-2 ${
        isOffline
          ? 'bg-red-600 text-white'
          : 'bg-amber-500 text-white'
      }`}
    >
      {isOffline ? <CloudOff className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {isOffline
        ? 'Hors ligne — vos actions seront réessayées automatiquement à la reconnexion'
        : 'Connexion lente — certaines actions peuvent prendre plus de temps'}
    </div>
  );
};

export default OfflineBanner;
