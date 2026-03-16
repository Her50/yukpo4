import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeInput } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import SelectModalitySelector from './SelectModalitySelector';
import { useLanguageSafe } from '../contexts/LanguageContext';

// ✅ Interface pour une variante de produit
export interface ProductVariant {
    id: string;
    quantite: string;              // Quantité (ex: "1", "5", "25")
    unite: string;                 // Unité (kg, L, g, pièce, etc.)
    conditionnement: string;       // Type de conditionnement (Sachet, Boîte, etc.)
    prix: string;                  // Prix de cette variante
    devise: string;                // Devise (XAF, EUR, etc.)
    stockDisponible?: number;      // Stock disponible pour cette variante
    reference?: string;            // Référence SKU optionnelle
    image?: string;                // ✅ NOUVEAU: Image spécifique à cette variante
}

interface ProductVariantManagerProps {
    variants: ProductVariant[];
    onChange: (variants: ProductVariant[]) => void;
    productType: string;           // Pour récupérer les bonnes modalités
    globalDevise?: string;      // ✅ NOUVEAU: Devise globale qui s'applique à toutes les variantes
    readonly?: boolean;
}

const ProductVariantManager: React.FC<ProductVariantManagerProps> = ({
    variants,
    onChange,
    productType,
    globalDevise = 'XAF',  // ✅ NOUVEAU: Devise globale par défaut
    readonly = false
}) => {
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

    const { t } = useLanguageSafe();
    // Ajouter une nouvelle variante
    const handleAddVariant = () => {
        const newVariant: ProductVariant = {
            id: `variant-${Date.now()}`,
            quantite: '',
            unite: '',
            conditionnement: '',
            prix: '',
            devise: globalDevise,  // ✅ Utiliser la devise globale
            stockDisponible: 0
        };
        onChange([...variants, newVariant]);
        setEditingVariantId(newVariant.id);
    };

    // Ajouter 3 variantes d'un coup (pour gagner du temps)
    const handleAdd3Variants = () => {
        const newVariants: ProductVariant[] = [];
        for (let i = 0; i < 3; i++) {
            newVariants.push({
                id: `variant-${Date.now()}-${i}`,
                quantite: '',
                unite: '',
                conditionnement: '',
                prix: '',
                devise: globalDevise,  // ✅ Utiliser la devise globale
                stockDisponible: 0
            });
        }
        onChange([...variants, ...newVariants]);
    };

    // Modifier une variante
    const handleUpdateVariant = (variantId: string, field: keyof ProductVariant, value: any) => {
        const updatedVariants = variants.map(v =>
            v.id === variantId ? { ...v, [field]: value } : v
        );
        onChange(updatedVariants);
    };

    // Supprimer une variante
    const handleDeleteVariant = (variantId: string) => {
        Alert.alert(
            'Supprimer la variante',
            t('productVariantManager.etesvousSurDeVouloirSupprimerCette'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                        onChange(variants.filter(v => v.id !== variantId));
                    }
                }
            ]
        );
    };

    // Dupliquer une variante
    const handleDuplicateVariant = (variantId: string) => {
        const variantToDuplicate = variants.find(v => v.id === variantId);
        if (variantToDuplicate) {
            const duplicated: ProductVariant = {
                ...variantToDuplicate,
                id: `variant-${Date.now()}`,
                image: undefined // Ne pas dupliquer l'image
            };
            onChange([...variants, duplicated]);
        }
    };

    // ✅ NOUVEAU: Gestion des images par variante
    const handleImagePicker = async (variantId: string) => {
        try {
            // ✅ CORRIGÉ: Utiliser 'images' as any pour compatibilité avec toutes les versions d'expo-image-picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const imageUri = result.assets[0].uri;
                handleUpdateVariant(variantId, 'image', imageUri);
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de sélectionner une image');
        }
    };

    const handleRemoveImage = (variantId: string) => {
        Alert.alert(
            'Supprimer l\'image',
            t('productVariantManager.etesvousSurDeVouloirSupprimerCette'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => handleUpdateVariant(variantId, 'image', undefined)
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header avec boutons d'ajout */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    📦 Variantes de Conditionnement
                </Text>
                {!readonly && (
                    <View style={styles.headerButtons}>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={handleAdd3Variants}
                        >
                            <SafeIcon name="layers" size={16} color={modernColors.primary} />
                            <Text style={styles.addButtonText}>+3</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.addButton, styles.addButtonPrimary]}
                            onPress={handleAddVariant}
                        >
                            <SafeIcon name="plus" size={16} color="#FFFFFF" />
                            <Text style={styles.addButtonTextPrimary}>{t('productVariantManager.ajouter')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <Text style={styles.hint}>
                💡 <Text style={styles.hintBold}>Astuce :</Text>{t('productVariantManager.ajoutezToutesLesQuantitesDisponiblesEx')}
            </Text>

            {/* Liste des variantes */}
            {variants.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="package" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>{t('productVariantManager.aucuneVarianteAjoutee')}</Text>
                    <Text style={styles.emptyHint}>
                        Ajoutez des variantes pour proposer différentes quantités
                    </Text>
                </View>
            ) : (
                <View style={styles.variantsContainer}>
                    <FlatList
                        data={variants}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item: variant, index }) => (
                            <View key={variant.id} style={styles.variantCard}>
                                {/* Header de la variante */}
                                <View style={styles.variantHeader}>
                                    <View style={styles.variantNumber}>
                                        <Text style={styles.variantNumberText}>{index + 1}</Text>
                                    </View>
                                    <Text style={styles.variantTitle}>
                                        {variant.quantite && variant.unite
                                            ? `${variant.quantite}${variant.unite}`
                                            : `Variante ${index + 1}`}
                                    </Text>
                                    {!readonly && (
                                        <View style={styles.variantActions}>
                                            <TouchableOpacity
                                                style={styles.actionButtonSmall}
                                                onPress={() => handleImagePicker(variant.id)}
                                            >
                                                <SafeIcon name="camera" size={14} color={modernColors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.actionButtonSmall}
                                                onPress={() => handleDuplicateVariant(variant.id)}
                                            >
                                                <SafeIcon name="copy" size={14} color={modernColors.success} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.actionButtonSmall}
                                                onPress={() => handleDeleteVariant(variant.id)}
                                            >
                                                <SafeIcon name="trash-2" size={14} color={modernColors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* ✅ NOUVEAU: Image de la variante */}
                                {variant.image && (
                                    <View style={styles.variantImageContainer}>
                                        <Image source={{ uri: variant.image }} style={styles.variantImage} />
                                        {!readonly && (
                                            <TouchableOpacity
                                                style={styles.removeImageButton}
                                                onPress={() => handleRemoveImage(variant.id)}
                                            >
                                                <SafeIcon name="x" size={12} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {/* Champs de la variante */}
                                <View style={styles.variantFields}>
                                    {/* Ligne 1: Quantité + Unité */}
                                    <View style={styles.fieldRow}>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>{t('productVariantManager.quantite')}<Text style={styles.required}>*</Text></Text>
                                            <NativeInput
                                                placeholder="Ex: 1"
                                                value={variant.quantite}
                                                onChangeText={(text) => handleUpdateVariant(variant.id, 'quantite', text)}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={[{ flex: 1 }]}>
                                            <SelectModalitySelector
                                                label={t('productVariantManager.unite')}
                                                value={variant.unite}
                                                productType={productType}
                                                fieldName="unites"
                                                onSelect={(value) => handleUpdateVariant(variant.id, 'unite', value)}
                                                required
                                                placeholder="kg, L..."
                                            />
                                        </View>
                                    </View>

                                    {/* Ligne 2: Conditionnement + Prix */}
                                    <View style={styles.fieldRow}>
                                        <View style={[{ flex: 1.2 }]}>
                                            <SelectModalitySelector
                                                label="Conditionnement"
                                                value={variant.conditionnement}
                                                productType={productType}
                                                fieldName="conditionnements"
                                                onSelect={(value) => handleUpdateVariant(variant.id, 'conditionnement', value)}
                                                placeholder={t('productVariantManager.sachetBoite')}
                                            />
                                        </View>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>Prix <Text style={styles.required}>*</Text></Text>
                                            <NativeInput
                                                placeholder="0"
                                                value={variant.prix}
                                                onChangeText={(text) => handleUpdateVariant(variant.id, 'prix', text)}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>

                                    {/* Ligne 3: Stock disponible */}
                                    <View style={styles.fieldRow}>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>{t('productVariantManager.stockDisponible')}</Text>
                                            <NativeInput
                                                placeholder="0"
                                                value={variant.stockDisponible?.toString() || ''}
                                                onChangeText={(text) => handleUpdateVariant(variant.id, 'stockDisponible', parseInt(text) || 0)}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>{t('productVariantManager.referenceOpt')}</Text>
                                            <NativeInput
                                                placeholder="SKU-001"
                                                value={variant.reference || ''}
                                                onChangeText={(text) => handleUpdateVariant(variant.id, 'reference', text)}
                                                style={styles.fieldInput}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}
                        style={styles.variantsList}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </View>
            )}

            {/* Résumé des variantes */}
            {variants.length > 0 && (
                <View style={styles.summary}>
                    <SafeIcon name="info" size={16} color={modernColors.primary} />
                    <Text style={styles.summaryText}>
                        {variants.length} variante{variants.length > 1 ? 's' : ''} •
                        Prix de {Math.min(...variants.filter(v => v.prix).map(v => parseFloat(v.prix) || 0)).toLocaleString()} à {Math.max(...variants.map(v => parseFloat(v.prix) || 0)).toLocaleString()} {globalDevise}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 8,
    },
    addButtonPrimary: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    addButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    addButtonTextPrimary: {
        color: '#FFFFFF',
    },
    hint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 16,
    },
    hintBold: {
        fontWeight: '600',
        color: modernColors.text,
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: modernColors.border,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    emptyHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    variantsContainer: {
        maxHeight: 600,  // ✅ AMÉLIORATION: Augmenté pour voir plus de variabilités
        marginBottom: 8,
    },
    variantsList: {
        maxHeight: 600,
    },
    variantCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    variantHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    variantNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    variantNumberText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    variantTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    variantActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButtonSmall: {
        padding: 6,
        backgroundColor: modernColors.background,
        borderRadius: 6,
    },
    variantFields: {
        gap: 8,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 8,
    },
    fieldContainer: {
        marginBottom: 8,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    required: {
        color: modernColors.error,
    },
    fieldInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: modernColors.text,
    },
    summary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    summaryText: {
        fontSize: 13,
        fontWeight: '500',
        color: modernColors.primary,
        flex: 1,
    },
    variantImageContainer: {
        position: 'relative',
        marginBottom: 12,
        alignSelf: 'center',
    },
    variantImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: modernColors.background,
    },
    removeImageButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: modernColors.error,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
});

export default ProductVariantManager;

