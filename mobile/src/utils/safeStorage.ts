/**
 * SafeStorage - Wrapper sécurisé pour AsyncStorage avec fallback
 * Corrige les erreurs "Driver not found" et "No available storage method found"
 * ✅ CORRIGÉ 2025-12-11: Utilise l'initialisation garantie d'AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureAsyncStorageReady } from './asyncStorageInit';

let storageAvailable = true;
let storageError: Error | null = null;

// ✅ AMÉLIORÉ: Tester la disponibilité du storage avec délai pour éviter "Driver not found"
const testStorage = async (retryCount: number = 0): Promise<boolean> => {
    try {
        // ✅ CRITIQUE: Attendre un peu si c'est le premier essai (AsyncStorage peut ne pas être prêt immédiatement)
        if (retryCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 200)); // ✅ AUGMENTÉ: De 100ms à 200ms pour plus de stabilité
        }

        // ✅ CRITIQUE: Vérifier que AsyncStorage est bien disponible avant d'essayer de l'utiliser
        if (!AsyncStorage || typeof AsyncStorage.setItem !== 'function') {
            console.warn('[SafeStorage] ⚠️ AsyncStorage non disponible (module non chargé)');
            storageAvailable = false;
            return false;
        }

        const testKey = '__storage_test__';
        await AsyncStorage.setItem(testKey, 'test');
        await AsyncStorage.removeItem(testKey);
        storageAvailable = true;
        storageError = null;
        return true;
    } catch (error: any) {
        const errorMsg = error?.message || String(error);

        // ✅ CRITIQUE: Si c'est "Driver not found" ou "No available storage method found", réessayer avec délai
        if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 5) {
            // ✅ AUGMENTÉ: De 3 à 5 tentatives avec délai progressif
            const delay = Math.min(500 * (retryCount + 1), 2000); // Délai progressif : 500ms, 1000ms, 1500ms, 2000ms, 2000ms
            console.warn(`[SafeStorage] ⚠️ Erreur storage (tentative ${retryCount + 1}/5), réessai dans ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return testStorage(retryCount + 1);
        }

        console.warn('[SafeStorage] ⚠️ AsyncStorage non disponible:', errorMsg);
        storageAvailable = false;
        storageError = error;
        return false;
    }
};

// ✅ CORRIGÉ 2025-12-11: Initialiser AsyncStorage de manière plus agressive au démarrage
// ✅ CRITIQUE: Tester immédiatement ET avec délai pour couvrir tous les cas
// ✅ NOUVEAU: Attendre que le module soit prêt avant de tester
const initializeAsyncStorage = async () => {
    // Attendre un peu pour que le module natif soit complètement chargé
    await new Promise(resolve => setTimeout(resolve, 100));

    // Tester plusieurs fois avec délais progressifs
    const testDelays = [0, 200, 500, 1000, 2000];
    for (const delay of testDelays) {
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        const result = await testStorage().catch(() => false);
        if (result) {
            console.log(`[SafeStorage] ✅ AsyncStorage initialisé après ${delay}ms`);
            return;
        }
    }
    console.warn('[SafeStorage] ⚠️ AsyncStorage non disponible après tous les tests');
};

// Démarrer l'initialisation (non-bloquant)
initializeAsyncStorage().catch(() => {
    // Ignorer les erreurs d'initialisation
});

export const SafeStorage = {
    /**
     * Vérifie si le storage est disponible
     */
    isAvailable(): boolean {
        return storageAvailable;
    },

    /**
     * Récupère un élément du storage avec retry automatique
     */
    async getItem(key: string, retryCount: number = 0): Promise<string | null> {
        // ✅ CRITIQUE 2025-12-11: S'assurer qu'AsyncStorage est initialisé avant utilisation
        if (retryCount === 0) {
            const ready = await ensureAsyncStorageReady();
            if (!ready) {
                console.warn('[SafeStorage] ⚠️ AsyncStorage non initialisé, retour null pour:', key);
                return null;
            }
        }

        // ✅ AMÉLIORÉ: Si storage non disponible, réessayer de tester avant de retourner null
        if (!storageAvailable && retryCount === 0) {
            const available = await testStorage();
            if (available) {
                storageAvailable = true;
            } else {
                console.warn('[SafeStorage] ⚠️ Storage non disponible, retour null pour:', key);
                return null;
            }
        }

        if (!storageAvailable) {
            return null;
        }

        try {
            return await AsyncStorage.getItem(key);
        } catch (error: any) {
            const errorMsg = error?.message || String(error);

            // ✅ CRITIQUE: Si c'est "Driver not found" ou "No available storage method found", réessayer avec délai
            if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 3) {
                // ✅ AUGMENTÉ: De 2 à 3 tentatives avec délai progressif
                const delay = Math.min(300 * (retryCount + 1), 1000); // 300ms, 600ms, 900ms
                console.warn(`[SafeStorage] ⚠️ Erreur storage (tentative ${retryCount + 1}/3), réessai dans ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // ✅ CRITIQUE: Réinitialiser AsyncStorage avant de réessayer
                const { ensureAsyncStorageReady } = require('./asyncStorageInit');
                await ensureAsyncStorageReady();
                storageAvailable = false; // Forcer le retest
                return this.getItem(key, retryCount + 1);
            }

            // ✅ CRITIQUE 2025-12-11: Ne pas logger comme erreur critique si c'est une erreur AsyncStorage connue
            const isKnownAsyncStorageError =
                errorMsg.includes('Driver not found') ||
                errorMsg.includes('No available storage method found') ||
                errorMsg.includes('AsyncStorage') && (errorMsg.includes('not found') || errorMsg.includes('unavailable'));

            if (isKnownAsyncStorageError) {
                // ✅ Ces erreurs sont attendues et gérées, ne pas les logger comme erreurs critiques
                console.warn('[SafeStorage] ⚠️ Erreur AsyncStorage connue (non-bloquante):', errorMsg);
                return null; // Retourner null silencieusement
            }

            console.error('[SafeStorage] ❌ Erreur getItem:', errorMsg);
            // Réessayer de tester le storage
            const available = await testStorage();
            if (!available) {
                return null;
            }
            // Réessayer une fois
            try {
                return await AsyncStorage.getItem(key);
            } catch (retryError) {
                console.error('[SafeStorage] ❌ Erreur getItem après retry:', retryError);
                return null;
            }
        }
    },

    /**
     * Sauvegarde un élément dans le storage avec retry automatique
     */
    async setItem(key: string, value: string, retryCount: number = 0): Promise<boolean> {
        // ✅ CRITIQUE 2025-12-11: S'assurer qu'AsyncStorage est initialisé avant utilisation
        if (retryCount === 0) {
            const ready = await ensureAsyncStorageReady();
            if (!ready) {
                console.warn('[SafeStorage] ⚠️ AsyncStorage non initialisé, impossible de sauvegarder:', key);
                return false;
            }
        }

        // ✅ AMÉLIORÉ: Si storage non disponible, réessayer de tester avant de retourner false
        if (!storageAvailable && retryCount === 0) {
            const available = await testStorage();
            if (available) {
                storageAvailable = true;
            } else {
                console.warn('[SafeStorage] ⚠️ Storage non disponible, impossible de sauvegarder:', key);
                return false;
            }
        }

        if (!storageAvailable) {
            return false;
        }

        try {
            await AsyncStorage.setItem(key, value);
            return true;
        } catch (error: any) {
            const errorMsg = error?.message || String(error);

            // ✅ CRITIQUE: Si c'est "Driver not found" ou "No available storage method found", réessayer avec délai
            if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 3) {
                // ✅ AUGMENTÉ: De 2 à 3 tentatives avec délai progressif
                const delay = Math.min(300 * (retryCount + 1), 1000); // 300ms, 600ms, 900ms
                console.warn(`[SafeStorage] ⚠️ Erreur storage (tentative ${retryCount + 1}/3), réessai dans ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // ✅ CRITIQUE: Réinitialiser AsyncStorage avant de réessayer
                const { ensureAsyncStorageReady } = require('./asyncStorageInit');
                await ensureAsyncStorageReady();
                storageAvailable = false; // Forcer le retest
                return this.setItem(key, value, retryCount + 1);
            }

            // ✅ CRITIQUE 2025-12-11: Ne pas logger comme erreur critique si c'est une erreur AsyncStorage connue
            const isKnownAsyncStorageError =
                errorMsg.includes('Driver not found') ||
                errorMsg.includes('No available storage method found') ||
                errorMsg.includes('AsyncStorage') && (errorMsg.includes('not found') || errorMsg.includes('unavailable'));

            if (isKnownAsyncStorageError) {
                // ✅ Ces erreurs sont attendues et gérées, ne pas les logger comme erreurs critiques
                console.warn('[SafeStorage] ⚠️ Erreur AsyncStorage connue (non-bloquante):', errorMsg);
                return false; // Retourner false silencieusement
            }

            console.error('[SafeStorage] ❌ Erreur setItem:', errorMsg);
            // Réessayer de tester le storage
            const available = await testStorage();
            if (!available) {
                return false;
            }
            // Réessayer une fois
            try {
                await AsyncStorage.setItem(key, value);
                return true;
            } catch (retryError) {
                console.error('[SafeStorage] ❌ Erreur setItem après retry:', retryError);
                return false;
            }
        }
    },

    /**
     * Supprime un élément du storage avec retry automatique
     */
    async removeItem(key: string, retryCount: number = 0): Promise<boolean> {
        // ✅ AMÉLIORÉ: Si storage non disponible, réessayer de tester avant de retourner false
        if (!storageAvailable && retryCount === 0) {
            const available = await testStorage();
            if (available) {
                storageAvailable = true;
            } else {
                console.warn('[SafeStorage] ⚠️ Storage non disponible, impossible de supprimer:', key);
                return false;
            }
        }

        if (!storageAvailable) {
            return false;
        }

        try {
            await AsyncStorage.removeItem(key);
            return true;
        } catch (error: any) {
            const errorMsg = error?.message || String(error);

            // ✅ CRITIQUE: Si c'est "Driver not found" ou "No available storage method found", réessayer avec délai
            if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 3) {
                // ✅ AUGMENTÉ: De 2 à 3 tentatives avec délai progressif
                const delay = Math.min(300 * (retryCount + 1), 1000); // 300ms, 600ms, 900ms
                console.warn(`[SafeStorage] ⚠️ Erreur storage (tentative ${retryCount + 1}/3), réessai dans ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // ✅ CRITIQUE: Réinitialiser AsyncStorage avant de réessayer
                const { ensureAsyncStorageReady } = require('./asyncStorageInit');
                await ensureAsyncStorageReady();
                storageAvailable = false; // Forcer le retest
                return this.removeItem(key, retryCount + 1);
            }

            console.error('[SafeStorage] ❌ Erreur removeItem:', errorMsg);
            // Réessayer de tester le storage
            const available = await testStorage();
            if (!available) {
                return false;
            }
            // Réessayer une fois
            try {
                await AsyncStorage.removeItem(key);
                return true;
            } catch (retryError) {
                console.error('[SafeStorage] ❌ Erreur removeItem après retry:', retryError);
                return false;
            }
        }
    },

    /**
     * Récupère toutes les clés
     */
    async getAllKeys(): Promise<string[]> {
        if (!storageAvailable) {
            console.warn('[SafeStorage] ⚠️ Storage non disponible, retour tableau vide');
            return [];
        }

        try {
            return await AsyncStorage.getAllKeys() as string[];
        } catch (error: any) {
            console.error('[SafeStorage] ❌ Erreur getAllKeys:', error?.message || error);
            // Réessayer de tester le storage
            const available = await testStorage();
            if (!available) {
                return [];
            }
            // Réessayer une fois
            try {
                return await AsyncStorage.getAllKeys() as string[];
            } catch (retryError) {
                console.error('[SafeStorage] ❌ Erreur getAllKeys après retry:', retryError);
                return [];
            }
        }
    },

    /**
     * Supprime plusieurs éléments
     */
    async multiRemove(keys: string[]): Promise<boolean> {
        if (!storageAvailable) {
            console.warn('[SafeStorage] ⚠️ Storage non disponible, impossible de supprimer plusieurs clés');
            return false;
        }

        try {
            await AsyncStorage.multiRemove(keys);
            return true;
        } catch (error: any) {
            console.error('[SafeStorage] ❌ Erreur multiRemove:', error?.message || error);
            // Réessayer de tester le storage
            const available = await testStorage();
            if (!available) {
                return false;
            }
            // Réessayer une fois
            try {
                await AsyncStorage.multiRemove(keys);
                return true;
            } catch (retryError) {
                console.error('[SafeStorage] ❌ Erreur multiRemove après retry:', retryError);
                return false;
            }
        }
    },

    /**
     * Réinitialise le test de disponibilité (utile après une erreur)
     */
    async resetAvailability(): Promise<void> {
        await testStorage();
    },

    /**
     * Obtient la dernière erreur
     */
    getLastError(): Error | null {
        return storageError;
    }
};

export default SafeStorage;

