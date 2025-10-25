import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import SafeIcon from './SafeIcon';

interface SmartVehicleModelInputProps {
    marque: string; // Marque du véhicule (pour suggestions contextuelles)
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
    autoLoadLastUsed?: boolean;
}

const SmartVehicleModelInput: React.FC<SmartVehicleModelInputProps> = ({
    marque,
    value,
    onChangeText,
    placeholder = 'Ex: Corolla',
    label = 'Modèle',
    required = false,
    autoLoadLastUsed = true,
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [allModels, setAllModels] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [lastUsedValue, setLastUsedValue] = useState<string>('');

    // Charger les modèles au montage et quand la marque change
    useEffect(() => {
        loadModels();
        if (autoLoadLastUsed) {
            loadLastUsedValue();
        }
    }, [marque]);

    // Sauvegarder le modèle quand on perd le focus
    useEffect(() => {
        if (!isFocused && value && value.trim().length > 1 && marque) {
            saveModel(value.trim());
            saveLastUsedValue(value.trim());
        }
    }, [isFocused, value]);

    // Charger les modèles depuis la BASE DE DONNÉES + cache local
    const loadModels = async () => {
        try {
            const cacheKey = marque ? `@yukpomnang_models_${marque}` : '@yukpomnang_models_all';
            let models: string[] = [];

            // 1. Charger depuis le cache local (rapide)
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                models = JSON.parse(cached) as string[];
                setAllModels(models);
            }

            // 2. Charger depuis la base de données
            try {
                const endpoint = marque
                    ? `/vehicle-models?brand=${encodeURIComponent(marque)}`
                    : '/vehicle-models/all';
                const response = await apiGet(endpoint);

                if (response.success && response.data && Array.isArray(response.data)) {
                    const dbModels = response.data.map((m: any) => m.model).filter(Boolean);

                    // Fusionner DB + cache local (éliminer doublons)
                    const merged = [...new Set([...dbModels, ...models])];

                    // Mettre à jour le cache local
                    await AsyncStorage.setItem(cacheKey, JSON.stringify(merged));
                    setAllModels(merged);
                }
            } catch (dbError) {
                console.warn('[SmartVehicleModelInput] Utilisation du cache local:', dbError);
            }
        } catch (error) {
            console.error('[SmartVehicleModelInput] Erreur chargement modèles:', error);
        }
    };

    // Charger la dernière valeur utilisée
    const loadLastUsedValue = async () => {
        try {
            const storageKey = marque
                ? `@yukpomnang_last_model_${marque}`
                : '@yukpomnang_last_model';
            const lastUsed = await AsyncStorage.getItem(storageKey);

            if (lastUsed) {
                setLastUsedValue(lastUsed);

                if (autoLoadLastUsed && !value) {
                    onChangeText(lastUsed);
                }
            }
        } catch (error) {
            console.error('[SmartVehicleModelInput] Erreur chargement dernière valeur:', error);
        }
    };

    // Sauvegarder la dernière valeur utilisée
    const saveLastUsedValue = async (modelValue: string) => {
        try {
            const storageKey = marque
                ? `@yukpomnang_last_model_${marque}`
                : '@yukpomnang_last_model';
            await AsyncStorage.setItem(storageKey, modelValue);
            setLastUsedValue(modelValue);
        } catch (error) {
            console.error('[SmartVehicleModelInput] Erreur sauvegarde dernière valeur:', error);
        }
    };

    // Sauvegarder un nouveau modèle (LOCAL + BASE DE DONNÉES)
    const saveModel = async (modelName: string) => {
        try {
            if (!modelName || modelName.trim().length < 2 || !marque) return;

            const normalized = modelName.trim();

            // Vérifier si le modèle existe déjà
            const exists = allModels.some(
                m => m.toLowerCase() === normalized.toLowerCase()
            );

            if (!exists) {
                // 1. Sauvegarder dans le cache local
                const updated = [...allModels, normalized];
                const cacheKey = `@yukpomnang_models_${marque}`;
                await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
                setAllModels(updated);

                // 2. Sauvegarder dans la base de données
                try {
                    await apiPost('/vehicle-models', {
                        brand: marque,
                        model: normalized
                    });
                    console.log(`🌐 [SmartVehicleModelInput] Modèle sauvegardé en DB: ${normalized}`);
                } catch (dbError) {
                    console.warn('[SmartVehicleModelInput] Erreur sauvegarde DB:', dbError);
                }
            }
        } catch (error) {
            console.error('[SmartVehicleModelInput] Erreur sauvegarde modèle:', error);
        }
    };

    // Filtrer les suggestions
    const updateSuggestions = (text: string) => {
        if (!text || text.trim().length < 1) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const filtered = allModels.filter(model =>
            model.toLowerCase().includes(text.toLowerCase())
        );

        // Tri intelligent
        filtered.sort((a, b) => {
            // Priorité dernière valeur
            if (lastUsedValue) {
                const aIsLast = a.toLowerCase() === lastUsedValue.toLowerCase();
                const bIsLast = b.toLowerCase() === lastUsedValue.toLowerCase();
                if (aIsLast && !bIsLast) return -1;
                if (!aIsLast && bIsLast) return 1;
            }

            // Commence par le texte
            const aStarts = a.toLowerCase().startsWith(text.toLowerCase());
            const bStarts = b.toLowerCase().startsWith(text.toLowerCase());
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return a.localeCompare(b);
        });

        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    };

    const handleChangeText = (text: string) => {
        onChangeText(text);
        updateSuggestions(text);
    };

    const selectSuggestion = (model: string) => {
        onChangeText(model);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const handleFocus = () => {
        setIsFocused(true);
        if (value && value.length >= 1) {
            updateSuggestions(value);
        }
    };

    const handleBlur = () => {
        setTimeout(() => {
            setIsFocused(false);
            setShowSuggestions(false);
        }, 200);
    };

    return (
        <View style={styles.container}>
            {label && (
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                    {marque && <Text style={styles.brandHint}> ({marque})</Text>}
                </Text>
            )}

            <View style={styles.inputContainer}>
                <SafeIcon
                    name="car"
                    size={20}
                    color="#6B7280"
                    style={styles.icon}
                />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={handleChangeText}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                />
                {value.length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            onChangeText('');
                            setSuggestions([]);
                            setShowSuggestions(false);
                        }}
                        style={styles.clearButton}
                    >
                        <SafeIcon name="x" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionsHeader}>
                        <SafeIcon name="list" size={14} color="#6B7280" />
                        <Text style={styles.suggestionsTitle}>
                            Modèles {marque} ({suggestions.length})
                        </Text>
                    </View>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item, index) => `${item}-${index}`}
                        renderItem={({ item }) => {
                            const isLastUsed = lastUsedValue && item.toLowerCase() === lastUsedValue.toLowerCase();
                            return (
                                <TouchableOpacity
                                    style={[styles.suggestionItem, isLastUsed && styles.suggestionItemLastUsed]}
                                    onPress={() => selectSuggestion(item)}
                                >
                                    <SafeIcon
                                        name={isLastUsed ? "star" : "chevron-right"}
                                        size={14}
                                        color={isLastUsed ? "#F59E0B" : "#3B82F6"}
                                    />
                                    <Text style={[styles.suggestionText, isLastUsed && styles.suggestionTextLastUsed]}>
                                        {item}
                                    </Text>
                                    {isLastUsed && (
                                        <View style={styles.lastUsedBadge}>
                                            <Text style={styles.lastUsedBadgeText}>Récent</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        style={styles.suggestionsList}
                        nestedScrollEnabled
                    />
                </View>
            )}

            {/* Hint */}
            {!showSuggestions && !marque && (
                <Text style={styles.hint}>
                    💡 Sélectionnez d'abord une marque pour voir les modèles
                </Text>
            )}
            {!showSuggestions && marque && allModels.length > 0 && (
                <Text style={styles.hint}>
                    💡 {allModels.length} modèle(s) {marque} enregistré(s)
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    required: {
        color: '#DC2626',
    },
    brandHint: {
        color: '#6B7280',
        fontWeight: '400',
        fontSize: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 12,
        height: 48,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
        paddingVertical: 0,
    },
    clearButton: {
        padding: 4,
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    suggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 6,
    },
    suggestionsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    suggestionsList: {
        maxHeight: 150,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 10,
    },
    suggestionText: {
        fontSize: 14,
        color: '#111827',
        flex: 1,
    },
    hint: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 6,
        fontStyle: 'italic',
    },
    suggestionItemLastUsed: {
        backgroundColor: '#FEF3C7',
        borderLeftWidth: 3,
        borderLeftColor: '#F59E0B',
    },
    suggestionTextLastUsed: {
        fontWeight: '600',
        color: '#92400E',
    },
    lastUsedBadge: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    lastUsedBadgeText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

export default SmartVehicleModelInput;

