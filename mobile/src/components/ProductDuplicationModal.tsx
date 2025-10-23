import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { Product } from '../types/Product';
import { NativeButton, NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface ProductDuplicationModalProps {
    visible: boolean;
    onClose: () => void;
    product: Product | null;
    onDuplicate: (duplicatedProduct: Product) => void;
}

const ProductDuplicationModal: React.FC<ProductDuplicationModalProps> = ({
    visible,
    onClose,
    product,
    onDuplicate
}) => {
    const [duplicatedProduct, setDuplicatedProduct] = useState<Product | null>(null);

    React.useEffect(() => {
        if (product && visible) {
            // Créer une copie du produit avec un nouvel ID et nom modifié
            const newProduct: Product = {
                ...product,
                id: `duplicate_${Date.now()}`,
                nom: `${product.nom} (Copie)`,
                // Réinitialiser les champs qui doivent être modifiés
                images: [], // Vider les images
                videos: [], // Vider les vidéos
                // Garder tous les autres champs (type, prix, description, etc.)
            };
            setDuplicatedProduct(newProduct);
        }
    }, [product, visible]);

    const handleDuplicate = () => {
        if (duplicatedProduct) {
            onDuplicate(duplicatedProduct);
            onClose();
            Alert.alert(
                '✅ Produit dupliqué',
                'Le produit a été dupliqué avec succès. Vous pouvez maintenant le modifier.',
                [{ text: 'OK' }]
            );
        }
    };

    const updateField = (field: keyof Product, value: any) => {
        if (duplicatedProduct) {
            setDuplicatedProduct({
                ...duplicatedProduct,
                [field]: value
            });
        }
    };

    if (!product || !duplicatedProduct) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <SafeIcon name="copy" size={24} color={modernColors.primary} />
                    <Text style={styles.title}>Dupliquer le produit</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="close" size={24} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <NativeCard style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <SafeIcon name="info" size={20} color={modernColors.info} />
                            <Text style={styles.infoTitle}>Information</Text>
                        </View>
                        <Text style={styles.infoText}>
                            Ce produit sera dupliqué avec tous ses paramètres. Vous pourrez ensuite modifier
                            les champs nécessaires (nom, prix, images, etc.) sans reprendre à zéro.
                        </Text>
                    </NativeCard>

                    <NativeCard style={styles.previewCard}>
                        <Text style={styles.previewTitle}>Aperçu du produit dupliqué :</Text>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Nom du produit :</Text>
                            <Text style={styles.fieldValue}>{duplicatedProduct.nom}</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Type :</Text>
                            <Text style={styles.fieldValue}>{duplicatedProduct.type}</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Prix :</Text>
                            <Text style={styles.fieldValue}>{duplicatedProduct.prix} {duplicatedProduct.devise}</Text>
                        </View>

                        {duplicatedProduct.description && (
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Description :</Text>
                                <Text style={styles.fieldValue}>{duplicatedProduct.description}</Text>
                            </View>
                        )}

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Images :</Text>
                            <Text style={styles.fieldValue}>
                                {duplicatedProduct.images?.length || 0} image(s) (réinitialisées)
                            </Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Vidéos :</Text>
                            <Text style={styles.fieldValue}>
                                {duplicatedProduct.videos?.length || 0} vidéo(s) (réinitialisées)
                            </Text>
                        </View>
                    </NativeCard>

                    <NativeCard style={styles.actionsCard}>
                        <Text style={styles.actionsTitle}>Actions disponibles après duplication :</Text>

                        <View style={styles.actionItem}>
                            <SafeIcon name="edit" size={16} color={modernColors.primary} />
                            <Text style={styles.actionText}>Modifier le nom du produit</Text>
                        </View>

                        <View style={styles.actionItem}>
                            <SafeIcon name="dollar-sign" size={16} color={modernColors.success} />
                            <Text style={styles.actionText}>Ajuster le prix</Text>
                        </View>

                        <View style={styles.actionItem}>
                            <SafeIcon name="image" size={16} color={modernColors.warning} />
                            <Text style={styles.actionText}>Ajouter de nouvelles images</Text>
                        </View>

                        <View style={styles.actionItem}>
                            <SafeIcon name="video" size={16} color={modernColors.info} />
                            <Text style={styles.actionText}>Ajouter de nouvelles vidéos</Text>
                        </View>

                        <View style={styles.actionItem}>
                            <SafeIcon name="settings" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.actionText}>Modifier les paramètres spécifiques</Text>
                        </View>
                    </NativeCard>
                </ScrollView>

                <View style={styles.footer}>
                    <NativeButton
                        title="Annuler"
                        onPress={onClose}
                        variant="secondary"
                        style={styles.cancelButton}
                    />
                    <NativeButton
                        title="Dupliquer le produit"
                        onPress={handleDuplicate}
                        variant="primary"
                        style={styles.duplicateButton}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        flex: 1,
        marginLeft: 12,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    infoCard: {
        marginBottom: 20,
        padding: 16,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginLeft: 8,
    },
    infoText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    previewCard: {
        marginBottom: 20,
        padding: 16,
    },
    previewTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    fieldRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    fieldLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        flex: 1,
    },
    fieldValue: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        flex: 1,
        textAlign: 'right',
    },
    actionsCard: {
        marginBottom: 20,
        padding: 16,
    },
    actionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionText: {
        fontSize: 14,
        color: modernColors.text,
        marginLeft: 12,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
    },
    duplicateButton: {
        flex: 2,
    },
});

export default ProductDuplicationModal;


