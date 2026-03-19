/**
 * AsyncStorageGate - Composant qui bloque le rendu jusqu'à ce qu'AsyncStorage soit prêt
 * Résout définitivement les erreurs "Driver not found" et "No available storage method found"
 * en s'assurant qu'AsyncStorage est initialisé AVANT que les providers ne soient montés
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ensureAsyncStorageReady } from '../utils/asyncStorageInit';
// import { useLanguageSafe } from '../contexts/LanguageContext'; // ✅ FIX: Supprimé pour éviter dépendance circulaire

interface AsyncStorageGateProps {
    children: React.ReactNode;
}

export const AsyncStorageGate: React.FC<AsyncStorageGateProps> = ({ children }) => {
    // const { t } = useLanguageSafe(); // ✅ FIX: Supprimé pour éviter dépendance circulaire
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let timeoutId: NodeJS.Timeout | null = null;

        const initialize = async () => {
            try {
                // ✅ CRITIQUE: Ajouter un timeout pour éviter le blocage indéfini
                // Si AsyncStorage ne s'initialise pas en 10 secondes, on continue quand même
                const timeoutPromise = new Promise<boolean>((resolve) => {
                    timeoutId = setTimeout(() => {
                        console.warn('[AsyncStorageGate] ⚠️ Timeout initialisation AsyncStorage (10s), continuation sans AsyncStorage');
                        resolve(false);
                    }, 10000); // 10 secondes max
                });

                // ✅ CRITIQUE: Attendre que AsyncStorage soit vraiment prêt
                // Cette fonction attend jusqu'à ce que le module natif soit initialisé
                const readyPromise = ensureAsyncStorageReady();

                // Race entre l'initialisation et le timeout
                const ready = await Promise.race([readyPromise, timeoutPromise]);

                // Annuler le timeout si l'initialisation a réussi
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                if (isMounted) {
                    if (ready) {
                        console.log('[AsyncStorageGate] ✅ AsyncStorage prêt, rendu des providers');
                        setIsReady(true);
                    } else {
                        console.warn('[AsyncStorageGate] ⚠️ AsyncStorage non disponible, mais on continue quand même');
                        // Continuer même si AsyncStorage n'est pas disponible
                        // L'app fonctionnera sans persistance locale
                        setIsReady(true);
                        setHasError(true);
                    }
                }
            } catch (error) {
                console.error('[AsyncStorageGate] ❌ Erreur initialisation AsyncStorage:', error);
                if (isMounted) {
                    // En cas d'erreur, continuer quand même (non-bloquant)
                    setIsReady(true);
                    setHasError(true);
                }
            } finally {
                // Nettoyer le timeout si toujours actif
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
        };

        initialize();

        return () => {
            isMounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, []);

    // CRITIQUE: Ne pas rendre les providers tant qu'AsyncStorage n'est pas prêt
    // MAIS avec timeout pour éviter le blocage indéfini
    if (!isReady) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.text}>Initialisation...</Text>
                {hasError && (
                    <Text style={[styles.text, { color: '#EF4444', marginTop: 8 }]}>
                        Mode sans persistance locale
                    </Text>
                )}
            </View>
        );
    }

    // ✅ AsyncStorage est prêt, rendre les providers
    return <>{children}</>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    text: {
        marginTop: 16,
        fontSize: 14,
        color: '#6B7280',
    },
});

