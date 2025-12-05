/**
 * 🤖 Suggestions de produits intelligentes
 * IA-powered product suggestions
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { NativeCard } from '../NativeDesign';
import { SafeIcon } from '../SafeIcon';

interface SuggestedProduct {
    id: string;
    name: string;
    category?: string;
    estimatedPrice?: number;
    reason: string; // Pourquoi suggéré
    icon?: string;
}

interface SuggestedProductsProps {
    supermarketId?: string;
    currentBasket?: Array<{ name: string; quantity: number }>;
    onAddProduct: (product: SuggestedProduct) => void;
    style?: any;
}

const SuggestedProducts: React.FC<SuggestedProductsProps> = ({
    supermarketId,
    currentBasket = [],
    onAddProduct,
    style,
}) => {
    const [suggestions, setSuggestions] = useState<SuggestedProduct[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (supermarketId) {
            loadSuggestions();
        }
    }, [supermarketId, currentBasket]);

    const loadSuggestions = async () => {
        setLoading(true);
        try {
            // TODO: Appeler l'API backend pour suggestions IA
            // Pour l'instant, suggestions basiques
            const mockSuggestions: SuggestedProduct[] = [
                {
                    id: '1',
                    name: 'Eau minérale',
                    category: 'Boissons',
                    estimatedPrice: 500,
                    reason: 'Produit populaire',
                    icon: 'droplet',
                },
                {
                    id: '2',
                    name: 'Pain de mie',
                    category: 'Boulangerie',
                    estimatedPrice: 800,
                    reason: 'Souvent acheté ensemble',
                    icon: 'bread',
                },
            ];
            setSuggestions(mockSuggestions);
        } catch (error) {
            console.error('[SuggestedProducts] Erreur chargement suggestions:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, style]}>
                <ActivityIndicator size="small" color={modernColors.primary} />
            </View>
        );
    }

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <View style={[styles.container, style]}>
            <View style={styles.header}>
                <SafeIcon name="sparkles" size={18} color={modernColors.primary} />
                <Text style={styles.title}>Suggestions pour vous</Text>
            </View>
            <FlatList
                data={suggestions}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <NativeCard style={styles.suggestionCard}>
                        {item.icon && (
                            <SafeIcon name={item.icon} size={24} color={modernColors.primary} />
                        )}
                        <Text style={styles.productName} numberOfLines={2}>
                            {item.name}
                        </Text>
                        {item.estimatedPrice && (
                            <Text style={styles.productPrice}>
                                ~{item.estimatedPrice.toLocaleString('fr-FR')} FCFA
                            </Text>
                        )}
                        <Text style={styles.reason} numberOfLines={1}>
                            {item.reason}
                        </Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => onAddProduct(item)}
                        >
                            <SafeIcon name="plus" size={16} color="#FFFFFF" />
                            <Text style={styles.addButtonText}>Ajouter</Text>
                        </TouchableOpacity>
                    </NativeCard>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    suggestionCard: {
        width: 140,
        padding: 12,
        marginRight: 12,
        alignItems: 'center',
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 8,
        textAlign: 'center',
    },
    productPrice: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
        marginTop: 4,
    },
    reason: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 8,
    },
    addButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default SuggestedProducts;


