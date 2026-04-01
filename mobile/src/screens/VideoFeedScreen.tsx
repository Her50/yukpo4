import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Audio, AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    LayoutChangeEvent,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewToken
} from 'react-native';
import OrderDeliveryModal from '../components/delivery/OrderDeliveryModal';
import ProductCommentsSection from '../components/ProductCommentsSection';
import ProductDescriptionSection from '../components/ProductDescriptionSection';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { mediaService } from '../services/mediaService';
import { videoCacheService } from '../services/videoCacheService';
import { generateProductShareMessage, generateSmartShareLink } from '../utils/productShareHelper';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type FeedItem = {
    id: string;
    titre: string;
    description?: string;
    videoUrl: string;
    thumbnail?: string;
    contentId: string;
    likesCount?: number;
    savesCount?: number;
    commentsCount?: number;
    viewsCount?: number;
    isPaid?: boolean;
    serviceId?: number;
    productIndex?: number;
    sellerName?: string;
    sellerAvatar?: string;
    category?: string;
    hashtags?: string[];
    hasDelivery?: boolean; // ✅ AJOUT: Support pour la livraison automatique
};

const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
};

const normalizeVideoUrl = (url: any): string | null => {
    console.log(`🎯 [VideoFeedScreen] normalizeVideoUrl appelé avec:`, url, typeof url);

    if (!url) {
        console.log(`❌ [VideoFeedScreen] normalizeVideoUrl: url est falsy`);
        return null;
    }

    const urlStr = typeof url === 'string' ? url : String(url);
    if (!urlStr || typeof urlStr !== 'string') {
        console.log(`❌ [VideoFeedScreen] normalizeVideoUrl: urlStr invalide`);
        return null;
    }

    const trimmed = urlStr.trim();
    if (!trimmed) {
        console.log(`❌ [VideoFeedScreen] normalizeVideoUrl: trimmed est vide`);
        return null;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        console.log(`✅ [VideoFeedScreen] normalizeVideoUrl: URL directe retournée:`, trimmed.substring(0, 100) + '...');
        return trimmed;
    }

    const cdnUrl = mediaService.getVideoUrl(trimmed);
    const result = cdnUrl || trimmed;
    console.log(`🌐 [VideoFeedScreen] normalizeVideoUrl: CDN URL générée:`, cdnUrl, 'résultat final:', result);
    return result;
};

// ✅ CORRIGÉ 2026-03-11: Vérifier qu'une URL est bien une vidéo (pas une image)
const isVideoUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    const pathPart = lower.split('?')[0]; // Ignorer les query params (presigned URLs)
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic'];
    const videoExts = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.3gp'];
    if (imageExts.some(ext => pathPart.endsWith(ext))) return false;
    if (videoExts.some(ext => pathPart.endsWith(ext))) return true;
    // Pas d'extension reconnaissable → accepter sauf si clairement image
    return !lower.includes('/image') && !lower.includes('_image');
};

// ✅ CORRIGÉ 2026-03-04: Helper pour extraire une vidéo depuis un champ qui peut être:
// - Une string directe: "url"
// - Un tableau: ["url1", "url2"]
// - Un objet {valeur: ["url1", "url2"]} (format formulaire dynamique)
const extractVideoFromField = (field: any): string | null => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) return field[0] || null;
    if (typeof field === 'object' && field.valeur) {
        if (typeof field.valeur === 'string') return field.valeur;
        if (Array.isArray(field.valeur)) return field.valeur[0] || null;
    }
    return null;
};

const normalizeFeed = (raw: any[]): FeedItem[] => {
    console.log(`🚀 [VideoFeedScreen] normalizeFeed START - ${raw.length} items bruts`);

    if (!Array.isArray(raw)) {
        console.warn(`❌ [VideoFeedScreen] normalizeFeed: raw n'est pas un tableau`, typeof raw, raw);
        return [];
    }
    console.log(`📊 [VideoFeedScreen] normalizeFeed: ${raw.length} items bruts à traiter`);

    const results = raw
        .map((item, index) => {
            console.log(`\n🔍 [VideoFeedScreen] Traitement item ${index}:`, item?.data?.nom || 'Sans nom');

            // ✅ CORRIGÉ 2026-03-04: Chercher la vidéo dans tous les formats possibles
            const rawVideo =
                item?.videoUrl ||
                item?.video ||
                item?.data?.videoUrl ||
                item?.data?.video ||
                extractVideoFromField(item?.data?.videos) ||
                extractVideoFromField(item?.videos);

            console.log(`📹 [VideoFeedScreen] rawVideo trouvé:`, rawVideo ? 'OUI' : 'NON');
            if (rawVideo) {
                console.log(`📹 [VideoFeedScreen] rawVideo type:`, typeof rawVideo);
                console.log(`📹 [VideoFeedScreen] rawVideo preview:`, String(rawVideo).substring(0, 100) + '...');
            }

            if (!rawVideo) {
                console.log(`❌ [VideoFeedScreen] Item ${index} ignoré: aucune vidéo trouvée`, {
                    videoUrl: item?.videoUrl,
                    video: item?.video,
                    dataVideoUrl: item?.data?.videoUrl,
                    dataVideo: item?.data?.video,
                    dataVideos: item?.data?.videos,
                    videos: item?.videos
                });
                return null;
            }

            const video = normalizeVideoUrl(rawVideo);
            console.log(`🎬 [VideoFeedScreen] normalizeVideoUrl result:`, video ? 'VALID' : 'NULL');

            if (!video) {
                console.log(`❌ [VideoFeedScreen] Item ${index} ignoré: normalizeVideoUrl a retourné null pour`, rawVideo);
                return null;
            }

            // ✅ CORRIGÉ 2026-03-11: Rejeter les URLs qui sont des images (pas des vidéos)
            if (!isVideoUrl(video)) {
                console.log(`❌ [VideoFeedScreen] Item ${index} ignoré: URL est une image, pas une vidéo:`, video.substring(0, 80));
                return null;
            }

            const title =
                item?.titre ||
                item?.title ||
                item?.data?.titre ||
                item?.data?.title ||
                '';
            const id =
                item?.id ||
                item?.content_id ||
                item?.data?.id ||
                `${index}-${video}`;

            const rawThumbnail =
                item?.thumbnail ||
                item?.cover ||
                item?.data?.thumbnail ||
                item?.data?.cover;
            const thumbnail = rawThumbnail
                ? (normalizeVideoUrl(rawThumbnail) || mediaService.getImageUrl(String(rawThumbnail)) || String(rawThumbnail))
                : undefined;

            // ✅ DÉTECTER LA LIVRAISON AUTOMATIQUE
            const serviceData = item?.data?.service?.data;
            const hasDelivery = !!(
                serviceData?.delivery_config ||
                serviceData?.delivery_enabled ||
                serviceData?.has_delivery ||
                serviceData?.delivery_type ||
                serviceData?.livraison_config ||
                serviceData?.livraison_enabled ||
                serviceData?.has_livraison ||
                serviceData?.livraison_type
            );

            console.log(`🚚 [VideoFeedScreen] Livraison détectée: ${hasDelivery ? 'OUI' : 'NON'}`);

            const result = {
                id: String(id),
                contentId: String(item?.content_id || id),
                titre: String(title),
                description: item?.description || item?.data?.description,
                videoUrl: video,
                thumbnail: thumbnail,
                likesCount: Number(item?.likes ?? item?.data?.likes ?? item?.stats?.likes ?? 0),
                savesCount: Number(item?.saves ?? item?.data?.saves ?? item?.stats?.saves ?? 0),
                commentsCount: Number(item?.comments ?? item?.data?.comments ?? item?.stats?.comments ?? 0),
                viewsCount: Number(item?.views ?? item?.data?.views ?? item?.stats?.views ?? 0),
                isPaid: item?.is_paid || item?.content_type === 'paid' || false,
                serviceId: item?.service_id || item?.data?.service_id,
                productIndex: item?.product_index ?? item?.data?.product_index ?? 0,
                sellerName: item?.seller_name || item?.data?.seller_name || item?.data?.titre_service?.valeur || item?.data?.titre_service || item?.data?.prestataire_name,
                sellerAvatar: item?.seller_avatar || item?.data?.seller_avatar,
                category: item?.category || item?.data?.category,
                hashtags: item?.hashtags || item?.data?.hashtags || [],
                hasDelivery: hasDelivery, // ✅ AJOUT: Information de livraison
            } as FeedItem;

            console.log(`✅ [VideoFeedScreen] Item ${index} validé: ${result.titre}`);
            return result;
        })
        .filter((item): item is FeedItem => item !== null && item !== undefined) as FeedItem[];

    console.log(`🎯 [VideoFeedScreen] normalizeFeed END - ${results.length} items validés`);
    return results;
};

const REACTIONS = [
    { type: 'love', emoji: '❤️', label: "J'adore" },
    { type: 'like', emoji: '👍', label: "J'aime" },
    { type: 'wow', emoji: '😮', label: 'Impressionnant' },
    { type: 'interested', emoji: '🎯', label: 'Intéressant' },
    { type: 'thinking', emoji: '🤔', label: 'À réfléchir' },
    { type: 'disappointed', emoji: '😕', label: 'Déçu' },
];

const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 200,
};

// ✅ FIX 2026-03-14: Composant ProgressBar isolé pour éviter les re-renders massifs de la FlatList
// progressMap change ~2x/sec — ce composant absorbe les updates sans re-render de renderItem
const VideoProgressBar: React.FC<{ progress: number }> = React.memo(({ progress }) => (
    <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        backgroundColor: 'rgba(255,255,255,0.15)', zIndex: 20,
    }}>
        <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: '#FF2D55' }} />
    </View>
));

const VideoFeedScreen: React.FC = ({ route }: any) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const isFocused = useIsFocused();
    const showOnlyMyVideos = route?.params?.showOnlyMyVideos || false;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
    const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
    const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});
    const [mutedMap, setMutedMap] = useState<Record<string, boolean>>({});
    const [progressMap, setProgressMap] = useState<Record<string, number>>({});
    const progressMapRef = useRef<Record<string, number>>({});
    const [doubleTapHeart, setDoubleTapHeart] = useState<string | null>(null);
    const [commentsModalItem, setCommentsModalItem] = useState<FeedItem | null>(null);
    const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, { count: number; hasReacted: boolean }>>>({});
    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const [pendingReaction, setPendingReaction] = useState<string | null>(null);
    const [bufferingMap, setBufferingMap] = useState<Record<string, boolean>>({});
    /** Échec de chargement / lecture (expo-av) — évite spinner infini si URL 403, codec, etc. */
    const [videoLoadErrorMap, setVideoLoadErrorMap] = useState<Record<string, boolean>>({});
    const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
    const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [selectedDeliveryItem, setSelectedDeliveryItem] = useState<FeedItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchExpanded, setSearchExpanded] = useState(false);
    const searchWidthAnim = useRef(new Animated.Value(0)).current;
    const searchInputRef = useRef<TextInput>(null);
    const [filteredFeed, setFilteredFeed] = useState<FeedItem[]>([]);
    const filteredFeedLengthRef = useRef(0);
    const viewedSet = useRef<Set<string>>(new Set());
    const spinAnim = useRef(new Animated.Value(0)).current;
    const videoRefs = useRef<Map<number, Video | null>>(new Map());
    const flatListRef = useRef<FlatList>(null);
    const lastTapRef = useRef<Record<string, number>>({});
    const heartAnim = useRef(new Animated.Value(0)).current;
    const currentIndexRef = useRef(0);
    /** Hauteur réelle du viewport du feed (onglet + safe area ≠ window height). Doit matcher paging + getItemLayout. */
    const pageHeightRef = useRef(SCREEN_HEIGHT);
    const [pageHeight, setPageHeight] = useState(SCREEN_HEIGHT);

    const fetchFeed = useCallback(async (isRefresh = false, pageNum = 1) => {
        if (!isRefresh && pageNum === 1) setLoading(true);
        try {
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const endpoint = showOnlyMyVideos
                ? '/api/videos/my-videos'
                : `/api/content/mixed?limit=20&page=${pageNum}&format=video${userIdParam}`;
            console.log(`[VideoFeedScreen] Appel API: ${endpoint}`);
            const response = await apiGet(endpoint);
            console.log(`[VideoFeedScreen] Réponse API brute:`, response);

            let data: any[] = [];
            const responseData = response?.data as any;

            if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
                data = responseData.data || responseData.items || [];
                console.log(`[VideoFeedScreen] Données extraites de l'objet: ${data.length} items`);
            } else if (responseData && Array.isArray(responseData)) {
                data = responseData;
                console.log(`[VideoFeedScreen] Données extraites du tableau: ${data.length} items`);
            } else {
                data = [];
                console.warn(`[VideoFeedScreen] Format de réponse inattendu:`, typeof responseData, responseData);
            }

            // Afficher le premier item pour debug
            if (data.length > 0) {
                console.log(`[VideoFeedScreen] Premier item brut:`, data[0]);
            }

            const normalized = normalizeFeed(data);
            console.log(`[VideoFeedScreen] Feed chargé: ${normalized.length} vidéos (page ${pageNum})`);

            if (pageNum === 1 || isRefresh) {
                setFeed(normalized);
                setLikedMap({});
                setSavedMap({});
                setPausedMap({});
                setProgressMap({});
                setBufferingMap({});
                setVideoLoadErrorMap({});
                viewedSet.current.clear();
                setPage(1);
            } else {
                // Append sans doublons
                setFeed((prev) => {
                    const existingIds = new Set(prev.map((f) => f.id));
                    const newItems = normalized.filter((f) => !existingIds.has(f.id));
                    return [...prev, ...newItems];
                });
            }
            setHasMore(normalized.length >= 10);
        } catch (error) {
            console.error('[VideoFeedScreen] Erreur chargement feed', error);
            if (!isRefresh && pageNum === 1) {
                Alert.alert(t('videoFeed.videosUnavailable'), t('videoFeed.cannotLoadVideos'));
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showOnlyMyVideos, user?.id]);

    useEffect(() => { fetchFeed(); }, [fetchFeed]);

    useEffect(() => {
        Audio.setAudioModeAsync({
            staysActiveInBackground: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
        }).catch(() => undefined);
    }, []);

    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    const handleListLayout = useCallback((e: LayoutChangeEvent) => {
        const h = e.nativeEvent.layout.height;
        if (h <= 0) return;
        if (Math.abs(h - pageHeightRef.current) < 1) return;
        pageHeightRef.current = h;
        setPageHeight(h);
    }, []);

    // Recaler le scroll quand la hauteur de page devient correcte (1er layout / rotation)
    useEffect(() => {
        if (!flatListRef.current || filteredFeed.length === 0) return;
        const idx = Math.min(currentIndexRef.current, filteredFeed.length - 1);
        flatListRef.current.scrollToOffset({ offset: idx * pageHeight, animated: false });
        // deps: pageHeight seulement — évite un scroll à chaque append pagination
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageHeight]);

    // ✅ Filtrer le feed selon la recherche
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredFeed(feed);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = feed.filter(item =>
                item.titre?.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query) ||
                item.sellerName?.toLowerCase().includes(query) ||
                item.category?.toLowerCase().includes(query) ||
                item.hashtags?.some(tag => tag.toLowerCase().includes(query))
            );
            setFilteredFeed(filtered);
            // Remettre à la première vidéo quand la recherche change
            if (filtered.length > 0) {
                setCurrentIndex(0);
                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            }
        }
    }, [feed, searchQuery]);

    // ✅ Garder la ref à jour pour éviter les stale closures dans handlePlaybackStatus
    useEffect(() => {
        filteredFeedLengthRef.current = filteredFeed.length;
    }, [filteredFeed.length]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchFeed(true, 1);
    }, [fetchFeed]);

    // ✅ Infinite scroll: charger la page suivante
    const loadMore = useCallback(() => {
        if (!hasMore || loading || refreshing) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchFeed(false, nextPage);
    }, [hasMore, loading, refreshing, page, fetchFeed]);

    // ✅ PRÉCHARGEMENT PRÉDICTIF: Précharger les 3 prochaines vidéos
    const preloadNextVideos = useCallback(async (currentIdx: number) => {
        for (let i = 1; i <= 3; i++) {
            const nextIndex = currentIdx + i;
            if (nextIndex < filteredFeed.length) {
                const nextItem = filteredFeed[nextIndex];
                if (nextItem?.videoUrl) {
                    // Précharger en arrière-plan sans bloquer
                    try {
                        await videoCacheService.preloadVideo(nextItem.videoUrl);
                    } catch (error) {
                        // Ignorer erreurs de préchargement
                        console.debug('[VideoFeedScreen] Préchargement échoué pour index', nextIndex);
                    }
                }
            }
        }
    }, [filteredFeed]);

    // ✅ Lancer préchargement quand currentIndex change
    useEffect(() => {
        if (filteredFeed.length > 0 && currentIndex >= 0) {
            // ✅ NOUVEAU: Réinitialiser le compteur de lectures pour la nouvelle vidéo
            const currentItem = filteredFeed[currentIndex];
            const contentId = currentItem?.contentId || currentItem?.id;
            if (contentId && !playCountRef.current[contentId]) {
                setPlayCount(prev => ({ ...prev, [contentId]: 0 }));
            }

            // Délai court pour ne pas impacter la performance du scroll
            const timeoutId = setTimeout(() => {
                preloadNextVideos(currentIndex);
            }, 500);

            return () => clearTimeout(timeoutId);
        }
    }, [currentIndex, filteredFeed, preloadNextVideos]);

    // ✅ Vérifier le statut de suivi pour les vidéos visibles
    const checkedFollowRef = useRef<Set<string>>(new Set());
    const checkFollowStatus = useCallback(async (serviceId: string | number) => {
        if (!serviceId || !user?.id) return;
        const key = String(serviceId);
        if (checkedFollowRef.current.has(key)) return;
        checkedFollowRef.current.add(key);
        try {
            const res = await apiGet(`/api/services/${key}/follow-status`);
            const data = res?.data as any;
            if (data?.success) {
                setFollowMap((prev) => ({ ...prev, [key]: data.is_following }));
            }
        } catch { /* silent */ }
    }, [user?.id]);

    // ✅ NOUVEAU: Gérer le compteur de lectures pour le mode TikTok (2 lectures avant auto-scroll)
    const playCountRef = useRef<Record<string, number>>({});
    const [playCount, setPlayCount] = useState<Record<string, number>>({});

    // ✅ CORRIGÉ: Réinitialiser l'état au retour sur l'écran
    useEffect(() => {
        if (isFocused && filteredFeed.length > 0) {
            // Réinitialiser l'état de lecture pour la vidéo actuelle
            const currentItem = filteredFeed[currentIndex];
            if (currentItem) {
                const contentId = currentItem.contentId || currentItem.id;
                if (contentId && !playCountRef.current[contentId]) {
                    setPlayCount(prev => ({ ...prev, [contentId]: 0 }));
                }
            }
        }
    }, [isFocused, filteredFeed, currentIndex]);

    const handleToggleFollow = useCallback(async (serviceId: string | number) => {
        if (!serviceId || !user?.id) {
            Alert.alert(t('videoFeed.loginRequired'), t('videoFeed.loginToFollow'));
            return;
        }

        // ✅ VALIDATION: S'assurer que serviceId est un nombre valide
        const numericServiceId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
        if (isNaN(numericServiceId) || numericServiceId <= 0) {
            console.error(`[VideoFeed] Invalid serviceId: ${serviceId}`);
            Alert.alert(t('message.error'), t('videoFeed.invalidServiceId'));
            return;
        }

        const key = String(numericServiceId);
        const wasFollowing = followMap[key] || false;

        // Optimistic update
        setFollowMap((prev) => ({ ...prev, [key]: !wasFollowing }));

        try {
            console.log(`[VideoFeed] Toggling follow for service ${numericServiceId}, wasFollowing: ${wasFollowing}`);
            const res = await apiPost(`/api/services/${numericServiceId}/follow`, {});
            const data = res?.data as any;
            console.log(`[VideoFeed] Follow response:`, data);

            if (data?.success) {
                // Mettre à jour avec la vraie valeur de l'API
                setFollowMap((prev) => ({ ...prev, [key]: data.is_following }));
                console.log(`[VideoFeed] Follow status updated to: ${data.is_following}`);
            } else {
                // Si l'API retourne success: false, revenir à l'état précédent
                console.warn(`[VideoFeed] Follow API returned success: false`);
                setFollowMap((prev) => ({ ...prev, [key]: wasFollowing }));
            }
        } catch (error) {
            // Revert on error et logger l'erreur
            console.error(`[VideoFeed] Error toggling follow for service ${numericServiceId}:`, error);
            setFollowMap((prev) => ({ ...prev, [key]: wasFollowing }));

            // Afficher un message d'erreur à l'utilisateur
            Alert.alert(
                t('message.error'),
                t('videoFeed.cannotFollowVendor'),
                [{ text: 'OK' }]
            );
        }
    }, [user?.id]);

    // ✅ View tracking: comptabiliser la vue quand vidéo active pendant >2s
    useEffect(() => {
        const currentItem = filteredFeed[currentIndex];
        if (!currentItem || !isFocused) return;
        const contentId = currentItem.contentId || currentItem.id;
        if (viewedSet.current.has(contentId)) return;

        const timer = setTimeout(() => {
            viewedSet.current.add(contentId);
            apiPost(`/api/content/${contentId}/engagement`, { action: 'view' }).catch(() => undefined);
        }, 2000);
        return () => clearTimeout(timer);
    }, [currentIndex, filteredFeed, isFocused]);

    // ✅ Spinning disc animation (comme TikTok)
    useEffect(() => {
        const spin = Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 4000,
                useNativeDriver: true,
            })
        );
        spin.start();
        return () => spin.stop();
    }, [spinAnim]);

    const registerRef = useCallback((index: number, ref: Video | null) => {
        videoRefs.current.set(index, ref);
    }, []);

    const forceSingleActiveVideo = useCallback((activeIndex: number) => {
        videoRefs.current.forEach((ref, idx) => {
            if (!ref) return;
            if (idx === activeIndex) {
                ref.playAsync().catch(() => undefined);
            } else {
                ref.pauseAsync().catch(() => undefined);
                ref.setStatusAsync({ shouldPlay: false }).catch(() => undefined);
            }
        });
    }, []);

    const handleViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
            if (!isFocused || viewableItems.length === 0) return;
            const firstVisible = viewableItems.find((v) => v.isViewable && typeof v.index === 'number');
            const nextIndex = firstVisible?.index ?? 0;
            if (nextIndex < 0 || nextIndex >= filteredFeed.length) return;
            if (nextIndex !== currentIndexRef.current) {
                setCurrentIndex(nextIndex);
                currentIndexRef.current = nextIndex;
                forceSingleActiveVideo(nextIndex);
            }
        },
        [filteredFeed.length, isFocused, forceSingleActiveVideo],
    );

    // ✅ CORRIGÉ: Pause/play basé sur currentIndex ET focus de l'écran
    useEffect(() => {
        if (!isFocused || filteredFeed.length === 0) return;

        videoRefs.current.forEach((ref, index) => {
            if (!ref) return;
            const item = filteredFeed[index];
            if (!item) return;
            const contentId = item.contentId || item.id;
            const isPaused = contentId ? (pausedMap[contentId] ?? false) : false;
            const isActive = index === currentIndex;

            if (isActive && !isPaused) {
                ref.playAsync().catch(() => undefined);
            } else {
                ref.pauseAsync().catch(() => undefined);
                ref.setStatusAsync({ shouldPlay: false }).catch(() => undefined);
            }
        });
    }, [currentIndex, pausedMap, filteredFeed, isFocused]);

    useEffect(() => {
        if (!isFocused) return;
        if (filteredFeed.length === 0) {
            setCurrentIndex(0);
            currentIndexRef.current = 0;
            return;
        }
        if (currentIndex >= filteredFeed.length) {
            const clamped = Math.max(0, filteredFeed.length - 1);
            setCurrentIndex(clamped);
            currentIndexRef.current = clamped;
            flatListRef.current?.scrollToOffset({ offset: clamped * pageHeightRef.current, animated: false });
        }
    }, [filteredFeed.length, currentIndex, isFocused]);

    // ✅ CORRIGÉ: Arrêter toutes les vidéos et réinitialiser l'état quand on quitte l'écran
    useFocusEffect(
        useCallback(() => {
            return () => {
                // Cleanup: pause toutes les vidéos et réinitialiser l'état
                videoRefs.current.forEach((ref) => {
                    if (ref) {
                        ref.pauseAsync().catch(() => undefined);
                        ref.setStatusAsync({ shouldPlay: false }).catch(() => undefined);
                        ref.unloadAsync().catch(() => undefined);
                    }
                });

                // Réinitialiser les états pour éviter l'écran figé au retour
                setPausedMap({});
                setProgressMap({});
                setBufferingMap({});
                setVideoLoadErrorMap({});
                setMutedMap({});
                setPlayCount({});
                playCountRef.current = {};
                videoRefs.current.clear();
                viewedSet.current.clear();
                setCurrentIndex(0);
            };
        }, [])
    );

    const animateHeart = useCallback((contentId: string) => {
        setDoubleTapHeart(contentId);
        heartAnim.setValue(0);
        Animated.sequence([
            Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
            Animated.timing(heartAnim, { toValue: 0, duration: 400, delay: 300, useNativeDriver: true }),
        ]).start(() => setDoubleTapHeart(null));
    }, [heartAnim]);

    // ✅ CORRIGÉ: Charger les réactions depuis la même API que ProductCard
    const loadReactionsForItem = useCallback(async (item: FeedItem) => {
        if (!item.serviceId) return;
        const key = `${item.serviceId}_${item.productIndex ?? 0}`;
        try {
            const response = await apiGet(`/api/products/${item.serviceId}/${item.productIndex ?? 0}/reactions`);
            if (response && response.data) {
                const reactionsData: Record<string, { count: number; hasReacted: boolean }> = {};
                // ✅ CORRIGÉ 2026-03-18: apiGet wraps response → response.data = backend JSON
                // Backend renvoie { success, data: [...] }, donc les réactions sont dans response.data.data
                const backendResp = response.data as any;
                const reactionsArray = Array.isArray(backendResp?.data)
                    ? backendResp.data
                    : Array.isArray(backendResp) ? backendResp : [];
                reactionsArray.forEach((r: any) => {
                    if (r && r.reaction_type) {
                        reactionsData[r.reaction_type] = {
                            count: r.count || 0,
                            hasReacted: r.has_reacted || false,
                        };
                    }
                });
                setReactionsMap((prev) => ({ ...prev, [key]: reactionsData }));
                // Sync likedMap avec l'état serveur
                const contentId = item.contentId || item.id;
                if (reactionsData.love?.hasReacted) {
                    setLikedMap((prev) => ({ ...prev, [contentId]: true }));
                }
            }
        } catch (error) {
            console.warn('[VideoFeedScreen] loadReactions error', error);
        }
    }, []);

    // ✅ Charger les réactions quand la vidéo visible change (index = filteredFeed, pas feed brut)
    useEffect(() => {
        const currentItem = filteredFeed[currentIndex];
        if (currentItem?.serviceId) {
            loadReactionsForItem(currentItem);
        }
    }, [currentIndex, filteredFeed, loadReactionsForItem]);

    // ✅ CORRIGÉ: handleReaction utilise la même API que ProductCard
    const handleReaction = useCallback(async (item: FeedItem, reactionType: string) => {
        if (!item.serviceId) {
            // Fallback: engagement API pour vidéos sans serviceId
            const contentId = item.contentId || item.id;
            const newState = !likedMap[contentId];
            setLikedMap((prev) => ({ ...prev, [contentId]: newState }));
            apiPost(`/api/content/${contentId}/engagement`, { action: 'like', set: newState }).catch(() => undefined);
            return;
        }

        const key = `${item.serviceId}_${item.productIndex ?? 0}`;
        setPendingReaction(reactionType);
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }

        try {
            const response = await apiPost(`/api/products/${item.serviceId}/${item.productIndex ?? 0}/react`, {
                reaction_type: reactionType,
            });
            if (response.success) {
                await loadReactionsForItem(item);
            }
        } catch (error) {
            console.warn('[VideoFeedScreen] Reaction error', error);
        } finally {
            setPendingReaction(null);
            setShowReactionPicker(null);
        }
    }, [likedMap, loadReactionsForItem]);

    const handleTap = useCallback((item: FeedItem) => {
        const contentId = item.contentId || item.id;
        const now = Date.now();
        const lastTap = lastTapRef.current[contentId] || 0;

        if (now - lastTap < 300) {
            // Double-tap → Love reaction (même API que ProductCard)
            handleReaction(item, 'love');
            animateHeart(contentId);
            lastTapRef.current[contentId] = 0;
        } else {
            // Single tap → Pause/Play
            lastTapRef.current[contentId] = now;
            setTimeout(() => {
                if (lastTapRef.current[contentId] === now) {
                    setPausedMap((prev) => ({ ...prev, [contentId]: !prev[contentId] }));
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
                }
            }, 320);
        }
    }, [animateHeart, handleReaction]);

    const toggleSave = useCallback(async (item: FeedItem) => {
        const contentId = item.contentId || item.id;
        const newState = !savedMap[contentId];
        setSavedMap((prev) => ({ ...prev, [contentId]: newState }));
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
        try {
            await apiPost(`/api/content/${contentId}/engagement`, { action: 'save', set: newState });
        } catch (error) {
            console.warn('[VideoFeedScreen] Save error', error);
        }
    }, [savedMap]);

    const toggleMute = useCallback((item: FeedItem) => {
        const contentId = item.contentId || item.id;
        setMutedMap((prev) => ({ ...prev, [contentId]: !prev[contentId] }));
    }, []);

    const handleShare = useCallback(async (item: FeedItem) => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
        const productName = item.titre?.trim() || t('videoFeed.video');
        const productDesc = (item.description && String(item.description).trim()) || '';

        try {
            if (item.serviceId != null && item.serviceId !== undefined) {
                const shareProductId = item.productIndex ?? 0;
                const shareServiceId = item.serviceId;
                const shareMessage = generateProductShareMessage({
                    productName,
                    productDescription: productDesc,
                    productId: shareProductId,
                    serviceId: shareServiceId,
                });
                const smartLink = generateSmartShareLink(shareProductId, shareServiceId);
                await Share.share({
                    message: shareMessage,
                    title: productName,
                    url: smartLink,
                });
            } else {
                const fallbackMsg = productDesc
                    ? `${productName}\n\n${productDesc}\n\n${item.videoUrl}`
                    : `${productName}\n\n${item.videoUrl}`;
                await Share.share({
                    message: fallbackMsg,
                    title: productName,
                    url: item.videoUrl,
                });
            }
        } catch (error) {
            console.error('[VideoFeedScreen] Erreur partage:', error);
            Alert.alert(t('videoFeed.information'), t('videoFeed.shareError'));
        }
    }, [t]);

    // ✅ FIX 2026-03-14: Barre de recherche style Facebook — icône ronde → expand au clic
    const toggleSearch = useCallback(() => {
        if (searchExpanded) {
            // Fermer
            Animated.timing(searchWidthAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: false,
            }).start(() => {
                setSearchExpanded(false);
                if (!searchQuery.trim()) setSearchQuery('');
            });
        } else {
            // Ouvrir
            setSearchExpanded(true);
            Animated.timing(searchWidthAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false,
            }).start(() => {
                searchInputRef.current?.focus();
            });
        }
    }, [searchExpanded, searchWidthAnim, searchQuery]);

    const closeSearch = useCallback(() => {
        setSearchQuery('');
        Animated.timing(searchWidthAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
        }).start(() => {
            setSearchExpanded(false);
        });
    }, [searchWidthAnim]);

    const toggleDescription = useCallback((contentId: string) => {
        setExpandedDescriptions((prev) => ({ ...prev, [contentId]: !prev[contentId] }));
    }, []);

    const handleViewProduct = useCallback((item: FeedItem) => {
        if (item.serviceId) {
            (navigation as any).navigate('ServiceDetailShared', { serviceId: item.serviceId });
        } else {
            Alert.alert(t('videoFeed.information'), t('videoFeed.noAssociatedProduct'));
        }
    }, [navigation]);

    // ✅ AJOUT: Gérer le clic sur le bouton de livraison
    const handleDeliveryOrder = useCallback((item: FeedItem) => {
        if (item.serviceId && item.hasDelivery) {
            console.log(`🚚 [VideoFeedScreen] Ouverture modal de livraison pour le service ${item.serviceId}`);
            setSelectedDeliveryItem(item);
            setShowDeliveryModal(true);
        } else {
            Alert.alert(t('videoFeed.information'), t('videoFeed.deliveryUnavailable'));
        }
    }, []);

    // ✅ AJOUT: Gérer la réussite de la commande de livraison
    const handleDeliverySuccess = useCallback((deliveryId: string) => {
        console.log(`🎯 [VideoFeedScreen] Livraison créée avec succès: ${deliveryId}`);
        setShowDeliveryModal(false);
        setSelectedDeliveryItem(null);

        // Naviguer vers l'écran de suivi comme dans ProductCard
        try {
            (navigation as any).navigate('DeliveryShoppingTracking', { deliveryId });
        } catch (error) {
            console.error('Erreur navigation vers DeliveryShoppingTracking:', error);
        }
    }, [navigation]);

    const handleOpenComments = useCallback((item: FeedItem) => {
        if (item.serviceId) {
            setCommentsModalItem(item);
        } else {
            Alert.alert(t('videoFeed.comments'), t('videoFeed.commentsUnavailable'));
        }
    }, []);

    const handlePlaybackStatus = useCallback((contentId: string, index: number, status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            // Échec définitif (réseau, 403, format) : expo renvoie error — sinon c'est encore le chargement
            if ('error' in status && (status as { error?: string }).error) {
                const err = (status as { error?: string }).error;
                console.warn(`[VideoFeedScreen] Lecture impossible (${contentId}):`, err);
                setVideoLoadErrorMap((prev) => (prev[contentId] ? prev : { ...prev, [contentId]: true }));
                setBufferingMap((prev) => ({ ...prev, [contentId]: false }));
                return;
            }
            setBufferingMap((prev) => {
                if (prev[contentId] === true) return prev;
                return { ...prev, [contentId]: true };
            });
            return;
        }

        const isBuffering = status.isBuffering || false;
        setBufferingMap((prev) => {
            if (prev[contentId] === isBuffering) return prev;
            return { ...prev, [contentId]: isBuffering };
        });

        if (status.durationMillis && status.durationMillis > 0) {
            const progress = status.positionMillis / status.durationMillis;
            // ✅ FIX 2026-03-14: Mettre à jour la ref miroir TOUJOURS (pas de re-render)
            progressMapRef.current[contentId] = progress;
            setProgressMap((prev) => {
                // ✅ FIX 2026-03-14: Seuil 3% (au lieu de 1%) pour réduire les re-renders
                // Exception: toujours updater quand >= 0.97 (pour déclencher les boutons replay)
                if (progress < 0.97 && Math.abs((prev[contentId] || 0) - progress) < 0.03) return prev;
                return { ...prev, [contentId]: progress };
            });

            // ✅ Mode TikTok: 2 lectures avant auto-scroll
            if (status.didJustFinish && !status.isLooping) {
                if (contentId) {
                    const currentPlayCount = (playCountRef.current[contentId] || 0) + 1;
                    playCountRef.current[contentId] = currentPlayCount;
                    setPlayCount(prev => ({ ...prev, [contentId]: currentPlayCount }));

                    if (currentPlayCount === 1) {
                        // Première lecture terminée → relancer pour la 2ème
                        setTimeout(() => {
                            const videoRef = videoRefs.current.get(index);
                            if (videoRef) {
                                videoRef.replayAsync().catch(() => undefined);
                            }
                        }, 500);
                    } else if (currentPlayCount >= 2) {
                        // ✅ CORRIGÉ: Utiliser la ref pour éviter stale closure
                        const feedLen = filteredFeedLengthRef.current;
                        const nextIndex = index + 1;
                        if (nextIndex < feedLen) {
                            setTimeout(() => {
                                const ph = pageHeightRef.current;
                                try {
                                    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                                } catch (_e) {
                                    flatListRef.current?.scrollToOffset({ offset: nextIndex * ph, animated: true });
                                }
                            }, 800);
                        } else {
                            // Fin du feed, charger plus de vidéos
                            loadMore();
                        }
                    }
                }
            }
        }
    }, [loadMore]);

    const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
        const contentId = item.contentId || item.id;
        const liked = likedMap[contentId] ?? false;
        const saved = savedMap[contentId] ?? false;
        const paused = pausedMap[contentId] ?? false;
        const muted = mutedMap[contentId] ?? false;
        const progress = progressMap[contentId] ?? 0;
        const isActive = index === currentIndex;
        const isBuffering = bufferingMap[contentId] ?? false;
        const hasLoadError = videoLoadErrorMap[contentId] ?? false;
        const spinRotation = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

        return (
            <View style={[styles.card, { height: pageHeight }]}>
                <Pressable style={styles.videoTouchable} onPress={() => handleTap(item)}>
                    <Video
                        ref={(ref) => registerRef(index, ref)}
                        style={[styles.video, { height: pageHeight }]}
                        videoStyle={[styles.videoNative, { height: pageHeight }]}
                        source={{ uri: item.videoUrl }}
                        // ✅ FIX 2026-03-14: Désactiver le poster — les thumbnails sont souvent des images produit
                        // qui flashent avant que la vidéo charge. Fond sombre (#111) + spinner = style TikTok/Reels
                        usePoster={false}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={isActive && !paused && isFocused && !hasLoadError}
                        isLooping={false}
                        isMuted={muted}
                        useNativeControls={false}
                        progressUpdateIntervalMillis={500}
                        onPlaybackStatusUpdate={(status) => handlePlaybackStatus(contentId, index, status)}
                        onError={(error) => {
                            console.error(`[VideoFeedScreen] Erreur vidéo ${index} (${contentId}):`, error);
                            setVideoLoadErrorMap((prev) => (prev[contentId] ? prev : { ...prev, [contentId]: true }));
                            setBufferingMap((prev) => ({ ...prev, [contentId]: false }));
                        }}
                    />

                    {/* Erreur de lecture : URL expirée, 403 GCS, codec, etc. */}
                    {isActive && hasLoadError && (
                        <View style={[styles.bufferingOverlay, styles.videoErrorOverlay]} pointerEvents="none">
                            <Text style={styles.videoErrorText}>{t('videoFeed.playbackFailed')}</Text>
                        </View>
                    )}

                    {/* Spinner : chargement / buffering — pas si erreur (sinon spinner infini) */}
                    {isActive && !hasLoadError && (isBuffering || (progress === 0 && !paused && (playCount[contentId] || 0) === 0)) && (
                        <View style={styles.bufferingOverlay}>
                            <ActivityIndicator size="large" color="#fff" />
                        </View>
                    )}

                    {paused && isActive && !isBuffering && (
                        <View style={styles.pauseOverlay}>
                            <View style={styles.pauseIcon}>
                                <SafeIcon name="play" size={48} color="#fff" type="lucide" />
                            </View>
                        </View>
                    )}

                    {/* ✅ Boutons replay et commander après 2 lectures - Centrés et modernes */}
                    {!paused && isActive && !isBuffering && (playCount[contentId] || 0) >= 2 && progress >= 0.98 && (
                        <View style={styles.centeredVideoActions}>
                            {/* ✅ Bouton Commander si livraison disponible */}
                            {item.serviceId && item.hasDelivery && (
                                <TouchableOpacity
                                    style={styles.centeredDeliveryButton}
                                    onPress={() => handleDeliveryOrder(item)}
                                    activeOpacity={0.8}
                                >
                                    <SafeIcon name="shopping-cart" size={18} color="#fff" type="lucide" />
                                    <Text style={styles.centeredDeliveryText}>Commander</Text>
                                </TouchableOpacity>
                            )}

                            {/* ✅ Bouton Rejouer moderne et centré */}
                            <TouchableOpacity
                                style={styles.centeredReplayButton}
                                onPress={() => {
                                    const videoRef = videoRefs.current.get(index);
                                    if (videoRef) {
                                        playCountRef.current[contentId] = 0;
                                        setPlayCount(prev => ({ ...prev, [contentId]: 0 }));
                                        videoRef.replayAsync().catch(() => undefined);
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="rotate-cw" size={24} color="#fff" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {doubleTapHeart === contentId && (
                        <Animated.View
                            style={[
                                styles.heartAnimation,
                                {
                                    transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.4] }) }],
                                    opacity: heartAnim,
                                },
                            ]}
                        >
                            <SafeIcon name="heart" size={100} color="#FF2D55" type="lucide" />
                        </Animated.View>
                    )}
                </Pressable>

                <VideoProgressBar progress={progress} />

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
                    style={styles.bottomGradient}
                    pointerEvents="none"
                />


                {/* ✅ Header: bouton retour uniquement */}
                <View style={styles.topBar}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => (navigation as any).goBack()}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="arrow-left" size={22} color="#fff" type="lucide" />
                    </TouchableOpacity>
                    {item.isPaid && (
                        <View style={styles.sponsoredBadgeInline}>
                            <Text style={styles.sponsoredText}>Sponsorisé</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.muteButton}
                    onPress={() => toggleMute(item)}
                    activeOpacity={0.7}
                >
                    <SafeIcon
                        name={muted ? 'volume-x' : 'volume-2'}
                        size={18}
                        color="#fff"
                        type="lucide"
                    />
                </TouchableOpacity>

                <View style={styles.bottomInfo}>
                    <TouchableOpacity
                        style={styles.sellerRow}
                        onPress={() => item.serviceId && handleViewProduct(item)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.sellerAvatar}>
                            <Text style={styles.sellerAvatarText}>
                                {(item.sellerName || 'Y')[0].toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.sellerInfo}>
                            <Text style={styles.sellerName} numberOfLines={1}>
                                {item.sellerName || 'Yukpo'}
                            </Text>
                            {item.category && (
                                <Text style={styles.sellerCategory} numberOfLines={1}>
                                    {item.category}
                                </Text>
                            )}
                        </View>
                        {item.serviceId && (
                            <TouchableOpacity
                                style={[styles.followButton, followMap[String(item.serviceId)] && styles.followButtonActive]}
                                onPress={() => handleToggleFollow(item.serviceId!)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <SafeIcon
                                    name={followMap[String(item.serviceId)] ? 'check' : 'plus'}
                                    size={12}
                                    color="#fff"
                                    type="lucide"
                                />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    <Text numberOfLines={2} style={styles.title}>
                        {item.titre}
                    </Text>

                    <ProductDescriptionSection
                        description={item.description || ''}
                        contentId={contentId}
                        expandedDescriptions={expandedDescriptions}
                        onToggleDescription={toggleDescription}
                        textColor="rgba(255,255,255,0.8)"
                        seeMoreColor="#FF2D55"
                        fontSize={13}
                        maxHeightCollapsed={36}
                        maxHeightExpanded={120}
                        showSeeMoreThreshold={100}
                    />

                    {Array.isArray(item.hashtags) && item.hashtags.length > 0 && (
                        <Text style={styles.hashtags} numberOfLines={1}>
                            {item.hashtags.slice(0, 4).map(h => `#${h}`).join(' ')}
                        </Text>
                    )}
                </View>

                {/* ✅ CORRIGÉ 2026-03-18: Boutons CTA uniquement pour la vidéo active
                    Empêche le bouton "Voir produit" de rester visible sur une autre vidéo */}
                {isActive && (
                    <View style={styles.actionButtonsContainer}>
                        {item.serviceId && (
                            <TouchableOpacity
                                style={styles.ctaButton}
                                onPress={() => handleViewProduct(item)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="shopping-bag" size={14} color="#fff" type="lucide" />
                                <Text style={styles.ctaText}>Voir le produit</Text>
                            </TouchableOpacity>
                        )}

                        {/* ✅ Bouton de livraison si le service a configuré la livraison automatique */}
                        {item.serviceId && item.hasDelivery && (
                            <TouchableOpacity
                                style={styles.deliveryButton}
                                onPress={() => handleDeliveryOrder(item)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="truck" size={14} color="#fff" type="lucide" />
                                <Text style={styles.deliveryText}>Commander</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <View style={styles.actions}>
                    {/* ✅ CORRIGÉ 2026-03-14: Réaction coeur + picker flottant au-dessus */}
                    <View style={{ alignItems: 'center' }}>
                        {/* Picker de réactions flottant au-dessus du coeur */}
                        {showReactionPicker === contentId && (
                            <View style={styles.reactionPickerFloating}>
                                {REACTIONS.map((reaction) => {
                                    const itemReactions = reactionsMap[`${item.serviceId}_${item.productIndex ?? 0}`] || {};
                                    const hasReacted = itemReactions[reaction.type]?.hasReacted || false;
                                    const reactionCount = itemReactions[reaction.type]?.count || 0;
                                    return (
                                        <TouchableOpacity
                                            key={reaction.type}
                                            style={[styles.reactionPickerFloatingItem, hasReacted && styles.reactionPickerFloatingItemActive]}
                                            onPress={() => handleReaction(item, reaction.type)}
                                            activeOpacity={0.7}
                                            disabled={pendingReaction !== null}
                                        >
                                            <Text style={styles.reactionPickerFloatingEmoji}>{reaction.emoji}</Text>
                                            {reactionCount > 0 && (
                                                <Text style={[styles.reactionPickerFloatingCount, hasReacted && { color: '#3B82F6' }]}>{reactionCount}</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                                <TouchableOpacity
                                    style={styles.reactionPickerFloatingClose}
                                    onPress={() => setShowReactionPicker(null)}
                                >
                                    <SafeIcon name="x" size={12} color="#fff" type="lucide" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleReaction(item, 'love')}
                            onLongPress={() => setShowReactionPicker(showReactionPicker === contentId ? null : contentId)}
                            activeOpacity={0.7}
                            disabled={pendingReaction !== null}
                        >
                            <View style={[styles.actionIconBg, liked && styles.actionIconBgActive]}>
                                {(() => {
                                    const itemReactions = reactionsMap[`${item.serviceId}_${item.productIndex ?? 0}`] || {};
                                    const userReaction = REACTIONS.find(r => itemReactions[r.type]?.hasReacted);
                                    if (userReaction && userReaction.type !== 'love') {
                                        return <Text style={{ fontSize: 22 }}>{userReaction.emoji}</Text>;
                                    }
                                    return <SafeIcon name="heart" size={24} color={liked ? '#FF2D55' : '#fff'} type="lucide" />;
                                })()}
                            </View>
                            <Text style={styles.actionLabel}>
                                {formatCount(
                                    Object.values(reactionsMap[`${item.serviceId}_${item.productIndex ?? 0}`] || {}).reduce((sum, r) => sum + (r?.count || 0), 0)
                                    || (item.likesCount ?? 0)
                                )}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenComments(item)} activeOpacity={0.7}>
                        <View style={styles.actionIconBg}>
                            <SafeIcon name="message-circle" size={24} color="#fff" type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>{formatCount(item.commentsCount ?? 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => toggleSave(item)} activeOpacity={0.7}>
                        <View style={[styles.actionIconBg, saved && styles.actionIconBgActive]}>
                            <SafeIcon name="bookmark" size={24} color={saved ? '#FFD700' : '#fff'} type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>{formatCount((item.savesCount ?? 0) + (saved ? 1 : 0))}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)} activeOpacity={0.7}>
                        <View style={styles.actionIconBg}>
                            <SafeIcon name="share" size={22} color="#fff" type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>{t('videoFeed.partager')}</Text>
                    </TouchableOpacity>

                </View>

                {/* ✅ Disque tournant vendeur (comme TikTok) */}
                <TouchableOpacity
                    style={styles.spinningDisc}
                    onPress={() => item.serviceId && handleViewProduct(item)}
                    activeOpacity={0.8}
                >
                    <Animated.View style={[styles.spinningDiscInner, { transform: [{ rotate: isActive && !paused ? spinRotation : '0deg' }] }]}>
                        <Text style={styles.spinningDiscText}>
                            {(item.sellerName || 'Y')[0].toUpperCase()}
                        </Text>
                    </Animated.View>
                </TouchableOpacity>

                {/* ✅ SUPPRIMÉ 2026-03-14: Ancien picker horizontal en bas — remplacé par picker flottant au-dessus du coeur */}
            </View>
        );
    }, [likedMap, savedMap, pausedMap, mutedMap, progressMap, currentIndex, doubleTapHeart, heartAnim, handleTap, handleReaction, toggleSave, toggleMute, handleShare, handleViewProduct, handleOpenComments, registerRef, handlePlaybackStatus, isFocused, reactionsMap, showReactionPicker, pendingReaction, bufferingMap, videoLoadErrorMap, spinAnim, filteredFeed.length, navigation, followMap, handleToggleFollow, playCount, expandedDescriptions, toggleDescription, handleDeliveryOrder, pageHeight, t]);

    if (loading) {
        return (
            <SafeNativeView style={styles.centered}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <ActivityIndicator size="large" color="#FF2D55" />
                <Text style={styles.loadingText}>Chargement des vidéos…</Text>
            </SafeNativeView>
        );
    }

    if (!feed.length) {
        return (
            <SafeNativeView style={styles.centered}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <SafeIcon name="video-off" size={64} color="#4B5563" type="lucide" />
                <Text style={styles.emptyTitle}>Aucune vidéo disponible</Text>
                <Text style={styles.emptySubtitle}>
                    Revenez plus tard ou créez votre première vidéo.
                </Text>
                <TouchableOpacity style={styles.reloadButton} onPress={() => fetchFeed()}>
                    <SafeIcon name="refresh-cw" size={18} color="#fff" type="lucide" />
                    <Text style={styles.reloadText}>Recharger</Text>
                </TouchableOpacity>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

            {/* ✅ FIX 2026-03-14: Recherche style Facebook Reels — icône ronde → expand au clic */}
            {!searchExpanded ? (
                <TouchableOpacity
                    style={styles.searchIconButton}
                    onPress={toggleSearch}
                    activeOpacity={0.7}
                >
                    <SafeIcon name="search" size={18} color="#fff" type="lucide" />
                </TouchableOpacity>
            ) : (
                <Animated.View style={[
                    styles.searchBarContainer,
                    {
                        opacity: searchWidthAnim,
                        transform: [{
                            translateX: searchWidthAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [SCREEN_WIDTH * 0.3, 0],
                            }),
                        }],
                    },
                ]}>
                    <View style={styles.searchBar}>
                        <SafeIcon name="search" size={18} color="#9CA3AF" type="lucide" />
                        <TextInput
                            ref={searchInputRef}
                            style={styles.searchInput}
                            placeholder={t('videoFeed.rechercherDesVideos')}
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <SafeIcon name="x" size={18} color="#fff" type="lucide" />
                        </TouchableOpacity>
                    </View>
                    {searchQuery.length > 0 && filteredFeed.length === 0 && (
                        <Text style={styles.searchNoResults}>{t('videoFeed.aucuneVideoTrouvee')}</Text>
                    )}
                </Animated.View>
            )}

            <FlatList
                ref={flatListRef}
                data={filteredFeed}
                extraData={pageHeight}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                onLayout={handleListLayout}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({
                    length: pageHeight,
                    offset: pageHeight * index,
                    index,
                })}
                windowSize={3}
                maxToRenderPerBatch={2}
                removeClippedSubviews={Platform.OS === 'ios'}
                initialNumToRender={1}
                decelerationRate="fast"
                onScrollBeginDrag={() => {
                    // ✅ CORRIGÉ 2026-03-18: Pause vidéo courante dès le début du scroll
                    const ref = videoRefs.current.get(currentIndex);
                    if (ref) {
                        ref.pauseAsync().catch(() => undefined);
                    }
                }}
                onMomentumScrollEnd={(event) => {
                    const offsetY = event.nativeEvent.contentOffset.y;
                    const ph = pageHeightRef.current || 1;
                    const snappedIndex = Math.max(0, Math.min(
                        filteredFeed.length - 1,
                        Math.round(offsetY / ph)
                    ));
                    if (snappedIndex !== currentIndexRef.current) {
                        setCurrentIndex(snappedIndex);
                        currentIndexRef.current = snappedIndex;
                    }
                    forceSingleActiveVideo(snappedIndex);
                }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                    }, 200);
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#FF2D55"
                        colors={['#FF2D55']}
                        progressBackgroundColor="#1a1a1a"
                    />
                }
            />

            {/* ✅ NOUVEAU: Modal commentaires utilisant ProductCommentsSection */}
            <Modal
                visible={!!commentsModalItem}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCommentsModalItem(null)}
            >
                <View style={styles.commentsModalOverlay}>
                    <View style={styles.commentsModalContainer}>
                        <View style={styles.commentsModalHeader}>
                            <Text style={styles.commentsModalTitle}>Commentaires</Text>
                            <TouchableOpacity
                                onPress={() => setCommentsModalItem(null)}
                                style={styles.commentsModalClose}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="x" size={22} color="#374151" type="lucide" />
                            </TouchableOpacity>
                        </View>
                        {commentsModalItem?.serviceId && (
                            <ProductCommentsSection
                                serviceId={commentsModalItem.serviceId}
                                productIndex={commentsModalItem.productIndex ?? 0}
                                serviceTitle={commentsModalItem.titre}
                                mode="full"
                                compact={false}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* ✅ Modal de livraison - Même composant que ProductCard */}
            {showDeliveryModal && selectedDeliveryItem?.serviceId && (
                <OrderDeliveryModal
                    visible={showDeliveryModal}
                    onClose={() => {
                        setShowDeliveryModal(false);
                        setSelectedDeliveryItem(null);
                    }}
                    serviceId={selectedDeliveryItem.serviceId}
                    productIndex={selectedDeliveryItem.productIndex}
                    productName={selectedDeliveryItem.titre}
                    initialProductPrice={0} // ✅ CORRECTION: Mettre 0 par défaut, le prix sera récupéré depuis le service
                    onSuccess={handleDeliverySuccess}
                    clientUserId={parseInt(user?.id || '0', 10)} // ✅ CORRECTION: Convertir string en number avec base 10
                />
            )}

        </SafeNativeView>
    );
};
/* ... */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        padding: 24,
        gap: 16,
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: 15,
        fontWeight: '500',
        marginTop: 8,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 16,
    },
    emptySubtitle: {
        color: '#6B7280',
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
    },
    reloadButton: {
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 50,
        backgroundColor: '#FF2D55',
    },
    reloadText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    card: {
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    videoTouchable: {
        flex: 1,
    },
    video: {
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
        backgroundColor: '#111',
    },
    videoNative: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    poster: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        resizeMode: 'cover' as const,
    },
    pauseOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pauseIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bufferingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    videoErrorOverlay: {
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    videoErrorText: {
        color: '#fff',
        textAlign: 'center',
        paddingHorizontal: 28,
        fontSize: 15,
        lineHeight: 22,
    },
    heartAnimation: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -50,
        marginLeft: -50,
    },
    progressBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.15)',
        zIndex: 20,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FF2D55',
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 300,
    },
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        zIndex: 30,
        gap: 10,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sponsoredBadgeInline: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(255,165,0,0.6)',
    },
    sponsoredText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    muteButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 52 : 32,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
    },
    bottomInfo: {
        position: 'absolute',
        bottom: 75, // ✅ CORRIGÉ: Réduit de 160 à 75 pour rapprocher description du bouton CTA
        left: 16,
        right: 72,
        gap: 4, // ✅ CORRIGÉ: Réduit de 8 à 4 pour un espacement plus compact
        maxHeight: 280,
    },
    sellerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    sellerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FF2D55',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    sellerAvatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    sellerInfo: {
        flex: 1,
    },
    sellerName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    sellerCategory: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
    },
    followButton: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FF2D55',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    followButtonActive: {
        backgroundColor: '#34C759',
    },
    title: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    description: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        lineHeight: 18,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    hashtags: {
        color: '#FF2D55',
        fontSize: 13,
        fontWeight: '600',
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,45,85,0.95)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    ctaText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    // ✅ AJOUT: Conteneur pour les boutons d'action
    actionButtonsContainer: {
        position: 'absolute',
        bottom: 10, // ✅ FIX 2026-03-14: Juste au-dessus de la progressBar
        left: 16,
        right: 72,
        flexDirection: 'row',
        gap: 8,
        zIndex: 25,
    },
    // ✅ AJOUT: Bouton de livraison
    deliveryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(34,197,94,0.95)', // Vert pour la livraison
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    deliveryText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    actions: {
        position: 'absolute',
        right: 12,
        bottom: 80, // ✅ RÉAJUSTÉ: Plus haut pour éviter le chevauchement avec le CTA
        gap: 12,
        alignItems: 'center',
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    actionIconBg: {
        width: 40, // ✅ RÉDUIT: De 44 à 40 pour compacter
        height: 40, // ✅ RÉDUIT: De 44 à 40 pour compacter
        borderRadius: 20, // ✅ RÉDUIT: De 22 à 20 pour proportion
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconBgActive: {
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    actionLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    brandYuk: {
        color: '#3B82F6',
    },
    brandPo: {
        color: '#7C3AED',
    },
    commentsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    commentsModalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: SCREEN_HEIGHT * 0.7,
        minHeight: SCREEN_HEIGHT * 0.45,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    commentsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    commentsModalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    commentsModalClose: {
        padding: 4,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    reactionPickerFloating: {
        position: 'absolute',
        bottom: 52,
        right: -4,
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderRadius: 20,
        paddingHorizontal: 6,
        paddingVertical: 8,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    reactionPickerFloatingItem: {
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 16,
        minWidth: 44,
    },
    reactionPickerFloatingItemActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    reactionPickerFloatingEmoji: {
        fontSize: 22,
    },
    reactionPickerFloatingCount: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
        marginTop: 1,
    },
    reactionPickerFloatingClose: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    spinningDisc: {
        position: 'absolute',
        right: 12,
        bottom: 42, // ✅ FIX 2026-03-14: Remonté pour ne pas chevaucher le CTA
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinningDiscInner: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinningDiscText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    replayButton: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -60 }, { translateY: -60 }],
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 60,
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    replayText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
    },
    // ✅ NOUVEAUX STYLES POUR BOUTONS CENTRÉS ET MODERNES
    centeredVideoActions: {
        position: 'absolute',
        top: '45%',
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        zIndex: 35,
    },
    centeredDeliveryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 30,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    centeredDeliveryText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    centeredReplayButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    // ✅ FIX 2026-03-14: Bouton rond de recherche style Facebook Reels
    searchIconButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 52 : 32,
        right: 60,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    searchBarContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 52 : 32,
        left: 60,
        right: 16,
        zIndex: 100,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    searchNoResults: {
        color: '#EF4444',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 6,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});

export default VideoFeedScreen;



