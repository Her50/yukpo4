/**
 * Composant de lecteur vidéo immersif avec contrôles adaptatifs
 * Mode plein écran, contrôles qui apparaissent/disparaissent
 */

import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import SafeIcon from '../SafeIcon';

interface ImmersiveVideoPlayerProps {
    source: { uri: string };
    isActive: boolean;
    isPaused: boolean;
    onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
    onTogglePause?: () => void;
    onLike?: () => void;
    onComment?: () => void;
    onShare?: () => void;
    onSkip?: () => void;
    showControls?: boolean;
    autoHideControls?: boolean;
    autoHideDelay?: number;
}

export const ImmersiveVideoPlayer: React.FC<ImmersiveVideoPlayerProps> = ({
    source,
    isActive,
    isPaused,
    onPlaybackStatusUpdate,
    onTogglePause,
    onLike,
    onComment,
    onShare,
    onSkip,
    showControls = true,
    autoHideControls = true,
    autoHideDelay = 3000,
}) => {
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const controlsOpacity = useSharedValue(1);
    const videoRef = React.useRef<Video>(null);
    const hideControlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Masquer la barre de statut en mode plein écran
    useEffect(() => {
        if (isFullscreen && isActive) {
            StatusBar.setHidden(true, 'fade');
        } else {
            StatusBar.setHidden(false, 'fade');
        }
        return () => {
            StatusBar.setHidden(false, 'fade');
        };
    }, [isFullscreen, isActive]);

    // Auto-hide des contrôles
    useEffect(() => {
        if (!autoHideControls || !showControls) {
            // ✅ CRITIQUE: Retourner explicitement undefined
            return undefined;
        }

        if (controlsVisible) {
            hideControlsTimeoutRef.current = setTimeout(() => {
                setControlsVisible(false);
                // ✅ SÉCURITÉ: Vérifier que withTiming est disponible
                if (typeof withTiming === 'function') {
                    try {
                        controlsOpacity.value = withTiming(0, { duration: 300 });
                    } catch (error) {
                        console.warn('[ImmersiveVideoPlayer] Erreur animation hide controls:', error);
                    }
                }
            }, autoHideDelay);
        }

        return () => {
            if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
            }
        };
    }, [controlsVisible, autoHideControls, autoHideDelay, showControls]);

    const handleTap = useCallback(() => {
        if (!showControls) return;

        if (controlsVisible) {
            // Masquer immédiatement
            setControlsVisible(false);
            // ✅ SÉCURITÉ: Vérifier que withTiming est disponible
            if (typeof withTiming === 'function') {
                try {
                    controlsOpacity.value = withTiming(0, { duration: 200 });
                } catch (error) {
                    console.warn('[ImmersiveVideoPlayer] Erreur animation hide:', error);
                }
            }
        } else {
            // Afficher avec animation
            setControlsVisible(true);
            // ✅ SÉCURITÉ: Vérifier que withSpring est disponible
            if (typeof withSpring === 'function') {
                try {
                    controlsOpacity.value = withSpring(1, { damping: 15 });
                } catch (error) {
                    console.warn('[ImmersiveVideoPlayer] Erreur animation show:', error);
                }
            }
        }
    }, [controlsVisible, showControls]);

    const animatedControlsStyle = useAnimatedStyle(() => {
        return {
            opacity: controlsOpacity.value,
        };
    });

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.videoContainer}
                activeOpacity={1}
                onPress={handleTap}
            >
                <Video
                    ref={videoRef}
                    source={source}
                    style={styles.video}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={isActive && !isPaused}
                    isLooping={false}
                    useNativeControls={false}
                    isMuted={false}
                    onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                />

                {/* Overlay avec gradient */}
                <View style={styles.gradientOverlay}>
                    <View style={styles.topGradient} />
                    <View style={styles.bottomGradient} />
                </View>

                {/* Contrôles adaptatifs */}
                {showControls && (
                    <Animated.View style={[styles.controls, animatedControlsStyle]} pointerEvents="box-none">
                        {/* Contrôles centraux (pause/play) */}
                        <View style={styles.centerControls}>
                            <TouchableOpacity
                                style={styles.playButton}
                                onPress={onTogglePause}
                                activeOpacity={0.8}
                            >
                                <SafeIcon
                                    name={isPaused ? 'play' : 'pause'}
                                    size={48}
                                    color="#FFF"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Contrôles latéraux */}
                        <View style={styles.sideControls}>
                            <TouchableOpacity
                                style={styles.sideButton}
                                onPress={onLike}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="heart" size={24} color="#FFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.sideButton}
                                onPress={onComment}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="message-circle" size={24} color="#FFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.sideButton}
                                onPress={onShare}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="share" size={24} color="#FFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.sideButton}
                                onPress={onSkip}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="chevron-down" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
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
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 200,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 300,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    controls: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerControls: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sideControls: {
        position: 'absolute',
        right: 16,
        bottom: 100,
        gap: 24,
    },
    sideButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

