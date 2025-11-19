/**
 * MixedContentCarousel - Carousel intelligent mélangeant publicités et produits organiques
 * Garantit l'équité : produits payants ont TOUJOURS plus de visibilité que gratuits
 */

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { CRASH_PREVENTION_CONFIG } from '../config/gpsConfig';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
import ProductCard from './ProductCard';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = 16; // ✅ Marge au bord de l'écran (cohérent avec paddingHorizontal)
const CARD_WIDTH = width * 0.85;
const CARD_MARGIN = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN; // ✅ Intervalle de snap constant

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
    const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
    const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isAutoScrollDisabled = CRASH_PREVENTION_CONFIG.DISABLE_MIXED_CONTENT_AUTOSCROLL;

    const [content, setContent] = useState<ContentItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [sessionId] = useState(() => `session_${Date.now()}_${userId || 'guest'}`);
    const [scrollDelay, setScrollDelay] = useState(5000);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedPrestataire, setSelectedPrestataire] = useState<any>(null);

    const clearAutoScrollTimer = () => {
        if (autoScrollTimerRef.current) {
            clearTimeout(autoScrollTimerRef.current);
            autoScrollTimerRef.current = null;
        }
    };

    const clearResumeTimer = () => {
        if (resumeTimerRef.current) {
            clearTimeout(resumeTimerRef.current);
            resumeTimerRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            clearAutoScrollTimer();
            clearResumeTimer();
        };
    }, []);

    // Charger le contenu mixte
    useEffect(() => {
        loadMixedContent();
    }, [userId, userBehavior]);

    // ✅ Réinitialiser l'index et la pause quand le contenu change
    useEffect(() => {
        const safeContent = Array.isArray(content) ? content : [];
        if (safeContent.length === 0) {
            setCurrentIndex(0);
            return;
        }

        requestAnimationFrame(() => {
            scrollViewRef.current?.scrollTo({ x: 0, animated: false });
            setCurrentIndex(0);
            setIsPaused(false);
        });
    }, [content.length]);

    // ✅ Démarrer le scroll automatique après la première mise en page
    useEffect(() => {
        if (isAutoScrollDisabled) {
            clearAutoScrollTimer();
            return;
        }

        const safeContent = Array.isArray(content) ? content : [];
        if (safeContent.length > 1 && currentIndex === 0 && !isPaused) {
            const initialTimer = setTimeout(() => {
                if (scrollViewRef.current && safeContent.length > 1) {
                    console.log('[MixedContentCarousel] 🎬 Démarrage scroll automatique initial (index 0 → 1)');
                    const offset = SCREEN_PADDING + SNAP_INTERVAL;
                    scrollViewRef.current.scrollTo({
                        x: offset,
                        animated: true,
                    });
                    setCurrentIndex(1);
                }
            }, 2000);

            return () => clearTimeout(initialTimer);
        }
    }, [content.length, isPaused, currentIndex, isAutoScrollDisabled]);

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
            console.log('[MixedContentCarousel] 📦 Réponse API:', { success: response.success, hasData: !!response.data, dataLength: Array.isArray(response.data) ? response.data.length : 0 });

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
            return Math.max(imageCount * 3000, 6000); // 3s par image
        }

        // Image simple ou publicité
        return item.is_paid ? 7000 : 5000; // Pub: 7s, Organique: 5s
    };

    // ✅ Auto-scroll intelligent - timer consolidé
    useEffect(() => {
        clearAutoScrollTimer();

        const safeContent = Array.isArray(content) ? content : [];
        if (safeContent.length <= 1 || isAutoScrollDisabled) {
            return;
        }

        if (isPaused) {
            return;
        }

        const currentItem = safeContent[currentIndex] ?? safeContent[0];
        if (!currentItem) {
            return;
        }

        const delay = Math.max(calculateDelay(currentItem), 3000);
        console.log('[MixedContentCarousel] ⏱️ Programmation autoscroll', { delay, currentIndex });

        autoScrollTimerRef.current = setTimeout(() => {
            if (!scrollViewRef.current) {
                console.log('[MixedContentCarousel] ⚠️ ScrollView ref null, scroll annulé');
                return;
            }

            const safeContent = Array.isArray(content) ? content : [];
            const nextIndex = (currentIndex + 1) % safeContent.length;
            const scrollPosition = SCREEN_PADDING + nextIndex * SNAP_INTERVAL;

            console.log('[MixedContentCarousel] 🎬 Auto scroll', { currentIndex, nextIndex, scrollPosition });

            scrollViewRef.current.scrollTo({
                x: scrollPosition,
                animated: true,
            });

            setCurrentIndex(nextIndex);
        }, delay);

        return clearAutoScrollTimer;
    }, [content, currentIndex, isPaused, isAutoScrollDisabled]);

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

    // ✅ Gérer le scroll manuel (quand l'utilisateur arrête de scroller)
    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const adjustedOffset = Math.max(0, offsetX - SCREEN_PADDING);
        const index = Math.round(adjustedOffset / SNAP_INTERVAL);
        const safeContent = Array.isArray(content) ? content : [];

        if (index !== currentIndex && index >= 0 && index < safeContent.length) {
            console.log('[MixedContentCarousel] 👆 Scroll manuel détecté: index', index);
            setCurrentIndex(index);

            if (!isAutoScrollDisabled) {
                setIsPaused(true);

                clearResumeTimer();
                resumeTimerRef.current = setTimeout(() => {
                    console.log('[MixedContentCarousel] ▶️ Reprise auto-scroll après pause manuelle');
                    setIsPaused(false);
                }, 4000);
            }
        }

        const currentItem = safeContent[index];
        if (currentItem) {
            trackVisibility(currentItem, index).catch(() => undefined);
        }
    };

    const handleScrollEvent = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const adjustedOffset = Math.max(0, offsetX - SCREEN_PADDING);
        const index = Math.round(adjustedOffset / SNAP_INTERVAL);

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

        const serviceId = item?.data?.service_id
            ?? item?.data?.serviceId
            ?? item?.data?.service?.id
            ?? item?.data?.id;

        if (!serviceId) {
            console.warn('[MixedContentCarousel] ⚠️ Impossible d’identifier le service pour cette carte', item);
            Alert.alert('Contenu indisponible', 'Nous ne parvenons pas à ouvrir cette annonce pour le moment.');
            return;
        }

        (navigation as any).navigate('ServiceDetail', {
            serviceId: String(serviceId),
            fromCarousel: true,
            isPaid: item.is_paid,
        });
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

    // ✅ CORRIGÉ: S'assurer que content est toujours un tableau
    const safeContent = Array.isArray(content) ? content : [];

    // Empty state
    if (safeContent.length === 0) {
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
                {safeContent.map((_, index) => (
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

            {/* ✅ ScrollView horizontal avec snap corrigé */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled={false}
                snapToInterval={SNAP_INTERVAL}
                snapToAlignment="start"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                onScroll={handleScrollEvent}
                scrollEventThrottle={16}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                nestedScrollEnabled
                contentInset={{
                    left: SCREEN_PADDING,
                    right: SCREEN_PADDING,
                }}
                contentOffset={{ x: SCREEN_PADDING, y: 0 }}
            >
                {safeContent.map((item, index) => (
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
            {safeContent.length > 1 && (
                <View style={styles.pagination}>
                    {safeContent.map((_, index) => (
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
            {!isAutoScrollDisabled && !isPaused && (
                <TouchableOpacity
                    style={styles.pauseButton}
                    onPress={() => setIsPaused(true)}
                >
                    <SafeIcon name="pause" size={16} color="#FFFFFF" />
                </TouchableOpacity>
            )}
            {!isAutoScrollDisabled && isPaused && (
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
        paddingHorizontal: SCREEN_PADDING, // ✅ CORRIGÉ: Utiliser constante cohérente
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
