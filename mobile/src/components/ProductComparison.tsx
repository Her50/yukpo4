/**
 * ProductComparison - Comparaison produits niveau géant (eBay/Amazon style)
 * Mode sélection et comparaison côte-à-côte
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { triggerHaptic } from '../utils/hapticFeedback';
import ProductCard from './ProductCard';
import SafeIcon from './SafeIcon';
import { useToaster } from './ToasterProvider';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Product {
    id: string;
    service_id: string;
    nom: string;
    prix: number;
    devise: string;
    images?: string[];
    [key: string]: any;
}

interface ProductComparisonProps {
    selectedProducts: Product[];
    onClearSelection?: () => void;
    onRemoveProduct?: (productId: string) => void;
}

export const ProductComparison: React.FC<ProductComparisonProps> = ({
    selectedProducts,
    onClearSelection,
    onRemoveProduct,
}) => {
    const [showComparison, setShowComparison] = useState(false);
    const toaster = useToaster();
    const { t } = useLanguageSafe();

    useEffect(() => {
        if (selectedProducts.length >= 2) {
            setShowComparison(true);
        }
    }, [selectedProducts.length]);

    const handleCompare = () => {
        if (selectedProducts.length < 2) {
            toaster.warning('Sélectionnez au moins 2 produits pour comparer');
            return;
        }
        triggerHaptic('medium');
        setShowComparison(true);
    };

    const handleRemove = (productId: string) => {
        triggerHaptic('light');
        onRemoveProduct?.(productId);
        if (selectedProducts.length <= 2) {
            setShowComparison(false);
        }
    };

    const getComparisonFields = () => {
        if (selectedProducts.length === 0) return [];

        const fields = [
            { key: 'prix', label: t('productComparison.prix'), format: (p: Product) => `${p.prix?.toLocaleString()} ${p.devise || 'XAF'}` },
            { key: 'nom', label: t('productComparison.nom'), format: (p: Product) => p.nom || 'N/A' },
            { key: 'location', label: t('productComparison.localisation'), format: (p: Product) => p.chosen_location || p.ville || 'N/A' },
            { key: 'distance', label: 'Distance', format: (p: Product) => p.distance_km ? `${p.distance_km.toFixed(1)} km` : 'N/A' },
            { key: 'rating', label: 'Note', format: (p: Product) => p.average_rating ? `${p.average_rating.toFixed(1)}/5` : 'N/A' },
            { key: 'reviews', label: 'Avis', format: (p: Product) => `${p.rating_count || 0} avis` },
        ];

        return fields;
    };

    if (selectedProducts.length === 0) return null;

    return (
        <>
            {/* Bouton flottant comparaison */}
            {selectedProducts.length >= 2 && (
                <TouchableOpacity
                    style={styles.compareButton}
                    onPress={handleCompare}
                    accessibilityRole="button"
                    accessibilityLabel={`Comparer ${selectedProducts.length} produits`}
                >
                    <SafeIcon name="git-compare" size={20} color="#FFFFFF" />
                    <Text style={styles.compareButtonText}>
                        Comparer ({selectedProducts.length})
                    </Text>
                </TouchableOpacity>
            )}

            {/* Modal comparaison */}
            <Modal
                visible={showComparison}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowComparison(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('productComparison.comparaisonProduits')}</Text>
                        <TouchableOpacity onPress={() => setShowComparison(false)}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={true}
                        style={styles.comparisonScroll}
                        contentContainerStyle={styles.comparisonContent}
                    >
                        {selectedProducts.map((product, index) => (
                            <View key={product.id} style={styles.comparisonColumn}>
                                {/* Header produit */}
                                <View style={styles.productHeader}>
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => handleRemove(product.id)}
                                    >
                                        <SafeIcon name="x" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                    <Text style={styles.productName} numberOfLines={2}>
                                        {product.nom}
                                    </Text>
                                </View>

                                {/* Image produit */}
                                {product.images && product.images.length > 0 && (
                                    <View style={styles.productImageContainer}>
                                        <ProductCard
                                            product={product}
                                            service={{ id: product.service_id }}
                                            onPress={() => { }}
                                        />
                                    </View>
                                )}

                                {/* Champs de comparaison */}
                                <View style={styles.comparisonFields}>
                                    {getComparisonFields().map((field) => (
                                        <View key={field.key} style={styles.comparisonField}>
                                            <Text style={styles.fieldLabel}>{field.label}</Text>
                                            <Text style={styles.fieldValue}>
                                                {field.format(product)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Actions */}
                                <View style={styles.productActions}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => {
                                            // Navigation vers détails
                                        }}
                                    >
                                        <SafeIcon name="eye" size={16} color={modernColors.primary} />
                                        <Text style={styles.actionButtonText}>{t('productComparison.voir')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.actionButtonPrimary]}
                                        onPress={() => {
                                            // Ajouter au panier
                                        }}
                                    >
                                        <SafeIcon name="shopping-cart" size={16} color="#FFFFFF" />
                                        <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                                            Panier
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Actions globales */}
                    <View style={styles.globalActions}>
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={() => {
                                onClearSelection?.();
                                setShowComparison(false);
                            }}
                        >
                            <SafeIcon name="trash-2" size={18} color="#EF4444" />
                            <Text style={styles.clearButtonText}>Tout effacer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    compareButton: {
        position: 'absolute',
        bottom: 80,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 1000,
    },
    compareButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
    },
    comparisonScroll: {
        flex: 1,
    },
    comparisonContent: {
        padding: 16,
        gap: 16,
    },
    comparisonColumn: {
        width: SCREEN_WIDTH * 0.85,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productHeader: {
        marginBottom: 12,
    },
    removeButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
        zIndex: 10,
    },
    productName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 8,
    },
    productImageContainer: {
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    comparisonFields: {
        gap: 12,
        marginBottom: 16,
    },
    comparisonField: {
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    fieldValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    productActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: modernColors.primary,
    },
    actionButtonPrimary: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
    },
    actionButtonTextPrimary: {
        color: '#FFFFFF',
    },
    globalActions: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#FEF2F2',
        borderWidth: 1.5,
        borderColor: '#FEE2E2',
    },
    clearButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#EF4444',
    },
});

export default ProductComparison;

