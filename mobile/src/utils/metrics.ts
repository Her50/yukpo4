/**
 * Utilitaires pour mesurer les métriques de performance et business
 */

import { analytics } from '../services/analytics';

interface PerformanceMetrics {
    screenLoadTime: number;
    apiResponseTime: number;
    renderTime: number;
}

interface BusinessMetrics {
    conversionRate: number;
    averageBookingTime: number;
    abandonmentRate: number;
    revenue: number;
}

/**
 * Mesurer le temps de chargement d'un écran
 */
export const measureScreenLoad = (screenName: string): (() => void) => {
    const startTime = performance.now();

    return () => {
        const loadTime = performance.now() - startTime;
        analytics.trackScreenLoad(screenName, loadTime);

        // Alerter si le temps de chargement est trop long
        if (loadTime > 2000) {
            console.warn(`[Metrics] ${screenName} prend ${loadTime.toFixed(0)}ms à charger (>2s)`);
        }
    };
};

/**
 * Mesurer le temps de réponse d'une API
 */
export const measureAPIResponse = async <T>(
    endpoint: string,
    apiCall: () => Promise<T>
): Promise<T> => {
    const startTime = performance.now();
    let success = false;

    try {
        const result = await apiCall();
        success = true;
        return result;
    } catch (error) {
        throw error;
    } finally {
        const responseTime = performance.now() - startTime;
        analytics.trackAPIResponse(endpoint, responseTime, success);
    }
};

/**
 * Calculer le taux de conversion
 */
export const calculateConversionRate = (
    searches: number,
    bookings: number
): number => {
    if (searches === 0) return 0;
    return (bookings / searches) * 100;
};

/**
 * Calculer le temps moyen de réservation
 */
export const calculateAverageBookingTime = (
    bookingTimes: number[]
): number => {
    if (bookingTimes.length === 0) return 0;
    const sum = bookingTimes.reduce((a, b) => a + b, 0);
    return sum / bookingTimes.length;
};

/**
 * Calculer le taux d'abandon
 */
export const calculateAbandonmentRate = (
    started: number,
    completed: number
): number => {
    if (started === 0) return 0;
    return ((started - completed) / started) * 100;
};

/**
 * Stocker une métrique localement
 */
export const storeMetric = (key: string, value: number | string) => {
    try {
        // Utiliser AsyncStorage pour persister
        // import AsyncStorage from '@react-native-async-storage/async-storage';
        // await AsyncStorage.setItem(`metric_${key}`, JSON.stringify(value));
    } catch (error) {
        console.error('[Metrics] Erreur stockage:', error);
    }
};

/**
 * Récupérer une métrique stockée
 */
export const getStoredMetric = async (key: string): Promise<number | string | null> => {
    try {
        // import AsyncStorage from '@react-native-async-storage/async-storage';
        // const value = await AsyncStorage.getItem(`metric_${key}`);
        // return value ? JSON.parse(value) : null;
        return null;
    } catch (error) {
        console.error('[Metrics] Erreur récupération:', error);
        return null;
    }
};

/**
 * Formater une métrique pour affichage
 */
export const formatMetric = (value: number, type: 'percentage' | 'time' | 'currency' | 'number'): string => {
    switch (type) {
        case 'percentage':
            return `${value.toFixed(1)}%`;
        case 'time':
            if (value < 1000) {
                return `${value.toFixed(0)}ms`;
            }
            return `${(value / 1000).toFixed(2)}s`;
        case 'currency':
            return `${value.toLocaleString('fr-FR')} FCFA`;
        case 'number':
            return value.toLocaleString('fr-FR');
        default:
            return value.toString();
    }
};

/**
 * Comparer deux métriques
 */
export const compareMetrics = (
    current: number,
    previous: number
): { difference: number; percentageChange: number; trend: 'up' | 'down' | 'stable' } => {
    const difference = current - previous;
    const percentageChange = previous !== 0 ? (difference / previous) * 100 : 0;
    const trend = Math.abs(percentageChange) < 1 ? 'stable' : percentageChange > 0 ? 'up' : 'down';

    return {
        difference,
        percentageChange,
        trend,
    };
};

export default {
    measureScreenLoad,
    measureAPIResponse,
    calculateConversionRate,
    calculateAverageBookingTime,
    calculateAbandonmentRate,
    storeMetric,
    getStoredMetric,
    formatMetric,
    compareMetrics,
};


