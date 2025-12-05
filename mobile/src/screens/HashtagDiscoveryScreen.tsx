/**
 * Page de découverte par hashtag
 * Affiche les vidéos d'un hashtag spécifique avec tri (récent, populaire, tendance)
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface VideoItem {
    id: string;
    content_id: string;
    titre: string;
    video_url: string;
    thumbnail?: string;
    service_id?: number;
    likes: number;
    saves: number;
    views: number;
    created_at: string;
    hashtags: string[];
}

interface HashtagInfo {
    tag: string;
    video_count: number;
    view_count: number;
    like_count: number;
    trend_score: number;
    is_trending: boolean;
}

const HashtagDiscoveryScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const hashtag = (route.params as any)?.hashtag || '';

    const [loading, setLoading] = useState(true);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [hashtagInfo, setHashtagInfo] = useState<HashtagInfo | null>(null);
    const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent');
    const [refreshing, setRefreshing] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const loadVideos = useCallback(async (reset = false) => {
        try {
            if (reset) {
                setLoading(true);
                setOffset(0);
            }

            const currentOffset = reset ? 0 : offset;
            // ✅ SCALABILITÉ: Limiter à 50 max par requête
            const response = await apiGet(
                `/api/hashtags/${encodeURIComponent(hashtag)}/videos?sort=${sortBy}&limit=50&offset=${currentOffset}`
            );

            if (response.success && response.data) {
                const newVideos = response.data.data || [];
                const total = response.data.total || 0;

                if (reset) {
                    setVideos(newVideos);
                } else {
                    setVideos((prev) => [...prev, ...newVideos]);
                }

                // ✅ SCALABILITÉ: Vérifier si plus de résultats disponibles
                setHasMore(newVideos.length === 50 && (currentOffset + newVideos.length) < total);
                setOffset(currentOffset + newVideos.length);
            }
        } catch (error) {
            console.error('[HashtagDiscovery] Erreur chargement vidéos:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [hashtag, sortBy, offset]);

    const loadHashtagInfo = useCallback(async () => {
        try {
            const response = await apiGet(`/api/hashtags/search?q=${encodeURIComponent(hashtag)}&limit=1`);
            if (response.success && response.data && response.data.length > 0) {
                setHashtagInfo(response.data[0]);
            }
        } catch (error) {
            console.error('[HashtagDiscovery] Erreur chargement info hashtag:', error);
        }
    }, [hashtag]);

    useEffect(() => {
        if (hashtag) {
            loadHashtagInfo();
            loadVideos(true);
        }
    }, [hashtag, sortBy]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadVideos(true);
        loadHashtagInfo();
    }, [loadVideos, loadHashtagInfo]);

    const handleSortChange = useCallback((newSort: 'recent' | 'popular' | 'trending') => {
        setSortBy(newSort);
    }, []);

    const formatCount = (value: number): string => {
        if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(1)}M`;
        }
        if (value >= 1_000) {
            return `${(value / 1_000).toFixed(1)}k`;
        }
        return `${value}`;
    };

    const renderVideoItem = useCallback(
        ({ item }: { item: VideoItem }) => (
            <TouchableOpacity
                style={styles.videoCard}
                onPress={() => {
                    // Naviguer vers VideoFeed avec cette vidéo en focus
                    (navigation as any).navigate('VideoFeed', { initialVideoId: item.id });
                }}
            >
                {item.thumbnail ? (
                    <View style={styles.thumbnailContainer}>
                        <Text style={styles.thumbnailPlaceholder}>📹</Text>
                    </View>
                ) : (
                    <View style={styles.thumbnailContainer}>
                        <Text style={styles.thumbnailPlaceholder}>📹</Text>
                    </View>
                )}
                <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>
                        {item.titre}
                    </Text>
                    <View style={styles.videoStats}>
                        <View style={styles.stat}>
                            <SafeIcon name="eye" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>{formatCount(item.views)}</Text>
                        </View>
                        <View style={styles.stat}>
                            <SafeIcon name="heart" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>{formatCount(item.likes)}</Text>
                        </View>
                        <View style={styles.stat}>
                            <SafeIcon name="bookmark" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>{formatCount(item.saves)}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        ),
        [navigation]
    );

    return (
        <SafeNativeView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.hashtagTitle}>
                        {hashtag.startsWith('#') ? hashtag : `#${hashtag}`}
                    </Text>
                    {hashtagInfo && (
                        <Text style={styles.hashtagSubtitle}>
                            {formatCount(hashtagInfo.video_count)} vidéos
                            {hashtagInfo.is_trending && ' • 🔥 Tendance'}
                        </Text>
                    )}
                </View>
            </View>

            {/* Filtres de tri */}
            <View style={styles.sortContainer}>
                {(['recent', 'popular', 'trending'] as const).map((sort) => (
                    <TouchableOpacity
                        key={sort}
                        style={[styles.sortButton, sortBy === sort && styles.sortButtonActive]}
                        onPress={() => handleSortChange(sort)}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                styles.sortButtonText,
                                sortBy === sort && styles.sortButtonTextActive,
                            ]}
                        >
                            {sort === 'recent' ? 'Récent' : sort === 'popular' ? 'Populaire' : 'Tendance'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Liste des vidéos */}
            {loading && videos.length === 0 ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loaderText}>Chargement des vidéos...</Text>
                </View>
            ) : videos.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="video-off" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyTitle}>Aucune vidéo trouvée</Text>
                    <Text style={styles.emptySubtitle}>
                        Aucune vidéo n'utilise ce hashtag pour le moment.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={videos}
                    renderItem={renderVideoItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    onEndReached={() => {
                        if (hasMore && !loading) {
                            loadVideos(false);
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loading && videos.length > 0 ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : null
                    }
                />
            )}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
    },
    hashtagTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    hashtagSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    sortContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    sortButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
    },
    sortButtonActive: {
        backgroundColor: modernColors.primary,
    },
    sortButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    sortButtonTextActive: {
        color: '#FFF',
    },
    listContent: {
        padding: 8,
    },
    videoCard: {
        flex: 1,
        margin: 4,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        overflow: 'hidden',
    },
    thumbnailContainer: {
        width: '100%',
        aspectRatio: 9 / 16,
        backgroundColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailPlaceholder: {
        fontSize: 32,
    },
    videoInfo: {
        padding: 12,
    },
    videoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    videoStats: {
        flexDirection: 'row',
        gap: 12,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loaderText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    emptySubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default HashtagDiscoveryScreen;

