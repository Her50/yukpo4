import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Text } from 'react-native';

interface LocationContextType {
  location: Location.LocationObject | null;
  errorMsg: string | null;
  isLoading: boolean;
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<Location.LocationObject | null>;
  watchLocation: () => Promise<Location.LocationSubscription | null>;
  stopWatchingLocation: () => void;
  getLocationAddress: (location: Location.LocationObject) => Promise<string | null>;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  // ✅ NOUVEAU 2025-01-01: Ref pour mémoriser la dernière location et éviter les re-renders inutiles
  const lastLocationRef = React.useRef<Location.LocationObject | null>(null);

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission de localisation refusée');
        return false;
      }
      return true;
    } catch (error) {
      setErrorMsg('Erreur lors de la demande de permission');
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      // ✅ CORRIGÉ: Timeout réduit à 10 secondes et meilleure gestion d'erreur
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 1000,
        distanceInterval: 1,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), 10000) // ✅ Réduit à 10s
      );

      const currentLocation = await Promise.race([locationPromise, timeoutPromise]);

      // ✅ CORRIGÉ: Validation des coordonnées GPS pour éviter les crashes
      if (
        !currentLocation?.coords ||
        !Number.isFinite(currentLocation.coords.latitude) ||
        !Number.isFinite(currentLocation.coords.longitude) ||
        currentLocation.coords.latitude < -90 ||
        currentLocation.coords.latitude > 90 ||
        currentLocation.coords.longitude < -180 ||
        currentLocation.coords.longitude > 180
      ) {
        throw new Error('Coordonnées GPS invalides');
      }

      // ✅ NOUVEAU: Mémoriser la dernière position valide
      lastLocationRef.current = currentLocation;
      setLocation(currentLocation);
      return currentLocation;
    } catch (error: any) {
      // ✅ CORRIGÉ: Ne pas logger les timeouts GPS comme des erreurs critiques
      // Les timeouts GPS sont normaux et ne doivent pas être envoyés au backend comme erreurs
      if (error?.message === 'GPS timeout') {
        console.warn('[LocationContext] ⚠️ GPS timeout (normal si GPS lent ou indisponible)');
        setErrorMsg('La localisation prend du temps. Réessayez plus tard.');
      } else {
        // Seules les vraies erreurs sont loggées comme erreurs
        console.error('[LocationContext] ❌ Erreur récupération localisation:', error);
        setErrorMsg(error?.message || 'Erreur lors de la récupération de la localisation');
      }
      
      // ✅ NOUVEAU: Retourner la dernière position connue si disponible en cas de timeout
      if (error?.message === 'GPS timeout' && lastLocationRef.current) {
        console.log('[LocationContext] ✅ Utilisation de la dernière position connue');
        return lastLocationRef.current;
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const watchLocation = async (): Promise<Location.LocationSubscription | null> => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // ✅ OPTIMISÉ 2025-01-01: Augmenter à 30s pour réduire les re-renders
          distanceInterval: 50, // ✅ OPTIMISÉ 2025-01-01: Augmenter à 50m pour réduire les re-renders
        },
        (newLocation) => {
          // ✅ CORRIGÉ: Validation des coordonnées GPS avant de les utiliser
          if (
            newLocation?.coords &&
            Number.isFinite(newLocation.coords.latitude) &&
            Number.isFinite(newLocation.coords.longitude) &&
            newLocation.coords.latitude >= -90 &&
            newLocation.coords.latitude <= 90 &&
            newLocation.coords.longitude >= -180 &&
            newLocation.coords.longitude <= 180
          ) {
            // ✅ OPTIMISÉ 2025-01-01: Ne mettre à jour que si la distance a changé significativement (> 50m)
            const lastLoc = lastLocationRef.current;
            if (lastLoc && lastLoc.coords) {
              const R = 6371; // Rayon de la Terre en kilomètres
              const dLat = (newLocation.coords.latitude - lastLoc.coords.latitude) * Math.PI / 180;
              const dLon = (newLocation.coords.longitude - lastLoc.coords.longitude) * Math.PI / 180;
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lastLoc.coords.latitude * Math.PI / 180) * Math.cos(newLocation.coords.latitude * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const distanceKm = R * c;
              const distanceM = distanceKm * 1000;
              
              // Ne mettre à jour que si la distance a changé de plus de 50 mètres
              if (distanceM < 50) {
                return; // Ignorer cette mise à jour, la distance n'a pas changé significativement
              }
            }
            
            // Mettre à jour la location
            lastLocationRef.current = newLocation;
            setLocation(newLocation);
          } else {
            console.warn('[LocationContext] ⚠️ Coordonnées GPS invalides ignorées:', newLocation);
          }
        }
      );

      setLocationSubscription(subscription);
      return subscription;
    } catch (error: any) {
      console.error('[LocationContext] ❌ Erreur surveillance localisation:', error);
      setErrorMsg(error?.message || 'Erreur lors de la surveillance de la localisation');
      return null;
    }
  };

  const stopWatchingLocation = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
  };

  const getLocationAddress = async (location: Location.LocationObject): Promise<string | null> => {
    try {
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address.length > 0) {
        const addr = address[0];
        return `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`.trim();
      }
      return null;
    } catch (error) {
      console.error('Erreur lors du géocodage inverse:', error);
      return null;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Rayon de la Terre en kilomètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    // ✅ SÉCURITÉ: Vérifier que getCurrentLocation est disponible
    if (typeof getCurrentLocation === 'function') {
      getCurrentLocation().catch((error) => {
        console.warn('[LocationContext] Erreur getCurrentLocation dans useEffect:', error);
      });
    }

    return () => {
      // ✅ SÉCURITÉ: Vérifier que la fonction existe avant de l'appeler
      if (typeof stopWatchingLocation === 'function') {
        try {
          stopWatchingLocation();
        } catch (error) {
          console.warn('[LocationContext] Erreur stopWatchingLocation dans cleanup:', error);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ CORRIGÉ: getCurrentLocation et stopWatchingLocation sont stables, pas besoin de les inclure

  const value: LocationContextType = {
    location,
    errorMsg,
    isLoading,
    requestLocationPermission,
    getCurrentLocation,
    watchLocation,
    stopWatchingLocation,
    getLocationAddress,
    calculateDistance,
  };

  // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
  const safeChildren = React.Children.map(children, (child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <Text key={index}>{String(child)}</Text>;
    }
    if (child == null) {
      return null;
    }
    return child;
  });

  return (
    <LocationContext.Provider value={value}>
      {safeChildren}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

// ✅ HOOK SAFE: Fonctionne avec ou sans provider (ne crash jamais)
export const useLocationSafe = (): LocationContextType => {
  try {
    const context = useContext(LocationContext);
    if (context) {
      return context;
    }
  } catch (error) {
    console.warn('[LocationContext] Provider non disponible, utilisation du fallback');
  }

  // Fallback si le provider n'existe pas
  return {
    location: null,
    errorMsg: null,
    isLoading: false,
    requestLocationPermission: async () => false,
    getCurrentLocation: async () => null,
    watchLocation: async () => null,
    stopWatchingLocation: () => { },
    getLocationAddress: async () => null,
    calculateDistance: () => 0,
  };
};