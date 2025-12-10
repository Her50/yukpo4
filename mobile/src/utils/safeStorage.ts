/**
 * SafeStorage - Wrapper sécurisé pour AsyncStorage avec fallback
 * Corrige les erreurs "Driver not found" et "No available storage method found"
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

let storageAvailable = true;
let storageError: Error | null = null;

// ✅ AMÉLIORÉ: Tester la disponibilité du storage avec délai pour éviter "Driver not found"
const testStorage = async (retryCount: number = 0): Promise<boolean> => {
    try {
        // ✅ CRITIQUE: Attendre un peu si c'est le premier essai (AsyncStorage peut ne pas être prêt immédiatement)
        if (retryCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Attendre 100ms
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
        if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 3) {
            console.warn(`[SafeStorage] ⚠️ Erreur storage (tentative ${retryCount + 1}/3), réessai dans 500ms...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Attendre 500ms avant de réessayer
            return testStorage(retryCount + 1);
        }

        console.warn('[SafeStorage] ⚠️ AsyncStorage non disponible:', errorMsg);
        storageAvailable = false;
        storageError = error;
        return false;
    }
};

// ✅ AMÉLIORÉ: Tester avec délai initial pour éviter les erreurs au démarrage
// ✅ CRITIQUE: Tester immédiatement ET avec délai pour couvrir tous les cas
testStorage().catch(() => {
    // Premier test immédiat (peut échouer, c'est normal)
});

// Test avec délai pour les cas où AsyncStorage n'est pas prêt immédiatement
setTimeout(() => {
    testStorage().catch(() => {
        // Ignorer les erreurs de test initial
    });
}, 300); // Attendre 300ms avant le deuxième test

// Test final après 1 seconde pour les cas très lents
setTimeout(() => {
    testStorage().catch(() => {
        // Ignorer les erreurs de test final
    });
}, 1000);

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
            if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 2) {
                console.warn(`[SafeStorage] ⚠️ Erreur "Driver not found" (tentative ${retryCount + 1}/2), réessai dans 300ms...`);
                await new Promise(resolve => setTimeout(resolve, 300));
                storageAvailable = false; // Forcer le retest
                return this.getItem(key, retryCount + 1);
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
            if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 2) {
                console.warn(`[SafeStorage] ⚠️ Erreur "Driver not found" (tentative ${retryCount + 1}/2), réessai dans 300ms...`);
                await new Promise(resolve => setTimeout(resolve, 300));
                storageAvailable = false; // Forcer le retest
                return this.setItem(key, value, retryCount + 1);
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
            if ((errorMsg.includes('Driver not found') || errorMsg.includes('No available storage method found')) && retryCount < 2) {
                console.warn(`[SafeStorage] ⚠️ Erreur "Driver not found" (tentative ${retryCount + 1}/2), réessai dans 300ms...`);
                await new Promise(resolve => setTimeout(resolve, 300));
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
            return await AsyncStorage.getAllKeys();
        } catch (error: any) {
            console.error('[SafeStorage] ❌ Erreur getAllKeys:', error?.message || error);
            // Réessayer de tester le storage
            const available = await testStorage();
            if (!available) {
                return [];
            }
            // Réessayer une fois
            try {
                return await AsyncStorage.getAllKeys();
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

