import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getFieldOptions } from '../data/productModalities';
import { modalityService } from '../services/modalityService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface EnhancedModalitySelectorProps {
    label: string;
    value: string;
    productType: string;
    fieldName: string;
    onSelect: (value: string) => void;
    required?: boolean;
    placeholder?: string;
}

const EnhancedModalitySelector: React.FC<EnhancedModalitySelectorProps> = ({
    label,
    value,
    productType,
    fieldName,
    onSelect,
    required = false,
    placeholder = 'Sélectionner...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [allOptions, setAllOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
            console.error('[EnhancedModalitySelector] Erreur chargement options:', error);
            // En cas d'erreur, utiliser seulement les options statiques
            setAllOptions(getFieldOptions(productType, fieldName));
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

                                    // Sélectionner la nouvelle modalité
                                    onSelect(newModality);

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
            // Incrémenter le compteur d'utilisation
            await modalityService.incrementUsage(productType, fieldName, option);
            onSelect(option);
        }
        setIsOpen(false);
        setSearchQuery(''); // Réinitialiser la recherche
    };

    const showOptions = () => {
        if (loading) {
            Alert.alert(
                'Chargement...',
                'Veuillez patienter pendant le chargement des options.',
                [{ text: 'OK' }]
            );
            return;
        }

        if (allOptions.length === 0) {
            Alert.alert(
                'Aucune option disponible',
                `Aucune option n'est définie pour ${label.toLowerCase()}.`,
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRECTION : Utiliser setIsOpen au lieu de Alert.alert
        // pour afficher TOUTES les options dans un Modal scrollable
        setSearchQuery(''); // Réinitialiser la recherche à l'ouverture
        setIsOpen(true);
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

            <TouchableOpacity
                style={[
                    styles.selector,
                    !value && styles.selectorPlaceholder
                ]}
                onPress={showOptions}
            >
                <Text style={[
                    styles.selectorText,
                    !value && styles.selectorTextPlaceholder
                ]}>
                    {value || placeholder}
                </Text>
                <SafeIcon
                    name="chevron-down"
                    size={20}
                    color={value ? modernColors.text : modernColors.textSecondary}
                />
            </TouchableOpacity>

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

            {/* ✅ NOUVEAU : Modal avec ScrollView pour afficher TOUTES les options */}
            <Modal
                visible={isOpen}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Sélectionner {label.toLowerCase()}
                            </Text>
                            <TouchableOpacity onPress={() => setIsOpen(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* ✅ NOUVEAU : Barre de recherche */}
                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={`Rechercher dans ${allOptions.length} options...`}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <SafeIcon name="x-circle" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* ✅ Afficher le nombre de résultats */}
                        {searchQuery.trim() && (
                            <View style={styles.searchResultsInfo}>
                                <Text style={styles.searchResultsText}>
                                    {filteredOptions.length} résultat{filteredOptions.length > 1 ? 's' : ''} trouvé{filteredOptions.length > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}

                        <ScrollView style={styles.modalOptions} showsVerticalScrollIndicator={true}>
                            {filteredOptions.length === 0 ? (
                                <View style={styles.noResultsContainer}>
                                    <SafeIcon name="search" size={40} color={modernColors.textSecondary} />
                                    <Text style={styles.noResultsText}>
                                        Aucun résultat pour "{searchQuery}"
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.addCustomButton}
                                        onPress={() => {
                                            setIsOpen(false);
                                            setSearchQuery('');
                                            // Simuler le clic sur "🆕 Autre (ajouter)"
                                            handleSelect('🆕 Autre (ajouter)');
                                        }}
                                    >
                                        <SafeIcon name="plus-circle" size={20} color={modernColors.primary} />
                                        <Text style={styles.addCustomButtonText}>
                                            Ajouter "{searchQuery}" comme nouvelle modalité
                                        </Text>
                                    </TouchableOpacity>
                                </View>
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
                                                value === option && styles.optionTextSelected
                                            ]}>
                                                {option}
                                            </Text>
                                            {value === option && (
                                                <SafeIcon name="check" size={20} color={modernColors.primary} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => setIsOpen(false)}
                            >
                                <Text style={styles.modalButtonText}>Fermer</Text>
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
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
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
    optionsCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    modalOptions: {
        maxHeight: 400,
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
        fontSize: 16,
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
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: modernColors.surface,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
        paddingVertical: 8,
    },
    searchResultsInfo: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: modernColors.primary + '10',
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    searchResultsText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    noResultsContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noResultsText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 12,
        marginBottom: 20,
        textAlign: 'center',
    },
    addCustomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: modernColors.primary + '10',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderStyle: 'dashed',
    },
    addCustomButtonText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
        flex: 1,
    },
});

export default EnhancedModalitySelector;
