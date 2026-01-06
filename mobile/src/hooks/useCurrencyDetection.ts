/**
 * Hook pour détecter automatiquement la devise basée sur la localisation GPS
 * Utilise getCurrencyIntelligently avec la position GPS actuelle
 */

import { useEffect, useState } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { getCurrencyIntelligently, LocationObject } from '../utils/currencyUtils';

/**
 * Hook pour obtenir la devise automatiquement depuis la localisation GPS
 * @param locationOverride - Localisation optionnelle à utiliser au lieu de la position GPS actuelle
 * @returns La devise détectée (par défaut 'XAF' si aucune localisation disponible)
 */
export const useCurrencyDetection = (locationOverride?: LocationObject | string | null): string => {
    const { location } = useLocation();
    const [currency, setCurrency] = useState<string>('XAF'); // Fallback par défaut

    useEffect(() => {
        // Priorité 1: locationOverride (si fourni)
        if (locationOverride) {
            const detectedCurrency = getCurrencyIntelligently(
                locationOverride,
                location?.coords ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                } : null
            );
            setCurrency(detectedCurrency);
            return;
        }

        // Priorité 2: Position GPS actuelle
        if (location?.coords) {
            // Utiliser getCurrencyIntelligently avec les coordonnées GPS
            // Note: getCurrencyIntelligently utilise principalement le quartier/ville/pays
            // Pour l'instant, on utilise un fallback basé sur la région GPS
            // TODO: Implémenter reverse geocoding pour obtenir le pays depuis GPS
            
            // Pour l'instant, on utilise XAF par défaut pour l'Afrique Centrale
            // Le système sera amélioré avec reverse geocoding
            const detectedCurrency = getCurrencyIntelligently(
                null,
                {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                }
            );
            setCurrency(detectedCurrency);
        } else {
            // Pas de GPS disponible, utiliser le fallback
            setCurrency('XAF');
        }
    }, [location, locationOverride]);

    return currency;
};

/**
 * Fonction utilitaire pour obtenir la devise depuis une localisation spécifique
 * (sans hook, pour utilisation dans des composants non-React ou en dehors de useEffect)
 */
export const getCurrencyFromGPS = (
    gpsCoords?: { lat: number; lng: number } | null,
    locationOverride?: LocationObject | string | null
): string => {
    // Priorité 1: locationOverride
    if (locationOverride) {
        return getCurrencyIntelligently(locationOverride);
    }

    // Priorité 2: GPS avec reverse geocoding (à implémenter)
    // Pour l'instant, fallback XAF
    if (gpsCoords) {
        // TODO: Implémenter reverse geocoding pour obtenir le pays depuis lat/lng
        // Pour l'instant, on utilise XAF par défaut
        return 'XAF';
    }

    // Fallback
    return 'XAF';
};

