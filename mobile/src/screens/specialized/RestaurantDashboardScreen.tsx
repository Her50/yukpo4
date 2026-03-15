// Dashboard professionnel pour prestataires Restaurant
// Gestion du menu, commandes, horaires et analytics

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

type TabType = 'overview' | 'menu' | 'orders' | 'analytics';

interface MenuItem {
    id: number;
    nom: string;
    description?: string;
    prix: number;
    categorie?: string;
    is_disponible: boolean;
    image?: string;
}

interface Order {
    id: number;
    client_name: string;
    items: string[];
    total: number;
    status: string;
    created_at: string;
}

const CATEGORIES_PLAT = [
    { key: 'entree', label: 'Entrées', icon: 'salad', color: '#10B981' },
    { key: 'plat', label: 'Plats', icon: 'utensils', color: '#F59E0B' },
    { key: 'dessert', label: 'Desserts', icon: 'cake', color: '#EC4899' },
    { key: 'boisson', label: 'Boissons', icon: 'coffee', color: '#3B82F6' },
    { key: 'specialite', label: 'Spécialités', icon: 'star', color: '#8B5CF6' },
];

const RestaurantDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isOpen, setIsOpen] = useState(true);
    const [stats, setStats] = useState({ totalPlats: 0, disponibles: 0, commandesJour: 0, chiffreJour: 0 });

    const devise = getCurrencyIntelligently() || 'FCFA';

    const loadData = useCallback(async () => {
        try {
            const [menuResp, ordersResp] = await Promise.allSettled([
                apiGet('/api/specialized-services/user?type=restaurant'),
                apiGet('/api/orders?status=pending'),
            ]);

            const menuData = menuResp.status === 'fulfilled' && (menuResp.value as any)?.data
                ? ((menuResp.value as any).data?.services || []) : [];
            setMenuItems(menuData);

            const ordersData = ordersResp.status === 'fulfilled' && (ordersResp.value as any)?.data
                ? ((ordersResp.value as any).data?.orders || []) : [];
            setOrders(ordersData);

            setStats({
                totalPlats: menuData.length,
                disponibles: menuData.filter((m: any) => m.is_disponible !== false).length,
                commandesJour: ordersData.length,
                chiffreJour: ordersData.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
            });
        } catch (e) {
            console.error('[RestaurantDashboard] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: 'Accueil', icon: 'layout-dashboard' },
        { key: 'menu', label: 'Menu', icon: 'book-open' },
        { key: 'orders', label: 'Commandes', icon: 'shopping-bag' },
        { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
    ];

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#DC2626" /><Text style={s.loadingText}>Chargement...</Text></View>;
    }

    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: 'Plats au menu', value: stats.totalPlats, icon: 'utensils', color: '#F59E0B' },
                    { label: 'Disponibles', value: stats.disponibles, icon: 'check-circle', color: '#10B981' },
                    { label: 'Commandes (jour)', value: stats.commandesJour, icon: 'shopping-bag', color: '#3B82F6' },
                    { label: 'CA du jour', value: `${stats.chiffreJour.toLocaleString()}`, icon: 'banknote', color: '#8B5CF6' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {/* Restaurant status */}
            <View style={[s.statusCard, { backgroundColor: isOpen ? '#F0FDF4' : '#FEF2F2' }]}>
                <SafeIcon name={isOpen ? 'door-open' : 'door-closed'} size={20} color={isOpen ? '#16A34A' : '#DC2626'} />
                <View style={{ flex: 1 }}>
                    <Text style={[s.statusTitle, { color: isOpen ? '#16A34A' : '#DC2626' }]}>
                        {isOpen ? 'Restaurant ouvert' : 'Restaurant fermé'}
                    </Text>
                    <Text style={s.statusSub}>{isOpen ? 'Accepte les commandes' : 'Commandes suspendues'}</Text>
                </View>
                <Switch value={isOpen} onValueChange={setIsOpen} trackColor={{ false: '#D1D5DB', true: '#16A34A' }} />
            </View>

            <Text style={s.sectionTitle}>Actions rapides</Text>
            <View style={s.quickRow}>
                {[
                    { label: 'Ajouter plat', icon: 'plus-circle', color: '#DC2626', onPress: () => setActiveTab('menu') },
                    { label: 'Commandes', icon: 'shopping-bag', color: '#3B82F6', onPress: () => setActiveTab('orders') },
                    { label: 'Planifier menu', icon: 'calendar', color: '#8B5CF6', onPress: () => (navigation as any).navigate('MenuPlanningHub') },
                    { label: 'Statistiques', icon: 'bar-chart-2', color: '#F59E0B', onPress: () => setActiveTab('analytics') },
                    { label: 'Portefeuille', icon: 'wallet', color: '#8B5CF6', onPress: () => (navigation as any).navigate('WalletFinancial') },
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
                {CATEGORIES_PLAT.map(c => (
                    <View key={c.key} style={s.typeCard}>
                        <View style={[s.typeIcon, { backgroundColor: c.color + '15' }]}>
                            <SafeIcon name={c.icon as any} size={18} color={c.color} />
                        </View>
                        <Text style={s.typeLabel}>{c.label}</Text>
                        <Text style={s.typeCount}>{menuItems.filter(m => m.categorie === c.key).length}</Text>
                    </View>
                ))}
            </View>

            {menuItems.length > 0 && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>Menu récent</Text>
                        <TouchableOpacity onPress={() => setActiveTab('menu')}><Text style={s.seeAll}>Tout voir</Text></TouchableOpacity>
                    </View>
                    {menuItems.slice(0, 4).map((m, i) => (
                        <View key={i} style={s.menuItemCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.menuItemName}>{m.nom}</Text>
                                <Text style={s.menuItemDetail}>{m.categorie || 'Plat'} · {m.prix.toLocaleString()} {devise}</Text>
                            </View>
                            <View style={[s.statusDot, { backgroundColor: m.is_disponible !== false ? '#10B981' : '#EF4444' }]} />
                        </View>
                    ))}
                </>
            )}

            {menuItems.length === 0 && (
                <View style={s.emptyState}>
                    <SafeIcon name="utensils" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Menu vide</Text>
                    <Text style={s.emptyText}>Ajoutez vos premiers plats pour commencer.</Text>
                    <NativeButton title="Créer le menu" onPress={() => setActiveTab('menu')} style={{ marginTop: 16 }} />
                </View>
            )}
        </ScrollView>
    );

    const renderMenu = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <NativeButton title="+ Ajouter un plat" onPress={() => Alert.alert('Info', 'Utilisez le formulaire intelligent pour ajouter un plat au menu.')} variant="primary" style={{ marginBottom: 16 }} />
            {menuItems.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="book-open" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Aucun plat au menu</Text>
                </View>
            ) : (
                menuItems.map((m, i) => (
                    <View key={i} style={s.menuItemCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.menuItemName}>{m.nom}</Text>
                            <Text style={s.menuItemDetail}>{m.categorie || 'Plat'} · {m.prix.toLocaleString()} {devise}</Text>
                            {m.description ? <Text style={s.menuItemDesc} numberOfLines={2}>{m.description}</Text> : null}
                        </View>
                        <View style={[s.statusDot, { backgroundColor: m.is_disponible !== false ? '#10B981' : '#EF4444' }]} />
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderOrders = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {orders.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="shopping-bag" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Aucune commande en cours</Text>
                    <Text style={s.emptyText}>Les nouvelles commandes apparaîtront ici.</Text>
                </View>
            ) : (
                orders.map((o, i) => (
                    <View key={i} style={s.orderCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.orderName}>{o.client_name}</Text>
                            <Text style={s.orderDetail}>{(o.items || []).join(', ')}</Text>
                            <Text style={s.orderTotal}>{(o.total || 0).toLocaleString()} {devise}</Text>
                        </View>
                        <View style={[s.orderBadge, { backgroundColor: o.status === 'pending' ? '#FEF3C7' : o.status === 'preparing' ? '#DBEAFE' : '#DCFCE7' }]}>
                            <Text style={[s.orderBadgeText, { color: o.status === 'pending' ? '#D97706' : o.status === 'preparing' ? '#2563EB' : '#16A34A' }]}>
                                {o.status === 'pending' ? 'En attente' : o.status === 'preparing' ? 'En prépa' : 'Prêt'}
                            </Text>
                        </View>
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
                    { label: 'Plats au menu', value: stats.totalPlats, color: '#F59E0B' },
                    { label: 'Disponibles', value: stats.disponibles, color: '#10B981' },
                    { label: 'Commandes du jour', value: stats.commandesJour, color: '#3B82F6' },
                    { label: `CA du jour (${devise})`, value: stats.chiffreJour.toLocaleString(), color: '#8B5CF6' },
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
            <LinearGradient colors={['#DC2626', '#B91C1C']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>Dashboard Restaurant</Text>
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
                {activeTab === 'menu' && renderMenu()}
                {activeTab === 'orders' && renderOrders()}
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
    statusCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 16, gap: 10 },
    statusTitle: { fontSize: 14, fontWeight: '600' },
    statusSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 10 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
    seeAll: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 10 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeCard: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1 },
    typeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    typeLabel: { fontSize: 11, fontWeight: '600', color: '#1F2937' },
    typeCount: { fontSize: 10, color: '#6B7280', marginTop: 2 },
    menuItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    menuItemName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    menuItemDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    menuItemDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    orderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    orderName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    orderDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    orderTotal: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginTop: 4 },
    orderBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    orderBadgeText: { fontSize: 11, fontWeight: '600' },
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

export default RestaurantDashboardScreen;
