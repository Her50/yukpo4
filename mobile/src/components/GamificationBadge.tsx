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
        alignItems: 'center', // ✅ CORRIGÉ: Centrer verticalement
        justifyContent: 'center', // ✅ CORRIGÉ: Centrer horizontalement
        paddingHorizontal: 6, // ✅ RÉDUIT: De 8 à 6px
        paddingVertical: 4, // ✅ CORRIGÉ: Augmenter de 3 à 4px pour meilleur alignement vertical
        backgroundColor: modernColors.primary,
        borderRadius: 12, // ✅ RÉDUIT: De 16 à 12px
        gap: 4, // ✅ CORRIGÉ: Augmenter de 3 à 4px pour séparer le trophée du nombre
        minWidth: 0, // ✅ AJOUTÉ: Permet au badge de se rétrécir si nécessaire
        maxWidth: 50, // ✅ CORRIGÉ: Limiter la largeur max pour éviter débordement
        height: 28, // ✅ CORRIGÉ: Hauteur fixe au lieu de 100% pour meilleur contrôle
        alignSelf: 'center', // ✅ CORRIGÉ: Centrer le badge dans son conteneur
    },
    compactIcon: {
        fontSize: 12, // ✅ RÉDUIT: De 14 à 12px
        lineHeight: 12, // ✅ CORRIGÉ: Définir lineHeight égal à fontSize pour alignement
        textAlignVertical: 'center', // ✅ CORRIGÉ: Centrer verticalement
    },
    compactPoints: {
        color: '#FFFFFF',
        fontSize: 10, // ✅ RÉDUIT: De 11 à 10px
        fontWeight: '700',
        lineHeight: 10, // ✅ CORRIGÉ: Définir lineHeight égal à fontSize pour alignement
        textAlignVertical: 'center', // ✅ CORRIGÉ: Centrer verticalement
        includeFontPadding: false, // ✅ CORRIGÉ: Désactiver le padding de police
    },
});

GamificationBadge.displayName = 'GamificationBadge';

