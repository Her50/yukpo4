import { useEffect, useState } from 'react';
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

export const useServiceReviews = (serviceId: number): UseServiceReviewsReturn => {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [stats, setStats] = useState<ServiceReviewsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                setLoading(true);

                // ✅ CORRIGÉ: Utilise apiGet au lieu de fetch hardcodé
                const reviewsResponse = await apiGet(API_ENDPOINTS.SERVICES.REVIEWS(serviceId));

                if (reviewsResponse.success && reviewsResponse.data) {
                    const reviewsData = reviewsResponse.data;
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
                } else {
                    console.log(`📝 [useServiceReviews] API reviews non disponible pour service ${serviceId}`);
                    setReviews([]);
                    setStats({
                        average_rating: 0,
                        total_reviews: 0,
                        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                        completion_rate: 0,
                        response_time: 0
                    });
                }
            } catch (error) {
                console.error('❌ [useServiceReviews] Erreur récupération avis:', error);
                setError('Impossible de charger les avis');
                setReviews([]);
                setStats({
                    average_rating: 0,
                    total_reviews: 0,
                    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    completion_rate: 0,
                    response_time: 0
                });
            } finally {
                setLoading(false);
            }
        };

        if (serviceId) {
            fetchReviews();
        }
    }, [serviceId]);

    const submitReview = async (rating: number, comment: string): Promise<boolean> => {
        try {
            // ✅ CORRIGÉ: Utilise apiPost au lieu de fetch hardcodé
            const response = await apiPost(API_ENDPOINTS.SERVICES.SUBMIT_REVIEW(serviceId), {
                rating,
                comment
            });

            if (response.success) {
                // Recharger les avis après soumission
                const reviewsResponse = await apiGet(API_ENDPOINTS.SERVICES.REVIEWS(serviceId));

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



