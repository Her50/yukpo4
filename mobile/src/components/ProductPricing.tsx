import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card } from 'react-native-paper';
import { theme } from '../theme/theme';

interface Product {
    id: string;
    name: string;
    price: string;
    currency: string;
    images?: string[];
    videos?: string[];
}

interface ProductPricingProps {
    products: Product[];
    compact?: boolean;
    maxDisplay?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    'XAF': 'FCFA',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': 'C$',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'BRL': 'R$',
    'AUD': 'A$',
};

const ProductPricing: React.FC<ProductPricingProps> = ({
    products,
    compact = false,
    maxDisplay = 3
}) => {
    if (!products || products.length === 0) {
        return null;
    }

    const formatPrice = (price: string, currency: string) => {
        const symbol = CURRENCY_SYMBOLS[currency] || currency;
        const numericPrice = parseFloat(price);

        if (isNaN(numericPrice)) return `${price} ${symbol}`;

        // Formatage intelligent selon la devise
        if (currency === 'XAF') {
            return `${Math.round(numericPrice).toLocaleString()} ${symbol}`;
        } else if (currency === 'JPY' || currency === 'KRW') {
            return `${Math.round(numericPrice).toLocaleString()} ${symbol}`;
        } else {
            return `${numericPrice.toFixed(2)} ${symbol}`;
        }
    };

    const getPriceRange = () => {
        const prices = products
            .map(p => parseFloat(p.price))
            .filter(p => !isNaN(p));

        if (prices.length === 0) return null;

        const min = Math.min(...prices);
        const max = Math.max(...prices);

        if (min === max) {
            return formatPrice(min.toString(), products[0].currency);
        }

        return `${formatPrice(min.toString(), products[0].currency)} - ${formatPrice(max.toString(), products[0].currency)}`;
    };

    const getAveragePrice = () => {
        const prices = products
            .map(p => parseFloat(p.price))
            .filter(p => !isNaN(p));

        if (prices.length === 0) return null;

        const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        return formatPrice(average.toString(), products[0].currency);
    };

    if (compact) {
        const priceRange = getPriceRange();
        const averagePrice = getAveragePrice();

        return (
            <View style={styles.compactContainer}>
                <Ionicons name="bag-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.compactPrice}>
                    {priceRange || averagePrice}
                </Text>
                <Badge style={styles.compactBadge}>
                    <Text style={styles.compactBadgeText}>
                        {products.length} produit{products.length > 1 ? 's' : ''}
                    </Text>
                </Badge>
            </View>
        );
    }

    return (
        <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
                <View style={styles.header}>
                    <Ionicons name="bag-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.headerTitle}>
                        Produits disponibles
                    </Text>
                    <Badge style={styles.headerBadge}>
                        <Text style={styles.headerBadgeText}>
                            {products.length}
                        </Text>
                    </Badge>
                </View>

                <View style={styles.productsList}>
                    {products.slice(0, maxDisplay).map((product, index) => (
                        <View key={product.id || index} style={styles.productItem}>
                            <View style={styles.productInfo}>
                                <Text style={styles.productName} numberOfLines={1}>
                                    {product.name}
                                </Text>
                                {(product.images?.length || 0) > 0 && (
                                    <View style={styles.productMediaInfo}>
                                        <Ionicons name="image-outline" size={12} color={theme.colors.textSecondary} />
                                        <Text style={styles.productMediaText}>
                                            {product.images?.length} image{(product.images?.length || 0) > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.productPrice}>
                                {formatPrice(product.price, product.currency)}
                            </Text>
                        </View>
                    ))}

                    {products.length > maxDisplay && (
                        <View style={styles.moreProductsContainer}>
                            <Badge style={styles.moreProductsBadge}>
                                <Text style={styles.moreProductsText}>
                                    +{products.length - maxDisplay} autre{products.length - maxDisplay > 1 ? 's' : ''} produit{products.length - maxDisplay > 1 ? 's' : ''}
                                </Text>
                            </Badge>
                        </View>
                    )}
                </View>

                {products.length > 1 && (
                    <View style={styles.priceSummary}>
                        <View style={styles.priceSummaryRow}>
                            <Text style={styles.priceSummaryLabel}>Gamme de prix:</Text>
                            <Text style={styles.priceSummaryValue}>
                                {getPriceRange()}
                            </Text>
                        </View>
                        <View style={styles.priceSummaryRow}>
                            <Text style={styles.priceSummaryLabel}>Prix moyen:</Text>
                            <Text style={styles.priceSummaryValue}>
                                {getAveragePrice()}
                            </Text>
                        </View>
                    </View>
                )}
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    compactPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primary,
    },
    compactBadge: {
        backgroundColor: theme.colors.surface,
    },
    compactBadgeText: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
    card: {
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
        backgroundColor: '#f0f8ff',
    },
    cardContent: {
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primary,
        flex: 1,
    },
    headerBadge: {
        backgroundColor: theme.colors.surface,
    },
    headerBadgeText: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
    productsList: {
        gap: 8,
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    productInfo: {
        flex: 1,
        marginRight: 8,
    },
    productName: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.colors.text,
        marginBottom: 2,
    },
    productMediaInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    productMediaText: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
    productPrice: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.primary,
    },
    moreProductsContainer: {
        alignItems: 'center',
        paddingTop: 8,
    },
    moreProductsBadge: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    moreProductsText: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
    priceSummary: {
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: theme.colors.primary,
        gap: 4,
    },
    priceSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceSummaryLabel: {
        fontSize: 11,
        color: theme.colors.textSecondary,
    },
    priceSummaryValue: {
        fontSize: 11,
        fontWeight: '500',
        color: theme.colors.primary,
    },
});

export default ProductPricing;
















