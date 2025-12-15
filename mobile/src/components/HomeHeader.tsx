import React, { useMemo } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { modernColors } from "../theme/modernTheme";
import { hapticPress } from "../utils/hapticFeedback";
import { useRenderMonitor } from "../hooks/useRenderMonitor";
import LanguageSelector from "./LanguageSelector";
import { SafeIcon } from "./SafeIcon";
import { SafeNativeView } from "./SafeNativeView";
import UserAvatarMenu from "./UserAvatarMenu";
import { GamificationBadge } from "./GamificationBadge";
import { LeaderboardModal } from "./LeaderboardModal";
import { ChallengesModal } from "./ChallengesModal";

const HEADER_HEIGHT = 56;

interface HomeHeaderProps {
    scrollY?: any;
    user?: any;
    unreadNotificationsCount: number;
    unreadChatCount?: number;
    selectedLocation: { lat: number; lng: number } | null;
    onDeliveryPress: () => void;
    onChatPress: () => void;
    onNotificationPress: () => void;
    onDebugNotifications?: () => void;
    navigation: any;
    language: string;
    onLanguageChange: (lang: string) => void;
    showLeaderboard?: boolean;
    showChallenges?: boolean;
    onShowLeaderboard?: () => void;
    onShowChallenges?: () => void;
    onCloseLeaderboard?: () => void;
    onCloseChallenges?: () => void;
    disabled?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = React.memo((props) => {
    const {
        scrollY,
        user,
        unreadNotificationsCount,
        unreadChatCount = 0,
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
        disabled = false,
    } = props;

    useRenderMonitor("HomeHeader", { unreadNotificationsCount, unreadChatCount, disabled });

    const headerAnimatedStyle = useMemo(() => {
        if (!scrollY || typeof scrollY.interpolate !== "function") {
            return null;
        }
        try {
            return {
                transform: [
                    {
                        translateY: scrollY.interpolate({
                            inputRange: [0, 80],
                            outputRange: [0, -12],
                            extrapolate: "clamp",
                        }),
                    },
                ],
                opacity: scrollY.interpolate({
                    inputRange: [0, 80],
                    outputRange: [1, 0.9],
                    extrapolate: "clamp",
                }),
            };
        } catch (error) {
            console.warn("[HomeHeader] fallback animated style", error);
            return null;
        }
    }, [scrollY]);

    const renderBadge = (count: number, containerStyle: any, textStyle: any) => {
        if (!count || count <= 0) {
            return null;
        }
        return (
            <View style={containerStyle}>
                <Text style={textStyle}>{count < 10 ? String(count) : "9+"}</Text>
            </View>
        );
    };

    return (
        <Animated.View style={[styles.header, headerAnimatedStyle || undefined]}>
            <SafeNativeView style={styles.headerContent} edges={["top"]}>
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarContainer}>
                            <UserAvatarMenu
                                onNavigate={(route) => navigation?.navigate?.(route)}
                                balance={user?.credits || 0}
                                weatherLocation={selectedLocation}
                            />
                        </View>
                        <LanguageSelector
                            selectedLanguage={language}
                            onLanguageChange={onLanguageChange}
                            compact
                        />
                        {user?.id ? (
                            <>
                                <GamificationBadge
                                    userId={user.id}
                                    compact
                                    onPress={() => {
                                        hapticPress();
                                        onShowLeaderboard?.();
                                    }}
                                />
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
                        ) : null}
                    </View>

                    <View style={styles.brandTitleContainer}>
                        <Text style={styles.brandTitleCompact} numberOfLines={1} ellipsizeMode="tail">
                            <Text style={styles.brandYuk}>Yuk</Text>
                            <Text style={styles.brandPo}>po</Text>
                        </Text>
                    </View>

                    <View style={styles.headerActionsCompact}>
                        <TouchableOpacity
                            style={[styles.headerButtonCompact, styles.headerButtonDelivery, disabled && styles.headerButtonDisabled]}
                            onPress={() => {
                                hapticPress();
                                onDeliveryPress?.();
                            }}
                            disabled={disabled}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="bike" size={18} color={disabled ? "#888" : "#4B5563"} type="lucide" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.headerButtonCompact, disabled && styles.headerButtonDisabled]}
                            onPress={() => {
                                hapticPress();
                                onChatPress?.();
                            }}
                            disabled={disabled}
                            activeOpacity={0.8}
                        >
                            <SafeIcon
                                name="message-circle"
                                size={18}
                                color={disabled ? "#888" : "#fff"}
                                type="lucide"
                            />
                            {renderBadge(unreadChatCount, styles.chatBadgeCompact, styles.chatBadgeText)}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.headerButtonCompact, disabled && styles.headerButtonDisabled]}
                            onPress={() => {
                                hapticPress();
                                onNotificationPress?.();
                            }}
                            onLongPress={onDebugNotifications}
                            delayLongPress={800}
                            disabled={disabled}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="bell" size={18} color={disabled ? "#888" : "#fff"} type="lucide" />
                            {renderBadge(
                                unreadNotificationsCount,
                                styles.notificationBadgeCompact,
                                styles.notificationBadgeText,
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
        borderBottomColor: "#E5E7EB",
        elevation: 3,
        zIndex: 1000,
    },
    headerContent: {
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 4,
        justifyContent: "center",
        alignItems: "stretch",
        height: HEADER_HEIGHT,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        width: "100%",
        gap: 8,
        height: HEADER_HEIGHT,
    },
    avatarContainer: {
        width: 36,
        height: 36,
        marginRight: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        minWidth: 0,
        maxWidth: "35%",
        flexShrink: 1,
        gap: 6,
    },
    brandTitleContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 100,
    },
    brandTitleCompact: {
        fontSize: 20,
        fontWeight: "800",
        color: modernColors.text,
    },
    brandYuk: {
        color: modernColors.primary,
    },
    brandPo: {
        color: modernColors.text,
    },
    headerActionsCompact: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        minWidth: 0,
    },
    headerButtonCompact: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: modernColors.primary,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },
    headerButtonDelivery: {
        backgroundColor: "rgba(255, 255, 255, 0.15)", // Transparent comme les notifications
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
    },
    headerButtonDisabled: {
        backgroundColor: "#d1d5db",
    },
    headerButtonIconCompact: {
        fontSize: 16,
        color: "#fff",
    },
    headerButtonIconDisabled: {
        color: "#888",
    },
    chatBadgeCompact: {
        position: "absolute",
        top: -4,
        right: -4,
        backgroundColor: modernColors.accent,
        borderRadius: 10,
        minWidth: 18,
        paddingHorizontal: 4,
        paddingVertical: 2,
        alignItems: "center",
    },
    chatBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#fff",
    },
    notificationBadgeCompact: {
        position: "absolute",
        top: -4,
        right: -4,
        backgroundColor: modernColors.danger,
        borderRadius: 10,
        minWidth: 18,
        paddingHorizontal: 4,
        paddingVertical: 2,
        alignItems: "center",
    },
    notificationBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#fff",
    },
});

HomeHeader.displayName = "HomeHeader";
export default HomeHeader;
