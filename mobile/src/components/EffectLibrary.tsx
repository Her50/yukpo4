// ✅ NOUVEAU: Bibliothèque d'effets vidéo avec recherche et catégorisation (50+)

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Effect, effectLibraryService } from '../services/effectLibraryService';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeInput } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export type EffectCategory = 'transitions' | 'visual_effects' | 'animations' | 'special' | 'all';

interface EffectLibraryProps {
    onEffectSelected?: (effect: Effect) => void;
    selectedEffects?: string[];
    showPreview?: boolean;
    filterCategory?: EffectCategory;
    maxSelection?: number;
}

const CATEGORIES: { key: EffectCategory; label: string; icon: string }[] = [
    { key: 'all', label: 'Tous', icon: 'grid' },
    { key: 'transitions', label: 'Transitions', icon: 'repeat' },
    { key: 'visual_effects', label: 'Effets Visuels', icon: 'sparkles' },
    { key: 'animations', label: 'Animations', icon: 'play' },
    { key: 'special', label: t('effectLibrary.speciaux'), icon: 'star' },
];

export const EffectLibrary: React.FC<EffectLibraryProps> = ({
    onEffectSelected,
    selectedEffects = [],
    showPreview = true,
    filterCategory = 'all',
    maxSelection,
}) => {
        const { t } = useLanguageSafe();
const [effects, setEffects] = useState<Effect[]>([]);
    const [filteredEffects, setFilteredEffects] = useState<Effect[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<EffectCategory>(filterCategory);
    const [showPremiumOnly, setShowPremiumOnly] = useState(false);

    // Charger les effets au montage
    useEffect(() => {
        loadEffects();
    }, [selectedCategory, showPremiumOnly]);

    const loadEffects = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params: any = {
                limit: 100,
                offset: 0,
            };

            if (selectedCategory !== 'all') {
                params.category = selectedCategory;
            }

            if (showPremiumOnly) {
                params.premium = true;
            }

            const response = await effectLibraryService.listEffects(params);
            setEffects(response.effects || []);
            setFilteredEffects(response.effects || []);
        } catch (err: any) {
            console.error('[EffectLibrary] Erreur chargement effets:', err);
            setError(err.message || 'Erreur lors du chargement des effets');
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, showPremiumOnly]);

    // Filtrer par recherche textuelle
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredEffects(effects);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = effects.filter(
            effect =>
                effect.name.toLowerCase().includes(query) ||
                effect.description.toLowerCase().includes(query) ||
                effect.tags.some(tag => tag.toLowerCase().includes(query))
        );
        setFilteredEffects(filtered);
    }, [searchQuery, effects]);

    const handleEffectPress = useCallback(
        (effect: Effect) => {
            if (maxSelection && selectedEffects.length >= maxSelection && !selectedEffects.includes(effect.name)) {
                // Atteint la limite
                return;
            }
            onEffectSelected?.(effect);
        },
        [onEffectSelected, selectedEffects, maxSelection]
    );

    const isEffectSelected = useCallback(
        (effectName: string) => selectedEffects.includes(effectName),
        [selectedEffects]
    );

    const renderEffectCard = useCallback(
        ({ item: effect }: { item: Effect }) => {
            const selected = isEffectSelected(effect.name);
            const canSelect = !maxSelection || selectedEffects.length < maxSelection || selected;

            return (
                <TouchableOpacity
                    style={[styles.effectCard, selected && styles.effectCardSelected]}
                    onPress={() => handleEffectPress(effect)}
                    disabled={!canSelect}
                    activeOpacity={0.7}
                >
                    <View style={styles.effectCardHeader}>
                        <View style={styles.effectCardHeaderLeft}>
                            {effect.is_premium && (
                                <SafeIcon name="star" size={16} color={modernColors.warning} />
                            )}
                            <Text style={styles.effectName} numberOfLines={1}>
                                {effect.name}
                            </Text>
                        </View>
                        {selected && (
                            <View style={styles.selectedBadge}>
                                <SafeIcon name="check" size={14} color="#FFFFFF" />
                            </View>
                        )}
                    </View>

                    <Text style={styles.effectDescription} numberOfLines={2}>
                        {effect.description}
                    </Text>

                    <View style={styles.effectTags}>
                        {effect.tags.slice(0, 3).map((tag, index) => (
                            <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                        {effect.tags.length > 3 && (
                            <Text style={styles.moreTagsText}>+{effect.tags.length - 3}</Text>
                        )}
                    </View>

                    {!canSelect && !selected && (
                        <View style={styles.maxSelectionOverlay}>
                            <Text style={styles.maxSelectionText}>
                                Limite atteinte ({maxSelection})
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            );
        },
        [handleEffectPress, isEffectSelected, selectedEffects, maxSelection]
    );

    if (loading && effects.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('effectLibrary.chargementDesEffets')}</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <NativeButton
                    variant="primary"
                    label={t('effectLibrary.reessayer')}
                    onPress={loadEffects}
                    style={styles.retryButton}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Barre de recherche */}
            <View style={styles.searchContainer}>
                <NativeInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t('effectLibrary.rechercherUnEffet')}
                    style={styles.searchInput}
                />
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowPremiumOnly(!showPremiumOnly)}
                >
                    <SafeIcon
                        name={showPremiumOnly ? 'star' : 'star-outline'}
                        size={20}
                        color={showPremiumOnly ? modernColors.warning : modernColors.textSecondary}
                    />
                </TouchableOpacity>
            </View>

            {/* Filtres par catégorie */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesContainer}
                contentContainerStyle={styles.categoriesContent}
            >
                {CATEGORIES.map(category => (
                    <TouchableOpacity
                        key={category.key}
                        style={[
                            styles.categoryButton,
                            selectedCategory === category.key && styles.categoryButtonActive,
                        ]}
                        onPress={() => setSelectedCategory(category.key)}
                    >
                        <SafeIcon
                            name={category.icon as any}
                            size={18}
                            color={
                                selectedCategory === category.key
                                    ? modernColors.primary
                                    : modernColors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.categoryButtonText,
                                selectedCategory === category.key && styles.categoryButtonTextActive,
                            ]}
                        >
                            {category.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Liste des effets */}
            <FlatList
                data={filteredEffects}
                renderItem={renderEffectCard}
                keyExtractor={item => item.name}
                numColumns={2}
                contentContainerStyle={styles.effectsList}
                columnWrapperStyle={styles.effectsRow}
                refreshing={loading}
                onRefresh={loadEffects}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="inbox" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyText}>
                            {searchQuery
                                ? t('effectLibrary.aucunEffetTrouvePourVotreRecherche')
                                : 'Aucun effet disponible'}
                        </Text>
                    </View>
                }
                ListHeaderComponent={
                    <Text style={styles.resultsCount}>
                        {filteredEffects.length} effet{filteredEffects.length > 1 ? 's' : 't('effectLibrary.trouveFilteredeffectslength1')s' : ''}
                    </Text>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
    },
    searchInput: {
        flex: 1,
    },
    filterButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 12,
    },
    categoriesContainer: {
        marginBottom: 16,
    },
    categoriesContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
        gap: 6,
    },
    categoryButtonActive: {
        backgroundColor: modernColors.primary + '20',
    },
    categoryButtonText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    categoryButtonTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    effectsList: {
        padding: 16,
    },
    effectsRow: {
        justifyContent: 'space-between',
        gap: 12,
    },
    effectCard: {
        flex: 1,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        minWidth: '47%',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    effectCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    effectCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    effectCardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    effectName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    selectedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    effectDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 16,
    },
    effectTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        alignItems: 'center',
    },
    tag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: modernColors.primary + '20',
        borderRadius: 4,
    },
    tagText: {
        fontSize: 10,
        color: modernColors.primary,
        fontWeight: '500',
    },
    moreTagsText: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    maxSelectionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    maxSelectionText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 16,
    },
    errorText: {
        fontSize: 14,
        color: modernColors.error,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 8,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48,
        gap: 16,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    resultsCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
        fontWeight: '500',
    },
});

