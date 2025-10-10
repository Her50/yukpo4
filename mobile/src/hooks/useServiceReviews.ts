import { useEffect, useState } from 'react';

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
                const token = await getToken();

                // Récupérer les avis
                const reviewsResponse = await fetch(`https://yukpomnang.onrender.com/api/services/${serviceId}/reviews`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (reviewsResponse.ok) {
                    const reviewsData = await reviewsResponse.json();
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
            const token = await getToken();
            if (!token) {
                throw new Error('Utilisateur non authentifié');
            }

            const response = await fetch(`https://yukpomnang.onrender.com/api/services/${serviceId}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rating, comment })
            });

            if (response.ok) {
                // Recharger les avis après soumission
                const reviewsResponse = await fetch(`https://yukpomnang.onrender.com/api/services/${serviceId}/reviews`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (reviewsResponse.ok) {
                    const reviewsData = await reviewsResponse.json();
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
            const token = await getToken();
            if (!token) {
                throw new Error('Utilisateur non authentifié');
            }

            const response = await fetch(`https://yukpomnang.onrender.com/api/reviews/${reviewId}/helpful`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
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

// Fonction utilitaire pour récupérer le token
const getToken = async (): Promise<string | null> => {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        let token = await AsyncStorage.getItem('auth_token');
        if (!token) {
            token = await AsyncStorage.getItem('token');
        }
        return token;
    } catch (error) {
        console.error('❌ [useServiceReviews] Erreur récupération token:', error);
        return null;
    }
};



