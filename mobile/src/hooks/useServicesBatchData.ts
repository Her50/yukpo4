import { useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS } from '../config/api.config';
import { apiGet } from '../services/api';

// Types pour les reviews
interface Review {
    id: number;
    user_id: number;
    user_name: string;
    rating: number;
    comment: string;
    helpful_count: number;
    created_at: string;
}

interface ServiceReviewsStats {
    average_rating: number;
    total_reviews: number;
    rating_distribution: { [key: number]: number };
    completion_rate: number;
    response_time: number;
}

// Types pour les stats
interface ServiceStats {
    views: number;
    shares: number;
    likes: number;
    contacts: number;
    messages: number;
    rating: number;
    totalRatings: number;
    createdDaysAgo: number;
}

// Types de retour
interface ServiceReviewsData {
    reviews: Review[];
    stats: ServiceReviewsStats | null;
}

interface ServiceStatsData {
    stats: ServiceStats | null;
}

interface ServicesBatchData {
    [serviceId: number]: {
        reviews: ServiceReviewsData;
        stats: ServiceStatsData;
    };
}

interface UseServicesBatchDataReturn {
    data: ServicesBatchData;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Hook pour charger les reviews et stats de plusieurs services en une seule fois
 * Utilise les endpoints batch pour optimiser les performances
 * 
 * @param serviceIds - Liste des IDs de services à charger
 * @param serviceCreatedAts - Map des dates de création par serviceId (optionnel, pour calculer createdDaysAgo)
 */
export const useServicesBatchData = (
    serviceIds: number[],
    serviceCreatedAts?: Map<number, string>
): UseServicesBatchDataReturn => {
    const [data, setData] = useState<ServicesBatchData>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastLoadedIdsRef = useRef<string>('');

    const fetchBatchData = async () => {
        if (!serviceIds || serviceIds.length === 0) {
            setLoading(false);
            setData({});
            return;
        }

        // Vérifier si on a déjà chargé ces mêmes services
        const currentIdsKey = serviceIds.sort().join(',');
        if (lastLoadedIdsRef.current === currentIdsKey && Object.keys(data).length > 0) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Charger reviews et stats en parallèle
            // ✅ Format: service_ids doit être une chaîne séparée par des virgules
            const serviceIdsStr = serviceIds.join(',');
            const [reviewsResponse, statsResponse] = await Promise.all([
                apiGet(API_ENDPOINTS.SERVICES.BATCH_REVIEWS, {
                    service_ids: serviceIdsStr,
                }),
                apiGet(API_ENDPOINTS.SERVICES.BATCH_STATS, {
                    service_ids: serviceIdsStr,
                }),
            ]);

            const newData: ServicesBatchData = {};

            // Traiter les reviews
            if (reviewsResponse.success && reviewsResponse.data) {
                const reviewsData = reviewsResponse.data as Record<string, any>;
                
                serviceIds.forEach((serviceId) => {
                    const serviceReviews = reviewsData[serviceId] || [];
                    const reviews: Review[] = Array.isArray(serviceReviews) ? serviceReviews : [];

                    // Calculer les statistiques des reviews
                    let stats: ServiceReviewsStats | null = null;
                    if (reviews.length > 0) {
                        const totalReviews = reviews.length;
                        const totalRating = reviews.reduce((sum: number, review: Review) => sum + review.rating, 0);
                        const averageRating = totalRating / totalReviews;

                        const ratingDistribution: { [key: number]: number } = {};
                        for (let i = 1; i <= 5; i++) {
                            ratingDistribution[i] = reviews.filter((r: Review) => r.rating === i).length;
                        }

                        stats = {
                            average_rating: averageRating,
                            total_reviews: totalReviews,
                            rating_distribution: ratingDistribution,
                            completion_rate: 0.85, // 85% de taux de completion
                            response_time: 2.5, // 2.5h de temps de réponse moyen
                        };
                    } else {
                        stats = {
                            average_rating: 0,
                            total_reviews: 0,
                            rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                            completion_rate: 0,
                            response_time: 0,
                        };
                    }

                    newData[serviceId] = {
                        reviews: {
                            reviews,
                            stats,
                        },
                        stats: {
                            stats: null, // Sera rempli par les stats
                        },
                    };
                });
            } else {
                // Initialiser avec des données vides si l'API échoue
                serviceIds.forEach((serviceId) => {
                    newData[serviceId] = {
                        reviews: {
                            reviews: [],
                            stats: {
                                average_rating: 0,
                                total_reviews: 0,
                                rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                                completion_rate: 0,
                                response_time: 0,
                            },
                        },
                        stats: {
                            stats: null,
                        },
                    };
                });
            }

            // Traiter les stats
            if (statsResponse.success && statsResponse.data) {
                const statsData = statsResponse.data as Record<string, any>;
                
                serviceIds.forEach((serviceId) => {
                    const serviceStats = statsData[serviceId];
                    const createdAt = serviceCreatedAts?.get(serviceId);

                    if (serviceStats) {
                        // Calculer l'âge du service si createdAt est fourni
                        let createdDaysAgo = 0;
                        if (createdAt) {
                            const createdDate = new Date(createdAt);
                            const now = new Date();
                            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
                            createdDaysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }

                        const stats: ServiceStats = {
                            views: serviceStats.views || 0,
                            shares: serviceStats.shares || 0,
                            likes: serviceStats.likes || 0,
                            contacts: serviceStats.contacts || 0,
                            messages: serviceStats.messages || 0,
                            rating: serviceStats.average_rating || 0,
                            totalRatings: serviceStats.total_ratings || 0,
                            createdDaysAgo,
                        };

                        if (!newData[serviceId]) {
                            newData[serviceId] = {
                                reviews: {
                                    reviews: [],
                                    stats: {
                                        average_rating: 0,
                                        total_reviews: 0,
                                        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                                        completion_rate: 0,
                                        response_time: 0,
                                    },
                                },
                                stats: {
                                    stats: null,
                                },
                            };
                        }
                        newData[serviceId].stats.stats = stats;
                    } else {
                        // Fallback avec des données minimales
                        if (!newData[serviceId]) {
                            newData[serviceId] = {
                                reviews: {
                                    reviews: [],
                                    stats: {
                                        average_rating: 0,
                                        total_reviews: 0,
                                        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                                        completion_rate: 0,
                                        response_time: 0,
                                    },
                                },
                                stats: {
                                    stats: null,
                                },
                            };
                        }

                        let createdDaysAgo = 0;
                        if (createdAt) {
                            const createdDate = new Date(createdAt);
                            const now = new Date();
                            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
                            createdDaysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }

                        newData[serviceId].stats.stats = {
                            views: Math.max(1, createdDaysAgo),
                            shares: 0,
                            likes: 0,
                            contacts: 0,
                            messages: 0,
                            rating: 0,
                            totalRatings: 0,
                            createdDaysAgo,
                        };
                    }
                });
            } else {
                // Initialiser avec des données minimales si l'API échoue
                serviceIds.forEach((serviceId) => {
                    if (!newData[serviceId]) {
                        newData[serviceId] = {
                            reviews: {
                                reviews: [],
                                stats: {
                                    average_rating: 0,
                                    total_reviews: 0,
                                    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                                    completion_rate: 0,
                                    response_time: 0,
                                },
                            },
                            stats: {
                                stats: null,
                            },
                        };
                    }

                    const createdAt = serviceCreatedAts?.get(serviceId);
                    let createdDaysAgo = 0;
                    if (createdAt) {
                        const createdDate = new Date(createdAt);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
                        createdDaysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }

                    if (!newData[serviceId].stats.stats) {
                        newData[serviceId].stats.stats = {
                            views: Math.max(1, createdDaysAgo),
                            shares: 0,
                            likes: 0,
                            contacts: 0,
                            messages: 0,
                            rating: 0,
                            totalRatings: 0,
                            createdDaysAgo,
                        };
                    }
                });
            }

            setData(newData);
            lastLoadedIdsRef.current = currentIdsKey;
        } catch (err) {
            console.error('❌ [useServicesBatchData] Erreur récupération données batch:', err);
            setError('Impossible de charger les données des services');
            
            // Initialiser avec des données vides en cas d'erreur
            const emptyData: ServicesBatchData = {};
            serviceIds.forEach((serviceId) => {
                const createdAt = serviceCreatedAts?.get(serviceId);
                let createdDaysAgo = 0;
                if (createdAt) {
                    const createdDate = new Date(createdAt);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
                    createdDaysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                emptyData[serviceId] = {
                    reviews: {
                        reviews: [],
                        stats: {
                            average_rating: 0,
                            total_reviews: 0,
                            rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                            completion_rate: 0,
                            response_time: 0,
                        },
                    },
                    stats: {
                        stats: {
                            views: Math.max(1, createdDaysAgo),
                            shares: 0,
                            likes: 0,
                            contacts: 0,
                            messages: 0,
                            rating: 0,
                            totalRatings: 0,
                            createdDaysAgo,
                        },
                    },
                };
            });
            setData(emptyData);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatchData();
    }, [serviceIds.join(',')]); // Dépendre de la chaîne jointe pour éviter les re-renders inutiles

    return {
        data,
        loading,
        error,
        refetch: fetchBatchData,
    };
};

