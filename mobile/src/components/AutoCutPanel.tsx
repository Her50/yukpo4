// ✅ NOUVEAU: Panel d'auto-cut intelligent pour vidéos

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
import { Highlight, SceneCut, videoAnalysisService } from '../services/videoAnalysisService';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface AutoCutPanelProps {
    videoUrl: string;
    videoId?: number;
    onScenesSelected: (scenes: SceneCut[]) => void;
}

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AutoCutPanel: React.FC<AutoCutPanelProps> = ({
    videoUrl,
    videoId,
    onScenesSelected,
}) => {
    const [loading, setLoading] = useState(false);
    const [scenes, setScenes] = useState<SceneCut[]>([]);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [selectedScenes, setSelectedScenes] = useState<Set<number>>(new Set());

    const handleAutoCut = async () => {
        setLoading(true);
        try {
            const result = await videoAnalysisService.autoCut({
                video_url: videoUrl,
                video_id: videoId,
                min_scene_duration: 2.0,
                max_scene_duration: 10.0,
                silence_threshold: -40.0,
                detect_highlights: true,
            });

            setScenes(result.scenes);
            setHighlights(result.highlights);

            // Auto-sélectionner les highlights
            const highlightIndices = new Set<number>();
            result.highlights.forEach((h) => {
                const sceneIdx = result.scenes.findIndex(
                    (s) => s.start_time <= h.start_time && s.end_time >= h.end_time
                );
                if (sceneIdx >= 0) highlightIndices.add(sceneIdx);
            });
            setSelectedScenes(highlightIndices);
        } catch (error: any) {
            console.error('[AutoCutPanel] Error:', error);
            Alert.alert('Erreur', 'Impossible de découper la vidéo automatiquement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Découpage Automatique</Text>
                <TouchableOpacity
                    style={styles.autoCutButton}
                    onPress={handleAutoCut}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <SafeIcon name="scissors" size={16} color="#FFF" />
                            <Text style={styles.autoCutButtonText}>Découper</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {scenes.length > 0 && (
                <>
                    <Text style={styles.summary}>
                        {scenes.length} scène{scenes.length > 1 ? 's' : ''} détectée{scenes.length > 1 ? 's' : ''}
                        {highlights.length > 0 && ` • ${highlights.length} highlight${highlights.length > 1 ? 's' : ''}`}
                    </Text>

                    <ScrollView style={styles.scenesList} nestedScrollEnabled>
                        {scenes.map((scene, index) => {
                            const isHighlight = highlights.some(
                                (h) => h.start_time >= scene.start_time && h.end_time <= scene.end_time
                            );
                            const isSelected = selectedScenes.has(index);

                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.sceneCard,
                                        isSelected && styles.sceneCardSelected,
                                        isHighlight && styles.sceneCardHighlight,
                                    ]}
                                    onPress={() => {
                                        const newSelected = new Set(selectedScenes);
                                        if (newSelected.has(index)) {
                                            newSelected.delete(index);
                                        } else {
                                            newSelected.add(index);
                                        }
                                        setSelectedScenes(newSelected);
                                    }}
                                >
                                    <View style={styles.sceneHeader}>
                                        <View style={styles.sceneNumber}>
                                            <Text style={styles.sceneNumberText}>{index + 1}</Text>
                                        </View>
                                        <View style={styles.sceneInfo}>
                                            <Text style={styles.sceneTime}>
                                                {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                                            </Text>
                                            <Text style={styles.sceneDuration}>
                                                ({scene.duration.toFixed(1)}s)
                                            </Text>
                                        </View>
                                        {isHighlight && (
                                            <View style={styles.highlightBadge}>
                                                <SafeIcon name="star" size={12} color="#F59E0B" />
                                                <Text style={styles.highlightText}>Highlight</Text>
                                            </View>
                                        )}
                                        {isSelected && (
                                            <View style={styles.selectedBadge}>
                                                <SafeIcon name="check" size={14} color="#10B981" />
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.sceneMeta}>
                                        <Text style={styles.sceneType}>{scene.scene_type}</Text>
                                        <Text style={styles.sceneConfidence}>
                                            Confiance: {(scene.confidence * 100).toFixed(0)}%
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {selectedScenes.size > 0 && (
                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={() => {
                                const selected = scenes.filter((_, idx) => selectedScenes.has(idx));
                                onScenesSelected(selected);
                            }}
                        >
                            <Text style={styles.applyButtonText}>
                                Utiliser {selectedScenes.size} scène{selectedScenes.size > 1 ? 's' : ''} sélectionnée{selectedScenes.size > 1 ? 's' : ''}
                            </Text>
                        </TouchableOpacity>
                    )}
                </>
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
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    autoCutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    autoCutButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
    summary: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    scenesList: {
        maxHeight: 300,
    },
    sceneCard: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginBottom: 8,
    },
    sceneCardSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: modernColors.primary + '10',
    },
    sceneCardHighlight: {
        borderColor: '#F59E0B',
    },
    sceneHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    sceneNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sceneNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
    },
    sceneInfo: {
        flex: 1,
    },
    sceneTime: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    sceneDuration: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    highlightBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#FEF3C7',
    },
    highlightText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#F59E0B',
    },
    selectedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sceneMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sceneType: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textTransform: 'capitalize',
    },
    sceneConfidence: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    applyButton: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
});

