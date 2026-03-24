import { apiGet } from '../services/api';

/** Même forme que `LocationObject` (évite import circulaire depuis LocationSelector). */
export interface EnrichableLocation {
    raw: string;
    place_name: string;
    components?: {
        quartier?: string;
        ville?: string;
        region?: string;
        pays?: string;
    };
    coordinates?: {
        lat: number;
        lng: number;
    };
    geoname_id?: number;
    location_vector?: string[];
    google_types?: string[];
    place_id?: string;
    geometry?: {
        coordinates?: number[];
    };
}

/** Même logique que dans LocationSelector — utilisé pour affichage et après enrich API. */
export const formatLocationDisplay = (location?: EnrichableLocation | string | boolean | null): string => {
    if (!location || location === null) return '';
    if (typeof location === 'boolean') return '';
    if (typeof location === 'string') {
        return location;
    }

    const parts: string[] = [];

    if (location.components?.quartier && !parts.includes(location.components.quartier)) {
        parts.push(location.components.quartier);
    }

    if (location.components?.ville) {
        const ville = location.components.ville;
        if (!parts.includes(ville)) {
            parts.push(ville);
        }
    }

    if (location.components?.region) {
        const region = location.components.region;
        if (!parts.includes(region)) {
            parts.push(region);
        }
    }

    if (location.components?.pays) {
        const pays = location.components.pays;
        if (!parts.includes(pays)) {
            parts.push(pays);
        }
    }

    if (parts.length > 0) {
        return parts.join(', ');
    }

    if (location.raw && typeof location.raw === 'string' && location.raw.trim() !== '') {
        if (location.raw.includes(',') || location.raw.includes(' - ')) {
            return location.raw;
        }
        return location.raw;
    }

    if (location.place_name && location.place_name.trim() !== '') {
        return location.place_name;
    }

    return '';
};

/**
 * Appelle GET /api/places/enrich (GeoNames / métadonnées backend).
 * À utiliser à la soumission ou en arrière-plan — pas à chaque frappe / sélection dans le champ.
 */
export async function enrichLocationWithBackend(location: EnrichableLocation): Promise<EnrichableLocation> {
    try {
        const countryParam = location.components?.pays
            ? `&country=${encodeURIComponent(location.components.pays)}`
            : '';

        const placeName = (location.place_name || location.raw || '').trim();
        if (!placeName) {
            const formattedRaw = formatLocationDisplay(location);
            return {
                ...location,
                raw: formattedRaw || location.place_name || location.raw,
            };
        }

        const response = await apiGet<any>(
            `/api/places/enrich?place_name=${encodeURIComponent(placeName)}${countryParam}`
        );

        if (response.success && response.data) {
            const data: any = response.data;

            const enriched: EnrichableLocation = {
                raw: location.raw,
                place_name: data.place_name || location.place_name || location.raw,
                components: {
                    ville: location.components?.ville || data.place_name || location.place_name || location.raw,
                    region: data.hierarchy?.parents?.[0] || location.components?.region,
                    pays: data.metadata?.country || location.components?.pays,
                    quartier: location.components?.quartier,
                },
                coordinates: data.coordinates || location.coordinates,
                geoname_id: data.geoname_id,
                location_vector: data.location_vector,
            };

            const formattedRaw = formatLocationDisplay(enriched);

            return {
                ...enriched,
                raw: formattedRaw || enriched.place_name || enriched.components?.ville || location.raw,
            };
        }

        const formattedRaw = formatLocationDisplay(location);
        return {
            ...location,
            raw: formattedRaw || location.place_name || location.raw,
        };
    } catch (error) {
        console.error('[enrichLocationWithBackend] Erreur:', error);
        const formattedRaw = formatLocationDisplay(location);
        return {
            ...location,
            raw: formattedRaw || location.place_name || location.raw,
        };
    }
}
