/**
 * Composant d'animation pour double-tap like (style TikTok)
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import SafeIcon from '../SafeIcon';

interface DoubleTapLikeProps {
    visible: boolean;
    onAnimationComplete?: () => void;
}

export const DoubleTapLike: React.FC<DoubleTapLikeProps> = ({
    visible,
    onAnimationComplete,
}) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (visible && typeof withSequence === 'function' && typeof withTiming === 'function' && typeof withSpring === 'function' && scale && opacity && rotation) {
            try {
                // Animation d'apparition avec rebond
                scale.value = withSequence(
                    withTiming(1.2, {
                        duration: 150,
                        easing: Easing.out(Easing.quad),
                    }),
                    withSpring(1, {
                        damping: 8,
                        stiffness: 200,
                    })
                );
                opacity.value = withSequence(
                    withTiming(1, { duration: 100 }),
                    withTiming(0, { duration: 400, delay: 200 })
                );
                rotation.value = withSequence(
                    withTiming(-15, { duration: 100 }),
                    withSpring(0, { damping: 8 })
                );

                // Callback après animation
                setTimeout(() => {
                    if (scale && opacity && rotation) {
                        scale.value = 0;
                        opacity.value = 0;
                        rotation.value = 0;
                    }
                    if (onAnimationComplete) {
                        onAnimationComplete();
                    }
                }, 700);
            } catch (error) {
                console.warn('[DoubleTapLike] Erreur animation:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]); // ✅ CORRIGÉ: Ne pas inclure les SharedValues

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: scale.value },
                { rotate: `${rotation.value}deg` },
            ],
            opacity: opacity.value,
        };
    });

    if (!visible) {
        return null;
    }

    return (
        <View style={styles.container} pointerEvents="none">
            <Animated.View style={[styles.heartContainer, animatedStyle]}>
                <SafeIcon name="heart" size={80} color="#F87171" />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    heartContainer: {
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

