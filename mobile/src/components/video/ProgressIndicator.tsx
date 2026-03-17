/**
 * Indicateurs de progression pour VideoFeed
 * Barre de progression, badge t('progressIndicator.xVideosRestantes'), etc.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface ProgressIndicatorProps {
    currentIndex: number;
    totalVideos: number;
    currentDuration?: number; // Durée actuelle en ms
    totalDuration?: number; // Durée totale en ms
    showRemainingCount?: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
    currentIndex,
    totalVideos,
    currentDuration = 0,
    totalDuration = 0,
    showRemainingCount = true,
}) => {
    const progress = totalDuration > 0 ? currentDuration / totalDuration : 0;
    const progressWidth = useSharedValue(progress);

    React.useEffect(() => {
    const { t } = useLanguageSafe();
        if (typeof withTiming === 'function' && progressWidth) {
            try {
                progressWidth.value = withTiming(progress, { duration: 200 });
            } catch (error) {
                console.warn('[ProgressIndicator] Erreur animation:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progress]); // ✅ CORRIGÉ: Ne pas inclure progressWidth (SharedValue est stable)

    const animatedProgressStyle = useAnimatedStyle(() => {
        return {
            width: `${progressWidth.value * 100}%`,
        };
    });

    const remainingCount = Math.max(0, totalVideos - currentIndex - 1);

    return (
        <View style={styles.container}>
            {/* Barre de progression vidéo */}
            {totalDuration > 0 && (
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <Animated.View style={[styles.progressBarFill, animatedProgressStyle]} />
                    </View>
                </View>
            )}

            {/* Indicateur de position dans le feed */}
            <View style={styles.feedIndicator}>
                {Array.from({ length: Math.min(totalVideos, 5) }).map((_, index) => {
                    const relativeIndex = currentIndex % 5;
                    const isActive = index === relativeIndex;
                    return (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                isActive && styles.dotActive,
                            ]}
                        />
                    );
                })}
            </View>

            {/* Badge t('progressIndicator.xVideosRestantes') */}
            {showRemainingCount && remainingCount > 0 && (
                <View style={styles.remainingBadge}>
                    <Text style={styles.remainingText}>
                        {remainingCount} {remainingCount === 1 ? t('progressIndicator.video') : t('progressIndicator.videos')} restante{remainingCount > 1 ? 's' : ''}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: 8,
        zIndex: 10,
    },
    progressBarContainer: {
        marginBottom: 8,
    },
    progressBarBackground: {
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    feedIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActive: {
        width: 20,
        backgroundColor: modernColors.primary,
    },
    remainingBadge: {
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginTop: 4,
    },
    remainingText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
    },
});

