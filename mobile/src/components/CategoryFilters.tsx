import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { CategoryFilter, getCategoryFilters, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { trackFilterSuggestion } from '../utils/analytics'; // ✅ OPTIMISATION 6
import { SmartFilterSuggestion } from '../utils/smartFilterSuggestions';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface CategoryFiltersProps {
    category: string;
    visible: boolean;
    onClose: () => void;
    onApply: (filters: Record<string, any>) => void;
    initialFilters?: Record<string, any>;
    smartSuggestions?: SmartFilterSuggestion[];  // ✅ NOUVEAU: Suggestions intelligentes
    filterHistory?: any[];                        // ✅ NOUVEAU: Historique des filtres
}

const CategoryFilters: React.FC<CategoryFiltersProps> = ({
    category,
    visible,
    onClose,
    onApply,
    initialFilters = {},
    smartSuggestions = [],
    filterHistory = [],
}) => {
    const categoryFilters = getCategoryFilters(category);
    const categoryStyle = getCategoryStyle(category);
    const terminology = getCategoryTerminology(category);

    const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));

    // ✅ OPTIMISATION 4: Charger les filtres depuis le cache au montage
    useEffect(() => {
        const loadCachedFilters = async () => {
            try {
                const cacheKey = `filters_cache_${category}`;
                const cached = await AsyncStorage.getItem(cacheKey);

                if (cached) {
                    const cachedFilters = JSON.parse(cached);
                    console.log(`[CategoryFilters] Cache trouvé pour ${category}:`, Object.keys(cachedFilters));

                    // Fusionner avec initialFilters (initialFilters prioritaire)
                    setFilters({ ...cachedFilters, ...initialFilters });
                }
            } catch (error) {
                console.error('[CategoryFilters] Erreur chargement cache:', error);
            }
        };

        if (visible && category) {
            loadCachedFilters();
        }
    }, [category, visible]);

    // Animation d'entrée
    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible]);

    const handleApply = async () => {
        // ✅ OPTIMISATION 4: Sauvegarder les filtres dans le cache
        try {
            const cacheKey = `filters_cache_${category}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(filters));
            console.log(`[CategoryFilters] Filtres sauvegardés en cache pour ${category}`);
        } catch (error) {
            console.error('[CategoryFilters] Erreur sauvegarde cache:', error);
        }

        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({});
    };

    // ✅ NOUVEAU: Appliquer une suggestion intelligente
    const applySuggestion = (suggestion: SmartFilterSuggestion) => {
        const newFilters = { ...filters };

        if (suggestion.type === 'range') {
            newFilters[`${suggestion.id}_min`] = suggestion.min;
            newFilters[`${suggestion.id}_max`] = suggestion.max;
        } else {
            newFilters[suggestion.id] = suggestion.options?.[0]?.value || null;
        }

        setFilters(newFilters);
        console.log(`💡 Suggestion appliquée: ${suggestion.label}`);

        // ✅ OPTIMISATION 6: Track l'application de la suggestion
        trackFilterSuggestion(category, suggestion.id, suggestion.label);
    };

    // ✅ NOUVEAU: Appliquer un filtre de l'historique
    const applyHistoryFilter = (historyItem: any) => {
        setFilters(historyItem.filters);
        console.log(`📜 Historique appliqué: ${Object.keys(historyItem.filters).length} filtres`);
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

    // ✅ NOUVEAU: Formater le temps écoulé
    const formatTimeAgo = (timestamp: number): string => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return 'Il y a quelques secondes';
        if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
        return `Il y a ${Math.floor(seconds / 86400)}j`;
    };

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

                    {/* ✅ NOUVEAU: Suggestions Intelligentes */}
                    {smartSuggestions.length > 0 && (
                        <View style={styles.suggestionsSection}>
                            <TouchableOpacity
                                style={styles.sectionToggle}
                                onPress={() => setShowSuggestions(!showSuggestions)}
                            >
                                <View style={styles.sectionTitleContainer}>
                                    <SafeIcon name="lightbulb" size={20} color={categoryStyle.primaryColor} />
                                    <Text style={styles.sectionTitle}>
                                        Suggestions intelligentes ({smartSuggestions.length})
                                    </Text>
                                </View>
                                <SafeIcon
                                    name={showSuggestions ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>

                            {showSuggestions && (
                                <Animated.View style={{ opacity: fadeAnim }}>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.suggestionsScroll}
                                    >
                                        {smartSuggestions.slice(0, 5).map((suggestion, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={[
                                                    styles.suggestionCard,
                                                    { borderColor: categoryStyle.primaryColor }
                                                ]}
                                                onPress={() => applySuggestion(suggestion)}
                                            >
                                                <View style={styles.suggestionHeader}>
                                                    <View style={[
                                                        styles.priorityBadge,
                                                        { backgroundColor: categoryStyle.badgeColor }
                                                    ]}>
                                                        <Text style={[
                                                            styles.priorityText,
                                                            { color: categoryStyle.primaryColor }
                                                        ]}>
                                                            {suggestion.priority}/10
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.suggestionCount}>
                                                        {suggestion.applicableCount}+
                                                    </Text>
                                                </View>
                                                <Text style={styles.suggestionLabel}>
                                                    {suggestion.label}
                                                </Text>
                                                <Text style={styles.suggestionReason}>
                                                    {suggestion.reason}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </Animated.View>
                            )}
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Historique des filtres */}
                    {filterHistory.length > 0 && (
                        <View style={styles.historySection}>
                            <TouchableOpacity
                                style={styles.sectionToggle}
                                onPress={() => setShowHistory(!showHistory)}
                            >
                                <View style={styles.sectionTitleContainer}>
                                    <SafeIcon name="clock" size={20} color="#F59E0B" />
                                    <Text style={styles.sectionTitle}>
                                        Historique ({filterHistory.length})
                                    </Text>
                                </View>
                                <SafeIcon
                                    name={showHistory ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>

                            {showHistory && (
                                <View style={styles.historyList}>
                                    {filterHistory.slice(0, 3).map((item, index) => {
                                        const filterCount = Object.keys(item.filters).length;
                                        const timeAgo = formatTimeAgo(item.timestamp);

                                        return (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.historyItem}
                                                onPress={() => applyHistoryFilter(item)}
                                            >
                                                <View style={styles.historyInfo}>
                                                    <Text style={styles.historyFilterCount}>
                                                        {filterCount} filtre{filterCount > 1 ? 's' : ''}
                                                    </Text>
                                                    <Text style={styles.historyTime}>{timeAgo}</Text>
                                                </View>
                                                <View style={styles.historyResults}>
                                                    <Text style={styles.historyResultsText}>
                                                        {item.resultCount} résultat{item.resultCount > 1 ? 's' : ''}
                                                    </Text>
                                                    <SafeIcon name="arrow-right" size={16} color={categoryStyle.primaryColor} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

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
    // ✅ NOUVEAUX STYLES: Suggestions & Historique
    suggestionsSection: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    historySection: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFBEB',
    },
    sectionToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    suggestionsScroll: {
        paddingTop: 12,
        paddingRight: 20,
        gap: 12,
    },
    suggestionCard: {
        width: width * 0.7,
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priorityBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    priorityText: {
        fontSize: 12,
        fontWeight: '800',
    },
    suggestionCount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#10B981',
    },
    suggestionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 6,
    },
    suggestionReason: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    historyList: {
        marginTop: 12,
        gap: 10,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FDE68A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    historyInfo: {
        flex: 1,
    },
    historyFilterCount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    historyTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    historyResults: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    historyResultsText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#F59E0B',
    },
});

export default CategoryFilters;

