/**
 * ModalSwipeable - Modal avec swipe-to-dismiss (style Instagram/TikTok)
 */

import React, { useRef } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100; // Distance minimale pour fermer
const VELOCITY_THRESHOLD = 500; // Vitesse minimale pour fermer

interface ModalSwipeableProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    swipeDirection?: 'down' | 'up' | 'left' | 'right';
}

const ModalSwipeable: React.FC<ModalSwipeableProps> = ({
    visible,
    onClose,
    children,
    swipeDirection = 'down',
}) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            // Animation d'entrée
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Réinitialiser pour la prochaine ouverture
            translateY.setValue(0);
            opacity.setValue(0);
        }
    }, [visible, translateY, opacity]);

    const panGesture = React.useMemo(() =>
        Gesture.Pan()
            .onUpdate((event) => {
                if (swipeDirection === 'down' && event.translationY > 0) {
                    translateY.setValue(event.translationY);
                    // Réduire l'opacité pendant le swipe
                    const opacityValue = Math.max(0, 1 - Math.abs(event.translationY) / SCREEN_HEIGHT);
                    opacity.setValue(opacityValue);
                } else if (swipeDirection === 'up' && event.translationY < 0) {
                    translateY.setValue(event.translationY);
                    const opacityValue = Math.max(0, 1 - Math.abs(event.translationY) / SCREEN_HEIGHT);
                    opacity.setValue(opacityValue);
                }
            })
            .onEnd((event) => {
                const shouldClose =
                    (swipeDirection === 'down' && event.translationY > SWIPE_THRESHOLD) ||
                    (swipeDirection === 'up' && event.translationY < -SWIPE_THRESHOLD) ||
                    (swipeDirection === 'down' && event.velocityY > VELOCITY_THRESHOLD) ||
                    (swipeDirection === 'up' && event.velocityY < -VELOCITY_THRESHOLD);

                if (shouldClose) {
                    // Animation de sortie
                    Animated.parallel([
                        Animated.timing(translateY, {
                            toValue: swipeDirection === 'down' ? SCREEN_HEIGHT : -SCREEN_HEIGHT,
                            duration: 250,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 250,
                            useNativeDriver: true,
                        }),
                    ]).start(() => {
                        runOnJS(onClose)();
                    });
                } else {
                    // Retour à la position initiale
                    Animated.parallel([
                        Animated.spring(translateY, {
                            toValue: 0,
                            tension: 50,
                            friction: 8,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 1,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                    ]).start();
                }
            }),
        [swipeDirection, translateY, opacity, onClose]
    );

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <Animated.View
                style={[
                    styles.overlay,
                    {
                        opacity,
                    },
                ]}
            >
                <GestureDetector gesture={panGesture}>
                    <Animated.View
                        style={[
                            styles.content,
                            {
                                transform: [{ translateY }],
                            },
                        ]}
                    >
                        {/* Indicateur de swipe */}
                        <View style={styles.swipeIndicator} />
                        {children}
                    </Animated.View>
                </GestureDetector>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    content: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        marginTop: 'auto',
    },
    swipeIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#D1D5DB',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 8,
    },
});

export default ModalSwipeable;

