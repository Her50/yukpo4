/**
 * Composant vidéo avec support effets et filtres
 * Wrapper autour de OptimizedVideo avec application de filtres
 */

import { Video, VideoProps } from 'expo-av';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import {
    StickerConfig,
    VideoEffectConfig,
    videoEffectsService,
} from '../../services/videoEffectsService';
import OptimizedVideo from './OptimizedVideo';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface VideoWithEffectsProps extends VideoProps {
    originalUri: string;
    contentId: string;
    isActive: boolean;
    effectConfig?: VideoEffectConfig;
    onPlaybackStatusUpdate?: (status: any) => Promise<void>;
}

export const VideoWithEffects = forwardRef<Video, VideoWithEffectsProps>(
    ({ originalUri, contentId, isActive, effectConfig, style, onPlaybackStatusUpdate, ...rest }, ref) => {
            const { t } = useLanguageSafe();
const [currentTime, setCurrentTime] = useState(0);

        // Appliquer le style de filtre si configuré
        const filterStyle = useMemo(() => {
            if (!effectConfig || effectConfig.filter === 'none') {
                return {};
            }
            return videoEffectsService.getFilterStyle(
                effectConfig.filter,
                effectConfig.intensity || 100
            );
        }, [effectConfig]);

        // Combiner les styles
        const combinedStyle = useMemo(() => {
            return [style, filterStyle];
        }, [style, filterStyle]);

        // Wrapper pour tracker le temps de lecture
        const handlePlaybackStatusUpdate = async (status: any) => {
            if (status.isLoaded && status.positionMillis) {
                setCurrentTime(status.positionMillis / 1000);
            }
            if (onPlaybackStatusUpdate) {
                await onPlaybackStatusUpdate(status);
            }
        };

        return (
            <View style={styles.container}>
                <OptimizedVideo
                    ref={ref}
                    originalUri={originalUri}
                    contentId={contentId}
                    isActive={isActive}
                    style={combinedStyle}
                    onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                    {...rest}
                />
                {/* ✅ IMPLÉMENTÉ: Stickers overlay avec rendu temps réel */}
                {effectConfig?.stickers && effectConfig.stickers.length > 0 && (
                    <View style={styles.stickersContainer} pointerEvents="none">
                        {effectConfig.stickers.map((sticker, index) => (
                            <StickerRenderer
                                key={`sticker-${sticker.id}-${index}`}
                                sticker={sticker}
                                currentTime={currentTime}
                            />
                        ))}
                    </View>
                )}
            </View>
        );
    }
);

/**
 * Composant de rendu de sticker individuel
 */
const StickerRenderer: React.FC<{ sticker: StickerConfig; currentTime?: number }> = ({ sticker, currentTime = 0 }) => {
    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);

    // Animation pour stickers animés
    useEffect(() => {
        if (sticker.type === 'animated' && typeof withRepeat === 'function' && typeof withTiming === 'function' && scale) {
            try {
                scale.value = withRepeat(
                    withTiming(1.1, { duration: 1000 }),
                    -1,
                    true
                );
            } catch (error) {
                console.warn('[VideoWithEffects] Erreur animation sticker:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sticker.type]); // ✅ CORRIGÉ: Ne pas inclure scale (SharedValue est stable)

    // Vérifier si le sticker doit être visible
    const isVisible =
        currentTime >= sticker.startTime &&
        currentTime <= sticker.startTime + sticker.duration;

    useEffect(() => {
        if (typeof withTiming === 'function' && opacity) {
            try {
                if (!isVisible) {
                    opacity.value = withTiming(0, { duration: 200 });
                } else {
                    opacity.value = withTiming(1, { duration: 200 });
                }
            } catch (error) {
                console.warn('[VideoWithEffects] Erreur animation visibility:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible]); // ✅ CORRIGÉ: Ne pas inclure opacity (SharedValue est stable)

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    if (!isVisible) {
        return null;
    }

    const positionStyle = {
        position: 'absolute' as const,
        left: `${sticker.position.x}%`,
        top: `${sticker.position.y}%`,
        width: sticker.size,
        height: sticker.size,
        transform: [{ rotate: `${sticker.rotation || 0}deg` }],
    };

    return (
        <Animated.View style={[positionStyle as any, animatedStyle]}>
            {sticker.type === 'emoji' && sticker.emoji ? (
                <Text style={styles.emojiSticker}>{sticker.emoji}</Text>
            ) : sticker.type === 'image' && sticker.url ? (
                <Image
                    source={{ uri: sticker.url }}
                    style={styles.imageSticker}
                    resizeMode="contain"
                />
            ) : sticker.type === 'animated' && sticker.url ? (
                <Image
                    source={{ uri: sticker.url }}
                    style={styles.animatedSticker}
                    resizeMode="contain"
                />
            ) : null}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    stickersContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    emojiSticker: {
        fontSize: 40,
        textAlign: 'center',
    },
    imageSticker: {
        width: '100%',
        height: '100%',
    },
    animatedSticker: {
        width: '100%',
        height: '100%',
    },
});

