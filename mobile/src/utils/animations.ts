/**
 * Utilitaires d'animations fluides
 */

import { Animated, Easing } from 'react-native';

/**
 * Animation de fade in
 */
export const fadeIn = (value: Animated.Value, duration: number = 300) => {
    return Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
    });
};

/**
 * Animation de fade out
 */
export const fadeOut = (value: Animated.Value, duration: number = 300) => {
    return Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
    });
};

/**
 * Animation de slide in depuis le bas
 */
export const slideInUp = (value: Animated.Value, duration: number = 300) => {
    return Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
    });
};

/**
 * Animation de slide out vers le bas
 */
export const slideOutDown = (value: Animated.Value, duration: number = 300) => {
    return Animated.timing(value, {
        toValue: 1000,
        duration,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
    });
};

/**
 * Animation de scale (pulse)
 */
export const pulse = (value: Animated.Value, min: number = 0.95, max: number = 1.05) => {
    return Animated.sequence([
        Animated.timing(value, {
            toValue: max,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }),
        Animated.timing(value, {
            toValue: min,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
        }),
    ]);
};

/**
 * Animation de bounce
 */
export const bounce = (value: Animated.Value, intensity: number = 10) => {
    return Animated.sequence([
        Animated.timing(value, {
            toValue: -intensity,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }),
        Animated.timing(value, {
            toValue: intensity,
            duration: 100,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
        }),
        Animated.timing(value, {
            toValue: 0,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }),
    ]);
};

/**
 * Animation stagger pour listes
 */
export const stagger = (
    values: Animated.Value[],
    delay: number = 50,
    duration: number = 300
) => {
    return Animated.stagger(
        delay,
        values.map((value) =>
            Animated.timing(value, {
                toValue: 1,
                duration,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        )
    );
};

/**
 * Animation de rotation
 */
export const rotate = (value: Animated.Value, duration: number = 1000) => {
    return Animated.loop(
        Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
        })
    );
};

/**
 * Interpolation pour rotation
 */
export const getRotateInterpolation = (value: Animated.Value) => {
    return value.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });
};

/**
 * Animation de shake
 */
export const shake = (value: Animated.Value, intensity: number = 10) => {
    return Animated.sequence([
        Animated.timing(value, {
            toValue: -intensity,
            duration: 50,
            useNativeDriver: true,
        }),
        Animated.timing(value, {
            toValue: intensity,
            duration: 50,
            useNativeDriver: true,
        }),
        Animated.timing(value, {
            toValue: -intensity,
            duration: 50,
            useNativeDriver: true,
        }),
        Animated.timing(value, {
            toValue: intensity,
            duration: 50,
            useNativeDriver: true,
        }),
        Animated.timing(value, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
        }),
    ]);
};
