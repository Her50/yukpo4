import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    distance: number;
    rating: number;
    price: string;
    location: {
        latitude: number;
        longitude: number;
    };
    address: string;
    phone?: string;
    website?: string;
}

export const useNearbyServices = (latitude?: number, longitude?: number, radius: number = 5000) => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchNearbyServices = async (lat: number, lon: number, searchRadius: number = radius) => {
        try {
            setLoading(true);
            setError(null);

            // API réelle pour les services à proximité
            const response = await api.get('/services/nearby', {
                params: {
                    latitude: lat,
                    longitude: lon,
                    radius: searchRadius,
                    limit: 20
                }
            });

            const rd: any = response.data;
            if (rd && rd.services) {
                const servicesData: Service[] = rd.services.map((service: any) => ({
                    id: service.id,
                    name: service.name,
                    description: service.description || 'Service disponible',
                    category: service.category || 'Général',
                    distance: service.distance || 0,
                    rating: service.rating || 0,
                    price: service.price || '€',
                    location: {
                        latitude: service.latitude,
                        longitude: service.longitude
                    },
                    address: service.address || '',
                    phone: service.phone,
                    website: service.website
                }));
                setServices(servicesData);
            } else {
                // Fallback avec services par défaut si l'API ne répond pas
                const fallbackServices: Service[] = [
                    {
                        id: 'fallback-1',
                        name: 'Service non disponible',
                        description: 'Les services à proximité ne sont pas disponibles pour le moment',
                        category: 'Information',
                        distance: 0,
                        rating: 0,
                        price: '',
                        location: { latitude: lat, longitude: lon },
                        address: 'Position actuelle'
                    }
                ];
                setServices(fallbackServices);
            }
        } catch (err) {
            console.error('Nearby services API error:', err);
            setError('Impossible de récupérer les services à proximité');

            // Fallback en cas d'erreur
            const fallbackServices: Service[] = [
                {
                    id: 'error-1',
                    name: 'Erreur de connexion',
                    description: 'Vérifiez votre connexion internet',
                    category: 'Erreur',
                    distance: 0,
                    rating: 0,
                    price: '',
                    location: { latitude: lat, longitude: lon },
                    address: 'Position actuelle'
                }
            ];
            setServices(fallbackServices);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (latitude && longitude) {
            // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
            fetchNearbyServices(latitude, longitude).catch(error => {
                console.error('[useNearbyServices] Erreur fetchNearbyServices:', error);
            });
        }
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [latitude, longitude, radius]);

    return {
        services,
        loading,
        error,
        fetchNearbyServices
    };
};
