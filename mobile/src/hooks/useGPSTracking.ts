import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiPatch } from '../services/api';

interface GPSTrackingState {
    isTracking: boolean;
    currentLocation: { lat: number; lng: number } | null;
    lastUpdate: Date | null;
    error: string | null;
}

interface UseGPSTrackingReturn extends GPSTrackingState {
    startTracking: () => Promise<void>;
    stopTracking: () => void;
    updateLocation: () => Promise<void>;
}

/**
 * Hook GPS simplifié et sécurisé
 * 
 * Fonctionnalités:
 * - Pas de démarrage automatique (évite les crashes)
 * - Gestion d'erreur robuste
 * - Timeouts pour éviter les blocages
 * - Tracking manuel uniquement
 */
export const useGPSTracking = (): UseGPSTrackingReturn => {
    const { user } = useAuth();
    const [state, setState] = useState<GPSTrackingState>({
        isTracking: false,
        currentLocation: null,
        lastUpdate: null,
        error: null
    });

    const watchRef = useRef<Location.LocationSubscription | null>(null);

    // Cleanup au démontage
    useEffect(() => {
        return () => {
            if (watchRef.current) {
                watchRef.current.remove();
            }
        };
    }, []);

    const startTracking = async () => {
        try {
            console.log('[useGPSTracking] 🚀 Démarrage du tracking GPS...');
            
            setState(prev => ({ ...prev, error: null }));

            // Demander les permissions avec timeout
            const permissionPromise = Location.requestForegroundPermissionsAsync();
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Permission timeout')), 10000)
            );

            const { status } = await Promise.race([permissionPromise, timeoutPromise]);

            if (status !== 'granted') {
                throw new Error('Permission de localisation refusée');
            }

            console.log('[useGPSTracking] ✅ Permissions accordées');

            // Obtenir la position actuelle
            await updateLocation();

            // Démarrer le tracking
            watchRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 5 * 60 * 1000, // 5 minutes
                    distanceInterval: 50, // 50 mètres
                },
                async (location) => {
                    try {
                        const coords = {
                            lat: location.coords.latitude,
                            lng: location.coords.longitude
                        };

                        console.log('[useGPSTracking] 📍 Nouvelle position:', coords);

                        setState(prev => ({
                            ...prev,
                            currentLocation: coords,
                            lastUpdate: new Date(),
                            error: null
                        }));

                        // Envoyer au backend
                        await sendLocationToBackend(coords.lat, coords.lng);
                    } catch (error) {
                        console.error('[useGPSTracking] Erreur mise à jour position:', error);
                    }
                }
            );

            setState(prev => ({ ...prev, isTracking: true }));
            console.log('[useGPSTracking] ✅ Tracking démarré avec succès');

        } catch (error: any) {
            console.error('[useGPSTracking] ❌ Erreur démarrage:', error);
            setState(prev => ({
                ...prev,
                isTracking: false,
                error: error.message
            }));
        }
    };

    const stopTracking = () => {
        console.log('[useGPSTracking] 🛑 Arrêt du tracking GPS...');

        if (watchRef.current) {
            watchRef.current.remove();
            watchRef.current = null;
        }

        setState(prev => ({
            ...prev,
            isTracking: false
        }));

        console.log('[useGPSTracking] ✅ Tracking arrêté');
    };

    const updateLocation = async () => {
        try {
            console.log('[useGPSTracking] 📍 Récupération position actuelle...');

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const coords = {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };

            console.log('[useGPSTracking] 📍 Position actuelle:', coords);

            setState(prev => ({
                ...prev,
                currentLocation: coords,
                lastUpdate: new Date(),
                error: null
            }));

            // Envoyer au backend
            await sendLocationToBackend(coords.lat, coords.lng);

        } catch (error: any) {
            console.error('[useGPSTracking] ❌ Erreur récupération position:', error);
            setState(prev => ({
                ...prev,
                error: error.message
            }));
        }
    };

    const sendLocationToBackend = async (latitude: number, longitude: number) => {
        if (!user?.token) {
            console.warn('[useGPSTracking] Pas de token utilisateur');
            return;
        }

        try {
            const response = await apiPatch('/api/user/me/gps_location', {
                latitude,
                longitude,
                accuracy: 10,
                timestamp: new Date().toISOString()
            });

            if (response.ok) {
                console.log('[useGPSTracking] ✅ Position envoyée au backend');
            } else {
                console.warn('[useGPSTracking] ⚠️ Erreur backend:', response.status);
            }
        } catch (error) {
            console.error('[useGPSTracking] ❌ Erreur réseau:', error);
        }
    };

    return {
        ...state,
        startTracking,
        stopTracking,
        updateLocation
    };
};