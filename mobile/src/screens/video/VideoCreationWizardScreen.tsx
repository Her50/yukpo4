import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreatorStudioCard } from '../../components/CreatorStudioCard';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { StudioAudioPanel } from '../../components/StudioAudioPanel';
import { VideoProgressModal } from '../../components/VideoProgressModal';
import { config } from '../../config/environment';
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
import { extractDescription, extractProductName, extractServiceName, safeStringDisplay } from '../../utils/displayHelpers';
import { normalizeServiceProducts } from '../../utils/productNormalizer';
import { apiCallWithRetry } from '../../utils/retryWithBackoff';
import { clearVideoDraft, loadVideoDraft, saveVideoDraft } from '../../utils/videoDraftStorage';
import { navigateToMesServicesHub } from '../../navigation/mesServicesNavigation';

const buildMediaUrl = (path: string | undefined | null): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:image')) return path;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const base = (config.API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
};

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
type CreationSource = 'media' | 'ai_virtual';

const buildFallbackStoryTemplates = (t: (key: string) => string): StoryTemplateSpec[] => [
    {
        id: 'blog',
        label: t('videoWizard.fallback.blogLabel'),
        description: t('videoCreationWizard.recitEditorialIdealPourActus'),
        recommendedCategories: [],
        tones: ['inspirational'],
        ctas: [t('videoWizard.fallback.ctaDiscover')],
        defaultDurationSeconds: 30,
        suggestedScenes: 3,
    },
    {
        id: 'tutorial',
        label: t('videoWizard.fallback.tutorialLabel'),
        description: t('videoCreationWizard.pasapasPourExpliquerUnServiceapp'),
        recommendedCategories: [],
        tones: ['educational'],
        ctas: [t('videoWizard.fallback.ctaTry')],
        defaultDurationSeconds: 36,
        suggestedScenes: 4,
    },
    {
        id: 'testimonial',
        label: t('videoCreationWizard.temoignageClient'),
        description: t('videoWizard.fallback.testimonialDesc'),
        recommendedCategories: [],
        tones: ['trust'],
        ctas: [t('videoWizard.fallback.ctaBook')],
        defaultDurationSeconds: 28,
        suggestedScenes: 3,
    },
    {
        id: 'comparison',
        label: t('videoWizard.fallback.comparisonLabel'),
        description: t('videoWizard.fallback.comparisonDesc'),
        recommendedCategories: [],
        tones: ['bold'],
        ctas: [t('videoCreationWizardScreen.passerAYukpo')],
        defaultDurationSeconds: 32,
        suggestedScenes: 4,
    },
];

const VideoCreationWizardScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params || {}) as WizardParams;
    const { t } = useLanguageSafe();
    const insets = useSafeAreaInsets();

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
    // ✅ NOUVEAU: Tracking des étapes complétées
    const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
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
    // ✅ CORRECTION: Flag pour éviter les toasts multiples
    const completionHandledRef = useRef(false);
    // ✅ CORRECTION: Refs pour les ScrollView de chaque étape (pour remettre le scroll au début lors du changement d'étape)
    const scrollViewRefs = useRef<Record<WizardStep, React.ComponentRef<typeof ScrollView> | null>>({
        1: null,
        2: null,
        3: null,
    });

    const [creationSource, setCreationSource] = useState<CreationSource>('media');
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

    // ✅ CORRECTION: Fonction helper pour calculer les styles dynamiquement avec insets
    // ✅ AMÉLIORATION: Augmenter significativement les paddings et gaps pour minimiser les scrolls verticaux
    const getStepContentStyle = useCallback(() => ({
        padding: 28, // ✅ AUGMENTÉ: De 20 à 28 pour plus d'espace
        gap: 28, // ✅ AUGMENTÉ: De 20 à 28 pour meilleure séparation visuelle
        // ✅ CORRECTION: Calculer dynamiquement le paddingBottom en fonction de la hauteur des boutons + safe area
        // Hauteur bouton (~60px) + padding top (16px) + padding bottom (20-34px) + safe area bottom + marge (28px)
        paddingBottom: 120 + insets.bottom, // ✅ AUGMENTÉ: De 100 à 120 pour garantir que tout le contenu est visible
        // ✅ CORRECTION: Utiliser flexGrow au lieu de minHeight pour permettre le scroll complet
        flexGrow: 1,
    }), [insets.bottom]);

    const getFixedBottomButtonStyle = useCallback(() => ({
        ...styles.fixedBottomButtonBase,
        // ✅ CORRECTION: Utiliser insets.bottom pour gérer dynamiquement la safe area
        paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 16), // ✅ Ajuster pour safe area
        minHeight: 80 + insets.bottom, // ✅ Hauteur minimale pour garantir la visibilité
    }), [insets.bottom]);

    const fallbackStoryTemplates = useMemo(() => buildFallbackStoryTemplates(t), [t]);
    const templateOptions =
        storyTemplates.length > 0 ? storyTemplates : fallbackStoryTemplates;
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
    const [generationStartTime, setGenerationStartTime] = useState<number | undefined>();
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

    // ✅ NOUVEAU: Fonction pour marquer une étape comme complétée
    const markStepCompleted = useCallback((stepNum: WizardStep) => {
        setCompletedSteps((prev) => new Set([...prev, stepNum]));
    }, []);

    // ✅ NOUVEAU: Validation avant navigation vers étape suivante
    const validateStepCompletion = useCallback((stepNum: WizardStep): { canProceed: boolean; error?: string } => {
        switch (stepNum) {
            case 1:
                // Valider que le brief ou les templates sont définis
                if (brief.trim().length === 0 && !storyTemplateId) {
                    return {
                        canProceed: false,
                        error: t('videoCreationWizardScreen.veuillezRenseignerUnBriefOuSelectionner')
                    };
                }
                if (!selectedStyle) {
                    return {
                        canProceed: false,
                        error: t('videoCreationWizardScreen.veuillezSelectionnerUnStyleDeVideo')
                    };
                }
                return { canProceed: true };
            case 2:
                // Valider étape 2 (optionnel - médias peuvent être auto-sélectionnés)
                // Pas de validation stricte ici
                return { canProceed: true };
            case 3:
                // Validation finale avant génération
                return { canProceed: true };
            default:
                return { canProceed: false, error: t('videoCreationWizardScreen.etapeInvalide') };
        }
    }, [brief, storyTemplateId, selectedStyle]);

    // ✅ NOUVEAU: Calculer la progression globale
    const globalProgress = useMemo(() => {
        const totalSteps = 3;
        const completed = completedSteps.size;
        // Inclure l'étape actuelle si elle est validée
        const currentStepValidated = validateStepCompletion(step).canProceed;
        const effectiveCompleted = currentStepValidated ? completed + 1 : completed;
        return Math.min(Math.round((effectiveCompleted / totalSteps) * 100), 100);
    }, [completedSteps, step, validateStepCompletion]);

    // ✅ NOUVEAU: Vérifier lors de la navigation
    const handleStepChange = useCallback((newStep: WizardStep) => {
        const currentStepNum = step;

        // Si on revient en arrière, c'est toujours OK
        if (newStep < currentStepNum) {
            setStep(newStep);
            return;
        }

        // Si on avance, valider l'étape actuelle
        const validation = validateStepCompletion(currentStepNum);
        if (validation.canProceed) {
            markStepCompleted(currentStepNum);
            setStep(newStep);
        } else {
            Alert.alert(
                t('videoWizardExtra.stepIncomplete'),
                validation.error || t('videoWizardExtra.stepIncompleteMsg')
            );
        }
    }, [step, validateStepCompletion, markStepCompleted]);

    // ✅ CORRECTION: Remettre le scroll au début lors du changement d'étape
    useEffect(() => {
        const scrollViewRef = scrollViewRefs.current[step];
        if (scrollViewRef) {
            // Utiliser un petit délai pour s'assurer que le ScrollView est rendu
            setTimeout(() => {
                scrollViewRef.scrollTo({ y: 0, animated: true });
            }, 100);
        }
    }, [step]);

    const fetchServiceDetails = useCallback(async () => {
        if (!serviceId && serviceId !== 0) {
            setLoadingService(false);
            // ✅ CORRIGÉ: Afficher un message d'erreur si serviceId est manquant
            Alert.alert(
                t('videoWizardExtra.serviceRequired'),
                t('videoWizardExtra.serviceRequiredMsg'),
                [
                    {
                        text: t('videoWizardExtra.back'),
                        onPress: () => navigation.goBack(),
                        style: 'cancel',
                    },
                    {
                        text: t('videoWizardExtra.createService'),
                        onPress: () => {
                            const parent = (navigation as any).getParent?.();
                            navigateToMesServicesHub(parent || navigation);
                        },
                    },
                ]
            );
            return;
        }
        try {
            setLoadingService(true);
            // ✅ PHASE 1: Retry automatique avec backoff
            const response = await apiCallWithRetry(() => apiGet<any>(`/api/services/${serviceId}`));
            if (response.success && response.data) {
                const service = response.data;

                // ✅ CORRECTION: Utiliser extractServiceName pour éviter l'affichage de JSON
                setServiceName(extractServiceName(service, `Service #${serviceId}`));

                // ✅ CORRECTION: Normaliser les produits avec normalizeServiceProducts
                const produits = normalizeServiceProducts(service.data?.produits);

                // ✅ Phase 7 - Amélioration 21 : Auto-remplissage Brief IA depuis description produit/service
                if (typeof productIndex === 'number' && produits[productIndex]) {
                    const p = produits[productIndex];

                    // ✅ CORRECTION: Utiliser extractProductName pour éviter l'affichage de JSON
                    setProductName(extractProductName(p, t('videoWizard.defaultProduct')));

                    // ✅ CORRECTION: Utiliser extractDescription pour éviter l'affichage de JSON dans TextInput
                    const productDesc = extractDescription(p.description || p.desc, '');
                    if (productDesc && !brief) {
                        setBrief(productDesc);
                    } else {
                        const serviceDesc = extractDescription(service.description, '');
                        if (produits.length <= 2 && serviceDesc && !brief) {
                            // Priorité 2 : Description du service si ≤ 2 produits
                            setBrief(serviceDesc);
                        }
                    }
                } else {
                    // ✅ CORRECTION: Utiliser extractDescription pour éviter l'affichage de JSON
                    const serviceDesc = extractDescription(service.description, '');
                    if (serviceDesc && !brief) {
                        // Si pas de produit spécifique, utiliser description service
                        setBrief(serviceDesc);
                    }
                }
            } else {
                // ✅ CORRIGÉ: Afficher un message d'erreur si le service n'est pas trouvé
                Alert.alert(
                    t('videoWizardExtra.serviceNotFound'),
                    t('videoWizardExtra.serviceNotFoundMsg'),
                    [
                        {
                            text: t('videoWizardExtra.back'),
                            onPress: () => navigation.goBack(),
                            style: 'cancel',
                        },
                        {
                            text: t('videoWizardExtra.retry'),
                            onPress: () => fetchServiceDetails(),
                        },
                    ]
                );
            }
        } catch (error) {
            console.warn('[VideoCreationWizard] Service introuvable', error);
            // ✅ CORRIGÉ: Afficher un message d'erreur en cas d'erreur
            const errorMessage = (error as any)?.message || t('videoWizard.errors.unknownError');
            const isNetworkError = errorMessage.toLowerCase().includes('network') ||
                errorMessage.toLowerCase().includes('timeout') ||
                errorMessage.toLowerCase().includes('fetch');

            Alert.alert(
                isNetworkError ? t('videoWizardExtra.connectionProblem') : t('videoWizardExtra.loadError'),
                isNetworkError
                    ? t('videoWizardExtra.connectionErrorMsg')
                    : `${errorMessage}`,
                [
                    {
                        text: t('videoWizardExtra.back'),
                        onPress: () => navigation.goBack(),
                        style: 'cancel',
                    },
                    {
                        text: t('videoWizardExtra.retry'),
                        onPress: () => fetchServiceDetails(),
                    },
                ]
            );
        } finally {
            setLoadingService(false);
        }
    }, [serviceId, productIndex, t, brief, navigation]);

    const fetchServiceMedia = useCallback(async () => {
        if (!serviceId || productIndex === undefined) {
            console.warn('[VideoCreationWizard] ⚠️ serviceId ou productIndex manquant:', { serviceId, productIndex });
            return;
        }
        try {
            setMediaLoading(true);
            const allMediaItems: ServiceMediaItem[] = [];

            console.log('[VideoCreationWizard] 🎬 Début chargement médias pour serviceId:', serviceId, 'productIndex:', productIndex);

            // ✅ CORRECTION: Charger les médias du produit spécifique
            const productResponse = await apiCallWithRetry(() => mediaApi.getProductMedia(serviceId, productIndex));
            console.log('[VideoCreationWizard] 🔍 Réponse getProductMedia:', {
                success: productResponse.success,
                hasData: !!productResponse.data,
                isArray: Array.isArray(productResponse.data),
                length: Array.isArray(productResponse.data) ? productResponse.data.length : 0
            });

            if (productResponse.success) {
                // ✅ CORRIGÉ: Gérer toutes les structures de réponse possibles
                const rawData = productResponse.data as any;
                let extractedMedia: any[] = [];
                if (Array.isArray(rawData)) {
                    extractedMedia = rawData;
                } else if (rawData && Array.isArray(rawData.data)) {
                    extractedMedia = rawData.data;
                } else if (rawData && Array.isArray(rawData.items)) {
                    extractedMedia = rawData.items;
                } else if (rawData && Array.isArray(rawData.media)) {
                    extractedMedia = rawData.media;
                } else {
                    console.warn('[VideoCreationWizard] ⚠️ Format de réponse getProductMedia inattendu:', rawData);
                }
                if (extractedMedia.length > 0) {
                    allMediaItems.push(...extractedMedia);
                    console.log('[VideoCreationWizard] ✅ Médias produits chargés:', extractedMedia.length);
                }
            } else {
                console.warn('[VideoCreationWizard] ⚠️ getProductMedia a échoué:', productResponse);
            }

            // ✅ AMÉLIORATION: Si peu de médias trouvés pour ce produit, charger aussi les médias du service entier
            // (utile pour les vidéos avec plusieurs produits ou si le produit n'a pas assez de médias)
            if (allMediaItems.length < 3) {
                console.log('[VideoCreationWizard] 📦 Peu de médias pour le produit (' + allMediaItems.length + '), chargement des médias du service...');
                const serviceResponse = await apiCallWithRetry(() => mediaApi.getServiceMediaDetailed(serviceId));
                console.log('[VideoCreationWizard] 🔍 Réponse getServiceMediaDetailed:', {
                    success: serviceResponse.success,
                    hasData: !!serviceResponse.data,
                    isArray: Array.isArray(serviceResponse.data),
                    length: Array.isArray(serviceResponse.data) ? serviceResponse.data.length : 0
                });

                if (serviceResponse.success) {
                    let serviceMedia: ServiceMediaItem[] = [];
                    const svcRaw = serviceResponse.data as any;
                    if (Array.isArray(svcRaw)) {
                        serviceMedia = svcRaw;
                    } else if (svcRaw && Array.isArray(svcRaw.data)) {
                        serviceMedia = svcRaw.data;
                    } else if (svcRaw && Array.isArray(svcRaw.items)) {
                        serviceMedia = svcRaw.items;
                    } else if (svcRaw && Array.isArray(svcRaw.media)) {
                        serviceMedia = svcRaw.media;
                    }

                    // ✅ Fusionner en évitant les doublons (par id)
                    const existingIds = new Set(allMediaItems.map(m => m.id));
                    const uniqueServiceMedia = serviceMedia.filter(m => !existingIds.has(m.id));
                    allMediaItems.push(...uniqueServiceMedia);
                    console.log('[VideoCreationWizard] ✅ Médias service ajoutés:', uniqueServiceMedia.length, '(total:', allMediaItems.length + ')');
                } else {
                    console.warn('[VideoCreationWizard] ⚠️ getServiceMediaDetailed a échoué:', serviceResponse);
                }
            }

            console.log('[VideoCreationWizard] ✅ Total médias chargés:', allMediaItems.length);
            setMediaItems(allMediaItems);
            // ✅ CORRIGÉ: Auto-sélectionner tous les médias chargés pour réduire les gestes utilisateur
            if (allMediaItems.length > 0 && selectedMediaIds.length === 0) {
                setSelectedMediaIds(allMediaItems.map(m => m.id).filter((id): id is number => typeof id === 'number' && id > 0));
            }
        } catch (error: any) {
            console.error('[VideoCreationWizard] ❌ Erreur chargement médias:', {
                error: error?.message || String(error),
                stack: error?.stack
            });
            // ✅ AMÉLIORATION: Afficher une alerte pour informer l'utilisateur
            Alert.alert(
                t('videoWizardExtra.mediaUnavailable'),
                t('videoWizardExtra.mediaUnavailableMsg'),
                [{ text: t('videoWizard.ok') }]
            );
        } finally {
            setMediaLoading(false);
        }
    }, [serviceId, productIndex]);

    // ✅ PHASE 1: Charger le brouillon au démarrage
    useEffect(() => {
        const loadDraft = async () => {
            try {
                const draft = await loadVideoDraft();
                if (draft && draft.serviceId === serviceId && draft.productIndex === productIndex) {
                    Alert.alert(
                        t('videoWizardExtra.draftFound'),
                        t('videoWizardExtra.draftFoundMsg'),
                        [
                            {
                                text: t('videoWizardExtra.draftNo'),
                                onPress: async () => {
                                    await clearVideoDraft();
                                },
                                style: 'cancel',
                            },
                            {
                                text: t('videoWizardExtra.draftYes'),
                                onPress: () => {
                                    // Restaurer les valeurs du brouillon
                                    if (draft.brief) setBrief(draft.brief);
                                    if (draft.headline) setHeadline(draft.headline);
                                    if (draft.callToAction) setCallToAction(draft.callToAction);
                                    if (draft.selectedMediaIds) setSelectedMediaIds(draft.selectedMediaIds);
                                    if (draft.sceneAssignments) setSceneAssignments(draft.sceneAssignments);
                                    if (draft.scenesDraft) setScenesDraft(draft.scenesDraft);
                                    if (draft.storyTemplateId) setStoryTemplateId(draft.storyTemplateId);
                                    if (draft.stylePack) setStylePack(draft.stylePack);
                                    if (draft.musicMode && (draft.musicMode === 'pulse' || draft.musicMode === 'lofi' || draft.musicMode === 'ambient' || draft.musicMode === 'cinematic' || draft.musicMode === 'none')) {
                                        setMusicMode(draft.musicMode as MusicMode);
                                    }
                                    if (draft.voiceoverEnabled !== undefined) setVoiceoverEnabled(draft.voiceoverEnabled);
                                    if (draft.voiceoverLang) setVoiceoverLang(draft.voiceoverLang);
                                    if (draft.selectedVoiceProfileId) setSelectedVoiceProfileId(draft.selectedVoiceProfileId);
                                    if (draft.autoStoryboard !== undefined) setAutoStoryboard(draft.autoStoryboard);
                                    if (draft.mode) setMode(draft.mode);
                                    if (draft.selectedStyle) setSelectedStyle(draft.selectedStyle);
                                    if (draft.publishChat !== undefined) setPublishChat(draft.publishChat);
                                    if (draft.publishCard !== undefined) setPublishCard(draft.publishCard);
                                    if (draft.publishSocial !== undefined) setPublishSocial(draft.publishSocial);
                                },
                            },
                        ]
                    );
                }
            } catch (error) {
                console.error('[VideoCreationWizard] Erreur chargement brouillon:', error);
            }
        };
        loadDraft();
    }, [serviceId, productIndex]);

    useEffect(() => {
        fetchServiceDetails();
    }, [fetchServiceDetails]);

    // ✅ PHASE 1: Sauvegarde automatique du brouillon avec debounce réel
    useEffect(() => {
        const timer = setTimeout(() => {
            const draft = {
                serviceId,
                productIndex,
                productName,
                serviceName,
                brief,
                headline,
                callToAction,
                selectedMediaIds,
                sceneAssignments,
                scenesDraft,
                storyTemplateId,
                stylePack,
                musicMode,
                voiceoverEnabled,
                voiceoverLang,
                selectedVoiceProfileId,
                autoStoryboard,
                mode,
                selectedStyle,
                publishChat,
                publishCard,
                publishSocial,
            };
            saveVideoDraft(draft);
        }, 1500); // 1.5s debounce
        return () => clearTimeout(timer);
    }, [
        serviceId,
        productIndex,
        productName,
        serviceName,
        brief,
        headline,
        callToAction,
        selectedMediaIds,
        sceneAssignments,
        scenesDraft,
        storyTemplateId,
        stylePack,
        musicMode,
        voiceoverEnabled,
        voiceoverLang,
        selectedVoiceProfileId,
        autoStoryboard,
        mode,
        selectedStyle,
        publishChat,
        publishCard,
        publishSocial,
    ]);

    // ✅ CORRIGÉ: Précharger les médias dès le chargement (pas attendre step 2)
    useEffect(() => {
        if (serviceId && productIndex !== undefined) {
            fetchServiceMedia();
        }
    }, [fetchServiceMedia]);

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

    // ✅ CORRECTION CRITIQUE: Initialiser l'opacité à 1 AVANT tout pour éviter les écrans vides
    useEffect(() => {
        stepTransition.setValue(1); // ✅ Initialiser à 1 pour que le contenu soit visible dès le départ
    }, []);

    // ✅ PHASE 3: Animation de transition améliorée entre les étapes
    // ✅ CORRIGÉ: S'assurer que l'animation se déclenche toujours et que le contenu reste visible
    useEffect(() => {
        // ✅ CORRECTION: Ne pas mettre à 0 si c'est le premier rendu (step === 1)
        // Cela évite un flash blanc au chargement initial
        if (step === 1) {
            // Pour le premier step, on garde l'opacité à 1
            stepTransition.setValue(1);
        } else {
            // Pour les changements de step, on anime depuis 0.3 (pas complètement invisible)
            stepTransition.setValue(0.3);
            // Animation plus fluide avec spring pour un effet plus naturel
            Animated.spring(stepTransition, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }).start((finished) => {
                // ✅ CORRECTION: Si l'animation échoue, forcer l'opacité à 1
                if (!finished) {
                    stepTransition.setValue(1);
                }
            });
        }
    }, [step]);

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
                        outputRange: [20, 0],
                    }),
                } as any,
                {
                    scale: stepTransition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                    }),
                } as any,
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
                Alert.alert(t('videoWizardExtra.voiceProfile'), t('videoWizardExtra.voiceProfileCreated'));
                setSelectedVoiceProfileId((prev) => prev ?? profile.id);
            } catch (error: any) {
                Alert.alert(t('videoWizardExtra.voiceProfile'), error?.message || t('videoWizardExtra.voiceProfileCreateError'));
            }
        },
        [createProfile],
    );

    const handleDeleteVoiceProfile = useCallback(
        async (profileId: number) => {
            try {
                await deleteProfile(profileId);
                Alert.alert(t('videoWizardExtra.voiceProfile'), t('videoWizardExtra.voiceProfileDeleted'));
                setSelectedVoiceProfileId((prev) => (prev === profileId ? undefined : prev));
            } catch (error: any) {
                Alert.alert(t('videoWizardExtra.voiceProfile'), error?.message || t('videoWizardExtra.voiceProfileDeleteError'));
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
                use_service_mediatech: true,
                include_publicite_assets: true,
                music_mode: musicMode !== 'none' ? musicMode : undefined,
                voiceover_lang: voiceoverEnabled ? voiceoverLang : undefined,
                voiceover_script: voiceoverEnabled ? brief : undefined,
                voice_profile_id: voiceoverEnabled ? selectedVoiceProfileId ?? undefined : undefined,
                creation_source: creationSource,
                ai_video_prompt: creationSource === 'ai_virtual' ? brief : undefined,
                media_scene_overrides: undefined,
            };

            // ✅ PHASE 1: Retry automatique avec backoff
            const response = await apiCallWithRetry(() => iaApi.estimateVideoCost(serviceId, productIndex, payload));
            const estimationResponse = response.data as VideoCostEstimateResponse | VideoCostEstimation | undefined;
            const estimation =
                estimationResponse && 'data' in estimationResponse
                    ? estimationResponse.data
                    : (estimationResponse as VideoCostEstimation | undefined);

            if (estimation) {
                setCostEstimation(estimation);
                // ✅ Vérifier si le solde est suffisant
                if (estimation.affordable === false) {
                    const balanceStr = estimation.current_balance_fcfa != null
                        ? `${Math.round(estimation.current_balance_fcfa).toLocaleString()} FCFA`
                        : t('videoWizard.unknown');
                    const costStr = `${Math.round(estimation.total_cost_local).toLocaleString()} ${estimation.local_currency}`;
                    Alert.alert(
                        t('videoWizardExtra.insufficientBalance'),
                        t('videoWizardExtra.insufficientBalanceMsg', { cost: costStr, balance: balanceStr }),
                        [
                            { text: t('message.cancel'), style: 'cancel' },
                            { text: t('videoWizardExtra.recharge'), onPress: () => (navigation as any).navigate('RechargeTokens') },
                        ]
                    );
                }
                // ✅ CORRECTION: Marquer étape 1 complétée et passer à l'étape 2
                markStepCompleted(1);
                setStep(2);
            } else {
                const errorMsg = response.message || t('videoWizard.alert.retrySoon') || t('videoWizard.errors.estimationError');
                Alert.alert(t('videoWizard.alert.estimationFailedTitle'), errorMsg);
                console.error('[VideoCreationWizard] Estimation vide:', response);
            }
        } catch (error: any) {
            console.error('[VideoCreationWizard] Erreur estimation coût:', error);
            let message = error?.message || t('videoWizard.alert.serverError') || t('videoWizard.errors.serverError');

            // Messages d'erreur plus spécifiques
            if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
                message = t('videoCreationWizardScreen.erreurDeConnexionVerifiezVotreAcces');
            } else if (error?.message?.includes('timeout')) {
                message = t('videoCreationWizardScreen.leDelaiDattenteAExpireReessayez');
            } else if (error?.message?.includes('401') || error?.message?.includes('403')) {
                message = t('videoCreationWizardScreen.sessionExpireeVeuillezVousReconnecter');
            } else if (error?.message?.includes('500')) {
                message = t('videoCreationWizardScreen.erreurServeurReessayezDansQuelquesInstants');
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
                    t('message.error'),
                    t('videoWizardExtra.sessionError'),
                );
                return;
            }

            // Validation UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(sessionId)) {
                console.error('[VideoCreationWizard] Session ID invalide (pas un UUID):', sessionId);
                Alert.alert(
                    t('message.error'),
                    t('videoWizardExtra.sessionInvalid'),
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
            const title = t('videoWizard.alert.storyboardFailedTitle') ?? t('videoWizard.storyboardAI');
            const defaultMessage = t('videoWizard.alert.storyboardFailedMessage');
            let message = error?.message || defaultMessage || t('videoCreationWizard.impossibleDeGenererLeStoryboard');

            // Messages d'erreur plus spécifiques
            if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
                message = t('videoCreationWizardScreen.erreurDeConnexionVerifiezVotreAcces');
            } else if (error?.message?.includes('timeout')) {
                message = t('videoCreationWizardScreen.leDelaiDattenteAExpireReessayez');
            } else if (error?.message?.includes('401') || error?.message?.includes('403')) {
                message = t('videoCreationWizardScreen.sessionExpireeVeuillezVousReconnecter');
            } else if (error?.message?.includes('500')) {
                message = t('videoCreationWizardScreen.erreurServeurReessayezDansQuelquesInstants');
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
                    // ✅ CORRECTION: Éviter les toasts multiples avec un flag
                    if (completionHandledRef.current) {
                        return;
                    }
                    completionHandledRef.current = true;

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
                        // ✅ CORRECTION: Afficher l'alert une seule fois
                        Alert.alert(
                            t('videoWizard.alert.renderDoneTitle'),
                            t('videoWizard.alert.renderDoneMessage'),
                        );
                    }
                } else if (job.status === 'failed') {
                    // ✅ CORRECTION: Éviter les toasts multiples avec un flag
                    if (completionHandledRef.current) {
                        return;
                    }
                    completionHandledRef.current = true;

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

        // ✅ CORRIGÉ 2026-03-11: Vérifier que le mode ai_virtual est disponible
        // Le service de génération vidéo IA (Runway/Sora/Pika) n'est pas encore activé côté serveur
        if (creationSource === 'ai_virtual') {
            Alert.alert(
                t('videoWizardExtra.aiNotAvailable'),
                t('videoWizardExtra.aiNotAvailableMsg'),
                [
                    { text: t('videoWizard.ok'), style: 'cancel' },
                    { text: t('videoWizardExtra.useMyMedia'), onPress: () => setCreationSource('media') },
                ]
            );
            return;
        }

        // ✅ Vérifier le solde avant de lancer la génération
        if (costEstimation && costEstimation.affordable === false) {
            const balanceStr = costEstimation.current_balance_fcfa != null
                ? `${Math.round(costEstimation.current_balance_fcfa).toLocaleString()} FCFA`
                : t('videoWizard.unknown');
            const costStr = `${Math.round(costEstimation.total_cost_local).toLocaleString()} ${costEstimation.local_currency}`;
            Alert.alert(
                t('videoWizardExtra.insufficientBalance'),
                t('videoWizardExtra.insufficientBalanceGenMsg', { cost: costStr, balance: balanceStr }),
                [
                    { text: t('message.cancel'), style: 'cancel' },
                    { text: t('videoWizardExtra.recharge'), onPress: () => (navigation as any).navigate('RechargeTokens') },
                ]
            );
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
            use_service_mediatech: true,
            include_publicite_assets: true,
            selected_media_ids: (creationSource as any) === 'ai_virtual' ? [] : selectedMediaIds,
            music_mode: musicMode !== 'none' ? musicMode : undefined,
            voiceover_lang: voiceoverEnabled ? voiceoverLang : undefined,
            voiceover_script: voiceoverEnabled ? brief : undefined,
            voice_profile_id: voiceoverEnabled ? selectedVoiceProfileId ?? undefined : undefined,
            creation_source: creationSource,
            ai_video_prompt: (creationSource as any) === 'ai_virtual' ? brief : undefined,
            distribute_channels: distributionChannels
                .filter((item) => item.value)
                .map((item) => item.key),
            style_effects,
            style_transitions,
            style_color_palette,
            style_music_hint,
            media_scene_overrides: (creationSource as any) === 'ai_virtual' ? undefined : media_scene_overrides,
        };

        try {
            // ✅ CORRECTION: Réinitialiser le flag de complétion avant de démarrer
            completionHandledRef.current = false;
            setIsGenerating(true);
            // ✅ PHASE 2: Enregistrer le temps de début pour calculer le temps estimé
            setGenerationStartTime(Date.now());
            startSimulation();

            // ✅ PHASE 1: Retry automatique avec backoff
            const response = await apiCallWithRetry(() =>
                iaApi.generateImmersiveVideo(serviceId, productIndex, payload),
                { maxRetries: 2, initialDelay: 2000 } // Moins de retries pour génération (plus long)
            );
            if (response.success && response.data?.job_id) {
                const jobId = response.data.job_id;
                setCurrentJobId(jobId);
                startJobPolling(jobId);
                // ✅ PHASE 1: Nettoyer le brouillon après génération réussie
                await clearVideoDraft();
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
            setGenerationStartTime(undefined);

            // ✅ PHASE 1: Message d'erreur amélioré
            const errorMessage = error?.message || t('videoWizard.alert.renderFailedMessage');
            const isNetworkError = errorMessage.toLowerCase().includes('network') ||
                errorMessage.toLowerCase().includes('timeout') ||
                errorMessage.toLowerCase().includes('fetch');

            // ✅ Détecter erreur solde insuffisant (402)
            const isBalanceError = error?.response?.status === 402 ||
                errorMessage.toLowerCase().includes('solde insuffisant') ||
                errorMessage.toLowerCase().includes('insufficient');

            const alertButtons: any[] = [{ text: t('videoWizard.ok') }];
            if (isBalanceError) {
                alertButtons.push({
                    text: `💳 ${t('videoWizardExtra.recharge')}`,
                    onPress: () => (navigation as any).navigate('RechargeTokens'),
                });
            } else {
                alertButtons.push({
                    text: t('videoWizardExtra.retry'),
                    onPress: () => handleGenerate(),
                });
            }

            Alert.alert(
                isBalanceError ? t('videoWizardExtra.insufficientBalance') : (isNetworkError ? t('videoWizardExtra.connectionProblem') : t('videoWizard.alert.renderFailedTitle')),
                isBalanceError
                    ? t('videoWizardExtra.balanceInsufficient')
                    : (isNetworkError
                        ? `${t('videoWizardExtra.networkErrorMsg')}\n\n${t('videoWizardExtra.draftSaved')}`
                        : `${errorMessage}\n\n${t('videoWizardExtra.draftSaved')}`),
                alertButtons
            );
        }
    };

    const [shortPreviewLoading, setShortPreviewLoading] = useState(false);

    const handleShortPreview = async () => {
        if (!studioSessionId) {
            Alert.alert(
                t('videoWizard.alert.previewShortNoSessionTitle') ?? t('videoCreationWizard.previsualisationRapide'),
                t('videoWizard.alert.previewShortNoSessionMessage') ??
                t('videoCreationWizardScreen.genereDabordUnStoryboardIaOu'),
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
                    t('videoWizard.alert.previewShortNoUrlTitle') ?? t('videoCreationWizard.previsualisationRapide'),
                    t('videoWizard.alert.previewShortNoUrlMessage') ??
                    t('videoWizard.errors.previewUrlError'),
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
                t('videoWizard.alert.previewShortFailedTitle') ?? t('videoCreationWizard.previsualisationRapide'),
                error?.message ||
                t('videoWizard.alert.previewShortFailedMessage') ||
                t('videoCreationWizardScreen.impossibleDeLancerLaPrevisualisationCourte'),
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
        const mediaUrl = buildMediaUrl(item.path);
        const isVideo = (item.media_type || '').toLowerCase().includes('video');
        return (
            <TouchableOpacity onPress={() => toggleMediaSelection(item.id)}>
                <NativeCard style={[styles.mediaCard, isSelected && styles.mediaCardSelected]}>
                    {mediaUrl ? (
                        <View style={styles.mediaThumbnailContainer}>
                            <Image
                                source={{ uri: mediaUrl }}
                                style={styles.mediaThumbnail}
                                resizeMode="cover"
                            />
                            {isVideo && (
                                <View style={styles.mediaVideoOverlay}>
                                    <SafeIcon name="play-circle" size={28} color="#FFF" />
                                </View>
                            )}
                            {isSelected && (
                                <View style={styles.mediaCheckOverlay}>
                                    <SafeIcon name="check-circle" size={24} color="#10B981" />
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={[styles.mediaThumbnailContainer, styles.mediaThumbnailPlaceholder]}>
                            <SafeIcon name={isVideo ? 'film' : 'image'} size={32} color={modernColors.textSecondary} />
                        </View>
                    )}
                    <View style={styles.mediaInfoRow}>
                        <Text style={styles.mediaTitle} numberOfLines={1}>
                            {item.ai_description || format('videoWizard.mediaLabel', { id: item.id })}
                        </Text>
                        <Text style={styles.mediaSubTitle}>
                            {isVideo ? t('videoCreationWizardScreen.video') : t('videoWizard.imageType')}
                        </Text>
                    </View>
                </NativeCard>
            </TouchableOpacity>
        );
    };

    const renderStepContent = () => {
        // ✅ CORRECTION: Afficher le contenu même si loadingService est true
        // Le contenu sera affiché avec des skeletons pendant le chargement
        switch (step) {
            case 1:
                return (
                    <Animated.View style={stepAnimatedStyle}>
                        <ScrollView
                            ref={(ref) => { scrollViewRefs.current[1] = ref; }}
                            contentContainerStyle={getStepContentStyle()}
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
                                        <Text style={styles.summaryTitle}>{safeStringDisplay(serviceName, `Service #${serviceId}`)}</Text>
                                        <Text style={styles.summarySubtitle}>{safeStringDisplay(productName, t('videoWizard.defaultProduct'))}</Text>
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
                                <Text style={styles.sectionTitle}>{t('videoCreationWizard.modeDeCreation')}</Text>
                                <View style={styles.creationSourceRow}>
                                    <TouchableOpacity
                                        style={[styles.creationSourceOption, creationSource === 'media' && styles.creationSourceOptionActive]}
                                        onPress={() => setCreationSource('media')}
                                    >
                                        <SafeIcon name="image" size={22} color={creationSource === 'media' ? '#FFFFFF' : modernColors.textSecondary} />
                                        <Text style={[styles.creationSourceLabel, creationSource === 'media' && styles.creationSourceLabelActive]}>{t('videoCreationWizard.mesPhotosVideos')}</Text>
                                        <Text style={[styles.creationSourceHint, creationSource === 'media' && styles.creationSourceHintActive]}>{t('videoCreationWizard.utiliseTesPropresMedias')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.creationSourceOption, creationSource === 'ai_virtual' && styles.creationSourceOptionActive]}
                                        onPress={() => setCreationSource('ai_virtual')}
                                    >
                                        <SafeIcon name="sparkles" size={22} color={creationSource === 'ai_virtual' ? '#FFFFFF' : modernColors.textSecondary} />
                                        <Text style={[styles.creationSourceLabel, creationSource === 'ai_virtual' && styles.creationSourceLabelActive]}>{t('videoCreationWizard.video100Ia')}</Text>
                                        <Text style={[styles.creationSourceHint, creationSource === 'ai_virtual' && styles.creationSourceHintActive]}>{t('videoCreationWizard.liaGenereToutPourToi')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </NativeCard>

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
                                                t('videoWizardExtra.videoStyle'),
                                                t('videoWizardExtra.chooseStyle'),
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
                                <Text style={styles.sectionTitle}>{t('videoWizard.narrativeTemplates')}</Text>
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
                                                        {format('videoWizard.templateMeta', { scenes: spec.suggestedScenes, duration: spec.defaultDurationSeconds, cta: spec.ctas[0] ?? '—' })}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                                {selectedStoryTemplate && (
                                    <Text style={styles.templateHint}>
                                        {format('videoWizard.selectedTemplate', { label: selectedStoryTemplate.label })}
                                    </Text>
                                )}
                            </NativeCard>

                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.storyboardAI')}</Text>
                                <Text style={styles.sectionSubTitle}>
                                    {t('videoWizard.storyboardDesc')}
                                </Text>
                                <View style={styles.inlineRow}>
                                    <NativeButton
                                        testID="video-storyboard-generate-button"
                                        title={storyboardLoading ? t('videoWizard.storyboardLoading') : t('videoCreationWizardScreen.genererStoryboard')}
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
                                                t('videoWizardExtra.aiMode'),
                                                t('videoWizardExtra.chooseMode'),
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
                        <View style={getFixedBottomButtonStyle()}>
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
                // ✅ CORRECTION: Afficher le contenu même si loadingService est true
                return (
                    <Animated.View style={stepAnimatedStyle}>
                        <ScrollView
                            ref={(ref) => { scrollViewRefs.current[2] = ref; }}
                            contentContainerStyle={getStepContentStyle()}
                            showsVerticalScrollIndicator={false}
                            style={styles.scrollView}
                        >
                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>
                                    {t('videoWizard.sections.media')} ({selectedMediaIds.length})
                                </Text>
                                {mediaLoading || loadingService ? (
                                    <View style={styles.mediaSkeletonContainer}>
                                        {mediaSkeletonPlaceholders.map((_, index) => (
                                            <LoadingSkeleton
                                                key={`media-skeleton-${index}`}
                                                height={54}
                                                style={styles.mediaSkeleton}
                                            />
                                        ))}
                                    </View>
                                ) : mediaItems.length === 0 ? (
                                    <View style={styles.emptyMediaState}>
                                        <SafeIcon name="image-off" size={32} color={modernColors.textSecondary} />
                                        <Text style={styles.emptyMediaTitle}>{t('videoCreationWizard.aucunMediaDisponible')}</Text>
                                        <Text style={styles.emptyMediaText}>
                                            {t('videoWizard.autoMediaSelect')}
                                        </Text>
                                        <Text style={styles.emptyMediaHint}>
                                            {t('videoWizard.addMediaHint')}
                                        </Text>
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
                                    {t('videoWizard.sections.timeline') || t('videoCreationWizard.montageParScene')}
                                </Text>
                                {scenesDraft.length === 0 ? (
                                    <View style={styles.emptyScenesState}>
                                        <SafeIcon name="film" size={48} color={modernColors.textSecondary} />
                                        <Text style={styles.emptyScenesTitle}>
                                            {t('videoWizard.summary.noScenes') || t('videoCreationWizard.aucuneSceneDefinie')}
                                        </Text>
                                        <Text style={styles.emptyScenesText}>
                                            {t('videoWizard.generateStoryboardHint')}
                                        </Text>
                                        <NativeButton
                                            title={t('videoCreationWizard.genererStoryboard')}
                                            variant="primary"
                                            size="small"
                                            onPress={handleGenerateStoryboard}
                                            disabled={storyboardLoading}
                                            style={{ marginTop: 12 }}
                                        />
                                        <Text style={styles.emptyScenesHint}>
                                            {t('videoWizard.autoScenesHint')}
                                        </Text>
                                    </View>
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
                                                                    defaultValue: t('videoCreationWizardScreen.sceneOptionnelle'),
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
                                                        t('videoWizard.chooseMediaForScene')}
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
                                                                            format('videoWizard.mediaLabel', { id: item.id })}
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.sceneMediaRowMeta
                                                                        }
                                                                    >
                                                                        {item.media_type || t('videoWizard.imageTypeFallback')}
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
                        <View style={getFixedBottomButtonStyle()}>
                            <View style={styles.navigationRow}>
                                <NativeButton
                                    title={t('videoWizard.buttons.prevStepShort')}
                                    variant="secondary"
                                    onPress={() => handleStepChange(1)}
                                />
                                <NativeButton
                                    title={t('videoWizard.buttons.previewTimeline')}
                                    variant="primary"
                                    onPress={() => handleStepChange(3)}
                                />
                            </View>
                        </View>
                    </Animated.View>
                );
            case 3:
                return (
                    <Animated.View style={stepAnimatedStyle}>
                        <ScrollView
                            ref={(ref) => { scrollViewRefs.current[3] = ref; }}
                            contentContainerStyle={getStepContentStyle()}
                            showsVerticalScrollIndicator={false}
                            style={styles.scrollView}
                        >
                            <NativeCard style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{t('videoWizard.sections.summary')}</Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.service')} : {safeStringDisplay(serviceName, `Service #${serviceId}`)}
                                </Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.product')} : {safeStringDisplay(productName, t('videoWizard.defaultProduct'))}
                                </Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.style')} : {selectedStyle}
                                </Text>
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.mode')} : {mode === 'expert' ? t('videoWizard.mode.expertTitle') : t('videoWizard.mode.standardTitle')}
                                </Text>
                                {selectedStoryTemplate && (
                                    <Text style={styles.summaryText}>
                                        {format('videoWizard.summaryTemplate', { label: selectedStoryTemplate.label })}
                                    </Text>
                                )}
                                <Text style={styles.summaryText}>
                                    {t('videoWizard.summary.mediaSelected')} : {selectedMediaIds.length}
                                </Text>
                                <Text style={styles.summaryText}>
                                    {format('videoWizard.summaryStylePackLabel', { pack: stylePack === 'pulse'
                                        ? t('videoWizard.pulseSocial')
                                        : stylePack === 'story'
                                            ? t('videoCreationWizardScreen.storyEditoriale')
                                            : t('videoWizard.corporateLight') })}
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
                                    <Text style={styles.sectionTitle}>{t('videoCreationWizard.videosLieesChainage')}</Text>
                                    <Text style={styles.sectionSubTitle}>
                                        {t('videoWizard.selectLinkedVideos')}
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
                                                            {item.title || format('videoWizard.sessionLabel', { id: item.id.slice(0, 8) })}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                            scrollEnabled={false}
                                        />
                                    ) : (
                                        <Text style={styles.summaryText}>{t('videoCreationWizard.aucuneAutreSessionDisponible')}</Text>
                                    )}
                                    {selectedLinkedSessions.length > 0 && (
                                        <NativeButton
                                            title={t('videoCreationWizardScreen.enregistrerLesLiens')}
                                            variant="primary"
                                            size="small"
                                            onPress={async () => {
                                                if (!studioSessionId) return;
                                                try {
                                                    await studioService.setDependencies(studioSessionId, selectedLinkedSessions);
                                                    Alert.alert(t('message.success'), t('videoWizardExtra.linkedSaved'));
                                                    const deps = await studioService.getDependencies(studioSessionId);
                                                    setDependencies(deps);
                                                } catch (error: any) {
                                                    Alert.alert(t('message.error'), error.message || t('videoWizardExtra.linkedSaveError'));
                                                }
                                            }}
                                            style={{ marginTop: 12 }}
                                        />
                                    )}
                                    {dependencies.length > 0 && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={styles.sectionSubTitle}>{t('videoCreationWizard.videosLiees')}</Text>
                                            {dependencies.map((dep, idx) => (
                                                <Text key={dep.id} style={styles.summaryText}>
                                                    {idx + 1}. {format('videoWizard.sessionLabel', { id: dep.child_session_id.slice(0, 8) })}
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
                                    {t('videoWizard.sections.previewShort') ?? t('videoCreationWizard.previsualisationRapide')}
                                </Text>
                                <Text style={styles.sectionSubTitle}>
                                    {t('videoWizard.previewSubtitle')}
                                </Text>
                                <View style={styles.inlineRow}>
                                    <NativeButton
                                        title={
                                            shortPreviewLoading
                                                ? t('videoWizard.buttons.previewShortLoading') ?? t('videoCreationWizard.previsualisation')
                                                : t('videoWizard.buttons.previewShort') ?? t('videoCreationWizard.previsualiser3s')
                                        }
                                        variant="primary"
                                        onPress={handleShortPreview}
                                        disabled={shortPreviewLoading}
                                    />
                                </View>
                            </NativeCard>

                        </ScrollView>
                        <View style={getFixedBottomButtonStyle()}>
                            <View style={styles.navigationRow}>
                                <NativeButton
                                    testID="video-next-step-button"
                                    title={t('videoWizard.buttons.prevStepShort')}
                                    variant="secondary"
                                    onPress={() => handleStepChange(2)}
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

    const renderProgressModal = () => {
        // ✅ PHASE 2: Modal de progression amélioré
        if (!isGenerating) return null;
        return (
            <VideoProgressModal
                visible={isGenerating}
                steps={progressSteps}
                startTime={generationStartTime}
            />
        );
    };

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
                <View style={styles.stepHeaderContent}>
                    {loadingService ? (
                        <>
                            <LoadingSkeleton width={140} height={16} style={styles.headerSkeletonPrimary} />
                            <LoadingSkeleton width={80} height={12} style={styles.headerSkeletonSecondary} />
                        </>
                    ) : (
                        <>
                            <Text style={styles.stepService}>{serviceName}</Text>
                            {/* ✅ NOUVEAU: Indicateur visuel des étapes */}
                            {(() => {
                                const stepLabels = [
                                    t('videoWizard.steps.step1') || 'Configuration',
                                    t('videoWizard.steps.step2') || t('videoCreationWizard.medias'),
                                    t('videoWizard.steps.step3') || t('videoCreationWizard.resume')
                                ];

                                return (
                                    <>
                                        <View style={styles.stepsIndicator}>
                                            {[1, 2, 3].map((stepNum) => {
                                                const isCompleted = completedSteps.has(stepNum as WizardStep);
                                                const isActive = step === stepNum;

                                                return (
                                                    <React.Fragment key={stepNum}>
                                                        <TouchableOpacity
                                                            style={[
                                                                styles.stepDot,
                                                                isCompleted && styles.stepDotCompleted,
                                                                isActive && styles.stepDotActive
                                                            ]}
                                                            onPress={() => {
                                                                // ✅ Navigation avec validation
                                                                if (stepNum < step || isCompleted) {
                                                                    handleStepChange(stepNum as WizardStep);
                                                                }
                                                            }}
                                                            disabled={!isCompleted && stepNum !== step && stepNum > step}
                                                        >
                                                            {isCompleted ? (
                                                                <SafeIcon name="check" size={16} color="#FFF" />
                                                            ) : (
                                                                <Text style={[
                                                                    styles.stepNumber,
                                                                    isActive && styles.stepNumberActive
                                                                ]}>
                                                                    {stepNum}
                                                                </Text>
                                                            )}
                                                        </TouchableOpacity>
                                                        {stepNum < 3 && (
                                                            <View style={[
                                                                styles.stepConnector,
                                                                isCompleted && styles.stepConnectorCompleted
                                                            ]} />
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </View>
                                        <Text style={styles.stepTitle}>
                                            {stepLabels[step - 1]} ({step}/3)
                                        </Text>
                                    </>
                                );
                            })()}
                        </>
                    )}
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* ✅ NOUVEAU: Barre de progression globale */}
            <View style={styles.globalProgressContainer}>
                <View style={styles.globalProgressBar}>
                    <View
                        style={[
                            styles.globalProgressFill,
                            { width: `${globalProgress}%` }
                        ]}
                    />
                </View>
                <Text style={styles.globalProgressText}>
                    {format('videoWizard.progressCompleted', { progress: globalProgress })}
                </Text>
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
        paddingHorizontal: 24,
        paddingVertical: 16, // ✅ RÉDUIT: De 20 à 16 pour moins d'espace vertical
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.border,
        minHeight: 60, // ✅ RÉDUIT: De 70 à 60 pour compacter
    },
    stepHeaderText: {
        flex: 1,
        alignItems: 'center', // Gardé pour centrer le contenu
    },
    stepHeaderContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center', // ✅ AJOUTÉ: Centrer verticalement
        gap: 6, // ✅ RÉDUIT: De 8 à 6 pour compacter
        minHeight: 40, // ✅ AJOUTÉ: Hauteur minimale pour le contenu
    },
    headerSkeletonPrimary: {
        marginBottom: 6,
    },
    headerSkeletonSecondary: {},
    stepService: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center', // ✅ AJOUTÉ: Centrer le texte
        flex: 1, // ✅ AJOUTÉ: Utiliser toute la largeur disponible
        flexWrap: 'wrap', // ✅ AJOUTÉ: Permettre le retour à la ligne si nécessaire
    },
    stepTitle: {
        fontSize: 18, // ✅ RÉDUIT: De 19 à 18 pour mieux s'adapter
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center', // ✅ AJOUTÉ: Centrer le texte
        flex: 1, // ✅ AJOUTÉ: Utiliser toute la largeur disponible
        flexWrap: 'wrap', // ✅ AJOUTÉ: Permettre le retour à la ligne si nécessaire
    },
    scrollView: {
        flex: 1,
        // ✅ CORRECTION: S'assurer que le ScrollView est visible et scrollable
    },
    fixedBottomButtonBase: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 16,
        backgroundColor: modernColors.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000, // ✅ S'assurer que les boutons sont au-dessus
    },
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.3)',
        borderRadius: 12,
        paddingHorizontal: 18, // ✅ AUGMENTÉ: De 14 à 18
        paddingVertical: 16, // ✅ AUGMENTÉ: De 12 à 16
        backgroundColor: modernColors.surface,
        marginTop: 12, // ✅ AUGMENTÉ: De 8 à 12
        minHeight: 56, // ✅ AJOUTÉ: Hauteur minimale pour meilleure visibilité
    },
    pickerButtonText: {
        fontSize: 17, // ✅ AUGMENTÉ: De 15 à 17
        color: modernColors.text,
        flex: 1,
        fontWeight: '500', // ✅ AJOUTÉ: Poids de police pour meilleure lisibilité
    },
    sectionCard: {
        gap: 24, // ✅ AUGMENTÉ: De 16 à 24 pour plus d'espace entre les éléments
    },
    creationSourceRow: {
        flexDirection: 'row',
        gap: 12,
    },
    creationSourceOption: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.background,
        borderWidth: 2,
        borderColor: modernColors.border,
    },
    creationSourceOptionActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    creationSourceLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center',
    },
    creationSourceLabelActive: {
        color: '#FFFFFF',
    },
    creationSourceHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    creationSourceHintActive: {
        color: 'rgba(255,255,255,0.8)',
    },
    sectionSubTitle: {
        fontSize: 15, // ✅ AUGMENTÉ: De 13 à 15 pour meilleure lisibilité
        color: modernColors.textSecondary,
        marginTop: 8, // ✅ AUGMENTÉ: De 4 à 8 pour plus d'espace
    },
    sectionTitle: {
        fontSize: 22, // ✅ AUGMENTÉ: De 18 à 22 pour meilleure visibilité
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4, // ✅ AJOUTÉ: Marge en bas pour séparation
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
        fontSize: 19, // ✅ AUGMENTÉ: De 16 à 19
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6, // ✅ AJOUTÉ: Marge en bas
    },
    summarySubtitle: {
        fontSize: 16, // ✅ AUGMENTÉ: De 14 à 16
        color: modernColors.textSecondary,
        lineHeight: 22, // ✅ AJOUTÉ: Hauteur de ligne
    },
    textArea: {
        minHeight: 160, // ✅ AUGMENTÉ: De 120 à 160 pour voir plus de texte sans scroll
        fontSize: 16, // ✅ AJOUTÉ: Taille de police plus grande
        padding: 16, // ✅ AJOUTÉ: Padding interne pour meilleure lisibilité
    },
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16, // ✅ AUGMENTÉ: De 12 à 16
        paddingVertical: 8, // ✅ AJOUTÉ: Padding vertical pour plus d'espace
        minHeight: 48, // ✅ AJOUTÉ: Hauteur minimale
    },
    inlineLabel: {
        fontSize: 17, // ✅ AUGMENTÉ: De 16 à 17
        color: modernColors.text,
        flex: 1,
        fontWeight: '500', // ✅ AJOUTÉ: Poids de police
    },
    pillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12, // ✅ AUGMENTÉ: De 8 à 12
        gap: 12, // ✅ AUGMENTÉ: De 8 à 12
    },
    pill: {
        paddingVertical: 14, // ✅ AUGMENTÉ: De 10 à 14
        paddingHorizontal: 20, // ✅ AUGMENTÉ: De 16 à 20
        borderRadius: 999,
        backgroundColor: modernColors.surface,
        minHeight: 48, // ✅ AJOUTÉ: Hauteur minimale
    },
    pillSmall: {
        paddingVertical: 12, // ✅ AUGMENTÉ: De 8 à 12
        paddingHorizontal: 18, // ✅ AUGMENTÉ: De 14 à 18
        borderRadius: 999,
        backgroundColor: modernColors.surface,
        minHeight: 44, // ✅ AJOUTÉ: Hauteur minimale
    },
    pillActive: {
        backgroundColor: modernColors.primary,
    },
    pillText: {
        color: modernColors.text,
        fontWeight: '600',
        fontSize: 15, // ✅ AJOUTÉ: Taille de police explicite
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
        padding: 18, // ✅ AUGMENTÉ: De 12 à 18
        marginBottom: 14, // ✅ AUGMENTÉ: De 10 à 14
        backgroundColor: 'rgba(10,16,30,0.75)',
        minHeight: 100, // ✅ AJOUTÉ: Hauteur minimale pour meilleure visibilité
    },
    templateCardActive: {
        borderColor: 'rgba(16,185,129,0.7)',
        backgroundColor: 'rgba(16,185,129,0.12)',
    },
    templateTitle: {
        fontSize: 18, // ✅ AUGMENTÉ: De 15 à 18
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6, // ✅ AJOUTÉ: Marge en bas
    },
    templateTitleActive: {
        color: modernColors.success,
    },
    templateDescription: {
        marginTop: 8, // ✅ AUGMENTÉ: De 4 à 8
        fontSize: 15, // ✅ AUGMENTÉ: De 13 à 15
        color: modernColors.textSecondary,
        lineHeight: 20, // ✅ AJOUTÉ: Hauteur de ligne pour meilleure lisibilité
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
        padding: 20, // ✅ AUGMENTÉ: De 16 à 20
        borderRadius: 18,
        backgroundColor: modernColors.surface,
        minHeight: 120, // ✅ AJOUTÉ: Hauteur minimale pour meilleure visibilité
    },
    modeCardActive: {
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    modeTitle: {
        fontSize: 18, // ✅ AUGMENTÉ: De 16 à 18
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8, // ✅ AJOUTÉ: Marge en bas
    },
    modeSubTitle: {
        fontSize: 15, // ✅ AUGMENTÉ: De 13 à 15
        color: modernColors.textSecondary,
        marginTop: 8, // ✅ AUGMENTÉ: De 6 à 8
        lineHeight: 20, // ✅ AJOUTÉ: Hauteur de ligne
    },
    navigationRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
    },
    mediaCard: {
        borderRadius: 14,
        backgroundColor: modernColors.surface,
        overflow: 'hidden',
        width: 150,
    },
    mediaCardSelected: {
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    mediaThumbnailContainer: {
        width: '100%',
        height: 110,
        position: 'relative',
    },
    mediaThumbnail: {
        width: '100%',
        height: '100%',
    },
    mediaThumbnailPlaceholder: {
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaVideoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    mediaCheckOverlay: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: '#FFF',
        borderRadius: 12,
    },
    mediaInfoRow: {
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    mediaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    mediaTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    mediaSubTitle: {
        marginTop: 2,
        fontSize: 11,
        color: modernColors.textSecondary,
        lineHeight: 20, // ✅ AJOUTÉ: Hauteur de ligne
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
    // ✅ NOUVEAU: Styles pour l'indicateur d'étapes
    stepsIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
        marginBottom: 4,
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotCompleted: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    stepDotActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    stepNumberActive: {
        color: '#FFF',
    },
    stepConnector: {
        width: 24,
        height: 2,
        backgroundColor: modernColors.border,
    },
    stepConnectorCompleted: {
        backgroundColor: modernColors.success,
    },
    // ✅ NOUVEAU: Barre de progression globale
    globalProgressContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    globalProgressBar: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    globalProgressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    globalProgressText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
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
    // ✅ NOUVEAU: Styles pour les états vides
    emptyScenesState: {
        alignItems: 'center',
        padding: 32,
        gap: 12,
    },
    emptyScenesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    emptyScenesText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyScenesHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
    },
    emptyMediaState: {
        alignItems: 'center',
        padding: 24,
        gap: 8,
    },
    emptyMediaTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    emptyMediaText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    emptyMediaHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    brandYuk: {
        color: '#3B82F6', // Bleu (cohérent avec le logo officiel)
    },
    brandPo: {
        color: '#7C3AED', // Violet (cohérent avec le logo officiel)
    },
});

export default VideoCreationWizardScreen;
