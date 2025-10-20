// @ts-nocheck
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { CategoryFilter, getCategoryFilters, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import SafeIcon from './SafeIcon';

interface CategoryFiltersProps {
    category: string;
    visible: boolean;
    onClose: () => void;
    onApply: (filters: Record<string, any>) => void;
    initialFilters?: Record<string, any>;
}

const CategoryFilters: React.FC<CategoryFiltersProps> = ({
    category,
    visible,
    onClose,
    onApply,
    initialFilters = {},
}) => {
    const categoryFilters = getCategoryFilters(category);
    const categoryStyle = getCategoryStyle(category);
    const terminology = getCategoryTerminology(category);

    const [filters, setFilters] = useState<Record<string, any>>(initialFilters);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({});
    };

    const renderFilter = (filter: CategoryFilter) => {
        switch (filter.type) {
            case 'range':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <View style={styles.rangeContainer}>
                            <View style={styles.rangeInputContainer}>
                                <Text style={styles.rangeInputLabel}>Min</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    value={filters[`${filter.id}_min`]?.toString() || ''}
                                    onChangeText={(text) => setFilters({
                                        ...filters,
                                        [`${filter.id}_min`]: text ? parseFloat(text) : null,
                                    })}
                                    placeholder={filter.min?.toString()}
                                    keyboardType="numeric"
                                />
                                {filter.unit && (
                                    <Text style={styles.rangeUnit}>{filter.unit}</Text>
                                )}
                            </View>
                            <Text style={styles.rangeSeparator}>-</Text>
                            <View style={styles.rangeInputContainer}>
                                <Text style={styles.rangeInputLabel}>Max</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    value={filters[`${filter.id}_max`]?.toString() || ''}
                                    onChangeText={(text) => setFilters({
                                        ...filters,
                                        [`${filter.id}_max`]: text ? parseFloat(text) : null,
                                    })}
                                    placeholder={filter.max?.toString()}
                                    keyboardType="numeric"
                                />
                                {filter.unit && (
                                    <Text style={styles.rangeUnit}>{filter.unit}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                );

            case 'select':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <View style={styles.selectContainer}>
                            {filter.options?.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.selectOption,
                                        filters[filter.id] === option.value && {
                                            backgroundColor: categoryStyle.primaryColor,
                                            borderColor: categoryStyle.primaryColor,
                                        },
                                    ]}
                                    onPress={() => setFilters({
                                        ...filters,
                                        [filter.id]: filters[filter.id] === option.value ? null : option.value,
                                    })}
                                >
                                    <Text
                                        style={[
                                            styles.selectOptionText,
                                            filters[filter.id] === option.value && styles.selectOptionTextActive,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    {filters[filter.id] === option.value && (
                                        <SafeIcon name="check" size={14} color="#FFFFFF" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 'multiselect':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <View style={styles.multiselectContainer}>
                            {filter.options?.map((option) => {
                                const isSelected = Array.isArray(filters[filter.id]) &&
                                    filters[filter.id].includes(option.value);
                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.multiselectOption,
                                            isSelected && {
                                                backgroundColor: categoryStyle.badgeColor,
                                                borderColor: categoryStyle.primaryColor,
                                            },
                                        ]}
                                        onPress={() => {
                                            const currentValues = filters[filter.id] || [];
                                            const newValues = isSelected
                                                ? currentValues.filter((v: string) => v !== option.value)
                                                : [...currentValues, option.value];
                                            setFilters({
                                                ...filters,
                                                [filter.id]: newValues.length > 0 ? newValues : null,
                                            });
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.multiselectOptionText,
                                                isSelected && { color: categoryStyle.primaryColor },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                        {isSelected && (
                                            <SafeIcon name="check-circle" size={14} color={categoryStyle.primaryColor} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                );

            case 'toggle':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <View style={styles.toggleContainer}>
                            <Text style={styles.filterLabel}>{filter.label}</Text>
                            <Switch
                                value={filters[filter.id] || false}
                                onValueChange={(value) => setFilters({
                                    ...filters,
                                    [filter.id]: value || null,
                                })}
                                trackColor={{ false: '#D1D5DB', true: categoryStyle.primaryColor }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>
                );

            case 'date':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <TextInput
                            style={styles.textInput}
                            value={filters[filter.id] || ''}
                            onChangeText={(text) => setFilters({
                                ...filters,
                                [filter.id]: text || null,
                            })}
                            placeholder="JJ/MM/AAAA"
                        />
                    </View>
                );

            case 'time':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <TextInput
                            style={styles.textInput}
                            value={filters[filter.id] || ''}
                            onChangeText={(text) => setFilters({
                                ...filters,
                                [filter.id]: text || null,
                            })}
                            placeholder="HH:MM"
                        />
                    </View>
                );

            default:
                return null;
        }
    };

    // Compter le nombre de filtres actifs
    const activeFiltersCount = Object.keys(filters).filter((key) => {
        const value = filters[key];
        return value !== null && value !== undefined && value !== '';
    }).length;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleContainer}>
                            <Text style={styles.modalTitle}>Filtrer les {terminology.productsLabel.toLowerCase()}</Text>
                            {activeFiltersCount > 0 && (
                                <View style={[styles.filterBadge, { backgroundColor: categoryStyle.primaryColor }]}>
                                    <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#1F2937" />
                        </TouchableOpacity>
                    </View>

                    {/* Filters */}
                    <ScrollView style={styles.filtersContent} showsVerticalScrollIndicator={false}>
                        {categoryFilters.map((filter) => renderFilter(filter))}
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={handleReset}
                        >
                            <SafeIcon name="refresh-cw" size={18} color="#6B7280" />
                            <Text style={styles.resetButtonText}>Réinitialiser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.applyButton, { backgroundColor: categoryStyle.primaryColor }]}
                            onPress={handleApply}
                        >
                            <SafeIcon name="check" size={18} color="#FFFFFF" />
                            <Text style={styles.applyButtonText}>Appliquer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
    },
    filterBadge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        minWidth: 24,
        alignItems: 'center',
    },
    filterBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 4,
    },
    filtersContent: {
        padding: 20,
    },
    filterContainer: {
        marginBottom: 24,
    },
    filterLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 12,
    },
    rangeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rangeInputContainer: {
        flex: 1,
        gap: 6,
    },
    rangeInputLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6B7280',
    },
    rangeInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1F2937',
        backgroundColor: '#F9FAFB',
    },
    rangeUnit: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    rangeSeparator: {
        fontSize: 18,
        fontWeight: '600',
        color: '#9CA3AF',
        marginTop: 20,
    },
    selectContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    selectOptionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#4B5563',
    },
    selectOptionTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    multiselectContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    multiselectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    multiselectOptionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#4B5563',
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1F2937',
        backgroundColor: '#F9FAFB',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    resetButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    resetButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    applyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    applyButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default CategoryFilters;

