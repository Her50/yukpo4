/**
 * LeaderboardModal - Modal pour afficher les leaderboards
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import gamificationService from '../services/gamificationService';
import { modernColors } from '../theme/modernTheme';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface LeaderboardModalProps {
    visible: boolean;
    onClose: () => void;
    userId?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
    visible,
    onClose,
    userId,
}) => {
        const { t } = useLanguageSafe();
const [leaderboard, setLeaderboard] = useState<Array<{
        userId: string;
        username: string;
        avatar?: string;
        points: number;
        rank: number;
    }>>([]);
    const [userRank, setUserRank] = useState(0);
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('weekly');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            loadLeaderboard();
        }
    }, [visible, period]);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const [leaderboardData, rankData] = await Promise.all([
                gamificationService.getLeaderboard(period, 100),
                userId ? gamificationService.getUserRank(userId, period) : Promise.resolve(0),
            ]);

            setLeaderboard(leaderboardData);
            setUserRank(rankData);
        } catch (error) {
            console.error('[LeaderboardModal] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const getRankIcon = (rank: number | null | undefined) => {
        if (rank == null) return '#?';
        if (rank === 1) return '\uD83E\uDD47';
        if (rank === 2) return '\uD83E\uDD48';
        if (rank === 3) return '\uD83E\uDD49';
        return `#${rank}`;
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>\uD83C\uDFC6 Classement</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Période */}
                    <View style={styles.periodSelector}>
                        {(['daily', 'weekly', 'monthly', 'alltime'] as const).map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.periodButton, period === p && styles.periodButtonActive]}
                                onPress={() => setPeriod(p)}
                            >
                                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                                    {p === 'daily' ? 'Jour' : p === 'weekly' ? 'Semaine' : p === 'monthly' ? 'Mois' : 'Total'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Rang utilisateur */}
                    {userId && userRank > 0 && (
                        <View style={styles.userRankContainer}>
                            <Text style={styles.userRankText}>Votre rang: #{userRank != null ? String(userRank) : '?'}</Text>
                        </View>
                    )}

                    {/* Leaderboard */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                        </View>
                    ) : (
                        <ScrollView style={styles.list}>
                            {leaderboard.map((entry, index) => (
                                <View
                                    key={entry.userId}
                                    style={[
                                        styles.entry,
                                        entry.userId === userId && styles.entryCurrentUser,
                                        index < 3 && styles.entryTop,
                                    ]}
                                >
                                    <Text style={styles.rank}>
                                        {entry.rank != null ? getRankIcon(entry.rank) : '#?'}
                                    </Text>
                                    <View style={styles.avatarContainer}>
                                        {entry.avatar ? (
                                            <Text style={styles.avatarEmoji}>{entry.avatar}</Text>
                                        ) : (
                                            <View style={styles.avatarPlaceholder}>
                                                <Text style={styles.avatarText}>
                                                    {entry.username.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.userInfo}>
                                        <Text style={styles.username}>{entry.username}</Text>
                                        <Text style={styles.points}>{entry.points != null ? String(entry.points) : '0'} pts</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
    },
    closeButton: {
        padding: 4,
    },
    periodSelector: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 8,
    },
    periodButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    periodButtonActive: {
        backgroundColor: modernColors.primary,
    },
    periodText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    periodTextActive: {
        color: '#FFFFFF',
    },
    userRankContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FEF3C7',
        marginHorizontal: 20,
        borderRadius: 12,
        marginBottom: 16,
    },
    userRankText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#92400E',
        textAlign: 'center',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    list: {
        flex: 1,
    },
    entry: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    entryCurrentUser: {
        backgroundColor: '#FEF3C7',
    },
    entryTop: {
        backgroundColor: '#F0FDF4',
    },
    rank: {
        fontSize: 20,
        fontWeight: '700',
        width: 40,
        textAlign: 'center',
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    avatarEmoji: {
        fontSize: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    points: {
        fontSize: 14,
        color: '#6B7280',
    },
});

LeaderboardModal.displayName = 'LeaderboardModal';

