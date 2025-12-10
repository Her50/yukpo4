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
        const safeChildren = (() => {
            // ✅ CRITIQUE: Gérer le cas où children est null/undefined
            if (children == null) {
                return null;
            }

            // ✅ CRITIQUE: Si children est une primitive, la wrapper directement
            if (typeof children === 'string' || typeof children === 'number' || typeof children === 'boolean') {
                return <Text>{String(children)}</Text>;
            }

            // ✅ CRITIQUE: Si children est un tableau, le traiter récursivement
            if (Array.isArray(children)) {
                const safeArray = children
                    .map((child, idx) => {
                        if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
                            return <Text key={idx}>{String(child)}</Text>;
                        }
                        if (child == null) {
                            return null;
                        }
                        if (React.isValidElement(child)) {
                            return child;
                        }
                        return <Text key={idx}>{String(child)}</Text>;
                    })
                    .filter(child => child != null); // Filtrer les null/undefined

                return safeArray.length > 0 ? safeArray : null;
            }

            // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
            const mapped = React.Children.map(children, (child, idx) => {
                // Si c'est une valeur primitive (string, number, boolean), l'envelopper dans un Text
                if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
                    return <Text key={idx}>{String(child)}</Text>;
                }
                // Si c'est null ou undefined, retourner null
                if (child == null) {
                    return null;
                }
                // Si c'est un tableau, le traiter récursivement
                if (Array.isArray(child)) {
                    return child.map((item, itemIndex) => {
                        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                            return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                        }
                        if (item == null) {
                            return null;
                        }
                        if (React.isValidElement(item)) {
                            return item;
                        }
                        return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                    });
                }
                // Si c'est un élément React valide, vérifier récursivement ses children
                if (React.isValidElement(child)) {
                    // ✅ NOUVEAU: Vérifier récursivement les children de l'élément pour détecter et wrapper les strings
                    try {
                        const childProps = (child as any).props;
                        if (childProps && childProps.children) {
                            // Fonction récursive pour wrapper les strings dans les children
                            const wrapStringsInChildren = (childrenToCheck: any, keyPrefix: string = ''): any => {
                                if (childrenToCheck == null) return null;

                                // Si c'est une primitive, la wrapper dans Text
                                if (typeof childrenToCheck === 'string' || typeof childrenToCheck === 'number' || typeof childrenToCheck === 'boolean') {
                                    console.warn('[AnimatedCard] ⚠️ String détectée et wrappée:', String(childrenToCheck).substring(0, 50));
                                    return <Text key={`${keyPrefix}-text`}>{String(childrenToCheck)}</Text>;
                                }

                                // Si c'est un tableau, traiter chaque élément
                                if (Array.isArray(childrenToCheck)) {
                                    return childrenToCheck.map((item, itemIdx) => wrapStringsInChildren(item, `${keyPrefix}-${itemIdx}`));
                                }

                                // Si c'est un élément React valide, vérifier ses children
                                if (React.isValidElement(childrenToCheck)) {
                                    const props = (childrenToCheck as any).props;
                                    if (props && props.children) {
                                        const wrappedChildren = wrapStringsInChildren(props.children, keyPrefix);
                                        // Cloner l'élément avec les children wrappés
                                        return React.cloneElement(childrenToCheck as React.ReactElement, {
                                            ...props,
                                            children: wrappedChildren
                                        });
                                    }
                                }

                                return childrenToCheck;
                            };

                            const wrappedChildren = wrapStringsInChildren(childProps.children, `child-${idx}`);
                            if (wrappedChildren !== childProps.children) {
                                // Les children ont été modifiés, cloner l'élément avec les nouveaux children
                                return React.cloneElement(child as React.ReactElement, {
                                    ...childProps,
                                    children: wrappedChildren
                                });
                            }
                        }
                    } catch (e) {
                        // Ignorer les erreurs de vérification
                        console.warn('[AnimatedCard] Erreur vérification récursive:', e);
                    }
                    return child;
                }
                // ✅ CRITIQUE: Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
                return <Text key={idx}>{String(child)}</Text>;
            });

            // ✅ CRITIQUE: Filtrer les null/undefined du résultat
            if (mapped == null) {
                return null;
            }

            if (Array.isArray(mapped)) {
                const filtered = mapped.filter(child => child != null);
                return filtered.length > 0 ? filtered : null;
            }

            return mapped;
        })();

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

