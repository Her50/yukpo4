/**
 * Écran Analytics pour créateurs
 * Affiche les statistiques détaillées sur les performances des vidéos
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface VideoAnalytics {
    video_id: string;
    title: string;
    views: number;
    likes: number;
    saves: number;
    shares: number;
    comments: number;
    avg_watch_duration_ms: number;
    completion_rate: number;
    engagement_rate: number;
    reach: number;
    impressions: number;
    ctr: number;
    created_at: string;
    last_updated: string;
}

interface CreatorAnalyticsOverview {
    total_videos: number;
    total_views: number;
    total_likes: number;
    total_saves: number;
    total_shares: number;
    total_comments: number;
    avg_views_per_video: number;
    avg_engagement_rate: number;
    total_followers: number;
    total_reach: number;
    period_start: string;
    period_end: string;
}

interface CreatorAnalyticsResponse {
    success: boolean;
    overview: CreatorAnalyticsOverview;
    videos: VideoAnalytics[];
    top_performers: Array<{
        video_id: string;
        title: string;
        views: number;
        engagement_rate: number;
        vs_average: number;
        trend: string;
    }>;
    insights: string[];
}

const CreatorAnalyticsScreen: React.FC = () => {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState<CreatorAnalyticsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadAnalytics = useCallback(async () => {
        if (!user?.id) {
            setError('Utilisateur non connecté');
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const response = await apiGet<CreatorAnalyticsResponse>(
                `/api/creators/${user.id}/analytics`
            );

            if (response.success && response.data) {
                setAnalytics(response.data);
            } else {
                setError(response.error || 'Erreur lors du chargement des analytics');
            }
        } catch (err: any) {
            console.error('[CreatorAnalytics] Erreur:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadAnalytics();
    }, [loadAnalytics]);

    const formatNumber = useCallback((num: number): string => {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        }
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    }, []);

    const formatDuration = useCallback((ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }, []);

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement des analytics...</Text>
                </View>
            </SafeNativeView>
        );
    }

    if (error) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.errorContainer}>
                    <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </SafeNativeView>
        );
    }

    if (!analytics) {
        return null;
    }

    const { overview, videos, top_performers, insights } = analytics;

    return (
        <SafeNativeView style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Analytics Créateur</Text>
                    <Text style={styles.headerSubtitle}>
                        {new Date(overview.period_start).toLocaleDateString()} -{' '}
                        {new Date(overview.period_end).toLocaleDateString()}
                    </Text>
                </View>

                {/* Overview Cards */}
                <View style={styles.overviewGrid}>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statValue}>{formatNumber(overview.total_views)}</Text>
                        <Text style={styles.statLabel}>Vues totales</Text>
                    </NativeCard>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statValue}>{formatNumber(overview.total_likes)}</Text>
                        <Text style={styles.statLabel}>Likes</Text>
                    </NativeCard>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statValue}>
                            {overview.avg_engagement_rate.toFixed(1)}%
                        </Text>
                        <Text style={styles.statLabel}>Engagement</Text>
                    </NativeCard>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statValue}>{formatNumber(overview.total_followers)}</Text>
                        <Text style={styles.statLabel}>Abonnés</Text>
                    </NativeCard>
                </View>

                {/* Insights */}
                {insights.length > 0 && (
                    <NativeCard style={styles.insightsCard}>
                        <Text style={styles.insightsTitle}>💡 Insights</Text>
                        {insights.map((insight, index) => (
                            <Text key={index} style={styles.insightText}>
                                • {insight}
                            </Text>
                        ))}
                    </NativeCard>
                )}

                {/* Top Performers */}
                {top_performers.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Top Performances</Text>
                        {top_performers.map((performer) => (
                            <NativeCard key={performer.video_id} style={styles.videoCard}>
                                <Text style={styles.videoTitle} numberOfLines={2}>
                                    {performer.title}
                                </Text>
                                <View style={styles.videoStats}>
                                    <View style={styles.videoStat}>
                                        <SafeIcon name="eye" size={16} color={modernColors.primary} />
                                        <Text style={styles.videoStatText}>
                                            {formatNumber(performer.views)}
                                        </Text>
                                    </View>
                                    <View style={styles.videoStat}>
                                        <SafeIcon
                                            name="heart"
                                            size={16}
                                            color={modernColors.error}
                                        />
                                        <Text style={styles.videoStatText}>
                                            {performer.engagement_rate.toFixed(1)}%
                                        </Text>
                                    </View>
                                    <View style={styles.videoStat}>
                                        <SafeIcon
                                            name={
                                                performer.trend === 'up'
                                                    ? 'trending-up'
                                                    : performer.trend === 'down'
                                                        ? 'trending-down'
                                                        : 'minus'
                                            }
                                            size={16}
                                            color={
                                                performer.trend === 'up'
                                                    ? modernColors.success
                                                    : performer.trend === 'down'
                                                        ? modernColors.error
                                                        : modernColors.textSecondary
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.videoStatText,
                                                {
                                                    color:
                                                        performer.trend === 'up'
                                                            ? modernColors.success
                                                            : performer.trend === 'down'
                                                                ? modernColors.error
                                                                : modernColors.textSecondary,
                                                },
                                            ]}
                                        >
                                            {performer.vs_average > 0 ? '+' : ''}
                                            {performer.vs_average.toFixed(1)}%
                                        </Text>
                                    </View>
                                </View>
                            </NativeCard>
                        ))}
                    </View>
                )}

                {/* All Videos */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Toutes les Vidéos</Text>
                    {videos.map((video) => (
                        <NativeCard key={video.video_id} style={styles.videoCard}>
                            <Text style={styles.videoTitle} numberOfLines={2}>
                                {video.title}
                            </Text>
                            <View style={styles.videoStats}>
                                <View style={styles.videoStat}>
                                    <SafeIcon name="eye" size={16} color={modernColors.primary} />
                                    <Text style={styles.videoStatText}>
                                        {formatNumber(video.views)}
                                    </Text>
                                </View>
                                <View style={styles.videoStat}>
                                    <SafeIcon name="heart" size={16} color={modernColors.error} />
                                    <Text style={styles.videoStatText}>
                                        {formatNumber(video.likes)}
                                    </Text>
                                </View>
                                <View style={styles.videoStat}>
                                    <SafeIcon
                                        name="message-circle"
                                        size={16}
                                        color={modernColors.textSecondary}
                                    />
                                    <Text style={styles.videoStatText}>
                                        {formatNumber(video.comments)}
                                    </Text>
                                </View>
                                <View style={styles.videoStat}>
                                    <SafeIcon
                                        name="clock"
                                        size={16}
                                        color={modernColors.textSecondary}
                                    />
                                    <Text style={styles.videoStatText}>
                                        {formatDuration(video.avg_watch_duration_ms)}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.videoMetrics}>
                                <Text style={styles.metricText}>
                                    Engagement: {video.engagement_rate.toFixed(1)}%
                                </Text>
                                <Text style={styles.metricText}>
                                    Complétion: {video.completion_rate.toFixed(1)}%
                                </Text>
                            </View>
                        </NativeCard>
                    ))}
                </View>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: modernColors.textSecondary,
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    errorText: {
        marginTop: 16,
        color: modernColors.error,
        fontSize: 16,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    header: {
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    overviewGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 24,
        marginHorizontal: -8,
    },
    statCard: {
        width: '48%',
        margin: '1%',
        padding: 16,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    insightsCard: {
        padding: 16,
        marginBottom: 24,
    },
    insightsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    insightText: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 8,
        lineHeight: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    videoCard: {
        padding: 16,
        marginBottom: 12,
    },
    videoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    videoStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    videoStat: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
        marginBottom: 8,
    },
    videoStatText: {
        fontSize: 14,
        color: modernColors.text,
        marginLeft: 6,
    },
    videoMetrics: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    metricText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
});

export default CreatorAnalyticsScreen;

