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

interface SmartPhoneModelInputProps {
    marque: string; // Marque du smartphone (pour suggestions contextuelles)
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
    autoLoadLastUsed?: boolean;
}

const SmartPhoneModelInput: React.FC<SmartPhoneModelInputProps> = ({
    marque,
    value,
    onChangeText,
    placeholder = 'Ex: iPhone 14 Pro, Galaxy S23',
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
            const cacheKey = marque ? `@yukpomnang_phone_models_${marque}` : '@yukpomnang_phone_models_all';
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
                    ? `/phone-models?brand=${encodeURIComponent(marque)}`
                    : '/phone-models';
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
                console.warn('[SmartPhoneModelInput] Utilisation du cache local:', dbError);
            }
        } catch (error) {
            console.error('[SmartPhoneModelInput] Erreur chargement modèles:', error);
        }
    };

    // Charger la dernière valeur utilisée
    const loadLastUsedValue = async () => {
        try {
            const storageKey = marque
                ? `@yukpomnang_last_phone_model_${marque}`
                : '@yukpomnang_last_phone_model';
            const lastUsed = await AsyncStorage.getItem(storageKey);

            if (lastUsed) {
                setLastUsedValue(lastUsed);

                if (autoLoadLastUsed && !value) {
                    onChangeText(lastUsed);
                }
            }
        } catch (error) {
            console.error('[SmartPhoneModelInput] Erreur chargement dernière valeur:', error);
        }
    };

    // Sauvegarder la dernière valeur utilisée
    const saveLastUsedValue = async (modelValue: string) => {
        try {
            const storageKey = marque
                ? `@yukpomnang_last_phone_model_${marque}`
                : '@yukpomnang_last_phone_model';
            await AsyncStorage.setItem(storageKey, modelValue);
            setLastUsedValue(modelValue);
        } catch (error) {
            console.error('[SmartPhoneModelInput] Erreur sauvegarde dernière valeur:', error);
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
                const cacheKey = `@yukpomnang_phone_models_${marque}`;
                await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
                setAllModels(updated);

                // 2. Sauvegarder dans la base de données
                try {
                    await apiPost('/phone-models', {
                        brand: marque,
                        model: normalized
                    });
                    console.log(`📱 [SmartPhoneModelInput] Modèle sauvegardé en DB: ${normalized}`);
                } catch (dbError) {
                    console.warn('[SmartPhoneModelInput] Erreur sauvegarde DB:', dbError);
                }
            }
        } catch (error) {
            console.error('[SmartPhoneModelInput] Erreur sauvegarde modèle:', error);
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

    const selectSuggestion = (suggestion: string) => {
        onChangeText(suggestion);
        setShowSuggestions(false);
        saveModel(suggestion);
        saveLastUsedValue(suggestion);
    };

    return (
        <View style={styles.container}>
            {/* Label */}
            {label && (
                <Text style={styles.label}>
                    {label} {required && <Text style={styles.required}>*</Text>}
                </Text>
            )}

            {/* Input */}
            <View style={styles.inputContainer}>
                <SafeIcon name="smartphone" size={18} color="#6B7280" style={styles.icon} />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={handleChangeText}
                    onFocus={() => {
                        setIsFocused(true);
                        if (value) updateSuggestions(value);
                    }}
                    onBlur={() => {
                        setTimeout(() => setIsFocused(false), 200);
                    }}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoCorrect={false}
                />

                {value.length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            onChangeText('');
                            setSuggestions([]);
                        }}
                        style={styles.clearButton}
                    >
                        <SafeIcon name="x-circle" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Dernière valeur utilisée (si pas de focus) */}
            {lastUsedValue && !isFocused && !value && (
                <TouchableOpacity
                    style={styles.lastUsedButton}
                    onPress={() => {
                        onChangeText(lastUsedValue);
                    }}
                >
                    <SafeIcon name="clock" size={14} color="#6366F1" />
                    <Text style={styles.lastUsedText}>Dernière valeur : {lastUsedValue}</Text>
                </TouchableOpacity>
            )}

            {/* Suggestions (dropdown) */}
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <FlatList
                        data={suggestions.slice(0, 5)}
                        keyExtractor={(item, index) => `${item}-${index}`}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => selectSuggestion(item)}
                            >
                                <SafeIcon name="smartphone" size={16} color="#6B7280" />
                                <Text style={styles.suggestionText}>{item}</Text>
                                {item.toLowerCase() === lastUsedValue.toLowerCase() && (
                                    <View style={styles.lastUsedBadge}>
                                        <Text style={styles.lastUsedBadgeText}>Dernier</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />

                    {suggestions.length > 5 && (
                        <View style={styles.moreResults}>
                            <Text style={styles.moreResultsText}>
                                +{suggestions.length - 5} autres résultats
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Info : si marque non sélectionnée */}
            {!marque && (
                <View style={styles.hintBox}>
                    <SafeIcon name="info" size={14} color="#6366F1" />
                    <Text style={styles.hintText}>Sélectionnez d'abord une marque</Text>
                </View>
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
        color: '#374151',
        marginBottom: 6,
    },
    required: {
        color: '#EF4444',
        fontWeight: '700',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    icon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
        paddingVertical: 0,
    },
    clearButton: {
        padding: 4,
    },
    lastUsedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    lastUsedText: {
        fontSize: 13,
        color: '#6366F1',
        fontWeight: '500',
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        maxHeight: 240,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    lastUsedBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    lastUsedBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    separator: {
        height: 1,
        backgroundColor: '#F3F4F6',
    },
    moreResults: {
        padding: 10,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    moreResultsText: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    hintBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        padding: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    hintText: {
        fontSize: 12,
        color: '#3B82F6',
    },
});

export default SmartPhoneModelInput;









