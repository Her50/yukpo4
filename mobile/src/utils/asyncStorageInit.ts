/**
 * Initialisation garantie d'AsyncStorage
 * Résout le problème "Driver not found" en s'assurant que le module natif est prêt
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

/**
 * Initialise AsyncStorage de manière garantie
 * Cette fonction doit être appelée au démarrage de l'app AVANT toute utilisation d'AsyncStorage
 */
export async function initializeAsyncStorage(): Promise<boolean> {
    // Si déjà initialisé, retourner immédiatement
    if (isInitialized) {
        return true;
    }

    // Si une initialisation est en cours, attendre qu'elle se termine
    if (initializationPromise) {
        return initializationPromise;
    }

    // Créer la promesse d'initialisation
    initializationPromise = (async () => {
        try {
            // ✅ CRITIQUE: Sur Android, attendre que le bridge React Native soit prêt
            if (Platform.OS === 'android') {
                // Attendre que le module natif soit chargé
                await new Promise(resolve => {
                    // Vérifier que AsyncStorage est disponible
                    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
                        resolve(undefined);
                    } else {
                        // Attendre un peu et réessayer
                        setTimeout(resolve, 100);
                    }
                });
            }

            // ✅ CRITIQUE: Tester AsyncStorage avec une opération réelle
            // Cela force l'initialisation du module natif
            const testKey = '__async_storage_init_test__';
            const testValue = 'test_' + Date.now();

            try {
                // Test d'écriture
                await AsyncStorage.setItem(testKey, testValue);

                // Test de lecture
                const readValue = await AsyncStorage.getItem(testKey);

                // Test de suppression
                await AsyncStorage.removeItem(testKey);

                // Vérifier que la valeur lue correspond à celle écrite
                if (readValue === testValue) {
                    isInitialized = true;
                    console.log('[AsyncStorageInit] ✅ AsyncStorage initialisé avec succès');
                    return true;
                } else {
                    throw new Error('Valeur lue ne correspond pas à la valeur écrite');
                }
            } catch (testError: any) {
                // Si le test échoue, réessayer avec délai progressif
                const errorMsg = testError?.message || String(testError);

                if (errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) {
                    console.warn('[AsyncStorageInit] ⚠️ Erreur "Driver not found", réessai avec délai...');

                    // Attendre plus longtemps pour Android
                    const delay = Platform.OS === 'android' ? 500 : 200;
                    await new Promise(resolve => setTimeout(resolve, delay));

                    // Réessayer une fois
                    try {
                        await AsyncStorage.setItem(testKey, testValue);
                        const readValue = await AsyncStorage.getItem(testKey);
                        await AsyncStorage.removeItem(testKey);

                        if (readValue === testValue) {
                            isInitialized = true;
                            console.log('[AsyncStorageInit] ✅ AsyncStorage initialisé après retry');
                            return true;
                        }
                    } catch (retryError) {
                        console.error('[AsyncStorageInit] ❌ Erreur après retry:', retryError);
                    }
                }

                throw testError;
            }
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            console.error('[AsyncStorageInit] ❌ Erreur initialisation AsyncStorage:', errorMsg);

            // ✅ CRITIQUE: Ne pas bloquer l'app si AsyncStorage n'est pas disponible
            // L'app peut continuer à fonctionner, mais sans persistance locale
            isInitialized = false;
            return false;
        } finally {
            // Réinitialiser la promesse pour permettre une nouvelle tentative si nécessaire
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

/**
 * Vérifie si AsyncStorage est initialisé
 */
export function isAsyncStorageReady(): boolean {
    return isInitialized;
}

/**
 * Réinitialise AsyncStorage (utile après une erreur)
 */
export async function reinitializeAsyncStorage(): Promise<boolean> {
    isInitialized = false;
    initializationPromise = null;
    return initializeAsyncStorage();
}

/**
 * Attendre que AsyncStorage soit prêt
 * Cette fonction peut être appelée avant toute opération AsyncStorage
 */
export async function ensureAsyncStorageReady(): Promise<boolean> {
    if (isInitialized) {
        return true;
    }
    return initializeAsyncStorage();
}


