// ✅ Écran Résultats BayamSelam - Comparaison de prix avec livraison, panier, tendances et promotions
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { PriceComparison, Supermarket, SupermarketProduct, SupermarketPromotion, supermarketService } from '../../services/supermarketService';
import { hapticPress } from '../../utils/hapticFeedback';

type ViewMode = 'results' | 'compare' | 'trends' | 'promotions';

interface SearchFilters {
    produit?: string;
    categorie?: string;
    ville?: string;
    quartier?: string;
    marche?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    prix_min?: number;
    prix_max?: number;
}

const BayamSelamResultsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location } = useLocation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const detectedCurrency = useCurrencyDetection();

    const filters = (route.params as any)?.filters as SearchFilters || {};
    const [viewMode, setViewMode] = useState<ViewMode>('results');

    // États pour résultats
    const [products, setProducts] = useState<Array<SupermarketProduct & { distance_km?: number }>>([]);
    const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // États pour comparaison
    const [compareQuery, setCompareQuery] = useState(filters.produit || '');
    const [priceComparison, setPriceComparison] = useState<PriceComparison | null>(null);
    const [loadingComparison, setLoadingComparison] = useState(false);

    // États pour tendances
    const [trendingProducts, setTrendingProducts] = useState<SupermarketProduct[]>([]);
    const [loadingTrends, setLoadingTrends] = useState(false);

    // États pour promotions
    const [promotions, setPromotions] = useState<SupermarketPromotion[]>([]);
    const [loadingPromotions, setLoadingPromotions] = useState(false);

    // États pour panier
    const [cartItems, setCartItems] = useState<Array<{ product: SupermarketProduct; quantity: number }>>([]);
    const [showCart, setShowCart] = useState(false);

    useEffect(() => {
        loadResults();
        loadTrends();
        loadPromotions();
    }, []);

    // Fonction pour calculer la distance entre deux points GPS
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const loadResults = useCallback(async () => {
        try {
            setLoading(true);

            // Charger les supermarchés à proximité
            if (location?.coords) {
                const userLat = filters.gps_lat || location.coords.latitude;
                const userLng = filters.gps_lon || location.coords.longitude;

                const supermarketsResponse = await supermarketService.listSupermarkets(
                    userLat,
                    userLng,
                    filters.rayon_km || 20
                );
                setSupermarkets(supermarketsResponse.supermarkets || []);

                // Charger les produits de chaque supermarché
                const allProducts: Array<SupermarketProduct & { distance_km?: number }> = [];
                for (const supermarket of supermarketsResponse.supermarkets || []) {
                    try {
                        const productsResponse = await supermarketService.getSupermarketProducts(supermarket.id, {
                            query: filters.produit,
                            category: filters.categorie,
                            min_price: filters.prix_min,
                            max_price: filters.prix_max,
                            page: 1,
                            limit: 20,
                        });
                        if (productsResponse.success && productsResponse.data?.products) {
                            // ✅ Ajouter la distance du supermarché aux produits
                            const productsWithDistance = productsResponse.data.products.map((product: SupermarketProduct) => ({
                                ...product,
                                distance_km: supermarket.distance_km,
                            }));
                            allProducts.push(...productsWithDistance);
                        }
                    } catch (err) {
                        console.error(`[BayamSelamResults] Erreur chargement produits ${supermarket.id}:`, err);
                    }
                }

                // Filtrer et trier par prix
                let filteredProducts = allProducts;
                if (filters.prix_min) {
                    filteredProducts = filteredProducts.filter(p => p.price >= filters.prix_min!);
                }
                if (filters.prix_max) {
                    filteredProducts = filteredProducts.filter(p => p.price <= filters.prix_max!);
                }

                // Grouper par produit et garder le meilleur prix
                const productMap = new Map<string, SupermarketProduct & { distance_km?: number }>();
                filteredProducts.forEach(product => {
                    const key = product.name.toLowerCase().trim();
                    const existing = productMap.get(key);
                    if (!existing || product.price < existing.price) {
                        productMap.set(key, product);
                    }
                });

                setProducts(Array.from(productMap.values()).sort((a, b) => a.price - b.price));
            }
        } catch (err: any) {
            console.error('[BayamSelamResults] Erreur chargement résultats:', err);
            Alert.alert(t('message.error'), t('bayamSelam.cannotLoadResults'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters, location]);

    const loadTrends = useCallback(async () => {
        try {
            setLoadingTrends(true);
            if (location?.coords) {
                // ✅ Utiliser le service de tendances si disponible, sinon fallback
                try {
                    const response = await supermarketService.getTrendingProducts(
                        location.coords.latitude,
                        location.coords.longitude,
                        20
                    );
                    if (response.success && response.data?.products) {
                        setTrendingProducts(response.data.products);
                        return;
                    }
                } catch (err) {
                    console.warn('[BayamSelamResults] Service tendances non disponible, fallback...');
                }

                // Fallback: Charger les produits les plus recherchés/vendus
                const supermarketsResponse = await supermarketService.listSupermarkets(
                    location.coords.latitude,
                    location.coords.longitude,
                    20
                );

                const allTrendingProducts: SupermarketProduct[] = [];
                for (const supermarket of supermarketsResponse.supermarkets?.slice(0, 5) || []) {
                    try {
                        const productsResponse = await supermarketService.getSupermarketProducts(supermarket.id, {
                            on_promotion: true, // Les promotions sont souvent tendances
                            page: 1,
                            limit: 10,
                        });
                        if (productsResponse.success && productsResponse.data?.products) {
                            allTrendingProducts.push(...productsResponse.data.products);
                        }
                    } catch (err) {
                        console.error(`[BayamSelamResults] Erreur chargement tendances ${supermarket.id}:`, err);
                    }
                }

                // Trier par popularité (promotions d'abord, puis prix)
                setTrendingProducts(
                    allTrendingProducts
                        .sort((a, b) => {
                            if (a.is_promotion && !b.is_promotion) return -1;
                            if (!a.is_promotion && b.is_promotion) return 1;
                            return a.price - b.price;
                        })
                        .slice(0, 20)
                );
            }
        } catch (err: any) {
            console.error('[BayamSelamResults] Erreur chargement tendances:', err);
        } finally {
            setLoadingTrends(false);
        }
    }, [location]);

    const loadPromotions = useCallback(async () => {
        try {
            setLoadingPromotions(true);
            if (location?.coords) {
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
            console.error('[BayamSelamResults] Erreur chargement promotions:', err);
        } finally {
            setLoadingPromotions(false);
        }
    }, [location]);

    const handleCompareProduct = async () => {
        if (!compareQuery.trim()) {
            Alert.alert(t('message.error'), t('bayamSelam.enterProductName'));
            return;
        }

        hapticPress();
        setLoadingComparison(true);
        setPriceComparison(null);

        try {
            const response = await supermarketService.compareProductPrices(
                compareQuery.trim(),
                undefined,
                location?.coords?.latitude,
                location?.coords?.longitude,
                20
            );

            if (response.success && response.data?.comparison) {
                setPriceComparison(response.data.comparison);
                setViewMode('compare');
            } else {
                Alert.alert(t('bayamSelam.noResult'), t('bayamSelam.noProductFound'));
            }
        } catch (err: any) {
            console.error('[BayamSelamResults] Erreur comparaison:', err);
            Alert.alert(t('message.error'), t('bayamSelam.cannotComparePrices'));
        } finally {
            setLoadingComparison(false);
        }
    };

    const addToCart = (product: SupermarketProduct) => {
        hapticPress();
        setCartItems(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
        Alert.alert(t('bayamSelam.addedToCart'), t('bayamSelam.productAddedToCart', { name: product.name }));
    };

    const removeFromCart = (productId: string) => {
        hapticPress();
        setCartItems(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateCartQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCartItems(prev =>
            prev.map(item =>
                item.product.id === productId ? { ...item, quantity } : item
            )
        );
    };

    const getCartTotal = () => {
        return cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);
    };

    const handleDelivery = () => {
        if (cartItems.length === 0) {
            Alert.alert(t('bayamSelam.emptyCart'), t('bayamSelam.addProductsFirst'));
            return;
        }

        if (!user) {
            Alert.alert(t('bayamSelam.loginRequired'), t('bayamSelam.loginToOrder'), [
                { text: t('common.cancel') },
                { text: t('common.login'), onPress: () => navigation.navigate('Login' as never) },
            ]);
            return;
        }

        hapticPress();
        // ✅ Naviguer vers le flux de livraison intelligent avec les produits du panier
        navigation.navigate('DeliveryShoppingFlowNew' as never, {
            cartItems: cartItems.map(item => ({
                name: item.product.name,
                quantity: item.quantity,
                price: item.product.price,
                supermarket_id: item.product.supermarket_id,
                supermarket_name: item.product.supermarket_name,
            })),
            fromBayamSelam: true,
        } as never);
    };

    const formatPrice = (price: number, currency?: string) => {
        const curr = currency || detectedCurrency;
        return `${price.toLocaleString()} ${curr}`;
    };

    const formatDistance = (distance?: number) => {
        if (!distance) return '';
        if (distance < 1) return `${Math.round(distance * 1000)}m`;
        return `${distance.toFixed(1)} km`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#F97316', '#FB923C']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>{t('bayamSelamResults.resultatsBayamselam')}</Text>
                            <Text style={styles.headerSubtitle}>
                                {products.length} produit{products.length > 1 ? 's' : ''} trouvé{products.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                setShowCart(!showCart);
                            }}
                            style={styles.cartButton}
                        >
                            <SafeIcon name="shopping-cart" size={24} color="#FFFFFF" type="lucide" />
                            {cartItems.length > 0 && (
                                <View style={styles.cartBadge}>
                                    <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche comparaison */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Comparer un produit..."
                                placeholderTextColor="#9CA3AF"
                                value={compareQuery}
                                onChangeText={setCompareQuery}
                                onSubmitEditing={handleCompareProduct}
                                returnKeyType="search"
                            />
                            <TouchableOpacity
                                onPress={handleCompareProduct}
                                style={styles.compareButton}
                                disabled={loadingComparison}
                            >
                                {loadingComparison ? (
                                    <ActivityIndicator size="small" color="#F97316" />
                                ) : (
                                    <SafeIcon name="git-compare" size={18} color="#F97316" type="lucide" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Onglets */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'results' && styles.tabActive]}
                        onPress={() => {
                            hapticPress();
                            setViewMode('results');
                        }}
                    >
                        <SafeIcon name="list" size={18} color={viewMode === 'results' ? '#F97316' : '#6B7280'} type="lucide" />
                        <Text style={[styles.tabLabel, viewMode === 'results' && styles.tabLabelActive]}>
                            Résultats
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'compare' && styles.tabActive]}
                        onPress={() => {
                            hapticPress();
                            setViewMode('compare');
                        }}
                    >
                        <SafeIcon name="git-compare" size={18} color={viewMode === 'compare' ? '#F97316' : '#6B7280'} type="lucide" />
                        <Text style={[styles.tabLabel, viewMode === 'compare' && styles.tabLabelActive]}>
                            Comparer
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'trends' && styles.tabActive]}
                        onPress={() => {
                            hapticPress();
                            setViewMode('trends');
                        }}
                    >
                        <SafeIcon name="trending-up" size={18} color={viewMode === 'trends' ? '#F97316' : '#6B7280'} type="lucide" />
                        <Text style={[styles.tabLabel, viewMode === 'trends' && styles.tabLabelActive]}>
                            Tendances
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'promotions' && styles.tabActive]}
                        onPress={() => {
                            hapticPress();
                            setViewMode('promotions');
                        }}
                    >
                        <SafeIcon name="tag" size={18} color={viewMode === 'promotions' ? '#F97316' : '#6B7280'} type="lucide" />
                        <Text style={[styles.tabLabel, viewMode === 'promotions' && styles.tabLabelActive]}>
                            Promotions
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Contenu selon le mode */}
            {viewMode === 'results' && (
                <ResultsView
                    products={products}
                    loading={loading}
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        loadResults();
                    }}
                    onAddToCart={addToCart}
                    formatPrice={formatPrice}
                />
            )}

            {viewMode === 'compare' && (
                <CompareView
                    comparison={priceComparison}
                    loading={loadingComparison}
                    compareQuery={compareQuery}
                    onCompare={handleCompareProduct}
                    formatPrice={formatPrice}
                    formatDistance={formatDistance}
                />
            )}

            {viewMode === 'trends' && (
                <TrendsView
                    trendingProducts={trendingProducts}
                    loading={loadingTrends}
                    onRefresh={loadTrends}
                    onAddToCart={addToCart}
                    formatPrice={formatPrice}
                />
            )}

            {viewMode === 'promotions' && (
                <PromotionsView
                    promotions={promotions}
                    loading={loadingPromotions}
                    onRefresh={loadPromotions}
                    onAddToCart={addToCart}
                    formatPrice={formatPrice}
                />
            )}

            {/* Panier flottant */}
            {showCart && (
                <CartModal
                    cartItems={cartItems}
                    onClose={() => setShowCart(false)}
                    onRemove={removeFromCart}
                    onUpdateQuantity={updateCartQuantity}
                    onDelivery={handleDelivery}
                    formatPrice={formatPrice}
                    total={getCartTotal()}
                />
            )}
        </SafeNativeView>
    );
};

// Composant pour les résultats
interface ResultsViewProps {
    products: Array<SupermarketProduct & { distance_km?: number }>;
    loading: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onAddToCart: (product: SupermarketProduct) => void;
    formatPrice: (price: number, currency?: string) => string;
}

const ResultsView: React.FC<ResultsViewProps> = ({
    products,
    loading,
    refreshing,
    onRefresh,
    onAddToCart,
    formatPrice,
}) => {
    if (loading && products.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={styles.loadingText}>{t('bayamSelamResults.rechercheEnCours')}/Text>
            </View>
        );
    }

    return (
        <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <ProductCard
                    product={item}
                    onAddToCart={() => onAddToCart(item)}
                    formatPrice={formatPrice}
                />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#F97316']}
                />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <SafeIcon name="package" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>{t('bayamSelamResults.aucunProduitTrouve')}</Text>
                    <Text style={styles.emptySubtext}>
                        Essayez de modifier vos critères de recherche
                    </Text>
                </View>
            }
        />
    );
};

// Composant pour la comparaison
interface CompareViewProps {
    comparison: PriceComparison | null;
    loading: boolean;
    compareQuery: string;
    onCompare: () => void;
    formatPrice: (price: number, currency?: string) => string;
    formatDistance: (distance?: number) => string;
}

const CompareView: React.FC<CompareViewProps> = ({
    comparison,
    loading,
    compareQuery,
    onCompare,
    formatPrice,
    formatDistance,
}) => {
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
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
                    <View
                        key={index}
                        style={[
                            styles.comparisonItem,
                            item.supermarket_id === comparison.cheapest.supermarket_id && styles.comparisonItemCheapest,
                        ]}
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
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

// Composant pour les tendances
interface TrendsViewProps {
    trendingProducts: SupermarketProduct[];
    loading: boolean;
    onRefresh: () => void;
    onAddToCart: (product: SupermarketProduct) => void;
    formatPrice: (price: number, currency?: string) => string;
}

const TrendsView: React.FC<TrendsViewProps> = ({
    trendingProducts,
    loading,
    onRefresh,
    onAddToCart,
    formatPrice,
}) => {
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={styles.loadingText}>{t('bayamSelamResults.chargementDesTendances')}</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={trendingProducts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <ProductCard
                    product={item}
                    onAddToCart={() => onAddToCart(item)}
                    formatPrice={formatPrice}
                    showTrendingBadge
                />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={onRefresh}
                    colors={['#F97316']}
                />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <SafeIcon name="trending-up" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>{t('bayamSelamResults.aucuneTendanceDisponible')}</Text>
                </View>
            }
        />
    );
};

// Composant pour les promotions
interface PromotionsViewProps {
    promotions: SupermarketPromotion[];
    loading: boolean;
    onRefresh: () => void;
    onAddToCart: (product: SupermarketProduct) => void;
    formatPrice: (price: number, currency?: string) => string;
}

const PromotionsView: React.FC<PromotionsViewProps> = ({
    promotions,
    loading,
    onRefresh,
    onAddToCart,
    formatPrice,
}) => {
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={styles.loadingText}>{t('bayamSelamResults.chargementDesPromotions')}</Text>
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
                    onAddToCart={onAddToCart}
                    formatPrice={formatPrice}
                />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl
                    refreshing={loading}
                    onRefresh={onRefresh}
                    colors={['#F97316']}
                />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <SafeIcon name="tag" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>{t('bayamSelamResults.aucunePromotionDisponible')}</Text>
                </View>
            }
        />
    );
};

// Card produit
interface ProductCardProps {
    product: SupermarketProduct & { distance_km?: number };
    onAddToCart: () => void;
    formatPrice: (price: number, currency?: string) => string;
    showTrendingBadge?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, formatPrice, showTrendingBadge }) => {
    return (
        <View style={styles.productCard}>
            {product.image_url && (
                <View style={styles.productImageContainer}>
                    <SafeIcon name="package" size={48} color="#F97316" type="lucide" />
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
                    {showTrendingBadge && (
                        <View style={styles.trendingBadge}>
                            <SafeIcon name="trending-up" size={12} color="#FFFFFF" type="lucide" />
                            <Text style={styles.trendingBadgeText}>Tendance</Text>
                        </View>
                    )}
                </View>
                {product.brand && (
                    <Text style={styles.productBrand}>{product.brand}</Text>
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
                <View style={styles.productMeta}>
                    <Text style={styles.productSupermarket}>{product.supermarket_name}</Text>
                    {product.distance_km && (
                        <Text style={styles.productDistance}>• {product.distance_km.toFixed(1)} km</Text>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.addToCartButton}
                    onPress={onAddToCart}
                    activeOpacity={0.7}
                >
                    <SafeIcon name="shopping-cart" size={16} color="#FFFFFF" type="lucide" />
                    <Text style={styles.addToCartButtonText}>{t('bayamSelamResultsScreen.ajouter')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// Card promotion
interface PromotionCardProps {
    promotion: SupermarketPromotion;
    onAddToCart: (product: SupermarketProduct) => void;
    formatPrice: (price: number, currency?: string) => string;
}

const PromotionCard: React.FC<PromotionCardProps> = ({ promotion, onAddToCart, formatPrice }) => {
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
                                onPress={() => onAddToCart(product)}
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

// Modal panier
interface CartModalProps {
    cartItems: Array<{ product: SupermarketProduct; quantity: number }>;
    onClose: () => void;
    onRemove: (productId: string) => void;
    onUpdateQuantity: (productId: string, quantity: number) => void;
    onDelivery: () => void;
    formatPrice: (price: number, currency?: string) => string;
    total: number;
}

const CartModal: React.FC<CartModalProps> = ({
    cartItems,
    onClose,
    onRemove,
    onUpdateQuantity,
    onDelivery,
    formatPrice,
    total,
}) => {
    return (
        <View style={styles.cartModalOverlay}>
            <View style={styles.cartModal}>
                <View style={styles.cartModalHeader}>
                    <Text style={styles.cartModalTitle}>{t('bayamSelamResults.monPanier')}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.cartModalClose}>
                        <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.cartModalContent}>
                    {cartItems.length === 0 ? (
                        <View style={styles.cartEmpty}>
                            <SafeIcon name="shopping-cart" size={64} color="#9CA3AF" />
                            <Text style={styles.cartEmptyText}>{t('bayamSelamResults.votrePanierEstVide')}</Text>
                        </View>
                    ) : (
                        cartItems.map((item) => (
                            <View key={item.product.id} style={styles.cartItem}>
                                <View style={styles.cartItemInfo}>
                                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                                    <Text style={styles.cartItemPrice}>
                                        {formatPrice(item.product.price, item.product.currency)}
                                    </Text>
                                </View>
                                <View style={styles.cartItemActions}>
                                    <TouchableOpacity
                                        style={styles.cartQuantityButton}
                                        onPress={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                    >
                                        <SafeIcon name="minus" size={16} color="#F97316" type="lucide" />
                                    </TouchableOpacity>
                                    <Text style={styles.cartQuantity}>{item.quantity}</Text>
                                    <TouchableOpacity
                                        style={styles.cartQuantityButton}
                                        onPress={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                    >
                                        <SafeIcon name="plus" size={16} color="#F97316" type="lucide" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cartRemoveButton}
                                        onPress={() => onRemove(item.product.id)}
                                    >
                                        <SafeIcon name="trash" size={16} color="#EF4444" type="lucide" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
                {cartItems.length > 0 && (
                    <View style={styles.cartModalFooter}>
                        <View style={styles.cartTotal}>
                            <Text style={styles.cartTotalLabel}>Total</Text>
                            <Text style={styles.cartTotalValue}>{formatPrice(total)}</Text>
                        </View>
                        <NativeButton
                            title="Commander avec livraison"
                            onPress={onDelivery}
                            variant="primary"
                            style={styles.cartDeliveryButton}
                        />
                    </View>
                )}
            </View>
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
    cartButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    cartBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
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
    compareButton: {
        padding: 4,
    },
    tabsContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabsScroll: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        gap: 6,
    },
    tabActive: {
        backgroundColor: '#FED7AA',
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabLabelActive: {
        color: '#F97316',
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
        flexWrap: 'wrap',
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
    trendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    trendingBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    productBrand: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
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
        color: '#F97316',
    },
    productPricePromo: {
        color: '#EF4444',
    },
    productUnit: {
        fontSize: 12,
        color: '#6B7280',
    },
    productMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    productSupermarket: {
        fontSize: 12,
        color: '#6B7280',
    },
    productDistance: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    addToCartButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F97316',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 6,
        alignSelf: 'flex-start',
    },
    addToCartButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
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
        borderColor: '#F97316',
        backgroundColor: '#FFF7ED',
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
        backgroundColor: '#F97316',
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
        color: '#F97316',
    },
    comparisonItemUnit: {
        fontSize: 14,
        color: '#6B7280',
    },
    comparisonItemDistance: {
        fontSize: 12,
        color: '#6B7280',
    },
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
    cartModalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    cartModal: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    cartModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    cartModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    cartModalClose: {
        padding: 4,
    },
    cartModalContent: {
        maxHeight: 400,
    },
    cartEmpty: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartEmptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    cartItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    cartItemInfo: {
        flex: 1,
        marginRight: 12,
    },
    cartItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    cartItemPrice: {
        fontSize: 14,
        color: '#6B7280',
    },
    cartItemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cartQuantityButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FED7AA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartQuantity: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        minWidth: 30,
        textAlign: 'center',
    },
    cartRemoveButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartModalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    cartTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cartTotalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    cartTotalValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#F97316',
    },
    cartDeliveryButton: {
        borderRadius: 12,
    },
});

export default BayamSelamResultsScreen;

