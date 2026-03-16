// ✅ NOUVEAU Phase 2: Éditeur de timeline multi-pistes avec keyframes

import React, { useState, useRef, useCallback } from 'react';
import {
    Dimensions,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AdvancedTimeline, TimelineTrack, TimelineClip, TimelineState, TimelineViewport } from '../types/AdvancedTimeline';
import { TrackHeader } from './TrackHeader';
import { ClipComponent } from './ClipComponent';
import { KeyframeEditor } from './KeyframeEditor';
import { CurveEditor } from './CurveEditor';
import { NativeButton } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TRACK_HEIGHT = 60;
const HEADER_WIDTH = 150;
const PIXELS_PER_SECOND = 50; // 50 pixels par seconde par défaut

interface AdvancedTimelineEditorProps {
    timeline: AdvancedTimeline;
    onTimelineChange?: (timeline: AdvancedTimeline) => void;
    onSave?: (timeline: AdvancedTimeline) => void;
    onClose?: () => void;
}

export const AdvancedTimelineEditor: React.FC<AdvancedTimelineEditorProps> = ({
    timeline: initialTimeline,
    onTimelineChange,
    onSave,
    onClose,
}) => {
        const { t } = useLanguageSafe();
const [timeline, setTimeline] = useState<AdvancedTimeline>(initialTimeline);
    const [state, setState] = useState<TimelineState>({
        currentTime: 0,
        isPlaying: false,
        isScrubbing: false,
        selectedClips: [],
        selectedTracks: [],
        viewport: {
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
            visibleStartTime: 0,
            visibleEndTime: timeline.duration,
        },
        snapEnabled: true,
        snapThreshold: 5,
    });
    const [editingKeyframe, setEditingKeyframe] = useState<{
        clipId: string;
        property: string;
    } | null>(null);
    const [editingCurve, setEditingCurve] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    const pixelsPerSecond = PIXELS_PER_SECOND * state.viewport.zoom;
    const timelineWidth = timeline.duration * pixelsPerSecond;

    const handleTimelineChange = useCallback((updatedTimeline: AdvancedTimeline) => {
        setTimeline(updatedTimeline);
        onTimelineChange?.(updatedTimeline);
    }, [onTimelineChange]);

    const handleTrackLock = useCallback((trackId: string) => {
        const updated = {
            ...timeline,
            tracks: timeline.tracks.map((track) =>
                track.id === trackId
                    ? { ...track, locked: !track.locked }
                    : track
            ),
        };
        handleTimelineChange(updated);
    }, [timeline, handleTimelineChange]);

    const handleTrackMute = useCallback((trackId: string) => {
        const updated = {
            ...timeline,
            tracks: timeline.tracks.map((track) =>
                track.id === trackId
                    ? { ...track, muted: !track.muted }
                    : track
            ),
        };
        handleTimelineChange(updated);
    }, [timeline, handleTimelineChange]);

    const handleTrackVisibility = useCallback((trackId: string) => {
        const updated = {
            ...timeline,
            tracks: timeline.tracks.map((track) =>
                track.id === trackId
                    ? { ...track, visible: track.visible !== false ? false : true }
                    : track
            ),
        };
        handleTimelineChange(updated);
    }, [timeline, handleTimelineChange]);

    const handleClipPress = useCallback((clipId: string) => {
        setState((prev) => ({
            ...prev,
            selectedClips: prev.selectedClips.includes(clipId)
                ? prev.selectedClips.filter((id) => id !== clipId)
                : [...prev.selectedClips, clipId],
        }));
    }, []);

    const handleZoom = useCallback((delta: number) => {
        setState((prev) => ({
            ...prev,
            viewport: {
                ...prev.viewport,
                zoom: Math.max(0.1, Math.min(10, prev.viewport.zoom + delta)),
            },
        }));
    }, []);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            {/* Header avec contrôles */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>{timeline.name}</Text>
                    <Text style={styles.subtitle}>
                        {formatTime(state.currentTime)} / {formatTime(timeline.duration)}
                    </Text>
                </View>
                <View style={styles.headerControls}>
                    {/* Zoom */}
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => handleZoom(-0.1)}
                    >
                        <SafeIcon name="zoom-out" size={20} color={modernColors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => handleZoom(0.1)}
                    >
                        <SafeIcon name="zoom-in" size={20} color={modernColors.text} />
                    </TouchableOpacity>

                    {/* Play/Pause */}
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))}
                    >
                        <SafeIcon
                            name={state.isPlaying ? 'pause' : 'play'}
                            size={20}
                            color={modernColors.primary}
                        />
                    </TouchableOpacity>

                    {/* Snap */}
                    <TouchableOpacity
                        style={[styles.controlButton, state.snapEnabled && styles.controlButtonActive]}
                        onPress={() => setState((prev) => ({ ...prev, snapEnabled: !prev.snapEnabled }))}
                    >
                        <SafeIcon name="magnet" size={20} color={state.snapEnabled ? modernColors.primary : modernColors.text} />
                    </TouchableOpacity>

                    {onClose && (
                        <TouchableOpacity
                            style={styles.controlButton}
                            onPress={onClose}
                        >
                            <SafeIcon name="x" size={20} color={modernColors.text} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Timeline */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={true}
                style={styles.timelineScrollView}
                contentContainerStyle={{ width: Math.max(SCREEN_WIDTH, timelineWidth + HEADER_WIDTH) }}
            >
                <View style={styles.timelineContainer}>
                    {/* En-tête avec timeline */}
                    <View style={styles.timelineHeader}>
                        <View style={styles.trackHeaderContainer}>
                            <Text style={styles.trackHeaderLabel}>Pistes</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRuler}>
                            {/* Ruler avec marqueurs de temps */}
                            {Array.from({ length: Math.ceil(timeline.duration) + 1 }).map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.timeMarker,
                                        { left: index * pixelsPerSecond },
                                    ]}
                                >
                                    <View style={styles.timeMarkerLine} />
                                    <Text style={styles.timeMarkerText}>{formatTime(index)}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Pistes */}
                    <ScrollView style={styles.tracksScrollView}>
                        {timeline.tracks.map((track) => (
                            <View key={track.id} style={styles.trackRow}>
                                {/* En-tête de piste */}
                                <View style={styles.trackHeader}>
                                    <TrackHeader
                                        trackId={track.id}
                                        type={track.type}
                                        name={track.name}
                                        locked={track.locked}
                                        muted={track.muted}
                                        visible={track.visible}
                                        onLock={handleTrackLock}
                                        onMute={handleTrackMute}
                                        onVisibility={handleTrackVisibility}
                                        height={TRACK_HEIGHT}
                                    />
                                </View>

                                {/* Zone des clips */}
                                <View style={styles.trackContent}>
                                    {track.clips.map((clip) => (
                                        <ClipComponent
                                            key={clip.id}
                                            clip={clip}
                                            trackType={track.type}
                                            pixelsPerSecond={pixelsPerSecond}
                                            isSelected={state.selectedClips.includes(clip.id)}
                                            onPress={handleClipPress}
                                            onLongPress={() => {
                                                // Ouvrir éditeur de keyframes
                                                setEditingKeyframe({
                                                    clipId: clip.id,
                                                    property: 'position',
                                                });
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </ScrollView>

            {/* Footer avec actions */}
            <View style={styles.footer}>
                <NativeButton
                    title={t('advancedTimelineEditor.ajouterPiste')}
                    onPress={() => {
                        // TODO: Implémenter ajout de piste
                    }}
                    variant="outline"
                />
                {onSave && (
                    <NativeButton
                        title={t('advancedTimelineEditor.enregistrer')}
                        onPress={() => onSave(timeline)}
                        variant="primary"
                    />
                )}
            </View>

            {/* Éditeurs modaux */}
            {editingKeyframe && (() => {
                const clip = timeline.tracks
                    .flatMap((t) => t.clips)
                    .find((c) => c.id === editingKeyframe.clipId);
                const keyframes = clip?.properties[editingKeyframe.property as keyof typeof clip.properties] || [];
                
                return (
                    <KeyframeEditor
                        visible={!!editingKeyframe}
                        keyframes={Array.isArray(keyframes) ? keyframes : []}
                        propertyName={editingKeyframe.property}
                        onClose={() => setEditingKeyframe(null)}
                        onSave={(savedKeyframes) => {
                            const updated = {
                                ...timeline,
                                tracks: timeline.tracks.map((track) => ({
                                    ...track,
                                    clips: track.clips.map((c) =>
                                        c.id === editingKeyframe.clipId
                                            ? {
                                                ...c,
                                                properties: {
                                                    ...c.properties,
                                                    [editingKeyframe.property]: savedKeyframes,
                                                },
                                            }
                                            : c
                                    ),
                                })),
                            };
                            handleTimelineChange(updated);
                            setEditingKeyframe(null);
                        }}
                    />
                );
            })()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerLeft: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    headerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    controlButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: modernColors.background,
    },
    controlButtonActive: {
        backgroundColor: modernColors.primary + '20',
    },
    timelineScrollView: {
        flex: 1,
    },
    timelineContainer: {
        minWidth: SCREEN_WIDTH,
    },
    timelineHeader: {
        flexDirection: 'row',
        height: 40,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    trackHeaderContainer: {
        width: HEADER_WIDTH,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: modernColors.border,
    },
    trackHeaderLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    timeRuler: {
        flex: 1,
        position: 'relative',
    },
    timeMarker: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        alignItems: 'center',
    },
    timeMarkerLine: {
        width: 1,
        flex: 1,
        backgroundColor: modernColors.border,
    },
    timeMarkerText: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    tracksScrollView: {
        flex: 1,
    },
    trackRow: {
        flexDirection: 'row',
        minHeight: TRACK_HEIGHT,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    trackHeader: {
        width: HEADER_WIDTH,
        borderRightWidth: 1,
        borderRightColor: modernColors.border,
    },
    trackContent: {
        flex: 1,
        position: 'relative',
        minHeight: TRACK_HEIGHT,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        gap: 12,
    },
});

