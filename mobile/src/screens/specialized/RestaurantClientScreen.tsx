// Écran client — Parcourir les restaurants Yukpo, voir le menu et commander
// Utilisateur final (non-partenaire)

import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import GlobalShareModal, { GlobalSharePayload } from '../../components/GlobalShareModal';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import {
    PublicRestaurant,
    RestaurantMenuItem,
    RestaurantOpeningHour,
    restaurantManagementService,
} from '../../services/restaurantManagementService';
import { apiGet } from '../../services/api';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';

type ViewMode = 'list' | 'menu';
type SearchMode = 'restaurant' | 'menu';
type ListTab = 'restaurants' | 'history';

interface CartItem extends RestaurantMenuItem {
    quantity: number;
}

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const CAT_ICONS: Record<string, { icon: string; color: string }> = {
    entree:    { icon: 'salad',    color: '#10B981' },
    plat:      { icon: 'utensils', color: '#F59E0B' },
    dessert:   { icon: 'cake',     color: '#EC4899' },
    boisson:   { icon: 'coffee',   color: '#3B82F6' },
    specialite:{ icon: 'star',     color: '#8B5CF6' },
};

const RestaurantClientScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const devise = useCurrencyDetection() || 'XAF';

    // Paramètres optionnels passés via navigation
    const params = (route.params as any) || {};
    const initialServiceId: number | undefined = params.service_id;

    const [viewMode, setViewMode] = useState<ViewMode>(initialServiceId ? 'menu' : 'list');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Liste des restaurants
    const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<SearchMode>('restaurant');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Restaurant sélectionné + son menu
    const [selectedRestaurant, setSelectedRestaurant] = useState<PublicRestaurant | null>(null);
    const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
    const [openingHours, setOpeningHours] = useState<RestaurantOpeningHour[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    // Panier
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartModal, setCartModal] = useState(false);
    const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('takeaway');
    const [orderNote, setOrderNote] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [placing, setPlacing] = useState(false);

    // Facture + suivi après commande
    const [invoiceModal, setInvoiceModal] = useState(false);
    const [lastOrderResult, setLastOrderResult] = useState<any>(null);
    const [trackingModal, setTrackingModal] = useState(false);
    const [trackingData, setTrackingData] = useState<any>(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const trackingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Historique
    const [listTab, setListTab] = useState<ListTab>('restaurants');
    const [orderHistory, setOrderHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Partage social
    const [shareModal, setShareModal] = useState(false);
    const [sharePayload, setSharePayload] = useState<GlobalSharePayload | null>(null);

    // Commentaires par plat (modal)
    const [commentsItemIndex, setCommentsItemIndex] = useState<number | null>(null);
    const [commentsModal, setCommentsModal] = useState(false);

    // Notation
    const [ratingModal, setRatingModal] = useState(false);
    const [ratingOrderId, setRatingOrderId] = useState<number | null>(null);
    const [ratingValue, setRatingValue] = useState(5);
    const [ratingComment, setRatingComment] = useState('');
    const [placingRating, setPlacingRating] = useState(false);

    // Wallet client
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    // Modal réservation de table
    const [reservationModal, setReservationModal] = useState(false);
    const [reservDate, setReservDate] = useState('');
    const [reservPeople, setReservPeople] = useState('2');
    const [reservNote, setReservNote] = useState('');
    const [placingReserv, setPlacingReserv] = useState(false);

    const loadRestaurants = useCallback(async () => {
        try {
            const list = await restaurantManagementService.publicListRestaurants();
            setRestaurants(list);
        } catch (e) {
            console.error('[RestaurantClient] loadRestaurants', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const loadMenu = useCallback(async (serviceId: number) => {
        setLoading(true);
        try {
            const data = await restaurantManagementService.publicGetMenu(serviceId);
            setMenuItems(data.menu || []);
            setOpeningHours(data.opening_hours || []);
        } catch (e) {
            console.error('[RestaurantClient] loadMenu', e);
            Alert.alert('Erreur', 'Impossible de charger le menu.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const loadHistory = useCallback(async () => {
        if (!user) return;
        setHistoryLoading(true);
        try {
            const orders = await restaurantManagementService.clientOrderHistory();
            setOrderHistory(orders);
        } catch (e) {
            console.error('[RestaurantClient] loadHistory', e);
        } finally {
            setHistoryLoading(false);
        }
    }, [user]);

    const startTracking = useCallback((orderId: number) => {
        setTrackingModal(true);
        setTrackingLoading(true);
        const poll = async () => {
            try {
                const data = await restaurantManagementService.getOrderStatus(orderId);
                setTrackingData(data);
            } catch {
                /* ignore */
            } finally {
                setTrackingLoading(false);
            }
        };
        poll();
        if (trackingInterval.current) clearInterval(trackingInterval.current);
        trackingInterval.current = setInterval(poll, 20000); // refresh toutes les 20s
    }, []);

    const stopTracking = useCallback(() => {
        if (trackingInterval.current) {
            clearInterval(trackingInterval.current);
            trackingInterval.current = null;
        }
        setTrackingModal(false);
        setTrackingData(null);
    }, []);

    const submitRating = async () => {
        if (!ratingOrderId) return;
        setPlacingRating(true);
        try {
            await restaurantManagementService.rateOrder(ratingOrderId, ratingValue, ratingComment || undefined);
            setRatingModal(false);
            setRatingComment('');
            setRatingValue(5);
            Alert.alert('Merci !', 'Votre avis a été enregistré.');
            loadHistory();
        } catch {
            Alert.alert('Erreur', 'Impossible d\'enregistrer votre avis.');
        } finally {
            setPlacingRating(false);
        }
    };

    // Recherche avec debounce (déclenche dès 2 caractères)
    useEffect(() => {
        if (viewMode !== 'list') return;
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const { results } = await restaurantManagementService.publicSearch(searchQuery, searchMode);
                setSearchResults(results);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
    }, [searchQuery, searchMode, viewMode]);

    useFocusEffect(useCallback(() => {
        if (initialServiceId) {
            const resto = restaurants.find(r => r.service_id === initialServiceId);
            if (resto) {
                setSelectedRestaurant(resto);
                setViewMode('menu');
                loadMenu(initialServiceId);
            } else {
                // On charge la liste d'abord pour trouver le restaurant
                restaurantManagementService.publicListRestaurants().then(list => {
                    setRestaurants(list);
                    const found = list.find(r => r.service_id === initialServiceId);
                    if (found) setSelectedRestaurant(found);
                    loadMenu(initialServiceId);
                    setViewMode('menu');
                });
            }
        } else {
            loadRestaurants();
        }
    }, [initialServiceId]));

    const openRestaurant = async (resto: PublicRestaurant) => {
        setSelectedRestaurant(resto);
        setCart([]);
        setViewMode('menu');
        await loadMenu(resto.service_id);
    };

    const backToList = () => {
        setViewMode('list');
        setSelectedRestaurant(null);
        setMenuItems([]);
        setCart([]);
        setActiveCategory('all');
    };

    // ── Panier ───────────────────────────────────────────────
    const addToCart = (item: RestaurantMenuItem) => {
        setCart(prev => {
            const existing = prev.find(c => c.id === item.id);
            if (existing) {
                return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const removeFromCart = (itemId: number) => {
        setCart(prev => {
            const existing = prev.find(c => c.id === itemId);
            if (!existing) return prev;
            if (existing.quantity <= 1) return prev.filter(c => c.id !== itemId);
            return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
        });
    };

    const cartTotal = cart.reduce((s, c) => s + c.prix * c.quantity, 0);
    const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
    const cartQtyFor = (id: number) => cart.find(c => c.id === id)?.quantity ?? 0;

    // ── Ouvrir le panier + pré-charger le solde wallet ───────
    const openCartModal = async () => {
        setCartModal(true);
        try {
            const resp = await apiGet<any>('/api/wallet/balance');
            const balanceCents: number = resp?.data?.balance_cents ?? resp?.data?.balance ?? 0;
            setWalletBalance(balanceCents);
        } catch {
            setWalletBalance(null); // wallet absent → paiement cash
        }
    };

    // ── Commander ────────────────────────────────────────────
    const placeOrder = async () => {
        if (!selectedRestaurant || cart.length === 0) return;
        if (!user) {
            Alert.alert('Connexion requise', 'Connectez-vous pour passer une commande.');
            return;
        }
        if (orderType === 'delivery' && !deliveryAddress.trim()) {
            Alert.alert('Adresse requise', 'Veuillez entrer votre adresse de livraison.');
            return;
        }
        setPlacing(true);
        try {
            const resp = await restaurantManagementService.publicCreateOrder(selectedRestaurant.service_id, {
                order_type: orderType,
                notes: orderNote || undefined,
                client_name: user.name,
                delivery_address: orderType === 'delivery' ? deliveryAddress : undefined,
                items: cart.map(c => ({
                    menu_item_id: c.id,
                    item_name: c.nom,
                    item_price: c.prix,
                    quantity: c.quantity,
                })),
            });
            const result = (resp as any)?.data ?? resp;
            setLastOrderResult(result);
            setCartModal(false);
            setCart([]);
            setOrderNote('');
            setDeliveryAddress('');
            setInvoiceModal(true);
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.message || 'Impossible de passer la commande. Réessayez.';
            Alert.alert('Erreur', msg);
        } finally {
            setPlacing(false);
        }
    };

    // ── Réservation de table ─────────────────────────────────
    const placeReservation = async () => {
        if (!selectedRestaurant || !reservDate.trim()) {
            Alert.alert('Erreur', 'La date est requise.');
            return;
        }
        if (!user) {
            Alert.alert('Connexion requise', 'Connectez-vous pour réserver.');
            return;
        }
        setPlacingReserv(true);
        try {
            await restaurantManagementService.createTableReservation({
                service_id: selectedRestaurant.service_id,
                requested_date: reservDate,
                people_count: parseInt(reservPeople) || 2,
                notes: reservNote,
            });
            setReservationModal(false);
            setReservDate('');
            setReservNote('');
            Alert.alert(
                'Réservation envoyée ! 📅',
                `Votre réservation pour ${reservPeople} personne(s) a été envoyée à ${selectedRestaurant.name}. Attendez la confirmation.`,
                [{ text: 'OK' }],
            );
        } catch {
            Alert.alert('Erreur', 'Impossible d\'envoyer la réservation.');
        } finally {
            setPlacingReserv(false);
        }
    };

    // ── Partage restaurant / plat ────────────────────────────
    const openShareRestaurant = (resto: PublicRestaurant) => {
        setSharePayload({
            title: `🍽️ ${resto.name}`,
            description: resto.description || `Restaurant sur Yukpo · ${resto.city || ''}`,
            shareUrl: `https://yukpomnang.com/restaurant/${resto.service_id}`,
            contentType: 'menu',
            serviceId: resto.service_id,
        });
        setShareModal(true);
    };

    const openShareMenuItem = (item: RestaurantMenuItem, index: number) => {
        setSharePayload({
            title: `🍽️ ${item.nom}`,
            description: `${item.description || ''}\n${item.prix.toLocaleString()} ${devise} — ${selectedRestaurant?.name || ''}`,
            shareUrl: `https://yukpomnang.com/restaurant/${selectedRestaurant?.service_id}`,
            contentType: 'menu',
            serviceId: selectedRestaurant?.service_id,
            productIndex: index,
        });
        setShareModal(true);
    };

    // ── Horaires du jour ─────────────────────────────────────
    const todayHours = () => {
        const today = new Date().getDay();
        const h = openingHours.find(h => h.day_of_week === today);
        if (!h) return null;
        if (h.is_closed) return { label: 'Fermé aujourd\'hui', open: false };
        return { label: `Ouvert : ${h.open_time || '?'} – ${h.close_time || '?'}`, open: true };
    };

    // ── Catégories du menu ───────────────────────────────────
    const categories = ['all', ...Array.from(new Set(menuItems.map(m => m.categorie || 'plat')))];
    const filteredItems = activeCategory === 'all' ? menuItems : menuItems.filter(m => m.categorie === activeCategory);

    if (loading && viewMode === 'list') {
        return (
            <View style={s.loadingScreen}>
                <ActivityIndicator size="large" color="#DC2626" />
                <Text style={s.loadingText}>Chargement des restaurants…</Text>
            </View>
        );
    }

    // ── HISTORIQUE ───────────────────────────────────────────
    const renderHistory = () => {
        if (historyLoading) return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                <ActivityIndicator size="large" color="#DC2626" />
            </View>
        );
        if (orderHistory.length === 0) return (
            <View style={s.emptyState}>
                <SafeIcon name="clock" size={48} color="#9CA3AF" />
                <Text style={s.emptyTitle}>Aucune commande</Text>
                <Text style={s.emptyText}>Vos commandes restaurant apparaîtront ici.</Text>
            </View>
        );

        const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
            pending:    { label: 'En attente',   color: '#D97706', bg: '#FEF3C7' },
            accepted:   { label: 'Acceptée',     color: '#2563EB', bg: '#DBEAFE' },
            preparing:  { label: 'Préparation',  color: '#7C3AED', bg: '#EDE9FE' },
            ready:      { label: 'Prête',        color: '#059669', bg: '#D1FAE5' },
            completed:  { label: 'Complétée',    color: '#374151', bg: '#F3F4F6' },
            cancelled:  { label: 'Annulée',      color: '#DC2626', bg: '#FEE2E2' },
        };

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={historyLoading} onRefresh={loadHistory} />}>
                {orderHistory.map((order: any, i: number) => {
                    const sc = STATUS_CONFIG[order.status] ?? { label: order.status, color: '#6B7280', bg: '#F3F4F6' };
                    const isActive = ['pending', 'accepted', 'preparing', 'ready'].includes(order.status);
                    const canRate = order.status === 'completed' && !order.client_rating;
                    return (
                        <View key={i} style={s.historyCard}>
                            <View style={s.historyTop}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.historyResto}>{order.restaurant_name}</Text>
                                    <Text style={s.historyDate}>{order.created_at?.slice(0, 10)} · {order.order_type === 'delivery' ? '🛵 Livraison' : order.order_type === 'dine_in' ? '🍽 Sur place' : '🥡 À emporter'}</Text>
                                </View>
                                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                                    <Text style={[s.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
                                </View>
                            </View>

                            {/* Items */}
                            {(order.items || []).slice(0, 3).map((it: any, j: number) => (
                                <Text key={j} style={s.historyItem}>· {it.item_name} x{it.quantity}</Text>
                            ))}

                            {/* Montants */}
                            <View style={s.historyAmounts}>
                                <Text style={s.historyTotal}>Repas: {Number(order.total_amount || 0).toLocaleString()} {devise}</Text>
                                {(order.delivery_fee ?? 0) > 0 && (
                                    <Text style={s.historyFee}>+ Livraison: {Number(order.delivery_fee).toLocaleString()} {devise}</Text>
                                )}
                                {(order.insurance_fee ?? 0) > 0 && (
                                    <Text style={s.historyFee}>+ Assurance: {Number(order.insurance_fee).toLocaleString()} {devise}</Text>
                                )}
                                {order.total_with_fees && (
                                    <Text style={s.historyGrandTotal}>Total: {Number(order.total_with_fees).toLocaleString()} {devise}</Text>
                                )}
                            </View>

                            {/* Étoiles si déjà noté */}
                            {order.client_rating && (
                                <Text style={s.existingRating}>{'⭐'.repeat(order.client_rating)} Votre avis</Text>
                            )}

                            {/* Actions */}
                            <View style={s.historyActions}>
                                {isActive && (
                                    <TouchableOpacity style={s.historyBtn} onPress={() => startTracking(order.id)}>
                                        <SafeIcon name="map-pin" size={13} color="#2563EB" />
                                        <Text style={[s.historyBtnText, { color: '#2563EB' }]}>Suivre</Text>
                                    </TouchableOpacity>
                                )}
                                {canRate && (
                                    <TouchableOpacity style={[s.historyBtn, s.historyBtnGold]} onPress={() => { setRatingOrderId(order.id); setRatingModal(true); }}>
                                        <SafeIcon name="star" size={13} color="#D97706" />
                                        <Text style={[s.historyBtnText, { color: '#D97706' }]}>Noter</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        );
    };

    // ── VUE LISTE ────────────────────────────────────────────
    const renderList = () => {
        const isSearching = searchQuery.length >= 2;
        // En mode restaurant sans API search : filtre local sur la liste déjà chargée
        const localFiltered = !isSearching ? restaurants :
            searchMode === 'restaurant' && searchResults.length === 0 && !searching
                ? restaurants.filter(r =>
                    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (r.city || '').toLowerCase().includes(searchQuery.toLowerCase()))
                : restaurants;

        return (
            <>
            {/* Onglets Restaurants / Mes commandes */}
            <View style={s.listTabRow}>
                {(['restaurants', 'history'] as ListTab[]).map(tab => (
                    <TouchableOpacity key={tab} style={[s.listTab, listTab === tab && s.listTabActive]}
                        onPress={() => {
                            setListTab(tab);
                            if (tab === 'history' && orderHistory.length === 0) loadHistory();
                        }}>
                        <SafeIcon name={tab === 'restaurants' ? 'utensils' : 'clock'} size={14} color={listTab === tab ? '#DC2626' : '#6B7280'} />
                        <Text style={[s.listTabText, listTab === tab && s.listTabTextActive]}>
                            {tab === 'restaurants' ? 'Restaurants' : 'Mes commandes'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {listTab === 'history' ? renderHistory() :
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRestaurants(); }} />}>

                {/* Barre de recherche */}
                <View style={s.searchBox}>
                    <SafeIcon name="search" size={16} color="#9CA3AF" />
                    <TextInput
                        style={s.searchInput}
                        placeholder={searchMode === 'restaurant' ? 'Rechercher un restaurant, une ville…' : 'Rechercher un plat, une catégorie…'}
                        value={searchQuery}
                        onChangeText={v => { setSearchQuery(v); setSearchResults([]); }}
                        placeholderTextColor="#9CA3AF"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                            <SafeIcon name="x" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Toggle Restaurant / Plat */}
                <View style={s.searchToggle}>
                    {(['restaurant', 'menu'] as SearchMode[]).map(mode => (
                        <TouchableOpacity
                            key={mode}
                            style={[s.searchToggleBtn, searchMode === mode && s.searchToggleActive]}
                            onPress={() => { setSearchMode(mode); setSearchResults([]); }}>
                            <SafeIcon
                                name={mode === 'restaurant' ? 'utensils' : 'book-open'}
                                size={13}
                                color={searchMode === mode ? '#fff' : '#6B7280'}
                            />
                            <Text style={[s.searchToggleText, searchMode === mode && s.searchToggleTextActive]}>
                                {mode === 'restaurant' ? 'Restaurants' : 'Par plat'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Indicateur de recherche */}
                {searching && (
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                        <ActivityIndicator size="small" color="#DC2626" />
                    </View>
                )}

                {/* Résultats PLATS */}
                {isSearching && searchMode === 'menu' && !searching && (
                    searchResults.length === 0 ? (
                        <View style={s.emptyState}>
                            <SafeIcon name="search" size={40} color="#9CA3AF" />
                            <Text style={s.emptyTitle}>Aucun plat trouvé</Text>
                            <Text style={s.emptyText}>Essayez un autre nom ou catégorie.</Text>
                        </View>
                    ) : (
                        <>
                            <Text style={s.searchResultsLabel}>{searchResults.length} plat(s) trouvé(s)</Text>
                            {searchResults.map((item: any, i: number) => (
                                <TouchableOpacity
                                    key={i}
                                    style={s.dishResultCard}
                                    onPress={() => {
                                        const resto: PublicRestaurant = {
                                            service_id: item.service_id,
                                            name: item.restaurant_name,
                                            accepts_delivery: item.accepts_delivery,
                                            accepts_dine_in: item.accepts_dine_in,
                                            menu_count: 0,
                                            city: item.city,
                                        };
                                        openRestaurant(resto);
                                    }}>
                                    <View style={s.dishResultLeft}>
                                        <View style={s.dishResultIcon}>
                                            <SafeIcon name="utensils" size={16} color="#DC2626" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={s.dishResultName}>{item.nom}</Text>
                                                {item.video_url ? (
                                                    <View style={s.videoBadge}>
                                                        <SafeIcon name="video" size={9} color="#fff" />
                                                        <Text style={s.videoBadgeText}>Vidéo</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                            {item.description ? <Text style={s.dishResultDesc} numberOfLines={1}>{item.description}</Text> : null}
                                            <Text style={s.dishResultResto}>
                                                <SafeIcon name="map-pin" size={10} color="#9CA3AF" /> {item.restaurant_name}{item.city ? ` · ${item.city}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={s.dishResultPrice}>{Number(item.prix || 0).toLocaleString()} {devise}</Text>
                                        <SafeIcon name="chevron-right" size={14} color="#9CA3AF" />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </>
                    )
                )}

                {/* Résultats RESTAURANTS (API search ou liste locale) */}
                {(!isSearching || searchMode === 'restaurant') && (
                    <>
                        {isSearching && searchMode === 'restaurant' && !searching && (
                            <Text style={s.searchResultsLabel}>
                                {(searchResults.length > 0 ? searchResults : localFiltered).length} restaurant(s) trouvé(s)
                            </Text>
                        )}
                        {(isSearching && searchResults.length > 0
                            ? searchResults
                            : isSearching
                                ? localFiltered
                                : restaurants
                        ).length === 0 ? (
                            <View style={s.emptyState}>
                                <SafeIcon name="utensils" size={48} color="#9CA3AF" />
                                <Text style={s.emptyTitle}>Aucun restaurant trouvé</Text>
                                <Text style={s.emptyText}>Les restaurants Yukpo de votre région apparaîtront ici.</Text>
                            </View>
                        ) : (
                            (isSearching && searchResults.length > 0
                                ? searchResults
                                : isSearching ? localFiltered : restaurants
                            ).map((resto: any, i: number) => (
                                <TouchableOpacity key={i} style={s.restoCard} onPress={() => openRestaurant(resto)}>
                                    <View style={s.restoIconBox}>
                                        <SafeIcon name="utensils" size={28} color="#DC2626" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.restoName}>{resto.name}</Text>
                                        {resto.city ? <Text style={s.restometa}>📍 {resto.city}</Text> : null}
                                        {resto.description ? <Text style={s.restoDesc} numberOfLines={2}>{resto.description}</Text> : null}
                                        <View style={s.restoTagRow}>
                                            {resto.accepts_dine_in && <View style={s.tag}><Text style={s.tagText}>🍽 Sur place</Text></View>}
                                            {resto.accepts_delivery && <View style={s.tag}><Text style={s.tagText}>🛵 Livraison</Text></View>}
                                            {(resto.menu_count ?? 0) > 0 && <View style={s.tag}><Text style={s.tagText}>{resto.menu_count} plats</Text></View>}
                                        </View>
                                    </View>
                                    <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            ))
                        )}
                    </>
                )}
            </ScrollView>}
            </>
        );
    };

    // ── VUE MENU ─────────────────────────────────────────────
    const renderMenu = () => {
        const todayInfo = todayHours();
        return (
            <>
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#DC2626" />
                    </View>
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 140 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { if (selectedRestaurant) { setRefreshing(true); loadMenu(selectedRestaurant.service_id); } }} />}>
                        {/* Info restaurant */}
                        <View style={s.restoInfoCard}>
                            {todayInfo && (
                                <View style={[s.hoursTag, { backgroundColor: todayInfo.open ? '#DCFCE7' : '#FEE2E2' }]}>
                                    <SafeIcon name={todayInfo.open ? 'clock' : 'clock-off'} size={13} color={todayInfo.open ? '#16A34A' : '#DC2626'} />
                                    <Text style={[s.hoursTagText, { color: todayInfo.open ? '#16A34A' : '#DC2626' }]}>{todayInfo.label}</Text>
                                </View>
                            )}
                            {selectedRestaurant?.description ? (
                                <Text style={s.restoInfoDesc}>{selectedRestaurant.description}</Text>
                            ) : null}
                            <View style={s.restoActionRow}>
                                {selectedRestaurant?.accepts_dine_in && (
                                    <TouchableOpacity
                                        style={s.reservBtn}
                                        onPress={() => setReservationModal(true)}>
                                        <SafeIcon name="calendar" size={14} color="#2563EB" />
                                        <Text style={s.reservBtnText}>Réserver une table</Text>
                                    </TouchableOpacity>
                                )}
                                {selectedRestaurant && (
                                    <TouchableOpacity
                                        style={s.shareRestoBtn}
                                        onPress={() => openShareRestaurant(selectedRestaurant)}>
                                        <SafeIcon name="share-2" size={14} color="#7C3AED" />
                                        <Text style={s.shareRestoBtnText}>Partager</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Filtres catégories */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catFilterRow}>
                            {categories.map((cat, i) => {
                                const catInfo = CAT_ICONS[cat];
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[s.catFilter, activeCategory === cat && s.catFilterActive]}
                                        onPress={() => setActiveCategory(cat)}>
                                        <Text style={[s.catFilterText, activeCategory === cat && s.catFilterTextActive]}>
                                            {cat === 'all' ? '🍴 Tout' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Items du menu */}
                        {filteredItems.length === 0 ? (
                            <View style={s.emptyState}>
                                <SafeIcon name="book-open" size={40} color="#9CA3AF" />
                                <Text style={s.emptyTitle}>Menu non disponible</Text>
                                <Text style={s.emptyText}>Ce restaurant n'a pas encore de plats publiés.</Text>
                            </View>
                        ) : (
                            filteredItems.map((item, i) => {
                                const qty = cartQtyFor(item.id);
                                const catInfo = CAT_ICONS[item.categorie || 'plat'];
                                return (
                                    <View key={i} style={s.menuCard}>
                                        <View style={[s.menuCatIcon, { backgroundColor: (catInfo?.color || '#F59E0B') + '15' }]}>
                                            <SafeIcon name={(catInfo?.icon || 'utensils') as any} size={20} color={catInfo?.color || '#F59E0B'} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <Text style={s.menuName}>{item.nom}</Text>
                                                {item.video_url ? (
                                                    <View style={s.videoBadge}>
                                                        <SafeIcon name="video" size={9} color="#fff" />
                                                        <Text style={s.videoBadgeText}>Vidéo</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                            {item.description ? <Text style={s.menuDesc} numberOfLines={2}>{item.description}</Text> : null}
                                            <Text style={s.menuPrice}>{item.prix.toLocaleString()} {devise}</Text>
                                            {/* Actions par plat : partager + commenter */}
                                            <View style={s.itemActions}>
                                                <TouchableOpacity style={s.itemActionBtn}
                                                    onPress={() => openShareMenuItem(item, i)}>
                                                    <SafeIcon name="share-2" size={12} color="#7C3AED" />
                                                    <Text style={[s.itemActionText, { color: '#7C3AED' }]}>Partager</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={s.itemActionBtn}
                                                    onPress={() => {
                                                        setCommentsItemIndex(i);
                                                        setCommentsModal(true);
                                                    }}>
                                                    <SafeIcon name="message-circle" size={12} color="#2563EB" />
                                                    <Text style={[s.itemActionText, { color: '#2563EB' }]}>Avis</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <View style={s.qtyControls}>
                                            {qty > 0 && (
                                                <TouchableOpacity style={s.qtyBtn} onPress={() => removeFromCart(item.id)}>
                                                    <SafeIcon name="minus" size={14} color="#DC2626" />
                                                </TouchableOpacity>
                                            )}
                                            {qty > 0 && <Text style={s.qtyText}>{qty}</Text>}
                                            <TouchableOpacity style={[s.qtyBtn, s.qtyBtnAdd]} onPress={() => addToCart(item)}>
                                                <SafeIcon name="plus" size={14} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        )}

                        {/* Commentaires & avis restaurant (toujours visibles) */}
                        {selectedRestaurant && (
                            <View style={s.commentsSection}>
                                <View style={s.commentsSectionHeader}>
                                    <SafeIcon name="message-square" size={16} color="#DC2626" />
                                    <Text style={s.commentsSectionTitle}>Avis & commentaires</Text>
                                </View>
                                <ProductCommentsSection
                                    serviceId={selectedRestaurant.service_id}
                                    serviceTitle={selectedRestaurant.name}
                                    mode="inline"
                                    compact={false}
                                    displayLimit={5}
                                />
                            </View>
                        )}
                    </ScrollView>
                )}

                {/* Bouton panier flottant */}
                {cart.length > 0 && (
                    <TouchableOpacity style={s.cartFab} onPress={openCartModal}>
                        <SafeIcon name="shopping-cart" size={20} color="#fff" />
                        <Text style={s.cartFabText}>{cartCount} article(s) · {cartTotal.toLocaleString()} {devise}</Text>
                        <SafeIcon name="chevron-right" size={16} color="#fff" />
                    </TouchableOpacity>
                )}
            </>
        );
    };

    // ── MODAL PANIER ─────────────────────────────────────────
    const renderCartModal = () => (
        <Modal visible={cartModal} transparent animationType="slide">
            <View style={s.modalOverlay}>
                <View style={s.modalSheet}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Ma commande</Text>
                        <TouchableOpacity onPress={() => setCartModal(false)}>
                            <SafeIcon name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView>
                        {cart.map((c, i) => (
                            <View key={i} style={s.cartRow}>
                                <Text style={s.cartItemName}>{c.nom}</Text>
                                <View style={s.qtyControls}>
                                    <TouchableOpacity style={s.qtyBtn} onPress={() => removeFromCart(c.id)}>
                                        <SafeIcon name="minus" size={13} color="#DC2626" />
                                    </TouchableOpacity>
                                    <Text style={s.qtyText}>{c.quantity}</Text>
                                    <TouchableOpacity style={[s.qtyBtn, s.qtyBtnAdd]} onPress={() => addToCart(c)}>
                                        <SafeIcon name="plus" size={13} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={s.cartItemPrice}>{(c.prix * c.quantity).toLocaleString()} {devise}</Text>
                            </View>
                        ))}

                        <View style={s.cartTotal}>
                            <Text style={s.cartTotalLabel}>Total</Text>
                            <Text style={s.cartTotalValue}>{cartTotal.toLocaleString()} {devise}</Text>
                        </View>

                        {/* Solde wallet + alerte si insuffisant */}
                        {walletBalance !== null && (() => {
                            const estimDelivery = orderType === 'delivery' ? 1000 : 0;
                            const estimInsurance = orderType === 'delivery'
                                ? Math.min(200 + Math.round(cartTotal * 0.008), 2500) : 0;
                            const estimTotal = cartTotal + estimDelivery + estimInsurance;
                            const balanceFcfa = walletBalance / 100;
                            const insuffisant = balanceFcfa < estimTotal;
                            return (
                                <View style={[s.walletBanner, insuffisant && s.walletBannerWarn]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <SafeIcon name="wallet" size={14} color={insuffisant ? '#B45309' : '#059669'} />
                                        <Text style={[s.walletBannerText, insuffisant && { color: '#B45309' }]}>
                                            Solde wallet : {balanceFcfa.toLocaleString()} {devise}
                                            {insuffisant ? ` · Manque ~${(estimTotal - balanceFcfa).toLocaleString()} ${devise}` : ' ✓'}
                                        </Text>
                                    </View>
                                    {insuffisant && (
                                        <TouchableOpacity
                                            style={s.walletRechargeBtn}
                                            onPress={() => {
                                                setCartModal(false);
                                                (navigation as any).navigate('WalletFinancial');
                                            }}>
                                            <SafeIcon name="plus-circle" size={13} color="#fff" />
                                            <Text style={s.walletRechargeBtnText}>Recharger</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })()}

                        {/* Estimation frais livraison */}
                        {orderType === 'delivery' && (
                            <View style={s.feesEstimate}>
                                <SafeIcon name="truck" size={13} color="#6B7280" />
                                <Text style={s.feesEstimateText}>
                                    Livraison ~1 000 {devise} + assurance ~{Math.min(200 + Math.round(cartTotal * 0.008), 2500)} {devise} estimés
                                </Text>
                            </View>
                        )}

                        <Text style={s.fieldLabel}>Type de commande</Text>
                        <View style={s.orderTypeRow}>
                            {(['takeaway', 'dine_in', 'delivery'] as const).map(type => (
                                selectedRestaurant?.accepts_delivery === false && type === 'delivery' ? null :
                                selectedRestaurant?.accepts_dine_in === false && type === 'dine_in' ? null :
                                <TouchableOpacity
                                    key={type}
                                    style={[s.orderTypeBtn, orderType === type && s.orderTypeBtnActive]}
                                    onPress={() => setOrderType(type)}>
                                    <Text style={[s.orderTypeBtnText, orderType === type && { color: '#DC2626' }]}>
                                        {type === 'takeaway' ? '🥡 À emporter' : type === 'dine_in' ? '🍽 Sur place' : '🛵 Livraison'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {orderType === 'delivery' && (
                            <>
                                <Text style={s.fieldLabel}>Adresse de livraison *</Text>
                                <TextInput
                                    style={s.input}
                                    placeholder="Rue, quartier, ville…"
                                    value={deliveryAddress}
                                    onChangeText={setDeliveryAddress}
                                />
                            </>
                        )}

                        <Text style={s.fieldLabel}>Instructions spéciales</Text>
                        <TextInput
                            style={[s.input, { height: 60 }]}
                            placeholder="Allergies, préférences…"
                            multiline
                            value={orderNote}
                            onChangeText={setOrderNote}
                        />
                    </ScrollView>
                    <NativeButton
                        title={placing ? 'Envoi en cours…' : orderType === 'delivery'
                            ? `Commander + livraison (~${(cartTotal + 1000 + Math.min(200 + Math.round(cartTotal * 0.008), 2500)).toLocaleString()} ${devise})`
                            : `Commander (${cartTotal.toLocaleString()} ${devise})`}
                        onPress={placeOrder}
                        variant="primary"
                        disabled={placing}
                        style={{ marginTop: 12 }}
                    />
                </View>
            </View>
        </Modal>
    );

    // ── MODAL FACTURE ────────────────────────────────────────
    const renderInvoiceModal = () => {
        const res = lastOrderResult;
        if (!res) return null;
        const inv = res.invoice || {};
        const lines: any[] = inv.lines || [];
        return (
            <Modal visible={invoiceModal} transparent animationType="slide">
                <View style={s.modalOverlay}>
                    <View style={[s.modalSheet, { paddingBottom: 32 }]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Facture détaillée</Text>
                            <TouchableOpacity onPress={() => setInvoiceModal(false)}>
                                <SafeIcon name="x" size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            <View style={s.invoiceCard}>
                                <Text style={s.invoiceSection}>Articles commandés</Text>
                                {lines.map((l: any, i: number) => (
                                    <View key={i} style={s.invoiceRow}>
                                        <Text style={s.invoiceLabel}>{l.label} × {l.qty}</Text>
                                        <Text style={s.invoiceValue}>{Number(l.subtotal || 0).toLocaleString()} {devise}</Text>
                                    </View>
                                ))}
                                <View style={s.invoiceDivider} />
                                <View style={s.invoiceRow}>
                                    <Text style={s.invoiceLabel}>Sous-total repas</Text>
                                    <Text style={s.invoiceValue}>{Number(inv.sous_total_repas || res.total || 0).toLocaleString()} {devise}</Text>
                                </View>
                                {(res.delivery_fee ?? 0) > 0 && (
                                    <View style={s.invoiceRow}>
                                        <Text style={s.invoiceLabel}>🛵 Frais de livraison</Text>
                                        <Text style={s.invoiceValue}>{Number(res.delivery_fee).toLocaleString()} {devise}</Text>
                                    </View>
                                )}
                                {(res.insurance_fee ?? 0) > 0 && (
                                    <View style={s.invoiceRow}>
                                        <Text style={s.invoiceLabel}>🛡 Assurance livraison</Text>
                                        <Text style={s.invoiceValue}>{Number(res.insurance_fee).toLocaleString()} {devise}</Text>
                                    </View>
                                )}
                                <View style={[s.invoiceRow, s.invoiceTotal]}>
                                    <Text style={s.invoiceTotalLabel}>TOTAL TTC</Text>
                                    <Text style={s.invoiceTotalValue}>{Number(res.total_with_fees || res.total || 0).toLocaleString()} {devise}</Text>
                                </View>
                                <Text style={s.invoiceNote}>
                                    Commission Yukpo (2%) : {Number(res.yukpo_commission || 0).toLocaleString()} {devise} · Statut : {res.payment_status === 'paid' ? '✅ Payé' : '⏳ À la réception'}
                                </Text>
                            </View>
                            {res.qr_code_url && (
                                <View style={s.qrContainer}>
                                    <Text style={s.qrTitle}>QR Code livraison</Text>
                                    <Text style={s.qrHint}>Montrez ce code au coursier pour valider la remise.</Text>
                                    <Image source={{ uri: res.qr_code_url }} style={s.qrImage} resizeMode="contain" />
                                </View>
                            )}
                        </ScrollView>
                        {res.order_id && (
                            <TouchableOpacity style={s.trackBtn} onPress={() => { setInvoiceModal(false); startTracking(res.order_id); }}>
                                <SafeIcon name="map-pin" size={16} color="#fff" />
                                <Text style={s.trackBtnText}>Suivre ma commande</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    // ── MODAL SUIVI ──────────────────────────────────────────
    const renderTrackingModal = () => {
        const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'completed'];
        const STEP_LABELS: Record<string, string> = {
            pending: 'Commande reçue',
            accepted: 'Acceptée',
            preparing: 'En préparation',
            ready: 'Prête / En route',
            completed: 'Livrée',
        };
        const currentStep = STEPS.indexOf(trackingData?.status || 'pending');
        return (
            <Modal visible={trackingModal} transparent animationType="slide" onRequestClose={stopTracking}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalSheet, { paddingBottom: 32 }]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Suivi commande #{trackingData?.id}</Text>
                            <TouchableOpacity onPress={stopTracking}>
                                <SafeIcon name="x" size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        {trackingLoading ? (
                            <ActivityIndicator size="large" color="#DC2626" style={{ marginVertical: 40 }} />
                        ) : (
                            <ScrollView>
                                <Text style={s.trackRestoName}>{trackingData?.restaurant_name}</Text>
                                <View style={s.stepsContainer}>
                                    {STEPS.filter(s => s !== 'cancelled').map((step, i) => {
                                        const done = i <= currentStep;
                                        const active = i === currentStep;
                                        return (
                                            <View key={step} style={s.stepRow}>
                                                <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                                                    {done && <SafeIcon name="check" size={12} color="#fff" />}
                                                </View>
                                                {i < STEPS.length - 2 && <View style={[s.stepLine, done && s.stepLineDone]} />}
                                                <Text style={[s.stepLabel, active && s.stepLabelActive]}>{STEP_LABELS[step]}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                                {trackingData?.estimated_ready_at && (
                                    <Text style={s.trackEta}>Prêt vers : {new Date(trackingData.estimated_ready_at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}</Text>
                                )}
                                {trackingData?.qr_code_url && trackingData.qr_status === 'pending' && (
                                    <View style={s.qrContainer}>
                                        <Text style={s.qrTitle}>QR Code de remise</Text>
                                        <Image source={{ uri: trackingData.qr_code_url }} style={s.qrImage} resizeMode="contain" />
                                    </View>
                                )}
                                <TouchableOpacity style={s.refreshBtn} onPress={() => startTracking(trackingData?.id)}>
                                    <SafeIcon name="refresh-cw" size={14} color="#2563EB" />
                                    <Text style={s.refreshBtnText}>Rafraîchir</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    // ── MODAL NOTATION ───────────────────────────────────────
    const renderRatingModal = () => (
        <Modal visible={ratingModal} transparent animationType="slide">
            <View style={s.modalOverlay}>
                <View style={[s.modalSheet, { paddingBottom: 40 }]}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Notez votre commande</Text>
                        <TouchableOpacity onPress={() => setRatingModal(false)}>
                            <SafeIcon name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <Text style={s.fieldLabel}>Votre note</Text>
                    <View style={s.starsRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                            <TouchableOpacity key={star} onPress={() => setRatingValue(star)}>
                                <Text style={[s.star, star <= ratingValue && s.starActive]}>★</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={s.fieldLabel}>Commentaire (optionnel)</Text>
                    <TextInput
                        style={[s.input, { height: 80 }]}
                        placeholder="Votre avis sur la qualité, le délai…"
                        multiline
                        value={ratingComment}
                        onChangeText={setRatingComment}
                    />
                    <NativeButton
                        title={placingRating ? 'Envoi…' : 'Envoyer mon avis'}
                        onPress={submitRating}
                        variant="primary"
                        disabled={placingRating}
                        style={{ marginTop: 16 }}
                    />
                </View>
            </View>
        </Modal>
    );

    // ── MODAL RÉSERVATION ────────────────────────────────────
    const renderReservModal = () => (
        <Modal visible={reservationModal} transparent animationType="slide">
            <View style={s.modalOverlay}>
                <View style={[s.modalSheet, { paddingBottom: 40 }]}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Réserver une table</Text>
                        <TouchableOpacity onPress={() => setReservationModal(false)}>
                            <SafeIcon name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <Text style={s.fieldLabel}>Date et heure (ex: 2026-04-05 19:00)</Text>
                    <TextInput
                        style={s.input}
                        placeholder="AAAA-MM-JJ HH:MM"
                        value={reservDate}
                        onChangeText={setReservDate}
                    />
                    <Text style={s.fieldLabel}>Nombre de personnes</Text>
                    <TextInput
                        style={s.input}
                        placeholder="2"
                        keyboardType="numeric"
                        value={reservPeople}
                        onChangeText={setReservPeople}
                    />
                    <Text style={s.fieldLabel}>Remarques (optionnel)</Text>
                    <TextInput
                        style={[s.input, { height: 60 }]}
                        placeholder="Occasion spéciale, allergies…"
                        multiline
                        value={reservNote}
                        onChangeText={setReservNote}
                    />
                    <NativeButton
                        title={placingReserv ? 'Envoi en cours…' : 'Envoyer la réservation'}
                        onPress={placeReservation}
                        variant="primary"
                        disabled={placingReserv}
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
                    <TouchableOpacity
                        onPress={viewMode === 'menu' ? backToList : () => navigation.goBack()}
                        style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>
                            {viewMode === 'menu' && selectedRestaurant
                                ? selectedRestaurant.name
                                : 'Restaurants'}
                        </Text>
                        <Text style={s.headerSub}>
                            {viewMode === 'menu' && selectedRestaurant
                                ? selectedRestaurant.city || 'Menu & Commandes'
                                : 'Trouvez et commandez près de vous'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={s.content}>
                {viewMode === 'list' ? renderList() : renderMenu()}
            </View>

            {renderCartModal()}
            {renderReservModal()}
            {renderInvoiceModal()}
            {renderTrackingModal()}
            {renderRatingModal()}

            {/* Modal commentaires / avis par plat spécifique */}
            <Modal visible={commentsModal} transparent animationType="slide" onRequestClose={() => setCommentsModal(false)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalSheet, { maxHeight: '90%' }]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>
                                {commentsItemIndex !== null ? `Avis : ${filteredItems[commentsItemIndex]?.nom || 'Plat'}` : 'Commentaires'}
                            </Text>
                            <TouchableOpacity onPress={() => setCommentsModal(false)}>
                                <SafeIcon name="x" size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        {selectedRestaurant && (
                            <ProductCommentsSection
                                serviceId={selectedRestaurant.service_id}
                                productIndex={commentsItemIndex ?? undefined}
                                serviceTitle={commentsItemIndex !== null ? filteredItems[commentsItemIndex]?.nom : selectedRestaurant.name}
                                mode="full"
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal partage social */}
            <GlobalShareModal
                visible={shareModal}
                onClose={() => setShareModal(false)}
                payload={sharePayload}
            />
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    // Search
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 10, elevation: 1 },
    searchInput: { flex: 1, fontSize: 14, color: '#111827' },
    searchToggle: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    searchToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    searchToggleActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
    searchToggleText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    searchToggleTextActive: { color: '#fff' },
    searchResultsLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 8, fontStyle: 'italic' },
    // Dish search results
    dishResultCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
    dishResultLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    dishResultIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
    dishResultName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
    dishResultDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    dishResultResto: { fontSize: 11, color: '#6B7280', marginTop: 3 },
    dishResultPrice: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginBottom: 4 },
    // Restaurant list
    restoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
    restoIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
    restoName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
    restometa: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    restoDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
    restoTagRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    tag: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 11, color: '#374151' },
    // Restaurant info card
    restoInfoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
    hoursTag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 8 },
    hoursTagText: { fontSize: 12, fontWeight: '600' },
    restoInfoDesc: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
    restoActionRow: { flexDirection: 'row', gap: 8 },
    reservBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#2563EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
    reservBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
    // Category filter
    catFilterRow: { marginBottom: 12 },
    catFilter: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff', marginRight: 8, elevation: 1 },
    catFilterActive: { backgroundColor: '#DC2626' },
    catFilterText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    catFilterTextActive: { color: '#fff' },
    // Menu items
    menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1 },
    menuCatIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    menuName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    menuDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
    menuPrice: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginTop: 4 },
    videoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, gap: 3 },
    videoBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    // Qty controls
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qtyBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    qtyBtnAdd: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
    qtyText: { fontSize: 14, fontWeight: '700', color: '#1F2937', minWidth: 20, textAlign: 'center' },
    // Floating cart
    cartFab: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#DC2626', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, elevation: 6 },
    cartFabText: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
    // Cart modal
    cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    cartItemName: { flex: 1, fontSize: 14, color: '#1F2937' },
    cartItemPrice: { fontSize: 13, fontWeight: '600', color: '#374151', marginLeft: 8 },
    cartTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
    cartTotalLabel: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    cartTotalValue: { fontSize: 18, fontWeight: '700', color: '#DC2626' },
    orderTypeRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
    orderTypeBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, alignItems: 'center' },
    orderTypeBtnActive: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
    orderTypeBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
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
    // Share restaurant button
    shareRestoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
    shareRestoBtnText: { color: '#7C3AED', fontSize: 13, fontWeight: '600' },
    // Per-item actions (share + comment)
    itemActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    itemActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    itemActionText: { fontSize: 11, fontWeight: '600' },
    // Comments section inline
    commentsSection: { marginTop: 20, marginBottom: 8 },
    commentsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    commentsSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
    // Wallet banner
    walletBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#D1FAE5', borderRadius: 8, padding: 10, marginBottom: 10, gap: 8 },
    walletBannerWarn: { backgroundColor: '#FEF3C7' },
    walletBannerText: { fontSize: 12, color: '#065F46', fontWeight: '600', flex: 1 },
    walletRechargeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC2626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    walletRechargeBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
    // Delivery estimate hint
    feesEstimate: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 8, marginBottom: 8 },
    feesEstimateText: { fontSize: 12, color: '#6B7280', flex: 1 },
    // List tabs
    listTabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    listTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    listTabActive: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
    listTabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    listTabTextActive: { color: '#DC2626' },
    // History
    historyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1 },
    historyTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    historyResto: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
    historyDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    historyItem: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
    historyAmounts: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    historyTotal: { fontSize: 13, color: '#374151' },
    historyFee: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    historyGrandTotal: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginTop: 4 },
    existingRating: { fontSize: 13, color: '#D97706', marginTop: 6 },
    historyActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#EFF6FF' },
    historyBtnGold: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
    historyBtnText: { fontSize: 12, fontWeight: '600' },
    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    // Invoice modal
    invoiceCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 16 },
    invoiceSection: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
    invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    invoiceLabel: { fontSize: 13, color: '#6B7280' },
    invoiceValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
    invoiceDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
    invoiceTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 6, paddingTop: 8 },
    invoiceTotalLabel: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
    invoiceTotalValue: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
    invoiceNote: { fontSize: 11, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
    // QR code
    qrContainer: { alignItems: 'center', paddingVertical: 16, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 12 },
    qrTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
    qrHint: { fontSize: 12, color: '#6B7280', marginBottom: 12, textAlign: 'center' },
    qrImage: { width: 200, height: 200, borderRadius: 8 },
    // Track button
    trackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 12, padding: 14, marginTop: 12 },
    trackBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    // Tracking modal
    trackRestoName: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 20, textAlign: 'center' },
    stepsContainer: { paddingHorizontal: 8, marginBottom: 16 },
    stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 12, zIndex: 1 },
    stepDotDone: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
    stepDotActive: { borderColor: '#DC2626', backgroundColor: '#DC2626' },
    stepLine: { position: 'absolute', left: 11, top: 24, width: 2, height: 28, backgroundColor: '#E5E7EB' },
    stepLineDone: { backgroundColor: '#DC2626' },
    stepLabel: { fontSize: 13, color: '#9CA3AF' },
    stepLabelActive: { color: '#DC2626', fontWeight: '700' },
    trackEta: { fontSize: 13, color: '#374151', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
    refreshBtnText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
    // Rating modal
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 },
    star: { fontSize: 36, color: '#D1D5DB' },
    starActive: { color: '#F59E0B' },
});

export default RestaurantClientScreen;
