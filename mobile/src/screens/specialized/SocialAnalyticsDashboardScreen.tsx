// Social Analytics Dashboard — Yukpo
// Vue cross-plateformes : engagement, posts top, heures optimales, A/B test, tendance 12 semaines.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
    platform: string;
    posts: number;
    impressions: number;
    engagement_rate: number;
    followers_gained: number;
    orders_attributed: number;
    revenue_attributed: number;
}

interface TopPost {
    post_id: number;
    platform: string;
    content_preview: string;
    effectiveness_score: number;
    engagement_rate: number;
    impressions: number;
    published_at: string;
}

interface BestHour {
    hour: number;
    platform: string;
    avg_engagement_rate: number;
}

interface WeeklyStat {
    week_start: string;
    posts_published: number;
    total_engagement: number;
    avg_engagement_rate: number;
}

interface Dashboard {
    period_days: number;
    total_posts: number;
    total_impressions: number;
    total_reach: number;
    total_engagement: number;
    avg_engagement_rate: number;
    orders_attributed: number;
    revenue_attributed_fcfa: number;
    platforms: PlatformStats[];
    top_posts: TopPost[];
    best_hours: BestHour[];
    weekly_trend: WeeklyStat[];
}

const PLATFORM_COLORS: Record<string, string> = {
    facebook: '#1877F2',
    instagram: '#E1306C',
    tiktok: '#000000',
    twitter: '#1DA1F2',
    linkedin: '#0A66C2',
    youtube: '#FF0000',
    pinterest: '#E60023',
};

const PERIODS = [7, 14, 30, 90];

export default function SocialAnalyticsDashboardScreen() {
    const route = useRoute<any>();
    const { user } = useAuth();
    const serviceId: number = route.params?.serviceId ?? 0;

    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState(30);
    const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'hours' | 'trend'>('overview');

    const fetchDashboard = useCallback(async () => {
        try {
            const data = await apiGet(
                `/api/social-ai/analytics/${serviceId}?days=${period}`
            );
            setDashboard(data);
        } catch (err) {
            console.warn('[Analytics]', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [serviceId, period]);

    useEffect(() => {
        setLoading(true);
        fetchDashboard();
    }, [fetchDashboard]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDashboard();
    }, [fetchDashboard]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>Chargement analytics...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* En-tête */}
            <View style={styles.header}>
                <Text style={styles.title}>Analytics Social</Text>
                <Text style={styles.subtitle}>Performance cross-plateformes</Text>
            </View>

            {/* Sélecteur période */}
            <View style={styles.periodSelector}>
                {PERIODS.map(p => (
                    <TouchableOpacity
                        key={p}
                        style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                        onPress={() => setPeriod(p)}
                    >
                        <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                            {p}j
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Onglets */}
            <View style={styles.tabs}>
                {(['overview', 'posts', 'hours', 'trend'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab === 'overview' ? 'Vue globale' : tab === 'posts' ? 'Top posts' : tab === 'hours' ? 'Heures' : 'Tendance'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {dashboard && (
                <>
                    {activeTab === 'overview' && <OverviewTab dashboard={dashboard} />}
                    {activeTab === 'posts' && <TopPostsTab posts={dashboard.top_posts} />}
                    {activeTab === 'hours' && <BestHoursTab hours={dashboard.best_hours} />}
                    {activeTab === 'trend' && <WeeklyTrendTab data={dashboard.weekly_trend} />}
                </>
            )}
        </ScrollView>
    );
}

// ─── Onglet Vue Globale ────────────────────────────────────────────────────────

function OverviewTab({ dashboard }: { dashboard: Dashboard }) {
    const fmt = (n: number) =>
        n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);

    const kpis = [
        { label: 'Posts publiés', value: String(dashboard.total_posts), icon: 'document-text', color: '#6366F1' },
        { label: 'Impressions', value: fmt(dashboard.total_impressions), icon: 'eye', color: '#0EA5E9' },
        { label: 'Taux engagement', value: `${dashboard.avg_engagement_rate?.toFixed(2) ?? 0}%`, icon: 'heart', color: '#EC4899' },
        { label: 'Commandes', value: String(dashboard.orders_attributed), icon: 'bag', color: '#10B981' },
        { label: 'Revenus (FCFA)', value: fmt(dashboard.revenue_attributed_fcfa), icon: 'cash', color: '#F59E0B' },
    ];

    return (
        <View style={styles.section}>
            <View style={styles.kpiGrid}>
                {kpis.map(kpi => (
                    <View key={kpi.label} style={[styles.kpiCard, { borderLeftColor: kpi.color }]}>
                        <SafeIcon name={kpi.icon as any} size={20} color={kpi.color} style={styles.kpiIcon} />
                        <Text style={styles.kpiValue}>{kpi.value}</Text>
                        <Text style={styles.kpiLabel}>{kpi.label}</Text>
                    </View>
                ))}
            </View>

            <Text style={styles.sectionTitle}>Par plateforme</Text>
            {dashboard.platforms.map(p => (
                <View key={p.platform} style={styles.platformRow}>
                    <View
                        style={[
                            styles.platformDot,
                            { backgroundColor: PLATFORM_COLORS[p.platform] ?? '#888' },
                        ]}
                    />
                    <Text style={styles.platformName}>{p.platform}</Text>
                    <Text style={styles.platformStat}>{p.posts} posts</Text>
                    <Text style={styles.platformStat}>{fmt(p.impressions)} impr.</Text>
                    <Text style={[styles.platformRate, { color: p.engagement_rate >= 3 ? '#10B981' : '#F59E0B' }]}>
                        {p.engagement_rate?.toFixed(2)}%
                    </Text>
                </View>
            ))}
        </View>
    );
}

// ─── Onglet Top Posts ─────────────────────────────────────────────────────────

function TopPostsTab({ posts }: { posts: TopPost[] }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meilleurs posts</Text>
            {posts.map((post, i) => (
                <View key={post.post_id} style={styles.postCard}>
                    <View style={styles.postRank}>
                        <Text style={styles.postRankText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.postInfo}>
                        <View style={styles.postMeta}>
                            <View
                                style={[
                                    styles.platformBadge,
                                    { backgroundColor: PLATFORM_COLORS[post.platform] ?? '#888' },
                                ]}
                            >
                                <Text style={styles.platformBadgeText}>{post.platform}</Text>
                            </View>
                            <Text style={styles.postDate}>
                                {post.published_at ? new Date(post.published_at).toLocaleDateString('fr-FR') : '—'}
                            </Text>
                        </View>
                        <Text style={styles.postPreview} numberOfLines={2}>
                            {post.content_preview}
                        </Text>
                        <View style={styles.postStats}>
                            <Text style={styles.postStatChip}>
                                Score {post.effectiveness_score?.toFixed(0)}/100
                            </Text>
                            <Text style={styles.postStatChip}>
                                {post.engagement_rate?.toFixed(2)}% eng.
                            </Text>
                            <Text style={styles.postStatChip}>
                                {post.impressions >= 1000 ? `${(post.impressions / 1000).toFixed(1)}k` : String(post.impressions)} impr.
                            </Text>
                        </View>
                    </View>
                </View>
            ))}
            {posts.length === 0 && (
                <Text style={styles.emptyText}>Aucun post publié sur cette période</Text>
            )}
        </View>
    );
}

// ─── Onglet Meilleures Heures ─────────────────────────────────────────────────

function BestHoursTab({ hours }: { hours: BestHour[] }) {
    const top5 = hours.slice(0, 10);
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heures optimales de publication</Text>
            <Text style={styles.sectionHint}>Basé sur vos publications passées</Text>
            {top5.map((h, i) => (
                <View key={`${h.platform}-${h.hour}`} style={styles.hourRow}>
                    <Text style={styles.hourRank}>#{i + 1}</Text>
                    <View
                        style={[
                            styles.platformDot,
                            { backgroundColor: PLATFORM_COLORS[h.platform] ?? '#888' },
                        ]}
                    />
                    <Text style={styles.hourPlatform}>{h.platform}</Text>
                    <Text style={styles.hourTime}>
                        {String(h.hour).padStart(2, '0')}h00
                    </Text>
                    <View style={styles.engBar}>
                        <View
                            style={[
                                styles.engBarFill,
                                { width: `${Math.min(h.avg_engagement_rate * 10, 100)}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.hourRate}>{h.avg_engagement_rate?.toFixed(2)}%</Text>
                </View>
            ))}
            {top5.length === 0 && (
                <Text style={styles.emptyText}>Pas assez de données encore</Text>
            )}
        </View>
    );
}

// ─── Onglet Tendance hebdomadaire ─────────────────────────────────────────────

function WeeklyTrendTab({ data }: { data: WeeklyStat[] }) {
    const maxEng = Math.max(...data.map(d => d.avg_engagement_rate ?? 0), 1);
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tendance 12 semaines</Text>
            {data.map(w => (
                <View key={w.week_start} style={styles.weekRow}>
                    <Text style={styles.weekLabel}>
                        {new Date(w.week_start).toLocaleDateString('fr-FR', { month: 'short', day: '2-digit' })}
                    </Text>
                    <Text style={styles.weekPosts}>{w.posts_published} posts</Text>
                    <View style={styles.engBar}>
                        <View
                            style={[
                                styles.engBarFill,
                                { width: `${((w.avg_engagement_rate ?? 0) / maxEng) * 100}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.weekRate}>{w.avg_engagement_rate?.toFixed(2)}%</Text>
                </View>
            ))}
            {data.length === 0 && <Text style={styles.emptyText}>Pas assez de données</Text>}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
    loadingText: { color: '#94A3B8', marginTop: 12 },
    header: { padding: 20, paddingTop: 40 },
    title: { fontSize: 24, fontWeight: '700', color: '#F1F5F9' },
    subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
    periodSelector: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
    periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1E293B' },
    periodBtnActive: { backgroundColor: '#6366F1' },
    periodBtnText: { color: '#64748B', fontSize: 13 },
    periodBtnTextActive: { color: '#FFF', fontWeight: '600' },
    tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 4, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: '#1E293B' },
    tabActive: { backgroundColor: '#6366F1' },
    tabText: { color: '#64748B', fontSize: 12 },
    tabTextActive: { color: '#FFF', fontWeight: '600' },
    section: { paddingHorizontal: 20, paddingBottom: 40 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: '#E2E8F0', marginBottom: 12, marginTop: 8 },
    sectionHint: { fontSize: 12, color: '#64748B', marginBottom: 12, marginTop: -8 },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    kpiCard: {
        flex: 1, minWidth: '45%', backgroundColor: '#1E293B', borderRadius: 12,
        padding: 14, borderLeftWidth: 4,
    },
    kpiIcon: { marginBottom: 6 },
    kpiValue: { fontSize: 20, fontWeight: '700', color: '#F1F5F9' },
    kpiLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
    platformRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#1E293B',
    },
    platformDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    platformName: { flex: 1, color: '#CBD5E1', fontSize: 14 },
    platformStat: { color: '#64748B', fontSize: 12, marginRight: 12 },
    platformRate: { fontSize: 13, fontWeight: '600' },
    postCard: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 10 },
    postRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    postRankText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    postInfo: { flex: 1 },
    postMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    platformBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    platformBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    postDate: { color: '#64748B', fontSize: 12 },
    postPreview: { color: '#CBD5E1', fontSize: 13, marginBottom: 8, lineHeight: 18 },
    postStats: { flexDirection: 'row', gap: 6 },
    postStatChip: { backgroundColor: '#0F172A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, color: '#94A3B8', fontSize: 11 },
    hourRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
    hourRank: { color: '#64748B', fontSize: 12, width: 24 },
    hourPlatform: { color: '#CBD5E1', fontSize: 13, width: 80 },
    hourTime: { color: '#6366F1', fontWeight: '600', width: 50 },
    hourRate: { color: '#10B981', fontSize: 12, width: 44, textAlign: 'right' },
    engBar: { flex: 1, height: 6, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
    engBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 3 },
    weekRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
    weekLabel: { color: '#CBD5E1', fontSize: 12, width: 52 },
    weekPosts: { color: '#64748B', fontSize: 11, width: 48 },
    weekRate: { color: '#10B981', fontSize: 12, width: 40, textAlign: 'right' },
    emptyText: { color: '#475569', fontSize: 14, textAlign: 'center', marginTop: 32 },
});
