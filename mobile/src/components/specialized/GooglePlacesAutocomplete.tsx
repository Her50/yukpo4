// ✅ NOUVEAU: Composant Google Places Autocomplete
// Date: 2026-01-26

import React, { useState, useEffect } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface GooglePlace {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

interface GooglePlacesAutocompleteProps {
    value: string;
    onChangeText: (text: string) => void;
    onPlaceSelect: (place: {
        place_id: string;
        name: string;
        address: string;
        gps?: string;
        ville?: string;
        quartier?: string;
    }) => void;
    placeholder?: string;
    style?: any;
}

const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
    value,
    onChangeText,
    onPlaceSelect,
    placeholder = 'Rechercher un lieu...',
    style,
}) => {
    const [suggestions, setSuggestions] = useState<GooglePlace[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (value.length >= 3) {
            const timeoutId = setTimeout(() => {
                searchPlaces(value);
            }, 300); // Debounce 300ms

            return () => clearTimeout(timeoutId);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [value]);

    const searchPlaces = async (query: string) => {
        try {
            setLoading(true);
            const response = await apiGet<{
                success: boolean;
                data: GooglePlace[];
            }>(`/api/immobilier/google-places/autocomplete?query=${encodeURIComponent(query)}`);

            if (response.success && response.data) {
                setSuggestions(response.data);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        } catch (error) {
            console.error('[GooglePlacesAutocomplete] Erreur:', error);
            setSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPlace = async (place: GooglePlace) => {
        try {
            // Récupérer les détails du lieu
            const detailsResponse = await apiGet<{
                success: boolean;
                data: {
                    place_id: string;
                    name: string;
                    formatted_address: string;
                    geometry?: {
                        location?: {
                            lat: number;
                            lng: number;
                        };
                    };
                    address_components?: Array<{
                        types: string[];
                        long_name: string;
                        short_name: string;
                    }>;
                };
            }>(`/api/immobilier/google-places/details?place_id=${place.place_id}`);

            if (detailsResponse.success && detailsResponse.data) {
                const data = detailsResponse.data;
                const gps = data.geometry?.location
                    ? `${data.geometry.location.lat},${data.geometry.location.lng}`
                    : undefined;

                // Extraire ville et quartier depuis address_components
                let ville: string | undefined;
                let quartier: string | undefined;

                if (data.address_components) {
                    data.address_components.forEach((component) => {
                        if (component.types.includes('locality')) {
                            ville = component.long_name;
                        } else if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
                            quartier = component.long_name;
                        }
                    });
                }

                onPlaceSelect({
                    place_id: data.place_id,
                    name: data.name,
                    address: data.formatted_address,
                    gps,
                    ville,
                    quartier,
                });

                onChangeText(data.name);
                setShowSuggestions(false);
            }
        } catch (error) {
            console.error('[GooglePlacesAutocomplete] Erreur détails:', error);
        }
    };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.inputContainer}>
                <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={modernColors.textSecondary}
                />
                {loading && (
                    <SafeIcon name="loader" size={20} color={modernColors.primary} />
                )}
            </View>

            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item) => item.place_id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => handleSelectPlace(item)}
                            >
                                <SafeIcon
                                    name="map-pin"
                                    size={16}
                                    color={modernColors.textSecondary}
                                />
                                <View style={styles.suggestionText}>
                                    <Text style={styles.suggestionMainText}>
                                        {item.structured_formatting.main_text}
                                    </Text>
                                    <Text style={styles.suggestionSecondaryText}>
                                        {item.structured_formatting.secondary_text}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        style={styles.suggestionsList}
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
        zIndex: 1000,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 8,
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
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        marginTop: 4,
        maxHeight: 200,
        borderWidth: 1,
        borderColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 1001,
    },
    suggestionsList: {
        maxHeight: 200,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 12,
    },
    suggestionText: {
        flex: 1,
    },
    suggestionMainText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 2,
    },
    suggestionSecondaryText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
});

export default GooglePlacesAutocomplete;

