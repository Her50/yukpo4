// @ts-nocheck
// ✅ NOUVEAU 2026-03-03: Écran statistiques produit (dashboard prestataire)
// Accessible depuis MesProduitsScreen via bouton 📊 sur chaque produit

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from '../services/api';
import { theme } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ProductStats {
    views: number;
    shares: number;
    saves: number;
    clicks: number;
    comments: number;
    reactions: number;
    avg_rating: number | null;
    media_count: number;
}

interface TimelineDataPoint {
    date: string;
    views: number;
    shares: number;
    clicks: number;
    saves: number;
}

interface CityVisitorInfo {
    city: string;
    count: number;
    percentage: number;
}

interface SearchSourceInfo {
    source: string;
    count: number;
    percentage: number;
}

interface VisitorInfo {
    user_id: number;
    display_name: string;
    visited_at: string;
    interaction_type: string;
}

type Period = '7d' | '30d' | '90d';

// ═══════════════════════════════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════════════════════════════

const ProductStatsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { productId, productName, serviceId } = (route.params as any) || {};

    const [period, setPeriod] = useState<Period>('30d');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<ProductStats | null>(null);
    const [timeline, setTimeline] = useState<TimelineDataPoint[]>([]);
    const [cities, setCities] = useState<CityVisitorInfo[]>([]);
    const [sources, setSources] = useState<SearchSourceInfo[]>([]);
    const [visitors, setVisitors] = useState<VisitorInfo[]>([]);
    const [totalVisitors, setTotalVisitors] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async (isRefresh = false) => {
        if (!productId) return;
        try {
            if (!isRefresh) setLoading(true);
            setError(null);

            const [statsRes, timelineRes, visitorsRes] = await Promise.all([
                apiGet(`/api/products/${productId}/stats`, { params: { period } }),
                apiGet(`/api/products/${productId}/stats/timeline`, { params: { period } }),
                apiGet(`/api/products/${productId}/stats/visitors`, { params: { period } }),
            ]);

            // Stats globales
            const statsData = statsRes?.data as any;
            if (statsData?.stats) {
                setStats(statsData.stats);
            } else if (statsData?.success === false) {
                setStats({ views: 0, shares: 0, saves: 0, clicks: 0, comments: 0, reactions: 0, avg_rating: null, media_count: 0 });
            }

            // Timeline
            const timelineData = timelineRes?.data as any;
            if (timelineData?.data_points) {
                setTimeline(timelineData.data_points);
            }

            // Visiteurs
            const visitorsData = visitorsRes?.data as any;
            if (visitorsData) {
                setCities(visitorsData.visitor_cities || []);
                setSources(visitorsData.search_sources || []);
                setVisitors(visitorsData.recent_visitors || []);
                setTotalVisitors(visitorsData.total_unique_visitors || 0);
            }
        } catch (err: any) {
            console.error('[ProductStatsScreen] Erreur chargement stats:', err);
            setError('Impossible de charger les statistiques');
            // Fallback: stats vides
            setStats({ views: 0, shares: 0, saves: 0, clicks: 0, comments: 0, reactions: 0, avg_rating: null, media_count: 0 });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [productId, period]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadStats(true);
    }, [loadStats]);

    const formatNumber = (n: number): string => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    };

    const getInteractionIcon = (type: string): string => {
        switch (type) {
            case 'view': return '👁️';
            case 'click': return '👆';
            case 'contact': return '📞';
            case 'share': return '🔗';
            default: return '📌';
        }
    };

    const getInteractionLabel = (type: string): string => {
        switch (type) {
            case 'view': return 'Vue';
            case 'click': return 'Clic';
            case 'contact': return 'Contact';
            case 'share': return 'Partage';
            default: return type;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // Mini Bar Chart (pur React Native, pas de dépendance)
    // ═══════════════════════════════════════════════════════════

    const renderMiniChart = () => {
        if (timeline.length === 0) {
            return (
                <View style={styles.emptyChart}>
                    <Text style={styles.emptyChartIcon}>📈</Text>
                    <Text style={styles.emptyChartText}>
                        Pas encore de données pour cette période
                    </Text>
                </View>
            );
        }

        const maxViews = Math.max(...timeline.map(d => d.views), 1);
        const chartWidth = SCREEN_WIDTH - 64;
        const barWidth = Math.max(4, Math.min(12, (chartWidth - timeline.length * 2) / timeline.length));

        return (
            <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
                        <Text style={styles.legendText}>Vues</Text>
                        <View style={[styles.legendDot, { backgroundColor: '#F59E0B', marginLeft: 12 }]} />
                        <Text style={styles.legendText}>Clics</Text>
                    </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                    <View style={styles.barsContainer}>
                        {timeline.map((point, index) => {
                            const viewsHeight = Math.max(2, (point.views / maxViews) * 100);
                            const clicksHeight = Math.max(2, (point.clicks / maxViews) * 100);
                            const dayLabel = point.date.slice(5); // MM-DD

                            return (
                                <View key={index} style={styles.barGroup}>
                                    <View style={styles.barPair}>
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: viewsHeight,
                                                    width: barWidth,
                                                    backgroundColor: '#6366F1',
                                                },
                                            ]}
                                        />
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: clicksHeight,
                                                    width: barWidth,
                                                    backgroundColor: '#F59E0B',
                                                    marginLeft: 1,
                                                },
                                            ]}
                                        />
                                    </View>
                                    {(index % Math.max(1, Math.floor(timeline.length / 6)) === 0) && (
                                        <Text style={styles.barLabel}>{dayLabel}</Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        );
    };

    // ═══════════════════════════════════════════════════════════
    // Rendu
    // ═══════════════════════════════════════════════════════════

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Chargement des statistiques...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        📊 Statistiques
                    </Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {productName || 'Produit'}
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
                }
            >
                {/* Sélecteur de période */}
                <View style={styles.periodSelector}>
                    {(['7d', '30d', '90d'] as Period[]).map((p) => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.periodButton, period === p && styles.periodButtonActive]}
                            onPress={() => setPeriod(p)}
                        >
                            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Cartes statistiques principales */}
                <View style={styles.statsGrid}>
                    <StatCard icon="👁️" label="Vues" value={formatNumber(stats?.views ?? 0)} color="#6366F1" />
                    <StatCard icon="🔗" label="Partages" value={formatNumber(stats?.shares ?? 0)} color="#10B981" />
                    <StatCard icon="💾" label="Sauvegardes" value={formatNumber(stats?.saves ?? 0)} color="#F59E0B" />
                    <StatCard icon="👆" label="Clics" value={formatNumber(stats?.clicks ?? 0)} color="#EF4444" />
                </View>

                {/* Cartes secondaires */}
                <View style={styles.statsGrid}>
                    <StatCard icon="💬" label="Commentaires" value={formatNumber(stats?.comments ?? 0)} color="#8B5CF6" />
                    <StatCard icon="❤️" label="Réactions" value={formatNumber(stats?.reactions ?? 0)} color="#EC4899" />
                    <StatCard
                        icon="⭐"
                        label="Note moyenne"
                        value={stats?.avg_rating ? stats.avg_rating.toFixed(1) : 'N/A'}
                        color="#F59E0B"
                    />
                    <StatCard icon="📷" label="Médias" value={formatNumber(stats?.media_count ?? 0)} color="#06B6D4" />
                </View>

                {/* Graphique temporel */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📈 Évolution temporelle</Text>
                    {renderMiniChart()}
                </View>

                {/* Villes des visiteurs */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🌍 Villes des visiteurs</Text>
                    <Text style={styles.sectionSubtitle}>
                        {totalVisitors} visiteur{totalVisitors !== 1 ? 's' : ''} unique{totalVisitors !== 1 ? 's' : ''}
                    </Text>
                    {cities.length === 0 ? (
                        <Text style={styles.emptyText}>Aucune donnée de localisation</Text>
                    ) : (
                        cities.map((city, i) => (
                            <View key={i} style={styles.progressRow}>
                                <View style={styles.progressLabel}>
                                    <Text style={styles.progressCity}>{city.city}</Text>
                                    <Text style={styles.progressCount}>
                                        {city.count} ({city.percentage}%)
                                    </Text>
                                </View>
                                <View style={styles.progressBarBg}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${Math.min(city.percentage, 100)}%` },
                                        ]}
                                    />
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* Sources d'interaction */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📱 Types d'interactions</Text>
                    {sources.length === 0 ? (
                        <Text style={styles.emptyText}>Aucune interaction enregistrée</Text>
                    ) : (
                        sources.map((source, i) => (
                            <View key={i} style={styles.sourceRow}>
                                <View style={styles.sourceLeft}>
                                    <Text style={styles.sourceIcon}>
                                        {source.source === 'Vues directes' ? '👁️' :
                                            source.source === 'Clics' ? '👆' :
                                                source.source === 'Contacts' ? '📞' :
                                                    source.source === 'Partages' ? '🔗' : '📌'}
                                    </Text>
                                    <Text style={styles.sourceName}>{source.source}</Text>
                                </View>
                                <View style={styles.sourceRight}>
                                    <Text style={styles.sourceCount}>{formatNumber(source.count)}</Text>
                                    <Text style={styles.sourcePercent}>{source.percentage}%</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* Visiteurs récents */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>👥 Visiteurs récents</Text>
                    {visitors.length === 0 ? (
                        <Text style={styles.emptyText}>Aucun visiteur récent</Text>
                    ) : (
                        visitors.slice(0, 10).map((visitor, i) => (
                            <View key={i} style={styles.visitorRow}>
                                <View style={styles.visitorAvatar}>
                                    <Text style={styles.visitorAvatarText}>
                                        {visitor.display_name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.visitorInfo}>
                                    <Text style={styles.visitorName} numberOfLines={1}>
                                        {visitor.display_name}
                                    </Text>
                                    <Text style={styles.visitorMeta}>
                                        {getInteractionIcon(visitor.interaction_type)}{' '}
                                        {getInteractionLabel(visitor.interaction_type)} · {visitor.visited_at}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// ═══════════════════════════════════════════════════════════════
// Composant StatCard
// ═══════════════════════════════════════════════════════════════

const StatCard: React.FC<{
    icon: string;
    label: string;
    value: string;
    color: string;
}> = ({ icon, label, value, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: '#64748B',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
            android: { elevation: 2 },
        }),
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    backIcon: {
        fontSize: 20,
        color: '#334155',
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
            android: { elevation: 1 },
        }),
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    periodButtonActive: {
        backgroundColor: theme.colors.primary,
    },
    periodText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    periodTextActive: {
        color: '#FFFFFF',
    },
    errorBanner: {
        backgroundColor: '#FEF2F2',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#EF4444',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 13,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 10,
    },
    statCard: {
        width: (SCREEN_WIDTH - 42) / 2 - 5,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderLeftWidth: 3,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    statIcon: {
        fontSize: 20,
        marginBottom: 6,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        paddingVertical: 20,
    },
    // Chart styles
    chartContainer: {
        marginTop: 8,
    },
    chartHeader: {
        marginBottom: 8,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    legendText: {
        fontSize: 11,
        color: '#64748B',
    },
    chartScroll: {
        maxHeight: 130,
    },
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 120,
        paddingBottom: 20,
    },
    barGroup: {
        alignItems: 'center',
        marginHorizontal: 1,
    },
    barPair: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    bar: {
        borderTopLeftRadius: 2,
        borderTopRightRadius: 2,
        minHeight: 2,
    },
    barLabel: {
        fontSize: 8,
        color: '#94A3B8',
        marginTop: 4,
        position: 'absolute',
        bottom: -16,
    },
    emptyChart: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyChartIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    emptyChartText: {
        fontSize: 13,
        color: '#94A3B8',
    },
    // Progress bar (cities)
    progressRow: {
        marginBottom: 10,
    },
    progressLabel: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    progressCity: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    progressCount: {
        fontSize: 12,
        color: '#64748B',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#6366F1',
        borderRadius: 3,
    },
    // Source rows
    sourceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    sourceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sourceIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    sourceName: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
    },
    sourceRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sourceCount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
    },
    sourcePercent: {
        fontSize: 12,
        color: '#94A3B8',
        minWidth: 36,
        textAlign: 'right',
    },
    // Visitor rows
    visitorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    visitorAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    visitorAvatarText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    visitorInfo: {
        flex: 1,
    },
    visitorName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    visitorMeta: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
});

export default ProductStatsScreen;
