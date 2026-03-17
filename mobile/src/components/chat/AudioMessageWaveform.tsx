import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface AudioMessageWaveformProps {
    audioUrl: string;
    duration?: number; // Durée en secondes
    isFromClient?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVEFORM_WIDTH = SCREEN_WIDTH * 0.6; // 60% de la largeur d'écran
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const NUM_BARS = Math.floor(WAVEFORM_WIDTH / (BAR_WIDTH + BAR_GAP));

const AudioMessageWaveform: React.FC<AudioMessageWaveformProps> = ({
    audioUrl,
    duration = 0,
    isFromClient = false,
}) => {
        const { t } = useLanguageSafe();
const [isPlaying, setIsPlaying] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(0);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [waveformData, setWaveformData] = useState<number[]>([]);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const barAnims = useRef<Animated.Value[]>([]).current;

    // Générer des données de waveform simulées (en production, utiliser une lib comme wavesurfer.js)
    useEffect(() => {
        const generateWaveform = () => {
            const data: number[] = [];
            for (let i = 0; i < NUM_BARS; i++) {
                // Simuler des amplitudes aléatoires entre 0.2 et 1.0
                data.push(0.2 + Math.random() * 0.8);
            }
            setWaveformData(data);
            // Initialiser les animations pour chaque barre
            barAnims.length = 0;
            data.forEach(() => {
                barAnims.push(new Animated.Value(1));
            });
        };
        generateWaveform();
    }, []);

    // Animation des barres pendant la lecture
    useEffect(() => {
        if (isPlaying && waveformData.length > 0) {
            const animations = barAnims.map((anim, index) => {
                const delay = index * 50; // Délai progressif pour effet visuel
                return Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.timing(anim, {
                            toValue: waveformData[index],
                            duration: 200,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 1,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                    ])
                );
            });
            Animated.parallel(animations).start();
        } else {
            barAnims.forEach((anim) => {
                anim.setValue(1);
            });
        }
    }, [isPlaying, waveformData]);

    const loadAudio = async () => {
        try {
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: audioUrl },
                { shouldPlay: false }
            );

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    setCurrentPosition(status.positionMillis / 1000);
                    const progress = status.positionMillis / status.durationMillis;
                    progressAnim.setValue(progress);

                    if (status.didJustFinish) {
                        setIsPlaying(false);
                        setCurrentPosition(0);
                        progressAnim.setValue(0);
                    }
                }
            });

            setSound(newSound);
        } catch (error) {
            console.error('Erreur chargement audio:', error);
        }
    };

    useEffect(() => {
        if (audioUrl) {
            loadAudio();
        }
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [audioUrl]);

    const togglePlayPause = async () => {
        if (!sound) return;

        try {
            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
            setIsPlaying(!isPlaying);
        } catch (error) {
            console.error('Erreur lecture audio:', error);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getBarHeight = (amplitude: number, index: number) => {
        // Hauteur de base + amplitude
        const baseHeight = 20;
        const maxHeight = 60;
        return baseHeight + amplitude * (maxHeight - baseHeight);
    };

    return (
        <View
            style={[
                styles.container,
                isFromClient && styles.containerClient,
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.playButton,
                    isFromClient && styles.playButtonClient,
                ]}
                onPress={togglePlayPause}
            >
                <SafeIcon
                    name={isPlaying ? 'pause' : 'play'}
                    size={20}
                    color={isFromClient ? '#FFFFFF' : modernColors.primary}
                />
            </TouchableOpacity>

            <View style={styles.waveformContainer}>
                {/* Barre de progression */}
                <View style={styles.progressBarContainer}>
                    <Animated.View
                        style={[
                            styles.progressBar,
                            {
                                width: progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                }),
                            },
                            isFromClient && styles.progressBarClient,
                        ]}
                    />
                </View>

                {/* Waveform */}
                <View style={styles.waveform}>
                    {waveformData.map((amplitude, index) => {
                        const barHeight = getBarHeight(amplitude, index);
                        const isActive = isPlaying && index < (currentPosition / duration) * NUM_BARS;

                        return (
                            <Animated.View
                                key={index}
                                style={[
                                    styles.bar,
                                    {
                                        height: barAnims[index]?.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [barHeight * 0.3, barHeight],
                                        }) || barHeight,
                                        backgroundColor: isActive
                                            ? (isFromClient ? '#FFFFFF' : modernColors.primary)
                                            : (isFromClient ? 'rgba(255,255,255,0.5)' : modernColors.textSecondary),
                                    },
                                ]}
                            />
                        );
                    })}
                </View>
            </View>

            <View style={styles.timeContainer}>
                <Text
                    style={[
                        styles.timeText,
                        isFromClient && styles.timeTextClient,
                    ]}
                >
                    {formatTime(currentPosition)} / {formatTime(duration || 0)}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 16,
        minWidth: 200,
    },
    containerClient: {
        backgroundColor: modernColors.primary,
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonClient: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    waveformContainer: {
        flex: 1,
        gap: 4,
    },
    progressBarContainer: {
        height: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 1,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 1,
    },
    progressBarClient: {
        backgroundColor: '#FFFFFF',
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 40,
        gap: BAR_GAP,
    },
    bar: {
        width: BAR_WIDTH,
        borderRadius: BAR_WIDTH / 2,
        minHeight: 8,
    },
    timeContainer: {
        minWidth: 60,
    },
    timeText: {
        fontSize: 11,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    timeTextClient: {
        color: '#FFFFFF',
    },
});

export default AudioMessageWaveform;

