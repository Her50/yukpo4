/**
 * FiltersPanel - Panneau de filtres pour ResultatBesoinScreen
 * Extrait de ResultatBesoinScreen pour améliorer la maintenabilité
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { hapticSelect } from '../../utils/hapticFeedback';

type SortOption = 'pertinence' | 'proximite' | 'prix_asc' | 'prix_desc';
type FilterCategory = 'all' | 'with_stock' | 'with_variants' | 'nearby';

interface FiltersPanelProps {
    visible: boolean;
    sortBy: SortOption;
    onSortChange: (sort: SortOption) => void;
    filterCategory: FilterCategory;
    onFilterCategoryChange: (category: FilterCategory) => void;
    priceFilter: {
        min: number | null;
        max: number | null;
        currency: string;
    };
    onPriceFilterChange: (filter: { min: number | null; max: number | null; currency: string }) => void;
    dynamicFilters: Record<string, Set<string>>;
    selectedFilters: Record<string, string>;
    onSelectedFiltersChange: (filters: Record<string, string>) => void;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
    visible,
    sortBy,
    onSortChange,
    filterCategory,
    onFilterCategoryChange,
    priceFilter,
    onPriceFilterChange,
    dynamicFilters,
    selectedFilters,
    onSelectedFiltersChange,
}) => {
    if (!visible) return null;

    return (
        <View style={styles.filtersPanel}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Tri */}
                <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupTitle}>📊 Trier par</Text>
                    <View style={styles.filterOptions}>
                        <TouchableOpacity
                            style={[styles.filterOption, sortBy === 'pertinence' && styles.filterOptionActive]}
                            onPress={() => {
                                hapticSelect();
                                onSortChange('pertinence');
                            }}
                        >
                            <Text style={[styles.filterOptionText, sortBy === 'pertinence' && styles.filterOptionTextActive]}>
                                Pertinence
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterOption, sortBy === 'proximite' && styles.filterOptionActive]}
                            onPress={() => {
                                hapticSelect();
                                onSortChange('proximite');
                            }}
                        >
                            <Text style={[styles.filterOptionText, sortBy === 'proximite' && styles.filterOptionTextActive]}>
                                Proximité
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterOption, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.filterOptionActive]}
                            onPress={() => {
                                hapticSelect();
                                if (sortBy === 'prix_asc') {
                                    onSortChange('prix_desc');
                                } else if (sortBy === 'prix_desc') {
                                    onSortChange('pertinence');
                                } else {
                                    onSortChange('prix_asc');
                                }
                            }}
                        >
                            <Text style={[styles.filterOptionText, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.filterOptionTextActive]}>
                                Prix
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.filterHint}>Sélectionnez un ordre de tri pour affiner votre recherche.</Text>
                </View>

                {/* Catégories rapides */}
                <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupTitle}>🎯 Catégories rapides</Text>
                    <View style={styles.filterOptions}>
                        {([
                            { key: 'all' as FilterCategory, label: 'Tous' },
                            { key: 'with_stock' as FilterCategory, label: 'En stock' },
                            { key: 'with_variants' as FilterCategory, label: 'Variantes' },
                            { key: 'nearby' as FilterCategory, label: 'Proche' },
                        ]).map((category) => {
                            const isActive = filterCategory === category.key;
                            return (
                                <TouchableOpacity
                                    key={category.key}
                                    style={[styles.filterOption, isActive && styles.filterOptionActive]}
                                    onPress={() => {
                                        hapticSelect();
                                        onFilterCategoryChange(category.key);
                                    }}
                                >
                                    <Text style={[styles.filterOptionText, isActive && styles.filterOptionTextActive]}>
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Filtre par prix */}
                <View style={styles.priceFilterContainer}>
                    <Text style={styles.filterGroupTitle}>💵 Filtre de prix</Text>
                    <View style={styles.priceFilterRow}>
                        <TextInput
                            style={styles.priceFilterInput}
                            placeholder="Min"
                            keyboardType="numeric"
                            value={priceFilter.min !== null ? String(priceFilter.min) : ''}
                            onChangeText={(text) => {
                                const sanitized = text.replace(/[^0-9]/g, '');
                                onPriceFilterChange({
                                    ...priceFilter,
                                    min: sanitized ? parseInt(sanitized, 10) : null,
                                });
                            }}
                        />
                        <Text style={styles.priceFilterSeparator}>—</Text>
                        <TextInput
                            style={styles.priceFilterInput}
                            placeholder="Max"
                            keyboardType="numeric"
                            value={priceFilter.max !== null ? String(priceFilter.max) : ''}
                            onChangeText={(text) => {
                                const sanitized = text.replace(/[^0-9]/g, '');
                                onPriceFilterChange({
                                    ...priceFilter,
                                    max: sanitized ? parseInt(sanitized, 10) : null,
                                });
                            }}
                        />
                    </View>
                    <View style={styles.priceFilterActions}>
                        <TouchableOpacity
                            style={styles.priceFilterReset}
                            onPress={() => onPriceFilterChange({ min: null, max: null, currency: priceFilter.currency })}
                        >
                            <Text style={styles.priceFilterResetText}>Réinitialiser</Text>
                        </TouchableOpacity>
                        <Text style={styles.priceFilterInfo}>Devise: {priceFilter.currency}</Text>
                    </View>
                </View>

                {/* Filtres dynamiques */}
                {dynamicFilters && typeof dynamicFilters === 'object' && Object.entries(dynamicFilters).map(([label, values]) => (
                    <View key={label} style={styles.dynamicFilterSection}>
                        <View style={styles.filterGroupHeader}>
                            <Text style={styles.dynamicFilterLabel}>{label}</Text>
                            {selectedFilters[label] && (
                                <TouchableOpacity
                                    onPress={() => {
                                        const next = { ...selectedFilters };
                                        delete next[label];
                                        onSelectedFiltersChange(next);
                                    }}
                                >
                                    <Text style={styles.filterHint}>Effacer</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.dynamicFilterOptions}>
                            {values && (values instanceof Set || Array.isArray(values)) ? Array.from(values).filter(v => v != null && v !== undefined && String(v).trim() !== '').map((value) => {
                                const isActive = selectedFilters[label] === value;
                                return (
                                    <TouchableOpacity
                                        key={String(value)}
                                        style={[styles.dynamicFilterChip, isActive && styles.dynamicFilterChipActive]}
                                        onPress={() => {
                                            hapticSelect();
                                            const next = { ...selectedFilters };
                                            if (isActive) {
                                                delete next[label];
                                            } else {
                                                next[label] = String(value);
                                            }
                                            onSelectedFiltersChange(next);
                                        }}
                                    >
                                        <Text style={[styles.dynamicFilterChipText, isActive && styles.dynamicFilterChipTextActive]}>
                                            {String(value)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }) : null}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    filtersPanel: {
        backgroundColor: '#FFF',
        padding: 16,
        gap: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        maxHeight: 400,
    },
    filterGroup: {
        gap: 12,
    },
    filterGroupTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    filterHint: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
        marginTop: -8,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#FFF',
    },
    filterOptionActive: {
        backgroundColor: modernColors.primary,
    },
    filterOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    filterOptionTextActive: {
        color: '#FFF',
    },
    priceFilterContainer: {
        marginTop: 12,
    },
    priceFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    priceFilterInput: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 14,
        color: '#0F172A',
    },
    priceFilterSeparator: {
        fontSize: 18,
        color: '#64748B',
        fontWeight: '600',
    },
    priceFilterActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    priceFilterReset: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    priceFilterResetText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    priceFilterInfo: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    dynamicFilterSection: {
        gap: 8,
        marginTop: 8,
    },
    filterGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dynamicFilterLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    dynamicFilterOptions: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
        flexWrap: 'wrap',
    },
    dynamicFilterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFF',
    },
    dynamicFilterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dynamicFilterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    dynamicFilterChipTextActive: {
        color: '#FFF',
    },
});

export default FiltersPanel;

