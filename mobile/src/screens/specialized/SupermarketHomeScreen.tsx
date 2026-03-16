// ✅ Écran Supermarché MODERNE - Refonte complète avec UX professionnelle
// Structure : Sélection supermarché → Produits → Comparaison → Promotions

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated, Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { PriceComparison, Supermarket, SupermarketProduct, SupermarketPromotion, supermarketService } from '../../services/supermarketService';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type ViewMode = 'select' | 'products' | 'compare' | 'promotions';

const TAB_ITEMS: { key: ViewMode; label: string; icon: string }[] = [
    { key: 'select', label: 'Magasins', icon: 'store' },
    { key: 'products', label: 'Produits', icon: 'shopping-bag' },
    { key: 'compare', label: 'Comparer', icon: 'git-compare' },
    { key: 'promotions', label: 'Promos', icon: 'tag' },
];

const SupermarketHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    // ✅ Détecter si on vient de BayamSelam ou du flux de livraison
    const isBayamSelam = route.name === 'BayamSelamSearch' || (route.params as any)?.fromBayamSelam;

    // Mode d'affichage
    const [viewMode, setViewMode] = useState<ViewMode>('select');

    // États pour sélection de supermarché
    const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
    const [selectedSupermarket, setSelectedSupermarket] = useState<Supermarket | null>(null);
    const [loadingSupermarkets, setLoadingSupermarkets] = useState(true);
    const [searchSupermarketQuery, setSearchSupermarketQuery] = useState('');

    // États pour produits
    const [products, setProducts] = useState<SupermarketProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [refreshingProducts, setRefreshingProducts] = useState(false);
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories, setCategories] = useState<string[]>([]);
    const [showPromotionsOnly, setShowPromotionsOnly] = useState(false);

    // États pour comparaison
    const [compareProductQuery, setCompareProductQuery] = useState('');
    const [priceComparison, setPriceComparison] = useState<PriceComparison | null>(null);
    const [loadingComparison, setLoadingComparison] = useState(false);

    // États pour promotions
    const [promotions, setPromotions] = useState<SupermarketPromotion[]>([]);
    const [loadingPromotions, setLoadingPromotions] = useState(false);

    // Animation pour l'indicateur de tab
    const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
    const screenWidth = Dimensions.get('window').width;

    // Charger les supermarchés à l'ouverture
    useEffect(() => {
        loadSupermarkets();
    }, []);

    // ✅ Si un supermarché est passé en paramètre (depuis livraison ou BayamSelam), le sélectionner automatiquement
    useEffect(() => {
        const params = route.params as any;
        if (params?.supermarketId && supermarkets.length > 0) {
            const supermarket = supermarkets.find(s => s.id.toString() === params.supermarketId.toString());
            if (supermarket) {
                setSelectedSupermarket(supermarket);
                setViewMode('products');
                loadProducts(supermarket.id);
            }
        }
    }, [route.params, supermarkets]);

    const loadSupermarkets = useCallback(async () => {
        try {
            setLoadingSupermarkets(true);
            if (location?.coords) {
                const response = await supermarketService.listSupermarkets(
                    location.coords.latitude,
                    location.coords.longitude,
                    20
                );
                setSupermarkets(response.supermarkets);
            } else {
                Alert.alert('Localisation requise', 'Veuillez activer la localisation pour trouver les supermarchés à proximité');
            }
        } catch (err: any) {
            console.error('[SupermarketHomeScreen] Erreur chargement supermarchés:', err);
            Alert.alert('Erreur', 'Impossible de charger les supermarchés');
        } finally {
            setLoadingSupermarkets(false);
        }
    }, [location]);

    const loadProducts = useCallback(async (supermarketId: string | number) => {
        try {
            setLoadingProducts(true);
            const filters = {
                query: productSearchQuery.trim() || undefined,
                category: selectedCategory || undefined,
                on_promotion: showPromotionsOnly || undefined,
                page: 1,
                limit: 50,
            };
            const response = await supermarketService.getSupermarketProducts(supermarketId, filters);
            const r = response.data as any;
            if (response.success && r?.products) {
                setProducts(r.products);
            } else {
                setProducts([]);
            }

            // Charger les catégories
            const categoriesResponse = await supermarketService.getSupermarketCategories(supermarketId);
            const catR = categoriesResponse.data as any;
            if (categoriesResponse.success && catR?.categories) {
                setCategories(catR.categories);
            }
        } catch (err: any) {
            console.error('[SupermarketHomeScreen] Erreur chargement produits:', err);
            Alert.alert('Erreur', 'Impossible de charger les produits');
            setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    }, [productSearchQuery, selectedCategory, showPromotionsOnly]);

    const handleSelectSupermarket = (supermarket: Supermarket) => {
        hapticPress();
        setSelectedSupermarket(supermarket);
        setViewMode('products');
        loadProducts(supermarket.id);
    };

    const handleCompareProduct = async () => {
        if (!compareProductQuery.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un nom de produit');
            return;
        }

        hapticPress();
        setLoadingComparison(true);
        setPriceComparison(null);

        try {
            const response = await supermarketService.compareProductPrices(
                compareProductQuery.trim(),
                undefined,
                location?.coords?.latitude,
                location?.coords?.longitude,
                20
            );

            if (response.success && response.data?.comparison) {
                setPriceComparison(response.data.comparison);
                setViewMode('compare');
            } else {
                Alert.alert('Aucun résultat', 'Aucun produit trouvé avec ce nom dans les supermarchés à proximité');
            }
        } catch (err: any) {
            console.error('[SupermarketHomeScreen] Erreur comparaison:', err);
            Alert.alert('Erreur', 'Impossible de comparer les prix');
        } finally {
            setLoadingComparison(false);
        }
    };

    const loadPromotions = useCallback(async () => {
        try {
            setLoadingPromotions(true);
            if (selectedSupermarket) {
                const response = await supermarketService.getSupermarketPromotions(selectedSupermarket.id, true);
                if (response.success && response.data?.promotions) {
                    setPromotions(response.data.promotions);
                }
            } else if (location?.coords) {
                const response = await supermarketService.getNearbyPromotions(
                    location.coords.latitude,
                    location.coords.longitude,
                    20
                );
                if (response.success && response.data?.promotions) {
                    setPromotions(response.data.promotions);
                }
            }
        } catch (err: any) {
            console.error('[SupermarketHomeScreen] Erreur chargement promotions:', err);
        } finally {
            setLoadingPromotions(false);
        }
    }, [selectedSupermarket, location]);

    // ✅ NOUVEAU: Détection automatique de devise depuis GPS
    const detectedCurrency = useCurrencyDetection();

    const formatPrice = (price: number, currency?: string) => {
        const curr = currency || detectedCurrency; // ✅ Utilise la devise détectée si non fournie
        return `${price.toLocaleString()} ${curr}`;
    };

    const formatDistance = (distance?: number) => {
        if (!distance) return '';
        if (distance < 1) return `${Math.round(distance * 1000)}m`;
        return `${distance.toFixed(1)} km`;
    };

    // Animer l'indicateur de tab quand le mode change
    useEffect(() => {
        const currentTabs = selectedSupermarket ? TAB_ITEMS : TAB_ITEMS.filter(t => t.key === 'select');
        const tabIndex = currentTabs.findIndex(t => t.key === viewMode);
        Animated.spring(tabIndicatorAnim, {
            toValue: Math.max(tabIndex, 0),
            useNativeDriver: true,
            tension: 68,
            friction: 10,
        }).start();
    }, [viewMode, selectedSupermarket]);

    const switchMode = (mode: ViewMode) => {
        hapticPress();
        if (mode === 'select') {
            setViewMode('select');
        } else if (mode === 'products') {
            setViewMode('products');
            if (selectedSupermarket) loadProducts(selectedSupermarket.id);
        } else if (mode === 'compare') {
            setViewMode('compare');
            setCompareProductQuery('');
            setPriceComparison(null);
        } else if (mode === 'promotions') {
            setViewMode('promotions');
            loadPromotions();
        }
    };

    // Filtrer les supermarchés
    const filteredSupermarkets = supermarkets.filter(sm =>
        searchSupermarketQuery.trim() === '' ||
        sm.name.toLowerCase().includes(searchSupermarketQuery.toLowerCase()) ||
        sm.address.toLowerCase().includes(searchSupermarketQuery.toLowerCase())
    );

    // Les tabs disponibles (products/compare/promotions nécessitent un supermarché sélectionné)
    const availableTabs = selectedSupermarket ? TAB_ITEMS : TAB_ITEMS.filter(t => t.key === 'select');
    const tabWidth = screenWidth / Math.max(availableTabs.length, 1);
    // interpolate nécessite au minimum 2 valeurs dans inputRange
    const safeInputRange = availableTabs.length >= 2
        ? availableTabs.map((_, i) => i)
        : [0, 1];
    const safeOutputRange = availableTabs.length >= 2
        ? availableTabs.map((_, i) => i * tabWidth)
        : [0, tabWidth];
    const indicatorTranslateX = tabIndicatorAnim.interpolate({
        inputRange: safeInputRange,
        outputRange: safeOutputRange,
        extrapolate: 'clamp',
    });

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#10B981', '#34D399']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                if (viewMode === 'select' || !selectedSupermarket) {
                                    navigation.goBack();
                                } else {
                                    setViewMode('select');
                                    setSelectedSupermarket(null);
                                }
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>
                                {viewMode === 'select' ? (isBayamSelam ? 'BayamSelam' : t('supermarketHomeScreen.supermarches')) :
                                    viewMode === 'products' ? selectedSupermarket?.name || 'Produits' :
                                        viewMode === 'compare' ? 'Comparaison de prix' :
                                            'Promotions'}
                            </Text>
                            {viewMode === 'products' && selectedSupermarket && (
                                <Text style={styles.headerSubtitle}>
                                    {products.length} produit{products.length > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                        {selectedSupermarket && (
                            <TouchableOpacity
                                onPress={() => switchMode('select')}
                                style={styles.changeSupermarketButton}
                            >
                                <SafeIcon name="repeat" size={18} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Barre de recherche selon le mode */}
                    {viewMode === 'select' && (
                        <View style={styles.searchContainer}>
                            <View style={styles.searchBar}>
                                <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={t('supermarketHome.rechercherUnSupermarche')}
                                    placeholderTextColor="#9CA3AF"
                                    value={searchSupermarketQuery}
                                    onChangeText={setSearchSupermarketQuery}
                                />
                                {searchSupermarketQuery.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setSearchSupermarketQuery('')}
                                        style={styles.clearButton}
                                    >
                                        <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {viewMode === 'products' && selectedSupermarket && (
                        <View style={styles.searchContainer}>
                            <View style={styles.searchBar}>
                                <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={t('supermarketHome.rechercherUnProduit')}
                                    placeholderTextColor="#9CA3AF"
                                    value={productSearchQuery}
                                    onChangeText={(text) => {
                                        setProductSearchQuery(text);
                                        // Recherche en temps réel après 500ms
                                        setTimeout(() => {
                                            if (selectedSupermarket) {
                                                loadProducts(selectedSupermarket.id);
                                            }
                                        }, 500);
                                    }}
                                    returnKeyType="search"
                                />
                                {productSearchQuery.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setProductSearchQuery('');
                                            if (selectedSupermarket) {
                                                loadProducts(selectedSupermarket.id);
                                            }
                                        }}
                                        style={styles.clearButton}
                                    >
                                        <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {viewMode === 'compare' && (
                        <View style={styles.searchContainer}>
                            <View style={styles.searchBar}>
                                <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={t('supermarketHome.nomDuProduitAComparer')}
                                    placeholderTextColor="#9CA3AF"
                                    value={compareProductQuery}
                                    onChangeText={setCompareProductQuery}
                                    onSubmitEditing={handleCompareProduct}
                                    returnKeyType="search"
                                />
                                <TouchableOpacity
                                    onPress={handleCompareProduct}
                                    style={styles.compareButton}
                                    disabled={loadingComparison}
                                >
                                    {loadingComparison ? (
                                        <ActivityIndicator size="small" color="#10B981" />
                                    ) : (
                                        <SafeIcon name="git-compare" size={18} color="#10B981" type="lucide" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    {/* ✅ Tabs de navigation intégrés dans le header */}
                    {availableTabs.length > 1 && (
                        <View style={styles.tabBarContainer}>
                            <View style={styles.tabBar}>
                                <Animated.View
                                    style={[
                                        styles.tabIndicator,
                                        {
                                            width: tabWidth - 8,
                                            transform: [{ translateX: indicatorTranslateX }],
                                        },
                                    ]}
                                />
                                {availableTabs.map((tab) => {
                                    const isActive = viewMode === tab.key;
                                    const badgeCount = tab.key === 'promotions' ? promotions.length :
                                        tab.key === 'products' ? products.length :
                                            tab.key === 'select' ? supermarkets.length : 0;
                                    return (
                                        <TouchableOpacity
                                            key={tab.key}
                                            style={styles.tabItem}
                                            onPress={() => switchMode(tab.key)}
                                            activeOpacity={0.7}
                                        >
                                            <SafeIcon
                                                name={tab.icon}
                                                size={18}
                                                color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
                                                type="lucide"
                                            />
                                            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                                                {tab.label}
                                            </Text>
                                            {badgeCount > 0 && !isActive && (
                                                <View style={styles.tabBadge}>
                                                    <Text style={styles.tabBadgeText}>
                                                        {badgeCount > 99 ? '99+' : badgeCount}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </LinearGradient>
            </View>

            {/* Contenu selon le mode */}
            {viewMode === 'select' && (
                <SupermarketSelectionView
                    supermarkets={filteredSupermarkets}
                    loading={loadingSupermarkets}
                    onSelect={handleSelectSupermarket}
                    onRefresh={loadSupermarkets}
                    formatDistance={formatDistance}
                />
            )}

            {viewMode === 'products' && selectedSupermarket && (
                <ProductsView
                    supermarket={selectedSupermarket}
                    products={products}
                    loading={loadingProducts}
                    refreshing={refreshingProducts}
                    onRefresh={() => {
                        setRefreshingProducts(true);
                        loadProducts(selectedSupermarket.id);
                    }}
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onCategoryChange={(category) => {
                        setSelectedCategory(category);
                        loadProducts(selectedSupermarket.id);
                    }}
                    showPromotionsOnly={showPromotionsOnly}
                    onTogglePromotionsOnly={(value) => {
                        setShowPromotionsOnly(value);
                        loadProducts(selectedSupermarket.id);
                    }}
                    onCompareProduct={(productName) => {
                        setCompareProductQuery(productName);
                        handleCompareProduct();
                    }}
                    formatPrice={formatPrice}
                />
            )}

            {viewMode === 'compare' && (
                <PriceComparisonView
                    comparison={priceComparison}
                    loading={loadingComparison}
                    onSelectSupermarket={handleSelectSupermarket}
                    formatPrice={formatPrice}
                    formatDistance={formatDistance}
                />
            )}

            {viewMode === 'promotions' && (
                <PromotionsView
                    promotions={promotions}
                    loading={loadingPromotions}
                    selectedSupermarket={selectedSupermarket}
                    onRefresh={loadPromotions}
                    onSelectProduct={(product) => {
                        if (selectedSupermarket) {
                            setViewMode('products');
                            setProductSearchQuery(product.name);
                            loadProducts(selectedSupermarket.id);
                        }
                    }}
                    formatPrice={formatPrice}
                />
            )}
        </SafeNativeView>
    );
};

// Composant pour la sélection de supermarché
interface SupermarketSelectionViewProps {
    supermarkets: Supermarket[];
    loading: boolean;
    onSelect: (supermarket: Supermarket) => void;
    onRefresh: () => void;
    formatDistance: (distance?: number) => string;
}

const SupermarketSelectionView: React.FC<SupermarketSelectionViewProps> = ({
    supermarkets,
    loading,
    onSelect,
    onRefresh,
    formatDistance,
}) => {
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>{t('supermarketHome.rechercheDeSupermarches')}</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={supermarkets}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <SupermarketCard
                    supermarket={item}
                    onPress={() => onSelect(item)}
                    formatDistance={formatDistance}
                />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={onRefresh}
                    colors={['#10B981']}
                />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <SafeIcon name="shopping-bag" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>{t('supermarketHome.aucunSupermarcheTrouve')}</Text>
                    <Text style={styles.emptySubtext}>
                        Essayez d'activer votre localisation ou d'élargir la zone de recherche
                    </Text>
                </View>
            }
        />
    );
};

// Card pour un supermarché
interface SupermarketCardProps {
    supermarket: Supermarket;
    onPress: () => void;
    formatDistance: (distance?: number) => string;
}

const SupermarketCard: React.FC<SupermarketCardProps> = ({ supermarket, onPress, formatDistance }) => {
    return (
        <TouchableOpacity style={styles.supermarketCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.supermarketHeader}>
                <View style={styles.supermarketIconContainer}>
                    <SafeIcon name="store" size={32} color="#10B981" type="lucide" />
                </View>
                <View style={styles.supermarketInfo}>
                    <Text style={styles.supermarketName} numberOfLines={2}>
                        {supermarket.name}
                    </Text>
                    <View style={styles.supermarketMeta}>
                        <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.supermarketAddress} numberOfLines={1}>
                            {supermarket.address}
                        </Text>
                    </View>
                    {supermarket.distance_km && (
                        <View style={styles.supermarketMeta}>
                            <SafeIcon name="navigation" size={14} color="#6B7280" type="lucide" />
                            <Text style={styles.supermarketDistance}>
                                {formatDistance(supermarket.distance_km)}
                            </Text>
                        </View>
                    )}
                </View>
                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
            </View>
        </TouchableOpacity>
    );
};

// Composant pour l'affichage des produits
interface ProductsViewProps {
    supermarket: Supermarket;
    products: SupermarketProduct[];
    loading: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    categories: string[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    showPromotionsOnly: boolean;
    onTogglePromotionsOnly: (value: boolean) => void;
    onCompareProduct: (productName: string) => void;
    formatPrice: (price: number, currency?: string) => string;
}

const ProductsView: React.FC<ProductsViewProps> = ({
    supermarket,
    products,
    loading,
    refreshing,
    onRefresh,
    categories,
    selectedCategory,
    onCategoryChange,
    showPromotionsOnly,
    onTogglePromotionsOnly,
    onCompareProduct,
    formatPrice,
}) => {
    return (
        <View style={styles.productsContainer}>
            {/* Filtres */}
            {categories.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoriesScroll}
                    contentContainerStyle={styles.categoriesContainer}
                >
                    <TouchableOpacity
                        style={[styles.categoryChip, selectedCategory === '' && styles.categoryChipActive]}
                        onPress={() => onCategoryChange('')}
                    >
                        <Text style={[styles.categoryChipText, selectedCategory === '' && styles.categoryChipTextActive]}>
                            Tous
                        </Text>
                    </TouchableOpacity>
                    {categories.map((category) => (
                        <TouchableOpacity
                            key={category}
                            style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
                            onPress={() => onCategoryChange(category)}
                        >
                            <Text style={[styles.categoryChipText, selectedCategory === category && styles.categoryChipTextActive]}>
                                {category}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Toggle promotions */}
            <View style={styles.promotionsToggleContainer}>
                <TouchableOpacity
                    style={[styles.promotionsToggle, showPromotionsOnly && styles.promotionsToggleActive]}
                    onPress={() => onTogglePromotionsOnly(!showPromotionsOnly)}
                >
                    <SafeIcon name="tag" size={16} color={showPromotionsOnly ? '#FFFFFF' : '#10B981'} type="lucide" />
                    <Text style={[styles.promotionsToggleText, showPromotionsOnly && styles.promotionsToggleTextActive]}>
                        Promotions uniquement
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Liste des produits */}
            {loading && products.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.loadingText}>{t('supermarketHome.chargementDesProduits')}</Text>
                </View>
            ) : (
                <FlatList
                    data={products}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ProductCard
                            product={item}
                            onCompare={() => onCompareProduct(item.name)}
                            formatPrice={formatPrice}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#10B981']}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="package" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>{t('supermarketHome.aucunProduitTrouve')}</Text>
                            <Text style={styles.emptySubtext}>
                                Essayez de modifier vos filtres de recherche
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

// Card pour un produit
interface ProductCardProps {
    product: SupermarketProduct;
    onCompare: () => void;
    formatPrice: (price: number, currency?: string) => string;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onCompare, formatPrice }) => {
    return (
        <View style={styles.productCard}>
            {product.image_url && (
                <View style={styles.productImageContainer}>
                    {/* TODO: Utiliser Image component pour afficher l'image */}
                    <SafeIcon name="package" size={48} color="#10B981" type="lucide" />
                </View>
            )}
            <View style={styles.productInfo}>
                <View style={styles.productHeader}>
                    <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                    </Text>
                    {product.is_promotion && (
                        <View style={styles.promotionBadge}>
                            <SafeIcon name="tag" size={12} color="#FFFFFF" type="lucide" />
                            <Text style={styles.promotionBadgeText}>
                                -{product.promotion_percentage || 0}%
                            </Text>
                        </View>
                    )}
                </View>
                {product.brand && (
                    <Text style={styles.productBrand}>{product.brand}</Text>
                )}
                {product.description && (
                    <Text style={styles.productDescription} numberOfLines={2}>
                        {product.description}
                    </Text>
                )}
                <View style={styles.productPricing}>
                    {product.is_promotion && product.original_price && (
                        <Text style={styles.productOriginalPrice}>
                            {formatPrice(product.original_price, product.currency)}
                        </Text>
                    )}
                    <Text style={[styles.productPrice, product.is_promotion && styles.productPricePromo]}>
                        {formatPrice(product.price, product.currency)}
                    </Text>
                    {product.unit && (
                        <Text style={styles.productUnit}> / {product.unit}</Text>
                    )}
                </View>
                <View style={styles.productActions}>
                    <TouchableOpacity
                        style={styles.compareButton}
                        onPress={onCompare}
                    >
                        <SafeIcon name="git-compare" size={14} color="#10B981" type="lucide" />
                        <Text style={styles.compareButtonText}>Comparer</Text>
                    </TouchableOpacity>
                    {product.stock_status === 'out_of_stock' && (
                        <View style={styles.outOfStockBadge}>
                            <Text style={styles.outOfStockText}>Rupture de stock</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

// Composant pour la comparaison de prix
interface PriceComparisonViewProps {
    comparison: PriceComparison | null;
    loading: boolean;
    onSelectSupermarket: (supermarket: Supermarket) => void;
    formatPrice: (price: number, currency?: string) => string;
    formatDistance: (distance?: number) => string;
}

const PriceComparisonView: React.FC<PriceComparisonViewProps> = ({
    comparison,
    loading,
    onSelectSupermarket,
    formatPrice,
    formatDistance,
}) => {
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Comparaison en cours...</Text>
            </View>
        );
    }

    if (!comparison) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="git-compare" size={64} color="#9CA3AF" />
                <Text style={styles.emptyText}>Recherchez un produit pour comparer</Text>
                <Text style={styles.emptySubtext}>
                    Entrez le nom d'un produit dans la barre de recherche ci-dessus
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.comparisonContainer} contentContainerStyle={styles.comparisonContent}>
            <View style={styles.comparisonHeader}>
                <Text style={styles.comparisonProductName}>{comparison.product_name}</Text>
                <Text style={styles.comparisonCategory}>{comparison.category}</Text>
            </View>

            <View style={styles.comparisonStats}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Prix moyen</Text>
                    <Text style={styles.statValue}>{formatPrice(comparison.average_price)}</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Fourchette</Text>
                    <Text style={styles.statValue}>
                        {formatPrice(comparison.price_range.min)} - {formatPrice(comparison.price_range.max)}
                    </Text>
                </View>
            </View>

            <Text style={styles.comparisonSectionTitle}>
                Meilleur prix: {comparison.cheapest.supermarket_name}
            </Text>

            <View style={styles.comparisonList}>
                {comparison.supermarkets.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.comparisonItem,
                            item.supermarket_id === comparison.cheapest.supermarket_id && styles.comparisonItemCheapest,
                        ]}
                        onPress={() => {
                            // Créer un objet Supermarket depuis les données
                            const supermarket: Supermarket = {
                                id: item.supermarket_id,
                                name: item.supermarket_name,
                                address: '',
                                latitude: 0,
                                longitude: 0,
                            };
                            onSelectSupermarket(supermarket);
                        }}
                    >
                        <View style={styles.comparisonItemHeader}>
                            <Text style={styles.comparisonItemName}>{item.supermarket_name}</Text>
                            {item.supermarket_id === comparison.cheapest.supermarket_id && (
                                <View style={styles.cheapestBadge}>
                                    <SafeIcon name="award" size={14} color="#FFFFFF" type="lucide" />
                                    <Text style={styles.cheapestBadgeText}>Meilleur prix</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.comparisonItemPricing}>
                            <Text style={styles.comparisonItemPrice}>
                                {formatPrice(item.product.price, item.product.currency)}
                            </Text>
                            {item.product.unit && (
                                <Text style={styles.comparisonItemUnit}> / {item.product.unit}</Text>
                            )}
                        </View>
                        {item.distance_km && (
                            <Text style={styles.comparisonItemDistance}>
                                À {formatDistance(item.distance_km)}
                            </Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
};

// Composant pour les promotions
interface PromotionsViewProps {
    promotions: SupermarketPromotion[];
    loading: boolean;
    selectedSupermarket: Supermarket | null;
    onRefresh: () => void;
    onSelectProduct: (product: SupermarketProduct) => void;
    formatPrice: (price: number, currency?: string) => string;
}

const PromotionsView: React.FC<PromotionsViewProps> = ({
    promotions,
    loading,
    selectedSupermarket,
    onRefresh,
    onSelectProduct,
    formatPrice,
}) => {
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>{t('supermarketHome.chargementDesPromotions')}</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={promotions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <PromotionCard
                    promotion={item}
                    onSelectProduct={onSelectProduct}
                    formatPrice={formatPrice}
                />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={onRefresh}
                    colors={['#10B981']}
                />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <SafeIcon name="tag" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>{t('supermarketHome.aucunePromotionDisponible')}</Text>
                    <Text style={styles.emptySubtext}>
                        {selectedSupermarket
                            ? `Aucune promotion active pour ${selectedSupermarket.name}`
                            : t('supermarketHomeScreen.aucunePromotionDansLesSupermarchesA')}
                    </Text>
                </View>
            }
        />
    );
};

// Card pour une promotion
interface PromotionCardProps {
    promotion: SupermarketPromotion;
    onSelectProduct: (product: SupermarketProduct) => void;
    formatPrice: (price: number, currency?: string) => string;
}

const PromotionCard: React.FC<PromotionCardProps> = ({ promotion, onSelectProduct, formatPrice }) => {
    return (
        <View style={styles.promotionCard}>
            <View style={styles.promotionHeader}>
                <View style={styles.promotionIconContainer}>
                    <SafeIcon name="tag" size={24} color="#EF4444" type="lucide" />
                </View>
                <View style={styles.promotionInfo}>
                    <Text style={styles.promotionTitle}>{promotion.title}</Text>
                    <Text style={styles.promotionSupermarket}>{promotion.supermarket_name}</Text>
                    {promotion.discount_percentage && (
                        <Text style={styles.promotionDiscount}>
                            -{promotion.discount_percentage}% de réduction
                        </Text>
                    )}
                    <Text style={styles.promotionDates}>
                        Jusqu'au {new Date(promotion.end_date).toLocaleDateString('fr-FR')}
                    </Text>
                </View>
            </View>
            {promotion.description && (
                <Text style={styles.promotionDescription}>{promotion.description}</Text>
            )}
            {promotion.products.length > 0 && (
                <View style={styles.promotionProducts}>
                    <Text style={styles.promotionProductsTitle}>
                        {promotion.products.length} produit{promotion.products.length > 1 ? 's' : ''} en promotion
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {promotion.products.slice(0, 5).map((product) => (
                            <TouchableOpacity
                                key={product.id}
                                style={styles.promotionProductItem}
                                onPress={() => onSelectProduct(product)}
                            >
                                <Text style={styles.promotionProductName} numberOfLines={1}>
                                    {product.name}
                                </Text>
                                <View style={styles.promotionProductPricing}>
                                    {product.original_price && (
                                        <Text style={styles.promotionProductOriginalPrice}>
                                            {formatPrice(product.original_price, product.currency)}
                                        </Text>
                                    )}
                                    <Text style={styles.promotionProductPrice}>
                                        {formatPrice(product.price, product.currency)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 2,
    },
    changeSupermarketButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabBarContainer: {
        marginTop: 12,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        borderRadius: 14,
        padding: 4,
        position: 'relative',
    },
    tabIndicator: {
        position: 'absolute',
        top: 4,
        left: 4,
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 10,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 5,
        zIndex: 1,
    },
    tabBadge: {
        backgroundColor: '#FBBF24',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginLeft: 2,
    },
    tabBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#111827',
    },
    searchContainer: {
        marginTop: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearButton: {
        padding: 4,
    },
    compareButton: {
        padding: 8,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    // Supermarket Card
    supermarketCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    supermarketHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    supermarketIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#D1FAE5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    supermarketInfo: {
        flex: 1,
    },
    supermarketName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    supermarketMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    supermarketAddress: {
        fontSize: 12,
        color: '#6B7280',
        flex: 1,
    },
    supermarketDistance: {
        fontSize: 12,
        color: '#6B7280',
    },
    // Products View
    productsContainer: {
        flex: 1,
    },
    categoriesScroll: {
        maxHeight: 50,
    },
    categoriesContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    categoryChipActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    categoryChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    categoryChipTextActive: {
        color: '#FFFFFF',
    },
    promotionsToggleContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    promotionsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: '#10B981',
        gap: 8,
        alignSelf: 'flex-start',
    },
    promotionsToggleActive: {
        backgroundColor: '#10B981',
    },
    promotionsToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    promotionsToggleTextActive: {
        color: '#FFFFFF',
    },
    // Product Card
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    productImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    productInfo: {
        flex: 1,
    },
    productHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 4,
        gap: 8,
    },
    productName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    promotionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    promotionBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    productBrand: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    productDescription: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 8,
    },
    productPricing: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    productOriginalPrice: {
        fontSize: 14,
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    productPrice: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10B981',
    },
    productPricePromo: {
        color: '#EF4444',
    },
    productUnit: {
        fontSize: 12,
        color: '#6B7280',
    },
    productActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    compareButtonLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        gap: 6,
    },
    compareButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
    },
    outOfStockBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#FEE2E2',
    },
    outOfStockText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#991B1B',
    },
    // Comparison View
    comparisonContainer: {
        flex: 1,
    },
    comparisonContent: {
        padding: 16,
    },
    comparisonHeader: {
        marginBottom: 20,
    },
    comparisonProductName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    comparisonCategory: {
        fontSize: 14,
        color: '#6B7280',
    },
    comparisonStats: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    comparisonSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    comparisonList: {
        gap: 12,
    },
    comparisonItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    comparisonItemCheapest: {
        borderColor: '#10B981',
        backgroundColor: '#F0FDF4',
    },
    comparisonItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    comparisonItemName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    cheapestBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    cheapestBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    comparisonItemPricing: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    comparisonItemPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10B981',
    },
    comparisonItemUnit: {
        fontSize: 14,
        color: '#6B7280',
    },
    comparisonItemDistance: {
        fontSize: 12,
        color: '#6B7280',
    },
    // Promotions View
    promotionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#FEE2E2',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    promotionHeader: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    promotionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    promotionInfo: {
        flex: 1,
    },
    promotionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    promotionSupermarket: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    promotionDiscount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
        marginBottom: 4,
    },
    promotionDates: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    promotionDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
        lineHeight: 20,
    },
    promotionProducts: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    promotionProductsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    promotionProductItem: {
        width: 120,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        marginRight: 8,
    },
    promotionProductName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    promotionProductPricing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    promotionProductOriginalPrice: {
        fontSize: 10,
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    promotionProductPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#EF4444',
    },
    // Tab labels (in header)
    tabLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
    },
    tabLabelActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default SupermarketHomeScreen;

