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
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { apiGet } from '../services/api';
import { config } from '../config/environment';

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

    // ✅ CORRIGÉ: Fonction pour vérifier si la timeline est valide
    const isTimelineValid = (): boolean => {
        if (!timeline || !timeline.scenes || !Array.isArray(timeline.scenes) || timeline.scenes.length === 0) {
            return false;
        }

        // Vérifier qu'au moins une scène a un média valide
        const hasValidMedia = timeline.scenes.some((scene: any) => {
            // Vérifier media_url
            if (scene.media_url && typeof scene.media_url === 'string' && scene.media_url.trim().length > 0) {
                if (scene.media_url.startsWith('http://') || scene.media_url.startsWith('https://') || scene.media_url.startsWith('file://')) {
                    return true;
                }
            }
            
            // Vérifier media_id
            if (scene.media_id !== null && scene.media_id !== undefined) {
                const mediaId = typeof scene.media_id === 'string' ? parseInt(scene.media_id, 10) : scene.media_id;
                if (!isNaN(mediaId) && mediaId > 0) {
                    return true;
                }
            }
            
            return false;
        });

        return hasValidMedia;
    };

    const timelineIsValid = isTimelineValid();

    // ✅ NOUVEAU: Fonction pour enrichir la timeline en convertissant media_id en media_url
    const enrichTimelineWithMediaUrls = async (timeline: VideoTimeline): Promise<VideoTimeline> => {
        const enrichedScenes = await Promise.all(
            timeline.scenes.map(async (scene: any) => {
                // Si la scène a déjà un media_url, on la garde telle quelle
                if (scene.media_url && typeof scene.media_url === 'string' && scene.media_url.trim().length > 0) {
                    return scene;
                }

                // Si la scène a un media_id, récupérer l'URL depuis l'API
                if (scene.media_id !== null && scene.media_id !== undefined) {
                    try {
                        const mediaId = typeof scene.media_id === 'string' ? parseInt(scene.media_id, 10) : scene.media_id;
                        if (!isNaN(mediaId) && mediaId > 0) {
                            const response = await apiGet(`/api/media/${mediaId}`);
                            if (response.success && response.data?.path) {
                                const mediaPath = response.data.path;
                                const base = (config.API_BASE_URL || config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
                                const mediaUrl = mediaPath.startsWith('http')
                                    ? mediaPath
                                    : base
                                    ? `${base}/api/media/files/${mediaPath.replace(/^\//, '')}`
                                    : mediaPath;

                                return {
                                    ...scene,
                                    media_url: mediaUrl,
                                };
                            }
                        }
                    } catch (error) {
                        console.error(`[QuickPreview] Erreur récupération média ${scene.media_id}:`, error);
                        // En cas d'erreur, on garde la scène telle quelle
                    }
                }

                // Si la scène a assets, utiliser video_url ou image_url
                if (scene.assets) {
                    if (scene.assets.video_url) {
                        return {
                            ...scene,
                            media_url: scene.assets.video_url,
                        };
                    }
                    if (scene.assets.image_url) {
                        return {
                            ...scene,
                            media_url: scene.assets.image_url,
                        };
                    }
                }

                // Si aucune URL n'a pu être trouvée, retourner la scène telle quelle
                return scene;
            })
        );

        return {
            ...timeline,
            scenes: enrichedScenes,
        };
    };

    const handleGeneratePreview = async () => {
        // ✅ CORRIGÉ: Validation de la timeline avant d'appeler l'API
        if (!timeline) {
            Alert.alert(
                'Timeline manquante',
                'Aucune timeline disponible pour générer le preview.\n\nVeuillez d\'abord créer une timeline avec des médias.',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Vérifier que la timeline contient des scènes
        if (!timeline.scenes || !Array.isArray(timeline.scenes) || timeline.scenes.length === 0) {
            Alert.alert(
                'Timeline vide',
                'La timeline ne contient aucune scène.\n\nVeuillez d\'abord générer une timeline avec des scènes.',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Vérifier que les scènes ont des médias valides (validation stricte)
        const scenesWithMedia = timeline.scenes.filter((scene: any) => {
            // Vérifier media_url (non vide, non null, non undefined)
            if (scene.media_url && typeof scene.media_url === 'string' && scene.media_url.trim().length > 0) {
                // Vérifier que l'URL est valide (http, https, ou file)
                if (scene.media_url.startsWith('http://') || scene.media_url.startsWith('https://') || scene.media_url.startsWith('file://')) {
                    return true;
                }
            }
            
            // Vérifier media_id (non null, non undefined, nombre valide)
            if (scene.media_id !== null && scene.media_id !== undefined) {
                const mediaId = typeof scene.media_id === 'string' ? parseInt(scene.media_id, 10) : scene.media_id;
                if (!isNaN(mediaId) && mediaId > 0) {
                    return true;
                }
            }
            
            // Vérifier assets.video_url ou assets.image_url
            if (scene.assets) {
                if (scene.assets.video_url && typeof scene.assets.video_url === 'string' && scene.assets.video_url.trim().length > 0) {
                    return true;
                }
                if (scene.assets.image_url && typeof scene.assets.image_url === 'string' && scene.assets.image_url.trim().length > 0) {
                    return true;
                }
            }
            
            return false;
        });

        if (scenesWithMedia.length === 0) {
            // ✅ CORRIGÉ: Log détaillé pour diagnostic
            console.error('[QuickPreview] Timeline invalide - Détails:', {
                totalScenes: timeline.scenes.length,
                scenes: timeline.scenes.map((s: any, idx: number) => ({
                    index: idx,
                    media_url: s.media_url,
                    media_id: s.media_id,
                    assets: s.assets,
                })),
            });
            
            Alert.alert(
                'Aucun média valide',
                'Aucun média valide trouvé dans la timeline.\n\n' +
                'Veuillez :\n' +
                '• Ajouter des médias (images, vidéos) à la timeline\n' +
                '• Vérifier que les médias ont des URLs valides\n' +
                '• Régénérer la timeline si nécessaire',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Log pour diagnostic
        console.log('[QuickPreview] Validation OK:', {
            totalScenes: timeline.scenes.length,
            scenesWithMedia: scenesWithMedia.length,
            firstScene: scenesWithMedia[0],
        });

        setLoading(true);
        setError(null);

        let enrichedTimeline: VideoTimeline | null = null;

        try {
            // ✅ NOUVEAU: Enrichir la timeline en convertissant media_id en media_url
            enrichedTimeline = await enrichTimelineWithMediaUrls(timeline);
            
            const response = await quickPreviewService.generatePreview({
                timeline: enrichedTimeline,
                quality: 'low',
                max_duration: 10.0,
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Réponse invalide du serveur');
            }

            setPreview(response);
            if (onPreviewReady) {
                onPreviewReady(response);
            }
        } catch (err: any) {
            // ✅ CORRIGÉ: Logs détaillés pour diagnostic
            console.error('[QuickPreview] ❌ Error:', {
                message: err?.message,
                name: err?.name,
                stack: err?.stack,
                response: err?.response?.data,
                status: err?.response?.status,
                timeline: {
                    scenesCount: enrichedTimeline?.scenes?.length || timeline?.scenes?.length || 0,
                    scenes: (enrichedTimeline?.scenes || timeline?.scenes || []).map((s: any, idx: number) => ({
                        index: idx,
                        media_url: s.media_url ? s.media_url.substring(0, 50) + '...' : null,
                        media_id: s.media_id,
                        start_time: s.start_time,
                        duration: s.duration,
                    })),
                },
            });
            
            // ✅ CORRIGÉ: Messages d'erreur plus clairs selon le type d'erreur
            let errorMessage = 'Erreur lors de la génération du preview';
            
            if (err?.response?.status === 500 || err?.message?.includes('500') || err?.message?.includes('Erreur 500')) {
                const serverError = err?.response?.data?.error || err?.response?.data?.message || '';
                if (serverError.includes('média') || serverError.includes('media') || serverError.includes('timeline')) {
                    errorMessage = `Erreur serveur : ${serverError || 'Aucun média trouvé dans la timeline'}\n\nVérifiez que tous les médias de la timeline sont accessibles.`;
                } else {
                    errorMessage = `Erreur serveur (500) : ${serverError || 'Le preview n\'a pas pu être généré'}\n\nVérifiez que tous les médias de la timeline sont accessibles.`;
                }
            } else if (err?.response?.status === 400) {
                const badRequestError = err?.response?.data?.error || err?.response?.data?.message || '';
                errorMessage = `Requête invalide : ${badRequestError || 'Vérifiez que la timeline est correctement formatée'}`;
            } else if (err?.message?.includes('média') || err?.message?.includes('media') || err?.message?.includes('timeline')) {
                errorMessage = 'Aucun média trouvé dans la timeline.\n\nVeuillez ajouter des médias avant de générer le preview.';
            } else if (err?.message?.includes('timeout') || err?.message?.includes('Timeout')) {
                errorMessage = 'Le traitement prend trop de temps.\n\nVeuillez réessayer avec moins de médias.';
            } else if (err?.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
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
                    style={[
                        styles.generateButton,
                        (!timelineIsValid || loading) && styles.generateButtonDisabled
                    ]}
                    onPress={handleGeneratePreview}
                    disabled={!timelineIsValid || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <SafeIcon name="play" size={16} color="#FFF" />
                            <Text style={styles.generateButtonText}>
                                {timelineIsValid ? 'Générer' : 'Médias requis'}
                            </Text>
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

            {!timelineIsValid && !loading && !preview && (
                <View style={styles.warningContainer}>
                    <SafeIcon name="alert-circle" size={20} color={modernColors.warning || '#F59E0B'} />
                    <Text style={styles.warningText}>
                        Ajoutez des médias à la timeline pour générer le preview
                    </Text>
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
    generateButtonDisabled: {
        backgroundColor: modernColors.textSecondary || '#9CA3AF',
        opacity: 0.6,
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
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        marginTop: 8,
    },
    warningText: {
        fontSize: 13,
        color: modernColors.warning || '#F59E0B',
        flex: 1,
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

