// Dashboard professionnel pour prestataires Supermarché
// Gestion du catalogue, stocks, promotions et analytics

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
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

type TabType = 'overview' | 'catalog' | 'promos' | 'analytics';

interface CatalogProduct {
    id: number;
    nom: string;
    prix: number;
    stock?: number;
    categorie?: string;
    en_promotion?: boolean;
    prix_promo?: number;
    is_active: boolean;
}

const CATEGORIES = [
    { key: 'alimentaire', label: 'Alimentaire', icon: 'apple', color: '#10B981' },
    { key: 'boissons', label: 'Boissons', icon: 'coffee', color: '#3B82F6' },
    { key: 'hygiene', label: 'Hygiène', icon: 'droplets', color: '#8B5CF6' },
    { key: 'menager', label: 'Ménager', icon: 'home', color: '#F59E0B' },
    { key: 'bebe', label: 'Bébé', icon: 'baby', color: '#EC4899' },
    { key: 'autres', label: 'Autres', icon: 'package', color: '#6B7280' },
];

const SupermarketPartnerDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [stats, setStats] = useState({ total: 0, enStock: 0, enPromo: 0, valeurStock: 0 });

    const devise = getCurrencyIntelligently() || 'FCFA';

    const loadData = useCallback(async () => {
        try {
            // 1. Récupérer les services supermarché du partenaire
            const resp = await apiGet('/api/specialized-services/user?type=supermarche');
            const services = (resp as any)?.data?.services || [];

            // 2. Pour chaque service, charger les produits réels (service_products)
            const allProducts: CatalogProduct[] = [];
            for (const svc of services) {
                const serviceId = svc.service_id || svc.id;
                try {
                    const prodResp = await apiGet(`/api/supermarkets/${serviceId}/products?limit=100`);
                    const backendData = (prodResp as any)?.data;
                    const svcProducts = backendData?.products || [];
                    for (const p of svcProducts) {
                        allProducts.push({
                            id: parseInt(p.id) || 0,
                            nom: p.name || p.nom || 'Produit',
                            prix: p.price || p.prix || 0,
                            stock: p.stock_status === 'in_stock' ? 1 : 0,
                            categorie: p.category || p.categorie || 'autres',
                            en_promotion: p.is_promotion || false,
                            prix_promo: p.original_price || undefined,
                            is_active: true,
                        });
                    }
                } catch (err) {
                    console.warn(`[SupermarketPartnerDashboard] Erreur chargement produits service ${serviceId}:`, err);
                }
            }

            setProducts(allProducts);
            setStats({
                total: allProducts.length,
                enStock: allProducts.filter((p) => (p.stock || 0) > 0).length,
                enPromo: allProducts.filter((p) => p.en_promotion === true).length,
                valeurStock: allProducts.reduce((sum, p) => sum + ((p.prix || 0) * (p.stock || 0)), 0),
            });
        } catch (e) {
            console.error('[SupermarketPartnerDashboard] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: 'Accueil', icon: 'layout-dashboard' },
        { key: 'catalog', label: 'Catalogue', icon: 'package' },
        { key: 'promos', label: 'Promos', icon: 'tag' },
        { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
    ];

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#10B981" /><Text style={s.loadingText}>Chargement...</Text></View>;
    }

    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: 'Produits', value: stats.total, icon: 'package', color: '#3B82F6' },
                    { label: 'En stock', value: stats.enStock, icon: 'check-circle', color: '#10B981' },
                    { label: 'En promo', value: stats.enPromo, icon: 'tag', color: '#F59E0B' },
                    { label: 'Valeur stock', value: `${(stats.valeurStock / 1000).toFixed(0)}k`, icon: 'banknote', color: '#8B5CF6' },
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
                    { label: 'Ajouter produit', icon: 'plus-circle', color: '#10B981', onPress: () => setActiveTab('catalog') },
                    { label: 'Créer promo', icon: 'tag', color: '#F59E0B', onPress: () => setActiveTab('promos') },
                    { label: 'Vitrine', icon: 'store', color: '#3B82F6', onPress: () => (navigation as any).navigate('SupermarketHome') },
                    { label: 'BayamSelam', icon: 'search', color: '#8B5CF6', onPress: () => (navigation as any).navigate('BayamSelamSearch') },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}>
                            <SafeIcon name={a.icon as any} size={22} color={a.color} />
                        </View>
                        <Text style={s.quickLabel} numberOfLines={2}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={s.sectionTitle}>Catégories</Text>
            <View style={s.typesGrid}>
                {CATEGORIES.map(c => (
                    <View key={c.key} style={s.typeCard}>
                        <View style={[s.typeIcon, { backgroundColor: c.color + '15' }]}>
                            <SafeIcon name={c.icon as any} size={18} color={c.color} />
                        </View>
                        <Text style={s.typeLabel}>{c.label}</Text>
                        <Text style={s.typeCount}>{products.filter(p => p.categorie === c.key).length}</Text>
                    </View>
                ))}
            </View>

            {products.length > 0 && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>Produits récents</Text>
                        <TouchableOpacity onPress={() => setActiveTab('catalog')}><Text style={s.seeAll}>Tout voir</Text></TouchableOpacity>
                    </View>
                    {products.slice(0, 4).map((p, i) => (
                        <View key={i} style={s.productCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.productName}>{p.nom}</Text>
                                <Text style={s.productDetail}>
                                    {p.prix.toLocaleString()} {devise} · Stock: {p.stock || 0}
                                    {p.en_promotion ? ` · Promo: ${p.prix_promo?.toLocaleString()} ${devise}` : ''}
                                </Text>
                            </View>
                            {p.en_promotion && <View style={s.promoBadge}><Text style={s.promoBadgeText}>PROMO</Text></View>}
                        </View>
                    ))}
                </>
            )}

            {products.length === 0 && (
                <View style={s.emptyState}>
                    <SafeIcon name="store" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Catalogue vide</Text>
                    <Text style={s.emptyText}>Ajoutez vos produits pour les rendre visibles aux clients.</Text>
                    <NativeButton title="Ajouter des produits" onPress={() => setActiveTab('catalog')} style={{ marginTop: 16 }} />
                </View>
            )}
        </ScrollView>
    );

    const renderCatalog = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <NativeButton title="+ Ajouter un produit" onPress={() => Alert.alert('Info', 'Utilisez le formulaire intelligent pour ajouter un produit.')} variant="primary" style={{ marginBottom: 16 }} />
            {products.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="package" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Aucun produit</Text>
                </View>
            ) : (
                products.map((p, i) => (
                    <View key={i} style={s.productCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.productName}>{p.nom}</Text>
                            <Text style={s.productDetail}>{p.prix.toLocaleString()} {devise} · Stock: {p.stock || 0}</Text>
                        </View>
                        <View style={[s.statusDot, { backgroundColor: p.is_active !== false ? '#10B981' : '#EF4444' }]} />
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderPromos = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <NativeButton title="+ Créer une promotion" onPress={() => (navigation as any).navigate('CreateFlashPromo')} variant="primary" style={{ marginBottom: 16 }} />
            {products.filter(p => p.en_promotion).length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="tag" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Aucune promotion active</Text>
                    <Text style={s.emptyText}>Créez des promotions pour attirer plus de clients.</Text>
                </View>
            ) : (
                products.filter(p => p.en_promotion).map((p, i) => (
                    <View key={i} style={s.productCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.productName}>{p.nom}</Text>
                            <Text style={s.productDetail}>
                                <Text style={{ textDecorationLine: 'line-through', color: '#9CA3AF' }}>{p.prix.toLocaleString()} {devise}</Text>
                                {' → '}{p.prix_promo?.toLocaleString()} {devise}
                            </Text>
                        </View>
                        <View style={s.promoBadge}><Text style={s.promoBadgeText}>PROMO</Text></View>
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.analyticsCard}>
                <Text style={s.analyticsTitle}>Résumé</Text>
                {[
                    { label: 'Total produits', value: stats.total, color: '#3B82F6' },
                    { label: 'En stock', value: stats.enStock, color: '#10B981' },
                    { label: 'En promotion', value: stats.enPromo, color: '#F59E0B' },
                    { label: `Valeur stock (${devise})`, value: stats.valeurStock.toLocaleString(), color: '#8B5CF6' },
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
            <LinearGradient colors={['#10B981', '#059669']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>Dashboard Supermarché</Text>
                        <Text style={s.headerSub}>{user?.name || 'Partenaire'}</Text>
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
                {activeTab === 'catalog' && renderCatalog()}
                {activeTab === 'promos' && renderPromos()}
                {activeTab === 'analytics' && renderAnalytics()}
            </View>
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
    tabLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 1 },
    statValue: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginTop: 6 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 10 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
    seeAll: { color: '#10B981', fontSize: 13, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 10 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeCard: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1 },
    typeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    typeLabel: { fontSize: 11, fontWeight: '600', color: '#1F2937' },
    typeCount: { fontSize: 10, color: '#6B7280', marginTop: 2 },
    productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    productName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    productDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    promoBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    promoBadgeText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
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

export default SupermarketPartnerDashboardScreen;
