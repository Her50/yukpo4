import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiCall } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface VehicleModelSelectorProps {
    label: string;
    value: string;
    marque: string; // Marque sélectionnée (filtrage intelligent)
    onSelect: (value: string) => void;
    required?: boolean;
    placeholder?: string;
}

/**
 * ✅ Sélecteur intelligent de modèles de véhicules
 * Filtre les modèles selon la marque sélectionnée
 * Utilise la table vehicle_models en BD
 */
const VehicleModelSelector: React.FC<VehicleModelSelectorProps> = ({
    label,
    value,
    marque,
    onSelect,
    required = false,
    placeholder = 'Sélectionner un modèle...'
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [models, setModels] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Charger les modèles selon la marque
    useEffect(() => {
        if (marque) {
            loadModels();
        } else {
            setModels([]);
        }
    }, [marque]);

    const loadModels = async () => {
        if (!marque) return;

        setLoading(true);
        try {
            // Appeler l'API pour récupérer les modèles de cette marque
            const response = await apiCall(`/api/vehicle-models?brand=${encodeURIComponent(marque)}`, 'GET');

            if (response && Array.isArray(response)) {
                const modelNames = response.map((v: any) => v.model).sort();
                setModels([...modelNames, '🆕 Autre (ajouter)']);
            } else {
                setModels(['🆕 Autre (ajouter)']);
            }
        } catch (error) {
            console.error('Erreur chargement modèles:', error);
            // Fallback: permettre seulement l'ajout manuel
            setModels(['🆕 Autre (ajouter)']);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (model: string) => {
        if (model.includes('🆕 Autre')) {
            // Ajouter un nouveau modèle
            Alert.prompt(
                `Nouveau modèle ${marque}`,
                `Entrez le modèle de ${marque} :`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Ajouter',
                        onPress: async (text) => {
                            if (text && text.trim()) {
                                const newModel = text.trim();

                                try {
                                    // Sauvegarder le nouveau modèle en BD
                                    await apiCall('/api/vehicle-models', 'POST', {
                                        brand: marque,
                                        model: newModel
                                    });

                                    // Recharger la liste
                                    await loadModels();
                                    onSelect(newModel);
                                    setModalVisible(false);

                                    Alert.alert(
                                        '✅ Modèle ajouté',
                                        `"${marque} ${newModel}" a été ajouté et sera disponible pour tous les utilisateurs`,
                                        [{ text: 'OK' }]
                                    );
                                } catch (error) {
                                    console.error('Erreur ajout modèle:', error);
                                    // Même si l'API échoue, on accepte la saisie
                                    onSelect(newModel);
                                    setModalVisible(false);
                                    Alert.alert(
                                        '⚠️ Modèle enregistré localement',
                                        `"${newModel}" a été enregistré. Il sera synchronisé avec la base de données.`,
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
            onSelect(model);
            setModalVisible(false);

            // Incrémenter le compteur d'usage en arrière-plan
            apiCall(`/api/vehicle-models/increment`, 'POST', {
                brand: marque,
                model: model
            }).catch(err => console.log('Erreur increment usage:', err));
        }
    };

    // Filtrer les modèles selon la recherche
    const filteredModels = models.filter(model =>
        model.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Si marque non sélectionnée
    if (!marque) {
        return (
            <View style={styles.container}>
                <Text style={styles.disabledLabel}>
                    {label} {required && <Text style={styles.required}>*</Text>}
                </Text>
                <View style={styles.disabledInput}>
                    <SafeIcon name="lock" size={16} color={modernColors.textSecondary} />
                    <Text style={styles.disabledText}>
                        Sélectionnez d'abord la marque du véhicule
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>
            <Text style={styles.marqueHint}>
                🚗 Modèles {marque}
            </Text>

            <TouchableOpacity
                style={styles.selector}
                onPress={() => setModalVisible(true)}
            >
                <Text style={[styles.selectorText, !value && styles.placeholder]}>
                    {value || placeholder}
                </Text>
                <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {/* Modal de sélection */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {label} - {marque}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher un modèle..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor={modernColors.textSecondary}
                            />
                        </View>

                        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Chargement des modèles {marque}...</Text>
                                </View>
                            ) : filteredModels.length > 0 ? (
                                filteredModels.map((model, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.option,
                                            value === model && styles.optionSelected,
                                            model.includes('🆕') && styles.optionAdd
                                        ]}
                                        onPress={() => handleSelect(model)}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            value === model && styles.optionTextSelected,
                                            model.includes('🆕') && styles.optionTextAdd
                                        ]}>
                                            {model}
                                        </Text>
                                        {value === model && (
                                            <SafeIcon name="check" size={18} color={modernColors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>Aucun modèle trouvé pour {marque}</Text>
                                </View>
                            )}
                        </ScrollView>
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
    marqueHint: {
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
});

export default VehicleModelSelector;







