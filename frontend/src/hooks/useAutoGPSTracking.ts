import { useState, useEffect, useCallback, useRef } from 'react';
import { gpsTrackingService } from '@/services/gpsTrackingService';
import { useUser } from './useUser';

interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export const useAutoGPSTracking = () => {
  const { user } = useUser();
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GPSLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Définir getCurrentLocation en premier pour éviter les problèmes d'ordre
  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await gpsTrackingService.getCurrentLocation();
      if (location) {
        const gpsLocation: GPSLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: Date.now(),
        };
        
        setCurrentLocation(gpsLocation);
        setError(null);
        
        console.log(`📍 Position GPS mise à jour: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
        
        // Envoyer au backend
        await updateBackendGPS(location.latitude, location.longitude, location.accuracy);
        
        return gpsLocation;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la position:', error);
      setError('Erreur lors de la récupération de la position GPS');
      throw error; // Propager l'erreur pour la gestion des retries
    }
    return null;
  }, []);

  const updateBackendGPS = useCallback(async (latitude: number, longitude: number, accuracy?: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }
      
      const response = await fetch('/api/user/me/gps_location', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // S'assurer que ce header est présent
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy: accuracy || 10,
        }),
      });

      if (response.ok) {
        console.log('✅ Position GPS mise à jour dans le backend');
      } else {
        console.warn('⚠️ Erreur lors de la mise à jour GPS dans le backend');
        setError('Erreur lors de la mise à jour GPS dans le backend');
      }
    } catch (error) {
      console.error('❌ Erreur réseau lors de la mise à jour GPS:', error);
      setError('Erreur réseau lors de la mise à jour GPS');
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (isTracking) return;
    
    try {
      console.log('🚀 Démarrage du tracking GPS automatique...');
      
      // Démarrer le service de tracking
      gpsTrackingService.startTracking();
      setIsTracking(true);
      setError(null);
      retryCountRef.current = 0;

      // Obtenir la position actuelle
      await getCurrentLocation();

      // Configurer la mise à jour automatique avec gestion d'erreur
      const trackLocation = async () => {
        try {
          await getCurrentLocation();
          retryCountRef.current = 0; // Reset retry count on success
          
          // Continuer le tracking toutes les 5 minutes
          trackingIntervalRef.current = setTimeout(trackLocation, 5 * 60 * 1000);
        } catch (error) {
          retryCountRef.current++;
          
          if (retryCountRef.current >= maxRetries) {
            setError(`Échec GPS après ${maxRetries} tentatives: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
            setIsTracking(false);
            return;
          }
          
          // Attendre avant de réessayer (backoff exponentiel)
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          console.log(`🔄 Tentative ${retryCountRef.current}/${maxRetries} dans ${delay}ms...`);
          trackingIntervalRef.current = setTimeout(trackLocation, delay);
        }
      };
      
      // Démarrer le cycle de tracking
      trackingIntervalRef.current = setTimeout(trackLocation, 5 * 60 * 1000);
      
    } catch (error) {
      console.error('❌ Erreur lors du démarrage du tracking GPS:', error);
      setError('Erreur lors du démarrage du tracking GPS');
      setIsTracking(false);
    }
  }, [isTracking, getCurrentLocation]);

  const stopTracking = useCallback(() => {
    gpsTrackingService.stopTracking();
    setIsTracking(false);
    
    // Nettoyer les intervalles
    if (trackingIntervalRef.current) {
      clearTimeout(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    
    console.log('🛑 Tracking GPS arrêté');
  }, []);

  const getLocationString = useCallback(() => {
    if (!currentLocation) return '';
    return `${currentLocation.latitude.toFixed(6)},${currentLocation.longitude.toFixed(6)}`;
  }, [currentLocation]);

  // Nettoyer les intervalles lors du démontage
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearTimeout(trackingIntervalRef.current);
      }
    };
  }, []);

  return {
    isTracking,
    currentLocation,
    locationString: getLocationString(),
    error,
    startTracking,
    stopTracking,
    getCurrentLocation,
    updateBackendGPS
  };
}; 