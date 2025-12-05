// ✅ NOUVEAU: Composant de preview rapide de timeline

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { QuickPreviewResponse, quickPreviewService } from '../services/quickPreviewService';
import { modernColors } from '../theme/modernTheme';
import { VideoTimeline } from '../types/VideoGeneration';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface QuickPreviewProps {
    timeline: VideoTimeline;
    onPreviewReady?: (preview: QuickPreviewResponse) => void;
}

export const QuickPreview: React.FC<QuickPreviewProps> = ({
    timeline,
    onPreviewReady,
}) => {
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<QuickPreviewResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGeneratePreview = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await quickPreviewService.generatePreview({
                timeline,
                quality: 'low',
                max_duration: 10.0,
            });

            setPreview(response);
            if (onPreviewReady) {
                onPreviewReady(response);
            }
        } catch (err: any) {
            console.error('[QuickPreview] Error:', err);
            setError(err.message || 'Erreur génération preview');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Preview Rapide</Text>
                    <Text style={styles.subtitle}>
                        Aperçu low quality en quelques secondes
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.generateButton}
                    onPress={handleGeneratePreview}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <SafeIcon name="play" size={16} color="#FFF" />
                            <Text style={styles.generateButtonText}>Générer</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Génération du preview...</Text>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <SafeIcon name="alert-circle" size={24} color={modernColors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {preview && (
                <View style={styles.previewContainer}>
                    {preview.thumbnail_url ? (
                        <Image
                            source={{ uri: preview.thumbnail_url }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.placeholder}>
                            <SafeIcon name="film" size={48} color={modernColors.textSecondary} />
                            <Text style={styles.placeholderText}>Preview généré</Text>
                        </View>
                    )}
                    <View style={styles.previewInfo}>
                        <View style={styles.infoRow}>
                            <SafeIcon name="clock" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>
                                Durée: {preview.preview_duration.toFixed(1)}s
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <SafeIcon name="zap" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>
                                Généré en {formatTime(preview.processing_time_ms)}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <SafeIcon name="layers" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>
                                Qualité: {preview.quality}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={() => {
                            // TODO: Ouvrir le preview dans un lecteur vidéo
                            Alert.alert('Preview', `URL: ${preview.preview_url}`);
                        }}
                    >
                        <SafeIcon name="play-circle" size={20} color="#FFF" />
                        <Text style={styles.playButtonText}>Voir le preview</Text>
                    </TouchableOpacity>
                </View>
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
    loadingContainer: {
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
    },
    errorText: {
        fontSize: 13,
        color: modernColors.error,
        flex: 1,
    },
    previewContainer: {
        marginTop: 12,
    },
    thumbnail: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginBottom: 12,
    },
    placeholder: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    placeholderText: {
        marginTop: 8,
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    previewInfo: {
        gap: 8,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    playButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
});

