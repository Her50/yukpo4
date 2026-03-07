/**
 * Service pour gérer la configuration de livraison des produits
 * Récupère les données de disponibilité et formate les jours
 */

import { API_BASE_URL } from '../config/api';
import SafeStorage from '../utils/safeStorage';

export interface ProductDeliveryConfig {
    id: number;
    service_id: number;
    product_index: number;
    is_immediately_available?: boolean;
    preparation_time_minutes?: number;
    max_preparation_time_minutes?: number;
    availability_days?: number[]; // 0=dimanche, 1=lundi, ..., 6=samedi
    pickup_address?: string;
    is_configured: boolean;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const productDeliveryService = {
    /**
     * Récupérer product_delivery_config pour un produit
     * Retourne : is_immediately_available, preparation_time_minutes, availability_days
     */
    getDeliveryConfig: async (serviceId: number, productIndex: number): Promise<ProductDeliveryConfig | null> => {
        // ✅ CORRIGÉ 2026-02-25: Fallback vers clé 'token' pour compatibilité
        let token: string | null = null;
        try {
            token = await SafeStorage.getItem('auth_token');
            if (!token) {
                token = await SafeStorage.getItem('token');
            }
        } catch (tokenError: any) {
            console.warn('[productDeliveryService] Erreur récupération token:', tokenError?.message || tokenError);
            throw new Error('Token d\'authentification manquant');
        }

        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/delivery/product-config/${serviceId}/${productIndex}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404 || response.status === 403) {
                    // 404 = config non trouvée, 403 = ancien backend qui bloque les non-propriétaires
                    return null;
                }
                throw new Error(data.message || 'Erreur lors de la récupération de la configuration');
            }

            return data.config;
        } catch (error: any) {
            console.error('[productDeliveryService] Erreur récupération config:', error);
            throw error;
        }
    },

    /**
     * Formater les jours pour affichage (ex: [1,2,3,4,5] -> "Lun-Ven")
     * 0=dimanche, 1=lundi, ..., 6=samedi
     */
    formatAvailabilityDays: (days: number[]): string => {
        if (!days || days.length === 0) {
            return 'Tous les jours';
        }

        if (days.length === 7) {
            return 'Tous les jours';
        }

        // Trier les jours
        const sortedDays = [...days].sort((a, b) => a - b);

        // Si tous les jours de la semaine (lundi à dimanche)
        if (sortedDays.length === 7) {
            return 'Tous les jours';
        }

        // Si jours consécutifs, utiliser format "Lun-Ven"
        if (sortedDays.length > 1) {
            const firstDay = sortedDays[0];
            const lastDay = sortedDays[sortedDays.length - 1];

            // Vérifier si consécutifs
            let isConsecutive = true;
            for (let i = 1; i < sortedDays.length; i++) {
                if (sortedDays[i] !== sortedDays[i - 1] + 1) {
                    isConsecutive = false;
                    break;
                }
            }

            if (isConsecutive && sortedDays.length > 2) {
                return `${DAY_NAMES_SHORT[firstDay]}-${DAY_NAMES_SHORT[lastDay]}`;
            }
        }

        // Sinon, lister les jours
        return sortedDays.map(day => DAY_NAMES_SHORT[day]).join(', ');
    },

    /**
     * Formater les jours avec noms complets
     */
    formatAvailabilityDaysFull: (days: number[]): string => {
        if (!days || days.length === 0) {
            return 'Tous les jours';
        }

        if (days.length === 7) {
            return 'Tous les jours';
        }

        const sortedDays = [...days].sort((a, b) => a - b);
        return sortedDays.map(day => DAY_NAMES[day]).join(', ');
    },

    /**
     * Vérifier si un produit est disponible aujourd'hui
     */
    isAvailableToday: (availabilityDays?: number[]): boolean => {
        if (!availabilityDays || availabilityDays.length === 0) {
            return true; // Pas de restriction = disponible
        }

        const today = new Date().getDay(); // 0=dimanche, 1=lundi, ..., 6=samedi
        return availabilityDays.includes(today);
    },

    /**
     * Vérifier si un produit est disponible maintenant (jour + heure)
     */
    isAvailableNow: (config: ProductDeliveryConfig | null): boolean => {
        if (!config || !config.is_configured) {
            return false;
        }

        // Vérifier les jours
        if (!productDeliveryService.isAvailableToday(config.availability_days)) {
            return false;
        }

        // TODO: Vérifier les plages horaires si nécessaire
        // Pour l'instant, on se base sur is_available_now depuis le backend
        return true;
    },

    /**
     * Formater le temps de préparation
     */
    formatPreparationTime: (minutes?: number): string => {
        if (!minutes) {
            return 'Temps non défini';
        }

        if (minutes < 60) {
            return `${minutes} min`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h${remainingMinutes}min`;
    },
};

