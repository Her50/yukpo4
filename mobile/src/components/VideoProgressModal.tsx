import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import type { ProgressStep } from '../types/VideoGeneration';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface VideoProgressModalProps {
    visible: boolean;
    steps: ProgressStep[];
    startTime?: number; // Timestamp de début
}

const VideoProgressModal: React.FC<VideoProgressModalProps> = ({
    visible,
    steps,
    startTime,
}) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    const pulseAnim = useRef(new Animated.Value(0)).current;

    // Calculer le pourcentage de progression
    const progress = useMemo(() => {
        const completed = steps.filter(s => s.status === 'completed').length;
        const total = steps.length;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }, [steps]);

    // Calculer le temps estimé restant
    const estimatedTimeRemaining = useMemo(() => {
        if (!startTime || progress === 0) {
            return null;
        }

        const elapsed = (Date.now() - startTime) / 1000; // en secondes
        const avgTimePerStep = elapsed / (progress / 100);
        const remainingSteps = (100 - progress) / 100;
        const estimated = Math.round(avgTimePerStep * remainingSteps);

        if (estimated < 60) {
            return `${estimated}s`;
        } else if (estimated < 3600) {
            return `${Math.round(estimated / 60)}min`;
        } else {
            return `${Math.round(estimated / 3600)}h`;
        }
    }, [startTime, progress]);

    // Animation pulse pour l'étape en cours
    useEffect(() => {
        if (visible) {
            const pulseAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseAnimation.start();
            return () => pulseAnimation.stop();
        }
    }, [visible, pulseAnim]);

    // Mettre à jour le temps écoulé
    useEffect(() => {
        if (!visible || !startTime) return;

        const interval = setInterval(() => {
            setElapsedTime(Math.round((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [visible, startTime]);

    const formatTime = (seconds: number): string => {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            return `${Math.round(seconds / 60)}min`;
        } else {
            return `${Math.round(seconds / 3600)}h`;
        }
    };

    const runningStep = steps.find(s => s.status === 'running');
    const pulseOpacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={styles.container}>
            <NativeCard style={styles.card}>
                <View style={styles.header}>
                    <SafeIcon name="loader" size={24} color={modernColors.primary} />
                    <Text style={styles.title}>Génération en cours</Text>
                </View>

                {/* ✅ PHASE 2: Barre de progression */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBarBackground}>
                        <Animated.View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${progress}%`,
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>{progress}%</Text>
                </View>

                {/* ✅ PHASE 2: Informations de temps */}
                <View style={styles.timeInfo}>
                    {elapsedTime > 0 && (
                        <View style={styles.timeItem}>
                            <SafeIcon name="clock" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.timeText}>Temps écoulé: {formatTime(elapsedTime)}</Text>
                        </View>
                    )}
                    {estimatedTimeRemaining && (
                        <View style={styles.timeItem}>
                            <SafeIcon name="timer" size={16} color={modernColors.primary} />
                            <Text style={styles.timeText}>Temps estimé: {estimatedTimeRemaining}</Text>
                        </View>
                    )}
                </View>

                {/* Étapes détaillées */}
                <View style={styles.stepsContainer}>
                    {steps.map((step, index) => {
                        const isRunning = step.status === 'running';
                        const isCompleted = step.status === 'completed';
                        const isPending = step.status === 'pending';

                        return (
                            <Animated.View
                                key={step.key}
                                style={[
                                    styles.stepRow,
                                    isRunning && {
                                        opacity: pulseAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [1, 0.6],
                                        }),
                                    },
                                ]}
                            >
                                <View style={styles.stepIconContainer}>
                                    {isCompleted ? (
                                        <SafeIcon name="check-circle" size={20} color={modernColors.success} />
                                    ) : isRunning ? (
                                        <Animated.View style={{ opacity: pulseOpacity }}>
                                            <SafeIcon name="loader" size={20} color={modernColors.primary} />
                                        </Animated.View>
                                    ) : (
                                        <SafeIcon name="circle" size={20} color={modernColors.textSecondary} />
                                    )}
                                </View>
                                <View style={styles.stepContent}>
                                    <Text
                                        style={[
                                            styles.stepLabel,
                                            isRunning && styles.stepLabelRunning,
                                            isCompleted && styles.stepLabelCompleted,
                                        ]}
                                    >
                                        {step.label}
                                    </Text>
                                    {step.detail && (
                                        <Text style={styles.stepDetail}>{step.detail}</Text>
                                    )}
                                </View>
                            </Animated.View>
                        );
                    })}
                </View>

                {/* ✅ PHASE 2: Étape actuelle en surbrillance */}
                {runningStep && (
                    <View style={styles.currentStepHighlight}>
                        <Text style={styles.currentStepText}>
                            En cours: {runningStep.label}
                        </Text>
                    </View>
                )}
            </NativeCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: modernColors.background,
        borderRadius: 16,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    progressContainer: {
        marginBottom: 16,
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: modernColors.border,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        textAlign: 'center',
    },
    timeInfo: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.background,
        borderRadius: 8,
    },
    timeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timeText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    stepsContainer: {
        gap: 12,
        marginBottom: 16,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    stepIconContainer: {
        width: 24,
        alignItems: 'center',
        marginTop: 2,
    },
    stepContent: {
        flex: 1,
    },
    stepLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    stepLabelRunning: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    stepLabelCompleted: {
        color: modernColors.success,
    },
    stepDetail: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    currentStepHighlight: {
        backgroundColor: modernColors.primary + '10',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
    },
    currentStepText: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '600',
    },
});

export default VideoProgressModal;

