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
            // ✅ AMÉLIORÉ: Attendre plus longtemps et vérifier plusieurs fois avec test réel
            if (Platform.OS === 'android') {
                // ✅ CRITIQUE: Attendre que le module natif soit chargé avec plusieurs vérifications
                // Le module peut être "chargé" mais pas encore "prêt" (bridge non initialisé)
                let moduleReady = false;
                for (let attempt = 0; attempt < 15; attempt++) {
                    // Vérifier que AsyncStorage existe et a les méthodes nécessaires
                    if (AsyncStorage && typeof AsyncStorage.getItem === 'function' && typeof AsyncStorage.setItem === 'function') {
                        // ✅ CRITIQUE: Tester une opération RÉELLE pour s'assurer que le module est vraiment prêt
                        // Juste vérifier l'existence des méthodes ne suffit pas
                        try {
                            const testKey = `__init_check_${Date.now()}__`;
                            await AsyncStorage.setItem(testKey, 'test');
                            const readValue = await AsyncStorage.getItem(testKey);
                            await AsyncStorage.removeItem(testKey);
                            
                            // Si on arrive ici sans erreur, le module est vraiment prêt
                            if (readValue === 'test') {
                                moduleReady = true;
                                console.log(`[AsyncStorageInit] ✅ Module prêt après ${attempt + 1} tentatives`);
                                break;
                            }
                        } catch (testError: any) {
                            const errorMsg = testError?.message || String(testError);
                            // Si c'est "Driver not found", le module n'est pas encore prêt
                            if (errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) {
                                // Module pas encore prêt, continuer à attendre
                            } else {
                                // Autre erreur, peut-être que le module est prêt mais il y a un autre problème
                                // On continue quand même
                                moduleReady = true;
                                break;
                            }
                        }
                    }
                    
                    // Attendre progressivement : 100ms, 200ms, 300ms, etc. (max 1.5s)
                    const delay = Math.min(100 * (attempt + 1), 1500);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                if (!moduleReady) {
                    console.warn('[AsyncStorageInit] ⚠️ Module AsyncStorage pas prêt après 15 tentatives');
                }
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
 * ✅ AMÉLIORÉ: Attend vraiment que le module soit prêt avec timeout
 */
export async function ensureAsyncStorageReady(): Promise<boolean> {
    // Si déjà initialisé, retourner immédiatement
    if (isInitialized) {
        return true;
    }

    // Si une initialisation est en cours, attendre qu'elle se termine
    if (initializationPromise) {
        return initializationPromise;
    }

    // Sinon, initialiser maintenant
    return initializeAsyncStorage();
}


