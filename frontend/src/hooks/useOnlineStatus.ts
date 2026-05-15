// Hook global pour le statut connexion Internet de l'utilisateur.
//
// Au CM/Afrique : la 4G dégrade fréquemment ou tombe (passages tunnel/sous-sol,
// limite de data, opérateur instable). Ce hook expose :
//   - online : true/false basé sur navigator.onLine + heartbeat HTTP léger
//   - lastOnlineAt : timestamp de la dernière confirmation online
//   - slow : true si la dernière requête a duré > 3s (réseau lent)
//
// Le composant <OfflineBanner> qui le consomme affiche un bandeau persistant
// quand offline (rouge) ou lent (orange).

import { useEffect, useState } from 'react';

type Status = 'online' | 'offline' | 'slow';

interface OnlineStatusState {
  status: Status;
  online: boolean;
  slow: boolean;
  lastOnlineAt: number | null;
}

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 s entre 2 ping
const SLOW_THRESHOLD_MS = 3_000; // > 3s = réseau lent

export function useOnlineStatus(): OnlineStatusState {
  const initialOnline =
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  const [status, setStatus] = useState<Status>(initialOnline ? 'online' : 'offline');
  const [slow, setSlow] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(
    initialOnline ? Date.now() : null,
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutHandle: number | null = null;

    const handleOnline = () => {
      if (cancelled) return;
      setStatus('online');
      setSlow(false);
      setLastOnlineAt(Date.now());
    };
    const handleOffline = () => {
      if (cancelled) return;
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Heartbeat : HEAD léger toutes les 30s pour confirmer la connectivité
    // réelle. navigator.onLine peut être trompeur sur certains routeurs.
    const ping = async () => {
      if (cancelled) return;
      const start = performance.now();
      try {
        await fetch('/healthz', {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        });
        if (cancelled) return;
        const duration = performance.now() - start;
        const isSlow = duration > SLOW_THRESHOLD_MS;
        setSlow(isSlow);
        setStatus(isSlow ? 'slow' : 'online');
        setLastOnlineAt(Date.now());
      } catch {
        if (cancelled) return;
        setStatus(navigator.onLine === false ? 'offline' : 'slow');
      } finally {
        timeoutHandle = window.setTimeout(ping, HEARTBEAT_INTERVAL_MS);
      }
    };
    // 1er ping après 5s (laisse le temps à l'app de démarrer)
    timeoutHandle = window.setTimeout(ping, 5000);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, []);

  return {
    status,
    online: status !== 'offline',
    slow,
    lastOnlineAt,
  };
}
