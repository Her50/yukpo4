import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

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

      // ✅ CORRIGÉ: Ajout d'un timeout pour éviter les blocages GPS
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 1000,
        distanceInterval: 1,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), 15000)
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

      setLocation(currentLocation);
      return currentLocation;
    } catch (error: any) {
      console.error('[LocationContext] ❌ Erreur récupération localisation:', error);
      setErrorMsg(error?.message || 'Erreur lors de la récupération de la localisation');
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
          timeInterval: 5000,
          distanceInterval: 10,
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
    getCurrentLocation();

    return () => {
      stopWatchingLocation();
    };
  }, []);

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

  return (
    <LocationContext.Provider value={value}>
      {children}
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