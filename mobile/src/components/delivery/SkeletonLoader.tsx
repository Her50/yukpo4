import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';

interface SkeletonLoaderProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: any;
    variant?: 'rect' | 'circle' | 'text';
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style,
    variant = 'rect',
}) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, [shimmerAnim]);

    const shimmerOpacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const isCircle = variant === 'circle';
    const finalBorderRadius = isCircle ? height / 2 : borderRadius;

    return (
        <View
            style={[
                styles.container,
                {
                    width,
                    height,
                    borderRadius: finalBorderRadius,
                },
                style,
            ]}
        >
            <Animated.View
                style={[
                    styles.shimmer,
                    {
                        opacity: shimmerOpacity,
                        borderRadius: finalBorderRadius,
                    },
                ]}
            />
        </View>
    );
};

export const SkeletonCard: React.FC<{ style?: any }> = ({ style }) => (
    <View style={[styles.card, style]}>
        <SkeletonLoader height={24} width="60%" style={styles.marginBottom} />
        <SkeletonLoader height={16} width="100%" style={styles.marginBottom} />
        <SkeletonLoader height={16} width="80%" />
    </View>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <View style={styles.list}>
        {Array.from({ length: count }).map((_, index) => (
            <SkeletonCard key={index} style={styles.listItem} />
        ))}
    </View>
);

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.surfaceVariant,
        overflow: 'hidden',
        position: 'relative',
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: modernColors.surface,
    },
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    marginBottom: {
        marginBottom: 8,
    },
    list: {
        gap: 12,
    },
    listItem: {
        marginBottom: 0,
    },
});

export default SkeletonLoader;

