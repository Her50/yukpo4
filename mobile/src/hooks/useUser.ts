/**
 * Hook pour gérer les données utilisateur
 * Compatible avec AuthContext existant
 */

import { useAuth } from '../contexts/AuthContext';

export const useUser = () => {
    const { user, loading } = useAuth();

    return {
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isPrestataire: user?.role === 'prestataire',
    };
};

export default useUser;
