// ✅ 2026-04-01: E-Commerce Hub — Yukpo
// Hub universel pour toutes les boutiques intégrées : supermarchés, mode, électronique,
// pharmacie, beauté, sport, maison, librairie, etc.
// Supporte WooCommerce, Shopify, PrestaShop, Jumia, CSV, APIs custom, et plus.

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import {
    ALL_STORE_CATEGORIES,
    EcommerceProduct,
    EcommerceStore,
    StoreCategory,
    STORE_CATEGORY_ICONS,
    STORE_CATEGORY_LABELS,
    ecommerceService,
} from '../../services/ecommerceService';
import {
    PriceComparison,
    SupermarketPromotion,
} from '../../services/supermarketService';
import { hapticPress } from '../../utils/hapticFeedback';

type ViewMode = 'stores' | 'products' | 'compare' | 'promotions';

const TAB_ITEMS: { key: ViewMode; icon: string; label: string }[] = [
    { key: 'stores', icon: 'grid', label: 'Boutiques' },
    { key: 'products', icon: 'shopping-bag', label: 'Produits' },
    { key: 'compare', icon: 'git-compare', label: 'Comparer' },
    { key: 'promotions', icon: 'tag', label: 'Promos' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / TAB_ITEMS.length;

// Couleurs par catégorie de boutique
const CATEGORY_COLORS: Record<StoreCategory, { bg: string; text: string; gradient: [string, string] }> = {
    supermarche:  { bg: '#D1FAE5', text: '#065F46', gradient: ['#10B981', '#34D399'] },
    alimentation: { bg: '#FEF3C7', text: '#92400E', gradient: ['#F59E0B', '#FCD34D'] },
    pharmacie:    { bg: '#DBEAFE', text: '#1E40AF', gradient: ['#3B82F6', '#60A5FA'] },
    mode:         { bg: '#FCE7F3', text: '#9D174D', gradient: ['#EC4899', '#F472B6'] },
    electronique: { bg: '#EDE9FE', text: '#5B21B6', gradient: ['#8B5CF6', '#A78BFA'] },
    beaute:       { bg: '#FFF0F3', text: '#BE123C', gradient: ['#FB7185', '#FDA4AF'] },
    sport:        { bg: '#FFF7ED', text: '#9A3412', gradient: ['#F97316', '#FB923C'] },
    maison:       { bg: '#F0FDF4', text: '#166534', gradient: ['#22C55E', '#4ADE80'] },
    librairie:    { bg: '#F5F3FF', text: '#4C1D95', gradient: ['#7C3AED', '#8B5CF6'] },
    autre:        { bg: '#F3F4F6', text: '#374151', gradient: ['#6B7280', '#9CA3AF'] },
};

const EcommerceHubScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { location } = useLocation();
    const { t } = useLanguageSafe();
    const { currency } = useCurrencyDetection();

    // ─── État principal ───────────────────────────────────────
    const [viewMode, setViewMode] = useState<ViewMode>('stores');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<StoreCategory | 'all'>('all');

    // ─── Boutiques ───────────────────────────────────────────
    const [stores, setStores] = useState<EcommerceStore[]>([]);
    const [selectedStore, setSelectedStore] = useState<EcommerceStore | null>(null);
    const [loadingStores, setLoadingStores] = useState(true);
    const [searchStoreQuery, setSearchStoreQuery] = useState('');

    // ─── Produits ─────────────────────────────────────────────
    const [products, setProducts] = useState<EcommerceProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [refreshingProducts, setRefreshingProducts] = useState(false);
    const [productQuery, setProductQuery] = useState('');
    const [productCategory, setProductCategory] = useState('');
    const [productCategories, setProductCategories] = useState<string[]>([]);
    const [showPromoOnly, setShowPromoOnly] = useState(false);
    const productSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Comparaison ─────────────────────────────────────────
    const [compareQuery, setCompareQuery] = useState('');
    const [priceComparison, setPriceComparison] = useState<PriceComparison | null>(null);
    const [loadingCompare, setLoadingCompare] = useState(false);

    // ─── Promotions ──────────────────────────────────────────
    const [promotions, setPromotions] = useState<SupermarketPromotion[]>([]);
    const [loadingPromotions, setLoadingPromotions] = useState(false);

    // ─── Animation tabs ───────────────────────────────────────
    const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

    // ─────────────────────────────────────────────────────────
    // INITIALISATION
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        loadStores();
    }, [activeCategoryFilter]);

    // Auto-sélection depuis paramètre navigation
    useEffect(() => {
        const params = route.params as any;
        if (params?.serviceId && stores.length > 0) {
            const found = stores.find(s => s.service_id.toString() === params.serviceId.toString());
            if (found) {
                handleSelectStore(found);
            }
        }
        if (params?.category) {
            setActiveCategoryFilter(params.category as StoreCategory);
        }
    }, [route.params, stores]);

    const animateToTab = useCallback((index: number) => {
        Animated.spring(tabIndicatorAnim, {
            toValue: index * TAB_WIDTH,
            useNativeDriver: true,
            tension: 300,
            friction: 30,
        }).start();
    }, [tabIndicatorAnim]);

    const switchTab = useCallback((mode: ViewMode) => {
        hapticPress();
        const index = TAB_ITEMS.findIndex(t => t.key === mode);
        animateToTab(index);
        setViewMode(mode);
    }, [animateToTab]);

    // ─────────────────────────────────────────────────────────
    // CHARGEMENT BOUTIQUES
    // ─────────────────────────────────────────────────────────
    const loadStores = useCallback(async () => {
        setLoadingStores(true);
        try {
            const { stores: allStores } = await ecommerceService.listStores({
                store_category: activeCategoryFilter === 'all' ? undefined : activeCategoryFilter,
                latitude: location?.coords?.latitude,
                longitude: location?.coords?.longitude,
                radius_km: 30,
                limit: 100,
            });

            // Calcul distance si GPS disponible
            if (location?.coords) {
                const { latitude: lat, longitude: lng } = location.coords;
                for (const store of allStores) {
                    if (store.gps) {
                        const [sLat, sLng] = store.gps.split(',').map(Number);
                        if (!isNaN(sLat) && !isNaN(sLng)) {
                            const d = haversine(lat, lng, sLat, sLng);
                            store.distance_km = Math.round(d * 10) / 10;
                        }
                    }
                }
                allStores.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
            }

            setStores(allStores);
        } catch (err) {
            console.error('[EcommerceHub] Erreur chargement boutiques:', err);
        } finally {
            setLoadingStores(false);
        }
    }, [activeCategoryFilter, location]);

    // ─────────────────────────────────────────────────────────
    // SÉLECTION D'UNE BOUTIQUE
    // ─────────────────────────────────────────────────────────
    const handleSelectStore = useCallback((store: EcommerceStore) => {
        hapticPress();
        setSelectedStore(store);
        setProductQuery('');
        setProductCategory('');
        setProducts([]);
        switchTab('products');
        loadProductsForStore(store.service_id, {});
        // Charger les catégories
        ecommerceService.getSupermarketCategories(store.service_id)
            .then(r => setProductCategories((r.data as any)?.categories || []))
            .catch(() => {});
    }, [switchTab]);

    // ─────────────────────────────────────────────────────────
    // CHARGEMENT PRODUITS
    // ─────────────────────────────────────────────────────────
    const loadProductsForStore = useCallback(async (
        serviceId: string | number,
        filters: { query?: string; category?: string; on_promotion?: boolean }
    ) => {
        setLoadingProducts(true);
        try {
            const response = await ecommerceService.getSupermarketProducts(serviceId, {
                query: filters.query,
                category: filters.category,
                on_promotion: filters.on_promotion,
                limit: 100,
            });
            const raw = (response.data as any)?.products || [];
            setProducts(raw.map((p: any) => ecommerceService.normalizeProduct(p)));
        } catch (err) {
            console.error('[EcommerceHub] Erreur chargement produits:', err);
            Alert.alert('Erreur', 'Impossible de charger les produits');
        } finally {
            setLoadingProducts(false);
            setRefreshingProducts(false);
        }
    }, []);

    // Recherche avec debounce
    const handleProductSearch = useCallback((text: string) => {
        setProductQuery(text);
        if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
        productSearchTimer.current = setTimeout(() => {
            if (selectedStore) {
                loadProductsForStore(selectedStore.service_id, {
                    query: text || undefined,
                    category: productCategory || undefined,
                    on_promotion: showPromoOnly || undefined,
                });
            }
        }, 500);
    }, [selectedStore, productCategory, showPromoOnly, loadProductsForStore]);

    // ─────────────────────────────────────────────────────────
    // COMPARAISON DE PRIX
    // ─────────────────────────────────────────────────────────
    const handleCompare = useCallback(async () => {
        if (!compareQuery.trim()) return;
        hapticPress();
        setLoadingCompare(true);
        setPriceComparison(null);
        try {
            const response = await ecommerceService.compareProductPrices(
                compareQuery.trim(),
                undefined,
                location?.coords?.latitude,
                location?.coords?.longitude,
                30
            );
            setPriceComparison((response.data as any)?.comparison || null);
        } catch {
            Alert.alert('Erreur', 'Impossible de comparer les prix');
        } finally {
            setLoadingCompare(false);
        }
    }, [compareQuery, location]);

    // ─────────────────────────────────────────────────────────
    // PROMOTIONS
    // ─────────────────────────────────────────────────────────
    const loadPromotions = useCallback(async () => {
        setLoadingPromotions(true);
        try {
            if (selectedStore) {
                const r = await ecommerceService.getSupermarketPromotions(selectedStore.service_id);
                setPromotions((r.data as any)?.promotions || []);
            } else if (location?.coords) {
                const r = await ecommerceService.getNearbyPromotions(
                    location.coords.latitude,
                    location.coords.longitude,
                    30
                );
                setPromotions((r.data as any)?.promotions || []);
            }
        } catch {
            // silencieux
        } finally {
            setLoadingPromotions(false);
        }
    }, [selectedStore, location]);

    useEffect(() => {
        if (viewMode === 'promotions') loadPromotions();
    }, [viewMode]);

    // ─────────────────────────────────────────────────────────
    // FILTRES BOUTIQUES (recherche locale)
    // ─────────────────────────────────────────────────────────
    const filteredStores = useMemo(() => {
        const q = searchStoreQuery.toLowerCase();
        return stores.filter(s => {
            const matchSearch = !q ||
                s.name?.toLowerCase().includes(q) ||
                s.address?.toLowerCase().includes(q) ||
                s.platform_name?.toLowerCase().includes(q);
            return matchSearch;
        });
    }, [stores, searchStoreQuery]);

    // ─────────────────────────────────────────────────────────
    // COULEURS DYNAMIQUES selon catégorie active
    // ─────────────────────────────────────────────────────────
    const activeColors = useMemo(() => {
        if (activeCategoryFilter === 'all') return CATEGORY_COLORS.supermarche;
        return CATEGORY_COLORS[activeCategoryFilter] || CATEGORY_COLORS.autre;
    }, [activeCategoryFilter]);

    // ─────────────────────────────────────────────────────────
    // RENDER : BARRE CATÉGORIES
    // ─────────────────────────────────────────────────────────
    const renderCategoryBar = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryBar}
        >
            <TouchableOpacity
                style={[
                    styles.categoryChip,
                    activeCategoryFilter === 'all' && { backgroundColor: activeColors.gradient[0] },
                ]}
                onPress={() => { hapticPress(); setActiveCategoryFilter('all'); }}
            >
                <Text style={[
                    styles.categoryChipText,
                    activeCategoryFilter === 'all' && styles.categoryChipTextActive,
                ]}>
                    🏪 Tout
                </Text>
            </TouchableOpacity>
            {ALL_STORE_CATEGORIES.map(cat => (
                <TouchableOpacity
                    key={cat}
                    style={[
                        styles.categoryChip,
                        activeCategoryFilter === cat && { backgroundColor: CATEGORY_COLORS[cat].gradient[0] },
                    ]}
                    onPress={() => { hapticPress(); setActiveCategoryFilter(cat); }}
                >
                    <Text style={[
                        styles.categoryChipText,
                        activeCategoryFilter === cat && styles.categoryChipTextActive,
                    ]}>
                        {STORE_CATEGORY_ICONS[cat]} {STORE_CATEGORY_LABELS[cat]}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER : CARTE BOUTIQUE
    // ─────────────────────────────────────────────────────────
    const renderStoreCard = ({ item }: { item: EcommerceStore }) => {
        const catColors = CATEGORY_COLORS[item.store_category] || CATEGORY_COLORS.autre;
        const isSelected = selectedStore?.service_id === item.service_id;
        return (
            <TouchableOpacity
                style={[styles.storeCard, isSelected && styles.storeCardSelected]}
                onPress={() => handleSelectStore(item)}
                activeOpacity={0.85}
            >
                {/* Logo ou icône */}
                <View style={[styles.storeIconBg, { backgroundColor: catColors.bg }]}>
                    {item.logo_url ? (
                        <Image source={{ uri: item.logo_url }} style={styles.storeLogoImg} resizeMode="contain" />
                    ) : (
                        <Text style={styles.storeIconEmoji}>{STORE_CATEGORY_ICONS[item.store_category] || '🏪'}</Text>
                    )}
                </View>
                <View style={styles.storeInfo}>
                    <Text style={styles.storeName} numberOfLines={1}>{item.name || 'Boutique'}</Text>
                    {item.platform_name && (
                        <View style={[styles.platformBadge, { backgroundColor: catColors.bg }]}>
                            <Text style={[styles.platformBadgeText, { color: catColors.text }]}>
                                {item.platform_name}
                            </Text>
                        </View>
                    )}
                    {item.address && (
                        <Text style={styles.storeAddress} numberOfLines={1}>{item.address}</Text>
                    )}
                    <View style={styles.storeMetaRow}>
                        {item.distance_km !== undefined && (
                            <View style={styles.storeMeta}>
                                <SafeIcon name="map-pin" size={12} color="#6B7280" />
                                <Text style={styles.storeMetaText}>{item.distance_km} km</Text>
                            </View>
                        )}
                        {item.products_count > 0 && (
                            <View style={styles.storeMeta}>
                                <SafeIcon name="package" size={12} color="#6B7280" />
                                <Text style={styles.storeMetaText}>{item.products_count} produits</Text>
                            </View>
                        )}
                    </View>
                </View>
                <SafeIcon name="chevron-right" size={20} color="#D1D5DB" />
            </TouchableOpacity>
        );
    };

    // ─────────────────────────────────────────────────────────
    // RENDER : CARTE PRODUIT
    // ─────────────────────────────────────────────────────────
    const renderProductCard = ({ item }: { item: EcommerceProduct }) => {
        const promoPct = item.promotion_percentage
            ?? ecommerceService.getPromotionPercentage(item.price, item.original_price);
        const imageUri = item.image_url
            || (Array.isArray(item.images) && item.images.length > 0
                ? (typeof item.images[0] === 'string' ? item.images[0] : (item.images[0] as any)?.url)
                : undefined);
        const isOutOfStock = item.stock_status === 'out_of_stock' || (item.stock !== undefined && item.stock <= 0);

        return (
            <View style={[styles.productCard, isOutOfStock && styles.productCardOutOfStock]}>
                {/* Image */}
                <View style={styles.productImageContainer}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                        <View style={styles.productImageFallback}>
                            <SafeIcon name="shopping-bag" size={32} color="#D1D5DB" />
                        </View>
                    )}
                    {item.is_promotion && promoPct && (
                        <View style={styles.promoBadge}>
                            <Text style={styles.promoBadgeText}>-{promoPct}%</Text>
                        </View>
                    )}
                    {isOutOfStock && (
                        <View style={styles.outOfStockOverlay}>
                            <Text style={styles.outOfStockText}>Rupture</Text>
                        </View>
                    )}
                </View>
                {/* Infos */}
                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    {item.brand && <Text style={styles.productBrand}>{item.brand}</Text>}
                    <View style={styles.productPriceRow}>
                        <Text style={styles.productPrice}>
                            {ecommerceService.formatPrice(item.price, item.currency || currency?.code || 'XAF')}
                        </Text>
                        {item.original_price && item.original_price > item.price && (
                            <Text style={styles.productOriginalPrice}>
                                {ecommerceService.formatPrice(item.original_price, item.currency || currency?.code || 'XAF')}
                            </Text>
                        )}
                    </View>
                    {item.unit && <Text style={styles.productUnit}>{item.unit}</Text>}
                    {/* Stock indicator */}
                    {item.stock_status === 'low_stock' && (
                        <Text style={styles.lowStockText}>⚠️ Stock limité</Text>
                    )}
                </View>
                {/* Bouton comparer */}
                <TouchableOpacity
                    style={styles.compareBtnSmall}
                    onPress={() => {
                        setCompareQuery(item.name);
                        switchTab('compare');
                    }}
                >
                    <SafeIcon name="git-compare" size={14} color="#6B7280" />
                </TouchableOpacity>
            </View>
        );
    };

    // ─────────────────────────────────────────────────────────
    // RENDER : VUE BOUTIQUES
    // ─────────────────────────────────────────────────────────
    const renderStoresView = () => (
        <View style={styles.viewContainer}>
            {/* Barre de recherche boutique */}
            <View style={styles.searchBar}>
                <SafeIcon name="search" size={18} color="#9CA3AF" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher une boutique..."
                    placeholderTextColor="#9CA3AF"
                    value={searchStoreQuery}
                    onChangeText={setSearchStoreQuery}
                />
                {searchStoreQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchStoreQuery('')}>
                        <SafeIcon name="x" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            {loadingStores ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={activeColors.gradient[0]} />
                    <Text style={styles.loaderText}>Chargement des boutiques...</Text>
                </View>
            ) : filteredStores.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>🏪</Text>
                    <Text style={styles.emptyStateTitle}>
                        {activeCategoryFilter === 'all'
                            ? 'Aucune boutique intégrée'
                            : `Aucune boutique "${STORE_CATEGORY_LABELS[activeCategoryFilter as StoreCategory]}" dans Yukpo`}
                    </Text>
                    <Text style={styles.emptyStateSubtitle}>
                        Les partenaires peuvent connecter leurs boutiques facilement
                    </Text>
                    <TouchableOpacity
                        style={[styles.partnerConnectBtn, { backgroundColor: activeColors.gradient[0] }]}
                        onPress={() => navigation.navigate('EcommercePartnerConnect')}
                    >
                        <SafeIcon name="plus-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.partnerConnectBtnText}>Connecter une boutique</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={filteredStores}
                    keyExtractor={item => item.service_id.toString()}
                    renderItem={renderStoreCard}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={loadingStores}
                            onRefresh={loadStores}
                            colors={[activeColors.gradient[0]]}
                            tintColor={activeColors.gradient[0]}
                        />
                    }
                    ListFooterComponent={
                        <TouchableOpacity
                            style={[styles.partnerConnectBtn, { backgroundColor: activeColors.gradient[0], marginTop: 8 }]}
                            onPress={() => navigation.navigate('EcommercePartnerConnect')}
                        >
                            <SafeIcon name="plus-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.partnerConnectBtnText}>Ajouter votre boutique</Text>
                        </TouchableOpacity>
                    }
                />
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER : VUE PRODUITS
    // ─────────────────────────────────────────────────────────
    const renderProductsView = () => (
        <View style={styles.viewContainer}>
            {!selectedStore ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>🛍️</Text>
                    <Text style={styles.emptyStateTitle}>Sélectionnez une boutique</Text>
                    <Text style={styles.emptyStateSubtitle}>Choisissez d'abord une boutique dans l'onglet "Boutiques"</Text>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: activeColors.gradient[0] }]} onPress={() => switchTab('stores')}>
                        <Text style={styles.actionBtnText}>Voir les boutiques</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    {/* Header boutique sélectionnée */}
                    <View style={[styles.selectedStoreBanner, { borderColor: activeColors.gradient[0] + '40' }]}>
                        <View style={[styles.selectedStoreIcon, { backgroundColor: activeColors.bg ?? '#F0FDF4' }]}>
                            <Text style={{ fontSize: 20 }}>
                                {STORE_CATEGORY_ICONS[selectedStore.store_category] || '🏪'}
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.selectedStoreName} numberOfLines={1}>{selectedStore.name}</Text>
                            {selectedStore.platform_name && (
                                <Text style={styles.selectedStorePlatform}>{selectedStore.platform_name}</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => { setSelectedStore(null); switchTab('stores'); }}>
                            <SafeIcon name="x" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Recherche produit */}
                    <View style={styles.searchBar}>
                        <SafeIcon name="search" size={18} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Rechercher un produit..."
                            placeholderTextColor="#9CA3AF"
                            value={productQuery}
                            onChangeText={handleProductSearch}
                        />
                        {productQuery.length > 0 && (
                            <TouchableOpacity onPress={() => handleProductSearch('')}>
                                <SafeIcon name="x" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Filtres : catégories + promos */}
                    {(productCategories.length > 0 || true) && (
                        <View style={styles.productFiltersRow}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                <TouchableOpacity
                                    style={[styles.filterChip, !productCategory && { backgroundColor: activeColors.gradient[0] }]}
                                    onPress={() => { setProductCategory(''); loadProductsForStore(selectedStore.service_id, { query: productQuery || undefined, on_promotion: showPromoOnly || undefined }); }}
                                >
                                    <Text style={[styles.filterChipText, !productCategory && { color: '#fff' }]}>Tous</Text>
                                </TouchableOpacity>
                                {productCategories.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.filterChip, productCategory === cat && { backgroundColor: activeColors.gradient[0] }]}
                                        onPress={() => { setProductCategory(cat); loadProductsForStore(selectedStore.service_id, { query: productQuery || undefined, category: cat, on_promotion: showPromoOnly || undefined }); }}
                                    >
                                        <Text style={[styles.filterChipText, productCategory === cat && { color: '#fff' }]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity
                                style={[styles.promoToggle, showPromoOnly && { backgroundColor: '#FEE2E2' }]}
                                onPress={() => {
                                    const next = !showPromoOnly;
                                    setShowPromoOnly(next);
                                    loadProductsForStore(selectedStore.service_id, { query: productQuery || undefined, category: productCategory || undefined, on_promotion: next || undefined });
                                }}
                            >
                                <SafeIcon name="tag" size={14} color={showPromoOnly ? '#EF4444' : '#9CA3AF'} />
                                <Text style={[styles.promoToggleText, showPromoOnly && { color: '#EF4444' }]}>Promos</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {loadingProducts ? (
                        <View style={styles.centerLoader}>
                            <ActivityIndicator size="large" color={activeColors.gradient[0]} />
                        </View>
                    ) : products.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateIcon}>📦</Text>
                            <Text style={styles.emptyStateTitle}>Aucun produit trouvé</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={products}
                            keyExtractor={(item, idx) => `${item.id}-${idx}`}
                            renderItem={renderProductCard}
                            numColumns={2}
                            columnWrapperStyle={styles.productRow}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshingProducts}
                                    onRefresh={() => {
                                        setRefreshingProducts(true);
                                        loadProductsForStore(selectedStore.service_id, { query: productQuery || undefined, category: productCategory || undefined, on_promotion: showPromoOnly || undefined });
                                    }}
                                    colors={[activeColors.gradient[0]]}
                                    tintColor={activeColors.gradient[0]}
                                />
                            }
                        />
                    )}
                </>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER : VUE COMPARAISON
    // ─────────────────────────────────────────────────────────
    const renderCompareView = () => (
        <ScrollView style={styles.viewContainer} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.sectionTitle}>Comparer les prix entre boutiques</Text>
            <View style={[styles.searchBar, { marginBottom: 12 }]}>
                <SafeIcon name="search" size={18} color="#9CA3AF" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Ex: Riz 5kg, iPhone 15, Robe bleue..."
                    placeholderTextColor="#9CA3AF"
                    value={compareQuery}
                    onChangeText={setCompareQuery}
                    onSubmitEditing={handleCompare}
                    returnKeyType="search"
                />
            </View>
            <TouchableOpacity
                style={[styles.compareBtn, { backgroundColor: activeColors.gradient[0] }, loadingCompare && { opacity: 0.7 }]}
                onPress={handleCompare}
                disabled={loadingCompare || !compareQuery.trim()}
            >
                {loadingCompare ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <>
                        <SafeIcon name="git-compare" size={18} color="#fff" />
                        <Text style={styles.compareBtnText}>Comparer les prix</Text>
                    </>
                )}
            </TouchableOpacity>

            {priceComparison && (
                <View style={styles.comparisonResults}>
                    <Text style={styles.comparisonProductName}>{priceComparison.product_name}</Text>
                    <View style={styles.comparisonStats}>
                        <View style={styles.comparisonStat}>
                            <Text style={styles.comparisonStatLabel}>Prix moyen</Text>
                            <Text style={styles.comparisonStatValue}>
                                {ecommerceService.formatPrice(priceComparison.average_price)}
                            </Text>
                        </View>
                        <View style={styles.comparisonStat}>
                            <Text style={styles.comparisonStatLabel}>Le moins cher</Text>
                            <Text style={[styles.comparisonStatValue, { color: '#10B981' }]}>
                                {ecommerceService.formatPrice(priceComparison.price_range.min)}
                            </Text>
                        </View>
                        <View style={styles.comparisonStat}>
                            <Text style={styles.comparisonStatLabel}>Le plus cher</Text>
                            <Text style={[styles.comparisonStatValue, { color: '#EF4444' }]}>
                                {ecommerceService.formatPrice(priceComparison.price_range.max)}
                            </Text>
                        </View>
                    </View>

                    {priceComparison.supermarkets.map((entry, idx) => {
                        const isCheapest = entry.supermarket_id === priceComparison.cheapest.supermarket_id;
                        return (
                            <View key={idx} style={[styles.comparisonRow, isCheapest && styles.comparisonRowCheapest]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.comparisonStoreName}>{entry.supermarket_name}</Text>
                                    {entry.distance_km !== undefined && (
                                        <Text style={styles.comparisonDistance}>📍 {entry.distance_km} km</Text>
                                    )}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.comparisonPrice, isCheapest && { color: '#10B981' }]}>
                                        {ecommerceService.formatPrice(entry.product.price)}
                                    </Text>
                                    {isCheapest && (
                                        <View style={styles.cheapestBadge}>
                                            <Text style={styles.cheapestBadgeText}>Meilleur prix</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER : VUE PROMOTIONS
    // ─────────────────────────────────────────────────────────
    const renderPromotionsView = () => (
        <View style={styles.viewContainer}>
            {loadingPromotions ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={activeColors.gradient[0]} />
                    <Text style={styles.loaderText}>Chargement des promotions...</Text>
                </View>
            ) : promotions.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>🏷️</Text>
                    <Text style={styles.emptyStateTitle}>Aucune promotion disponible</Text>
                    <Text style={styles.emptyStateSubtitle}>
                        {selectedStore
                            ? `Pas de promos actives chez ${selectedStore.name}`
                            : 'Aucune promotion dans votre zone'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={promotions}
                    keyExtractor={(item, i) => `${item.id}-${i}`}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={styles.promoCard}>
                            <View style={styles.promoCardHeader}>
                                <View style={[styles.promoIconBg, { backgroundColor: '#FEE2E2' }]}>
                                    <SafeIcon name="tag" size={22} color="#EF4444" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.promoTitle}>{item.title}</Text>
                                    <Text style={styles.promoStore}>{item.supermarket_name}</Text>
                                    {item.discount_percentage && (
                                        <Text style={styles.promoDiscount}>-{item.discount_percentage}%</Text>
                                    )}
                                    <Text style={styles.promoDates}>
                                        Jusqu'au {new Date(item.end_date).toLocaleDateString('fr-FR')}
                                    </Text>
                                </View>
                            </View>
                            {item.products?.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                    {item.products.map((p, pi) => (
                                        <TouchableOpacity
                                            key={pi}
                                            style={styles.promoProductChip}
                                            onPress={() => {
                                                setCompareQuery(p.name);
                                                switchTab('compare');
                                            }}
                                        >
                                            <Text style={styles.promoProductChipText} numberOfLines={1}>{p.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    )}
                />
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────
    // RENDER PRINCIPAL
    // ─────────────────────────────────────────────────────────
    return (
        <SafeNativeView style={styles.container}>
            {/* Header gradient dynamique */}
            <LinearGradient
                colors={activeColors.gradient}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>
                        {activeCategoryFilter === 'all'
                            ? '🛒 E-Commerce Yukpo'
                            : `${STORE_CATEGORY_ICONS[activeCategoryFilter as StoreCategory]} ${STORE_CATEGORY_LABELS[activeCategoryFilter as StoreCategory]}`}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {filteredStores.length} boutique{filteredStores.length !== 1 ? 's' : ''}
                        {selectedStore ? ` · ${selectedStore.name}` : ''}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.headerPartnerBtn}
                    onPress={() => navigation.navigate('EcommercePartnerConnect')}
                >
                    <SafeIcon name="plus-circle" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </LinearGradient>

            {/* Filtre catégories */}
            {renderCategoryBar()}

            {/* Tabs */}
            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab, index) => {
                    const isActive = viewMode === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => switchTab(tab.key)}
                        >
                            <SafeIcon
                                name={tab.icon}
                                size={20}
                                color={isActive ? activeColors.gradient[0] : '#9CA3AF'}
                            />
                            <Text style={[styles.tabLabel, isActive && { color: activeColors.gradient[0] }]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                <Animated.View
                    style={[
                        styles.tabIndicator,
                        { backgroundColor: activeColors.gradient[0], transform: [{ translateX: tabIndicatorAnim }] },
                    ]}
                />
            </View>

            {/* Contenu */}
            {viewMode === 'stores' && renderStoresView()}
            {viewMode === 'products' && renderProductsView()}
            {viewMode === 'compare' && renderCompareView()}
            {viewMode === 'promotions' && renderPromotionsView()}
        </SafeNativeView>
    );
};

// ═══════════════════════════════════════════════════════════════
// UTILITAIRE HAVERSINE
// ═══════════════════════════════════════════════════════════════
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingTop: 50,
        gap: 12,
    },
    headerBack: { padding: 4 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    headerPartnerBtn: { padding: 4 },
    categoryBar: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 6,
    },
    categoryChipText: { fontSize: 13, fontWeight: '500', color: '#374151' },
    categoryChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        position: 'relative',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        gap: 4,
    },
    tabLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        height: 3,
        width: TAB_WIDTH,
        borderRadius: 2,
    },
    viewContainer: { flex: 1 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        margin: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 15, color: '#111827' },
    listContent: { paddingHorizontal: 12, paddingBottom: 24 },
    centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
    loaderText: { fontSize: 14, color: '#6B7280' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 10 },
    emptyStateIcon: { fontSize: 56, marginBottom: 4 },
    emptyStateTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
    emptyStateSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
    actionBtn: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    partnerConnectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginHorizontal: 12,
        marginBottom: 8,
    },
    partnerConnectBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    // Store card
    storeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    storeCardSelected: {
        borderWidth: 2,
        borderColor: '#10B981',
    },
    storeIconBg: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storeLogoImg: { width: 44, height: 44, borderRadius: 10 },
    storeIconEmoji: { fontSize: 26 },
    storeInfo: { flex: 1, gap: 3 },
    storeName: { fontSize: 16, fontWeight: '700', color: '#111827' },
    platformBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    platformBadgeText: { fontSize: 11, fontWeight: '600' },
    storeAddress: { fontSize: 13, color: '#6B7280' },
    storeMetaRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
    storeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    storeMetaText: { fontSize: 12, color: '#6B7280' },
    // Selected store banner
    selectedStoreBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        margin: 12,
        marginBottom: 4,
        padding: 12,
        gap: 10,
    },
    selectedStoreIcon: {
        width: 40, height: 40, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    selectedStoreName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    selectedStorePlatform: { fontSize: 12, color: '#6B7280' },
    // Product filters
    productFiltersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginBottom: 8,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 6,
    },
    filterChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    promoToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    promoToggleText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
    // Product card
    productRow: { gap: 10, marginBottom: 10 },
    productCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
    },
    productCardOutOfStock: { opacity: 0.6 },
    productImageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#F9FAFB', position: 'relative' },
    productImage: { width: '100%', height: '100%' },
    productImageFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    promobadge: {
        position: 'absolute', top: 8, left: 8,
        backgroundColor: '#EF4444',
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    promoBadge: {
        position: 'absolute', top: 8, left: 8,
        backgroundColor: '#EF4444',
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    promoBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    outOfStockOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center', alignItems: 'center',
    },
    outOfStockText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    productInfo: { padding: 10, gap: 3 },
    productName: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
    productBrand: { fontSize: 11, color: '#6B7280' },
    productPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    productPrice: { fontSize: 15, fontWeight: '700', color: '#10B981' },
    productOriginalPrice: { fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through' },
    productUnit: { fontSize: 11, color: '#9CA3AF' },
    lowStockText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
    compareBtnSmall: {
        position: 'absolute', top: 8, right: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 8, padding: 5,
    },
    // Comparaison
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', margin: 16, marginBottom: 8 },
    compareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 12,
    },
    compareBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    comparisonResults: { margin: 12 },
    comparisonProductName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
    comparisonStats: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        justifyContent: 'space-around',
    },
    comparisonStat: { alignItems: 'center', gap: 4 },
    comparisonStatLabel: { fontSize: 11, color: '#6B7280' },
    comparisonStatValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
    comparisonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    comparisonRowCheapest: { borderWidth: 2, borderColor: '#10B981' },
    comparisonStoreName: { fontSize: 15, fontWeight: '600', color: '#111827' },
    comparisonDistance: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    comparisonPrice: { fontSize: 18, fontWeight: '700', color: '#111827' },
    cheapestBadge: {
        backgroundColor: '#10B981', borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
    },
    cheapestBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    // Promotions
    promoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#FEE2E2',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    promoCardHeader: { flexDirection: 'row', gap: 12 },
    promoIconBg: {
        width: 48, height: 48, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    promoTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
    promoStore: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
    promoDiscount: { fontSize: 16, fontWeight: '700', color: '#EF4444', marginBottom: 2 },
    promoDates: { fontSize: 12, color: '#9CA3AF' },
    promoProductChip: {
        backgroundColor: '#FFF0F0',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginRight: 6,
        maxWidth: 140,
    },
    promoProductChipText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },
});

export default EcommerceHubScreen;
