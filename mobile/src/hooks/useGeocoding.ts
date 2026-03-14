import * as Location from 'expo-location';
import { useState } from 'react';

interface GeocodingResult {
    address: string;
    latitude: number;
    longitude: number;
    city: string;
    country: string;
}

export const useGeocoding = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const geocodeAddress = async (address: string): Promise<GeocodingResult | null> => {
        try {
            setLoading(true);
            setError(null);

            const result = await Location.geocodeAsync(address);

            if (result.length > 0) {
                const location = result[0];
                return {
                    address: address,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    city: (location as any).city || '',
                    country: (location as any).country || ''
                };
            }

            return null;
        } catch (err) {
            setError('Erreur lors du géocodage');
            console.error('Geocoding error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
        try {
            setLoading(true);
            setError(null);

            // ✅ CORRIGÉ 2026-01-12: Utiliser reverseGeocodeWithRetry avec retry et fallback
            const { reverseGeocodeAddress } = await import('../utils/reverseGeocoding');
            const address = await reverseGeocodeAddress(latitude, longitude);

            return address;
        } catch (err) {
            setError('Erreur lors du géocodage inverse');
            console.error('Reverse geocoding error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        geocodeAddress,
        reverseGeocode
    };
};

