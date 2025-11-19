import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { CreatorStudioCard } from '../../components/CreatorStudioCard';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { StudioAudioPanel } from '../../components/StudioAudioPanel';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useVideoGenerationProgress } from '../../hooks/useVideoGenerationProgress';
import { useVoiceProfiles } from '../../hooks/useVoiceProfiles';
import type { VideoJobStatus } from '../../services/api';
import { apiGet, iaApi, mediaApi } from '../../services/api';
import { studioService, type VideoDependency } from '../../services/studioService';
import { trackUxEvent } from '../../services/uxMetrics';
import { modernColors } from '../../theme/modernTheme';
import {
    GeneratedVideoResponse,
    StoryTemplateSpec,
    VideoCostEstimateResponse,
    VideoCostEstimation,
    VideoGenerationPayload
} from '../../types/VideoGeneration';
import type { CreateVoiceProfilePayload, MusicMode } from '../../types/audio';

interface WizardParams {
    serviceId: number;
    productId?: number;
    productIndex: number;
    productName?: string;
}

interface ServiceMediaItem {
    id: number;
    path: string;
    media_type?: string | null;
    ai_description?: string | null;
}

type WizardStep = 1 | 2 | 3;

type ModePreset = 'standard' | 'expert';

const FALLBACK_STORY_TEMPLATES: StoryTemplateSpec[] = [
    {
        id: 'blog',
        label: 'Blog / Chronicle',
        description: 'Récit éditorial idéal pour actus et annonces.',
        recommendedCategories: [],
        tones: ['inspirational'],
        ctas: ['Découvrir'],
        defaultDurationSeconds: 30,
        suggestedScenes: 3,
    },
    {
        id: 'tutorial',
        label: 'Tutoriel / How-to',
        description: 'Pas-à-pas pour expliquer un service/app.',
        recommendedCategories: [],
        tones: ['educational'],
        ctas: ['Essayer'],
        defaultDurationSeconds: 36,
        suggestedScenes: 4,
    },
    {
        id: 'testimonial',
        label: 'Témoignage client',
        description: 'Renforce la preuve sociale en quelques secondes.',
        recommendedCategories: [],
        tones: ['trust'],
        ctas: ['Réserver'],
        defaultDurationSeconds: 28,
        suggestedScenes: 3,
    },
    {
        id: 'comparison',
        label: 'Comparatif / Benchmark',
        description: 'Oppose deux options pour mettre en avant Yukpo.',
        recommendedCategories: [],
        tones: ['bold'],
        ctas: ['Passer à Yukpo'],
        defaultDurationSeconds: 32,
        suggestedScenes: 4,
    },
];

const VideoCreationWizardScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params || {}) as WizardParams;
    const { t } = useLanguageSafe();

    const format = useCallback(
        (key: string, params: Record<string, string | number>) => {
            let template = t(key);
            Object.entries(params).forEach(([paramKey, value]) => {
                const regex = new RegExp(`{{${paramKey}}}`, 'g');
                template = template.replace(regex, String(value));
            });
            return template;
        },
        [t],
    );

    const [step, setStep] = useState<WizardStep>(1);
    const [loadingService, setLoadingService] = useState(true);
    const [costEstimation, setCostEstimation] = useState<VideoCostEstimation | null>(null);
    const [costLoading, setCostLoading] = useState(false);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [serviceName, setServiceName] = useState('');
    const [productName, setProductName] = useState(params.productName || t('videoWizard.defaultProduct'));
    const [mediaItems, setMediaItems] = useState<ServiceMediaItem[]>([]);
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
    const serviceId = params.serviceId;
    const productIndex = params.productIndex;

    type SceneDraft = {
        id: string;
        optional: boolean;
    };

    const [scenesDraft, setScenesDraft] = useState<SceneDraft[]>([]);
    const [sceneAssignments, setSceneAssignments] = useState<Record<string, number | null>>({});
    const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);

    const [brief, setBrief] = useState('');
    const [headline, setHeadline] = useState('');
    const [callToAction, setCallToAction] = useState('');
    const [autoStoryboard, setAutoStoryboard] = useState(true);
    const [mode, setMode] = useState<ModePreset>('standard');
    const [selectedStyle, setSelectedStyle] = useState('IntroPulse');
    const [stylePack, setStylePack] = useState<'pulse' | 'story' | 'corporate'>('pulse');
    const [musicMode, setMusicMode] = useState<MusicMode>('pulse');
    const [voiceoverEnabled, setVoiceoverEnabled] = useState(true);
    const [voiceoverLang, setVoiceoverLang] = useState<'fr' | 'en'>('fr');
    const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState<number | undefined>();
    const [publishChat, setPublishChat] = useState(true);
    const [publishCard, setPublishCard] = useState(true);
    const [publishSocial, setPublishSocial] = useState(false);
    const [storyTemplateId, setStoryTemplateId] = useState<string>('blog');
    const [storyTemplates, setStoryTemplates] = useState<StoryTemplateSpec[]>([]);
    const [storyTemplatesLoading, setStoryTemplatesLoading] = useState(true);
    const [shortPreviewStarted, setShortPreviewStarted] = useState(false);
    const [storyboard, setStoryboard] = useState<import('../../services/studioService').Storyboard | null>(null);
    const [storyboardLoading, setStoryboardLoading] = useState(false);
    const [studioSessionId, setStudioSessionId] = useState<string | undefined>();
    const [prewarmedShortPreviewUrl, setPrewarmedShortPreviewUrl] = useState<string | undefined>();
    // ✅ Phase 9 - Amélioration 31 : Chaînage vidéos
    const [availableSessions, setAvailableSessions] = useState<Array<{ id: string; title?: string }>>([]);
    const [selectedLinkedSessions, setSelectedLinkedSessions] = useState<string[]>([]);
    const [dependencies, setDependencies] = useState<VideoDependency[]>([]);

    const templateOptions =
        storyTemplates.length > 0 ? storyTemplates : FALLBACK_STORY_TEMPLATES;
    const selectedStoryTemplate = templateOptions.find((spec) => spec.id === storyTemplateId);
    const effectiveScenesCount = useMemo(() => {
        if (selectedStoryTemplate?.suggestedScenes && selectedStoryTemplate.suggestedScenes > 0) {
            return selectedStoryTemplate.suggestedScenes;
        }
        return 3;
    }, [selectedStoryTemplate]);

    useEffect(() => {
        trackUxEvent('wizard_open', {
            device: 'mobile',
            serviceId,
            productIndex,
            step,
        });
    }, [productIndex, serviceId, step]);

    // ✅ Phase 9 - Amélioration 31 : Charger les sessions disponibles pour le chaînage
    useEffect(() => {
        const loadAvailableSessions = async () => {
            try {
                const sessions = await studioService.listSessions();
                setAvailableSessions(sessions.map((s) => ({
                    id: s.id,
                    title: (typeof s.brief === 'object' && s.brief !== null && 'title' in s.brief)
                        ? String(s.brief.title)
                        : undefined
                })));
            } catch (error) {
                console.error('[VideoCreationWizardScreen] Erreur chargement sessions:', error);
            }
        };
        if (step === 3) {
            loadAvailableSessions();
        }
    }, [step]);

    // ✅ Phase 9 - Amélioration 31 : Charger les dépendances existantes
    useEffect(() => {
        const loadDependencies = async () => {
            if (!studioSessionId) return;
            try {
                const deps = await studioService.getDependencies(studioSessionId);
                setDependencies(deps);
                setSelectedLinkedSessions(deps.map((d) => d.child_session_id));
            } catch (error) {
                console.error('[VideoCreationWizardScreen] Erreur chargement dépendances:', error);
            }
        };
        if (studioSessionId && step === 3) {
            loadDependencies();
        }
    }, [studioSessionId, step]);

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
        if (storyboard && storyboard.scenes.length > 0) {
            const nextScenes: SceneDraft[] = storyboard.scenes.map((scene) => ({
                id: `scene-${scene.index}`,
                optional: false,
            }));
            setScenesDraft(nextScenes);
            setSceneAssignments({});
            setCurrentSceneIndex(0);
            return;
        }
        if (effectiveScenesCount <= 0) {
            setScenesDraft([]);
            setSceneAssignments({});
            setCurrentSceneIndex(0);
            return;
        }
        const nextScenes: SceneDraft[] = Array.from({ length: effectiveScenesCount }).map(
            (_, index) => ({
                id: `scene-${index}`,
                optional: false,
            }),
        );
        setScenesDraft(nextScenes);
        setSceneAssignments({});
        setCurrentSceneIndex(0);
    }, [effectiveScenesCount, storyboard]);

    const currentScene = useMemo(
        () =>
            currentSceneIndex >= 0 && currentSceneIndex < scenesDraft.length
                ? scenesDraft[currentSceneIndex]
                : undefined,
        [currentSceneIndex, scenesDraft],
    );

    const [isGenerating, setIsGenerating] = useState(false);
    const {
        steps: progressSteps,
        startSimulation,
        applyServerSteps,
        reset: resetProgress,
        fail: failProgress,
    } = useVideoGenerationProgress();

    const stepTransition = useRef(new Animated.Value(0)).current;
    const runningPulse = useRef(new Animated.Value(0)).current;
    const modalScale = useRef(new Animated.Value(0)).current;

    const {
        voiceProfiles,
        loading: loadingVoiceProfiles,
        createProfile,
        deleteProfile,
    } = useVoiceProfiles({ serviceId });

    const fetchServiceDetails = useCallback(async () => {
        if (!serviceId && serviceId !== 0) {
            setLoadingService(false);
            // ✅ CORRIGÉ: Afficher un message d'erreur si serviceId est manquant
            Alert.alert(
                'Service manquant',
                'Aucun service n\'a été sélectionné. Veuillez créer un service avant de créer une vidéo.',
                [
                    {
                        text: 'Retour',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
            return;
        }
        try {
            setLoadingService(true);
            const response = await apiGet<any>(`/api/services/${serviceId}`);
            if (response.success && response.data) {
                const service = response.data;
                setServiceName(service.titre || service.name || `Service #${serviceId}`);
                const produits = service.data?.produits?.valeur || service.data?.produits || [];

                // ✅ Phase 7 - Amélioration 21 : Auto-remplissage Brief IA depuis description produit/service
                if (typeof productIndex === 'number' && produits[productIndex]) {
                    const p = produits[productIndex];
                    setProductName(p.nom || p.name || p.title || t('videoWizard.defaultProduct'));

                    // Priorité 1 : Description du produit si disponible
                    const productDesc = p.description || p.desc;
                    if (productDesc && !brief) {
                        setBrief(productDesc);
                    } else if (produits.length <= 2 && service.description && !brief) {
                        // Priorité 2 : Description du service si ≤ 2 produits
                        setBrief(service.description);
                    }
                } else if (service.description && !brief) {
                    // Si pas de produit spécifique, utiliser description service
                    setBrief(service.description);
                }
            } else {
                // ✅ CORRIGÉ: Afficher un message d'erreur si le service n'est pas trouvé
                Alert.alert(
                    'Service introuvable',
                    'Le service sélectionné n\'a pas pu être chargé. Veuillez réessayer.',
                    [
                        {
                            text: 'Retour',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            }
        } catch (error) {
            console.warn('[VideoCreationWizard] Service introuvable', error);
            // ✅ CORRIGÉ: Afficher un message d'erreur en cas d'erreur
            Alert.alert(
                'Erreur',
                'Une erreur est survenue lors du chargement du service. Veuillez réessayer.',
                [
                    {
                        text: 'Retour',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } finally {
            setLoadingService(false);
        }
    }, [serviceId, productIndex, t, brief, navigation]);

    const fetchServiceMedia = useCallback(async () => {
        if (!serviceId) {
            return;
        }
        try {
            setMediaLoading(true);
            const response = await mediaApi.getServiceMediaDetailed(serviceId);
            if (response.success && Array.isArray(response.data)) {
                setMediaItems(response.data as ServiceMediaItem[]);
            } else if (response.data && Array.isArray((response.data as any).items)) {
                setMediaItems((response.data as any).items as ServiceMediaItem[]);
            }
        } catch (error) {
            console.warn('[VideoCreationWizard] Médias indisponibles', error);
        } finally {
            setMediaLoading(false);
        }
    }, [serviceId]);

    useEffect(() => {
        fetchServiceDetails();
    }, [fetchServiceDetails]);

    useEffect(() => {
        if (step >= 2) {
            fetchServiceMedia();
        }
    }, [step, fetchServiceMedia]);

    useEffect(() => {
        if (!isGenerating && step === 1) {
            resetProgress();
        }
    }, [isGenerating, step, resetProgress]);

    useEffect(() => {
        if (!voiceoverEnabled) {
            setSelectedVoiceProfileId(undefined);
            return;
        }
        if (!selectedVoiceProfileId && voiceProfiles.length > 0) {
            setSelectedVoiceProfileId(voiceProfiles[0].id);
        }
    }, [selectedVoiceProfileId, voiceProfiles, voiceoverEnabled]);

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
                console.warn('[VideoCreationWizard] templates indisponibles', error);
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

    useEffect(() => {
        stepTransition.setValue(0);
        Animated.timing(stepTransition, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
        }).start();
    }, [step, stepTransition]);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(runningPulse, {
                    toValue: 1,
                    duration: 650,
                    useNativeDriver: true,
                }),
                Animated.timing(runningPulse, {
                    toValue: 0,
                    duration: 650,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [runningPulse]);

    useEffect(() => {
        if (isGenerating) {
            modalScale.setValue(0.85);
            Animated.spring(modalScale, {
                toValue: 1,
                damping: 12,
                stiffness: 150,
                useNativeDriver: true,
            }).start();
        } else {
            modalScale.setValue(0);
        }
    }, [isGenerating, modalScale]);

    const stepAnimatedStyle = useMemo(
        () => ({
            opacity: stepTransition,
            transform: [
                {
                    translateY: stepTransition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                    }),
                },
            ],
        }),
        [stepTransition],
    );

    const runningPulseStyle = useMemo(
        () => ({
            opacity: runningPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.45, 1],
            }),
        }),
        [runningPulse],
    );

    const modalAnimatedStyle = useMemo(
        () => ({
            opacity: modalScale.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
            }),
            transform: [
                {
                    scale: modalScale.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1],
                    }),
                },
            ],
        }),
        [modalScale],
    );

    const handleCreateVoiceProfile = useCallback(
        async (
            payload: Omit<CreateVoiceProfilePayload, 'service_id'> & { sample_media_id?: number | null },
        ) => {
            try {
                const profile = await createProfile(payload);
                Alert.alert('Profil vocal', 'Profil créé avec succès.');
                setSelectedVoiceProfileId((prev) => prev ?? profile.id);
            } catch (error: any) {
                Alert.alert('Profil vocal', error?.message || 'Impossible de créer le profil audio.');
            }
        },
        [createProfile],
    );

    const handleDeleteVoiceProfile = useCallback(
        async (profileId: number) => {
            try {
                await deleteProfile(profileId);
                Alert.alert('Profil vocal', 'Profil supprimé.');
                setSelectedVoiceProfileId((prev) => (prev === profileId ? undefined : prev));
            } catch (error: any) {
                Alert.alert('Profil vocal', error?.message || 'Suppression impossible.');
            }
        },
        [deleteProfile],
    );

    const handleEstimateCost = async () => {
        if (!serviceId && serviceId !== 0) {
            Alert.alert(t('videoWizard.alert.missingInfoTitle'), t('videoWizard.alert.serviceUnknown'));
            return;
        }
        if (typeof productIndex !== 'number') {
            Alert.alert(t('videoWizard.alert.missingInfoTitle'), t('videoWizard.alert.productUnknown'));
            return;
        }
        try {
            setCostLoading(true);
            const payload: VideoGenerationPayload = {
                style: selectedStyle,
                headline,
                call_to_action: callToAction,
                story_template_id: storyTemplateId,
                auto_storyboard: autoStoryboard,
                use_ai_templates: mode === 'expert',
                use_service_mediatech: mode === 'expert',
                include_publicite_assets: mode === 'expert',
                music_mode: musicMode !== 'none' ? musicMode : undefined,
                voiceover_lang: voiceoverEnabled ? voiceoverLang : undefined,
                voiceover_script: voiceoverEnabled ? brief : undefined,
                voice_profile_id: voiceoverEnabled ? selectedVoiceProfileId ?? undefined : undefined,
                media_scene_overrides: undefined,
            };

            const response = await iaApi.estimateVideoCost(serviceId, productIndex, payload);
            const estimationResponse = response.data as VideoCostEstimateResponse | VideoCostEstimation | undefined;
            const estimation =
                estimationResponse && 'data' in estimationResponse
                    ? estimationResponse.data
                    : (estimationResponse as VideoCostEstimation | undefined);

            if (estimation) {
                setCostEstimation(estimation);
                setStep(2);
            } else {
                const errorMsg = response.message || t('videoWizard.alert.retrySoon') || 'Erreur lors de l\'estimation.';
                Alert.alert(t('videoWizard.alert.estimationFailedTitle'), errorMsg);
                console.error('[VideoCreationWizard] Estimation vide:', response);
            }
        } catch (error: any) {
            console.error('[VideoCreationWizard] Erreur estimation coût:', error);
            let message = error?.message || t('videoWizard.alert.serverError') || 'Erreur serveur.';

            // Messages d'erreur plus spécifiques
            if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
                message = 'Erreur de connexion. Vérifiez votre accès Internet.';
            } else if (error?.message?.includes('timeout')) {
                message = 'Le délai d\'attente a expiré. Réessayez.';
            } else if (error?.message?.includes('401') || error?.message?.includes('403')) {
                message = 'Session expirée. Veuillez vous reconnecter.';
            } else if (error?.message?.includes('500')) {
                message = 'Erreur serveur. Réessayez dans quelques instants.';
            }

            Alert.alert(t('videoWizard.alert.estimationFailedTitle'), message);
        } finally {
            setCostLoading(false);
        }
    };

    const toggleMediaSelection = (mediaId: number) => {
        setSelectedMediaIds((prev) => {
            if (prev.includes(mediaId)) {
                return prev.filter((id) => id !== mediaId);
            }
            return [...prev, mediaId];
        });
    };

    const ensureStudioSession = useCallback(async (): Promise<string | undefined> => {
        if (studioSessionId) {
            return studioSessionId;
        }
        try {
            const existing = await studioService.listSessions();
            if (existing.length > 0) {
                setStudioSessionId(existing[0].id);
                return existing[0].id;
            }
            const payload: import('../../services/studioService').CreateStudioSessionPayload = {
                service_id: serviceId,
                brief: { raw: brief },
                metadata: {
                    product_name: productName,
                },
                distribution_plan: [],
            };
            const aggregate = await studioService.createSession(payload);
            setStudioSessionId(aggregate.session.id);
            return aggregate.session.id;
        } catch (error) {
            console.warn('[VideoCreationWizard] session Studio storyboard indisponible', error);
            return undefined;
        }
    }, [brief, productName, serviceId, studioSessionId]);

    const buildStoryboardRequest = useCallback(
        (): import('../../services/studioService').StoryboardRequest => {
            const outlineSource =
                brief.trim().length > 0
                    ? brief
                        .split(/[\n\.!?]/)
                        .map((entry) => entry.trim())
                        .filter((entry) => entry.length > 0)
                    : [t('videoWizard.placeholders.brief')];

            const script_outline = outlineSource.slice(0, 6);

            return {
                script_outline,
                product_name: productName || t('videoWizard.defaultProduct'),
                headline: headline || undefined,
                call_to_action: callToAction || undefined,
                style: stylePack,
                duration_seconds:
                    selectedStoryTemplate?.defaultDurationSeconds ?? 28,
                template_id: storyTemplateId,
                business_context: undefined,
                ai_hints: [],
            };
        },
        [
            brief,
            callToAction,
            headline,
            productName,
            selectedStoryTemplate?.defaultDurationSeconds,
            storyTemplateId,
            stylePack,
            t,
        ],
    );

    const handleGenerateStoryboard = useCallback(async () => {
        const startedAt = Date.now();
        trackUxEvent('storyboard_generate_click', {
            device: 'mobile',
            serviceId,
            productIndex,
            sessionId: studioSessionId,
            step,
        });
        try {
            const sessionId = await ensureStudioSession();
            if (!sessionId) {
                Alert.alert(
                    'Erreur',
                    'Impossible de créer ou récupérer une session Studio. Vérifiez votre connexion.',
                );
                return;
            }

            // Validation UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(sessionId)) {
                console.error('[VideoCreationWizard] Session ID invalide (pas un UUID):', sessionId);
                Alert.alert(
                    'Erreur',
                    'Session Studio invalide. Veuillez réessayer.',
                );
                return;
            }

            setStoryboardLoading(true);
            const request = buildStoryboardRequest();
            console.log('[VideoCreationWizard] Génération storyboard pour session:', sessionId);
            console.log('[VideoCreationWizard] Payload:', JSON.stringify(request, null, 2));
            const result = await studioService.generateStoryboard(sessionId, request);
            setStoryboard(result);
            const durationMs = Date.now() - startedAt;
            trackUxEvent('storyboard_generate_completed', {
                device: 'mobile',
                serviceId,
                productIndex,
                sessionId,
                step,
                durationMs,
                extra: {
                    scenes: result.scenes.length,
                },
            });
        } catch (error: any) {
            console.error('[VideoCreationWizard] Erreur génération storyboard:', error);
            const title = t('videoWizard.alert.storyboardFailedTitle') ?? 'Storyboard IA';
            const defaultMessage = t('videoWizard.alert.storyboardFailedMessage');
            let message = error?.message || defaultMessage || 'Impossible de générer le storyboard.';

            // Messages d'erreur plus spécifiques
            if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
                message = 'Erreur de connexion. Vérifiez votre accès Internet.';
            } else if (error?.message?.includes('timeout')) {
                message = 'Le délai d\'attente a expiré. Réessayez.';
            } else if (error?.message?.includes('401') || error?.message?.includes('403')) {
                message = 'Session expirée. Veuillez vous reconnecter.';
            } else if (error?.message?.includes('500')) {
                message = 'Erreur serveur. Réessayez dans quelques instants.';
            }

            Alert.alert(title, message);
            const durationMs = Date.now() - startedAt;
            trackUxEvent('storyboard_generate_failed', {
                device: 'mobile',
                serviceId,
                productIndex,
                sessionId: studioSessionId,
                step,
                durationMs,
                extra: {
                    error: error?.message ?? 'unknown',
                    errorType: error?.name ?? 'unknown',
                },
            });
        } finally {
            setStoryboardLoading(false);
        }
    }, [buildStoryboardRequest, ensureStudioSession, productIndex, serviceId, step, studioSessionId, t]);

    const assignMediaToScene = useCallback(
        (sceneId: string, mediaId: number | null) => {
            setSceneAssignments((prev) => ({
                ...prev,
                [sceneId]: mediaId,
            }));
            trackUxEvent('media_assignment_change', {
                device: 'mobile',
                serviceId,
                productIndex,
                sessionId: studioSessionId,
                step,
                extra: {
                    sceneId,
                    mediaId,
                },
            });
        },
        [productIndex, serviceId, step, studioSessionId],
    );

    const toggleSceneOptional = useCallback((sceneId: string) => {
        setScenesDraft((prev) =>
            prev.map((scene) =>
                scene.id === sceneId ? { ...scene, optional: !scene.optional } : scene,
            ),
        );
    }, []);

    const distributionChannels = useMemo(() => {
        return [
            { key: 'chat', label: t('videoWizard.channels.chat'), value: publishChat, setter: setPublishChat },
            { key: 'product', label: t('videoWizard.channels.product'), value: publishCard, setter: setPublishCard },
            { key: 'shorts', label: t('videoWizard.channels.shorts'), value: publishSocial, setter: setPublishSocial },
        ];
    }, [publishCard, publishChat, publishSocial, t]);

    const mediaSkeletonPlaceholders = useMemo(() => Array.from({ length: 4 }), []);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    const mapJobSteps = useCallback((jobSteps?: VideoJobStatus['progress_steps']) => {
        if (!jobSteps || jobSteps.length === 0) {
            return undefined;
        }
        return jobSteps.map((step) => ({
            key: step.key,
            label: step.label,
            status: step.status as 'completed' | 'pending' | 'running' | string,
            detail: step.detail ?? undefined,
        }));
    }, []);

    const startJobPolling = useCallback(
        (jobId: string) => {
            stopPolling();

            const fetchStatus = async () => {
                const statusResponse = await mediaApi.getVideoJobStatus(jobId);
                if (!statusResponse.success || !statusResponse.data) {
                    return;
                }
                const job = statusResponse.data;
                if (!job) {
                    return;
                }
                const mappedSteps = mapJobSteps(job.progress_steps);
                if (mappedSteps) {
                    applyServerSteps(mappedSteps);
                }

                if (job.status === 'completed') {
                    stopPolling();
                    resetProgress();
                    setCurrentJobId(null);
                    setIsGenerating(false);
                    const resultPayload = job.result_payload as GeneratedVideoResponse | undefined;
                    if (resultPayload) {
                        setCostEstimation(resultPayload.cost_estimation || costEstimation || null);
                        navigation.replace('VideoGenerationResult' as never, {
                            result: resultPayload,
                            costEstimation: resultPayload.cost_estimation || costEstimation || null,
                            serviceId,
                            productIndex,
                        } as never);
                    } else {
                        Alert.alert(
                            t('videoWizard.alert.renderDoneTitle'),
                            t('videoWizard.alert.renderDoneMessage'),
                        );
                    }
                } else if (job.status === 'failed') {
                    stopPolling();
                    failProgress();
                    resetProgress();
                    setCurrentJobId(null);
                    setIsGenerating(false);
                    Alert.alert(
                        t('videoWizard.alert.renderFailedTitle'),
                        job.error_message || t('videoWizard.alert.renderFailedMessage'),
                    );
                }
            };

            fetchStatus();
            pollingRef.current = setInterval(fetchStatus, 2000);
        },
        [
            applyServerSteps,
            costEstimation,
            failProgress,
            mapJobSteps,
            navigation,
            productIndex,
            resetProgress,
            serviceId,
            stopPolling,
            setCostEstimation,
        ],
    );

    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    const handleGenerate = async () => {
        if (!serviceId && serviceId !== 0) {
            return;
        }
        if (typeof productIndex !== 'number') {
            return;
        }

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

        const payload: VideoGenerationPayload = {
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
            voice_profile_id: voiceoverEnabled ? selectedVoiceProfileId ?? undefined : undefined,
            distribute_channels: distributionChannels
                .filter((item) => item.value)
                .map((item) => item.key),
            style_effects,
            style_transitions,
            style_color_palette,
            style_music_hint,
            media_scene_overrides,
        };

        try {
            setIsGenerating(true);
            startSimulation();

            const response = await iaApi.generateImmersiveVideo(serviceId, productIndex, payload);
            if (response.success && response.data?.job_id) {
                const jobId = response.data.job_id;
                setCurrentJobId(jobId);
                startJobPolling(jobId);
            } else {
                throw new Error(response.message || t('videoWizard.errors.launchFailed'));
            }
        } catch (error: any) {
            console.error('[VideoCreationWizard] Generation error', error);
            stopPolling();
            failProgress();
            resetProgress();
            setCurrentJobId(null);
            setIsGenerating(false);
            Alert.alert(
                t('videoWizard.alert.renderFailedTitle'),
                error?.message || t('videoWizard.alert.renderFailedMessage'),
            );
        }
    };

    const [shortPreviewLoading, setShortPreviewLoading] = useState(false);

    const handleShortPreview = async () => {
        if (!studioSessionId) {
            Alert.alert(
                t('videoWizard.alert.previewShortNoSessionTitle') ?? 'Prévisualisation rapide',
                t('videoWizard.alert.previewShortNoSessionMessage') ??
                'Génère d’abord un storyboard IA ou une session Studio avant la prévisualisation.',
            );
            return;
        }
        const startedAt = Date.now();
        setShortPreviewLoading(true);
        trackUxEvent('preview_short_click', {
            device: 'mobile',
            serviceId,
            productIndex,
            sessionId: studioSessionId,
            step,
        });
        try {
            if (prewarmedShortPreviewUrl) {
                Linking.openURL(prewarmedShortPreviewUrl);
                setShortPreviewStarted(true);
                const durationMs = Date.now() - startedAt;
                trackUxEvent('preview_short_completed', {
                    device: 'mobile',
                    serviceId,
                    productIndex,
                    sessionId: studioSessionId,
                    step,
                    durationMs,
                    prewarmed: true,
                });
                return;
            }
            const response = await studioService.requestShortPreview(studioSessionId);
            if (!response.preview_url) {
                Alert.alert(
                    t('videoWizard.alert.previewShortNoUrlTitle') ?? 'Prévisualisation rapide',
                    t('videoWizard.alert.previewShortNoUrlMessage') ??
                    "Impossible de récupérer l'URL de la prévisualisation.",
                );
                const durationMs = Date.now() - startedAt;
                trackUxEvent('preview_short_failed', {
                    device: 'mobile',
                    serviceId,
                    productIndex,
                    sessionId: studioSessionId,
                    step,
                    durationMs,
                    extra: { reason: 'no_preview_url' },
                });
                return;
            }
            // Ouvre le lien dans le navigateur / player natif
            // Sur mobile, on laisse le système gérer (lecteur vidéo du système)
            setPrewarmedShortPreviewUrl(response.preview_url);
            Linking.openURL(response.preview_url);
            setShortPreviewStarted(true);
            const durationMs = Date.now() - startedAt;
            trackUxEvent('preview_short_completed', {
                device: 'mobile',
                serviceId,
                productIndex,
                sessionId: studioSessionId,
                step,
                durationMs,
                prewarmed: false,
            });
        } catch (error: any) {
            Alert.alert(
                t('videoWizard.alert.previewShortFailedTitle') ?? 'Prévisualisation rapide',
                error?.message ||
                t('videoWizard.alert.previewShortFailedMessage') ||
                'Impossible de lancer la prévisualisation courte.',
            );
            const durationMs = Date.now() - startedAt;
            trackUxEvent('preview_short_failed', {
                device: 'mobile',
                serviceId,
                productIndex,
                sessionId: studioSessionId,
                step,
                durationMs,
                extra: {
                    error: error?.message ?? 'unknown',
                },
            });
        } finally {
            setShortPreviewLoading(false);
        }
    };

    const renderMediaItem = ({ item }: { item: ServiceMediaItem }) => {
        const isSelected = selectedMediaIds.includes(item.id);
        return (
            <TouchableOpacity onPress={() => toggleMediaSelection(item.id)}>
                <NativeCard style={[styles.mediaCard, isSelected && styles.mediaCardSelected]}>
                    <View style={styles.mediaHeader}>
                        <SafeIcon
                            name={isSelected ? 'check-circle' : 'image'}
                            size={22}
                            color={isSelected ? modernColors.success : modernColors.textSecondary}
                        />
                        <Text style={styles.mediaTitle} numberOfLines={1}>
                            {item.ai_description || `Média #${item.id}`}
                        </Text>
                    </View>
                    <Text style={styles.mediaSubTitle}>
                        {item.media_type || 'image'}
                    </Text>
                </NativeCard>
            </TouchableOpacity>
        );
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <Animated.View style={stepAnimatedStyle}>
                        <ScrollView
                            contentContainerStyle={styles.stepContent}
                            showsVerticalScrollIndicator={false}
                            style={styles.scrollView}
                        >
                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.sections.context')}</Text>
                                {loadingService ? (
                                    <View style={styles.skeletonStack}>
                                        <LoadingSkeleton width="65%" />
                                        <LoadingSkeleton width="42%" style={styles.skeletonSpacer} />
                                    </View>
                                ) : (
                                    <View style={styles.summaryContainer}>
                                        <Text style={styles.summaryTitle}>{serviceName}</Text>
                                        <Text style={styles.summarySubtitle}>{productName}</Text>
                                    </View>
                                )}
                                {costLoading && (
                                    <LoadingSkeleton width="80%" height={14} style={styles.skeletonSpacer} />
                                )}
                                {costEstimation && !costLoading && (
                                    <View style={styles.costBadge}>
                                        <SafeIcon name="wallet" size={18} color={modernColors.primary} />
                                        <Text style={styles.costBadgeText}>
                                            {Math.round(costEstimation.total_cost_local)} {costEstimation.local_currency} · ~
                                            {` ${costEstimation.total_cost_usd.toFixed(2)} $`}
                                        </Text>
                                    </View>
                                )}
                            </NativeCard>
                            <CreatorStudioCard serviceName={serviceName} productName={productName} />

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.sections.describe')}</Text>
                                <NativeInput
                                    testID="video-brief-input"
                                    multiline
                                    placeholder={t('videoWizard.placeholders.brief')}
                                    value={brief}
                                    onChangeText={setBrief}
                                    style={styles.textArea}
                                />
                                <View style={styles.inlineRow}>
                                    <Text style={styles.inlineLabel}>{t('videoWizard.controls.storyboard')}</Text>
                                    <Switch
                                        value={autoStoryboard}
                                        onValueChange={setAutoStoryboard}
                                    />
                                </View>
                            </NativeCard>

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.sections.style')}</Text>
                                {Platform.OS === 'ios' ? (
                                    <TouchableOpacity
                                        style={styles.pickerButton}
                                        onPress={() => {
                                            Alert.alert(
                                                'Style de vidéo',
                                                'Choisissez un style',
                                                ['IntroPulse', 'ProductShowcase', 'ARHighlight', 'GlowCTA'].map((template) => ({
                                                    text: template,
                                                    onPress: () => setSelectedStyle(template),
                                                    style: selectedStyle === template ? 'default' : undefined,
                                                })),
                                            );
                                        }}
                                    >
                                        <Text style={styles.pickerButtonText}>
                                            {selectedStyle}
                                        </Text>
                                        <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.pillContainer}>
                                        {['IntroPulse', 'ProductShowcase', 'ARHighlight', 'GlowCTA'].map((template) => (
                                            <TouchableOpacity
                                                key={template}
                                                style={[
                                                    styles.pill,
                                                    selectedStyle === template && styles.pillActive,
                                                ]}
                                                onPress={() => setSelectedStyle(template)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.pillText,
                                                        selectedStyle === template && styles.pillTextActive,
                                                    ]}
                                                >
                                                    {template}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </NativeCard>

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>Templates narratifs</Text>
                                {storyTemplatesLoading ? (
                                    <ActivityIndicator color={modernColors.primary} />
                                ) : (
                                    <View style={styles.templateList}>
                                        {templateOptions.map((spec) => {
                                            const active = spec.id === storyTemplateId;
                                            return (
                                                <TouchableOpacity
                                                    key={spec.id}
                                                    style={[
                                                        styles.templateCard,
                                                        active && styles.templateCardActive,
                                                    ]}
                                                    onPress={() => setStoryTemplateId(spec.id)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.templateTitle,
                                                            active && styles.templateTitleActive,
                                                        ]}
                                                    >
                                                        {spec.label}
                                                    </Text>
                                                    <Text style={styles.templateDescription}>
                                                        {spec.description}
                                                    </Text>
                                                    <Text style={styles.templateMeta}>
                                                        {spec.suggestedScenes} scènes · ~{spec.defaultDurationSeconds}s · CTA{' '}
                                                        {spec.ctas[0] ?? '—'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                                {selectedStoryTemplate && (
                                    <Text style={styles.templateHint}>
                                        Template sélectionné : {selectedStoryTemplate.label}
                                    </Text>
                                )}
                            </NativeCard>

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>Storyboard IA</Text>
                                <Text style={styles.sectionSubTitle}>
                                    Génère une proposition de scènes (intro, bénéfices, preuves, CTA) à partir de ton
                                    brief.
                                </Text>
                                <View style={styles.inlineRow}>
                                    <NativeButton
                                        testID="video-storyboard-generate-button"
                                        title={storyboardLoading ? 'Storyboard…' : 'Générer storyboard'}
                                        variant="primary"
                                        size="small"
                                        onPress={handleGenerateStoryboard}
                                        disabled={storyboardLoading}
                                    />
                                </View>
                                {storyboard && storyboard.scenes.length > 0 && (
                                    <View style={styles.storyboardList}>
                                        {storyboard.scenes.slice(0, 4).map((scene) => (
                                            <View key={scene.index} style={styles.storyboardItem}>
                                                <Text style={styles.storyboardSceneType}>
                                                    {scene.sceneType}
                                                </Text>
                                                <Text style={styles.storyboardSceneText} numberOfLines={2}>
                                                    {scene.headline ||
                                                        scene.body ||
                                                        t('videoWizard.summary.sceneDefaultHint')}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </NativeCard>

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.sections.mode')}</Text>
                                {Platform.OS === 'ios' ? (
                                    <TouchableOpacity
                                        style={styles.pickerButton}
                                        onPress={() => {
                                            const modeOptions = [
                                                { key: 'standard', label: t('videoWizard.mode.standardTitle'), description: t('videoWizard.mode.standardDesc') },
                                                { key: 'expert', label: t('videoWizard.mode.expertTitle'), description: t('videoWizard.mode.expertDesc') },
                                            ];
                                            Alert.alert(
                                                'Mode IA',
                                                'Choisissez un mode',
                                                modeOptions.map((item) => ({
                                                    text: `${item.label}\n${item.description}`,
                                                    onPress: () => setMode(item.key as ModePreset),
                                                    style: mode === item.key ? 'default' : undefined,
                                                })),
                                            );
                                        }}
                                    >
                                        <Text style={styles.pickerButtonText}>
                                            {mode === 'expert' ? t('videoWizard.mode.expertTitle') : t('videoWizard.mode.standardTitle')}
                                        </Text>
                                        <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.pillContainer}>
                                        {[
                                            { key: 'standard', label: t('videoWizard.mode.standardTitle'), description: t('videoWizard.mode.standardDesc') },
                                            { key: 'expert', label: t('videoWizard.mode.expertTitle'), description: t('videoWizard.mode.expertDesc') },
                                        ].map((item) => (
                                            <TouchableOpacity
                                                key={item.key}
                                                style={[styles.modeCard, mode === item.key && styles.modeCardActive]}
                                                onPress={() => setMode(item.key as ModePreset)}
                                            >
                                                <Text style={styles.modeTitle}>{item.label}</Text>
                                                <Text style={styles.modeSubTitle}>{item.description}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </NativeCard>

                        </ScrollView>
                        <View style={styles.fixedBottomButton}>
                            <NativeButton
                                title={costLoading ? t('videoWizard.buttons.estimating') : t('videoWizard.buttons.nextStepGeneric')}
                                variant="primary"
                                size="large"
                                onPress={handleEstimateCost}
                                disabled={costLoading}
                            />
                        </View>
                    </Animated.View>
                );
            case 2:
                return (
                    <Animated.View style={stepAnimatedStyle}>
                        <ScrollView
                            contentContainerStyle={styles.stepContent}
                            showsVerticalScrollIndicator={false}
                            style={styles.scrollView}
                        >
                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>
                                    {t('videoWizard.sections.media')} ({selectedMediaIds.length})
                                </Text>
                                {mediaLoading ? (
                                    <View style={styles.mediaSkeletonContainer}>
                                        {mediaSkeletonPlaceholders.map((_, index) => (
                                            <LoadingSkeleton
                                                key={`media-skeleton-${index}`}
                                                height={54}
                                                style={styles.mediaSkeleton}
                                            />
                                        ))}
                                    </View>
                                ) : (
                                    <FlatList
                                        data={mediaItems}
                                        keyExtractor={(item) => item.id.toString()}
                                        renderItem={renderMediaItem}
                                        ItemSeparatorComponent={() => <View style={styles.mediaSeparator} />}
                                        scrollEnabled={false}
                                    />
                                )}
                            </NativeCard>

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>
                                    {t('videoWizard.sections.timeline') || 'Montage par scène'}
                                </Text>
                                {scenesDraft.length === 0 ? (
                                    <Text style={styles.summaryText}>
                                        {t('videoWizard.summary.noScenes') || 'Aucune scène définie.'}
                                    </Text>
                                ) : (
                                    <>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={styles.sceneChipsRow}
                                        >
                                            {scenesDraft.map((scene, index) => {
                                                const active = index === currentSceneIndex;
                                                const assignedMediaId = sceneAssignments[scene.id];
                                                return (
                                                    <TouchableOpacity
                                                        key={scene.id}
                                                        testID={`video-timeline-chip-${index}`}
                                                        style={[
                                                            styles.sceneChip,
                                                            active && styles.sceneChipActive,
                                                        ]}
                                                        onPress={() => {
                                                            setCurrentSceneIndex(index);
                                                            trackUxEvent('scene_chip_tap', {
                                                                device: 'mobile',
                                                                serviceId,
                                                                productIndex,
                                                                sessionId: studioSessionId,
                                                                step,
                                                                sceneIndex: index,
                                                            });
                                                        }}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.sceneChipLabel,
                                                                active && styles.sceneChipLabelActive,
                                                            ]}
                                                        >
                                                            {t('videoWizard.summary.sceneShortLabel', {
                                                                defaultValue: `S${index + 1}`,
                                                                index: index + 1,
                                                            })}
                                                        </Text>
                                                        <Text style={styles.sceneChipMeta}>
                                                            {assignedMediaId
                                                                ? `#${assignedMediaId}`
                                                                : t(
                                                                    'videoWizard.summary.sceneMediaNone',
                                                                    {
                                                                        defaultValue: 'Auto',
                                                                    },
                                                                )}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                        {currentScene && (
                                            <View style={styles.scenePanel}>
                                                <View style={styles.inlineRow}>
                                                    <Text style={styles.inlineLabel}>
                                                        {t('videoWizard.summary.sceneLabel', {
                                                            defaultValue: `Scène ${currentSceneIndex + 1}`,
                                                            index: currentSceneIndex + 1,
                                                        })}
                                                    </Text>
                                                    <View style={styles.sceneOptionalRow}>
                                                        <Text style={styles.sceneOptionalLabel}>
                                                            {t(
                                                                'videoWizard.summary.optionalScene',
                                                                {
                                                                    defaultValue: 'Scène optionnelle',
                                                                },
                                                            )}
                                                        </Text>
                                                        <Switch
                                                            value={currentScene.optional}
                                                            onValueChange={() =>
                                                                toggleSceneOptional(currentScene.id)
                                                            }
                                                        />
                                                    </View>
                                                </View>
                                                <Text style={styles.scenePanelHint}>
                                                    {t('videoWizard.summary.sceneMediaHint') ||
                                                        "Choisis un média pour cette scène ou laisse Yukpo décider."}
                                                </Text>
                                                <ScrollView
                                                    style={styles.sceneMediaList}
                                                    nestedScrollEnabled
                                                    showsVerticalScrollIndicator={false}
                                                >
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.sceneMediaRow,
                                                            !sceneAssignments[currentScene.id] &&
                                                            styles.sceneMediaRowActive,
                                                        ]}
                                                        onPress={() =>
                                                            assignMediaToScene(currentScene.id, null)
                                                        }
                                                    >
                                                        <SafeIcon
                                                            name={
                                                                !sceneAssignments[currentScene.id]
                                                                    ? 'check-circle'
                                                                    : 'circle'
                                                            }
                                                            size={18}
                                                            color={modernColors.primary}
                                                        />
                                                        <Text style={styles.sceneMediaRowLabel}>
                                                            {t(
                                                                'videoWizard.summary.sceneMediaNone',
                                                                {
                                                                    defaultValue:
                                                                        'Laisser Yukpo choisir automatiquement',
                                                                },
                                                            )}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    {mediaItems.map((item) => {
                                                        const assigned =
                                                            sceneAssignments[currentScene.id] ===
                                                            item.id;
                                                        return (
                                                            <TouchableOpacity
                                                                key={item.id}
                                                                style={[
                                                                    styles.sceneMediaRow,
                                                                    assigned &&
                                                                    styles.sceneMediaRowActive,
                                                                ]}
                                                                onPress={() =>
                                                                    assignMediaToScene(
                                                                        currentScene.id,
                                                                        assigned ? null : item.id,
                                                                    )
                                                                }
                                                            >
                                                                <SafeIcon
                                                                    name={
                                                                        assigned
                                                                            ? 'check-circle'
                                                                            : 'circle'
                                                                    }
                                                                    size={18}
                                                                    color={
                                                                        assigned
                                                                            ? modernColors.success
                                                                            : modernColors.textSecondary
                                                                    }
                                                                />
                                                                <View style={styles.sceneMediaText}>
                                                                    <Text
                                                                        style={
                                                                            styles.sceneMediaRowLabel
                                                                        }
                                                                        numberOfLines={1}
                                                                    >
                                                                        {item.ai_description ||
                                                                            `Média #${item.id}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.sceneMediaRowMeta
                                                                        }
                                                                    >
                                                                        {item.media_type || 'image'}
                                                                    </Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </>
                                )}
                            </NativeCard>

                            <StudioAudioPanel
                                serviceId={serviceId}
                                voiceoverEnabled={voiceoverEnabled}
                                onVoiceoverToggle={setVoiceoverEnabled}
                                voiceoverLang={voiceoverLang as 'fr' | 'en'}
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

                        </ScrollView>
                        <View style={styles.fixedBottomButton}>
                            <View style={styles.navigationRow}>
                                <NativeButton
                                    title={t('videoWizard.buttons.prevStepShort')}
                                    variant="secondary"
                                    onPress={() => setStep(1)}
                                />
                                <NativeButton
                                    title={t('videoWizard.buttons.previewTimeline')}
                                    variant="primary"
                                    onPress={() => setStep(3)}
                                />
                            </View>
                        </View>
                    </Animated.View>
                );
            case 3:
                return (
                    <Animated.View style={stepAnimatedStyle}>
                        <ScrollView
                            contentContainerStyle={styles.stepContent}
                            showsVerticalScrollIndicator={false}
                            style={styles.scrollView}
                        >
                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.sections.summary')}</Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.service')} : {serviceName || `Service #${serviceId}`}
                                </Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.product')} : {productName}
                                </Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.style')} : {selectedStyle}
                                </Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.mode')} : {mode === 'expert' ? t('videoWizard.mode.expertTitle') : t('videoWizard.mode.standardTitle')}
                                </Text>
                                {selectedStoryTemplate && (
                                    <Text style={styles.summaryText}>
                                        Template narratif : {selectedStoryTemplate.label}
                                    </Text>
                                )}
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.mediaSelected')} : {selectedMediaIds.length}
                                </Text>
                                <Text style={styles.summaryText}>
                                    Pack de style :{' '}
                                    {stylePack === 'pulse'
                                        ? 'Pulse social'
                                        : stylePack === 'story'
                                            ? 'Story éditoriale'
                                            : 'Corporate clair'}
                                </Text>
                                {costEstimation && (
                                    <View style={styles.costContainer}>
                                        <Text style={styles.costTitle}>{t('videoWizard.summary.costTitle')}</Text>
                                        <Text style={styles.costValue}>
                                            {Math.round(costEstimation.total_cost_local)} {costEstimation.local_currency}
                                        </Text>
                                        <Text style={styles.costSubValue}>
                                            {format('videoWizard.summary.costLine', {
                                                usd: costEstimation.total_cost_usd.toFixed(2),
                                                multiplier: costEstimation.margin_multiplier,
                                            })}
                                        </Text>
                                    </View>
                                )}
                            </NativeCard>

                            {/* ✅ Phase 9 - Amélioration 31 : Sélection de vidéos liées */}
                            {studioSessionId && (
                                <NativeCard style={styles.sectionCard}>
                                    <Text style={styles.sectionTitle}>Vidéos liées (chaînage)</Text>
                                    <Text style={styles.sectionSubTitle}>
                                        Sélectionne les vidéos qui suivront celle-ci dans une séquence
                                    </Text>
                                    {availableSessions.length > 0 ? (
                                        <FlatList
                                            data={availableSessions.filter((s) => s.id !== studioSessionId)}
                                            keyExtractor={(item) => item.id}
                                            renderItem={({ item }) => {
                                                const isSelected = selectedLinkedSessions.includes(item.id);
                                                return (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.sceneMediaRow,
                                                            isSelected && styles.sceneMediaRowActive,
                                                        ]}
                                                        onPress={() => {
                                                            if (isSelected) {
                                                                setSelectedLinkedSessions(
                                                                    selectedLinkedSessions.filter((id) => id !== item.id)
                                                                );
                                                            } else {
                                                                setSelectedLinkedSessions([...selectedLinkedSessions, item.id]);
                                                            }
                                                        }}
                                                    >
                                                        <SafeIcon
                                                            name={isSelected ? 'check-circle' : 'circle'}
                                                            size={18}
                                                            color={isSelected ? modernColors.success : modernColors.textSecondary}
                                                        />
                                                        <Text style={styles.sceneMediaRowLabel}>
                                                            {item.title || `Session ${item.id.slice(0, 8)}`}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                            scrollEnabled={false}
                                        />
                                    ) : (
                                        <Text style={styles.summaryText}>Aucune autre session disponible</Text>
                                    )}
                                    {selectedLinkedSessions.length > 0 && (
                                        <NativeButton
                                            title="Enregistrer les liens"
                                            variant="primary"
                                            size="small"
                                            onPress={async () => {
                                                if (!studioSessionId) return;
                                                try {
                                                    await studioService.setDependencies(studioSessionId, selectedLinkedSessions);
                                                    Alert.alert('Succès', 'Vidéos liées enregistrées');
                                                    const deps = await studioService.getDependencies(studioSessionId);
                                                    setDependencies(deps);
                                                } catch (error: any) {
                                                    Alert.alert('Erreur', error.message || 'Erreur lors de l\'enregistrement');
                                                }
                                            }}
                                            style={{ marginTop: 12 }}
                                        />
                                    )}
                                    {dependencies.length > 0 && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={styles.sectionSubTitle}>Vidéos liées :</Text>
                                            {dependencies.map((dep, idx) => (
                                                <Text key={dep.id} style={styles.summaryText}>
                                                    {idx + 1}. Session {dep.child_session_id.slice(0, 8)}
                                                </Text>
                                            ))}
                                        </View>
                                    )}
                                </NativeCard>
                            )}

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.sections.publication')}</Text>
                                {distributionChannels.map((item) => (
                                    <View key={item.key} style={styles.inlineRow}>
                                        <Text style={styles.inlineLabel}>{item.label}</Text>
                                        <Switch value={item.value} onValueChange={item.setter} />
                                    </View>
                                ))}
                            </NativeCard>

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>
                                    {t('videoWizard.sections.previewShort') ?? 'Prévisualisation rapide'}
                                </Text>
                                <Text style={styles.sectionSubTitle}>
                                    Lance un aperçu court (~3–5s) de ton montage pour tester le rythme avant le rendu complet.
                                </Text>
                                <View style={styles.inlineRow}>
                                    <NativeButton
                                        title={
                                            shortPreviewLoading
                                                ? t('videoWizard.buttons.previewShortLoading') ?? 'Prévisualisation…'
                                                : t('videoWizard.buttons.previewShort') ?? 'Prévisualiser 3s'
                                        }
                                        variant="primary"
                                        onPress={handleShortPreview}
                                        disabled={shortPreviewLoading}
                                    />
                                </View>
                            </NativeCard>

                        </ScrollView>
                        <View style={styles.fixedBottomButton}>
                            <View style={styles.navigationRow}>
                                <NativeButton
                                    testID="video-next-step-button"
                                    title={t('videoWizard.buttons.prevStepShort')}
                                    variant="secondary"
                                    onPress={() => setStep(2)}
                                />
                                <NativeButton
                                    testID="video-preview-short-button"
                                    title={isGenerating ? t('videoWizard.buttons.rendering') : t('videoWizard.buttons.launchRender')}
                                    variant="primary"
                                    onPress={handleGenerate}
                                    disabled={isGenerating}
                                />
                            </View>
                        </View>
                    </Animated.View>
                );
            default:
                return null;
        }
    };

    const renderProgressModal = () => (
        <Modal visible={isGenerating} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <Animated.View style={[styles.modalCard, modalAnimatedStyle]}>
                    <Text style={styles.modalTitle}>{t('videoWizard.modal.title')}</Text>
                    <Text style={styles.modalSubtitle}>{t('videoWizard.modal.subtitle')}</Text>
                    <View style={styles.modalSteps}>
                        {progressSteps.map((item) => (
                            <Animated.View
                                key={item.key}
                                style={[
                                    styles.modalStepRow,
                                    item.status === 'running' ? runningPulseStyle : undefined,
                                ]}
                            >
                                <SafeIcon
                                    name={item.status === 'completed' ? 'check-circle' : item.status === 'running' ? 'loader' : 'circle'}
                                    size={20}
                                    color={item.status === 'completed' ? modernColors.success : modernColors.textSecondary}
                                />
                                <Animated.Text
                                    style={[
                                        styles.modalStepLabel,
                                        item.status === 'running' ? runningPulseStyle : undefined,
                                    ]}
                                >
                                    {item.label}
                                </Animated.Text>
                            </Animated.View>
                        ))}
                    </View>
                    <ActivityIndicator color={modernColors.primary} style={{ marginTop: 12 }} />
                </Animated.View>
            </View>
        </Modal>
    );

    return (
        <SafeNativeView
            style={styles.container}
            edges={['top', 'bottom']}
            testID="video-wizard-screen"
        >
            <View style={styles.stepHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <View style={styles.stepHeaderText}>
                    {loadingService ? (
                        <>
                            <LoadingSkeleton width={140} height={16} style={styles.headerSkeletonPrimary} />
                            <LoadingSkeleton width={80} height={12} style={styles.headerSkeletonSecondary} />
                        </>
                    ) : (
                        <>
                            <Text style={styles.stepService}>{serviceName}</Text>
                            <Text style={styles.stepTitle}>{format('videoWizard.meta.stepCountShort', { step })}</Text>
                        </>
                    )}
                </View>
                <View style={{ width: 24 }} />
            </View>

            {renderStepContent()}

            {renderProgressModal()}

            {shortPreviewStarted && <View testID="video-preview-short-started" />}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.border,
    },
    stepHeaderText: {
        flex: 1,
        alignItems: 'center',
    },
    headerSkeletonPrimary: {
        marginBottom: 6,
    },
    headerSkeletonSecondary: {},
    stepService: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    scrollView: {
        flex: 1,
    },
    stepContent: {
        padding: 20,
        gap: 20,
        paddingBottom: 100, // Espace pour le bouton fixe
    },
    fixedBottomButton: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 40,
        backgroundColor: modernColors.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.3)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: modernColors.surface,
        marginTop: 8,
    },
    pickerButtonText: {
        fontSize: 15,
        color: modernColors.text,
        flex: 1,
    },
    sectionCard: {
        gap: 16,
    },
    sectionSubTitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    skeletonStack: {
        gap: 10,
    },
    skeletonSpacer: {
        marginTop: 8,
    },
    summaryContainer: {
        gap: 2,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    summarySubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    textArea: {
        minHeight: 120,
    },
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    inlineLabel: {
        fontSize: 16,
        color: modernColors.text,
        flex: 1,
    },
    pillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
        gap: 8,
    },
    pill: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: modernColors.surface,
    },
    pillSmall: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: modernColors.surface,
    },
    pillActive: {
        backgroundColor: modernColors.primary,
    },
    pillText: {
        color: modernColors.text,
        fontWeight: '600',
    },
    pillTextActive: {
        color: '#FFF',
    },
    templateList: {
        width: '100%',
    },
    templateCard: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        backgroundColor: 'rgba(10,16,30,0.75)',
    },
    templateCardActive: {
        borderColor: 'rgba(16,185,129,0.7)',
        backgroundColor: 'rgba(16,185,129,0.12)',
    },
    templateTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    templateTitleActive: {
        color: modernColors.success,
    },
    templateDescription: {
        marginTop: 4,
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    templateMeta: {
        marginTop: 4,
        fontSize: 12,
        color: 'rgba(255,255,255,0.65)',
    },
    templateHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    modeCard: {
        flex: 1,
        padding: 16,
        borderRadius: 18,
        backgroundColor: modernColors.surface,
    },
    modeCardActive: {
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    modeTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    modeSubTitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 6,
    },
    navigationRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
    },
    mediaCard: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: modernColors.surface,
    },
    mediaCardSelected: {
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: modernColors.surfaceVariant,
    },
    mediaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    mediaTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    mediaSubTitle: {
        marginTop: 8,
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    mediaSeparator: {
        height: 12,
    },
    mediaSkeletonContainer: {
        gap: 12,
    },
    mediaSkeleton: {
        borderRadius: 16,
    },
    sceneChipsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
    },
    sceneChip: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.5)',
        backgroundColor: 'rgba(15,23,42,0.7)',
        marginRight: 6,
    },
    sceneChipActive: {
        borderColor: modernColors.primary,
        backgroundColor: 'rgba(59,130,246,0.25)',
    },
    sceneChipLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    sceneChipLabelActive: {
        color: '#fff',
    },
    sceneChipMeta: {
        fontSize: 10,
        color: 'rgba(148,163,184,0.9)',
    },
    scenePanel: {
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.5)',
        padding: 10,
        backgroundColor: 'rgba(15,23,42,0.8)',
        gap: 8,
    },
    scenePanelHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    sceneMediaList: {
        maxHeight: 220,
        marginTop: 4,
    },
    sceneMediaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        borderRadius: 10,
        paddingHorizontal: 8,
    },
    sceneMediaRowActive: {
        backgroundColor: 'rgba(37,99,235,0.18)',
    },
    sceneMediaRowLabel: {
        fontSize: 13,
        color: '#fff',
    },
    sceneMediaRowMeta: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    sceneMediaText: {
        flex: 1,
    },
    sceneOptionalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sceneOptionalLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    summaryText: {
        fontSize: 15,
        color: modernColors.text,
    },
    costContainer: {
        marginTop: 16,
        backgroundColor: modernColors.surfaceVariant,
        padding: 16,
        borderRadius: 16,
        gap: 6,
    },
    costTitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    costValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
    },
    costSubValue: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    costBadge: {
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: modernColors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    costBadgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    storyboardList: {
        marginTop: 8,
        gap: 6,
    },
    storyboardItem: {
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.35)',
        borderRadius: 12,
        padding: 10,
        backgroundColor: 'rgba(15,23,42,0.8)',
    },
    storyboardSceneType: {
        fontSize: 11,
        fontWeight: '700',
        color: '#bfdbfe',
    },
    storyboardSceneText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        borderRadius: 24,
        padding: 24,
        backgroundColor: modernColors.background,
        gap: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    modalSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    modalSteps: {
        gap: 10,
    },
    modalStepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalStepLabel: {
        fontSize: 15,
        color: modernColors.text,
    },
});

export default VideoCreationWizardScreen;
