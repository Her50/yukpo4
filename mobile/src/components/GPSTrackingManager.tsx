// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiPatch } from '../services/api';

/**
 * Composant GPS Manager réécrit pour éviter les crashes
 * 
 * Fonctionnalités:
 * - Démarre le GPS uniquement si activé dans les paramètres
 * - Gestion d'erreur robuste
 * - Pas de démarrage automatique au lancement
 * - Tracking en arrière-plan sécurisé
 */
const GPSTrackingManager: React.FC = () => {
    const { user } = useAuth();
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Vérifier si le GPS est activé dans les paramètres
    useEffect(() => {
        const checkGPSStatus = async () => {
            if (!user) {
                setIsActive(false);
                return;
            }

            try {
                const gpsEnabled = await SafeStorage.getItem('gpsEnabled');
                const isGPSEnabled = gpsEnabled !== null ? JSON.parse(gpsEnabled) : false;

                console.log('[GPSTrackingManager] GPS activé:', isGPSEnabled);

                if (isGPSEnabled) {
                    // Délai pour éviter les blocages au démarrage
                    // Réduit à 2 secondes car LazyManagers attend déjà 5 secondes
                    setTimeout(() => {
                        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
                        startGPSTracking().catch(error => {
                            console.error('[GPSTrackingManager] Erreur startGPSTracking:', error);
                        });
                    }, 2000); // 2 secondes après le chargement du manager
                }
            } catch (error) {
                console.error('[GPSTrackingManager] Erreur vérification GPS:', error);
                setError('Erreur vérification GPS');
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        checkGPSStatus().catch(error => {
            console.error('[GPSTrackingManager] Erreur checkGPSStatus:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [user]);

    const startGPSTracking = async () => {
        try {
            console.log('[GPSTrackingManager] 🚀 Démarrage du tracking GPS...');

            // Vérifier les permissions
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                console.log('[GPSTrackingManager] Permissions GPS refusées');
                setError('Permissions GPS refusées');
                return;
            }

            // Obtenir la position actuelle
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const coords = {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };

            console.log('[GPSTrackingManager] 📍 Position actuelle:', coords);

            // Envoyer au backend
            await sendLocationToBackend(coords.lat, coords.lng);

            // Démarrer le tracking en arrière-plan
            const watchSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 5 * 60 * 1000, // 5 minutes
                    distanceInterval: 50, // 50 mètres
                },
                async (newLocation) => {
                    try {
                        const newCoords = {
                            lat: newLocation.coords.latitude,
                            lng: newLocation.coords.longitude
                        };

                        console.log('[GPSTrackingManager] 📍 Nouvelle position:', newCoords);

                        // Envoyer au backend
                        await sendLocationToBackend(newCoords.lat, newCoords.lng);
                    } catch (error) {
                        console.error('[GPSTrackingManager] Erreur mise à jour position:', error);
                    }
                }
            );

            setIsActive(true);
            setError(null);
            console.log('[GPSTrackingManager] ✅ Tracking GPS démarré avec succès');

            // Cleanup function
            return () => {
                console.log('[GPSTrackingManager] 🛑 Arrêt du tracking GPS...');
                watchSubscription.remove();
                setIsActive(false);
            };

        } catch (error: any) {
            console.error('[GPSTrackingManager] ❌ Erreur démarrage GPS:', error);
            setError(error.message);
            setIsActive(false);
        }
    };

    const sendLocationToBackend = async (latitude: number, longitude: number) => {
        if (!user?.token) {
            console.warn('[GPSTrackingManager] Pas de token utilisateur');
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
                console.log('[GPSTrackingManager] ✅ Position envoyée au backend');
            } else {
                console.warn('[GPSTrackingManager] ⚠️ Erreur backend:', response.status);
            }
        } catch (error) {
            console.error('[GPSTrackingManager] ❌ Erreur réseau:', error);
        }
    };

    // Logs de suivi
    useEffect(() => {
        if (user && isActive) {
            console.log('[GPSTrackingManager] 📍 Tracking GPS actif pour:', user.email);
        }
    }, [user, isActive]);

    useEffect(() => {
        if (error) {
            console.error('[GPSTrackingManager] ❌ Erreur GPS:', error);
        }
    }, [error]);

    // Ce composant ne rend rien (invisible)
    return null;
};

export default GPSTrackingManager;