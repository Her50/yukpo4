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
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    const { t } = useLanguageSafe();
    const route = useRoute();
    const rawTag = (route.params as any)?.hashtag ?? '';
    const hasTag = String(rawTag || '')
        .trim()
        .replace(/^#/, '');

    const [loading, setLoading] = useState(true);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [hashtagInfo, setHashtagInfo] = useState<HashtagInfo | null>(null);
    const [trendingTags, setTrendingTags] = useState<HashtagInfo[]>([]);
    const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent');
    const [refreshing, setRefreshing] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const loadTrendingHashtags = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiGet('/api/hashtags/search', {
                params: { limit: 40, trending: true },
            });
            const body: any = response.data;
            const list: HashtagInfo[] = Array.isArray(body?.data) ? body.data : [];
            setTrendingTags(list);
        } catch (error) {
            console.error('[HashtagDiscovery] Erreur tendances:', error);
            setTrendingTags([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const loadVideos = useCallback(async (reset = false) => {
        if (!hasTag) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        try {
            if (reset) {
                setLoading(true);
                setOffset(0);
            }

            const currentOffset = reset ? 0 : offset;
            const response = await apiGet(
                `/api/hashtags/${encodeURIComponent(hasTag)}/videos?sort=${sortBy}&limit=50&offset=${currentOffset}`
            );

            if (response.success && response.data) {
                const rd: any = response.data;
                const newVideos = rd.data || [];
                const total = rd.total || 0;

                if (reset) {
                    setVideos(newVideos);
                } else {
                    setVideos((prev) => [...prev, ...newVideos]);
                }

                setHasMore(newVideos.length === 50 && (currentOffset + newVideos.length) < total);
                setOffset(currentOffset + newVideos.length);
            }
        } catch (error) {
            console.error('[HashtagDiscovery] Erreur chargement vidéos:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [hasTag, sortBy, offset]);

    const loadHashtagInfo = useCallback(async () => {
        if (!hasTag) {
            setHashtagInfo(null);
            return;
        }
        try {
            const response = await apiGet('/api/hashtags/search', {
                params: { q: hasTag, limit: 1 },
            });
            const body: any = response.data;
            const arr: HashtagInfo[] = Array.isArray(body?.data) ? body.data : [];
            if (arr.length > 0) {
                setHashtagInfo(arr[0]);
            } else {
                setHashtagInfo(null);
            }
        } catch (error) {
            console.error('[HashtagDiscovery] Erreur chargement info hashtag:', error);
        }
    }, [hasTag]);

    useEffect(() => {
        if (!hasTag) {
            loadTrendingHashtags();
            setVideos([]);
            setHashtagInfo(null);
            return;
        }
        loadHashtagInfo();
        loadVideos(true);
    }, [hasTag, sortBy]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (!hasTag) {
            loadTrendingHashtags();
            return;
        }
        loadVideos(true);
        loadHashtagInfo();
    }, [hasTag, loadVideos, loadHashtagInfo, loadTrendingHashtags]);

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
                        {hasTag ? (hasTag.startsWith('#') ? hasTag : `#${hasTag}`) : (t('hashtagDiscovery.trendingTitle') || 'Hashtags tendance')}
                    </Text>
                    {hasTag && hashtagInfo && (
                        <Text style={styles.hashtagSubtitle}>
                            {formatCount(hashtagInfo.video_count)} vidéos{hashtagInfo.is_trending ? ' • 🔥 Tendance' : ''}
                        </Text>
                    )}
                    {!hasTag && (
                        <Text style={styles.hashtagSubtitle}>
                            {t('hashtagDiscovery.pickHashtag') || 'Choisissez un hashtag pour voir les vidéos'}
                        </Text>
                    )}
                </View>
            </View>

            {/* Filtres de tri (uniquement quand un tag est choisi) */}
            {hasTag ? (
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
            ) : null}

            {/* Mode découverte : liste des hashtags tendance */}
            {!hasTag && (
                <>
                    {loading && trendingTags.length === 0 ? (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                            <Text style={styles.loaderText}>{t('hashtagDiscovery.chargementDesVideos')}</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={trendingTags}
                            keyExtractor={(item, i) => item.tag || String(i)}
                            numColumns={2}
                            contentContainerStyle={styles.listContent}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyTitle}>{t('hashtagDiscovery.aucuneVideoTrouvee')}</Text>
                                    <Text style={styles.emptySubtitle}>
                                        {t('hashtagDiscovery.noTrending') || 'Aucun hashtag pour le moment.'}
                                    </Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.trendChip}
                                    onPress={() => (navigation as any).setParams({ hashtag: item.tag })}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.trendChipTag} numberOfLines={1}>
                                        #{item.tag}
                                    </Text>
                                    <Text style={styles.trendChipMeta}>
                                        {formatCount(item.video_count)} vid.
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </>
            )}

            {/* Liste des vidéos (tag sélectionné) */}
            {hasTag && loading && videos.length === 0 ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loaderText}>{t('hashtagDiscovery.chargementDesVideos')}</Text>
                </View>
            ) : hasTag && videos.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="video-off" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyTitle}>{t('hashtagDiscovery.aucuneVideoTrouvee')}</Text>
                    <Text style={styles.emptySubtitle}>
                        Aucune vidéo n'utilise ce hashtag pour le moment.
                    </Text>
                </View>
            ) : hasTag ? (
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
            ) : null}
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
    trendChip: {
        flex: 1,
        margin: 6,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        minHeight: 72,
        justifyContent: 'center',
    },
    trendChipTag: {
        fontSize: 16,
        fontWeight: '800',
        color: modernColors.primary,
    },
    trendChipMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
});

export default HashtagDiscoveryScreen;

