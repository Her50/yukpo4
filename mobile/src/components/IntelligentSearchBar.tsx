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
                    const queryText = normalizeSearchText(cleaned);
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
            const trimmedSuggestion = suggestion.trim();
            if (!trimmedSuggestion) {
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
                    trimmedSuggestion,
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
            onSubmit(trimmedSuggestion);
        },
        [onSubmit, enableHistory, category, sessionId, onSearchRecorded]
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

                    {!isLoadingCombinations && combinationSuggestions.length > 0 && (
                        <View style={styles.compactCombinationList}>
                            {combinationSuggestions.map((combo, index) => {
                                const accentColor = modernColors?.accent ?? '#F97316';

                                return (
                                    <TouchableOpacity
                                        key={`combo-${combo.id}-${index}`}
                                        style={styles.compactCombinationItem}
                                        onPress={() => selectSuggestion(combo.asQuery)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={styles.compactCombinationHeader}>
                                            <View style={styles.compactCombinationHeaderLeft}>
                                                <SafeIcon
                                                    name={combo.isPreferred ? 'sparkles' : 'sparkles'}
                                                    size={16}
                                                    color={modernColors.primary}
                                                />
                                                <Text style={styles.compactCombinationTitle} numberOfLines={2}>
                                                    Proposition {index + 1}
                                                </Text>
                                            </View>

                                            {typeof combo.usageCount === 'number' && combo.usageCount > 0 && (
                                                <View style={styles.compactUsagePill}>
                                                    <SafeIcon name="users" size={12} color={accentColor} />
                                                    <Text style={styles.compactUsageText}>
                                                        {combo.usageCount}× recherché
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.compactCombinationChips}>
                                            {combo.vector.slice(0, 6).map((chip: string, chipIndex: number) => (
                                                <View key={`${combo.id}-chip-${chipIndex}`} style={styles.compactCombinationChip}>
                                                    <Text style={styles.compactCombinationChipText}>{chip}</Text>
                                                </View>
                                            ))}
                                        </View>

                                        {(typeof combo.price === 'number' || (combo.occurrences && combo.occurrences > 1)) && (
                                            <View style={styles.compactCombinationMeta}>
                                                <View style={styles.compactMetaLeft}>
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

                                        <View style={styles.compactCombinationApply}>
                                            <SafeIcon name="arrow-right" size={14} color="#FFFFFF" />
                                            <Text style={styles.compactCombinationApplyText}>Utiliser cette suggestion</Text>
                                        </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    compactCombinationHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    compactCombinationTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
    },
    compactUsagePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF1E6',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    compactUsageText: {
        fontSize: 12,
        color: modernColors.accent,
        fontWeight: '600',
    },
    compactCombinationChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    compactCombinationChip: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    compactCombinationChipText: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '500',
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
    compactCombinationApply: {
        marginTop: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
    },
    compactCombinationApplyText: {
        marginLeft: 0,
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
});

export default IntelligentSearchBar;

