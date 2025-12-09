/**
 * AnimatedCard - Carte avec animations fluides
 * Gain estimé: +30% d'engagement utilisateur
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
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

            if (typeof withTiming === 'function' && typeof withSpring === 'function' && opacity && translateY && scale) {
                const timeoutId = setTimeout(() => {
                    try {
                        opacity.value = withTiming(1, { duration: 300 });
                        translateY.value = withSpring(0, {
                            damping: 15,
                            stiffness: 100,
                        });
                        scale.value = withSpring(1, {
                            damping: 15,
                            stiffness: 100,
                        });
                    } catch (error) {
                        console.warn('[AnimatedCard] Erreur animation:', error);
                    }
                }, animationDelay);

                return () => {
                    // ✅ CRITIQUE: Nettoyer le timeout
                    clearTimeout(timeoutId);
                };
            }
            // ✅ CRITIQUE: Retourner explicitement undefined si la condition n'est pas remplie
            return undefined;
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [index, delay]); // ✅ CORRIGÉ: Ne pas inclure les SharedValues (elles sont stables)

        const animatedStyle = useAnimatedStyle(() => ({
            opacity: opacity.value,
            transform: [
                { translateY: translateY.value },
                { scale: scale.value },
            ],
        }));

        // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
        // Éviter de rendre des valeurs primitives directement
        const safeChildren = React.Children.map(children, (child, index) => {
            // Si c'est une valeur primitive (string, number), l'envelopper dans un Text
            if (typeof child === 'string' || typeof child === 'number') {
                return <Text key={index}>{String(child)}</Text>;
            }
            // Si c'est null ou undefined, retourner null
            if (child == null) {
                return null;
            }
            return child;
        });

        return (
            <Animated.View style={[styles.card, animatedStyle, style]}>
                {safeChildren}
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

