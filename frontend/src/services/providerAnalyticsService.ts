/**
 * Service pour les analytics prestataire
 * Récupère les statistiques, métriques et analyses pour le dashboard prestataire
 */

import { apiService } from './apiService';

export interface DateRange {
    start: Date;
    end: Date;
}

export interface OrderStatistics {
    total: number;
    pending: number;
    validated: number;
    ready: number;
    rejected: number;
    cancelled: number;
    by_status: Record<string, number>;
}

export interface PreparationTimeMetrics {
    average_minutes: number;
    median_minutes: number;
    min_minutes: number;
    max_minutes: number;
    by_product: Array<{
        service_id: number;
        product_index: number;
        average_minutes: number;
        order_count: number;
    }>;
}

export interface RejectionAnalytics {
    total_rejections: number;
    rejection_rate: number; // Pourcentage
    reasons: Array<{
        reason: string;
        count: number;
        percentage: number;
    }>;
    by_product: Array<{
        service_id: number;
        product_index: number;
        rejection_count: number;
        rejection_rate: number;
    }>;
}

export interface CancellationAnalytics {
    total_cancellations: number;
    cancellation_rate: number; // Pourcentage global
    by_type: {
        timeout: number;
        rejected: number;
        provider_cancelled: number;
        courier_unavailable: number;
    };
    by_product: Array<{
        service_id: number;
        product_index: number;
        total_orders: number;
        total_cancellations: number;
        cancellation_rate: number;
        timeout_cancellations: number;
        rejected_cancellations: number;
    }>;
    top_reasons: Array<{
        reason: string;
        count: number;
    }>;
    evolution: Array<{
        date: string;
        cancellation_rate: number;
        total_cancellations: number;
    }>;
    high_cancellation_products: Array<{
        service_id: number;
        product_index: number;
        cancellation_rate: number;
    }>; // Produits avec taux > 20%
}

export interface PenaltiesAnalytics {
    total_penalties: number;
    total_amount_cents: number;
    average_amount_cents: number;
    evolution: Array<{
        date: string;
        count: number;
        total_amount_cents: number;
    }>;
}

export interface ProductPerformance {
    service_id: number;
    product_index: number;
    total_orders: number;
    average_preparation_minutes: number;
    validation_rate: number;
    cancellation_rate: number;
    rejection_rate: number;
}

export interface ImmediateAvailabilityStats {
    immediate_products: {
        count: number;
        total_orders: number;
        average_preparation_minutes: number;
        satisfaction_rate?: number;
    };
    delayed_products: {
        count: number;
        total_orders: number;
        average_preparation_minutes: number;
        satisfaction_rate?: number;
    };
    comparison: {
        order_volume_difference: number; // Pourcentage
        satisfaction_difference?: number; // Pourcentage
    };
}

export interface ProviderDashboardData {
    order_stats: OrderStatistics;
    preparation_time_stats: PreparationTimeMetrics;
    rejection_stats: RejectionAnalytics;
    cancellation_stats: CancellationAnalytics;
    penalties_stats: PenaltiesAnalytics;
    product_performance: ProductPerformance[];
    immediate_availability_stats: ImmediateAvailabilityStats;
}

export const providerAnalyticsService = {
    /**
     * Statistiques commandes (pending, validated, rejected, etc.)
     */
    getOrderStatistics: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<OrderStatistics> => {
        const params = new URLSearchParams();
        if (dateRange) {
            params.append('period_start', dateRange.start.toISOString());
            params.append('period_end', dateRange.end.toISOString());
        }

        const response = await apiService(
            `/api/provider/${providerId}/analytics/orders?${params.toString()}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des statistiques commandes');
        }

        const data = await response.json();
        return data.order_stats;
    },

    /**
     * Métriques délais de préparation
     * Temps moyen, médian, par produit, etc.
     */
    getPreparationTimeMetrics: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<PreparationTimeMetrics> => {
        const params = new URLSearchParams();
        if (dateRange) {
            params.append('period_start', dateRange.start.toISOString());
            params.append('period_end', dateRange.end.toISOString());
        }

        const response = await apiService(
            `/api/provider/${providerId}/analytics/preparation-time?${params.toString()}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des métriques de préparation');
        }

        const data = await response.json();
        return data.preparation_time_stats;
    },

    /**
     * Analyse des rejets (raisons, fréquences, tendances)
     */
    getRejectionAnalytics: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<RejectionAnalytics> => {
        const params = new URLSearchParams();
        if (dateRange) {
            params.append('period_start', dateRange.start.toISOString());
            params.append('period_end', dateRange.end.toISOString());
        }

        const response = await apiService(
            `/api/provider/${providerId}/analytics/rejections?${params.toString()}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération de l\'analyse des rejets');
        }

        const data = await response.json();
        return data.rejection_stats;
    },

    /**
     * Analyse des annulations (timeout, rejet, etc.)
     * Taux d'annulation par produit, raisons, évolution
     */
    getCancellationAnalytics: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<CancellationAnalytics> => {
        const params = new URLSearchParams();
        if (dateRange) {
            params.append('period_start', dateRange.start.toISOString());
            params.append('period_end', dateRange.end.toISOString());
        }

        const response = await apiService(
            `/api/provider/${providerId}/analytics/cancellations?${params.toString()}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération de l\'analyse des annulations');
        }

        const data = await response.json();
        return data.cancellation_stats;
    },

    /**
     * Analyse des pénalités (montant total, nombre, évolution)
     */
    getPenaltiesAnalytics: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<PenaltiesAnalytics> => {
        // TODO: Implémenter route backend pour pénalités
        // Pour l'instant, retourner des données vides
        return {
            total_penalties: 0,
            total_amount_cents: 0,
            average_amount_cents: 0,
            evolution: [],
        };
    },

    /**
     * Performance par produit (temps préparation, taux validation)
     */
    getProductPerformance: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<ProductPerformance[]> => {
        const params = new URLSearchParams();
        if (dateRange) {
            params.append('period_start', dateRange.start.toISOString());
            params.append('period_end', dateRange.end.toISOString());
        }

        const response = await apiService(
            `/api/provider/${providerId}/analytics/product-performance?${params.toString()}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération de la performance produits');
        }

        const data = await response.json();
        return data.product_performance_stats || [];
    },

    /**
     * Stats produits disponibles immédiatement vs avec délai
     */
    getImmediateAvailabilityStats: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<ImmediateAvailabilityStats> => {
        const params = new URLSearchParams();
        if (dateRange) {
            params.append('period_start', dateRange.start.toISOString());
            params.append('period_end', dateRange.end.toISOString());
        }

        const response = await apiService(
            `/api/provider/${providerId}/analytics/availability-stats?${params.toString()}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des stats disponibilité');
        }

        const data = await response.json();
        return data.availability_stats;
    },

    /**
     * Données complètes du dashboard
     */
    getDashboardData: async (
        providerId: number,
        dateRange?: DateRange
    ): Promise<ProviderDashboardData> => {
        const params = new URLSearchParams();
        if (dateRange) {
            params.append('period_start', dateRange.start.toISOString());
            params.append('period_end', dateRange.end.toISOString());
        }

        const response = await apiService(
            `/api/provider/${providerId}/analytics/dashboard?${params.toString()}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des données dashboard');
        }

        const data = await response.json();
        return data.dashboard_data;
    },
};

