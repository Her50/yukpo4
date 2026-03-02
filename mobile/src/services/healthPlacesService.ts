import * as Location from 'expo-location';
import { HOPITAUX_REELS_PAR_PAYS } from '../data/hopitauxReelsAfricains';
import { LABORATOIRES_AFRICAINS_PAR_PAYS } from '../data/laboratoiresAfricains';
import { PHARMACIES_REELLES_PAR_PAYS } from '../data/pharmaciesReellesAfricaines';
import { getUserZone } from '../utils/userZone';
import { apiGet } from './api';

export type HealthStructureType = 'hospital' | 'pharmacy' | 'health';

interface HealthAutocompleteOptions {
    query?: string;
    type: HealthStructureType;
    useLocation?: boolean; // Utiliser la géolocalisation
    radius?: number; // Rayon en mètres (défaut: 5000)
}

class HealthPlacesService {
    private userLocation: { latitude: number; longitude: number } | null = null;

    /**
     * Obtenir la localisation de l'utilisateur
     */
    async getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
        if (this.userLocation) {
            return this.userLocation;
        }

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('[HealthPlacesService] Permission de localisation refusée');
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            this.userLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            return this.userLocation;
        } catch (error) {
            console.error('[HealthPlacesService] Erreur géolocalisation:', error);
            return null;
        }
    }

    /**
     * Autocomplete intelligent pour structures de santé
     * - Priorité 1: Google Maps API avec géolocalisation
     * - Priorité 2: Base de données locale (fallback)
     */
    async autocomplete(options: HealthAutocompleteOptions): Promise<string[]> {
        const { query = '', type, useLocation = true, radius = 5000 } = options;
        const results: string[] = [];

        // ✅ PRIORITÉ 1: Backend Google Maps API avec géolocalisation
        try {
            let url = `/api/places/autocomplete?query=${encodeURIComponent(query)}&type=${type}`;

            // Ajouter géolocalisation si activée
            if (useLocation) {
                const location = await this.getUserLocation();
                if (location) {
                    url += `&lat=${location.latitude}&lng=${location.longitude}&radius=${radius}`;
                }
            }

            const response = await apiGet<{ success: boolean; data?: string[] }>(url);
            // ✅ FIX 2026-03-03: apiGet retourne { success, data: <backend_json> }
            const backendResp = response.data as any;
            if (response.success && backendResp?.success && Array.isArray(backendResp.data) && backendResp.data.length > 0) {
                results.push(...backendResp.data);
            }
        } catch (_err) {
            // Fallback ci-dessous
        }

        // ✅ PRIORITÉ 2: Base de données locale (fallback)
        const userZone = await getUserZone();
        const localResults = this.getLocalHealthStructures(type, userZone, query);
        results.push(...localResults);

        // Dédupliquer
        const seen = new Set<string>();
        const unique = results.filter(item => {
            const key = item.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return unique.slice(0, 30);
    }

    /**
     * Obtenir les structures de santé locales (fallback)
     */
    private getLocalHealthStructures(
        type: HealthStructureType,
        countryCode: string,
        query: string
    ): string[] {
        let structures: string[] = [];

        // Sélectionner la base de données appropriée
        switch (type) {
            case 'hospital':
                structures = HOPITAUX_REELS_PAR_PAYS[countryCode] || [];
                break;
            case 'pharmacy':
                structures = PHARMACIES_REELLES_PAR_PAYS[countryCode] || [];
                break;
            case 'health':
                // Pour "health" général, combiner labos + hôpitaux + pharmacies
                const labos = LABORATOIRES_AFRICAINS_PAR_PAYS[countryCode] || [];
                const hopitaux = HOPITAUX_REELS_PAR_PAYS[countryCode] || [];
                const pharmacies = PHARMACIES_REELLES_PAR_PAYS[countryCode] || [];
                structures = [...labos, ...hopitaux, ...pharmacies];
                break;
        }

        // Filtrer par query si fournie
        if (query.trim()) {
            const q = query.toLowerCase();
            structures = structures.filter(s => s.toLowerCase().includes(q));
        }

        return structures;
    }
}

export const healthPlacesService = new HealthPlacesService();

