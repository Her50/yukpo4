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
import { useLanguageSafe } from '../contexts/LanguageContext';

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
        const { t } = useLanguageSafe();
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
                    <Text style={styles.compactIcon}>\uD83C\uDFC6</Text>
                    <Text style={styles.compactPoints}>{points != null ? String(points) : '0'}</Text>
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
                    <Text style={styles.icon}>\uD83C\uDFC6</Text>
                    <View style={styles.stats}>
                        <Text style={styles.points}>{points != null ? String(points) : '0'} pts</Text>
                        {streak != null && streak > 0 && (
                            <Text style={styles.streak}>\uD83D\uDD25 {String(streak)}j</Text>
                        )}
                        {badges != null && badges > 0 && (
                            <Text style={styles.badges}>⭐ {String(badges)}</Text>
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
        justifyContent: 'center',
        paddingHorizontal: 6, // ✅ RÉDUIT 2025-12-11: De 8 à 6px pour compacter
        paddingVertical: 3, // ✅ RÉDUIT 2025-12-11: De 4 à 3px pour compacter
        backgroundColor: 'rgba(255, 215, 0, 0.15)', // ✅ CORRIGÉ 2025-12-11: Utiliser la même couleur que dans l'autre style
        borderRadius: 14, // ✅ RÉDUIT: De 16 à 14px pour plus de compacité
        gap: 3, // ✅ RÉDUIT 2025-12-11: De 4 à 3px pour compacter
        minWidth: 0,
        maxWidth: 60, // ✅ RÉDUIT 2025-12-11: De 70 à 60px pour éviter la confusion avec Yukpo
        height: 28, // ✅ CORRIGÉ 2025-12-11: Hauteur fixe réduite pour éviter le chevauchement avec Yukpo
        borderWidth: 1, // ✅ AJOUTÉ 2025-12-11: Bordure pour correspondre à l'autre style
        borderColor: 'rgba(255, 215, 0, 0.3)', // ✅ AJOUTÉ 2025-12-11: Couleur de bordure
        alignSelf: 'center',
    },
    compactIcon: {
        fontSize: 16,
        lineHeight: 16, // ✅ CORRIGÉ: LineHeight égal à fontSize
        textAlignVertical: 'center',
        includeFontPadding: false,
    },
    compactPoints: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        lineHeight: 13, // ✅ CORRIGÉ: LineHeight égal à fontSize
        textAlignVertical: 'center',
        includeFontPadding: false,
    },
});

GamificationBadge.displayName = 'GamificationBadge';

