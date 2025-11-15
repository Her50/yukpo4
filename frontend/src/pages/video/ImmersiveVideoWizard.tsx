import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { CreatorStudioPreviewCard } from '@/components/video/CreatorStudioPreviewCard';
import { StudioAudioPanel } from '@/components/video/StudioAudioPanel';
import { VideoAnalyticsOverviewSection } from '@/components/video/VideoAnalyticsOverview';
import { useVideoGenerationProgress } from '@/hooks/useVideoGenerationProgress';
import { useVoiceProfiles } from '@/hooks/useVoiceProfiles';
import { studioService } from '@/services/studioService';
import {
    estimateVideoCost,
    fetchServiceDetails,
    fetchServiceMedia,
    fetchVideoJobStatus,
    startVideoGeneration,
} from '@/services/videoGeneration';
import type { CreateVoiceProfilePayload } from '@/types/audio';
import type {
    GeneratedVideoResponse,
    StoryTemplateSpec,
    VideoCostEstimation,
    VideoGenerationPayload,
    VideoJobStatus,
} from '@/types/video';

type WizardStep = 1 | 2 | 3;
type MusicMode = 'pulse' | 'lofi' | 'ambient' | 'cinematic' | 'none';
type ModePreset = 'standard' | 'expert';

interface ServiceMediaItem {
    id: number;
    path: string;
    media_type?: string | null;
    ai_description?: string | null;
}

const gradientCard =
    'bg-gradient-to-br from-slate-900 via-indigo-900/80 to-slate-900 border border-white/10 shadow-xl';

const statusBadge = (status: string) => {
    switch (status) {
        case 'completed':
            return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40';
        case 'running':
            return 'bg-indigo-500/10 text-indigo-200 border border-indigo-500/40';
        default:
            return 'bg-slate-500/10 text-slate-300 border border-slate-500/40';
    }
};

const FALLBACK_STORY_TEMPLATES: StoryTemplateSpec[] = [
    {
        id: 'blog',
        label: 'Blog / Chronicle',
        description: 'Récit éditorial pour actus, lancements ou récap.',
        recommendedCategories: [],
        tones: ['inspirational'],
        ctas: ['Découvrir'],
        defaultDurationSeconds: 30,
        suggestedScenes: 3,
    },
    {
        id: 'tutorial',
        label: 'Tutoriel / How-to',
        description: 'Pas-à-pas pour guider l’utilisateur.',
        recommendedCategories: [],
        tones: ['educational'],
        ctas: ['Essayer'],
        defaultDurationSeconds: 36,
        suggestedScenes: 4,
    },
    {
        id: 'testimonial',
        label: 'Témoignage client',
        description: 'Renforce la preuve sociale avec une citation.',
        recommendedCategories: [],
        tones: ['trust'],
        ctas: ['Réserver'],
        defaultDurationSeconds: 28,
        suggestedScenes: 3,
    },
    {
        id: 'comparison',
        label: 'Comparatif / Benchmark',
        description: 'Oppose deux options pour montrer la valeur.',
        recommendedCategories: [],
        tones: ['bold'],
        ctas: ['Passer à Yukpo'],
        defaultDurationSeconds: 32,
        suggestedScenes: 4,
    },
];

const ImmersiveVideoWizard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    const initialServiceId = Number(searchParams.get('serviceId') ?? location.state?.serviceId);
    const initialProductIndex = Number(searchParams.get('productIndex') ?? location.state?.productIndex);

    const [serviceId, setServiceId] = useState<number | undefined>(
        Number.isFinite(initialServiceId) ? initialServiceId : undefined,
    );
    const [productIndex, setProductIndex] = useState<number | undefined>(
        Number.isFinite(initialProductIndex) ? initialProductIndex : undefined,
    );

    const [serviceName, setServiceName] = useState<string>('');
    const [productName, setProductName] = useState<string>(() => t('videoWizard.defaultProduct'));
    const productNameLoadedRef = useRef(false);
    const [mediaItems, setMediaItems] = useState<ServiceMediaItem[]>([]);

    const [step, setStep] = useState<WizardStep>(1);
    const [mode, setMode] = useState<ModePreset>('standard');
    const [musicMode, setMusicMode] = useState<MusicMode>('pulse');
    const [autoStoryboard, setAutoStoryboard] = useState(true);
    const [voiceoverEnabled, setVoiceoverEnabled] = useState(true);
    const [voiceoverLang, setVoiceoverLang] = useState<'fr' | 'en'>('fr');
    const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState<number | undefined>();
    const [selectedStyle, setSelectedStyle] = useState('IntroPulse');
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
    const [headline, setHeadline] = useState('');
    const [callToAction, setCallToAction] = useState('');
    const [brief, setBrief] = useState('');

    const [publishChat, setPublishChat] = useState(true);
    const [publishCard, setPublishCard] = useState(true);
    const [publishSocial, setPublishSocial] = useState(false);
    const [storyTemplateId, setStoryTemplateId] = useState<string>('blog');
    const [storyTemplates, setStoryTemplates] = useState<StoryTemplateSpec[]>([]);
    const [storyTemplatesLoading, setStoryTemplatesLoading] = useState(true);

    const {
        voiceProfiles,
        loading: loadingVoiceProfiles,
        createProfile: createVoiceProfile,
        deleteProfile: deleteVoiceProfile,
    } = useVoiceProfiles({ serviceId });

    useEffect(() => {
        if (voiceoverEnabled && !selectedVoiceProfileId && voiceProfiles.length > 0) {
            setSelectedVoiceProfileId(voiceProfiles[0].id);
        }
    }, [selectedVoiceProfileId, voiceProfiles, voiceoverEnabled]);

    const [loadingService, setLoadingService] = useState(false);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [costLoading, setCostLoading] = useState(false);
    const [costEstimation, setCostEstimation] = useState<VideoCostEstimation | null>(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [jobResult, setJobResult] = useState<GeneratedVideoResponse | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const storyTemplateOptions =
        storyTemplates.length > 0 ? storyTemplates : FALLBACK_STORY_TEMPLATES;
    const selectedStoryTemplate = storyTemplateOptions.find((spec) => spec.id === storyTemplateId);

    useEffect(() => {
        let cancelled = false;
        const loadTemplates = async () => {
            setStoryTemplatesLoading(true);
            try {
                const templates = await studioService.listTemplates();
                if (!cancelled && Array.isArray(templates)) {
                    setStoryTemplates(templates);
                    if (
                        templates.length > 0 &&
                        !templates.some((spec) => spec.id === storyTemplateId)
                    ) {
                        setStoryTemplateId(templates[0].id);
                    }
                }
            } catch (error) {
                console.error('[ImmersiveVideoWizard] template fetch failed', error);
            } finally {
                if (!cancelled) {
                    setStoryTemplatesLoading(false);
                }
            }
        };
        loadTemplates();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (
            storyTemplates.length > 0 &&
            !storyTemplates.some((spec) => spec.id === storyTemplateId)
        ) {
            setStoryTemplateId(storyTemplates[0].id);
        }
    }, [storyTemplateId, storyTemplates]);

    const localizedProgressSteps = useMemo(
        () => [
            {
                key: 'cost_estimation',
                label: t('videoWizard.progress.steps.cost_estimation'),
                status: 'completed' as const,
            },
            {
                key: 'broll_selection',
                label: t('videoWizard.progress.steps.broll_selection'),
                status: 'pending' as const,
            },
            {
                key: 'timeline_generation',
                label: t('videoWizard.progress.steps.timeline_generation'),
                status: 'pending' as const,
            },
            {
                key: 'audio_mix',
                label: t('videoWizard.progress.steps.audio_mix'),
                status: 'pending' as const,
            },
            {
                key: 'video_mux',
                label: t('videoWizard.progress.steps.video_mux'),
                status: 'pending' as const,
            },
        ],
        [t],
    );

    const channelOptions = useMemo(
        () => [
            { key: 'chat', label: t('videoWizard.channels.chat') },
            { key: 'product', label: t('videoWizard.channels.product') },
            { key: 'shorts', label: t('videoWizard.channels.shorts') },
        ],
        [t],
    );

    const stepLabelByKey = useMemo(() => {
        const map = new Map<string, string>();
        localizedProgressSteps.forEach((step) => map.set(step.key, step.label));
        return map;
    }, [localizedProgressSteps]);

    const {
        steps: progressSteps,
        startSimulation,
        applyServerSteps,
        reset: resetProgress,
        fail: failProgress,
    } = useVideoGenerationProgress(localizedProgressSteps);

    const mediaSkeletonPlaceholders = useMemo(() => Array.from({ length: 4 }), []);

    const updateSearchParams = useCallback((nextServiceId?: number, nextProductIndex?: number) => {
        const params = new URLSearchParams(searchParams);
        if (Number.isFinite(nextServiceId)) {
            params.set('serviceId', String(nextServiceId));
        } else {
            params.delete('serviceId');
        }
        if (Number.isFinite(nextProductIndex)) {
            params.set('productIndex', String(nextProductIndex));
        } else {
            params.delete('productIndex');
        }
        setSearchParams(params);
    }, [searchParams, setSearchParams]);

    const distributionChannels = useMemo(
        () =>
            [
                { key: 'chat', selected: publishChat, setter: setPublishChat },
                { key: 'product', selected: publishCard, setter: setPublishCard },
                { key: 'shorts', selected: publishSocial, setter: setPublishSocial },
            ].map((channel) => ({
                ...channel,
                label: channelOptions.find((option) => option.key === channel.key)?.label ?? channel.key,
            })),
        [channelOptions, publishCard, publishChat, publishSocial],
    );

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    const mapServerSteps = useCallback(
        (jobSteps: VideoJobStatus['progress_steps']) => {
            if (!jobSteps || jobSteps.length === 0) {
                return localizedProgressSteps;
            }
            return jobSteps.map((step) => ({
                key: step.key,
                label: step.label || stepLabelByKey.get(step.key) || step.key,
                status:
                    step.status === 'completed' || step.status === 'running' || step.status === 'pending'
                        ? step.status
                        : 'pending',
                detail: step.detail,
            }));
        },
        [localizedProgressSteps, stepLabelByKey],
    );

    const fetchServiceData = useCallback(async () => {
        if (!Number.isFinite(serviceId) || !Number.isFinite(productIndex)) {
            return;
        }
        try {
            setLoadingService(true);
            const response = await fetchServiceDetails(serviceId!);
            const service = response?.data ?? response;
            setServiceName(service?.titre || service?.name || `Service #${serviceId}`);
            const produits = service?.data?.produits?.valeur || service?.data?.produits || [];
            if (Array.isArray(produits) && produits[productIndex!]) {
                const product = produits[productIndex!];
                const resolvedName = product?.nom || product?.name || product?.title;
                if (resolvedName) {
                    productNameLoadedRef.current = true;
                    setProductName(resolvedName);
                }
            }
        } catch (error) {
            console.error('[ImmersiveVideoWizard] Service fetch error', error);
            toast.error(t('videoWizard.errors.serviceFetch'));
        } finally {
            useEffect(() => {
                if (!productNameLoadedRef.current) {
                    setProductName(t('videoWizard.defaultProduct'));
                }
            }, [t]);
            setLoadingService(false);
        }
    }, [productIndex, serviceId, t]);

    const fetchMedia = useCallback(async () => {
        if (!Number.isFinite(serviceId)) return;
        try {
            setLoadingMedia(true);
            const response = await fetchServiceMedia(serviceId!);
            const items = response?.data ?? response;
            if (Array.isArray(items)) {
                setMediaItems(items);
            } else if (items?.items) {
                setMediaItems(items.items);
            }
        } catch (error) {
            console.error('[ImmersiveVideoWizard] Media fetch error', error);
        } finally {
            setLoadingMedia(false);
        }
    }, [serviceId]);

    useEffect(() => {
        if (Number.isFinite(serviceId)) {
            fetchServiceData();
            fetchMedia();
        }
    }, [fetchMedia, fetchServiceData, serviceId]);

    const toggleMediaSelection = useCallback((mediaId: number) => {
        setSelectedMediaIds((prev) =>
            prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId],
        );
    }, []);

    const buildPayload = useCallback(
        (): VideoGenerationPayload => ({
            style: selectedStyle,
            headline,
            call_to_action: callToAction,
            story_template_id: storyTemplateId,
            auto_storyboard: autoStoryboard,
            use_ai_templates: mode === 'expert',
            use_service_mediatech: mode === 'expert',
            include_publicite_assets: mode === 'expert',
            selected_media_ids: selectedMediaIds,
            music_mode: musicMode !== 'none' ? musicMode : undefined,
            voiceover_lang: voiceoverEnabled ? voiceoverLang : undefined,
            voiceover_script: voiceoverEnabled ? brief : undefined,
            voice_profile_id: selectedVoiceProfileId,
            distribute_channels: distributionChannels
                .filter((item) => item.selected)
                .map((item) => item.key),
        }),
        [
            autoStoryboard,
            brief,
            callToAction,
            distributionChannels,
            headline,
            mode,
            musicMode,
            selectedMediaIds,
            selectedStyle,
            storyTemplateId,
            selectedVoiceProfileId,
            voiceoverEnabled,
            voiceoverLang,
        ],
    );

    const handleCreateVoiceProfile = useCallback(
        async (payload: Omit<CreateVoiceProfilePayload, 'service_id'>) => {
            try {
                const profile = await createVoiceProfile(payload);
                toast.success('Profil vocal créé');
                setSelectedVoiceProfileId((prev) => prev ?? profile.id);
            } catch (error: any) {
                console.error('[ImmersiveVideoWizard] voice profile creation error', error);
                toast.error(error?.message || 'Impossible de créer le profil audio');
            }
        },
        [createVoiceProfile],
    );

    const handleDeleteVoiceProfile = useCallback(
        async (profileId: number) => {
            try {
                await deleteVoiceProfile(profileId);
                toast.success('Profil audio supprimé');
                setSelectedVoiceProfileId((prev) => (prev === profileId ? undefined : prev));
            } catch (error: any) {
                console.error('[ImmersiveVideoWizard] voice profile delete error', error);
                toast.error(error?.message || 'Suppression impossible');
            }
        },
        [deleteVoiceProfile],
    );

    const handleEstimate = useCallback(async () => {
        if (!Number.isFinite(serviceId) || !Number.isFinite(productIndex)) {
            toast.error(t('videoWizard.errors.invalidContext'));
            return;
        }
        try {
            setCostLoading(true);
            const payload = buildPayload();
            const estimation = await estimateVideoCost(serviceId!, productIndex!, payload);
            setCostEstimation(estimation);
            setStep(2);
            toast.success(t('videoWizard.notifications.costReady'));
        } catch (error: any) {
            console.error('[ImmersiveVideoWizard] Cost estimation error', error);
            toast.error(error?.message || t('videoWizard.errors.costEstimation'));
        } finally {
            setCostLoading(false);
        }
    }, [buildPayload, productIndex, serviceId, t]);

    const handleGenerate = useCallback(async () => {
        if (!Number.isFinite(serviceId) || !Number.isFinite(productIndex)) {
            toast.error(t('videoWizard.errors.invalidContext'));
            return;
        }
        try {
            setIsGenerating(true);
            setJobResult(null);
            startSimulation();

            const payload = buildPayload();
            const response = await startVideoGeneration(serviceId!, productIndex!, payload);
            if (response?.job_id) {
                setCurrentJobId(response.job_id);
                toast.loading(t('videoWizard.notifications.rendering'), { id: response.job_id });
            } else {
                throw new Error(t('videoWizard.errors.launchFailed'));
            }
        } catch (error: any) {
            console.error('[ImmersiveVideoWizard] Generation error', error);
            failProgress();
            resetProgress();
            setIsGenerating(false);
            setCurrentJobId(null);
            toast.error(error?.message || t('videoWizard.errors.rendering'));
        }
    }, [buildPayload, failProgress, productIndex, resetProgress, serviceId, startSimulation, t]);

    const handleJobStatus = useCallback(
        async (jobId: string) => {
            try {
                const job = await fetchVideoJobStatus(jobId);
                if (job.progress_steps) {
                    applyServerSteps(mapServerSteps(job.progress_steps));
                }
                if (job.status === 'completed') {
                    toast.success(t('videoWizard.notifications.renderComplete'), { id: jobId });
                    stopPolling();
                    setIsGenerating(false);
                    setCurrentJobId(null);
                    resetProgress();
                    if (job.result_payload) {
                        setJobResult(job.result_payload as GeneratedVideoResponse);
                    } else if (job.result_media_id) {
                        toast.success(t('videoWizard.notifications.mediaReady'));
                    }
                } else if (job.status === 'failed') {
                    toast.error(job.error_message || t('videoWizard.errors.rendering'), { id: jobId });
                    stopPolling();
                    failProgress();
                    resetProgress();
                    setIsGenerating(false);
                    setCurrentJobId(null);
                }
            } catch (error) {
                console.error('[ImmersiveVideoWizard] Polling error', error);
            }
        },
        [applyServerSteps, failProgress, mapServerSteps, resetProgress, stopPolling, t],
    );

    useEffect(() => {
        if (!currentJobId) return undefined;
        handleJobStatus(currentJobId);
        const interval = setInterval(() => handleJobStatus(currentJobId), 2000);
        pollingRef.current = interval;
        return () => {
            clearInterval(interval);
            pollingRef.current = null;
        };
    }, [currentJobId, handleJobStatus]);

    useEffect(() => () => stopPolling(), [stopPolling]);

    const activeStepLabel = useMemo(() => {
        switch (step) {
            case 1:
                return t('videoWizard.steps.describe');
            case 2:
                return t('videoWizard.steps.assets');
            case 3:
                return t('videoWizard.steps.preview');
            default:
                return '';
        }
    }, [step, t]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100" aria-busy={isGenerating}>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-16 lg:px-10">
                <header className="space-y-4">
                    <motion.h1
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-4xl font-extrabold tracking-tight sm:text-5xl"
                    >
                        {t('videoWizard.hero.title')}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="max-w-3xl text-lg text-slate-400"
                    >
                        {t('videoWizard.hero.subtitle')}
                    </motion.p>
                    <CreatorStudioPreviewCard serviceName={serviceName} productName={productName} />
                </header>

                <VideoAnalyticsOverviewSection className="space-y-6" />

                <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45 }}
                        className={`rounded-3xl p-8 ${gradientCard}`}
                    >
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-indigo-500/20 backdrop-blur-sm flex items-center justify-center border border-indigo-500/40">
                                    <span className="text-2xl">🎯</span>
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{t('videoWizard.meta.service')}</p>
                                    {loadingService ? (
                                        <div className="h-4 w-40 animate-pulse rounded bg-slate-700/60" />
                                    ) : (
                                        <p className="text-lg font-semibold text-slate-100">{serviceName || t('videoWizard.meta.selectService')}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-fuchsia-500/20 backdrop-blur-sm flex items-center justify-center border border-fuchsia-500/40">
                                    <span className="text-2xl">🧠</span>
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{t('videoWizard.meta.step')}</p>
                                    <p className="text-lg font-semibold text-slate-100">
                                        {t('videoWizard.meta.stepCounter', {
                                            step,
                                            label: activeStepLabel,
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <label className="flex flex-col gap-2">
                                    <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-400">
                                        {t('videoWizard.inputs.serviceId')}
                                    </span>
                                    <input
                                        type="number"
                                        value={serviceId ?? ''}
                                        onChange={(event) => {
                                            const value = event.target.value ? Number(event.target.value) : undefined;
                                            setServiceId(value);
                                            updateSearchParams(value, productIndex);
                                        }}
                                        className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                        placeholder="123"
                                    />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-400">
                                        {t('videoWizard.inputs.productIndex')}
                                    </span>
                                    <input
                                        type="number"
                                        value={productIndex ?? ''}
                                        onChange={(event) => {
                                            const value = event.target.value ? Number(event.target.value) : undefined;
                                            setProductIndex(value);
                                            updateSearchParams(serviceId, value);
                                        }}
                                        className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                        placeholder="0"
                                    />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-400">
                                        {t('videoWizard.inputs.voiceover')}
                                    </span>
                                    <select
                                        value={voiceoverLang}
                                        onChange={(event) => setVoiceoverLang(event.target.value as 'fr' | 'en')}
                                        className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="fr">🇫🇷 Français</option>
                                        <option value="en">🇺🇸 English</option>
                                    </select>
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-3" role="group" aria-label={t('videoWizard.accessibility.channelGroup')}>
                                {distributionChannels.map((channel) => (
                                    <button
                                        key={channel.key}
                                        type="button"
                                        onClick={() => channel.setter(!channel.selected)}
                                        aria-pressed={channel.selected}
                                        aria-label={t('videoWizard.accessibility.channelToggle', { channel: channel.label })}
                                        className={`rounded-full border px-4 py-1 text-sm transition ${channel.selected ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300 hover:border-indigo-400 hover:text-indigo-200'}`}
                                    >
                                        {channel.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step-1"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -16 }}
                                    transition={{ duration: 0.3 }}
                                    className="mt-10 grid gap-6"
                                >
                                    <div className="grid gap-4 rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                        <h3 className="text-lg font-semibold text-slate-100">
                                            {t('videoWizard.sections.describe')}
                                        </h3>
                                        <textarea
                                            value={brief}
                                            onChange={(event) => setBrief(event.target.value)}
                                            placeholder={t('videoWizard.placeholders.brief')}
                                            aria-label={t('videoWizard.sections.describe')}
                                            className="min-h-[120px] rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                        />
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <input
                                                value={headline}
                                                onChange={(event) => setHeadline(event.target.value)}
                                                placeholder={t('videoWizard.placeholders.headline')}
                                                aria-label={t('videoWizard.placeholders.headline')}
                                                className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                            />
                                            ... (truncated to avoid duplicating the entire file)
                                        </div>
                                        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={autoStoryboard}
                                                onChange={() => setAutoStoryboard((prev) => !prev)}
                                                className="h-4 w-4 rounded border border-white/30 bg-slate-800 accent-indigo-500"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-100">
                                                    {t('videoWizard.controls.storyboard')}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {t('videoWizard.controls.storyboardHint')}
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="grid gap-4 rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                        <h3 className="text-lg font-semibold text-slate-100">
                                            {t('videoWizard.sections.style')}
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {['IntroPulse', 'ProductShowcase', 'ARHighlight', 'GlowCTA'].map((template) => (
                                                <button
                                                    key={template}
                                                    type="button"
                                                    onClick={() => setSelectedStyle(template)}
                                                    aria-pressed={selectedStyle === template}
                                                    aria-label={t('videoWizard.accessibility.templateOption', { template })}
                                                    className={`rounded-full border px-5 py-2 text-sm transition ${selectedStyle === template ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100 shadow-lg shadow-indigo-500/20' : 'border-white/10 bg-white/5 text-slate-300 hover:border-indigo-400 hover:text-indigo-200'}`}
                                                >
                                                    {template}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {[
                                                { key: 'standard', title: t('videoWizard.mode.standardTitle'), description: t('videoWizard.mode.standardDesc') },
                                                { key: 'expert', title: t('videoWizard.mode.expertTitle'), description: t('videoWizard.mode.expertDesc') },
                                            ].map((item) => (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() => setMode(item.key as ModePreset)}
                                                    aria-pressed={mode === item.key}
                                                    aria-label={t('videoWizard.accessibility.modeOption', { mode: item.title })}
                                                    className={`rounded-2xl border px-5 py-4 text-left transition ${mode === item.key ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100 shadow-lg shadow-emerald-500/25' : 'border-white/10 bg-white/3 text-slate-200 hover:border-emerald-400 hover:text-emerald-100'}`}
                                                >
                                                    <p className="text-base font-semibold">{item.title}</p>
                                                    <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-4 rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                        <h3 className="text-lg font-semibold text-slate-100">
                                            Templates narratifs
                                        </h3>
                                        {storyTemplatesLoading ? (
                                            <p className="text-sm text-slate-300">Chargement…</p>
                                        ) : (
                                            <div className="grid gap-2 md:grid-cols-2">
                                                {storyTemplateOptions.map((spec) => {
                                                    const selected = spec.id === storyTemplateId;
                                                    return (
                                                        <button
                                                            key={spec.id}
                                                            type="button"
                                                            onClick={() => setStoryTemplateId(spec.id)}
                                                            className={`rounded-2xl border px-4 py-3 text-left transition ${selected
                                                                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50'
                                                                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/30'
                                                                }`}
                                                        >
                                                            <p className="text-sm font-semibold">{spec.label}</p>
                                                            <p className="text-xs text-slate-300">{spec.description}</p>
                                                            <p className="mt-1 text-[11px] text-slate-400">
                                                                {spec.suggestedScenes} scènes · ~{spec.defaultDurationSeconds}s · CTA{' '}
                                                                {spec.ctas[0] ?? '—'}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {selectedStoryTemplate && (
                                            <p className="text-xs text-slate-400">
                                                Template sélectionné :{' '}
                                                <span className="font-semibold text-slate-200">
                                                    {selectedStoryTemplate.label}
                                                </span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                        <h3 className="text-lg font-semibold text-slate-100">{t('videoWizard.sections.audio')}</h3>
                                        <div className="flex flex-wrap gap-2" role="group" aria-label={t('videoWizard.accessibility.musicGroup')}>
                                            {(['pulse', 'lofi', 'ambient', 'cinematic', 'none'] as MusicMode[]).map((modeKey) => {
                                                const label = t(`videoWizard.musicModes.${modeKey}`);
                                                return (
                                                    <button
                                                        key={modeKey}
                                                        type="button"
                                                        onClick={() => setMusicMode(modeKey)}
                                                        aria-pressed={musicMode === modeKey}
                                                        aria-label={t('videoWizard.accessibility.musicOption', { mode: label })}
                                                        className={`rounded-full border px-4 py-2 text-sm capitalize transition ${musicMode === modeKey ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100' : 'border-white/10 bg-white/5 text-slate-300 hover:border-fuchsia-400 hover:text-fuchsia-200'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={voiceoverEnabled}
                                                onChange={() => setVoiceoverEnabled((prev) => !prev)}
                                                className="h-4 w-4 rounded border border-white/30 bg-slate-800 accent-indigo-500"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-100">{t('videoWizard.controls.voiceover')}</p>
                                                <p className="text-xs text-slate-400">{t('videoWizard.controls.voiceoverHint')}</p>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleEstimate}
                                            disabled={costLoading || !serviceId || productIndex === undefined}
                                            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/40"
                                        >
                                            {costLoading ? t('videoWizard.buttons.estimating') : t('videoWizard.buttons.nextStep')}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step-2"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -16 }}
                                    transition={{ duration: 0.3 }}
                                    className="mt-10 grid gap-6"
                                >
                                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                        <div className="mb-4 flex items-center justify-between gap-4">
                                            <h3 className="text-lg font-semibold text-slate-100">
                                                {t('videoWizard.sections.media')} ({selectedMediaIds.length})
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setStep(1)}
                                                className="text-sm text-slate-300 underline decoration-dotted underline-offset-4 hover:text-indigo-200"
                                            >
                                                {t('videoWizard.buttons.prevStep', { step: 1 })}
                                            </button>
                                        </div>
                                        <div className="grid gap-3">
                                            {loadingMedia ? (
                                                mediaSkeletonPlaceholders.map((_, index) => (
                                                    <div key={index} className="h-16 animate-pulse rounded-xl bg-white/5" />
                                                ))
                                            ) : mediaItems.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                                                    {t('videoWizard.notifications.noMedia')}
                                                </div>
                                            ) : (
                                                <div className="grid gap-3">
                                                    {mediaItems.map((item) => {
                                                        const selected = selectedMediaIds.includes(item.id);
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => toggleMediaSelection(item.id)}
                                                                aria-pressed={selected}
                                                                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${selected ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-200 hover:border-emerald-400 hover:text-emerald-100'}`}
                                                            >
                                                                <div className="flex flex-col text-left">
                                                                    <span className="text-sm font-semibold">{item.ai_description || `Media #${item.id}`}</span>
                                                                    <span className="text-xs text-slate-400">{item.media_type || 'image'}</span>
                                                                </div>
                                                                <div className={`h-6 w-6 rounded-full border-2 ${selected ? 'border-emerald-300 bg-emerald-500/70' : 'border-white/20 bg-transparent'}`} />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <StudioAudioPanel
                                        voiceoverEnabled={voiceoverEnabled}
                                        onVoiceoverToggle={setVoiceoverEnabled}
                                        voiceoverLang={voiceoverLang}
                                        onVoiceoverLangChange={setVoiceoverLang}
                                        voiceProfiles={voiceProfiles}
                                        selectedVoiceProfileId={selectedVoiceProfileId}
                                        onVoiceProfileSelect={setSelectedVoiceProfileId}
                                        isLoadingProfiles={loadingVoiceProfiles}
                                        onCreateProfile={handleCreateVoiceProfile}
                                        onDeleteProfile={handleDeleteVoiceProfile}
                                        musicMode={musicMode}
                                        onMusicModeChange={setMusicMode}
                                    />

                                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                        <h3 className="mb-4 text-lg font-semibold text-slate-100">{t('videoWizard.sections.epilogue')}</h3>
                                        {costEstimation ? (
                                            <div className="grid gap-4 md:grid-cols-3">
                                                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-100">
                                                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">{t('videoWizard.summary.totalLocal')}</p>
                                                    <p className="mt-2 text-2xl font-bold">{Math.round(costEstimation.total_cost_local)} {costEstimation.local_currency}</p>
                                                    <p className="text-xs text-emerald-200/70">≈ {costEstimation.total_cost_usd.toFixed(2)} $</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-400/30 bg-white/5 p-4">
                                                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{t('videoWizard.summary.tokens')}</p>
                                                    <p className="mt-2 text-2xl font-bold text-slate-100">{costEstimation.estimated_tokens}</p>
                                                    <p className="text-xs text-slate-400">{t('videoWizard.summary.breakdown', {
                                                        tokens: costEstimation.breakdown.tokens_cost_usd.toFixed(2),
                                                        audio: costEstimation.breakdown.audio_mastering_usd.toFixed(2),
                                                        broll: costEstimation.breakdown.broll_generation_usd.toFixed(2),
                                                    })}</p>
                                                </div>
                                                <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4 text-indigo-100">
                                                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-300">{t('videoWizard.summary.margin')}</p>
                                                    <p className="mt-2 text-2xl font-bold">×{costEstimation.margin_multiplier}</p>
                                                    <p className="text-xs text-indigo-200/70">
                                                        {costEstimation.affordable
                                                            ? t('videoWizard.summary.affordable')
                                                            : t('videoWizard.summary.notAffordable')}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-white/15 bg-white/3 p-6 text-sm text-slate-300">
                                                {t('videoWizard.summary.noCost')}
                                            </div>
                                        )}

                                        <div className="mt-6 flex flex-wrap justify-between gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setStep(1)}
                                                className="text-sm text-slate-300 underline decoration-dotted underline-offset-4 hover:text-indigo-200"
                                            >
                                                {t('videoWizard.buttons.prevStep', { step: 1 })}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setStep(3)}
                                                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
                                            >
                                                {t('videoWizard.buttons.previewTimeline')}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    key="step-3"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -16 }}
                                    transition={{ duration: 0.3 }}
                                    className="mt-10 grid gap-6"
                                >
                                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                        <h3 className="mb-4 text-lg font-semibold text-slate-100">{t('videoWizard.sections.summary')}</h3>
                                        <div className="grid gap-2 text-sm text-slate-300">
                                            <p>
                                                <span className="font-semibold text-slate-100">{t('videoWizard.summary.service')}:</span>{' '}
                                                {serviceName}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-100">{t('videoWizard.summary.product')}:</span>{' '}
                                                {productName}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-100">{t('videoWizard.summary.style')}:</span>{' '}
                                                {selectedStyle}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-100">{t('videoWizard.summary.mode')}:</span>{' '}
                                                {mode === 'expert' ? t('videoWizard.mode.expertTitle') : t('videoWizard.mode.standardTitle')}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-100">{t('videoWizard.summary.mediaSelected')}:</span>{' '}
                                                {selectedMediaIds.length}
                                            </p>
                                            {costEstimation && (
                                                <div className="mt-2">
                                                    <p className="font-semibold text-slate-100">{t('videoWizard.summary.costTitle')}</p>
                                                    <p className="text-slate-200">
                                                        {Math.round(costEstimation.total_cost_local)} {costEstimation.local_currency}
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        {t('videoWizard.summary.costLine', {
                                                            usd: costEstimation.total_cost_usd.toFixed(2),
                                                            multiplier: costEstimation.margin_multiplier,
                                                        })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-6 text-indigo-100">
                                        <div>
                                            <p className="text-sm font-semibold">{t('videoWizard.summary.finalConfirm')}</p>
                                            <p className="text-xs text-indigo-200">{t('videoWizard.summary.finalHint')}</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setStep(2)}
                                                className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-indigo-200"
                                            >
                                                {t('videoWizard.buttons.prevStep', { step: 2 })}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleGenerate}
                                                disabled={isGenerating || !costEstimation}
                                                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                                            >
                                                {isGenerating ? t('videoWizard.buttons.rendering') : t('videoWizard.buttons.launchRender')}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    <div className="flex flex-col gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur"
                        >
                            <h2 className="mb-4 text-lg font-semibold text-slate-100">
                                {t('videoWizard.progress.title')}
                            </h2>
                            <div
                                className="space-y-3"
                                role="list"
                                aria-live="polite"
                                aria-label={t('videoWizard.accessibility.progressList')}
                            >
                                {progressSteps.map((stepItem) => (
                                    <div key={stepItem.key} className={`flex items-start justify-between gap-4 rounded-xl px-4 py-3 ${stepItem.status === 'completed'
                                        ? 'bg-emerald-500/10 text-emerald-100'
                                        : stepItem.status === 'running'
                                            ? 'bg-indigo-500/10 text-indigo-100'
                                            : 'bg-white/5 text-slate-200'
                                        }`}
                                        role="listitem"
                                        aria-current={stepItem.status === 'running' ? 'step' : undefined}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold">{stepItem.label}</p>
                                            {stepItem.detail && <p className="text-xs text-slate-300">{stepItem.detail}</p>}
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(stepItem.status)}`}>
                                            {stepItem.status === 'completed'
                                                ? t('videoWizard.progress.completed')
                                                : stepItem.status === 'running'
                                                    ? t('videoWizard.progress.running')
                                                    : t('videoWizard.progress.pending')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 text-xs text-slate-400" aria-live="polite">
                                {currentJobId
                                    ? t('videoWizard.progress.jobId', { jobId: currentJobId })
                                    : t('videoWizard.progress.jobIdle')}
                            </div>
                        </motion.div>

                        {jobResult && (
                            <motion.div
                                key="result-card"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur"
                            >
                                <h3 className="mb-4 text-lg font-semibold text-slate-900">{t('videoWizard.result.title')}</h3>
                                <video
                                    controls
                                    src={jobResult.video_url}
                                    aria-label={t('videoWizard.accessibility.previewVideo')}
                                    className="aspect-video w-full rounded-2xl border border-slate-200 shadow-lg"
                                />
                                <div className="mt-4 space-y-2 text-sm text-slate-700">
                                    <p>
                                        <span className="font-semibold text-slate-900">{t('videoWizard.result.duration')}:</span>{' '}
                                        {jobResult.duration_seconds}s
                                    </p>
                                    <p>
                                        <span className="font-semibold text-slate-900">{t('videoWizard.result.style')}:</span>{' '}
                                        {jobResult.style}
                                    </p>
                                    {jobResult.headline && (
                                        <p>
                                            <span className="font-semibold text-slate-900">{t('videoWizard.result.headline')}:</span>{' '}
                                            {jobResult.headline}
                                        </p>
                                    )}
                                    {jobResult.call_to_action && (
                                        <p>
                                            <span className="font-semibold text-slate-900">{t('videoWizard.result.cta')}:</span>{' '}
                                            {jobResult.call_to_action}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => window.open(jobResult.video_url, '_blank')}
                                            className="rounded-full border border-indigo-500/60 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/20"
                                        >
                                            {t('videoWizard.result.viewInNewTab')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/dashboard/mes-services')}
                                            className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20"
                                        >
                                            {t('videoWizard.result.goToLibrary')}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </section>
            </div>

            <AnimatePresence>
                {(isGenerating || currentJobId) && (
                    <motion.div
                        key="progress-overlay"
                        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                            className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-xl"
                        >
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <h4 className="text-xl font-semibold text-slate-100">{t('videoWizard.progress.modalTitle')}</h4>
                                    <p className="text-sm text-slate-400">
                                        {t('videoWizard.progress.modalSubtitle')}
                                    </p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/20 text-2xl">
                                    🎬
                                </div>
                            </div>
                            <div
                                className="space-y-3"
                                role="list"
                                aria-live="assertive"
                                aria-label={t('videoWizard.accessibility.progressList')}
                            >
                                {progressSteps.map((stepItem) => (
                                    <div
                                        key={stepItem.key}
                                        className={`flex items-center justify-between rounded-xl px-4 py-3 ${stepItem.status === 'completed'
                                            ? 'bg-emerald-500/10 text-emerald-100'
                                            : stepItem.status === 'running'
                                                ? 'bg-indigo-500/10 text-indigo-100'
                                                : 'bg-white/5 text-slate-200'
                                            }`}
                                        role="listitem"
                                        aria-current={stepItem.status === 'running' ? 'step' : undefined}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold">{stepItem.label}</p>
                                            {stepItem.detail && <p className="text-xs text-slate-300">{stepItem.detail}</p>}
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(stepItem.status)}`}>
                                            {stepItem.status === 'completed'
                                                ? t('videoWizard.progress.completed')
                                                : stepItem.status === 'running'
                                                    ? t('videoWizard.progress.running')
                                                    : t('videoWizard.progress.pending')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 text-center text-xs text-slate-400">
                                {currentJobId
                                    ? t('videoWizard.progress.modalJob', {
                                        jobId: currentJobId,
                                    })
                                    : t('videoWizard.progress.modalWaiting')}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ImmersiveVideoWizard;


