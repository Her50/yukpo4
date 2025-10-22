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
import { NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

interface PubliciteStats {
    id: string;
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
}

const PubliciteDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [publicites, setPublicites] = useState<PubliciteStats[]>([]);
    const [globalStats, setGlobalStats] = useState({
        total_vues: 0,
        total_clics: 0,
        taux_conversion_moyen: 0,
        budget_total_depense: 0,
        publicites_actives: 0
    });

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);

            const response = await apiGet('/api/publicites/dashboard');

            if (response.success && response.data) {
                setPublicites(response.data.publicites || []);
                setGlobalStats(response.data.stats || globalStats);
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

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={modernColors.primaryGradient} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{t('publicite.dashboard')}</Text>
                        <Text style={styles.headerSubtitle}>{t('publicite.analytics')}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('CreatePublicite')}
                        style={styles.addButton}
                    >
                        <SafeIcon name="plus" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
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
                                </View>
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
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
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
});

export default PubliciteDashboardScreen;


