/**
 * Hook pour gérer les données utilisateur
 * Compatible avec AuthContext existant
 */

import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../utils/roleHelpers'; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

export const useUser = () => {
    const { user, loading } = useAuth();

    return {
        user,
        loading,
        isAuthenticated: !!user,
        // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
        isAdmin: isAdminUser(user),
        isPrestataire: user?.role === 'prestataire',
    };
};

export default useUser;
