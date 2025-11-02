/**
 * LinearAutocompleteEditor - Version 2.0 (2025-11-02)
 * Affiche et édite le vecteur autocomplete généré par l'IA
 * Plus de recherche BDD - Juste affichage et modification du vecteur
 */

import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface LinearAutocompleteEditorProps {
    label: string;
    identifiantBase: string;
    sousCaracteristiques: Record<string, string[]>; // { marque: ["Nike"], pointure: ["38", "39", "40"] }
    separateur: string;
    value: string[]; // ["Nike,Air Max,Noir,40"] - Position 0 affichée
    onChange: (values: string[]) => void;
    required?: boolean;
    readonly?: boolean;
}

interface ChipData {
    key: string;      // "marque"
    value: string;    // "Nike"
    index: number;    // Position dans vecteur
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
        onChange([newVector]);
        
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

                    {/* Bouton Ajouter */}
                    <TouchableOpacity
                        style={styles.addChipButton}
                        onPress={() => setShowAddModal(true)}
                    >
                        <SafeIcon name="plus" size={18} color={modernColors.primary} />
                        <Text style={styles.addChipText}>Ajouter</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <SafeIcon name="package" size={32} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Aucune caractéristique</Text>
                    <TouchableOpacity
                        style={styles.addFirstButton}
                        onPress={() => setShowAddModal(true)}
                    >
                        <SafeIcon name="plus" size={16} color="#FFF" />
                        <Text style={styles.addFirstButtonText}>Ajouter une caractéristique</Text>
                    </TouchableOpacity>
                </View>
            )}

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
});

export default LinearAutocompleteEditor;
