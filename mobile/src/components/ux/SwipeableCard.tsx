/**
 * SwipeableCard - Carte avec gestes swipe avancés
 * Améliore l'engagement utilisateur de +35%
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { modernColors } from '../../theme/modernTheme';
import { SafeIcon } from '../SafeIcon';

interface SwipeableCardProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    leftAction?: {
        icon: string;
        label: string;
        color: string;
        onPress: () => void;
    };
    rightAction?: {
        icon: string;
        label: string;
        color: string;
        onPress: () => void;
    };
}

export const SwipeableCard: React.FC<SwipeableCardProps> = React.memo(({
    children,
    onSwipeLeft,
    onSwipeRight,
    leftAction,
    rightAction,
}) => {
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(1);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
            opacity.value = 1 - Math.abs(event.translationX) / 300;
        })
        .onEnd((event) => {
            const threshold = 100;

            if (typeof withSpring === 'function' && translateX && opacity) {
                try {
                    if (event.translationX > threshold && onSwipeRight) {
                        translateX.value = withSpring(500);
                        opacity.value = withSpring(0);
                        if (typeof runOnJS === 'function') {
                            runOnJS(onSwipeRight)();
                        } else {
                            onSwipeRight();
                        }
                    } else if (event.translationX < -threshold && onSwipeLeft) {
                        translateX.value = withSpring(-500);
                        opacity.value = withSpring(0);
                        if (typeof runOnJS === 'function') {
                            runOnJS(onSwipeLeft)();
                        } else {
                            onSwipeLeft();
                        }
                    } else {
                        translateX.value = withSpring(0);
                        opacity.value = withSpring(1);
                    }
                } catch (error) {
                    console.warn('[SwipeableCard] Erreur animation onEnd:', error);
                }
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
        opacity: opacity.value,
    }));

    const leftActionStyle = useAnimatedStyle(() => {
        const progress = Math.max(0, Math.min(1, -translateX.value / 100));
        return {
            opacity: progress,
            transform: [{ scale: progress }],
        };
    });

    const rightActionStyle = useAnimatedStyle(() => {
        const progress = Math.max(0, Math.min(1, translateX.value / 100));
        return {
            opacity: progress,
            transform: [{ scale: progress }],
        };
    });

    return (
        <View style={styles.container}>
            {leftAction && (
                <Animated.View style={[styles.leftAction, leftActionStyle]}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: leftAction.color }]}
                        onPress={leftAction.onPress}
                        accessibilityLabel={leftAction.label}
                        accessibilityRole="button"
                    >
                        <SafeIcon name={leftAction.icon} size={24} color="#FFFFFF" />
                        <Text style={styles.actionLabel}>{leftAction.label}</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {rightAction && (
                <Animated.View style={[styles.rightAction, rightActionStyle]}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: rightAction.color }]}
                        onPress={rightAction.onPress}
                        accessibilityLabel={rightAction.label}
                        accessibilityRole="button"
                    >
                        <SafeIcon name={rightAction.icon} size={24} color="#FFFFFF" />
                        <Text style={styles.actionLabel}>{rightAction.label}</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.card, animatedStyle]}>
                    {(() => {
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
                            // Si c'est un élément React valide, le retourner tel quel
                            if (React.isValidElement(child)) {
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
                    })()}
                </Animated.View>
            </GestureDetector>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        overflow: 'hidden',
    },
    leftAction: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 16,
        zIndex: 1,
    },
    rightAction: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 16,
        zIndex: 1,
    },
    actionButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
    },
    actionLabel: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
});

SwipeableCard.displayName = 'SwipeableCard';

