/**
 * 🎨 Carte de livraison animée avec micro-interactions
 * Niveau Uber Eats / DoorDash
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, TouchableOpacity } from 'react-native';
import { DeliverySummary } from '../../types/delivery';
import ActiveDeliveryCard from './ActiveDeliveryCard';

interface AnimatedDeliveryCardProps {
    delivery: DeliverySummary;
    onPress: (deliveryId: string) => void;
    index?: number;
}

const AnimatedDeliveryCard: React.FC<AnimatedDeliveryCardProps> = React.memo(({
    delivery,
    onPress,
    index = 0,
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const pressAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Animation d'entrée avec délai selon l'index
        try {
            // ✅ CORRIGÉ: Utiliser Easing importé directement depuis react-native
            // Vérifier que Easing.bezier existe avant de l'utiliser
            const easingFunction = Easing && typeof Easing.bezier === 'function'
                ? Easing.bezier(0.42, 0, 0.58, 1)
                : undefined;

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    delay: index * 100,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    delay: index * 100,
                    easing: easingFunction, // ✅ CORRIGÉ: Utiliser Easing.bezier sécurisé
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 8,
                    delay: index * 100,
                    useNativeDriver: true,
                }),
            ]).start();
        } catch (error) {
            console.warn('[AnimatedDeliveryCard] Erreur animation:', error);
            // En cas d'erreur, définir directement les valeurs finales
            fadeAnim.setValue(1);
            slideAnim.setValue(0);
            scaleAnim.setValue(1);
        }
    }, [index, fadeAnim, slideAnim, scaleAnim]);

    const handlePressIn = () => {
        Animated.spring(pressAnim, {
            toValue: 0.96,
            tension: 300,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(pressAnim, {
            toValue: 1,
            tension: 300,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    const animatedStyle = {
        opacity: fadeAnim,
        transform: [
            { translateY: slideAnim },
            { scale: Animated.multiply(scaleAnim, pressAnim) },
        ],
    };

    return (
        <Animated.View style={animatedStyle as any}>
            <TouchableOpacity
                onPress={() => onPress(delivery.id)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
            >
                <ActiveDeliveryCard delivery={delivery} onPress={onPress} />
            </TouchableOpacity>
        </Animated.View>
    );
}, (prevProps, nextProps) => {
    // ✅ OPTIMISATION: Éviter les re-renders inutiles
    return (
        prevProps.delivery.id === nextProps.delivery.id &&
        prevProps.delivery.status === nextProps.delivery.status &&
        prevProps.index === nextProps.index
    );
});

AnimatedDeliveryCard.displayName = 'AnimatedDeliveryCard';

export default AnimatedDeliveryCard;


