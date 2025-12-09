/**
 * HomeHeader - Header collapsible optimisé avec Reanimated 3
 * Gain estimé: +20% de contenu visible, +40% performance animations
 * ✅ MIGRÉ VERS REANIMATED 3 pour animations fluides 60fps
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Extrapolate,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { modernColors } from '../theme/modernTheme';
import { hapticPress } from '../utils/hapticFeedback';
import { ChallengesModal } from './ChallengesModal'; // ✅ NOUVEAU: Challenges
import { GamificationBadge } from './GamificationBadge'; // ✅ NOUVEAU: Gamification
import LanguageSelector from './LanguageSelector';
import { LeaderboardModal } from './LeaderboardModal'; // ✅ NOUVEAU: Leaderboard
import { SafeIcon } from './SafeIcon';
import { SafeNativeView } from './SafeNativeView';
import UserAvatarMenu from './UserAvatarMenu';

const HEADER_MAX_HEIGHT = 60; // ✅ RÉDUIT: De 80 à 60px pour un header plus compact
const HEADER_MIN_HEIGHT = 48; // ✅ RÉDUIT: De 50 à 48px
const SCROLL_THRESHOLD = 100;

interface HomeHeaderProps {
    scrollY: any; // ✅ Compatible avec Animated.Value (React Native) ou SharedValue (Reanimated)
    user?: any;
    unreadNotificationsCount: number;
    unreadChatCount?: number; // ✅ NOUVEAU 2025-01-27: Nombre de conversations non lues
    selectedLocation: { lat: number; lng: number } | null;
    onDeliveryPress: () => void;
    onChatPress: () => void;
    onNotificationPress: () => void;
    onDebugNotifications?: () => void;
    navigation: any;
    language: string;
    onLanguageChange: (lang: string) => void;
    // ✅ NOUVEAU: Modals gamification
    showLeaderboard?: boolean;
    showChallenges?: boolean;
    onShowLeaderboard?: () => void;
    onShowChallenges?: () => void;
    onCloseLeaderboard?: () => void;
    onCloseChallenges?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = React.memo(({
    scrollY,
    user,
    unreadNotificationsCount,
    unreadChatCount = 0, // ✅ NOUVEAU 2025-01-27: Nombre de conversations non lues
    selectedLocation,
    onDeliveryPress,
    onChatPress,
    onNotificationPress,
    onDebugNotifications,
    navigation,
    language,
    onLanguageChange,
    showLeaderboard = false,
    showChallenges = false,
    onShowLeaderboard,
    onShowChallenges,
    onCloseLeaderboard,
    onCloseChallenges,
}) => {
    // ✅ REANIMATED 3: useSharedValue pour meilleure performance
    const scrollYShared = useSharedValue(0);
    const badgeScaleChat = useSharedValue(1);
    const badgeScaleNotification = useSharedValue(1);

    // ✅ Convertir Animated.Value en SharedValue pour compatibilité
    useEffect(() => {
        if (!scrollY || typeof scrollY.addListener !== 'function') {
            // ✅ CRITIQUE: Retourner explicitement undefined
            return undefined;
        }

        try {
            const listener = scrollY.addListener(({ value }) => {
                if (scrollYShared) {
                    scrollYShared.value = value;
                }
            });

            return () => {
                if (scrollY && typeof scrollY.removeListener === 'function' && listener) {
                    scrollY.removeListener(listener);
                }
            };
        } catch (error) {
            console.warn('[HomeHeader] Erreur listener scrollY:', error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollY]);

    // ✅ Animation badges au changement de compteur
    useEffect(() => {
        if (unreadChatCount > 0 && typeof withSpring === 'function' && badgeScaleChat) {
            try {
                badgeScaleChat.value = withSpring(1.2, { damping: 8 }, () => {
                    if (badgeScaleChat && typeof withSpring === 'function') {
                        badgeScaleChat.value = withSpring(1, { damping: 8 });
                    }
                });
            } catch (error) {
                console.warn('[HomeHeader] Erreur animation badge chat:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unreadChatCount]);

    useEffect(() => {
        if (unreadNotificationsCount > 0 && typeof withSpring === 'function' && badgeScaleNotification) {
            try {
                badgeScaleNotification.value = withSpring(1.2, { damping: 8 }, () => {
                    if (badgeScaleNotification && typeof withSpring === 'function') {
                        badgeScaleNotification.value = withSpring(1, { damping: 8 });
                    }
                });
            } catch (error) {
                console.warn('[HomeHeader] Erreur animation badge notification:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unreadNotificationsCount]);

    // ✅ Styles animés avec Reanimated 3 (60fps garanti) + Parallax
    const animatedHeaderStyle = useAnimatedStyle(() => {
        const scrollProgress = Math.min(scrollYShared.value / SCROLL_THRESHOLD, 1);

        const height = interpolate(
            scrollProgress,
            [0, 1],
            [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
            Extrapolate.CLAMP
        );

        const opacity = interpolate(
            scrollProgress,
            [0, 1],
            [1, 0.7],
            Extrapolate.CLAMP
        );

        // ✅ NOUVEAU: Parallax effect (header se déplace plus lentement que le scroll)
        // ✅ NOUVEAU: Parallax effect (header se déplace plus lentement que le scroll)
        const parallaxOffset = interpolate(
            scrollProgress,
            [0, 1],
            [0, -20], // Header se déplace 20px vers le haut (effet parallax)
            Extrapolate.CLAMP
        );

        return {
            height,
            opacity,
            transform: [{ translateY: parallaxOffset }],
        };
    });

    const animatedTitleStyle = useAnimatedStyle(() => {
        const scrollProgress = Math.min(scrollYShared.value / SCROLL_THRESHOLD, 1);

        const opacity = interpolate(
            scrollProgress,
            [0, 1],
            [1, 0.5],
            Extrapolate.CLAMP
        );

        return {
            opacity,
        };
    });

    const animatedChatBadgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScaleChat.value }],
    }));

    const animatedNotificationBadgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScaleNotification.value }],
    }));

    // ✅ Handlers avec haptic feedback
    const handleDeliveryPress = () => {
        hapticPress();
        onDeliveryPress();
    };

    const handleChatPress = () => {
        hapticPress();
        onChatPress();
    };

    const handleNotificationPress = () => {
        hapticPress();
        onNotificationPress();
    };

    return (
        <Animated.View style={[styles.header, animatedHeaderStyle]}>
            <SafeNativeView style={styles.headerContent} edges={['top']}>
                <View style={styles.headerRow}>
                    {/* Colonne gauche: Avatar + Langue + Gamification */}
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarContainer}>
                            <UserAvatarMenu
                                onNavigate={(route) => navigation.navigate(route)}
                                balance={user?.credits || 0}
                                weatherLocation={selectedLocation}
                            />
                        </View>
                        <LanguageSelector
                            selectedLanguage={language}
                            onLanguageChange={onLanguageChange}
                            compact={true}
                        />
                        {/* ✅ NOUVEAU: Badge gamification compact */}
                        {user?.id && (
                            <>
                                <GamificationBadge
                                    userId={user.id}
                                    compact={true}
                                    onPress={() => {
                                        hapticPress();
                                        onShowLeaderboard?.();
                                    }}
                                />
                                {/* ✅ NOUVEAU: Modals gamification */}
                                <LeaderboardModal
                                    visible={showLeaderboard}
                                    onClose={() => onCloseLeaderboard?.()}
                                    userId={user.id}
                                />
                                <ChallengesModal
                                    visible={showChallenges}
                                    onClose={() => onCloseChallenges?.()}
                                    userId={user.id}
                                />
                            </>
                        )}
                    </View>

                    {/* Titre principal PARFAITEMENT centré avec animation */}
                    <Animated.View style={[styles.brandTitleContainer, animatedTitleStyle]}>
                        <Text style={styles.brandTitleCompact} numberOfLines={1} ellipsizeMode="tail">
                            <Text style={styles.brandYuk}>Yuk</Text>
                            <Text style={styles.brandPo}>po</Text>
                        </Text>
                    </Animated.View>

                    {/* Colonne droite: Actions avec badges animés */}
                    <View style={styles.headerActionsCompact}>
                        {/* ✅ Bouton livraison - Icône livreur (bike) pour représenter le service de livraison */}
                        <TouchableOpacity
                            style={styles.headerButtonCompact}
                            onPress={handleDeliveryPress}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="bike" size={18} color="#fff" type="lucide" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButtonCompact}
                            onPress={handleChatPress}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.headerButtonIconCompact}>💬</Text>
                            {/* ✅ NOUVEAU 2025-01-27: Badge pour messages non lus avec animation */}
                            {typeof unreadChatCount !== 'undefined' && unreadChatCount > 0 && (
                                <Animated.View style={[styles.chatBadgeCompact, animatedChatBadgeStyle]}>
                                    {unreadChatCount < 10 ? (
                                        <Text style={styles.chatBadgeText}>{unreadChatCount}</Text>
                                    ) : (
                                        <Text style={styles.chatBadgeText}>9+</Text>
                                    )}
                                </Animated.View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButtonCompact}
                            onPress={handleNotificationPress}
                            onLongPress={onDebugNotifications}
                            delayLongPress={1000}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.headerButtonIconCompact}>🔔</Text>
                            {unreadNotificationsCount > 0 && (
                                <Animated.View style={[styles.notificationBadgeCompact, animatedNotificationBadgeStyle]}>
                                    {unreadNotificationsCount < 10 && (
                                        <Text style={styles.notificationBadgeText}>{unreadNotificationsCount}</Text>
                                    )}
                                </Animated.View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeNativeView>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    header: {
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 1000,
    },
    headerContent: {
        paddingHorizontal: 16,
        paddingVertical: 8, // ✅ RÉDUIT: De 12 à 8px pour réduire la hauteur
        justifyContent: 'center', // ✅ AJOUTÉ: Centrer verticalement
        flex: 1, // ✅ AJOUTÉ: Prendre toute la hauteur disponible
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center', // ✅ Centrer verticalement tous les éléments
        paddingHorizontal: 4,
        width: '100%',
        justifyContent: 'space-between',
        gap: 4,
        minHeight: 44, // ✅ AJOUTÉ: Hauteur minimale pour touch target
    },
    avatarContainer: {
        width: 36, // ✅ RÉDUIT: De 40 à 36px pour plus de compacité
        height: 36, // ✅ RÉDUIT: De 40 à 36px
        marginRight: 4, // ✅ RÉDUIT: De 6 à 4px
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minWidth: 0,
        maxWidth: '30%', // ✅ RÉDUIT: De 35% à 30% pour laisser plus d'espace au centre
        flexShrink: 1,
        gap: 4, // ✅ RÉDUIT: De 6 à 4px pour plus de compacité
    },
    brandTitleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8, // ✅ AUGMENTÉ: De 4 à 8px pour plus d'espace
        minWidth: 80, // ✅ AUGMENTÉ: De 70 à 80px pour garantir l'espace
        flexShrink: 0,
        zIndex: 1, // ✅ AJOUTÉ: S'assurer que le titre est au-dessus
    },
    brandTitleCompact: {
        width: '100%',
        fontSize: 18, // ✅ RÉDUIT: De 20 à 18px pour plus de compacité
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -0.2,
        includeFontPadding: false,
        textAlignVertical: 'center',
        flexShrink: 0,
        overflow: 'visible',
    },
    brandYuk: {
        color: '#EAB308',
    },
    brandPo: {
        color: '#DC2626',
    },
    headerActionsCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        minWidth: 0,
        maxWidth: '30%', // ✅ RÉDUIT: De 35% à 30% pour symétrie avec la colonne gauche
        flexShrink: 1,
    },
    headerButtonCompact: {
        width: 32, // ✅ RÉDUIT: De 36 à 32px pour plus de compacité
        height: 32, // ✅ RÉDUIT: De 36 à 32px
        borderRadius: 16, // ✅ RÉDUIT: De 18 à 16px
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    headerButtonIconCompact: {
        fontSize: 16,
        color: '#374151',
    },
    notificationBadgeCompact: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    chatBadgeCompact: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#3B82F6', // Bleu pour différencier des notifications
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    chatBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

HomeHeader.displayName = 'HomeHeader';

