/**
 * MixedContentCarousel - Carousel intelligent mélangeant publicités et produits organiques
 * Garantit l'équité : produits payants ont TOUJOURS plus de visibilité que gratuits
 */

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
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
import { useTheme } from '../contexts/ThemeContext';
import { apiGet, apiPost } from '../services/api';
import { imagePrefetchService } from '../services/imagePrefetchService';
import { mlRecommendationService } from '../services/mlRecommendationService';
import { modernColors } from '../theme/modernTheme';
import { hapticPress, hapticSelect } from '../utils/hapticFeedback';
import ChatModalMobile from './ChatModalMobile';
import ProductCard from './ProductCard';
import ProductCardSkeleton from './ProductCardSkeleton';
import SafeIcon from './SafeIcon';
import { EmptyState } from './ux/EmptyState';
import { SwipeableCard } from './ux/SwipeableCard';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = 16; // ✅ Marge au bord de l'écran (cohérent avec paddingHorizontal)
const CARD_WIDTH = width * 0.85;
const CARD_MARGIN = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN; // ✅ Intervalle de snap constant

type CarouselMode = 'recommended' | 'search';

interface MixedContentCarouselProps {
    userId?: string;
    userBehavior?: string[]; // Catégories préférées
    publiciteFrequency?: number; // 1 pub toutes les X cartes
    // ✅ NOUVEAU: Props pour mode recherche hybride
    mode?: CarouselMode; // Mode du carousel (recommandé ou recherche)
    searchResults?: any[]; // Résultats de recherche à afficher
    searchQuery?: string; // Query de recherche
    totalSearchResults?: number; // Total de résultats (pour "Voir tous")
    onShowAllResults?: () => void; // Callback pour voir tous les résultats
    onClearSearch?: () => void; // Callback pour revenir au mode recommandé
}

interface ContentItem {
    type: 'organic' | 'paid';
    is_paid: boolean;
    data: any;
    boost_level?: string;
    frequency_ratio?: number;
}

const MixedContentCarousel: React.FC<MixedContentCarouselProps> = React.memo(({
    userId,
    userBehavior = [],
    publiciteFrequency = 3,
    mode = 'recommended', // ✅ NOUVEAU: Mode par défaut = recommandé
    searchResults = [], // ✅ NOUVEAU: Résultats de recherche
    searchQuery = '', // ✅ NOUVEAU: Query de recherche
    totalSearchResults = 0, // ✅ NOUVEAU: Total de résultats
    onShowAllResults, // ✅ NOUVEAU: Callback voir tous
    onClearSearch, // ✅ NOUVEAU: Callback clear recherche
}) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { colors } = useTheme(); // ✅ NOUVEAU: Support thème
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
    const [scrollViewMounted, setScrollViewMounted] = useState(false);
    // ✅ NOUVEAU: Tracker si tous les médias de la carte actuelle ont été vus
    const [allMediaViewed, setAllMediaViewed] = useState<Map<number, boolean>>(new Map());
    const [mediaViewStartTime, setMediaViewStartTime] = useState<Map<number, number>>(new Map());
    // ✅ NOUVEAU: Filtres rapides
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'popular' | 'nearby' | 'new'>('all');
    const [scrollIndicatorVisible, setScrollIndicatorVisible] = useState(true);

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
            // ✅ SÉCURITÉ: Vérifier que les fonctions existent avant de les appeler
            if (typeof clearAutoScrollTimer === 'function') {
                clearAutoScrollTimer();
            }
            if (typeof clearResumeTimer === 'function') {
                clearResumeTimer();
            }
        };
    }, []);

    // ✅ DIAGNOSTIC: Vérifier que le ScrollView est monté
    useEffect(() => {
        // Vérifier périodiquement si le ScrollView est monté
        const checkScrollView = () => {
            if (scrollViewRef.current) {
                try {
                    // Tester si on peut accéder aux méthodes du ScrollView
                    if (typeof scrollViewRef.current.scrollTo === 'function') {
                        if (!scrollViewMounted) {
                            console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] ScrollView monté et prêt');
                            setScrollViewMounted(true);
                        }
                        return true;
                    }
                } catch (error) {
                    console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Erreur vérification ScrollView:', error);
                }
            }
            return false;
        };

        // Vérifier immédiatement
        checkScrollView();

        // Vérifier périodiquement (toutes les 500ms pendant 5 secondes)
        const interval = setInterval(() => {
            if (checkScrollView()) {
                clearInterval(interval);
            }
        }, 500);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            if (!scrollViewMounted) {
                console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] ScrollView non monté après 5 secondes');
            }
        }, 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [scrollViewMounted]);

    // ✅ NOUVEAU: Charger le contenu mixte avec recommandations ML activement utilisées
    useEffect(() => {
        const loadContentWithML = async () => {
            // Charger le contenu de base
            await loadMixedContent();

            // ✅ NOUVEAU: Charger et MÉLANGER les recommandations ML avec le contenu
            if (userId && userBehavior.length > 0) {
                try {
                    // ✅ SÉCURITÉ: Vérifier que mlRecommendationService existe
                    if (mlRecommendationService && typeof (mlRecommendationService as any).getPersonalizedContent === 'function') {
                        const recommendations = await (mlRecommendationService as any).getPersonalizedContent(
                            userId,
                            userBehavior,
                            null // location sera ajoutée si disponible
                        );

                        if (recommendations && recommendations.length > 0) {
                            console.log('[MixedContentCarousel] ✅ Recommandations ML chargées:', recommendations.length);

                            // ✅ NOUVEAU: Mélanger les recommandations ML avec le contenu existant
                            setContent(prevContent => {
                                const mlItems: ContentItem[] = recommendations.map((rec: any) => ({
                                    type: 'organic',
                                    is_paid: false,
                                    data: rec,
                                }));

                                // Mélanger: 30% recommandations ML au début, 70% contenu organique
                                const mixed = [
                                    ...mlItems.slice(0, Math.min(3, mlItems.length)), // 3 premières recommandations ML
                                    ...prevContent,
                                    ...mlItems.slice(3), // Reste des recommandations ML
                                ];

                                return mixed;
                            });
                        }
                    } else {
                        console.warn('[MixedContentCarousel] mlRecommendationService.getPersonalizedContent non disponible');
                    }
                } catch (err) {
                    console.warn('[MixedContentCarousel] Erreur recommandations ML:', err);
                }
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadContentWithML().catch(error => {
            console.error('[MixedContentCarousel] Erreur loadContentWithML:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, userBehavior]);

    // ✅ NOUVEAU: Initialiser le tracking des médias pour toutes les cartes
    useEffect(() => {
        const safeContent = Array.isArray(content) ? content : [];
        if (safeContent.length === 0) return;

        setAllMediaViewed(prev => {
            const newMap = new Map(prev);
            safeContent.forEach((item, index) => {
                if (!newMap.has(index)) {
                    const hasMedia = (Array.isArray(item.data?.images) && item.data.images.length > 0) ||
                        (Array.isArray(item.data?.videos) && item.data.videos.length > 0);
                    newMap.set(index, !hasMedia); // Si pas de médias, considéré comme "vu"
                }
            });
            return newMap;
        });

        setMediaViewStartTime(prev => {
            const newMap = new Map(prev);
            safeContent.forEach((item, index) => {
                if (!newMap.has(index)) {
                    const hasMedia = (Array.isArray(item.data?.images) && item.data.images.length > 0) ||
                        (Array.isArray(item.data?.videos) && item.data.videos.length > 0);
                    if (hasMedia) {
                        newMap.set(index, Date.now());
                    }
                }
            });
            return newMap;
        });
    }, [content.length]);

    // ✅ Réinitialiser l'index et la pause quand le contenu change
    useEffect(() => {
        const safeContent = Array.isArray(content) ? content : [];
        console.log('[MixedContentCarousel] 🔄 [DIAGNOSTIC] Réinitialisation après changement de contenu:', {
            contentLength: safeContent.length,
            hasScrollViewRef: !!scrollViewRef.current
        });

        if (safeContent.length === 0) {
            setCurrentIndex(0);
            console.log('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Contenu vide, index réinitialisé à 0');
            return;
        }

        requestAnimationFrame(() => {
            if (scrollViewRef.current) {
                try {
                    scrollViewRef.current.scrollTo({ x: 0, animated: false });
                    setCurrentIndex(0);
                    setIsPaused(false);
                    console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] Scroll réinitialisé à 0, index:', 0, 'pause:', false);
                } catch (error) {
                    console.error('[MixedContentCarousel] ❌ [DIAGNOSTIC] Erreur réinitialisation scroll:', error);
                }
            } else {
                console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] ScrollView ref null lors de la réinitialisation');
                setCurrentIndex(0);
                setIsPaused(false);
            }
        });
    }, [content.length]);

    // ✅ Démarrer le scroll automatique après la première mise en page
    useEffect(() => {
        // ✅ DIAGNOSTIC: Log visible pour comprendre l'état
        console.log('[MixedContentCarousel] 🔍 [DIAGNOSTIC] Vérification scroll initial:', {
            isAutoScrollDisabled,
            contentLength: Array.isArray(content) ? content.length : 0,
            currentIndex,
            isPaused,
            hasScrollViewRef: !!scrollViewRef.current,
            scrollViewType: scrollViewRef.current ? typeof scrollViewRef.current.scrollTo : 'null'
        });

        if (isAutoScrollDisabled) {
            clearAutoScrollTimer();
            console.log('[MixedContentCarousel] ⏸️ [DIAGNOSTIC] Scroll automatique désactivé (configuration CRASH_PREVENTION_CONFIG.DISABLE_MIXED_CONTENT_AUTOSCROLL)');
            return;
        }

        const safeContent = Array.isArray(content) ? content : [];

        // ✅ CORRIGÉ: Simplifier les conditions - démarrer même avec 1 élément pour test
        if (safeContent.length >= 1 && currentIndex === 0 && !isPaused) {
            console.log('[MixedContentCarousel] ⏱️ [DIAGNOSTIC] Programmation scroll initial dans 1 seconde...', {
                contentLength: safeContent.length,
                currentIndex,
                isPaused,
                scrollViewMounted
            });

            // ✅ CORRIGÉ: Réduire le délai de 2s à 1s pour démarrage plus rapide
            const initialTimer = setTimeout(() => {
                const safeContent = Array.isArray(content) ? content : [];
                console.log('[MixedContentCarousel] 🎬 [DIAGNOSTIC] Tentative scroll initial après 2s:', {
                    hasScrollViewRef: !!scrollViewRef.current,
                    scrollViewMounted,
                    contentLength: safeContent.length,
                    scrollViewReady: scrollViewRef.current ? typeof scrollViewRef.current.scrollTo === 'function' : false
                });

                // ✅ CORRIGÉ: Simplifier - ne pas dépendre strictement de scrollViewMounted
                if (scrollViewRef.current && safeContent.length >= 1) {
                    // ✅ CORRIGÉ: Vérifier que scrollTo est disponible
                    if (typeof scrollViewRef.current.scrollTo !== 'function') {
                        console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] scrollTo n\'est pas une fonction');
                        return;
                    }

                    // ✅ CORRIGÉ: Calculer la position correctement (nextIndex * SNAP_INTERVAL)
                    const nextIndex = 1;
                    const scrollPosition = nextIndex * SNAP_INTERVAL;

                    console.log('[MixedContentCarousel] 🎯 [DIAGNOSTIC] Exécution scroll automatique initial:', {
                        nextIndex,
                        scrollPosition,
                        SNAP_INTERVAL,
                        CARD_WIDTH,
                        CARD_MARGIN
                    });

                    // ✅ CORRIGÉ: Utiliser requestAnimationFrame pour s'assurer que le layout est prêt
                    requestAnimationFrame(() => {
                        if (scrollViewRef.current) {
                            try {
                                scrollViewRef.current.scrollTo({
                                    x: scrollPosition,
                                    animated: true,
                                });
                                setCurrentIndex(nextIndex);
                                console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] Scroll initial exécuté avec succès vers index', nextIndex);
                            } catch (error) {
                                console.error('[MixedContentCarousel] ❌ [DIAGNOSTIC] Erreur lors du scroll initial:', error);
                            }
                        } else {
                            console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] ScrollView ref null dans requestAnimationFrame');
                        }
                    });
                } else {
                    console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] ScrollView ref null ou contenu insuffisant lors du scroll initial:', {
                        hasScrollViewRef: !!scrollViewRef.current,
                        scrollViewMounted,
                        contentLength: safeContent.length,
                        reason: !scrollViewRef.current ? 'ScrollView ref null' :
                            !scrollViewMounted ? 'ScrollView non monté' :
                                safeContent.length <= 1 ? 'Contenu insuffisant' : 'Raison inconnue'
                    });
                }
            }, 1000); // ✅ CORRIGÉ: Délai réduit de 2s à 1s

            return () => {
                // ✅ SÉCURITÉ: Vérifier que initialTimer existe avant de le nettoyer
                if (initialTimer) {
                    clearTimeout(initialTimer);
                }
            };
        } else {
            // ✅ DIAGNOSTIC: Log visible pour comprendre pourquoi le scroll ne démarre pas
            console.log('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Scroll initial non démarré:', {
                contentLength: safeContent.length,
                currentIndex,
                isPaused,
                reason: safeContent.length < 1 ? 'Pas de contenu' :
                    currentIndex !== 0 ? `Index actuel ${currentIndex} (besoin 0)` :
                        isPaused ? 'En pause' : 'Raison inconnue'
            });
        }
    }, [content.length, isPaused, currentIndex, isAutoScrollDisabled, content, scrollViewMounted]);

    const loadMixedContent = async () => {
        try {
            setLoading(true);
            console.log('[MixedContentCarousel] 🎬 [DIAGNOSTIC] Démarrage chargement contenu mixte...', {
                userId,
                userBehaviorCount: userBehavior.length,
                sessionId
            });

            // Construire les paramètres
            const params = new URLSearchParams();
            if (userBehavior.length > 0) {
                params.append('categories', userBehavior.join(','));
                console.log('[MixedContentCarousel] [DIAGNOSTIC] Catégories comportement:', userBehavior);
            }
            if (userId) {
                params.append('user_id', userId);
            }
            params.append('session_id', sessionId);

            const apiUrl = `/api/content/mixed?${params.toString()}`;
            console.log('[MixedContentCarousel] 🔗 [DIAGNOSTIC] Appel API:', apiUrl);

            const startTime = Date.now();
            const response = await apiGet(apiUrl);
            const loadTime = Date.now() - startTime;

            // ✅ CORRIGÉ: Extraire le tableau depuis response.data.data si nécessaire
            let mixedContentArray: any[] = [];
            if (response.success && response.data) {
                if (Array.isArray(response.data)) {
                    mixedContentArray = response.data;
                } else if (typeof response.data === 'object' && response.data !== null && 'data' in response.data) {
                    const dataObj = response.data as { data?: any };
                    if (dataObj.data && Array.isArray(dataObj.data)) {
                        mixedContentArray = dataObj.data;
                    }
                }
            }

            const responseDataMixed = response.data as any;
            console.log('[MixedContentCarousel] 📦 [DIAGNOSTIC] Réponse API reçue:', {
                success: response.success,
                hasData: !!response.data,
                hasDataData: !!(responseDataMixed?.data),
                dataLength: mixedContentArray.length,
                loadTime: `${loadTime}ms`,
                dataType: typeof response.data,
                isArray: Array.isArray(response.data),
                isDataArray: Array.isArray(responseDataMixed?.data)
            });

            if (mixedContentArray.length > 0) {
                console.log(`[MixedContentCarousel] ✅ [DIAGNOSTIC] ${mixedContentArray.length} éléments de contenu mixte chargés`);
                setContent(mixedContentArray);
                console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] Contenu défini dans le state, longueur:', mixedContentArray.length);
            } else {
                // ✅ FALLBACK: Charger les produits organiques si pas de contenu mixte
                const responseDataMixed2 = response.data as any;
                console.log('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Pas de contenu mixte, chargement des produits organiques...', {
                    success: response.success,
                    hasData: !!response.data,
                    hasDataData: !!(responseDataMixed2?.data),
                    dataType: typeof response.data,
                    isArray: Array.isArray(response.data),
                    isDataArray: Array.isArray(responseDataMixed2?.data)
                });
                await loadOrganicProducts();
            }

            setLoading(false);
        } catch (error) {
            console.error('[MixedContentCarousel] ❌ [DIAGNOSTIC] Erreur chargement:', error);
            // ✅ FALLBACK: En cas d'erreur, charger les produits organiques
            console.log('[MixedContentCarousel] 🔄 [DIAGNOSTIC] Basculement vers produits organiques (fallback)...');
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
            console.log('[MixedContentCarousel] 🔄 [DIAGNOSTIC] Chargement des produits organiques...');

            // ✅ CORRIGÉ: Retirer le paramètre include_products qui cause une erreur 400
            // Essayer d'abord l'API récente
            console.log('[MixedContentCarousel] [DIAGNOSTIC] Tentative API /api/services/recent?limit=20');
            const startTime = Date.now();
            let response = await apiGet('/api/services/recent?limit=20');
            const loadTime = Date.now() - startTime;

            // ✅ CORRIGÉ: Extraire le tableau de services depuis response.data.data
            // Le backend retourne {success: true, data: [...], count: 20}
            // apiCall met cette réponse dans response.data, donc le tableau est dans response.data.data
            let servicesArray: any[] = [];
            if (response.success && response.data) {
                // Vérifier si response.data est directement un tableau (ancien format)
                if (Array.isArray(response.data)) {
                    servicesArray = response.data;
                }
                // Sinon, vérifier si response.data.data est un tableau (nouveau format backend)
                else if (typeof response.data === 'object' && response.data !== null && 'data' in response.data) {
                    const dataObj = response.data as { data?: any };
                    if (dataObj.data && Array.isArray(dataObj.data)) {
                        servicesArray = dataObj.data;
                    }
                }
            }

            // Si ça ne marche pas, essayer l'API standard
            if (servicesArray.length === 0) {
                const responseData = response.data as any;
                console.log('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] API recent échouée, essai API standard...', {
                    success: response.success,
                    hasData: !!response.data,
                    hasDataData: !!(responseData?.data),
                    isArray: Array.isArray(response.data),
                    isDataArray: Array.isArray(responseData?.data)
                });
                const startTime2 = Date.now();
                response = await apiGet('/api/services?limit=20');
                const loadTime2 = Date.now() - startTime2;

                // Réessayer d'extraire le tableau
                if (response.success && response.data) {
                    if (Array.isArray(response.data)) {
                        servicesArray = response.data;
                    } else if (typeof response.data === 'object' && response.data !== null && 'data' in response.data) {
                        const dataObj = response.data as { data?: any };
                        if (dataObj.data && Array.isArray(dataObj.data)) {
                            servicesArray = dataObj.data;
                        }
                    }
                }

                const responseData2 = response.data as any;
                console.log('[MixedContentCarousel] [DIAGNOSTIC] Réponse API standard:', {
                    success: response.success,
                    hasData: !!response.data,
                    hasDataData: !!(responseData2?.data),
                    isArray: Array.isArray(response.data),
                    isDataArray: Array.isArray(responseData2?.data),
                    servicesArrayLength: servicesArray.length,
                    loadTime: `${loadTime2}ms`
                });
            } else {
                console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] Réponse API recent réussie:', {
                    success: response.success,
                    dataLength: servicesArray.length,
                    loadTime: `${loadTime}ms`
                });
            }

            if (servicesArray.length > 0) {
                const organicContent: ContentItem[] = [];
                console.log('[MixedContentCarousel] [DIAGNOSTIC] Traitement de', servicesArray.length, 'services...');

                servicesArray.forEach((service: any, serviceIndex: number) => {
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
                                    // ✅ CORRIGÉ: S'assurer que les propriétés principales sont au niveau racine pour ProductCard
                                    nom: productData.nom || productData.name || productData.titre || productData.title,
                                    prix: productData.prix || productData.price || productData.prix_produit,
                                    description: productData.description || productData.desc || productData.description_produit,
                                    serviceId: service.id || service.service_id,
                                    service: {
                                        ...service,
                                        // ✅ CORRIGÉ: S'assurer que service.data contient les bonnes propriétés
                                        data: service.data || {
                                            nom_produit: productData.nom ? { valeur: productData.nom } : undefined,
                                            titre_service: service.data?.titre_service || (service.titre ? { valeur: service.titre } : undefined),
                                            description: productData.description ? { valeur: productData.description } : undefined,
                                            prix_produit: productData.prix ? { valeur: productData.prix } : undefined,
                                        }
                                    },
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
                                // ✅ CORRIGÉ: S'assurer que les propriétés principales sont au niveau racine
                                nom: service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.titre || service.nom || 'Service',
                                description: service.data?.description?.valeur || service.description || 'Description du service',
                                prix: service.prix || '0',
                                devise: service.devise || 'XAF',
                                serviceId: service.id || service.service_id,
                                // ✅ CORRIGÉ: S'assurer que service.data est correctement structuré
                                service: {
                                    ...service,
                                    data: service.data || {
                                        titre_service: service.titre ? { valeur: service.titre } : undefined,
                                        nom_produit: service.nom ? { valeur: service.nom } : undefined,
                                        description: service.description ? { valeur: service.description } : undefined,
                                    }
                                }
                            }
                        });
                    }
                });

                console.log(`[MixedContentCarousel] ✅ [DIAGNOSTIC] ${organicContent.length} produits organiques chargés`);
                if (organicContent.length === 0) {
                    console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Aucun produit trouvé dans les services. Structure des données:', {
                        servicesCount: servicesArray.length,
                        firstService: servicesArray[0] ? {
                            id: servicesArray[0].id,
                            hasData: !!servicesArray[0].data,
                            dataKeys: servicesArray[0].data ? Object.keys(servicesArray[0].data) : [],
                            hasProduits: !!servicesArray[0].data?.produits,
                            produitsType: typeof servicesArray[0].data?.produits,
                            produitsValue: servicesArray[0].data?.produits
                        } : null
                    });
                }
                setContent(organicContent);
                console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] Contenu organique défini dans le state, longueur:', organicContent.length);
            } else {
                const responseData3 = response.data as any;
                console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Aucun produit organique trouvé - Réponse API invalide:', {
                    success: response.success,
                    hasData: !!response.data,
                    hasDataData: !!(responseData3?.data),
                    isArray: Array.isArray(response.data),
                    isDataArray: Array.isArray(responseData3?.data),
                    dataType: typeof response.data,
                    servicesArrayLength: servicesArray.length
                });
                setContent([]);
            }
        } catch (error) {
            console.error('[MixedContentCarousel] ❌ [DIAGNOSTIC] Erreur chargement produits organiques:', error);
            setContent([]);
        }
    };

    // ✅ CORRIGÉ: Déclarer safeContent une seule fois au niveau du composant
    const safeContent = Array.isArray(content) ? content : [];

    // ✅ AMÉLIORÉ: Précharger 3 items à l'avance pour performance optimale
    useEffect(() => {
        if (safeContent.length > 0 && currentIndex < safeContent.length - 1) {
            const prefetchCount = 3; // ✅ Précharger 3 items à l'avance
            const imageUrls: string[] = [];

            // Précharger les 3 prochains items
            for (let i = 1; i <= prefetchCount && currentIndex + i < safeContent.length; i++) {
                const nextItem = safeContent[currentIndex + i];
                if (nextItem?.data?.images?.[0]) {
                    imageUrls.push(nextItem.data.images[0]);
                }
                // Précharger aussi les vidéos si présentes
                if (nextItem?.data?.videos?.[0]) {
                    imageUrls.push(nextItem.data.videos[0]);
                }
            }

            if (imageUrls.length > 0) {
                // ✅ SÉCURITÉ: Vérifier que imagePrefetchService existe
                if (imagePrefetchService && typeof imagePrefetchService.prefetchBatch === 'function') {
                    imagePrefetchService.prefetchBatch(imageUrls).catch((err: any) => {
                        console.warn('[MixedContentCarousel] Erreur prefetch images:', err);
                    });
                }
            }
        }
    }, [currentIndex, safeContent]);

    // ✅ NOUVEAU: Calculer le délai selon le type de contenu et si tous les médias ont été vus
    const calculateDelay = (item: ContentItem, cardIndex: number): number => {
        if (isPaused) return 0;

        // ✅ NOUVEAU: Si tous les médias n'ont pas été vus, attendre plus longtemps
        const mediaViewed = allMediaViewed.get(cardIndex);
        if (mediaViewed === false) {
            // Attendre jusqu'à ce que tous les médias soient vus (vérifié toutes les 2 secondes)
            return 2000;
        }

        // Compter tous les médias (images + vidéos)
        const imageCount = Array.isArray(item.data?.images) ? item.data.images.length : (item.data?.images ? 1 : 0);
        const videoCount = Array.isArray(item.data?.videos) ? item.data.videos.length : (item.data?.videos ? 1 : 0);
        const totalMedia = imageCount + videoCount;

        // Si pas de médias, délai standard
        if (totalMedia === 0) {
            return item.is_paid ? 7000 : 5000;
        }

        // ✅ NOUVEAU: Calculer le délai basé sur le nombre total de médias
        // 3s par image + 5s par vidéo, minimum 5s
        const delay = Math.max(
            imageCount * 3000 + videoCount * 5000,
            5000
        );

        return delay;
    };

    // ✅ Auto-scroll intelligent - timer consolidé
    useEffect(() => {
        clearAutoScrollTimer();

        const safeContent = Array.isArray(content) ? content : [];

        // ✅ DIAGNOSTIC: Log visible pour comprendre l'état du scroll automatique
        console.log('[MixedContentCarousel] 🔄 [DIAGNOSTIC] Vérification auto-scroll continu:', {
            isAutoScrollDisabled,
            contentLength: safeContent.length,
            currentIndex,
            isPaused,
            hasScrollViewRef: !!scrollViewRef.current,
            scrollViewMounted
        });

        if (isAutoScrollDisabled) {
            console.log('[MixedContentCarousel] ⏸️ [DIAGNOSTIC] Scroll automatique désactivé (configuration)');
            return;
        }

        if (safeContent.length <= 1) {
            console.log('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Pas assez de contenu pour le scroll automatique:', safeContent.length);
            return;
        }

        if (isPaused) {
            console.log('[MixedContentCarousel] ⏸️ [DIAGNOSTIC] Scroll automatique en pause');
            return;
        }

        const currentItem = safeContent[currentIndex] ?? safeContent[0];
        if (!currentItem) {
            console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Item actuel introuvable:', { currentIndex, contentLength: safeContent.length });
            return;
        }

        // ✅ NOUVEAU: Vérifier si tous les médias ont été vus
        const mediaViewed = allMediaViewed.get(currentIndex);
        if (mediaViewed === false) {
            // Si pas encore tous vus, attendre 2 secondes et revérifier
            console.log('[MixedContentCarousel] ⏳ [DIAGNOSTIC] Attente que tous les médias soient vus pour la carte', currentIndex);
        }

        const delay = Math.max(calculateDelay(currentItem, currentIndex), 3000);
        console.log('[MixedContentCarousel] ⏱️ [DIAGNOSTIC] Programmation autoscroll', {
            delay,
            currentIndex,
            contentLength: safeContent.length,
            itemType: currentItem.type,
            isPaid: currentItem.is_paid,
            nextScrollIn: `${(delay / 1000).toFixed(1)}s`
        });

        autoScrollTimerRef.current = setTimeout(() => {
            // ✅ CORRIGÉ: Vérifier que le ScrollView est monté et que le contenu est chargé
            if (!scrollViewRef.current || !scrollViewMounted) {
                console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] ScrollView ref null ou non monté, scroll annulé:', {
                    hasScrollViewRef: !!scrollViewRef.current,
                    scrollViewMounted
                });
                return;
            }

            const safeContent = Array.isArray(content) ? content : [];
            if (safeContent.length <= 1) {
                console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Contenu insuffisant lors du scroll:', safeContent.length);
                return;
            }

            // ✅ CORRIGÉ: Vérifier que le ScrollView est bien monté en vérifiant qu'on peut accéder à ses méthodes
            try {
                // Test si le ScrollView est accessible
                if (typeof scrollViewRef.current.scrollTo !== 'function') {
                    console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] ScrollView.scrollTo n\'est pas une fonction, scroll annulé');
                    return;
                }
            } catch (error) {
                console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] Erreur accès ScrollView:', error);
                return;
            }

            const nextIndex = (currentIndex + 1) % safeContent.length;
            // ✅ CORRIGÉ: Calculer la position de scroll correctement en tenant compte du padding
            const scrollPosition = nextIndex * SNAP_INTERVAL;

            console.log('[MixedContentCarousel] 🎬 [DIAGNOSTIC] Auto scroll exécuté', {
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
                        try {
                            scrollViewRef.current.scrollTo({
                                x: scrollPosition,
                                animated: true,
                            });
                            setCurrentIndex(nextIndex);
                            console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] Scroll exécuté avec succès vers index', nextIndex);
                        } catch (error) {
                            console.error('[MixedContentCarousel] ❌ [DIAGNOSTIC] Erreur lors du scrollTo:', error);
                        }
                    } else {
                        console.warn('[MixedContentCarousel] ⚠️ [DIAGNOSTIC] ScrollView ref null dans requestAnimationFrame');
                    }
                });
            } catch (error) {
                console.error('[MixedContentCarousel] ❌ [DIAGNOSTIC] Erreur lors du scroll:', error);
            }
        }, delay);

        return clearAutoScrollTimer;
    }, [content, currentIndex, isPaused, isAutoScrollDisabled, scrollViewMounted]);

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
                view_duration_ms: calculateDelay(item, position) // ✅ CORRIGÉ: Passer les deux arguments
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

        // ✅ NOUVEAU: Masquer l'indicateur de scroll après le premier scroll
        if (offsetX > 10 && scrollIndicatorVisible) {
            setScrollIndicatorVisible(false);
        }
    };

    // ✅ NOUVEAU: Handler pour quand tous les médias d'une carte ont été vus
    const handleAllMediaViewed = (cardIndex: number) => {
        console.log('[MixedContentCarousel] ✅ Tous les médias vus pour la carte', cardIndex);
        setAllMediaViewed(prev => {
            const newMap = new Map(prev);
            newMap.set(cardIndex, true);
            return newMap;
        });
    };

    // ✅ NOUVEAU: Filtrer le contenu selon le filtre sélectionné
    const filteredContent = React.useMemo(() => {
        if (selectedFilter === 'all') return safeContent;

        return safeContent.filter((item) => {
            switch (selectedFilter) {
                case 'popular':
                    // Produits avec beaucoup de vues ou interactions
                    return (item.data?.views || 0) > 10 || (item.data?.reactions_count || 0) > 5;
                case 'nearby':
                    // Produits avec GPS proche (si disponible)
                    return !!item.data?.distance || !!item.data?.gps_fixe;
                case 'new':
                    // Produits créés dans les 7 derniers jours
                    const createdAt = item.data?.created_at || item.data?.createdAt;
                    if (!createdAt) return false;
                    const createdDate = new Date(createdAt);
                    const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
                    return daysSinceCreation <= 7;
                default:
                    return true;
            }
        });
    }, [safeContent, selectedFilter]);

    // ✅ NOUVEAU: Créer les styles dynamiquement avec le thème (UNE SEULE FOIS)
    const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

    // ✅ Gérer le clic sur une carte
    const handleCardClick = async (item: ContentItem, index: number) => {
        hapticPress(); // ✅ NOUVEAU: Feedback haptique
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

        // ✅ CORRIGÉ: Extraire serviceId depuis plusieurs sources possibles
        const serviceId = item?.data?.service_id
            ?? item?.data?.serviceId
            ?? item?.data?.service?.id
            ?? item?.data?.service?.service_id
            ?? item?.data?.id;

        if (!serviceId) {
            console.error('[MixedContentCarousel] ❌ Impossible d\'identifier le service pour cette carte:', {
                itemData: {
                    service_id: item?.data?.service_id,
                    serviceId: item?.data?.serviceId,
                    id: item?.data?.id,
                    service: item?.data?.service ? {
                        id: item?.data?.service?.id,
                        service_id: item?.data?.service?.service_id
                    } : null
                },
                itemKeys: item?.data ? Object.keys(item.data).slice(0, 20) : []
            });
            Alert.alert('Contenu indisponible', 'Nous ne parvenons pas à ouvrir cette annonce pour le moment.');
            return;
        }

        console.log('[MixedContentCarousel] ✅ Navigation vers ServiceDetail avec serviceId:', serviceId);
        (navigation as any).navigate('ServiceDetail', {
            serviceId: String(serviceId),
            fromCarousel: true,
            isPaid: item.is_paid,
        });
    };

    // Loading state avec skeleton
    if (loading) {
        return (
            <View style={dynamicStyles.container}>
                {/* ✅ NOUVEAU: Filtres rapides même en loading */}
                <View style={dynamicStyles.filtersContainer}>
                    {(['all', 'popular', 'nearby', 'new'] as const).map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[
                                dynamicStyles.filterButton,
                                selectedFilter === filter && dynamicStyles.filterButtonActive
                            ]}
                            onPress={() => {
                                setSelectedFilter(filter);
                                hapticSelect();
                            }}
                            disabled={loading}
                        >
                            <Text style={[
                                dynamicStyles.filterButtonText,
                                selectedFilter === filter && dynamicStyles.filterButtonTextActive
                            ]}>
                                {filter === 'all' ? 'Tous' :
                                    filter === 'popular' ? 'Populaires' :
                                        filter === 'nearby' ? 'Proches' : 'Nouveaux'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {/* ✅ NOUVEAU: Skeleton loading */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dynamicStyles.scrollView}>
                    {[1, 2, 3].map((i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </ScrollView>
            </View>
        );
    }

    // ✅ NOUVEAU: Empty state amélioré avec EmptyState
    if (safeContent.length === 0) {
        return (
            <View style={dynamicStyles.emptyContainer}>
                <EmptyState
                    variant="empty"
                    title="Aucun contenu disponible"
                    description="Essayez de rafraîchir ou de modifier vos filtres"
                    icon="package"
                />
            </View>
        );
    }

    return (
        <View style={dynamicStyles.container}>
            {/* ✅ NOUVEAU: Header de recherche ou filtres selon le mode */}
            {mode === 'search' ? (
                <View style={dynamicStyles.searchHeader}>
                    <View style={dynamicStyles.searchHeaderTop}>
                        <View style={dynamicStyles.searchHeaderLeft}>
                            <SafeIcon name="search" size={18} color={colors.primary} />
                            <Text style={dynamicStyles.searchHeaderTitle}>
                                Résultats pour "{searchQuery}"
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={dynamicStyles.clearSearchButton}
                            onPress={onClearSearch}
                            accessibilityLabel="Nouvelle recherche"
                            accessibilityRole="button"
                        >
                            <SafeIcon name="x" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={dynamicStyles.searchHeaderBottom}>
                        <Text style={dynamicStyles.searchHeaderCount}>
                            {searchResults.length} résultat(s) affiché(s)
                            {totalSearchResults > searchResults.length && ` sur ${totalSearchResults}`}
                        </Text>
                        {totalSearchResults > searchResults.length && onShowAllResults && (
                            <TouchableOpacity
                                style={dynamicStyles.showAllButton}
                                onPress={onShowAllResults}
                                accessibilityLabel={`Voir tous les ${totalSearchResults} résultats`}
                                accessibilityRole="button"
                            >
                                <Text style={dynamicStyles.showAllButtonText}>
                                    Voir tous ({totalSearchResults})
                                </Text>
                                <SafeIcon name="chevron-right" size={16} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : (
                /* ✅ NOUVEAU: Filtres rapides (mode recommandé) */
                <View style={dynamicStyles.filtersContainer}>
                    {(['all', 'popular', 'nearby', 'new'] as const).map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[
                                dynamicStyles.filterButton,
                                selectedFilter === filter && dynamicStyles.filterButtonActive
                            ]}
                            onPress={() => {
                                setSelectedFilter(filter);
                                hapticSelect();
                            }}
                            accessibilityLabel={`Filtre ${filter === 'all' ? 'Tous' : filter === 'popular' ? 'Populaires' : filter === 'nearby' ? 'Proches' : 'Nouveaux'}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: selectedFilter === filter }}
                        >
                            <Text style={[
                                dynamicStyles.filterButtonText,
                                selectedFilter === filter && dynamicStyles.filterButtonTextActive
                            ]}>
                                {filter === 'all' ? 'Tous' :
                                    filter === 'popular' ? 'Populaires' :
                                        filter === 'nearby' ? 'Proches' : 'Nouveaux'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* ✅ NOUVEAU: Indicateur de scroll horizontal */}
            {scrollIndicatorVisible && safeContent.length > 1 && (
                <View style={dynamicStyles.scrollIndicator}>
                    <SafeIcon name="chevron-left" size={16} color={colors.primary} />
                    <Text style={dynamicStyles.scrollIndicatorText}>Glissez pour voir plus</Text>
                    <SafeIcon name="chevron-right" size={16} color={colors.primary} />
                </View>
            )}

            {/* ✅ CORRIGÉ: Conteneur avec hauteur fixe pour éviter le débordement */}
            {/* ✅ Barres de progression (comme Instagram Stories) */}
            <View style={dynamicStyles.progressBars}>
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
                ref={(ref) => {
                    scrollViewRef.current = ref;
                    if (ref && !scrollViewMounted) {
                        console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] ScrollView ref assigné');
                        setScrollViewMounted(true);
                    }
                }}
                horizontal
                pagingEnabled={false}
                snapToInterval={SNAP_INTERVAL}
                snapToAlignment="start"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                onScroll={handleScrollEvent}
                scrollEventThrottle={16}
                style={dynamicStyles.scrollView}
                contentContainerStyle={[
                    dynamicStyles.scrollContent,
                    { paddingRight: SCREEN_PADDING } // ✅ CORRIGÉ: Ajouter padding à droite pour le dernier élément
                ]}
                nestedScrollEnabled={true}
                removeClippedSubviews={false} // ✅ CORRIGÉ: Désactiver pour éviter les problèmes de rendu
                scrollEnabled={true} // ✅ CORRIGÉ: S'assurer que le scroll est activé
                onLayout={() => {
                    console.log('[MixedContentCarousel] ✅ [DIAGNOSTIC] ScrollView layout terminé');
                    if (scrollViewRef.current && !scrollViewMounted) {
                        setScrollViewMounted(true);
                    }
                }}
            >
                {filteredContent.map((item, index) => {
                    // ✅ DIAGNOSTIC: Log pour comprendre les données
                    if (__DEV__ && index === 0) {
                        console.log('[MixedContentCarousel] 🔍 [DIAGNOSTIC] Données première carte:', {
                            hasData: !!item.data,
                            hasNom: !!item.data?.nom,
                            hasService: !!item.data?.service,
                            serviceId: item.data?.serviceId || item.data?.service_id,
                            serviceData: item.data?.service?.data ? Object.keys(item.data.service.data) : 'no data',
                            productKeys: item.data ? Object.keys(item.data).slice(0, 10) : []
                        });
                    }

                    // ✅ NOUVEAU: Initialiser le tracking des médias pour cette carte si pas déjà fait
                    const hasMedia = (Array.isArray(item.data?.images) && item.data.images.length > 0) ||
                        (Array.isArray(item.data?.videos) && item.data.videos.length > 0);
                    if (!allMediaViewed.has(index)) {
                        // Initialiser dans un useEffect séparé (appelé une fois par carte)
                        // Note: Cette initialisation se fait via useEffect dans le composant parent
                    }

                    return (
                        <SwipeableCard
                            key={`${item.type}-${item.data.id || item.data.serviceId || index}-${index}`}
                            onSwipeLeft={() => {
                                // Action swipe left (ex: partager)
                                console.log('[MixedContentCarousel] Swipe left sur:', item.data?.nom);
                            }}
                            rightAction={{
                                icon: 'share-2',
                                label: 'Partager',
                                color: modernColors.primary,
                                onPress: () => {
                                    // TODO: Implémenter partage
                                    console.log('[MixedContentCarousel] Partager:', item.data?.nom);
                                }
                            }}
                        >
                            <TouchableOpacity
                                style={[dynamicStyles.card, { width: CARD_WIDTH, marginRight: CARD_MARGIN }]}
                                activeOpacity={0.9}
                                onPress={() => handleCardClick(item, index)}
                                accessibilityLabel={`${item.is_paid ? 'Annonce sponsorisée' : 'Produit recommandé'}: ${item.data?.nom || 'Produit'}`}
                                accessibilityRole="button"
                                accessibilityHint="Appuyez deux fois pour voir les détails du produit"
                            >
                                {/* ✅ Badge Sponsorisé ou Recommandé */}
                                <View style={[
                                    dynamicStyles.badge,
                                    item.is_paid ? dynamicStyles.badgePaid : dynamicStyles.badgeOrganic
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

                                {/* ✅ NOUVEAU: Badge "Nouveau" pour les produits récents */}
                                {(() => {
                                    const createdAt = item.data?.created_at || item.data?.createdAt;
                                    if (!createdAt) return null;
                                    const createdDate = new Date(createdAt);
                                    const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
                                    if (daysSinceCreation <= 7) {
                                        return (
                                            <View style={styles.newBadge}>
                                                <Text style={styles.newBadgeText}>✨ Nouveau</Text>
                                            </View>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* ✅ Badge durée vidéo si présent */}
                                {item.data?.videos && item.data.videos.length > 0 && (
                                    <View style={styles.videoBadge}>
                                        <SafeIcon name="video" size={14} color="#FFFFFF" />
                                        <Text style={styles.videoDuration}>0:15</Text>
                                    </View>
                                )}

                                {/* Contenu de la carte */}
                                <ProductCard
                                    product={{
                                        ...item.data,
                                        // ✅ CORRIGÉ: S'assurer que serviceId est toujours présent dans product
                                        service_id: item.data.service_id || item.data.serviceId || item.data.service?.id || item.data.service?.service_id,
                                        serviceId: item.data.serviceId || item.data.service_id || item.data.service?.id || item.data.service?.service_id,
                                    }}
                                    service={item.data.service || {
                                        id: item.data.serviceId || item.data.service_id || item.data.service?.id || item.data.service?.service_id,
                                        service_id: item.data.serviceId || item.data.service_id || item.data.service?.id || item.data.service?.service_id,
                                        data: item.data.service?.data || {
                                            titre_service: item.data.nom ? { valeur: item.data.nom } : undefined,
                                            nom_produit: item.data.nom ? { valeur: item.data.nom } : undefined,
                                            description: item.data.description ? { valeur: item.data.description } : undefined,
                                            prix_produit: item.data.prix ? { valeur: item.data.prix } : undefined,
                                        }
                                    }}
                                    prestataire={item.data.prestataire}
                                    onPress={() => handleCardClick(item, index)}
                                    onChatPress={() => {
                                        const resolvedServiceId = item.data.serviceId || item.data.service_id || item.data.service?.id || item.data.service?.service_id;
                                        setSelectedService(item.data.service || {
                                            id: resolvedServiceId,
                                            service_id: resolvedServiceId,
                                            data: item.data.service?.data || {}
                                        });
                                        setSelectedPrestataire(item.data.prestataire || null);
                                        setShowChatModal(true);
                                    }}
                                    // ✅ NOUVEAU: Passer les callbacks pour tracker les médias
                                    onAllMediaViewed={() => handleAllMediaViewed(index)}
                                />
                            </TouchableOpacity>
                        </SwipeableCard>
                    );
                })}
            </ScrollView>

            {/* ✅ Pagination dots */}
            {filteredContent.length > 1 && (
                <View style={dynamicStyles.pagination}>
                    {filteredContent.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                dynamicStyles.paginationDot,
                                index === currentIndex && dynamicStyles.paginationDotActive
                            ]}
                        />
                    ))}
                </View>
            )}

            {/* ✅ Contrôles manuels */}
            {!isAutoScrollDisabled && !isPaused && (
                <TouchableOpacity
                    style={dynamicStyles.pauseButton}
                    onPress={() => setIsPaused(true)}
                >
                    <SafeIcon name="pause" size={16} color="#FFFFFF" />
                </TouchableOpacity>
            )}
            {!isAutoScrollDisabled && isPaused && (
                <TouchableOpacity
                    style={dynamicStyles.playButton}
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
});

// ✅ NOUVEAU: Fonction pour créer les styles avec support thème
const createStyles = (colors: any) => StyleSheet.create({
    container: {
        marginVertical: 0,
        marginTop: 0,
        height: 420, // ✅ AUGMENTÉ: 360 → 420 (320px cartes + 40px progress + 60px filtres)
        maxHeight: 420,
        overflow: 'hidden',
        backgroundColor: 'transparent', // Transparent pour laisser passer le fond
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
        color: colors.textSecondary, // ✅ NOUVEAU: Support thème
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
        backgroundColor: colors.borderLight, // ✅ NOUVEAU: Support thème
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary, // ✅ NOUVEAU: Support thème
        borderRadius: 2,
    },
    scrollView: {
        marginBottom: 8,
        height: 320, // ✅ AUGMENTÉ: 240 → 320 pour donner plus d'espace vertical aux cartes
        maxHeight: 320, // ✅ AUGMENTÉ: 240 → 320
        overflow: 'hidden',
    },
    scrollContent: {
        paddingLeft: SCREEN_PADDING,
        alignItems: 'center',
        paddingVertical: 0,
        height: 320, // ✅ AUGMENTÉ: 240 → 320 pour correspondre à la nouvelle hauteur
    },
    card: {
        backgroundColor: colors.surface, // ✅ NOUVEAU: Support thème
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        height: 320, // ✅ AUGMENTÉ: 240 → 320 pour donner plus d'espace aux cartes
        maxHeight: 320, // ✅ AUGMENTÉ: 240 → 320
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
        backgroundColor: colors.primary, // ✅ NOUVEAU: Support thème - Bleu pour recommandé
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
        backgroundColor: colors.borderLight, // ✅ NOUVEAU: Support thème
    },
    paginationDotActive: {
        width: 20,
        backgroundColor: colors.primary, // ✅ NOUVEAU: Support thème
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
        backgroundColor: colors.primary, // ✅ NOUVEAU: Support thème
        borderRadius: 25,
        padding: 12,
        zIndex: 20,
    },
    // ✅ NOUVEAU: Styles pour les filtres rapides
    filtersContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        marginBottom: 4,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: colors.surfaceVariant, // ✅ NOUVEAU: Support thème
        borderWidth: 1,
        borderColor: colors.border, // ✅ NOUVEAU: Support thème
    },
    filterButtonActive: {
        backgroundColor: colors.primary, // ✅ NOUVEAU: Support thème
        borderColor: colors.primary, // ✅ NOUVEAU: Support thème
    },
    filterButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary, // ✅ NOUVEAU: Support thème
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU: Indicateur de scroll horizontal
    scrollIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        gap: 8,
        backgroundColor: colors.surfaceVariant, // ✅ NOUVEAU: Support thème
        marginBottom: 4,
    },
    scrollIndicatorText: {
        fontSize: 11,
        color: colors.primary, // ✅ NOUVEAU: Support thème
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Badge "Nouveau"
    newBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#10B981',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 10,
    },
    newBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    // ✅ NOUVEAU: Styles pour header de recherche
    searchHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.surfaceVariant,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchHeaderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    searchHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    searchHeaderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
    },
    clearSearchButton: {
        padding: 4,
        borderRadius: 12,
        backgroundColor: colors.surface,
    },
    searchHeaderBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    searchHeaderCount: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    showAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: colors.primary,
    },
    showAllButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

// ✅ Styles par défaut (pour compatibilité)
const styles = createStyles(modernColors);

MixedContentCarousel.displayName = 'MixedContentCarousel';

export default MixedContentCarousel;
