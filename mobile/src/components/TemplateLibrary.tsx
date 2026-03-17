// ✅ NOUVEAU: Bibliothèque de templates vidéo par industrie (50+)

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { VideoTemplate, templateService } from '../services/templateService';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeInput } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export type TemplateIndustry = 'ecommerce' | 'services' | 'creators' | 'business' | 'social_media' | 'all';

interface TemplateLibraryProps {
    onTemplateSelected?: (template: VideoTemplate) => void;
    selectedTemplate?: string | null;
    filterIndustry?: TemplateIndustry;
}

const INDUSTRIES: { key: TemplateIndustry; label: string; icon: string }[] = [
    { key: 'all', label: 'Tous', icon: 'grid' },
    { key: 'ecommerce', label: 'E-commerce', icon: 'shopping-bag' },
    { key: 'services', label: 'Services', icon: 'briefcase' },
    { key: 'creators', label: t('templateLibrary.createurs'), icon: 'video' },
    { key: 'business', label: 'Business', icon: 'trending-up' },
    { key: 'social_media', label: 'Social Media', icon: 'share-2' },
];

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
    onTemplateSelected,
    selectedTemplate,
    filterIndustry = 'all',
}) => {
        const { t } = useLanguageSafe();
const [templates, setTemplates] = useState<VideoTemplate[]>([]);
    const [filteredTemplates, setFilteredTemplates] = useState<VideoTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndustry, setSelectedIndustry] = useState<TemplateIndustry>(filterIndustry);
    const [showPremiumOnly, setShowPremiumOnly] = useState(false);

    // Charger les templates au montage
    useEffect(() => {
        loadTemplates();
    }, [selectedIndustry, showPremiumOnly]);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params: any = {
                limit: 100,
                offset: 0,
            };

            if (selectedIndustry !== 'all') {
                params.industry = selectedIndustry;
            }

            if (showPremiumOnly) {
                params.premium = true;
            }

            const response = await templateService.listTemplates(params);
            setTemplates(response.templates || []);
            setFilteredTemplates(response.templates || []);
        } catch (err: any) {
            console.error('[TemplateLibrary] Erreur chargement templates:', err);
            setError(err.message || 'Erreur lors du chargement des templates');
        } finally {
            setLoading(false);
        }
    }, [selectedIndustry, showPremiumOnly]);

    // Filtrer par recherche textuelle
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredTemplates(templates);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = templates.filter(
            template =>
                template.name.toLowerCase().includes(query) ||
                template.description.toLowerCase().includes(query) ||
                template.tags.some(tag => tag.toLowerCase().includes(query)) ||
                template.subcategory?.toLowerCase().includes(query)
        );
        setFilteredTemplates(filtered);
    }, [searchQuery, templates]);

    const handleTemplatePress = useCallback(
        (template: VideoTemplate) => {
            onTemplateSelected?.(template);
        },
        [onTemplateSelected]
    );

    const renderTemplateCard = useCallback(
        ({ item: template }: { item: VideoTemplate }) => {
            const selected = selectedTemplate === template.name;

            return (
                <TouchableOpacity
                    style={[styles.templateCard, selected && styles.templateCardSelected]}
                    onPress={() => handleTemplatePress(template)}
                    activeOpacity={0.7}
                >
                    <View style={styles.templateCardHeader}>
                        <View style={styles.templateCardHeaderLeft}>
                            {template.is_premium && (
                                <SafeIcon name="star" size={16} color={modernColors.warning} />
                            )}
                            <Text style={styles.templateName} numberOfLines={1}>
                                {template.name}
                            </Text>
                        </View>
                        {selected && (
                            <View style={styles.selectedBadge}>
                                <SafeIcon name="check" size={14} color="#FFFFFF" />
                            </View>
                        )}
                    </View>

                    {template.subcategory && (
                        <Text style={styles.templateSubcategory} numberOfLines={1}>
                            {template.subcategory}
                        </Text>
                    )}

                    <Text style={styles.templateDescription} numberOfLines={2}>
                        {template.description}
                    </Text>

                    <View style={styles.templateMeta}>
                        <View style={styles.metaItem}>
                            <SafeIcon name="clock" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.metaText}>{template.duration}s</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <SafeIcon name="maximize" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.metaText}>{template.format}</Text>
                        </View>
                        {template.usage_count > 0 && (
                            <View style={styles.metaItem}>
                                <SafeIcon name="users" size={12} color={modernColors.textSecondary} />
                                <Text style={styles.metaText}>{template.usage_count}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.templateTags}>
                        {template.tags.slice(0, 3).map((tag, index) => (
                            <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                        {template.tags.length > 3 && (
                            <Text style={styles.moreTagsText}>+{String(template.tags.length - 3)}</Text>
                        )}
                    </View>
                </TouchableOpacity>
            );
        },
        [handleTemplatePress, selectedTemplate]
    );

    if (loading && templates.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('templateLibrary.chargementDesTemplates')}</Text>
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
                    label={t('templateLibrary.reessayer')}
                    onPress={loadTemplates}
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
                    placeholder={t('templateLibrary.rechercherUnTemplate')}
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

            {/* Filtres par industrie */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.industriesContainer}
                contentContainerStyle={styles.industriesContent}
            >
                {INDUSTRIES.map(industry => (
                    <TouchableOpacity
                        key={industry.key}
                        style={[
                            styles.industryButton,
                            selectedIndustry === industry.key && styles.industryButtonActive,
                        ]}
                        onPress={() => setSelectedIndustry(industry.key)}
                    >
                        <SafeIcon
                            name={industry.icon as any}
                            size={18}
                            color={
                                selectedIndustry === industry.key
                                    ? modernColors.primary
                                    : modernColors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.industryButtonText,
                                selectedIndustry === industry.key && styles.industryButtonTextActive,
                            ]}
                        >
                            {industry.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Liste des templates */}
            <FlatList
                data={filteredTemplates}
                renderItem={renderTemplateCard}
                keyExtractor={item => item.name}
                numColumns={2}
                contentContainerStyle={styles.templatesList}
                columnWrapperStyle={styles.templatesRow}
                refreshing={loading}
                onRefresh={loadTemplates}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="inbox" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyText}>
                            {searchQuery
                                ? t('templateLibrary.aucunTemplateTrouvePourVotreRecherche')
                                : 'Aucun template disponible'}
                        </Text>
                    </View>
                }
                ListHeaderComponent={
                    <Text style={styles.resultsCount}>
                        {String(filteredTemplates.length)} template{filteredTemplates.length > 1 ? 's' : 't('templateLibrary.trouveFilteredtemplateslength1')s' : ''}
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
    industriesContainer: {
        marginBottom: 16,
    },
    industriesContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    industryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
        gap: 6,
    },
    industryButtonActive: {
        backgroundColor: modernColors.primary + '20',
    },
    industryButtonText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    industryButtonTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    templatesList: {
        padding: 16,
    },
    templatesRow: {
        justifyContent: 'space-between',
        gap: 12,
    },
    templateCard: {
        flex: 1,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        minWidth: '47%',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    templateCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    templateCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    templateCardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    templateName: {
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
    templateSubcategory: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
        marginBottom: 4,
        textTransform: 'capitalize',
    },
    templateDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 16,
    },
    templateMeta: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    templateTags: {
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

