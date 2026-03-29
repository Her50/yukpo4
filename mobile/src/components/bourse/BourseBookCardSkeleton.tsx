/**
 * Squelette pour la liste « livres à proximité » (Bourse du livre).
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const BourseBookCardSkeleton: React.FC = () => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
                Animated.timing(shimmerAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });

    return (
        <View style={styles.row}>
            <Animated.View style={[styles.cover, { opacity }]} />
            <View style={styles.body}>
                <Animated.View style={[styles.lineLg, { opacity }]} />
                <Animated.View style={[styles.lineMd, { opacity }]} />
                <Animated.View style={[styles.lineSm, { opacity }]} />
                <Animated.View style={[styles.lineSm, { opacity }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    cover: {
        width: 100,
        height: 140,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
    },
    body: {
        flex: 1,
        gap: 8,
        justifyContent: 'center',
    },
    lineLg: { height: 16, borderRadius: 6, backgroundColor: '#E5E7EB', width: '92%' },
    lineMd: { height: 12, borderRadius: 5, backgroundColor: '#E5E7EB', width: '55%' },
    lineSm: { height: 10, borderRadius: 4, backgroundColor: '#E5E7EB', width: '78%' },
});

export default BourseBookCardSkeleton;
