/**
 * SimplePrestationSelector - Sélecteur simple de prestations/services sans planification
 * UX améliorée : sélection dans un modal au lieu de chips étalées
 */

import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface SimplePrestationSelectorProps {
    label: string;
    options: string[];
    selected: string[];
    onSelectionChange: (selected: string[]) => void;
    allowCustom?: boolean;
    placeholder?: string;
}

const SimplePrestationSelector: React.FC<SimplePrestationSelectorProps> = ({
    label,
    options,
    selected,
    onSelectionChange,
    allowCustom = true,
    placeholder = 'Ajouter une option personnalisée'
}) => {
    const [showModal, setShowModal] = useState(false);
    const [customInput, setCustomInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filtrer les options disponibles
    const availableOptions = options.filter(opt => !selected.includes(opt));

    // Filtrer selon la recherche
    const filteredOptions = availableOptions.filter(opt =>
        opt.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggle = (option: string) => {
        if (selected.includes(option)) {
            onSelectionChange(selected.filter(s => s !== option));
        } else {
            onSelectionChange([...selected, option]);
        }
    };

    const handleAddCustom = () => {
        if (customInput.trim() && !selected.includes(customInput.trim())) {
            onSelectionChange([...selected, customInput.trim()]);
            setCustomInput('');
            setShowModal(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowModal(true)}
                >
                    <SafeIcon name="plus" size={18} color={modernColors.primary} />
                    <Text style={styles.addButtonText}>Ajouter</Text>
                </TouchableOpacity>
            </View>

            {/* Liste des options sélectionnées */}
            {selected.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Aucune option sélectionnée</Text>
                    <Text style={styles.emptyHint}>Appuyez sur "Ajouter" pour commencer</Text>
                </View>
            ) : (
                <View style={styles.selectedList}>
                    {selected.map((item, index) => (
                        <View key={index} style={styles.itemCard}>
                            <Text style={styles.itemName}>{item}</Text>
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => handleToggle(item)}
                            >
                                <SafeIcon name="x" size={16} color="#DC2626" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {/* Modal de sélection */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Sélectionner</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={18} color="#9CA3AF" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <ScrollView style={styles.optionsList}>
                            {filteredOptions.length === 0 ? (
                                <Text style={styles.noResults}>Aucun résultat</Text>
                            ) : (
                                filteredOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={styles.optionItem}
                                        onPress={() => {
                                            handleToggle(option);
                                            setShowModal(false);
                                        }}
                                    >
                                        <Text style={styles.optionText}>{option}</Text>
                                        <SafeIcon name="plus" size={18} color={modernColors.primary} />
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>

                        {allowCustom && (
                            <View style={styles.customContainer}>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder={placeholder}
                                    value={customInput}
                                    onChangeText={setCustomInput}
                                    onSubmitEditing={handleAddCustom}
                                />
                                <TouchableOpacity
                                    style={[styles.customButton, !customInput.trim() && styles.customButtonDisabled]}
                                    onPress={handleAddCustom}
                                    disabled={!customInput.trim()}
                                >
                                    <SafeIcon name="plus" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 16 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: `${modernColors.primary}15`,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    emptyState: {
        padding: 20,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    emptyHint: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    selectedList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    removeButton: {
        padding: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
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
        color: '#111827',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    optionsList: {
        padding: 16,
        maxHeight: 400,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        marginBottom: 8,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
    },
    noResults: {
        textAlign: 'center',
        padding: 20,
        color: '#6B7280',
    },
    customContainer: {
        flexDirection: 'row',
        gap: 8,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    customInput: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 14,
    },
    customButton: {
        padding: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customButtonDisabled: {
        backgroundColor: '#D1D5DB',
        opacity: 0.5,
    },
});

export default SimplePrestationSelector;

