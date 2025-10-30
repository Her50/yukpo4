import * as Location from 'expo-location';
import { HOTELS_REELS_PAR_PAYS } from '../data/hotelsReelsAfricains';
import { getUserZone } from '../utils/userZone';
import { apiGet } from './api';

export type HotelStructureType = 'hotel' | 'lodging' | 'accommodation';

interface HotelAutocompleteOptions {
    query?: string;
    type?: HotelStructureType; // 'hotel' par défaut
    useLocation?: boolean; // Utiliser la géolocalisation
    radius?: number; // Rayon en mètres (défaut: 5000)
}

class HotelPlacesService {
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
                console.warn('[HotelPlacesService] Permission de localisation refusée');
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
            console.error('[HotelPlacesService] Erreur géolocalisation:', error);
            return null;
        }
    }

    /**
     * Autocomplete intelligent pour hôtels et hébergements
     * - Priorité 1: Google Maps API avec géolocalisation
     * - Priorité 2: Base de données locale (fallback)
     */
    async autocomplete(options: HotelAutocompleteOptions): Promise<string[]> {
        const { query = '', type = 'hotel', useLocation = true, radius = 5000 } = options;
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
            if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                results.push(...response.data);
            }
        } catch (_err) {
            // Fallback ci-dessous
            console.log('[HotelPlacesService] API Google Maps indisponible, utilisation du fallback local');
        }

        // ✅ PRIORITÉ 2: Base de données locale (fallback)
        const userZone = await getUserZone();
        const localResults = this.getLocalHotels(userZone, query);
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
     * Obtenir les hôtels locaux (fallback)
     */
    private getLocalHotels(
        countryCode: string,
        query: string
    ): string[] {
        let hotels: string[] = HOTELS_REELS_PAR_PAYS[countryCode] || [];

        // Filtrer par query si fournie
        if (query.trim()) {
            const q = query.toLowerCase();
            hotels = hotels.filter(h => h.toLowerCase().includes(q));
        }

        return hotels;
    }
}

export const hotelPlacesService = new HotelPlacesService();


