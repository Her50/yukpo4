/**
 * Service pour gérer l'autocomplete des lieux (places)
 * Adapté depuis mobile/src/services/placesService.ts
 */

import { apiGet } from './apiService';
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
            // ✅ 2026-05-13 : Corrige le mismatch param FE↔BE.
            //   Le backend attend `type` (renommé via #[serde(rename="type")])
            //   et `city`, pas `scope`/`city_context`. Sans ce fix, le scope
            //   était toujours ignoré côté backend (heureusement = recherche
            //   universelle par défaut, mais à corriger pour clarté).
            const params = new URLSearchParams({
                query: query.trim(),
            });

            if (scope && scope !== 'all') {
                params.append('type', scope);
            }

            if (cityContext) {
                params.append('city', cityContext);
            }

            const response = await apiGet(`/api/places/autocomplete?${params.toString()}`);
            const json: any = await response.json().catch(() => ({}));

            if (json?.success && Array.isArray(json?.data)) {
                return json.data as string[];
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

            const response = await apiGet(`/api/places/enrich?${params.toString()}`);
            const json: any = await response.json().catch(() => ({}));

            if (json?.success && json?.data) {
                return json.data as {
                    place_name: string;
                    coordinates?: { lat: number; lng: number };
                    geoname_id?: number;
                    location_vector?: string[];
                    hierarchy?: { parents?: string[] };
                    metadata?: { country?: string };
                };
            }

            return null;
        } catch (error) {
            console.error('[PlacesService] Erreur enrichissement:', error);
            return null;
        }
    }
}

export const placesService = new PlacesService();





