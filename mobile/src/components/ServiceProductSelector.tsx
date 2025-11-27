import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface Product {
    serviceId: number;
    productIndex: number;
    productName: string;
    serviceName: string;
}

interface ServiceProductSelectorProps {
    visible: boolean;
    products: Product[];
    onSelect: (product: Product) => void;
    onSelectMultiple?: (products: Product[]) => void; // ✅ NOUVEAU : Support sélection multiple
    onClose: () => void;
    allowMultiple?: boolean; // ✅ NOUVEAU : Permettre sélection multiple
}

const ServiceProductSelector: React.FC<ServiceProductSelectorProps> = ({
    visible,
    products,
    onSelect,
    onSelectMultiple,
    onClose,
    allowMultiple = false, // ✅ Par défaut, sélection unique pour compatibilité
}) => {
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set()); // ✅ NOUVEAU : Set pour sélection multiple

    const handleConfirm = () => {
        if (allowMultiple && onSelectMultiple) {
            // ✅ Mode sélection multiple
            const selected = products.filter((product) =>
                selectedProducts.has(`${product.serviceId}-${product.productIndex}`)
            );
            if (selected.length > 0) {
                onSelectMultiple(selected);
                setSelectedProducts(new Set());
                onClose();
            }
        } else {
            // ✅ Mode sélection unique (compatibilité)
            const selected = products.find((product) =>
                selectedProducts.has(`${product.serviceId}-${product.productIndex}`)
            );
            if (selected) {
                onSelect(selected);
                setSelectedProducts(new Set());
                onClose();
            }
        }
    };

    const toggleProductSelection = (product: Product) => {
        const key = `${product.serviceId}-${product.productIndex}`;
        setSelectedProducts((prev) => {
            const next = new Set(prev);
            if (allowMultiple) {
                // ✅ Mode multiple : toggle
                if (next.has(key)) {
                    next.delete(key);
                } else {
                    next.add(key);
                }
            } else {
                // ✅ Mode unique : remplace la sélection
                next.clear();
                next.add(key);
            }
            return next;
        });
    };

    // ✅ CORRIGÉ: Vérifier que products est défini et est un array
    const safeProducts = Array.isArray(products) ? products : [];

    // Grouper par service
    const groupedByService = safeProducts.reduce((acc, product) => {
        if (!product) return acc; // ✅ Protection contre produits null/undefined
        const key = `${product.serviceId}-${product.serviceName}`;
        if (!acc[key]) {
            acc[key] = {
                serviceId: product.serviceId,
                serviceName: product.serviceName,
                products: [],
            };
        }
        acc[key].products.push(product);
        return acc;
    }, {} as Record<string, { serviceId: number; serviceName: string; products: Product[] }>);

    const services = Object.values(groupedByService);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <NativeCard style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Sélectionner un produit</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        {allowMultiple
                            ? 'Choisissez un ou plusieurs produits pour lesquels vous souhaitez créer une vidéo'
                            : 'Choisissez le produit pour lequel vous souhaitez créer une vidéo'}
                    </Text>
                    {allowMultiple && selectedProducts.size > 0 && (
                        <View style={styles.selectionCount}>
                            <Text style={styles.selectionCountText}>
                                {selectedProducts.size} produit(s) sélectionné(s)
                            </Text>
                        </View>
                    )}

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {Array.isArray(services) && services.length > 0 ? (
                            services.map((service, serviceIndex) => {
                                // ✅ CORRIGÉ: Vérifier que service et service.products sont définis
                                if (!service || !Array.isArray(service.products)) {
                                    return null;
                                }

                                return (
                                    <View key={`service-${service.serviceId || serviceIndex}`} style={styles.serviceGroup}>
                                        <View style={styles.serviceHeader}>
                                            <SafeIcon name="briefcase" size={18} color={modernColors.primary} />
                                            <Text style={styles.serviceName}>
                                                {service.serviceName || 'Service sans nom'}
                                            </Text>
                                        </View>

                                        {service.products.map((product, productIndex) => {
                                            // ✅ CORRIGÉ: Vérifier que product est défini
                                            if (!product) return null;

                                            const productKey = `${product.serviceId}-${product.productIndex}`;
                                            const isSelected = selectedProducts.has(productKey);

                                            // ✅ CORRIGÉ: Extraire le nom du produit depuis différents formats
                                            const extractProductName = (productName: any): string => {
                                                if (!productName) return 'Produit sans nom';

                                                if (typeof productName === 'string') {
                                                    const trimmed = productName.trim();
                                                    // Éviter d'afficher des objets JSON stringifiés
                                                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                                        try {
                                                            const parsed = JSON.parse(trimmed);
                                                            if (typeof parsed === 'object' && parsed !== null) {
                                                                if ('valeur' in parsed && typeof parsed.valeur === 'string') {
                                                                    return parsed.valeur.trim() || 'Produit sans nom';
                                                                }
                                                                return 'Produit sans nom';
                                                            }
                                                        } catch {
                                                            // Ce n'est pas du JSON valide
                                                        }
                                                    }
                                                    return trimmed || 'Produit sans nom';
                                                }

                                                if (typeof productName === 'object' && productName !== null) {
                                                    if ('valeur' in productName && typeof productName.valeur === 'string') {
                                                        return productName.valeur.trim() || 'Produit sans nom';
                                                    }
                                                    return 'Produit sans nom';
                                                }

                                                return String(productName) || 'Produit sans nom';
                                            };

                                            return (
                                                <TouchableOpacity
                                                    key={`product-${product.serviceId}-${product.productIndex || productIndex}`}
                                                    style={[
                                                        styles.productItem,
                                                        isSelected && styles.productItemSelected,
                                                    ]}
                                                    onPress={() => toggleProductSelection(product)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.productContent}>
                                                        <SafeIcon
                                                            name={isSelected ? 'check-circle' : 'circle'}
                                                            size={20}
                                                            color={isSelected ? modernColors.primary : modernColors.textSecondary}
                                                        />
                                                        <Text
                                                            style={[
                                                                styles.productName,
                                                                isSelected && styles.productNameSelected,
                                                            ]}
                                                        >
                                                            {extractProductName(product.productName)}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>Aucun produit disponible</Text>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <NativeButton
                            title="Annuler"
                            variant="outline"
                            size="medium"
                            onPress={onClose}
                            style={styles.cancelButton}
                        />
                        <NativeButton
                            title={allowMultiple
                                ? `Créer la vidéo${selectedProducts.size > 0 ? ` (${selectedProducts.size})` : ''}`
                                : 'Créer la vidéo'}
                            variant="primary"
                            size="medium"
                            onPress={handleConfirm}
                            disabled={selectedProducts.size === 0}
                            style={styles.confirmButton}
                        />
                    </View>
                </NativeCard>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        backgroundColor: modernColors.background,
        borderRadius: 16,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    selectionCount: {
        backgroundColor: modernColors.primary + '15',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    selectionCountText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    scrollView: {
        maxHeight: 400,
    },
    serviceGroup: {
        marginBottom: 24,
    },
    serviceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    productItem: {
        padding: 12,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    productItemSelected: {
        backgroundColor: modernColors.primary + '10',
        borderColor: modernColors.primary,
    },
    productContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    productName: {
        fontSize: 15,
        color: modernColors.text,
        flex: 1,
    },
    productNameSelected: {
        fontWeight: '600',
        color: modernColors.primary,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cancelButton: {
        flex: 1,
    },
    confirmButton: {
        flex: 1,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default ServiceProductSelector;

