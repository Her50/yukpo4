/**
 * MixedContentCarousel - Carousel intelligent mélangeant publicités et produits organiques
 * Garantit l'équité : produits payants ont TOUJOURS plus de visibilité que gratuits
 */

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
import ProductCard from './ProductCard';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = 8; // ✅ Marge au bord de l'écran
const CARD_WIDTH = width * 0.85;
const CARD_MARGIN = 12;

interface MixedContentCarouselProps {
    userId?: string;
    userBehavior?: string[]; // Catégories préférées
    publiciteFrequency?: number; // 1 pub toutes les X cartes
}

interface ContentItem {
    type: 'organic' | 'paid';
    is_paid: boolean;
    data: any;
    boost_level?: string;
    frequency_ratio?: number;
}

const MixedContentCarousel: React.FC<MixedContentCarouselProps> = ({
    userId,
    userBehavior = [],
    publiciteFrequency = 3
}) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const scrollViewRef = useRef<ScrollView>(null);

    const [content, setContent] = useState<ContentItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [sessionId] = useState(() => `session_${Date.now()}_${userId || 'guest'}`);
    const [scrollDelay, setScrollDelay] = useState(5000);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedPrestataire, setSelectedPrestataire] = useState<any>(null);

    // Charger le contenu mixte
    useEffect(() => {
        loadMixedContent();
    }, [userId, userBehavior]);

    // ✅ Démarrer le scroll automatique dès que le contenu est chargé
    useEffect(() => {
        if (content.length > 1 && !isPaused && currentIndex === 0) {
            // Déclencher le premier scroll après un court délai
            const initialTimer = setTimeout(() => {
                if (scrollViewRef.current && content.length > 1) {
                    console.log('[MixedContentCarousel] 🎬 Démarrage scroll automatique initial');
                    const firstScrollPosition = SCREEN_PADDING + (CARD_WIDTH + CARD_MARGIN);
                    scrollViewRef.current.scrollTo({
                        x: firstScrollPosition,
                        animated: true, // ✅ CHANGÉ: animated true pour meilleur visuel
                    });
                    setCurrentIndex(1); // ✅ AJOUTÉ: Déclencher le timer suivant
                }
            }, 1000); // ✅ CHANGÉ: 1s au lieu de 500ms pour laisser le temps de render
            return () => clearTimeout(initialTimer);
        }
    }, [content.length, isPaused]);

    const loadMixedContent = async () => {
        try {
            setLoading(true);
            console.log('[MixedContentCarousel] 🎬 Démarrage chargement contenu mixte...');

            // Construire les paramètres
            const params = new URLSearchParams();
            if (userBehavior.length > 0) {
                params.append('categories', userBehavior.join(','));
                console.log('[MixedContentCarousel] Catégories comportement:', userBehavior);
            }
            if (userId) {
                params.append('user_id', userId);
            }
            params.append('session_id', sessionId);

            console.log('[MixedContentCarousel] 🔗 Appel API:', `/api/content/mixed?${params.toString()}`);
            const response = await apiGet(`/api/content/mixed?${params.toString()}`);
            console.log('[MixedContentCarousel] 📦 Réponse API:', { success: response.success, hasData: !!response.data, dataLength: (response.data as any)?.length });

            if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
                console.log(`[MixedContentCarousel] ✅ ${response.data.length} éléments de contenu mixte chargés`);
                setContent(response.data);
            } else {
                // ✅ FALLBACK: Charger les produits organiques si pas de contenu mixte
                console.log('[MixedContentCarousel] ⚠️ Pas de contenu mixte, chargement des produits organiques...');
                await loadOrganicProducts();
            }

            setLoading(false);
        } catch (error) {
            console.error('[MixedContentCarousel] ❌ Erreur chargement:', error);
            // ✅ FALLBACK: En cas d'erreur, charger les produits organiques
            console.log('[MixedContentCarousel] 🔄 Basculement vers produits organiques (fallback)...');
            await loadOrganicProducts();
            setLoading(false);
        }
    };

    // ✅ NOUVEAU: Charger les produits organiques en fallback
    const loadOrganicProducts = async () => {
        try {
            console.log('[MixedContentCarousel] Chargement des produits organiques...');

            // Essayer d'abord l'API récente
            let response = await apiGet('/api/services/recent?limit=20&include_products=true');

            // Si ça ne marche pas, essayer l'API standard
            if (!response.success || !response.data || !Array.isArray(response.data)) {
                console.log('[MixedContentCarousel] API recent échouée, essai API standard...');
                response = await apiGet('/api/services?limit=20');
            }

            if (response.success && response.data && Array.isArray(response.data)) {
                const organicContent: ContentItem[] = [];

                response.data.forEach((service: any) => {
                    if (service.data?.produits && Array.isArray(service.data.produits)) {
                        service.data.produits.forEach((product: any) => {
                            organicContent.push({
                                type: 'organic',
                                is_paid: false,
                                data: {
                                    ...product,
                                    serviceId: service.id,
                                    service: service
                                }
                            });
                        });
                    } else {
                        // Si pas de produits, ajouter le service lui-même
                        organicContent.push({
                            type: 'organic',
                            is_paid: false,
                            data: {
                                ...service,
                                nom: service.titre || service.nom || 'Service',
                                description: service.description || 'Description du service',
                                prix: service.prix || '0',
                                devise: service.devise || 'XAF'
                            }
                        });
                    }
                });

                console.log(`[MixedContentCarousel] ${organicContent.length} produits organiques chargés`);
                setContent(organicContent);
            } else {
                console.log('[MixedContentCarousel] Aucun produit organique trouvé');
                setContent([]);
            }
        } catch (error) {
            console.error('[MixedContentCarousel] Erreur chargement produits organiques:', error);
            setContent([]);
        }
    };

    // ✅ Calculer le délai selon le type de contenu
    const calculateDelay = (item: ContentItem): number => {
        if (isPaused) return 0;

        // Vidéo ?
        const hasVideo = item.data?.videos && item.data.videos.length > 0;
        if (hasVideo) {
            return 15000; // 15s pour vidéo
        }

        // Plusieurs images ?
        const imageCount = item.data?.images?.length || 1;
        if (imageCount > 1) {
            return imageCount * 3000; // 3s par image
        }

        // Image simple ou publicité
        return item.is_paid ? 7000 : 5000; // Pub: 7s, Organique: 5s
    };

    // ✅ Auto-scroll intelligent - CORRIGÉ pour fonctionner correctement
    useEffect(() => {
        console.log('[MixedContentCarousel] Timer check:', {
            contentLength: content.length,
            isPaused,
            currentIndex,
            hasCurrentItem: !!content[currentIndex]
        });

        if (content.length <= 1) {
            console.log('[MixedContentCarousel] ⚠️ Scroll annulé: Pas assez d\'éléments (besoin de 2 minimum)');
            return;
        }

        if (isPaused) {
            console.log('[MixedContentCarousel] ⏸️ Scroll en pause (scroll manuel ou interaction)');
            return;
        }

        const currentItem = content[currentIndex];
        if (!currentItem) {
            console.log('[MixedContentCarousel] ⚠️ Item courant non trouvé à l\'index', currentIndex);
            return;
        }

        const delay = calculateDelay(currentItem);
        if (delay === 0) {
            console.log('[MixedContentCarousel] ⚠️ Délai = 0, scroll annulé');
            return;
        }

        console.log(`[MixedContentCarousel] ⏱️ Timer démarré: ${delay}ms jusqu'au prochain scroll (${currentIndex} → ${(currentIndex + 1) % content.length})`);

        const timer = setTimeout(() => {
            if (!scrollViewRef.current) {
                console.log('[MixedContentCarousel] ⚠️ ScrollView ref null, scroll annulé');
                return;
            }

            const nextIndex = (currentIndex + 1) % content.length;

            // Calculer la position exacte pour le scroll (avec padding au début)
            const scrollPosition = SCREEN_PADDING + nextIndex * (CARD_WIDTH + CARD_MARGIN);

            console.log(`[MixedContentCarousel] 🎬 Scroll automatique: index ${currentIndex} → ${nextIndex} (position ${scrollPosition}px)`);

            // Scroll vers la position suivante
            scrollViewRef.current.scrollTo({
                x: scrollPosition,
                animated: true,
            });

            // Mettre à jour l'index immédiatement pour déclencher le prochain timer
            setCurrentIndex(nextIndex);

            // Tracker la visibilité de l'élément précédent après un court délai
            setTimeout(() => {
                trackVisibility(currentItem, currentIndex);
            }, 100);
        }, delay);

        return () => clearTimeout(timer);
    }, [currentIndex, content, isPaused]);

    // ✅ Tracker la visibilité
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

    // ✅ Gérer le scroll manuel
    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        // Tenir compte du padding au début
        const adjustedOffset = Math.max(0, offsetX - SCREEN_PADDING);
        const index = Math.round(adjustedOffset / (CARD_WIDTH + CARD_MARGIN));

        if (index !== currentIndex && index >= 0 && index < content.length) {
            setIsPaused(true);
            setCurrentIndex(index);

            // Reprendre auto-scroll après 3s
            setTimeout(() => setIsPaused(false), 3000);
        }
    };

    // ✅ Gérer le scroll en cours (pour mise à jour continue de l'index)
    const handleScrollEvent = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const adjustedOffset = Math.max(0, offsetX - SCREEN_PADDING);
        const index = Math.round(adjustedOffset / (CARD_WIDTH + CARD_MARGIN));

        if (index >= 0 && index < content.length && index !== currentIndex) {
            setCurrentIndex(index);
        }
    };

    // ✅ Gérer le clic sur une carte
    const handleCardClick = async (item: ContentItem, index: number) => {
        // Tracker le clic
        try {
            await apiPost('/api/visibility/track', {
                user_id: parseInt(userId || '0'),
                session_id: sessionId,
                content_id: item.data.id?.toString() || '',
                content_type: item.is_paid ? 'paid' : 'organic',
                position_in_feed: index,
                clicked: true
            });
        } catch (error) {
            console.error('[MixedContentCarousel] Erreur tracking clic:', error);
        }

        // Navigation selon le type
        if (item.is_paid) {
            // Publicité : ouvrir détails de la publicité
            console.log('[MixedContentCarousel] Clic publicité:', item.data.titre);
            // TODO: Naviguer vers écran détails publicité
        } else {
            // Produit organique : ouvrir détails du produit/service
            if (item.data.service_id) {
                (navigation as any).navigate('ServiceDetail', { serviceId: item.data.service_id });
            }
        }
    };

    // Loading state
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    // Empty state
    if (content.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <SafeIcon name="package" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>Aucun contenu disponible</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* ✅ Barres de progression (comme Instagram Stories) */}
            <View style={styles.progressBars}>
                {content.map((_, index) => (
                    <View key={index} style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: index < currentIndex ? '100%' :
                                        index === currentIndex ? '50%' : '0%'
                                }
                            ]}
                        />
                    </View>
                ))}
            </View>

            {/* ✅ ScrollView horizontal */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled={false}
                snapToInterval={CARD_WIDTH + CARD_MARGIN}
                snapToAlignment="start"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                onScroll={handleScrollEvent}
                scrollEventThrottle={16}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {content.map((item, index) => (
                    <TouchableOpacity
                        key={`${item.type}-${item.data.id}-${index}`}
                        style={[styles.card, { width: CARD_WIDTH, marginRight: CARD_MARGIN }]}
                        activeOpacity={0.9}
                        onPress={() => handleCardClick(item, index)}
                    >
                        {/* ✅ Badge Sponsorisé ou Recommandé */}
                        <View style={[
                            styles.badge,
                            item.is_paid ? styles.badgePaid : styles.badgeOrganic
                        ]}>
                            <SafeIcon
                                name={item.is_paid ? 'star' : 'sparkles'}
                                size={12}
                                color="#FFFFFF"
                            />
                            <Text style={styles.badgeText}>
                                {item.is_paid ? 'Sponsorisé' : 'Pour vous'}
                            </Text>
                            {item.is_paid && item.boost_level && (
                                <Text style={styles.boostLevel}>
                                    {item.boost_level.toUpperCase()}
                                </Text>
                            )}
                        </View>

                        {/* ✅ Badge durée vidéo si présent */}
                        {item.data?.videos && item.data.videos.length > 0 && (
                            <View style={styles.videoBadge}>
                                <SafeIcon name="video" size={14} color="#FFFFFF" />
                                <Text style={styles.videoDuration}>0:15</Text>
                            </View>
                        )}

                        {/* Contenu de la carte */}
                        <ProductCard
                            product={item.data}
                            service={item.data.service || { id: item.data.serviceId || item.data.service_id, data: {} }}
                            prestataire={item.data.prestataire}
                            onPress={() => handleCardClick(item, index)}
                            onChatPress={() => {
                                setSelectedService(item.data.service || { id: item.data.serviceId || item.data.service_id, data: {} });
                                setSelectedPrestataire(item.data.prestataire || null);
                                setShowChatModal(true);
                            }}
                        />
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* ✅ Pagination dots */}
            {content.length > 1 && (
                <View style={styles.pagination}>
                    {content.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.paginationDot,
                                index === currentIndex && styles.paginationDotActive
                            ]}
                        />
                    ))}
                </View>
            )}

            {/* ✅ Contrôles manuels */}
            {!isPaused && (
                <TouchableOpacity
                    style={styles.pauseButton}
                    onPress={() => setIsPaused(true)}
                >
                    <SafeIcon name="pause" size={16} color="#FFFFFF" />
                </TouchableOpacity>
            )}
            {isPaused && (
                <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => setIsPaused(false)}
                >
                    <SafeIcon name="play" size={16} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            {/* Chat Modal avec WebSocket */}
            <ChatModalMobile
                visible={showChatModal}
                service={selectedService}
                prestataireInfo={selectedPrestataire}
                user={user}
                onClose={() => {
                    setShowChatModal(false);
                    setSelectedService(null);
                    setSelectedPrestataire(null);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    progressBars: {
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    progressBar: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    scrollView: {
        marginBottom: 8,
    },
    scrollContent: {
        paddingHorizontal: 8, // ✅ Petite marge au bord de l'écran
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    badge: {
        position: 'absolute',
        top: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
        zIndex: 10,
    },
    badgePaid: {
        backgroundColor: '#FFD700', // Or pour sponsorisé
    },
    badgeOrganic: {
        backgroundColor: modernColors.primary, // Bleu pour recommandé
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    boostLevel: {
        marginLeft: 4,
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        opacity: 0.8,
    },
    videoBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
        zIndex: 10,
    },
    videoDuration: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingHorizontal: 16,
    },
    paginationDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    paginationDotActive: {
        width: 20,
        backgroundColor: modernColors.primary,
    },
    pauseButton: {
        position: 'absolute',
        bottom: 60,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 25,
        padding: 12,
        zIndex: 20,
    },
    playButton: {
        position: 'absolute',
        bottom: 60,
        right: 20,
        backgroundColor: modernColors.primary,
        borderRadius: 25,
        padding: 12,
        zIndex: 20,
    },
});

export default MixedContentCarousel;

