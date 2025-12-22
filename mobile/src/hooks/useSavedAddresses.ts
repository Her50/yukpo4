import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';
import { LocationObject } from '../components/LocationSelector';

export interface UserSavedAddress {
    id: number;
    user_id: number;
    label: string;
    address_type: 'pickup' | 'dropoff' | 'both';
    address: string;
    latitude: number;
    longitude: number;
    location_data?: any; // JSONB pour LocationObject
    contact_name?: string;
    contact_phone?: string;
    instructions?: string;
    building_number?: string;
    floor?: string;
    apartment?: string;
    is_default_pickup: boolean;
    is_default_dropoff: boolean;
    usage_count: number;
    last_used_at?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserSavedAddressInput {
    label: string;
    address_type: 'pickup' | 'dropoff' | 'both';
    address: string;
    latitude: number;
    longitude: number;
    location_data?: any;
    contact_name?: string;
    contact_phone?: string;
    instructions?: string;
    building_number?: string;
    floor?: string;
    apartment?: string;
    is_default_pickup?: boolean;
    is_default_dropoff?: boolean;
}

interface SavedAddressesResponse {
    success: boolean;
    addresses: UserSavedAddress[];
    total: number;
}

interface SavedAddressResponse {
    success: boolean;
    address: UserSavedAddress;
}

/**
 * Hook pour gérer les adresses sauvegardées de l'utilisateur
 */
export const useSavedAddresses = (addressType?: 'pickup' | 'dropoff' | 'both') => {
    const [addresses, setAddresses] = useState<UserSavedAddress[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Charger les adresses sauvegardées
     */
    const fetchAddresses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = addressType ? `?address_type=${addressType}` : '';
            const response = await apiGet<SavedAddressesResponse>(
                `/api/delivery/saved-addresses${params}`
            );
            
            if (response.success && response.addresses) {
                setAddresses(response.addresses);
            } else {
                setAddresses([]);
            }
        } catch (err: any) {
            console.error('[useSavedAddresses] Erreur lors du chargement des adresses:', err);
            setError(err?.message || 'Erreur lors du chargement des adresses');
            setAddresses([]);
        } finally {
            setLoading(false);
        }
    }, [addressType]);

    /**
     * Créer une nouvelle adresse sauvegardée
     */
    const createAddress = useCallback(async (input: UserSavedAddressInput): Promise<UserSavedAddress> => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiPost<SavedAddressResponse>(
                '/api/delivery/saved-addresses',
                input
            );
            
            if (response.success && response.address) {
                // Recharger la liste
                await fetchAddresses();
                return response.address;
            } else {
                throw new Error(response.error || 'Erreur lors de la création de l\'adresse');
            }
        } catch (err: any) {
            console.error('[useSavedAddresses] Erreur lors de la création:', err);
            setError(err?.message || 'Erreur lors de la création de l\'adresse');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchAddresses]);

    /**
     * Créer une adresse depuis un LocationObject (helper)
     */
    const createAddressFromLocation = useCallback(async (
        location: LocationObject,
        label: string,
        addressType: 'pickup' | 'dropoff' | 'both' = 'both',
        options?: {
            contact_name?: string;
            contact_phone?: string;
            instructions?: string;
            is_default_pickup?: boolean;
            is_default_dropoff?: boolean;
        }
    ): Promise<UserSavedAddress> => {
        const coords = location.coordinates;
        if (!coords?.lat || !coords?.lng) {
            throw new Error('Coordonnées GPS manquantes');
        }

        const input: UserSavedAddressInput = {
            label,
            address_type: addressType,
            address: location.raw || location.place_name || '',
            latitude: coords.lat,
            longitude: coords.lng,
            location_data: location,
            contact_name: options?.contact_name,
            contact_phone: options?.contact_phone,
            instructions: options?.instructions,
            is_default_pickup: options?.is_default_pickup,
            is_default_dropoff: options?.is_default_dropoff,
        };

        return createAddress(input);
    }, [createAddress]);

    /**
     * Mettre à jour une adresse sauvegardée
     */
    const updateAddress = useCallback(async (
        id: number,
        input: Partial<UserSavedAddressInput>
    ): Promise<UserSavedAddress> => {
        setLoading(true);
        setError(null);
        try {
            // Récupérer l'adresse existante pour fusionner
            const existing = addresses.find(a => a.id === id);
            if (!existing) {
                throw new Error('Adresse non trouvée');
            }

            const fullInput: UserSavedAddressInput = {
                label: input.label ?? existing.label,
                address_type: input.address_type ?? existing.address_type,
                address: input.address ?? existing.address,
                latitude: input.latitude ?? existing.latitude,
                longitude: input.longitude ?? existing.longitude,
                location_data: input.location_data ?? existing.location_data,
                contact_name: input.contact_name ?? existing.contact_name,
                contact_phone: input.contact_phone ?? existing.contact_phone,
                instructions: input.instructions ?? existing.instructions,
                building_number: input.building_number ?? existing.building_number,
                floor: input.floor ?? existing.floor,
                apartment: input.apartment ?? existing.apartment,
                is_default_pickup: input.is_default_pickup ?? existing.is_default_pickup,
                is_default_dropoff: input.is_default_dropoff ?? existing.is_default_dropoff,
            };

            const response = await apiPut<SavedAddressResponse>(
                `/api/delivery/saved-addresses/${id}`,
                fullInput
            );
            
            if (response.success && response.address) {
                // Recharger la liste
                await fetchAddresses();
                return response.address;
            } else {
                throw new Error(response.error || 'Erreur lors de la mise à jour');
            }
        } catch (err: any) {
            console.error('[useSavedAddresses] Erreur lors de la mise à jour:', err);
            setError(err?.message || 'Erreur lors de la mise à jour');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [addresses, fetchAddresses]);

    /**
     * Supprimer une adresse sauvegardée
     */
    const deleteAddress = useCallback(async (id: number): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiDelete<{ success: boolean; message?: string }>(
                `/api/delivery/saved-addresses/${id}`
            );
            
            if (response.success) {
                // Recharger la liste
                await fetchAddresses();
            } else {
                throw new Error('Erreur lors de la suppression');
            }
        } catch (err: any) {
            console.error('[useSavedAddresses] Erreur lors de la suppression:', err);
            setError(err?.message || 'Erreur lors de la suppression');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchAddresses]);

    /**
     * Définir une adresse comme défaut
     */
    const setDefaultAddress = useCallback(async (
        id: number,
        addressType: 'pickup' | 'dropoff'
    ): Promise<UserSavedAddress> => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiPost<SavedAddressResponse>(
                `/api/delivery/saved-addresses/${id}/set-default`,
                { address_type: addressType }
            );
            
            if (response.success && response.address) {
                // Recharger la liste
                await fetchAddresses();
                return response.address;
            } else {
                throw new Error(response.error || 'Erreur lors de la définition de l\'adresse par défaut');
            }
        } catch (err: any) {
            console.error('[useSavedAddresses] Erreur lors de la définition par défaut:', err);
            setError(err?.message || 'Erreur lors de la définition de l\'adresse par défaut');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchAddresses]);

    /**
     * Obtenir l'adresse par défaut pour un type
     */
    const getDefaultAddress = useCallback((type: 'pickup' | 'dropoff'): UserSavedAddress | undefined => {
        return addresses.find(addr => 
            (type === 'pickup' && addr.is_default_pickup) ||
            (type === 'dropoff' && addr.is_default_dropoff)
        );
    }, [addresses]);

    /**
     * Obtenir les adresses les plus utilisées (triées par usage_count et last_used_at)
     */
    const getMostUsedAddresses = useCallback((limit: number = 5): UserSavedAddress[] => {
        return [...addresses]
            .sort((a, b) => {
                // D'abord par usage_count décroissant
                if (b.usage_count !== a.usage_count) {
                    return b.usage_count - a.usage_count;
                }
                // Ensuite par last_used_at décroissant
                if (a.last_used_at && b.last_used_at) {
                    return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
                }
                if (a.last_used_at) return -1;
                if (b.last_used_at) return 1;
                return 0;
            })
            .slice(0, limit);
    }, [addresses]);

    // Charger les adresses au montage
    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    return {
        addresses,
        loading,
        error,
        fetchAddresses,
        createAddress,
        createAddressFromLocation,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        getDefaultAddress,
        getMostUsedAddresses,
    };
};


