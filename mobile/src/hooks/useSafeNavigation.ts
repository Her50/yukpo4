/**
 * Hook pour navigation sécurisée avec gestion d'erreur robuste
 * Évite les blocages et les crashes de navigation
 */

import { useNavigation } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

export interface SafeNavigationOptions {
    /**
     * Délai maximum avant de déverrouiller la navigation (ms)
     * @default 500
     */
    unlockDelay?: number;

    /**
     * Afficher une alerte en cas d'erreur
     * @default true
     */
    showAlertOnError?: boolean;

    /**
     * Message d'erreur personnalisé
     */
    errorMessage?: string;
}

export function useSafeNavigation() {
    const navigation = useNavigation();
    const isNavigatingRef = useRef(false);
    const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const safeNavigate = useCallback(
        (routeName: string, params?: any, options?: SafeNavigationOptions) => {
            const {
                unlockDelay = 500,
                showAlertOnError = true,
                errorMessage,
            } = options || {};

            // ✅ Vérifier si déjà en navigation
            if (isNavigatingRef.current) {
                console.warn('[useSafeNavigation] Navigation déjà en cours, ignoré:', routeName);
                return false;
            }

            // ✅ Vérifier que la navigation est disponible
            if (!navigation || typeof (navigation as any).navigate !== 'function') {
                console.error('[useSafeNavigation] Navigation non disponible');
                if (showAlertOnError) {
                    Alert.alert('Erreur', 'Navigation non disponible');
                }
                return false;
            }

            // ✅ Vérifier que routeName est valide
            if (!routeName || typeof routeName !== 'string') {
                console.error('[useSafeNavigation] RouteName invalide:', routeName);
                if (showAlertOnError) {
                    Alert.alert('Erreur', 'Route invalide');
                }
                return false;
            }

            isNavigatingRef.current = true;

            // ✅ Nettoyer le timeout précédent
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }

            try {
                console.log('[useSafeNavigation] Navigation vers:', routeName, params ? '(avec params)' : '');

                // ✅ Navigation avec gestion d'erreur
                (navigation as any).navigate(routeName, params);

                // ✅ Déverrouiller après un délai raisonnable
                navigationTimeoutRef.current = setTimeout(() => {
                    isNavigatingRef.current = false;
                    navigationTimeoutRef.current = null;
                }, unlockDelay);

                return true;
            } catch (error: any) {
                // ✅ Déverrouiller immédiatement en cas d'erreur
                console.error('[useSafeNavigation] Erreur navigation vers', routeName, ':', error);
                isNavigatingRef.current = false;

                if (navigationTimeoutRef.current) {
                    clearTimeout(navigationTimeoutRef.current);
                    navigationTimeoutRef.current = null;
                }

                if (showAlertOnError) {
                    const message = errorMessage || `Impossible d'ouvrir ${routeName}. Veuillez réessayer.`;
                    Alert.alert('Erreur de navigation', message);
                }

                return false;
            }
        },
        [navigation]
    );

    // ✅ Fonction pour forcer le déverrouillage (en cas d'urgence)
    const forceUnlock = useCallback(() => {
        console.warn('[useSafeNavigation] Force unlock appelé');
        isNavigatingRef.current = false;
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
            navigationTimeoutRef.current = null;
        }
    }, []);

    return {
        safeNavigate,
        isNavigating: isNavigatingRef.current,
        forceUnlock,
        navigation, // Exposer navigation pour les cas spéciaux
    };
}

