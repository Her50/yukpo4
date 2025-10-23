import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

        const alertOptions = allOptions.map(option => ({
            text: option,
            onPress: () => handleSelect(option)
        }));

        Alert.alert(
            `Sélectionner ${label.toLowerCase()}`,
            'Choisissez une option ou ajoutez-en une nouvelle :',
            alertOptions
        );
    };

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
});

export default EnhancedModalitySelector;
