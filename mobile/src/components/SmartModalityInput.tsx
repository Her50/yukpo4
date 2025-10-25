import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { NativeInput } from './NativeDesign';
import { SafeIcon } from './SafeIcon';

const modernColors = {
    primary: '#6366F1',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    text: '#1F2937',
    surface: '#FFFFFF',
    border: '#E5E7EB',
};

interface SmartModalityInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    modalityType: 'city' | 'agency' | 'country';
    required?: boolean;
    fieldKey: string; // Clé unique pour le custom_modalities (ex: 'departure_city', 'arrival_city', 'agency_name')
    autoLoadLastUsed?: boolean; // Charger automatiquement la dernière valeur utilisée
    userId?: string; // ID utilisateur pour personnaliser
}

export const SmartModalityInput: React.FC<SmartModalityInputProps> = ({
    label,
    value,
    onChangeText,
    placeholder,
    modalityType,
    required = false,
    fieldKey,
    autoLoadLastUsed = true,
    userId,
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUsedValue, setLastUsedValue] = useState<string>('');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Charger la dernière valeur utilisée au montage
    useEffect(() => {
        if (autoLoadLastUsed) {
            loadLastUsedValue();
        }
    }, [fieldKey]);

    // Charger la dernière valeur utilisée
    const loadLastUsedValue = async () => {
        try {
            const storageKey = userId
                ? `@yukpomnang_last_used_${fieldKey}_${userId}`
                : `@yukpomnang_last_used_${fieldKey}`;
            const lastUsed = await AsyncStorage.getItem(storageKey);

            if (lastUsed) {
                setLastUsedValue(lastUsed);

                // Si le champ est vide et qu'on doit auto-charger, pré-remplir
                if (autoLoadLastUsed && !value) {
                    onChangeText(lastUsed);
                    console.log(`💡 [SmartModalityInput] Dernière valeur chargée pour ${fieldKey}: ${lastUsed}`);
                }
            }
        } catch (error) {
            console.error('[SmartModalityInput] Erreur chargement dernière valeur:', error);
        }
    };

    // Sauvegarder la dernière valeur utilisée
    const saveLastUsedValue = async (modalityValue: string) => {
        try {
            const storageKey = userId
                ? `@yukpomnang_last_used_${fieldKey}_${userId}`
                : `@yukpomnang_last_used_${fieldKey}`;
            await AsyncStorage.setItem(storageKey, modalityValue);
            setLastUsedValue(modalityValue);
            console.log(`✅ [SmartModalityInput] Dernière valeur mémorisée pour ${fieldKey}: ${modalityValue}`);
        } catch (error) {
            console.error('[SmartModalityInput] Erreur sauvegarde dernière valeur:', error);
        }
    };

    // Charger les suggestions en temps réel
    const loadSuggestions = async (searchText: string) => {
        if (searchText.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsLoading(true);
        try {
            // Récupérer les modalités existantes depuis custom_modalities
            const response = await apiGet(`/api/modalities/suggestions?type=${fieldKey}&search=${encodeURIComponent(searchText)}`);

            if (response && Array.isArray(response.suggestions)) {
                // Trier intelligemment : dernière utilisée en premier
                const sorted = response.suggestions.sort((a, b) => {
                    if (lastUsedValue) {
                        const aIsLastUsed = a.toLowerCase() === lastUsedValue.toLowerCase();
                        const bIsLastUsed = b.toLowerCase() === lastUsedValue.toLowerCase();
                        if (aIsLastUsed && !bIsLastUsed) return -1;
                        if (!aIsLastUsed && bIsLastUsed) return 1;
                    }
                    return a.localeCompare(b);
                });

                setSuggestions(sorted);
                setShowSuggestions(sorted.length > 0);

                // Animation d'apparition
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            }
        } catch (error) {
            console.error('Erreur chargement suggestions:', error);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Sauvegarder une nouvelle modalité
    const saveNewModality = async (modalityValue: string) => {
        try {
            await apiPost('/api/modalities/custom', {
                field_type: fieldKey,
                value: modalityValue.trim(),
                category: 'ticket_voyage', // Adapté dynamiquement si besoin
            });
        } catch (error) {
            console.error('Erreur sauvegarde nouvelle modalité:', error);
        }
    };

    // Gestion de la saisie
    const handleTextChange = (text: string) => {
        onChangeText(text);
        loadSuggestions(text);
    };

    // Sélection d'une suggestion
    const handleSelectSuggestion = (suggestion: string) => {
        onChangeText(suggestion);
        saveLastUsedValue(suggestion); // Mémoriser la sélection
        setShowSuggestions(false);
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start();
    };

    // Ajout d'une nouvelle modalité
    const handleAddNew = async () => {
        if (value.trim().length > 0) {
            await saveNewModality(value);
            await saveLastUsedValue(value); // Mémoriser la nouvelle valeur
            setShowSuggestions(false);
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    };

    // Icônes selon le type
    const getIcon = () => {
        switch (modalityType) {
            case 'city': return 'map-pin';
            case 'agency': return 'briefcase';
            case 'country': return 'globe';
            default: return 'list';
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <View style={styles.inputWrapper}>
                <SafeIcon name={getIcon()} size={18} color={modernColors.primary} />
                <NativeInput
                    placeholder={placeholder}
                    value={value}
                    onChangeText={handleTextChange}
                    style={styles.input}
                    onFocus={() => {
                        if (value.length >= 2) {
                            loadSuggestions(value);
                        }
                    }}
                />
                {isLoading && (
                    <SafeIcon name="loader" size={18} color={modernColors.primary} />
                )}
            </View>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <Animated.View
                    style={[
                        styles.suggestionsContainer,
                        { opacity: fadeAnim }
                    ]}
                >
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item, index) => `suggestion-${index}`}
                        renderItem={({ item }) => {
                            const isLastUsed = lastUsedValue && item.toLowerCase() === lastUsedValue.toLowerCase();
                            return (
                                <TouchableOpacity
                                    style={[styles.suggestionItem, isLastUsed && styles.suggestionItemLastUsed]}
                                    onPress={() => handleSelectSuggestion(item)}
                                >
                                    <SafeIcon
                                        name={isLastUsed ? "star" : getIcon()}
                                        size={16}
                                        color={isLastUsed ? modernColors.warning : modernColors.text}
                                    />
                                    <Text style={[styles.suggestionText, isLastUsed && styles.suggestionTextLastUsed]}>
                                        {item}
                                    </Text>
                                    {isLastUsed && (
                                        <View style={styles.lastUsedBadge}>
                                            <Text style={styles.lastUsedBadgeText}>Récente</Text>
                                        </View>
                                    )}
                                    {!isLastUsed && (
                                        <SafeIcon name="check" size={14} color={modernColors.success} />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListFooterComponent={
                            value.trim().length > 0 && !suggestions.includes(value.trim()) ? (
                                <TouchableOpacity
                                    style={styles.addNewButton}
                                    onPress={handleAddNew}
                                >
                                    <SafeIcon name="plus-circle" size={16} color={modernColors.primary} />
                                    <Text style={styles.addNewText}>
                                        Ajouter "{value.trim()}" comme nouvelle option
                                    </Text>
                                </TouchableOpacity>
                            ) : null
                        }
                    />
                </Animated.View>
            )}

            {/* Bouton d'ajout si aucune suggestion */}
            {value.trim().length > 2 && suggestions.length === 0 && !isLoading && (
                <TouchableOpacity
                    style={styles.noResultsButton}
                    onPress={handleAddNew}
                >
                    <SafeIcon name="plus" size={16} color={modernColors.primary} />
                    <Text style={styles.noResultsText}>
                        Créer "{value.trim()}"
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 2,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: modernColors.text,
        paddingVertical: 12,
        borderWidth: 0, // Enlever la bordure par défaut du NativeInput
    },
    suggestionsContainer: {
        maxHeight: 220,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        marginTop: 4,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    addNewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#EEF2FF',
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    addNewText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    noResultsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 8,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
    },
    noResultsText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    suggestionItemLastUsed: {
        backgroundColor: '#FEF3C7',
        borderLeftWidth: 3,
        borderLeftColor: modernColors.warning,
    },
    suggestionTextLastUsed: {
        fontWeight: '600',
        color: '#92400E',
    },
    lastUsedBadge: {
        backgroundColor: modernColors.warning,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    lastUsedBadgeText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

