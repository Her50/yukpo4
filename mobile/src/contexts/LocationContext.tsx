import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Location from 'expo-location';

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

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 1000,
        distanceInterval: 1,
      });

      setLocation(currentLocation);
      return currentLocation;
    } catch (error) {
      setErrorMsg('Erreur lors de la récupération de la localisation');
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
          setLocation(newLocation);
        }
      );

      setLocationSubscription(subscription);
      return subscription;
    } catch (error) {
      setErrorMsg('Erreur lors de la surveillance de la localisation');
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
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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