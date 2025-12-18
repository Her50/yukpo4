// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import AdvancedAnalyticsChart from '../components/AdvancedAnalyticsChart';
import { ExportButton } from '../components/ExportButton';
import { NativeCard } from '../components/SafeNativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
import OptimizationSuggestions from '../components/OptimizationSuggestions';
import PubliciteVersionHistory from '../components/PubliciteVersionHistory';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

interface PubliciteStats {
    id: string | number;
    titre: string;
    status: 'active' | 'expired' | 'pending';
    vues: number;
    clics: number;
    conversion_rate: number;
    budget_depense: number;
    jours_restants: number;
    zone_geographique: string;
    produits_count: number;
    date_debut: string;
    date_fin: string;
    videos_meta?: PubliciteVideoMeta[];
    video_stats?: Record<string, any>;
}

interface PubliciteVideoMeta {
    format?: string | null;
    source?: string | null;
    duration_ms?: number | null;
    ai_generated?: boolean | null;
}

interface VideoSummary {
    views_by_format: Record<string, number>;
    clicks_by_format: Record<string, number>;
    ai_generated_videos: number;
    manual_videos: number;
}

const emptyVideoSummary: VideoSummary = {
    views_by_format: {},
    clicks_by_format: {},
    ai_generated_videos: 0,
    manual_videos: 0,
};

const PubliciteDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPubliciteForHistory, setSelectedPubliciteForHistory] = useState<number | null>(null);
    const [publicites, setPublicites] = useState<PubliciteStats[]>([]);
    const [globalStats, setGlobalStats] = useState({
        total_vues: 0,
        total_clics: 0,
        taux_conversion_moyen: 0,
        budget_total_depense: 0,
        publicites_actives: 0,
        video_summary: emptyVideoSummary,
    });

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);

            const response = await apiGet('/api/publicites/dashboard');

            if (response.success && response.data) {
                const statsPayload = response.data.stats || {};
                setGlobalStats({
                    total_vues: statsPayload.total_vues || 0,
                    total_clics: statsPayload.total_clics || 0,
                    taux_conversion_moyen: statsPayload.taux_conversion_moyen || 0,
                    budget_total_depense: statsPayload.budget_total_depense || 0,
                    publicites_actives: statsPayload.publicites_actives || 0,
                    video_summary: statsPayload.video_summary || emptyVideoSummary,
                });

                const pubsPayload: PubliciteStats[] = (response.data.publicites || []).map((pub: any) => ({
                    ...pub,
                    videos_meta: Array.isArray(pub.videos_meta) ? pub.videos_meta : [],
                    video_stats: pub.video_stats || {},
                }));

                setPublicites(pubsPayload);
            }

            setLoading(false);
        } catch (error) {
            console.error('[PubliciteDashboard] Erreur chargement:', error);
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadDashboard();
        setRefreshing(false);
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'active':
                return '#10B981';
            case 'expired':
                return '#EF4444';
            case 'pending':
                return '#F59E0B';
            default:
                return modernColors.textSecondary;
        }
    };

    const getStatusLabel = (status: string): string => {
        switch (status) {
            case 'active':
                return t('publicite.active');
            case 'expired':
                return t('publicite.expired');
            case 'pending':
                return 'En attente';
            default:
                return status;
        }
    };

    const renderTopFormatChips = (formatMap: Record<string, number>, label: string) => {
        const entries = Object.entries(formatMap || {})
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .slice(0, 3);

        if (entries.length === 0) {
            return null;
        }

        return (
            <View style={styles.videoFormatRow}>
                {entries.map(([format, value]) => (
                    <View key={`${label}_${format}`} style={styles.videoFormatChip}>
                        <SafeIcon name="play-circle" size={14} color="#4F46E5" />
                        <Text style={styles.videoFormatText}>
                            {label} {format.toUpperCase()} · {value}
                        </Text>
                    </View>
                ))}
            </View>
        );
    };

    const renderVideoMetaSection = (pub: PubliciteStats) => {
        const metas = Array.isArray(pub.videos_meta) ? pub.videos_meta : [];
        const stats = pub.video_stats || {};
        const views = stats.views || {};
        const clicks = stats.clicks || {};

        if (!metas.length && (!Object.keys(views).length && !Object.keys(clicks).length)) {
            return null;
        }

        return (
            <View style={styles.videoMetaSection}>
                <Text style={styles.videoMetaTitle}>Vidéos</Text>
                {metas.length > 0 && (
                    <View style={styles.videoMetaChipRow}>
                        {metas.slice(0, 4).map((meta, index) => {
                            const format = (meta.format || (meta.ai_generated ? 'square' : 'video') || 'video').toString();
                            const source = (meta.source || (meta.ai_generated ? 'ai' : 'manual') || 'manual').toString();
                            return (
                                <View key={`${pub.id}_meta_${index}`} style={styles.videoMetaChip}>
                                    <SafeIcon name={meta.ai_generated ? 'sparkles' : 'film'} size={12} color={meta.ai_generated ? '#6366F1' : '#059669'} />
                                    <Text style={styles.videoMetaChipText}>
                                        {format.toUpperCase()} · {source.toUpperCase()}
                                    </Text>
                                </View>
                            );
                        })}
                        {metas.length > 4 && (
                            <View style={styles.videoMetaChip}>
                                <SafeIcon name="plus" size={12} color="#6B7280" />
                                <Text style={styles.videoMetaChipText}>+{metas.length - 4}</Text>
                            </View>
                        )}
                    </View>
                )}

                {Object.keys(views).length > 0 && (
                    <View style={styles.videoStatsRow}>
                        <SafeIcon name="eye" size={14} color="#3B82F6" />
                        <Text style={styles.videoStatsLabel}>Vues par format</Text>
                    </View>
                )}
                {renderTopFormatChips(views, 'Vue')}

                {Object.keys(clicks).length > 0 && (
                    <View style={styles.videoStatsRow}>
                        <SafeIcon name="mouse-pointer" size={14} color="#10B981" />
                        <Text style={styles.videoStatsLabel}>Clics par format</Text>
                    </View>
                )}
                {renderTopFormatChips(clicks, 'Clic')}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={modernColors.primaryGradient} style={styles.header}>
                <NavigatorToolbar
                    tone="dark"
                    showHandle={false}
                    density="compact"
                    backIcon="back"
                    title={t('publicite.dashboard')}
                    subtitle={t('publicite.analytics')}
                    rightSlot={(
                        <TouchableOpacity
                            onPress={() => (navigation as any).navigate('CreatePublicite')}
                            style={styles.addButton}
                        >
                            <SafeIcon name="plus" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                />
            </LinearGradient>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {/* Stats globales */}
                <View style={styles.statsGrid}>
                    <NativeCard style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
                            <SafeIcon name="eye" size={24} color="#3B82F6" />
                        </View>
                        <Text style={styles.statValue}>{globalStats.total_vues.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>{t('publicite.views')}</Text>
                    </NativeCard>

                    <NativeCard style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#F0FDF4' }]}>
                            <SafeIcon name="mouse-pointer" size={24} color="#10B981" />
                        </View>
                        <Text style={styles.statValue}>{globalStats.total_clics.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>{t('publicite.clicks')}</Text>
                    </NativeCard>

                    <NativeCard style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
                            <SafeIcon name="trending-up" size={24} color="#F59E0B" />
                        </View>
                        <Text style={styles.statValue}>{globalStats.taux_conversion_moyen.toFixed(1)}%</Text>
                        <Text style={styles.statLabel}>{t('publicite.conversion_rate')}</Text>
                    </NativeCard>

                    <NativeCard style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
                            <SafeIcon name="dollar-sign" size={24} color="#EF4444" />
                        </View>
                        <Text style={styles.statValue}>{globalStats.budget_total_depense.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>{t('stats.budget')}</Text>
                    </NativeCard>
                </View>

                {/* Résumé vidéos */}
                <NativeCard style={styles.videoSummaryCard}>
                    <Text style={styles.videoSummaryTitle}>Performance vidéos</Text>
                    <View style={styles.videoSummaryRow}>
                        <View style={styles.videoSummaryItem}>
                            <SafeIcon name="sparkles" size={18} color="#6366F1" />
                            <View>
                                <Text style={styles.videoSummaryValue}>{globalStats.video_summary.ai_generated_videos}</Text>
                                <Text style={styles.videoSummaryLabel}>IA générées</Text>
                            </View>
                        </View>
                        <View style={styles.videoSummaryItem}>
                            <SafeIcon name="film" size={18} color="#059669" />
                            <View>
                                <Text style={styles.videoSummaryValue}>{globalStats.video_summary.manual_videos}</Text>
                                <Text style={styles.videoSummaryLabel}>Manuelles</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.videoSummaryFormats}>
                        {renderTopFormatChips(globalStats.video_summary.views_by_format, 'Vue')}
                        {renderTopFormatChips(globalStats.video_summary.clicks_by_format, 'Clic')}
                    </View>
                </NativeCard>

                {/* ✅ NOUVEAU: Analytics Avancés */}
                {user?.id && (
                    <NativeCard style={styles.analyticsCard}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="trending-up" size={24} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Analytics Avancés</Text>
                            <ExportButton
                                data={publicites.map(pub => ({
                                    titre: pub.titre,
                                    vues: pub.vues,
                                    clics: pub.clics,
                                    conversion_rate: pub.conversion_rate,
                                    budget_depense: pub.budget_depense,
                                    status: pub.status,
                                    date_debut: pub.date_debut,
                                    date_fin: pub.date_fin,
                                }))}
                                format="csv"
                                filename={`publicites_${new Date().toISOString().split('T')[0]}.csv`}
                            />
                        </View>
                        <AdvancedAnalyticsChart userId={parseInt(user.id)} periodDays={30} />
                    </NativeCard>
                )}

                {/* ✅ NOUVEAU: Suggestions d'Optimisation */}
                {user?.id && (
                    <NativeCard style={styles.analyticsCard}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="zap" size={24} color="#F59E0B" />
                            <Text style={styles.sectionTitle}>Optimisation Automatique</Text>
                        </View>
                        <OptimizationSuggestions userId={parseInt(user.id)} />
                    </NativeCard>
                )}

                {/* Liste des publicités */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Mes publicités ({publicites.length})</Text>
                        <View style={styles.activeBadge}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activeText}>{globalStats.publicites_actives} actives</Text>
                        </View>
                    </View>

                    {publicites.length === 0 ? (
                        <NativeCard style={styles.emptyCard}>
                            <SafeIcon name="megaphone" size={64} color={modernColors.border} />
                            <Text style={styles.emptyText}>Aucune publicité</Text>
                            <Text style={styles.emptySubtext}>Créez votre première publicité pour booster vos produits</Text>
                            <TouchableOpacity
                                style={styles.createButton}
                                onPress={() => (navigation as any).navigate('CreatePublicite')}
                            >
                                <SafeIcon name="plus" size={20} color="#fff" />
                                <Text style={styles.createButtonText}>{t('publicite.create')}</Text>
                            </TouchableOpacity>
                        </NativeCard>
                    ) : (
                        publicites.map((pub) => (
                            <NativeCard key={pub.id} style={styles.publiciteCard}>
                                <View style={styles.publiciteHeader}>
                                    <View style={styles.publiciteTitle}>
                                        <Text style={styles.publiciteTitleText} numberOfLines={1}>
                                            {pub.titre}
                                        </Text>
                                        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(pub.status)}20` }]}>
                                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(pub.status) }]} />
                                            <Text style={[styles.statusText, { color: getStatusColor(pub.status) }]}>
                                                {getStatusLabel(pub.status)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Métriques */}
                                <View style={styles.metricsGrid}>
                                    <View style={styles.metric}>
                                        <SafeIcon name="eye" size={16} color={modernColors.textSecondary} />
                                        <Text style={styles.metricValue}>{pub.vues}</Text>
                                        <Text style={styles.metricLabel}>vues</Text>
                                    </View>
                                    <View style={styles.metric}>
                                        <SafeIcon name="mouse-pointer" size={16} color={modernColors.textSecondary} />
                                        <Text style={styles.metricValue}>{pub.clics}</Text>
                                        <Text style={styles.metricLabel}>clics</Text>
                                    </View>
                                    <View style={styles.metric}>
                                        <SafeIcon name="trending-up" size={16} color={modernColors.textSecondary} />
                                        <Text style={styles.metricValue}>{pub.conversion_rate.toFixed(1)}%</Text>
                                        <Text style={styles.metricLabel}>taux</Text>
                                    </View>
                                    <View style={styles.metric}>
                                        <SafeIcon name="package" size={16} color={modernColors.textSecondary} />
                                        <Text style={styles.metricValue}>{pub.produits_count}</Text>
                                        <Text style={styles.metricLabel}>produits</Text>
                                    </View>
                                </View>

                                {/* Infos additionnelles */}
                                <View style={styles.publiciteFooter}>
                                    <View style={styles.infoRow}>
                                        <SafeIcon name="calendar" size={14} color={modernColors.textSecondary} />
                                        <Text style={styles.infoText}>
                                            {pub.jours_restants > 0
                                                ? `${pub.jours_restants} jours restants`
                                                : 'Expiré'
                                            }
                                        </Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <SafeIcon
                                            name={pub.zone_geographique === 'local' ? 'map-pin' : 'globe'}
                                            size={14}
                                            color={modernColors.textSecondary}
                                        />
                                        <Text style={styles.infoText}>
                                            {pub.zone_geographique === 'local' ? 'Local' :
                                                pub.zone_geographique === 'regional' ? 'Régional' : 'International'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Barre de progression */}
                                {pub.status === 'active' && (
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressBar}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    { width: `${(pub.jours_restants / parseInt(pub.date_fin.split(' ')[0])) * 100}%` }
                                                ]}
                                            />
                                        </View>
                                    </View>
                                )}

                                {/* ✅ Boutons d'action */}
                                <View style={styles.publiciteActions}>
                                    {pub.status === 'expired' && (
                                        <TouchableOpacity
                                            style={styles.relanceButton}
                                            onPress={() => (navigation as any).navigate('CreatePublicite', { relanceId: pub.id })}
                                        >
                                            <SafeIcon name="refresh-cw" size={16} color="#fff" />
                                            <Text style={styles.relanceButtonText}>Relancer</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.modifyButton}
                                        onPress={() => (navigation as any).navigate('CreatePublicite', { publiciteId: pub.id })}
                                    >
                                        <SafeIcon name="edit" size={16} color="#6366F1" />
                                        <Text style={styles.modifyButtonText}>Modifier</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.historyButton}
                                        onPress={() => setSelectedPubliciteForHistory(selectedPubliciteForHistory === parseInt(pub.id) ? null : parseInt(pub.id))}
                                    >
                                        <SafeIcon name="history" size={16} color="#8B5CF6" />
                                        <Text style={styles.historyButtonText}>Historique</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* ✅ Historique des versions */}
                                {selectedPubliciteForHistory === parseInt(pub.id) && (
                                    <View style={styles.historyContainer}>
                                        <PubliciteVersionHistory
                                            campaignId={parseInt(pub.id)}
                                            onVersionSelect={(versionNumber) => {
                                                console.log('Version sélectionnée:', versionNumber);
                                                // Recharger les données après restauration
                                                loadDashboard();
                                            }}
                                        />
                                    </View>
                                )}

                                {renderVideoMetaSection(pub)}
                            </NativeCard>
                        ))
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
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
        backgroundColor: modernColors.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        width: (width - 44) / 2,
        padding: 16,
        alignItems: 'center',
    },
    statIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    videoSummaryCard: {
        padding: 16,
        marginBottom: 24,
    },
    videoSummaryTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    videoSummaryRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    videoSummaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#EEF2FF',
    },
    videoSummaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    videoSummaryLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    videoSummaryFormats: {
        gap: 8,
    },
    videoFormatRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    videoFormatChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#E0E7FF',
    },
    videoFormatText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4338CA',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#F0FDF4',
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    activeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
    },
    emptyCard: {
        padding: 48,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        backgroundColor: modernColors.primary,
    },
    createButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    publiciteCard: {
        padding: 16,
        marginBottom: 12,
    },
    publiciteHeader: {
        marginBottom: 16,
    },
    publiciteTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    publiciteTitleText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    metricsGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    metric: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    metricValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    metricLabel: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    videoMetaSection: {
        marginTop: 16,
        gap: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    videoMetaTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    videoMetaChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    videoMetaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F3F4F6',
    },
    videoMetaChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    videoStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    videoStatsLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '600',
    },
    publiciteFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    progressContainer: {
        marginTop: 12,
    },
    progressBar: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
    },
    publiciteActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    relanceButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    relanceButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    modifyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    modifyButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    historyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#8B5CF6',
    },
    historyButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    historyContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
});

export default PubliciteDashboardScreen;


