/**
 * Squelette pour une carte paquet (BookPackagesScreen).
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const BookPackageCardSkeleton: React.FC = () => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
                Animated.timing(shimmerAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.72] });

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Animated.View style={[styles.badge, { opacity }]} />
                <Animated.View style={[styles.pill, { opacity }]} />
            </View>
            <Animated.View style={[styles.line, { opacity }]} />
            <Animated.View style={[styles.lineShort, { opacity }]} />
            <Animated.View style={[styles.line, { opacity }]} />
            <Animated.View style={[styles.btn, { opacity }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    badge: {
        width: 120,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
    },
    pill: {
        width: 88,
        height: 26,
        borderRadius: 12,
        backgroundColor: '#E5E7EB',
    },
    line: {
        height: 12,
        borderRadius: 4,
        backgroundColor: '#E5E7EB',
        marginBottom: 8,
        width: '100%',
    },
    lineShort: {
        height: 12,
        borderRadius: 4,
        backgroundColor: '#E5E7EB',
        marginBottom: 8,
        width: '66%',
    },
    btn: {
        marginTop: 8,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#E5E7EB',
    },
});

export default BookPackageCardSkeleton;
