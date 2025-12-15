import { useNavigation } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Share,
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
import { modernColors } from '../theme/modernTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type FeedItem = {
    id: string;
    titre: string;
    description?: string;
    videoUrl: string;
    thumbnail?: string;
    contentId: string;
    likesCount?: number;
    savesCount?: number;
};

const normalizeFeed = (raw: any[]): FeedItem[] =>
    (raw || [])
        .map((item, index) => {
            const video =
                item?.videoUrl ||
                item?.video ||
                item?.data?.video ||
                item?.data?.videos?.[0];
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
            return {
                id: String(id),
                contentId: String(item?.content_id || id),
                titre: String(title),
                description: item?.description || item?.data?.description,
                videoUrl: video,
                thumbnail:
                    item?.thumbnail ||
                    item?.cover ||
                    item?.data?.thumbnail ||
                    item?.data?.cover,
                likesCount: Number(
                    item?.likes ??
                        item?.data?.likes ??
                        item?.stats?.likes ??
                        0,
                ),
                savesCount: Number(
                    item?.saves ??
                        item?.data?.saves ??
                        item?.stats?.saves ??
                        0,
                ),
            } as FeedItem;
        })
        .filter(Boolean) as FeedItem[];

const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 200,
};

const VideoFeedScreen: React.FC = ({ route }: any) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const showOnlyMyVideos = route?.params?.showOnlyMyVideos || false;

    const [loading, setLoading] = useState(true);
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
    const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
    const videoRefs = useRef<Map<number, Video | null>>(new Map());

    const fetchFeed = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = showOnlyMyVideos
                ? '/api/videos/my-videos'
                : '/api/content/mixed?limit=30&format=video';
            const response = await apiGet(endpoint);
            const data = response?.data || response?.items || [];
            const normalized = normalizeFeed(data);
            setFeed(normalized);
            setLikedMap({});
            setSavedMap({});
        } catch (error) {
            console.error('[VideoFeedScreen] Erreur chargement feed', error);
            Alert.alert(
                'Vidéos indisponibles',
                "Impossible de charger les vidéos pour l'instant.",
            );
        } finally {
            setLoading(false);
        }
    }, [showOnlyMyVideos]);

    useEffect(() => {
        fetchFeed();
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
            if (index === currentIndex) {
                ref.playAsync().catch(() => undefined);
            } else {
                ref.pauseAsync().catch(() => undefined);
            }
        });
    }, [currentIndex]);

    const toggleLike = async (item: FeedItem) => {
        const contentId = item.contentId || item.id;
        setLikedMap((prev) => ({
            ...prev,
            [contentId]: !prev[contentId],
        }));
        try {
            await apiPost('/api/content/engagement', {
                content_id: contentId,
                action: 'like',
            });
        } catch (error) {
            console.warn('[VideoFeedScreen] Like error', error);
        }
    };

    const toggleSave = async (item: FeedItem) => {
        const contentId = item.contentId || item.id;
        setSavedMap((prev) => ({
            ...prev,
            [contentId]: !prev[contentId],
        }));
        try {
            await apiPost('/api/content/engagement', {
                content_id: contentId,
                action: 'save',
            });
        } catch (error) {
            console.warn('[VideoFeedScreen] Save error', error);
        }
    };

    const handleShare = async (item: FeedItem) => {
        try {
            await Share.share({
                message: item.videoUrl,
                url: item.videoUrl,
                title: item.titre,
            });
        } catch (error) {
            console.warn('[VideoFeedScreen] Share error', error);
        }
    };

    const renderItem = ({ item, index }: { item: FeedItem; index: number }) => {
        const contentId = item.contentId || item.id;
        const liked = likedMap[contentId] ?? false;
        const saved = savedMap[contentId] ?? false;
        return (
            <View style={styles.card}>
                <Video
                    ref={(ref) => registerRef(index, ref)}
                    style={styles.video}
                    source={{ uri: item.videoUrl }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={index === currentIndex}
                    isLooping
                    useNativeControls={false}
                />
                <View style={styles.overlay}>
                    <Text numberOfLines={2} style={styles.title}>
                        {item.titre}
                    </Text>
                    {item.description ? (
                        <Text numberOfLines={2} style={styles.description}>
                            {item.description}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => toggleLike(item)}
                    >
                        <SafeIcon
                            name="heart"
                            size={24}
                            color={liked ? modernColors.primary : '#fff'}
                            type="lucide"
                        />
                        <Text style={styles.actionLabel}>
                            {(item.likesCount ?? 0) + (liked ? 1 : 0)}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => toggleSave(item)}
                    >
                        <SafeIcon
                            name="bookmark"
                            size={24}
                            color={saved ? modernColors.primary : '#fff'}
                            type="lucide"
                        />
                        <Text style={styles.actionLabel}>
                            {(item.savesCount ?? 0) + (saved ? 1 : 0)}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleShare(item)}
                    >
                        <SafeIcon name="share" size={24} color="#fff" type="lucide" />
                        <Text style={styles.actionLabel}>Partager</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.centered}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des vidéos…</Text>
            </SafeNativeView>
        );
    }

    if (!feed.length) {
        return (
            <SafeNativeView style={styles.centered}>
                <Text style={styles.emptyTitle}>Aucune vidéo disponible</Text>
                <Text style={styles.emptySubtitle}>
                    Revenez plus tard ou créez votre première vidéo.
                </Text>
                <TouchableOpacity
                    style={styles.reloadButton}
                    onPress={fetchFeed}
                >
                    <Text style={styles.reloadText}>Recharger</Text>
                </TouchableOpacity>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
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
        gap: 12,
    },
    loadingText: {
        color: '#E5E7EB',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptySubtitle: {
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 6,
    },
    reloadButton: {
        marginTop: 16,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: modernColors.primary,
    },
    reloadText: {
        color: '#fff',
        fontWeight: '700',
    },
    card: {
        height: SCREEN_HEIGHT,
        width: '100%',
        backgroundColor: '#000',
    },
    video: {
        height: '100%',
        width: '100%',
        backgroundColor: '#000',
    },
    overlay: {
        position: 'absolute',
        bottom: 110,
        left: 16,
        right: 100,
        gap: 6,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    description: {
        color: '#E5E7EB',
        fontSize: 14,
    },
    actions: {
        position: 'absolute',
        right: 16,
        bottom: 80,
        gap: 12,
        alignItems: 'center',
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    actionLabel: {
        color: '#fff',
        fontWeight: '600',
    },
});

export default VideoFeedScreen;


