/**
 * Composant de filtres pour la recherche de tickets
 * Permet de filtrer par prix, horaire, compagnie, etc.
 */

import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeButton, NativeInput } from './SafeNativeDesign';

export interface SearchFilters {
    minPrice: number | null;
    maxPrice: number | null;
    timeRange: 'morning' | 'afternoon' | 'evening' | null;
    company: string | null;
    sortBy: 'price' | 'time' | 'duration' | 'popularity';
    sortOrder: 'asc' | 'desc';
    availability?: string;
    services?: string[];
    rating?: number;
}

interface SearchFiltersProps {
    visible: boolean;
    onClose: () => void;
    filters?: SearchFilters;
    onApply: (filters: SearchFilters) => void;
    companies?: string[];
    initialFilters?: SearchFilters;
    specializedType?: string;
}

const SearchFiltersComponent: React.FC<SearchFiltersProps> = ({
    visible,
    onClose,
    filters: initialFilters,
    onApply,
    companies = [],
}) => {
    const [filters, setFilters] = useState<SearchFilters>(initialFilters);
    const [minPriceText, setMinPriceText] = useState(
        initialFilters.minPrice?.toString() || ''
    );
    const [maxPriceText, setMaxPriceText] = useState(
        initialFilters.maxPrice?.toString() || ''
    );

    const handleApply = () => {
        const newFilters: SearchFilters = {
            ...filters,
            minPrice: minPriceText ? parseFloat(minPriceText) : null,
            maxPrice: maxPriceText ? parseFloat(maxPriceText) : null,
        };
        onApply(newFilters);
        onClose();
    };

    const handleReset = () => {
        const resetFilters: SearchFilters = {
            minPrice: null,
            maxPrice: null,
            timeRange: null,
            company: null,
            sortBy: 'price',
            sortOrder: 'asc',
        };
        setFilters(resetFilters);
        setMinPriceText('');
        setMaxPriceText('');
    };

    const timeRanges = [
        { value: 'morning', label: 'Matin (6h-12h)' },
        { value: 'afternoon', label: 'Après-midi (12h-18h)' },
        { value: 'evening', label: 'Soir (18h-24h)' },
    ] as const;

    const sortOptions = [
        { value: 'price', label: 'Prix' },
        { value: 'time', label: 'Horaire' },
        { value: 'duration', label: 'Durée' },
        { value: 'popularity', label: 'Popularité' },
    ] as const;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Filtres et tri</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Prix */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Prix (FCFA)</Text>
                            <View style={styles.priceRow}>
                                <View style={styles.priceInput}>
                                    <Text style={styles.label}>Min</Text>
                                    <NativeInput
                                        value={minPriceText}
                                        onChangeText={setMinPriceText}
                                        placeholder="0"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.priceInput}>
                                    <Text style={styles.label}>Max</Text>
                                    <NativeInput
                                        value={maxPriceText}
                                        onChangeText={setMaxPriceText}
                                        placeholder="100000"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Horaire */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Horaire de départ</Text>
                            <View style={styles.chipsContainer}>
                                {timeRanges.map((range) => (
                                    <TouchableOpacity
                                        key={range.value}
                                        style={[
                                            styles.chip,
                                            filters.timeRange === range.value && styles.chipActive,
                                        ]}
                                        onPress={() =>
                                            setFilters({
                                                ...filters,
                                                timeRange:
                                                    filters.timeRange === range.value
                                                        ? null
                                                        : range.value,
                                            })
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                filters.timeRange === range.value &&
                                                styles.chipTextActive,
                                            ]}
                                        >
                                            {range.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Compagnie */}
                        {companies.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Compagnie</Text>
                                <View style={styles.chipsContainer}>
                                    {companies.map((company) => (
                                        <TouchableOpacity
                                            key={company}
                                            style={[
                                                styles.chip,
                                                filters.company === company && styles.chipActive,
                                            ]}
                                            onPress={() =>
                                                setFilters({
                                                    ...filters,
                                                    company:
                                                        filters.company === company ? null : company,
                                                })
                                            }
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    filters.company === company &&
                                                    styles.chipTextActive,
                                                ]}
                                            >
                                                {company}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Tri */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Trier par</Text>
                            <View style={styles.sortContainer}>
                                {sortOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.sortOption,
                                            filters.sortBy === option.value && styles.sortOptionActive,
                                        ]}
                                        onPress={() =>
                                            setFilters({ ...filters, sortBy: option.value })
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.sortOptionText,
                                                filters.sortBy === option.value &&
                                                styles.sortOptionTextActive,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.sortOrderContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.sortOrderButton,
                                        filters.sortOrder === 'asc' && styles.sortOrderButtonActive,
                                    ]}
                                    onPress={() => setFilters({ ...filters, sortOrder: 'asc' })}
                                >
                                    <SafeIcon
                                        name="arrow-up"
                                        size={16}
                                        color={
                                            filters.sortOrder === 'asc'
                                                ? '#fff'
                                                : modernColors.primary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.sortOrderText,
                                            filters.sortOrder === 'asc' &&
                                            styles.sortOrderTextActive,
                                        ]}
                                    >
                                        Croissant
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.sortOrderButton,
                                        filters.sortOrder === 'desc' && styles.sortOrderButtonActive,
                                    ]}
                                    onPress={() => setFilters({ ...filters, sortOrder: 'desc' })}
                                >
                                    <SafeIcon
                                        name="arrow-down"
                                        size={16}
                                        color={
                                            filters.sortOrder === 'desc'
                                                ? '#fff'
                                                : modernColors.primary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.sortOrderText,
                                            filters.sortOrder === 'desc' &&
                                            styles.sortOrderTextActive,
                                        ]}
                                    >
                                        Décroissant
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                            <Text style={styles.resetButtonText}>Réinitialiser</Text>
                        </TouchableOpacity>
                        <NativeButton
                            title="Appliquer"
                            onPress={handleApply}
                            variant="primary"
                            size="large"
                            style={styles.applyButton}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    priceRow: {
        flexDirection: 'row',
        gap: 12,
    },
    priceInput: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    sortContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    sortOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sortOptionActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    sortOptionText: {
        fontSize: 14,
        color: '#374151',
    },
    sortOptionTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    sortOrderContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    sortOrderButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#fff',
    },
    sortOrderButtonActive: {
        backgroundColor: modernColors.primary,
    },
    sortOrderText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    sortOrderTextActive: {
        color: '#fff',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    resetButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    applyButton: {
        flex: 1,
    },
});

export default SearchFiltersComponent;
