/**
 * Service pour gérer l'historique de recherche
 * Permet d'enregistrer les recherches et de récupérer les suggestions intelligentes
 */

import { apiCall, apiGet } from './api';

export interface SearchHistoryEntry {
    id: number;
    user_id?: number;
    query_text: string;
    query_type: string;
    category?: string;
    filters?: Record<string, any>;
    location_lat?: number;
    location_lon?: number;
    results_count: number;
    clicked_result_id?: number;
    clicked_at?: string;
    session_id?: string;
    device_type?: string;
    created_at: string;
}

export interface PopularSearch {
    query_text: string;
    search_count: number;
    last_searched: string;
}

export interface SearchSuggestion {
    query_text: string;
    search_count: number;
}

class SearchHistoryService {
    /**
     * Enregistrer une recherche dans l'historique
     * @param query_text Texte de la recherche
     * @param query_type Type: "text", "image", "voice", "autocomplete"
     * @param category Catégorie filtrée (optionnel)
     * @param filters Filtres appliqués (optionnel)
     * @param location_lat Latitude GPS (optionnel)
     * @param location_lon Longitude GPS (optionnel)
     * @param results_count Nombre de résultats trouvés
     * @param session_id ID de session (optionnel)
     * @param device_type Type d'appareil: "mobile", "web", "tablet" (optionnel)
     */
    async recordSearch(
        query_text: string,
        query_type: 'text' | 'image' | 'voice' | 'autocomplete' = 'text',
        options?: {
            category?: string;
            filters?: Record<string, any>;
            location_lat?: number;
            location_lon?: number;
            results_count?: number;
            session_id?: string;
            device_type?: 'mobile' | 'web' | 'tablet';
        }
    ): Promise<number | null> {
        try {
            const response = await apiCall<{
                success: boolean;
                id: number;
                message: string;
            }>('/api/search/history/record', {
                method: 'POST',
                body: JSON.stringify({
                    query_text,
                    query_type,
                    category: options?.category,
                    filters: options?.filters,
                    location_lat: options?.location_lat,
                    location_lon: options?.location_lon,
                    results_count: options?.results_count || 0,
                    session_id: options?.session_id,
                    device_type: options?.device_type || 'mobile',
                }),
            });

            if (response.success && response.data?.id) {
                return response.data.id;
            }

            return null;
        } catch (error) {
            console.error('[SearchHistoryService] Erreur enregistrement recherche:', error);
            return null;
        }
    }

    /**
     * Enregistrer un clic sur un résultat de recherche
     * @param search_id ID de la recherche
     * @param result_id ID du résultat sur lequel l'utilisateur a cliqué
     */
    async recordClick(search_id: number, result_id: number): Promise<boolean> {
        try {
            const response = await apiCall<{
                success: boolean;
                message: string;
            }>(`/api/search/history/${search_id}/click`, {
                method: 'POST',
                body: JSON.stringify({
                    result_id,
                }),
            });

            return response.success === true;
        } catch (error) {
            console.error('[SearchHistoryService] Erreur enregistrement clic:', error);
            return false;
        }
    }

    /**
     * Récupérer les recherches populaires
     * @param limit Nombre maximum de résultats (défaut: 10)
     * @param category Catégorie filtrée (optionnel)
     * @param days Nombre de jours à considérer (défaut: 30)
     */
    async getPopularSearches(
        limit: number = 10,
        category?: string,
        days: number = 30
    ): Promise<PopularSearch[]> {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                days: days.toString(),
            });

            if (category) {
                params.append('category', category);
            }

            const response = await apiGet<{
                success: boolean;
                data: PopularSearch[];
                count: number;
            }>(`/api/search/history/popular?${params.toString()}`);

            if (response.success && Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('[SearchHistoryService] Erreur récupération recherches populaires:', error);
            return [];
        }
    }

    /**
     * Récupérer les suggestions de recherche
     * @param prefix Préfixe de recherche (optionnel)
     * @param limit Nombre maximum de suggestions (défaut: 5)
     */
    async getSuggestions(prefix?: string, limit: number = 5): Promise<SearchSuggestion[]> {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
            });

            if (prefix) {
                params.append('prefix', prefix);
            }

            const response = await apiGet<{
                success: boolean;
                data: SearchSuggestion[];
                count: number;
            }>(`/api/search/history/suggestions?${params.toString()}`);

            if (response.success && Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('[SearchHistoryService] Erreur récupération suggestions:', error);
            return [];
        }
    }

    /**
     * Récupérer l'historique de recherche de l'utilisateur connecté
     * @param limit Nombre maximum de résultats (défaut: 50)
     */
    async getUserHistory(limit: number = 50): Promise<SearchHistoryEntry[]> {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
            });

            const response = await apiGet<{
                success: boolean;
                data: SearchHistoryEntry[];
                count: number;
            }>(`/api/search/history/user?${params.toString()}`);

            if (response.success && Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('[SearchHistoryService] Erreur récupération historique:', error);
            return [];
        }
    }

    /**
     * Générer un ID de session unique pour regrouper les recherches
     */
    generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const searchHistoryService = new SearchHistoryService();

