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
            // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
            console.debug('[MixedContentCarousel] ⏸️ Scroll automatique désactivé (configuration)');
            return;
        }

        const safeContent = Array.isArray(content) ? content : [];
        // ✅ CORRIGÉ: Log en debug pour éviter le spam
        console.debug('[MixedContentCarousel] 🔍 Vérification scroll initial:', {
            contentLength: safeContent.length,
            currentIndex,
            isPaused,
            isAutoScrollDisabled
        });

        if (safeContent.length > 1 && currentIndex === 0 && !isPaused) {
            // ✅ CORRIGÉ: Log en debug pour éviter le spam
            console.debug('[MixedContentCarousel] ⏱️ Programmation scroll initial dans 2 secondes...');
            const initialTimer = setTimeout(() => {
                const safeContent = Array.isArray(content) ? content : [];
                if (scrollViewRef.current && safeContent.length > 1) {
                    // ✅ CORRIGÉ: Vérifier que scrollTo est disponible
                    if (typeof scrollViewRef.current.scrollTo !== 'function') {
                        console.warn('[MixedContentCarousel] ⚠️ scrollTo n\'est pas une fonction');
                        return;
                    }

                    // ✅ CORRIGÉ: Log en debug pour éviter le spam
                    console.debug('[MixedContentCarousel] 🎬 Démarrage scroll automatique initial (index 0 → 1)');
                    // ✅ CORRIGÉ: Calculer la position correctement (nextIndex * SNAP_INTERVAL)
                    const nextIndex = 1;
                    const scrollPosition = nextIndex * SNAP_INTERVAL;

                    // ✅ CORRIGÉ: Utiliser requestAnimationFrame pour s'assurer que le layout est prêt
                    requestAnimationFrame(() => {
                        if (scrollViewRef.current) {
                            scrollViewRef.current.scrollTo({
                                x: scrollPosition,
                                animated: true,
                            });
                            setCurrentIndex(nextIndex);
                        }
                    });
                } else {
                    console.warn('[MixedContentCarousel] ⚠️ ScrollView ref null ou contenu insuffisant lors du scroll initial');
                }
            }, 2000);

            return () => clearTimeout(initialTimer);
        } else if (safeContent.length <= 1) {
            // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
            console.debug('[MixedContentCarousel] Pas assez de contenu pour le scroll automatique:', safeContent.length);
        }
    }, [content.length, isPaused, currentIndex, isAutoScrollDisabled, content]);

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

    // ✅ FONCTION: Extraire les produits d'un service (cohérent avec MesServicesScreen)
    // ✅ CORRIGÉ: Gérer toutes les structures possibles incluant produits_light
    const extractProduits = (service: any): any[] => {
        // Structure 1: produits_light (réponse allégée du backend)
        if (service.produits_light && Array.isArray(service.produits_light)) {
            return service.produits_light;
        }
        // Structure 2: data.produits (tableau direct)
        if (Array.isArray(service.data?.produits)) {
            return service.data.produits;
        }
        // Structure 3: data.produits.valeur (structure standard)
        if (service.data?.produits?.valeur && Array.isArray(service.data.produits.valeur)) {
            return service.data.produits.valeur;
        }
        // Structure 4: data.produits_valeur (alias)
        if (Array.isArray(service.data?.produits_valeur)) {
            return service.data.produits_valeur;
        }
        // Structure 5: data.produits est un objet avec un tableau à l'intérieur
        if (service.data?.produits && typeof service.data.produits === 'object') {
            const produitsObj = service.data.produits;
            if (Array.isArray(produitsObj.items)) {
                return produitsObj.items;
            } else if (Array.isArray(produitsObj.list)) {
                return produitsObj.list;
            }
        }
        // Structure 6: produits directement sur le service (fallback)
        if (Array.isArray(service.produits)) {
            return service.produits;
        }
        return [];
    };

    // ✅ NOUVEAU: Charger les produits organiques en fallback
    const loadOrganicProducts = async () => {
        try {
            console.log('[MixedContentCarousel] Chargement des produits organiques...');

            // ✅ CORRIGÉ: Retirer le paramètre include_products qui cause une erreur 400
            // Essayer d'abord l'API récente
            let response = await apiGet('/api/services/recent?limit=20');

            // Si ça ne marche pas, essayer l'API standard
            if (!response.success || !response.data || !Array.isArray(response.data)) {
                console.log('[MixedContentCarousel] API recent échouée, essai API standard...');
                response = await apiGet('/api/services?limit=20');
            }

            if (response.success && response.data && Array.isArray(response.data)) {
                const organicContent: ContentItem[] = [];

                response.data.forEach((service: any) => {
                    // ✅ CORRIGÉ: Utiliser extractProduits pour gérer toutes les structures
                    const produits = extractProduits(service);

                    if (produits && produits.length > 0) {
                        produits.forEach((product: any, index: number) => {
                            // ✅ CORRIGÉ: Parser le produit (peut être une chaîne ou un objet)
                            let productData: any = {};

                            if (typeof product === 'string') {
                                // Si le produit est une chaîne, parser (format: "nom,categorie,description,prix")
                                const parts = product.split(',').map(p => p.trim());
                                productData = {
                                    nom: parts[0] || `Produit ${index + 1}`,
                                    description: parts.length >= 3 ? parts.slice(2, -1).join(', ') : (parts[1] || 'Aucune description'),
                                    prix: parts[parts.length - 1] || '0',
                                    devise: 'XAF'
                                };
                            } else if (product && typeof product === 'object') {
                                // Si c'est un objet, utiliser directement
                                productData = {
                                    nom: product.nom || product.data?.nom || product.titre || product.title || `Produit ${index + 1}`,
                                    description: product.description || product.desc || product.description_produit || 'Aucune description',
                                    prix: product.prix || product.data?.prix || '0',
                                    devise: product.devise || product.data?.devise || 'XAF',
                                    ...product
                                };
                            } else {
                                // Fallback
                                productData = {
                                    nom: `Produit ${index + 1}`,
                                    description: 'Aucune description',
                                    prix: '0',
                                    devise: 'XAF'
                                };
                            }

                            organicContent.push({
                                type: 'organic',
                                is_paid: false,
                                data: {
                                    ...productData,
                                    serviceId: service.id,
                                    service: service,
                                    product_index: typeof product.product_index === 'number' ? product.product_index : index
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
                                nom: service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.titre || service.nom || 'Service',
                                description: service.data?.description?.valeur || service.description || 'Description du service',
                                prix: service.prix || '0',
                                devise: service.devise || 'XAF'
                            }
                        });
                    }
                });

                // ✅ CORRIGÉ: Log en debug pour éviter le spam
                console.debug(`[MixedContentCarousel] ✅ ${organicContent.length} produits organiques chargés`);
                if (organicContent.length === 0) {
                    // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
                    console.debug('[MixedContentCarousel] ⚠️ Aucun produit trouvé dans les services. Structure des données:', {
                        servicesCount: response.data.length,
                        firstService: response.data[0] ? {
                            id: response.data[0].id,
                            hasData: !!response.data[0].data,
                            dataKeys: response.data[0].data ? Object.keys(response.data[0].data) : [],
                            hasProduits: !!response.data[0].data?.produits,
                            produitsType: typeof response.data[0].data?.produits,
                            produitsValue: response.data[0].data?.produits
                        } : null
                    });
                }
                setContent(organicContent);
            } else {
                // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
                console.debug('[MixedContentCarousel] ⚠️ Aucun produit organique trouvé - Réponse API invalide:', {
                    success: response.success,
                    hasData: !!response.data,
                    isArray: Array.isArray(response.data),
                    dataType: typeof response.data
                });
                setContent([]);
            }
        } catch (error) {
            console.error('[MixedContentCarousel] ❌ Erreur chargement produits organiques:', error);
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

        if (isAutoScrollDisabled) {
            // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
            console.debug('[MixedContentCarousel] ⏸️ Scroll automatique désactivé (configuration)');
            return;
        }

        if (safeContent.length <= 1) {
            // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
            console.debug('[MixedContentCarousel] Pas assez de contenu pour le scroll automatique:', safeContent.length);
            return;
        }

        if (isPaused) {
            // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
            console.debug('[MixedContentCarousel] ⏸️ Scroll automatique en pause');
            return;
        }

        const currentItem = safeContent[currentIndex] ?? safeContent[0];
        if (!currentItem) {
            console.warn('[MixedContentCarousel] ⚠️ Item actuel introuvable:', { currentIndex, contentLength: safeContent.length });
            return;
        }

        const delay = Math.max(calculateDelay(currentItem), 3000);
        // ✅ CORRIGÉ: Log en debug pour éviter le spam (se déclenche fréquemment)
        console.debug('[MixedContentCarousel] ⏱️ Programmation autoscroll', {
            delay,
            currentIndex,
            contentLength: safeContent.length,
            itemType: currentItem.type,
            isPaid: currentItem.is_paid
        });

        autoScrollTimerRef.current = setTimeout(() => {
            // ✅ CORRIGÉ: Vérifier que le ScrollView est monté et que le contenu est chargé
            if (!scrollViewRef.current) {
                // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas rare mais normal)
                console.debug('[MixedContentCarousel] ⚠️ ScrollView ref null, scroll annulé');
                return;
            }

            const safeContent = Array.isArray(content) ? content : [];
            if (safeContent.length <= 1) {
                // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas normal)
                console.debug('[MixedContentCarousel] ⚠️ Contenu insuffisant lors du scroll:', safeContent.length);
                return;
            }

            // ✅ CORRIGÉ: Vérifier que le ScrollView est bien monté en vérifiant qu'on peut accéder à ses méthodes
            try {
                // Test si le ScrollView est accessible
                if (typeof scrollViewRef.current.scrollTo !== 'function') {
                    // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas rare mais normal)
                    console.debug('[MixedContentCarousel] ⚠️ ScrollView.scrollTo n\'est pas une fonction, scroll annulé');
                    return;
                }
            } catch (error) {
                // ✅ CORRIGÉ: Log en debug pour éviter le spam (cas rare mais normal)
                console.debug('[MixedContentCarousel] ⚠️ Erreur accès ScrollView:', error);
                return;
            }

            const nextIndex = (currentIndex + 1) % safeContent.length;
            // ✅ CORRIGÉ: Calculer la position de scroll correctement en tenant compte du padding
            const scrollPosition = nextIndex * SNAP_INTERVAL;

            // ✅ CORRIGÉ: Log en debug pour éviter le spam (se déclenche fréquemment)
            console.debug('[MixedContentCarousel] 🎬 Auto scroll exécuté', {
                currentIndex,
                nextIndex,
                scrollPosition,
                SNAP_INTERVAL,
                CARD_WIDTH,
                CARD_MARGIN,
                contentLength: safeContent.length
            });

            try {
                // ✅ CORRIGÉ: Utiliser requestAnimationFrame pour s'assurer que le layout est prêt
                requestAnimationFrame(() => {
                    if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                            x: scrollPosition,
                            animated: true,
                        });
                        setCurrentIndex(nextIndex);
                    }
                });
            } catch (error) {
                console.error('[MixedContentCarousel] ❌ Erreur lors du scroll:', error);
            }
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

    // ✅ AMÉLIORATION: Gérer le scroll manuel avec meilleure détection des gestes
    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const adjustedOffset = Math.max(0, offsetX - SCREEN_PADDING);
        const index = Math.round(adjustedOffset / SNAP_INTERVAL);
        const safeContent = Array.isArray(content) ? content : [];

        if (index !== currentIndex && index >= 0 && index < safeContent.length) {
            // ✅ CORRIGÉ: Log en debug pour éviter le spam (se déclenche à chaque scroll manuel)
            console.debug('[MixedContentCarousel] 👆 Scroll manuel détecté: index', index);
            setCurrentIndex(index);

            if (!isAutoScrollDisabled) {
                setIsPaused(true);

                clearResumeTimer();
                resumeTimerRef.current = setTimeout(() => {
                    // ✅ CORRIGÉ: Log en debug pour éviter le spam
                    console.debug('[MixedContentCarousel] ▶️ Reprise auto-scroll après pause manuelle');
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
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingRight: SCREEN_PADDING } // ✅ CORRIGÉ: Ajouter padding à droite pour le dernier élément
                ]}
                nestedScrollEnabled={true}
                removeClippedSubviews={false} // ✅ CORRIGÉ: Désactiver pour éviter les problèmes de rendu
                scrollEnabled={true} // ✅ CORRIGÉ: S'assurer que le scroll est activé
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
        paddingLeft: SCREEN_PADDING, // ✅ CORRIGÉ: Padding à gauche seulement (paddingRight dans style inline)
        alignItems: 'center', // ✅ CORRIGÉ: Centrer verticalement les cartes
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
