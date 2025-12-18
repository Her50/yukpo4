import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeInput } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import SelectModalitySelector from './SelectModalitySelector';

// ✅ Interface pour une variante de chaussure (Pointure + Couleur + Prix + Images)
export interface ChaussureVariant {
    id: string;
    pointure: string;        // "38", "39", "40", "41"...
    couleur: string;         // "Noir", "Blanc", "Marron"...
    prix: string;            // Prix de cette variante
    devise: string;          // "XAF", "EUR"
    stockDisponible?: number;
    reference?: string;      // SKU optionnel
    images?: string[];       // ✅ PLUSIEURS images par variante (différentes vues de la couleur)
}

interface ChaussureVariantManagerProps {
    variants: ChaussureVariant[];
    onChange: (variants: ChaussureVariant[]) => void;
    globalDevise?: string;      // ✅ NOUVEAU: Devise globale qui s'applique à toutes les variantes
    readonly?: boolean;
}

const ChaussureVariantManager: React.FC<ChaussureVariantManagerProps> = ({
    variants,
    onChange,
    globalDevise = 'XAF',  // ✅ NOUVEAU: Devise globale par défaut
    readonly = false
}) => {
    const handleAddVariant = () => {
        const newVariant: ChaussureVariant = {
            id: `variant-${Date.now()}`,
            pointure: '',
            couleur: '',
            prix: '',
            devise: globalDevise,  // ✅ Utiliser la devise globale
            stockDisponible: 0,
            images: []
        };
        onChange([...variants, newVariant]);
    };

    const handleUpdateVariant = (variantId: string, field: keyof ChaussureVariant, value: any) => {
        const updatedVariants = variants.map(v =>
            v.id === variantId ? { ...v, [field]: value } : v
        );
        onChange(updatedVariants);
    };

    const handleDeleteVariant = (variantId: string) => {
        Alert.alert(
            'Supprimer la variante',
            'Êtes-vous sûr de vouloir supprimer cette variante ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => onChange(variants.filter(v => v.id !== variantId))
                }
            ]
        );
    };

    const handleDuplicateVariant = (variantId: string) => {
        const variantToDuplicate = variants.find(v => v.id === variantId);
        if (variantToDuplicate) {
            const duplicated: ChaussureVariant = {
                ...variantToDuplicate,
                id: `variant-${Date.now()}`,
                images: [] // Ne pas dupliquer les images
            };
            onChange([...variants, duplicated]);
        }
    };

    // ✅ Upload multiple images par variante
    const handleImagePicker = async (variantId: string) => {
        try {
            // ✅ CORRIGÉ: Utiliser 'images' as any pour compatibilité avec toutes les versions d'expo-image-picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any,
                allowsMultipleSelection: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets.length > 0) {
                const variant = variants.find(v => v.id === variantId);
                const existingImages = variant?.images || [];
                const newImages = result.assets.map(asset => asset.uri);

                handleUpdateVariant(variantId, 'images', [...existingImages, ...newImages]);
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de sélectionner les images');
        }
    };

    const handleRemoveImage = (variantId: string, imageIndex: number) => {
        const variant = variants.find(v => v.id === variantId);
        if (variant && variant.images) {
            const updatedImages = variant.images.filter((_, idx) => idx !== imageIndex);
            handleUpdateVariant(variantId, 'images', updatedImages);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>👟 Pointures et Couleurs Disponibles</Text>
                {!readonly && (
                    <TouchableOpacity style={styles.addButton} onPress={handleAddVariant}>
                        <SafeIcon name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>Ajouter</Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.hint}>
                💡 Ajoutez toutes les pointures et couleurs disponibles (Ex: 38 Noir, 39 Blanc, 40 Marron)
            </Text>

            {/* Liste des variantes */}
            {variants.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="shopping-bag" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucune variante ajoutée</Text>
                    <Text style={styles.emptyHint}>
                        Ajoutez les pointures et couleurs disponibles
                    </Text>
                </View>
            ) : (
                <View style={styles.variantsContainer}>
                    <FlatList
                        data={variants}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item: variant, index }) => (
                            <View key={variant.id} style={styles.variantCard}>
                                {/* Header */}
                                <View style={styles.variantHeader}>
                                    <View style={styles.variantNumber}>
                                        <Text style={styles.variantNumberText}>{index + 1}</Text>
                                    </View>
                                    <Text style={styles.variantTitle}>
                                        {variant.pointure && variant.couleur
                                            ? `Pointure ${variant.pointure} - ${variant.couleur}`
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

                                {/* Images de la variante */}
                                {variant.images && variant.images.length > 0 && (
                                    <View style={styles.imagesContainer}>
                                        {variant.images.map((img, imgIdx) => (
                                            <View key={imgIdx} style={styles.imageWrapper}>
                                                <Image source={{ uri: img }} style={styles.variantImage} />
                                                {!readonly && (
                                                    <TouchableOpacity
                                                        style={styles.removeImageButton}
                                                        onPress={() => handleRemoveImage(variant.id, imgIdx)}
                                                    >
                                                        <SafeIcon name="x" size={12} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Champs */}
                                <View style={styles.variantFields}>
                                    {/* Pointure + Couleur */}
                                    <View style={styles.fieldRow}>
                                        <View style={[{ flex: 1 }]}>
                                            <SelectModalitySelector
                                                label="Pointure"
                                                value={variant.pointure}
                                                productType="chaussure"
                                                fieldName="pointures"
                                                onSelect={(value) => handleUpdateVariant(variant.id, 'pointure', value)}
                                                required
                                                placeholder="Ex: 38"
                                            />
                                        </View>
                                        <View style={[{ flex: 1 }]}>
                                            <SelectModalitySelector
                                                label="Couleur"
                                                value={variant.couleur}
                                                productType="chaussure"
                                                fieldName="couleurs"
                                                onSelect={(value) => handleUpdateVariant(variant.id, 'couleur', value)}
                                                required
                                                placeholder="Ex: Noir"
                                            />
                                        </View>
                                    </View>

                                    {/* Prix + Stock */}
                                    <View style={styles.fieldRow}>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>Prix <Text style={styles.required}>*</Text></Text>
                                            <NativeInput
                                                placeholder="Ex: 25000"
                                                value={variant.prix}
                                                onChangeText={(text) => handleUpdateVariant(variant.id, 'prix', text)}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                                editable={!readonly}
                                            />
                                        </View>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>Stock</Text>
                                            <NativeInput
                                                placeholder="Ex: 10"
                                                value={variant.stockDisponible?.toString() || ''}
                                                onChangeText={(text) => handleUpdateVariant(variant.id, 'stockDisponible', parseInt(text) || 0)}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                                editable={!readonly}
                                            />
                                        </View>
                                    </View>

                                    {/* Référence optionnelle */}
                                    <View style={[styles.fieldContainer, { marginBottom: 8 }]}>
                                        <Text style={styles.fieldLabel}>Référence (opt.)</Text>
                                        <NativeInput
                                            placeholder="Ex: NIKE-AIR-38-BLK"
                                            value={variant.reference || ''}
                                            onChangeText={(text) => handleUpdateVariant(variant.id, 'reference', text)}
                                            style={styles.fieldInput}
                                            editable={!readonly}
                                        />
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

            {/* Résumé */}
            {variants.length > 0 && (
                <View style={styles.summary}>
                    <SafeIcon name="info" size={16} color={modernColors.primary} />
                    <Text style={styles.summaryText}>
                        {variants.length} variante{variants.length > 1 ? 's' : ''} •
                        Prix de {Math.min(...variants.filter(v => v.prix).map(v => parseFloat(v.prix) || Infinity)).toLocaleString()}
                        à {Math.max(...variants.map(v => parseFloat(v.prix) || 0)).toLocaleString()} {globalDevise}
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
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    hint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 16,
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
    imagesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    imageWrapper: {
        position: 'relative',
    },
    variantImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: modernColors.background,
    },
    removeImageButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: modernColors.error,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
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
});

export default ChaussureVariantManager;







