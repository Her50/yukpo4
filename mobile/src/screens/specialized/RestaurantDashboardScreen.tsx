// Dashboard professionnel partenaire Restaurant — Yukpo
// Gestion du menu, commandes (accepter/préparer/prêt), horaires, statistiques

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
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
import GlobalShareModal, { GlobalSharePayload } from '../../components/GlobalShareModal';
import ProductVideoCreationModal from '../../components/ProductVideoCreationModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { ManagedProduct } from '../../types/ManagedProduct';
import {
    RestaurantMenuItem,
    RestaurantOpeningHour,
    RestaurantOrder,
    RestaurantReservation,
    restaurantManagementService,
} from '../../services/restaurantManagementService';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';

type TabType = 'overview' | 'menu' | 'orders' | 'hours' | 'finances';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const JOURS_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const CATEGORIES_PLAT = [
    { key: 'entree', label: 'Entrées', icon: 'salad', color: '#10B981' },
    { key: 'plat', label: 'Plats', icon: 'utensils', color: '#F59E0B' },
    { key: 'dessert', label: 'Desserts', icon: 'cake', color: '#EC4899' },
    { key: 'boisson', label: 'Boissons', icon: 'coffee', color: '#3B82F6' },
    { key: 'specialite', label: 'Spécialités', icon: 'star', color: '#8B5CF6' },
];

const STATUS_ORDER: Record<string, { label: string; next: string; color: string }> = {
    pending:   { label: 'En attente',  next: 'accepted',  color: '#D97706' },
    accepted:  { label: 'Acceptée',    next: 'preparing', color: '#2563EB' },
    preparing: { label: 'En prépa.',   next: 'ready',     color: '#7C3AED' },
    ready:     { label: 'Prête',       next: 'completed', color: '#059669' },
    completed: { label: 'Terminée',    next: '',          color: '#6B7280' },
    cancelled: { label: 'Annulée',     next: '',          color: '#EF4444' },
};

const RestaurantDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user, logout } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [showStudioModal, setShowStudioModal] = useState(false);
    const [studioProduct, setStudioProduct] = useState<ManagedProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data
    const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
    const [orders, setOrders] = useState<RestaurantOrder[]>([]);
    const [reservations, setReservations] = useState<RestaurantReservation[]>([]);
    const [openingHours, setOpeningHours] = useState<RestaurantOpeningHour[]>([]);
    const [isOpen, setIsOpen] = useState(true);
    const [stats, setStats] = useState({
        totalPlats: 0, disponibles: 0, commandesJour: 0,
        chiffreJour: 0, reservationsJour: 0, boissonsActives: 0,
    });
    const [financial, setFinancial] = useState<any>(null);
    const [loadingFinances, setLoadingFinances] = useState(false);

    // Modal ajout/édition plat
    const [menuModal, setMenuModal] = useState(false);
    const [editItem, setEditItem] = useState<Partial<RestaurantMenuItem> | null>(null);
    const [savingItem, setSavingItem] = useState(false);

    // Partage social menu
    const [shareModal, setShareModal] = useState(false);
    const [sharePayload, setSharePayload] = useState<GlobalSharePayload | null>(null);
    const [myServiceId, setMyServiceId] = useState<number | null>(null);

    // Modal horaires
    const [hoursModal, setHoursModal] = useState(false);
    const [editHour, setEditHour] = useState<RestaurantOpeningHour | null>(null);
    const [savingHour, setSavingHour] = useState(false);

    const devise = useCurrencyDetection() || 'XAF';

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [dashData, hoursData, overviewData] = await Promise.allSettled([
                restaurantManagementService.getDashboardData(),
                restaurantManagementService.getOpeningHours(),
                restaurantManagementService.getOverview(),
            ]);

            if (dashData.status === 'fulfilled') {
                const d = dashData.value;
                setMenuItems(d.menuItems);
                setOrders(d.pendingOrders);
                setReservations(d.reservations);
                setStats({
                    totalPlats: d.menuItems.length,
                    disponibles: d.menuItems.filter(m => m.is_disponible !== false).length,
                    commandesJour: d.pendingOrders.length,
                    chiffreJour: d.pendingOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
                    reservationsJour: d.reservations.length,
                    boissonsActives: d.menuItems.filter(m => m.categorie === 'boisson' && m.is_disponible !== false).length,
                });
            }
            if (hoursData.status === 'fulfilled') {
                setOpeningHours(hoursData.value);
            }
            if (overviewData.status === 'fulfilled' && overviewData.value?.service_id) {
                setMyServiceId(overviewData.value.service_id);
            }
        } catch (e) {
            console.error('[RestaurantDashboard]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    useEffect(() => {
        if (activeTab === 'finances' && !financial && !loadingFinances) {
            loadFinances();
        }
    }, [activeTab]);

    // ── Gestion statut commande ──────────────────────────────
    const advanceOrderStatus = async (order: RestaurantOrder) => {
        const info = STATUS_ORDER[order.status];
        if (!info?.next) return;
        try {
            await restaurantManagementService.updateOrderStatus(order.id, info.next);
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: info.next } : o));
        } catch {
            Alert.alert('Erreur', 'Impossible de mettre à jour la commande.');
        }
    };

    const cancelOrder = async (order: RestaurantOrder) => {
        Alert.alert('Annuler la commande', 'Confirmer l\'annulation ?', [
            { text: 'Non', style: 'cancel' },
            {
                text: 'Annuler', style: 'destructive', onPress: async () => {
                    try {
                        await restaurantManagementService.updateOrderStatus(order.id, 'cancelled');
                        setOrders(prev => prev.filter(o => o.id !== order.id));
                    } catch {
                        Alert.alert('Erreur', 'Impossible d\'annuler.');
                    }
                }
            },
        ]);
    };

    // ── Sauvegarde plat ──────────────────────────────────────
    const saveMenuItem = async () => {
        if (!editItem?.nom?.trim()) {
            Alert.alert('Erreur', 'Le nom du plat est requis.');
            return;
        }
        if (!editItem.prix || editItem.prix <= 0) {
            Alert.alert('Erreur', 'Le prix doit être supérieur à 0.');
            return;
        }
        setSavingItem(true);
        try {
            let resp: any;
            if (editItem.id) {
                resp = await restaurantManagementService.updateMenuItem(editItem.id, editItem);
            } else {
                resp = await restaurantManagementService.createMenuItem({
                    nom: editItem.nom!,
                    description: editItem.description,
                    prix: editItem.prix!,
                    categorie: editItem.categorie || 'plat',
                    is_disponible: editItem.is_disponible !== false,
                    image_url: editItem.image_url,
                    video_url: editItem.video_url,
                });
            }
            // Vérifier explicitement le succès — apiPost ne throw pas sur les erreurs HTTP
            if (resp && resp.success === false) {
                const msg = resp.error || resp.message || 'Erreur inconnue';
                throw new Error(msg);
            }
            setMenuModal(false);
            setEditItem(null);
            await loadData();
        } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible de sauvegarder le plat. Vérifiez votre connexion.');
        } finally {
            setSavingItem(false);
        }
    };

    const toggleItemDisponible = async (item: RestaurantMenuItem) => {
        try {
            await restaurantManagementService.updateMenuItem(item.id, { is_disponible: !item.is_disponible });
            setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_disponible: !m.is_disponible } : m));
        } catch {
            Alert.alert('Erreur', 'Impossible de modifier la disponibilité.');
        }
    };

    const deleteMenuItem = async (item: RestaurantMenuItem) => {
        Alert.alert('Supprimer', `Supprimer "${item.nom}" du menu ?`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer', style: 'destructive', onPress: async () => {
                    try {
                        await restaurantManagementService.deleteMenuItem(item.id);
                        setMenuItems(prev => prev.filter(m => m.id !== item.id));
                    } catch {
                        Alert.alert('Erreur', 'Impossible de supprimer.');
                    }
                },
            },
        ]);
    };

    // ── Sauvegarde horaire ───────────────────────────────────
    const saveHour = async () => {
        if (!editHour) return;
        setSavingHour(true);
        try {
            const updated = openingHours.some(h => h.day_of_week === editHour.day_of_week)
                ? openingHours.map(h => h.day_of_week === editHour.day_of_week ? editHour : h)
                : [...openingHours, editHour];
            await restaurantManagementService.updateOpeningHours(updated);
            setOpeningHours(updated);
            setHoursModal(false);
            setEditHour(null);
        } catch {
            Alert.alert('Erreur', 'Impossible de sauvegarder les horaires.');
        } finally {
            setSavingHour(false);
        }
    };

    const loadFinances = useCallback(async () => {
        setLoadingFinances(true);
        try {
            const resp = await restaurantManagementService.getFinancialSummary();
            setFinancial((resp as any)?.data);
        } catch (e) {
            console.error('[RestaurantDashboard] finances', e);
        } finally {
            setLoadingFinances(false);
        }
    }, []);

    // ── TABS ─────────────────────────────────────────────────
    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: t('restaurantDashboard.accueil'), icon: 'layout-dashboard' },
        { key: 'menu', label: 'Menu', icon: 'book-open' },
        { key: 'orders', label: t('restaurantDashboard.commandes'), icon: 'shopping-bag' },
        { key: 'hours', label: t('restaurantDashboard.horaires'), icon: 'clock' },
        { key: 'finances', label: t('restaurantDashboard.finances'), icon: 'trending-up' },
    ];

    if (loading) {
        return (
            <View style={s.loadingScreen}>
                <ActivityIndicator size="large" color="#DC2626" />
                <Text style={s.loadingText}>Chargement du restaurant…</Text>
            </View>
        );
    }

    // ── RENDER OVERVIEW ──────────────────────────────────────
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: 'Plats au menu', value: stats.totalPlats, icon: 'utensils', color: '#F59E0B' },
                    { label: 'Disponibles', value: stats.disponibles, icon: 'check-circle', color: '#10B981' },
                    { label: 'Commandes actives', value: stats.commandesJour, icon: 'shopping-bag', color: '#3B82F6' },
                    { label: `CA (${devise})`, value: stats.chiffreJour.toLocaleString(), icon: 'banknote', color: '#8B5CF6' },
                    { label: 'Réservations', value: stats.reservationsJour, icon: 'calendar', color: '#06B6D4' },
                    { label: 'Boissons actives', value: stats.boissonsActives, icon: 'coffee', color: '#2563EB' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {/* Statut ouverture */}
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
                    { label: 'Ajouter plat', icon: 'plus-circle', color: '#DC2626', onPress: () => { setEditItem({ categorie: 'plat', is_disponible: true }); setMenuModal(true); } },
                    { label: 'Commandes', icon: 'shopping-bag', color: '#3B82F6', onPress: () => setActiveTab('orders') },
                    { label: 'Horaires', icon: 'clock', color: '#8B5CF6', onPress: () => setActiveTab('hours') },
                    { label: 'Statistiques', icon: 'bar-chart-2', color: '#F59E0B', onPress: () => setActiveTab('finances') },
                    { label: 'Portefeuille', icon: 'wallet', color: '#059669', onPress: () => (navigation as any).navigate('WalletFinancial') },
                    {
                        label: 'Se déconnecter', icon: 'log-out', color: '#DC2626', onPress: () =>
                            Alert.alert('Déconnexion', 'Confirmer ?', [
                                { text: 'Annuler', style: 'cancel' },
                                { text: 'Se déconnecter', style: 'destructive', onPress: logout },
                            ])
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

            {/* Commandes en attente (aperçu) */}
            {orders.filter(o => o.status === 'pending').length > 0 && (
                <>
                    <Text style={[s.sectionTitle, { color: '#D97706' }]}>
                        ⚡ {orders.filter(o => o.status === 'pending').length} commande(s) en attente
                    </Text>
                    {orders.filter(o => o.status === 'pending').slice(0, 2).map((o, i) => (
                        <View key={i} style={s.orderCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.orderName}>{o.client_name || 'Client Yukpo'}</Text>
                                <Text style={s.orderDetail}>{o.items?.map(it => it.item_name).join(', ')}</Text>
                                <Text style={s.orderTotal}>{(o.total_amount || 0).toLocaleString()} {devise}</Text>
                            </View>
                            <TouchableOpacity
                                style={[s.actionBtn, { backgroundColor: '#2563EB' }]}
                                onPress={() => advanceOrderStatus(o)}>
                                <Text style={s.actionBtnText}>Accepter</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </>
            )}

            {/* Menu récent */}
            {menuItems.slice(0, 4).map((m, i) => (
                <View key={i} style={s.menuItemCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.menuItemName}>{m.nom}</Text>
                        <Text style={s.menuItemDetail}>{m.categorie || 'Plat'} · {m.prix.toLocaleString()} {devise}</Text>
                    </View>
                    <View style={[s.statusDot, { backgroundColor: m.is_disponible !== false ? '#10B981' : '#EF4444' }]} />
                </View>
            ))}
        </ScrollView>
    );

    // ── RENDER MENU ──────────────────────────────────────────
    const renderMenu = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                    <NativeButton
                        title="+ Ajouter un plat"
                        onPress={() => { setEditItem({ categorie: 'plat', is_disponible: true }); setMenuModal(true); }}
                        variant="primary"
                    />
                </View>
                <TouchableOpacity
                    style={s.shareMenuBtn}
                    onPress={() => {
                        setSharePayload({
                            title: `🍽️ Menu de ${user?.name || 'mon restaurant'} sur Yukpo`,
                            description: `Découvrez notre menu avec ${menuItems.filter(m => m.is_disponible !== false).length} plats disponibles. Commandez maintenant !`,
                            shareUrl: `https://yukpomnang.com/restaurant/${myServiceId || ''}`,
                            contentType: 'menu',
                            serviceId: myServiceId,
                        });
                        setShareModal(true);
                    }}>
                    <SafeIcon name="share-2" size={18} color="#7C3AED" />
                    <Text style={s.shareMenuBtnText}>Partager</Text>
                </TouchableOpacity>
            </View>
            {CATEGORIES_PLAT.map(cat => {
                const items = menuItems.filter(m => m.categorie === cat.key);
                if (items.length === 0) return null;
                return (
                    <View key={cat.key}>
                        <View style={[s.catHeader, { borderLeftColor: cat.color }]}>
                            <SafeIcon name={cat.icon as any} size={16} color={cat.color} />
                            <Text style={[s.catTitle, { color: cat.color }]}>{cat.label}</Text>
                            <Text style={s.catCount}>{items.length}</Text>
                        </View>
                        {items.map((m, i) => (
                            <View key={i} style={s.menuItemCard}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={s.menuItemName}>{m.nom}</Text>
                                        {m.video_url ? (
                                            <View style={s.videoBadge}>
                                                <SafeIcon name="video" size={10} color="#fff" />
                                                <Text style={s.videoBadgeText}>Vidéo</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={s.menuItemDetail}>{m.prix.toLocaleString()} {devise}</Text>
                                    {m.description ? <Text style={s.menuItemDesc} numberOfLines={2}>{m.description}</Text> : null}
                                </View>
                                <Switch
                                    value={m.is_disponible !== false}
                                    onValueChange={() => toggleItemDisponible(m)}
                                    trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                                <TouchableOpacity
                                    style={s.editBtn}
                                    onPress={() => { setEditItem({ ...m }); setMenuModal(true); }}>
                                    <SafeIcon name="edit-2" size={16} color="#2563EB" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={s.deleteBtn}
                                    onPress={() => deleteMenuItem(m)}>
                                    <SafeIcon name="trash-2" size={16} color="#EF4444" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={s.shareItemBtn}
                                    onPress={() => {
                                        setSharePayload({
                                            title: `🍽️ ${m.nom}`,
                                            description: `${m.description || ''}\n${m.prix.toLocaleString()} ${devise} — Disponible sur Yukpo`,
                                            shareUrl: `https://yukpomnang.com/restaurant/${myServiceId || ''}`,
                                            contentType: 'menu',
                                            serviceId: myServiceId,
                                        });
                                        setShareModal(true);
                                    }}>
                                    <SafeIcon name="share-2" size={15} color="#7C3AED" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.shareItemBtn, { backgroundColor: '#8B5CF620' }]}
                                    onPress={() => {
                                        const mp: ManagedProduct = {
                                            id: String(m.id || i),
                                            nom: m.nom,
                                            serviceId: String(myServiceId || ''),
                                            serviceTitre: 'Restaurant',
                                            prix: m.prix,
                                            type: m.categorie,
                                            description: m.description,
                                            product_index: typeof m.id === 'number' ? m.id : i,
                                        };
                                        setStudioProduct(mp);
                                        setShowStudioModal(true);
                                    }}>
                                    <SafeIcon name="film" size={15} color="#8B5CF6" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                );
            })}
            {menuItems.length === 0 && (
                <View style={s.emptyState}>
                    <SafeIcon name="book-open" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Menu vide</Text>
                    <Text style={s.emptyText}>Ajoutez vos premiers plats pour attirer des clients.</Text>
                </View>
            )}
        </ScrollView>
    );

    // ── RENDER ORDERS ────────────────────────────────────────
    const renderOrders = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}>
            {orders.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="shopping-bag" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Aucune commande active</Text>
                    <Text style={s.emptyText}>Les nouvelles commandes apparaîtront ici en temps réel.</Text>
                </View>
            ) : (
                orders.map((o, i) => {
                    const info = STATUS_ORDER[o.status] || { label: o.status, next: '', color: '#6B7280' };
                    return (
                        <View key={i} style={s.orderCardFull}>
                            <View style={s.orderCardHeader}>
                                <View>
                                    <Text style={s.orderName}>{o.client_name || 'Client Yukpo'}</Text>
                                    {o.client_phone ? <Text style={s.orderMeta}>📞 {o.client_phone}</Text> : null}
                                    <Text style={s.orderMeta}>
                                        {o.order_type === 'dine_in' ? '🍽 Sur place' : o.order_type === 'takeaway' ? '🥡 À emporter' : '🛵 Livraison'}
                                        {o.table_id ? ` · Table #${o.table_id}` : ''}
                                    </Text>
                                </View>
                                <View style={[s.statusBadge, { backgroundColor: info.color + '20' }]}>
                                    <Text style={[s.statusBadgeText, { color: info.color }]}>{info.label}</Text>
                                </View>
                            </View>
                            <View style={s.orderItemsList}>
                                {(o.items || []).map((it, j) => (
                                    <Text key={j} style={s.orderItemLine}>
                                        · {it.quantity}x {it.item_name} — {it.item_price.toLocaleString()} {devise}
                                    </Text>
                                ))}
                            </View>
                            <View style={s.orderFooter}>
                                <Text style={s.orderTotal}>Total : {(o.total_amount || 0).toLocaleString()} {devise}</Text>
                                {o.notes ? <Text style={s.orderNotes}>Note : {o.notes}</Text> : null}
                            </View>
                            {info.next !== '' && (
                                <View style={s.orderActions}>
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: info.color, flex: 1 }]}
                                        onPress={() => advanceOrderStatus(o)}>
                                        <Text style={s.actionBtnText}>
                                            {info.next === 'accepted' ? 'Accepter' :
                                                info.next === 'preparing' ? 'Commencer prépa.' :
                                                    info.next === 'ready' ? 'Marquer prête' : 'Terminer'}
                                        </Text>
                                    </TouchableOpacity>
                                    {o.status === 'pending' && (
                                        <TouchableOpacity
                                            style={[s.actionBtn, { backgroundColor: '#EF4444', marginLeft: 8 }]}
                                            onPress={() => cancelOrder(o)}>
                                            <Text style={s.actionBtnText}>Refuser</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })
            )}
        </ScrollView>
    );

    // ── RENDER HOURS ─────────────────────────────────────────
    const renderHours = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}>
            <Text style={s.hoursHint}>Définissez vos horaires d'ouverture jour par jour.</Text>
            {JOURS_FULL.map((jour, dayIdx) => {
                const h = openingHours.find(h => h.day_of_week === dayIdx);
                const closed = h?.is_closed ?? false;
                return (
                    <TouchableOpacity
                        key={dayIdx}
                        style={s.hourRow}
                        onPress={() => {
                            setEditHour(h || { day_of_week: dayIdx, open_time: '08:00', close_time: '22:00', is_closed: false });
                            setHoursModal(true);
                        }}>
                        <View style={[s.dayBadge, { backgroundColor: closed ? '#FEE2E2' : '#DCFCE7' }]}>
                            <Text style={[s.dayBadgeText, { color: closed ? '#DC2626' : '#16A34A' }]}>
                                {JOURS[dayIdx]}
                            </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={s.hourDayName}>{jour}</Text>
                            {closed
                                ? <Text style={s.hourTime}>Fermé</Text>
                                : h
                                    ? <Text style={s.hourTime}>{h.open_time || '--:--'} – {h.close_time || '--:--'}</Text>
                                    : <Text style={[s.hourTime, { color: '#9CA3AF' }]}>Non configuré</Text>}
                        </View>
                        <SafeIcon name="chevron-right" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    // ── RENDER FINANCES ───────────────────────────────────────
    const renderFinances = () => {
        const f = financial;
        return (
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
                refreshControl={
                    <RefreshControl
                        refreshing={loadingFinances}
                        onRefresh={loadFinances}
                    />
                }>
                {!f ? (
                    <NativeButton
                        title="Charger les finances"
                        onPress={loadFinances}
                        variant="primary"
                        style={{ marginBottom: 16 }}
                    />
                ) : null}

                {/* Aujourd'hui */}
                {f?.today && (
                    <View style={s.finCard}>
                        <Text style={s.finTitle}>Aujourd'hui</Text>
                        {[
                            { label: 'Commandes', value: f.today.orders_today, color: '#3B82F6' },
                            { label: `CA (${devise})`, value: Number(f.today.revenue_today || 0).toLocaleString(), color: '#F59E0B' },
                            { label: `Net partenaire (${devise})`, value: Number(f.today.net_today || 0).toLocaleString(), color: '#10B981' },
                        ].map((it, i) => (
                            <View key={i} style={s.analyticsRow}>
                                <View style={[s.analyticsDot, { backgroundColor: it.color }]} />
                                <Text style={s.analyticsLabel}>{it.label}</Text>
                                <Text style={[s.analyticsValue, { color: it.color }]}>{it.value}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Global */}
                {f?.global && (
                    <View style={s.finCard}>
                        <Text style={s.finTitle}>Bilan global</Text>
                        {[
                            { label: 'Total commandes', value: f.global.total_orders, color: '#6B7280' },
                            { label: 'Commandes terminées', value: f.global.completed_orders, color: '#10B981' },
                            { label: `CA total (${devise})`, value: Number(f.global.total_revenue || 0).toLocaleString(), color: '#F59E0B' },
                            { label: `Commission Yukpo 2% (${devise})`, value: Number(f.global.total_commission || 0).toLocaleString(), color: '#EF4444' },
                            { label: `Net partenaire (${devise})`, value: Number(f.global.total_net || 0).toLocaleString(), color: '#10B981' },
                            { label: 'Commandes payées', value: f.global.paid_orders, color: '#3B82F6' },
                        ].map((it, i) => (
                            <View key={i} style={s.analyticsRow}>
                                <View style={[s.analyticsDot, { backgroundColor: it.color }]} />
                                <Text style={s.analyticsLabel}>{it.label}</Text>
                                <Text style={[s.analyticsValue, { color: it.color }]}>{it.value}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Solde portefeuille */}
                {f?.wallet_balance !== undefined && (
                    <View style={[s.finCard, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={s.finTitle}>💰 Solde portefeuille</Text>
                        <Text style={s.walletBalance}>
                            {Number(f.wallet_balance || 0).toLocaleString()} {devise}
                        </Text>
                        <Text style={s.walletHint}>
                            Commissions Yukpo (2%) déduites automatiquement à chaque commande terminée.
                        </Text>
                    </View>
                )}

                {/* Top plats */}
                {f?.top_items?.length > 0 && (
                    <View style={s.finCard}>
                        <Text style={s.finTitle}>🏆 Top plats vendus</Text>
                        {f.top_items.map((it: any, i: number) => (
                            <View key={i} style={s.analyticsRow}>
                                <Text style={[s.analyticsDot, { color: '#F59E0B', fontSize: 14 }]}>{i + 1}.</Text>
                                <Text style={[s.analyticsLabel, { flex: 1 }]}>{it.item_name}</Text>
                                <Text style={s.analyticsLabel}>{it.qty_sold} ventes</Text>
                                <Text style={[s.analyticsValue, { color: '#F59E0B', fontSize: 13 }]}>
                                    {Number(it.revenue || 0).toLocaleString()} {devise}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Historique 30 jours */}
                {f?.history?.length > 0 && (
                    <View style={s.finCard}>
                        <Text style={s.finTitle}>📅 Historique 30 jours</Text>
                        {f.history.slice(0, 10).map((h: any, i: number) => (
                            <View key={i} style={s.analyticsRow}>
                                <Text style={[s.analyticsLabel, { color: '#6B7280', minWidth: 90 }]}>{h.day}</Text>
                                <Text style={s.analyticsLabel}>{h.orders} cmd</Text>
                                <Text style={[s.analyticsValue, { color: '#10B981', fontSize: 13 }]}>
                                    {Number(h.net || 0).toLocaleString()} {devise}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {!f && !loadingFinances && (
                    <View style={s.emptyState}>
                        <SafeIcon name="trending-up" size={48} color="#9CA3AF" />
                        <Text style={s.emptyTitle}>Aucune donnée financière</Text>
                        <Text style={s.emptyText}>Les finances apparaîtront dès votre première commande complétée.</Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    // ── MODAL PLAT ───────────────────────────────────────────
    const renderMenuModal = () => (
        <Modal visible={menuModal} transparent animationType="slide">
            <View style={s.modalOverlay}>
                <View style={s.modalSheet}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>{editItem?.id ? 'Modifier le plat' : 'Nouveau plat'}</Text>
                        <TouchableOpacity onPress={() => { setMenuModal(false); setEditItem(null); }}>
                            <SafeIcon name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView>
                        <Text style={s.fieldLabel}>Nom du plat *</Text>
                        <TextInput
                            style={s.input}
                            placeholder="Ex: Ndolé, Poulet DG…"
                            value={editItem?.nom || ''}
                            onChangeText={v => setEditItem(prev => ({ ...prev, nom: v }))}
                        />
                        <Text style={s.fieldLabel}>Prix ({devise}) *</Text>
                        <TextInput
                            style={s.input}
                            placeholder="0"
                            keyboardType="numeric"
                            value={editItem?.prix?.toString() || ''}
                            onChangeText={v => setEditItem(prev => ({ ...prev, prix: parseFloat(v) || 0 }))}
                        />
                        <Text style={s.fieldLabel}>Description</Text>
                        <TextInput
                            style={[s.input, { height: 70 }]}
                            placeholder="Description courte du plat…"
                            multiline
                            value={editItem?.description || ''}
                            onChangeText={v => setEditItem(prev => ({ ...prev, description: v }))}
                        />
                        <Text style={s.fieldLabel}>URL Image (optionnel)</Text>
                        <TextInput
                            style={s.input}
                            placeholder="https://…/photo.jpg"
                            autoCapitalize="none"
                            keyboardType="url"
                            value={editItem?.image_url || ''}
                            onChangeText={v => setEditItem(prev => ({ ...prev, image_url: v }))}
                        />
                        <Text style={s.fieldLabel}>URL Vidéo (optionnel)</Text>
                        <TextInput
                            style={s.input}
                            placeholder="https://youtube.com/… ou lien direct"
                            autoCapitalize="none"
                            keyboardType="url"
                            value={editItem?.video_url || ''}
                            onChangeText={v => setEditItem(prev => ({ ...prev, video_url: v }))}
                        />
                        <Text style={s.videoHint}>
                            La vidéo sera visible par les clients sur la page du restaurant.
                        </Text>
                        <Text style={s.fieldLabel}>Catégorie</Text>
                        <View style={s.catRow}>
                            {CATEGORIES_PLAT.map(c => (
                                <TouchableOpacity
                                    key={c.key}
                                    style={[s.catChip, editItem?.categorie === c.key && { backgroundColor: c.color, borderColor: c.color }]}
                                    onPress={() => setEditItem(prev => ({ ...prev, categorie: c.key }))}>
                                    <Text style={[s.catChipText, editItem?.categorie === c.key && { color: '#fff' }]}>{c.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={s.switchRow}>
                            <Text style={s.fieldLabel}>Disponible maintenant</Text>
                            <Switch
                                value={editItem?.is_disponible !== false}
                                onValueChange={v => setEditItem(prev => ({ ...prev, is_disponible: v }))}
                                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                            />
                        </View>
                    </ScrollView>
                    <NativeButton
                        title={savingItem ? 'Sauvegarde…' : 'Enregistrer'}
                        onPress={saveMenuItem}
                        variant="primary"
                        disabled={savingItem}
                        style={{ marginTop: 12 }}
                    />
                </View>
            </View>
        </Modal>
    );

    // ── MODAL HORAIRE ────────────────────────────────────────
    const renderHoursModal = () => (
        <Modal visible={hoursModal} transparent animationType="slide">
            <View style={s.modalOverlay}>
                <View style={[s.modalSheet, { paddingBottom: 40 }]}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>
                            {editHour ? JOURS_FULL[editHour.day_of_week] : 'Horaire'}
                        </Text>
                        <TouchableOpacity onPress={() => { setHoursModal(false); setEditHour(null); }}>
                            <SafeIcon name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <View style={s.switchRow}>
                        <Text style={s.fieldLabel}>Fermé ce jour</Text>
                        <Switch
                            value={editHour?.is_closed ?? false}
                            onValueChange={v => setEditHour(prev => prev ? { ...prev, is_closed: v } : null)}
                            trackColor={{ false: '#D1D5DB', true: '#EF4444' }}
                        />
                    </View>
                    {!editHour?.is_closed && (
                        <>
                            <Text style={s.fieldLabel}>Heure d'ouverture (HH:MM)</Text>
                            <TextInput
                                style={s.input}
                                placeholder="08:00"
                                value={editHour?.open_time || ''}
                                onChangeText={v => setEditHour(prev => prev ? { ...prev, open_time: v } : null)}
                            />
                            <Text style={s.fieldLabel}>Heure de fermeture (HH:MM)</Text>
                            <TextInput
                                style={s.input}
                                placeholder="22:00"
                                value={editHour?.close_time || ''}
                                onChangeText={v => setEditHour(prev => prev ? { ...prev, close_time: v } : null)}
                            />
                        </>
                    )}
                    <NativeButton
                        title={savingHour ? 'Sauvegarde…' : 'Enregistrer'}
                        onPress={saveHour}
                        variant="primary"
                        disabled={savingHour}
                        style={{ marginTop: 16 }}
                    />
                </View>
            </View>
        </Modal>
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
                    {orders.filter(o => o.status === 'pending').length > 0 && (
                        <View style={s.notifBadge}>
                            <Text style={s.notifText}>{orders.filter(o => o.status === 'pending').length}</Text>
                        </View>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.tabRow}>
                        {TABS.map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[s.tab, activeTab === tab.key && s.tabActive]}
                                onPress={() => setActiveTab(tab.key)}>
                                <SafeIcon name={tab.icon as any} size={15} color={activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.6)'} />
                                <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </LinearGradient>

            <View style={s.content}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'menu' && renderMenu()}
                {activeTab === 'orders' && renderOrders()}
                {activeTab === 'hours' && renderHours()}
                {activeTab === 'finances' && renderFinances()}
            </View>

            {renderMenuModal()}
            {renderHoursModal()}
            <GlobalShareModal
                visible={shareModal}
                onClose={() => setShareModal(false)}
                payload={sharePayload}
            />
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
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
    notifBadge: { backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    notifText: { color: '#D97706', fontWeight: '700', fontSize: 13 },
    tabRow: { flexDirection: 'row', gap: 4, paddingBottom: 4 },
    tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, gap: 4 },
    tabActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
    tabLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
    statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderLeftWidth: 3, elevation: 1 },
    statValue: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 6 },
    statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
    statusCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginVertical: 12, gap: 10 },
    statusTitle: { fontSize: 14, fontWeight: '600' },
    statusSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 10 },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    quickAction: { width: '30%', alignItems: 'center', gap: 6, marginBottom: 4 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeCard: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1 },
    typeIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    typeLabel: { fontSize: 11, fontWeight: '600', color: '#1F2937' },
    typeCount: { fontSize: 10, color: '#6B7280', marginTop: 2 },
    // Menu
    catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderLeftWidth: 3, paddingLeft: 8, marginTop: 16, marginBottom: 8 },
    catTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
    catCount: { fontSize: 12, color: '#6B7280' },
    menuItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1, gap: 8 },
    menuItemName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    menuItemDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    menuItemDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
    videoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, gap: 3 },
    videoBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    videoHint: { fontSize: 11, color: '#6B7280', marginTop: 4, marginBottom: 8, fontStyle: 'italic' },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    editBtn: { padding: 6 },
    deleteBtn: { padding: 6 },
    shareItemBtn: { padding: 6 },
    shareMenuBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F5F3FF' },
    shareMenuBtnText: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
    // Orders
    orderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
    orderCardFull: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    orderName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    orderMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    orderItemsList: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, marginBottom: 8 },
    orderItemLine: { fontSize: 13, color: '#374151', paddingVertical: 2 },
    orderFooter: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
    orderTotal: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
    orderDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    orderNotes: { fontSize: 12, color: '#F59E0B', marginTop: 4 },
    orderActions: { flexDirection: 'row', marginTop: 10 },
    statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadgeText: { fontSize: 12, fontWeight: '700' },
    actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    // Hours
    hoursHint: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
    hourRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    dayBadge: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    dayBadgeText: { fontSize: 12, fontWeight: '700' },
    hourDayName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    hourTime: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    // Finances
    finCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1, marginBottom: 12 },
    finTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    walletBalance: { fontSize: 28, fontWeight: '800', color: '#059669', marginVertical: 8 },
    walletHint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
    // Analytics
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1, marginBottom: 12 },
    analyticsTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    analyticsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    analyticsLabel: { flex: 1, fontSize: 14, color: '#374151' },
    analyticsValue: { fontSize: 17, fontWeight: '700' },
    // Empty
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    catChip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    catChipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
});

export default RestaurantDashboardScreen;
