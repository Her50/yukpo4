import { AnimatePresence, motion } from 'framer-motion';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type TouchEvent,
} from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { CreatorStudioPreviewCard } from '@/components/video/CreatorStudioPreviewCard';
import { StudioAudioPanel } from '@/components/video/StudioAudioPanel';
import { VideoAnalyticsOverviewSection } from '@/components/video/VideoAnalyticsOverview';
import { useFeatureFlags } from '@/context';
import { useVideoGenerationProgress } from '@/hooks/useVideoGenerationProgress';
import { useVoiceProfiles } from '@/hooks/useVoiceProfiles';
import { studioService, type Storyboard, type StoryboardRequest } from '@/services/studioService';
import { trackUxEvent } from '@/services/uxMetrics';
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

interface TimelineScenePreviewProps {
    sceneIndex: number;
    totalScenes: number;
    templateLabel?: string;
    estimatedSceneDuration: number;
    stylePack: 'pulse' | 'story' | 'corporate';
    headline: string;
    callToAction: string;
}

const TimelineScenePreview = ({
    sceneIndex,
    totalScenes,
    templateLabel,
    estimatedSceneDuration,
    stylePack,
    headline,
    callToAction,
}: TimelineScenePreviewProps) => {
    const accentRingClass =
        stylePack === 'pulse'
            ? 'from-fuchsia-500/40 via-indigo-500/40 to-sky-400/30'
            : stylePack === 'story'
                ? 'from-amber-400/40 via-rose-400/30 to-indigo-400/30'
                : 'from-slate-500/40 via-sky-500/30 to-emerald-400/30';

    const templateText =
        templateLabel ??
        (stylePack === 'pulse'
            ? 'Pulse social'
            : stylePack === 'story'
                ? 'Story éditoriale'
                : 'Corporate clair');

    return (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/80 to-slate-950/90 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative h-9 w-9">
                        <div className="absolute inset-0 rounded-full bg-slate-900" />
                        <motion.div
                            key={sceneIndex}
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                            className={`absolute inset-0 rounded-full bg-gradient-to-br ${accentRingClass} shadow-[0_0_20px_rgba(148,163,253,0.55)]`}
                        />
                        <div className="relative flex h-full w-full items-center justify-center rounded-full border border-white/20 text-xs font-semibold text-slate-50">
                            S{sceneIndex + 1}
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Timeline Yukpo
                        </p>
                        <p className="text-sm font-semibold text-slate-50">
                            {templateText} · ~{Math.round(estimatedSceneDuration || 8)}s
                        </p>
                    </div>
                </div>
                <p className="text-[11px] text-slate-400">
                    {sceneIndex + 1}/{totalScenes}
                </p>
            </div>
            <motion.div
                key={`preview-body-${sceneIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200"
            >
                <p className="line-clamp-1 font-semibold">
                    {headline || 'Accroche Yukpo générée à partir du brief'}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                    {callToAction ||
                        'CTA et overlays adaptés à ton service, prêts à être synchronisés sur les beats.'}
                </p>
            </motion.div>
        </div>
    );
};

const ImmersiveVideoWizard = () => {
    const { isEnabled } = useFeatureFlags();
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
    const [stylePack, setStylePack] = useState<'pulse' | 'story' | 'corporate'>('pulse');
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

    type SceneDraft = {
        id: string;
        optional: boolean;
    };

    const [scenesDraft, setScenesDraft] = useState<SceneDraft[]>([]);
    const [sceneAssignments, setSceneAssignments] = useState<Record<string, number | null>>({});
    const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
    const [scrubPosition, setScrubPosition] = useState<number>(0);
    const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
    const [storyboardLoading, setStoryboardLoading] = useState(false);
    const [studioSessionId, setStudioSessionId] = useState<string | null>(null);
    const [prewarmedShortPreviewUrl, setPrewarmedShortPreviewUrl] = useState<string | null>(null);
    const [shortPreviewLoading, setShortPreviewLoading] = useState(false);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const uxWizardOpenedRef = useRef(false);
    const shortPreviewPrewarmRef = useRef(false);

    const storyTemplateOptions =
        storyTemplates.length > 0 ? storyTemplates : FALLBACK_STORY_TEMPLATES;
    const selectedStoryTemplate = storyTemplateOptions.find((spec) => spec.id === storyTemplateId);

    const effectiveScenesCount = useMemo(() => {
        if (selectedStoryTemplate?.suggestedScenes && selectedStoryTemplate.suggestedScenes > 0) {
            return selectedStoryTemplate.suggestedScenes;
        }
        return 3;
    }, [selectedStoryTemplate]);

    useEffect(() => {
        if (uxWizardOpenedRef.current) {
            return;
        }
        uxWizardOpenedRef.current = true;
        trackUxEvent('wizard_open', {
            device: 'web',
            serviceId: serviceId,
            productIndex: productIndex,
            step,
        });
    }, [productIndex, serviceId, step]);

    // Auto-assign de médias par défaut aux scènes (réduction de gestes)
    useEffect(() => {
        if (!mediaItems.length || !scenesDraft.length) {
            return;
        }
        setSceneAssignments((prev) => {
            // Ne pas écraser les choix de l'utilisateur si des assignations existent déjà
            if (Object.keys(prev).length > 0) {
                return prev;
            }
            const next: Record<string, number | null> = { ...prev };
            let mediaIndex = 0;
            const uniqueMediaIds = Array.from(
                new Set(
                    mediaItems
                        .filter((m) => typeof m.id === 'number')
                        .map((m) => m.id),
                ),
            );
            if (!uniqueMediaIds.length) {
                return prev;
            }

            for (const scene of scenesDraft) {
                if (next[scene.id] != null) {
                    continue;
                }
                const mediaId = uniqueMediaIds[mediaIndex % uniqueMediaIds.length];
                next[scene.id] = mediaId;
                mediaIndex += 1;
            }
            return next;
        });
    }, [mediaItems, scenesDraft]);

    useEffect(() => {
        if (effectiveScenesCount <= 0) {
            setScenesDraft([]);
            setSceneAssignments({});
            setCurrentSceneIndex(0);
            setScrubPosition(0);
            return;
        }

        const nextScenes: SceneDraft[] = Array.from({ length: effectiveScenesCount }).map(
            (_, index) => ({
                id: `scene-${index}`,
                optional: false,
            }),
        );
        setScenesDraft(nextScenes);
        setCurrentSceneIndex(0);
        setScrubPosition(0);
        setSceneAssignments({});
    }, [effectiveScenesCount]);

    const totalEstimatedDuration = useMemo(() => {
        if (!selectedStoryTemplate || effectiveScenesCount <= 0) {
            return 0;
        }
        return selectedStoryTemplate.defaultDurationSeconds;
    }, [effectiveScenesCount, selectedStoryTemplate]);

    const estimatedSceneDuration = useMemo(() => {
        if (!totalEstimatedDuration || effectiveScenesCount <= 0) {
            return 0;
        }
        return totalEstimatedDuration / effectiveScenesCount;
    }, [effectiveScenesCount, totalEstimatedDuration]);

    const ensureStudioSession = useCallback(async (): Promise<string | null> => {
        if (studioSessionId) {
            return studioSessionId;
        }
        try {
            const payload = {
                service_id: serviceId,
                brief: { raw: brief },
                metadata: {
                    product_name: productName,
                },
                distribution_plan: [],
            } satisfies StoryboardRequest | any;
            const session = await studioService.createSession(payload);
            setStudioSessionId(session.session.id);
            return session.session.id;
        } catch (error) {
            console.error('[ImmersiveVideoWizard] unable to create studio session for storyboard', error);
            toast.error(t('videoWizard.errors.storyboardSession') || 'Session storyboard indisponible');
            return null;
        }
    }, [brief, productName, serviceId, studioSessionId, t]);

    const buildStoryboardRequest = useCallback((): StoryboardRequest => {
        const outlineSource =
            brief.trim().length > 0
                ? brief
                    .split(/[\n\.!?]/)
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0)
                : [t('videoWizard.placeholders.brief') || 'Mettre en avant ton service en 3 scènes'];

        const script_outline = outlineSource.slice(0, 6);

        return {
            script_outline,
            product_name: productName || t('videoWizard.defaultProduct'),
            headline: headline || undefined,
            call_to_action: callToAction || undefined,
            style: stylePack,
            duration_seconds: totalEstimatedDuration || selectedStoryTemplate?.defaultDurationSeconds || 28,
            template_id: storyTemplateId,
            business_context: undefined,
            ai_hints: [],
        };
    }, [
        brief,
        callToAction,
        headline,
        productName,
        selectedStoryTemplate?.defaultDurationSeconds,
        storyTemplateId,
        stylePack,
        t,
        totalEstimatedDuration,
    ]);

    const handleGenerateStoryboard = useCallback(async () => {
        if (!isEnabled('gpu_worker')) return;
        const startedAt = performance.now();
        trackUxEvent('storyboard_generate_click', {
            device: 'web',
            serviceId: serviceId,
            productIndex: productIndex,
            sessionId: studioSessionId ?? undefined,
            step,
        });
        setStoryboardLoading(true);
        try {
            const sessionId = await ensureStudioSession();
            if (!sessionId) {
                setStoryboardLoading(false);
                return;
            }

            // Validation UUID pour sessionId
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(sessionId)) {
                console.error('[ImmersiveVideoWizard] Session ID invalide (pas un UUID):', sessionId);
                toast.error(
                    t('videoWizard.errors.storyboardInvalidSession') || 'Session Studio invalide. Veuillez réessayer.',
                );
                setStoryboardLoading(false);
                return;
            }

            const request = buildStoryboardRequest();
            console.log('[ImmersiveVideoWizard] generateStoryboard called with:', {
                sessionId,
                payload: JSON.stringify(request, null, 2),
                url: `/api/studio/sessions/${sessionId}/storyboard`,
            });

            const result = await studioService.generateStoryboard(sessionId, request);

            console.log('[ImmersiveVideoWizard] generateStoryboard response:', {
                success: !!result,
                hasScenes: !!result?.scenes,
                scenesCount: result?.scenes?.length || 0,
            });
            setStoryboard(result);
            const durationMs = performance.now() - startedAt;
            trackUxEvent('storyboard_generate_completed', {
                device: 'web',
                serviceId: serviceId,
                productIndex: productIndex,
                sessionId,
                step,
                durationMs,
                extra: {
                    scenes: result.scenes.length,
                },
            });
        } catch (error: any) {
            console.error('[ImmersiveVideoWizard] storyboard generation error', error);
            const errorMessage = error?.message || t('videoWizard.errors.storyboardGeneration') || 'Storyboard IA indisponible';

            // Messages d'erreur plus spécifiques
            let displayMessage = errorMessage;
            if (errorMessage.includes('404')) {
                displayMessage = 'Endpoint storyboard introuvable (404). Vérifiez que le backend est correctement configuré.';
            } else if (errorMessage.includes('500')) {
                displayMessage = 'Erreur serveur lors de la génération du storyboard (500). Réessayez plus tard.';
            } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
                displayMessage = 'Le délai d\'attente a été dépassé. Réessayez.';
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                displayMessage = 'Erreur de connexion réseau. Vérifiez votre connexion.';
            }

            toast.error(displayMessage);
            const durationMs = performance.now() - startedAt;
            trackUxEvent('storyboard_generate_failed', {
                device: 'web',
                serviceId: serviceId,
                productIndex: productIndex,
                sessionId: studioSessionId ?? undefined,
                step,
                durationMs,
                extra: {
                    error: error?.message ?? 'unknown',
                },
            });
        } finally {
            setStoryboardLoading(false);
        }
    }, [buildStoryboardRequest, ensureStudioSession, isEnabled, productIndex, serviceId, step, studioSessionId, t]);

    const handleShortPreview = useCallback(async () => {
        if (!isEnabled('gpu_worker')) {
            toast.error(
                t('videoWizard.errors.previewUnavailable') ||
                'La prévisualisation GPU est temporairement indisponible.',
            );
            return;
        }
        const sessionId = studioSessionId;
        if (!sessionId) {
            toast.error(
                t('videoWizard.errors.previewNoSession') ||
                'Crée d’abord un storyboard ou une session Studio avant la prévisualisation.',
            );
            return;
        }

        const startedAt = performance.now();
        setShortPreviewLoading(true);
        trackUxEvent('preview_short_click', {
            device: 'web',
            serviceId: serviceId,
            productIndex: productIndex,
            sessionId,
            step,
        });

        try {
            if (prewarmedShortPreviewUrl) {
                window.open(prewarmedShortPreviewUrl, '_blank', 'noopener,noreferrer');
                trackUxEvent('preview_short_completed', {
                    device: 'web',
                    serviceId: serviceId,
                    productIndex: productIndex,
                    sessionId,
                    step,
                    durationMs: performance.now() - startedAt,
                    prewarmed: true,
                });
                return;
            }

            console.log('[ImmersiveVideoWizard] requestShortPreview called with sessionId:', sessionId);

            const res = await studioService.requestShortPreview(sessionId);

            console.log('[ImmersiveVideoWizard] requestShortPreview response:', {
                success: !!res,
                hasPreviewUrl: !!res?.preview_url,
                previewUrl: res?.preview_url,
            });

            if (!res.preview_url) {
                toast.error(
                    t('videoWizard.errors.previewNoUrl') ||
                    "Impossible de récupérer l'URL de la prévisualisation.",
                );
                const durationMs = performance.now() - startedAt;
                trackUxEvent('preview_short_failed', {
                    device: 'web',
                    serviceId: serviceId,
                    productIndex: productIndex,
                    sessionId,
                    step,
                    durationMs,
                    extra: { reason: 'no_preview_url' },
                });
                return;
            }
            setPrewarmedShortPreviewUrl(res.preview_url);
            window.open(res.preview_url, '_blank', 'noopener,noreferrer');
            const durationMs = performance.now() - startedAt;
            trackUxEvent('preview_short_completed', {
                device: 'web',
                serviceId: serviceId,
                productIndex: productIndex,
                sessionId,
                step,
                durationMs,
                prewarmed: false,
            });
        } catch (error: any) {
            console.error('[ImmersiveVideoWizard] short preview error', error);
            const errorMessage = error?.message || t('videoWizard.errors.previewFailed') || 'Impossible de lancer la prévisualisation courte.';

            // Messages d'erreur plus spécifiques
            let displayMessage = errorMessage;
            if (errorMessage.includes('404')) {
                displayMessage = 'Endpoint preview introuvable (404). Vérifiez que le backend est correctement configuré.';
            } else if (errorMessage.includes('500')) {
                displayMessage = 'Erreur serveur lors de la génération de la prévisualisation (500). Le worker Remotion pourrait être indisponible.';
            } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
                displayMessage = 'Le délai d\'attente a été dépassé. La génération vidéo peut prendre plus de temps.';
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                displayMessage = 'Erreur de connexion réseau. Vérifiez votre connexion.';
            }

            toast.error(displayMessage);
            const durationMs = performance.now() - startedAt;
            trackUxEvent('preview_short_failed', {
                device: 'web',
                serviceId: serviceId,
                productIndex: productIndex,
                sessionId,
                step,
                durationMs,
                extra: {
                    error: error?.message ?? 'unknown',
                },
            });
        } finally {
            setShortPreviewLoading(false);
        }
    }, [isEnabled, prewarmedShortPreviewUrl, productIndex, serviceId, step, studioSessionId, t]);

    const applyStoryboardToScenes = useCallback(() => {
        if (!storyboard || !storyboard.scenes.length) {
            toast.error(
                t('videoWizard.errors.storyboardEmpty') ||
                'Aucun storyboard disponible pour configurer la timeline.',
            );
            return;
        }

        const nextScenes: SceneDraft[] = storyboard.scenes.map((scene) => ({
            id: `scene-${scene.index}`,
            optional: false,
        }));

        setScenesDraft(nextScenes);
        setSceneAssignments({});
        setCurrentSceneIndex(0);
        setScrubPosition(0);

        toast.success(
            t('videoWizard.toasts.storyboardApplied') || 'Storyboard appliqué à la timeline.',
        );
        trackUxEvent('storyboard_apply', {
            device: 'web',
            serviceId: serviceId,
            productIndex: productIndex,
            sessionId: studioSessionId ?? undefined,
            step,
            extra: {
                scenes: storyboard.scenes.length,
            },
        });
    }, [productIndex, serviceId, step, storyboard, studioSessionId, t]);

    useEffect(() => {
        if (!isEnabled('gpu_worker')) {
            return;
        }
        if (!studioSessionId) {
            return;
        }
        if (shortPreviewPrewarmRef.current || prewarmedShortPreviewUrl) {
            return;
        }
        if (!storyboard || !storyboard.scenes.length) {
            return;
        }

        const hasAssignedMedia = Object.values(sceneAssignments).some(
            (mediaId) => typeof mediaId === 'number',
        );
        if (!hasAssignedMedia) {
            return;
        }

        shortPreviewPrewarmRef.current = true;
        const startedAt = performance.now();
        trackUxEvent('preview_short_prewarm_start', {
            device: 'web',
            serviceId: serviceId,
            productIndex: productIndex,
            sessionId: studioSessionId,
            step,
        });

        void studioService
            .requestShortPreview(studioSessionId)
            .then((res) => {
                if (res.preview_url) {
                    setPrewarmedShortPreviewUrl(res.preview_url);
                }
                const durationMs = performance.now() - startedAt;
                trackUxEvent('preview_short_prewarm_completed', {
                    device: 'web',
                    serviceId: serviceId,
                    productIndex: productIndex,
                    sessionId: studioSessionId,
                    step,
                    durationMs,
                    prewarmed: true,
                });
            })
            .catch((error: any) => {
                const durationMs = performance.now() - startedAt;
                trackUxEvent('preview_short_prewarm_failed', {
                    device: 'web',
                    serviceId: serviceId,
                    productIndex: productIndex,
                    sessionId: studioSessionId,
                    step,
                    durationMs,
                    extra: {
                        error: error?.message ?? 'unknown',
                    },
                });
            });
    }, [
        isEnabled,
        prewarmedShortPreviewUrl,
        productIndex,
        sceneAssignments,
        serviceId,
        step,
        storyboard,
        studioSessionId,
    ]);

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
        if (isEnabled('gpu_worker')) {
            loadTemplates();
        }
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEnabled]);

    useEffect(() => {
        if (
            storyTemplates.length > 0 &&
            !storyTemplates.some((spec) => spec.id === storyTemplateId)
        ) {
            setStoryTemplateId(storyTemplates[0].id);
        }
    }, [storyTemplateId, storyTemplates]);

    if (!isEnabled('gpu_worker')) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
                <div className="max-w-xl space-y-4 text-center">
                    <h1 className="text-2xl sm:text-3xl font-bold">
                        Assistant vidéo immersif indisponible
                    </h1>
                    <p className="text-slate-300">
                        Le worker GPU vidéo n&apos;est pas activé sur cet environnement.
                        Activez le flag <code>gpu_worker</code> ou utilisez un environnement
                        configuré pour la génération vidéo immersif.
                    </p>
                </div>
            </div>
        );
    }

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
        (): VideoGenerationPayload => {
            const orderedOverrides: { media_id: number; scene_index: number }[] = [];
            let nonOptionalIndex = 0;

            scenesDraft.forEach((scene) => {
                if (scene.optional) {
                    return;
                }
                const mediaId = sceneAssignments[scene.id];
                if (typeof mediaId === 'number') {
                    orderedOverrides.push({
                        media_id: mediaId,
                        scene_index: nonOptionalIndex,
                    });
                }
                nonOptionalIndex += 1;
            });

            const media_scene_overrides =
                orderedOverrides.length > 0 ? orderedOverrides : undefined;

            const style_effects =
                stylePack === 'pulse'
                    ? ['strong glow', 'punchy text', 'fast motion']
                    : stylePack === 'story'
                        ? ['subtle cinematic', 'soft focus']
                        : ['subtle', 'clean'];

            const style_transitions =
                stylePack === 'pulse'
                    ? ['orbit-3d', 'speed-ramp']
                    : stylePack === 'story'
                        ? ['parallax', 'fade']
                        : ['hard-cut'];

            const style_color_palette =
                stylePack === 'pulse'
                    ? 'neon glow'
                    : stylePack === 'story'
                        ? 'cinematic warm'
                        : 'neutral corporate';

            const style_music_hint =
                stylePack === 'pulse'
                    ? 'high energy beat'
                    : stylePack === 'story'
                        ? 'lofi / ambient'
                        : 'ambient corporate';

            return {
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
                style_effects,
                style_transitions,
                style_color_palette,
                style_music_hint,
                distribute_channels: distributionChannels
                    .filter((item) => item.selected)
                    .map((item) => item.key),
                media_scene_overrides,
            };
        },
        [
            autoStoryboard,
            brief,
            callToAction,
            distributionChannels,
            headline,
            mode,
            musicMode,
            scenesDraft,
            sceneAssignments,
            selectedMediaIds,
            selectedStyle,
            storyTemplateId,
            selectedVoiceProfileId,
            stylePack,
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

    const handleScrub = useCallback(
        (event: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
            const target = event.currentTarget;
            const rect = target.getBoundingClientRect();
            const clientX =
                'touches' in event
                    ? event.touches[0]?.clientX ?? rect.left
                    : (event as MouseEvent<HTMLDivElement>).clientX;
            const rawRatio = (clientX - rect.left) / rect.width;
            const ratio = Math.min(1, Math.max(0, rawRatio));
            setScrubPosition(ratio);

            if (effectiveScenesCount > 0) {
                const approximateScene = Math.floor(ratio * effectiveScenesCount);
                const clampedIndex = Math.min(
                    effectiveScenesCount - 1,
                    Math.max(0, approximateScene),
                );
                setCurrentSceneIndex(clampedIndex);
            }
        },
        [effectiveScenesCount],
    );

    const handleSceneRailClick = useCallback(
        (index: number) => {
            if (scenesDraft.length <= 0) return;
            const clampedIndex = Math.min(scenesDraft.length - 1, Math.max(0, index));
            setCurrentSceneIndex(clampedIndex);
            const ratio = scenesDraft.length > 1 ? clampedIndex / (scenesDraft.length - 1) : 0;
            setScrubPosition(ratio);
        },
        [scenesDraft.length],
    );

    const moveScene = useCallback(
        (fromIndex: number, toIndex: number) => {
            setScenesDraft((prev) => {
                if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
                    return prev;
                }
                if (fromIndex >= prev.length || toIndex >= prev.length) {
                    return prev;
                }
                const next = [...prev];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved);
                return next;
            });
            setCurrentSceneIndex((prevIndex) => {
                if (prevIndex === fromIndex) {
                    return toIndex;
                }
                return prevIndex;
            });
        },
        [],
    );

    const duplicateScene = useCallback(
        (index: number) => {
            setScenesDraft((prev) => {
                if (index < 0 || index >= prev.length) return prev;
                const base = prev[index];
                const copy: SceneDraft = {
                    id: `${base.id}-copy-${Date.now()}`,
                    optional: base.optional,
                };
                const next = [...prev];
                next.splice(index + 1, 0, copy);
                return next;
            });
        },
        [],
    );

    const deleteScene = useCallback((index: number) => {
        setScenesDraft((prev) => {
            if (prev.length <= 1 || index < 0 || index >= prev.length) {
                return prev;
            }
            const next = [...prev];
            const [removed] = next.splice(index, 1);
            setSceneAssignments((prevAssignments) => {
                const { [removed.id]: _, ...rest } = prevAssignments;
                return rest;
            });
            setCurrentSceneIndex((prevIndex) => {
                if (prevIndex > index) return prevIndex - 1;
                if (prevIndex === index) return Math.max(0, index - 1);
                return prevIndex;
            });
            return next;
        });
    }, []);

    const toggleSceneOptional = useCallback((id: string) => {
        setScenesDraft((prev) =>
            prev.map((scene) =>
                scene.id === id ? { ...scene, optional: !scene.optional } : scene,
            ),
        );
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100" aria-busy={isGenerating}>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-32 pt-16 lg:px-10">
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
                    <CreatorStudioPreviewCard
                        serviceId={serviceId}
                        serviceName={serviceName}
                        productName={productName}
                    />
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
                                        <p className="mb-2 text-xs text-slate-400">
                                            Brief & recommandation IA : Décris ton service, ton CTA, les points clés pour générer des suggestions IA personnalisées.
                                        </p>
                                        <textarea
                                            value={brief}
                                            onChange={(event) => setBrief(event.target.value)}
                                            placeholder={t('videoWizard.placeholders.brief') || 'Décris ton service, ton CTA, les points clés...'}
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
                                        <select
                                            value={selectedStyle}
                                            onChange={(event) => setSelectedStyle(event.target.value)}
                                            aria-label={t('videoWizard.accessibility.templateOption', { template: selectedStyle })}
                                            className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                        >
                                            {['IntroPulse', 'ProductShowcase', 'ARHighlight', 'GlowCTA'].map((template) => (
                                                <option key={template} value={template}>
                                                    {template}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={mode}
                                            onChange={(event) => setMode(event.target.value as ModePreset)}
                                            aria-label={t('videoWizard.accessibility.modeOption', { mode })}
                                            className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="standard">
                                                {t('videoWizard.mode.standardTitle')} - {t('videoWizard.mode.standardDesc')}
                                            </option>
                                            <option value="expert">
                                                {t('videoWizard.mode.expertTitle')} - {t('videoWizard.mode.expertDesc')}
                                            </option>
                                        </select>
                                        <select
                                            value={stylePack}
                                            onChange={(event) => setStylePack(event.target.value as 'pulse' | 'story' | 'corporate')}
                                            aria-label="Style pack"
                                            className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="pulse">Pulse social - Transitions 3D, glow léger, musique rythmée.</option>
                                            <option value="story">Story éditoriale - Parallax doux, cinematic, texte lisible.</option>
                                            <option value="corporate">Corporate clair - Cuts propres, colorimétrie neutre.</option>
                                        </select>
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
                                        <div className="mt-4 rounded-2xl border border-indigo-500/40 bg-indigo-900/40 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
                                                        Storyboard IA
                                                    </p>
                                                    <p className="text-xs text-slate-300">
                                                        Propose une séquence de scènes (intro, bénéfices, preuves, CTA)
                                                        à partir de ton brief.
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleGenerateStoryboard}
                                                        disabled={storyboardLoading}
                                                        className="rounded-full border border-indigo-300/60 bg-indigo-500/20 px-3 py-1 text-[11px] font-semibold text-indigo-50 hover:bg-indigo-500/30 disabled:opacity-50"
                                                    >
                                                        {storyboardLoading ? 'Storyboard…' : 'Générer'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={applyStoryboardToScenes}
                                                        disabled={!storyboard || !storyboard.scenes.length}
                                                        className="rounded-full border border-emerald-300/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
                                                    >
                                                        Utiliser
                                                    </button>
                                                </div>
                                            </div>
                                            {storyboard && storyboard.scenes.length > 0 && (
                                                <div className="mt-3 space-y-1">
                                                    {storyboard.scenes.slice(0, 4).map((scene) => (
                                                        <div
                                                            key={scene.index}
                                                            className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-200"
                                                        >
                                                            <span className="font-semibold uppercase tracking-wide text-indigo-200">
                                                                {scene.sceneType}{' '}
                                                            </span>
                                                            ·{' '}
                                                            {scene.headline ||
                                                                scene.body ||
                                                                t('videoWizard.summary.sceneDefaultHint', {
                                                                    defaultValue: 'Scène',
                                                                })}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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
                                            {effectiveScenesCount > 0 && (
                                                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                                                    <p className="text-sm font-semibold text-slate-100">
                                                        {t('videoWizard.summary.timeline') ??
                                                            'Timeline (assignation des scènes)'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {effectiveScenesCount} scènes estimées · vous
                                                        pouvez forcer quelle image est utilisée pour
                                                        certaines scènes.
                                                    </p>

                                                    {/* Rail horizontal enrichi représentant les scènes + scrubber */}
                                                    <div className="mt-3 space-y-2">
                                                        <div
                                                            className="relative flex items-center gap-1 overflow-hidden rounded-full bg-slate-900/80 px-2 py-1"
                                                            role="slider"
                                                            aria-valuemin={0}
                                                            aria-valuemax={effectiveScenesCount - 1}
                                                            aria-valuenow={currentSceneIndex}
                                                            aria-label={t(
                                                                'videoWizard.accessibility.timelineSlider',
                                                            )}
                                                            onMouseDown={handleScrub}
                                                            onMouseMove={(event) => {
                                                                if (event.buttons === 1) {
                                                                    handleScrub(event);
                                                                }
                                                            }}
                                                            onTouchStart={handleScrub}
                                                            onTouchMove={handleScrub}
                                                        >
                                                            {scenesDraft.map((scene, index) => {
                                                                const isAssigned =
                                                                    sceneAssignments[scene.id] != null;
                                                                const isActive =
                                                                    index === currentSceneIndex;
                                                                const widthPercent =
                                                                    scenesDraft.length > 0
                                                                        ? 100 / scenesDraft.length
                                                                        : 100;
                                                                return (
                                                                    <button
                                                                        key={`rail-${index}`}
                                                                        type="button"
                                                                        style={{
                                                                            width: `${widthPercent}%`,
                                                                        }}
                                                                        className={`relative flex flex-col items-center justify-center rounded-full px-2 py-1 text-[10px] font-medium transition focus:outline-none ${isActive
                                                                            ? 'bg-indigo-500/40 text-indigo-50 border border-indigo-300/60 shadow-sm shadow-indigo-500/40'
                                                                            : isAssigned
                                                                                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/60'
                                                                                : 'bg-slate-800/80 text-slate-300 border border-white/10'
                                                                            }`}
                                                                        onClick={() =>
                                                                            handleSceneRailClick(index)
                                                                        }
                                                                    >
                                                                        <span>
                                                                            {t(
                                                                                'videoWizard.summary.sceneShortLabel',
                                                                                {
                                                                                    defaultValue: `S${index + 1
                                                                                        }`,
                                                                                    index: index + 1,
                                                                                },
                                                                            )}
                                                                        </span>
                                                                        <span className="text-[9px] text-slate-300">
                                                                            {estimatedSceneDuration > 0
                                                                                ? `~${Math.round(
                                                                                    estimatedSceneDuration,
                                                                                )}s`
                                                                                : '~8s'}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                            <div className="pointer-events-none absolute inset-y-1">
                                                                <div
                                                                    className="h-full w-0.5 rounded-full bg-indigo-300/90 shadow-[0_0_0_3px_rgba(129,140,248,0.35)] transition-transform"
                                                                    style={{
                                                                        transform: `translateX(${scrubPosition * 100
                                                                            }%)`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        {totalEstimatedDuration > 0 && (
                                                            <p className="text-[11px] text-slate-400">
                                                                ~
                                                                {Math.round(
                                                                    totalEstimatedDuration,
                                                                )}{' '}
                                                                s estimées · scène actuelle S
                                                                {currentSceneIndex + 1}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-slate-100">
                                                                    Prévisualisation rapide
                                                                </h3>
                                                                <p className="text-xs text-slate-400">
                                                                    Lance une preview courte (~3–5s) de la timeline actuelle pour
                                                                    ressentir le rythme façon TikTok avant le rendu complet.
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={handleShortPreview}
                                                                disabled={shortPreviewLoading}
                                                                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${shortPreviewLoading
                                                                    ? 'bg-indigo-500/10 text-indigo-200 ring-indigo-400/40 opacity-80 cursor-wait'
                                                                    : 'bg-indigo-500/20 text-indigo-100 ring-indigo-400/60 hover:bg-indigo-500/30'
                                                                    }`}
                                                            >
                                                                {shortPreviewLoading ? (
                                                                    <>
                                                                        <span className="h-3 w-3 animate-spin rounded-full border border-indigo-200 border-t-transparent" />
                                                                        <span>
                                                                            {t('videoWizard.buttons.previewShortLoading') ??
                                                                                'Prévisualisation en cours…'}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    t('videoWizard.buttons.previewShort') ?? 'Prévisualisation rapide'
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Aperçu micro-timeline de la scène courante */}
                                                    <TimelineScenePreview
                                                        sceneIndex={currentSceneIndex}
                                                        totalScenes={effectiveScenesCount}
                                                        templateLabel={selectedStoryTemplate?.label}
                                                        estimatedSceneDuration={estimatedSceneDuration}
                                                        stylePack={stylePack}
                                                        headline={headline}
                                                        callToAction={callToAction}
                                                    />

                                                    {/* Liste détaillée scène par scène avec assignation média */}
                                                    <div className="mt-3 space-y-2">
                                                        {scenesDraft.map((scene, index) => (
                                                            <div
                                                                key={scene.id}
                                                                className={`flex flex-col gap-2 rounded-lg border bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:justify-between ${index === currentSceneIndex
                                                                    ? 'border-indigo-400/80 shadow-sm shadow-indigo-500/40'
                                                                    : 'border-white/10'
                                                                    }`}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-semibold text-slate-100">
                                                                        {t('videoWizard.summary.sceneLabel', {
                                                                            defaultValue: `Scène ${index + 1}`,
                                                                            index: index + 1,
                                                                        })}
                                                                    </span>
                                                                    <span className="text-[11px] text-slate-400">
                                                                        {selectedStoryTemplate
                                                                            ? `${selectedStoryTemplate.label} · ~${Math.round(
                                                                                estimatedSceneDuration || 8,
                                                                            )}s`
                                                                            : t(
                                                                                'videoWizard.summary.sceneDefaultHint',
                                                                                {
                                                                                    defaultValue:
                                                                                        'Segment de la vidéo',
                                                                                },
                                                                            )}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-1 flex flex-wrap items-center gap-2 sm:mt-0">
                                                                    <select
                                                                        value={
                                                                            sceneAssignments[scene.id] ??
                                                                            ''
                                                                        }
                                                                        onChange={(event) => {
                                                                            const value =
                                                                                event.target.value
                                                                                    ? Number(
                                                                                        event.target
                                                                                            .value,
                                                                                    )
                                                                                    : null;
                                                                            setSceneAssignments(
                                                                                (prev) => ({
                                                                                    ...prev,
                                                                                    [scene.id]: value,
                                                                                }),
                                                                            );
                                                                        }}
                                                                        className="min-w-[160px] rounded-lg border border-white/15 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                                                                    >
                                                                        <option value="">
                                                                            {t(
                                                                                'videoWizard.summary.sceneMediaNone',
                                                                                {
                                                                                    defaultValue:
                                                                                        'Laisser Yukpo choisir automatiquement',
                                                                                },
                                                                            )}
                                                                        </option>
                                                                        {mediaItems.map((item) => (
                                                                            <option
                                                                                key={item.id}
                                                                                value={item.id}
                                                                            >
                                                                                {item.ai_description ||
                                                                                    `Media #${item.id}`}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                moveScene(
                                                                                    index,
                                                                                    Math.max(0, index - 1),
                                                                                )
                                                                            }
                                                                            disabled={index === 0}
                                                                            className="rounded-full border border-white/15 bg-slate-950/80 px-2 py-1 text-[10px] text-slate-200 hover:border-indigo-400 hover:text-indigo-200 disabled:opacity-40"
                                                                        >
                                                                            ↑
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                moveScene(
                                                                                    index,
                                                                                    Math.min(
                                                                                        scenesDraft.length - 1,
                                                                                        index + 1,
                                                                                    ),
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                index ===
                                                                                scenesDraft.length - 1
                                                                            }
                                                                            className="rounded-full border border-white/15 bg-slate-950/80 px-2 py-1 text-[10px] text-slate-200 hover:border-indigo-400 hover:text-indigo-200 disabled:opacity-40"
                                                                        >
                                                                            ↓
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                duplicateScene(index)
                                                                            }
                                                                            className="rounded-full border border-white/15 bg-slate-950/80 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-400 hover:text-emerald-200"
                                                                        >
                                                                            {t(
                                                                                'videoWizard.summary.duplicateScene',
                                                                                {
                                                                                    defaultValue:
                                                                                        'Dupliquer',
                                                                                },
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                deleteScene(index)
                                                                            }
                                                                            disabled={
                                                                                scenesDraft.length <= 1
                                                                            }
                                                                            className="rounded-full border border-white/15 bg-slate-950/80 px-2 py-1 text-[10px] text-rose-200 hover:border-rose-400 hover:text-rose-100 disabled:opacity-40"
                                                                        >
                                                                            {t(
                                                                                'videoWizard.summary.deleteScene',
                                                                                {
                                                                                    defaultValue:
                                                                                        'Supprimer',
                                                                                },
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                    <label className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={scene.optional}
                                                                            onChange={() =>
                                                                                toggleSceneOptional(
                                                                                    scene.id,
                                                                                )
                                                                            }
                                                                            className="h-3 w-3 rounded border border-white/30 bg-slate-800 accent-indigo-500"
                                                                        />
                                                                        <span>
                                                                            {t(
                                                                                'videoWizard.summary.optionalScene',
                                                                                {
                                                                                    defaultValue:
                                                                                        'Scène optionnelle',
                                                                                },
                                                                            )}
                                                                        </span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Boutons de navigation fixes en bas */}
                    <div className="sticky bottom-0 z-10 -mx-4 -mb-4 bg-slate-950/95 backdrop-blur-sm border-t border-white/10 px-4 py-4 lg:mx-0 lg:rounded-t-2xl">
                        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="font-semibold text-slate-300">Étape {step}/3</span>
                                <span>·</span>
                                <span>{activeStepLabel}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setStep((step - 1) as WizardStep)}
                                        className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-indigo-200 hover:text-indigo-100"
                                    >
                                        {t('videoWizard.buttons.prevStep', { step: step - 1 })}
                                    </button>
                                )}
                                {step === 1 && (
                                    <button
                                        type="button"
                                        onClick={handleEstimate}
                                        disabled={costLoading || !serviceId || productIndex === undefined}
                                        className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/40"
                                    >
                                        {costLoading ? t('videoWizard.buttons.estimating') : t('videoWizard.buttons.nextStep')}
                                    </button>
                                )}
                                {step === 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setStep(3)}
                                        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
                                    >
                                        {t('videoWizard.buttons.previewTimeline')}
                                    </button>
                                )}
                                {step === 3 && (
                                    <button
                                        type="button"
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !costEstimation}
                                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                                    >
                                        {isGenerating ? t('videoWizard.buttons.rendering') : t('videoWizard.buttons.launchRender')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

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


