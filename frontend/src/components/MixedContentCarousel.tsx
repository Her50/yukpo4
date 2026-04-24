/**
 * MixedContentCarousel - Version Web
 * Carousel intelligent mélangeant publicités et produits organiques
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../services/apiService';

interface MixedContentCarouselProps {
    userId?: string;
    userBehavior?: string[];
    publiciteFrequency?: number;
}

interface ContentItem {
    type: 'organic' | 'paid';
    is_paid: boolean;
    data: any;
    boost_level?: string;
}

const MixedContentCarousel: React.FC<MixedContentCarouselProps> = ({
    userId,
    userBehavior = [],
    publiciteFrequency = 3
}) => {
    const navigate = useNavigate();
    const [content, setContent] = useState<ContentItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [sessionId] = useState(() => `session_${Date.now()}_${userId || 'guest'}`);

    useEffect(() => {
        loadMixedContent();
    }, [userId, userBehavior]);

    const loadMixedContent = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            if (userBehavior.length > 0) {
                params.append('categories', userBehavior.join(','));
            }
            if (userId) {
                params.append('user_id', userId);
            }
            params.append('session_id', sessionId);

            const response = await apiGet(`/api/content/mixed?${params.toString()}`);

            if (response.success && response.data) {
                setContent(Array.isArray(response.data) ? response.data : []);
            }

            setLoading(false);
        } catch (error) {
            console.error('[MixedContentCarousel] Erreur:', error);
            setContent([]);
            setLoading(false);
        }
    };

    const calculateDelay = (item: ContentItem): number => {
        if (isPaused) return 0;

        const hasVideo = item.data?.videos && item.data.videos.length > 0;
        if (hasVideo) return 15000;

        const imageCount = item.data?.images?.length || 1;
        if (imageCount > 1) return imageCount * 3000;

        return item.is_paid ? 7000 : 5000;
    };

    useEffect(() => {
        if (content.length <= 1 || isPaused) return;

        const delay = calculateDelay(content[currentIndex]);
        if (delay === 0) return;

        const timer = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % content.length);
            trackVisibility(content[currentIndex], currentIndex);
        }, delay);

        return () => clearTimeout(timer);
    }, [currentIndex, content, isPaused]);

    const trackVisibility = async (item: ContentItem, position: number) => {
        try {
            await apiPost('/api/visibility/track', {
                user_id: parseInt(userId || '0'),
                session_id: sessionId,
                content_id: item.data.id?.toString() || '',
                content_type: item.is_paid ? 'paid' : 'organic',
                position_in_feed: position,
                viewed: true,
                view_duration_ms: calculateDelay(item)
            });
        } catch (error) {
            console.error('[MixedContentCarousel] Erreur tracking:', error);
        }
    };

    const handleCardClick = async (item: ContentItem, index: number) => {
        await apiPost('/api/visibility/track', {
            user_id: parseInt(userId || '0'),
            session_id: sessionId,
            content_id: item.data.id?.toString() || '',
            content_type: item.is_paid ? 'paid' : 'organic',
            position_in_feed: index,
            clicked: true
        });

        if (item.data.service_id) {
            navigate(`/service/${item.data.service_id}`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="ml-4 text-gray-600">Chargement...</p>
            </div>
        );
    }

    if (content.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-10">
                <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-gray-600">Aucun contenu disponible</p>
            </div>
        );
    }

    return (
        <div className="relative my-6">
            {/* Barres de progression */}
            <div className="flex gap-1 px-4 mb-2">
                {content.map((_, index) => (
                    <div
                        key={index}
                        className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden"
                    >
                        <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                            style={{
                                width: index < currentIndex ? '100%' :
                                    index === currentIndex ? '50%' : '0%'
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Carousel */}
            <div className="relative overflow-hidden">
                <div
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {content.map((item, index) => (
                        <div
                            key={`${item.type}-${item.data.id}-${index}`}
                            className="min-w-full px-4"
                        >
                            <div
                                onClick={() => handleCardClick(item, index)}
                                className="relative bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
                            >
                                {/* Badge */}
                                <div className={`absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full ${item.is_paid ? 'bg-yellow-400' : 'bg-indigo-600'
                                    }`}>
                                    <span className="text-white text-xs font-bold">
                                        {item.is_paid ? '⭐ Sponsorisé' : '✨ Pour vous'}
                                    </span>
                                    {item.is_paid && item.boost_level && (
                                        <span className="text-white text-[9px] font-black opacity-80">
                                            {item.boost_level.toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {/* Contenu */}
                                {item.data.images && item.data.images[0] && (
                                    <img
                                        src={item.data.images[0]}
                                        alt={item.data.titre || 'Produit'}
                                        className="w-full h-48 object-cover"
                                    />
                                )}

                                <div className="p-4">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        {item.data.titre || item.data.nom}
                                    </h3>
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                        {item.data.description}
                                    </p>
                                    {item.data.prix && (
                                        <p className="mt-3 text-xl font-bold text-indigo-600">
                                            {item.data.prix} {item.data.devise || 'FCFA'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation dots */}
            {content.length > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                    {content.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-2 rounded-full transition-all ${index === currentIndex
                                ? 'w-8 bg-indigo-600'
                                : 'w-2 bg-gray-300'
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Contrôles */}
            <button
                onClick={() => setIsPaused(!isPaused)}
                className="absolute bottom-16 right-6 bg-black bg-opacity-60 text-white p-3 rounded-full hover:bg-opacity-80 transition-all"
            >
                {isPaused ? '▶' : '⏸'}
            </button>
        </div>
    );
};

export default MixedContentCarousel;
