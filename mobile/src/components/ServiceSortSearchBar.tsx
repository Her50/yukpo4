// ✅ NOUVEAU Phase 5.3: Composant de recherche et tri pour gestion services spécialisés
// Combine recherche en temps réel + dropdown de tri

import React, { useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

export type SortOption = 'name' | 'date' | 'status' | 'created_at' | 'updated_at';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    field: SortOption;
    direction: SortDirection;
}

interface Props {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortConfig: SortConfig;
    onSortChange: (config: SortConfig) => void;
    placeholder?: string;
}

const ServiceSortSearchBar: React.FC<Props> = ({
    searchQuery,
    onSearchChange,
    sortConfig,
    onSortChange,
    placeholder = 'Rechercher dans la liste...',
}) => {
    const [showSortModal, setShowSortModal] = useState(false);

    const sortOptions: Array<{ value: SortOption; label: string; icon: string }> = [
        { value: 'name', label: 'Nom', icon: 'text' },
        { value: 'created_at', label: 'Date de création', icon: 'calendar' },
        { value: 'updated_at', label: 'Dernière modification', icon: 'edit' },
        { value: 'status', label: 'Statut', icon: 'check-circle' },
    ];

    const getSortLabel = (): string => {
        const option = sortOptions.find((o) => o.value === sortConfig.field);
        const direction = sortConfig.direction === 'asc' ? '↑' : '↓';
        return option ? `${option.label} ${direction}` : 'Trier';
    };

    const handleSortSelect = (field: SortOption) => {
        // Si même champ, inverser la direction, sinon nouveau champ en asc
        const newDirection =
            sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        onSortChange({ field, direction: newDirection });
        setShowSortModal(false);
    };

    return (
        <View style={styles.container}>
            {/* Barre de recherche */}
            <View style={styles.searchBar}>
                <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={placeholder}
                    placeholderTextColor={modernColors.textSecondary}
                    value={searchQuery}
                    onChangeText={onSearchChange}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => onSearchChange('')}>
                        <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Bouton tri */}
            <TouchableOpacity
                style={styles.sortButton}
                onPress={() => setShowSortModal(true)}
            >
                <SafeIcon name="arrow-up-down" size={18} color={modernColors.primary} />
                <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
            </TouchableOpacity>

            {/* Modal tri */}
            <Modal
                visible={showSortModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSortModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSortModal(false)}
                >
                    <View style={styles.modalContent}>
                        <NativeCard style={styles.sortCard}>
                            <View style={styles.sortHeader}>
                                <Text style={styles.sortTitle}>Trier par</Text>
                                <TouchableOpacity onPress={() => setShowSortModal(false)}>
                                    <SafeIcon name="x" size={20} color={modernColors.textPrimary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.sortOptions}>
                                {sortOptions.map((option) => {
                                    const isSelected = sortConfig.field === option.value;
                                    const isAsc = isSelected && sortConfig.direction === 'asc';
                                    const isDesc = isSelected && sortConfig.direction === 'desc';

                                    return (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.sortOption,
                                                isSelected && styles.sortOptionActive,
                                            ]}
                                            onPress={() => handleSortSelect(option.value)}
                                        >
                                            <SafeIcon
                                                name={option.icon}
                                                size={18}
                                                color={
                                                    isSelected
                                                        ? modernColors.primary
                                                        : modernColors.textSecondary
                                                }
                                            />
                                            <Text
                                                style={[
                                                    styles.sortOptionLabel,
                                                    isSelected && styles.sortOptionLabelActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                            {isSelected && (
                                                <SafeIcon
                                                    name={isAsc ? 'arrow-up' : 'arrow-down'}
                                                    size={16}
                                                    color={modernColors.primary}
                                                />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </NativeCard>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sortButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        maxWidth: 300,
    },
    sortCard: {
        padding: 0,
    },
    sortHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    sortTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    sortOptions: {
        padding: 8,
    },
    sortOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 8,
        marginBottom: 4,
    },
    sortOptionActive: {
        backgroundColor: modernColors.primary + '15',
    },
    sortOptionLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: '#374151',
    },
    sortOptionLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
});

export default ServiceSortSearchBar;

