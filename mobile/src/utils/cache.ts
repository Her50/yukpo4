/**
 * Cache utility pour optimiser les performances
 * Utilise AsyncStorage pour mettre en cache les données
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from './safeStorage';

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export class CacheManager {
    private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Récupère une entrée du cache si elle existe et n'est pas expirée
     */
    static async get<T>(key: string, ttl: number = this.DEFAULT_TTL): Promise<T | null> {
        try {
            const cached = await SafeStorage.getItem(key);
            if (!cached) {
                return null;
            }

            const entry: CacheEntry<T> = JSON.parse(cached);
            const now = Date.now();

            // Vérifier si le cache est expiré
            if (now - entry.timestamp > ttl) {
                // Supprimer l'entrée expirée
                await SafeStorage.removeItem(key);
                return null;
            }

            return entry.data;
        } catch (error) {
            console.error(`[CacheManager] Erreur lecture cache ${key}:`, error);
            return null;
        }
    }

    /**
     * Sauvegarde une entrée dans le cache
     */
    static async set<T>(key: string, data: T): Promise<void> {
        try {
            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
            };
            await SafeStorage.setItem(key, JSON.stringify(entry));
        } catch (error) {
            console.error(`[CacheManager] Erreur écriture cache ${key}:`, error);
        }
    }

    /**
     * Supprime une entrée du cache
     */
    static async remove(key: string): Promise<void> {
        try {
            await SafeStorage.removeItem(key);
        } catch (error) {
            console.error(`[CacheManager] Erreur suppression cache ${key}:`, error);
        }
    }

    /**
     * Vide tout le cache (optionnel)
     */
    static async clear(): Promise<void> {
        try {
            const keys = await SafeStorage.getAllKeys();
            const cacheKeys = keys.filter(key => key.startsWith('cache_'));
            await SafeStorage.multiRemove(cacheKeys);
        } catch (error) {
            console.error('[CacheManager] Erreur vidage cache:', error);
        }
    }
}

/**
 * Helper pour créer une clé de cache
 */
export const createCacheKey = (...parts: (string | number)[]): string => {
    return `cache_${parts.join('_')}`;
};

