/**
 * Composant IntelligentSearchBar
 * Barre de recherche intelligente avec historique, suggestions et recherche contextuelle
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';
import { SearchSuggestion as HistorySuggestion, searchHistoryService } from '../services/searchHistoryService';
import { modernColors } from '../theme/modernTheme';
import LocationSelector, { LocationObject } from './LocationSelector';
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

const computeCombinationRanking = (
    suggestion: CombinationCardSuggestion,
    tokens: string[],
    categoryTokens: string[],
): { popularityScore: number; relevanceScore: number; totalScore: number } => {
    const normalizedVector = suggestion.vector
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSearchText(value));
    const normalizedLabels = suggestion.labels
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSearchText(value));

    let relevanceScore = 0;
    const uniqueTokens = Array.from(new Set(tokens));
    uniqueTokens.forEach((token) => {
        if (!token) return;
        if (normalizedVector.some((value) => value.includes(token))) {
            relevanceScore += 6;
        } else if (normalizedLabels.some((value) => value.includes(token))) {
            relevanceScore += 4;
        }
    });

    const uniqueCategoryTokens = Array.from(new Set(categoryTokens));
    uniqueCategoryTokens.forEach((token) => {
        if (!token) return;
        if (normalizedVector.some((value) => value.includes(token))) {
            relevanceScore += 10;
        } else if (normalizedLabels.some((value) => value.includes(token))) {
            relevanceScore += 6;
        }
    });

    const popularityScore =
        (suggestion.usageCount ?? 0) * 2 +
        (suggestion.occurrences ?? 0);

    const totalScore = popularityScore * 2 + relevanceScore;

    return { popularityScore, relevanceScore, totalScore };
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
    const [searchLocation, setSearchLocation] = useState<LocationObject | null>(null);
    const categoryTokensBase = useMemo(() => buildSearchTokens(category || ''), [category]);
    const topCombinationSuggestion = useMemo(
        () => (combinationSuggestions.length > 0 ? combinationSuggestions[0] : null),
        [combinationSuggestions]
    );
    const topCombinationRows = useMemo(
        () => (topCombinationSuggestion ? buildLabeledPairs(topCombinationSuggestion.vector, topCombinationSuggestion.labels) : []),
        [topCombinationSuggestion]
    );

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
                const locationFragment = (searchLocation?.raw || searchLocation?.place_name || '').trim();
                const combinedQuery = [cleaned, locationFragment].filter(Boolean).join(' ');

                const queryTokens = buildSearchTokens(cleaned);
                const locationTokens = buildSearchTokens(locationFragment);
                const tokens = Array.from(new Set([...queryTokens, ...locationTokens]));
                const categoryTokens = categoryTokensBase;
                const payload: Record<string, unknown> = {
                    query: combinedQuery || cleaned,
                    limit: 8,
                };

                if (category && category.trim().length > 0) {
                    payload.category = category.trim();
                }

                if (searchLocation?.coordinates?.lat && searchLocation?.coordinates?.lng) {
                    payload.user_lat = searchLocation.coordinates.lat;
                    payload.user_lng = searchLocation.coordinates.lng;
                }

                if (locationFragment.length > 0) {
                    payload.location_hint = locationFragment;
                }

                const response = await apiPost('/api/autocomplete/search-products', payload);

                if (response?.success) {
                    const combos = normalizeAutocompleteResponse(response);
                    const queryText = normalizeSearchText(combinedQuery || cleaned);
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

                        // ✅ AMÉLIORATION : Filtrage amélioré avec normalisation
                        if (queryText.length > 0) {
                            const vectorText = normalizeSearchText(vector.join(' '));
                            const labelsText = normalizeSearchText(
                                labels.length > 0
                                    ? labels.join(' ')
                                    : ''
                            );
                            const fullText = `${vectorText} ${labelsText}`.trim();

                            if (!fullText.includes(queryText) && !vectorMatchesTokens(vector, tokens, labels)) {
                                return;
                            }
                        } else if (!vectorMatchesTokens(vector, tokens, labels)) {
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

                    let normalized = Array.from(unique.values());

                    // ✅ FALLBACK : Si aucun match après filtrage strict, prendre les premières suggestions
                    if (normalized.length === 0 && combos.length > 0) {
                        const firstCombo = combos[0]?.combination ?? combos[0];
                        if (firstCombo && Array.isArray(firstCombo.product_vector)) {
                            const vector = firstCombo.product_vector
                                .filter((part: any) => typeof part === 'string')
                                .map((part: string) => part.trim())
                                .filter(Boolean);

                            if (vector.length > 0) {
                                const labels = Array.isArray(firstCombo.product_labels) ? firstCombo.product_labels : [];
                                normalized = [{
                                    id: `${firstCombo.id ?? 'fallback'}`,
                                    vector,
                                    labels,
                                    asQuery: vector.join(', '),
                                    usageCount: typeof firstCombo.usage_count === 'number' ? firstCombo.usage_count : undefined,
                                    price: typeof firstCombo.prix === 'number' ? firstCombo.prix : undefined,
                                    devise: firstCombo.devise || undefined,
                                    isPreferred: !!firstCombo.is_ai_preferred,
                                    occurrences: 1,
                                }];
                            }
                        }
                    }

                    if (normalized.length === 0) {
                        setCombinationError('Aucune caractéristique populaire correspondant à cette recherche.');
                    } else {
                        const scored = normalized.map((suggestion) => {
                            const { popularityScore, relevanceScore, totalScore } = computeCombinationRanking(
                                suggestion,
                                tokens,
                                categoryTokens,
                            );
                            return { suggestion, popularityScore, totalScore };
                        });

                        const scoredWithBoost = scored.map((entry) => {
                            if (locationTokens.length === 0) {
                                return entry;
                            }

                            const vectorTokens = buildSearchTokens(entry.suggestion.vector.join(' '));
                            const labelsTokens = buildSearchTokens(entry.suggestion.labels.join(' '));
                            const hasLocationMatch = locationTokens.some((token) =>
                                vectorTokens.includes(token) || labelsTokens.includes(token)
                            );

                            return hasLocationMatch
                                ? { ...entry, totalScore: entry.totalScore + 8 }
                                : entry;
                        });

                        const sortedSuggestions = [...scoredWithBoost]
                            .sort((a, b) => b.totalScore - a.totalScore)
                            .map((entry) => entry.suggestion);

                        const finalSuggestions = sortedSuggestions.length > 0
                            ? sortedSuggestions
                            : normalized.slice(0, 1);

                        setCombinationSuggestions(finalSuggestions.slice(0, 1));
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
        [category, categoryTokensBase, searchLocation]
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
        const locationFragment = (searchLocation?.raw || searchLocation?.place_name || '').trim();
        const combinedQuery = [cleanedQuery, locationFragment].filter(Boolean).join(' ').trim();

        if (!combinedQuery) {
            return;
        }

        // Fermer le clavier et les suggestions
        Keyboard.dismiss();
        setShowSuggestions(false);

        // Enregistrer la recherche dans l'historique
        if (enableHistory) {
            try {
                const searchId = await searchHistoryService.recordSearch(
                    combinedQuery,
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
        onSubmit(combinedQuery);
    }, [cleanedQuery, enableHistory, category, sessionId, onSubmit, onSearchRecorded, searchLocation]);

    // Sélectionner une suggestion
    const selectSuggestion = useCallback(
        (suggestion: string) => {
            const trimmedSuggestion = suggestion.trim();
            const locationFragment = (searchLocation?.raw || searchLocation?.place_name || '').trim();
            const combinedQuery = [trimmedSuggestion, locationFragment].filter(Boolean).join(' ').trim();

            if (!combinedQuery) {
                return;
            }

            setQuery(trimmedSuggestion);
            setShowSuggestions(false);
            setCombinationSuggestions([]);
            setCombinationError(null);
            Keyboard.dismiss();

            // Enregistrer la recherche dans l'historique si activé
            if (enableHistory) {
                searchHistoryService.recordSearch(
                    combinedQuery,
                    'text',
                    {
                        category,
                        session_id: sessionId,
                        device_type: 'mobile',
                    }
                ).then((searchId) => {
                    if (searchId && onSearchRecorded) {
                        onSearchRecorded(searchId);
                    }
                }).catch((error) => {
                    console.error('[IntelligentSearchBar] Erreur enregistrement recherche:', error);
                });
            }

            // Déclencher automatiquement la recherche
            onSubmit(combinedQuery);
        },
        [onSubmit, enableHistory, category, sessionId, onSearchRecorded, searchLocation]
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
                    <View style={styles.combinationSuggestionsHeader}>
                        <View style={styles.combinationSuggestionsHeaderLeft}>
                            <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                            <Text style={styles.combinationSuggestionsTitle}>Caractéristiques recommandées</Text>
                            {combinationSuggestions.length > 0 && (
                                <Text style={styles.combinationSuggestionsCount}>({combinationSuggestions.length})</Text>
                            )}
                        </View>
                    </View>

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

                    {!isLoadingCombinations && !combinationError && topCombinationSuggestion && (
                        <View style={styles.topCombinationCard}>
                            <View style={styles.topCombinationHeader}>
                                <View style={styles.topCombinationHeaderLeft}>
                                    <SafeIcon
                                        name={topCombinationSuggestion.isPreferred ? 'sparkles' : 'users'}
                                        size={16}
                                        color={topCombinationSuggestion.isPreferred ? modernColors.primary : '#F97316'}
                                    />
                                    <Text style={styles.topCombinationTitle}>Caractéristiques pertinentes détectées</Text>
                                </View>
                                {typeof topCombinationSuggestion.usageCount === 'number' && topCombinationSuggestion.usageCount > 0 && (
                                    <View style={styles.topCombinationBadge}>
                                        <SafeIcon name="users" size={12} color={modernColors.primary} />
                                        <Text style={styles.topCombinationBadgeText}>
                                            {topCombinationSuggestion.usageCount}× recherché
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.topCombinationTable}>
                                {topCombinationRows.length === 0 ? (
                                    <Text style={styles.topCombinationEmptyRow}>Aucune modalité disponible.</Text>
                                ) : (
                                    topCombinationRows.slice(0, 6).map((row, index) => (
                                        <View
                                            key={`${topCombinationSuggestion.id}-row-${index}`}
                                            style={[
                                                styles.topCombinationRow,
                                                index === Math.min(topCombinationRows.length, 6) - 1 && styles.topCombinationRowLast,
                                            ]}
                                        >
                                            <Text style={styles.topCombinationCellLabel}>{row.label}</Text>
                                            <Text style={styles.topCombinationCellValue}>{row.value}</Text>
                                        </View>
                                    ))
                                )}
                            </View>

                            {(typeof topCombinationSuggestion.price === 'number' ||
                                (topCombinationSuggestion.occurrences ?? 0) > 0) && (
                                    <View style={styles.topCombinationMeta}>
                                        <View style={styles.topCombinationMetaLeft}>
                                            {typeof topCombinationSuggestion.occurrences === 'number' &&
                                                topCombinationSuggestion.occurrences > 0 && (
                                                    <Text style={styles.topCombinationMetaText}>
                                                        🔁 {topCombinationSuggestion.occurrences} occurrence
                                                        {topCombinationSuggestion.occurrences > 1 ? 's' : ''}
                                                    </Text>
                                                )}
                                        </View>
                                        {typeof topCombinationSuggestion.price === 'number' && (
                                            <Text style={styles.topCombinationMetaText}>
                                                💰 {Math.round(topCombinationSuggestion.price).toLocaleString('fr-FR')}{' '}
                                                {topCombinationSuggestion.devise || 'XAF'}
                                            </Text>
                                        )}
                                    </View>
                                )}

                            <View style={styles.topCombinationLocation}>
                                <LocationSelector
                                    label="Lieu de recherche"
                                    value={searchLocation || ''}
                                    onSelect={(loc) => {
                                        if (!loc || !loc.raw) {
                                            setSearchLocation(null);
                                            return;
                                        }
                                        setSearchLocation(loc);
                                    }}
                                    placeholder="Ex: Douala, Cameroun"
                                    scope="all"
                                    enrichWithBackend
                                />
                            </View>
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

const normalizeAutocompleteResponse = (response: any): any[] => {
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
    combinationSuggestionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    combinationSuggestionsHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    combinationSuggestionsTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    combinationSuggestionsCount: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
    },
    topCombinationCard: {
        marginHorizontal: 16,
        marginTop: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.borderLight,
        padding: 14,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    topCombinationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topCombinationHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
    },
    topCombinationTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    topCombinationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    topCombinationBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
    },
    topCombinationTable: {
        borderWidth: 1,
        borderColor: modernColors.borderLight,
        borderRadius: 10,
        overflow: 'hidden',
    },
    topCombinationEmptyRow: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    topCombinationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.borderLight,
        gap: 12,
    },
    topCombinationRowLast: {
        borderBottomWidth: 0,
    },
    topCombinationCellLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        flex: 0.6,
    },
    topCombinationCellValue: {
        fontSize: 12,
        color: modernColors.text,
        flex: 1,
        textAlign: 'right',
    },
    topCombinationMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topCombinationMetaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 1,
    },
    topCombinationMetaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    topCombinationLocation: {
        marginTop: 4,
    },
});

export default IntelligentSearchBar;

