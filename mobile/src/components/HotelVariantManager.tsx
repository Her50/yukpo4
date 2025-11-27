import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import MultiSelectModalitySelector from './MultiSelectModalitySelector';
import { NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';
import SelectModalitySelector from './SelectModalitySelector';

// ✅ Interface pour une variante de chambre d'hôtel
export interface HotelVariant {
    id: string;
    typeChambre: string;           // Type de chambre (Simple, Double, Suite...)
    capacite: string;              // Capacité (1 personne, 2 personnes...)
    prix: string;                  // Prix par nuit
    devise: string;                // Devise (XAF, EUR, etc.)
    equipements?: string[];        // Équipements spécifiques à cette chambre
    superficie?: string;           // Superficie en m²
    nbChambresDisponibles?: number; // Nombre de chambres de ce type disponibles
    image?: string;                // Image de la chambre
}

interface HotelVariantManagerProps {
    variants: HotelVariant[];
    onChange: (variants: HotelVariant[]) => void;
    globalDevise?: string;      // ✅ NOUVEAU: Devise globale qui s'applique à toutes les variantes
    readonly?: boolean;
}

const HotelVariantManager: React.FC<HotelVariantManagerProps> = ({
    variants,
    onChange,
    globalDevise = 'XAF',  // ✅ NOUVEAU: Devise globale par défaut
    readonly = false
}) => {
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

    // Ajouter une nouvelle variante de chambre
    const handleAddVariant = () => {
        const newVariant: HotelVariant = {
            id: `room-${Date.now()}`,
            typeChambre: '',
            capacite: '',
            prix: '',
            devise: globalDevise,  // ✅ Utiliser la devise globale
            equipements: [],
            nbChambresDisponibles: 0
        };
        onChange([...variants, newVariant]);
        setEditingVariantId(newVariant.id);
    };

    // Ajouter 3 chambres d'un coup
    const handleAdd3Variants = () => {
        const newVariants: HotelVariant[] = [];
        for (let i = 0; i < 3; i++) {
            newVariants.push({
                id: `room-${Date.now()}-${i}`,
                typeChambre: '',
                capacite: '',
                prix: '',
                devise: globalDevise,  // ✅ Utiliser la devise globale
                equipements: [],
                nbChambresDisponibles: 0
            });
        }
        onChange([...variants, ...newVariants]);
    };

    // Modifier une variante
    const handleUpdateVariant = (variantId: string, field: keyof HotelVariant, value: any) => {
        const updatedVariants = variants.map(v =>
            v.id === variantId ? { ...v, [field]: value } : v
        );
        onChange(updatedVariants);
    };

    // Supprimer une variante
    const handleDeleteVariant = (variantId: string) => {
        Alert.alert(
            'Supprimer cette chambre',
            'Voulez-vous vraiment supprimer ce type de chambre ?',
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

    // Dupliquer une variante
    const handleDuplicateVariant = (variantId: string) => {
        const variantToDuplicate = variants.find(v => v.id === variantId);
        if (variantToDuplicate) {
            const duplicated: HotelVariant = {
                ...variantToDuplicate,
                id: `room-${Date.now()}`,
            };
            onChange([...variants, duplicated]);
        }
    };

    // Upload image pour une chambre
    const handlePickImage = async (variantId: string) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Nous avons besoin d\'accéder à votre galerie');
            return;
        }

        // ✅ CORRIGÉ: Protection contre undefined pour MediaType.Images
        if (!ImagePicker || !ImagePicker.MediaType) {
            console.error('[HotelVariantManager] ImagePicker ou MediaType est undefined');
            Alert.alert('Erreur', 'Impossible d\'accéder à la galerie. Veuillez réessayer.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            handleUpdateVariant(variantId, 'image', result.assets[0].uri);
        }
    };

    // Calculer fourchette de prix
    const getPriceRange = () => {
        if (variants.length === 0) return null;
        const prices = variants
            .map(v => parseFloat(v.prix))
            .filter(p => !isNaN(p) && p > 0);

        if (prices.length === 0) return null;

        const min = Math.min(...prices);
        const max = Math.max(...prices);

        return min === max
            ? `${min.toLocaleString()} ${globalDevise}/nuit`
            : `${min.toLocaleString()} - ${max.toLocaleString()} ${globalDevise}/nuit`;
    };

    return (
        <View style={styles.container}>
            {/* En-tête avec boutons */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <SafeIcon name="bed" size={20} color={modernColors.primary} />
                    <Text style={styles.title}>Types de Chambres & Tarifs</Text>
                </View>
                {!readonly && (
                    <View style={styles.headerButtons}>
                        <TouchableOpacity style={styles.addButton} onPress={handleAddVariant}>
                            <SafeIcon name="plus" size={16} color="#FFF" />
                            <Text style={styles.addButtonText}>+1</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.add3Button} onPress={handleAdd3Variants}>
                            <SafeIcon name="plus" size={16} color="#FFF" />
                            <Text style={styles.add3ButtonText}>+3</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Résumé */}
            {variants.length > 0 && (
                <View style={styles.summary}>
                    <Text style={styles.summaryText}>
                        📊 {variants.length} type{variants.length > 1 ? 's' : ''} de chambre{variants.length > 1 ? 's' : ''}
                    </Text>
                    {getPriceRange() && (
                        <Text style={styles.summaryPrice}>
                            💰 {getPriceRange()}
                        </Text>
                    )}
                </View>
            )}

            {/* Message d'aide */}
            <View style={styles.hintBox}>
                <SafeIcon name="info" size={14} color={modernColors.primary} />
                <Text style={styles.hintText}>
                    💡 Ajoutez les différents types de chambres avec leurs tarifs et photos.
                </Text>
            </View>

            {/* Liste des variantes */}
            <View style={styles.variantsContainer}>
                <FlatList
                    data={variants}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item: variant, index }) => (
                        <View key={variant.id} style={styles.variantCard}>
                            {/* En-tête de la variante */}
                            <View style={styles.variantHeader}>
                                <Text style={styles.variantNumber}>Chambre #{index + 1}</Text>
                                {!readonly && (
                                    <View style={styles.variantActions}>
                                        <TouchableOpacity
                                            onPress={() => handlePickImage(variant.id)}
                                            style={styles.actionButton}
                                        >
                                            <SafeIcon name="camera" size={16} color={modernColors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDuplicateVariant(variant.id)}
                                            style={styles.actionButton}
                                        >
                                            <SafeIcon name="copy" size={16} color={modernColors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteVariant(variant.id)}
                                            style={styles.actionButton}
                                        >
                                            <SafeIcon name="trash-2" size={16} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Image de la chambre */}
                            {variant.image && (
                                <View style={styles.imageContainer}>
                                    <Image source={{ uri: variant.image }} style={styles.variantImage} />
                                </View>
                            )}

                            {/* Type de chambre */}
                            <SelectModalitySelector
                                label="Type de chambre"
                                value={variant.typeChambre}
                                productType="hotellerie"
                                fieldName="chambres"
                                onSelect={(value) => handleUpdateVariant(variant.id, 'typeChambre', value)}
                                required
                                placeholder="Ex: Chambre Double, Suite..."
                            />

                            {/* Capacité et Superficie */}
                            <View style={styles.row}>
                                <View style={[styles.field, { flex: 1 }]}>
                                    <SelectModalitySelector
                                        label="Capacité"
                                        value={variant.capacite}
                                        productType="hotellerie"
                                        fieldName="capacites"
                                        onSelect={(value) => handleUpdateVariant(variant.id, 'capacite', value)}
                                        required
                                        placeholder="Ex: 2 personnes"
                                    />
                                </View>
                                <View style={[styles.field, { flex: 1 }]}>
                                    <Text style={styles.label}>Superficie (m²)</Text>
                                    <NativeInput
                                        placeholder="Ex: 25"
                                        value={variant.superficie || ''}
                                        onChangeText={(text) => handleUpdateVariant(variant.id, 'superficie', text)}
                                        keyboardType="numeric"
                                        style={styles.input}
                                    />
                                </View>
                            </View>

                            {/* Prix par nuit */}
                            <View style={styles.row}>
                                <View style={[styles.field, { flex: 2 }]}>
                                    <Text style={styles.label}>Prix/nuit <Text style={styles.required}>*</Text></Text>
                                    <NativeInput
                                        placeholder="Ex: 45000"
                                        value={variant.prix}
                                        onChangeText={(text) => handleUpdateVariant(variant.id, 'prix', text)}
                                        keyboardType="numeric"
                                        style={styles.input}
                                    />
                                </View>
                                <View style={[styles.field, { flex: 1 }]}>
                                    <Text style={styles.label}>Disponibles</Text>
                                    <NativeInput
                                        placeholder="Ex: 5"
                                        value={variant.nbChambresDisponibles?.toString() || ''}
                                        onChangeText={(text) => handleUpdateVariant(variant.id, 'nbChambresDisponibles', parseInt(text) || 0)}
                                        keyboardType="numeric"
                                        style={styles.input}
                                    />
                                </View>
                            </View>

                            {/* Équipements spécifiques */}
                            <MultiSelectModalitySelector
                                label="Équipements de cette chambre"
                                values={variant.equipements || []}
                                productType="hotellerie"
                                fieldName="equipements"
                                onSelect={(values) => handleUpdateVariant(variant.id, 'equipements', values)}
                                placeholder="Ex: Balcon, Baignoire, Vue mer..."
                                maxSelections={15}
                            />

                            {/* Validation */}
                            {!variant.typeChambre || !variant.capacite || !variant.prix ? (
                                <View style={styles.warningBox}>
                                    <SafeIcon name="alert-circle" size={14} color="#DC2626" />
                                    <Text style={styles.warningText}>
                                        ⚠️ Complétez les champs obligatoires
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.validBox}>
                                    <SafeIcon name="check-circle" size={14} color="#10B981" />
                                    <Text style={styles.validText}>
                                        ✓ {variant.typeChambre} - {variant.capacite} - {variant.prix} XAF/nuit
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                    style={styles.variantsList}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            </View>

            {/* Message si pas de variantes */}
            {variants.length === 0 && (
                <View style={styles.emptyState}>
                    <SafeIcon name="bed" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>Aucun type de chambre ajouté</Text>
                    <Text style={styles.emptySubtext}>
                        Ajoutez les différents types de chambres disponibles dans votre établissement
                    </Text>
                    {!readonly && (
                        <TouchableOpacity style={styles.emptyButton} onPress={handleAddVariant}>
                            <SafeIcon name="plus" size={20} color="#FFF" />
                            <Text style={styles.emptyButtonText}>Ajouter une chambre</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    add3Button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#10B981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    add3ButtonText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    summary: {
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    summaryText: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 4,
    },
    summaryPrice: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.primary,
    },
    hintBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EFF6FF',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
    },
    hintText: {
        flex: 1,
        fontSize: 13,
        color: '#1E40AF',
    },
    variantsContainer: {
        maxHeight: 700,  // ✅ AMÉLIORATION: Augmenté encore plus pour hôtellerie (plus de champs)
        marginBottom: 8,
    },
    variantsList: {
        maxHeight: 700,
    },
    variantCard: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    variantHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    variantNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    variantActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 6,
    },
    imageContainer: {
        marginBottom: 12,
    },
    variantImage: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        resizeMode: 'cover',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    field: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    required: {
        color: '#DC2626',
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEE2E2',
        padding: 8,
        borderRadius: 6,
        marginTop: 8,
    },
    warningText: {
        fontSize: 12,
        color: '#DC2626',
    },
    validBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#D1FAE5',
        padding: 8,
        borderRadius: 6,
        marginTop: 8,
    },
    validText: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 4,
        textAlign: 'center',
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 16,
    },
    emptyButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default HotelVariantManager;


