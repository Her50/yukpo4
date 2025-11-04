/**
 * LinearAutocompleteEditor - Version 3.0 (2025-11-04)
 * Affiche et édite le vecteur autocomplete généré par l'IA
 * ✅ NOUVEAU : Suggestions populaires depuis autocomplete_combinations
 */

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface LinearAutocompleteEditorProps {
    label: string;
    identifiantBase: string;
    sousCaracteristiques: Record<string, string[]>; // { marque: ["Nike"], pointure: ["38", "39", "40"] }
    separateur: string;
    value: string[]; // ["Nike,Air Max,Noir,40"] - Position 0 affichée
    onChange: (values: string[], updatedSousCaracs?: Record<string, string[]>) => void; // ✅ NOUVEAU: passer aussi sous-caracs
    required?: boolean;
    readonly?: boolean;
}

interface ChipData {
    key: string;      // "marque"
    value: string;    // "Nike"
    index: number;    // Position dans vecteur
}

interface PopularProduct {
    product_vector: string[];
    product_labels: string[];
    usage_count: number;
    prix_moyen?: number;
    has_variant: boolean;
    variant_dimension?: string;
    is_trending: boolean;  // ✅ Tendance (actif dans les 7 derniers jours)
}

export const LinearAutocompleteEditor: React.FC<LinearAutocompleteEditorProps> = ({
    label,
    identifiantBase,
    sousCaracteristiques,
    separateur,
    value,
    onChange,
    required = false,
    readonly = false,
}) => {
    // État : Affiche la première valeur (combinaison de référence)
    const displayValue = value && value.length > 0 ? value[0] : '';

    const [showEditModal, setShowEditModal] = useState(false);
    const [editingChipIndex, setEditingChipIndex] = useState<number | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCharKey, setNewCharKey] = useState('');
    const [newCharValue, setNewCharValue] = useState('');

    // ✅ NOUVEAU 2025-11-04 : Recherche progressive
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<PopularProduct[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Décomposer le vecteur en chips
    const parseVectorToChips = (vectorStr: string): ChipData[] => {
        const parts = vectorStr.split(separateur).map(p => p.trim()).filter(p => p);
        const subCharKeys = Object.keys(sousCaracteristiques);

        return parts.map((value, index) => ({
            key: subCharKeys[index] || `dimension_${index}`,
            value: value,
            index: index,
        }));
    };

    const chips = displayValue ? parseVectorToChips(displayValue) : [];

    // ✅ NOUVEAU 2025-11-04 : Recherche progressive dans autocomplete_combinations
    useEffect(() => {
        if (searchQuery.trim().length >= 2) {
            searchSuggestions(searchQuery);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [searchQuery]);

    const searchSuggestions = async (query: string) => {
        setLoadingSuggestions(true);
        setShowSuggestions(true); // ✅ CORRECTION: Afficher tout de suite (même pendant loading)
        
        try {
            console.log('[LinearAutocompleteEditor] 🔍 Recherche suggestions pour:', query);
            const response = await apiGet(
                `/api/products/popular?search=${encodeURIComponent(query)}&limit=8`
            );

            console.log('[LinearAutocompleteEditor] 📦 Réponse API:', response);

            if (response.success && response.data) {
                const products = response.data as PopularProduct[];
                console.log('[LinearAutocompleteEditor] ✅ Suggestions trouvées:', products.length);
                setSuggestions(products);
                // Garder showSuggestions à true même si aucune suggestion
            } else {
                console.log('[LinearAutocompleteEditor] ⚠️ Aucune suggestion reçue');
                setSuggestions([]);
            }
        } catch (error) {
            console.error('[LinearAutocompleteEditor] ❌ Erreur recherche suggestions:', error);
            setSuggestions([]);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Sélectionner une suggestion
    const selectSuggestion = (product: PopularProduct) => {
        const newVector = product.product_vector.join(separateur);

        // Mettre à jour sousCaracteristiques avec les labels du produit sélectionné
        const updatedSousCaracs: Record<string, string[]> = {};
        product.product_labels.forEach((label, index) => {
            if (!updatedSousCaracs[label]) {
                updatedSousCaracs[label] = [];
            }
            updatedSousCaracs[label].push(product.product_vector[index]);
        });

        onChange([newVector], updatedSousCaracs);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    // Modifier une caractéristique
    const handleModifyChip = (chipIndex: number) => {
        setEditingChipIndex(chipIndex);
        setShowEditModal(true);
    };

    // Sauvegarder modification
    const saveChipModification = (newValue: string) => {
        if (!newValue.trim() || editingChipIndex === null) return;

        const parts = displayValue.split(separateur).map(p => p.trim());
        parts[editingChipIndex] = newValue.trim();

        const newVector = parts.join(separateur);
        onChange([newVector]);

        setShowEditModal(false);
        setEditingChipIndex(null);
    };

    // Supprimer une caractéristique
    const handleDeleteChip = (chipIndex: number) => {
        Alert.alert(
            'Supprimer caractéristique',
            `Êtes-vous sûr de vouloir supprimer "${chips[chipIndex].value}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                        const parts = displayValue.split(separateur).map(p => p.trim());
                        parts.splice(chipIndex, 1);

                        const newVector = parts.join(separateur);
                        onChange([newVector]);
                    }
                }
            ]
        );
    };

    // Ajouter nouvelle caractéristique
    const handleAddCharacteristic = () => {
        if (!newCharValue.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir une valeur');
            return;
        }

        const parts = displayValue ? displayValue.split(separateur).map(p => p.trim()) : [];
        parts.push(newCharValue.trim());

        const newVector = parts.join(separateur);

        // ✅ CORRECTION 2025-11-04: Mettre à jour sousCaracteristiques avec le nouveau label
        const updatedSousCaracs = { ...sousCaracteristiques };
        if (newCharKey.trim()) {
            // Ajouter le label avec la valeur
            if (!updatedSousCaracs[newCharKey.trim()]) {
                updatedSousCaracs[newCharKey.trim()] = [];
            }
            if (!updatedSousCaracs[newCharKey.trim()].includes(newCharValue.trim())) {
                updatedSousCaracs[newCharKey.trim()].push(newCharValue.trim());
            }
        }

        // Passer le vecteur ET les sous-caractéristiques mises à jour
        onChange([newVector], updatedSousCaracs);

        setShowAddModal(false);
        setNewCharKey('');
        setNewCharValue('');
    };

    if (readonly) {
        return (
            <View style={styles.container}>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.chipsContainer}>
                    {chips.map((chip, index) => (
                        <View key={index} style={styles.chipReadonly}>
                            <Text style={styles.chipKey}>{chip.key}:</Text>
                            <Text style={styles.chipValue}>{chip.value}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    // ✅ CORRECTION 2025-11-04: Placeholder dynamique depuis la valeur IA (value[0])
    const generatePlaceholder = (): string => {
        // ✅ PRIORITÉ 1: Si un vecteur existe déjà (de l'IA), l'utiliser comme exemple
        if (value && value.length > 0 && value[0]) {
            const firstValues = value[0].split(separateur).slice(0, 4).join(' • ');
            return `${firstValues}... 🤖 IA`;
        }
        
        // ✅ PRIORITÉ 2: Exemple générique basé sur les sous-caractéristiques IA
        if (Object.keys(sousCaracteristiques).length > 0) {
            const exampleParts = Object.keys(sousCaracteristiques).slice(0, 4).map((key) => {
                const values = sousCaracteristiques[key];
                return values && values.length > 0 ? values[0] : key;
            });
            return exampleParts.length > 0
                ? `Ex: ${exampleParts.join(' • ')}...`
                : 'Rechercher un produit populaire...';
        }
        
        // ✅ PRIORITÉ 3: Fallback générique
        return 'Rechercher un produit populaire...';
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
                <Text style={styles.helperText}>
                    🤖 Généré par l'IA - Modifiable
                </Text>
            </View>

            {/* ✅ NOUVEAU : Champ de recherche */}
            <View style={styles.searchContainer}>
                <SafeIcon name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={generatePlaceholder()}
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onFocus={() => setShowSuggestions(searchQuery.trim().length >= 2)}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setShowSuggestions(false); }}>
                        <SafeIcon name="x" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ✅ Suggestions progressives */}
            {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>📦 Suggestions populaires</Text>
                    {loadingSuggestions && <ActivityIndicator size="small" color={modernColors.primary} style={{ marginVertical: 12 }} />}
                    
                    {!loadingSuggestions && suggestions.length === 0 && searchQuery.trim().length >= 2 && (
                        <View style={styles.noSuggestionsContainer}>
                            <SafeIcon name="info" size={20} color="#9CA3AF" />
                            <Text style={styles.noSuggestionsText}>
                                Aucun produit populaire trouvé pour "{searchQuery}"
                            </Text>
                            <Text style={styles.noSuggestionsHint}>
                                💡 Essayez avec d'autres mots-clés ou créez votre propre combinaison
                            </Text>
                        </View>
                    )}
                    
                    {suggestions.map((product, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.suggestionItem}
                            onPress={() => selectSuggestion(product)}
                        >
                            <View style={styles.suggestionContent}>
                                <Text style={styles.suggestionVector} numberOfLines={1}>
                                    {product.product_vector.join(' • ')}
                                </Text>
                                <View style={styles.suggestionMeta}>
                                    {product.is_trending && (
                                        <View style={styles.trendingBadge}>
                                            <Text style={styles.trendingText}>📈 TENDANCE</Text>
                                        </View>
                                    )}
                                    <Text style={styles.suggestionCount}>
                                        👥 {product.usage_count} vendeur{product.usage_count > 1 ? 's' : ''}
                                    </Text>
                                    {product.prix_moyen && (
                                        <Text style={styles.suggestionPrice}>
                                            💰 {product.prix_moyen.toFixed(0)} XAF
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <SafeIcon name="chevron-right" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Vecteur affiché en chips */}
            {chips.length > 0 ? (
                <View style={styles.vectorContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsScroll}
                    >
                        {chips.map((chip, index) => (
                            <View key={index} style={styles.chip}>
                                <View style={styles.chipContent}>
                                    <Text style={styles.chipKey}>{chip.key}</Text>
                                    <Text style={styles.chipValue}>{chip.value}</Text>
                                </View>
                                <View style={styles.chipActions}>
                                    <TouchableOpacity
                                        style={styles.chipButton}
                                        onPress={() => handleModifyChip(index)}
                                    >
                                        <SafeIcon name="edit-2" size={14} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.chipButton}
                                        onPress={() => handleDeleteChip(index)}
                                    >
                                        <SafeIcon name="trash-2" size={14} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* ✅ NOUVEAU : Bouton édition quand vecteur sélectionné */}
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setShowAddModal(true)}
                    >
                        <SafeIcon name="edit-3" size={16} color={modernColors.primary} />
                        <Text style={styles.editButtonText}>Éditer</Text>
                    </TouchableOpacity>
                </View>
            ) : null}


            {/* Modal Édition */}
            <Modal
                visible={showEditModal && editingChipIndex !== null}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Modifier {editingChipIndex !== null ? chips[editingChipIndex]?.key : ''}
                            </Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {editingChipIndex !== null && (
                            <View style={styles.modalBody}>
                                <Text style={styles.modalLabel}>Valeur actuelle</Text>
                                <Text style={styles.currentValue}>{chips[editingChipIndex]?.value}</Text>

                                {/* Options disponibles si définies par l'IA */}
                                {sousCaracteristiques[chips[editingChipIndex]?.key] && (
                                    <View style={styles.optionsSection}>
                                        <Text style={styles.optionsTitle}>Options suggérées :</Text>
                                        <ScrollView style={styles.optionsList}>
                                            {sousCaracteristiques[chips[editingChipIndex]?.key].map((option, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[
                                                        styles.optionItem,
                                                        option === chips[editingChipIndex]?.value && styles.optionItemSelected
                                                    ]}
                                                    onPress={() => saveChipModification(option)}
                                                >
                                                    <Text style={[
                                                        styles.optionText,
                                                        option === chips[editingChipIndex]?.value && styles.optionTextSelected
                                                    ]}>
                                                        {option}
                                                    </Text>
                                                    {option === chips[editingChipIndex]?.value && (
                                                        <SafeIcon name="check" size={16} color={modernColors.primary} />
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowEditModal(false)}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal Ajout */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ajouter une caractéristique</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Type de caractéristique</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: matière, couleur, taille..."
                                value={newCharKey}
                                onChangeText={setNewCharKey}
                            />

                            <Text style={styles.modalLabel}>Valeur</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: Cuir, Rouge, XL..."
                                value={newCharValue}
                                onChangeText={setNewCharValue}
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowAddModal(false)}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleAddCharacteristic}
                                >
                                    <SafeIcon name="plus" size={16} color="#FFF" />
                                    <Text style={styles.saveButtonText}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    header: {
        gap: 4,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    required: {
        color: '#EF4444',
    },
    helperText: {
        fontSize: 13,
        color: '#6B7280',
    },
    vectorContainer: {
        gap: 12,
    },
    chipsScroll: {
        gap: 8,
        paddingVertical: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipContent: {
        gap: 2,
    },
    chipKey: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '500',
    },
    chipValue: {
        fontSize: 14,
        color: '#1F2937',
        fontWeight: '600',
    },
    chipActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 8,
        paddingLeft: 8,
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
    },
    chipButton: {
        padding: 4,
    },
    chipReadonly: {
        flexDirection: 'row',
        gap: 4,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addChipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 12,
        borderStyle: 'dashed',
    },
    addChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    addFirstButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    addFirstButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    modalBody: {
        padding: 20,
        gap: 16,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    currentValue: {
        fontSize: 16,
        color: '#6B7280',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    optionsSection: {
        gap: 8,
    },
    optionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    optionsList: {
        maxHeight: 200,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 8,
    },
    optionItemSelected: {
        backgroundColor: modernColors.primaryLight || '#EEF2FF',
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    optionText: {
        fontSize: 15,
        color: '#1F2937',
    },
    optionTextSelected: {
        fontWeight: '600',
        color: modernColors.primary,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: '#1F2937',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    saveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },
    // ✅ NOUVEAU : Styles produits populaires
    popularButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        marginTop: 12,
    },
    popularButtonEmoji: {
        fontSize: 18,
    },
    popularButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        flex: 1,
    },
    popularCountBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 24,
        alignItems: 'center',
    },
    popularCountText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
    },
    popularSection: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
        maxHeight: 400,
    },
    loadingPopularContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 20,
    },
    loadingPopularText: {
        fontSize: 14,
        color: '#6B7280',
    },
    popularSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 12,
    },
    popularList: {
        maxHeight: 350,
    },
    popularCard: {
        backgroundColor: '#FFF',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        position: 'relative',
    },
    popularCardTrending: {
        borderColor: '#EF4444',
        borderWidth: 2,
        backgroundColor: '#FEF2F2',
    },
    trendingBadgeSmall: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        zIndex: 10,
    },
    trendingBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    popularCardContent: {
        gap: 10,
        marginBottom: 10,
    },
    popularChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    popularChip: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    popularChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    popularStats: {
        gap: 4,
    },
    popularUsage: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EF4444',
    },
    popularPriceText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#059669',
    },
    popularVariantText: {
        fontSize: 12,
        color: '#6B7280',
    },
    popularSelectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: modernColors.primary,
        paddingVertical: 8,
        borderRadius: 8,
    },
    popularSelectText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFF',
    },
    noPopularContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    noPopularText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    // ✅ NOUVEAU 2025-11-04: Styles pour suggestions autocomplete
    suggestionsContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionContent: {
        flex: 1,
        gap: 6,
    },
    suggestionVector: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    suggestionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    trendingBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    trendingText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    suggestionCount: {
        fontSize: 11,
        color: '#6B7280',
    },
    suggestionPrice: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    noSuggestionsContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    noSuggestionsText: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
    },
    noSuggestionsHint: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchIcon: {
        marginRight: 4,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
        paddingVertical: 4,
    },
});

export default LinearAutocompleteEditor;
