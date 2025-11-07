/**
 * Composant IntelligentSearchBar
 * Barre de recherche intelligente avec historique, suggestions et recherche contextuelle
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';
import { SearchSuggestion as HistorySuggestion, searchHistoryService } from '../services/searchHistoryService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface IntelligentSearchBarProps {
    placeholder?: string;
    onSubmit: (query: string) => void;
    onGPSPress?: () => void;
    showSendButton?: boolean;
    initialValue?: string;
    category?: string; // Catégorie pour contextualiser les suggestions
    enableHistory?: boolean; // Activer l'historique
    enableSuggestions?: boolean; // Activer les suggestions
    onSearchRecorded?: (searchId: number) => void; // Callback quand une recherche est enregistrée
}

interface SearchSuggestion {
    query_text: string;
    search_count?: number;
}

interface CombinationCardSuggestion {
    id: string;
    vector: string[];
    labels: string[];
    asQuery: string;
    usageCount?: number;
    price?: number;
    devise?: string;
    isPreferred?: boolean;
    occurrences?: number;
}

const normalizeSearchText = (input: string): string => {
    if (typeof input !== 'string') {
        return '';
    }

    try {
        return input
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .toLowerCase();
    } catch (error) {
        return input.toLowerCase();
    }
};

const buildSearchTokens = (input: string): string[] => {
    if (!input || typeof input !== 'string') {
        return [];
    }

    return input
        .split(/[\s,;\-|/_]+/)
        .map((token) => normalizeSearchText(token.trim()))
        .filter(Boolean);
};

const vectorMatchesTokens = (
    vector: string[] = [],
    tokens: string[] = [],
    labels: string[] = [],
): boolean => {
    if (tokens.length === 0) {
        return true;
    }

    const normalizedVector = vector
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSearchText(value));

    const normalizedLabels = labels
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSearchText(value));

    return tokens.every((token) =>
        normalizedVector.some((value) => value.includes(token)) ||
        normalizedLabels.some((label) => label.includes(token))
    );
};

const buildLabeledPairs = (
    values: string[] = [],
    labels: string[] = [],
): Array<{ label: string; value: string }> => {
    return values
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .map((value, index) => {
            const rawLabel = labels[index];
            const label = rawLabel && rawLabel.trim().length > 0
                ? rawLabel
                : `Caractéristique ${index + 1}`;

            return {
                label,
                value,
            };
        });
};

const buildCombinationKey = (values: string[] = [], labels: string[] = []): string => {
    const pairs = buildLabeledPairs(values, labels);
    if (pairs.length === 0) {
        return '';
    }

    return pairs
        .map(({ label, value }) => {
            const normalizedLabel = normalizeSearchText(label || '');
            const normalizedValue = normalizeSearchText(value || '');
            return `${normalizedLabel}=${normalizedValue}`;
        })
        .join('|');
};

export const IntelligentSearchBar: React.FC<IntelligentSearchBarProps> = ({
    placeholder = 'Rechercher...',
    onSubmit,
    onGPSPress,
    showSendButton = true,
    initialValue = '',
    category,
    enableHistory = true,
    enableSuggestions = true,
    onSearchRecorded,
}) => {
    const [query, setQuery] = useState(initialValue);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<HistorySuggestion[]>([]);
    const [popularSearches, setPopularSearches] = useState<HistorySuggestion[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [combinationSuggestions, setCombinationSuggestions] = useState<CombinationCardSuggestion[]>([]);
    const [isLoadingCombinations, setIsLoadingCombinations] = useState(false);
    const [combinationError, setCombinationError] = useState<string | null>(null);
    const [sessionId] = useState(() => searchHistoryService.generateSessionId());
    const inputRef = useRef<TextInput>(null);
    const [placeholderText, setPlaceholderText] = useState('');
    const [placeholderLoading, setPlaceholderLoading] = useState(false);
    const [searchGoal, setSearchGoal] = useState<string | undefined>(undefined);
    const [searchEnergy, setSearchEnergy] = useState(50);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Charger les recherches populaires au montage
    useEffect(() => {
        if (enableHistory) {
            loadPopularSearches();
        }
    }, [enableHistory, category]);

    // Charger les recherches populaires
    const loadPopularSearches = useCallback(async () => {
        try {
            const popular = await searchHistoryService.getPopularSearches(5, category, 30);
            setPopularSearches(popular);
        } catch (error) {
            console.error('[IntelligentSearchBar] Erreur chargement recherches populaires:', error);
        }
    }, [category]);

    // Charger les suggestions
    const loadSuggestions = useCallback(async (prefix: string) => {
        setIsLoadingSuggestions(true);
        try {
            const suggestionsData = await searchHistoryService.getSuggestions(prefix, 5);
            setSuggestions(suggestionsData);
            setShowSuggestions(true);
        } catch (error) {
            console.error('[IntelligentSearchBar] Erreur chargement suggestions:', error);
            setSuggestions([]);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, []);

    const loadCombinationSuggestions = useCallback(
        async (text: string) => {
            const cleaned = text.trim();
            if (cleaned.length < 2) {
                setCombinationSuggestions([]);
                setCombinationError(null);
                return;
            }

            setIsLoadingCombinations(true);
            setCombinationError(null);

            try {
                const tokens = buildSearchTokens(cleaned);
                const response = await apiPost('/api/combinations/search', {
                    query: cleaned,
                    limit: 8,
                });

                if (response?.success) {
                    const combos = normalizeCombinationsResponse(response);
                    const unique = new Map<string, CombinationCardSuggestion>();
                    combos.forEach((item: any) => {
                        const combo = item?.combination ?? item;
                        if (!combo || !Array.isArray(combo.product_vector)) {
                            return;
                        }

                        const vector = combo.product_vector
                            .filter((part: any) => typeof part === 'string')
                            .map((part: string) => part.trim())
                            .filter(Boolean);

                        if (vector.length === 0) {
                            return;
                        }

                        const labels = Array.isArray(combo.product_labels) ? combo.product_labels : [];

                        if (!vectorMatchesTokens(vector, tokens, labels)) {
                            return;
                        }

                        const joined = vector.join(', ');
                        const key = buildCombinationKey(vector, labels);

                        if (!joined || !key) {
                            return;
                        }

                        let price: number | undefined;
                        if (combo.prix !== null && combo.prix !== undefined) {
                            const parsed = typeof combo.prix === 'number'
                                ? combo.prix
                                : parseFloat(`${combo.prix}`);
                            price = Number.isNaN(parsed) ? undefined : parsed;
                        }

                        const usageCount = typeof combo.usage_count === 'number' ? combo.usage_count : undefined;

                        const existing = unique.get(key);
                        if (existing) {
                            existing.occurrences = (existing.occurrences ?? 1) + 1;
                            if (
                                typeof usageCount === 'number' &&
                                usageCount > (existing.usageCount ?? 0)
                            ) {
                                existing.usageCount = usageCount;
                            }
                            if (price !== undefined && existing.price === undefined) {
                                existing.price = price;
                                existing.devise = combo.devise || existing.devise;
                            }
                            if (combo.is_ai_preferred) {
                                existing.isPreferred = true;
                            }
                            return;
                        }

                        unique.set(key, {
                            id: `${combo.id ?? key}`,
                            vector,
                            labels,
                            asQuery: joined,
                            usageCount,
                            price,
                            devise: combo.devise || undefined,
                            isPreferred: !!combo.is_ai_preferred,
                            occurrences: 1,
                        });
                    });

                    const normalized = Array.from(unique.values());

                    setCombinationSuggestions(normalized);
                    if (normalized.length === 0) {
                        setCombinationError('Aucune caractéristique populaire correspondant à cette recherche.');
                    } else {
                        setCombinationError(null);
                    }
                } else {
                    setCombinationSuggestions([]);
                    setCombinationError('Aucune caractéristique populaire trouvée.');
                }
            } catch (error) {
                console.error('[IntelligentSearchBar] Erreur chargement combinaisons:', error);
                setCombinationError('Impossible de charger les caractéristiques populaires pour cette recherche.');
                setCombinationSuggestions([]);
            } finally {
                setIsLoadingCombinations(false);
            }
        },
        []
    );

    const cleanedQuery = query.trim();

    // Charger les suggestions quand l'utilisateur tape
    useEffect(() => {
        const trimmed = query.trim();

        if (trimmed.length >= 2) {
            const debounceTimer = setTimeout(() => {
                if (enableSuggestions) {
                    loadSuggestions(trimmed);
                }
                loadCombinationSuggestions(trimmed);
            }, 300);

            return () => clearTimeout(debounceTimer);
        }

        setSuggestions([]);
        setShowSuggestions(false);
        setCombinationSuggestions([]);
        setCombinationError(null);
    }, [query, enableSuggestions, loadSuggestions, loadCombinationSuggestions]);

    // Soumettre la recherche
    const handleSubmit = useCallback(async () => {
        if (!cleanedQuery) {
            return;
        }

        // Fermer le clavier et les suggestions
        Keyboard.dismiss();
        setShowSuggestions(false);

        // Enregistrer la recherche dans l'historique
        if (enableHistory) {
            try {
                const searchId = await searchHistoryService.recordSearch(
                    cleanedQuery,
                    'text',
                    {
                        category,
                        session_id: sessionId,
                        device_type: 'mobile',
                    }
                );

                if (searchId && onSearchRecorded) {
                    onSearchRecorded(searchId);
                }
            } catch (error) {
                console.error('[IntelligentSearchBar] Erreur enregistrement recherche:', error);
            }
        }

        // Appeler le callback parent
        onSubmit(cleanedQuery);
    }, [cleanedQuery, enableHistory, category, sessionId, onSubmit, onSearchRecorded]);

    // Sélectionner une suggestion
    const selectSuggestion = useCallback(
        (suggestion: string) => {
            setQuery(suggestion);
            setShowSuggestions(false);
            Keyboard.dismiss();
            // Déclencher automatiquement la recherche
            const trimmedSuggestion = suggestion.trim();
            if (trimmedSuggestion) {
                onSubmit(trimmedSuggestion);
            }
        },
        [onSubmit]
    );

    // Rendre une suggestion
    const renderSuggestion = useCallback(
        ({ item }: { item: HistorySuggestion }) => {
            return (
                <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => selectSuggestion(item.query_text)}
                    activeOpacity={0.85}
                >
                    <SafeIcon name="clock" size={14} color={modernColors.textTertiary} />
                    <Text style={styles.suggestionText} numberOfLines={1}>
                        {item.query_text}
                    </Text>
                    {item.search_count && item.search_count > 1 && (
                        <View style={styles.suggestionBadge}>
                            <Text style={styles.suggestionBadgeText}>{item.search_count}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            );
        },
        [selectSuggestion]
    );

    // Suggestions combinées (historique + populaires)
    const allSuggestions = useMemo(() => {
        const combined: HistorySuggestion[] = [];

        // Ajouter les suggestions de l'historique en premier
        if (suggestions.length > 0) {
            combined.push(...suggestions);
        }

        // Ajouter les recherches populaires si pas de suggestions
        if (suggestions.length === 0 && popularSearches.length > 0 && query.length < 2) {
            combined.push(...popularSearches);
        }

        return combined;
    }, [suggestions, popularSearches, query]);

    return (
        <View style={styles.container}>
            <View style={styles.searchInputContainer}>
                <View style={styles.searchIconWrapper}>
                    <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                </View>
                <TextInput
                    ref={inputRef}
                    style={styles.searchInput}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => {
                        if (enableSuggestions && query.length < 2 && popularSearches.length > 0) {
                            setShowSuggestions(true);
                        }
                    }}
                />
                {isLoadingSuggestions && (
                    <ActivityIndicator size="small" color={modernColors.primary} style={styles.loader} />
                )}
                {onGPSPress && (
                    <TouchableOpacity style={styles.gpsButton} onPress={onGPSPress}>
                        <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Suggestions */}
            {showSuggestions && allSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionsHeader}>
                        <SafeIcon name="clock" size={14} color={modernColors.textTertiary} />
                        <Text style={styles.suggestionsHeaderText}>
                            {suggestions.length > 0 ? 'Suggestions' : 'Recherches populaires'}
                        </Text>
                    </View>
                    <FlatList
                        data={allSuggestions}
                        keyExtractor={(item, index) => `${item.query_text}-${index}`}
                        renderItem={renderSuggestion}
                        keyboardShouldPersistTaps="handled"
                        maxToRenderPerBatch={5}
                        windowSize={5}
                    />
                </View>
            )}

            {query.trim().length >= 2 && (
                <View style={styles.combinationSection}>
                    <Text style={styles.combinationSuggestionsTitle}>Caractéristiques populaires</Text>

                    {isLoadingCombinations && (
                        <View style={styles.loadingCombinationsContainer}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.loadingCombinationsText}>Chargement des caractéristiques…</Text>
                        </View>
                    )}

                    {combinationError && (
                        <Text style={styles.combinationError}>{combinationError}</Text>
                    )}

                    {!isLoadingCombinations && !combinationError && combinationSuggestions.length === 0 && (
                        <Text style={styles.emptyCombinationsText}>Aucune caractéristique populaire trouvée pour cette recherche.</Text>
                    )}

                    {!isLoadingCombinations && combinationSuggestions.length > 0 && (
                        <View style={styles.compactCombinationList}>
                            {combinationSuggestions.map((combo, index) => {
                                const rows = buildLabeledPairs(combo.vector, combo.labels);
                                const previewText = (combo.asQuery || rows.map(({ value }) => value).join(' ')).trim();
                                const tagValues = rows
                                    .filter((row) => row.value)
                                    .slice(0, 4);

                                return (
                                    <TouchableOpacity
                                        key={`combo-${combo.id}-${index}`}
                                        style={styles.compactCombinationItem}
                                        onPress={() => selectSuggestion(combo.asQuery)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={styles.compactCombinationHeader}>
                                            <SafeIcon
                                                name={combo.isPreferred ? 'sparkles' : 'search'}
                                                size={16}
                                                color={combo.isPreferred ? modernColors.primary : '#6366F1'}
                                            />
                                            <Text style={styles.compactCombinationTitle} numberOfLines={2}>
                                                {previewText}
                                            </Text>
                                        </View>

                                        {tagValues.length > 0 && (
                                            <View style={styles.compactCombinationTags}>
                                                {tagValues.map(({ label, value }, tagIndex) => (
                                                    <View key={`${combo.id}-tag-${tagIndex}`} style={styles.compactTag}>
                                                        <Text style={styles.compactTagLabel} numberOfLines={1}>
                                                            {label}:
                                                        </Text>
                                                        <Text style={styles.compactTagValue} numberOfLines={1}>
                                                            {value}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {(typeof combo.usageCount === 'number' || typeof combo.price === 'number' || (combo.occurrences && combo.occurrences > 1)) && (
                                            <View style={styles.compactCombinationMeta}>
                                                <View style={styles.compactMetaLeft}>
                                                    {typeof combo.usageCount === 'number' && (
                                                        <View style={styles.compactBadge}>
                                                            <SafeIcon name="users" size={12} color={modernColors.textSecondary} />
                                                            <Text style={styles.compactBadgeText}>{combo.usageCount}</Text>
                                                        </View>
                                                    )}
                                                    {combo.occurrences && combo.occurrences > 1 && (
                                                        <View style={styles.compactBadge}>
                                                            <SafeIcon name="repeat" size={12} color={modernColors.textSecondary} />
                                                            <Text style={styles.compactBadgeText}>{combo.occurrences}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {typeof combo.price === 'number' && (
                                                    <Text style={styles.compactCombinationPrice}>
                                                        {Math.round(combo.price).toLocaleString('fr-FR')} {combo.devise || 'XAF'}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            )}

            {/* Bouton d'envoi */}
            {showSendButton && (
                <TouchableOpacity
                    style={[styles.sendButton, !cleanedQuery && styles.sendButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={!cleanedQuery}
                >
                    {!cleanedQuery ? (
                        <SafeIcon name="send" size={18} color={modernColors.textTertiary} />
                    ) : (
                        <SafeIcon name="send" size={18} color="#FFFFFF" />
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
};

const normalizeCombinationsResponse = (response: any): any[] => {
    if (!response) {
        return [];
    }

    const payload = response.data ?? response;

    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.results)) {
        return payload.results;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    if (Array.isArray(payload?.data?.data)) {
        return payload.data.data;
    }

    return [];
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 16,
        marginBottom: 16,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    searchIconWrapper: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
    },
    loader: {
        marginLeft: 8,
    },
    gpsButton: {
        marginLeft: 8,
        padding: 4,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 1,
        borderColor: modernColors.border,
        maxHeight: 200,
    },
    suggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 8,
    },
    suggestionsHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textTertiary,
        textTransform: 'uppercase',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.borderLight,
        gap: 10,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    suggestionBadge: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 24,
        alignItems: 'center',
    },
    suggestionBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    sendButton: {
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: [{ translateY: -18 }],
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    sendButtonDisabled: {
        backgroundColor: modernColors.surfaceVariant,
    },
    historyChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    historyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    historyChipText: {
        fontSize: 12,
        color: '#4B5563',
    },
    combinationSection: {
        marginBottom: 16,
    },
    loadingCombinationsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    loadingCombinationsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    combinationError: {
        fontSize: 12,
        color: '#EF4444',
        marginBottom: 12,
    },
    emptyCombinationsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        marginBottom: 16,
    },
    categorySection: {
        marginBottom: 16,
    },
    categoryChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: modernColors.surfaceVariant,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    categoryChipText: {
        fontSize: 12,
        color: modernColors.text,
    },
    voiceSearchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.surfaceVariant,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    voiceSearchText: {
        fontSize: 12,
        color: modernColors.text,
    },
    advancedFiltersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.surfaceVariant,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    advancedFiltersText: {
        fontSize: 12,
        color: modernColors.text,
    },
    searchTips: {
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    searchTip: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    combinationSuggestionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
        paddingHorizontal: 16,
    },
    compactCombinationList: {
        paddingHorizontal: 16,
        gap: 12,
    },
    compactCombinationItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: modernColors.borderLight,
        gap: 10,
    },
    compactCombinationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    compactCombinationTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        lineHeight: 18,
    },
    compactCombinationTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    compactTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
        gap: 4,
    },
    compactTagLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4C51BF',
    },
    compactTagValue: {
        fontSize: 11,
        color: modernColors.text,
        fontWeight: '500',
    },
    compactCombinationMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    compactMetaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    compactCombinationPrice: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    compactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    compactBadgeText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontWeight: '600',
    },
});

export default IntelligentSearchBar;

