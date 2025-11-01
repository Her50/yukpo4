/**
 * Composant IntelligentSearchBar
 * Barre de recherche intelligente avec historique, suggestions et recherche contextuelle
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { searchHistoryService } from '../services/searchHistoryService';
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
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [popularSearches, setPopularSearches] = useState<SearchSuggestion[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [sessionId] = useState(() => searchHistoryService.generateSessionId());
    const inputRef = useRef<TextInput>(null);

    // Charger les recherches populaires au montage
    useEffect(() => {
        if (enableHistory) {
            loadPopularSearches();
        }
    }, [enableHistory, category]);

    // Charger les suggestions quand l'utilisateur tape
    useEffect(() => {
        if (enableSuggestions && query.length >= 2) {
            const debounceTimer = setTimeout(() => {
                loadSuggestions(query);
            }, 300); // Debounce de 300ms

            return () => clearTimeout(debounceTimer);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [query, enableSuggestions]);

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

    // Soumettre la recherche
    const handleSubmit = useCallback(async () => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            return;
        }

        // Fermer le clavier et les suggestions
        Keyboard.dismiss();
        setShowSuggestions(false);

        // Enregistrer la recherche dans l'historique
        if (enableHistory) {
            try {
                const searchId = await searchHistoryService.recordSearch(
                    trimmedQuery,
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
        onSubmit(trimmedQuery);
    }, [query, enableHistory, category, sessionId, onSubmit, onSearchRecorded]);

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
        ({ item }: { item: SearchSuggestion }) => {
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
        const combined: SearchSuggestion[] = [];

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

            {/* Bouton d'envoi */}
            {showSendButton && (
                <TouchableOpacity
                    style={[styles.sendButton, !query.trim() && styles.sendButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={!query.trim()}
                >
                    {!query.trim() ? (
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
        position: 'relative',
        zIndex: 1000,
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
});

export default IntelligentSearchBar;

