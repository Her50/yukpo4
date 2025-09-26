import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    country?: string;
}

interface LocationContextType {
    location: LocationData | null;
    loading: boolean;
    error: string | null;
    requestLocationPermission: () => Promise<boolean>;
    getCurrentLocation: () => Promise<LocationData | null>;
    updateLocation: (location: LocationData) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};

interface LocationProviderProps {
    children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
    const [location, setLocation] = useState<LocationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        requestLocationPermission();
    }, []);

    const requestLocationPermission = async (): Promise<boolean> => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                setError('Permission de localisation refusée');
                Alert.alert(
                    'Permission requise',
                    'Cette application a besoin d\'accéder à votre localisation pour fonctionner correctement.',
                    [{ text: 'OK' }]
                );
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erreur lors de la demande de permission:', error);
            setError('Erreur lors de la demande de permission');
            return false;
        }
    };

    const getCurrentLocation = async (): Promise<LocationData | null> => {
        try {
            setLoading(true);
            setError(null);

            const hasPermission = await requestLocationPermission();
            if (!hasPermission) {
                return null;
            }

            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const { latitude, longitude } = currentLocation.coords;

            // Récupérer l'adresse à partir des coordonnées
            const addressResponse = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            const address = addressResponse[0];
            const locationData: LocationData = {
                latitude,
                longitude,
                address: address ? `${address.street || ''} ${address.streetNumber || ''}`.trim() : undefined,
                city: address?.city || address?.subregion,
                country: address?.country,
            };

            setLocation(locationData);
            return locationData;
        } catch (error) {
            console.error('Erreur lors de la récupération de la localisation:', error);
            setError('Impossible de récupérer votre localisation');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const updateLocation = (newLocation: LocationData) => {
        setLocation(newLocation);
    };

    const value: LocationContextType = {
        location,
        loading,
        error,
        requestLocationPermission,
        getCurrentLocation,
        updateLocation,
    };

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};

