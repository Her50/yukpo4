// ✅ NOUVEAU: Sélecteur de variantes de timeline générées par IA

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { TimelineVariant, timelineVariantService } from '../services/timelineVariantService';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface TimelineVariantSelectorProps {
    timelineRequest: any; // TimelineVariantRequest
    onVariantSelected: (variant: TimelineVariant) => void;
    onVariantsGenerated?: (variants: TimelineVariant[]) => void;
}

export const TimelineVariantSelector: React.FC<TimelineVariantSelectorProps> = ({
    timelineRequest,
    onVariantSelected,
    onVariantsGenerated,
}) => {
    const [loading, setLoading] = useState(false);
    const [variants, setVariants] = useState<TimelineVariant[]>([]);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

    const handleGenerateVariants = async () => {
        setLoading(true);
        try {
            const response = await timelineVariantService.generateVariants(timelineRequest);

            setVariants(response.variants);
            if (onVariantsGenerated) {
                onVariantsGenerated(response.variants);
            }

            // Auto-sélectionner la première variante
            if (response.variants.length > 0) {
                setSelectedVariantId(response.variants[0].variant_id);
                onVariantSelected(response.variants[0]);
            }
        } catch (error: any) {
            console.error('[TimelineVariantSelector] Error:', error);
            Alert.alert('Erreur', 'Impossible de générer les variantes de timeline');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Variantes de Timeline</Text>
                    <Text style={styles.subtitle}>
                        L'IA génère plusieurs versions avec différents styles
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.generateButton}
                    onPress={handleGenerateVariants}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <SafeIcon name="sparkles" size={16} color="#FFF" />
                            <Text style={styles.generateButtonText}>Générer</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {variants.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.variantsList}
                    contentContainerStyle={styles.variantsContent}
                >
                    {variants.map((variant) => {
                        const isSelected = selectedVariantId === variant.variant_id;

                        return (
                            <TouchableOpacity
                                key={variant.variant_id}
                                style={[
                                    styles.variantCard,
                                    isSelected && styles.variantCardSelected,
                                ]}
                                onPress={() => {
                                    setSelectedVariantId(variant.variant_id);
                                    onVariantSelected(variant);
                                }}
                            >
                                <View style={styles.variantHeader}>
                                    <Text style={styles.variantName}>{variant.variant_name}</Text>
                                    {isSelected && (
                                        <View style={styles.selectedBadge}>
                                            <SafeIcon name="check" size={14} color="#FFF" />
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.variantDescription} numberOfLines={2}>
                                    {variant.variant_description}
                                </Text>
                                <View style={styles.variantStats}>
                                    <View style={styles.statItem}>
                                        <SafeIcon name="film" size={12} color={modernColors.textSecondary} />
                                        <Text style={styles.statText}>
                                            {variant.timeline.scenes.length} scènes
                                        </Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <SafeIcon name="clock" size={12} color={modernColors.textSecondary} />
                                        <Text style={styles.statText}>
                                            {formatTime(variant.timeline.total_duration)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.variantCharacteristics}>
                                    <Text style={styles.characteristicLabel}>
                                        Rythme: {variant.style_characteristics.pacing}
                                    </Text>
                                    <Text style={styles.characteristicLabel}>
                                        Intensité: {(variant.style_characteristics.effect_intensity * 100).toFixed(0)}%
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    generateButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFF',
    },
    variantsList: {
        marginHorizontal: -8,
    },
    variantsContent: {
        gap: 12,
        paddingHorizontal: 8,
    },
    variantCard: {
        width: 200,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    variantCardSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: modernColors.primary + '10',
    },
    variantHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    variantName: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
        textTransform: 'capitalize',
    },
    selectedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    variantDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    variantStats: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    variantCharacteristics: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        gap: 4,
    },
    characteristicLabel: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
});

