import { useEffect, useState } from 'react';
import { userApi } from '../services/api';

interface Favorite {
    id: string;
    service_id: string;
    user_id: string;
    created_at: string;
    service?: any;
}

interface FavoritesResult {
    favorites: Favorite[];
    loading: boolean;
    error: string | null;
    isFavorited: (serviceId: string) => boolean;
    toggleFavorite: (serviceId: string) => Promise<boolean>;
    addFavorite: (serviceId: string) => Promise<boolean>;
    removeFavorite: (serviceId: string) => Promise<boolean>;
}

/**
 * Hook pour gérer les favoris des services
 * Permet d'ajouter, supprimer et vérifier les favoris
 */
export const useFavorites = (userId?: string): FavoritesResult => {
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Charger les favoris de l'utilisateur
    useEffect(() => {
        const loadFavorites = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                console.log(`📊 [useFavorites] Chargement des favoris pour user ${userId}`);

                const response = await (userApi as any).getUserFavorites(userId) as any;

                if (response.success && response.data) {
                    setFavorites(response.data);
                    console.log(`✅ [useFavorites] ${response.data.length} favoris chargés`);
                } else {
                    throw new Error(response.error || 'Erreur lors du chargement des favoris');
                }
            } catch (error) {
                console.error(`❌ [useFavorites] Erreur:`, error);
                setError(error instanceof Error ? error.message : 'Erreur inconnue');
                setFavorites([]);
            } finally {
                setLoading(false);
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadFavorites().catch(error => {
            console.error('[useFavorites] Erreur loadFavorites:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [userId]);

    // Vérifier si un service est en favori
    const isFavorited = (serviceId: string): boolean => {
        return favorites.some(fav => fav.service_id === serviceId);
    };

    // Ajouter un service aux favoris
    const addFavorite = async (serviceId: string): Promise<boolean> => {
        try {
            console.log(`📊 [useFavorites] Ajout du service ${serviceId} aux favoris`);

            const response = await (userApi as any).addFavorite(serviceId) as any;

            if (response.success) {
                const newFavorite: Favorite = {
                    id: response.data.id,
                    service_id: serviceId,
                    user_id: userId || '',
                    created_at: new Date().toISOString()
                };

                setFavorites(prev => [...prev, newFavorite]);
                console.log(`✅ [useFavorites] Service ${serviceId} ajouté aux favoris`);
                return true;
            } else {
                throw new Error(response.error || 'Erreur lors de l\'ajout aux favoris');
            }
        } catch (error) {
            console.error(`❌ [useFavorites] Erreur ajout favori:`, error);
            setError(error instanceof Error ? error.message : 'Erreur inconnue');
            return false;
        }
    };

    // Supprimer un service des favoris
    const removeFavorite = async (serviceId: string): Promise<boolean> => {
        try {
            console.log(`📊 [useFavorites] Suppression du service ${serviceId} des favoris`);

            const favorite = favorites.find(fav => fav.service_id === serviceId);
            if (!favorite) {
                console.warn(`⚠️ [useFavorites] Favori non trouvé pour service ${serviceId}`);
                return false;
            }

            const response = await (userApi as any).removeFavorite(favorite.id) as any;

            if (response.success) {
                setFavorites(prev => prev.filter(fav => fav.service_id !== serviceId));
                console.log(`✅ [useFavorites] Service ${serviceId} supprimé des favoris`);
                return true;
            } else {
                throw new Error(response.error || 'Erreur lors de la suppression des favoris');
            }
        } catch (error) {
            console.error(`❌ [useFavorites] Erreur suppression favori:`, error);
            setError(error instanceof Error ? error.message : 'Erreur inconnue');
            return false;
        }
    };

    // Basculer l'état favori d'un service
    const toggleFavorite = async (serviceId: string): Promise<boolean> => {
        if (isFavorited(serviceId)) {
            return await removeFavorite(serviceId);
        } else {
            return await addFavorite(serviceId);
        }
    };

    return {
        favorites,
        loading,
        error,
        isFavorited,
        toggleFavorite,
        addFavorite,
        removeFavorite
    };
};

export default useFavorites;
