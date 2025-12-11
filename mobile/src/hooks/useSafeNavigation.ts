/**
 * Hook pour navigation sécurisée avec gestion d'erreur robuste
 * Évite les blocages et les crashes de navigation
 */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useRef } from 'react';
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
    const safetyResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ✅ CRITIQUE 2025-12-11: Safety reset pour débloquer la navigation si elle reste bloquée
    // Vérifier toutes les secondes si la navigation est bloquée depuis plus de 2 secondes
    React.useEffect(() => {
        const checkAndUnlock = () => {
            if (isNavigatingRef.current) {
                // ✅ Si le flag est bloqué mais qu'il n'y a pas de timeout actif, c'est un blocage
                // Le timeout normal devrait avoir déverrouillé après unlockDelay (500ms)
                // Si on est ici et que le flag est toujours à true après 2s, c'est un blocage
                if (!navigationTimeoutRef.current && !safetyResetTimeoutRef.current) {
                    // ✅ Pas de timeout actif = blocage détecté
                    console.warn('[useSafeNavigation] ⚠️ SAFETY RESET: Navigation bloquée détectée, déverrouillage forcé');
                    isNavigatingRef.current = false;
                }
            }
        };

        // ✅ Vérifier toutes les secondes
        const interval = setInterval(checkAndUnlock, 1000);

        return () => {
            clearInterval(interval);
            if (safetyResetTimeoutRef.current) {
                clearTimeout(safetyResetTimeoutRef.current);
                safetyResetTimeoutRef.current = null;
            }
        };
    }, []);

    const safeNavigate = useCallback(
        (routeName: string, params?: any, options?: SafeNavigationOptions) => {
            const {
                unlockDelay = 500,
                showAlertOnError = true,
                errorMessage,
            } = options || {};

            // ✅ CRITIQUE 2025-12-11: Si la navigation est bloquée, forcer le déverrouillage après 1 seconde
            if (isNavigatingRef.current) {
                // ✅ Vérifier si c'est un blocage réel ou juste une navigation rapide
                // Si le timeout existe toujours, c'est qu'on est dans le délai normal (500ms)
                if (navigationTimeoutRef.current) {
                    console.warn('[useSafeNavigation] Navigation déjà en cours, ignoré:', routeName);
                    // ✅ NOUVEAU: Au lieu de bloquer complètement, permettre la navigation après 1 seconde
                    // Cela évite les blocages prolongés
                    setTimeout(() => {
                        if (isNavigatingRef.current && !navigationTimeoutRef.current) {
                            console.warn('[useSafeNavigation] ⚠️ Navigation bloquée depuis 1s, déverrouillage forcé');
                            isNavigatingRef.current = false;
                        }
                    }, 1000);
                    return false;
                } else {
                    // ✅ Le timeout a expiré mais isNavigatingRef est toujours à true = blocage
                    console.warn('[useSafeNavigation] ⚠️ Navigation bloquée détectée, déverrouillage forcé');
                    isNavigatingRef.current = false;
                }
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
                    // ✅ Nettoyer aussi le safety reset
                    if (safetyResetTimeoutRef.current) {
                        clearTimeout(safetyResetTimeoutRef.current);
                        safetyResetTimeoutRef.current = null;
                    }
                }, unlockDelay);

                // ✅ CRITIQUE 2025-12-11: Safety reset absolu après 2 secondes maximum
                // Même si le timeout normal ne se déclenche pas, on force le déverrouillage
                if (safetyResetTimeoutRef.current) {
                    clearTimeout(safetyResetTimeoutRef.current);
                }
                safetyResetTimeoutRef.current = setTimeout(() => {
                    if (isNavigatingRef.current) {
                        console.warn('[useSafeNavigation] ⚠️ SAFETY RESET ABSOLU: Navigation bloquée depuis 2s, déverrouillage forcé');
                        isNavigatingRef.current = false;
                        if (navigationTimeoutRef.current) {
                            clearTimeout(navigationTimeoutRef.current);
                            navigationTimeoutRef.current = null;
                        }
                    }
                    safetyResetTimeoutRef.current = null;
                }, 2000); // ✅ 2 secondes maximum avant déverrouillage forcé

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
        console.warn('[useSafeNavigation] 🔓 Force unlock appelé - Déverrouillage immédiat de la navigation');
        isNavigatingRef.current = false;
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
            navigationTimeoutRef.current = null;
        }
        if (safetyResetTimeoutRef.current) {
            clearTimeout(safetyResetTimeoutRef.current);
            safetyResetTimeoutRef.current = null;
        }
    }, []);

    return {
        safeNavigate,
        isNavigating: isNavigatingRef.current,
        forceUnlock,
        navigation, // Exposer navigation pour les cas spéciaux
    };
}

