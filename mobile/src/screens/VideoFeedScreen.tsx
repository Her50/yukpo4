import { useNavigation } from '@react-navigation/native';
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

const normalizeFeed = (raw: any[]): FeedItem[] => {
    if (!Array.isArray(raw)) {
        console.warn('[VideoFeedScreen] normalizeFeed: raw n\'est pas un tableau', typeof raw, raw);
        return [];
    }
    return raw
        .map((item, index) => {
            const rawVideo =
                item?.videoUrl ||
                item?.video ||
                item?.data?.video ||
                item?.data?.videos?.[0];
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
                sellerName: item?.seller_name || item?.data?.seller_name || item?.data?.titre_service || item?.data?.titre?.valeur,
                sellerAvatar: item?.seller_avatar || item?.data?.seller_avatar,
                category: item?.category || item?.data?.category,
                hashtags: item?.hashtags || item?.data?.hashtags || [],
            } as FeedItem;
        })
        .filter((item): item is FeedItem => item !== null && item !== undefined) as FeedItem[];
};

const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 200,
};

const VideoFeedScreen: React.FC = ({ route }: any) => {
    const navigation = useNavigation();
    const { user } = useAuth();
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
    const videoRefs = useRef<Map<number, Video | null>>(new Map());
    const lastTapRef = useRef<Record<string, number>>({});
    const heartAnim = useRef(new Animated.Value(0)).current;

    const fetchFeed = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const endpoint = showOnlyMyVideos
                ? '/api/videos/my-videos'
                : '/api/content/mixed?limit=30&format=video';
            const response = await apiGet(endpoint);
            let data = response?.data;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                data = data.data || data.items || [];
            } else if (!data || !Array.isArray(data)) {
                data = response?.items || [];
            }
            const normalized = normalizeFeed(data);
            console.log(`[VideoFeedScreen] Feed chargé: ${normalized.length} vidéos`);
            setFeed(normalized);
            setLikedMap({});
            setSavedMap({});
            setPausedMap({});
            setProgressMap({});
        } catch (error) {
            console.error('[VideoFeedScreen] Erreur chargement feed', error);
            if (!isRefresh) {
                Alert.alert('Vidéos indisponibles', "Impossible de charger les vidéos pour l'instant.");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showOnlyMyVideos]);

    useEffect(() => { fetchFeed(); }, [fetchFeed]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchFeed(true);
    }, [fetchFeed]);

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

    useEffect(() => {
        videoRefs.current.forEach((ref, index) => {
            if (!ref) return;
            const item = feed[index];
            const contentId = item?.contentId || item?.id;
            const isPaused = contentId ? (pausedMap[contentId] ?? false) : false;
            if (index === currentIndex && !isPaused) {
                ref.playAsync().catch(() => undefined);
            } else {
                ref.pauseAsync().catch(() => undefined);
            }
        });
    }, [currentIndex, pausedMap, feed]);

    const animateHeart = useCallback((contentId: string) => {
        setDoubleTapHeart(contentId);
        heartAnim.setValue(0);
        Animated.sequence([
            Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
            Animated.timing(heartAnim, { toValue: 0, duration: 400, delay: 300, useNativeDriver: true }),
        ]).start(() => setDoubleTapHeart(null));
    }, [heartAnim]);

    const handleTap = useCallback((item: FeedItem) => {
        const contentId = item.contentId || item.id;
        const now = Date.now();
        const lastTap = lastTapRef.current[contentId] || 0;

        if (now - lastTap < 300) {
            // Double-tap → Like
            if (!likedMap[contentId]) {
                setLikedMap((prev) => ({ ...prev, [contentId]: true }));
                apiPost(`/api/content/${contentId}/engagement`, { action: 'like', set: true }).catch(() => undefined);
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) { }
            }
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
    }, [likedMap, animateHeart]);

    const toggleLike = useCallback(async (item: FeedItem) => {
        const contentId = item.contentId || item.id;
        const newState = !likedMap[contentId];
        setLikedMap((prev) => ({ ...prev, [contentId]: newState }));
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
        try {
            await apiPost(`/api/content/${contentId}/engagement`, { action: 'like', set: newState });
        } catch (error) {
            console.warn('[VideoFeedScreen] Like error', error);
        }
    }, [likedMap]);

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
                ? `${SHARE_BASE_URL}/service/${item.serviceId}`
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
            (navigation as any).navigate('ServiceDetail', { serviceId: item.serviceId });
        }
    }, [navigation]);

    const handlePlaybackStatus = useCallback((contentId: string, status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        if (status.durationMillis && status.durationMillis > 0) {
            const progress = status.positionMillis / status.durationMillis;
            setProgressMap((prev) => {
                if (Math.abs((prev[contentId] || 0) - progress) < 0.01) return prev;
                return { ...prev, [contentId]: progress };
            });
        }
    }, []);

    const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
        const contentId = item.contentId || item.id;
        const liked = likedMap[contentId] ?? false;
        const saved = savedMap[contentId] ?? false;
        const paused = pausedMap[contentId] ?? false;
        const muted = mutedMap[contentId] ?? false;
        const progress = progressMap[contentId] ?? 0;
        const isActive = index === currentIndex;

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
                        shouldPlay={isActive && !paused}
                        isLooping
                        isMuted={muted}
                        useNativeControls={false}
                        onPlaybackStatusUpdate={(status) => handlePlaybackStatus(contentId, status)}
                        onError={(error) => console.error(`[VideoFeedScreen] Erreur vidéo ${index}:`, error)}
                    />

                    {paused && isActive && (
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

                {item.isPaid && (
                    <View style={styles.sponsoredBadge}>
                        <Text style={styles.sponsoredText}>Sponsorisé</Text>
                    </View>
                )}

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
                    <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(item)} activeOpacity={0.7}>
                        <View style={[styles.actionIconBg, liked && styles.actionIconBgActive]}>
                            <SafeIcon name="heart" size={28} color={liked ? '#FF2D55' : '#fff'} type="lucide" />
                        </View>
                        <Text style={styles.actionLabel}>{formatCount((item.likesCount ?? 0) + (liked ? 1 : 0))}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => { }} activeOpacity={0.7}>
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
            </View>
        );
    }, [likedMap, savedMap, pausedMap, mutedMap, progressMap, currentIndex, doubleTapHeart, heartAnim, handleTap, toggleLike, toggleSave, toggleMute, handleShare, handleViewProduct, registerRef, handlePlaybackStatus]);

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
                <TouchableOpacity style={styles.reloadButton} onPress={fetchFeed}>
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
    sponsoredBadge: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    sponsoredText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    muteButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomInfo: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 80,
        gap: 8,
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
        fontSize: 15,
        fontWeight: '700',
    },
    sellerCategory: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '500',
    },
    title: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
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
        right: 12,
        bottom: 100,
        gap: 20,
        alignItems: 'center',
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    actionIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
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
});

export default VideoFeedScreen;



