import { useEffect, useCallback } from 'react';
import { appUpdateService } from '../services/appUpdateService';

/**
 * Hook pour gérer les vérifications de mises à jour
 */
export const useAppUpdateCheck = () => {
  // Vérification automatique au démarrage
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        await appUpdateService.checkForUpdatesOnAppStart();
      } catch (error) {
        console.warn('[useAppUpdateCheck] Erreur vérification automatique:', error);
      }
    };

    // Lancer la vérification après 2 secondes (pour ne pas bloquer le démarrage)
    const timer = setTimeout(checkUpdates, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Vérification manuelle
  const checkForUpdatesManually = useCallback(async (): Promise<boolean> => {
    try {
      return await appUpdateService.checkForUpdatesManually();
    } catch (error) {
      console.error('[useAppUpdateCheck] Erreur vérification manuelle:', error);
      return false;
    }
  }, []);

  // Vérification forcée
  const forceCheckForUpdates = useCallback(async (): Promise<void> => {
    try {
      await appUpdateService.forceCheckForUpdates();
    } catch (error) {
      console.error('[useAppUpdateCheck] Erreur vérification forcée:', error);
    }
  }, []);

  // Vérification de support
  const isVersionSupported = useCallback(async (): Promise<boolean> => {
    try {
      return await appUpdateService.isCurrentVersionSupported();
    } catch (error) {
      console.error('[useAppUpdateCheck] Erreur vérification support:', error);
      return true;
    }
  }, []);

  return {
    checkForUpdatesManually,
    forceCheckForUpdates,
    isVersionSupported,
  };
};
