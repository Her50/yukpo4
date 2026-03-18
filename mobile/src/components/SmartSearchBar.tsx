/**
 * SmartSearchBar
 * Barre de recherche intelligente avec autocomplete de modalités
 * Propose progressivement des suggestions basées sur les caractéristiques tapées
 * ✅ NOUVEAU: Support des caractéristiques dynamiques extraites des produits
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { autocompleteHistoryService } from '../services/autocompleteHistoryService';
import { modernColors } from '../theme/modernTheme';
import { extractAvailableCharacteristics } from '../utils/characteristicsExtractor';
import SafeIcon from './SafeIcon';

interface SmartSearchBarProps {
    placeholder?: string;
    onSearch: (query: string, filters?: Record<string, string[]>) => void;
    onClear?: () => void;
    initialValue?: string;
    showFilters?: boolean;
    availableProducts?: any[]; // ✅ NOUVEAU: Produits pour extraction dynamique
    onLocationFilterPress?: () => void; // ✅ NOUVEAU: Callback pour ouvrir filtre location
    hasLocationFilter?: boolean; // ✅ NOUVEAU: Indique si un filtre de proximité est actif
}

interface Suggestion {
    type: 'modality' | 'category' | 'product';
    label: string;
    value: string;
    icon?: string;
    characteristicKey?: string; // ✅ NOUVEAU: Clé de la caractéristique
}

export const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
    placeholder = "Rechercher...",
    onSearch,
    onClear,
    initialValue = '',
    showFilters = true,
    availableProducts = [], // ✅ NOUVEAU
    onLocationFilterPress, // ✅ NOUVEAU
    hasLocationFilter = false, // ✅ NOUVEAU
}) => {
    const [searchText, setSearchText] = useState(initialValue);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({}); // ✅ MODIFIÉ: string[]

    // Charger les suggestions au fur et à mesure de la saisie
    useEffect(() => {
        if (!searchText || searchText.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const loadSuggestions = async () => {
            setIsLoading(true);
            try {
                const allSuggestions: Suggestion[] = [];

                // ✅ NOUVEAU: Priorité aux caractéristiques dynamiques des produits disponibles
                if (availableProducts && availableProducts.length > 0) {
                    const characteristics = extractAvailableCharacteristics(availableProducts);
                    const searchLower = searchText.toLowerCase();

                    Object.entries(characteristics).forEach(([charKey, valuesSet]) => {
                        const matchingValues = Array.from(valuesSet).filter(value =>
                            value.toLowerCase().includes(searchLower)
                        );

                        matchingValues.slice(0, 3).forEach(value => {
                            allSuggestions.push({
                                type: 'modality',
                                label: `${charKey}: ${value}`,
                                value: value,
                                icon: getIconForKey(charKey),
                                characteristicKey: charKey,
                            });
                        });
                    });
                }

                // ✅ FALLBACK: Recherche dans l'historique autocomplete si peu de résultats
                if (allSuggestions.length < 5) {
                    const categories = [
                        { base: 'produits', keys: ['marque', 'modele', 'type', 'couleur'] },
                        { base: 'services', keys: ['competence', 'specialite', 'type_service'] },
                        { base: 'prestations', keys: ['domaine', 'niveau', 'experience'] },
                    ];

                    for (const category of categories) {
                        for (const key of category.keys) {
                            try {
                                const results = await autocompleteHistoryService.getSuggestions(
                                    category.base,
                                    key,
                                    searchText,
                                    3
                                );

                                results.forEach(result => {
                                    // Éviter les doublons
                                    if (!allSuggestions.find(s => s.value === result.valeur)) {
                                        allSuggestions.push({
                                            type: 'modality',
                                            label: `${key}: ${result.valeur}`,
                                            value: result.valeur,
                                            icon: getIconForKey(key),
                                            characteristicKey: key,
                                        });
                                    }
                                });
                            } catch (error) {
                                // Ignorer les erreurs silencieusement
                            }
                        }
                    }
                }

                // Limiter à 10 suggestions
                setSuggestions(allSuggestions.slice(0, 10));
                setShowSuggestions(allSuggestions.length > 0);
            } catch (error) {
                console.error('[SmartSearchBar] Erreur chargement suggestions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const timeoutId = setTimeout(loadSuggestions, 300);
        return () => clearTimeout(timeoutId);
    }, [searchText, availableProducts]);

    const getIconForKey = (key: string): string => {
        const iconMap: Record<string, string> = {
            marque: '\uD83C\uDFF7️',
            modele: '\uD83D\uDCE6',
            type: '\uD83D\uDD16',
            couleur: '\uD83C\uDFA8',
            competence: '\uD83D\uDCBC',
            specialite: '⭐',
            type_service: '\uD83D\uDEE0️',
            domaine: '\uD83D\uDCDA',
            niveau: '\uD83D\uDCCA',
            experience: '\uD83C\uDF93',
            annee: '\uD83D\uDCC5',
            taille: '\uD83D\uDCCF',
            pointure: '\uD83D\uDC5F',
            matiere: '\uD83E\uDDF5',
            style: '✨',
            etat: '⭐',
            version: '\uD83D\uDD22',
            carburant: '⛽',
            transmission: '⚙️',
            puissance: '⚡',
            kilometrage: '\uD83D\uDEE3️',
            dimensions: '\uD83D\uDCD0',
            poids: '⚖️',
            forme: '◾',
            nombre_de_places: '\uD83D\uDC65',
            capacite: '\uD83D\uDCCA',
        };
        return iconMap[key.toLowerCase()] || '\uD83D\uDD0D';
    };

    // ✅ NOUVEAU: Compter le total de filtres actifs
    const totalFiltersCount = Object.values(selectedFilters).reduce(
        (sum, values) => sum + values.length,
        0
    );

    // ✅ NOUVEAU: Appliquer les filtres et lancer la recherche
    const handleApplyFilters = useCallback(() => {
        Keyboard.dismiss();
        setShowSuggestions(false);
        onSearch(searchText || '', selectedFilters);
    }, [searchText, selectedFilters, onSearch]);

    const handleSearch = useCallback(() => {
        Keyboard.dismiss();
        setShowSuggestions(false);
        onSearch(searchText, selectedFilters);
    }, [searchText, selectedFilters, onSearch]);

    const handleClear = useCallback(() => {
        setSearchText('');
        setSuggestions([]);
        setSelectedFilters({});
        setShowSuggestions(false);
        onClear?.();
    }, [onClear]);

    const handleSelectSuggestion = useCallback((suggestion: Suggestion) => {
        // ✅ NOUVEAU: Si c'est une modalité avec clé, ajouter au filtre
        if (suggestion.characteristicKey) {
            const key = suggestion.characteristicKey;
            const currentValues = selectedFilters[key] || [];

            // Ajouter la valeur si pas déjà présente
            if (!currentValues.includes(suggestion.value)) {
                const newFilters = {
                    ...selectedFilters,
                    [key]: [...currentValues, suggestion.value]
                };
                setSelectedFilters(newFilters);
            }

            setShowSuggestions(false);
            setSearchText(''); // Effacer la recherche après sélection
        } else {
            // Comportement legacy: recherche directe
            setSearchText(suggestion.value);
            setShowSuggestions(false);
            onSearch(suggestion.value, selectedFilters);
        }
    }, [selectedFilters, onSearch]);

    const handleAddFilter = useCallback((key: string, value: string) => {
        const currentValues = selectedFilters[key] || [];
        if (!currentValues.includes(value)) {
            const newFilters = {
                ...selectedFilters,
                [key]: [...currentValues, value]
            };
            setSelectedFilters(newFilters);
        }
    }, [selectedFilters]);

    const handleRemoveFilter = useCallback((key: string, value?: string) => {
        if (value) {
            // Supprimer une valeur spécifique
            const currentValues = selectedFilters[key] || [];
            const newValues = currentValues.filter(v => v !== value);

            if (newValues.length > 0) {
                setSelectedFilters({ ...selectedFilters, [key]: newValues });
            } else {
                const newFilters = { ...selectedFilters };
                delete newFilters[key];
                setSelectedFilters(newFilters);
            }
        } else {
            // Supprimer toute la clé
            const newFilters = { ...selectedFilters };
            delete newFilters[key];
            setSelectedFilters(newFilters);
        }
    }, [selectedFilters]);

    return (
        <View style={styles.container}>
            {/* Barre de recherche principale */}
            <View style={styles.searchBar}>
                <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={placeholder}
                    placeholderTextColor={modernColors.textSecondary}
                    value={searchText}
                    onChangeText={setSearchText}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color={modernColors.primary} />
                )}
                {searchText.length > 0 && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                        <SafeIcon name="x-circle" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                )}
                {/* Bouton de localisation */}
                {onLocationFilterPress && (
                    <TouchableOpacity
                        onPress={onLocationFilterPress}
                        style={[styles.locationButton, hasLocationFilter && styles.locationButtonActive]}
                    >
                        <SafeIcon
                            name="map-pin"
                            size={18}
                            color={hasLocationFilter ? "#FFFFFF" : modernColors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
                    <SafeIcon name="arrow-right" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Filtres actifs */}
            {Object.keys(selectedFilters).length > 0 && (
                <View style={styles.filtersWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filtersContainer}
                        contentContainerStyle={styles.filtersContent}
                    >
                        {Object.entries(selectedFilters).map(([key, values]) =>
                            values.map((value, idx) => (
                                <View key={`${key}-${idx}`} style={styles.filterChip}>
                                    <Text style={styles.filterText}>{key}: {value}</Text>
                                    <TouchableOpacity onPress={() => handleRemoveFilter(key, value)}>
                                        <SafeIcon name="x" size={14} color={modernColors.primary} />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </ScrollView>
                    <TouchableOpacity
                        style={styles.applyFiltersButton}
                        onPress={handleApplyFilters}
                    >
                        <SafeIcon name="filter" size={16} color="#FFFFFF" />
                        <Text style={styles.applyFiltersText}>
                            Rechercher ({totalFiltersCount})
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>
                        \uD83D\uDCA1 Suggestions ({suggestions.length})
                    </Text>
                    <ScrollView
                        style={styles.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                    >
                        {suggestions.map((suggestion, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.suggestionItem}
                                onPress={() => handleSelectSuggestion(suggestion)}
                            >
                                <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
                                <View style={styles.suggestionContent}>
                                    <Text style={styles.suggestionLabel} numberOfLines={1}>
                                        {suggestion.label}
                                    </Text>
                                    <Text style={styles.suggestionValue} numberOfLines={1}>
                                        {suggestion.value}
                                    </Text>
                                </View>
                                <SafeIcon name="arrow-right" size={16} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        zIndex: 1000,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: modernColors.text,
        padding: 0,
    },
    clearButton: {
        padding: 4,
    },
    locationButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 8,
    },
    locationButtonActive: {
        backgroundColor: modernColors.success,
    },
    searchButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        padding: 8,
    },
    filtersWrapper: {
        marginTop: 8,
        gap: 8,
    },
    filtersContainer: {
        maxHeight: 40,
    },
    filtersContent: {
        gap: 8,
        paddingVertical: 4,
    },
    applyFiltersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 6,
    },
    applyFiltersText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    filterText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        maxHeight: 300,
    },
    suggestionsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 8,
    },
    suggestionsList: {
        maxHeight: 250,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    suggestionIcon: {
        fontSize: 20,
    },
    suggestionContent: {
        flex: 1,
        gap: 2,
    },
    suggestionLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    suggestionValue: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '600',
    },
});

export default SmartSearchBar;

