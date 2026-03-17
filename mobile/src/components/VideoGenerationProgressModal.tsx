// ✅ NOUVEAU: Modal de progression visuelle pour la génération vidéo

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
    Easing
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ProgressStep {
    key: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    detail?: string;
}

interface VideoGenerationProgressModalProps {
    visible: boolean;
    jobId?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    progressSteps?: ProgressStep[];
    currentStep?: number;
    totalSteps?: number;
    errorMessage?: string;
    onClose?: () => void;
}

// Mapping des étapes pour affichage français
const STEP_LABELS: Record<string, string> = {
    'initialization': 'Initialisation',
    'brief_generation': t('videoGenerationProgressModal.generationDuScript'),
    'style_suggestion': 'Suggestion de style',
    'timeline_generation': t('videoGenerationProgressModal.creationDeLaTimeline'),
    'media_collection': t('videoGenerationProgressModal.collecteDesMedias'),
    'audio_generation': t('videoGenerationProgressModal.generationAudio'),
    'voiceover': t('videoGenerationProgressModal.generationDeLaVoix'),
    'music_selection': t('videoGenerationProgressModal.selectionMusicale'),
    'video_rendering': t('videoGenerationProgressModal.renduVideo'),
    'watermark': 'Application du watermark',
    'saving_media': 'Enregistrement',
    'finalizing': 'Finalisation',
};

const STEP_ICONS: Record<string, string> = {
    'initialization': 'zap',
    'brief_generation': 'file-text',
    'style_suggestion': 'palette',
    'timeline_generation': 'film',
    'media_collection': 'image',
    'audio_generation': 'music',
    'voiceover': 'mic',
    'music_selection': 'headphones',
    'video_rendering': 'video',
    'watermark': 'award',
    'saving_media': 'save',
    'finalizing': 'check-circle',
};

export const VideoGenerationProgressModal: React.FC<VideoGenerationProgressModalProps> = ({
    visible,
    jobId,
    status = 'running',
    progressSteps = [],
    currentStep = 0,
    totalSteps = 120,
    errorMessage,
    onClose,
}) => {
        const { t } = useLanguageSafe();
const [animatedProgress] = useState(new Animated.Value(0));
    const [pulseAnim] = useState(new Animated.Value(1));

    // Animation de la barre de progression
    useEffect(() => {
        const progress = totalSteps > 0 ? Math.min(currentStep / totalSteps, 1) : 0;
        Animated.timing(animatedProgress, {
            toValue: progress,
            duration: 500,
            easing: Easing.bezier(0.42, 0, 0.58, 1), // ✅ CORRIGÉ: Utiliser Easing.bezier au lieu de Easing.out() qui peut être undefined
            useNativeDriver: false,
        }).start();
    }, [currentStep, totalSteps]);

    // Animation pulse pour l'étape en cours
    useEffect(() => {
        if (status === 'running') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        easing: Easing.bezier(0.42, 0, 0.58, 1), // ✅ CORRIGÉ: Utiliser Easing.bezier au lieu de Easing.inOut(Easing.ease) qui peut être undefined
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        easing: Easing.bezier(0.42, 0, 0.58, 1), // ✅ CORRIGÉ: Utiliser Easing.bezier au lieu de Easing.inOut(Easing.ease) qui peut être undefined
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [status]);

    const progressWidth = animatedProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    // Filtrer et trier les étapes pour affichage
    const displaySteps = progressSteps
        .filter(step => {
            // Afficher toutes les étapes sauf celles qui sont pending et qui ne sont pas l'initialisation
            if (step.status === 'pending' && step.key !== 'initialization') {
                return false;
            }
            return true;
        })
        .sort((a, b) => {
            const order = ['initialization', 'brief_generation', 'style_suggestion', 'timeline_generation', 
                          'media_collection', 'audio_generation', 'voiceover', 'music_selection', 
                          'video_rendering', 'watermark', 'saving_media', 'finalizing'];
            const aIndex = order.indexOf(a.key);
            const bIndex = order.indexOf(b.key);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

    const getStepIcon = (stepKey: string) => {
        return STEP_ICONS[stepKey] || 'circle';
    };

    const getStepLabel = (step: ProgressStep) => {
        return STEP_LABELS[step.key] || step.label || step.key;
    };

    const getStepStatusColor = (stepStatus: string) => {
        switch (stepStatus) {
            case 'completed':
                return modernColors.success || '#10B981';
            case 'running':
                return modernColors.primary || '#6366F1';
            case 'failed':
                return modernColors.error || '#EF4444';
            default:
                return modernColors.textSecondary || '#6B7280';
        }
    };

    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            {isCompleted ? (
                                <View style={[styles.statusIcon, { backgroundColor: '#D1FAE5' }]}>
                                    <SafeIcon name="check-circle" size={32} color="#10B981" />
                                </View>
                            ) : isFailed ? (
                                <View style={[styles.statusIcon, { backgroundColor: '#FEE2E2' }]}>
                                    <SafeIcon name="x-circle" size={32} color="#EF4444" />
                                </View>
                            ) : (
                                <Animated.View style={[styles.statusIcon, { backgroundColor: '#EFF6FF', transform: [{ scale: pulseAnim }] }]}>
                                    <ActivityIndicator size="large" color={modernColors.primary} />
                                </Animated.View>
                            )}
                            <View style={styles.headerText}>
                                <Text style={styles.title}>
                                    {isCompleted ? t('videoGenerationProgressModal.videoGenereeAvecSucces') : 
                                     isFailed ? t('videoGenerationProgressModal.generationEchouee') : 
                                     t('videoGenerationProgressModal.generationDeVotreVideo')}
                                </Text>
                                <Text style={styles.subtitle}>
                                    {isCompleted ? t('videoGenerationProgressModal.votreVideoEstPrete') :
                                     isFailed ? errorMessage || t('videoGenerationProgress.uneErreurEstSurvenue') :
                                     t('videoGenerationProgressModal.etape', { currentStep: currentStep, totalSteps: totalSteps })}
                                </Text>
                            </View>
                        </View>
                        {(isCompleted || isFailed) && onClose && (
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <SafeIcon name="x" size={24} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Barre de progression globale */}
                    {!isFailed && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBackground}>
                                <Animated.View
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            width: progressWidth,
                                            backgroundColor: isCompleted 
                                                ? modernColors.success || '#10B981'
                                                : modernColors.primary || '#6366F1',
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressText}>
                                {Math.round((currentStep / totalSteps) * 100)}%
                            </Text>
                        </View>
                    )}

                    {/* Liste des étapes */}
                    <ScrollView 
                        style={styles.stepsContainer}
                        contentContainerStyle={styles.stepsContent}
                        showsVerticalScrollIndicator={true}
                    >
                        {displaySteps.length > 0 ? (
                            displaySteps.map((step, index) => {
                                const isActive = step.status === 'running';
                                const isDone = step.status === 'completed';
                                const isError = step.status === 'failed';
                                const stepLabel = getStepLabel(step);
                                const stepIcon = getStepIcon(step.key);
                                const stepColor = getStepStatusColor(step.status);

                                return (
                                    <View key={step.key || index} style={styles.stepItem}>
                                        <View style={styles.stepIconContainer}>
                                            {isDone ? (
                                                <View style={[styles.stepIcon, { backgroundColor: '#D1FAE5' }]}>
                                                    <SafeIcon name="check" size={20} color="#10B981" />
                                                </View>
                                            ) : isError ? (
                                                <View style={[styles.stepIcon, { backgroundColor: '#FEE2E2' }]}>
                                                    <SafeIcon name="x" size={20} color="#EF4444" />
                                                </View>
                                            ) : isActive ? (
                                                <Animated.View 
                                                    style={[
                                                        styles.stepIcon, 
                                                        { backgroundColor: '#EFF6FF', transform: [{ scale: pulseAnim }] }
                                                    ]}
                                                >
                                                    <ActivityIndicator size="small" color={modernColors.primary} />
                                                </Animated.View>
                                            ) : (
                                                <View style={[styles.stepIcon, { backgroundColor: '#F3F4F6' }]}>
                                                    <SafeIcon name={stepIcon} size={20} color={modernColors.textSecondary} />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.stepContent}>
                                            <Text style={[
                                                styles.stepLabel,
                                                isActive && styles.stepLabelActive,
                                                isDone && styles.stepLabelDone,
                                                isError && styles.stepLabelError,
                                            ]}>
                                                {stepLabel}
                                            </Text>
                                            {step.detail && (
                                                <Text style={styles.stepDetail}>{step.detail}</Text>
                                            )}
                                        </View>
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                {status === 'running' ? (
                                    <>
                                        <ActivityIndicator size="large" color={modernColors.primary} style={{ marginBottom: 16 }} />
                                        <Text style={styles.emptyStateText}>
                                            Initialisation de la génération vidéo...
                                        </Text>
                                        <Text style={[styles.emptyStateText, { marginTop: 8, fontSize: 12 }]}>
                                            Les étapes de progression apparaîtront bientôt
                                        </Text>
                                    </>
                                ) : status === 'failed' ? (
                                    <>
                                        <SafeIcon name="alert-circle" size={48} color={modernColors.error} style={{ marginBottom: 16 }} />
                                        <Text style={[styles.emptyStateText, { color: modernColors.error, fontWeight: '600' }]}>
                                            {errorMessage || t('videoGenerationProgress.uneErreurEstSurvenue')}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={styles.emptyStateText}>
                                        Aucune étape disponible
                                    </Text>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer avec info job */}
                    {jobId && (
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                ID: {jobId.substring(0, 8)}...
                            </Text>
                        </View>
                    )}
                </View>
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
    modalContainer: {
        backgroundColor: modernColors.surface || '#FFFFFF',
        borderRadius: 20,
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border || '#E5E7EB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    statusIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text || '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary || '#6B7280',
    },
    closeButton: {
        padding: 8,
    },
    progressContainer: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border || '#E5E7EB',
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: modernColors.border || '#E5E7EB',
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
        color: modernColors.text || '#111827',
        textAlign: 'center',
    },
    stepsContainer: {
        flex: 1,
        maxHeight: 400,
    },
    stepsContent: {
        padding: 20,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    stepIconContainer: {
        marginRight: 12,
    },
    stepIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepContent: {
        flex: 1,
        paddingTop: 2,
    },
    stepLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text || '#111827',
        marginBottom: 4,
    },
    stepLabelActive: {
        color: modernColors.primary || '#6366F1',
    },
    stepLabelDone: {
        color: modernColors.success || '#10B981',
    },
    stepLabelError: {
        color: modernColors.error || '#EF4444',
    },
    stepDetail: {
        fontSize: 13,
        color: modernColors.textSecondary || '#6B7280',
        lineHeight: 18,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        color: modernColors.textSecondary || '#6B7280',
        textAlign: 'center',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border || '#E5E7EB',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: modernColors.textSecondary || '#6B7280',
        fontFamily: 'monospace',
    },
});

