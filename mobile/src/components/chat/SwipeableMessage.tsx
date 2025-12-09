import React, { useRef } from 'react';
import {
    Animated,
    PanResponder,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
// ✅ expo-haptics installé - utiliser le helper existant
import { hapticPress, hapticSelect } from '../../utils/hapticFeedback';

interface SwipeableMessageProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void; // Répondre
    onSwipeRight?: () => void; // Supprimer (si message de l'utilisateur)
    canDelete?: boolean;
    disabled?: boolean;
}

const SWIPE_THRESHOLD = 80; // Distance minimale pour déclencher l'action
const SWIPE_VELOCITY_THRESHOLD = 0.5;

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    canDelete = false,
    disabled = false,
}) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !disabled,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 10;
            },
            onPanResponderGrant: () => {
                // Feedback haptique léger au début du swipe
                hapticPress();
            },
            onPanResponderMove: (_, gestureState) => {
                const { dx } = gestureState;
                translateX.setValue(dx);
                // Opacité des actions en fonction de la distance
                const actionOpacity = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
                opacity.setValue(actionOpacity);
            },
            onPanResponderRelease: (_, gestureState) => {
                const { dx, vx } = gestureState;
                const shouldTriggerAction =
                    Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;

                if (shouldTriggerAction) {
                    if (dx > 0 && onSwipeRight && canDelete) {
                        // Swipe droite → Supprimer
                        hapticPress();
                        onSwipeRight();
                    } else if (dx < 0 && onSwipeLeft) {
                        // Swipe gauche → Répondre
                        hapticSelect();
                        onSwipeLeft();
                    }
                }

                // Animation de retour
                Animated.parallel([
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 65,
                        friction: 8,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]).start();
            },
        })
    ).current;

    const getActionIcon = (direction: 'left' | 'right') => {
        if (direction === 'left') {
            return 'corner-up-right'; // Répondre
        } else {
            return 'trash'; // Supprimer
        }
    };

    const getActionColor = (direction: 'left' | 'right') => {
        if (direction === 'left') {
            return modernColors.primary;
        } else {
            return modernColors.error;
        }
    };

    return (
        <View style={styles.container}>
            {/* Actions en arrière-plan */}
            <View style={styles.actionsContainer}>
                {onSwipeLeft && (
                    <Animated.View
                        style={[
                            styles.actionLeft,
                            {
                                opacity: opacity.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    >
                        <SafeIcon
                            name={getActionIcon('left')}
                            size={24}
                            color={getActionColor('left')}
                        />
                    </Animated.View>
                )}
                {onSwipeRight && canDelete && (
                    <Animated.View
                        style={[
                            styles.actionRight,
                            {
                                opacity: opacity.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    >
                        <SafeIcon
                            name={getActionIcon('right')}
                            size={24}
                            color={getActionColor('right')}
                        />
                    </Animated.View>
                )}
            </View>

            {/* Message avec swipe */}
            <Animated.View
                style={[
                    styles.messageContainer,
                    {
                        transform: [{ translateX }],
                    },
                ]}
                {...panResponder.panHandlers}
            >
                {React.Children.map(children, (child, index) => {
                    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
                    // Éviter de rendre des valeurs primitives directement
                    if (typeof child === 'string' || typeof child === 'number') {
                        return <Text key={index}>{String(child)}</Text>;
                    }
                    if (child == null) {
                        return null;
                    }
                    return child;
                })}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    actionsContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    actionLeft: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: modernColors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionRight: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: modernColors.error + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageContainer: {
        backgroundColor: 'transparent',
    },
});

export default SwipeableMessage;

