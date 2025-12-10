/**
 * SafeStorage - Wrapper sécurisé pour AsyncStorage avec fallback
 * Corrige les erreurs "Driver not found" et "No available storage method found"
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

let storageAvailable = true;
let storageError: Error | null = null;

// Tester la disponibilité du storage au démarrage
const testStorage = async (): Promise<boolean> => {
    try {
        const testKey = '__storage_test__';
        await AsyncStorage.setItem(testKey, 'test');
        await AsyncStorage.removeItem(testKey);
        storageAvailable = true;
        storageError = null;
        return true;
    } catch (error: any) {
        console.warn('[SafeStorage] ⚠️ AsyncStorage non disponible:', error?.message || error);
        storageAvailable = false;
        storageError = error;
        return false;
    }
};

// Tester immédiatement
testStorage().catch(() => {
    // Ignorer les erreurs de test initial
});

export const SafeStorage = {
    /**
     * Vérifie si le storage est disponible
     */
    isAvailable(): boolean {
        return storageAvailable;
    },

    /**
     * Récupère un élément du storage
     */
    async getItem(key: string): Promise<string | null> {
        if (!storageAvailable) {
            console.warn('[SafeStorage] ⚠️ Storage non disponible, retour null pour:', key);
            return null;
        }

        try {
            return await AsyncStorage.getItem(key);
        } catch (error: any) {
            console.error('[SafeStorage] ❌ Erreur getItem:', error?.message || error);
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
     * Sauvegarde un élément dans le storage
     */
    async setItem(key: string, value: string): Promise<boolean> {
        if (!storageAvailable) {
            console.warn('[SafeStorage] ⚠️ Storage non disponible, impossible de sauvegarder:', key);
            return false;
        }

        try {
            await AsyncStorage.setItem(key, value);
            return true;
        } catch (error: any) {
            console.error('[SafeStorage] ❌ Erreur setItem:', error?.message || error);
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
     * Supprime un élément du storage
     */
    async removeItem(key: string): Promise<boolean> {
        if (!storageAvailable) {
            console.warn('[SafeStorage] ⚠️ Storage non disponible, impossible de supprimer:', key);
            return false;
        }

        try {
            await AsyncStorage.removeItem(key);
            return true;
        } catch (error: any) {
            console.error('[SafeStorage] ❌ Erreur removeItem:', error?.message || error);
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

