import { useNavigation } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewToken
} from 'react-native';
import AnimatedReanimated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import ProductCommentsSection from '../components/ProductCommentsSection';
import ProductVideoCreationModal from '../components/ProductVideoCreationModal';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
// ✅ NOUVEAU: Composants améliorés VideoFeed
import { DoubleTapLike } from '../components/video/DoubleTapLike';
import DuetRemixModal from '../components/video/DuetRemixModal';
import { HashtagsList } from '../components/video/HashtagsList';
import { LiveStreamPlayer } from '../components/video/LiveStreamPlayer';
import { VideoGestureHandler } from '../components/video/VideoGestureHandler';
import { VideoWithEffects } from '../components/video/VideoWithEffects';
// ✅ NOUVEAU: Accessibilité
import { AccessibilityWrapper, useAccessibility } from '../components/ux/AccessibilityWrapper';
// ✅ NOUVEAU: Optimisations batterie
import { useBatteryOptimization } from '../services/batteryOptimizationService';
// ✅ NOUVEAU: Fonctionnalités sociales avancées
// ✅ NOUVEAU: Composants livraison et chat depuis vidéo
import ChatModalMobile from '../components/ChatModalMobile';
import OrderDeliveryModal from '../components/delivery/OrderDeliveryModal';
import { ENVIRONMENT } from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import { adaptiveVideoService } from '../services/adaptiveVideoService';
import { apiGet, apiPost } from '../services/api';
import { cdnService } from '../services/cdnService';
import liveStreamingService from '../services/liveStreamingService';
import { retryWithBackoff } from '../services/retryService';
import { studioService } from '../services/studioService';
import userBehaviorService from '../services/userBehaviorService';
import { videoCacheService } from '../services/videoCacheService';
import { videoPreloadService } from '../services/videoPreloadService';
import { videoRecommendationService } from '../services/videoRecommendationService';
import { modernColors } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import { triggerHaptic } from '../utils/hapticFeedback';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
// ✅ OPTIMISÉ: Détection tablette pour responsivité multi-écrans
const isTablet = SCREEN_WIDTH > 768;
const numColumns = isTablet ? 2 : 1; // 2 colonnes sur tablette, 1 sur téléphone
const formatCount = (value: number): string => {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}k`;
    }
    return `${value}`;
};

const normalizeCategoryKey = (product: Record<string, any>): string => {
    const raw =
        product?.categorie_produit ??
        product?.categorie ??
        product?.category ??
        product?.type ??
        product?.serviceCategorie ??
        'autre';
    return String(raw).trim().toLowerCase();
};

const getProductTypeLabel = (type: string): string => {
    const key = (type || '').toLowerCase();
    const labels: Record<string, string> = {
        electronique: '📱 Électronique',
        informatique: '💻 Informatique',
        plombier: '🔧 Plomberie',
        plomberie: '🔧 Plomberie',
        electricite: '⚡ Électricité',
        automobile: '🚗 Automobile',
        agriculture: '🌾 Agriculture',
        beaute: '💄 Beauté',
        sante: '🩺 Santé',
        immobilier: '🏢 Immobilier',
        service: '💼 Service',
        prestation: '💼 Prestation',
        ticket_voyage: '🚌 Ticket de voyage',
    };
    if (labels[key]) {
        return labels[key];
    }
    if (!key) {
        return 'Autres catégories';
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
};

const resolveNumericId = (value: any): number | null => {
    if (value === null || value === undefined) {
        return null;
    }
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseDateToTimestamp = (value: any): number => {
    if (!value) {
        return 0;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return 0;
        }
        const numericCandidate = Number(trimmed);
        if (!Number.isNaN(numericCandidate) && Number.isFinite(numericCandidate)) {
            if (numericCandidate > 10_000_000_000) {
                return numericCandidate;
            }
            if (numericCandidate > 10_000_000) {
                return numericCandidate * 1000;
            }
        }

        const parsedDate = Date.parse(trimmed.replace(/\.\d{3}Z$/, 'Z'));
        if (!Number.isNaN(parsedDate)) {
            return parsedDate;
        }
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.getTime();
    }
    return 0;
};

const resolveProductTimestamp = (product: Record<string, any>, fallback?: number): number => {
    if (!product || typeof product !== 'object') {
        return fallback || 0;
    }
    const candidates: any[] = [
        product.created_at_ts,
        product.created_at,
        product.createdAt,
        product.created_at_api,
        product.created_at_iso,
        product.created_at_app,
        product.createdAtISO,
        product.createdAtMs,
        product.created_at_ms,
        product.lifecycle_created_at,
        product.lifecycleCreatedAt,
        product.updated_at,
        product.updatedAt,
        product.date_creation,
        product.dateCreation,
        product.metadata?.created_at,
        product.metadata?.createdAt,
        product.stats?.created_at,
        product.stats?.createdAt,
    ];
    for (const candidate of candidates) {
        const timestamp = parseDateToTimestamp(candidate);
        if (timestamp) {
            return timestamp;
        }
    }
    if (typeof fallback === 'number' && fallback > 0) {
        return fallback;
    }
    if (product.rawProductId) {
        const numericId = Number(product.rawProductId);
        if (!Number.isNaN(numericId) && Number.isFinite(numericId)) {
            return numericId;
        }
    }
    return 0;
};

const extractManagedProductsFromServices = (servicesData: any[]): ManagedProduct[] => {
    const results: ManagedProduct[] = [];
    servicesData.forEach((service: any) => {
        if (!service) {
            return;
        }
        const serviceId = service.id ? String(service.id) : Math.random().toString(36).slice(2);
        const serviceTitre =
            service.data?.titre_service?.valeur ||
            service.data?.titre_service ||
            service.titre ||
            service.name ||
            'Service sans titre';
        const produits = service.data?.produits?.valeur || service.data?.produits || [];
        const serviceCreatedAtTs = parseDateToTimestamp(
            service.created_at || service.createdAt || service.data?.created_at,
        );
        if (Array.isArray(produits)) {
            produits.forEach((product: any, index: number) => {
                const productIndex =
                    typeof product?.product_index === 'number' ? product.product_index : index;
                const rawProductIdCandidate =
                    product.lifecycle_id ??
                    product.product_lifecycle_id ??
                    product.productLifecycleId ??
                    product.product_id ??
                    product.id ??
                    null;
                const numericProductId = resolveNumericId(rawProductIdCandidate);
                const categoryKey = normalizeCategoryKey(product);
                const categoryLabel = getProductTypeLabel(categoryKey);
                const fallbackTimestamp =
                    serviceCreatedAtTs || (numericProductId ? numericProductId * 1000 : 0);
                const productTimestamp = resolveProductTimestamp(product, fallbackTimestamp);
                const views = Number(
                    product.views ?? product.stats?.views ?? product.analytics?.views ?? 0,
                );
                const shares = Number(
                    product.shares ?? product.stats?.shares ?? product.analytics?.shares ?? 0,
                );
                const saves = Number(
                    product.saves ??
                    product.stats?.favorites ??
                    product.analytics?.favorites ??
                    product.favoris ??
                    0,
                );
                results.push({
                    ...product,
                    id: numericProductId
                        ? String(numericProductId)
                        : `${serviceId}_${productIndex}`,
                    rawProductId: numericProductId ?? undefined,
                    product_index: productIndex,
                    category_key: categoryKey,
                    category_label: categoryLabel,
                    serviceId,
                    serviceTitre,
                    is_active:
                        product.is_active !== undefined ? product.is_active : product.actif ?? true,
                    created_at_ts: productTimestamp,
                    views,
                    shares,
                    saves,
                });
            });
        }
    });
    results.sort((a, b) => {
        const tsA = a.created_at_ts || 0;
        const tsB = b.created_at_ts || 0;
        if (tsA !== tsB) {
            return tsB - tsA;
        }
        const rawA = Number(a.rawProductId || 0);
        const rawB = Number(b.rawProductId || 0);
        if (rawA !== rawB) {
            return rawB - rawA;
        }
        return (b.product_index ?? 0) - (a.product_index ?? 0);
    });
    return results;
};

const formatLiveStartRelative = (isoDate: string): string => {
    try {
        const date = new Date(isoDate);
        if (Number.isNaN(date.getTime())) {
            return 'Prochainement';
        }
        const diff = date.getTime() - Date.now();
        if (diff <= 0) {
            return 'En direct';
        }
        const minutes = Math.round(diff / 60000);
        if (minutes < 60) {
            return `Dans ${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `Dans ${hours}h${mins.toString().padStart(2, '0')}`;
    } catch (error) {
        console.warn('[VideoFeedScreen] formatLiveStartRelative error', error);
        return 'Prochainement';
    }
};

const formatLiveStartClock = (isoDate: string): string => {
    try {
        const date = new Date(isoDate);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (error) {
        console.warn('[VideoFeedScreen] formatLiveStartClock error', error);
        return '';
    }
};

const buildFallbackLiveSessions = (): LiveSession[] => {
    const base = Date.now();
    return [
        {
            id: 'demo-live-1',
            title: 'Live lancement coffret beauté',
            startAt: new Date(base + 20 * 60000).toISOString(),
            serviceId: 'demo-service-1',
            description:
                'Découvrez en direct notre nouvelle box beauté, promotions exceptionnelles durant le live.',
            audience: 182,
            thumbnail:
                'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
            tags: ['Beauté', 'Promo'],
            hostName: 'Equipe Yukpo Beauty',
        },
        {
            id: 'demo-live-2',
            title: 'Atelier réparation express',
            startAt: new Date(base + 55 * 60000).toISOString(),
            serviceId: 'demo-service-2',
            description:
                'Un technicien expert vous montre comment prolonger la vie de vos appareils électroménagers.',
            audience: 96,
            thumbnail:
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
            tags: ['Service', 'Conseils'],
            hostName: 'Atelier Express',
        },
    ];
};

interface FeedItem {
    id: string;
    titre: string;
    description?: string;
    videoUrl: string;
    thumbnail?: string;
    serviceId?: number;
    contentId: string;
    prestataire?: {
        nom?: string;
        avatar_url?: string;
        user_id?: number;
    };
    isSponsored?: boolean;
    badge?: string;
    frequencyRatio?: number;
    likesCount?: number;
    savesCount?: number;
    audioLabel?: string;
    sessionId?: string; // ✅ Phase 9 - Amélioration 31 : ID de session pour chaînage vidéos
    hashtags?: string[]; // ✅ NOUVEAU: Hashtags de la vidéo
}

interface LiveSession {
    id: string;
    title: string;
    startAt: string;
    serviceId?: string;
    description?: string;
    audience?: number;
    thumbnail?: string;
    tags?: string[];
    hostName?: string;
    flashSales?: Array<{ id: string; status: string }>; // ✅ NOUVEAU: Flash sales de la session
}

interface ContentEngagementResponse {
    content_id: string;
    likes: number;
    saves: number;
    liked?: boolean;
    saved?: boolean;
}

// ✅ OPTIMISÉ: viewabilityConfig à 50% pour préchargement plus précoce (comme TikTok)
const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Au lieu de 80% - détection plus précoce
    minimumViewTime: 100, // 100ms minimum avant changement
    waitForInteraction: false, // Ne pas attendre interaction utilisateur
};

const VideoFeedScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    // ✅ NOUVEAU: Accessibilité
    const { isScreenReaderEnabled, isReduceMotionEnabled } = useAccessibility();
    // ✅ NOUVEAU: Optimisations batterie
    const { isBackground, shouldPauseVideos, shouldReducePreload, optimalFPS } = useBatteryOptimization();
    const [loading, setLoading] = useState(true);
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [forYouSource, setForYouSource] = useState<FeedItem[]>([]);
    const [followingFeed, setFollowingFeed] = useState<FeedItem[]>([]);
    const [activeLane, setActiveLane] = useState<'foryou' | 'following'>('foryou');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentDurationMs, setCurrentDurationMs] = useState(0);
    const videoRefs = useRef<Map<number, Video | null>>(new Map());
    // ✅ NOUVEAU: Tracking temps de visionnage
    const lastTrackTimeRef = useRef<Map<string, number>>(new Map()); // contentId -> last tracked time (seconds)
    const videoDurationsRef = useRef<Map<string, number>>(new Map()); // contentId -> video duration (seconds)
    const currentIndexRef = useRef(0);
    const currentStartTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef(
        `video_feed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
    // ✅ Phase 9 - Amélioration 31 : Navigation automatique vers vidéo suivante
    const nextVideoNavigationRef = useRef<Map<string, string>>(new Map()); // sessionId -> nextSessionId
    const isNavigatingRef = useRef(false);
    const flatListRef = useRef<FlatList<FeedItem>>(null);
    const feedRef = useRef<FeedItem[]>([]);
    const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
    const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
    const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
    const [commentTarget, setCommentTarget] = useState<FeedItem | null>(null);
    const [duetTarget, setDuetTarget] = useState<FeedItem | null>(null);
    const [creatorPanelItem, setCreatorPanelItem] = useState<FeedItem | null>(null);
    // ✅ NOUVEAU: États pour livraison et chat depuis vidéo
    const [deliveryTarget, setDeliveryTarget] = useState<FeedItem | null>(null);
    const [chatTarget, setChatTarget] = useState<FeedItem | null>(null);
    const [serviceDataForDelivery, setServiceDataForDelivery] = useState<any>(null);
    const [deliveryProductIndex, setDeliveryProductIndex] = useState<number | undefined>(undefined);
    const [deliveryProductName, setDeliveryProductName] = useState<string | undefined>(undefined);
    const [serviceDataForChat, setServiceDataForChat] = useState<any>(null);
    const [creationModalVisible, setCreationModalVisible] = useState(false);
    const [creationProducts, setCreationProducts] = useState<ManagedProduct[]>([]);
    const [creationPrimaryProduct, setCreationPrimaryProduct] = useState<ManagedProduct | null>(null);
    const [creationLoading, setCreationLoading] = useState(false);
    const creationInventoryLoadedRef = useRef(false);
    const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
    const [liveLoading, setLiveLoading] = useState(false);
    const [liveModalSession, setLiveModalSession] = useState<LiveSession | null>(null);
    const [liveReminderMap, setLiveReminderMap] = useState<Record<string, boolean>>({});
    const [showLiveChat, setShowLiveChat] = useState(false);
    // ✅ NOUVEAU: États pour améliorations UX
    const [showDoubleTapLike, setShowDoubleTapLike] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const isFollowingLane = activeLane === 'following';

    // ✅ OPTIMISÉ: Animation de transition fade entre vidéos (comme TikTok)
    const fadeAnim = useSharedValue(1);

    // ✅ NOUVEAU: Initialiser les services (préchargement, compression adaptative, CDN, cache)
    useEffect(() => {
        videoPreloadService.initialize().catch(() => {
            // Ignorer erreurs silencieusement
        });
        adaptiveVideoService.initialize().catch(() => {
            // Ignorer erreurs silencieusement
        });
        cdnService.initialize(ENVIRONMENT.API_URL).catch(() => {
            // Ignorer erreurs silencieusement
        });
        // ✅ NOUVEAU: Initialiser le service de cache vidéo
        videoCacheService.initialize().catch(() => {
            // Ignorer erreurs silencieusement
        });
    }, []);

    useEffect(() => {
        if (Platform.OS === 'android') {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            LayoutAnimation.setLayoutAnimationEnabledExperimental?.(true);
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!isPaused && currentStartTimeRef.current != null) {
                setCurrentDurationMs(Date.now() - currentStartTimeRef.current);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [isPaused]);


    const registerRef = useCallback((index: number, ref: Video | null) => {
        videoRefs.current.set(index, ref);
    }, []);

    const playActiveVideo = useCallback(
        async (activeIndex: number) => {
            // ✅ NOUVEAU: Pause automatique si app en background ou si shouldPauseVideos
            const shouldPause = isPaused || shouldPauseVideos;

            for (const [index, ref] of videoRefs.current.entries()) {
                if (!ref) continue;
                try {
                    if (index === activeIndex) {
                        if (shouldPause) {
                            await ref.pauseAsync();
                        } else {
                            await ref.playAsync();
                        }
                    } else {
                        await ref.pauseAsync();
                    }
                } catch (error) {
                    console.warn('[VideoFeedScreen] Playback error', error);
                }
            }
        },
        [isPaused, shouldPauseVideos],
    );

    useEffect(() => {
        // ✅ OPTIMISÉ: Animation fade lors du changement de vidéo
        fadeAnim.value = withTiming(0, { duration: 150 }, () => {
            playActiveVideo(currentIndex).catch(() => undefined);
            fadeAnim.value = withTiming(1, { duration: 150 });
        });
    }, [currentIndex, playActiveVideo, fadeAnim]);

    useEffect(() => {
        playActiveVideo(currentIndexRef.current).catch(() => undefined);
    }, [isPaused, playActiveVideo, shouldPauseVideos]);

    // ✅ NOUVEAU: Pause automatique quand app passe en background
    useEffect(() => {
        if (shouldPauseVideos && !isPaused) {
            setIsPaused(true);
        }
    }, [shouldPauseVideos]);

    useEffect(() => {
        const nextItem = feed[currentIndex + 1];
        if (nextItem?.thumbnail) {
            Image.prefetch(nextItem.thumbnail).catch(() => undefined);
        }
    }, [currentIndex, feed]);

    const processResponse = useCallback((data: any[]): FeedItem[] => {
        return data
            .map((item) => {
                if (item?.type === 'live_replay') {
                    const replaySource =
                        item?.data?.hls_url ??
                        item?.data?.replay_url ??
                        item?.data?.video ??
                        item?.data?.videos?.[0];
                    if (!replaySource) {
                        return null;
                    }

                    const hostLabel =
                        item?.data?.host ??
                        item?.data?.host_name ??
                        item?.data?.hostName ??
                        'Replay live Yukpo';
                    return {
                        id: `live-replay-${item?.data?.id ?? item?.content_id ?? Math.random().toString(36).slice(2)}`,
                        titre:
                            item?.data?.title ??
                            item?.data?.titre ??
                            item?.data?.name ??
                            'Replay live',
                        description: item?.data?.description ?? undefined,
                        videoUrl: replaySource,
                        thumbnail: item?.data?.thumbnail ?? item?.data?.cover ?? undefined,
                        serviceId: item?.data?.service_id ?? item?.data?.serviceId ?? item?.data?.service?.id,
                        contentId: item?.content_id ?? `live_replay_${item?.data?.id ?? Math.random().toString(36).slice(2)}`,
                        prestataire: item?.data?.prestataire,
                        isSponsored: false,
                        badge: 'Replay live',
                        likesCount: item?.data?.likes ?? 0,
                        savesCount: item?.data?.saves ?? 0,
                        audioLabel: hostLabel,
                    } as FeedItem;
                }

                const video =
                    item?.data?.videos?.[0] ||
                    item?.data?.video ||
                    item?.data?.media?.videos?.[0];
                if (!video) return null;
                const serviceId =
                    item?.data?.service_id ??
                    item?.data?.serviceId ??
                    item?.data?.service?.id;
                const contentId: string =
                    item?.content_id ||
                    item?.data?.content_id ||
                    (serviceId ? `service_${serviceId}` : `content_${item?.data?.id ?? video}`);
                const engagement = item?.engagement ?? item?.data?.engagement ?? {};

                const audioMode =
                    item?.data?.music_mode ??
                    item?.data?.audio_mode ??
                    item?.data?.soundtrack ??
                    item?.data?.audio_label ??
                    item?.data?.audio_profile ??
                    null;
                return {
                    id: `${item.type}-${item.data?.id ?? video}`,
                    titre:
                        item?.data?.nom ??
                        item?.data?.titre ??
                        item?.data?.service?.titre ??
                        'Contenu vidéo',
                    description:
                        item?.data?.description ??
                        item?.data?.service?.description ??
                        undefined,
                    videoUrl: video,
                    thumbnail:
                        item?.data?.thumbnails?.[0] ?? item?.data?.images?.[0] ?? undefined,
                    serviceId: serviceId ? Number(serviceId) : undefined,
                    contentId,
                    prestataire: item?.data?.prestataire,
                    isSponsored: item?.is_paid ?? false,
                    badge: item?.is_paid ? item?.boost_level ?? 'Sponsorisé' : undefined,
                    frequencyRatio: item?.frequency_ratio ?? item?.data?.frequency_ratio,
                    likesCount:
                        engagement?.likes ?? item?.data?.stats?.likes ?? item?.data?.likes_count ?? item?.likes ?? 0,
                    savesCount:
                        engagement?.saves ?? item?.data?.stats?.saves ?? item?.data?.saves_count ?? item?.saves ?? 0,
                    audioLabel: typeof audioMode === 'string' && audioMode.trim().length > 0
                        ? audioMode
                        : item?.is_paid
                            ? 'Audio sponsorisé'
                            : 'Audio IA Yukpo',
                    // ✅ Phase 9 - Amélioration 31 : Extraire sessionId pour chaînage vidéos
                    sessionId: item?.data?.studio_session_id ?? item?.data?.session_id ?? undefined,
                    // ✅ NOUVEAU: Extraire hashtags depuis données API
                    hashtags: Array.isArray(item?.data?.hashtags)
                        ? item.data.hashtags
                        : Array.isArray(item?.hashtags)
                            ? item.hashtags
                            : Array.isArray(item?.data?.ai_tags)
                                ? item.data.ai_tags
                                : Array.isArray(item?.tags)
                                    ? item.tags
                                    : undefined,
                } as FeedItem;
            })
            .filter(Boolean) as FeedItem[];
    }, []);

    const reorderFeed = useCallback((items: FeedItem[]): FeedItem[] => {
        if (items.length === 0) {
            return items;
        }

        const paid = items
            .filter((item) => item.isSponsored)
            .sort((a, b) => {
                const priority = (badge?: string) => {
                    const normalized = (badge || '').toLowerCase();
                    if (normalized.includes('ultra')) return 0;
                    if (normalized.includes('premium')) return 1;
                    return 2;
                };
                const prioDiff = priority(a.badge) - priority(b.badge);
                if (prioDiff !== 0) {
                    return prioDiff;
                }
                const ratioA = a.frequencyRatio ?? 0.3;
                const ratioB = b.frequencyRatio ?? 0.3;
                return ratioB - ratioA;
            });

        const organic = items.filter((item) => !item.isSponsored);
        if (paid.length === 0 || organic.length === 0) {
            return items;
        }

        const result: FeedItem[] = [];
        const paidQueue = paid.map((item) => {
            const ratio = Math.max(0.05, item.frequencyRatio ?? 0.3);
            const interval = Math.max(0, Math.round(1 / ratio) - 1);
            return { item, interval };
        });
        const organicQueue = [...organic];
        let organicSinceAd = Number.MAX_SAFE_INTEGER;
        let currentInterval = 0;

        while (paidQueue.length > 0 || organicQueue.length > 0) {
            if (
                paidQueue.length > 0 &&
                (organicSinceAd >= currentInterval || organicQueue.length === 0)
            ) {
                const nextPaid = paidQueue.shift()!;
                result.push(nextPaid.item);
                organicSinceAd = 0;
                currentInterval = nextPaid.interval;
            } else if (organicQueue.length > 0) {
                result.push(organicQueue.shift()!);
                organicSinceAd += 1;
            } else if (paidQueue.length > 0) {
                result.push(paidQueue.shift()!.item);
            }
        }

        return result;
    }, []);

    const logVisibility = useCallback(
        async (
            item: FeedItem,
            index: number,
            {
                viewed = true,
                clicked = false,
                viewDurationMs = 0,
            }: { viewed?: boolean; clicked?: boolean; viewDurationMs?: number }
        ) => {
            const contentId = item.contentId || (item.serviceId ? `service_${item.serviceId}` : item.id);
            try {
                await apiPost('/api/visibility/track', {
                    user_id: user?.id ?? 0,
                    session_id: sessionIdRef.current,
                    content_id: contentId,
                    content_type: item.isSponsored ? 'paid' : 'organic',
                    position_in_feed: index,
                    viewed,
                    clicked,
                    view_duration_ms: Math.max(0, Math.round(viewDurationMs)),
                });
            } catch (error) {
                console.warn('[VideoFeedScreen] logVisibility error', error);
            }
        },
        [user?.id]
    );

    // ✅ NOUVEAU: Tracker le temps de visionnage
    const trackWatchTime = useCallback(
        async (contentId: string, currentTimeSeconds: number, durationSeconds: number) => {
            // Envoyer toutes les 5 secondes
            const lastTracked = lastTrackTimeRef.current.get(contentId) || 0;
            const timeSinceLastTrack = currentTimeSeconds - lastTracked;

            if (timeSinceLastTrack >= 5 || currentTimeSeconds === 0) {
                try {
                    await apiPost(`/api/content/${encodeURIComponent(contentId)}/track-watch`, {
                        watch_duration_ms: Math.floor(currentTimeSeconds * 1000),
                        video_duration_ms: Math.floor(durationSeconds * 1000),
                        device_type: Platform.OS === 'ios' ? 'ios' : 'android',
                    });

                    // Mettre à jour le dernier temps tracké
                    lastTrackTimeRef.current.set(contentId, currentTimeSeconds);
                    videoDurationsRef.current.set(contentId, durationSeconds);
                } catch (error) {
                    console.warn('[VideoFeedScreen] Erreur tracking temps visionnage:', error);
                }
            }
        },
        [],
    );

    const flushCurrentView = useCallback(() => {
        const prevIndex = currentIndexRef.current;
        if (!feed[prevIndex] || currentStartTimeRef.current == null) {
            return;
        }
        const elapsed = Date.now() - currentStartTimeRef.current;
        const prevItem = feed[prevIndex];

        // ✅ NOUVEAU: Finaliser tracking temps de visionnage
        const lastTracked = lastTrackTimeRef.current.get(prevItem.contentId) || 0;
        const duration = videoDurationsRef.current.get(prevItem.contentId) || 0;
        if (lastTracked > 0 && duration > 0) {
            // Envoyer dernière mise à jour avec temps final
            trackWatchTime(prevItem.contentId, lastTracked, duration).catch(() => undefined);
        }

        logVisibility(prevItem, prevIndex, {
            viewed: true,
            viewDurationMs: elapsed,
        });
        currentStartTimeRef.current = null;
    }, [feed, logVisibility, trackWatchTime]);

    const loadFeed = useCallback(async () => {
        try {
            setLoading(true);

            // ✅ NOUVEAU: Charger les vidéos de l'utilisateur depuis le nouvel endpoint
            let myVideos: FeedItem[] = [];
            try {
                // ✅ OPTIMISÉ: Retry intelligent avec backoff exponentiel
                const myVideosResponse = await retryWithBackoff(
                    () => apiGet('/api/videos/my-videos'),
                    { maxRetries: 3, initialDelay: 1000 }
                );
                if (myVideosResponse.success && Array.isArray(myVideosResponse.data)) {
                    myVideos = myVideosResponse.data.map((video: any) => ({
                        id: `my-video-${video.id}`,
                        titre: video.description || video.product_name || 'Ma vidéo',
                        description: video.description || undefined,
                        videoUrl: video.video_url,
                        thumbnail: undefined,
                        serviceId: video.service_id,
                        contentId: `video_${video.id}`,
                        prestataire: undefined,
                        isSponsored: false,
                        badge: 'Ma vidéo',
                        likesCount: 0,
                        savesCount: 0,
                        audioLabel: 'Vidéo générée',
                    } as FeedItem));
                }
            } catch (error) {
                console.warn('[VideoFeedScreen] Erreur chargement mes vidéos:', error);
                // Continuer même si l'endpoint échoue
            }

            const categories = await userBehaviorService.getPreferredCategories(5);

            const params = new URLSearchParams();
            params.append('limit', '25');
            if (categories.length > 0) {
                params.append('categories', categories.join(','));
            }
            if (user?.id) {
                params.append('user_id', String(user.id));
            }

            // ✅ OPTIMISÉ: Retry intelligent pour chargement feed
            const response = await retryWithBackoff(
                () => apiGet(`/api/content/mixed?${params.toString()}`),
                { maxRetries: 3, initialDelay: 1000 }
            );

            let parsed: FeedItem[] = [];
            if (response.success && Array.isArray(response.data)) {
                parsed = processResponse(response.data);
            }

            // ✅ NOUVEAU: Combiner les vidéos de l'utilisateur avec le feed principal
            // Les vidéos de l'utilisateur sont ajoutées en premier
            const combinedFeed = [...myVideos, ...parsed];
            setForYouSource(combinedFeed);

            // ✅ OPTIMISÉ: Réordonner avec recommandations ML (comme TikTok)
            let ordered: FeedItem[];
            if (user?.id) {
                try {
                    const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
                    if (!isNaN(userId)) {
                        ordered = await videoRecommendationService.reorderFeedByRecommendations(
                            userId,
                            combinedFeed
                        );
                    } else {
                        ordered = reorderFeed(combinedFeed);
                    }
                } catch (error) {
                    console.warn('[VideoFeedScreen] Erreur recommandations ML, fallback basique:', error);
                    ordered = reorderFeed(combinedFeed);
                }
            } else {
                ordered = reorderFeed(combinedFeed);
            }

            setFeed(ordered);
            feedRef.current = ordered; // ✅ Phase 9 - Amélioration 31 : Mettre à jour la ref du feed
            if (isFollowingLane) {
                setActiveLane('foryou');
            }
        } catch (error) {
            console.error('[VideoFeedScreen] loadFeed error', error);
            setForYouSource([]);
            setFeed([]);
            feedRef.current = []; // ✅ Phase 9 - Amélioration 31 : Mettre à jour la ref du feed
        } finally {
            setLoading(false);
        }
    }, [isFollowingLane, processResponse, reorderFeed, user?.id]);

    const searchFeed = useCallback(async () => {
        if (!searchQuery.trim()) {
            return loadFeed();
        }

        try {
            setIsSearching(true);
            const response = await apiGet(
                `/api/services/search?q=${encodeURIComponent(searchQuery.trim())}&limit=25&include_videos=true`
            );

            if (response.success && Array.isArray(response.data)) {
                const mapped = response.data
                    .map((item: any) => {
                        const video =
                            item?.videos?.[0] ||
                            item?.media?.videos?.[0];
                        if (!video) {
                            return null;
                        }
                        const serviceId = item.service_id ?? item.id;
                        const contentId =
                            item.content_id ??
                            (serviceId ? `service_${serviceId}` : `search_${item.id ?? video}`);
                        return {
                            id: `search-${item.id ?? video}`,
                            titre: item.titre ?? item.nom ?? 'Vidéo recommandée',
                            description: item.description ?? undefined,
                            videoUrl: video,
                            thumbnail: item.thumbnails?.[0] ?? item.images?.[0],
                            serviceId: serviceId,
                            contentId,
                            prestataire: item.prestataire,
                            isSponsored: false,
                            badge: undefined,
                            likesCount: item.likes_count ?? 0,
                            savesCount: item.saves_count ?? 0,
                        } as FeedItem;
                    })
                    .filter(Boolean) as FeedItem[];

                const ordered = reorderFeed(mapped);
                setForYouSource(mapped);
                setFeed(ordered);
                feedRef.current = ordered; // ✅ Phase 9 - Amélioration 31 : Mettre à jour la ref du feed
                if (isFollowingLane) {
                    setActiveLane('foryou');
                }
            } else {
                setForYouSource([]);
                setFeed([]);
                feedRef.current = []; // ✅ Phase 9 - Amélioration 31 : Mettre à jour la ref du feed
            }
        } catch (error) {
            console.error('[VideoFeedScreen] searchFeed error', error);
            setForYouSource([]);
            setFeed([]);
            feedRef.current = []; // ✅ Phase 9 - Amélioration 31 : Mettre à jour la ref du feed
        } finally {
            setIsSearching(false);
        }
    }, [isFollowingLane, loadFeed, reorderFeed, searchQuery]);

    useEffect(() => {
        loadFeed().catch(() => undefined);
    }, [loadFeed]);

    useEffect(() => {
        if (feed.length === 0) {
            feedRef.current = []; // ✅ Phase 9 - Amélioration 31 : Mettre à jour la ref du feed
            return;
        }
        feedRef.current = feed; // ✅ Phase 9 - Amélioration 31 : Mettre à jour la ref du feed
        currentIndexRef.current = 0;
        setCurrentIndex(0);
        currentStartTimeRef.current = Date.now();
        logVisibility(feed[0], 0, { viewed: true, viewDurationMs: 0 });
    }, [feed, logVisibility]);

    useEffect(() => {
        return () => {
            flushCurrentView();
        };
    }, [flushCurrentView]);

    useEffect(() => {
        if (feed.length === 0) {
            setLikeCounts({});
            setSaveCounts({});
            return;
        }
        const likeSnapshot: Record<string, number> = {};
        const saveSnapshot: Record<string, number> = {};
        feed.forEach((item) => {
            likeSnapshot[item.contentId] = item.likesCount ?? 0;
            saveSnapshot[item.contentId] = item.savesCount ?? 0;
        });
        setLikeCounts(likeSnapshot);
        setSaveCounts(saveSnapshot);
    }, [feed]);

    useEffect(() => {
        if (forYouSource.length === 0) {
            setFollowingFeed([]);
            return;
        }
        const engaged = new Set<string>();
        Object.entries(likedMap).forEach(([cid, liked]) => {
            if (liked) engaged.add(cid);
        });
        Object.entries(savedMap).forEach(([cid, saved]) => {
            if (saved) engaged.add(cid);
        });
        const ordered = reorderFeed(forYouSource);
        const curated = ordered.filter((item) => {
            if (engaged.has(item.contentId)) return true;
            if (item.isSponsored) return false;
            const ratio = item.frequencyRatio ?? 0.0;
            return ratio >= 0.35;
        });
        const shortlist =
            curated.length > 0
                ? curated.slice(0, 30)
                : ordered.slice(0, Math.min(10, ordered.length));
        setFollowingFeed(shortlist);
    }, [forYouSource, likedMap, reorderFeed, savedMap]);

    useEffect(() => {
        if (activeLane === 'following') {
            setFeed(followingFeed);
            currentIndexRef.current = 0;
            setCurrentIndex(0);
            currentStartTimeRef.current = Date.now();
            setCurrentDurationMs(0);
        }
    }, [activeLane, followingFeed]);

    useEffect(() => {
        if (feed.length === 0) {
            return;
        }
        const contentIds = Array.from(
            new Set(
                feed
                    .map((item) => item.contentId)
                    .filter((id) => !!id)
            ),
        );
        if (contentIds.length === 0) {
            return;
        }
        let cancelled = false;
        const loadStatus = async () => {
            try {
                const response = await apiGet(
                    `/api/content/engagement?ids=${encodeURIComponent(contentIds.join(','))}`,
                );
                if (!response?.success || !Array.isArray(response?.data) || cancelled) {
                    return;
                }
                const likeMap: Record<string, number> = {};
                const saveMap: Record<string, number> = {};
                const likedState: Record<string, boolean> = {};
                const savedState: Record<string, boolean> = {};
                response.data.forEach((entry: any) => {
                    const cid = entry?.content_id;
                    if (!cid) return;
                    likeMap[cid] = entry?.likes ?? likeCounts[cid] ?? 0;
                    saveMap[cid] = entry?.saves ?? saveCounts[cid] ?? 0;
                    likedState[cid] = entry?.liked ?? likedMap[cid] ?? false;
                    savedState[cid] = entry?.saved ?? savedMap[cid] ?? false;
                });
                if (!cancelled) {
                    setLikeCounts((prev) => ({ ...prev, ...likeMap }));
                    setSaveCounts((prev) => ({ ...prev, ...saveMap }));
                    setLikedMap((prev) => ({ ...prev, ...likedState }));
                    setSavedMap((prev) => ({ ...prev, ...savedState }));
                }
            } catch (error) {
                console.warn('[VideoFeedScreen] engagement status error', error);
            }
        };
        loadStatus();
        return () => {
            cancelled = true;
        };
    }, [feed]);

    const handleViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length === 0) return;
            const firstVisible = viewableItems[0];
            if (firstVisible?.index == null) {
                return;
            }
            const nextIndex = firstVisible.index;
            if (nextIndex === currentIndexRef.current) {
                return;
            }

            flushCurrentView();
            currentIndexRef.current = nextIndex;
            currentStartTimeRef.current = Date.now();
            setCurrentIndex(nextIndex);
            setCurrentDurationMs(0);

            if (feed[nextIndex]) {
                logVisibility(feed[nextIndex], nextIndex, {
                    viewed: true,
                    viewDurationMs: 0,
                });
            }
        },
        [feed, flushCurrentView, logVisibility]
    );

    const onPressCTA = useCallback(
        (item: FeedItem) => {
            if (item.serviceId) {
                logVisibility(item, currentIndexRef.current, {
                    clicked: true,
                    viewed: true,
                    viewDurationMs:
                        currentStartTimeRef.current != null
                            ? Date.now() - currentStartTimeRef.current
                            : 0,
                });
                (navigation as any).navigate('ServiceDetail', {
                    serviceId: String(item.serviceId),
                    fromVideoFeed: true,
                });
            }
        },
        [logVisibility, navigation]
    );

    const handleLike = useCallback(
        async (item: FeedItem) => {
            if (!user?.id) {
                Alert.alert(
                    'Connexion requise',
                    'Connectez-vous pour aimer cette vidéo.',
                );
                return;
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const contentId = item.contentId;
            const next = !(likedMap[contentId] ?? false);
            setLikedMap((previous) => ({ ...previous, [contentId]: next }));
            setLikeCounts((counts) => ({
                ...counts,
                [contentId]: Math.max(0, (counts[contentId] ?? 0) + (next ? 1 : -1)),
            }));
            try {
                const response = await apiPost<ContentEngagementResponse>(
                    `/api/content/${encodeURIComponent(contentId)}/engagement`,
                    {
                        action: 'like',
                        set: next,
                    },
                );
                const payload: ContentEngagementResponse | undefined =
                    (response.data as ContentEngagementResponse | undefined) ||
                    (response as unknown as ContentEngagementResponse);
                if (response?.success && payload) {
                    setLikeCounts((counts) => ({
                        ...counts,
                        [contentId]: payload.likes ?? counts[contentId] ?? 0,
                    }));
                    if (typeof payload.liked === 'boolean') {
                        setLikedMap((prev) => ({ ...prev, [contentId]: payload.liked! }));
                    }
                }
                await userBehaviorService.trackSearch(item.titre ?? 'video_like', 'video_like');
            } catch (error) {
                console.warn('[VideoFeedScreen] like error', error);
                setLikedMap((prev) => ({ ...prev, [contentId]: !next }));
                setLikeCounts((counts) => ({
                    ...counts,
                    [contentId]: Math.max(0, (counts[contentId] ?? 0) + (next ? -1 : 1)),
                }));
            }
            logVisibility(item, currentIndexRef.current, {
                clicked: true,
                viewDurationMs:
                    currentStartTimeRef.current != null
                        ? Date.now() - currentStartTimeRef.current
                        : 0,
            });
        },
        [likedMap, logVisibility, user?.id]
    );

    const handleSave = useCallback(
        async (item: FeedItem) => {
            if (!user?.id) {
                Alert.alert(
                    'Connexion requise',
                    'Connectez-vous pour sauvegarder cette vidéo.',
                );
                return;
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const contentId = item.contentId;

            // ✅ OPTIMISÉ: Tracker interaction pour recommandations ML
            if (user?.id) {
                videoRecommendationService.trackInteraction(contentId, 'save').catch(() => {
                    // Ignorer erreurs silencieusement
                });
            }
            const next = !(savedMap[contentId] ?? false);
            setSavedMap((previous) => ({ ...previous, [contentId]: next }));
            setSaveCounts((counts) => ({
                ...counts,
                [contentId]: Math.max(0, (counts[contentId] ?? 0) + (next ? 1 : -1)),
            }));
            try {
                const response = await apiPost<ContentEngagementResponse>(
                    `/api/content/${encodeURIComponent(contentId)}/engagement`,
                    {
                        action: 'save',
                        set: next,
                    },
                );
                const payload: ContentEngagementResponse | undefined =
                    (response.data as ContentEngagementResponse | undefined) ||
                    (response as unknown as ContentEngagementResponse);
                if (response?.success && payload) {
                    setSaveCounts((counts) => ({
                        ...counts,
                        [contentId]: payload.saves ?? counts[contentId] ?? 0,
                    }));
                    if (typeof payload.saved === 'boolean') {
                        setSavedMap((prev) => ({ ...prev, [contentId]: payload.saved! }));
                    }
                }
                await userBehaviorService.trackSearch(item.titre ?? 'video_save', 'video_save');
            } catch (error) {
                console.warn('[VideoFeedScreen] save error', error);
                setSavedMap((prev) => ({ ...prev, [contentId]: !next }));
                setSaveCounts((counts) => ({
                    ...counts,
                    [contentId]: Math.max(0, (counts[contentId] ?? 0) + (next ? -1 : 1)),
                }));
            }
        },
        [savedMap, user?.id]
    );

    const handleShare = useCallback(async (item: FeedItem) => {
        try {
            await Share.share({
                message: `Découvre cette offre sur Yukpo: ${item.titre}`,
            });
            await userBehaviorService.trackSearch(item.titre ?? 'video_share', 'video_share');
        } catch (error) {
            console.warn('[VideoFeedScreen] share error', error);
        }
    }, []);

    const handleSkip = useCallback(() => {
        const nextIndex = Math.min(feed.length - 1, currentIndexRef.current + 1);
        if (nextIndex !== currentIndexRef.current) {
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        }
    }, [feed.length]);

    // ✅ NOUVEAU: Handler pour livraison depuis vidéo
    const handleDelivery = useCallback(async (item: FeedItem) => {
        if (!item.serviceId) {
            Alert.alert('Erreur', 'Service non disponible pour cette vidéo');
            return;
        }

        try {
            // Charger les données du service
            const response = await apiGet(`/api/services/${item.serviceId}`);
            const service = response?.data || response;

            if (!service) {
                Alert.alert('Erreur', 'Impossible de charger les informations du service');
                return;
            }

            // Extraire le premier produit disponible
            const serviceData = service as any;
            const produits = serviceData?.produits?.valeur || serviceData?.produits || [];
            let productIndex: number | undefined = undefined;
            let productName: string | undefined = item.titre;

            if (Array.isArray(produits) && produits.length > 0) {
                const firstProduct = produits.find((p: any) => {
                    const nom = p?.nom || p?.name || p?.titre || p?.title;
                    return nom && typeof nom === 'string' && nom.trim().length > 0;
                }) || produits[0];

                productIndex = produits.indexOf(firstProduct);
                productName = firstProduct?.nom || firstProduct?.name || firstProduct?.titre || firstProduct?.title || item.titre;
            }

            setServiceDataForDelivery(service);
            setDeliveryProductIndex(productIndex);
            setDeliveryProductName(productName);
            setDeliveryTarget(item);
            triggerHaptic('light');
        } catch (error) {
            console.error('[VideoFeedScreen] Erreur chargement service pour livraison:', error);
            Alert.alert('Erreur', 'Impossible de charger les informations. Veuillez réessayer.');
        }
    }, []);

    // ✅ NOUVEAU: Handler pour chat depuis vidéo
    const handleChat = useCallback(async (item: FeedItem) => {
        if (!item.serviceId) {
            Alert.alert('Erreur', 'Service non disponible pour cette vidéo');
            return;
        }

        try {
            // Charger les données du service pour le chat
            const response = await apiGet(`/api/services/${item.serviceId}`);
            const service = response?.data || response;

            if (!service) {
                Alert.alert('Erreur', 'Impossible de charger les informations du service');
                return;
            }

            setServiceDataForChat(service);
            setChatTarget(item);
            triggerHaptic('light');
        } catch (error) {
            console.error('[VideoFeedScreen] Erreur chargement service pour chat:', error);
            Alert.alert('Erreur', 'Impossible de charger les informations. Veuillez réessayer.');
        }
    }, []);

    // ✅ NOUVEAU: Handlers pour navigation par gestes
    const handleSwipeUp = useCallback(() => {
        if (currentIndex < feed.length - 1) {
            const nextIndex = currentIndex + 1;
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setCurrentIndex(nextIndex);
            triggerHaptic('light');
        }
    }, [currentIndex, feed.length]);

    const handleSwipeDown = useCallback(() => {
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
            setCurrentIndex(prevIndex);
            triggerHaptic('light');
        }
    }, [currentIndex]);

    const handleDoubleTapLike = useCallback(() => {
        const currentItem = feed[currentIndex];
        if (currentItem) {
            setShowDoubleTapLike(true);
            handleLike(currentItem);
            triggerHaptic('medium');
        }
    }, [currentIndex, feed, handleLike]);

    const handleSwipeLeft = useCallback(() => {
        const currentItem = feed[currentIndex];
        if (currentItem) {
            handleLike(currentItem);
            triggerHaptic('light');
        }
    }, [currentIndex, feed, handleLike]);

    const handleSwipeRight = useCallback(() => {
        const currentItem = feed[currentIndex];
        if (currentItem) {
            handleSave(currentItem);
            triggerHaptic('light');
        }
    }, [currentIndex, feed, handleSave]);

    // ✅ NOUVEAU: Préchargement intelligent
    useEffect(() => {
        if (feed.length > 0 && currentIndex >= 0) {
            // ✅ OPTIMISÉ: Préchargement agressif dès que vidéo actuelle visible à 50% (comme TikTok)
            // Au lieu d'attendre 70% du feed, on précharge dès que la vidéo actuelle est visible
            if (currentIndex >= 0 && feed.length > currentIndex + 1) {
                videoPreloadService.preloadNextVideos(
                    feed.map(item => ({ id: item.id, videoUrl: item.videoUrl, thumbnail: item.thumbnail })),
                    currentIndex
                ).catch(() => {
                    // Ignorer erreurs silencieusement
                });

                // ✅ OPTIMISÉ: Précharger aussi les thumbnails pour feedback visuel
                const nextVideos = feed.slice(currentIndex + 1, currentIndex + 6);
                nextVideos.forEach(video => {
                    if (video.thumbnail) {
                        Image.prefetch(video.thumbnail).catch(() => {
                            // Ignorer erreurs silencieusement
                        });
                    }
                });
            }
        }
    }, [feed, currentIndex]);

    const togglePause = useCallback(() => {
        const currentItem = feed[currentIndexRef.current];
        if (!currentItem) {
            return;
        }
        setIsPaused((previous) => {
            const next = !previous;
            if (next) {
                flushCurrentView();
                logVisibility(currentItem, currentIndexRef.current, {
                    viewed: true,
                    clicked: false,
                    viewDurationMs: 0,
                });
            } else {
                currentStartTimeRef.current = Date.now();
                logVisibility(currentItem, currentIndexRef.current, {
                    viewed: true,
                    clicked: true,
                    viewDurationMs: 0,
                });
            }
            return next;
        });
    }, [feed, flushCurrentView, logVisibility]);

    const handleLaneChange = useCallback(
        (lane: 'foryou' | 'following') => {
            if (lane === activeLane) {
                return;
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            flushCurrentView();
            if (lane === 'foryou') {
                const nextFeed = reorderFeed(forYouSource);
                setFeed(nextFeed);
            } else {
                setFeed(followingFeed);
            }
            setActiveLane(lane);
            currentIndexRef.current = 0;
            setCurrentIndex(0);
            currentStartTimeRef.current = Date.now();
            setCurrentDurationMs(0);
        },
        [activeLane, flushCurrentView, followingFeed, forYouSource, reorderFeed],
    );

    const ensureCreatorInventory = useCallback(async (): Promise<ManagedProduct[] | null> => {
        if (creationInventoryLoadedRef.current && creationProducts.length > 0) {
            return creationProducts;
        }
        setCreationLoading(true);
        try {
            const response = await apiGet('/api/prestataire/services');
            if (response.success && response.data) {
                const payload = response.data as any;
                const servicesData = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.services)
                        ? payload.services
                        : [];
                const mapped = extractManagedProductsFromServices(servicesData);
                setCreationProducts(mapped);
                creationInventoryLoadedRef.current = true;
                return mapped;
            }
            Alert.alert(
                'Création vidéo',
                'Impossible de charger vos produits pour la création de vidéos.'
            );
            return null;
        } catch (error) {
            console.error('[VideoFeedScreen] creator inventory error', error);
            Alert.alert(
                'Création vidéo',
                'Une erreur est survenue lors du chargement de vos produits.'
            );
            return null;
        } finally {
            setCreationLoading(false);
        }
    }, [creationProducts]);

    const handleOpenCreation = useCallback(
        async (source?: FeedItem) => {
            const inventory = await ensureCreatorInventory();
            if (!inventory || inventory.length === 0) {
                return;
            }
            if (source?.serviceId) {
                const match = inventory.find(
                    (product) => product.serviceId === String(source.serviceId),
                );
                setCreationPrimaryProduct(match ?? null);
            } else {
                setCreationPrimaryProduct(null);
            }
            setCreationModalVisible(true);
        },
        [ensureCreatorInventory],
    );

    const logLiveInteraction = useCallback(
        async (session: LiveSession, action: 'view' | 'join' | 'reminder') => {
            try {
                await apiPost('/api/visibility/track', {
                    user_id: user?.id ?? 0,
                    session_id: sessionIdRef.current,
                    content_id: `live_${session.id}`,
                    content_type: 'live_upcoming',
                    position_in_feed: 0,
                    viewed: action === 'view',
                    clicked: action !== 'view',
                    metadata: {
                        action,
                        start_at: session.startAt,
                    },
                });
            } catch (error) {
                console.warn('[VideoFeedScreen] logLiveInteraction error', error);
            }
        },
        [user?.id],
    );

    const fetchLiveSessions = useCallback(
        async (silent = false) => {
            if (!silent) {
                setLiveLoading(true);
            }
            try {
                const response = await liveStreamingService.getUpcomingLives(5);
                const payload = response.success ? response.data : null;
                const records = Array.isArray(payload?.data) ? payload?.data : [];

                let sessions: LiveSession[] = records
                    .map((item: any) => {
                        const metadata = item?.metadata ?? {};
                        const safeStartAt =
                            item?.start_at ??
                            metadata?.scheduled_start ??
                            new Date(Date.now() + 30 * 60000).toISOString();
                        return {
                            id: String(item?.id ?? Math.random().toString(36).slice(2)),
                            title: item?.title ?? metadata?.title ?? 'Live produit',
                            startAt: new Date(safeStartAt).toISOString(),
                            serviceId: item?.service_id ?? metadata?.service_id ?? metadata?.serviceId,
                            description: item?.description ?? metadata?.description ?? '',
                            audience: Number(item?.current_viewers ?? metadata?.audience ?? 0),
                            thumbnail: metadata?.thumbnail ?? metadata?.cover ?? undefined,
                            tags: Array.isArray(metadata?.tags) ? metadata.tags : [],
                            hostName:
                                metadata?.host_name ??
                                item?.livekit_participant_identity ??
                                undefined,
                            // ✅ NOUVEAU: Récupérer les flash sales si disponibles
                            flashSales: item?.flash_sales
                                ? item.flash_sales.map((fs: any) => ({ id: String(fs.id), status: fs.status }))
                                : undefined,
                        } as LiveSession;
                    })
                    .filter((session: LiveSession) => !!session.title);

                if (sessions.length === 0) {
                    sessions = buildFallbackLiveSessions();
                }

                const preferredLives = await userBehaviorService.getPreferredLives(10);
                sessions.sort((a, b) => {
                    const idxA = preferredLives.indexOf(a.id);
                    const idxB = preferredLives.indexOf(b.id);
                    if (idxA !== -1 || idxB !== -1) {
                        if (idxA === -1) return 1;
                        if (idxB === -1) return -1;
                        return idxA - idxB;
                    }
                    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
                });

                setLiveSessions(sessions);
            } catch (error) {
                console.warn('[VideoFeedScreen] live session fetch error', error);
                setLiveSessions(buildFallbackLiveSessions());
            } finally {
                if (!silent) {
                    setLiveLoading(false);
                }
            }
        },
        [],
    );

    const handleLiveCardPress = useCallback(
        (session: LiveSession) => {
            // ✅ NOUVEAU: Si la session a des flash sales, naviguer directement vers l'écran Flash Sale
            if (session.flashSales && session.flashSales.length > 0) {
                navigation.navigate('FlashSale' as never, { sessionId: session.id } as never);
            } else {
                setLiveModalSession(session);
            }
            logLiveInteraction(session, 'view').catch(() => undefined);
        },
        [logLiveInteraction, navigation],
    );

    const handleLiveReminder = useCallback(
        async (session: LiveSession) => {
            const alreadySet = !!liveReminderMap[session.id];
            setLiveReminderMap((prev) => {
                const updated = { ...prev };
                if (alreadySet) {
                    delete updated[session.id];
                } else {
                    updated[session.id] = true;
                }
                return updated;
            });
            if (!alreadySet) {
                await userBehaviorService.trackLiveInterest(session.id, 'reminder');
                logLiveInteraction(session, 'reminder').catch(() => undefined);
                Alert.alert('Rappel ajouté', 'Vous serez notifié avant le début du live.');
            } else {
                Alert.alert('Rappel annulé', 'Vous ne recevrez plus de notification pour ce live.');
            }
        },
        [liveReminderMap, logLiveInteraction],
    );

    const handleJoinLive = useCallback(
        async (session: LiveSession) => {
            await userBehaviorService.trackLiveInterest(session.id, 'join');
            logLiveInteraction(session, 'join').catch(() => undefined);
            Alert.alert(
                'Live prochainement',
                "Nous vous redirigerons vers la salle dès l'ouverture du live."
            );
        },
        [logLiveInteraction],
    );

    const handleStartLive = useCallback(() => {
        Alert.alert(
            'Lancement Live',
            'Nous préparons la salle de diffusion. Configurez votre produit phare pendant quelques instants.'
        );
    }, []);

    useEffect(() => {
        fetchLiveSessions().catch(() => undefined);
        const interval = setInterval(() => {
            fetchLiveSessions(true).catch(() => undefined);
        }, 120000);
        return () => clearInterval(interval);
    }, [fetchLiveSessions]);

    const handleCreatorPress = useCallback((item: FeedItem) => {
        setCreatorPanelItem(item);
    }, []);

    const handleReport = useCallback((item: FeedItem) => {
        Alert.alert(
            'Signaler cette vidéo',
            "Nous examinerons rapidement ce contenu pour protéger la communauté Yukpo.",
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Signaler',
                    style: 'destructive',
                    onPress: () => {
                        console.log('[VideoFeedScreen] report video', item.contentId);
                        Alert.alert(
                            'Merci',
                            'Votre signalement a bien été pris en compte.'
                        );
                    },
                },
            ],
            { cancelable: true },
        );
    }, []);

    const handleLongPress = useCallback(
        (item: FeedItem) => {
            if (Platform.OS === 'ios') {
                ActionSheetIOS.showActionSheetWithOptions(
                    {
                        title: 'Actions vidéo',
                        message: item.titre,
                        options: ['Annuler', 'Voir le prestataire', 'Partager', 'Signaler'],
                        destructiveButtonIndex: 3,
                        cancelButtonIndex: 0,
                    },
                    (buttonIndex) => {
                        if (buttonIndex === 1) {
                            handleCreatorPress(item);
                        } else if (buttonIndex === 2) {
                            handleShare(item);
                        } else if (buttonIndex === 3) {
                            handleReport(item);
                        }
                    },
                );
            } else {
                Alert.alert(
                    'Actions vidéo',
                    'Que souhaitez-vous faire ?',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Voir le prestataire',
                            onPress: () => handleCreatorPress(item),
                        },
                        {
                            text: 'Partager',
                            onPress: () => handleShare(item),
                        },
                        {
                            text: 'Signaler',
                            style: 'destructive',
                            onPress: () => handleReport(item),
                        },
                    ],
                    { cancelable: true },
                );
            }
        },
        [handleCreatorPress, handleReport, handleShare],
    );

    const handleCreationSuccess = useCallback(() => {
        setCreationModalVisible(false);
        setCreationPrimaryProduct(null);
        loadFeed().catch(() => undefined);
        Alert.alert(
            'Vidéo en cours',
            'Votre vidéo est en préparation. Vous recevrez une notification dès qu’elle sera prête.'
        );
    }, [loadFeed]);

    // ✅ OPTIMISÉ: Style animé pour transition fade
    const animatedFadeStyle = useAnimatedStyle(() => {
        return {
            opacity: fadeAnim.value,
        };
    });

    const renderItem = useCallback(
        ({ item, index }: { item: FeedItem; index: number }) => {
            const hasThumbnail = !!item.thumbnail;
            const isActive = index === currentIndex;
            const distance = Math.abs(index - currentIndex);

            // ✅ OPTIMISÉ: Nettoyage mémoire proactif - Démonter les vidéos à plus de 2 positions (comme TikTok)
            if (distance > 2) {
                // Retourner un placeholder avec thumbnail pour feedback visuel
                return (
                    <View style={[styles.slide, { height: SCREEN_HEIGHT }]}>
                        {hasThumbnail && (
                            <Image
                                source={{ uri: item.thumbnail }}
                                style={StyleSheet.absoluteFill}
                                resizeMode="cover"
                            />
                        )}
                        <View style={styles.placeholderOverlay}>
                            <ActivityIndicator size="small" color="#FFF" />
                        </View>
                    </View>
                );
            }

            const overlay = (
                <>
                    <VideoWithEffects
                        ref={(ref: Video | null) => registerRef(index, ref)}
                        originalUri={item.videoUrl}
                        contentId={item.contentId}
                        isActive={isActive}
                        style={styles.video}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={isActive && !isPaused}
                        isLooping={!item.sessionId} // ✅ Phase 9 - Amélioration 31 : Ne pas boucler si sessionId existe (pour navigation automatique)
                        useNativeControls={false}
                        isMuted={false}
                        onPlaybackStatusUpdate={async (status) => {
                            // ✅ NOUVEAU: Tracker temps de visionnage
                            if (status.isLoaded && isActive && !isPaused) {
                                const currentTimeSeconds = status.positionMillis
                                    ? status.positionMillis / 1000
                                    : 0;
                                const durationSeconds = status.durationMillis
                                    ? status.durationMillis / 1000
                                    : 0;

                                if (durationSeconds > 0) {
                                    trackWatchTime(item.contentId, currentTimeSeconds, durationSeconds).catch(
                                        () => undefined,
                                    );

                                    // ✅ OPTIMISÉ: Tracker visionnage pour recommandations ML
                                    if (user?.id && currentTimeSeconds >= 5) {
                                        videoRecommendationService.trackInteraction(
                                            item.contentId,
                                            'view',
                                            currentTimeSeconds
                                        ).catch(() => {
                                            // Ignorer erreurs silencieusement
                                        });
                                    }
                                }
                            }

                            // ✅ Phase 9 - Amélioration 31 : Navigation automatique vers vidéo suivante
                            if (
                                status.isLoaded &&
                                status.didJustFinish &&
                                !status.isLooping &&
                                item.sessionId &&
                                !isNavigatingRef.current
                            ) {
                                isNavigatingRef.current = true;
                                try {
                                    // Vérifier si on a déjà la vidéo suivante en cache
                                    let nextSessionId = nextVideoNavigationRef.current.get(item.sessionId);

                                    if (!nextSessionId) {
                                        // Récupérer la vidéo suivante depuis l'API
                                        const nextVideo = await studioService.getNextVideo(item.sessionId);
                                        if (nextVideo.next_session_id) {
                                            nextSessionId = nextVideo.next_session_id;
                                            nextVideoNavigationRef.current.set(item.sessionId, nextSessionId);
                                        }
                                    }

                                    if (nextSessionId) {
                                        // Chercher la vidéo suivante dans le feed
                                        const currentFeed = feedRef.current; // ✅ Phase 9 - Amélioration 31 : Utiliser la ref du feed
                                        const currentIdx = currentIndexRef.current; // Utiliser la ref pour éviter les problèmes de closure
                                        const nextIndex = currentFeed.findIndex((f) => f.sessionId === nextSessionId);
                                        if (nextIndex !== -1 && nextIndex !== currentIdx) {
                                            // Naviguer vers la vidéo suivante
                                            flatListRef.current?.scrollToIndex({
                                                index: nextIndex,
                                                animated: true,
                                            });
                                            currentIndexRef.current = nextIndex;
                                            setCurrentIndex(nextIndex);
                                        } else {
                                            // Si la vidéo suivante n'est pas dans le feed, la charger
                                            // TODO: Implémenter le chargement de la vidéo suivante depuis l'API
                                            console.log('[VideoFeedScreen] Vidéo suivante non trouvée dans le feed:', nextSessionId);
                                        }
                                    }
                                } catch (error) {
                                    console.error('[VideoFeedScreen] Erreur navigation vidéo suivante:', error);
                                } finally {
                                    // Réinitialiser après un court délai pour permettre la navigation
                                    setTimeout(() => {
                                        isNavigatingRef.current = false;
                                    }, 1000);
                                }
                            }
                        }}
                    />

                    <LinearGradientOverlay />

                    <View style={styles.overlayContent}>
                        <View style={styles.headerRow}>
                            {item.isSponsored ? (
                                <View style={styles.sponsoredTag}>
                                    <SafeIcon name="star" size={12} color="#FFF" />
                                    <Text style={styles.sponsoredText}>
                                        {item.badge?.toUpperCase() ?? 'SPONSORISÉ'}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.recommendedTag}>
                                    <SafeIcon name="sparkles" size={12} color="#FFF" />
                                    <Text style={styles.recommendedText}>Pour vous</Text>
                                </View>
                            )}
                            <View style={styles.liveStatsContainer}>
                                <SafeIcon name="activity" size={12} color="#22D3EE" />
                                <Text style={styles.liveStatsText}>
                                    {isActive ? `${(currentDurationMs / 1000).toFixed(1)}s` : '0.0s'}
                                </Text>
                                <Text style={styles.liveStatsSub}>
                                    {formatCount(likeCounts[item.contentId] ?? 0)} interactions
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.pauseButton}
                            onPress={togglePause}
                            activeOpacity={0.85}
                        >
                            <SafeIcon name={isPaused ? 'play' : 'pause'} size={14} color="#0F172A" />
                            <Text style={styles.pauseButtonText}>
                                {isPaused ? 'Reprendre' : 'Pause'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.title} numberOfLines={2}>
                                {item.titre}
                            </Text>
                            {!!item.description && (
                                <Text style={styles.description} numberOfLines={3}>
                                    {item.description}
                                </Text>
                            )}

                            {/* ✅ NOUVEAU: Hashtags cliquables */}
                            {item.hashtags && item.hashtags.length > 0 && (
                                <HashtagsList
                                    hashtags={item.hashtags}
                                    maxVisible={5}
                                    showTrending={false}
                                />
                            )}

                            <View style={styles.audioBadge}>
                                <SafeIcon name="music" size={12} color="#0F172A" />
                                <Text style={styles.audioBadgeText}>
                                    {item.audioLabel || 'Audio IA Yukpo'}
                                </Text>
                            </View>

                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={() => onPressCTA(item)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.primaryButtonText}>Voir l’offre</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => onPressCTA(item)}
                                    activeOpacity={0.85}
                                >
                                    <SafeIcon name="message-circle" size={16} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.sideActions}>
                            <TouchableOpacity
                                style={styles.sideActionButton}
                                onPress={() => handleLike(item)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="heart" size={20} color={likedMap[item.contentId] ? '#F87171' : '#FFF'} />
                                <Text style={styles.sideActionCount}>
                                    {formatCount(likeCounts[item.contentId] ?? 0)}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sideActionButton}
                                onPress={() => handleSave(item)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon
                                    name="bookmark"
                                    size={20}
                                    color={savedMap[item.contentId] ? '#34D399' : '#FFF'}
                                />
                                <Text style={styles.sideActionCount}>
                                    {formatCount(saveCounts[item.contentId] ?? 0)}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sideActionButton}
                                onPress={() => {
                                    if (!item.serviceId) {
                                        Alert.alert(
                                            'Service indisponible',
                                            'Impossible d’ouvrir les commentaires pour ce contenu.',
                                        );
                                        return;
                                    }
                                    setCommentTarget(item);
                                }}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="message-circle" size={20} color="#FFF" />
                                <Text style={styles.sideActionCount}>Commenter</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sideActionButton}
                                onPress={() => handleShare(item)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="share" size={20} color="#FFF" />
                                <Text style={styles.sideActionCount}>Partage</Text>
                            </TouchableOpacity>
                            {/* ✅ NOUVEAU: Bouton Duet/Remix */}
                            <TouchableOpacity
                                style={styles.sideActionButton}
                                onPress={() => setDuetTarget(item)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="users" size={20} color="#FFF" />
                                <Text style={styles.sideActionCount}>Duet</Text>
                            </TouchableOpacity>
                            {/* ✅ NOUVEAU: Bouton Livrer depuis vidéo */}
                            {item.serviceId && (
                                <TouchableOpacity
                                    style={styles.sideActionButton}
                                    onPress={() => handleDelivery(item)}
                                    activeOpacity={0.8}
                                >
                                    <SafeIcon name="truck" size={20} color="#FFF" />
                                    <Text style={styles.sideActionCount}>Livrer</Text>
                                </TouchableOpacity>
                            )}
                            {/* ✅ NOUVEAU: Bouton Chat depuis vidéo */}
                            {item.serviceId && item.prestataire && (
                                <TouchableOpacity
                                    style={styles.sideActionButton}
                                    onPress={() => handleChat(item)}
                                    activeOpacity={0.8}
                                >
                                    <SafeIcon name="message-circle" size={20} color="#FFF" />
                                    <Text style={styles.sideActionCount}>Chat</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.sideActionButton}
                                onPress={() => handleCreatorPress(item)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="user-circle" size={20} color="#FFF" />
                                <Text style={styles.sideActionCount}>Prestataire</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sideActionButton}
                                onPress={handleSkip}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="chevron-down" size={20} color="#FFF" />
                                <Text style={styles.sideActionCount}>Passer</Text>
                            </TouchableOpacity>
                            {/* ✅ NOUVEAU: Bouton "Créer vidéo similaire" */}
                            {item.serviceId && (
                                <TouchableOpacity
                                    style={styles.sideActionButton}
                                    onPress={() => {
                                        // Naviguer vers création vidéo avec produit pré-sélectionné
                                        navigation.navigate('VideoCreationIntro', {
                                            serviceId: item.serviceId,
                                        });
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <SafeIcon name="video" size={20} color="#FFF" />
                                    <Text style={styles.sideActionCount}>Créer</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </>
            );

            return (
                <AccessibilityWrapper
                    accessible={isScreenReaderEnabled}
                    accessibilityLabel={`Vidéo ${item.titre}. ${item.description || ''}`}
                    accessibilityHint="Double-tapez pour aimer, balayez vers le haut pour la vidéo suivante"
                    accessibilityRole="none"
                >
                    <VideoGestureHandler
                        onSwipeUp={handleSwipeUp}
                        onSwipeDown={handleSwipeDown}
                        onSwipeLeft={() => handleLike(item)}
                        onSwipeRight={() => handleSave(item)}
                        onDoubleTap={handleDoubleTapLike}
                        enabled={isActive}
                    >
                        <Pressable
                            style={{ flex: 1 }}
                            onLongPress={() => handleLongPress(item)}
                            delayLongPress={350}
                            accessible={isScreenReaderEnabled}
                            accessibilityLabel={`Actions pour ${item.titre}`}
                            accessibilityRole="button"
                        >
                            <AnimatedReanimated.View
                                style={[
                                    styles.slide,
                                    {
                                        height: isTablet ? SCREEN_HEIGHT / 2 : SCREEN_HEIGHT,
                                        width: isTablet ? (SCREEN_WIDTH / 2) - 16 : SCREEN_WIDTH,
                                        opacity: isActive ? 1 : 0.55,
                                    },
                                    isActive ? animatedFadeStyle : undefined,
                                ]}
                            >
                                {hasThumbnail ? (
                                    <ImageBackground
                                        source={{ uri: item.thumbnail! }}
                                        style={styles.videoBackground}
                                    >
                                        {overlay}
                                    </ImageBackground>
                                ) : (
                                    <View style={[styles.videoBackground, styles.videoBackgroundFallback]}>
                                        {overlay}
                                    </View>
                                )}

                                {/* ✅ OPTIMISÉ: DoubleTapLike avec animation cœur (comme TikTok) */}
                                <DoubleTapLike
                                    visible={showDoubleTapLike && isActive}
                                    onAnimationComplete={() => setShowDoubleTapLike(false)}
                                />
                            </AnimatedReanimated.View>
                        </Pressable>
                    </VideoGestureHandler>
                </AccessibilityWrapper>
            );
        },
        [
            currentIndex,
            currentDurationMs,
            handleLike,
            handleSave,
            handleShare,
            handleSkip,
            handleLongPress,
            likedMap,
            likeCounts,
            onPressCTA,
            registerRef,
            savedMap,
            isPaused,
            togglePause,
        ],
    );

    const keyExtractor = useCallback((item: FeedItem) => item.id, []);

    // ✅ OPTIMISÉ: getItemLayout pour scroll ultra-fluide (comme TikTok)
    const getItemLayout = useCallback(
        (_: any, index: number) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
        }),
        []
    );

    const emptyContent = useMemo(
        () => (
            <View style={styles.emptyState}>
                <SafeIcon name="video-off" size={48} color={modernColors.textSecondary} />
                <Text style={styles.emptyTitle}>Aucune vidéo à afficher</Text>
                <Text style={styles.emptySubtitle}>
                    Continuez d’utiliser l’application pour générer des recommandations personnalisées.
                </Text>
            </View>
        ),
        [],
    );

    return (
        <SafeNativeView style={styles.container} edges={['top', 'bottom']}>
            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loaderText}>Chargement du flux vidéo…</Text>
                </View>
            ) : feed.length === 0 ? (
                emptyContent
            ) : (
                <>
                    <View style={styles.tabsContainer}>
                        {[
                            { key: 'foryou', label: 'Pour vous' },
                            { key: 'following', label: 'Mes prestataires' },
                        ].map((tab) => {
                            const isActive = activeLane === tab.key;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[
                                        styles.tabButton,
                                        isActive ? styles.tabButtonActive : undefined,
                                    ]}
                                    activeOpacity={0.85}
                                    onPress={() => handleLaneChange(tab.key as 'foryou' | 'following')}
                                >
                                    <Text
                                        style={[
                                            styles.tabLabel,
                                            isActive ? styles.tabLabelActive : undefined,
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {liveSessions.length > 0 && (
                        <View style={styles.liveSection}>
                            <View style={styles.liveHeader}>
                                <View style={styles.liveTitleBadge}>
                                    <SafeIcon name="radio" size={14} color="#F8FAFC" />
                                    <Text style={styles.liveTitleText}>Lives produits</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.liveRefreshButton}
                                    activeOpacity={0.8}
                                    onPress={() => fetchLiveSessions(true)}
                                >
                                    {liveLoading ? (
                                        <ActivityIndicator size="small" color="#F8FAFC" />
                                    ) : (
                                        <SafeIcon name="refresh-cw" size={16} color="#F8FAFC" />
                                    )}
                                </TouchableOpacity>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.liveScrollContent}
                            >
                                {liveSessions.map((session) => {
                                    const relative = formatLiveStartRelative(session.startAt);
                                    const clock = formatLiveStartClock(session.startAt);
                                    const reminded = !!liveReminderMap[session.id];
                                    return (
                                        <TouchableOpacity
                                            key={session.id}
                                            style={styles.liveCard}
                                            activeOpacity={0.9}
                                            onPress={() => handleLiveCardPress(session)}
                                        >
                                            <View style={styles.liveCardHeader}>
                                                <View style={styles.liveBadge}>
                                                    <Text style={styles.liveBadgeLabel}>LIVE</Text>
                                                </View>
                                                <View style={styles.liveAudience}>
                                                    <SafeIcon name="users" size={12} color="#1F2937" />
                                                    <Text style={styles.liveAudienceText}>
                                                        {formatCount(session.audience ?? 0)}
                                                    </Text>
                                                </View>
                                            </View>
                                            {session.thumbnail ? (
                                                <ImageBackground
                                                    source={{ uri: session.thumbnail }}
                                                    style={styles.liveThumbnail}
                                                    imageStyle={styles.liveThumbnailImage}
                                                >
                                                    <View style={styles.liveThumbnailOverlay} />
                                                </ImageBackground>
                                            ) : null}
                                            <Text style={styles.liveCardTitle} numberOfLines={2}>
                                                {session.title}
                                            </Text>
                                            {!!session.hostName && (
                                                <Text style={styles.liveCardHost} numberOfLines={1}>
                                                    avec {session.hostName}
                                                </Text>
                                            )}
                                            {session.tags && session.tags.length > 0 && (
                                                <View style={styles.liveTagsRow}>
                                                    {session.tags.slice(0, 2).map((tag) => (
                                                        <View key={`${session.id}_${tag}`} style={styles.liveTag}>
                                                            <Text style={styles.liveTagText}>{tag}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            <View style={styles.liveFooterRow}>
                                                <View>
                                                    <Text style={styles.liveRelativeText}>{relative}</Text>
                                                    {!!clock && (
                                                        <Text style={styles.liveClockText}>{clock}</Text>
                                                    )}
                                                </View>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.liveReminderButton,
                                                        reminded ? styles.liveReminderButtonActive : undefined,
                                                    ]}
                                                    activeOpacity={0.85}
                                                    onPress={() => handleLiveReminder(session)}
                                                >
                                                    <SafeIcon
                                                        name={reminded ? 'bell-ring' : 'bell'}
                                                        size={14}
                                                        color={reminded ? '#1D4ED8' : '#0F172A'}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.liveReminderText,
                                                            reminded ? styles.liveReminderTextActive : undefined,
                                                        ]}
                                                    >
                                                        {reminded ? 'Rappel actif' : 'Notifier'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                    <View style={styles.searchContainer}>
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Rechercher un produit ou un prestataire"
                            placeholderTextColor="#9CA3AF"
                            style={styles.searchInput}
                            returnKeyType="search"
                            onSubmitEditing={searchFeed}
                        />
                        <TouchableOpacity
                            style={styles.searchButton}
                            onPress={searchFeed}
                            activeOpacity={0.85}
                        >
                            {isSearching ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <SafeIcon name="search" size={18} color="#FFF" />
                            )}
                        </TouchableOpacity>
                        {!!searchQuery && (
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={() => {
                                    setSearchQuery('');
                                    loadFeed().catch(() => undefined);
                                }}
                                activeOpacity={0.85}
                            >
                                <SafeIcon name="x" size={14} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <FlatList
                        ref={flatListRef}
                        data={feed}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        getItemLayout={isTablet ? undefined : getItemLayout}
                        pagingEnabled={!isTablet}
                        snapToInterval={isTablet ? undefined : SCREEN_HEIGHT}
                        snapToAlignment="start"
                        decelerationRate="fast"
                        showsVerticalScrollIndicator={false}
                        viewabilityConfig={viewabilityConfig}
                        onViewableItemsChanged={handleViewableItemsChanged}
                        windowSize={isTablet ? 10 : 5}
                        initialNumToRender={isTablet ? 4 : 3}
                        maxToRenderPerBatch={isTablet ? 8 : 5}
                        updateCellsBatchingPeriod={50}
                        removeClippedSubviews
                        onEndReachedThreshold={0.3}
                        numColumns={numColumns}
                        columnWrapperStyle={isTablet ? styles.tabletRow : undefined}
                    />
                </>
            )}
            {commentTarget?.serviceId ? (
                <Modal
                    visible={true}
                    animationType="slide"
                    onRequestClose={() => setCommentTarget(null)}
                >
                    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B' }}>Commentaires</Text>
                            <TouchableOpacity onPress={() => setCommentTarget(null)}>
                                <SafeIcon name="x" size={24} color="#1E293B" />
                            </TouchableOpacity>
                        </View>
                        <ProductCommentsSection
                            serviceId={commentTarget.serviceId}
                            serviceTitle={commentTarget.titre}
                            mode="full"
                        />
                    </View>
                </Modal>
            ) : null}
            {/* ✅ NOUVEAU: Modal Duet/Remix */}
            <DuetRemixModal
                visible={!!duetTarget}
                originalVideo={duetTarget}
                onClose={() => setDuetTarget(null)}
                onSuccess={(duetId) => {
                    console.log('[VideoFeedScreen] Duet créé:', duetId);
                    setDuetTarget(null);
                    // Optionnel: Recharger le feed ou naviguer vers le duet
                }}
            />
            <Modal
                visible={!!liveModalSession}
                transparent
                animationType="fade"
                onRequestClose={() => setLiveModalSession(null)}
            >
                <View style={styles.liveModalWrapper}>
                    <TouchableOpacity
                        style={styles.liveModalBackdrop}
                        activeOpacity={1}
                        onPress={() => setLiveModalSession(null)}
                    />
                    {liveModalSession ? (() => {
                        const now = Date.now();
                        const startTime = new Date(liveModalSession.startAt).getTime();
                        const isLive = now >= startTime;

                        return (
                            <View style={styles.liveModalContainer}>
                                {isLive ? (
                                    // ✅ IMPLÉMENTÉ: Player live streaming HLS si session en cours
                                    <View style={styles.livePlayerContainer}>
                                        <LiveStreamPlayer
                                            sessionId={liveModalSession.id}
                                            userId={user?.id ? Number(user.id) : undefined}
                                            autoPlay={true}
                                            onError={(error) => {
                                                console.error('[VideoFeedScreen] Erreur live player:', error);
                                                Alert.alert('Erreur', 'Impossible de charger le live. Veuillez réessayer.');
                                            }}
                                        />
                                        <TouchableOpacity
                                            style={styles.livePlayerCloseButton}
                                            onPress={() => {
                                                setLiveModalSession(null);
                                                setShowLiveChat(false);
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <SafeIcon name="x" size={20} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    // Session à venir - afficher infos
                                    <>
                                        <View style={styles.liveModalBadgeRow}>
                                            <View style={styles.liveBadge}>
                                                <Text style={styles.liveBadgeLabel}>LIVE</Text>
                                            </View>
                                            <Text style={styles.liveModalAudience}>
                                                {formatCount(liveModalSession.audience ?? 0)} intéressés
                                            </Text>
                                        </View>
                                        <Text style={styles.liveModalTitle}>{liveModalSession.title}</Text>
                                        <Text style={styles.liveModalTime}>
                                            {formatLiveStartRelative(liveModalSession.startAt)} ·{' '}
                                            {formatLiveStartClock(liveModalSession.startAt)}
                                        </Text>
                                        {!!liveModalSession.description && (
                                            <Text style={styles.liveModalDescription}>
                                                {liveModalSession.description}
                                            </Text>
                                        )}
                                        <View style={styles.liveModalActions}>
                                            <TouchableOpacity
                                                style={styles.liveJoinButton}
                                                activeOpacity={0.85}
                                                onPress={() => handleJoinLive(liveModalSession)}
                                            >
                                                <SafeIcon name="play" size={16} color="#FFF" />
                                                <Text style={styles.liveJoinButtonLabel}>Rejoindre le live</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[
                                                    styles.liveReminderModalButton,
                                                    liveReminderMap[liveModalSession.id]
                                                        ? styles.liveReminderModalButtonActive
                                                        : undefined,
                                                ]}
                                                activeOpacity={0.85}
                                                onPress={() => handleLiveReminder(liveModalSession)}
                                            >
                                                <SafeIcon
                                                    name={liveReminderMap[liveModalSession.id] ? 'bell-ring' : 'bell'}
                                                    size={15}
                                                    color={liveReminderMap[liveModalSession.id] ? '#1D4ED8' : '#0F172A'}
                                                />
                                                <Text
                                                    style={[
                                                        styles.liveReminderModalLabel,
                                                        liveReminderMap[liveModalSession.id]
                                                            ? styles.liveReminderModalLabelActive
                                                            : undefined,
                                                    ]}
                                                >
                                                    {liveReminderMap[liveModalSession.id]
                                                        ? 'Rappel actif'
                                                        : 'Être notifié'}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.liveStartButton}
                                                activeOpacity={0.85}
                                                onPress={() => {
                                                    setLiveModalSession(null);
                                                    handleStartLive();
                                                    handleOpenCreation();
                                                }}
                                            >
                                                <SafeIcon name="video" size={16} color="#0F172A" />
                                                <Text style={styles.liveStartButtonLabel}>Vendre en live</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        );
                    })() : null}
                </View>
            </Modal>
            <Modal
                visible={!!creatorPanelItem}
                transparent
                animationType="fade"
                onRequestClose={() => setCreatorPanelItem(null)}
            >
                <View style={styles.creatorModalWrapper}>
                    <TouchableOpacity
                        style={styles.creatorModalBackdrop}
                        activeOpacity={1}
                        onPress={() => setCreatorPanelItem(null)}
                    />
                    <View style={styles.creatorModalContainer}>
                        <View style={styles.creatorHeader}>
                            <View style={styles.creatorAvatar}>
                                {creatorPanelItem?.prestataire?.avatar_url ? (
                                    <Image
                                        source={{ uri: creatorPanelItem.prestataire?.avatar_url! }}
                                        style={styles.creatorAvatarImage}
                                    />
                                ) : (
                                    <SafeIcon name="user" size={24} color="#1F2937" />
                                )}
                            </View>
                            <View style={styles.creatorMeta}>
                                <Text style={styles.creatorName}>
                                    {creatorPanelItem?.prestataire?.nom ??
                                        creatorPanelItem?.prestataire?.user_id ??
                                        'Prestataire Yukpo'}
                                </Text>
                                <Text style={styles.creatorSubtitle}>
                                    {creatorPanelItem?.isSponsored
                                        ? 'Vidéo sponsorisée'
                                        : 'Vidéo recommandée'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.creatorFollowButton}
                                activeOpacity={0.85}
                            >
                                <SafeIcon name="plus" size={14} color="#0F172A" />
                                <Text style={styles.creatorFollowLabel}>Suivre</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.creatorStatsRow}>
                            <View style={styles.creatorStatCard}>
                                <Text style={styles.creatorStatValue}>
                                    {formatCount(likeCounts[creatorPanelItem?.contentId ?? ''] ?? 0)}
                                </Text>
                                <Text style={styles.creatorStatLabel}>Likes</Text>
                            </View>
                            <View style={styles.creatorStatCard}>
                                <Text style={styles.creatorStatValue}>
                                    {formatCount(saveCounts[creatorPanelItem?.contentId ?? ''] ?? 0)}
                                </Text>
                                <Text style={styles.creatorStatLabel}>Saves</Text>
                            </View>
                            <View style={styles.creatorStatCard}>
                                <Text style={styles.creatorStatValue}>
                                    {formatCount(
                                        Math.max(
                                            likeCounts[creatorPanelItem?.contentId ?? ''] ?? 0,
                                            saveCounts[creatorPanelItem?.contentId ?? ''] ?? 0,
                                        ),
                                    )}
                                </Text>
                                <Text style={styles.creatorStatLabel}>Interactions</Text>
                            </View>
                        </View>

                        {!!creatorPanelItem?.description && (
                            <View style={styles.creatorDescription}>
                                <Text style={styles.creatorDescriptionText}>
                                    {creatorPanelItem.description}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.creatorCTA}
                            activeOpacity={0.85}
                            onPress={() => {
                                if (creatorPanelItem?.serviceId) {
                                    setCreatorPanelItem(null);
                                    onPressCTA(creatorPanelItem);
                                }
                            }}
                        >
                            <SafeIcon name="store" size={16} color="#FFF" />
                            <Text style={styles.creatorCTALabel}>Découvrir ses services</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {!loading && (
                <TouchableOpacity
                    style={styles.creationFab}
                    activeOpacity={0.9}
                    onPress={() => handleOpenCreation(feed[currentIndex])}
                >
                    {creationLoading ? (
                        <ActivityIndicator size="small" color="#0F172A" />
                    ) : (
                        <SafeIcon name="video" size={18} color="#0F172A" />
                    )}
                    <Text style={styles.creationFabLabel}>Créer</Text>
                </TouchableOpacity>
            )}
            <ProductVideoCreationModal
                visible={creationModalVisible}
                primaryProduct={creationPrimaryProduct}
                products={creationProducts}
                onClose={() => {
                    setCreationModalVisible(false);
                    setCreationPrimaryProduct(null);
                }}
                onSuccess={handleCreationSuccess}
            />
            {/* ✅ NOUVEAU: Modal livraison depuis vidéo */}
            {deliveryTarget && serviceDataForDelivery && (
                <OrderDeliveryModal
                    visible={!!deliveryTarget}
                    onClose={() => {
                        setDeliveryTarget(null);
                        setServiceDataForDelivery(null);
                        setDeliveryProductIndex(undefined);
                        setDeliveryProductName(undefined);
                    }}
                    serviceId={deliveryTarget.serviceId!}
                    productIndex={deliveryProductIndex}
                    productName={deliveryProductName}
                    onSuccess={(deliveryId) => {
                        console.log('[VideoFeedScreen] Livraison créée:', deliveryId);
                        setDeliveryTarget(null);
                        setServiceDataForDelivery(null);
                        Alert.alert('Succès', 'Votre demande de livraison a été créée avec succès!');
                    }}
                />
            )}
            {/* ✅ NOUVEAU: Modal chat depuis vidéo */}
            {chatTarget && serviceDataForChat && chatTarget.prestataire && (
                <ChatModalMobile
                    visible={!!chatTarget}
                    onClose={() => {
                        setChatTarget(null);
                        setServiceDataForChat(null);
                    }}
                    service={serviceDataForChat}
                    prestataireInfo={chatTarget.prestataire}
                    user={user}
                />
            )}
        </SafeNativeView>
    );
};

const LinearGradientOverlay = () => (
    <View style={StyleSheet.absoluteFill}>
        <View style={styles.topGradient} />
        <View style={styles.bottomGradient} />
    </View>
);

const styles = StyleSheet.create({
    filterModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    tabsContainer: {
        position: 'absolute',
        top: 18,
        left: 16,
        right: 16,
        zIndex: 12,
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderRadius: 28,
        padding: 6,
        gap: 8,
    },
    tabButton: {
        flex: 1,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    tabButtonActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.95)',
        shadowColor: '#6366F1',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    tabLabel: {
        color: '#CBD5F5',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    tabLabelActive: {
        color: '#FFF',
    },
    liveSection: {
        position: 'absolute',
        top: 130,
        left: 0,
        right: 0,
        zIndex: 9,
    },
    liveHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    liveTitleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(99, 102, 241, 0.4)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
    },
    liveTitleText: {
        color: '#F8FAFC',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.4,
    },
    liveRefreshButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    liveScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        gap: 12,
    },
    liveCard: {
        width: SCREEN_WIDTH * 0.6,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.35)',
        gap: 10,
    },
    liveCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    liveBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveBadgeLabel: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 10,
        letterSpacing: 0.6,
    },
    liveAudience: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(248, 250, 252, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveAudienceText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '600',
    },
    liveThumbnail: {
        height: 120,
        borderRadius: 16,
        overflow: 'hidden',
    },
    liveThumbnailImage: {
        borderRadius: 16,
    },
    liveThumbnailOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.25)',
    },
    liveCardTitle: {
        color: '#F8FAFC',
        fontSize: 16,
        fontWeight: '700',
    },
    liveCardHost: {
        color: '#E0E7FF',
        fontSize: 12,
    },
    liveTagsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    liveTag: {
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveTagText: {
        color: '#E0E7FF',
        fontSize: 11,
        fontWeight: '600',
    },
    liveFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    liveRelativeText: {
        color: '#FBBF24',
        fontSize: 13,
        fontWeight: '700',
    },
    liveClockText: {
        color: '#CBD5F5',
        fontSize: 12,
        marginTop: 2,
    },
    liveReminderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(241, 245, 249, 0.9)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    liveReminderButtonActive: {
        backgroundColor: 'rgba(191, 219, 254, 0.95)',
    },
    liveReminderText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '600',
    },
    liveReminderTextActive: {
        color: '#1D4ED8',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 16,
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        backgroundColor: 'black',
    },
    searchContainer: {
        position: 'absolute',
        top: 76,
        left: 16,
        right: 16,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        color: '#F9FAFB',
        fontSize: 15,
        paddingVertical: 0,
    },
    searchButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 16,
    },
    emptySubtitle: {
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    slide: {
        width: SCREEN_WIDTH,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
    },
    videoBackground: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoBackgroundFallback: {
        backgroundColor: '#111827',
    },
    video: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    overlayContent: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingVertical: 24,
        justifyContent: 'space-between',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pauseButton: {
        position: 'absolute',
        top: 36,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
    },
    pauseButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
    },
    sponsoredTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(250, 204, 21, 0.85)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    sponsoredText: {
        color: '#1F2937',
        fontWeight: '700',
        fontSize: 12,
    },
    recommendedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.75)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    recommendedText: {
        color: '#F9FAFB',
        fontWeight: '700',
        fontSize: 12,
    },
    liveStatsContainer: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignItems: 'flex-end',
        minWidth: 88,
    },
    liveStatsText: {
        color: '#22D3EE',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 0.4,
    },
    liveStatsSub: {
        color: '#E5E7EB',
        fontSize: 11,
        marginTop: 2,
    },
    creatorModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
    },
    creatorModalWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    creatorModalContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
        gap: 20,
    },
    creatorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    creatorAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    creatorAvatarImage: {
        width: '100%',
        height: '100%',
    },
    creatorMeta: {
        flex: 1,
    },
    creatorName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    creatorSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    creatorFollowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#38BDF8',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        shadowColor: '#38BDF8',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    creatorFollowLabel: {
        color: '#0F172A',
        fontWeight: '700',
        fontSize: 13,
    },
    creatorStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    creatorStatCard: {
        flex: 1,
        backgroundColor: '#E2E8F0',
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
    },
    creatorStatValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    creatorStatLabel: {
        fontSize: 12,
        color: '#475569',
        marginTop: 4,
    },
    creatorDescription: {
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        padding: 16,
    },
    creatorDescriptionText: {
        color: '#4338CA',
        fontSize: 14,
        lineHeight: 20,
    },
    creatorCTA: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#6366F1',
        paddingVertical: 14,
        borderRadius: 18,
    },
    creatorCTALabel: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    creationFab: {
        position: 'absolute',
        right: 20,
        bottom: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FBBF24',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 999,
        shadowColor: '#F59E0B',
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    creationFabLabel: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    liveModalWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    liveModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
    },
    liveModalContainer: {
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 36,
        gap: 18,
    },
    liveModalBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    liveModalAudience: {
        color: '#1F2937',
        fontSize: 12,
    },
    liveModalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
    },
    liveModalTime: {
        color: '#2563EB',
        fontWeight: '700',
        fontSize: 14,
    },
    liveModalDescription: {
        color: '#475569',
        fontSize: 14,
        lineHeight: 20,
    },
    liveModalActions: {
        gap: 12,
    },
    liveJoinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#EF4444',
        paddingVertical: 14,
        borderRadius: 18,
    },
    liveJoinButtonLabel: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
    livePlayerContainer: {
        width: '100%',
        height: 400,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000',
        marginBottom: 16,
    },
    livePlayerCloseButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    liveReminderModalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#E2E8F0',
        paddingVertical: 12,
        borderRadius: 18,
    },
    liveReminderModalButtonActive: {
        backgroundColor: '#DBEAFE',
    },
    liveReminderModalLabel: {
        color: '#0F172A',
        fontWeight: '700',
    },
    liveReminderModalLabelActive: {
        color: '#1D4ED8',
    },
    liveStartButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 12,
        borderRadius: 18,
        backgroundColor: '#FBBF24',
    },
    liveStartButtonLabel: {
        color: '#0F172A',
        fontWeight: '700',
        fontSize: 14,
    },
    footer: {
        paddingBottom: 24,
    },
    title: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
    },
    description: {
        color: '#E5E7EB',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    audioBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(226, 232, 240, 0.85)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 16,
    },
    audioBadgeText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '600',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: modernColors.primary,
        paddingVertical: 14,
        borderRadius: 24,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },
    secondaryButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sideActions: {
        position: 'absolute',
        right: 20,
        bottom: SCREEN_HEIGHT * 0.25,
        gap: 16,
        alignItems: 'center',
    },
    sideActionButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sideActionCount: {
        marginTop: 6,
        fontSize: 11,
        fontWeight: '600',
        color: '#F9FAFB',
    },
    topGradient: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    bottomGradient: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    placeholderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabletRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
});

export default VideoFeedScreen;

