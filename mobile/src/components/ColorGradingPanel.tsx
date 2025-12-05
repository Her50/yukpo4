// ✅ NOUVEAU: Panel de color grading automatique

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ColorGradingResponse, colorGradingService } from '../services/colorGradingService';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './NativeDesign';

interface ColorGradingPanelProps {
    mediaUrl: string;
    mediaId?: number;
    stylePreset?: string;
    onGradingComplete: (gradedUrl: string) => void;
}

const GRADING_PRESETS = [
    { key: 'cinematic', label: 'Cinematic', icon: '🎬', description: 'Style cinéma professionnel' },
    { key: 'vibrant', label: 'Vibrant', icon: '🌈', description: 'Couleurs vives et énergiques' },
    { key: 'moody', label: 'Moody', icon: '🌙', description: 'Ambiance sombre et dramatique' },
    { key: 'warm', label: 'Warm', icon: '☀️', description: 'Tons chauds et accueillants' },
    { key: 'cool', label: 'Cool', icon: '❄️', description: 'Tons froids et modernes' },
];

export const ColorGradingPanel: React.FC<ColorGradingPanelProps> = ({
    mediaUrl,
    mediaId,
    stylePreset,
    onGradingComplete,
}) => {
    const [loading, setLoading] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState(stylePreset || 'cinematic');
    const [intensity, setIntensity] = useState(0.7);
    const [result, setResult] = useState<ColorGradingResponse | null>(null);

    const handleApplyGrading = async (preset: string) => {
        setLoading(true);
        try {
            const response = await colorGradingService.applyGrading({
                media_url: mediaUrl,
                media_id: mediaId,
                style_preset: preset,
                intensity,
                maintain_skin_tones: true,
            });

            setResult(response);
            onGradingComplete(response.graded_media_url);
        } catch (error: any) {
            console.error('[ColorGradingPanel] Error:', error);
            Alert.alert('Erreur', 'Impossible d\'appliquer le color grading');
        } finally {
            setLoading(false);
        }
    };

    return (
        <NativeCard style={styles.container}>
            <Text style={styles.title}>Color Grading Automatique</Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.presetsList}
                contentContainerStyle={styles.presetsContent}
            >
                {GRADING_PRESETS.map((preset) => (
                    <TouchableOpacity
                        key={preset.key}
                        style={[
                            styles.presetCard,
                            selectedPreset === preset.key && styles.presetCardSelected,
                        ]}
                        onPress={() => {
                            setSelectedPreset(preset.key);
                            handleApplyGrading(preset.key);
                        }}
                        disabled={loading}
                    >
                        <Text style={styles.presetIcon}>{preset.icon}</Text>
                        <Text style={styles.presetLabel}>{preset.label}</Text>
                        <Text style={styles.presetDescription}>{preset.description}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {loading && (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Application du color grading...</Text>
                </View>
            )}

            {result && result.before_after_comparison && (
                <View style={styles.comparison}>
                    <Text style={styles.comparisonTitle}>Avant / Après</Text>
                    <Image
                        source={{ uri: result.before_after_comparison }}
                        style={styles.comparisonImage}
                        resizeMode="contain"
                    />
                </View>
            )}
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
        marginBottom: 12,
    },
    presetsList: {
        marginBottom: 12,
    },
    presetsContent: {
        gap: 12,
    },
    presetCard: {
        width: 100,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    presetCardSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: modernColors.primary + '10',
    },
    presetIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    presetLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    presetDescription: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    loading: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 8,
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    comparison: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
    },
    comparisonTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    comparisonImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
});

