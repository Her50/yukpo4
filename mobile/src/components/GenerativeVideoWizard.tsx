// ✅ NOUVEAU Phase 3.1: Wizard pour génération vidéo IA complète depuis texte

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    GenerateVideoRequest,
    GenerativeJob,
    generativeVideoService,
    Storyboard,
} from '../services/generativeVideoService';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeInput } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';

export interface GenerativeVideoGeneratedPayload {
    /** ID du job `POST /api/generative/generate` (pour attache produit) */
    generativeJobId: string;
    videoUrl: string;
    timelineId: string;
}

interface GenerativeVideoWizardProps {
    visible: boolean;
    onClose: () => void;
    /** Texte initial (ex. contexte produit) */
    initialDescription?: string;
    /** Appelé quand la génération est terminée avec succès */
    onVideoGenerated?: (payload: GenerativeVideoGeneratedPayload) => void;
}

/** Valeurs envoyées à l'API — libellés via i18n `style*` */
const STYLE_OPTIONS = [
    { value: 'cinématique', i18nKey: 'styleCinematic' },
    { value: 'dramatique', i18nKey: 'styleDramatic' },
    { value: 'dynamique', i18nKey: 'styleDynamic' },
    { value: 'calme', i18nKey: 'styleCalm' },
    { value: 'épique', i18nKey: 'styleEpic' },
    { value: 'intime', i18nKey: 'styleIntimate' },
] as const;

const MOOD_OPTIONS = [
    { value: 'energetic', i18nKey: 'moodEnergetic' },
    { value: 'relaxing', i18nKey: 'moodRelaxing' },
    { value: 'happy', i18nKey: 'moodHappy' },
    { value: 'sad', i18nKey: 'moodSad' },
    { value: 'dramatic', i18nKey: 'moodDramatic' },
    { value: 'calm', i18nKey: 'moodCalm' },
    { value: 'epic', i18nKey: 'moodEpic' },
] as const;

const ASPECT_RATIOS: Array<'16:9' | '9:16' | '1:1' | '4:5' | '21:9'> = ['16:9', '9:16', '1:1', '4:5', '21:9'];

const PROVIDER_OPTIONS = [
    { value: 'runway' as const, i18nKey: 'providerRunway' },
    { value: 'pika' as const, i18nKey: 'providerPika' },
    { value: 'sora' as const, i18nKey: 'providerSora' },
] as const;

const G = 'generativeVideoWizard';

export const GenerativeVideoWizard: React.FC<GenerativeVideoWizardProps> = ({
    visible,
    onClose,
    initialDescription = '',
    onVideoGenerated,
}) => {
    const { t } = useLanguageSafe();
    const tg = useCallback(
        (key: string, params?: Record<string, string | number>) => t(`${G}.${key}`, params),
        [t],
    );

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState('30');
    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5' | '21:9'>('16:9');
    const [selectedProvider, setSelectedProvider] = useState<'runway' | 'pika' | 'sora' | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<GenerativeJob | null>(null);
    const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Polling pour le statut du job
    useEffect(() => {
        if (!jobId) return;

        const interval = setInterval(async () => {
            try {
                const updatedJob = await generativeVideoService.getJobStatus(jobId);
                setJob(updatedJob);

                if (updatedJob.storyboard) {
                    setStoryboard((prev) => prev ?? updatedJob.storyboard!);
                }

                if (updatedJob.status === 'completed' && updatedJob.final_video_url && jobId) {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setLoading(false);
                    const payload: GenerativeVideoGeneratedPayload = {
                        generativeJobId: jobId,
                        videoUrl: updatedJob.final_video_url,
                        timelineId: updatedJob.final_timeline_id || '',
                    };
                    if (onVideoGenerated) {
                        onVideoGenerated(payload);
                    } else {
                        Alert.alert(tg('alertSuccessTitle'), tg('alertSuccessBody'));
                    }
                } else if (updatedJob.status === 'failed') {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setLoading(false);
                    Alert.alert(tg('alertErrorTitle'), updatedJob.error || tg('alertGenerationFailed'));
                }
            } catch (error: any) {
                console.error('[GenerativeVideoWizard] Erreur polling:', error);
            }
        }, 3000); // Poll toutes les 3 secondes

        pollingIntervalRef.current = interval;

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [jobId, onVideoGenerated, tg]);

    const handleGenerate = async () => {
        if (!description.trim()) {
            Alert.alert(tg('alertErrorTitle'), tg('alertEmptyDescription'));
            return;
        }

        setLoading(true);
        setStep(3);

        try {
            const request: GenerateVideoRequest = {
                description: description.trim(),
                duration_seconds: parseFloat(duration) || 30,
                style: selectedStyle || undefined,
                mood: selectedMood || undefined,
                aspect_ratio: selectedAspectRatio,
                provider: selectedProvider,
            };

            const response = await generativeVideoService.generateVideo(request);
            setJobId(response.job_id);
        } catch (error: any) {
            console.error('[GenerativeVideoWizard] Erreur génération:', error);
            Alert.alert(tg('alertErrorTitle'), error.message || tg('alertGenericError'));
            setLoading(false);
            setStep(1);
        }
    };

    const handleClose = () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setJobId(null);
        setJob(null);
        setStoryboard(null);
        setStep(1);
        setLoading(false);
        onClose();
    };

    const getProgressLabel = (): string => {
        if (!job) return '';
        const { stage, message, current_scene, total_scenes } = job.progress;
        if (stage === 'generating_storyboard') return tg('progressStoryboard');
        if (stage === 'generating_clips') {
            return tg('progressClips', {
                current: current_scene || 0,
                total: total_scenes || 0,
            });
        }
        if (stage === 'assembling') return tg('progressAssembling');
        if (message && String(message).trim()) return String(message);
        return tg('progressProcessing');
    };

    const renderStep1 = () => (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>{tg('step1Title')}</Text>
            <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder={tg('placeholderDescription')}
                multiline
                numberOfLines={6}
                placeholderTextColor={modernColors.textSecondary}
            />

            <Text style={styles.label}>{tg('labelDurationSeconds')}</Text>
            <NativeInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder={tg('placeholderDuration')}
            />

            <Text style={styles.label}>{tg('labelAspectRatio')}</Text>
            <View style={styles.optionsRow}>
                {ASPECT_RATIOS.map((ratio) => (
                    <TouchableOpacity
                        key={ratio}
                        style={[
                            styles.optionChip,
                            selectedAspectRatio === ratio && styles.optionChipActive,
                        ]}
                        onPress={() => setSelectedAspectRatio(ratio)}
                    >
                        <Text
                            style={[
                                styles.optionChipText,
                                selectedAspectRatio === ratio && styles.optionChipTextActive,
                            ]}
                        >
                            {ratio}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <NativeButton
                title={tg('next')}
                onPress={() => setStep(2)}
                variant="primary"
                disabled={!description.trim()}
            />
        </ScrollView>
    );

    const renderStep2 = () => (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>{tg('step2Title')}</Text>

            <Text style={styles.label}>{tg('labelVisualStyle')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
                {STYLE_OPTIONS.map(({ value, i18nKey }) => (
                    <TouchableOpacity
                        key={value}
                        style={[
                            styles.optionChip,
                            selectedStyle === value && styles.optionChipActive,
                        ]}
                        onPress={() => setSelectedStyle(selectedStyle === value ? null : value)}
                    >
                        <Text
                            style={[
                                styles.optionChipText,
                                selectedStyle === value && styles.optionChipTextActive,
                            ]}
                        >
                            {tg(i18nKey)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.label}>{tg('labelMood')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
                {MOOD_OPTIONS.map(({ value, i18nKey }) => (
                    <TouchableOpacity
                        key={value}
                        style={[
                            styles.optionChip,
                            selectedMood === value && styles.optionChipActive,
                        ]}
                        onPress={() => setSelectedMood(selectedMood === value ? null : value)}
                    >
                        <Text
                            style={[
                                styles.optionChipText,
                                selectedMood === value && styles.optionChipTextActive,
                            ]}
                        >
                            {tg(i18nKey)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.label}>{tg('labelAiProvider')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
                {PROVIDER_OPTIONS.map(({ value, i18nKey }) => (
                    <TouchableOpacity
                        key={value}
                        style={[
                            styles.optionChip,
                            selectedProvider === value && styles.optionChipActive,
                        ]}
                        onPress={() =>
                            setSelectedProvider(selectedProvider === value ? undefined : value)
                        }
                    >
                        <Text
                            style={[
                                styles.optionChipText,
                                selectedProvider === value && styles.optionChipTextActive,
                            ]}
                        >
                            {tg(i18nKey)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.stepActions}>
                <NativeButton
                    title={tg('back')}
                    onPress={() => setStep(1)}
                    variant="outline"
                    style={styles.backButton}
                />
                <NativeButton
                    title={tg('generate')}
                    onPress={handleGenerate}
                    variant="primary"
                    style={styles.generateButton}
                />
            </View>
        </ScrollView>
    );

    const renderStep3 = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{tg('step3Title')}</Text>

            {loading && (
                <ActivityIndicator
                    size="large"
                    color={modernColors.primary}
                    style={styles.loadingIndicator}
                />
            )}

            {job && (
                <View style={styles.progressContainer}>
                    <Text style={styles.progressLabel}>{getProgressLabel()}</Text>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${job.progress.progress}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>
                        {job.progress.progress.toFixed(0)}%
                    </Text>
                </View>
            )}

            {storyboard && (
                <View style={styles.storyboardContainer}>
                    <Text style={styles.storyboardTitle}>{tg('storyboardGenerated')}</Text>
                    <Text style={styles.storyboardInfo}>
                        {tg('storyboardMeta', {
                            count: storyboard.scenes.length,
                            seconds: storyboard.total_duration,
                        })}
                    </Text>
                    <ScrollView style={styles.scenesList}>
                        {storyboard.scenes.map((scene) => (
                            <View key={scene.scene_number} style={styles.sceneItem}>
                                <Text style={styles.sceneNumber}>
                                    {tg('sceneLabel', { n: scene.scene_number })}
                                </Text>
                                <Text style={styles.sceneDescription}>
                                    {scene.description}
                                </Text>
                                <Text style={styles.sceneDuration}>
                                    {tg('sceneDurationLine', { seconds: scene.duration_seconds })}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {job?.generated_clips && job.generated_clips.length > 0 && (
                <View style={styles.clipsContainer}>
                    <Text style={styles.clipsTitle}>
                        {tg('clipsProgress', {
                            done: job.generated_clips.length,
                            total: storyboard?.scenes.length || 0,
                        })}
                    </Text>
                </View>
            )}

            {job?.error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{job.error}</Text>
                </View>
            )}
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{tg('modalTitle')}</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Steps indicator */}
                    <View style={styles.stepsIndicator}>
                        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
                        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
                        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
                        <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
                        <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
                    </View>

                    {/* Step content */}
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
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
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    stepsIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    stepDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: modernColors.border,
    },
    stepDotActive: {
        backgroundColor: modernColors.primary,
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: modernColors.border,
        marginHorizontal: 8,
    },
    stepLineActive: {
        backgroundColor: modernColors.primary,
    },
    stepContent: {
        flex: 1,
        padding: 20,
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    textArea: {
        backgroundColor: modernColors.background,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: modernColors.border,
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 8,
        marginTop: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    optionChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    optionChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    optionChipText: {
        fontSize: 13,
        color: modernColors.text,
        fontWeight: '500',
    },
    optionChipTextActive: {
        color: modernColors.surface,
        fontWeight: '600',
    },
    stepActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    backButton: {
        flex: 1,
    },
    generateButton: {
        flex: 1,
    },
    loadingIndicator: {
        marginVertical: 40,
    },
    progressContainer: {
        marginTop: 20,
    },
    progressLabel: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 8,
    },
    progressBar: {
        height: 8,
        backgroundColor: modernColors.background,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
    },
    progressText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    storyboardContainer: {
        marginTop: 20,
        padding: 16,
        backgroundColor: modernColors.background,
        borderRadius: 12,
    },
    storyboardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    storyboardInfo: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    scenesList: {
        maxHeight: 200,
    },
    sceneItem: {
        padding: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        marginBottom: 8,
    },
    sceneNumber: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 4,
    },
    sceneDescription: {
        fontSize: 13,
        color: modernColors.text,
        marginBottom: 4,
    },
    sceneDuration: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    clipsContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: modernColors.background,
        borderRadius: 8,
    },
    clipsTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    errorContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: modernColors.error + '20',
        borderRadius: 8,
    },
    errorText: {
        fontSize: 13,
        color: modernColors.error,
    },
});
