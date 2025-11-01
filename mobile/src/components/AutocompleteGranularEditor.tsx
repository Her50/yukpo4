/**
 * Composant AutocompleteGranularEditor
 * Éditeur granulaire pour les champs autocomplete avec suggestions intelligentes
 * Permet de gérer les sous-caractéristiques séparément (marque, modèle, année, etc.)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { autocompleteHistoryService } from '../services/autocompleteHistoryService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface AutocompleteGranularEditorProps {
    label: string;
    identifiantBase: string;
    sousCaracteristiques: Record<string, string[]>; // Ex: { marque: [], modele: [], annee: [] }
    separateur: string; // Ex: ","
    value: string[]; // Valeurs concaténées existantes: ["Toyota,RAV4,2018,4x4"]
    onChange: (values: string[]) => void;
    required?: boolean;
    placeholder?: string;
    allowCustomModality?: boolean;
    filtrable?: boolean;
}

interface SubCharacteristicInput {
    name: string;
    value: string;
    suggestions: string[];
    isLoading: boolean;
}

export const AutocompleteGranularEditor: React.FC<AutocompleteGranularEditorProps> = ({
    label,
    identifiantBase,
    sousCaracteristiques,
    separateur,
    value,
    onChange,
    required = false,
    placeholder,
    allowCustomModality = true,
    filtrable = true,
}) => {
    const [showModal, setShowModal] = useState(false);
    const [currentValues, setCurrentValues] = useState<string[]>(value || []);
    const [subCharacteristics, setSubCharacteristics] = useState<SubCharacteristicInput[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    // Initialiser les sous-caractéristiques
    useEffect(() => {
        const subCharNames = Object.keys(sousCaracteristiques);
        const initialSubChars: SubCharacteristicInput[] = subCharNames.map((name) => ({
            name,
            value: '',
            suggestions: [],
            isLoading: false,
        }));
        setSubCharacteristics(initialSubChars);

        // Décomposer les valeurs existantes si présentes
        if (value && value.length > 0) {
            const decomposed = value.map((val) => {
                const parts = val.split(separateur).map((s) => s.trim());
                const decomposedObj: Record<string, string> = {};
                subCharNames.forEach((name, idx) => {
                    decomposedObj[name] = parts[idx] || '';
                });
                return decomposedObj;
            });
            // Utiliser la première valeur pour pré-remplir
            if (decomposed.length > 0) {
                const first = decomposed[0];
                const updated = initialSubChars.map((sub) => ({
                    ...sub,
                    value: first[sub.name] || '',
                }));
                setSubCharacteristics(updated);
            }
        }
    }, [identifiantBase, sousCaracteristiques, separateur, value]);

    // Charger les suggestions pour une sous-caractéristique
    const loadSuggestions = useCallback(
        async (subCharName: string, prefix: string) => {
            if (!prefix || prefix.length < 1) {
                return [];
            }

            setIsLoadingSuggestions(true);
            try {
                const suggestions = await autocompleteHistoryService.getSuggestions(
                    identifiantBase,
                    subCharName,
                    prefix,
                    10
                );
                return suggestions.map((s) => s.valeur);
            } catch (error) {
                console.error(`[AutocompleteGranularEditor] Erreur chargement suggestions pour ${subCharName}:`, error);
                return [];
            } finally {
                setIsLoadingSuggestions(false);
            }
        },
        [identifiantBase]
    );

    // Mettre à jour une sous-caractéristique
    const updateSubCharacteristic = useCallback(
        async (index: number, newValue: string) => {
            const updated = [...subCharacteristics];
            updated[index] = {
                ...updated[index],
                value: newValue,
                suggestions: [],
                isLoading: false,
            };

            // Charger les suggestions si on tape
            if (newValue.length >= 1 && filtrable) {
                updated[index].isLoading = true;
                setSubCharacteristics(updated);

                const suggestions = await loadSuggestions(updated[index].name, newValue);
                updated[index].suggestions = suggestions;
                updated[index].isLoading = false;
            }

            setSubCharacteristics(updated);
        },
        [subCharacteristics, loadSuggestions, filtrable]
    );

    // Sélectionner une suggestion
    const selectSuggestion = useCallback(
        (subCharIndex: number, suggestion: string) => {
            const updated = [...subCharacteristics];
            updated[subCharIndex] = {
                ...updated[subCharIndex],
                value: suggestion,
                suggestions: [],
            };
            setSubCharacteristics(updated);
        },
        [subCharacteristics]
    );

    // Ajouter une nouvelle valeur concaténée
    const addValue = useCallback(() => {
        const concatenated = subCharacteristics.map((sub) => sub.value.trim()).join(separateur);
        if (concatenated && concatenated.split(separateur).some((part) => part.trim())) {
            const newValues = [...currentValues, concatenated];
            setCurrentValues(newValues);
            onChange(newValues);

            // Historiser la nouvelle valeur
            autocompleteHistoryService
                .historizeField(
                    identifiantBase,
                    [concatenated],
                    separateur,
                    sousCaracteristiques,
                    'utilisateur'
                )
                .catch((error) => {
                    console.error('[AutocompleteGranularEditor] Erreur historisation:', error);
                });

            // Réinitialiser les champs
            const reset = subCharacteristics.map((sub) => ({
                ...sub,
                value: '',
                suggestions: [],
            }));
            setSubCharacteristics(reset);
        }
    }, [subCharacteristics, currentValues, separateur, identifiantBase, sousCaracteristiques, onChange]);

    // Supprimer une valeur
    const removeValue = useCallback(
        (index: number) => {
            const newValues = currentValues.filter((_, i) => i !== index);
            setCurrentValues(newValues);
            onChange(newValues);
        },
        [currentValues, onChange]
    );

    // Éditer une valeur existante
    const editValue = useCallback(
        (index: number) => {
            const val = currentValues[index];
            const parts = val.split(separateur).map((s) => s.trim());
            const updated = subCharacteristics.map((sub, idx) => ({
                ...sub,
                value: parts[idx] || '',
            }));
            setSubCharacteristics(updated);
            setEditingIndex(index);
            setShowModal(true);
        },
        [currentValues, separateur, subCharacteristics]
    );

    // Sauvegarder l'édition
    const saveEdit = useCallback(() => {
        const concatenated = subCharacteristics.map((sub) => sub.value.trim()).join(separateur);
        if (concatenated && concatenated.split(separateur).some((part) => part.trim())) {
            const newValues = [...currentValues];
            if (editingIndex !== null) {
                newValues[editingIndex] = concatenated;
            } else {
                newValues.push(concatenated);
            }
            setCurrentValues(newValues);
            onChange(newValues);
            setShowModal(false);
            setEditingIndex(null);
        }
    }, [subCharacteristics, currentValues, editingIndex, separateur, onChange]);

    const renderSubCharacteristicInput = (subChar: SubCharacteristicInput, index: number) => {
        return (
            <View key={subChar.name} style={styles.subCharContainer}>
                <Text style={styles.subCharLabel}>{subChar.name}</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={`Entrez ${subChar.name}...`}
                        placeholderTextColor="#9CA3AF"
                        value={subChar.value}
                        onChangeText={(text) => updateSubCharacteristic(index, text)}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {subChar.isLoading && (
                        <ActivityIndicator size="small" color={modernColors.primary} style={styles.loader} />
                    )}
                </View>

                {/* Suggestions */}
                {subChar.suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        {subChar.suggestions.map((suggestion, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.suggestionItem}
                                onPress={() => selectSuggestion(index, suggestion)}
                            >
                                <SafeIcon name="search" size={14} color={modernColors.primary} />
                                <Text style={styles.suggestionText}>{suggestion}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        setEditingIndex(null);
                        setShowModal(true);
                    }}
                >
                    <SafeIcon name="plus" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Ajouter</Text>
                </TouchableOpacity>
            </View>

            {/* Liste des valeurs existantes */}
            {currentValues.length > 0 && (
                <View style={styles.valuesList}>
                    {currentValues.map((val, index) => (
                        <View key={index} style={styles.valueItem}>
                            <Text style={styles.valueText}>{val}</Text>
                            <View style={styles.valueActions}>
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => editValue(index)}
                                >
                                    <SafeIcon name="edit" size={14} color={modernColors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => removeValue(index)}
                                >
                                    <SafeIcon name="trash" size={14} color={modernColors.error} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
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
                                {editingIndex !== null ? 'Modifier' : 'Ajouter'} {label}
                            </Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => {
                                    setShowModal(false);
                                    setEditingIndex(null);
                                }}
                            >
                                <SafeIcon name="x" size={20} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={subCharacteristics}
                            keyExtractor={(item) => item.name}
                            renderItem={({ item, index }) => renderSubCharacteristicInput(item, index)}
                            contentContainerStyle={styles.modalBody}
                        />

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowModal(false);
                                    setEditingIndex(null);
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
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
    valuesList: {
        gap: 8,
    },
    valueItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    valueText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    valueActions: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        padding: 4,
    },
    deleteButton: {
        padding: 4,
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
        padding: 16,
    },
    subCharContainer: {
        marginBottom: 16,
    },
    subCharLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
        textTransform: 'capitalize',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    loader: {
        marginLeft: 8,
    },
    suggestionsContainer: {
        marginTop: 8,
        gap: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 6,
        gap: 8,
    },
    suggestionText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
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
});

export default AutocompleteGranularEditor;

