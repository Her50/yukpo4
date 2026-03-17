import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

// ============================================================================
// FleetDashboardScreen — Dashboard de gestion de flotte pour partenaires gérants
// Types partenaires: chauffeur, livraison, livraison_courses_marche, demenagement, transport
// ============================================================================

interface FleetStats {
    total_couriers: number;
    pending_applications: number;
    completed_deliveries_30d: number;
    active_deliveries: number;
    avg_rating: number;
    monthly_revenue_cents: number;
}

interface FleetCourier {
    courier_id: string;
    user_id: number;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    courier_type: string | null;
    deliveries_30d: number;
    rating: number;
}

interface FleetApplication {
    id: string;
    user_id: number;
    name: string;
    status: string;
    submitted_at: string | null;
    phone: string | null;
    city: string | null;
    vehicle_type: string | null;
    courier_type: string | null;
    has_documents: boolean;
}

type TabKey = 'overview' | 'couriers' | 'applications';

const PARTNER_TYPE_LABELS: Record<string, string> = {
    chauffeur: 'Chauffeurs',
    livraison: 'Coursiers Livraison',
    livraison_courses_marche: 'Coursiers Marche',
    demenagement: 'Equipe Demenagement',
    transport: 'Transporteurs',
};

const COURIER_TYPE_LABELS: Record<string, string> = {
    classic: 'Coursier',
    market_shopping: 'Courses Marche',
    taxi: 'Chauffeur Taxi',
    carpooling: 'Covoiturage',
    moving: 'Demenagement',
};

const FleetDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user, logout } = useAuth();
    const { t } = useLanguageSafe();
    const partnerType = ((user as any)?.partner_type || '').toLowerCase().trim();

    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Stats
    const [stats, setStats] = useState<FleetStats>({
        total_couriers: 0,
        pending_applications: 0,
        completed_deliveries_30d: 0,
        active_deliveries: 0,
        avg_rating: 0,
        monthly_revenue_cents: 0,
    });

    // Couriers list
    const [couriers, setCouriers] = useState<FleetCourier[]>([]);
    const [loadingCouriers, setLoadingCouriers] = useState(false);

    // Applications list
    const [applications, setApplications] = useState<FleetApplication[]>([]);
    const [loadingApplications, setLoadingApplications] = useState(false);
    const [appFilter, setAppFilter] = useState<string>('submitted');

    // Modals
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    const fleetLabel = PARTNER_TYPE_LABELS[partnerType] || 'Flotte';

    // ========== DATA LOADING ==========

    const loadStats = useCallback(async () => {
        try {
            const res: any = await apiGet('/api/partners/me/fleet/stats');
            const data = res?.data || res;
            if (data?.data) {
                setStats(data.data);
            }
        } catch (err: any) {
            console.error('[FleetDashboard] Erreur chargement stats:', err);
        }
    }, []);

    const loadCouriers = useCallback(async () => {
        setLoadingCouriers(true);
        try {
            const res: any = await apiGet('/api/partners/me/fleet/couriers');
            const data = res?.data || res;
            setCouriers(data?.data || []);
        } catch (err: any) {
            console.error('[FleetDashboard] Erreur chargement coursiers:', err);
        } finally {
            setLoadingCouriers(false);
        }
    }, []);

    const loadApplications = useCallback(async () => {
        setLoadingApplications(true);
        try {
            const res: any = await apiGet(`/api/partners/me/fleet/applications?status=${appFilter}`);
            const data = res?.data || res;
            setApplications(data?.data || []);
        } catch (err: any) {
            console.error('[FleetDashboard] Erreur chargement candidatures:', err);
        } finally {
            setLoadingApplications(false);
        }
    }, [appFilter]);

    const loadAll = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        await Promise.all([loadStats(), loadCouriers(), loadApplications()]);
        setLoading(false);
        setRefreshing(false);
    }, [loadStats, loadCouriers, loadApplications]);

    useEffect(() => { loadAll(); }, []);

    useEffect(() => { loadApplications(); }, [appFilter]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAll(true);
    };

    // ========== ACTIONS ==========

    const handleApproveApplication = async (appId: string) => {
        Alert.alert(
            t('fleet.approveApplication'),
            t('fleet.approveConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Approuver',
                    onPress: async () => {
                        setProcessing(appId);
                        try {
                            await apiPost(`/api/partners/me/fleet/applications/${appId}/approve`, {});
                            Alert.alert(t('fleet.applicationApproved'), t('fleet.courierAddedToFleet'));
                            loadAll(true);
                        } catch (err: any) {
                            Alert.alert(t('message.error'), err?.message || t('fleet.cannotApprove'));
                        } finally {
                            setProcessing(null);
                        }
                    },
                },
            ],
        );
    };

    const handleRejectApplication = async () => {
        if (!rejectTarget) return;
        setProcessing(rejectTarget);
        try {
            await apiPost(`/api/partners/me/fleet/applications/${rejectTarget}/reject`, {
                reason: rejectReason || undefined,
            });
            Alert.alert(t('fleet.applicationRejected'), t('fleet.candidateInformed'));
            setRejectModalVisible(false);
            setRejectTarget(null);
            setRejectReason('');
            loadAll(true);
        } catch (err: any) {
            Alert.alert(t('message.error'), err?.message || t('fleet.cannotReject'));
        } finally {
            setProcessing(null);
        }
    };

    const handleToggleCourier = async (courierId: string, currentStatus: string) => {
        const action = currentStatus === 'approved' ? 'suspend' : 'activate';
        const label = action === 'suspend' ? 'Suspendre' : 'Reactiver';
        Alert.alert(
            t('fleet.toggleCourier', { action: label }),
            action === 'suspend'
                ? t('fleet.suspendWarning')
                : 'Ce coursier pourra a nouveau recevoir des courses.',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: label,
                    style: action === 'suspend' ? 'destructive' : 'default',
                    onPress: async () => {
                        setProcessing(courierId);
                        try {
                            await apiPost(`/api/partners/me/fleet/couriers/${courierId}/toggle`, { action });
                            loadCouriers();
                            loadStats();
                        } catch (err: any) {
                            Alert.alert(t('message.error'), err?.message || t('fleet.cannotToggleStatus'));
                        } finally {
                            setProcessing(null);
                        }
                    },
                },
            ],
        );
    };

    // ========== RENDER HELPERS ==========

    const formatCurrency = (cents: number) => {
        return `${Math.round(cents / 100).toLocaleString()} XAF`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return '#22c55e';
            case 'submitted': return '#f59e0b';
            case 'rejected': return '#ef4444';
            case 'suspended': return '#94a3b8';
            default: return '#6b7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return 'Actif';
            case 'submitted': return 'En attente';
            case 'rejected': return 'Rejete';
            case 'suspended': return 'Suspendu';
            case 'draft': return 'Brouillon';
            case 'under_review': return 'En revision';
            default: return status;
        }
    };

    // ========== TAB: OVERVIEW ==========

    const renderOverview = () => (
        <ScrollView
            style={styles.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[modernColors.primary]} />}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.sectionTitle}>Tableau de bord — {fleetLabel}</Text>

            <View style={styles.statsGrid}>
                <NativeCard style={styles.statCard}>
                    <SafeIcon name="users" size={28} color={modernColors.primary} type="lucide" />
                    <Text style={styles.statValue}>{stats.total_couriers}</Text>
                    <Text style={styles.statLabel}>Coursiers actifs</Text>
                </NativeCard>
                <NativeCard style={styles.statCard}>
                    <SafeIcon name="clock" size={28} color="#f59e0b" type="lucide" />
                    <Text style={styles.statValue}>{stats.pending_applications}</Text>
                    <Text style={styles.statLabel}>Candidatures</Text>
                </NativeCard>
                <NativeCard style={styles.statCard}>
                    <SafeIcon name="check-circle" size={28} color="#22c55e" type="lucide" />
                    <Text style={styles.statValue}>{stats.completed_deliveries_30d}</Text>
                    <Text style={styles.statLabel}>Courses (30j)</Text>
                </NativeCard>
                <NativeCard style={styles.statCard}>
                    <SafeIcon name="truck" size={28} color="#3b82f6" type="lucide" />
                    <Text style={styles.statValue}>{stats.active_deliveries}</Text>
                    <Text style={styles.statLabel}>{t('fleetDashboard.enCours')}</Text>
                </NativeCard>
            </View>

            <View style={styles.statsRow}>
                <NativeCard style={styles.statCardWide}>
                    <View style={styles.statCardWideInner}>
                        <SafeIcon name="star" size={24} color="#f59e0b" type="lucide" />
                        <View style={styles.statCardWideText}>
                            <Text style={styles.statValue}>{stats.avg_rating.toFixed(1)}/5</Text>
                            <Text style={styles.statLabel}>{t('fleetDashboard.noteMoyenneFlotte')}</Text>
                        </View>
                    </View>
                </NativeCard>
                <NativeCard style={styles.statCardWide}>
                    <View style={styles.statCardWideInner}>
                        <SafeIcon name="banknote" size={24} color="#22c55e" type="lucide" />
                        <View style={styles.statCardWideText}>
                            <Text style={styles.statValue}>{formatCurrency(stats.monthly_revenue_cents)}</Text>
                            <Text style={styles.statLabel}>{t('fleetDashboard.revenusCeMois')}</Text>
                        </View>
                    </View>
                </NativeCard>
            </View>

            {stats.pending_applications > 0 && (
                <TouchableOpacity
                    style={styles.alertBanner}
                    onPress={() => setActiveTab('applications')}
                >
                    <SafeIcon name="alert-circle" size={20} color="#f59e0b" type="lucide" />
                    <Text style={styles.alertText}>
                        {stats.pending_applications} candidature{stats.pending_applications > 1 ? 's' : ''} en attente de validation
                    </Text>
                    <SafeIcon name="chevron-right" size={18} color="#f59e0b" type="lucide" />
                </TouchableOpacity>
            )}

            {/* Actions rapides */}
            <View style={styles.quickSection}>
                <Text style={styles.sectionSubtitle}>Actions rapides</Text>
                <View style={styles.quickActionsRow}>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('applications')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#f59e0b15' }]}>
                            <SafeIcon name="user-plus" size={22} color="#f59e0b" type="lucide" />
                        </View>
                        <Text style={styles.quickActionLabel}>Candidatures</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('couriers')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#3b82f615' }]}>
                            <SafeIcon name="users" size={22} color="#3b82f6" type="lucide" />
                        </View>
                        <Text style={styles.quickActionLabel}>Coursiers</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('analytics')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#22c55e15' }]}>
                            <SafeIcon name="bar-chart-2" size={22} color="#22c55e" type="lucide" />
                        </View>
                        <Text style={styles.quickActionLabel}>Analytics</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => (navigation as any).navigate('WalletFinancial')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#8b5cf615' }]}>
                            <SafeIcon name="wallet" size={22} color="#8b5cf6" type="lucide" />
                        </View>
                        <Text style={styles.quickActionLabel}>Portefeuille</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => {
                        Alert.alert(
                            t('common.deconnexion'),
                            t('common.confirmDeconnexion'),
                            [
                                { text: t('common.cancel'), style: 'cancel' },
                                { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }
                            ]
                        );
                    }}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#dc262615' }]}>
                            <SafeIcon name="log-out" size={22} color="#dc2626" type="lucide" />
                        </View>
                        <Text style={styles.quickActionLabel}>{t('common.sortir')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quick access to top couriers */}
            {couriers.length > 0 && (
                <View style={styles.quickSection}>
                    <View style={styles.quickSectionHeader}>
                        <Text style={styles.sectionSubtitle}>Meilleurs coursiers</Text>
                        <TouchableOpacity onPress={() => setActiveTab('couriers')}>
                            <Text style={styles.seeAllLink}>{t('fleetDashboard.voirTous')}</Text>
                        </TouchableOpacity>
                    </View>
                    {couriers
                        .sort((a, b) => b.deliveries_30d - a.deliveries_30d)
                        .slice(0, 3)
                        .map((c) => (
                            <NativeCard key={c.courier_id} style={styles.quickCourierCard}>
                                <View style={styles.quickCourierRow}>
                                    <SafeIcon name="user" size={20} color={modernColors.primary} type="lucide" />
                                    <View style={styles.quickCourierInfo}>
                                        <Text style={styles.quickCourierName} numberOfLines={1}>{c.name}</Text>
                                        <Text style={styles.quickCourierMeta}>
                                            {c.deliveries_30d} courses ・ {c.rating.toFixed(1)} ★
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(c.status) + '20' }]}>
                                        <Text style={[styles.statusBadgeText, { color: getStatusColor(c.status) }]}>
                                            {getStatusLabel(c.status)}
                                        </Text>
                                    </View>
                                </View>
                            </NativeCard>
                        ))}
                </View>
            )}
        </ScrollView>
    );

    // ========== TAB: COURIERS ==========

    const renderCourierItem = ({ item }: { item: FleetCourier }) => (
        <NativeCard style={styles.courierCard}>
            <View style={styles.courierHeader}>
                <View style={styles.courierAvatar}>
                    <SafeIcon name="user" size={24} color="#fff" type="lucide" />
                </View>
                <View style={styles.courierInfo}>
                    <Text style={styles.courierName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.courierMeta}>
                        {COURIER_TYPE_LABELS[item.courier_type || ''] || item.courier_type || 'Coursier'}
                    </Text>
                    {item.phone && <Text style={styles.courierContact}>{item.phone}</Text>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>
            <View style={styles.courierStats}>
                <View style={styles.courierStatItem}>
                    <Text style={styles.courierStatValue}>{item.deliveries_30d}</Text>
                    <Text style={styles.courierStatLabel}>Courses (30j)</Text>
                </View>
                <View style={styles.courierStatItem}>
                    <Text style={styles.courierStatValue}>{item.rating.toFixed(1)} ★</Text>
                    <Text style={styles.courierStatLabel}>Note</Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        item.status === 'approved'
                            ? styles.toggleSuspend
                            : styles.toggleActivate,
                    ]}
                    onPress={() => handleToggleCourier(item.courier_id, item.status)}
                    disabled={processing === item.courier_id}
                >
                    {processing === item.courier_id ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.toggleButtonText}>
                            {item.status === 'approved' ? 'Suspendre' : 'Reactiver'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </NativeCard>
    );

    const renderCouriers = () => (
        <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Mes {fleetLabel} ({couriers.length})</Text>
            {loadingCouriers ? (
                <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 40 }} />
            ) : couriers.length === 0 ? (
                <NativeCard style={styles.emptyCard}>
                    <SafeIcon name="users" size={48} color={modernColors.textSecondary} type="lucide" />
                    <Text style={styles.emptyTitle}>{t('fleetDashboard.aucunCoursier')}</Text>
                    <Text style={styles.emptyText}>
                        Les coursiers qui s'inscrivent en selectionnant votre entreprise apparaitront ici
                        une fois approuves.
                    </Text>
                </NativeCard>
            ) : (
                <FlatList
                    data={couriers}
                    keyExtractor={(item) => item.courier_id}
                    renderItem={renderCourierItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[modernColors.primary]} />}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </View>
    );

    // ========== TAB: APPLICATIONS ==========

    const renderApplicationItem = ({ item }: { item: FleetApplication }) => (
        <NativeCard style={styles.applicationCard}>
            <View style={styles.applicationHeader}>
                <View style={styles.applicationInfo}>
                    <Text style={styles.applicationName}>{item.name}</Text>
                    <Text style={styles.applicationMeta}>
                        {COURIER_TYPE_LABELS[item.courier_type || ''] || item.courier_type || t('fleetDashboard.typeNonSpecifie')}
                        {item.city ? ` ・ ${item.city}` : ''}
                    </Text>
                    {item.vehicle_type && (
                        <Text style={styles.applicationMeta}>Vehicule: {item.vehicle_type}</Text>
                    )}
                    {item.phone && (
                        <Text style={styles.applicationMeta}>Tel: {item.phone}</Text>
                    )}
                    {item.submitted_at && (
                        <Text style={styles.applicationDate}>
                            Soumis le {new Date(item.submitted_at).toLocaleDateString('fr-FR')}
                        </Text>
                    )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>

            {item.has_documents && (
                <View style={styles.docBadge}>
                    <SafeIcon name="file-text" size={14} color={modernColors.primary} type="lucide" />
                    <Text style={styles.docBadgeText}>{t('fleetDashboard.documentsFournis')}</Text>
                </View>
            )}

            {item.status === 'submitted' && (
                <View style={styles.applicationActions}>
                    <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApproveApplication(item.id)}
                        disabled={processing === item.id}
                    >
                        {processing === item.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <SafeIcon name="check" size={16} color="#fff" type="lucide" />
                                <Text style={styles.approveButtonText}>Approuver</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => {
                            setRejectTarget(item.id);
                            setRejectReason('');
                            setRejectModalVisible(true);
                        }}
                        disabled={processing === item.id}
                    >
                        <SafeIcon name="x" size={16} color="#ef4444" type="lucide" />
                        <Text style={styles.rejectButtonText}>Rejeter</Text>
                    </TouchableOpacity>
                </View>
            )}
        </NativeCard>
    );

    const renderApplications = () => (
        <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Candidatures</Text>

            <View style={styles.filterRow}>
                {['submitted', 'approved', 'rejected', 'all'].map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, appFilter === f && styles.filterChipActive]}
                        onPress={() => setAppFilter(f)}
                    >
                        <Text style={[styles.filterChipText, appFilter === f && styles.filterChipTextActive]}>
                            {f === 'submitted' ? 'En attente' : f === 'approved' ? 'Approuvees' : f === 'rejected' ? 'Rejetees' : 'Toutes'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loadingApplications ? (
                <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 40 }} />
            ) : applications.length === 0 ? (
                <NativeCard style={styles.emptyCard}>
                    <SafeIcon name="inbox" size={48} color={modernColors.textSecondary} type="lucide" />
                    <Text style={styles.emptyTitle}>{t('fleetDashboard.aucuneCandidature')}</Text>
                    <Text style={styles.emptyText}>
                        {appFilter === 'submitted'
                            ? 'Aucune candidature en attente pour le moment.'
                            : 'Aucune candidature trouvee avec ce filtre.'}
                    </Text>
                </NativeCard>
            ) : (
                <FlatList
                    data={applications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderApplicationItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[modernColors.primary]} />}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </View>
    );

    // ========== MAIN RENDER ==========

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('fleetDashboard.chargementDeVotreFlotte')}</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{t('fleetDashboard.gestionDeFlotte')}</Text>
                    <Text style={styles.headerSubtitle}>{fleetLabel}</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
                    <SafeIcon name="refresh-cw" size={20} color={modernColors.primary} type="lucide" />
                </TouchableOpacity>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                {([
                    { key: 'overview' as TabKey, label: 'Apercu', icon: 'layout-dashboard' },
                    { key: 'couriers' as TabKey, label: fleetLabel, icon: 'users' },
                    { key: 'applications' as TabKey, label: 'Candidatures', icon: 'user-plus', badge: stats.pending_applications },
                ]).map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <SafeIcon
                            name={tab.icon}
                            size={18}
                            color={activeTab === tab.key ? modernColors.primary : modernColors.textSecondary}
                            type="lucide"
                        />
                        <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                            {tab.label}
                        </Text>
                        {tab.badge && tab.badge > 0 ? (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'couriers' && renderCouriers()}
            {activeTab === 'applications' && renderApplications()}

            {/* Reject Modal */}
            <Modal visible={rejectModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rejeter la candidature</Text>
                        <Text style={styles.modalSubtitle}>
                            Vous pouvez fournir un motif de refus (optionnel)
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Motif du refus..."
                            placeholderTextColor="#999"
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                            numberOfLines={3}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setRejectModalVisible(false);
                                    setRejectTarget(null);
                                }}
                            >
                                <Text style={styles.modalCancelText}>{t('fleetDashboardScreen.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalRejectButton}
                                onPress={handleRejectApplication}
                                disabled={processing !== null}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalRejectText}>{t('fleetDashboardScreen.confirmerLeRejet')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: modernColors.textSecondary,
        fontSize: 14,
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 8 : 12,
        paddingBottom: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    refreshButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: modernColors.primary + '15',
    },
    // Tab Bar
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 4,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 4,
    },
    tabItemActive: {
        backgroundColor: modernColors.primary + '15',
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    tabLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    tabBadge: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 2,
    },
    tabBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    tabContent: {
        flex: 1,
        paddingHorizontal: 16,
    },
    // Section titles
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 12,
        marginBottom: 12,
    },
    sectionSubtitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
    },
    statCard: {
        width: '48%' as any,
        flexGrow: 1,
        flexBasis: '45%',
        padding: 16,
        alignItems: 'center',
        borderRadius: 12,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 8,
    },
    statLabel: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
        textAlign: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    statCardWide: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
    },
    statCardWideInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statCardWideText: {
        flex: 1,
    },
    // Alert Banner
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        borderRadius: 10,
        padding: 12,
        gap: 8,
        marginBottom: 16,
    },
    alertText: {
        flex: 1,
        fontSize: 13,
        color: '#92400e',
        fontWeight: '500',
    },
    // Quick section
    quickSection: {
        marginBottom: 20,
    },
    quickSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    seeAllLink: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '500',
    },
    quickCourierCard: {
        padding: 12,
        marginBottom: 6,
        borderRadius: 10,
    },
    quickCourierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    quickCourierInfo: {
        flex: 1,
    },
    quickCourierName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    quickCourierMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    quickAction: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    quickActionIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionLabel: {
        fontSize: 10,
        color: modernColors.text,
        fontWeight: '500',
        textAlign: 'center',
    },
    // Status badge
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    // Courier card
    courierCard: {
        padding: 14,
        marginBottom: 10,
        borderRadius: 12,
    },
    courierHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    courierAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    courierInfo: {
        flex: 1,
    },
    courierName: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    courierMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 1,
    },
    courierContact: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    courierStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingTop: 10,
    },
    courierStatItem: {
        alignItems: 'center',
    },
    courierStatValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    courierStatLabel: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    toggleButton: {
        marginLeft: 'auto',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    toggleSuspend: {
        backgroundColor: '#f87171',
    },
    toggleActivate: {
        backgroundColor: '#22c55e',
    },
    toggleButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // Application card
    applicationCard: {
        padding: 14,
        marginBottom: 10,
        borderRadius: 12,
    },
    applicationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    applicationInfo: {
        flex: 1,
        marginRight: 12,
    },
    applicationName: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    applicationMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    applicationDate: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    docBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    docBadgeText: {
        fontSize: 12,
        color: modernColors.primary,
    },
    applicationActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingTop: 12,
    },
    approveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#22c55e',
        paddingVertical: 10,
        borderRadius: 8,
    },
    approveButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    rejectButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#fef2f2',
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    rejectButtonText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 13,
    },
    // Filter row
    filterRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary + '15',
        borderColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    filterChipTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    // Empty state
    emptyCard: {
        padding: 30,
        alignItems: 'center',
        borderRadius: 12,
        marginTop: 20,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 12,
    },
    emptyText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    modalCancelText: {
        color: modernColors.text,
        fontWeight: '600',
    },
    modalRejectButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#ef4444',
    },
    modalRejectText: {
        color: '#fff',
        fontWeight: '600',
    },
});

export default FleetDashboardScreen;
