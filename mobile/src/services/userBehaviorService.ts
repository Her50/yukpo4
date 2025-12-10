// Service de tracking du comportement utilisateur
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../utils/safeStorage';

interface SearchHistory {
    query: string;
    category?: string;
    timestamp: number;
}

interface UserBehavior {
    searchHistory: SearchHistory[];
    categoryPreferences: Record<string, number>; // catégorie -> nombre de recherches
    livePreferences: Record<string, number>; // live_id -> poids d'intérêt
    lastUpdated: number;
}

const STORAGE_KEY = 'user_behavior';
const MAX_HISTORY = 100;

class UserBehaviorService {
    private static instance: UserBehaviorService;

    private constructor() { }

    static getInstance(): UserBehaviorService {
        if (!UserBehaviorService.instance) {
            UserBehaviorService.instance = new UserBehaviorService();
        }
        return UserBehaviorService.instance;
    }

    // Enregistrer une recherche
    async trackSearch(query: string, category?: string): Promise<void> {
        try {
            const behavior = await this.getBehavior();

            // Ajouter à l'historique
            behavior.searchHistory.unshift({
                query,
                category,
                timestamp: Date.now()
            });

            // Limiter la taille de l'historique
            if (behavior.searchHistory.length > MAX_HISTORY) {
                behavior.searchHistory = behavior.searchHistory.slice(0, MAX_HISTORY);
            }

            // Mettre à jour les préférences de catégorie
            if (category) {
                behavior.categoryPreferences[category] =
                    (behavior.categoryPreferences[category] || 0) + 1;
            }

            behavior.lastUpdated = Date.now();

            await SafeStorage.setItem(STORAGE_KEY, JSON.stringify(behavior));
            console.log('[UserBehavior] Recherche enregistrée:', { query, category });
        } catch (error) {
            console.error('[UserBehavior] Erreur tracking:', error);
        }
    }

    // Enregistrer une interaction avec un produit
    async trackProductView(productType: string): Promise<void> {
        try {
            const behavior = await this.getBehavior();

            behavior.categoryPreferences[productType] =
                (behavior.categoryPreferences[productType] || 0) + 0.5; // Poids plus faible que recherche

            behavior.lastUpdated = Date.now();

            await SafeStorage.setItem(STORAGE_KEY, JSON.stringify(behavior));
        } catch (error) {
            console.error('[UserBehavior] Erreur tracking produit:', error);
        }
    }

    // Obtenir le comportement de l'utilisateur
    async getBehavior(): Promise<UserBehavior> {
        try {
            const stored = await SafeStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('[UserBehavior] Erreur lecture:', error);
        }

        return {
            searchHistory: [],
            categoryPreferences: {},
            livePreferences: {},
            lastUpdated: Date.now()
        };
    }

    // Obtenir les catégories préférées (triées par fréquence)
    async getPreferredCategories(limit: number = 5): Promise<string[]> {
        try {
            const behavior = await this.getBehavior();

            // Trier les catégories par score décroissant
            const sorted = Object.entries(behavior.categoryPreferences)
                .sort(([, a], [, b]) => b - a)
                .slice(0, limit)
                .map(([category]) => category);

            console.log('[UserBehavior] Catégories préférées:', sorted);
            return sorted;
        } catch (error) {
            console.error('[UserBehavior] Erreur catégories préférées:', error);
            return [];
        }
    }

    // Réinitialiser le comportement
    async resetBehavior(): Promise<void> {
        try {
            await SafeStorage.removeItem(STORAGE_KEY);
            console.log('[UserBehavior] Comportement réinitialisé');
        } catch (error) {
            console.error('[UserBehavior] Erreur reset:', error);
        }
    }

    async trackLiveInterest(liveId: string, event: 'reminder' | 'join' = 'reminder'): Promise<void> {
        if (!liveId) {
            return;
        }
        try {
            const behavior = await this.getBehavior();
            if (!behavior.livePreferences) {
                behavior.livePreferences = {};
            }
            const weight = event === 'join' ? 2 : 1;
            behavior.livePreferences[liveId] = (behavior.livePreferences[liveId] || 0) + weight;
            behavior.lastUpdated = Date.now();
            await SafeStorage.setItem(STORAGE_KEY, JSON.stringify(behavior));
            console.log('[UserBehavior] Live interest enregistré:', { liveId, event });
        } catch (error) {
            console.error('[UserBehavior] Erreur tracking live:', error);
        }
    }

    async getPreferredLives(limit: number = 5): Promise<string[]> {
        try {
            const behavior = await this.getBehavior();
            const map = behavior.livePreferences || {};
            return Object.entries(map)
                .sort(([, a], [, b]) => b - a)
                .slice(0, limit)
                .map(([liveId]) => liveId);
        } catch (error) {
            console.error('[UserBehavior] Erreur préférences live:', error);
            return [];
        }
    }

    // Obtenir les statistiques
    async getStats(): Promise<{
        totalSearches: number;
        topCategories: Array<{ category: string; count: number }>;
        recentSearches: SearchHistory[];
    }> {
        try {
            const behavior = await this.getBehavior();

            const topCategories = Object.entries(behavior.categoryPreferences)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([category, count]) => ({ category, count: Math.round(count) }));

            return {
                totalSearches: behavior.searchHistory.length,
                topCategories,
                recentSearches: behavior.searchHistory.slice(0, 10)
            };
        } catch (error) {
            console.error('[UserBehavior] Erreur stats:', error);
            return {
                totalSearches: 0,
                topCategories: [],
                recentSearches: []
            };
        }
    }
}

export const userBehaviorService = UserBehaviorService.getInstance();
export default userBehaviorService;




