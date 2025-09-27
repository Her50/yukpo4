import { useState, useEffect, useCallback } from 'react';

interface ServerStatus {
  isOnline: boolean;
  lastCheck: Date | null;
  retryCount: number;
}

export const useServerStatus = () => {
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: true,
    lastCheck: null,
    retryCount: 0
  });

  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/healthz', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 secondes timeout
      });

      if (response.ok) {
        setStatus(prev => ({
          isOnline: true,
          lastCheck: new Date(),
          retryCount: 0
        }));
        return true;
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      console.warn('[ServerStatus] Serveur inaccessible:', error);
      setStatus(prev => ({
        isOnline: false,
        lastCheck: new Date(),
        retryCount: prev.retryCount + 1
      }));
      return false;
    }
  }, []);

  // Vérifier le statut au montage
  useEffect(() => {
    checkServerStatus();
  }, [checkServerStatus]);

  // Vérifier périodiquement (toutes les 30 secondes)
  useEffect(() => {
    const interval = setInterval(() => {
      checkServerStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [checkServerStatus]);

  return {
    isOnline: status.isOnline,
    lastCheck: status.lastCheck,
    retryCount: status.retryCount,
    checkServerStatus
  };
};
