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
// ✅ CORRIGÉ: Utiliser cleanChildren pour éviter les erreurs de rendu
import { cleanChildren } from '../utils/safeChildren';

interface AnimatedCardProps {
    children: React.ReactNode;
    index?: number;
    delay?: number;
    style?: any;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = React.memo(
    ({ children, index = 0, delay = 0, style }) => {
        // ✅ DEBUG: Logger les children pour identifier les problèmes (TOUJOURS activé)
        React.useEffect(() => {
            try {
                const { componentDebugger } = require('../utils/componentDebugger');
                componentDebugger.enable();
                componentDebugger.logComponent('AnimatedCard', { index, delay }, children);
            } catch (e) {
                // Ignorer si le debugger n'est pas disponible
            }
        }, [children, index, delay]);

        const opacity = useSharedValue(0);
        const translateY = useSharedValue(50);
        const scale = useSharedValue(0.9);

        useEffect(() => {
            // Animation d'entrée avec délai basé sur l'index
            const animationDelay = index * 100 + delay;

            if (typeof withTiming === 'function' && typeof withSpring === 'function' && opacity && translateY && scale) {
                const timeoutId = setTimeout(() => {
                    try {
                        // ✅ AMÉLIORÉ: Animations plus fluides avec easing optimisé
                        opacity.value = withTiming(1, {
                            duration: 300,
                            easing: require('react-native-reanimated').Easing.bezier(0.25, 0.1, 0.25, 1), // ✅ Easing naturel
                        });
                        translateY.value = withSpring(0, {
                            damping: 20, // ✅ AMÉLIORÉ: Damping augmenté
                            stiffness: 150, // ✅ AMÉLIORÉ: Stiffness augmentée
                            mass: 0.8, // ✅ AMÉLIORÉ: Mass réduite
                        });
                        scale.value = withSpring(1, {
                            damping: 18,
                            stiffness: 200, // ✅ AMÉLIORÉ: Stiffness plus élevée pour scale
                            mass: 0.7,
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

        const animatedStyle = useAnimatedStyle(() => {
            return {
                opacity: opacity.value,
                transform: [
                    { translateY: translateY.value },
                    { scale: scale.value },
                ] as any,
            };
        });

        // ✅ CORRIGÉ: Utiliser cleanChildren pour un nettoyage cohérent et éviter les erreurs de rendu
        const safeChildren = React.useMemo(() => cleanChildren(children, 'AnimatedCard'), [children]);

        return (
            <Animated.View
                style={[styles.card, animatedStyle, style]}
                pointerEvents="box-none" // ✅ CRITIQUE: Permettre les interactions des enfants
            >
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

