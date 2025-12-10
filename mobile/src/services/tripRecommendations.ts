/**
 * Service de recommandations de trajets
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../utils/safeStorage';
import { apiGet } from './api';

interface TripRecommendation {
    route: string;
    departure_city: string;
    arrival_city: string;
    price: number;
    duration_minutes: number;
    popularity_score: number;
    reason: string;
}

interface UserTripHistory {
    route: string;
    departure_city: string;
    arrival_city: string;
    timestamp: number;
    count: number;
}

class TripRecommendationsService {
    private readonly HISTORY_KEY = 'trip_history';
    private readonly FAVORITES_KEY = 'favorite_trips';

    /**
     * Enregistrer un trajet dans l'historique
     */
    async recordTrip(departureCity: string, arrivalCity: string) {
        try {
            const route = `${departureCity} → ${arrivalCity}`;
            const existing = await SafeStorage.getItem(this.HISTORY_KEY);
            const history: UserTripHistory[] = existing ? JSON.parse(existing) : [];

            const existingIndex = history.findIndex((h) => h.route === route);
            if (existingIndex >= 0) {
                history[existingIndex].count += 1;
                history[existingIndex].timestamp = Date.now();
            } else {
                history.push({
                    route,
                    departure_city: departureCity,
                    arrival_city: arrivalCity,
                    timestamp: Date.now(),
                    count: 1,
                });
            }

            // Garder seulement les 50 derniers
            history.sort((a, b) => b.timestamp - a.timestamp);
            const limited = history.slice(0, 50);

            await SafeStorage.setItem(this.HISTORY_KEY, JSON.stringify(limited));
        } catch (error) {
            console.error('[TripRecommendations] Erreur enregistrement:', error);
        }
    }

    /**
     * Obtenir l'historique des trajets
     */
    async getTripHistory(): Promise<UserTripHistory[]> {
        try {
            const existing = await SafeStorage.getItem(this.HISTORY_KEY);
            return existing ? JSON.parse(existing) : [];
        } catch (error) {
            console.error('[TripRecommendations] Erreur récupération historique:', error);
            return [];
        }
    }

    /**
     * Obtenir les trajets favoris
     */
    async getFavoriteTrips(): Promise<string[]> {
        try {
            const existing = await SafeStorage.getItem(this.FAVORITES_KEY);
            return existing ? JSON.parse(existing) : [];
        } catch (error) {
            console.error('[TripRecommendations] Erreur récupération favoris:', error);
            return [];
        }
    }

    /**
     * Ajouter un trajet aux favoris
     */
    async addFavoriteTrip(route: string) {
        try {
            const favorites = await this.getFavoriteTrips();
            if (!favorites.includes(route)) {
                favorites.push(route);
                await SafeStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
            }
        } catch (error) {
            console.error('[TripRecommendations] Erreur ajout favori:', error);
        }
    }

    /**
     * Retirer un trajet des favoris
     */
    async removeFavoriteTrip(route: string) {
        try {
            const favorites = await this.getFavoriteTrips();
            const filtered = favorites.filter((f) => f !== route);
            await SafeStorage.setItem(this.FAVORITES_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('[TripRecommendations] Erreur retrait favori:', error);
        }
    }

    /**
     * Obtenir des recommandations basées sur l'historique
     */
    async getRecommendations(departureCity?: string): Promise<TripRecommendation[]> {
        try {
            const history = await this.getTripHistory();
            const favorites = await this.getFavoriteTrips();

            // Si pas d'historique, retourner des recommandations populaires
            if (history.length === 0) {
                return await this.getPopularRecommendations(departureCity);
            }

            // Analyser l'historique pour trouver des patterns
            const cityCounts: { [key: string]: number } = {};
            history.forEach((trip) => {
                cityCounts[trip.departure_city] = (cityCounts[trip.departure_city] || 0) + trip.count;
                cityCounts[trip.arrival_city] = (cityCounts[trip.arrival_city] || 0) + trip.count;
            });

            // Recommander des trajets depuis la ville la plus fréquentée
            const topCity = Object.entries(cityCounts)
                .sort(([, a], [, b]) => b - a)[0]?.[0];

            const recommendations: TripRecommendation[] = [];

            // Recommandations basées sur l'historique
            history.slice(0, 5).forEach((trip) => {
                recommendations.push({
                    route: trip.route,
                    departure_city: trip.departure_city,
                    arrival_city: trip.arrival_city,
                    price: 0, // Sera rempli par l'API
                    duration_minutes: 0,
                    popularity_score: trip.count,
                    reason: `Vous avez déjà voyagé ${trip.count} fois sur ce trajet`,
                });
            });

            // Ajouter des recommandations populaires
            const popular = await this.getPopularRecommendations(departureCity || topCity);
            recommendations.push(...popular.slice(0, 3));

            return recommendations.slice(0, 10);
        } catch (error) {
            console.error('[TripRecommendations] Erreur recommandations:', error);
            return [];
        }
    }

    /**
     * Obtenir des recommandations populaires depuis le backend
     */
    private async getPopularRecommendations(departureCity?: string): Promise<TripRecommendation[]> {
        try {
            const response = await apiGet(
                `/api/recommendations/trips${departureCity ? `?departure_city=${departureCity}` : ''}`
            );

            if (response.success && response.recommendations) {
                return response.recommendations;
            }

            // Fallback: recommandations par défaut
            return [
                {
                    route: 'Yaoundé → Douala',
                    departure_city: 'Yaoundé',
                    arrival_city: 'Douala',
                    price: 25000,
                    duration_minutes: 180,
                    popularity_score: 0.9,
                    reason: 'Trajet le plus populaire',
                },
                {
                    route: 'Douala → Yaoundé',
                    departure_city: 'Douala',
                    arrival_city: 'Yaoundé',
                    price: 25000,
                    duration_minutes: 180,
                    popularity_score: 0.85,
                    reason: 'Retour populaire',
                },
            ];
        } catch (error) {
            console.error('[TripRecommendations] Erreur recommandations populaires:', error);
            return [];
        }
    }
}

export const tripRecommendations = new TripRecommendationsService();
export default tripRecommendations;


