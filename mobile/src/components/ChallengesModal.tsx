/**
 * ChallengesModal - Modal pour afficher les challenges
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import gamificationService from '../services/gamificationService';
import { modernColors } from '../theme/modernTheme';
import { SafeIcon } from './SafeIcon';

interface Challenge {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: 'daily' | 'weekly' | 'monthly' | 'special';
    target: number;
    current: number;
    reward: number;
    expiresAt?: number;
    completed: boolean;
}

interface ChallengesModalProps {
    visible: boolean;
    onClose: () => void;
    userId?: string;
}

export const ChallengesModal: React.FC<ChallengesModalProps> = ({
    visible,
    onClose,
    userId,
}) => {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible && userId) {
            loadChallenges();
        }
    }, [visible, userId]);

    const loadChallenges = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const challengesData = await gamificationService.getChallenges(userId);
            setChallenges(challengesData);
        } catch (error) {
            console.error('[ChallengesModal] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const getProgress = (challenge: Challenge) => {
        return Math.min((challenge.current / challenge.target) * 100, 100);
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'daily': return 'Quotidien';
            case 'weekly': return 'Hebdomadaire';
            case 'monthly': return 'Mensuel';
            case 'special': return 'Spécial';
            default: return type;
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>🎯 Challenges</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                        </View>
                    ) : (
                        <ScrollView style={styles.list}>
                            {challenges.map((challenge) => {
                                const progress = getProgress(challenge);
                                const isExpired = challenge.expiresAt && challenge.expiresAt < Date.now();

                                return (
                                    <View
                                        key={challenge.id}
                                        style={[
                                            styles.challenge,
                                            challenge.completed && styles.challengeCompleted,
                                            isExpired && !challenge.completed && styles.challengeExpired,
                                        ]}
                                    >
                                        <View style={styles.challengeHeader}>
                                            <Text style={styles.challengeIcon}>{challenge.icon}</Text>
                                            <View style={styles.challengeInfo}>
                                                <Text style={styles.challengeName}>{challenge.name}</Text>
                                                <Text style={styles.challengeType}>{getTypeLabel(challenge.type)}</Text>
                                            </View>
                                            {challenge.completed && (
                                                <View style={styles.completedBadge}>
                                                    <Text style={styles.completedText}>✓</Text>
                                                </View>
                                            )}
                                        </View>

                                        <Text style={styles.challengeDescription}>{challenge.description}</Text>

                                        <View style={styles.progressContainer}>
                                            <View style={styles.progressBar}>
                                                <View
                                                    style={[
                                                        styles.progressFill,
                                                        { width: `${progress}%` },
                                                        challenge.completed && styles.progressFillCompleted,
                                                    ]}
                                                />
                                            </View>
                                            <Text style={styles.progressText}>
                                                {challenge.current} / {challenge.target}
                                            </Text>
                                        </View>

                                        <View style={styles.rewardContainer}>
                                            <Text style={styles.rewardLabel}>Récompense:</Text>
                                            <Text style={styles.rewardValue}>+{challenge.reward} pts</Text>
                                        </View>

                                        {isExpired && !challenge.completed && (
                                            <Text style={styles.expiredText}>Expiré</Text>
                                        )}
                                    </View>
                                );
                            })}
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
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    list: {
        flex: 1,
        paddingHorizontal: 20,
    },
    challenge: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    challengeCompleted: {
        backgroundColor: '#F0FDF4',
        borderColor: '#10B981',
    },
    challengeExpired: {
        opacity: 0.6,
    },
    challengeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    challengeIcon: {
        fontSize: 32,
        marginRight: 12,
    },
    challengeInfo: {
        flex: 1,
    },
    challengeName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    challengeType: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    completedBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    challengeDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
    },
    progressContainer: {
        marginBottom: 12,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 4,
    },
    progressFillCompleted: {
        backgroundColor: '#10B981',
    },
    progressText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'right',
    },
    rewardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rewardLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    rewardValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    expiredText: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
        marginTop: 8,
    },
});

ChallengesModal.displayName = 'ChallengesModal';

