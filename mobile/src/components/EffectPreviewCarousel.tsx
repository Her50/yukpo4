// ✅ NOUVEAU: Carousel de previews d'effets générés par IA

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { EffectPreviewResponse, effectPreviewService } from '../services/effectPreviewService';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface EffectPreviewCarouselProps {
    effectNames: string[];
    sampleMediaUrl: string;
    onEffectSelected: (effectName: string, preview: EffectPreviewResponse) => void;
}

export const EffectPreviewCarousel: React.FC<EffectPreviewCarouselProps> = ({
    effectNames,
    sampleMediaUrl,
    onEffectSelected,
}) => {
    const [previews, setPreviews] = useState<Map<string, EffectPreviewResponse>>(new Map());
    const [loading, setLoading] = useState<Set<string>>(new Set());
    const [selectedEffect, setSelectedEffect] = useState<string | null>(null);

    useEffect(() => {
        // Générer les previews pour tous les effets
        const generatePreviews = async () => {
            for (const effectName of effectNames) {
                if (!previews.has(effectName) && !loading.has(effectName)) {
                    setLoading(prev => new Set(prev).add(effectName));

                    try {
                        const preview = await effectPreviewService.generatePreview({
                            effect_name: effectName,
                            sample_media_url: sampleMediaUrl,
                            duration: 3.0,
                            quality: 'low',
                        });

                        setPreviews(prev => new Map(prev).set(effectName, preview));
                    } catch (error: any) {
                        console.error(`[EffectPreviewCarousel] Erreur preview ${effectName}:`, error);
                    } finally {
                        setLoading(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(effectName);
                            return newSet;
                        });
                    }
                }
            }
        };

        generatePreviews();
    }, [effectNames, sampleMediaUrl]);

    return (
        <NativeCard style={styles.container}>
            <Text style={styles.title}>Aperçu des Effets</Text>
            <Text style={styles.subtitle}>
                Cliquez sur un effet pour voir le preview
            </Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
            >
                {effectNames.map((effectName) => {
                    const preview = previews.get(effectName);
                    const isLoading = loading.has(effectName);
                    const isSelected = selectedEffect === effectName;

                    return (
                        <TouchableOpacity
                            key={effectName}
                            style={[
                                styles.effectCard,
                                isSelected && styles.effectCardSelected,
                            ]}
                            onPress={() => {
                                if (preview) {
                                    setSelectedEffect(effectName);
                                    onEffectSelected(effectName, preview);
                                }
                            }}
                            disabled={isLoading || !preview}
                        >
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color={modernColors.primary} />
                                    <Text style={styles.loadingText}>Génération...</Text>
                                </View>
                            ) : preview ? (
                                <>
                                    {preview.thumbnail_url ? (
                                        <Image
                                            source={{ uri: preview.thumbnail_url }}
                                            style={styles.thumbnail}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.placeholder}>
                                            <SafeIcon name="film" size={32} color={modernColors.textSecondary} />
                                        </View>
                                    )}
                                    <Text style={styles.effectName}>{effectName}</Text>
                                    <Text style={styles.effectDescription} numberOfLines={2}>
                                        {preview.description}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.selectedBadge}>
                                            <SafeIcon name="check" size={16} color="#FFF" />
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View style={styles.errorContainer}>
                                    <SafeIcon name="alert-circle" size={24} color={modernColors.error} />
                                    <Text style={styles.errorText}>Erreur</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
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
        marginBottom: 12,
    },
    carousel: {
        marginHorizontal: -8,
    },
    carouselContent: {
        gap: 12,
        paddingHorizontal: 8,
    },
    effectCard: {
        width: 140,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        position: 'relative',
    },
    effectCardSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: modernColors.primary + '10',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
        gap: 8,
    },
    loadingText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    thumbnail: {
        width: '100%',
        height: 80,
        borderRadius: 8,
        marginBottom: 8,
    },
    placeholder: {
        width: '100%',
        height: 80,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    effectName: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
        textTransform: 'capitalize',
    },
    effectDescription: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    selectedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
        gap: 4,
    },
    errorText: {
        fontSize: 11,
        color: modernColors.error,
    },
});

