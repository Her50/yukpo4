import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import SafeIcon from './SafeIcon';

interface AdSuggestion {
    text: string;
    confidence: number;
    reasoning?: string;
}

interface AISuggestionsGeneratorProps {
    field: 'titre' | 'description';
    products: ManagedProduct[];
    targetAudience?: {
        ageRange?: { min: number; max: number };
        gender?: string;
        interests?: string[];
    };
    campaignGoal?: 'awareness' | 'conversion' | 'engagement';
    onSuggestionSelect: (suggestion: string) => void;
    currentValue?: string;
}

export const AISuggestionsGenerator: React.FC<AISuggestionsGeneratorProps> = ({
    field,
    products,
    targetAudience,
    campaignGoal,
    onSuggestionSelect,
    currentValue,
}) => {
    const [suggestions, setSuggestions] = useState<AdSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateSuggestions = useCallback(async () => {
        if (products.length === 0) {
            setError('Sélectionnez au moins un produit');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await apiPost('/api/publicites/ai/generate-suggestions', {
                field,
                products: products.map(p => ({
                    nom: p.nom,
                    nom_produit: p.nom,
                    name: p.nom,
                    prix: p.prix,
                    description: p.description,
                    category_key: p.category_key,
                })),
                target_audience: targetAudience || undefined,
                campaign_goal: campaignGoal || undefined,
                count: 5,
            });

            if (response.success && response.data) {
                setSuggestions((response.data as any).suggestions || []);
                setExpanded(true);
            } else {
                setError(response.error || 'Erreur lors de la génération');
            }
        } catch (err: any) {
            console.error('[AISuggestionsGenerator] Erreur:', err);
            setError('Impossible de générer des suggestions');
        } finally {
            setLoading(false);
        }
    }, [field, products, targetAudience, campaignGoal]);

    if (!expanded && suggestions.length === 0) {
        return (
            <TouchableOpacity
                style={styles.generateButton}
                onPress={generateSuggestions}
                disabled={loading || products.length === 0}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={modernColors.primary} />
                ) : (
                    <>
                        <SafeIcon name="sparkles" size={18} color={modernColors.primary} />
                        <Text style={styles.generateButtonText}>
                            ✨ Générer des suggestions IA
                        </Text>
                    </>
                )}
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <SafeIcon name="sparkles" size={20} color={modernColors.primary} />
                    <Text style={styles.title}>
                        Suggestions IA ({suggestions.length})
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        setExpanded(false);
                        setSuggestions([]);
                    }}
                >
                    <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Génération en cours...</Text>
                </View>
            ) : (
                <View style={styles.suggestionsList}>
                    {suggestions.map((suggestion, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.suggestionCard,
                                currentValue === suggestion.text && styles.suggestionCardSelected,
                            ]}
                            onPress={() => onSuggestionSelect(suggestion.text)}
                        >
                            <View style={styles.suggestionHeader}>
                                <Text style={styles.suggestionText} numberOfLines={3}>
                                    {suggestion.text}
                                </Text>
                                {currentValue === suggestion.text && (
                                    <View style={styles.selectedBadge}>
                                        <SafeIcon name="check" size={14} color="#fff" />
                                    </View>
                                )}
                            </View>
                            <View style={styles.suggestionFooter}>
                                <View style={styles.confidenceBadge}>
                                    <SafeIcon name="trending-up" size={12} color={modernColors.success} />
                                    <Text style={styles.confidenceText}>
                                        {Math.round(suggestion.confidence * 100)}% confiance
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.useButton}
                                    onPress={() => onSuggestionSelect(suggestion.text)}
                                >
                                    <Text style={styles.useButtonText}>Utiliser</Text>
                                    <SafeIcon name="arrow-right" size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <TouchableOpacity
                style={styles.regenerateButton}
                onPress={generateSuggestions}
                disabled={loading}
            >
                <SafeIcon name="refresh-cw" size={16} color={modernColors.primary} />
                <Text style={styles.regenerateButtonText}>Régénérer</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.primary,
        marginBottom: 16,
    },
    generateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    container: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        marginBottom: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.error,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 20,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    suggestionsList: {
        gap: 12,
    },
    suggestionCard: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    suggestionCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    suggestionHeader: {
        marginBottom: 12,
    },
    suggestionText: {
        fontSize: 14,
        lineHeight: 20,
        color: modernColors.text,
        fontWeight: '500',
    },
    selectedBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F0FDF4',
    },
    confidenceText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.success,
    },
    useButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    useButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    regenerateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
    regenerateButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

