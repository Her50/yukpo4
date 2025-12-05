// ✅ Composant Skeleton Loading réutilisable
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';

interface SkeletonLoaderProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: any;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 4,
    style,
}) => {
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius,
                    opacity,
                },
                style,
            ]}
        />
    );
};

// Composant Skeleton Card pour les cartes
export const SkeletonCard: React.FC<{ style?: any }> = ({ style }) => (
    <View style={[styles.skeletonCard, style]}>
        <SkeletonLoader width="60%" height={24} borderRadius={8} />
        <SkeletonLoader width="100%" height={16} borderRadius={4} style={styles.skeletonMargin} />
        <SkeletonLoader width="80%" height={16} borderRadius={4} style={styles.skeletonMargin} />
        <View style={styles.skeletonRow}>
            <SkeletonLoader width="40%" height={16} borderRadius={4} />
            <SkeletonLoader width="40%" height={16} borderRadius={4} />
        </View>
    </View>
);

// Composant Skeleton List pour les listes
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <View>
        {Array.from({ length: count }).map((_, index) => (
            <SkeletonCard key={index} style={styles.skeletonListItem} />
        ))}
    </View>
);

// Composant Skeleton Stats pour les statistiques
export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <View style={styles.skeletonStatsContainer}>
        {Array.from({ length: count }).map((_, index) => (
            <View key={index} style={styles.skeletonStatCard}>
                <SkeletonLoader width="100%" height={16} borderRadius={4} />
                <SkeletonLoader width="60%" height={32} borderRadius={8} style={styles.skeletonMargin} />
                <SkeletonLoader width="80%" height={12} borderRadius={4} style={styles.skeletonMargin} />
            </View>
        ))}
    </View>
);

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: modernColors.textSecondary,
    },
    skeletonCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    skeletonMargin: {
        marginTop: 8,
    },
    skeletonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    skeletonListItem: {
        marginBottom: 16,
    },
    skeletonStatsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    skeletonStatCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
});

export default SkeletonLoader;
