/**
 * 🗺️ Indicateur de route optimisée
 * Affiche la route calculée et le temps estimé
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { NativeCard } from '../SafeNativeDesign';
import { SafeIcon } from '../SafeIcon';

interface RouteOptimizationIndicatorProps {
    distance: number; // en km
    estimatedTime: number; // en minutes
    isOptimized?: boolean;
    trafficDelay?: number; // en minutes
    style?: any;
}

const RouteOptimizationIndicator: React.FC<RouteOptimizationIndicatorProps> = ({
    distance,
    estimatedTime,
    isOptimized = true,
    trafficDelay = 0,
    style,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isOptimized) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [isOptimized]);

    const totalTime = estimatedTime + trafficDelay;

    return (
        <NativeCard style={[styles.container, style]}>
            <View style={styles.header}>
                <Animated.View
                    style={[
                        styles.iconContainer,
                        {
                            transform: [{ scale: pulseAnim }],
                        },
                    ]}
                >
                    <SafeIcon
                        name={isOptimized ? 'navigation' : 'map'}
                        size={20}
                        color={isOptimized ? modernColors.success : modernColors.warning}
                    />
                </Animated.View>
                <View style={styles.info}>
                    <Text style={styles.label}>
                        {isOptimized ? 'Route optimisée' : 'Route standard'}
                    </Text>
                    <View style={styles.stats}>
                        <View style={styles.stat}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>{distance.toFixed(1)} km</Text>
                        </View>
                        <View style={styles.stat}>
                            <SafeIcon name="clock" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>
                                {totalTime} min
                                {trafficDelay > 0 && (
                                    <Text style={styles.trafficDelay}> (+{trafficDelay} trafic)</Text>
                                )}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
            {isOptimized && (
                <View style={styles.badge}>
                    <SafeIcon name="zap" size={12} color={modernColors.success} />
                    <Text style={styles.badgeText}>Route la plus rapide</Text>
                </View>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.success + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    stats: {
        flexDirection: 'row',
        gap: 16,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    trafficDelay: {
        color: modernColors.warning,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.success,
    },
});

export default RouteOptimizationIndicator;


