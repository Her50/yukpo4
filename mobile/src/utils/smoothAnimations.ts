import { Animated } from 'react-native';

/**
 * ✅ PHASE 3: Utilitaires pour animations fluides
 */

/**
 * Animation de transition fluide avec fade + slide + scale
 */
export const createSmoothTransition = (
    animValue: Animated.Value,
    config?: {
        duration?: number;
        useSpring?: boolean;
        tension?: number;
        friction?: number;
    }
) => {
    const {
        duration = 400,
        useSpring = true,
        tension = 50,
        friction = 8,
    } = config || {};

    animValue.setValue(0);

    if (useSpring) {
        return Animated.spring(animValue, {
            toValue: 1,
            tension,
            friction,
            useNativeDriver: true,
        });
    } else {
        return Animated.timing(animValue, {
            toValue: 1,
            duration,
            useNativeDriver: true,
        });
    }
};

/**
 * Style animé pour transitions entre écrans
 */
export const createTransitionStyle = (animValue: Animated.Value) => {
    return {
        opacity: animValue,
        transform: [
            {
                translateY: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                }),
            },
            {
                scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                }),
            },
        ],
    };
};

/**
 * Animation pulse pour éléments actifs
 */
export const createPulseAnimation = (animValue: Animated.Value) => {
    return Animated.loop(
        Animated.sequence([
            Animated.timing(animValue, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.timing(animValue, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true,
            }),
        ])
    );
};

/**
 * Animation de fade in
 */
export const fadeIn = (animValue: Animated.Value, duration = 300) => {
    animValue.setValue(0);
    return Animated.timing(animValue, {
        toValue: 1,
        duration,
        useNativeDriver: true,
    });
};

/**
 * Animation de fade out
 */
export const fadeOut = (animValue: Animated.Value, duration = 300) => {
    return Animated.timing(animValue, {
        toValue: 0,
        duration,
        useNativeDriver: true,
    });
};

/**
 * Animation stagger pour liste d'éléments
 */
export const staggerAnimation = (
    animValues: Animated.Value[],
    delay = 100,
    duration = 300
) => {
    return Animated.stagger(
        delay,
        animValues.map(anim =>
            Animated.timing(anim, {
                toValue: 1,
                duration,
                useNativeDriver: true,
            })
        )
    );
};

