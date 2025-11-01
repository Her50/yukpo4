/**
 * Service de géocodage pour convertir noms de lieux en coordonnées GPS
 */

interface GeocodeResult {
    lat: number;
    lon: number;
    displayName?: string;
}

/**
 * Géocode un nom de lieu en coordonnées GPS
 * Utilise Nominatim (OpenStreetMap)
 */
export async function geocodeLocation(locationName: string): Promise<GeocodeResult | null> {
    if (!locationName || locationName.trim().length === 0) {
        return null;
    }

    try {
        console.log('[Geocoding] Recherche:', locationName);

        // Appel API Nominatim
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(locationName)}&` +
            `format=json&` +
            `limit=1&` +
            `countrycodes=cm&` + // Cameroun par défaut
            `addressdetails=1`
        );

        if (!response.ok) {
            console.error('[Geocoding] Erreur HTTP:', response.status);
            return null;
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            console.warn('[Geocoding] Aucun résultat pour:', locationName);
            return null;
        }

        const result = data[0];
        const geocoded: GeocodeResult = {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            displayName: result.display_name
        };

        console.log('[Geocoding] ✅ Trouvé:', geocoded);
        return geocoded;

    } catch (error) {
        console.error('[Geocoding] Erreur:', error);
        return null;
    }
}

/**
 * Parse une chaîne GPS en coordonnées
 * Formats supportés:
 * - "lat,lon"
 * - "POINT(lon lat)" (PostGIS)
 */
export function parseGPS(gps: string | null | undefined): { lat: number, lon: number } | null {
    if (!gps || typeof gps !== 'string') {
        return null;
    }

    // Format "lat,lon"
    if (gps.includes(',')) {
        const parts = gps.split(',');
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0].trim());
            const lon = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lon)) {
                return { lat, lon };
            }
        }
    }

    // Format "POINT(lon lat)" (PostGIS)
    const pointMatch = gps.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (pointMatch) {
        const lon = parseFloat(pointMatch[1]);
        const lat = parseFloat(pointMatch[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
            return { lat, lon };
        }
    }

    console.warn('[parseGPS] Format GPS non reconnu:', gps);
    return null;
}

/**
 * Formate des coordonnées pour affichage
 */
export function formatCoordinates(lat: number, lon: number, precision: number = 4): string {
    return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * Formate une distance pour affichage
 */
export function formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    if (distanceKm < 10) {
        return `${distanceKm.toFixed(1)} km`;
    }
    return `${Math.round(distanceKm)} km`;
}

