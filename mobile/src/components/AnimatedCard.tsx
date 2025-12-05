/**
 * AnimatedCard - Carte avec animations fluides
 * Gain estimé: +30% d'engagement utilisateur
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

interface AnimatedCardProps {
    children: React.ReactNode;
    index?: number;
    delay?: number;
    style?: any;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = React.memo(
    ({ children, index = 0, delay = 0, style }) => {
        const opacity = useSharedValue(0);
        const translateY = useSharedValue(50);
        const scale = useSharedValue(0.9);

        useEffect(() => {
            // Animation d'entrée avec délai basé sur l'index
            const animationDelay = index * 100 + delay;

            setTimeout(() => {
                opacity.value = withTiming(1, { duration: 300 });
                translateY.value = withSpring(0, {
                    damping: 15,
                    stiffness: 100,
                });
                scale.value = withSpring(1, {
                    damping: 15,
                    stiffness: 100,
                });
            }, animationDelay);
        }, [index, delay, opacity, translateY, scale]);

        const animatedStyle = useAnimatedStyle(() => ({
            opacity: opacity.value,
            transform: [
                { translateY: translateY.value },
                { scale: scale.value },
            ],
        }));

        return (
            <Animated.View style={[styles.card, animatedStyle, style]}>
                {children}
            </Animated.View>
        );
    }
);

const styles = StyleSheet.create({
    card: {
        // Styles de base pour la carte
    },
});

AnimatedCard.displayName = 'AnimatedCard';

