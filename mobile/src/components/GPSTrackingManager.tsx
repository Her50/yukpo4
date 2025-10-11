import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGPSTracking } from '../hooks/useGPSTracking';

/**
 * Composant transparent qui gère automatiquement le tracking GPS en arrière-plan
 * 
 * Fonctionnalités:
 * - Démarre automatiquement si gpsEnabled = true (par défaut)
 * - S'arrête automatiquement si l'utilisateur désactive le GPS dans les paramètres
 * - Met à jour la position toutes les 5 minutes
 * - Envoie les coordonnées au backend automatiquement
 * - Ne rend aucun UI (composant invisible)
 */
const GPSTrackingManager: React.FC = () => {
    const { user } = useAuth();
    const { isTracking, currentLocation, lastUpdate, error } = useGPSTracking();

    // Logs de suivi pour le développement
    useEffect(() => {
        if (user && isTracking) {
            console.log('[GPSTrackingManager] 📍 Tracking GPS actif pour:', user.email);
            if (currentLocation) {
                console.log('[GPSTrackingManager] Position actuelle:', currentLocation);
            }
            if (lastUpdate) {
                console.log('[GPSTrackingManager] Dernière mise à jour:', lastUpdate.toLocaleString());
            }
        }
    }, [user, isTracking, currentLocation, lastUpdate]);

    useEffect(() => {
        if (error) {
            console.error('[GPSTrackingManager] ❌ Erreur tracking GPS:', error);
        }
    }, [error]);

    // Ce composant ne rend rien (invisible)
    return null;
};

export default GPSTrackingManager;


