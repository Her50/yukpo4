// @ts-nocheck
// Ô£à NOUVEAU: Pr├®visualisation temps r├®el des vid├®os avec WebSocket et streaming

import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface RealTimeVideoPreviewProps {
    videoUrl: string;
    onPreviewReady?: (previewUrl: string) => void;
    onError?: (error: string) => void;
    showControls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
}

interface PreviewFrame {
    timestamp: number;
    thumbnailUrl: string;
    duration: number;
    resolution: { width: number; height: number };
}

interface TimelineMarker {
    timestamp: number;
    label: string;
    type: 'scene' | 'transition' | 'effect';
    color: string;
}

export const RealTimeVideoPreview: React.FC<RealTimeVideoPreviewProps> = ({
    videoUrl,
    onPreviewReady,
    onError,
    showControls = true,
    autoPlay = false,
    loop = true,
    muted = true,
}) => {
    const videoRef = useRef<Video>(null);
        const { t } = useLanguageSafe();
const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [previewFrames, setPreviewFrames] = useState<PreviewFrame[]>([]);
    const [timelineMarkers, setTimelineMarkers] = useState<TimelineMarker[]>([]);
    const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [volume, setVolume] = useState(muted ? 0 : 1.0);
    const [showTimeline, setShowTimeline] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

    // Charger la vid├®o et g├®n├®rer les previews
    useEffect(() => {
        loadVideo();
    }, [videoUrl]);

    const loadVideo = useCallback(async () => {
        if (!videoUrl) {
            setError(t('realTimeVideoPreview.aucuneUrlVidoFournie'));
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Charger les m├®tadonn├®es de la vid├®o
            const metadata = await apiGet(`/video/metadata?url=${encodeURIComponent(videoUrl)}`);

            if (metadata.success && metadata.data) {
                setDuration(metadata.data.duration || 0);

                // G├®n├®rer les frames de preview
                await generatePreviewFrames(metadata.data.duration || 0);

                // Charger les marqueurs de timeline
                await loadTimelineMarkers();

                onPreviewReady?.(videoUrl);
            } else {
                throw new Error(metadata.error || 'Erreur chargement m├®tadonn├®es');
            }
        } catch (err: any) {
            console.error('[RealTimeVideoPreview] Erreur chargement vid├®o:', err);
            setError(err.message || t('realTimeVideoPreview.erreurLorsDuChargementDe'));
            onError?.(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [videoUrl, onPreviewReady, onError]);

    const generatePreviewFrames = useCallback(async (videoDuration: number) => {
        setIsGeneratingPreview(true);

        try {
            const response = await apiGet(`/video/preview-frames?url=${encodeURIComponent(videoUrl)}&duration=${videoDuration}`);

            if (response.success && response.data?.frames) {
                setPreviewFrames(response.data.frames);
            }
        } catch (err: any) {
            console.warn('[RealTimeVideoPreview] Erreur g├®n├®ration frames:', err);
            // Ne pas bloquer si les frames ne peuvent pas ├¬tre g├®n├®r├®es
        } finally {
            setIsGeneratingPreview(false);
        }
    }, [videoUrl]);

    const loadTimelineMarkers = useCallback(async () => {
        try {
            const response = await apiGet(`/video/timeline-markers?url=${encodeURIComponent(videoUrl)}`);

            if (response.success && response.data?.markers) {
                setTimelineMarkers(response.data.markers);
            }
        } catch (err: any) {
            console.warn('[RealTimeVideoPreview] Erreur chargement marqueurs:', err);
        }
    }, [videoUrl]);

    // Gestionnaires d'├®v├®nements vid├®o
    const handlePlaybackStatusUpdate = useCallback((status: any) => {
        if (status.isLoaded) {
            setIsPlaying(status.isPlaying || autoPlay);
            setCurrentTime(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
        }
    }, [autoPlay]);

    const handleLoadStart = useCallback(() => {
        setIsLoading(true);
    }, []);

    const handleLoad = useCallback((status: any) => {
        setIsLoading(false);
        if (status.durationMillis) {
            setDuration(status.durationMillis);
        }
    }, []);

    const handleError = useCallback((error: any) => {
        console.error('[RealTimeVideoPreview] Erreur lecture vid├®o:', error);
        setError(t('realTimeVideoPreview.erreurLorsDeLaLecture'));
        onError?.('Erreur lecture vid├®o');
    }, [onError]);

    // Contr├┤les de lecture
    const togglePlayPause = useCallback(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pauseAsync();
            } else {
                videoRef.current.playAsync();
            }
            setIsPlaying(!isPlaying);
        }
    }, [isPlaying]);

    const seekTo = useCallback((timestamp: number) => {
        if (videoRef.current) {
            videoRef.current.setPositionAsync(timestamp);
            setCurrentTime(timestamp);
        }
    }, []);

    const seekToFrame = useCallback((frameIndex: number) => {
        if (previewFrames[frameIndex]) {
            seekTo(previewFrames[frameIndex].timestamp);
            setSelectedFrame(frameIndex);
        }
    }, [previewFrames, seekTo]);

    const changePlaybackRate = useCallback((rate: number) => {
        if (videoRef.current) {
            videoRef.current.setRateAsync(rate);
            setPlaybackRate(rate);
        }
    }, []);

    const changeVolume = useCallback((newVolume: number) => {
        if (videoRef.current) {
            videoRef.current.setVolumeAsync(newVolume);
            setVolume(newVolume);
        }
    }, []);

    // Contr├┤les de zoom et pan
    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            // D├®marrer le pan/zoom
        },
        onPanResponderMove: (evt, gestureState) => {
            const { dx, dy } = gestureState;

            // Zoom avec deux doigts (pinch)
            if (evt.nativeEvent.changedTouches.length === 2) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                const newZoom = Math.max(0.5, Math.min(3.0, zoomLevel + distance * 0.001));
                setZoomLevel(newZoom);
            } else {
                // Pan avec un doigt
                setPanOffset({
                    x: panOffset.x + dx * 0.5,
                    y: panOffset.y + dy * 0.5,
                });
            }
        },
        onPanResponderRelease: () => {
            // Fin du pan/zoom
        },
    });

    const resetZoom = useCallback(() => {
        setZoomLevel(1.0);
        setPanOffset({ x: 0, y: 0 });
    }, []);

    // Formater le temps
    const formatTime = useCallback((milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    // Calculer la progression
    const progress = duration > 0 ? currentTime / duration : 0;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('realTimeVideoPreview.chargementDeLaVido')}</Text>
                {isGeneratingPreview && (
                    <Text style={styles.generatingText}>G├®n├®ration des previews...</Text>
                )}
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadVideo}>
                    <Text style={styles.retryButtonText}>R├®essayer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            {/* Vid├®o principale */}
            <View style={styles.videoContainer}>
                <Video
                    ref={videoRef}
                    source={{ uri: videoUrl }}
                    style={[
                        styles.video,
                        {
                            transform: [
                                { scale: zoomLevel },
                                { translateX: panOffset.x },
                                { translateY: panOffset.y }
                            ]
                        }
                    ]}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={autoPlay}
                    isLooping={loop}
                    isMuted={muted}
                    volume={volume}
                    rate={playbackRate}
                    onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                    onLoadStart={handleLoadStart}
                    onLoad={handleLoad}
                    onError={handleError}
                />

                {/* Contr├┤les de zoom */}
                {zoomLevel !== 1.0 && (
                    <TouchableOpacity style={styles.resetZoomButton} onPress={resetZoom}>
                        <SafeIcon name="maximize-2" size={20} color="white" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Timeline avec previews */}
            {showTimeline && (
                <View style={styles.timelineContainer}>
                    {/* Barre de progression */}
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />

                        {/* Marqueurs de timeline */}
                        {timelineMarkers.map((marker, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.timelineMarker,
                                    { left: `${(marker.timestamp / duration) * 100}%` }
                                ]}
                                onPress={() => seekTo(marker.timestamp)}
                            >
                                <View style={[styles.markerDot, { backgroundColor: marker.color }]} />
                                <Text style={styles.markerLabel}>{marker.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Temps actuel et dur├®e */}
                    <View style={styles.timeDisplay}>
                        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                        <Text style={styles.timeText}>{formatTime(duration)}</Text>
                    </View>

                    {/* Frames de preview */}
                    {previewFrames.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.previewFramesContainer}
                            contentContainerStyle={styles.previewFramesContent}
                        >
                            {previewFrames.map((frame, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.previewFrame,
                                        selectedFrame === index && styles.previewFrameSelected
                                    ]}
                                    onPress={() => seekToFrame(index)}
                                >
                                    <Image source={{ uri: frame.thumbnailUrl }} style={styles.frameThumbnail} />
                                    <Text style={styles.frameTime}>
                                        {formatTime(frame.timestamp)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}

            {/* Contr├┤les de lecture */}
            {showControls && (
                <View style={styles.controlsContainer}>
                    <View style={styles.primaryControls}>
                        <TouchableOpacity style={styles.controlButton} onPress={() => seekTo(0)}>
                            <SafeIcon name="skip-back" size={24} color={modernColors.text} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
                            <SafeIcon
                                name={isPlaying ? "pause" : "play"}
                                size={32}
                                color="white"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.controlButton} onPress={() => seekTo(duration)}>
                            <SafeIcon name="skip-forward" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.secondaryControls}>
                        {/* Vitesse de lecture */}
                        <View style={styles.speedControl}>
                            <Text style={styles.speedLabel}>{playbackRate}x</Text>
                            <View style={styles.speedButtons}>
                                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
                                    <TouchableOpacity
                                        key={rate}
                                        style={[
                                            styles.speedButton,
                                            playbackRate === rate && styles.speedButtonActive
                                        ]}
                                        onPress={() => changePlaybackRate(rate)}
                                    >
                                        <Text style={[
                                            styles.speedButtonText,
                                            playbackRate === rate && styles.speedButtonTextActive
                                        ]}>
                                            {rate}x
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Volume */}
                        <TouchableOpacity
                            style={styles.volumeButton}
                            onPress={() => changeVolume(volume === 0 ? 1 : 0)}
                        >
                            <SafeIcon
                                name={volume === 0 ? "volume-x" : "volume-2"}
                                size={20}
                                color={modernColors.text}
                            />
                        </TouchableOpacity>

                        {/* Toggle timeline */}
                        <TouchableOpacity
                            style={styles.toggleButton}
                            onPress={() => setShowTimeline(!showTimeline)}
                        >
                            <SafeIcon
                                name={showTimeline ? "eye-off" : "eye"}
                                size={20}
                                color={modernColors.text}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: 'white',
    },
    generatingText: {
        fontSize: 14,
        color: '#888',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: 'white',
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    videoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    resetZoomButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 8,
    },
    timelineContainer: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 16,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        marginBottom: 8,
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    timelineMarker: {
        position: 'absolute',
        top: -8,
        alignItems: 'center',
    },
    markerDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'white',
    },
    markerLabel: {
        color: 'white',
        fontSize: 10,
        marginTop: 4,
    },
    timeDisplay: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    timeText: {
        color: 'white',
        fontSize: 14,
        fontFamily: 'monospace',
    },
    previewFramesContainer: {
        maxHeight: 80,
    },
    previewFramesContent: {
        gap: 8,
    },
    previewFrame: {
        alignItems: 'center',
        opacity: 0.7,
    },
    previewFrameSelected: {
        opacity: 1,
    },
    frameThumbnail: {
        width: 60,
        height: 40,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    frameThumbnailSelected: {
        borderColor: modernColors.primary,
    },
    frameTime: {
        color: 'white',
        fontSize: 10,
        marginTop: 4,
    },
    controlsContainer: {
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: 16,
    },
    primaryControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 32,
        marginBottom: 16,
    },
    controlButton: {
        padding: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    playButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 25,
        padding: 16,
    },
    secondaryControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    speedControl: {
        flex: 1,
    },
    speedLabel: {
        color: 'white',
        fontSize: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    speedButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    speedButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    speedButtonActive: {
        backgroundColor: modernColors.primary,
    },
    speedButtonText: {
        color: 'white',
        fontSize: 11,
    },
    speedButtonTextActive: {
        color: 'white',
        fontWeight: '600',
    },
    volumeButton: {
        padding: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    toggleButton: {
        padding: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
});

export default RealTimeVideoPreview;
