import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getFieldOptions, getModalitiesWithUserContext } from '../data/productModalities';
import useUserCountry from '../hooks/useUserCountry';
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
    const [searchQuery, setSearchQuery] = useState('');

    // ✅ NOUVEAU: Détecter le pays de l'utilisateur pour adapter les lieux
    const { countryCode } = useUserCountry();

    // Charger les options (statiques + personnalisées)
    useEffect(() => {
        loadOptions();
    }, [productType, fieldName, countryCode]); // Recharger si le pays change

    const loadOptions = async () => {
        setLoading(true);
        try {
            // ✅ NOUVEAU: Détecter si le champ nécessite adaptation au contexte utilisateur
            const isContextualField = 
                // Champs géographiques
                fieldName.toLowerCase().includes('ville') ||
                fieldName.toLowerCase().includes('quartier') ||
                fieldName.toLowerCase().includes('zone') ||
                fieldName.toLowerCase().includes('localisation') ||
                // Champs éducatifs
                fieldName.toLowerCase().includes('matiere') ||
                (fieldName.toLowerCase().includes('niveau') && fieldName.toLowerCase().includes('scolaire')) ||
                // Champs préparation concours
                fieldName.toLowerCase().includes('concours');

            // Options statiques de base (adaptées au contexte si nécessaire)
            let staticOptions: string[];
            if (isContextualField) {
                // Utiliser les modalités contextualisées selon le pays de l'utilisateur
                const contextualizedModalities = getModalitiesWithUserContext(productType, countryCode);
                staticOptions = contextualizedModalities[fieldName] || getFieldOptions(productType, fieldName);
                console.log(`[MultiSelectModalitySelector] ✅ Modalités adaptées au pays ${countryCode}:`, staticOptions.length);
            } else {
                // Utiliser les modalités standard
                staticOptions = getFieldOptions(productType, fieldName);
            }

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

    const toggleSelection = async (option: string) => {
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
        return `${values.length} ${label.toLowerCase()}${values.length > 1 ? 's' : ''} sélectionné${values.length > 1 ? 's' : ''}`;
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
            <Modal
                visible={showModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Sélectionner {label.toLowerCase()}
                            </Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
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
                                            setShowModal(false);
                                            setSearchQuery('');
                                            // Ajouter directement avec le texte recherché
                                            toggleSelection('🆕 Autre (ajouter)');
                                        }}
                                    >
                                        <SafeIcon name="plus-circle" size={20} color={modernColors.primary} />
                                        <Text style={styles.addCustomButtonText}>
                                            Ajouter "{searchQuery}" comme nouvelle modalité
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                filteredOptions.map((option, index) => {
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
                                })
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => {
                                    setShowModal(false);
                                    setSearchQuery(''); // Réinitialiser la recherche
                                }}
                            >
                                <Text style={styles.modalButtonText}>
                                    Terminé ({values.length} sélectionné{values.length > 1 ? 's' : ''})
                                </Text>
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
        backgroundColor: 'transparent', // ✅ CORRIGÉ: Fond transparent au lieu de bleu
        borderWidth: 1, // ✅ NOUVEAU: Bordure fine
        borderColor: modernColors.border, // ✅ NOUVEAU: Couleur de bordure subtile
        borderRadius: 6, // ✅ CORRIGÉ: Moins arrondi pour moins d'espace
        paddingHorizontal: 8, // ✅ CORRIGÉ: Padding réduit de 12 à 8
        paddingVertical: 4, // ✅ CORRIGÉ: Padding réduit de 6 à 4
        marginRight: 6, // ✅ CORRIGÉ: Marge réduite de 8 à 6
    },
    selectedItemText: {
        fontSize: 13, // ✅ CORRIGÉ: Taille augmentée de 12 à 13 pour lisibilité
        color: modernColors.text, // ✅ CORRIGÉ: Texte foncé au lieu de blanc
        marginRight: 4, // ✅ CORRIGÉ: Marge réduite de 6 à 4
        fontWeight: '500', // ✅ NOUVEAU: Poids medium pour meilleure lisibilité
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

export default MultiSelectModalitySelector;


