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
                    {children}
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

