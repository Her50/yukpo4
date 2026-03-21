/**
 * Hook de notification de bienvenue au premier lancement de l'application.
 * Détecte si c'est la première ouverture après installation via SafeStorage,
 * puis joue un message vocal de bienvenue dans la langue de l'utilisateur.
 */

import { useEffect, useRef } from 'react';
import { notificationSoundService } from '../services/notificationSoundService';
import SafeStorage from '../utils/safeStorage';

const WELCOME_PLAYED_KEY = 'yukpo_welcome_played';

export function useWelcomeNotification(): void {
    const hasTriggered = useRef(false);

    useEffect(() => {
        if (hasTriggered.current) return;
        hasTriggered.current = true;

        const checkAndPlayWelcome = async () => {
            try {
                const alreadyPlayed = await SafeStorage.getItem(WELCOME_PLAYED_KEY);

                if (alreadyPlayed) {
                    return;
                }

                // Marquer immédiatement pour éviter double déclenchement
                await SafeStorage.setItem(WELCOME_PLAYED_KEY, 'true');

                // Précharger les sons pour une lecture instantanée
                await notificationSoundService.preloadAllSounds();

                // Lecture immédiate (plus d'attente)
                await notificationSoundService.playWelcomeMessage();
                console.log('[useWelcomeNotification] ✅ Bienvenue jouée avec succès');
            } catch (error) {
                console.warn('[useWelcomeNotification] ⚠️ Erreur vérification premier lancement:', error);
            }
        };

        checkAndPlayWelcome();
    }, []);
}
