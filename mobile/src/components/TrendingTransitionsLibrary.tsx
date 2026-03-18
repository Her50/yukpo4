// ✅ NOUVEAU: Bibliothèque de 50+ transitions tendance avec preview temps réel

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
import { effectLibraryService } from '../services/effectLibraryService';
import { modernColors } from '../theme/modernTheme';
import { SafeIcon } from './SafeIcon';
import { NativeButton, NativeInput } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

export type TransitionCategory = 'transitions_tiktok' | 'transitions_creative' | 'transitions_professional' | 'transitions_glitch' | 'transitions_nature' | 'all';

interface TrendingTransitionsLibraryProps {
    onTransitionSelected?: (transition: any) => void;
    selectedTransitions?: string[];
    maxSelection?: number;
    showPreview?: boolean;
}

const CATEGORIES: { key: TransitionCategory; label: string; icon: string; color: string }[] = [
    { key: 'all', label: 'Toutes', icon: 'grid', color: modernColors.primary },
    { key: 'transitions_tiktok', label: '\uD83D\uDD25 TikTok', icon: 'trending-up', color: '#FF0050' },
    { key: 'transitions_creative', label: t('trendingTransitionsLibrary.creatives'), icon: 'sparkles', color: '#8B5CF6' },
    { key: 'transitions_professional', label: '\uD83D\uDCBC Pro', icon: 'briefcase', color: '#3B82F6' },
    { key: 'transitions_glitch', label: '⚡ Glitch', icon: 'zap', color: '#10B981' },
    { key: 'transitions_nature', label: '\uD83C\uDF3F Nature', icon: 'leaf', color: '#059669' },
];

const TRENDING_BADGES = {
    viral: { label: 'Viral', color: '#FF0050' },
    new: { label: 'New', color: '#8B5CF6' },
    premium: { label: 'Pro', color: '#3B82F6' },
    popular: { label: 'Trend', color: '#F59E0B' },
};

export const TrendingTransitionsLibrary: React.FC<TrendingTransitionsLibraryProps> = ({
    onTransitionSelected,
    selectedTransitions = [],
    maxSelection = 5,
    showPreview = true,
}) => {
        const { t } = useLanguageSafe();
const [transitions, setTransitions] = useState<any[]>([]);
    const [filteredTransitions, setFilteredTransitions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<TransitionCategory>('all');
    const [showPremiumOnly, setShowPremiumOnly] = useState(false);
    const [previewTransition, setPreviewTransition] = useState<any | null>(null);

    // Charger les transitions au montage
    useEffect(() => {
        loadTransitions();
    }, [selectedCategory, showPremiumOnly]);

    const loadTransitions = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params: any = {
                category: selectedCategory === 'all' ? undefined : selectedCategory,
                search_query: searchQuery.trim() || undefined,
                is_premium: showPremiumOnly || undefined,
                limit: 100,
                offset: 0,
            };

            const response = await effectLibraryService.listEffects(params);
            setTransitions(response.effects || []);
            setFilteredTransitions(response.effects || []);
        } catch (err: any) {
            console.error('[TrendingTransitionsLibrary] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement des transitions');
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, showPremiumOnly, searchQuery]);

    // Filtrer par recherche textuelle
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredTransitions(transitions);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = transitions.filter(
            transition =>
                transition.name.toLowerCase().includes(query) ||
                transition.description.toLowerCase().includes(query) ||
                transition.tags.some((tag: string) => tag.toLowerCase().includes(query))
        );
        setFilteredTransitions(filtered);
    }, [searchQuery, transitions]);

    const handleTransitionPress = useCallback(
        (transition: any) => {
            if (selectedTransitions.length >= maxSelection && !selectedTransitions.includes(transition.id)) {
                // Limite atteinte
                return;
            }

            onTransitionSelected?.(transition);

            if (showPreview) {
                setPreviewTransition(transition);
            }
        },
        [selectedTransitions, maxSelection, onTransitionSelected, showPreview]
    );

    const isSelected = useCallback(
        (transitionId: string) => selectedTransitions.includes(transitionId),
        [selectedTransitions]
    );

    const renderTransitionItem = useCallback(({ item: transition }: { item: any }) => {
        const selected = isSelected(transition.id);
        const categoryInfo = CATEGORIES.find(cat => cat.key === transition.category);
        const badges = [];

        // Ajouter badges automatiques
        if (transition.popularity_score > 90) badges.push('viral');
        if (transition.is_premium) badges.push('premium');
        if (transition.popularity_score > 80 && transition.popularity_score <= 90) badges.push('popular');

        return (
            <TouchableOpacity
                style={[
                    styles.transitionCard,
                    selected && styles.transitionCardSelected,
                    { borderLeftColor: categoryInfo?.color || modernColors.primary }
                ]}
                onPress={() => handleTransitionPress(transition)}
                disabled={selectedTransitions.length >= maxSelection && !selected}
            >
                <View style={styles.transitionHeader}>
                    <View style={styles.transitionInfo}>
                        <Text style={styles.transitionName}>{transition.name}</Text>
                        <Text style={styles.transitionDescription} numberOfLines={2}>
                            {transition.description}
                        </Text>
                    </View>
                    {selected && (
                        <View style={styles.selectedBadge}>
                            <SafeIcon name="check" size={16} color="white" />
                        </View>
                    )}
                </View>

                <View style={styles.transitionMeta}>
                    <View style={styles.transitionTags}>
                        {transition.tags.slice(0, 3).map((tag: string, index: number) => (
                            <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.transitionStats}>
                        <Text style={styles.popularityScore}>
                            \uD83D\uDD25 {transition.popularity_score}
                        </Text>
                        {transition.is_premium && (
                            <SafeIcon name="crown" size={14} color={modernColors.accent} />
                        )}
                    </View>
                </View>

                {badges.length > 0 && (
                    <View style={styles.badgesContainer}>
                        {badges.map((badge, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.badge,
                                    { backgroundColor: TRENDING_BADGES[badge as keyof typeof TRENDING_BADGES].color }
                                ]}
                            >
                                <Text style={styles.badgeText}>
                                    {TRENDING_BADGES[badge as keyof typeof TRENDING_BADGES].label}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [isSelected, handleTransitionPress, selectedTransitions, maxSelection]);

    const renderCategoryButton = useCallback(
        (category: typeof CATEGORIES[0]) => (
            <TouchableOpacity
                key={category.key}
                style={[
                    styles.categoryButton,
                    selectedCategory === category.key && styles.categoryButtonSelected,
                    { borderColor: category.color }
                ]}
                onPress={() => setSelectedCategory(category.key)}
            >
                <SafeIcon name={category.icon} size={16} color={category.color} />
                <Text
                    style={[
                        styles.categoryButtonText,
                        selectedCategory === category.key && { color: category.color }
                    ]}
                >
                    {category.label}
                </Text>
            </TouchableOpacity>
        ),
        [selectedCategory]
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('trendingTransitionsLibrary.chargementDesTransitionsTendance')}</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <SafeIcon name="alert-circle" size={24} color={modernColors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <NativeButton title={t('trendingTransitionsLibrary.reessayer')} onPress={loadTransitions} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Transitions Tendance</Text>
                <Text style={styles.subtitle}>
                    {filteredTransitions.length} transitions • {selectedTransitions.length}/{maxSelection} sélectionnées
                </Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesContainer}
                contentContainerStyle={styles.categoriesContent}
            >
                {CATEGORIES.map(renderCategoryButton)}
            </ScrollView>

            <View style={styles.filtersContainer}>
                <NativeInput
                    placeholder={t('trendingTransitionsLibrary.rechercherUneTransition')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                />
                <TouchableOpacity
                    style={[
                        styles.premiumToggle,
                        showPremiumOnly && styles.premiumToggleActive
                    ]}
                    onPress={() => setShowPremiumOnly(!showPremiumOnly)}
                >
                    <SafeIcon
                        name="crown"
                        size={16}
                        color={showPremiumOnly ? 'white' : modernColors.accent}
                    />
                    <Text
                        style={[
                            styles.premiumToggleText,
                            showPremiumOnly && styles.premiumToggleTextActive
                        ]}
                    >
                        Pro
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredTransitions}
                renderItem={renderTransitionItem}
                keyExtractor={(item) => item.id}
                style={styles.transitionsList}
                contentContainerStyle={styles.transitionsListContent}
                showsVerticalScrollIndicator={false}
            />
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
        backgroundColor: 'white',
        gap: 6,
        minWidth: 80,
    },
    categoryButtonSelected: {
        backgroundColor: modernColors.background,
    },
    categoryButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    filtersContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    searchInput: {
        flex: 1,
    },
    premiumToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.accent,
        gap: 6,
    },
    premiumToggleActive: {
        backgroundColor: modernColors.accent,
    },
    premiumToggleText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.accent,
    },
    premiumToggleTextActive: {
        color: 'white',
    },
    transitionsList: {
        flex: 1,
    },
    transitionsListContent: {
        padding: 16,
        gap: 12,
    },
    transitionCard: {
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
    transitionCardSelected: {
        backgroundColor: `${modernColors.primary}10`,
        borderColor: modernColors.primary,
    },
    transitionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    transitionInfo: {
        flex: 1,
    },
    transitionName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    transitionDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    selectedBadge: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 6,
    },
    transitionMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    transitionTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    tag: {
        backgroundColor: modernColors.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    tagText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    transitionStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    popularityScore: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    badgesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 10,
        color: 'white',
        fontWeight: '600',
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
});

export default TrendingTransitionsLibrary;
