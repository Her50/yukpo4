// ✅ NOUVEAU Phase 10: Modal de progression détaillée pour génération vidéo
// Affiche la progression étape par étape avec estimation temps

import React from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

export type GenerationStep =
    | 'storyboard'
    | 'clips'
    | 'audio'
    | 'rendering'
    | 'complete'
    | 'error';

export interface GenerationProgress {
    step: GenerationStep;
    progress: number; // 0-100
    estimatedTimeRemaining: number; // secondes
    currentScene?: number;
    totalScenes?: number;
    message?: string;
    error?: string;
}

interface VideoProgressModalProps {
    visible: boolean;
    progress: GenerationProgress | null;
    onCancel?: () => void;
    onDismiss?: () => void;
}

const getStepLabel = (step: GenerationStep): string => {
    switch (step) {
        case 'storyboard':
            return 'Génération du storyboard';
        case 'clips':
            return 'Génération des clips vidéo';
        case 'audio':
            return 'Synchronisation audio';
        case 'rendering':
            return 'Rendu final';
        case 'complete':
            return 'Vidéo générée!';
        case 'error':
            return 'Erreur de génération';
        default:
            return 'Génération en cours...';
    }
};

const getStepIcon = (step: GenerationStep): string => {
    switch (step) {
        case 'storyboard':
            return 'file-text';
        case 'clips':
            return 'video';
        case 'audio':
            return 'music';
        case 'rendering':
            return 'film';
        case 'complete':
            return 'check-circle';
        case 'error':
            return 'alert-circle';
        default:
            return 'loader';
    }
};

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
        return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
};

export const VideoProgressModal: React.FC<VideoProgressModalProps> = ({
    visible,
    progress,
    onCancel,
    onDismiss,
}) => {
    const progressAnim = useSharedValue(0);

    React.useEffect(() => {
        if (progress) {
            progressAnim.value = withTiming(progress.progress, { duration: 300 });
        }
    }, [progress?.progress]);

    const animatedProgressStyle = useAnimatedStyle(() => {
        return {
            width: `${progressAnim.value}%`,
        };
    });

    if (!progress) {
        return null;
    }

    const isComplete = progress.step === 'complete';
    const isError = progress.step === 'error';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <NativeCard style={styles.modalCard}>
                    {/* Header */}
                    <View style={styles.header}>
                        <SafeIcon
                            name={getStepIcon(progress.step)}
                            size={32}
                            color={
                                isError
                                    ? modernColors.danger
                                    : isComplete
                                        ? modernColors.success
                                        : modernColors.primary
                            }
                        />
                        <Text style={styles.title}>{getStepLabel(progress.step)}</Text>
                    </View>

                    {/* Progress Bar */}
                    {!isComplete && !isError && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBackground}>
                                <Animated.View
                                    style={[
                                        styles.progressBarFill,
                                        animatedProgressStyle,
                                        {
                                            backgroundColor:
                                                progress.progress < 30
                                                    ? modernColors.danger
                                                    : progress.progress < 70
                                                        ? modernColors.warning
                                                        : modernColors.primary,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressText}>
                                {String(Math.round(progress.progress))}%
                            </Text>
                        </View>
                    )}

                    {/* Scene Progress */}
                    {progress.step === 'clips' &&
                        progress.currentScene !== undefined &&
                        progress.totalScenes !== undefined && (
                            <View style={styles.sceneProgress}>
                                <Text style={styles.sceneText}>
                                    Scène {progress.currentScene} / {progress.totalScenes}
                                </Text>
                            </View>
                        )}

                    {/* Message */}
                    {progress.message && (
                        <Text style={styles.message}>{progress.message}</Text>
                    )}

                    {/* Error */}
                    {isError && progress.error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{progress.error}</Text>
                        </View>
                    )}

                    {/* Time Remaining */}
                    {!isComplete && !isError && progress.estimatedTimeRemaining > 0 && (
                        <View style={styles.timeContainer}>
                            <SafeIcon
                                name="clock"
                                size={16}
                                color={modernColors.textSecondary}
                            />
                            <Text style={styles.timeText}>
                                Temps restant: {formatTime(progress.estimatedTimeRemaining)}
                            </Text>
                        </View>
                    )}

                    {/* Loading Indicator */}
                    {!isComplete && !isError && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator
                                size="large"
                                color={modernColors.primary}
                            />
                        </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        {!isComplete && !isError && onCancel && (
                            <NativeButton
                                title="Annuler"
                                variant="secondary"
                                size="medium"
                                onPress={onCancel}
                                style={styles.cancelButton}
                            />
                        )}
                        {(isComplete || isError) && onDismiss && (
                            <NativeButton
                                title={isError ? 'Fermer' : 'OK'}
                                variant={isError ? 'secondary' : 'primary'}
                                size="medium"
                                onPress={onDismiss}
                                style={styles.dismissButton}
                            />
                        )}
                    </View>
                </NativeCard>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 400,
        padding: 24,
        borderRadius: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        flex: 1,
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
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    sceneProgress: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: modernColors.border + '40',
        borderRadius: 8,
    },
    sceneText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 16,
    },
    errorContainer: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: modernColors.danger + '20',
        borderRadius: 8,
    },
    errorText: {
        fontSize: 14,
        color: modernColors.danger,
        textAlign: 'center',
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 8,
    },
    timeText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 16,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        minWidth: 120,
    },
    dismissButton: {
        minWidth: 120,
    },
});
