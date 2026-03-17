// Dashboard professionnel pour prestataires Supermarché
// Gestion du catalogue, stocks, promotions, commandes et vérification coursier

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type TabType = 'overview' | 'catalog' | 'orders' | 'promos' | 'analytics';

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
    { key: 'hygiene', label: t('supermarketPartnerDashboard.hygiene'), icon: 'droplets', color: '#8B5CF6' },
    { key: 'menager', label: t('supermarketPartnerDashboard.menager'), icon: 'home', color: '#F59E0B' },
    { key: 'bebe', label: t('supermarketPartnerDashboard.bebe'), icon: 'baby', color: '#EC4899' },
    { key: 'autres', label: 'Autres', icon: 'package', color: '#6B7280' },
];

interface PendingOrder {
    delivery_id: string;
    status: string;
    client_name: string;
    items_count: number;
    total_amount: number;
    created_at: string;
    courier_name?: string;
    courier_assigned: boolean;
}

const SupermarketPartnerDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user, logout } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [stats, setStats] = useState({ total: 0, enStock: 0, enPromo: 0, valeurStock: 0 });
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [bulkOverwrite, setBulkOverwrite] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [serviceId, setServiceId] = useState<number | null>(null);

    const devise = getCurrencyIntelligently() || 'FCFA';

    const loadProducts = useCallback(async () => {
        try {
            // 1. Récupérer les services supermarché du partenaire
            const resp: any = await apiGet('/api/specialized-services/user?type=supermarche');
            const services = resp?.data?.services || [];
            // Sauvegarder le serviceId pour l'import en masse
            if (services.length > 0) {
                setServiceId(services[0].service_id || services[0].id);
            }

            // 2. Pour chaque service, charger les produits réels (service_products)
            const allProducts: CatalogProduct[] = [];
            for (const svc of services) {
                const serviceId = svc.service_id || svc.id;
                try {
                    const prodResp: any = await apiGet(`/api/supermarkets/${serviceId}/products?limit=100`);
                    const backendData = prodResp?.data;
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
            console.error('[SupermarketPartnerDashboard] Error produits:', e);
        }
    }, []);

    const loadOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            // Charger les commandes en attente de pickup (livraisons assignées au supermarché)
            const resp: any = await apiGet('/api/delivery/provider/pending-pickups');
            const data = resp?.data;
            const deliveries = data?.deliveries || data?.data || [];
            const mapped: PendingOrder[] = deliveries.map((d: any) => ({
                delivery_id: d.id || d.delivery_id,
                status: d.status || 'pending',
                client_name: d.client_name || d.recipient?.contact_name || 'Client',
                items_count: d.items_count || d.products?.length || 0,
                total_amount: d.total_amount || 0,
                created_at: d.created_at || d.requested_at || '',
                courier_name: d.courier_name || null,
                courier_assigned: !!(d.courier_id || d.courier_name),
            }));
            setOrders(mapped);
        } catch (err: any) {
            console.warn('[SupermarketPartnerDashboard] Erreur chargement commandes:', err);
            setOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    }, []);

    const loadData = useCallback(async () => {
        await Promise.all([loadProducts(), loadOrders()]);
        setLoading(false);
        setRefreshing(false);
    }, [loadProducts, loadOrders]);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const handleBulkImport = async () => {
        if (!bulkText.trim()) { Alert.alert('Erreur', t('supermarketPartnerDashboardScreen.collezVosDonneesCsvOuJson')); return; }
        if (!serviceId) {
            Alert.alert('Erreur', t('supermarketPartnerDashboardScreen.aucunServiceSupermarcheTrouveCreezD')abord votre service.'); return; }
        setBulkLoading(true);
            try {
                let payload: any = { service_id: serviceId, overwrite_existing: bulkOverwrite };
                const trimmed = bulkText.trim();
                if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                    // JSON
                    const parsed = JSON.parse(trimmed);
                    payload.products = Array.isArray(parsed) ? parsed : [parsed];
                } else {
                    // CSV
                    payload.csv_data = trimmed;
                }
                const resp: any = await apiPost('/api/supermarkets/products/bulk-import', payload);
                const data = resp?.data as any;
                setShowBulkModal(false);
                setBulkText('');
                Alert.alert(
                    t('supermarketPartnerDashboardScreen.importTermine'),
                    t('supermarketPartnerDashboardScreen.produitsCreesnMisAJourdataerrorslength0', { data?_created || 0: data?.created || 0, data ? _updated || 0 : data?.updated || 0 }) \n\n⚠️ ${ data.errors.length } erreur(s): \n${ data.errors.slice(0, 3).join('\n') } ` : ''}`,
            );
loadProducts();
        } catch (e: any) {
    const msg = e?.message || 'Erreur import';
    if (msg.includes('JSON')) { Alert.alert('Erreur format', t('supermarketPartnerDashboardScreen.leFormatJsonEstInvalideVerifiez')); }
    else { Alert.alert('Erreur', msg); }
} finally { setBulkLoading(false); }
    };

const pendingOrdersCount = orders.filter(o => o.courier_assigned && ['assigned', 'en_route_pickup', 'arrival_pickup'].includes(o.status)).length;

const TABS: { key: TabType; label: string; icon: string; badge?: number }[] = [
    { key: 'overview', label: t('supermarketPartnerDashboard.accueil'), icon: 'layout-dashboard' },
    { key: 'catalog', label: 'Catalogue', icon: 'package' },
    { key: 'orders', label: t('supermarketPartnerDashboard.commandes'), icon: 'shopping-cart', badge: pendingOrdersCount },
    { key: 'promos', label: 'Promos', icon: 'tag' },
    { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
];

if (loading) {
    return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#10B981" /><Text style={s.loadingText}>{t('supermarketPartnerDashboard.chargement')}</Text></View>;
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

        {pendingOrdersCount > 0 && (
            <TouchableOpacity style={s.alertBanner} onPress={() => setActiveTab('orders')}>
                <SafeIcon name="alert-circle" size={20} color="#D97706" />
                <Text style={s.alertText}>
                    {pendingOrdersCount} commande{pendingOrdersCount > 1 ? 's' : ''} en attente de pickup
                </Text>
                <SafeIcon name="chevron-right" size={18} color="#D97706" />
            </TouchableOpacity>
        )}

        <Text style={s.sectionTitle}>Actions rapides</Text>
        <View style={s.quickRow}>
            {[
                { label: t('supermarketPartnerDashboard.ajouterProduit'), icon: 'plus-circle', color: '#10B981', onPress: () => (navigation as any).navigate('FormulaireYukpoIntelligent', { category: 'supermarche' }) },
                { label: 'Import masse', icon: 'upload', color: '#3B82F6', onPress: () => setShowBulkModal(true) },
                { label: t('supermarketPartnerDashboard.mesProduits'), icon: 'package', color: '#F59E0B', onPress: () => (navigation as any).navigate('MesProduits') },
                { label: t('supermarketPartnerDashboard.commandes'), icon: 'shopping-cart', color: '#EF4444', onPress: () => setActiveTab('orders') },
                { label: 'Portefeuille', icon: 'wallet', color: '#8B5CF6', onPress: () => (navigation as any).navigate('WalletFinancial') },
                {
                    label: t('common.sortir'), icon: 'log-out', color: '#DC2626', onPress: () => {
                        Alert.alert(
                            t('common.deconnexion'),
                            t('common.confirmDeconnexion'),
                            [
                                { text: t('common.cancel'), style: 'cancel' },
                                { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }
                            ]
                        );
                    }
                },
            ].map((a, i) => (
                <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                    <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}>
                        <SafeIcon name={a.icon as any} size={22} color={a.color} />
                    </View>
                    <Text style={s.quickLabel} numberOfLines={2}>{a.label}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <Text style={s.sectionTitle}>{t('supermarketPartnerDashboard.categories')}</Text>
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
                    <Text style={s.sectionTitle}>{t('supermarketPartnerDashboard.produitsRecents')}</Text>
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
                <Text style={s.emptyTitle}>{t('supermarketPartnerDashboard.catalogueVide')}</Text>
                <Text style={s.emptyText}>{t('supermarketPartnerDashboard.ajoutezVosProduitsPourLes')}</Text>
                <NativeButton title={t('supermarketPartnerDashboard.ajouterDesProduits')} onPress={() => setActiveTab('catalog')} style={{ marginTop: 16 }} />
            </View>
        )}
    </ScrollView>
);

const renderCatalog = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
                <NativeButton title={t('supermarketPartnerDashboard.ajouterUnProduit')} onPress={() => (navigation as any).navigate('FormulaireYukpoIntelligent', { category: 'supermarche' })} variant="primary" />
            </View>
            <View style={{ flex: 1 }}>
                <NativeButton title="Gerer mes produits" onPress={() => (navigation as any).navigate('MesProduits')} />
            </View>
        </View>
        <TouchableOpacity style={s.bulkImportBtn} onPress={() => setShowBulkModal(true)}>
            <SafeIcon name="upload" size={16} color="#10B981" />
            <Text style={s.bulkImportBtnText}>Import en masse (CSV / JSON)</Text>
            <SafeIcon name="chevron-right" size={16} color="#10B981" />
        </TouchableOpacity>
        {products.length === 0 ? (
            <View style={s.emptyState}>
                <SafeIcon name="package" size={48} color="#9CA3AF" />
                <Text style={s.emptyTitle}>{t('supermarketPartnerDashboard.aucunProduit')}</Text>
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
        <NativeButton title={t('supermarketPartnerDashboard.creerUnePromotion')} onPress={() => (navigation as any).navigate('CreateFlashPromo')} variant="primary" style={{ marginBottom: 16 }} />
        {products.filter(p => p.en_promotion).length === 0 ? (
            <View style={s.emptyState}>
                <SafeIcon name="tag" size={48} color="#9CA3AF" />
                <Text style={s.emptyTitle}>{t('supermarketPartnerDashboard.aucunePromotionActive')}</Text>
                <Text style={s.emptyText}>{t('supermarketPartnerDashboard.creezDesPromotionsPourAttirer')}</Text>
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

const renderOrders = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <Text style={s.sectionTitle}>{t('supermarketPartnerDashboard.commandesEnAttenteDePickup')}</Text>
        {loadingOrders ? (
            <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
        ) : orders.length === 0 ? (
            <View style={s.emptyState}>
                <SafeIcon name="inbox" size={48} color="#9CA3AF" />
                <Text style={s.emptyTitle}>{t('supermarketPartnerDashboard.aucuneCommandeEnAttente')}</Text>
                <Text style={s.emptyText}>{t('supermarketPartnerDashboard.lesCommandesDesClientsApparaitront')}</Text>
            </View>
        ) : (
            orders.map((order, i) => {
                const canVerify = order.courier_assigned && ['assigned', 'en_route_pickup', 'arrival_pickup'].includes(order.status);
                const statusLabel = order.status === 'arrival_pickup' ? 'Coursier arrive' :
                    order.status === 'en_route_pickup' ? 'Coursier en route' :
                        order.status === 'assigned' ? 'Coursier assigne' :
                            order.status === 'shopping_pending' ? 'En preparation' : order.status;
                const statusColor = order.status === 'arrival_pickup' ? '#10B981' :
                    order.status === 'en_route_pickup' ? '#3B82F6' : '#F59E0B';

                return (
                    <View key={order.delivery_id || i} style={s.orderCard}>
                        <View style={s.orderHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.orderClient}>{order.client_name}</Text>
                                <Text style={s.orderMeta}>
                                    {order.items_count} article{order.items_count > 1 ? 's' : ''}
                                    {order.total_amount > 0 ? ` · ${order.total_amount.toLocaleString()} ${devise}` : ''}
                                </Text>
                                {order.courier_name && (
                                    <Text style={s.orderCourier}>Coursier: {order.courier_name}</Text>
                                )}
                                {order.created_at && (
                                    <Text style={s.orderDate}>
                                        {new Date(order.created_at).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                )}
                            </View>
                            <View style={[s.orderStatusBadge, { backgroundColor: statusColor + '20' }]}>
                                <Text style={[s.orderStatusText, { color: statusColor }]}>{statusLabel}</Text>
                            </View>
                        </View>

                        {canVerify && (
                            <TouchableOpacity
                                style={s.verifyButton}
                                onPress={() => (navigation as any).navigate('ProviderCourierVerification', { deliveryId: order.delivery_id })}
                            >
                                <SafeIcon name="shield-check" size={18} color="#fff" />
                                <Text style={s.verifyButtonText}>Verifier le coursier et remettre les produits</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );
            })
        )}
    </ScrollView>
);

const renderAnalytics = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <View style={s.analyticsCard}>
            <Text style={s.analyticsTitle}>{t('supermarketPartnerDashboard.resume')}</Text>
            {[
                { label: t('supermarketPartnerDashboard.totalProduits'), value: stats.total, color: '#3B82F6' },
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
                    <Text style={s.headerTitle}>{t('supermarketPartnerDashboard.dashboardSupermarche')}</Text>
                    <Text style={s.headerSub}>{user?.name || t('supermarketPartnerDashboard.partenaire')}</Text>
                </View>
            </View>
            <View style={s.tabRow}>
                {TABS.map(t => (
                    <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => setActiveTab(t.key)}>
                        <SafeIcon name={t.icon as any} size={16} color={activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.6)'} />
                        <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
                        {t.badge && t.badge > 0 ? (
                            <View style={s.tabBadge}><Text style={s.tabBadgeText}>{t.badge}</Text></View>
                        ) : null}
                    </TouchableOpacity>
                ))}
            </View>
        </LinearGradient>
        <View style={s.content}>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'catalog' && renderCatalog()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'promos' && renderPromos()}
            {activeTab === 'analytics' && renderAnalytics()}
        </View>

        {/* Modal Import en masse */}
        <Modal visible={showBulkModal} animationType="slide" transparent onRequestClose={() => setShowBulkModal(false)}>
            <View style={s.modalOverlay}>
                <View style={s.modalContent}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Import en masse de produits</Text>
                        <TouchableOpacity onPress={() => setShowBulkModal(false)}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ padding: 16 }}>
                        {/* Guide / Aide */}
                        <TouchableOpacity style={s.guideToggle} onPress={() => setShowGuide(!showGuide)}>
                            <SafeIcon name="help-circle" size={18} color="#3B82F6" />
                            <Text style={s.guideToggleText}>Comment preparer mes donnees ?</Text>
                            <SafeIcon name={showGuide ? 'chevron-up' : 'chevron-down'} size={16} color="#3B82F6" />
                        </TouchableOpacity>

                        {showGuide && (
                            <View style={s.guideBox}>
                                <Text style={s.guideTitle}>Format CSV (recommande)</Text>
                                <Text style={s.guideText}>
                                    Chaque ligne = 1 produit. Colonnes separees par virgule, point-virgule ou tabulation.
                                </Text>
                                <View style={s.codeBlock}>
                                    <Text style={s.codeText}>
                                        {`nom;prix;stock;categorie;marque;unite\nRiz 5kg;3500;50;alimentaire;Uncle Ben's;sac\nLait Gloria;800;100;boissons;Gloria;boite\nSavon Palmolive;500;200;hygiene;Palmolive;piece`}
                                    </Text>
                                </View>
                                <Text style={s.guideSubtitle}>Colonnes disponibles (dans l'ordre) :</Text>
                                <Text style={s.guideText}>
                                    1. nom (obligatoire){"\n"}
                                    2. prix{"\n"}
                                    3. stock (quantite){"\n"}
                                    4. categorie (alimentaire, boissons, hygiene, menager, bebe, autres){"\n"}
                                    5. marque{"\n"}
                                    6. unite (kg, L, piece, sac, boite...){"\n"}
                                    7. description{"\n"}
                                    8. code_barre{"\n"}
                                    9. en_promotion (oui/non){"\n"}
                                    10. prix_promo
                                </Text>

                                <Text style={[s.guideTitle, { marginTop: 12 }]}>Format JSON</Text>
                                <View style={s.codeBlock}>
                                    <Text style={s.codeText}>
                                        {`[\n  {"nom": "Riz 5kg", "prix": 3500, "stock": 50, "categorie": "alimentaire"},\n  {"nom": "Lait Gloria", "prix": 800, "stock": 100}\n]`}
                                    </Text>
                                </View>

                                <Text style={[s.guideTitle, { marginTop: 12 }]}>Conseils</Text>
                                <Text style={s.guideText}>
                                    - Vous pouvez copier-coller depuis Excel ou Google Sheets{"\n"}
                                    - Maximum 500 produits par import{"\n"}
                                    - Seul le nom est obligatoire{"\n"}
                                    - Les images peuvent etre ajoutees apres via "Mes Produits"{"\n"}
                                    - Activez "Remplacer existants" pour mettre a jour les prix/stocks
                                </Text>
                            </View>
                        )}

                        <Text style={s.inputLabel}>Collez vos donnees ici (CSV ou JSON) :</Text>
                        <TextInput
                            style={s.bulkTextInput}
                            value={bulkText}
                            onChangeText={setBulkText}
                            placeholder={`nom;prix;stock;categorie;marque\nRiz 5kg;3500;50;alimentaire;Uncle Ben's\nLait Gloria;800;100;boissons;Gloria`}
                            placeholderTextColor="#9CA3AF"
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={s.switchRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.switchLabel}>Remplacer les produits existants</Text>
                                <Text style={s.switchHint}>Si un produit avec le meme nom existe, il sera mis a jour</Text>
                            </View>
                            <Switch
                                value={bulkOverwrite}
                                onValueChange={setBulkOverwrite}
                                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                            />
                        </View>

                        {bulkText.trim().length > 0 && (
                            <Text style={s.previewCount}>
                                Environ {bulkText.trim().split('\n').filter(l => l.trim()).length} ligne(s) detectee(s)
                            </Text>
                        )}
                    </ScrollView>

                    <View style={s.modalFooter}>
                        <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowBulkModal(false); setBulkText(''); }}>
                            <Text style={s.cancelBtnText}>{t('supermarketPartnerDashboardScreen.annuler')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[s.importBtn, (!bulkText.trim() || bulkLoading) && { opacity: 0.5 }]}
                            onPress={handleBulkImport}
                            disabled={!bulkText.trim() || bulkLoading}
                        >
                            {bulkLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <SafeIcon name="upload" size={16} color="#fff" />
                            )}
                            <Text style={s.importBtnText}>{bulkLoading ? 'Import...' : 'Importer'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
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
    alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, gap: 8, marginTop: 16 },
    alertText: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '500' },
    tabBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', marginLeft: 2 },
    tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    orderCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    orderHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    orderClient: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
    orderMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    orderCourier: { fontSize: 12, color: '#3B82F6', marginTop: 2 },
    orderDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
    orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    orderStatusText: { fontSize: 11, fontWeight: '600' },
    verifyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, marginTop: 12 },
    verifyButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    bulkImportBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#ECFDF5', borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 16 },
    bulkImportBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#10B981' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
    modalFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    guideToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: '#EFF6FF', borderRadius: 8, marginBottom: 12 },
    guideToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#3B82F6' },
    guideBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    guideTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
    guideSubtitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 4 },
    guideText: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
    codeBlock: { backgroundColor: '#1F2937', borderRadius: 8, padding: 10, marginVertical: 6 },
    codeText: { fontSize: 11, color: '#A5F3FC', fontFamily: 'monospace' },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
    bulkTextInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, minHeight: 120, fontSize: 12, fontFamily: 'monospace', color: '#1F2937', backgroundColor: '#FAFAFA' },
    switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
    switchLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
    switchHint: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
    previewCount: { fontSize: 12, color: '#6B7280', marginTop: 8, fontStyle: 'italic' },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    importBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
    importBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default SupermarketPartnerDashboardScreen;
