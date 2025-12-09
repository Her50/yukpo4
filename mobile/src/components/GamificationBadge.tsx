/**
 * GamificationBadge - Badge de gamification avec animations
 * Affiche points, badges, streaks
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import gamificationService from '../services/gamificationService';
import { modernColors } from '../theme/modernTheme';

interface GamificationBadgeProps {
    userId?: string;
    compact?: boolean;
    onPress?: () => void;
}

export const GamificationBadge: React.FC<GamificationBadgeProps> = ({
    userId,
    compact = false,
    onPress,
}) => {
    const [points, setPoints] = useState(0);
    const [streak, setStreak] = useState(0);
    const [badges, setBadges] = useState(0);
    const [loading, setLoading] = useState(true);

    const scale = useSharedValue(1);
    const glow = useSharedValue(0);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            // ✅ CRITIQUE: Retourner explicitement undefined
            return undefined;
        }

        const loadGamification = async () => {
            try {
                const [pointsData, streakData, badgesData] = await Promise.all([
                    gamificationService.getPoints(userId),
                    gamificationService.getStreak(userId),
                    gamificationService.getBadges(userId),
                ]);

                setPoints(pointsData.total);
                setStreak(streakData.current);
                setBadges(badgesData.filter(b => b.unlockedAt).length);

                // ✅ Animation au chargement
                if (typeof withSpring === 'function' && scale) {
                    try {
                        scale.value = withSpring(1.1, { damping: 10 }, () => {
                            if (scale && typeof withSpring === 'function') {
                                scale.value = withSpring(1, { damping: 10 });
                            }
                        });
                    } catch (error) {
                        console.warn('[GamificationBadge] Erreur animation:', error);
                    }
                }
            } catch (error) {
                console.error('[GamificationBadge] Erreur chargement:', error);
            } finally {
                setLoading(false);
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadGamification().catch(error => {
            console.error('[GamificationBadge] Erreur loadGamification:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [userId]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    if (!userId || loading) {
        return null;
    }

    if (compact) {
        return (
            <TouchableOpacity
                style={styles.compactContainer}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <Animated.View style={[styles.compactBadge, animatedStyle]}>
                    <Text style={styles.compactIcon}>🏆</Text>
                    <Text style={styles.compactPoints}>{points}</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Animated.View style={[styles.badge, animatedStyle]}>
                <View style={styles.badgeRow}>
                    <Text style={styles.icon}>🏆</Text>
                    <View style={styles.stats}>
                        <Text style={styles.points}>{points} pts</Text>
                        {streak > 0 && (
                            <Text style={styles.streak}>🔥 {streak}j</Text>
                        )}
                        {badges > 0 && (
                            <Text style={styles.badges}>⭐ {badges}</Text>
                        )}
                    </View>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        // Styles pour version complète
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: modernColors.primary,
        borderRadius: 20,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    icon: {
        fontSize: 16,
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    points: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    streak: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    badges: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    compactContainer: {
        // Styles pour version compacte
    },
    compactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: modernColors.primary,
        borderRadius: 16,
        gap: 4,
    },
    compactIcon: {
        fontSize: 14,
    },
    compactPoints: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
});

GamificationBadge.displayName = 'GamificationBadge';

