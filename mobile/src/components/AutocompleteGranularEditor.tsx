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
import { useLanguageSafe } from '../contexts/LanguageContext';

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
        const { t } = useLanguageSafe();
const [showModal, setShowModal] = useState(false);
    const [currentValues, setCurrentValues] = useState<string[]>(value || []);
    const [subCharacteristics, setSubCharacteristics] = useState<SubCharacteristicInput[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [showAddCustomModal, setShowAddCustomModal] = useState(false);
    const [customModalityLabel, setCustomModalityLabel] = useState('');
    const [customModalityValue, setCustomModalityValue] = useState('');

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

    // Helper pour obtenir un exemple de valeur selon les données de l'IA
    const getSampleValue = (fieldName: string): string => {
        // Utiliser les valeurs réelles fournies par l'IA si disponibles
        const values = sousCaracteristiques[fieldName];
        if (Array.isArray(values) && values.length > 0) {
            // Prendre la première valeur comme exemple
            const firstValue = values[0];
            return `Ex: ${firstValue}${values.length > 1 ? ', ' + values[1] : ''}...`;
        }

        // Fallback générique si pas de données IA
        return 'Tapez pour rechercher...';
    };

    const renderSubCharacteristicInput = (subChar: SubCharacteristicInput, index: number) => {
        return (
            <View key={subChar.name} style={styles.subCharContainer}>
                <Text style={styles.subCharLabel}>
                    {subChar.name}
                </Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={`Ex: ${getSampleValue(subChar.name)}`}
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

                {/* Suggestions avec boutons d'action */}
                {subChar.suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        <Text style={styles.suggestionsHeader}>
                            💡 {subChar.suggestions.length} suggestion(s) trouvée(s) :
                        </Text>
                        {subChar.suggestions.map((suggestion, idx) => (
                            <View key={idx} style={styles.suggestionItem}>
                                <TouchableOpacity
                                    style={styles.suggestionTextContainer}
                                    onPress={() => selectSuggestion(index, suggestion)}
                                >
                                    <SafeIcon name="search" size={14} color={modernColors.primary} />
                                    <Text style={styles.suggestionText}>{suggestion}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.suggestionEditButton}
                                    onPress={() => {
                                        // Pré-remplir avec la suggestion
                                        const updated = [...subCharacteristics];
                                        updated[index] = {
                                            ...updated[index],
                                            value: suggestion,
                                            suggestions: [],
                                        };
                                        setSubCharacteristics(updated);
                                    }}
                                >
                                    <SafeIcon name="edit" size={12} color={modernColors.primary} />
                                    <Text style={styles.suggestionEditText}>{t('autocompleteGranularEditor.modifier')}</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                        <Text style={styles.suggestionsFooter}>
                            Cliquez directement pour ajouter, ou sur "Modifier" pour personnaliser avant d'ajouter
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    // Générer un exemple dynamique basé sur les sous-caractéristiques de l'IA
    const generateDynamicExample = () => {
        const subCharNames = Object.keys(sousCaracteristiques);
        if (subCharNames.length === 0) return '';

        // Créer un exemple avec les noms des caractéristiques ET un exemple de valeur réel de l'IA
        const exampleParts = subCharNames.slice(0, 3).map(name => {
            const values = sousCaracteristiques[name];
            // Utiliser la première valeur fournie par l'IA comme exemple
            const firstValue = Array.isArray(values) && values.length > 0 ? values[0] : '';
            return firstValue;
        }).filter(Boolean);

        // Afficher les noms des caractéristiques à rechercher (max 4)
        const charNames = subCharNames.slice(0, 4).join(', ');

        if (exampleParts.length > 0) {
            // Utiliser les vraies valeurs générées par l'IA comme exemples
            return `Tapez pour rechercher: ${charNames} - Ex: ${exampleParts.join(', ')}`;
        }
        return `Tapez pour rechercher: ${charNames}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
                <Text style={styles.helperText}>
                    💡 Tapez pour rechercher les caractéristiques de votre produit et modifiez si besoin
                    {generateDynamicExample() && (
                        <Text style={styles.exampleText}> • {generateDynamicExample()}</Text>
                    )}
                </Text>
            </View>

            {/* Champ de saisie rapide avec bouton Ajouter aligné */}
            <View style={styles.quickInputWrapper}>
                <Text style={styles.quickInputLabel}>
                    📝 {currentValues.length > 0 ? t('autocompleteGranularEditor.ajoutees', { currentValues_length: currentValues.length }) : t('autocompleteGranularEditor.aucuneCaracteristiqueAjoutee')}
                </Text>
                <TouchableOpacity
                    style={styles.quickInputContainer}
                    activeOpacity={0.7}
                    onPress={() => {
                        setEditingIndex(null);
                        setShowModal(true);
                    }}
                >
                    <View style={styles.quickInput}>
                        <Text style={currentValues.length > 0 ? styles.quickInputText : styles.quickInputPlaceholder}>
                            {currentValues.length > 0
                                ? 'Cliquez pour modifier ou ajouter'
                                : (placeholder || "Cliquez sur Ajouter pour commencer")}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => {
                            setEditingIndex(null);
                            setShowModal(true);
                        }}
                    >
                        <SafeIcon name="plus" size={18} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>{t('autocompleteGranularEditor.ajouter')}</Text>
                    </TouchableOpacity>
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
                                style={styles.addCustomButton}
                                onPress={() => {
                                    setShowAddCustomModal(true);
                                }}
                            >
                                <SafeIcon name="plus-circle" size={18} color={modernColors.primary} />
                                <Text style={styles.addCustomButtonText}>{t('autocompleteGranularEditor.ajouterCaracteristique')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowModal(false);
                                    setEditingIndex(null);
                                }}
                            >
                                <Text style={styles.cancelButtonText}>{t('autocompleteGranularEditor.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                                <Text style={styles.saveButtonText}>{t('autocompleteGranularEditor.enregistrer')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal d'ajout de modalité personnalisée */}
            <Modal
                visible={showAddCustomModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowAddCustomModal(false)}
            >
                <View style={styles.customModalOverlay}>
                    <View style={styles.customModalContent}>
                        <View style={styles.customModalHeader}>
                            <SafeIcon name="plus-circle" size={24} color={modernColors.primary} />
                            <Text style={styles.customModalTitle}>{t('autocompleteGranularEditor.ajouterUneCaracteristique')}</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => {
                                    setShowAddCustomModal(false);
                                    setCustomModalityLabel('');
                                    setCustomModalityValue('');
                                }}
                            >
                                <SafeIcon name="x" size={20} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.customModalBody}>
                            <Text style={styles.customModalDescription}>
                                Ajoutez une nouvelle caractéristique qui n'est pas dans la liste
                            </Text>

                            <View style={styles.customInputContainer}>
                                <Text style={styles.customInputLabel}>{t('autocompleteGranularEditor.nomDeLaCaracteristique')}</Text>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder={t('autocompleteGranularEditor.exCouleurTailleMatiere')}
                                    placeholderTextColor="#9CA3AF"
                                    value={customModalityLabel}
                                    onChangeText={setCustomModalityLabel}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.customInputContainer}>
                                <Text style={styles.customInputLabel}>Valeur</Text>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder="Ex: Noir, XL, Coton..."
                                    placeholderTextColor="#9CA3AF"
                                    value={customModalityValue}
                                    onChangeText={setCustomModalityValue}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                        </View>

                        <View style={styles.customModalFooter}>
                            <TouchableOpacity
                                style={styles.customCancelButton}
                                onPress={() => {
                                    setShowAddCustomModal(false);
                                    setCustomModalityLabel('');
                                    setCustomModalityValue('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>{t('autocompleteGranularEditor.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.customSaveButton,
                                    (!customModalityLabel || !customModalityValue) && styles.customSaveButtonDisabled
                                ]}
                                onPress={() => {
                                    if (!customModalityLabel || !customModalityValue) return;

                                    // Ajouter la nouvelle caractéristique
                                    const updated = [...subCharacteristics];
                                    const existingIndex = updated.findIndex(s => s.name.toLowerCase() === customModalityLabel.toLowerCase());

                                    if (existingIndex >= 0) {
                                        // Si la caractéristique existe déjà, mettre à jour sa valeur
                                        updated[existingIndex] = {
                                            ...updated[existingIndex],
                                            value: customModalityValue,
                                            suggestions: []
                                        };
                                    } else {
                                        // Sinon, ajouter une nouvelle entrée
                                        updated.push({
                                            name: customModalityLabel.trim(),
                                            value: customModalityValue.trim(),
                                            suggestions: [],
                                            isLoading: false
                                        });
                                    }

                                    setSubCharacteristics(updated);
                                    setShowAddCustomModal(false);
                                    setCustomModalityLabel('');
                                    setCustomModalityValue('');
                                }}
                                disabled={!customModalityLabel || !customModalityValue}
                            >
                                <SafeIcon name="check" size={18} color="#FFFFFF" />
                                <Text style={styles.customSaveButtonText}>{t('autocompleteGranularEditor.ajouter')}</Text>
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
        marginBottom: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    helperText: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
        lineHeight: 13,
    },
    exampleText: {
        fontSize: 9,
        color: modernColors.primary,
        fontWeight: '600',
    },
    required: {
        color: modernColors.error,
    },
    quickInputWrapper: {
        marginBottom: 12,
    },
    quickInputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 6,
    },
    quickInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quickInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        minHeight: 44,
    },
    quickInputText: {
        fontSize: 14,
        color: modernColors.text,
    },
    quickInputPlaceholder: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
        minWidth: 100,
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
    subCharHint: {
        fontSize: 11,
        fontWeight: '400',
        color: modernColors.textSecondary,
        textTransform: 'none',
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
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 8,
        gap: 6,
    },
    suggestionsHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 4,
    },
    suggestionsFooter: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginTop: 6,
        fontStyle: 'italic',
        lineHeight: 13,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
        padding: 8,
        gap: 8,
    },
    suggestionTextContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    suggestionText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    suggestionEditButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0E7FF', // Bleu clair pour le bouton Modifier
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 4,
        gap: 4,
    },
    suggestionEditText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
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
    addCustomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    addCustomButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    customModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    customModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    customModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 12,
    },
    customModalTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    customModalBody: {
        padding: 20,
        gap: 20,
    },
    customModalDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    customInputContainer: {
        gap: 8,
    },
    customInputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    customInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: '#F9FAFB',
    },
    customModalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    customCancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    customSaveButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 6,
    },
    customSaveButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.5,
    },
    customSaveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default AutocompleteGranularEditor;

