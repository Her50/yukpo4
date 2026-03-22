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

    initializationPromise = (async () => {
        try {
            if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
                throw new Error('AsyncStorage module not found or not properly loaded');
            }

            // Un seul getItem suffit pour vérifier que le driver natif est prêt
            const maxRetries = Platform.OS === 'android' ? 4 : 2;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    await AsyncStorage.getItem('__init_probe__');
                    isInitialized = true;
                    return true;
                } catch (probeError: any) {
                    const msg = probeError?.message || '';
                    if (msg.includes('Driver not found') || msg.includes('No available storage method')) {
                        if (attempt < maxRetries) {
                            await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
                            continue;
                        }
                    }
                    throw probeError;
                }
            }
            return false;
        } catch (error: any) {
            console.error('[AsyncStorageInit] ❌ Erreur:', error?.message || error);
            isInitialized = false;
            return false;
        } finally {
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


