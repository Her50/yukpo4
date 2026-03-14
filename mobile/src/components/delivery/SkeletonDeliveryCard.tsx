/**
 * 💀 Skeleton loader pour les cartes de livraison
 * Design moderne inspiré de Shimmer effect (Uber Eats, Instagram)
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';

interface SkeletonDeliveryCardProps {
    style?: any;
}

const SkeletonDeliveryCard: React.FC<SkeletonDeliveryCardProps> = ({ style }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, []);

    const shimmerOpacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={[styles.container, style]}>
            {/* Header skeleton */}
            <View style={styles.header}>
                <Animated.View style={[styles.skeletonBox, styles.badge, { opacity: shimmerOpacity }]} />
                <Animated.View style={[styles.skeletonBox, styles.status, { opacity: shimmerOpacity }]} />
            </View>

            {/* Body skeleton */}
            <View style={styles.body}>
                <Animated.View style={[styles.skeletonBox, styles.line, { opacity: shimmerOpacity }]} />
                <Animated.View style={[styles.skeletonBox, styles.lineShort, { opacity: shimmerOpacity }]} />
                <Animated.View style={[styles.skeletonBox, styles.line, { opacity: shimmerOpacity }]} />
            </View>

            {/* Footer skeleton */}
            <View style={styles.footer}>
                <Animated.View style={[styles.skeletonBox, styles.footerLine, { opacity: shimmerOpacity }]} />
                <View style={styles.footerButtons}>
                    <Animated.View style={[styles.skeletonBox, styles.button, { opacity: shimmerOpacity }]} />
                    <Animated.View style={[styles.skeletonBox, styles.button, { opacity: shimmerOpacity }]} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        marginHorizontal: 2,
        ...modernStyles.shadowMedium,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    body: {
        gap: 12,
        marginBottom: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skeletonBox: {
        backgroundColor: modernColors.border,
        borderRadius: 8,
    },
    badge: {
        width: 120,
        height: 24,
    },
    status: {
        width: 100,
        height: 24,
    },
    line: {
        width: '100%',
        height: 16,
    },
    lineShort: {
        width: '70%',
        height: 16,
    },
    footerLine: {
        width: 100,
        height: 14,
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        width: 80,
        height: 36,
        borderRadius: 8,
    },
});

export default SkeletonDeliveryCard;


