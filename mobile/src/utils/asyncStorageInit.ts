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
 * ✅ CORRIGÉ À LA SOURCE: Attendre que le bridge React Native soit complètement initialisé
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
            // ✅ CORRIGÉ À LA SOURCE: Attendre que le bridge React Native soit prêt
            // Le problème "Driver not found" vient du fait que le module natif n'est pas encore initialisé
            // Avec Expo, on doit attendre que NativeModules soit disponible

            // ✅ CRITIQUE: Vérifier que NativeModules est disponible (indique que le bridge est prêt)
            const { NativeModules } = require('react-native');
            let bridgeReady = false;

            // Attendre jusqu'à 3 secondes que le bridge soit prêt
            for (let attempt = 0; attempt < 30; attempt++) {
                if (NativeModules && Object.keys(NativeModules).length > 0) {
                    bridgeReady = true;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (!bridgeReady) {
                console.warn('[AsyncStorageInit] ⚠️ Bridge React Native pas prêt après 3 secondes');
            }

            // ✅ CRITIQUE: Attendre un peu plus pour que les modules natifs soient complètement chargés
            // Même si le bridge est prêt, les modules individuels peuvent avoir besoin de temps
            await new Promise(resolve => setTimeout(resolve, Platform.OS === 'android' ? 300 : 100));

            // ✅ CRITIQUE: Vérifier que AsyncStorage est bien chargé comme module natif
            // Avec Expo, AsyncStorage devrait être automatiquement disponible, mais on vérifie quand même
            if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
                throw new Error('AsyncStorage module not found or not properly loaded');
            }

            // ✅ CORRIGÉ À LA SOURCE: Tester AsyncStorage avec une opération réelle
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
                // ✅ CORRIGÉ À LA SOURCE: Si le test échoue, réessayer avec délai progressif
                // Le problème "Driver not found" vient du fait que le module natif n'est pas encore prêt
                const errorMsg = testError?.message || String(testError);

                if (errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) {
                    console.warn('[AsyncStorageInit] ⚠️ Erreur "Driver not found", réessai avec délai...');

                    // ✅ CRITIQUE: Attendre plus longtemps pour que le module natif soit complètement initialisé
                    // Sur Android, le module peut avoir besoin de plus de temps
                    const delay = Platform.OS === 'android' ? 800 : 300;
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
                        // Ne pas throw ici, on va retourner false plus bas
                    }
                }

                // ✅ Si ce n'est pas une erreur "Driver not found", c'est une autre erreur
                // On la propage pour que l'app sache qu'AsyncStorage n'est pas disponible
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


