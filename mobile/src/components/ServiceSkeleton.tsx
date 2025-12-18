// ✅ NOUVEAU: Composant skeleton loader pour les services spécialisés
// Utilisé pendant le chargement pour améliorer l'UX

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';

interface ServiceSkeletonProps {
    mode?: 'card' | 'list';
}

const ServiceSkeleton: React.FC<ServiceSkeletonProps> = ({ mode = 'card' }) => {
    const shimmerAnimation = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnimation, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnimation, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, [shimmerAnimation]);

    const opacity = shimmerAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    if (mode === 'list') {
        return (
            <NativeCard style={styles.listSkeleton}>
                <View style={styles.listContent}>
                    <Animated.View
                        style={[
                            styles.skeletonCircle,
                            { opacity },
                        ]}
                    />
                    <View style={styles.listTextContainer}>
                        <Animated.View
                            style={[
                                styles.skeletonText,
                                styles.skeletonTitle,
                                { opacity },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.skeletonText,
                                styles.skeletonSubtitle,
                                { opacity },
                            ]}
                        />
                    </View>
                    <Animated.View
                        style={[
                            styles.skeletonCircle,
                            { width: 24, height: 24, opacity },
                        ]}
                    />
                </View>
            </NativeCard>
        );
    }

    return (
        <NativeCard style={styles.cardSkeleton}>
            <View style={styles.cardHeader}>
                <Animated.View
                    style={[
                        styles.skeletonCircle,
                        { opacity },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.skeletonCircle,
                        { width: 24, height: 24, opacity },
                    ]}
                />
            </View>
            <Animated.View
                style={[
                    styles.skeletonText,
                    styles.skeletonTitle,
                    { opacity },
                ]}
            />
            <View style={styles.cardFooter}>
                <Animated.View
                    style={[
                        styles.skeletonBadge,
                        { opacity },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.skeletonBadge,
                        { width: 60, opacity },
                    ]}
                />
            </View>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    cardSkeleton: {
        marginBottom: 12,
        padding: 16,
    },
    listSkeleton: {
        marginBottom: 8,
        padding: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    listContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    skeletonCircle: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: modernColors.textSecondary + '30',
    },
    listTextContainer: {
        flex: 1,
        gap: 8,
    },
    skeletonText: {
        height: 16,
        borderRadius: 4,
        backgroundColor: modernColors.textSecondary + '30',
    },
    skeletonTitle: {
        width: '80%',
        marginBottom: 8,
    },
    skeletonSubtitle: {
        width: '60%',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    skeletonBadge: {
        width: 80,
        height: 24,
        borderRadius: 6,
        backgroundColor: modernColors.textSecondary + '30',
    },
});

export default ServiceSkeleton;



