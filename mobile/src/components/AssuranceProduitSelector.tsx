import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getProduitsAssuranceByType } from '../data/assuranceModalities';
import { modalityService } from '../services/modalityService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface AssuranceProduitSelectorProps {
    label: string;
    value: string;
    typeAssurance: string; // "VIE" ou "NON VIE"
    onSelect: (value: string) => void;
    required?: boolean;
    disabled?: boolean;
}

/**
 * Sélecteur intelligent de produits d'assurance
 * Filtre les produits selon le type VIE ou NON VIE
 */
const AssuranceProduitSelector: React.FC<AssuranceProduitSelectorProps> = ({
    label,
    value,
    typeAssurance,
    onSelect,
    required = false,
    disabled = false
}) => {
        const { t } = useLanguageSafe();
const [modalVisible, setModalVisible] = useState(false);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [newProduitName, setNewProduitName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [options, setOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Charger les options selon le type d'assurance
    useEffect(() => {
        loadOptions();
    }, [typeAssurance]);

    const loadOptions = async () => {
        if (!typeAssurance) {
            setOptions([]);
            return;
        }

        setLoading(true);
        try {
            // Récupérer les produits selon le type (VIE ou NON VIE)
            const staticOptions = getProduitsAssuranceByType(typeAssurance);

            // Récupérer les produits personnalisés de la BD
            const fieldName = typeAssurance === 'VIE' ? 'produits_vie' : 'produits_non_vie';
            const customOptions = await modalityService.getModalitiesForField('assurance', fieldName);

            // Combiner et éliminer doublons
            const combinedOptions = [...new Set([...staticOptions, ...customOptions])];

            // Trier alphabétiquement
            const sortedOptions = combinedOptions.sort((a, b) => {
                if (a.includes('🆕')) return 1;
                if (b.includes('🆕')) return -1;
                return a.localeCompare(b, 'fr');
            });

            setOptions(sortedOptions);
        } catch (error) {
            console.error('Erreur chargement produits assurance:', error);
            setOptions(getProduitsAssuranceByType(typeAssurance));
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (option: string) => {
        if (option.includes('🆕 Autre')) {
            // Ouvrir modale d'ajout (compatible Android)
            setNewProduitName('');
            setAddModalVisible(true);
        } else {
            onSelect(option);
            setModalVisible(false);

            // Incrémenter le compteur d'usage
            const fieldName = typeAssurance === 'VIE' ? 'produits_vie' : 'produits_non_vie';
            modalityService.incrementUsage('assurance', fieldName, option);
        }
    };

    const handleAddNewProduit = async () => {
        if (!newProduitName.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un nom de produit', [{ text: 'OK' }]);
            return;
        }

        const newProduit = newProduitName.trim();
        const fieldName = typeAssurance === 'VIE' ? 'produits_vie' : 'produits_non_vie';

        const success = await modalityService.addCustomModality(
            'assurance',
            fieldName,
            newProduit
        );

        if (success) {
            await loadOptions();
            onSelect(newProduit);
            setAddModalVisible(false);
            setModalVisible(false);
            setNewProduitName('');
            Alert.alert(
                t('assuranceProduitSelector.produitAjoute'),
                t('assuranceProduitSelector.aEteAjouteALaListe', { newProduit: newProduit, typeAssurance: typeAssurance }),
                [{ text: 'OK' }]
            );
        } else {
            Alert.alert('❌ Erreur', 'Impossible d\'ajouter le produit', [{ text: 'OK' }]);
        }
    };

    // Filtrer les options selon la recherche
    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Message si type non sélectionné
    if (!typeAssurance) {
        return (
            <View style={styles.disabledContainer}>
                <Text style={styles.disabledLabel}>{label} <Text style={styles.required}>*</Text></Text>
                <View style={styles.disabledInput}>
                    <SafeIcon name="lock" size={16} color={modernColors.textSecondary} />
                    <Text style={styles.disabledText}>
                        Sélectionnez d'abord le type d'assurance (VIE ou NON VIE)
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.typeHint}>
                📋 Produits {typeAssurance}
            </Text>

            <TouchableOpacity
                style={[styles.selector, disabled && styles.selectorDisabled]}
                onPress={() => !disabled && setModalVisible(true)}
                disabled={disabled}
            >
                <Text style={[styles.selectorText, !value && styles.placeholder]}>
                    {value || t('assuranceProduitSelector.selectionnerUnProduit')}
                </Text>
                <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {/* Modal de sélection */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {label} - {typeAssurance}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('assuranceProduitSelector.rechercherUnProduit')}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor={modernColors.textSecondary}
                            />
                        </View>

                        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>{t('assuranceProduitSelector.chargement')}</Text>
                                </View>
                            ) : filteredOptions.length > 0 ? (
                                filteredOptions.map((option, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.option,
                                            value === option && styles.optionSelected,
                                            option.includes('🆕') && styles.optionAdd
                                        ]}
                                        onPress={() => handleSelect(option)}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            value === option && styles.optionTextSelected,
                                            option.includes('🆕') && styles.optionTextAdd
                                        ]}>
                                            {option}
                                        </Text>
                                        {value === option && (
                                            <SafeIcon name="check" size={18} color={modernColors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>{t('assuranceProduitSelector.aucunProduitTrouve')}</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal d'ajout de nouveau produit (compatible Android) */}
            <Modal visible={addModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.addModalContent}>
                        <View style={styles.addModalHeader}>
                            <Text style={styles.addModalTitle}>
                                Nouveau produit d'assurance {typeAssurance}
                            </Text>
                        </View>

                        <Text style={styles.addModalLabel}>{t('assuranceProduitSelector.nomDuProduit')}</Text>
                        <TextInput
                            style={styles.addModalInput}
                            placeholder={t('assuranceProduitSelector.ex', { typeAssurance === 'VIE' ? t('assuranceProduitSelector.epargneRetraite') : 'Assurance habitation': typeAssurance === 'VIE' ? t('assuranceProduitSelector.epargneRetraite') : 'Assurance habitation' })}
                            value={newProduitName}
                            onChangeText={setNewProduitName}
                            placeholderTextColor={modernColors.textSecondary}
                            autoFocus
                        />

                        <View style={styles.addModalButtons}>
                            <TouchableOpacity
                                style={[styles.addModalButton, styles.addModalButtonCancel]}
                                onPress={() => {
                                    setAddModalVisible(false);
                                    setNewProduitName('');
                                }}
                            >
                                <Text style={styles.addModalButtonTextCancel}>{t('assuranceProduitSelector.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.addModalButton, styles.addModalButtonConfirm]}
                                onPress={handleAddNewProduit}
                            >
                                <Text style={styles.addModalButtonTextConfirm}>{t('assuranceProduitSelector.ajouter')}</Text>
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
        marginBottom: 12,
    },
    disabledContainer: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    disabledLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 6,
    },
    required: {
        color: modernColors.error,
    },
    typeHint: {
        fontSize: 11,
        fontWeight: '500',
        color: modernColors.primary,
        marginBottom: 6,
        fontStyle: 'italic',
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: modernColors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    selectorDisabled: {
        backgroundColor: modernColors.background,
        opacity: 0.6,
    },
    selectorText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    placeholder: {
        color: modernColors.textSecondary,
    },
    disabledInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    disabledText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
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
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: modernColors.background,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        margin: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    optionsList: {
        maxHeight: 400,
        paddingHorizontal: 16,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginBottom: 6,
    },
    optionSelected: {
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    optionAdd: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: modernColors.success,
    },
    optionText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    optionTextSelected: {
        fontWeight: '600',
        color: modernColors.primary,
    },
    optionTextAdd: {
        color: modernColors.success,
        fontWeight: '600',
    },
    loadingContainer: {
        padding: 32,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    addModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 30,
        maxWidth: 400,
        alignSelf: 'center',
    },
    addModalHeader: {
        marginBottom: 16,
    },
    addModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center',
    },
    addModalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    addModalInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 20,
    },
    addModalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    addModalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    addModalButtonCancel: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    addModalButtonConfirm: {
        backgroundColor: modernColors.primary,
    },
    addModalButtonTextCancel: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    addModalButtonTextConfirm: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default AssuranceProduitSelector;







