/**
 * FiltersBottomSheet - Bottom sheet pour les filtres de recherche
 * Remplace le FiltersPanel par un bottom sheet moderne et interactif
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { hapticSelect } from '../../utils/hapticFeedback';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

type SortOption = 'pertinence' | 'proximite' | 'prix_asc' | 'prix_desc';
type FilterCategory = 'all' | 'with_stock' | 'with_variants' | 'nearby';

interface FiltersBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
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
    onApplyFilters: () => void;
    onResetFilters: () => void;
}

const FiltersBottomSheet: React.FC<FiltersBottomSheetProps> = ({
    isOpen,
    onClose,
    sortBy,
    onSortChange,
    filterCategory,
    onFilterCategoryChange,
    priceFilter,
    onPriceFilterChange,
    dynamicFilters,
    selectedFilters,
    onSelectedFiltersChange,
    onApplyFilters,
    onResetFilters,
}) => {
    const snapPoints = useMemo(() => ['85%'], []);
    const bottomSheetRef = React.useRef<BottomSheet>(null);

    // Ouvrir/fermer le bottom sheet
    React.useEffect(() => {
        if (isOpen) {
            bottomSheetRef.current?.expand();
        } else {
            bottomSheetRef.current?.close();
        }
    }, [isOpen]);

    // Backdrop personnalisé
    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    const handleApply = useCallback(() => {
        hapticSelect();
        onApplyFilters();
        bottomSheetRef.current?.close();
    }, [onApplyFilters]);

    const handleReset = useCallback(() => {
        hapticSelect();
        onResetFilters();
    }, [onResetFilters]);

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            onClose={onClose}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            animateOnMount
        >
            <BottomSheetView style={styles.headerContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t('filtersBottomSheet.filtresEtTri')}/Text>
                    <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                        <SafeIcon name="rotate-ccw" size={18} color={modernColors.primary} />
                        <Text style={styles.resetText}>{t('filtersBottomSheet.reinitialiser')}</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetView>

            <BottomSheetScrollView
                style={styles.contentContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Tri */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('filtersBottomSheet.trierPar')}</Text>
                    <View style={styles.optionsRow}>
                        <TouchableOpacity
                            style={[styles.optionButton, sortBy === 'pertinence' && styles.optionButtonActive]}
                            onPress={() => {
                                hapticSelect();
                                onSortChange('pertinence');
                            }}
                        >
                            <SafeIcon
                                name="zap"
                                size={18}
                                color={sortBy === 'pertinence' ? '#FFFFFF' : modernColors.primary}
                            />
                            <Text style={[styles.optionText, sortBy === 'pertinence' && styles.optionTextActive]}>
                                Pertinence
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.optionButton, sortBy === 'proximite' && styles.optionButtonActive]}
                            onPress={() => {
                                hapticSelect();
                                onSortChange('proximite');
                            }}
                        >
                            <SafeIcon
                                name="map-pin"
                                size={18}
                                color={sortBy === 'proximite' ? '#FFFFFF' : modernColors.primary}
                            />
                            <Text style={[styles.optionText, sortBy === 'proximite' && styles.optionTextActive]}>
                                Proximité
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.optionButton, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.optionButtonActive]}
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
                            <SafeIcon
                                name={sortBy === 'prix_desc' ? 'arrow-down' : 'arrow-up'}
                                size={18}
                                color={(sortBy === 'prix_asc' || sortBy === 'prix_desc') ? '#FFFFFF' : modernColors.primary}
                            />
                            <Text style={[styles.optionText, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.optionTextActive]}>
                                Prix {sortBy === 'prix_desc' ? '↓' : sortBy === 'prix_asc' ? '↑' : ''}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Catégories rapides */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('filtersBottomSheet.categoriesRapides')}</Text>
                    <View style={styles.optionsRow}>
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
                                    style={[styles.optionButton, isActive && styles.optionButtonActive]}
                                    onPress={() => {
                                        hapticSelect();
                                        onFilterCategoryChange(category.key);
                                    }}
                                >
                                    <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Filtre par prix */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('filtersBottomSheet.filtreDePrix')}</Text>
                    <View style={styles.priceRow}>
                        <TextInput
                            style={styles.priceInput}
                            placeholder="Min"
                            placeholderTextColor="#9CA3AF"
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
                        <Text style={styles.priceSeparator}>—</Text>
                        <TextInput
                            style={styles.priceInput}
                            placeholder="Max"
                            placeholderTextColor="#9CA3AF"
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
                    <Text style={styles.priceInfo}>Devise: {priceFilter.currency}</Text>
                </View>

                {/* Filtres dynamiques */}
                {dynamicFilters && typeof dynamicFilters === 'object' && Object.entries(dynamicFilters).map(([label, values]) => (
                    <View key={label} style={styles.section}>
                        <View style={styles.dynamicFilterHeader}>
                            <Text style={styles.sectionTitle}>{label}</Text>
                            {selectedFilters[label] && (
                                <TouchableOpacity
                                    onPress={() => {
                                        const next = { ...selectedFilters };
                                        delete next[label];
                                        onSelectedFiltersChange(next);
                                    }}
                                >
                                    <Text style={styles.clearFilterText}>Effacer</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.chipsContainer}>
                            {values && (values instanceof Set || Array.isArray(values)) ? Array.from(values).filter(v => v != null && v !== undefined && String(v).trim() !== '').map((value) => {
                                const isActive = selectedFilters[label] === value;
                                return (
                                    <TouchableOpacity
                                        key={String(value)}
                                        style={[styles.chip, isActive && styles.chipActive]}
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
                                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                            {String(value)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }) : null}
                        </View>
                    </View>
                ))}
            </BottomSheetScrollView>

            <BottomSheetView style={styles.footerContainer}>
                <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                    <Text style={styles.applyButtonText}>Appliquer les filtres</Text>
                </TouchableOpacity>
            </BottomSheetView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    bottomSheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    handleIndicator: {
        backgroundColor: '#D1D5DB',
        width: 40,
        height: 4,
    },
    headerContainer: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    resetText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    contentContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 100,
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
    },
    optionButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    optionTextActive: {
        color: '#FFFFFF',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    priceInput: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 15,
        color: '#0F172A',
    },
    priceSeparator: {
        fontSize: 18,
        color: '#64748B',
        fontWeight: '600',
    },
    priceInfo: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    dynamicFilterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    clearFilterText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
    },
    chipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    footerContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    applyButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default FiltersBottomSheet;

