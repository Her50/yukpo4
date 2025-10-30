import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getFieldOptions } from '../data/productModalities';
import { modalityService } from '../services/modalityService';
import { modernColors } from '../theme/modernTheme';
import { getUserZone, sortOptionsByZone } from '../utils/userZone';
import SafeIcon from './SafeIcon';

interface SelectModalitySelectorProps {
    label: string;
    value: string;
    productType: string;
    fieldName: string;
    onSelect: (value: string) => void;
    required?: boolean;
    placeholder?: string;
}

const SelectModalitySelector: React.FC<SelectModalitySelectorProps> = ({
    label,
    value,
    productType,
    fieldName,
    onSelect,
    required = false,
    placeholder = 'Sélectionner...'
}) => {
    const [allOptions, setAllOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userZone, setUserZone] = useState<string>('CM'); // Zone par défaut: Cameroun

    // Charger la zone utilisateur au montage
    useEffect(() => {
        getUserZone().then(zone => {
            setUserZone(zone);
        });
    }, []);

    // Charger les options (statiques + personnalisées)
    useEffect(() => {
        loadOptions();
    }, [productType, fieldName, userZone]);

    const loadOptions = async () => {
        setLoading(true);
        try {
            // Options statiques de base
            const staticOptions = getFieldOptions(productType, fieldName);

            // Options personnalisées depuis le serveur
            const customOptions = await modalityService.getModalitiesForField(productType, fieldName);

            // Combiner les options (statiques + personnalisées, sans doublons)
            const combinedOptions = [...new Set([...staticOptions, ...customOptions])];

            // ✅ PRIORISATION GÉOGRAPHIQUE: Trier avec zone utilisateur en premier
            let sortedOptions = sortOptionsByZone(combinedOptions, userZone);

            // Mettre "🆕 Autre" à la fin même après tri géographique
            sortedOptions = sortedOptions.sort((a, b) => {
                if (a.includes('🆕')) return 1;
                if (b.includes('🆕')) return -1;
                return 0; // Garder l'ordre géographique déjà trié
            });

            setAllOptions(sortedOptions);
        } catch (error) {
            console.error('[SelectModalitySelector] Erreur chargement options:', error);
            // En cas d'erreur, utiliser seulement les options statiques
            const staticOptions = getFieldOptions(productType, fieldName);
            let sortedOptions = sortOptionsByZone(staticOptions, userZone);
            sortedOptions = sortedOptions.sort((a, b) => {
                if (a.includes('🆕')) return 1;
                if (b.includes('🆕')) return -1;
                return 0;
            });
            setAllOptions(sortedOptions);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (option: string) => {
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
                                if (allOptions.some(opt => opt.toLowerCase() === newModality.toLowerCase() && !opt.includes('🆕'))) {
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

                                    // Sélectionner la nouvelle modalité
                                    onSelect(newModality);
                                    setShowModal(false);

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
            // Sélectionner l'option
            onSelect(option);
            setShowModal(false);

            // Incrémenter le compteur d'utilisation
            await modalityService.incrementUsage(productType, fieldName, option);
        }
    };

    const clearSelection = () => {
        Alert.alert(
            'Effacer la sélection',
            `Voulez-vous effacer le ${label.toLowerCase()} sélectionné ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Effacer',
                    style: 'destructive',
                    onPress: () => onSelect('')
                }
            ]
        );
    };

    // ✅ NOUVEAU : Filtrer les options selon la recherche
    const filteredOptions = allOptions.filter(option => {
        if (!searchQuery.trim()) return true;
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const normalizedOption = option.toLowerCase();
        return normalizedOption.includes(normalizedQuery);
    });

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <View style={styles.selectorRow}>
                <TouchableOpacity
                    style={[
                        styles.selector,
                        !value && styles.selectorPlaceholder,
                        { flex: 1 }
                    ]}
                    onPress={() => setShowModal(true)}
                >
                    <Text style={[
                        styles.selectorText,
                        !value && styles.placeholderText
                    ]}>
                        {value || placeholder}
                    </Text>
                    <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>

                {/* ✅ NOUVEAU: Bouton visible pour ajouter une nouvelle modalité */}
                <TouchableOpacity
                    style={styles.addModalityButton}
                    onPress={() => {
                        Alert.prompt(
                            `➕ Ajouter un nouveau ${label.toLowerCase()}`,
                            `Entrez le ${label.toLowerCase()} que vous souhaitez ajouter :`,
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
                                            if (allOptions.some(opt => opt.toLowerCase() === newModality.toLowerCase() && !opt.includes('🆕'))) {
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

                                                // Sélectionner la nouvelle modalité
                                                onSelect(newModality);
                                                setShowModal(false);

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
                    }}
                >
                    <SafeIcon name="plus-circle" size={20} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {value && (
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearSelection}
                >
                    <SafeIcon name="x-circle" size={16} color={modernColors.error} />
                    <Text style={styles.clearButtonText}>Effacer</Text>
                </TouchableOpacity>
            )}

            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Sélectionner {label.toLowerCase()}</Text>
                            <TouchableOpacity
                                onPress={() => setShowModal(false)}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Barre de recherche */}
                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={`Rechercher ${label.toLowerCase()}...`}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor={modernColors.textSecondary}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <SafeIcon name="x-circle" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Liste des options */}
                        <ScrollView style={styles.optionsList}>
                            {loading ? (
                                <Text style={styles.loadingText}>Chargement...</Text>
                            ) : filteredOptions.length === 0 ? (
                                <Text style={styles.emptyText}>
                                    Aucun résultat pour "{searchQuery}"
                                </Text>
                            ) : (
                                filteredOptions.map((option, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.optionItem,
                                            value === option && styles.optionItemSelected
                                        ]}
                                        onPress={() => handleSelect(option)}
                                    >
                                        <View style={styles.optionContent}>
                                            <Text style={[
                                                styles.optionText,
                                                value === option && styles.optionTextSelected,
                                                option.includes('🆕') && styles.optionTextNew
                                            ]}>
                                                {option}
                                            </Text>
                                            {value === option && (
                                                <SafeIcon
                                                    name="check"
                                                    size={20}
                                                    color={modernColors.primary}
                                                />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.modalFooter}>
                            <Text style={styles.footerText}>
                                {filteredOptions.length} option{filteredOptions.length > 1 ? 's' : ''} disponible{filteredOptions.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12, // ✅ Réduit de 20 à 12
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
        fontSize: 16,
    },
    selectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: modernColors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    addModalityButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    selectorPlaceholder: {
        borderColor: modernColors.border,
    },
    selectorText: {
        fontSize: 15,
        color: modernColors.text,
        flex: 1,
    },
    placeholderText: {
        color: modernColors.textSecondary,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingVertical: 4,
        gap: 4,
    },
    clearButtonText: {
        fontSize: 13,
        color: modernColors.error,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        margin: 16,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: modernColors.text,
    },
    optionsList: {
        maxHeight: 400,
    },
    loadingText: {
        textAlign: 'center',
        padding: 20,
        color: modernColors.textSecondary,
    },
    emptyText: {
        textAlign: 'center',
        padding: 20,
        color: modernColors.textSecondary,
    },
    optionItem: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    optionItemSelected: {
        backgroundColor: '#EEF2FF',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionText: {
        fontSize: 15,
        color: modernColors.text,
        flex: 1,
    },
    optionTextSelected: {
        fontWeight: '600',
        color: modernColors.primary,
    },
    optionTextNew: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
});

export default SelectModalitySelector;







