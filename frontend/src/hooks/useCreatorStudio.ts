import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    studioService,
    TimelineClipInput,
    type Storyboard,
    type StoryboardRequest,
} from '../services/studioService';
import type {
    StoryTemplateSpec,
    StudioPreviewEvent,
    StudioPreviewMetrics,
    StudioSessionAggregate
} from '../types/video';

type StudioStepKey = 'brief' | 'assets' | 'audio' | 'timeline' | 'distribution';

export interface CreatorStudioState {
    currentStep: StudioStepKey;
    brief: string;
    aiSuggestions: string[];
    recommendedTemplates: string[];
    previewUrl?: string;
    previewLoading: boolean;
    recommendationsLoading: boolean;
    sessionId?: string;
    sessionLoading: boolean;
    error?: string | null;
    templates: StoryTemplateSpec[];
    templatesLoading: boolean;
    timelineDraft: {
        template?: string;
        estimatedDuration: number;
        scenes: number;
    };
    previewEvents: StudioPreviewEvent[];
    previewEventsLoading: boolean;
    previewMetrics?: StudioPreviewMetrics;
    previewMetricsLoading: boolean;
    distributionPlan: string[];
    storyboard?: Storyboard | null;
    storyboardLoading: boolean;
}

export interface CreatorStudioActions {
    setBrief: (text: string) => void;
    generateAiSuggestions: () => Promise<void>;
    pickTemplate: (template: string) => void;
    requestPreview: () => Promise<void>;
    goToStep: (step: StudioStepKey) => void;
    generateStoryboard: () => Promise<void>;
}

const extractBrief = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object' && 'raw' in value) {
        const raw = (value as { raw?: unknown }).raw;
        if (typeof raw === 'string') {
            return raw;
        }
    }
    return '';
};

const DEFAULT_DISTRIBUTION = [
    'TikTok impulsion',
    'Stories Instagram',
    'WhatsApp Broadcast'
];
const FALLBACK_TEMPLATES: StoryTemplateSpec[] = [
    {
        id: 'blog',
        label: 'Blog / Chronicle',
        description: 'Annonces et contenus éditoriaux.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 30,
        suggestedScenes: 3,
    },
    {
        id: 'tutorial',
        label: 'Tutoriel / How-to',
        description: 'Pas-à-pas pour expliquer un service.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 36,
        suggestedScenes: 4,
    },
    {
        id: 'testimonial',
        label: 'Témoignage client',
        description: 'Preuve sociale, citation, métriques.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 28,
        suggestedScenes: 3,
    },
    {
        id: 'comparison',
        label: 'Comparatif / Benchmark',
        description: 'Avant / après pour illustrer la valeur Yukpo.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 32,
        suggestedScenes: 4,
    },
];

type CreatorStudioOptions = {
    serviceId?: number;
};

export const useCreatorStudio = (
    options: CreatorStudioOptions = {},
): [CreatorStudioState, CreatorStudioActions] => {
    const [currentStep, setCurrentStep] = useState<StudioStepKey>('brief');
    const [brief, setBriefState] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [recommendedTemplates, setRecommendedTemplates] = useState<string[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string>();
    const [previewLoading, setPreviewLoading] = useState(false);
    const [recommendationsLoading, setRecommendationsLoading] = useState(false);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [sessionAggregate, setSessionAggregate] = useState<StudioSessionAggregate | null>(null);
    const [templates, setTemplates] = useState<StoryTemplateSpec[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [previewEvents, setPreviewEvents] = useState<StudioPreviewEvent[]>([]);
    const [previewEventsLoading, setPreviewEventsLoading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<StudioPreviewMetrics>();
    const [previewMetricsLoading, setPreviewMetricsLoading] = useState(false);
    const [timelineDraft, setTimelineDraft] = useState({
        template: undefined as string | undefined,
        estimatedDuration: 28,
        scenes: 6
    });
    const [distributionPlan, setDistributionPlan] = useState<string[]>(DEFAULT_DISTRIBUTION);
    const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
    const [storyboardLoading, setStoryboardLoading] = useState(false);

    const sessionId = sessionAggregate?.session.id;
    const templateOptions = templates.length > 0 ? templates : FALLBACK_TEMPLATES;

    const pickTemplateSpec = useCallback(
        (templateId: string) =>
            templateOptions.find((spec) => spec.id === templateId) ?? templateOptions[0],
        [templateOptions],
    );

    const refreshSession = useCallback(
        async (targetId: string) => {
            try {
                const aggregate = await studioService.getSession(targetId);
                setSessionAggregate(aggregate);
                setBriefState(extractBrief(aggregate.session.brief));

                setPreviewEventsLoading(true);
                setPreviewMetricsLoading(true);
                const [events, metrics] = await Promise.all([
                    studioService.listPreviewEvents(targetId),
                    studioService.getPreviewMetrics(targetId)
                ]);
                setPreviewEvents(events);
                setPreviewMetrics(metrics);
            } catch (error) {
                console.error('[CreatorStudio] refresh session failed', error);
                setSessionError((error as Error).message);
            } finally {
                setPreviewEventsLoading(false);
                setPreviewMetricsLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        let cancelled = false;
        const loadTemplates = async () => {
            setTemplatesLoading(true);
            try {
                const list = await studioService.listTemplates();
                if (!cancelled) {
                    setTemplates(list);
                }
            } catch (error) {
                console.error('[CreatorStudio] template fetch failed', error);
            } finally {
                if (!cancelled) {
                    setTemplatesLoading(false);
                }
            }
        };
        loadTemplates();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            setSessionLoading(true);
            try {
                const existing = await studioService.listSessions();
                if (cancelled) {
                    return;
                }
                if (existing.length > 0) {
                    await refreshSession(existing[0].id);
                } else {
                    const aggregate = await studioService.createSession({
                        service_id: options.serviceId,
                        brief: { raw: '' },
                        distribution_plan: DEFAULT_DISTRIBUTION
                    });
                    if (!cancelled) {
                        setSessionAggregate(aggregate);
                        setBriefState('');
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    setSessionError((error as Error).message);
                }
            } finally {
                if (!cancelled) {
                    setSessionLoading(false);
                }
            }
        };

        bootstrap();
        return () => {
            cancelled = true;
        };
    }, [refreshSession]);

    const persistBrief = useCallback(
        async (text: string) => {
            if (!sessionId) {
                return;
            }
            try {
                await studioService.updateSession(sessionId, {
                    brief: { raw: text }
                });
            } catch (error) {
                console.warn('[CreatorStudio] unable to persist brief', error);
            }
        },
        [sessionId]
    );

    const setBrief = useCallback(
        (text: string) => {
            setBriefState(text);
            void persistBrief(text);
        },
        [persistBrief]
    );

    const generateAiSuggestions = useCallback(async () => {
        if (!sessionId) {
            return;
        }
        setRecommendationsLoading(true);
        try {
            // Placeholder until backend IA modules are wired
            await new Promise((resolve) => setTimeout(resolve, 600));
            const mock = [
                'Accroche immersive en 3 scènes (hero shot, bénéfice, CTA)',
                'CTA “Réservez sous 24h” + délai de livraison dynamique',
                'Ajouter témoignage express (8s) pour crédibiliser'
            ];
            const templates = ['testimonial', 'tutorial'];
            setAiSuggestions(mock);
            setRecommendedTemplates(templates);
            await studioService.updateSession(sessionId, {
                ai_recommendations: mock,
                recommended_templates: templates
            });
        } catch (error) {
            console.error('[CreatorStudio] IA suggestions failed', error);
            setSessionError((error as Error).message);
        } finally {
            setRecommendationsLoading(false);
        }
    }, [sessionId]);

    const pickTemplate = useCallback(
        (template: string) => {
            const spec = pickTemplateSpec(template);
            setTimelineDraft((draft) => ({
                ...draft,
                template,
                scenes: spec?.suggestedScenes ?? draft.scenes,
                estimatedDuration: spec?.defaultDurationSeconds ?? draft.estimatedDuration,
            }));
        },
        [pickTemplateSpec],
    );

    const buildStoryboardRequest = useCallback((): StoryboardRequest | null => {
        if (!selectedStoryTemplate) {
            return null;
        }
        const outlineSource =
            aiSuggestions.length > 0
                ? aiSuggestions
                : brief
                    .split(/[\n\.!?]/)
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0);
        const script_outline =
            outlineSource.length > 0 ? outlineSource.slice(0, 6) : ['Concept Yukpo Studio'];

        return {
            script_outline,
            product_name: (sessionAggregate?.session.metadata as any)?.product_name ?? 'Studio Yukpo',
            headline: brief || undefined,
            call_to_action: (sessionAggregate?.session.metadata as any)?.cta_label,
            style: (sessionAggregate?.session.metadata as any)?.template_tone,
            duration_seconds: selectedStoryTemplate.default_duration_seconds,
            template_id: timelineDraft.template,
            business_context: undefined,
            ai_hints: recommendedTemplates,
        };
    }, [aiSuggestions, brief, recommendedTemplates, selectedStoryTemplate, sessionAggregate, timelineDraft.template]);

    const generateStoryboard = useCallback(async () => {
        if (!sessionId) {
            return;
        }
        const request = buildStoryboardRequest();
        if (!request) {
            return;
        }
        setStoryboardLoading(true);
        try {
            const result = await studioService.generateStoryboard(sessionId, request);
            setStoryboard(result);
        } catch (error) {
            console.error('[CreatorStudio] storyboard generation failed', error);
            setSessionError((error as Error).message);
        } finally {
            setStoryboardLoading(false);
        }
    }, [buildStoryboardRequest, sessionId]);

    const buildTimelinePayload = useCallback((): TimelineClipInput[] => {
        const templateKey =
            timelineDraft.template ?? recommendedTemplates[0] ?? templateOptions[0]?.id ?? 'blog';
        const spec = pickTemplateSpec(templateKey);
        const scenesCount = Math.max(1, spec?.suggestedScenes ?? timelineDraft.scenes);
        const totalDuration = spec?.defaultDurationSeconds ?? timelineDraft.estimatedDuration;
        const baseDuration = Math.max(4, Math.round(totalDuration / scenesCount));

        const templatesList = ['IntroPulse', 'ProductShowcase', 'GlowCTA'];

        return Array.from({ length: scenesCount }).map((_, index) => {
            const immersiveTemplate = templatesList[Math.min(index, templatesList.length - 1)];
            return {
                position: index,
                lane: templateKey,
                duration_seconds: baseDuration,
                payload: {
                    id: `scene-${index + 1}`,
                    template: immersiveTemplate,
                    durationInFrames: baseDuration * 30,
                    assets: {
                        headline:
                            index === 0
                                ? brief || 'Concept Yukpo Studio'
                                : aiSuggestions[index] ?? 'Séquence narrative',
                        body:
                            index === scenesCount - 1
                                ? 'CTA Yukpo Studio'
                                : undefined
                    },
                    transition: {
                        type: index === 0 ? 'orbit-3d' : 'hard-cut',
                        durationInFrames: 18
                    }
                }
            };
        });
    }, [aiSuggestions, brief, pickTemplateSpec, recommendedTemplates, templateOptions, timelineDraft]);

    const requestPreview = useCallback(async () => {
        if (!sessionId) {
            return;
        }
        setPreviewLoading(true);
        try {
            const timelinePayload = buildTimelinePayload();
            await studioService.saveTimeline(sessionId, timelinePayload);
            const preview = await studioService.requestPreview(sessionId);
            setPreviewUrl(preview.preview_url ?? undefined);
            setTimelineDraft((draft) => ({
                ...draft,
                template: preview.template ?? draft.template,
                scenes: preview.clip_count ?? draft.scenes,
                estimatedDuration: preview.duration_seconds ?? draft.estimatedDuration,
            }));
            setDistributionPlan((current) =>
                current.length ? current : DEFAULT_DISTRIBUTION
            );
            await refreshSession(sessionId);
        } catch (error) {
            console.error('[CreatorStudio] preview failed', error);
            setSessionError((error as Error).message);
        } finally {
            setPreviewLoading(false);
        }
    }, [buildTimelinePayload, refreshSession, sessionId]);

    const goToStep = useCallback((step: StudioStepKey) => {
        setCurrentStep(step);
    }, []);

    const state = useMemo<CreatorStudioState>(() => {
        return {
            currentStep,
            brief,
            aiSuggestions,
            recommendedTemplates,
            previewUrl,
            previewLoading,
            recommendationsLoading,
            sessionId,
            sessionLoading,
            error: sessionError,
            templates: templateOptions,
            templatesLoading,
            timelineDraft,
            previewEvents,
            previewEventsLoading,
            previewMetrics,
            previewMetricsLoading,
            distributionPlan,
            storyboard,
            storyboardLoading,
        };
    }, [
        aiSuggestions,
        brief,
        currentStep,
        distributionPlan,
        previewLoading,
        previewUrl,
        recommendationsLoading,
        recommendedTemplates,
        sessionError,
        sessionId,
        sessionLoading,
        previewEvents,
        previewEventsLoading,
        previewMetrics,
        previewMetricsLoading,
        templateOptions,
        templatesLoading,
        timelineDraft,
        storyboard,
        storyboardLoading,
    ]);

    const actions: CreatorStudioActions = {
        setBrief,
        generateAiSuggestions,
        pickTemplate,
        requestPreview,
        goToStep,
        generateStoryboard,
    };

    return [state, actions];
};
