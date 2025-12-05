// ✅ NOUVEAU: Composant d'autocomplétion pour recherche services spécialisés
// Suggestions intelligentes pendant la saisie

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

// Fonction debounce simple
function useDebounce<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    return useCallback(
        ((...args: any[]) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                callback(...args);
            }, delay);
        }) as T,
        [callback, delay]
    );
}

interface Suggestion {
    text: string;
    type: 'query' | 'service' | 'location';
    icon?: string;
}

interface Props {
    specializedType: string;
    onSelect: (query: string) => void;
    placeholder?: string;
    prefillQuery?: string;
}

const SpecializedSearchAutocomplete: React.FC<Props> = ({
    specializedType,
    onSelect,
    placeholder,
    prefillQuery,
}) => {
    const [query, setQuery] = useState(prefillQuery || '');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Suggestions par défaut basées sur le type
    const defaultSuggestions: Suggestion[] = [
        { text: 'pharmacie de garde', type: 'query', icon: 'clock' },
        { text: 'pharmacie 24h', type: 'query', icon: 'clock' },
        { text: 'médecin disponible', type: 'query', icon: 'user-md' },
        { text: 'urgences ouvertes', type: 'query', icon: 'alert-circle' },
    ].filter((s) => {
        if (specializedType === 'pharmacie') {
            return s.text.includes('pharmacie');
        }
        if (specializedType === 'hopital' || specializedType === 'laboratoire') {
            return s.text.includes('médecin') || s.text.includes('urgences');
        }
        return true;
    });

    // Fonction de recherche
    const performSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setSuggestions(defaultSuggestions);
            return;
        }

        setLoading(true);
        try {
            // TODO: Appel API pour suggestions (à implémenter dans backend)
            // Pour l'instant, utiliser suggestions par défaut filtrées
            const filtered = defaultSuggestions.filter((s) =>
                s.text.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setSuggestions(filtered.length > 0 ? filtered : defaultSuggestions);
        } catch (error) {
            console.error('Erreur suggestions:', error);
            setSuggestions(defaultSuggestions);
        } finally {
            setLoading(false);
        }
    }, [specializedType]);

    // Debounce pour éviter trop de requêtes
    const debouncedSearch = useDebounce(performSearch, 300);

    useEffect(() => {
        if (prefillQuery) {
            setQuery(prefillQuery);
        }
        setSuggestions(defaultSuggestions);
    }, [prefillQuery, specializedType]);

    useEffect(() => {
        debouncedSearch(query);
    }, [query, debouncedSearch]);

    const handleSelect = (suggestion: Suggestion) => {
        setQuery(suggestion.text);
        setShowSuggestions(false);
        onSelect(suggestion.text);
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                <TextInput
                    style={styles.input}
                    placeholder={placeholder || 'Rechercher...'}
                    placeholderTextColor={modernColors.textSecondary}
                    value={query}
                    onChangeText={(text) => {
                        setQuery(text);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                />
                {loading && (
                    <ActivityIndicator size="small" color={modernColors.primary} />
                )}
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                        <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item, index) => `${item.type}-${index}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => handleSelect(item)}
                            >
                                <SafeIcon
                                    name={item.icon || 'search'}
                                    size={16}
                                    color={modernColors.textSecondary}
                                    type="lucide"
                                />
                                <Text style={styles.suggestionText}>{item.text}</Text>
                            </TouchableOpacity>
                        )}
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 1000,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        maxHeight: 300,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    suggestionText: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
    },
});

export default SpecializedSearchAutocomplete;

