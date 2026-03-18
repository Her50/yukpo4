/**
 * \uD83C\uDFC6 Système de badges et gamification
 * Design moderne inspiré de Duolingo, Uber Driver
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { SafeIcon } from '../SafeIcon';

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    unlocked: boolean;
    unlockedAt?: string;
    progress?: number; // 0-100
}

interface GamificationBadgeProps {
    badge: Badge;
    size?: 'small' | 'medium' | 'large';
    showProgress?: boolean;
    onPress?: () => void;
}

const GamificationBadge: React.FC<GamificationBadgeProps> = ({
    badge,
    size = 'medium',
    showProgress = false,
    onPress,
}) => {
    const scaleAnim = useRef(new Animated.Value(badge.unlocked ? 1 : 0.8)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (badge.unlocked) {
            // Animation de déblocage
            Animated.sequence([
                Animated.spring(scaleAnim, {
                    toValue: 1.2,
                    tension: 200,
                    friction: 3,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 200,
                    friction: 3,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        // Animation de progression
        if (badge.progress !== undefined) {
            Animated.timing(progressAnim, {
                toValue: badge.progress,
                duration: 1000,
                useNativeDriver: false,
            }).start();
        }
    }, [badge.unlocked, badge.progress]);

    const sizeConfig = {
        small: { icon: 24, container: 48, fontSize: 10 },
        medium: { icon: 32, container: 64, fontSize: 12 },
        large: { icon: 48, container: 96, fontSize: 14 },
    };

    const config = sizeConfig[size];
    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ scale: scaleAnim }],
                    width: config.container,
                    height: config.container,
                },
            ]}
        >
            <View
                style={[
                    styles.badge,
                    {
                        backgroundColor: badge.unlocked ? badge.color : modernColors.border,
                        width: config.container,
                        height: config.container,
                        borderRadius: config.container / 2,
                    },
                ]}
            >
                <SafeIcon
                    name={badge.icon}
                    size={config.icon}
                    color={badge.unlocked ? '#FFFFFF' : modernColors.textSecondary}
                />
            </View>

            {showProgress && badge.progress !== undefined && !badge.unlocked && (
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progressWidth,
                                    backgroundColor: badge.color,
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>{badge.progress}%</Text>
                </View>
            )}

            {badge.unlocked && (
                <View style={styles.unlockedIndicator}>
                    <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                </View>
            )}

            <Text style={[styles.badgeName, { fontSize: config.fontSize }]} numberOfLines={1}>
                {badge.name}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        margin: 8,
    },
    badge: {
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 5,
    },
    progressContainer: {
        marginTop: 8,
        width: '100%',
    },
    progressBar: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 10,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    unlockedIndicator: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
    },
    badgeName: {
        marginTop: 8,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
});

export default GamificationBadge;


