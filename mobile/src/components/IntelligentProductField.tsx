/**
 * 🧠 CHAMP DE FORMULAIRE INTELLIGENT AVEC AUTOCOMPLETE CONDITIONNEL
 * 
 * Exemple d'utilisation dans ProductManagerMobile:
 * 
 * <IntelligentProductField
 *   label="Modèle du véhicule"
 *   fieldKey="modele"
 *   value={formData.modele}
 *   onValueChange={(value) => setFormData({...formData, modele: value})}
 *   productType="automobile"
 *   category="automobile"
 *   previousFields={{ marque: formData.marque }}
 * />
 */

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { intelligentProductAutocomplete } from '../services/intelligentProductAutocomplete';
import { modernColors } from '../theme/modernTheme';
import { NativeInput } from './SafeNativeDesign';

interface IntelligentProductFieldProps {
    label: string;
    fieldKey: string;
    value: string;
    onValueChange: (value: string) => void;
    productType: string;
    category: string;
    previousFields: Record<string, any>; // Champs déjà remplis
    placeholder?: string;
    required?: boolean;
    userId?: string;
}

interface Suggestion {
    value: string;
    source: 'rules' | 'history' | 'popular' | 'ai' | 'static';
    weight: number;
    reason?: string;
}

export const IntelligentProductField: React.FC<IntelligentProductFieldProps> = ({
    label,
    fieldKey,
    value,
    onValueChange,
    productType,
    category,
    previousFields,
    placeholder,
    required = false,
    userId
}) => {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState(value);

    // Charger les suggestions quand l'utilisateur tape
    useEffect(() => {
        const loadSuggestions = async () => {
            if (!showSuggestions) return;

            setLoading(true);
            try {
                const results = await intelligentProductAutocomplete.getSuggestions(
                    fieldKey,
                    searchQuery,
                    {
                        productType,
                        category,
                        previousFields,
                        userId
                    }
                );

                setSuggestions(results);
            } catch (error) {
                console.error('[IntelligentProductField] Erreur chargement suggestions:', error);
            } finally {
                setLoading(false);
            }
        };

        const debounceTimer = setTimeout(loadSuggestions, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery, showSuggestions, productType, category, JSON.stringify(previousFields)]);

    // Charger les suggestions initiales au focus
    const handleFocus = async () => {
        setShowSuggestions(true);
        if (suggestions.length === 0) {
            setLoading(true);
            try {
                const results = await intelligentProductAutocomplete.getSuggestions(
                    fieldKey,
                    '',
                    {
                        productType,
                        category,
                        previousFields,
                        userId
                    }
                );
                setSuggestions(results);
            } catch (error) {
                console.error('[IntelligentProductField] Erreur chargement initial:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSelectSuggestion = async (suggestion: Suggestion) => {
        setSearchQuery(suggestion.value);
        onValueChange(suggestion.value);
        setShowSuggestions(false);

        // Enregistrer la sélection pour apprentissage
        await intelligentProductAutocomplete.recordSelection(
            fieldKey,
            suggestion.value,
            {
                productType,
                category,
                previousFields,
                userId
            }
        );
    };

    const handleTextChange = (text: string) => {
        setSearchQuery(text);
        onValueChange(text);
    };

    // Icône selon la source
    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'rules': return '🎯';
            case 'history': return '📊';
            case 'popular': return '🔥';
            case 'ai': return '🧠';
            case 'static': return '📚';
            default: return '💡';
        }
    };

    // Couleur selon le poids
    const getWeightColor = (weight: number) => {
        if (weight >= 80) return modernColors.success;
        if (weight >= 60) return modernColors.primary;
        if (weight >= 40) return modernColors.warning;
        return modernColors.textSecondary;
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <NativeInput
                value={searchQuery}
                onChangeText={handleTextChange}
                placeholder={placeholder || `Saisir ${label.toLowerCase()}...`}
                onFocus={handleFocus}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                style={styles.input}
            />

            {/* Liste des suggestions */}
            {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.loadingText}>Chargement des suggestions...</Text>
                        </View>
                    ) : suggestions.length > 0 ? (
                        <FlatList
                            data={suggestions}
                            keyExtractor={(item, index) => `${item.value}-${index}`}
                            style={styles.suggestionsList}
                            nestedScrollEnabled
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelectSuggestion(item)}
                                >
                                    <View style={styles.suggestionLeft}>
                                        <Text style={styles.suggestionIcon}>
                                            {getSourceIcon(item.source)}
                                        </Text>
                                        <View style={styles.suggestionTextContainer}>
                                            <Text style={styles.suggestionValue} numberOfLines={1}>
                                                {item.value}
                                            </Text>
                                            {item.reason && (
                                                <Text style={styles.suggestionReason} numberOfLines={1}>
                                                    {item.reason}
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Indicateur de pertinence */}
                                    <View style={[
                                        styles.weightIndicator,
                                        { backgroundColor: getWeightColor(item.weight) }
                                    ]}>
                                        <Text style={styles.weightText}>{item.weight}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>
                                    Aucune suggestion disponible
                                </Text>
                            }
                        />
                    ) : (
                        <Text style={styles.emptyText}>
                            Commencez à taper pour voir les suggestions
                        </Text>
                    )}

                    {/* Légende des icônes */}
                    <View style={styles.legend}>
                        <Text style={styles.legendTitle}>Légende :</Text>
                        <View style={styles.legendItems}>
                            <Text style={styles.legendItem}>🎯 Basé sur vos saisies</Text>
                            <Text style={styles.legendItem}>📊 Votre historique</Text>
                            <Text style={styles.legendItem}>🔥 Populaire</Text>
                            <Text style={styles.legendItem}>🧠 Suggéré par IA</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        zIndex: 100,
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
    input: {
        // Styles héritées de NativeInput
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginTop: 4,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 1000,
    },
    loadingContainer: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    suggestionsList: {
        maxHeight: 220,
    },
    suggestionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    suggestionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    suggestionIcon: {
        fontSize: 18,
    },
    suggestionTextContainer: {
        flex: 1,
    },
    suggestionValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    suggestionReason: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    weightIndicator: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 36,
        alignItems: 'center',
    },
    weightText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    emptyText: {
        padding: 16,
        textAlign: 'center',
        fontSize: 13,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    legend: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    legendTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 6,
    },
    legendItems: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    legendItem: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
});

