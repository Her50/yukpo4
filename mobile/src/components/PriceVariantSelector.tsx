/**
 * Composant PriceVariantSelector
 * Sélecteur de variantes de prix pour les produits avec variantes (taille, pointure, quantité, etc.)
 */

import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface PriceModality {
    valeur: string; // Ex: "38", "39", "40"
    prix: number; // Prix numérique (jamais string)
    devise: string; // Ex: "XAF", "EUR"
    stock?: number; // Stock disponible (optionnel)
    image?: string; // Image spécifique à cette modalité (base64 ou URI)
}

interface PriceVariantSelectorProps {
    label?: string;
    variable?: string; // Ex: "pointure", "taille", "quantite"
    modalites: PriceModality[];
    onChange: (modalites: PriceModality[]) => void;
    required?: boolean;
    availableCurrencies?: string[]; // Devises disponibles
    defaultCurrency?: string; // Devise par défaut
    helperText?: string;
    showEmptyStateDetails?: boolean;
}

export const PriceVariantSelector: React.FC<PriceVariantSelectorProps> = ({
    label,
    variable,
    modalites: modalitesProp,
    onChange,
    required = false,
    availableCurrencies = ['XAF', 'EUR', 'USD'],
    defaultCurrency = 'XAF',
    helperText,
    showEmptyStateDetails = true,
}) => {
    // ✅ Protection contre undefined - toujours utiliser un tableau
    const modalites = modalitesProp || [];
    const [showModal, setShowModal] = useState(false);
    const [editingModality, setEditingModality] = useState<PriceModality | null>(null);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [tempModality, setTempModality] = useState<Partial<PriceModality>>({
        valeur: '',
        prix: 0,
        devise: defaultCurrency,
        stock: undefined,
        image: undefined,
    });

    // Ouvrir le modal pour ajouter une nouvelle modalité
    const openAddModal = useCallback(() => {
        setTempModality({
            valeur: '',
            prix: 0,
            devise: defaultCurrency,
            stock: undefined,
            image: undefined,
        });
        setEditingModality(null);
        setEditIndex(null);
        setShowModal(true);
    }, [defaultCurrency]);

    // Ouvrir le modal pour éditer une modalité existante
    const openEditModal = useCallback(
        (modality: PriceModality, index: number) => {
            setTempModality({
                valeur: modality.valeur,
                prix: modality.prix,
                devise: modality.devise,
                stock: modality.stock,
                image: modality.image,
            });
            setEditingModality(modality);
            setEditIndex(index);
            setShowModal(true);
        },
        []
    );

    // Sauvegarder la modalité
    const saveModality = useCallback(() => {
        // Validation
        if (!tempModality.valeur || tempModality.valeur.trim() === '') {
            Alert.alert('Erreur', `Veuillez entrer une valeur pour ${variable}`);
            return;
        }

        if (!tempModality.prix || tempModality.prix <= 0) {
            Alert.alert('Erreur', 'Le prix doit être supérieur à 0');
            return;
        }

        if (!tempModality.devise) {
            Alert.alert('Erreur', 'Veuillez sélectionner une devise');
            return;
        }

        // S'assurer que prix est un nombre (jamais string)
        const prix = typeof tempModality.prix === 'string' ? parseFloat(tempModality.prix) : tempModality.prix;
        if (isNaN(prix) || prix <= 0) {
            Alert.alert('Erreur', 'Le prix doit être un nombre valide');
            return;
        }

        const newModality: PriceModality = {
            valeur: tempModality.valeur.trim(),
            prix: prix, // Toujours un nombre
            devise: tempModality.devise!,
            stock: tempModality.stock && tempModality.stock > 0 ? tempModality.stock : undefined,
            image: tempModality.image,
        };

        const updated = [...modalites];
        if (editIndex !== null) {
            // Modifier existante
            updated[editIndex] = newModality;
        } else {
            // Ajouter nouvelle
            updated.push(newModality);
        }

        onChange(updated);
        setShowModal(false);
        setEditingModality(null);
        setEditIndex(null);
    }, [tempModality, modalites, editIndex, variable, onChange]);

    // Supprimer une modalité
    const removeModality = useCallback(
        (index: number) => {
            // ✅ Protection contre undefined
            if (!modalites || !modalites[index]) {
                console.warn('[PriceVariantSelector] Tentative de suppression d\'une modalité inexistante');
                return;
            }

            Alert.alert(
                'Confirmer',
                `Voulez-vous supprimer la modalité "${modalites[index].valeur}" ?`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: () => {
                            const updated = modalites.filter((_, i) => i !== index);
                            onChange(updated);
                        },
                    },
                ]
            );
        },
        [modalites, onChange]
    );

    // Formater le prix pour affichage
    const formatPrice = useCallback((prix: number, devise: string) => {
        return `${prix.toLocaleString('fr-FR')} ${devise}`;
    }, []);

    const resolvedLabel = label?.trim() || 'Variantes';
    const resolvedVariable = variable?.trim();
    const resolvedHelperText = helperText || 'Modifiez chaque modalité détectée (prix, devise, stock, image) ou ajoutez-en de nouvelles.';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>
                    {resolvedLabel}
                    {resolvedVariable ? ` (${resolvedVariable})` : ''}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
                <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                    <SafeIcon name="plus" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Ajouter une modalité</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>{resolvedHelperText}</Text>

            {/* Liste des modalités */}
            {modalites.length > 0 ? (
                <View style={styles.modalitiesList}>
                    <Text style={styles.modalitiesCount}>
                        {modalites.length} variante{modalites.length > 1 ? 's' : ''} définie{modalites.length > 1 ? 's' : ''}
                    </Text>
                    {modalites.map((modality, index) => (
                        <View key={index} style={styles.modalityItem}>
                            {/* Image de la modalité ou placeholder */}
                            <View style={styles.modalityImageContainer}>
                                {modality.image ? (
                                    <Image
                                        source={{ uri: modality.image.startsWith('data:') ? modality.image : `data:image/jpeg;base64,${modality.image}` }}
                                        style={styles.modalityImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.modalityImagePlaceholder}>
                                        <SafeIcon name="image" size={24} color={modernColors.textTertiary} />
                                    </View>
                                )}
                            </View>

                            <View style={styles.modalityInfo}>
                                <View style={styles.modalityHeader}>
                                    <Text style={styles.modalityValue}>{modality.valeur}</Text>
                                    {modality.stock !== undefined && (
                                        <View style={styles.stockBadge}>
                                            <Text style={styles.stockBadgeText}>Stock: {modality.stock}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.modalityPrice}>
                                    {formatPrice(modality.prix, modality.devise)}
                                </Text>
                            </View>

                            <View style={styles.modalityActions}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => openEditModal(modality, index)}
                                >
                                    <SafeIcon name="edit-2" size={16} color={modernColors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.deleteActionButton]}
                                    onPress={() => removeModality(index)}
                                >
                                    <SafeIcon name="trash-2" size={16} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            ) : showEmptyStateDetails ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyStateIcon}>
                        <SafeIcon name="tag" size={32} color={modernColors.primary} />
                    </View>
                    <Text style={styles.emptyStateTitle}>Aucune variante définie</Text>
                    <Text style={styles.emptyStateText}>
                        Appuyez sur « Ajouter » pour définir une variante (ex: Taille M) et le prix correspondant.
                    </Text>
                </View>
            ) : (
                <TouchableOpacity style={styles.compactEmptyState} onPress={openAddModal}>
                    <SafeIcon name="layers" size={18} color={modernColors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.compactEmptyTitle}>Ajouter une variante</Text>
                        <Text style={styles.compactEmptyText}>Ex: Taille M, Formule VIP, Option Livraison...</Text>
                    </View>
                    <SafeIcon name="plus" size={18} color={modernColors.primary} />
                </TouchableOpacity>
            )}

            {/* Modal d'édition */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editIndex !== null ? 'Modifier' : 'Ajouter'} une modalité
                            </Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => {
                                    setShowModal(false);
                                    setEditingModality(null);
                                    setEditIndex(null);
                                }}
                            >
                                <SafeIcon name="x" size={20} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                            {/* Valeur */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>
                                    Valeur ({variable}) <Text style={styles.required}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={`Ex: 38, 39, 40...`}
                                    placeholderTextColor="#9CA3AF"
                                    value={tempModality.valeur}
                                    onChangeText={(text) => setTempModality({ ...tempModality, valeur: text })}
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Prix */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>
                                    Prix <Text style={styles.required}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor="#9CA3AF"
                                    value={tempModality.prix?.toString() || ''}
                                    onChangeText={(text) => {
                                        const num = parseFloat(text);
                                        setTempModality({
                                            ...tempModality,
                                            prix: isNaN(num) ? 0 : num,
                                        });
                                    }}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.inputHint}>⚠️ Le prix doit être un nombre (jamais texte)</Text>
                            </View>

                            {/* Devise */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>
                                    Devise <Text style={styles.required}>*</Text>
                                </Text>
                                <View style={styles.currencyButtons}>
                                    {availableCurrencies.map((currency) => (
                                        <TouchableOpacity
                                            key={currency}
                                            style={[
                                                styles.currencyButton,
                                                tempModality.devise === currency && styles.currencyButtonActive,
                                            ]}
                                            onPress={() => setTempModality({ ...tempModality, devise: currency })}
                                        >
                                            <Text
                                                style={[
                                                    styles.currencyButtonText,
                                                    tempModality.devise === currency && styles.currencyButtonTextActive,
                                                ]}
                                            >
                                                {currency}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Stock (optionnel) */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Stock (optionnel)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor="#9CA3AF"
                                    value={tempModality.stock?.toString() || ''}
                                    onChangeText={(text) => {
                                        const num = parseInt(text, 10);
                                        setTempModality({
                                            ...tempModality,
                                            stock: isNaN(num) ? undefined : num,
                                        });
                                    }}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.inputHint}>Laisser vide si illimité</Text>
                            </View>

                            {/* Image (optionnel) */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Image spécifique (optionnel)</Text>
                                {tempModality.image ? (
                                    <View style={styles.imagePreviewContainer}>
                                        <Image
                                            source={{ uri: tempModality.image.startsWith('data:') ? tempModality.image : `data:image/jpeg;base64,${tempModality.image}` }}
                                            style={styles.imagePreview}
                                            resizeMode="cover"
                                        />
                                        <TouchableOpacity
                                            style={styles.removeImageButton}
                                            onPress={() => setTempModality({ ...tempModality, image: undefined })}
                                        >
                                            <SafeIcon name="x" size={16} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.uploadImageButton}
                                        onPress={async () => {
                                            try {
                                                const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                                if (!permissionResult.granted) {
                                                    Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
                                                    return;
                                                }

                                                const result = await ImagePicker.launchImageLibraryAsync({
                                                    mediaTypes: ImagePicker.MediaType.Images,
                                                    allowsEditing: true,
                                                    aspect: [4, 3],
                                                    quality: 0.8,
                                                    base64: true,
                                                });

                                                if (!result.canceled && result.assets[0]?.base64) {
                                                    const imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
                                                    setTempModality({ ...tempModality, image: imageBase64 });
                                                }
                                            } catch (error) {
                                                console.error('Erreur sélection image:', error);
                                                Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
                                            }
                                        }}
                                    >
                                        <SafeIcon name="image" size={20} color={modernColors.primary} />
                                        <Text style={styles.uploadImageText}>Ajouter une image</Text>
                                    </TouchableOpacity>
                                )}
                                <Text style={styles.inputHint}>Image spécifique à cette modalité (ex: photo du produit en pointure 38)</Text>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowModal(false);
                                    setEditingModality(null);
                                    setEditIndex(null);
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={saveModality}>
                                <Text style={styles.saveButtonText}>Enregistrer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    required: {
        color: modernColors.error,
    },
    helperText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalitiesList: {
        gap: 12,
    },
    modalitiesCount: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    modalityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    modalityImageContainer: {
        width: 70,
        height: 70,
    },
    modalityImage: {
        width: 70,
        height: 70,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    modalityImagePlaceholder: {
        width: 70,
        height: 70,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderStyle: 'dashed',
    },
    modalityInfo: {
        flex: 1,
        gap: 4,
    },
    modalityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalityValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    stockBadge: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    stockBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
    },
    modalityPrice: {
        fontSize: 18,
        color: modernColors.success,
        fontWeight: '700',
    },
    modalityActions: {
        flexDirection: 'column',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteActionButton: {
        backgroundColor: modernColors.error,
    },
    emptyState: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        borderStyle: 'dashed',
        gap: 12,
    },
    emptyStateIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    compactEmptyState: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: '#F9FAFB',
    },
    compactEmptyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    compactEmptyText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        flex: 1,
    },
    modalBodyContent: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: '#FFFFFF',
    },
    inputHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    currencyButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    currencyButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: '#FFFFFF',
    },
    currencyButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    currencyButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    currencyButtonTextActive: {
        color: '#FFFFFF',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    saveButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    modalityImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    imagePreviewContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    imagePreview: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    removeImageButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 20,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadImageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderStyle: 'dashed',
        backgroundColor: '#F9FAFB',
    },
    uploadImageText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default PriceVariantSelector;

