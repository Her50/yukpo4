import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag, Tag } from 'lucide-react';
import React from 'react';

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
            <div className="flex items-center gap-2 text-sm">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-600">
                    {priceRange || averagePrice}
                </span>
                <Badge variant="secondary" className="text-xs">
                    {products.length} produit{products.length > 1 ? 's' : ''}
                </Badge>
            </div>
        );
    }

    return (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/30">
            <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-900 text-sm">
                        Produits disponibles
                    </span>
                    <Badge variant="secondary" className="text-xs">
                        {products.length}
                    </Badge>
                </div>

                <div className="space-y-2">
                    {products.slice(0, maxDisplay).map((product, index) => (
                        <div key={product.id || index} className="flex items-center justify-between bg-white rounded-lg p-2 border">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {product.name}
                                </p>
                                {(product.images?.length || 0) > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <Tag className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs text-gray-500">
                                            {product.images?.length} image{(product.images?.length || 0) > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-blue-600">
                                    {formatPrice(product.price, product.currency)}
                                </p>
                            </div>
                        </div>
                    ))}

                    {products.length > maxDisplay && (
                        <div className="text-center pt-2">
                            <Badge variant="outline" className="text-xs">
                                +{products.length - maxDisplay} autre{products.length - maxDisplay > 1 ? 's' : ''} produit{products.length - maxDisplay > 1 ? 's' : ''}
                            </Badge>
                        </div>
                    )}
                </div>

                {products.length > 1 && (
                    <div className="mt-3 pt-2 border-t border-blue-200">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Gamme de prix:</span>
                            <span className="font-medium text-blue-600">
                                {getPriceRange()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-600">Prix moyen:</span>
                            <span className="font-medium text-blue-600">
                                {getAveragePrice()}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ProductPricing;

















