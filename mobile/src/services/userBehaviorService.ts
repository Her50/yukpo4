// Service de tracking du comportement utilisateur
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SearchHistory {
    query: string;
    category?: string;
    timestamp: number;
}

interface UserBehavior {
    searchHistory: SearchHistory[];
    categoryPreferences: Record<string, number>; // catégorie -> nombre de recherches
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

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(behavior));
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

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(behavior));
        } catch (error) {
            console.error('[UserBehavior] Erreur tracking produit:', error);
        }
    }

    // Obtenir le comportement de l'utilisateur
    async getBehavior(): Promise<UserBehavior> {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('[UserBehavior] Erreur lecture:', error);
        }

        return {
            searchHistory: [],
            categoryPreferences: {},
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
            await AsyncStorage.removeItem(STORAGE_KEY);
            console.log('[UserBehavior] Comportement réinitialisé');
        } catch (error) {
            console.error('[UserBehavior] Erreur reset:', error);
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


