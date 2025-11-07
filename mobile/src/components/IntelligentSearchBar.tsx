/**
 * Composant IntelligentSearchBar
 * Barre de recherche intelligente avec historique, suggestions et recherche contextuelle
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';
import searchHistoryService, { SearchSuggestion as HistorySuggestion } from '../services/searchHistoryService';
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
    const [combinationSuggestions, setCombinationSuggestions] = useState<string[]>([]);
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

    // Charger les suggestions quand l'utilisateur tape
    useEffect(() => {
        const trimmed = query.trim();

        if (trimmed.length >= 2) {
            const debounceTimer = setTimeout(() => {
                if (enableSuggestions) {
                    loadSuggestions(trimmed);
                }
                loadCombinationSuggestions(trimmed);
            }, 300); // Debounce de 300ms

            return () => clearTimeout(debounceTimer);
        }

        setSuggestions([]);
        setShowSuggestions(false);
        setCombinationSuggestions([]);
        setCombinationError(null);
    }, [query, enableSuggestions, loadSuggestions, loadCombinationSuggestions]);

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
                const response = await apiPost('/api/combinations/search', {
                    query: cleaned,
                    limit: 8,
                });

                if (response?.success && Array.isArray(response.data)) {
                    const unique = new Set<string>();
                    const normalized = response.data
                        .map((item: any) => {
                            const combo = item?.combination;
                            if (!combo || !Array.isArray(combo.product_vector)) {
                                return null;
                            }

                            const parts = combo.product_vector
                                .filter((part: any) => typeof part === 'string')
                                .map((part: string) => part.trim())
                                .filter(Boolean);

                            if (parts.length === 0) {
                                return null;
                            }

                            const joined = parts.join(', ');
                            const key = joined.toLowerCase();

                            if (!joined || unique.has(key)) {
                                return null;
                            }

                            unique.add(key);
                            return joined;
                        })
                        .filter((value: string | null): value is string => value !== null);

                    setCombinationSuggestions(normalized);
                } else {
                    setCombinationSuggestions([]);
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
                >
                    <SafeIcon name="clock" size={16} color={modernColors.textTertiary} />
                    <Text style={styles.suggestionText}>{item.query_text}</Text>
                    {item.search_count && item.search_count > 1 && (
                        <Text style={styles.suggestionCount}>{item.search_count}</Text>
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
                <SafeIcon name="search" size={20} color={modernColors.textSecondary} style={styles.searchIcon} />
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
                        <View style={styles.combinationSuggestionsContainer}>
                            {combinationSuggestions.map((combo, index) => {
                                const parts = combo.split(',').map((part) => part.trim()).filter(Boolean);

                                return (
                                    <TouchableOpacity
                                        key={`combo-${index}-${combo}`}
                                        style={styles.combinationCard}
                                        onPress={() => selectSuggestion(combo)}
                                    >
                                        <View style={styles.combinationCardHeader}>
                                            <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                                            <Text style={styles.combinationCardTitle}>Suggestion {index + 1}</Text>
                                        </View>
                                        <View style={styles.combinationCardChips}>
                                            {parts.map((part, chipIndex) => (
                                                <View key={`${combo}-${chipIndex}`} style={styles.combinationCardChip}>
                                                    <Text style={styles.combinationCardChipText}>{part}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <Text style={styles.combinationApply}>Appuyer pour utiliser cette combinaison</Text>
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
    searchIcon: {
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.borderLight,
        gap: 12,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    suggestionCount: {
        fontSize: 12,
        color: modernColors.textTertiary,
        backgroundColor: modernColors.surfaceVariant,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
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
    combinationSuggestionsContainer: {
        paddingHorizontal: 16,
        gap: 12,
    },
    combinationCard: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    combinationCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    combinationCardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    combinationCardChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    combinationCardChip: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    combinationCardChipText: {
        fontSize: 12,
        color: modernColors.text,
    },
    combinationApply: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    combinationError: {
        color: modernColors.error,
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
    },
});

export default IntelligentSearchBar;

