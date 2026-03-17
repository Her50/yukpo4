/**
 * Hook de notification de bienvenue au premier lancement de l'application.
 * Détecte si c'est la première ouverture après installation via SafeStorage,
 * puis joue un message vocal de bienvenue dans la langue de l'utilisateur.
 */

import { useEffect, useRef } from 'react';
import SafeStorage from '../utils/safeStorage';
import { notificationSoundService } from '../services/notificationSoundService';

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

                // Attendre que l'app soit bien chargée (3s après le montage)
                setTimeout(async () => {
                    try {
                        await notificationSoundService.playWelcomeMessage();
                        console.log('[useWelcomeNotification] ✅ Bienvenue jouée avec succès');
                    } catch (error) {
                        console.warn('[useWelcomeNotification] ⚠️ Erreur lecture bienvenue:', error);
                    }
                }, 3000);
            } catch (error) {
                console.warn('[useWelcomeNotification] ⚠️ Erreur vérification premier lancement:', error);
            }
        };

        checkAndPlayWelcome();
    }, []);
}
