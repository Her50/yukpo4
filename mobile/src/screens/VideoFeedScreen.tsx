import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
} from 'react-native';
import ProductCommentsSection from '../components/ProductCommentsSection';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../services/api';
import { mediaService } from '../services/mediaService';

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
};

const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
};

const normalizeVideoUrl = (url: any): string | null => {
    if (!url) return null;
    const urlStr = typeof url === 'string' ? url : String(url);
    if (!urlStr || typeof urlStr !== 'string') return null;
    const trimmed = urlStr.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return trimmed;
    }
    return mediaService.getVideoUrl(trimmed) || trimmed;
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
    if (!Array.isArray(raw)) {
        console.warn('[VideoFeedScreen] normalizeFeed: raw n\'est pas un tableau', typeof raw, raw);
        return [];
    }
    return raw
        .map((item, index) => {
            // ✅ CORRIGÉ 2026-03-04: Chercher la vidéo dans tous les formats possibles
            const rawVideo =
                item?.videoUrl ||
                item?.video ||
                item?.data?.videoUrl ||
                item?.data?.video ||
                extractVideoFromField(item?.data?.videos) ||
                extractVideoFromField(item?.videos);
            if (!rawVideo) return null;

            const video = normalizeVideoUrl(rawVideo);
            if (!video) return null;

            const title =
                item?.titre ||
                item?.title ||
                item?.data?.titre ||
                item?.data?.title ||
                `Vidéo ${index + 1}`;
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

            return {
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
            } as FeedItem;
        })
        .filter((item): item is FeedItem => item !== null && item !== undefined) as FeedItem[];
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

const VideoFeedScreen: React.FC = ({ route }: any) => {
    const navigation = useNavigation();
    const { user } = useAuth();
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
    const [doubleTapHeart, setDoubleTapHeart] = useState<string | null>(null);
    const [commentsModalItem, setCommentsModalItem] = useState<FeedItem | null>(null);
    const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, { count: number; hasReacted: boolean }>>>({});
    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const [pendingReaction, setPendingReaction] = useState<string | null>(null);
    const [bufferingMap, setBufferingMap] = useState<Record<string, boolean>>({});
    const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const viewedSet = useRef<Set<string>>(new Set());
    const spinAnim = useRef(new Animated.Value(0)).current;
    const videoRefs = useRef<Map<number, Video | null>>(new Map());
    const flatListRef = useRef<FlatList>(null);
    const lastTapRef = useRef<Record<string, number>>({});
    const heartAnim = useRef(new Animated.Value(0)).current;

    const fetchFeed = useCallback(async (isRefresh = false, pageNum = 1) => {
        if (!isRefresh && pageNum === 1) setLoading(true);
        try {
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const endpoint = showOnlyMyVideos
                ? '/api/videos/my-videos'
                : `/api/content/mixed?limit=20&page=${pageNum}&format=video${userIdParam}`;
            const response = await apiGet(endpoint);
            let data = response?.data;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                data = data.data || data.items || [];
            } else if (!data || !Array.isArray(data)) {
                data = response?.items || [];
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
                Alert.alert('Vidéos indisponibles', "Impossible de charger les vidéos pour l'instant.");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showOnlyMyVideos, user?.id]);

    useEffect(() => { fetchFeed(); }, [fetchFeed]);

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

    useEffect(() => {
        const item = feed[currentIndex];
        if (item?.serviceId) {
            checkFollowStatus(item.serviceId);
        }
    }, [currentIndex, feed, checkFollowStatus]);

    const handleToggleFollow = useCallback(async (serviceId: string | number) => {
        if (!serviceId || !user?.id) {
            Alert.alert('Connexion requise', 'Connectez-vous pour suivre ce vendeur.');
            return;
        }
        const key = String(serviceId);
        const wasFollowing = followMap[key] || false;
        // Optimistic update
        setFollowMap((prev) => ({ ...prev, [key]: !wasFollowing }));
        try {
            const res = await apiPost(`/api/services/${key}/follow`, {});
            const data = res?.data as any;
            if (data?.success) {
                setFollowMap((prev) => ({ ...prev, [key]: data.is_following }));
            }
        } catch {
            // Revert on error
            setFollowMap((prev) => ({ ...prev, [key]: wasFollowing }));
        }
    }, [user?.id, followMap]);

    // ✅ View tracking: comptabiliser la vue quand vidéo active pendant >2s
    useEffect(() => {
        const currentItem = feed[currentIndex];
        if (!currentItem || !isFocused) return;
        const contentId = currentItem.contentId || currentItem.id;
        if (viewedSet.current.has(contentId)) return;

        const timer = setTimeout(() => {
            viewedSet.current.add(contentId);
            apiPost(`/api/content/${contentId}/engagement`, { action: 'view' }).catch(() => undefined);
        }, 2000);
        return () => clearTimeout(timer);
    }, [currentIndex, feed, isFocused]);

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

    const handleViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
            const nextIndex = viewableItems[0]?.index ?? 0;
            if (nextIndex === currentIndex) return;
            setCurrentIndex(nextIndex);
        },
        [currentIndex],
    );

    // ✅ CORRIGÉ: Pause/play basé sur currentIndex ET focus de l'écran
    useEffect(() => {
        videoRefs.current.forEach((ref, index) => {
            if (!ref) return;
            const item = feed[index];
            const contentId = item?.contentId || item?.id;
            const isPaused = contentId ? (pausedMap[contentId] ?? false) : false;
            if (index === currentIndex && !isPaused && isFocused) {
                ref.playAsync().catch(() => undefined);
            } else {
                ref.pauseAsync().catch(() => undefined);
            }
        });
    }, [currentIndex, pausedMap, feed, isFocused]);

    // ✅ CORRIGÉ: Arrêter toutes les vidéos quand on quitte l'écran
    useFocusEffect(
        useCallback(() => {
            return () => {
                // Cleanup: pause toutes les vidéos en quittant
                videoRefs.current.forEach((ref) => {
                    if (ref) {
                        ref.pauseAsync().catch(() => undefined);
                        ref.setStatusAsync({ shouldPlay: false }).catch(() => undefined);
                    }
                });
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
            if (response && response.success && response.data) {
                const reactionsData: Record<string, { count: number; hasReacted: boolean }> = {};
                const reactionsArray = Array.isArray(response.data) ? response.data : [];
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

    // ✅ Charger les réactions quand la vidéo visible change
    useEffect(() => {
        const currentItem = feed[currentIndex];
        if (currentItem?.serviceId) {
            loadReactionsForItem(currentItem);
        }
    }, [currentIndex, feed, loadReactionsForItem]);

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
        try {
            const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpo-backend-376093909298.europe-west1.run.app';
            const shareUrl = item.serviceId
                ? `${SHARE_BASE_URL}/product/${item.serviceId}_${item.productIndex ?? 0}`
                : item.videoUrl;

            let shareText = `🎬 ${item.titre}`;
            if (item.description) shareText += `\n\n${item.description}`;
            if (item.sellerName) shareText += `\n🏪 ${item.sellerName}`;
            shareText += `\n\n🔗 Voir sur Yukpo:\n${shareUrl}`;

            await Share.share({ message: shareText, url: shareUrl, title: item.titre });
        } catch (error) {
            console.warn('[VideoFeedScreen] Share error', error);
        }
    }, []);

    const handleViewProduct = useCallback((item: FeedItem) => {
        if (item.serviceId) {
            (navigation as any).navigate('ServiceDetailShared', { serviceId: item.serviceId });
        } else {
            Alert.alert('Information', 'Aucun produit associé à cette vidéo.');
        }
    }, [navigation]);

    const handleOpenComments = useCallback((item: FeedItem) => {
        if (item.serviceId) {
            setCommentsModalItem(item);
        } else {
            Alert.alert('Commentaires', 'Les commentaires ne sont pas disponibles pour cette vidéo.');
        }
    }, []);

    const handlePlaybackStatus = useCallback((contentId: string, index: number, status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            // ✅ Détecter le buffering avant le chargement
            setBufferingMap((prev) => {
                if (prev[contentId] === true) return prev;
                return { ...prev, [contentId]: true };
            });
            return;
        }

        // ✅ Tracker l'état de buffering
        const isBuffering = status.isBuffering || false;
        setBufferingMap((prev) => {
            if (prev[contentId] === isBuffering) return prev;
            return { ...prev, [contentId]: isBuffering };
        });

        if (status.durationMillis && status.durationMillis > 0) {
            const progress = status.positionMillis / status.durationMillis;
            setProgressMap((prev) => {
                if (Math.abs((prev[contentId] || 0) - progress) < 0.01) return prev;
                return { ...prev, [contentId]: progress };
            });

            // ✅ Auto-scroll vers la vidéo suivante quand la vidéo se termine
            if (status.didJustFinish && !status.isLooping) {
                const nextIndex = index + 1;
                if (nextIndex < feed.length) {
                    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                }
            }
        }
    }, [feed.length]);

    const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
        const contentId = item.contentId || item.id;
        const liked = likedMap[contentId] ?? false;
        const saved = savedMap[contentId] ?? false;
        const paused = pausedMap[contentId] ?? false;
        const muted = mutedMap[contentId] ?? false;
        const progress = progressMap[contentId] ?? 0;
        const isActive = index === currentIndex;
        const isBuffering = bufferingMap[contentId] ?? false;
        const spinRotation = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

        return (
            <View style={styles.card}>
                <Pressable style={styles.videoTouchable} onPress={() => handleTap(item)}>
                    <Video
                        ref={(ref) => registerRef(index, ref)}
                        style={styles.video}
                        source={{ uri: item.videoUrl }}
                        posterSource={item.thumbnail ? { uri: item.thumbnail } : undefined}
                        posterStyle={styles.poster}
                        usePoster={!!item.thumbnail}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={isActive && !paused && isFocused}
                        isLooping={false}
                        isMuted={muted}
                        useNativeControls={false}
                        onPlaybackStatusUpdate={(status) => handlePlaybackStatus(contentId, index, status)}
                        onError={(error) => console.error(`[VideoFeedScreen] Erreur vidéo ${index}:`, error)}
                    />

                    {/* ✅ Buffering spinner (comme TikTok) */}
                    {isBuffering && isActive && (
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

                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                </View>

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
                    style={styles.bottomGradient}
                    pointerEvents="none"
                />

                {/* ✅ Header: bouton retour + compteur vidéo (comme TikTok) */}
                <View style={styles.topBar}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => (navigation as any).goBack()}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="arrow-left" size={22} color="#fff" type="lucide" />
                    </TouchableOpacity>
                    <View style={styles.videoCounter}>
                        <Text style={styles.videoCounterText}>{index + 1}/{feed.length}</Text>
                    </View>
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
                    {item.description ? (
                        <Text numberOfLines={2} style={styles.description}>
                            {item.description}
                        </Text>
                    ) : null}

                    {Array.isArray(item.hashtags) && item.hashtags.length > 0 && (
                        <Text style={styles.hashtags} numberOfLines={1}>
                            {item.hashtags.slice(0, 4).map(h => `#${h}`).join(' ')}
                        </Text>
                    )}

                    {item.serviceId && (
                        <TouchableOpacity
                            style={styles.ctaButton}
                            onPress={() => handleViewProduct(item)}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="shopping-bag" size={16} color="#fff" type="lucide" />
                            <Text style={styles.ctaText}>Voir le produit</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.actions}>
                    {/* ✅ Réaction coeur: tap = love, long-press = picker multi-réactions */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleReaction(item, 'love')}
                        onLongPress={() => setShowReactionPicker(contentId)}
                        activeOpacity={0.7}
                        disabled={pendingReaction !== null}
                    >
                        <View style={[styles.actionIconBg, liked && styles.actionIconBgActive]}>
                            <SafeIcon name="heart" size={28} color={liked ? '#FF2D55' : '#fff'} type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>
                            {formatCount(
                                Object.values(reactionsMap[`${item.serviceId}_${item.productIndex ?? 0}`] || {}).reduce((sum, r) => sum + (r?.count || 0), 0)
                                || (item.likesCount ?? 0)
                            )}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenComments(item)} activeOpacity={0.7}>
                        <View style={styles.actionIconBg}>
                            <SafeIcon name="message-circle" size={28} color="#fff" type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>{formatCount(item.commentsCount ?? 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => toggleSave(item)} activeOpacity={0.7}>
                        <View style={[styles.actionIconBg, saved && styles.actionIconBgActive]}>
                            <SafeIcon name="bookmark" size={28} color={saved ? '#FFD700' : '#fff'} type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>{formatCount((item.savesCount ?? 0) + (saved ? 1 : 0))}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)} activeOpacity={0.7}>
                        <View style={styles.actionIconBg}>
                            <SafeIcon name="send" size={26} color="#fff" type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>Partager</Text>
                    </TouchableOpacity>
                </View>

                {/* ✅ Disque tournant vendeur (comme TikTok) */}
                <Animated.View style={[styles.spinningDisc, { transform: [{ rotate: isActive && !paused ? spinRotation : '0deg' }] }]}>
                    <View style={styles.spinningDiscInner}>
                        <Text style={styles.spinningDiscText}>
                            {(item.sellerName || 'Y')[0].toUpperCase()}
                        </Text>
                    </View>
                </Animated.View>

                {/* ✅ Picker multi-réactions (apparaît au long-press sur coeur) */}
                {showReactionPicker === contentId && (
                    <View style={styles.reactionPickerContainer}>
                        <View style={styles.reactionPicker}>
                            {REACTIONS.map((reaction) => {
                                const itemReactions = reactionsMap[`${item.serviceId}_${item.productIndex ?? 0}`] || {};
                                const hasReacted = itemReactions[reaction.type]?.hasReacted || false;
                                return (
                                    <TouchableOpacity
                                        key={reaction.type}
                                        style={[styles.reactionPickerItem, hasReacted && styles.reactionPickerItemActive]}
                                        onPress={() => handleReaction(item, reaction.type)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.reactionPickerEmoji}>{reaction.emoji}</Text>
                                        {itemReactions[reaction.type]?.count > 0 && (
                                            <Text style={styles.reactionPickerCount}>{itemReactions[reaction.type].count}</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity
                            style={styles.reactionPickerClose}
                            onPress={() => setShowReactionPicker(null)}
                        >
                            <SafeIcon name="x" size={16} color="#fff" type="lucide" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }, [likedMap, savedMap, pausedMap, mutedMap, progressMap, currentIndex, doubleTapHeart, heartAnim, handleTap, handleReaction, toggleSave, toggleMute, handleShare, handleViewProduct, handleOpenComments, registerRef, handlePlaybackStatus, isFocused, reactionsMap, showReactionPicker, pendingReaction, bufferingMap, spinAnim, feed.length, navigation, followMap, handleToggleFollow]);

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
            <FlatList
                ref={flatListRef}
                data={feed}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({
                    length: SCREEN_HEIGHT,
                    offset: SCREEN_HEIGHT * index,
                    index,
                })}
                windowSize={3}
                maxToRenderPerBatch={2}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={1}
                decelerationRate="fast"
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
        </SafeNativeView>
    );
};

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
    },
    videoTouchable: {
        flex: 1,
    },
    video: {
        height: '100%',
        width: '100%',
        backgroundColor: '#111',
    },
    poster: {
        height: '100%',
        width: '100%',
        resizeMode: 'cover',
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
        backgroundColor: 'rgba(0,0,0,0.15)',
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
    videoCounter: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    videoCounterText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
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
        bottom: 40,
        left: 16,
        right: 72,
        gap: 6,
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
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 50,
        backgroundColor: 'rgba(255,45,85,0.9)',
        marginTop: 4,
    },
    ctaText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    actions: {
        position: 'absolute',
        right: 8,
        bottom: 60,
        gap: 16,
        alignItems: 'center',
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    actionIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
    reactionPickerContainer: {
        position: 'absolute',
        right: 64,
        bottom: 160,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    reactionPicker: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderRadius: 30,
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 4,
    },
    reactionPickerItem: {
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 20,
    },
    reactionPickerItemActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    reactionPickerEmoji: {
        fontSize: 24,
    },
    reactionPickerCount: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
        marginTop: 1,
    },
    reactionPickerClose: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinningDisc: {
        position: 'absolute',
        right: 10,
        bottom: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinningDiscInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinningDiscText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
});

export default VideoFeedScreen;



