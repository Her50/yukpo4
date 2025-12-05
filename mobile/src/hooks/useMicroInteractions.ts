/**
 * useMicroInteractions - Hook pour micro-interactions premium (scale, glow, haptic)
 * Réutilisable partout dans l'app
 */

import { useCallback } from 'react';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { hapticPress, hapticSelect } from '../utils/hapticFeedback';

interface UseMicroInteractionsOptions {
    scaleOnPress?: boolean;
    glowOnPress?: boolean;
    hapticFeedback?: 'none' | 'light' | 'medium' | 'heavy';
    springConfig?: {
        damping?: number;
        stiffness?: number;
    };
}

export const useMicroInteractions = (options: UseMicroInteractionsOptions = {}) => {
    const {
        scaleOnPress = true,
        glowOnPress = true,
        hapticFeedback = 'light',
        springConfig = { damping: 15, stiffness: 100 },
    } = options;

    const scale = useSharedValue(1);
    const glow = useSharedValue(0);
    const opacity = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        if (hapticFeedback !== 'none') {
            if (hapticFeedback === 'light') {
                hapticPress();
            } else if (hapticFeedback === 'medium') {
                hapticSelect();
            } else {
                hapticSelect(); // heavy
            }
        }

        if (scaleOnPress) {
            scale.value = withSpring(0.95, springConfig);
        }

        if (glowOnPress) {
            glow.value = withTiming(1, { duration: 150 });
        }

        opacity.value = withTiming(0.8, { duration: 100 });
    }, [scaleOnPress, glowOnPress, hapticFeedback, springConfig]);

    const handlePressOut = useCallback(() => {
        if (scaleOnPress) {
            scale.value = withSpring(1, springConfig);
        }

        if (glowOnPress) {
            glow.value = withTiming(0, { duration: 300 });
        }

        opacity.value = withTiming(1, { duration: 100 });
    }, [scaleOnPress, glowOnPress, springConfig]);

    return {
        scale,
        glow,
        opacity,
        handlePressIn,
        handlePressOut,
    };
};

