/**
 * Hook pour gérer les services de l'utilisateur
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';

export const useUserServices = () => {
    const { user } = useAuth();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasServices, setHasServices] = useState(false);

    useEffect(() => {
        if (user?.id) {
            loadUserServices();
        }
    }, [user?.id]);

    const loadUserServices = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/services/user/${user.id}`);
            setServices(response.data || []);
            setHasServices((response.data || []).length > 0);
        } catch (error) {
            console.error('Erreur chargement services utilisateur:', error);
            setServices([]);
            setHasServices(false);
        } finally {
            setLoading(false);
        }
    };

    return {
        services,
        loading,
        hasServices,
        refetch: loadUserServices,
    };
};

export default useUserServices;
