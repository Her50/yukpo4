/**
 * Composant pour sélectionner des filtres vidéo
 */

import React, { useCallback, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    VideoFilter,
    videoEffectsService,
} from '../../services/videoEffectsService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface VideoFilterSelectorProps {
    selectedFilter: VideoFilter;
    onFilterSelect: (filter: VideoFilter) => void;
    onClose: () => void;
    showIntensity?: boolean;
    onIntensityChange?: (intensity: number) => void;
}

const VideoFilterSelector: React.FC<VideoFilterSelectorProps> = ({
    selectedFilter,
    onFilterSelect,
    onClose,
    showIntensity = false,
    onIntensityChange,
}) => {
        const { t } = useLanguageSafe();
const [intensity, setIntensity] = useState(100);
    const availableFilters = videoEffectsService.getAvailableFilters();

    const handleIntensityChange = useCallback((value: number) => {
        setIntensity(value);
        onIntensityChange?.(value);
    }, [onIntensityChange]);

    const renderFilterItem = useCallback(
        ({ item }: { item: VideoFilter }) => {
            const isSelected = item === selectedFilter;
            const description = videoEffectsService.getFilterDescription(item);

            return (
                <TouchableOpacity
                    style={[
                        styles.filterItem,
                        isSelected && styles.filterItemSelected,
                    ]}
                    onPress={() => onFilterSelect(item)}
                    activeOpacity={0.7}
                >
                    <View style={styles.filterIconContainer}>
                        <SafeIcon
                            name={isSelected ? 'check-circle' : 'circle'}
                            size={24}
                            color={isSelected ? modernColors.primary : modernColors.textSecondary}
                        />
                    </View>
                    <View style={styles.filterInfo}>
                        <Text
                            style={[
                                styles.filterName,
                                isSelected && styles.filterNameSelected,
                            ]}
                        >
                            {description}
                        </Text>
                        <Text style={styles.filterType}>
                            {item === 'none' ? 'Original' : item.toUpperCase()}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        },
        [selectedFilter, onFilterSelect]
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('videoFilterSelector.filtresVideo')}</Text>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    activeOpacity={0.7}
                >
                    <SafeIcon name="x" size={24} color={modernColors.text} />
                </TouchableOpacity>
            </View>

            {/* Filters List */}
            <FlatList
                data={availableFilters}
                renderItem={renderFilterItem}
                keyExtractor={(item) => item}
                style={styles.filtersList}
                contentContainerStyle={styles.filtersListContent}
            />

            {/* Intensity Slider (si activé) */}
            {showIntensity && selectedFilter !== 'none' && (
                <View style={styles.intensityContainer}>
                    <Text style={styles.intensityLabel}>
                        Intensité: {intensity}%
                    </Text>
                    <View style={styles.sliderContainer}>
                        <TouchableOpacity
                            style={styles.sliderButton}
                            onPress={() => handleIntensityChange(Math.max(0, intensity - 10))}
                        >
                            <SafeIcon name="minus" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                        <View style={styles.sliderTrack}>
                            <View
                                style={[
                                    styles.sliderFill,
                                    { width: `${intensity}%` },
                                ]}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.sliderButton}
                            onPress={() => handleIntensityChange(Math.min(100, intensity + 10))}
                        >
                            <SafeIcon name="plus" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filtersList: {
        flex: 1,
    },
    filtersListContent: {
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    filterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: modernColors.surface,
    },
    filterItemSelected: {
        backgroundColor: modernColors.primary + '20',
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    filterIconContainer: {
        marginRight: 12,
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
    filterNameSelected: {
        color: modernColors.primary,
    },
    filterType: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    intensityContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    intensityLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sliderButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 8,
    },
    sliderTrack: {
        flex: 1,
        height: 8,
        backgroundColor: modernColors.border,
        borderRadius: 4,
        marginHorizontal: 12,
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 4,
    },
});

export default VideoFilterSelector;

