import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { locationApi } from '../services/api';

interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  address?: string;
  accuracy?: number;
  timestamp?: number;
}

interface LocationContextType {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission de localisation refusée.');
        Alert.alert(
          'Permission de localisation',
          'L\'application a besoin de votre localisation pour fonctionner. Veuillez l\'activer dans les paramètres.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les paramètres', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }
      setError(null);
      return true;
    } catch (err: any) {
      console.error('Erreur demande permission localisation:', err);
      setError('Erreur lors de la demande de permission de localisation.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setLoading(true);
    setError(null);
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      let locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy } = locationResult.coords;
      let city, country, address;

      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode && geocode.length > 0) {
          city = geocode[0].city || undefined;
          country = geocode[0].country || undefined;
          address = geocode[0].name || undefined;
        }
      } catch (geocodeError) {
        console.warn('Erreur géocodage inverse:', geocodeError);
        // Continuer même si le géocodage échoue
      }

      const locationData: LocationData = {
        latitude,
        longitude,
        city,
        country,
        address,
        accuracy: accuracy || undefined,
      };

      setLocation(locationData);
      return locationData;
    } catch (err: any) {
      console.error('Erreur récupération localisation:', err);
      setError('Impossible de récupérer la localisation actuelle.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [requestLocationPermission]);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  const value: LocationContextType = {
    location,
    loading,
    error,
    requestLocationPermission,
    getCurrentLocation,
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
    throw new Error('useLocation doit être utilisé dans un LocationProvider');
  }
  return context;
};