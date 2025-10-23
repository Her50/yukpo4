import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getFieldOptions } from '../data/productModalities';
import { modalityService } from '../services/modalityService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface MultiSelectModalitySelectorProps {
    label: string;
    values: string[];
    productType: string;
    fieldName: string;
    onSelect: (values: string[]) => void;
    required?: boolean;
    placeholder?: string;
    maxSelections?: number;
}

const MultiSelectModalitySelector: React.FC<MultiSelectModalitySelectorProps> = ({
    label,
    values,
    productType,
    fieldName,
    onSelect,
    required = false,
    placeholder = 'Sélectionner...',
    maxSelections = 10
}) => {
    const [allOptions, setAllOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Charger les options (statiques + personnalisées)
    useEffect(() => {
        loadOptions();
    }, [productType, fieldName]);

    const loadOptions = async () => {
        setLoading(true);
        try {
            // Options statiques de base
            const staticOptions = getFieldOptions(productType, fieldName);

            // Options personnalisées depuis le serveur
            const customOptions = await modalityService.getModalitiesForField(productType, fieldName);

            // Combiner les options (statiques + personnalisées, sans doublons)
            const combinedOptions = [...new Set([...staticOptions, ...customOptions])];

            setAllOptions(combinedOptions);
        } catch (error) {
            console.error('[MultiSelectModalitySelector] Erreur chargement options:', error);
            // En cas d'erreur, utiliser seulement les options statiques
            setAllOptions(getFieldOptions(productType, fieldName));
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (option: string) => {
        if (option.includes('🆕 Autre')) {
            // Proposer d'ajouter une nouvelle modalité
            Alert.prompt(
                `Nouveau ${label.toLowerCase()}`,
                `Entrez le ${label.toLowerCase()} :`,
                [
                    {
                        text: 'Annuler',
                        style: 'cancel'
                    },
                    {
                        text: 'Ajouter',
                        onPress: async (text) => {
                            if (text && text.trim()) {
                                const newModality = text.trim();

                                // Vérifier si la modalité existe déjà
                                if (allOptions.some(opt => opt.toLowerCase() === newModality.toLowerCase())) {
                                    Alert.alert(
                                        '⚠️ Modalité existante',
                                        `"${newModality}" existe déjà dans la liste.`,
                                        [{ text: 'OK' }]
                                    );
                                    return;
                                }

                                // Ajouter la nouvelle modalité au serveur
                                const success = await modalityService.addCustomModality(
                                    productType,
                                    fieldName,
                                    newModality
                                );

                                if (success) {
                                    // Recharger les options pour inclure la nouvelle modalité
                                    await loadOptions();

                                    // Ajouter la nouvelle modalité à la sélection
                                    const newValues = [...values, newModality];
                                    onSelect(newValues);

                                    Alert.alert(
                                        '✅ Modalité ajoutée',
                                        `"${newModality}" a été ajouté et sera visible pour tous les utilisateurs !`,
                                        [{ text: 'OK' }]
                                    );
                                } else {
                                    Alert.alert(
                                        '❌ Erreur',
                                        'Impossible d\'ajouter la modalité. Veuillez réessayer.',
                                        [{ text: 'OK' }]
                                    );
                                }
                            }
                        }
                    }
                ],
                'plain-text'
            );
        } else {
            // Toggle la sélection
            const isSelected = values.includes(option);
            let newValues: string[];

            if (isSelected) {
                // Désélectionner
                newValues = values.filter(v => v !== option);
            } else {
                // Vérifier la limite de sélections
                if (values.length >= maxSelections) {
                    Alert.alert(
                        '⚠️ Limite atteinte',
                        `Vous ne pouvez sélectionner que ${maxSelections} ${label.toLowerCase()}s maximum.`,
                        [{ text: 'OK' }]
                    );
                    return;
                }
                // Sélectionner
                newValues = [...values, option];
            }

            onSelect(newValues);

            // Incrémenter le compteur d'utilisation
            await modalityService.incrementUsage(productType, fieldName, option);
        }
    };

    const removeSelection = (value: string) => {
        const newValues = values.filter(v => v !== value);
        onSelect(newValues);
    };

    const clearAll = () => {
        Alert.alert(
            'Effacer toutes les sélections',
            `Voulez-vous effacer toutes les ${label.toLowerCase()}s sélectionnées ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Effacer',
                    style: 'destructive',
                    onPress: () => onSelect([])
                }
            ]
        );
    };

    const getDisplayText = () => {
        if (values.length === 0) return placeholder;
        if (values.length === 1) return values[0];
        return `${values.length} ${label.toLowerCase()}s sélectionnées`;
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
                {maxSelections > 1 && (
                    <Text style={styles.limitText}> (max {maxSelections})</Text>
                )}
            </Text>

            <TouchableOpacity
                style={[
                    styles.selector,
                    !values.length && styles.selectorPlaceholder
                ]}
                onPress={() => setShowModal(true)}
            >
                <Text style={[
                    styles.selectorText,
                    !values.length && styles.selectorTextPlaceholder
                ]}>
                    {getDisplayText()}
                </Text>
                <SafeIcon
                    name="chevron-down"
                    size={20}
                    color={values.length ? modernColors.text : modernColors.textSecondary}
                />
            </TouchableOpacity>

            {/* Affichage des sélections */}
            {values.length > 0 && (
                <View style={styles.selectedContainer}>
                    <View style={styles.selectedHeader}>
                        <Text style={styles.selectedTitle}>
                            {values.length} sélectionné{values.length > 1 ? 's' : ''}
                        </Text>
                        <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
                            <SafeIcon name="x" size={16} color={modernColors.error} />
                            <Text style={styles.clearText}>Effacer tout</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedScroll}>
                        {values.map((value, index) => (
                            <View key={index} style={styles.selectedItem}>
                                <Text style={styles.selectedItemText}>{value}</Text>
                                <TouchableOpacity
                                    onPress={() => removeSelection(value)}
                                    style={styles.removeButton}
                                >
                                    <SafeIcon name="x" size={14} color={modernColors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Indicateur du nombre d'options disponibles */}
            {allOptions.length > 0 && !loading && (
                <Text style={styles.optionsCount}>
                    {allOptions.length} option{allOptions.length > 1 ? 's' : ''} disponible{allOptions.length > 1 ? 's' : ''}
                    {allOptions.some(opt => !opt.includes('🆕')) && ' (inclut les modalités partagées)'}
                </Text>
            )}
            {loading && (
                <Text style={styles.optionsCount}>
                    Chargement des options...
                </Text>
            )}

            {/* Modal de sélection */}
            {showModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Sélectionner {label.toLowerCase()}
                            </Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <SafeIcon name="close" size={24} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalOptions} showsVerticalScrollIndicator={false}>
                            {allOptions.map((option, index) => {
                                const isSelected = values.includes(option);
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.optionItem,
                                            isSelected && styles.optionItemSelected
                                        ]}
                                        onPress={() => toggleSelection(option)}
                                    >
                                        <View style={styles.optionContent}>
                                            <Text style={[
                                                styles.optionText,
                                                isSelected && styles.optionTextSelected
                                            ]}>
                                                {option}
                                            </Text>
                                            {isSelected && (
                                                <SafeIcon name="check" size={20} color={modernColors.primary} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => setShowModal(false)}
                            >
                                <Text style={styles.modalButtonText}>Terminé</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
    },
    limitText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: 'normal',
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    selectorPlaceholder: {
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    selectorText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    selectorTextPlaceholder: {
        color: modernColors.textSecondary,
    },
    selectedContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    selectedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    selectedTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    clearText: {
        fontSize: 12,
        color: modernColors.error,
    },
    selectedScroll: {
        maxHeight: 100,
    },
    selectedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
    },
    selectedItemText: {
        fontSize: 12,
        color: 'white',
        marginRight: 6,
    },
    removeButton: {
        padding: 2,
    },
    optionsCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: modernColors.background,
        borderRadius: 12,
        width: '90%',
        maxHeight: '80%',
        overflow: 'hidden',
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
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    modalOptions: {
        maxHeight: 300,
    },
    optionItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    optionItemSelected: {
        backgroundColor: modernColors.primary + '10',
    },
    optionContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    optionTextSelected: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    modalButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'white',
    },
});

export default MultiSelectModalitySelector;


