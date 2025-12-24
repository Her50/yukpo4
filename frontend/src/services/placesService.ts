/**
 * Service pour gérer l'autocomplete des lieux (places)
 * Adapté depuis mobile/src/services/placesService.ts
 */

import { apiGet } from './api';
import { buildUrl } from '../config/api.config';

export type PlaceScope = 'city' | 'point' | 'neighborhood' | 'all';

class PlacesService {
    /**
     * Autocomplete de lieux
     * @param query Requête de recherche
     * @param scope Type de lieu recherché (optionnel)
     * @param cityContext Contexte de ville pour filtrer les résultats (optionnel)
     */
    async autocomplete(
        query: string,
        scope?: PlaceScope,
        cityContext?: string
    ): Promise<string[]> {
        if (!query || query.trim().length < 2) {
            return [];
        }

        try {
            const params = new URLSearchParams({
                query: query.trim(),
            });

            if (scope && scope !== 'all') {
                params.append('scope', scope);
            }

            if (cityContext) {
                params.append('city_context', cityContext);
            }

            const response = await apiGet<{
                success: boolean;
                data: string[];
                count: number;
            }>(`/api/places/autocomplete?${params.toString()}`);

            if (response.success && Array.isArray(response.data)) {
                return response.data;
            }

            return [];
        } catch (error) {
            console.error('[PlacesService] Erreur autocomplete:', error);
            return [];
        }
    }

    /**
     * Enrichir un lieu avec les données backend (GeoNames)
     * @param placeName Nom du lieu
     * @param country Pays (optionnel)
     */
    async enrich(
        placeName: string,
        country?: string
    ): Promise<{
        place_name: string;
        coordinates?: { lat: number; lng: number };
        geoname_id?: number;
        location_vector?: string[];
        hierarchy?: { parents?: string[] };
        metadata?: { country?: string };
    } | null> {
        try {
            const params = new URLSearchParams({
                place_name: placeName,
            });

            if (country) {
                params.append('country', country);
            }

            const response = await apiGet<{
                success: boolean;
                data: {
                    place_name: string;
                    coordinates?: { lat: number; lng: number };
                    geoname_id?: number;
                    location_vector?: string[];
                    hierarchy?: { parents?: string[] };
                    metadata?: { country?: string };
                };
            }>(`/api/places/enrich?${params.toString()}`);

            if (response.success && response.data) {
                return response.data;
            }

            return null;
        } catch (error) {
            console.error('[PlacesService] Erreur enrichissement:', error);
            return null;
        }
    }
}

export const placesService = new PlacesService();




