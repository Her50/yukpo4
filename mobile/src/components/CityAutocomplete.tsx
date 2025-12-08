/**
 * Composant d'autocomplétion intelligente pour les villes
 * Utilise Google Places API pour suggérer des villes pendant la saisie
 */

import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface CitySuggestion {
    place_id: string;
    description: string;
    main_text: string;
    secondary_text: string;
}

interface CityAutocompleteProps {
    value: string;
    onChangeText: (text: string) => void;
    onSelect: (city: CitySuggestion) => void;
    placeholder?: string;
    label?: string;
    error?: string;
}

const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
    value,
    onChangeText,
    onSelect,
    placeholder = 'Rechercher une ville...',
    label,
    error,
}) => {
    const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Charger les recherches récentes au montage
    useEffect(() => {
        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadRecentSearches().catch(error => {
            console.error('[CityAutocomplete] Erreur loadRecentSearches:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, []);

    // Rechercher des suggestions quand le texte change
    useEffect(() => {
        if (value.trim().length >= 2) {
            const debounceTimer = setTimeout(() => {
                // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
                searchCities(value.trim()).catch(error => {
                    console.error('[CityAutocomplete] Erreur searchCities:', error);
                });
            }, 300); // Debounce 300ms

            return () => {
                // ✅ SÉCURITÉ: Vérifier que debounceTimer existe avant de le nettoyer
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
            };
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [value]);

    const loadRecentSearches = async () => {
        try {
            // TODO: Charger depuis AsyncStorage
            // const stored = await AsyncStorage.getItem('recent_city_searches');
            // if (stored) {
            //     setRecentSearches(JSON.parse(stored));
            // }
        } catch (error) {
            console.error('[CityAutocomplete] Erreur chargement recherches récentes:', error);
        }
    };

    const saveRecentSearch = async (city: string) => {
        try {
            const updated = [city, ...recentSearches.filter(s => s !== city)].slice(0, 5);
            setRecentSearches(updated);
            // TODO: Sauvegarder dans AsyncStorage
            // await AsyncStorage.setItem('recent_city_searches', JSON.stringify(updated));
        } catch (error) {
            console.error('[CityAutocomplete] Erreur sauvegarde recherche:', error);
        }
    };

    const searchCities = async (query: string) => {
        if (!query || query.length < 2) return;

        try {
            setLoading(true);

            // Option 1: Utiliser Google Places API (nécessite clé API)
            // const API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY';
            // const response = await fetch(
            //     `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${API_KEY}&language=fr`
            // );
            // const data = await response.json();
            // if (data.predictions) {
            //     const formatted = data.predictions.map((p: any) => ({
            //         place_id: p.place_id,
            //         description: p.description,
            //         main_text: p.structured_formatting.main_text,
            //         secondary_text: p.structured_formatting.secondary_text,
            //     }));
            //     setSuggestions(formatted);
            //     setShowSuggestions(true);
            // }

            // Option 2: Utiliser le backend Yukpomnang (recommandé)
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/geocoding/autocomplete?query=${encodeURIComponent(query)}&type=city&limit=5`
            );

            if (response.ok) {
                const data = await response.json();
                if (data.suggestions) {
                    setSuggestions(data.suggestions);
                    setShowSuggestions(true);
                }
            } else {
                // Fallback: suggestions locales pour villes camerounaises populaires
                const localSuggestions = getLocalSuggestions(query);
                setSuggestions(localSuggestions);
                setShowSuggestions(true);
            }
        } catch (error) {
            console.error('[CityAutocomplete] Erreur recherche:', error);
            // Fallback: suggestions locales
            const localSuggestions = getLocalSuggestions(query);
            setSuggestions(localSuggestions);
            setShowSuggestions(true);
        } finally {
            setLoading(false);
        }
    };

    // Suggestions locales pour villes camerounaises populaires
    const getLocalSuggestions = (query: string): CitySuggestion[] => {
        const cities = [
            'Yaoundé',
            'Douala',
            'Bafoussam',
            'Bamenda',
            'Garoua',
            'Maroua',
            'Kribi',
            'Buea',
            'Limbe',
            'Ebolowa',
            'Kousseri',
            'Nkongsamba',
            'Bafang',
            'Foumban',
            'Dschang',
            'Edea',
            'Sangmelima',
            'Mbalmayo',
            'Bertoua',
            'Ngaoundere',
        ];

        const filtered = cities
            .filter(city => city.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5)
            .map(city => ({
                place_id: city.toLowerCase().replace(/\s+/g, '-'),
                description: city,
                main_text: city,
                secondary_text: 'Cameroun',
            }));

        return filtered;
    };

    const handleSelect = (suggestion: CitySuggestion) => {
        onChangeText(suggestion.main_text);
        onSelect(suggestion);
        setShowSuggestions(false);
        saveRecentSearch(suggestion.main_text);
    };

    const handleFocus = () => {
        if (value.trim().length >= 2) {
            setShowSuggestions(true);
        } else if (recentSearches.length > 0) {
            // Afficher les recherches récentes
            const recentSuggestions: CitySuggestion[] = recentSearches.map(city => ({
                place_id: city.toLowerCase().replace(/\s+/g, '-'),
                description: city,
                main_text: city,
                secondary_text: 'Recherche récente',
            }));
            setSuggestions(recentSuggestions);
            setShowSuggestions(true);
        }
    };

    const renderSuggestion = ({ item }: { item: CitySuggestion }) => (
        <TouchableOpacity
            style={styles.suggestionItem}
            onPress={() => handleSelect(item)}
        >
            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
            <View style={styles.suggestionText}>
                <Text style={styles.suggestionMain}>{item.main_text}</Text>
                {item.secondary_text && (
                    <Text style={styles.suggestionSecondary}>{item.secondary_text}</Text>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={styles.inputContainer}>
                <TextInput
                    style={[styles.input, error && styles.inputError]}
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={handleFocus}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoCorrect={false}
                />
                {value.length > 0 && (
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => {
                            onChangeText('');
                            setSuggestions([]);
                            setShowSuggestions(false);
                        }}
                    >
                        <SafeIcon name="x" size={16} color="#6B7280" />
                    </TouchableOpacity>
                )}
                {loading && (
                    <View style={styles.loadingIndicator}>
                        <SafeIcon name="loader" size={16} color={modernColors.primary} />
                    </View>
                )}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <FlatList
                        data={suggestions}
                        renderItem={renderSuggestion}
                        keyExtractor={(item) => item.place_id}
                        style={styles.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    inputContainer: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 48,
        paddingHorizontal: 16,
        paddingRight: 40,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 14,
        color: '#111827',
    },
    inputError: {
        borderColor: '#EF4444',
    },
    clearButton: {
        position: 'absolute',
        right: 12,
        padding: 4,
    },
    loadingIndicator: {
        position: 'absolute',
        right: 12,
        padding: 4,
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
    },
    suggestionsList: {
        maxHeight: 200,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    suggestionText: {
        flex: 1,
    },
    suggestionMain: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    suggestionSecondary: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
});

export default CityAutocomplete;


