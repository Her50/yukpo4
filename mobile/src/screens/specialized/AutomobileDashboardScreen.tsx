// Dashboard professionnel pour prestataires Automobile
// Gestion du stock de vehicules, annonces, clients

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import ProductVideoCreationModal from '../../components/ProductVideoCreationModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { ManagedProduct } from '../../types/ManagedProduct';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type TabType = 'overview' | 'vehicles' | 'analytics';

interface Vehicle {
    id: number;
    marque: string;
    modele: string;
    annee?: number;
    prix?: number;
    type_vehicule?: string;
    is_occasion?: boolean;
    is_active: boolean;
    images?: string[];
}

const TYPES_VEHICULE = [
    { key: 'berline', label: 'Berline', icon: 'car', color: '#3B82F6' },
    { key: 'suv', label: 'SUV', icon: 'truck', color: '#10B981' },
    { key: 'pickup', label: 'Pick-up', icon: 'truck', color: '#F59E0B' },
    { key: 'utilitaire', label: 'Utilitaire', icon: 'package', color: '#8B5CF6' },
    { key: 'moto', label: 'Moto', icon: 'bike', color: '#DC2626' },
    { key: 'camion', label: 'Camion', icon: 'truck', color: '#6366F1' },
];

const AutomobileDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user, logout } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [showStudioModal, setShowStudioModal] = useState(false);
    const [studioProduct, setStudioProduct] = useState<ManagedProduct | null>(null);
    const [expandedVehicleComments, setExpandedVehicleComments] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [stats, setStats] = useState({ total: 0, active: 0, occasion: 0, neuf: 0 });

    const devise = getCurrencyIntelligently() || 'FCFA';

    const loadData = useCallback(async () => {
        try {
            const resp = await apiGet('/api/specialized-services/user?type=automobile');
            const data = (resp as any)?.data?.services || [];
            setVehicles(data);
            setStats({
                total: data.length,
                active: data.filter((v: any) => v.is_active !== false).length,
                occasion: data.filter((v: any) => v.is_occasion === true).length,
                neuf: data.filter((v: any) => v.is_occasion !== true).length,
            });
        } catch (e) {
            console.error('[AutomobileDashboard] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: t('automobileDashboard.accueil'), icon: 'layout-dashboard' },
        { key: 'vehicles', label: t('automobileDashboard.vehicules'), icon: 'car' },
        { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
    ];

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#F59E0B" /><Text style={s.loadingText}>{t('automobileDashboard.chargement')}</Text></View>;
    }

    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: t('automobileDashboard.vehicules'), value: stats.total, icon: 'car', color: '#3B82F6' },
                    { label: t('automobileDashboard.enLigne'), value: stats.active, icon: 'check-circle', color: '#10B981' },
                    { label: 'Occasion', value: stats.occasion, icon: 'refresh-cw', color: '#F59E0B' },
                    { label: 'Neufs', value: stats.neuf, icon: 'star', color: '#8B5CF6' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            <Text style={s.sectionTitle}>Actions rapides</Text>
            <View style={s.quickRow}>
                {[
                    { label: t('automobileDashboard.ajouterVehicule'), icon: 'plus-circle', color: '#F59E0B', onPress: () => setActiveTab('vehicles') },
                    { label: t('automobileDashboard.recherche'), icon: 'search', color: '#3B82F6', onPress: () => (navigation as any).navigate('AutoServicesSearch') },
                    { label: 'Statistiques', icon: 'bar-chart-2', color: '#8B5CF6', onPress: () => setActiveTab('analytics') },
                    { label: 'Portefeuille', icon: 'wallet', color: '#10B981', onPress: () => (navigation as any).navigate('WalletFinancial') },
                    { label: t('common.sortir'), icon: 'log-out', color: '#DC2626', onPress: () => { Alert.alert(t('common.deconnexion'), t('common.confirmDeconnexion'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }]); } },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}>
                            <SafeIcon name={a.icon as any} size={22} color={a.color} />
                        </View>
                        <Text style={s.quickLabel} numberOfLines={2}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={s.sectionTitle}>Par type</Text>
            <View style={s.typesGrid}>
                {TYPES_VEHICULE.map(t => (
                    <View key={t.key} style={s.typeCard}>
                        <View style={[s.typeIcon, { backgroundColor: t.color + '15' }]}>
                            <SafeIcon name={t.icon as any} size={18} color={t.color} />
                        </View>
                        <Text style={s.typeLabel}>{t.label}</Text>
                        <Text style={s.typeCount}>{vehicles.filter(v => v.type_vehicule === t.key).length}</Text>
                    </View>
                ))}
            </View>

            {vehicles.length > 0 && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>{t('automobileDashboard.vehiculesRecents')}</Text>
                        <TouchableOpacity onPress={() => setActiveTab('vehicles')}><Text style={s.seeAll}>Tout voir</Text></TouchableOpacity>
                    </View>
                    {vehicles.slice(0, 4).map((v, i) => (
                        <View key={i} style={s.vehicleCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.vehicleName}>{v.marque} {v.modele}</Text>
                                <Text style={s.vehicleDetail}>{v.annee || ''} {v.is_occasion ? '· Occasion' : '· Neuf'}{v.prix ? ` · ${v.prix.toLocaleString()} ${devise}` : ''}</Text>
                            </View>
                            <View style={[s.statusDot, { backgroundColor: v.is_active !== false ? '#10B981' : '#EF4444' }]} />
                        </View>
                    ))}
                </>
            )}

            {vehicles.length === 0 && (
                <View style={s.emptyState}>
                    <SafeIcon name="car" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('automobileDashboard.aucunVehicule')}</Text>
                    <Text style={s.emptyText}>{t('automobileDashboard.ajoutezVosPremiersVehiculesPour')}</Text>
                    <NativeButton title={t('automobileDashboard.ajouterUnVehicule')} onPress={() => setActiveTab('vehicles')} style={{ marginTop: 16 }} />
                </View>
            )}
        </ScrollView>
    );

    const renderVehicles = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <NativeButton title={t('automobileDashboard.ajouterUnVehicule')} onPress={() => Alert.alert('Info', t('automobileDashboardScreen.utilisezLeFormulaireIntelligentPourAjouter'))} variant="primary" style={{ marginBottom: 16 }} />
            {vehicles.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="car" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('automobileDashboard.aucunVehiculeEnregistre')}</Text>
                </View>
            ) : (
                vehicles.map((v, i) => (
                    <React.Fragment key={i}>
                        <View style={s.vehicleCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.vehicleName}>{v.marque} {v.modele}</Text>
                                <Text style={s.vehicleDetail}>
                                    {v.type_vehicule || ''} {v.annee ? `· ${v.annee}` : ''} {v.is_occasion ? '· Occasion' : '· Neuf'}
                                    {v.prix ? ` · ${v.prix.toLocaleString()} ${devise}` : ''}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={{ backgroundColor: '#8B5CF620', borderRadius: 6, padding: 6, marginRight: 6 }}
                                onPress={() => {
                                    const mp: ManagedProduct = {
                                        id: String(v.id),
                                        nom: `${v.marque} ${v.modele}`,
                                        serviceId: String(v.id),
                                        serviceTitre: 'Automobile',
                                        prix: v.prix,
                                        type: v.type_vehicule,
                                        product_index: i,
                                        images: v.images || [],
                                    };
                                    setStudioProduct(mp);
                                    setShowStudioModal(true);
                                }}
                            >
                                <SafeIcon name="film" size={14} color="#8B5CF6" />
                            </TouchableOpacity>
                            <View style={[s.statusDot, { backgroundColor: v.is_active !== false ? '#10B981' : '#EF4444' }]} />
                        </View>
                        <TouchableOpacity
                            style={s.commentsToggle}
                            onPress={() => setExpandedVehicleComments(prev => {
                                const next = new Set(prev);
                                next.has(v.id) ? next.delete(v.id) : next.add(v.id);
                                return next;
                            })}
                        >
                            <SafeIcon name="message-circle" size={14} color="#6366F1" />
                            <Text style={s.commentsToggleText}>
                                {expandedVehicleComments.has(v.id) ? 'Masquer les avis' : 'Avis clients'}
                            </Text>
                            <SafeIcon name={expandedVehicleComments.has(v.id) ? 'chevron-up' : 'chevron-down'} size={14} color="#6366F1" />
                        </TouchableOpacity>
                        {expandedVehicleComments.has(v.id) && (
                            <ProductCommentsSection
                                serviceId={v.id}
                                serviceTitle={`${v.marque} ${v.modele}`}
                                mode="inline"
                                compact
                            />
                        )}
                    </React.Fragment>
                ))
            )}
        </ScrollView>
    );

    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.analyticsCard}>
                <Text style={s.analyticsTitle}>{t('automobileDashboard.resumeDuStock')}</Text>
                {[
                    { label: t('automobileDashboard.totalVehicules'), value: stats.total, color: '#3B82F6' },
                    { label: t('automobileDashboard.enLigne'), value: stats.active, color: '#10B981' },
                    { label: 'Occasion', value: stats.occasion, color: '#F59E0B' },
                    { label: 'Neufs', value: stats.neuf, color: '#8B5CF6' },
                ].map((item, i) => (
                    <View key={i} style={s.analyticsRow}>
                        <View style={[s.analyticsDot, { backgroundColor: item.color }]} />
                        <Text style={s.analyticsLabel}>{item.label}</Text>
                        <Text style={[s.analyticsValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );

    return (
        <View style={s.container}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>{t('automobileDashboard.dashboardAutomobile')}</Text>
                        <Text style={s.headerSub}>{user?.name || t('automobileDashboard.partenaire')}</Text>
                    </View>
                </View>
                <View style={s.tabRow}>
                    {TABS.map(t => (
                        <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => setActiveTab(t.key)}>
                            <SafeIcon name={t.icon as any} size={16} color={activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.6)'} />
                            <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>
            <View style={s.content}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'vehicles' && renderVehicles()}
                {activeTab === 'analytics' && renderAnalytics()}
            </View>
            <ProductVideoCreationModal
                visible={showStudioModal}
                primaryProduct={studioProduct}
                products={studioProduct ? [studioProduct] : []}
                onClose={() => { setShowStudioModal(false); setStudioProduct(null); }}
                onSuccess={() => { setShowStudioModal(false); setStudioProduct(null); }}
                navigation={navigation}
            />
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    tabRow: { flexDirection: 'row', gap: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 4 },
    tabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 1 },
    statValue: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginTop: 6 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 10 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
    seeAll: { color: '#F59E0B', fontSize: 13, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 10 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeCard: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1 },
    typeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    typeLabel: { fontSize: 11, fontWeight: '600', color: '#1F2937' },
    typeCount: { fontSize: 10, color: '#6B7280', marginTop: 2 },
    vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    vehicleName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    vehicleDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    commentsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#EEF2FF', borderRadius: 8, marginBottom: 8 },
    commentsToggleText: { flex: 1, fontSize: 12, color: '#6366F1', fontWeight: '600' },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1 },
    analyticsTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    analyticsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    analyticsLabel: { flex: 1, fontSize: 14, color: '#374151' },
    analyticsValue: { fontSize: 18, fontWeight: '700' },
});

export default AutomobileDashboardScreen;
