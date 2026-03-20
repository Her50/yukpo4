import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { modernColors } from '../../theme/modernTheme';
import {
    GeneratedVideoResponse,
    ProgressStep,
    VideoCostEstimation
} from '../../types/VideoGeneration';
import { safeStringDisplay } from '../../utils/displayHelpers';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { navigateToVideoCreationTab } from '../../navigation/mesServicesNavigation';

interface ResultParams {
    result: GeneratedVideoResponse;
    costEstimation?: VideoCostEstimation | null;
    serviceId?: number;
    productIndex?: number;
}

type Navigation = ReturnType<typeof useNavigation>;

const VideoGenerationResultScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { result, costEstimation } = (route.params || {}) as ResultParams;

    const progressSteps: ProgressStep[] = useMemo(() => {
        if (result?.progress_steps && result.progress_steps.length > 0) {
            return result.progress_steps;
        }
        return [
            { key: 'cost_estimation', label: t('videoGenerationResult.budgetValide'), status: 'completed' },
            { key: 'broll_selection', label: t('videoGenerationResult.imagesEtVisuels'), status: 'completed' },
            { key: 'timeline_generation', label: t('videoGenerationResult.montageVideo'), status: 'completed' },
            { key: 'audio_mix', label: 'Musique et son', status: 'completed' },
            { key: 'video_mux', label: 'Finalisation', status: 'completed' },
        ];
    }, [result?.progress_steps]);

    const immersiveDuration = useMemo(() => {
        const frames = result?.immersive_analytics?.estimated_frames;
        if (typeof frames !== 'number' || frames <= 0) {
            return null;
        }
        return Math.ceil(frames / 30);
    }, [result?.immersive_analytics]);

    const handleOpenVideo = () => {
        if (result?.video_url) {
            Linking.openURL(result.video_url).catch(() => {
                console.warn('[VideoGenerationResult] Impossible d\'ouvrir la vidéo');
            });
        }
    };

    const handleCreateAnother = () => {
        navigateToVideoCreationTab(navigation as any);
    };

    const handleViewAnalytics = () => {
        navigation.navigate('VideoAnalytics' as never);
    };

    const handleShare = async () => {
        if (!result?.video_url) return;
        try {
            await Share.share({
                message: t('videoGenerationResultScreen.regardeMaVideoCreeeAvecYukpo', { result_video_url: result.video_url }),
                url: result.video_url,
                title: t('videoGenerationResult.maVideoYukpo'),
            });
        } catch (error) {
            console.warn('[VideoGenerationResult] Partage échoué:', error);
        }
    };

    if (!result) {
        return (
            <SafeNativeView edges={['top', 'bottom']} style={styles.centered}>
                <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
                <Text style={styles.errorTitle}>{t('videoGenerationResult.aucuneVideoDisponible')}</Text>
                <NativeButton title={t('videoGenerationResultScreen.retour')} onPress={() => navigation.goBack()} variant="primary" />
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView edges={['top', 'bottom']} style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="sparkles" size={28} color={modernColors.primary} />
                <Text style={styles.title}>{t('videoGenerationResult.videoPrete')}</Text>
                <Text style={styles.subtitle}>
                    Ta vidéo est prête ! Tu peux la regarder, la partager ou en créer une nouvelle.
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <NativeCard style={styles.videoCard}>
                    <Text style={styles.sectionTitle}>{t('videoGenerationResult.taVideo')}</Text>
                    <Text style={styles.videoUrl} numberOfLines={2}>
                        {safeStringDisplay(result.video_url, 'URL non disponible')}
                    </Text>
                    <NativeButton
                        title={t('videoGenerationResult.lireLaVideo')}
                        variant="primary"
                        onPress={handleOpenVideo}
                    />
                </NativeCard>

                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Progression</Text>
                    {progressSteps.map((item) => (
                        <View key={item.key} style={styles.progressRow}>
                            <SafeIcon
                                name={item.status === 'completed' ? 'check-circle' : 'circle'}
                                size={20}
                                color={item.status === 'completed' ? modernColors.success : modernColors.textSecondary}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.progressLabel}>{item.label}</Text>
                                {item.detail ? (
                                    <Text style={styles.progressDetail}>{item.detail}</Text>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </NativeCard>

                {costEstimation && (
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>{t('videoGenerationResult.coutFinal')}</Text>
                        <Text style={styles.costValue}>
                            {Math.round(costEstimation.total_cost_local)} {costEstimation.local_currency}
                        </Text>
                        <Text style={styles.costHint}>
                            Base {costEstimation.total_cost_usd.toFixed(2)} $ • marge x{costEstimation.margin_multiplier}
                        </Text>
                        <Text style={styles.costHint}>
                            Solde restant estimé : {costEstimation.current_balance_fcfa ?? '—'} FCFA
                        </Text>
                    </NativeCard>
                )}

                {result.immersive_analytics && (
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Analyse timeline</Text>
                        <Text style={styles.analyticsItem}>
                            Scènes : {result.immersive_analytics.total_scenes}
                        </Text>
                        <Text style={styles.analyticsItem}>
                            Clips b-roll : {result.immersive_analytics.broll_clips_used}
                        </Text>
                        <Text style={styles.analyticsItem}>
                            Frames estimées : {result.immersive_analytics.estimated_frames}
                        </Text>
                        {typeof immersiveDuration === 'number' && (
                            <Text style={styles.analyticsItem}>
                                Durée estimée : ~{immersiveDuration}s
                            </Text>
                        )}
                        {result.immersive_analytics.selected_template && (
                            <Text style={styles.analyticsItem}>
                                Template : {result.immersive_analytics.selected_template}
                            </Text>
                        )}
                    </NativeCard>
                )}

                {result.orchestration_warnings && result.orchestration_warnings.length > 0 && (
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Ajustements IA</Text>
                        {result.orchestration_warnings.map((warning, index) => (
                            <Text key={warning + index} style={styles.warningText}>{warning}</Text>
                        ))}
                    </NativeCard>
                )}
            </ScrollView>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <SafeIcon name="share" size={20} color={modernColors.primary} />
                </TouchableOpacity>
                <NativeButton title={t('videoGenerationResult.nouvelleVideo')} onPress={handleCreateAnother} variant="secondary" size="small" />
                <NativeButton title={t('videoGenerationResult.lireLaVideo')} onPress={handleOpenVideo} variant="primary" size="small" />
            </View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        padding: 24,
        gap: 12,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 15,
        color: modernColors.textSecondary,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 100,
        gap: 16,
    },
    videoCard: {
        gap: 16,
    },
    sectionCard: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    videoUrl: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    progressLabel: {
        fontSize: 15,
        color: modernColors.text,
        fontWeight: '600',
    },
    progressDetail: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    costValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
    },
    costHint: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    analyticsItem: {
        fontSize: 14,
        color: modernColors.text,
    },
    warningText: {
        fontSize: 13,
        color: modernColors.warning,
    },
    actions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: modernColors.background,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    shareButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        backgroundColor: modernColors.background,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.error,
    },
});

export default VideoGenerationResultScreen;
