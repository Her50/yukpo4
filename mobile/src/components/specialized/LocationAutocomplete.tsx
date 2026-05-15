// ✅ NOUVEAU Phase 1.1: Autocomplétion intelligente de localisation
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../../services/api';
import { useLocation } from '../../contexts/LocationContext';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

interface LocationSuggestion {
    id: string;
    name: string;
    full_name: string;
    ville?: string;
    quartier?: string;
    property_count: number;
    category: string;
}

interface LocationAutocompleteProps {
    value: string;
    onChangeText: (text: string) => void;
    onSelect: (suggestion: LocationSuggestion) => void;
    placeholder?: string;
    style?: any;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
    value,
    onChangeText,
    onSelect,
    placeholder = "Rechercher une ville ou un quartier...",
    style,
}) => {
    const { location } = useLocation();
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (value.trim().length >= 2) {
            const debounceTimer = setTimeout(() => {
                fetchSuggestions(value);
            }, 300);

            return () => clearTimeout(debounceTimer);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [value]);

    const fetchSuggestions = async (query: string) => {
        try {
            setLoading(true);
            const params: any = {
                q: query,
                limit: 10,
            };

            // Ajouter coordonnées GPS si disponibles
            if (location?.coords) {
                params.lat = location.coords.latitude;
                params.lng = location.coords.longitude;
            }

            const response = await apiGet<{
                success: boolean;
                suggestions: LocationSuggestion[];
            }>('/api/immobilier/autocomplete-location', params);

            if (response.success && response.suggestions) {
                setSuggestions(response.suggestions);
                setShowSuggestions(true);
            }
        } catch (error) {
            console.error('[LocationAutocomplete] Erreur:', error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (suggestion: LocationSuggestion) => {
        onChangeText(suggestion.full_name);
        onSelect(suggestion);
        setShowSuggestions(false);
    };

    return (
        <View style={[styles.container, style]}>
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => handleSelect(item)}
                            >
                                <SafeIcon
                                    name={item.category === 'ville' ? 'map-pin' : 'navigation'}
                                    size={20}
                                    color={modernColors.primary}
                                />
                                <View style={styles.suggestionContent}>
                                    <Text style={styles.suggestionName}>
                                        {item.full_name}
                                    </Text>
                                    <Text style={styles.suggestionCount}>
                                        {item.property_count} bien{item.property_count > 1 ? 's' : ''}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        style={styles.suggestionsList}
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
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginTop: 4,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionsList: {
        maxHeight: 300,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    suggestionContent: {
        flex: 1,
        marginLeft: 12,
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    suggestionCount: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default LocationAutocomplete;

