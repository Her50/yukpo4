/**
 * 🎨 Carte de livraison animée avec micro-interactions
 * Niveau Uber Eats / DoorDash
 */

import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import { DeliverySummary } from '../../types/delivery';
import ActiveDeliveryCard from './ActiveDeliveryCard';

interface AnimatedDeliveryCardProps {
    delivery: DeliverySummary;
    onPress: (deliveryId: string) => void;
    index?: number;
}

const AnimatedDeliveryCard: React.FC<AnimatedDeliveryCardProps> = ({
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
                easing: Animated.Easing.out(Animated.Easing.cubic),
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
    }, [index]);

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
        <Animated.View style={animatedStyle}>
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
};

export default AnimatedDeliveryCard;


