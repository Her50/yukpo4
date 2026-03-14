// ✅ NOUVEAU: Sélecteur de filtres artistiques IA avec preview temps réel

import { Slider } from '@react-native-community/slider';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import type { ArtisticFilterConfig, FilteredVideoResult } from '../types/ArtisticFilter';
import { SafeIcon } from './SafeIcon';
import { NativeButton, NativeInput } from './SafeNativeDesign';

interface ArtisticFilterSelectorProps {
    videoUrl: string;
    onFilterApplied?: (result: FilteredVideoResult) => void;
    maxSelection?: number;
    showPreview?: boolean;
}

const FILTER_CATEGORIES = [
    { key: 'classics', label: '🎨 Classiques', icon: 'palette' },
    { key: 'modern', label: '🌆 Modernes', icon: 'sparkles' },
    { key: 'abstract', label: '🔷 Abstraits', icon: 'box' },
    { key: 'vintage', label: '📷 Vintage', icon: 'camera' },
];

const STYLE_PRESETS = {
    subtle: { label: 'Subtil', range: [0.1, 0.4] },
    moderate: { label: 'Modéré', range: [0.4, 0.7] },
    intense: { label: 'Intense', range: [0.7, 1.0] },
};

export const ArtisticFilterSelector: React.FC<ArtisticFilterSelectorProps> = ({
    videoUrl,
    onFilterApplied,
    maxSelection = 3,
    showPreview = true,
}) => {
    const [filters, setFilters] = useState<ArtisticFilterConfig[]>([]);
    const [selectedFilters, setSelectedFilters] = useState<Map<string, { intensity: number }>>(new Map());
    const [loading, setLoading] = useState(true);
    const [applyingFilter, setApplyingFilter] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewFilter, setPreviewFilter] = useState<ArtisticFilterConfig | null>(null);
    const [intensityPreset, setIntensityPreset] = useState<keyof typeof STYLE_PRESETS>('moderate');

    // Charger les filtres disponibles
    useEffect(() => {
        loadFilters();
    }, []);

    const loadFilters = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await apiGet('/video/artistic-filters');
            const rd: any = response.data;
            if (response.success && rd?.filters) {
                setFilters(rd.filters);
            } else {
                throw new Error(response.error || 'Erreur chargement filtres');
            }
        } catch (err: any) {
            console.error('[ArtisticFilterSelector] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement des filtres');
        } finally {
            setLoading(false);
        }
    }, []);

    // Filtrer les filtres
    const filteredFilters = filters.filter(filter => {
        const matchesCategory = selectedCategory === 'all' ||
            (selectedCategory === 'classics' && ['van_gogh', 'monet', 'picasso'].some(name => filter.name.includes(name))) ||
            (selectedCategory === 'modern' && ['banksy', 'warhol', 'manga'].some(name => filter.name.includes(name))) ||
            (selectedCategory === 'abstract' && ['kandinsky', 'cyberpunk'].some(name => filter.name.includes(name))) ||
            (selectedCategory === 'vintage' && ['vintage', 'sepia'].some(name => filter.name.includes(name)));

        const matchesSearch = !searchQuery.trim() ||
            filter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            filter.style_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            filter.artist.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesSearch;
    });

    const handleFilterSelect = useCallback((filter: ArtisticFilterConfig) => {
        const currentSelection = new Map(selectedFilters);

        if (currentSelection.has(filter.name)) {
            // Désélectionner
            currentSelection.delete(filter.name);
        } else if (currentSelection.size < maxSelection) {
            // Sélectionner avec intensité par défaut
            const defaultIntensity = STYLE_PRESETS[intensityPreset].range[0] +
                (STYLE_PRESETS[intensityPreset].range[1] - STYLE_PRESETS[intensityPreset].range[0]) / 2;
            currentSelection.set(filter.name, { intensity: defaultIntensity });
        }

        setSelectedFilters(currentSelection);
    }, [selectedFilters, maxSelection, intensityPreset]);

    const handleIntensityChange = useCallback((filterName: string, intensity: number) => {
        const currentSelection = new Map(selectedFilters);
        if (currentSelection.has(filterName)) {
            currentSelection.set(filterName, { intensity });
            setSelectedFilters(currentSelection);
        }
    }, [selectedFilters]);

    const applyFilters = useCallback(async () => {
        if (selectedFilters.size === 0) {
            setError('Veuillez sélectionner au moins un filtre');
            return;
        }

        setApplyingFilter(true);
        setError(null);

        try {
            // Convertir Map en tableau pour l'API
            const filterChain = Array.from(selectedFilters.entries()).map(([name, config]) => ({
                filter_name: name,
                intensity: config.intensity
            }));

            const response = await apiPost('/video/apply-artistic-filters', {
                video_url: videoUrl,
                filter_chain: filterChain
            });

            const ard: any = response.data;
            if (response.success && ard?.results) {
                const results = ard.results;
                onFilterApplied?.(results[results.length - 1]); // Dernier résultat

                // Feedback succès
                Alert.alert(
                    '✅ Filtres appliqués!',
                    `${results.length} filtre(s) appliqué(s) avec succès.\nTemps de traitement: ${results[0]?.processing_time_ms || 0}ms`,
                    [{ text: 'OK' }]
                );
            } else {
                throw new Error(response.error || 'Erreur application filtres');
            }
        } catch (err: any) {
            console.error('[ArtisticFilterSelector] Erreur application:', err);
            setError(err.message || 'Erreur lors de l\'application des filtres');
        } finally {
            setApplyingFilter(false);
        }
    }, [selectedFilters, videoUrl, onFilterApplied]);

    const renderFilterItem = useCallback(({ item: filter }: { item: ArtisticFilterConfig }) => {
        const isSelected = selectedFilters.has(filter.name);
        const intensity = selectedFilters.get(filter.name)?.intensity || 0.5;

        return (
            <TouchableOpacity
                style={[
                    styles.filterCard,
                    isSelected && styles.filterCardSelected,
                    { borderLeftColor: filter.is_premium ? modernColors.accent : modernColors.primary }
                ]}
                onPress={() => handleFilterSelect(filter)}
                disabled={applyingFilter}
            >
                <View style={styles.filterHeader}>
                    <View style={styles.filterInfo}>
                        <Text style={styles.filterName}>{filter.style_name}</Text>
                        <Text style={styles.filterArtist}>{filter.artist}</Text>
                        <Text style={styles.filterDescription} numberOfLines={2}>
                            {filter.description}
                        </Text>
                    </View>
                    <View style={styles.filterMeta}>
                        {filter.is_premium && (
                            <SafeIcon name="crown" size={16} color={modernColors.accent} />
                        )}
                        {filter.gpu_required && (
                            <SafeIcon name="cpu" size={16} color={modernColors.primary} />
                        )}
                        {isSelected && (
                            <View style={styles.selectedBadge}>
                                <SafeIcon name="check" size={14} color="white" />
                            </View>
                        )}
                    </View>
                </View>

                {isSelected && (
                    <View style={styles.intensityControl}>
                        <Text style={styles.intensityLabel}>
                            Intensité: {Math.round(intensity * 100)}%
                        </Text>
                        <Slider
                            style={styles.intensitySlider}
                            minimumValue={filter.intensity_range[0]}
                            maximumValue={filter.intensity_range[1]}
                            value={intensity}
                            onValueChange={(value) => handleIntensityChange(filter.name, value)}
                            minimumTrackTintColor={modernColors.primary}
                            maximumTrackTintColor={modernColors.border}
                            thumbStyle={styles.sliderThumb}
                        />
                        <View style={styles.intensityPresets}>
                            {Object.entries(STYLE_PRESETS).map(([key, preset]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[
                                        styles.presetButton,
                                        intensityPreset === key && styles.presetButtonSelected
                                    ]}
                                    onPress={() => {
                                        setIntensityPreset(key as keyof typeof STYLE_PRESETS);
                                        const newIntensity = preset.range[0] +
                                            (preset.range[1] - preset.range[0]) / 2;
                                        handleIntensityChange(filter.name, newIntensity);
                                    }}
                                >
                                    <Text style={[
                                        styles.presetButtonText,
                                        intensityPreset === key && styles.presetButtonTextSelected
                                    ]}>
                                        {preset.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.filterFooter}>
                    <Text style={styles.processingTime}>
                        ⏱️ {filter.processing_time_seconds}s
                    </Text>
                    <Text style={styles.formatInfo}>
                        {filter.input_formats.join(', ')} → {filter.output_formats.join(', ')}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }, [selectedFilters, applyingFilter, intensityPreset, handleFilterSelect, handleIntensityChange]);

    const renderCategoryButton = useCallback((category: typeof FILTER_CATEGORIES[0]) => (
        <TouchableOpacity
            key={category.key}
            style={[
                styles.categoryButton,
                selectedCategory === category.key && styles.categoryButtonSelected
            ]}
            onPress={() => setSelectedCategory(category.key)}
        >
            <SafeIcon name={category.icon} size={16} color={modernColors.primary} />
            <Text style={[
                styles.categoryButtonText,
                selectedCategory === category.key && styles.categoryButtonTextSelected
            ]}>
                {category.label}
            </Text>
        </TouchableOpacity>
    ), [selectedCategory]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des filtres artistiques...</Text>
            </View>
        );
    }

    if (error && !applyingFilter) {
        return (
            <View style={styles.errorContainer}>
                <SafeIcon name="alert-circle" size={24} color={modernColors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <NativeButton title="Réessayer" onPress={loadFilters} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Filtres Artistiques IA</Text>
                <Text style={styles.subtitle}>
                    Transformez vos vidéos en œuvres d'art • {selectedFilters.size}/{maxSelection} sélectionnés
                </Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesContainer}
                contentContainerStyle={styles.categoriesContent}
            >
                <TouchableOpacity
                    style={[
                        styles.categoryButton,
                        selectedCategory === 'all' && styles.categoryButtonSelected
                    ]}
                    onPress={() => setSelectedCategory('all')}
                >
                    <SafeIcon name="grid" size={16} color={modernColors.primary} />
                    <Text style={[
                        styles.categoryButtonText,
                        selectedCategory === 'all' && styles.categoryButtonTextSelected
                    ]}>
                        Tous
                    </Text>
                </TouchableOpacity>
                {FILTER_CATEGORIES.map(renderCategoryButton)}
            </ScrollView>

            <View style={styles.searchContainer}>
                <NativeInput
                    placeholder="Rechercher un filtre, artiste ou style..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                />
            </View>

            <FlatList
                data={filteredFilters}
                renderItem={renderFilterItem}
                keyExtractor={(item) => item.name}
                style={styles.filtersList}
                contentContainerStyle={styles.filtersListContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="search" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyText}>Aucun filtre trouvé</Text>
                        <Text style={styles.emptySubtext}>Essayez d'autres termes de recherche</Text>
                    </View>
                }
            />

            {selectedFilters.size > 0 && (
                <View style={styles.actionContainer}>
                    <NativeButton
                        title={applyingFilter ? "Application..." : `Appliquer ${selectedFilters.size} filtre(s)`}
                        onPress={applyFilters}
                        disabled={applyingFilter}
                        style={styles.applyButton}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    categoriesContainer: {
        maxHeight: 60,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    categoriesContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: 'white',
        gap: 6,
        minWidth: 80,
    },
    categoryButtonSelected: {
        backgroundColor: modernColors.background,
        borderColor: modernColors.primary,
    },
    categoryButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    categoryButtonTextSelected: {
        color: modernColors.primary,
    },
    searchContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    searchInput: {
        flex: 1,
    },
    filtersList: {
        flex: 1,
    },
    filtersListContent: {
        padding: 16,
        gap: 16,
    },
    filterCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    filterCardSelected: {
        backgroundColor: `${modernColors.primary}10`,
        borderColor: modernColors.primary,
    },
    filterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    filterInfo: {
        flex: 1,
    },
    filterName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    filterArtist: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '500',
        marginBottom: 4,
    },
    filterDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    filterMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    selectedBadge: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 6,
    },
    intensityControl: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    intensityLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 8,
    },
    intensitySlider: {
        width: '100%',
        height: 40,
    },
    sliderThumb: {
        width: 20,
        height: 20,
        backgroundColor: modernColors.primary,
    },
    intensityPresets: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        gap: 8,
    },
    presetButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: 'white',
        alignItems: 'center',
    },
    presetButtonSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    presetButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    presetButtonTextSelected: {
        color: 'white',
    },
    filterFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    processingTime: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    formatInfo: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    actionContainer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    applyButton: {
        backgroundColor: modernColors.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default ArtisticFilterSelector;
