/**
 * Hook useScrollY - Pour header collapsible
 * Gain estimé: +20% de contenu visible
 */

import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Hook pour gérer le scroll Y avec animations
 * @returns scrollY et fonction onScroll pour FlatList/ScrollView
 */
export const useScrollY = () => {
    const scrollY = useRef(new Animated.Value(0)).current;

    const onScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false } // Nécessaire pour les animations de hauteur
    );

    return { scrollY, onScroll };
};

