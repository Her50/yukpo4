/**
 * SuggestionsPanel - Panneau de suggestions pour ResultatBesoinScreen
 * Extrait de ResultatBesoinScreen pour améliorer la maintenabilité
 */

import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { hapticSelect } from '../../utils/hapticFeedback';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface CombinationSuggestion {
    service_id: number;
    product_vector: string[];
    location_vector: string[];
    full_vector: string[];
    chosen_location?: string;
    usage_count: number;
    has_variant: boolean;
    variant_dimension?: string;
    prix?: number;
    devise?: string;
    final_score: number;
}

interface SuggestionsPanelProps {
    visible: boolean;
    suggestions: CombinationSuggestion[];
    loading: boolean;
    onSelectSuggestion: (suggestion: CombinationSuggestion) => void;
    onSearchWithoutSuggestion: () => void;
}

const getSuggestionVector = (suggestion: CombinationSuggestion): string[] => {
    if (Array.isArray(suggestion.full_vector) && suggestion.full_vector.length > 0) {
        return suggestion.full_vector.filter((item) => typeof item === 'string');
    }
    if (Array.isArray(suggestion.product_vector) && suggestion.product_vector.length > 0) {
        return suggestion.product_vector.filter((item) => typeof item === 'string');
    }
    return [];
};

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
    visible,
    suggestions,
    loading,
    onSelectSuggestion,
    onSearchWithoutSuggestion,
}) => {
    if (!visible) return null;

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>{t('suggestionsPanel.chargementDesSuggestions')}</Text>
            </View>
        );
    }

    if (suggestions.length === 0) {
        return (
            <View style={styles.noSuggestionsContainer}>
                <Text style={styles.noSuggestionsText}>{t('suggestionsPanel.aucuneSuggestion')}</Text>
                <TouchableOpacity
                    style={styles.manualSearchButton}
                    onPress={onSearchWithoutSuggestion}
                >
                    <SafeIcon name="search" size={16} color={modernColors.primary} />
                    <Text style={styles.manualSearchText}>{t('suggestionsPanel.rechercherQuandMeme')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <SafeIcon name="sparkles" size={18} color={modernColors.primary} />
                    <Text style={styles.title}>{t('suggestionsPanel.caracteristiquesRecommandees')}</Text>
                    <Text style={styles.count}>({suggestions.length})</Text>
                </View>
                <TouchableOpacity
                    style={styles.manualSearchButton}
                    onPress={onSearchWithoutSuggestion}
                >
                    <SafeIcon name="search" size={16} color={modernColors.primary} />
                    <Text style={styles.manualSearchText}>{t('suggestionsPanel.rechercherSansSuggestion')}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={suggestions}
                keyExtractor={(_, index) => `suggestion-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item, index }) => {
                    const chipsVector = getSuggestionVector(item);
                    const chips = Array.isArray(chipsVector) ? chipsVector.slice(0, 6) : [];
                    const priceText = typeof item?.prix === 'number'
                        ? `${Math.round(item.prix).toLocaleString()} ${item?.devise || 'XAF'}`
                        : null;

                    return (
                        <TouchableOpacity
                            key={`suggestion-card-${index}`}
                            style={styles.card}
                            onPress={() => {
                                hapticSelect();
                                onSelectSuggestion(item);
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderLeft}>
                                    <SafeIcon name="layers" size={16} color={modernColors.primary} />
                                    <Text style={styles.cardTitle}>Proposition {index + 1}</Text>
                                </View>
                                {item?.usage_count ? (
                                    <View style={styles.usagePill}>
                                        <SafeIcon name="flame" size={14} color="#EA580C" />
                                        <Text style={styles.usageText}>
                                            {item.usage_count}× recherché
                                        </Text>
                                    </View>
                                ) : priceText ? (
                                    <Text style={styles.priceText}>{priceText}</Text>
                                ) : null}
                            </View>

                            <View style={styles.vectorChips}>
                                {chips.filter(chip => chip != null && String(chip).trim() !== '').map((chip, chipIndex) => (
                                    <View key={`${String(chip)}-${chipIndex}`} style={styles.chip}>
                                        <Text style={styles.chipText} numberOfLines={1}>
                                            {String(chip)}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.statsRow}>
                                {item.chosen_location && (
                                    <View style={styles.locationRow}>
                                        <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                                        <Text style={styles.locationText}>{item.chosen_location}</Text>
                                    </View>
                                )}
                                {item.has_variant && item.variant_dimension ? (
                                    <Text style={styles.statsText}>⚙️ {item.variant_dimension}</Text>
                                ) : item.usage_count ? (
                                    <Text style={styles.statsText}>\uD83D\uDC65 {item.usage_count} recherche(s)</Text>
                                ) : null}
                            </View>

                            <View style={styles.selectButton}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.primary} />
                                <Text style={styles.selectButtonText}>Utiliser cette suggestion</Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    count: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        padding: 20,
    },
    noSuggestionsContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    noSuggestionsText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
    },
    manualSearchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 12,
        borderStyle: 'dashed',
        marginTop: 16,
        paddingHorizontal: 16,
    },
    manualSearchText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    list: {
        maxHeight: 280,
    },
    listContent: {
        paddingBottom: 12,
    },
    card: {
        width: 280,
        marginRight: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
    },
    usagePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF1E6',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    usageText: {
        fontSize: 12,
        color: modernColors.accent,
        fontWeight: '600',
    },
    priceText: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
    },
    vectorChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    chip: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '500',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    locationText: {
        fontSize: 14,
        color: '#6B7280',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    statsText: {
        fontSize: 12,
        color: '#6B7280',
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.primary,
        paddingVertical: 10,
        borderRadius: 8,
    },
    selectButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default SuggestionsPanel;

