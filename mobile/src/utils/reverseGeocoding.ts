/**
 * Utilitaire pour le géocodage inverse avec retry et fallback
 * Gère les timeouts et erreurs de manière robuste
 */

import * as Location from 'expo-location';

export interface ReverseGeocodeResult {
    address: string;
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    region?: string;
    country?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 3000]; // 1s, 2s, 3s
const TIMEOUT_MS = 10000; // 10 secondes

/**
 * Effectue un géocodage inverse avec retry et timeout
 * @param latitude Latitude
 * @param longitude Longitude
 * @param options Options de configuration
 * @returns Résultat du géocodage ou null en cas d'échec
 */
export const reverseGeocodeWithRetry = async (
    latitude: number,
    longitude: number,
    options: {
        maxRetries?: number;
        timeoutMs?: number;
        fallbackAddress?: string;
    } = {}
): Promise<ReverseGeocodeResult | null> => {
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
    const fallbackAddress = options.fallbackAddress;

    // Vérifier que les coordonnées sont valides
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        console.warn('[reverseGeocodeWithRetry] Coordonnées invalides:', { latitude, longitude });
        return fallbackAddress ? { address: fallbackAddress } : null;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[reverseGeocodeWithRetry] Tentative ${attempt + 1}/${maxRetries + 1} pour (${latitude}, ${longitude})`);

            // Créer une promesse avec timeout
            const geocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout géocodage inverse')), timeoutMs);
            });

            const result = await Promise.race([geocodePromise, timeoutPromise]);

            if (result && result.length > 0) {
                const addr = result[0];
                const addressParts: string[] = [];
                
                if (addr.name) addressParts.push(addr.name);
                if (addr.street) addressParts.push(addr.street);
                if (addr.district) addressParts.push(addr.district);
                if (addr.city) addressParts.push(addr.city);
                if (addr.region) addressParts.push(addr.region);
                if (addr.country) addressParts.push(addr.country);

                const fullAddress = addressParts.filter(Boolean).join(', ') || 
                    addr.name || 
                    addr.street || 
                    addr.district || 
                    addr.city || 
                    'Lieu sélectionné';

                console.log(`[reverseGeocodeWithRetry] ✅ Succès tentative ${attempt + 1}:`, fullAddress);

                return {
                    address: fullAddress,
                    name: addr.name || undefined,
                    street: addr.street || undefined,
                    district: addr.district || undefined,
                    city: addr.city || undefined,
                    region: addr.region || undefined,
                    country: addr.country || undefined,
                };
            }

            // Si aucun résultat mais pas d'erreur, utiliser le fallback
            if (fallbackAddress) {
                console.log('[reverseGeocodeWithRetry] Aucun résultat, utilisation du fallback');
                return { address: fallbackAddress };
            }

            return null;
        } catch (error: any) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errorMessage = error?.message || String(error);
            const isTimeout = errorMessage.includes('Timeout') || errorMessage.includes('timeout');
            const isUnavailable = errorMessage.includes('UNAVAILABLE') || errorMessage.includes('unavailable');

            console.warn(
                `[reverseGeocodeWithRetry] ⚠️ Tentative ${attempt + 1} échouée:`,
                errorMessage,
                isTimeout ? '(timeout)' : isUnavailable ? '(unavailable)' : ''
            );

            // Si c'est la dernière tentative, ne pas retry
            if (attempt >= maxRetries) {
                break;
            }

            // Attendre avant de retry (sauf pour la dernière tentative)
            const delay = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Toutes les tentatives ont échoué
    console.error(
        `[reverseGeocodeWithRetry] ❌ Toutes les tentatives ont échoué après ${maxRetries + 1} essais:`,
        lastError?.message
    );

    // Utiliser le fallback si disponible
    if (fallbackAddress) {
        console.log('[reverseGeocodeWithRetry] Utilisation du fallback après échec');
        return { address: fallbackAddress };
    }

    // Générer une adresse basique à partir des coordonnées
    const basicAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    console.log('[reverseGeocodeWithRetry] Utilisation adresse basique (coordonnées)');
    return { address: basicAddress };
};

/**
 * Version simplifiée qui retourne juste l'adresse en string
 */
export const reverseGeocodeAddress = async (
    latitude: number,
    longitude: number,
    fallback?: string
): Promise<string | null> => {
    const result = await reverseGeocodeWithRetry(latitude, longitude, { fallbackAddress: fallback });
    return result?.address || null;
};

