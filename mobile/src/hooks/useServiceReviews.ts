import { useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS } from '../config/api.config';
import { apiGet, apiPost } from '../services/api';

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

interface UseServiceReviewsReturn {
    reviews: Review[];
    stats: ServiceReviewsStats | null;
    loading: boolean;
    error: string | null;
    submitReview: (rating: number, comment: string) => Promise<boolean>;
    markReviewHelpful: (reviewId: number) => Promise<boolean>;
}

/**
 * Hook pour récupérer les reviews d'un ou plusieurs services
 * Utilise automatiquement l'endpoint batch si plusieurs serviceIds sont fournis
 * 
 * @param serviceId - ID du service OU liste d'IDs de services
 */
export const useServiceReviews = (serviceId: number | number[]): UseServiceReviewsReturn => {
    // ✅ NOUVEAU 2025-01-01: Détecter si on a une liste de services
    const isBatch = Array.isArray(serviceId);
    const serviceIds = isBatch ? serviceId : [serviceId];
    const singleServiceId = isBatch ? serviceIds[0] : serviceId;
    const [reviews, setReviews] = useState<Review[]>([]);
    const [stats, setStats] = useState<ServiceReviewsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // ✅ CORRIGÉ 2025-12-30: Utiliser un ref pour tracker le dernier serviceId chargé et éviter les re-fetch en boucle
    const lastLoadedServiceIdRef = useRef<number | null>(null);

    useEffect(() => {
        // ✅ CORRIGÉ 2025-12-30: Ne pas re-fetch si déjà chargé pour ce serviceId
        if (!singleServiceId || serviceIds.length === 0) {
            return;
        }

        // Vérifier si on a déjà chargé les reviews pour ce serviceId
        if (lastLoadedServiceIdRef.current === singleServiceId && reviews.length > 0 && !isBatch) {
            return;
        }

        let cancelled = false;

        const fetchReviews = async () => {
            if (cancelled) return;

            try {
                setLoading(true);

                let reviewsResponse;
                
                // ✅ NOUVEAU 2025-01-01: Utiliser l'endpoint batch si plusieurs services
                if (isBatch && serviceIds.length > 1) {
                    const serviceIdsStr = serviceIds.join(',');
                    const batchResponse = await apiGet(API_ENDPOINTS.SERVICES.BATCH_REVIEWS, {
                        service_ids: serviceIdsStr,
                    });
                    
                    // Extraire les reviews du premier service (compatibilité avec l'API actuelle)
                    if (batchResponse.success && batchResponse.data) {
                        const batchData = batchResponse.data as Record<string, any>;
                        const firstServiceReviews = batchData[singleServiceId] || [];
                        reviewsResponse = {
                            success: true,
                            data: {
                                reviews: Array.isArray(firstServiceReviews) ? firstServiceReviews : [],
                            },
                        };
                    } else {
                        reviewsResponse = batchResponse;
                    }
                } else {
                    // ✅ CORRIGÉ: Utilise apiGet au lieu de fetch hardcodé
                    reviewsResponse = await apiGet(API_ENDPOINTS.SERVICES.REVIEWS(singleServiceId));
                }

                if (cancelled) return;

                if (reviewsResponse.success && reviewsResponse.data) {
                    const reviewsData = reviewsResponse.data;
                    
                    if (!cancelled) {
                        setReviews(reviewsData.reviews || []);

                        // Calculer les statistiques
                        if (reviewsData.reviews && reviewsData.reviews.length > 0) {
                            const totalReviews = reviewsData.reviews.length;
                            const totalRating = reviewsData.reviews.reduce((sum: number, review: Review) => sum + review.rating, 0);
                            const averageRating = totalRating / totalReviews;

                            const ratingDistribution: { [key: number]: number } = {};
                            for (let i = 1; i <= 5; i++) {
                                ratingDistribution[i] = reviewsData.reviews.filter((r: Review) => r.rating === i).length;
                            }

                            setStats({
                                average_rating: averageRating,
                                total_reviews: totalReviews,
                                rating_distribution: ratingDistribution,
                                completion_rate: 0.85, // 85% de taux de completion
                                response_time: 2.5 // 2.5h de temps de réponse moyen
                            });
                        }
                        lastLoadedServiceIdRef.current = singleServiceId;
                    }
                } else {
                    if (!cancelled) {
                        console.log(`📝 [useServiceReviews] API reviews non disponible pour service ${singleServiceId}`);
                        setReviews([]);
                        setStats({
                            average_rating: 0,
                            total_reviews: 0,
                            rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                            completion_rate: 0,
                            response_time: 0
                        });
                        lastLoadedServiceIdRef.current = singleServiceId;
                    }
                }
            } catch (error) {
                if (cancelled) return;
                console.error('❌ [useServiceReviews] Erreur récupération avis:', error);
                setError('Impossible de charger les avis');
                if (!cancelled) {
                    setReviews([]);
                    setStats({
                        average_rating: 0,
                        total_reviews: 0,
                        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                        completion_rate: 0,
                        response_time: 0
                    });
                    lastLoadedServiceIdRef.current = singleServiceId;
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchReviews();

        return () => {
            cancelled = true;
        };
    }, [singleServiceId, isBatch, serviceIds.join(',')]); // ✅ Dépendre de singleServiceId et de la liste pour batch

    const submitReview = async (rating: number, comment: string): Promise<boolean> => {
        try {
            // ✅ CORRIGÉ: Utilise apiPost au lieu de fetch hardcodé
            const response = await apiPost(API_ENDPOINTS.SERVICES.SUBMIT_REVIEW(singleServiceId), {
                rating,
                comment
            });

            if (response.success) {
                // Recharger les avis après soumission
                const reviewsResponse = await apiGet(API_ENDPOINTS.SERVICES.REVIEWS(singleServiceId));

                if (reviewsResponse.success && reviewsResponse.data) {
                    const reviewsData = reviewsResponse.data;
                    setReviews(reviewsData.reviews || []);

                    // Mettre à jour les statistiques
                    if (reviewsData.reviews && reviewsData.reviews.length > 0) {
                        const totalReviews = reviewsData.reviews.length;
                        const totalRating = reviewsData.reviews.reduce((sum: number, review: Review) => sum + review.rating, 0);
                        const averageRating = totalRating / totalReviews;

                        const ratingDistribution: { [key: number]: number } = {};
                        for (let i = 1; i <= 5; i++) {
                            ratingDistribution[i] = reviewsData.reviews.filter((r: Review) => r.rating === i).length;
                        }

                        setStats({
                            average_rating: averageRating,
                            total_reviews: totalReviews,
                            rating_distribution: ratingDistribution,
                            completion_rate: 0.85,
                            response_time: 2.5
                        });
                    }
                }

                return true;
            } else {
                throw new Error('Erreur lors de la soumission de l\'avis');
            }
        } catch (error) {
            console.error('❌ [useServiceReviews] Erreur soumission avis:', error);
            return false;
        }
    };

    const markReviewHelpful = async (reviewId: number): Promise<boolean> => {
        try {
            // ✅ CORRIGÉ: Utilise apiPost au lieu de fetch hardcodé
            const response = await apiPost(API_ENDPOINTS.REVIEWS.MARK_HELPFUL(reviewId), {});

            if (response.success) {
                // Mettre à jour localement le compteur
                setReviews(prev => prev.map(review =>
                    review.id === reviewId
                        ? { ...review, helpful_count: review.helpful_count + 1 }
                        : review
                ));
                return true;
            } else {
                throw new Error('Erreur lors du marquage utile');
            }
        } catch (error) {
            console.error('❌ [useServiceReviews] Erreur marquage utile:', error);
            return false;
        }
    };

    return { reviews, stats, loading, error, submitReview, markReviewHelpful };
};

// ✅ getToken() n'est plus nécessaire car apiGet/apiPost gèrent automatiquement le token



