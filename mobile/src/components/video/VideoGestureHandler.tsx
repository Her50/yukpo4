/**
 * Composant de gestion des gestes pour VideoFeedScreen
 * Implémente swipe vertical, double-tap, swipe left/right
 */

import React, { useCallback, useRef } from 'react';
import { Dimensions, Text } from 'react-native';
import { PanGestureHandler, State, TapGestureHandler } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { triggerHaptic } from '../../utils/hapticFeedback';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 50; // Minimum distance pour déclencher swipe
const DOUBLE_TAP_DELAY = 300; // Délai max entre deux taps

interface VideoGestureHandlerProps {
    children: React.ReactNode;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onDoubleTap?: () => void;
    onSingleTap?: () => void;
    enabled?: boolean;
}

export const VideoGestureHandler: React.FC<VideoGestureHandlerProps> = ({
    children,
    onSwipeUp,
    onSwipeDown,
    onSwipeLeft,
    onSwipeRight,
    onDoubleTap,
    onSingleTap,
    enabled = true,
}) => {
    const translateY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const lastTapRef = useRef<number>(0);
    const doubleTapRef = useRef<TapGestureHandler>(null);

    // Handler pour swipe vertical (navigation vidéos)
    const panGestureHandler = useAnimatedGestureHandler({
        onStart: (_, ctx: any) => {
            ctx.startY = translateY.value;
            ctx.startX = translateX.value;
        },
        onActive: (event, ctx: any) => {
            if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
                // Swipe vertical
                translateY.value = ctx.startY + event.translationY;
            } else {
                // Swipe horizontal
                translateX.value = ctx.startX + event.translationX;
            }
        },
        onEnd: (event) => {
            const absY = Math.abs(event.translationY);
            const absX = Math.abs(event.translationX);

            if (absY > absX && absY > SWIPE_THRESHOLD) {
                // Swipe vertical détecté
                if (event.translationY < 0) {
                    // Swipe up (vidéo suivante)
                    triggerHaptic('light');
                    if (onSwipeUp) {
                        runOnJS(onSwipeUp)();
                    }
                } else {
                    // Swipe down (vidéo précédente)
                    triggerHaptic('light');
                    if (onSwipeDown) {
                        runOnJS(onSwipeDown)();
                    }
                }
            } else if (absX > absY && absX > SWIPE_THRESHOLD) {
                // Swipe horizontal détecté
                if (event.translationX < 0) {
                    // Swipe left (like rapide)
                    triggerHaptic('medium');
                    if (onSwipeLeft) {
                        runOnJS(onSwipeLeft)();
                    }
                } else {
                    // Swipe right (save rapide)
                    triggerHaptic('medium');
                    if (onSwipeRight) {
                        runOnJS(onSwipeRight)();
                    }
                }
            }

            // Reset position
            // ✅ SÉCURITÉ: Vérifier que withSpring est disponible
            if (typeof withSpring === 'function') {
                try {
                    translateY.value = withSpring(0);
                    translateX.value = withSpring(0);
                } catch (error) {
                    console.warn('[VideoGestureHandler] Erreur animation reset:', error);
                    // Fallback: reset direct sans animation
                    translateY.value = 0;
                    translateX.value = 0;
                }
            } else {
                // Fallback: reset direct sans animation
                translateY.value = 0;
                translateX.value = 0;
            }
        },
    });

    // Handler pour double-tap (like)
    const handleDoubleTap = useCallback(() => {
        const now = Date.now();
        const timeDiff = now - lastTapRef.current;

        if (timeDiff < DOUBLE_TAP_DELAY) {
            // Double tap détecté
            triggerHaptic('medium');
            if (onDoubleTap) {
                onDoubleTap();
            }
            lastTapRef.current = 0;
        } else {
            // Premier tap
            lastTapRef.current = now;
            setTimeout(() => {
                if (lastTapRef.current === now) {
                    // Single tap (pas de double tap)
                    if (onSingleTap) {
                        onSingleTap();
                    }
                }
            }, DOUBLE_TAP_DELAY);
        }
    }, [onDoubleTap, onSingleTap]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: translateY.value },
                { translateX: translateX.value },
            ],
        };
    });

    if (!enabled) {
        // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
        const safeChildren = React.Children.map(children, (child, index) => {
            if (typeof child === 'string' || typeof child === 'number') {
                return <Text key={index}>{String(child)}</Text>;
            }
            if (child == null) {
                return null;
            }
            return child;
        });
        return <>{safeChildren}</>;
    }

    return (
        <PanGestureHandler onGestureEvent={panGestureHandler} enabled={enabled}>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>
                <TapGestureHandler
                    ref={doubleTapRef}
                    onHandlerStateChange={({ nativeEvent }) => {
                        if (nativeEvent.state === State.END) {
                            handleDoubleTap();
                        }
                    }}
                    numberOfTaps={2}
                >
                    <Animated.View style={{ flex: 1 }}>
                        {children}
                    </Animated.View>
                </TapGestureHandler>
            </Animated.View>
        </PanGestureHandler>
    );
};

