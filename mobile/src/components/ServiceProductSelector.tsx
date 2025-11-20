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
    onClose: () => void;
}

const ServiceProductSelector: React.FC<ServiceProductSelectorProps> = ({
    visible,
    products,
    onSelect,
    onClose,
}) => {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const handleConfirm = () => {
        if (selectedProduct) {
            onSelect(selectedProduct);
            setSelectedProduct(null);
            onClose();
        }
    };

    // Grouper par service
    const groupedByService = products.reduce((acc, product) => {
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
                        Choisissez le produit pour lequel vous souhaitez créer une vidéo
                    </Text>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {services.map((service, serviceIndex) => (
                            <View key={`service-${service.serviceId}`} style={styles.serviceGroup}>
                                <View style={styles.serviceHeader}>
                                    <SafeIcon name="briefcase" size={18} color={modernColors.primary} />
                                    <Text style={styles.serviceName}>{service.serviceName}</Text>
                                </View>

                                {service.products.map((product, productIndex) => {
                                    const isSelected = selectedProduct?.serviceId === product.serviceId &&
                                        selectedProduct?.productIndex === product.productIndex;

                                    return (
                                        <TouchableOpacity
                                            key={`product-${product.serviceId}-${product.productIndex}`}
                                            style={[
                                                styles.productItem,
                                                isSelected && styles.productItemSelected,
                                            ]}
                                            onPress={() => setSelectedProduct(product)}
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
                                                    {product.productName}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
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
                            title="Créer la vidéo"
                            variant="primary"
                            size="medium"
                            onPress={handleConfirm}
                            disabled={!selectedProduct}
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
        marginBottom: 20,
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
});

export default ServiceProductSelector;

