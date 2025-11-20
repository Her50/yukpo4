/**
 * Service pour gérer la configuration de livraison des produits (Frontend)
 * Récupère les données de disponibilité et formate les jours
 */

import { apiService } from './apiService';

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
    cancellation_rate?: number; // Taux d'annulation depuis product_cancellation_stats
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const productDeliveryService = {
    /**
     * Récupérer product_delivery_config pour un produit
     * Retourne : is_immediately_available, preparation_time_minutes, availability_days
     */
    getDeliveryConfig: async (
        serviceId: number,
        productIndex: number
    ): Promise<ProductDeliveryConfig | null> => {
        try {
            const response = await apiService(
                `/api/delivery/product-config/${serviceId}/${productIndex}`,
                { method: 'GET' }
            );

            if (response.status === 404) {
                return null; // Configuration non trouvée
            }

            if (!response.ok) {
                throw new Error('Erreur lors de la récupération de la configuration');
            }

            const data = await response.json();
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
        return sortedDays.map((day) => DAY_NAMES_SHORT[day]).join(', ');
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
        return sortedDays.map((day) => DAY_NAMES[day]).join(', ');
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

    /**
     * Obtenir le badge de taux d'annulation
     */
    getCancellationBadge: (cancellationRate?: number): {
        label: string;
        color: string;
        show: boolean;
    } => {
        if (!cancellationRate && cancellationRate !== 0) {
            return { label: '', color: '', show: false };
        }

        if (cancellationRate >= 30) {
            return {
                label: `⚠️ Annulations fréquentes (${cancellationRate.toFixed(0)}%)`,
                color: 'bg-red-100 text-red-800 border-red-300',
                show: true,
            };
        }

        if (cancellationRate >= 20) {
            return {
                label: `⚠️ Annulations modérées (${cancellationRate.toFixed(0)}%)`,
                color: 'bg-orange-100 text-orange-800 border-orange-300',
                show: true,
            };
        }

        if (cancellationRate >= 10) {
            return {
                label: `⚠️ Quelques annulations (${cancellationRate.toFixed(0)}%)`,
                color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                show: true,
            };
        }

        if (cancellationRate < 5) {
            return {
                label: `✅ Fiable`,
                color: 'bg-green-100 text-green-800 border-green-300',
                show: true,
            };
        }

        return { label: '', color: '', show: false };
    },
};

