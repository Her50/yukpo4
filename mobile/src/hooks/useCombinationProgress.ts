// Hook pour suivre la progression de génération des combinaisons
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://yukpomnang.onrender.com';

export interface CombinationProgress {
  status: 'in_progress' | 'completed' | 'error' | 'not_found';
  current?: number;
  total?: number;
  percentage?: number;
  seedsAvailable: boolean;
  estimatedRemainingSeconds?: number;
  updatedAt?: string;
}

export interface UseCombinationProgressResult {
  progress: CombinationProgress | null;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  stopPolling: () => void;
}

/**
 * Hook pour suivre la progression de génération des combinaisons
 * 
 * @param sessionId - ID de session retourné par /api/ia/creation-service
 * @param pollingInterval - Intervalle de polling en ms (défaut: 2000ms)
 * @returns Progression, état de polling, et fonction pour arrêter
 */
export function useCombinationProgress(
  sessionId: string | null,
  pollingInterval: number = 2000
): UseCombinationProgressResult {
  const [progress, setProgress] = useState<CombinationProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !isPolling) {
      return;
    }

    let isMounted = true;

    const fetchProgress = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await axios.get<CombinationProgress>(
          `${API_URL}/api/combinations/progress/${sessionId}`,
          {
            timeout: 5000, // Timeout de 5 secondes
          }
        );

        if (!isMounted) return;

        const data = response.data;
        setProgress(data);

        // Arrêter le polling si terminé ou erreur
        if (data.status === 'completed' || data.status === 'error' || data.status === 'not_found') {
          setIsPolling(false);
          console.log('[useCombinationProgress] Polling arrêté:', data.status);
        }

        // Log progression
        if (data.status === 'in_progress' && data.percentage) {
          console.log(
            `[useCombinationProgress] Progression: ${data.current?.toLocaleString()} / ${data.total?.toLocaleString()} (${data.percentage.toFixed(1)}%)`
          );
        }
      } catch (err: any) {
        if (!isMounted) return;

        console.error('[useCombinationProgress] Erreur polling:', err.message);
        setError(err.message || 'Erreur récupération progression');

        // Ne pas arrêter le polling en cas d'erreur réseau temporaire
        // Juste logger et continuer
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Premier appel immédiat
    fetchProgress();

    // Polling régulier
    const interval = setInterval(fetchProgress, pollingInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, isPolling, pollingInterval]);

  const stopPolling = () => {
    console.log('[useCombinationProgress] Arrêt manuel du polling');
    setIsPolling(false);
  };

  return {
    progress,
    isLoading,
    isPolling,
    error,
    stopPolling,
  };
}

/**
 * Formatter le temps restant estimé
 */
export function formatRemainingTime(seconds?: number): string {
  if (!seconds || seconds === 0) return 'Terminé';
  
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes}min ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  }
}

/**
 * Formatter le nombre de combinaisons avec séparateurs de milliers
 */
export function formatCombinationCount(count?: number): string {
  if (!count) return '0';
  return count.toLocaleString('fr-FR');
}

