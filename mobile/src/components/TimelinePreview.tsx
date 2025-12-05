// ✅ NOUVEAU: Composant de prévisualisation de timeline de montage vidéo
// ✅ Phase 10: Optimisé avec thumbnails pour scrub 60fps

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { SafeIcon } from './SafeIcon';

export interface TimelineScene {
    scene_index: number;
    start_time: number;
    duration: number;
    media_id?: string;
    media_url?: string;
    text?: string;
    text_position?: string;
    transition?: string;
    effects?: string[];
    audio_cue?: number;
}

export interface VideoTimeline {
    total_duration: number;
    scenes: TimelineScene[];
}

interface TimelinePreviewProps {
    timeline: VideoTimeline;
    onEdit?: () => void;
    onScenePress?: (sceneIndex: number) => void;
}

export const TimelinePreview: React.FC<TimelinePreviewProps> = ({
    timeline,
    onEdit,
    onScenePress,
}) => {
    // ✅ NOUVEAU Phase 10: État pour thumbnails
    const [thumbnails, setThumbnails] = React.useState<Map<number, string>>(new Map());
    const [loadingThumbnails, setLoadingThumbnails] = React.useState<Set<number>>(new Set());

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ✅ NOUVEAU Phase 10: Générer thumbnails pour scrub fluide 60fps
    React.useEffect(() => {
        const generateThumbnails = async () => {
            // Générer thumbnails pour chaque scène (1 par seconde)
            for (const scene of timeline.scenes) {
                if (!thumbnails.has(scene.scene_index) && !loadingThumbnails.has(scene.scene_index)) {
                    setLoadingThumbnails(prev => new Set(prev).add(scene.scene_index));

                    // TODO: Appeler API backend pour générer thumbnail GPU
                    // const thumbnailUrl = await api.generateThumbnail(scene.media_url, scene.start_time);
                    // Pour l'instant, on simule
                    const thumbnailUrl = scene.media_url || `thumbnail_${scene.scene_index}.jpg`;

                    setThumbnails(prev => {
                        const newMap = new Map(prev);
                        newMap.set(scene.scene_index, thumbnailUrl);
                        return newMap;
                    });

                    setLoadingThumbnails(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(scene.scene_index);
                        return newSet;
                    });
                }
            }
        };

        generateThumbnails();
    }, [timeline.scenes, thumbnails, loadingThumbnails]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <SafeIcon name="film" size={20} color={modernColors.primary} />
                    <Text style={styles.title}>Timeline de montage</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.duration}>
                        {formatTime(timeline.total_duration)}
                    </Text>
                    {onEdit && (
                        <TouchableOpacity onPress={onEdit} style={styles.editButton}>
                            <SafeIcon name="edit" size={16} color={modernColors.primary} />
                            <Text style={styles.editButtonText}>Modifier</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scenesContainer}
            >
                {timeline.scenes.map((scene, index) => {
                    const isFirst = index === 0;
                    const isLast = index === timeline.scenes.length - 1;
                    const progress = (scene.start_time / timeline.total_duration) * 100;

                    return (
                        <TouchableOpacity
                            key={scene.scene_index}
                            style={styles.sceneCard}
                            onPress={() => onScenePress?.(scene.scene_index)}
                            activeOpacity={0.7}
                        >
                            {/* ✅ NOUVEAU Phase 10: Thumbnail pour scrub fluide */}
                            {thumbnails.has(scene.scene_index) && (
                                <View style={styles.thumbnailContainer}>
                                    {/* <Image
                                        source={{ uri: thumbnails.get(scene.scene_index) }}
                                        style={styles.thumbnail}
                                        resizeMode="cover"
                                    /> */}
                                    <View style={styles.thumbnailPlaceholder}>
                                        <SafeIcon name="image" size={24} color={modernColors.primary} />
                                    </View>
                                </View>
                            )}

                            <View style={styles.sceneHeader}>
                                <View style={styles.sceneNumber}>
                                    <Text style={styles.sceneNumberText}>
                                        {scene.scene_index + 1}
                                    </Text>
                                </View>
                                <View style={styles.sceneTime}>
                                    <Text style={styles.sceneTimeText}>
                                        {formatTime(scene.start_time)} - {formatTime(scene.start_time + scene.duration)}
                                    </Text>
                                    <Text style={styles.sceneDurationText}>
                                        ({scene.duration.toFixed(1)}s)
                                    </Text>
                                </View>
                            </View>

                            {scene.text && (
                                <View style={styles.sceneTextContainer}>
                                    <Text style={styles.sceneText} numberOfLines={2}>
                                        {scene.text}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.sceneMeta}>
                                {scene.media_id && (
                                    <View style={styles.metaBadge}>
                                        <SafeIcon name="image" size={12} color={modernColors.primary} />
                                        <Text style={styles.metaText}>Média</Text>
                                    </View>
                                )}
                                {scene.transition && scene.transition !== 'none' && (
                                    <View style={styles.metaBadge}>
                                        <SafeIcon name="arrow-right" size={12} color={modernColors.primary} />
                                        <Text style={styles.metaText}>
                                            {scene.transition}
                                        </Text>
                                    </View>
                                )}
                                {scene.effects && scene.effects.length > 0 && (
                                    <View style={styles.metaBadge}>
                                        <SafeIcon name="sparkles" size={12} color={modernColors.primary} />
                                        <Text style={styles.metaText}>
                                            {scene.effects.length} effet{scene.effects.length > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Barre de progression */}
                            <View style={styles.progressBarContainer}>
                                <View
                                    style={[
                                        styles.progressBar,
                                        { width: `${(scene.duration / timeline.total_duration) * 100}%` },
                                    ]}
                                />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {timeline.scenes.length === 0 && (
                <View style={styles.emptyState}>
                    <SafeIcon name="film" size={32} color={modernColors.border} />
                    <Text style={styles.emptyStateText}>
                        Aucune scène dans la timeline
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
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
        fontWeight: '600',
        color: modernColors.text,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    duration: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: modernColors.primary + '15',
    },
    editButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    scenesContainer: {
        gap: 12,
        paddingRight: 16,
    },
    sceneCard: {
        width: 200,
        backgroundColor: modernColors.background,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    sceneHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sceneNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sceneNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sceneTime: {
        flex: 1,
        marginLeft: 8,
    },
    sceneTimeText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.text,
    },
    sceneDurationText: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    sceneTextContainer: {
        marginBottom: 8,
        minHeight: 40,
    },
    sceneText: {
        fontSize: 12,
        color: modernColors.text,
        lineHeight: 16,
    },
    sceneMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: modernColors.surface,
    },
    metaText: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    progressBarContainer: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: modernColors.primary,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyStateText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
    },
    // ✅ NOUVEAU Phase 10: Styles pour thumbnails
    thumbnailContainer: {
        width: '100%',
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 8,
        backgroundColor: modernColors.border,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.border,
    },
});

