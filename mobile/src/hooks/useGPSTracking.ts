import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
 * Hook personnalisé pour gérer le tracking GPS en temps réel
 * 
 * Fonctionnalités:
 * - Démarre automatiquement si gpsEnabled = true (par défaut)
 * - Met à jour la position toutes les 5 minutes
 * - Envoie les coordonnées au backend automatiquement
 * - Respecte le paramètre gpsEnabled dans les settings
 */
export const useGPSTracking = (): UseGPSTrackingReturn => {
    const { user } = useAuth();
    const [state, setState] = useState<GPSTrackingState>({
        isTracking: false,
        currentLocation: null,
        lastUpdate: null,
        error: null
    });

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const watchRef = useRef<Location.LocationSubscription | null>(null);

    // Vérifier et démarrer automatiquement si GPS activé (avec gestion d'erreur robuste)
    useEffect(() => {
        const checkAndStartGPS = async () => {
            if (!user) return;

            try {
                // Vérifier si le GPS est activé dans les paramètres
                const gpsEnabled = await AsyncStorage.getItem('gpsEnabled');
                const isGPSEnabled = gpsEnabled !== null ? JSON.parse(gpsEnabled) : false; // Par défaut DÉSACTIVÉ pour éviter les crashes

                console.log('[useGPSTracking] Paramètre GPS:', isGPSEnabled);

                if (isGPSEnabled) {
                    console.log('[useGPSTracking] Démarrage automatique du tracking GPS...');
                    // Délai pour éviter le crash au démarrage
                    setTimeout(async () => {
                        try {
                            await startTracking();
                        } catch (trackingError) {
                            console.error('[useGPSTracking] Erreur tracking différé:', trackingError);
                        }
                    }, 2000); // 2 secondes de délai
                } else {
                    console.log('[useGPSTracking] GPS désactivé dans les paramètres');
                }
            } catch (error) {
                console.error('[useGPSTracking] Erreur lors de la vérification GPS:', error);
                // En cas d'erreur, ne pas faire échouer l'app
            }
        };

        // Délai initial pour laisser l'app se charger
        const timeoutId = setTimeout(checkAndStartGPS, 3000);

        return () => clearTimeout(timeoutId);

        // Cleanup au démontage
        return () => {
            if (watchRef.current) {
                watchRef.current.remove();
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [user]);

    // Vérifier périodiquement les changements du paramètre gpsEnabled
    useEffect(() => {
        const checkGPSSettingInterval = setInterval(async () => {
            try {
                const gpsEnabled = await AsyncStorage.getItem('gpsEnabled');
                const isGPSEnabled = gpsEnabled !== null ? JSON.parse(gpsEnabled) : true;

                if (isGPSEnabled && !state.isTracking) {
                    console.log('[useGPSTracking] GPS réactivé, redémarrage du tracking...');
                    await startTracking();
                } else if (!isGPSEnabled && state.isTracking) {
                    console.log('[useGPSTracking] GPS désactivé, arrêt du tracking...');
                    stopTracking();
                }
            } catch (error) {
                console.error('[useGPSTracking] Erreur vérification paramètre GPS:', error);
            }
        }, 10000); // Vérifier toutes les 10 secondes

        return () => {
            clearInterval(checkGPSSettingInterval);
        };
    }, [state.isTracking]);

    const startTracking = async () => {
        try {
            console.log('[useGPSTracking] Demande des permissions...');

            // Demander les permissions de localisation
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                throw new Error('Permission de localisation refusée');
            }

            console.log('[useGPSTracking] Permissions accordées, démarrage du tracking...');

            // Obtenir la position actuelle immédiatement
            await updateLocation();

            // Démarrer le watch de position (mise à jour continue)
            watchRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5 * 60 * 1000, // Mise à jour toutes les 5 minutes
                    distanceInterval: 50, // Ou si déplacement de 50 mètres
                },
                async (location) => {
                    const coords = {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude
                    };

                    console.log('[useGPSTracking] Nouvelle position:', coords);

                    setState(prev => ({
                        ...prev,
                        currentLocation: coords,
                        lastUpdate: new Date(),
                        error: null
                    }));

                    // Envoyer au backend
                    await sendLocationToBackend(coords.lat, coords.lng);
                }
            );

            setState(prev => ({ ...prev, isTracking: true, error: null }));
            console.log('✅ [useGPSTracking] Tracking GPS démarré avec succès');

        } catch (error: any) {
            console.error('[useGPSTracking] Erreur démarrage tracking:', error);
            setState(prev => ({
                ...prev,
                isTracking: false,
                error: error.message
            }));
        }
    };

    const stopTracking = () => {
        console.log('[useGPSTracking] Arrêt du tracking GPS...');

        if (watchRef.current) {
            watchRef.current.remove();
            watchRef.current = null;
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        setState(prev => ({
            ...prev,
            isTracking: false
        }));

        console.log('✅ [useGPSTracking] Tracking GPS arrêté');
    };

    const updateLocation = async () => {
        try {
            console.log('[useGPSTracking] Récupération de la position actuelle...');

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const coords = {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };

            console.log('[useGPSTracking] Position actuelle:', coords);

            setState(prev => ({
                ...prev,
                currentLocation: coords,
                lastUpdate: new Date(),
                error: null
            }));

            // Envoyer au backend
            await sendLocationToBackend(coords.lat, coords.lng);

        } catch (error: any) {
            console.error('[useGPSTracking] Erreur récupération position:', error);
            setState(prev => ({
                ...prev,
                error: error.message
            }));
        }
    };

    const sendLocationToBackend = async (latitude: number, longitude: number) => {
        if (!user?.token) {
            console.warn('[useGPSTracking] Pas de token utilisateur, impossible d\'envoyer la position');
            return;
        }

        try {
            const response = await fetch('https://yukpomnang.onrender.com/api/user/me/gps_location', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    latitude,
                    longitude,
                    accuracy: 10,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                console.log('✅ [useGPSTracking] Position GPS mise à jour dans le backend');
            } else {
                const error = await response.text();
                console.warn('⚠️ [useGPSTracking] Erreur backend:', response.status, error);
            }
        } catch (error) {
            console.error('❌ [useGPSTracking] Erreur réseau:', error);
        }
    };

    return {
        ...state,
        startTracking,
        stopTracking,
        updateLocation
    };
};

