import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { config } from '../config/environment';
import { iaApi, mediaApi } from '../services/api';
import { uploadToCloud } from '../services/cloudUpload';
import { studioService, type VideoDependency } from '../services/studioService';
import { trackUxEvent } from '../services/uxMetrics';
import { modernColors } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import { AIDistributionPlan, AIVideoBriefVariant, AIVideoStyleSuggestion, GeneratedVideoResponse, VideoCostEstimateResponse, VideoCostEstimation, VideoGenerationPayload } from '../types/VideoGeneration';
import { extractDescription, extractServiceName } from '../utils/displayHelpers';
import { getFieldValue } from '../utils/productNormalizer';
import { apiCallWithRetry } from '../utils/retryWithBackoff';
import { clearVideoDraft, loadVideoDraft, saveVideoDraft, type VideoDraft } from '../utils/videoDraftStorage';
import { NativeButton, NativeCard, NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';
import { TimelineEditor } from './TimelineEditor';
import { TimelinePreview, VideoTimeline as VideoTimelineType } from './TimelinePreview';
// ✅ NOUVEAU: Composants IA avancés
import { AudioSuggestionPanel } from './AudioSuggestionPanel';
import { AudioSyncPanel } from './AudioSyncPanel';
import { AutoCaptionsPanel } from './AutoCaptionsPanel';
import { AutoCutPanel } from './AutoCutPanel';
import { ColorGradingPanel } from './ColorGradingPanel';
import { CreatorStudioCard } from './CreatorStudioCard';
import { EffectPreviewCarousel } from './EffectPreviewCarousel';
import { QuickPreview } from './QuickPreview';
import { TimelineVariantSelector } from './TimelineVariantSelector';
// ✅ NOUVEAU Phase 3.2: Éditeur AR immersif
import ARVideoEditor from './ARVideoEditor';
// ✅ NOUVEAU: Modal de progression visuelle
import { VideoGenerationProgressModal } from './VideoGenerationProgressModal';

type VideoStylePreset = 'tiktok' | 'story' | 'cinematic' | 'carousel';
type MusicMode = 'pulse' | 'lofi' | 'ambient' | 'cinematic' | 'none';

interface MediaLibraryItem {
    id: number;
    path: string;
    type?: string | null;
    media_type?: string | null;
    product_index?: number | null;
    ai_description?: string | null;
}

interface CuratedAudioLoop {
    id: string;
    title: string;
    genre: string;
    mood: string;
    bpm: number;
    url: string;
    license: string;
}

interface GroupedProducts {
    serviceId: string;
    serviceTitre: string;
    items: ManagedProduct[];
}

interface ProductVideoCreationModalProps {
    visible: boolean;
    primaryProduct: ManagedProduct | null;
    products: ManagedProduct[];
    onClose: () => void;
    onSuccess: (result: GeneratedVideoResponse) => void | Promise<void>;
}

const VIDEO_STYLE_OPTIONS: Array<{ key: VideoStylePreset; label: string; description: string }> = [
    { key: 'tiktok', label: 'TikTok Boost', description: 'Transitions rapides, texte dynamique, format vertical 9:16' },
    { key: 'story', label: 'Story Produit', description: 'Narration douce, highlight des atouts, superpositions élégantes' },
    { key: 'cinematic', label: 'Ciné Premium', description: 'Animations lentes, focus sur détails, ambiance immersive' },
    { key: 'carousel', label: 'Carousel Flash', description: 'Slides punchy, CTA répétés, idéal publicités express' },
];

const MUSIC_MODE_OPTIONS: Array<{ key: MusicMode; label: string; description: string }> = [
    { key: 'pulse', label: 'Pulse', description: "Beat énergique parfait pour capter l'attention" },
    { key: 'lofi', label: 'Lofi', description: 'Ambiance douce et premium' },
    { key: 'ambient', label: 'Ambient', description: 'Atmosphère aérienne et relaxante' },
    { key: 'cinematic', label: 'Ciné', description: 'Montée orchestrale immersive' },
    { key: 'none', label: 'Aucun', description: 'Sans musique automatique' },
];

const VOICE_LANG_OPTIONS = [
    { value: 'fr', label: 'Français (FR)' },
    { value: 'fr-fr', label: 'Français Premium' },
    { value: 'en', label: 'English (US)' },
    { value: 'en-gb', label: 'English (UK)' },
    { value: 'pt-br', label: 'Português (BR)' },
    { value: 'es', label: 'Español' },
];

const DISTRIBUTION_OPTIONS = [
    { key: 'chat', label: 'Chat Commerce' },
    { key: 'product', label: 'Carte Produit' },
    { key: 'shorts', label: 'Shorts / Reels' },
    { key: 'instagram', label: 'Instagram Feed' },
    { key: 'youtube', label: 'YouTube' },
];

// ✅ CORRIGÉ 2025-11-30: Utiliser l'endpoint /api/media/files pour les chemins uploads/
const buildMediaUrl = (path: string | undefined | null): string => {
    if (!path) {
        return '';
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:image')) {
        return path;
    }

    // ✅ CORRIGÉ: Utiliser /api/media/files pour les chemins uploads/
    if (path.startsWith('uploads/') || path.startsWith('/uploads/')) {
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const base = (config.API_BASE_URL || config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
    }

    // Pour les autres chemins, utiliser aussi /api/media/files
    const cleanPath = path.replace(/^\//, '');
    const base = (config.API_BASE_URL || config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
};

const normalizeProductName = (product?: ManagedProduct | null): string => {
    if (!product) {
        return 'Votre produit';
    }

    // ✅ CORRIGÉ: Utiliser extractProductName qui gère tous les cas
    const { extractProductName } = require('../utils/displayHelpers');
    return extractProductName(product, 'Votre produit');
};

const ensureNumber = (value: any, fallback: number): number => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
        return parsed;
    }
    return fallback;
};

const computePriceLabel = (product: ManagedProduct | null | undefined): string | undefined => {
    if (!product) {
        return undefined;
    }

    // ✅ CORRIGÉ: Extraire la valeur du prix en utilisant getFieldValue
    const prix = getFieldValue(product.prix);
    const devise = getFieldValue(product.devise) || 'XAF';

    if (prix === undefined || prix === null || prix === '') {
        return undefined;
    }

    const value =
        typeof prix === 'number'
            ? prix.toLocaleString()
            : String(prix).trim();
    if (!value) {
        return undefined;
    }
    return `${value} ${devise}`;
};

const computePromotionLabel = (product: ManagedProduct | null | undefined): string | undefined => {
    if (!product) {
        return undefined;
    }
    const candidate =
        (product as any)?.promotion_label ||
        (product as any)?.promotion ||
        ((product as any)?.promotionActive ? 'Promotion active' : undefined);
    return candidate ? String(candidate) : undefined;
};

const collectProductHighlights = (product: ManagedProduct | null | undefined): string[] => {
    if (!product) {
        return [];
    }
    const highlights: string[] = [];
    if (product.type) {
        highlights.push(`Type: ${product.type}`);
    }
    if (product.category_label) {
        highlights.push(`Catégorie: ${product.category_label}`);
    }
    const priceLabel = computePriceLabel(product);
    if (priceLabel) {
        highlights.push(`Prix courant: ${priceLabel}`);
    }
    if ((product as any)?.city) {
        highlights.push(`Localisation: ${(product as any).city}`);
    }
    if (Array.isArray((product as any)?.tags)) {
        (product as any).tags.forEach((tag: string) => {
            if (tag) {
                highlights.push(`#${tag}`);
            }
        });
    }
    return highlights;
};

const buildDefaultVoiceover = (
    productName: string,
    headline: string,
    callToAction: string,
    storyboardLines: string[],
) => {
    const lines: string[] = [];

    if (headline) {
        lines.push(headline.replace(/[🚀🎯🔥✅⭐️#]+/g, '').trim());
    } else {
        lines.push(`Découvrez ${productName} sur Yukpomnang.`);
    }

    storyboardLines.slice(0, 3).forEach((line) => {
        if (line.trim().length > 0) {
            lines.push(line.replace(/[🚀🎯🔥✅⭐️#]+/g, '').trim());
        }
    });

    if (callToAction) {
        lines.push(callToAction.replace(/[🚀🎯🔥✅⭐️#]+/g, '').trim());
    } else {
        lines.push('Contactez-nous dès maintenant via Yukpomnang.');
    }

    return lines.join('\n');
};

const applyBriefVariant = (
    variant: AIVideoBriefVariant,
    setHeadline: (headline: string) => void,
    setCallToAction: (callToAction: string) => void,
    setScriptNotes: (scriptNotes: string) => void,
    setVoiceoverScript: (voiceoverScript: string) => void,
    setVariantPickerVisible: (visible: boolean) => void,
) => {
    if (variant.headline) {
        setHeadline(variant.headline);
    }
    if (variant.call_to_action) {
        setCallToAction(variant.call_to_action);
    }
    if (Array.isArray(variant.script_outline) && variant.script_outline.length > 0) {
        setScriptNotes(variant.script_outline.join('\n'));
    }
    if (variant.voiceover) {
        setVoiceoverScript(variant.voiceover);
    }
    setVariantPickerVisible(false);
    Alert.alert('Brief appliqué', 'La variante sélectionnée a été appliquée.');
};

type ModalStep = 1 | 2 | 3 | 4 | 5 | 6;

const ProductVideoCreationModal: React.FC<ProductVideoCreationModalProps> = ({
    visible,
    primaryProduct,
    products,
    onClose,
    onSuccess,
}) => {
    const insets = useSafeAreaInsets();
    const [activeStep, setActiveStep] = useState<ModalStep>(1);
    // ✅ CORRECTION: Ref pour le ScrollView principal (pour remettre le scroll au début lors du changement d'étape)
    const mainScrollViewRef = useRef<ScrollView | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<ManagedProduct | null>(primaryProduct);
    const [selectedRelatedProducts, setSelectedRelatedProducts] = useState<Set<number>>(new Set());
    const [selectedMediaIds, setSelectedMediaIds] = useState<Set<number>>(new Set());

    const [productMedia, setProductMedia] = useState<MediaLibraryItem[]>([]);
    const [serviceMedia, setServiceMedia] = useState<MediaLibraryItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(false);

    const [stylePreset, setStylePreset] = useState<VideoStylePreset>('tiktok');
    const [duration, setDuration] = useState<string>('28');
    const [headline, setHeadline] = useState<string>('');
    const [callToAction, setCallToAction] = useState<string>('Commandez maintenant sur Yukpomnang ✅');
    const [scriptNotes, setScriptNotes] = useState<string>('');

    const [includePrice, setIncludePrice] = useState<boolean>(true);
    const [includePromotion, setIncludePromotion] = useState<boolean>(false);
    const [includeContact, setIncludeContact] = useState<boolean>(true);
    const [useProductGallery, setUseProductGallery] = useState<boolean>(true);
    const [useMediatechLibrary, setUseMediatechLibrary] = useState<boolean>(true);
    const [includePubliciteAssets, setIncludePubliciteAssets] = useState<boolean>(true);
    const [publishToChat, setPublishToChat] = useState<boolean>(true);
    const [publishToProductCard, setPublishToProductCard] = useState<boolean>(true);
    const [musicMode, setMusicMode] = useState<MusicMode>('pulse');
    const [musicVolume, setMusicVolume] = useState<string>('0.28');
    const [voiceoverEnabled, setVoiceoverEnabled] = useState<boolean>(false);
    const [voiceoverScript, setVoiceoverScript] = useState<string>('');
    const [voiceoverLang, setVoiceoverLang] = useState<string>('fr');
    const [generateSquareVariant, setGenerateSquareVariant] = useState<boolean>(true);
    const [generateLandscapeVariant, setGenerateLandscapeVariant] = useState<boolean>(false);
    const [subtitleLang, setSubtitleLang] = useState<string>('fr');
    const [availableAudioTracks, setAvailableAudioTracks] = useState<MediaLibraryItem[]>([]);
    const [selectedMusicTrackId, setSelectedMusicTrackId] = useState<number | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set(['chat', 'product']));
    const [audioLibrary, setAudioLibrary] = useState<CuratedAudioLoop[]>([]);
    const [loadingLibrary, setLoadingLibrary] = useState<boolean>(false);
    const [attachingLoopId, setAttachingLoopId] = useState<string | null>(null);
    const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
    const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
    const [briefVariants, setBriefVariants] = useState<AIVideoBriefVariant[]>([]);
    const [variantPickerVisible, setVariantPickerVisible] = useState<boolean>(false);
    const [styleSuggestion, setStyleSuggestion] = useState<AIVideoStyleSuggestion | null>(null);
    const [isGeneratingStyle, setIsGeneratingStyle] = useState<boolean>(false);
    const [selectedEffects, setSelectedEffects] = useState<Set<string>>(new Set());
    const [selectedTransitions, setSelectedTransitions] = useState<Set<string>>(new Set());
    const [selectedOverlayTips, setSelectedOverlayTips] = useState<Set<string>>(new Set());
    const [colorPalette, setColorPalette] = useState<string>('');
    const [styleMusicHint, setStyleMusicHint] = useState<string>('');
    const [mediaAnalysis, setMediaAnalysis] = useState<{ dominantColors?: string[]; detectedObjects?: string[]; ambiance?: string | null; marketingAngle?: string | null }>({});
    const [isAnalyzingMedia, setIsAnalyzingMedia] = useState<boolean>(false);
    const [distributionPlan, setDistributionPlan] = useState<AIDistributionPlan | null>(null);
    const [isGeneratingDistribution, setIsGeneratingDistribution] = useState<boolean>(false);
    const [coachLoading, setCoachLoading] = useState<boolean>(false);
    const coachPrefetchDoneRef = useRef(false);
    // ✅ NOUVEAU: État pour la timeline générée
    const [generatedTimeline, setGeneratedTimeline] = useState<VideoTimelineType | null>(null);
    const [isGeneratingTimeline, setIsGeneratingTimeline] = useState<boolean>(false);
    const [isEditingTimeline, setIsEditingTimeline] = useState<boolean>(false);

    // ✅ NOUVEAU: États pour les fonctionnalités migrées du wizard
    const [costEstimation, setCostEstimation] = useState<VideoCostEstimation | null>(null);
    const [costLoading, setCostLoading] = useState<boolean>(false);
    const [showCostEstimation, setShowCostEstimation] = useState<boolean>(false);
    const [availableSessions, setAvailableSessions] = useState<Array<{ id: string; title?: string }>>([]);
    const [selectedLinkedSessions, setSelectedLinkedSessions] = useState<string[]>([]);
    const [dependencies, setDependencies] = useState<VideoDependency[]>([]);
    const [showVideoChaining, setShowVideoChaining] = useState<boolean>(false);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

    // ✅ NOUVEAU: Studio Sessions (depuis Wizard)
    const [studioSessionId, setStudioSessionId] = useState<string | undefined>();
    const [storyboard, setStoryboard] = useState<import('../services/studioService').Storyboard | null>(null);
    const [storyboardLoading, setStoryboardLoading] = useState<boolean>(false);
    const [shortPreviewUrl, setShortPreviewUrl] = useState<string | null>(null);
    const [shortPreviewLoading, setShortPreviewLoading] = useState<boolean>(false);
    const [prewarmedShortPreviewUrl, setPrewarmedShortPreviewUrl] = useState<string | undefined>();

    // ✅ NOUVEAU: États pour le modal de progression visuelle
    const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
    const [currentJobId, setCurrentJobId] = useState<string | undefined>();
    const [currentJobStatus, setCurrentJobStatus] = useState<'pending' | 'running' | 'completed' | 'failed'>('pending');
    const [currentProgressSteps, setCurrentProgressSteps] = useState<Array<{ key: string; label: string; status: string; detail?: string }>>([]);
    const [currentStepNumber, setCurrentStepNumber] = useState<number>(0);
    const [currentErrorMessage, setCurrentErrorMessage] = useState<string | undefined>();

    // ✅ NOUVEAU: Auto-Storyboard Toggle (depuis Wizard)
    const [autoStoryboard, setAutoStoryboard] = useState<boolean>(true);

    // ✅ NOUVEAU: Completed Steps Tracking (depuis Wizard)
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    // ✅ NOUVEAU: Story Templates Serveur (depuis Wizard)
    const [storyTemplates, setStoryTemplates] = useState<import('../types/VideoGeneration').StoryTemplateSpec[]>([]);
    const [storyTemplatesLoading, setStoryTemplatesLoading] = useState<boolean>(false);
    const [storyTemplateId, setStoryTemplateId] = useState<string>('blog');

    // ✅ NOUVEAU Phase 3.2: État pour l'éditeur AR
    const [showAREditor, setShowAREditor] = useState<boolean>(false);
    const [isUploadingARVideo, setIsUploadingARVideo] = useState<boolean>(false);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // ✅ NOUVEAU Phase 3.2: Gérer la vidéo AR capturée
    const handleARVideoCaptured = useCallback(async (videoUri: string) => {
        if (!selectedProduct || typeof selectedProduct.product_index !== 'number') {
            Alert.alert('Erreur', 'Produit non sélectionné');
            setShowAREditor(false);
            return;
        }

        setIsUploadingARVideo(true);
        try {
            const serviceId = Number(selectedProduct.serviceId);
            const productIndex = selectedProduct.product_index;

            // Upload vers le cloud
            const uploadResult = await uploadToCloud(
                videoUri,
                'video',
                `ar_video_${Date.now()}.mp4`
            );

            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || 'Erreur lors de l\'upload');
            }

            // Créer un item média temporaire (l'API backend gérera l'enregistrement)
            const newMediaItem: MediaLibraryItem = {
                id: Date.now(), // ID temporaire
                path: uploadResult.url,
                type: 'video',
                media_type: 'video',
                product_index: productIndex,
                ai_description: 'Vidéo AR immersive',
            };

            // Ajouter à la médiathèque produit immédiatement
            setProductMedia((prev) => [...prev, newMediaItem]);
            // Sélectionner automatiquement
            setSelectedMediaIds((prev) => new Set([...prev, newMediaItem.id]));

            Alert.alert('Succès', 'Vidéo AR ajoutée à votre médiathèque');
            setShowAREditor(false);

            // Rafraîchir les médias pour obtenir l'ID réel depuis le serveur
            await refreshMedia(selectedProduct);
            console.log('[ProductVideoCreationModal] Médias rafraîchis après upload AR');
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur upload vidéo AR:', error);
            Alert.alert(
                'Erreur',
                error?.message || 'Impossible d\'ajouter la vidéo AR. Réessayez plus tard.'
            );
        } finally {
            setIsUploadingARVideo(false);
        }
    }, [selectedProduct]);
    const refreshMedia = useCallback(
        async (product?: ManagedProduct | null): Promise<MediaLibraryItem[]> => {
            if (!product || typeof product.product_index !== 'number') {
                setProductMedia([]);
                setServiceMedia([]);
                setAvailableAudioTracks([]);
                setSelectedMusicTrackId(null);
                return [];
            }

            setMediaLoading(true);

            try {
                const [productMediaResponse, serviceMediaResponse] = await Promise.all([
                    mediaApi.getProductMedia(product.serviceId, product.product_index),
                    mediaApi.getServiceMediaDetailed(product.serviceId),
                ]);

                if (!productMediaResponse.success) {
                    throw new Error(
                        productMediaResponse.error || 'Impossible de récupérer les médias du produit.'
                    );
                }

                if (!serviceMediaResponse.success) {
                    throw new Error(
                        serviceMediaResponse.error || 'Impossible de récupérer la médiathèque du prestataire.'
                    );
                }

                const productMediaItems: MediaLibraryItem[] = Array.isArray((productMediaResponse.data as any)?.data)
                    ? (productMediaResponse.data as any).data
                        .map((item: any) => ({
                            id: ensureNumber(item.id, -1),
                            path: item.path,
                            type: item.media_type ?? item.type ?? 'image',
                            media_type: item.media_type ?? item.type ?? 'image',
                            product_index: item.product_index ?? null,
                            ai_description: item.ai_description ?? null,
                        }))
                        .filter((item: MediaLibraryItem) => item.id > 0)
                    : [];

                const serviceMediaItems: MediaLibraryItem[] = Array.isArray(serviceMediaResponse.data)
                    ? serviceMediaResponse.data
                        .map((item: any) => ({
                            id: ensureNumber(item.id, -1),
                            path: item.path,
                            type: item.media_type ?? item.type ?? 'image',
                            media_type: item.media_type ?? item.type ?? 'image',
                            product_index: item.product_index ?? null,
                            ai_description: item.ai_description ?? null,
                        }))
                        .filter((item: MediaLibraryItem) => item.id > 0)
                    : [];

                setProductMedia(productMediaItems);
                setServiceMedia(serviceMediaItems);

                const audioTracks = [...serviceMediaItems, ...productMediaItems].filter((item) => {
                    const kind = (item.media_type || item.type || '').toLowerCase();
                    return kind.includes('audio');
                });
                setAvailableAudioTracks(audioTracks);

                const defaultIds = new Set<number>();
                productMediaItems.slice(0, 4).forEach((item) => defaultIds.add(item.id));
                setSelectedMediaIds(defaultIds);

                return audioTracks;
            } catch (error) {
                console.error('[ProductVideoCreationModal] Erreur chargement médias:', error);
                Alert.alert(
                    'Erreur récupération médias',
                    'Impossible de récupérer vos images et vidéos pour le moment. Réessayez plus tard.'
                );
                return [];
            } finally {
                setMediaLoading(false);
            }
        },
        []
    );

    // ✅ AMÉLIORATION: Fonction helper pour retry avec exponential backoff
    const fetchWithRetry = useCallback(async <T,>(
        fetchFn: () => Promise<T>,
        maxRetries: number = 3,
        type: string = 'unknown'
    ): Promise<T | null> => {
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                const result = await fetchFn();
                return result;
            } catch (error: any) {
                retryCount++;
                const errorMsg = error?.message || String(error);
                const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('timed out');
                const isNetworkError = errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch');

                if (retryCount >= maxRetries) {
                    console.warn(`[ProductVideoCreationModal] Coach IA: ${type} indisponible après ${maxRetries} tentatives`, error);
                    // ✅ AMÉLIORATION: Logger plus de détails pour debugging
                    console.warn(`[ProductVideoCreationModal] Dernière erreur pour ${type}:`, {
                        message: errorMsg,
                        isTimeout,
                        isNetworkError,
                        stack: error?.stack
                    });
                    return null;
                }

                // ✅ AMÉLIORATION: Log des retries pour debugging
                console.log(`[ProductVideoCreationModal] Coach IA ${type}: Tentative ${retryCount + 1}/${maxRetries} (erreur: ${errorMsg.substring(0, 50)})`);

                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }, []);

    // ✅ AMÉLIORATION: Valeurs par défaut pour Coach IA
    const getDefaultCoachData = useCallback((type: 'brief' | 'style' | 'plan'): any => {
        if (!selectedProduct) return null;

        const productName = normalizeProductName(selectedProduct);

        switch (type) {
            case 'brief':
                return {
                    variants: [{
                        headline: productName,
                        call_to_action: 'Découvrez maintenant',
                        script_outline: ['Introduction', 'Caractéristiques', 'Appel à l\'action'],
                        tone: stylePreset
                    }]
                };
            case 'style':
                return {
                    suggestion: {
                        preset: stylePreset || 'story',
                        transitions: 'smooth',
                        effects: [],
                        overlay_tips: []
                    }
                };
            case 'plan':
                return {
                    plan: {
                        distribution: Array.from(selectedChannels.values()).length > 0
                            ? Array.from(selectedChannels.values())
                            : ['product', 'chat'],
                        duration: 15,
                        hashtags: [],
                        schedule: []
                    }
                };
            default:
                return null;
        }
    }, [selectedProduct, stylePreset, selectedChannels]);

    const prefetchCoachInsights = useCallback(async () => {
        if (!selectedProduct || coachLoading) {
            return;
        }
        if (coachPrefetchDoneRef.current && (briefVariants.length > 0 || styleSuggestion || distributionPlan)) {
            return;
        }

        coachPrefetchDoneRef.current = true;
        setCoachLoading(true);

        const priceLabel = computePriceLabel(selectedProduct);
        const promotionValue = computePromotionLabel(selectedProduct);
        const highlights = collectProductHighlights(selectedProduct);
        const channelsArray = Array.from(selectedChannels.values());
        const lang = subtitleLang || voiceoverLang;

        try {
            // ✅ AMÉLIORATION: Brief avec retry + valeurs par défaut
            if (briefVariants.length === 0) {
                const briefResult = await fetchWithRetry(
                    async () => {
                        const response = await mediaApi.generateVideoBrief({
                            product_name: normalizeProductName(selectedProduct),
                            description: extractDescription(selectedProduct.description, ''),
                            price: priceLabel,
                            promotion: promotionValue,
                            highlights,
                            target_audience: channelsArray.join(', '),
                            tone: stylePreset,
                            lang,
                            variant_count: 3,
                        });
                        if (response.success && Array.isArray((response.data as any)?.variants) && (response.data as any).variants.length > 0) {
                            return (response.data as any).variants;
                        }
                        throw new Error('Aucun variant retourné');
                    },
                    3,
                    'brief'
                );

                if (briefResult) {
                    setBriefVariants(briefResult);
                } else {
                    // ✅ CORRECTION: Utiliser valeurs par défaut avec notification silencieuse
                    const defaultBrief = getDefaultCoachData('brief');
                    if (defaultBrief?.variants) {
                        console.log('[ProductVideoCreationModal] Coach IA: Utilisation valeurs par défaut pour brief');
                        setBriefVariants(defaultBrief.variants);
                    } else {
                        console.warn('[ProductVideoCreationModal] Coach IA: Impossible de générer brief, même avec valeurs par défaut');
                    }
                }
            }

            // ✅ AMÉLIORATION: Style avec retry + valeurs par défaut
            if (!styleSuggestion) {
                const styleResult = await fetchWithRetry(
                    async () => {
                        const channelPriority = ['shorts', 'instagram', 'youtube', 'chat', 'product'];
                        const preferredChannel = channelPriority.find((key) => selectedChannels.has(key)) || 'shorts';
                        const response = await mediaApi.generateVideoStyle({
                            channel: preferredChannel,
                            product_type: getFieldValue(selectedProduct.type) || getFieldValue(selectedProduct.category_label) || '',
                            tone: stylePreset,
                            promotion: promotionValue,
                            highlights,
                            lang,
                        });
                        if (response.success && (response.data as any)?.suggestion) {
                            return (response.data as any).suggestion;
                        }
                        throw new Error('Aucune suggestion retournée');
                    },
                    3,
                    'style'
                );

                if (styleResult) {
                    setStyleSuggestion(styleResult);
                } else {
                    // ✅ CORRECTION: Utiliser valeurs par défaut avec notification silencieuse
                    const defaultStyle = getDefaultCoachData('style');
                    if (defaultStyle?.suggestion) {
                        console.log('[ProductVideoCreationModal] Coach IA: Utilisation valeurs par défaut pour style');
                        setStyleSuggestion(defaultStyle.suggestion);
                    } else {
                        console.warn('[ProductVideoCreationModal] Coach IA: Impossible de générer style, même avec valeurs par défaut');
                    }
                }
            }

            // ✅ NOUVEAU: Génération de timeline après le style
            if (!generatedTimeline && briefVariants.length > 0 && styleSuggestion) {
                const selectedBrief = briefVariants[0]; // Utiliser le premier brief
                setIsGeneratingTimeline(true);
                try {
                    // Préparer les médias disponibles
                    const availableMedia = [
                        ...productMedia.map(m => ({
                            id: m.id.toString(),
                            url: m.path ? `${config.API_BASE_URL}/${m.path}` : undefined,
                            media_type: (m.type || m.media_type || 'image') === 'image' ? 'image' : 'video',
                        })),
                        ...serviceMedia.map(m => ({
                            id: m.id.toString(),
                            url: m.path ? `${config.API_BASE_URL}/${m.path}` : undefined,
                            media_type: (m.type || m.media_type || 'image') === 'image' ? 'image' : 'video',
                        })),
                    ];

                    const timelineResponse = await mediaApi.generateVideoTimeline({
                        brief: {
                            script_outline: selectedBrief.script_outline || [],
                            headline: selectedBrief.headline,
                            call_to_action: selectedBrief.call_to_action,
                        },
                        style: {
                            effects: styleSuggestion.effects || [],
                            transitions: styleSuggestion.transitions || [],
                            color_palette: styleSuggestion.color_palette || undefined,
                        },
                        available_media: availableMedia,
                        duration_seconds: ensureNumber(duration, 28),
                        voiceover_script: voiceoverEnabled ? voiceoverScript.trim() : undefined,
                        music_track_id: selectedMusicTrackId ?? undefined,
                        lang: subtitleLang || voiceoverLang || 'fr',
                    });

                    if (timelineResponse.success && timelineResponse.data) {
                        const responseData = timelineResponse.data as { success?: boolean; timeline?: VideoTimelineType };
                        if (responseData.timeline) {
                            console.log('[ProductVideoCreationModal] ✅ Timeline générée:', responseData.timeline);
                            setGeneratedTimeline(responseData.timeline);
                            // ✅ NOUVEAU: Mettre à jour scriptNotes avec le texte des scènes si vide
                            if (!scriptNotes.trim() && responseData.timeline.scenes.length > 0) {
                                const scriptFromTimeline = responseData.timeline.scenes
                                    .map(s => s.text)
                                    .filter((t): t is string => t !== undefined && t.trim().length > 0)
                                    .join('\n');
                                if (scriptFromTimeline) {
                                    setScriptNotes(scriptFromTimeline);
                                }
                            }
                        } else {
                            console.warn('[ProductVideoCreationModal] ⚠️ Timeline non générée, utilisation storyboard texte');
                        }
                    } else {
                        console.warn('[ProductVideoCreationModal] ⚠️ Timeline non générée, utilisation storyboard texte');
                    }
                } catch (error) {
                    console.error('[ProductVideoCreationModal] Erreur génération timeline:', error);
                    // Continuer sans timeline, utiliser storyboard texte
                } finally {
                    setIsGeneratingTimeline(false);
                }
            }

            // ✅ AMÉLIORATION: Plan avec retry + valeurs par défaut
            if (!distributionPlan) {
                const planResult = await fetchWithRetry(
                    async () => {
                        const response = await mediaApi.generateDistributionPlan({
                            product_name: normalizeProductName(selectedProduct),
                            channels: channelsArray,
                            target_audience: channelsArray.join(', '),
                            marketing_angle: mediaAnalysis.marketingAngle || undefined,
                            lang,
                        });
                        if (response.success && (response.data as any)?.plan) {
                            return (response.data as any).plan;
                        }
                        throw new Error('Aucun plan retourné');
                    },
                    3,
                    'plan'
                );

                if (planResult) {
                    setDistributionPlan(planResult);
                } else {
                    // ✅ CORRECTION: Utiliser valeurs par défaut avec notification silencieuse
                    const defaultPlan = getDefaultCoachData('plan');
                    if (defaultPlan?.plan) {
                        console.log('[ProductVideoCreationModal] Coach IA: Utilisation valeurs par défaut pour plan');
                        setDistributionPlan(defaultPlan.plan);
                    } else {
                        console.warn('[ProductVideoCreationModal] Coach IA: Impossible de générer plan, même avec valeurs par défaut');
                    }
                }
            }
        } finally {
            setCoachLoading(false);
        }
    }, [
        briefVariants.length,
        distributionPlan,
        mediaAnalysis.marketingAngle,
        selectedChannels,
        selectedProduct,
        coachLoading,
        stylePreset,
        styleSuggestion,
        subtitleLang,
        voiceoverLang,
        fetchWithRetry,
        getDefaultCoachData,
    ]);

    const handleRefreshCoach = useCallback(() => {
        coachPrefetchDoneRef.current = false;
        prefetchCoachInsights().catch((error) =>
            console.warn('[ProductVideoCreationModal] Coach IA: rafraîchissement impossible', error)
        );
    }, [prefetchCoachInsights]);

    // ✅ NOUVEAU: Fonction pour estimer le coût de génération
    const handleEstimateCost = useCallback(async () => {
        if (!selectedProduct || typeof selectedProduct.product_index !== 'number') {
            Alert.alert('Produit requis', 'Sélectionnez d\'abord un produit.');
            return;
        }

        const serviceId = Number(selectedProduct.serviceId);
        if (Number.isNaN(serviceId)) {
            Alert.alert('Service invalide', 'Impossible d\'estimer le coût.');
            return;
        }

        try {
            setCostLoading(true);
            const payload: VideoGenerationPayload = {
                style: stylePreset,
                headline: headline.trim(),
                call_to_action: callToAction.trim(),
                duration_seconds: ensureNumber(duration, 28),
                storyboard: scriptNotes
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0),
                music_mode: musicMode !== 'none' ? musicMode : undefined,
                music_volume: musicMode !== 'none' ? Number.parseFloat(musicVolume) : undefined,
                voiceover_lang: voiceoverEnabled ? voiceoverLang : undefined,
                voiceover_script: voiceoverEnabled ? voiceoverScript.trim() : undefined,
                selected_media_ids: Array.from(selectedMediaIds),
                use_service_mediatech: useMediatechLibrary,
                include_publicite_assets: includePubliciteAssets,
                generate_square_variant: generateSquareVariant,
                generate_landscape_variant: generateLandscapeVariant,
                distribute_channels: Array.from(selectedChannels.values()),
            };

            const response = await apiCallWithRetry(() =>
                iaApi.estimateVideoCost(serviceId, selectedProduct.product_index, payload)
            );

            const estimationResponse = response.data as VideoCostEstimateResponse | VideoCostEstimation | undefined;
            const estimation =
                estimationResponse && 'data' in estimationResponse
                    ? estimationResponse.data
                    : (estimationResponse as VideoCostEstimation | undefined);

            if (estimation) {
                setCostEstimation(estimation);
                setShowCostEstimation(true);
            } else {
                Alert.alert('Estimation impossible', 'Impossible d\'estimer le coût pour le moment. Réessayez plus tard.');
            }
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur estimation coût:', error);
            let message = error?.message || 'Erreur serveur.';

            if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
                message = 'Erreur de connexion. Vérifiez votre accès Internet.';
            } else if (error?.message?.includes('timeout')) {
                message = 'Le délai d\'attente a expiré. Réessayez.';
            }

            Alert.alert('Erreur d\'estimation', message);
        } finally {
            setCostLoading(false);
        }
    }, [
        selectedProduct,
        stylePreset,
        headline,
        callToAction,
        duration,
        scriptNotes,
        musicMode,
        musicVolume,
        voiceoverEnabled,
        voiceoverScript,
        voiceoverLang,
        selectedMediaIds,
        useMediatechLibrary,
        includePubliciteAssets,
        generateSquareVariant,
        generateLandscapeVariant,
        selectedChannels,
    ]);

    // ✅ NOUVEAU: Charger le brouillon au démarrage
    useEffect(() => {
        if (!visible || !selectedProduct) return;

        const loadDraft = async () => {
            try {
                const draft = await loadVideoDraft();
                if (draft &&
                    draft.serviceId === Number(selectedProduct.serviceId) &&
                    draft.productIndex === selectedProduct.product_index) {
                    Alert.alert(
                        'Brouillon trouvé',
                        'Un brouillon non terminé a été trouvé. Voulez-vous le reprendre ?',
                        [
                            {
                                text: 'Non, recommencer',
                                onPress: async () => {
                                    await clearVideoDraft();
                                },
                                style: 'cancel',
                            },
                            {
                                text: 'Oui, reprendre',
                                onPress: () => {
                                    // Restaurer les valeurs du brouillon
                                    if (draft.headline) setHeadline(draft.headline);
                                    if (draft.callToAction) setCallToAction(draft.callToAction);
                                    if (draft.brief) setScriptNotes(draft.brief);
                                    if (draft.selectedMediaIds && draft.selectedMediaIds.length > 0) {
                                        setSelectedMediaIds(new Set(draft.selectedMediaIds));
                                    }
                                    if (draft.musicMode) setMusicMode(draft.musicMode as MusicMode);
                                    if (draft.voiceoverEnabled !== undefined) setVoiceoverEnabled(draft.voiceoverEnabled);
                                    if (draft.voiceoverLang) setVoiceoverLang(draft.voiceoverLang);
                                    if (draft.publishChat !== undefined) setPublishToChat(draft.publishChat);
                                    if (draft.publishCard !== undefined) setPublishToProductCard(draft.publishCard);
                                },
                            },
                        ]
                    );
                }
            } catch (error) {
                console.error('[ProductVideoCreationModal] Erreur chargement brouillon:', error);
            }
        };
        loadDraft();
    }, [visible, selectedProduct]);

    // ✅ NOUVEAU: Sauvegarde automatique du brouillon avec debounce
    useEffect(() => {
        if (!visible || !selectedProduct) return;

        const draft: Partial<VideoDraft> = {
            serviceId: Number(selectedProduct.serviceId),
            productIndex: selectedProduct.product_index || 0,
            productName: normalizeProductName(selectedProduct),
            serviceName: selectedProduct.serviceTitre || '',
            brief: scriptNotes,
            headline,
            callToAction,
            selectedMediaIds: Array.from(selectedMediaIds),
            musicMode,
            voiceoverEnabled,
            voiceoverLang: voiceoverLang as 'fr' | 'en',
            publishChat: publishToChat,
            publishCard: publishToProductCard,
            publishSocial: selectedChannels.has('shorts') || selectedChannels.has('instagram') || selectedChannels.has('youtube'),
        };
        saveVideoDraft(draft);
    }, [
        visible,
        selectedProduct,
        scriptNotes,
        headline,
        callToAction,
        selectedMediaIds,
        musicMode,
        voiceoverEnabled,
        voiceoverLang,
        publishToChat,
        publishToProductCard,
        selectedChannels,
    ]);

    // ✅ NOUVEAU: Charger les sessions disponibles pour le chaînage
    useEffect(() => {
        if (!visible || !showVideoChaining) return;

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
                console.error('[ProductVideoCreationModal] Erreur chargement sessions:', error);
            }
        };
        loadAvailableSessions();
    }, [visible, showVideoChaining]);

    useEffect(() => {
        if (!visible) {
            coachPrefetchDoneRef.current = false;
            setCoachLoading(false);
            // ✅ CORRECTION: Réinitialiser l'étape quand le modal se ferme
            setActiveStep(1);
            // ✅ NOUVEAU: Réinitialiser les états des fonctionnalités migrées
            setCostEstimation(null);
            setShowCostEstimation(false);
            setShowVideoChaining(false);
            setSelectedLinkedSessions([]);
            setCompletedSteps(new Set());
        } else {
            // ✅ NOUVEAU: Tracking UX (depuis Wizard)
            trackUxEvent('wizard_open', {
                device: 'mobile',
                serviceId: selectedProduct?.serviceId ? Number(selectedProduct.serviceId) : undefined,
                productIndex: selectedProduct?.product_index,
                step: activeStep,
            });
        }
    }, [visible, selectedProduct, activeStep]);

    useEffect(() => {
        coachPrefetchDoneRef.current = false;
        setCoachLoading(false);
    }, [selectedProduct?.id]);

    useEffect(() => {
        if (visible && selectedProduct) {
            prefetchCoachInsights().catch((error) =>
                console.warn('[ProductVideoCreationModal] Coach IA: pré-chargement impossible', error)
            );
        }
    }, [visible, selectedProduct, prefetchCoachInsights]);

    const handleAttachAudioLoop = useCallback(
        async (loopId: string) => {
            if (!selectedProduct) {
                return;
            }
            const numericServiceId = Number(selectedProduct.serviceId);
            if (Number.isNaN(numericServiceId)) {
                Alert.alert('Service introuvable', "Impossible d'attacher cette piste audio.");
                return;
            }
            setAttachingLoopId(loopId);
            try {
                const response = await mediaApi.attachAudioLoop(loopId, numericServiceId);
                if (!response.success) {
                    throw new Error(response.error || 'Attache impossible');
                }
                await refreshMedia(selectedProduct);
                Alert.alert('🎵 Audio ajouté', 'La boucle a été ajoutée à votre médiathèque.');
            } catch (error) {
                console.error("[ProductVideoCreationModal] Impossible d'attacher la boucle audio: ", error);
                Alert.alert('Erreur', "Ajout de la boucle audio impossible pour le moment.");
            } finally {
                setAttachingLoopId(null);
            }
        },
        [refreshMedia, selectedProduct]
    );

    const handleImportAudioTrack = useCallback(async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', "Sélectionnez un produit principal avant d'importer un audio.");
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['audio/*'],
                multiple: false,
                copyToCacheDirectory: true,
            });

            if (!result || (result as any).canceled || (result as any).type === 'cancel') {
                return;
            }

            const asset: any = (result as any).assets?.[0] || result;
            if (!asset?.uri) {
                Alert.alert('Import audio', 'Impossible de lire ce fichier audio.');
                return;
            }

            setIsUploadingAudio(true);

            const uploaded = await mediaApi.uploadServiceAudio(selectedProduct.serviceId, {
                uri: asset.uri,
                name: asset.name || asset.originalName,
                type: asset.mimeType || asset.type || 'audio/mpeg',
            });

            const audioTracks = await refreshMedia(selectedProduct);

            if (uploaded?.id) {
                setSelectedMusicTrackId(uploaded.id);
            } else if (audioTracks.length > 0) {
                const latest = [...audioTracks].sort((a, b) => (b.id || 0) - (a.id || 0))[0];
                setSelectedMusicTrackId(latest?.id ?? null);
            }

            Alert.alert('Audio importé', 'Votre piste a été ajoutée à la médiathèque.');
        } catch (error) {
            console.error('[ProductVideoCreationModal] Import audio échoué:', error);
            Alert.alert(
                'Erreur import audio',
                error instanceof Error ? error.message : "Impossible d'importer ce fichier audio pour le moment."
            );
        } finally {
            setIsUploadingAudio(false);
        }
    }, [refreshMedia, selectedProduct]);

    const handleGenerateBrief = useCallback(async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', 'Sélectionnez un produit avant de générer un brief.');
            return;
        }

        setIsGeneratingBrief(true);
        try {
            const priceLabel = computePriceLabel(selectedProduct);
            const promotionValue = computePromotionLabel(selectedProduct);
            const highlights = collectProductHighlights(selectedProduct);
            const response = await mediaApi.generateVideoBrief({
                product_name: normalizeProductName(selectedProduct),
                description: extractDescription(selectedProduct.description, ''),
                price: priceLabel,
                promotion: promotionValue,
                highlights,
                target_audience: Array.from(selectedChannels.values()).join(', '),
                tone: stylePreset,
                lang: subtitleLang || voiceoverLang,
                variant_count: 3,
            });

            if (!response.success || !(response.data as any)?.variants) {
                throw new Error(response.error || 'Génération IA impossible');
            }

            const variants: AIVideoBriefVariant[] = (response.data as any).variants;
            setBriefVariants(variants);

            if (variants.length === 0) {
                throw new Error('Aucune variante générée');
            } else if (variants.length === 1) {
                applyBriefVariant(variants[0], setHeadline, setCallToAction, setScriptNotes, setVoiceoverScript, setVariantPickerVisible);
                Alert.alert('Brief généré', 'Le script et le CTA ont été optimisés par Yukpomnang IA.');
            } else {
                setVariantPickerVisible(true);
            }
        } catch (error) {
            console.error('[ProductVideoCreationModal] Brief IA impossible:', error);
            Alert.alert(
                'Erreur IA',
                error instanceof Error ? error.message : 'Impossible de générer le brief IA pour le moment.'
            );
        } finally {
            setIsGeneratingBrief(false);
        }
    }, [selectedProduct, selectedChannels, stylePreset, subtitleLang, voiceoverLang]); // ✅ CORRIGÉ: applyBriefVariant est une fonction utilitaire stable, pas besoin de dépendance

    const applyStyleSuggestion = useCallback((suggestion: AIVideoStyleSuggestion) => {
        setStyleSuggestion(suggestion);
        setSelectedEffects(new Set(suggestion.effects || []));
        setSelectedTransitions(new Set(suggestion.transitions || []));
        setSelectedOverlayTips(new Set(suggestion.overlay_tips || []));
        setColorPalette(suggestion.color_palette || '');
        setStyleMusicHint(suggestion.music_hint || '');
    }, []);

    const handleGenerateStyleSuggestion = useCallback(async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', 'Sélectionnez un produit avant de générer des effets IA.');
            return;
        }

        setIsGeneratingStyle(true);
        try {
            const highlights = collectProductHighlights(selectedProduct);
            const channelPriority = ['shorts', 'instagram', 'youtube', 'chat', 'product'];
            const selectedChannel = channelPriority.find((key) => selectedChannels.has(key)) || 'shorts';

            const response = await mediaApi.generateVideoStyle({
                channel: selectedChannel,
                product_type: selectedProduct.type || selectedProduct.category_label,
                tone: stylePreset,
                promotion: computePromotionLabel(selectedProduct),
                highlights,
                lang: subtitleLang || voiceoverLang,
            });

            if (!response.success || !(response.data as any)?.suggestion) {
                throw new Error(response.error || 'Impossible de récupérer les suggestions IA');
            }

            applyStyleSuggestion((response.data as any).suggestion);
            Alert.alert('Effets IA générés', 'Les effets et transitions recommandés ont été ajoutés. Vous pouvez les ajuster.');
        } catch (error) {
            console.error('[ProductVideoCreationModal] Style IA impossible:', error);
            Alert.alert(
                'Erreur IA',
                error instanceof Error ? error.message : 'Impossible de générer les suggestions visuelles pour le moment.'
            );
        } finally {
            setIsGeneratingStyle(false);
        }
    }, [selectedProduct, selectedChannels, stylePreset, subtitleLang, voiceoverLang, applyStyleSuggestion]);

    const handleAnalyzeMedia = useCallback(async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', "Sélectionnez un produit avant d'analyser vos médias.");
            return;
        }

        setIsAnalyzingMedia(true);
        try {
            const tags: string[] = [];
            productMedia.forEach((item) => {
                if (item.ai_description) {
                    tags.push(item.ai_description);
                }
            });
            serviceMedia.forEach((item) => {
                if (item.ai_description) {
                    tags.push(item.ai_description);
                }
            });

            // ✅ CORRECTION: Utiliser iaApi.analyzeMedia() au lieu de mediaApi.analyzeMedia()
            // L'endpoint correct est /api/ia/media-analysis, pas /api/media/analyze
            const response = await iaApi.analyzeMedia({
                product_name: normalizeProductName(selectedProduct),
                media_tags: tags,
                description: extractDescription(selectedProduct.description, ''),
                lang: subtitleLang || voiceoverLang,
            });

            if (!response.success || !(response.data as any)?.analysis) {
                throw new Error(response.error || 'Analyse IA indisponible');
            }

            const analysis = (response.data as any).analysis;
            setMediaAnalysis({
                dominantColors: analysis.dominant_colors,
                detectedObjects: analysis.detected_objects,
                ambiance: analysis.ambiance,
                marketingAngle: analysis.marketing_angle,
            });
            Alert.alert('Analyse IA terminée', 'Couleurs dominantes et angles marketing mis à jour.');
        } catch (error) {
            console.error('[ProductVideoCreationModal] Analyse média impossible:', error);
            Alert.alert(
                'Erreur IA',
                error instanceof Error ? error.message : "Impossible d'analyser vos médias pour le moment."
            );
        } finally {
            setIsAnalyzingMedia(false);
        }
    }, [productMedia, serviceMedia, selectedProduct, subtitleLang, voiceoverLang]);

    useEffect(() => {
        if (!visible) {
            setSelectedProduct(primaryProduct);
            setSelectedRelatedProducts(new Set());
            setSelectedMediaIds(new Set());
            setStylePreset('tiktok');
            setDuration('28');
            setScriptNotes('');
            setIncludePrice(true);
            setIncludeContact(true);
            setUseProductGallery(true);
            setUseMediatechLibrary(true);
            setIncludePubliciteAssets(true);
            setPublishToChat(true);
            setPublishToProductCard(true);
            setMusicMode('pulse');
            setMusicVolume('0.28');
            setVoiceoverEnabled(false);
            setVoiceoverScript('');
            setVoiceoverLang('fr');
            setSubtitleLang('fr');
            setGenerateSquareVariant(true);
            setGenerateLandscapeVariant(false);
            setSelectedMusicTrackId(null);
            setAvailableAudioTracks([]);
            setSelectedChannels(new Set(['chat', 'product']));
            setBriefVariants([]);
            setVariantPickerVisible(false);
            setStyleSuggestion(null);
            setSelectedEffects(new Set());
            setSelectedTransitions(new Set());
            setSelectedOverlayTips(new Set());
            setColorPalette('');
            setStyleMusicHint('');
            setMediaAnalysis({});
            setDistributionPlan(null);
            return;
        }

        setSelectedProduct(primaryProduct);
        setSelectedRelatedProducts(new Set());
        setSelectedMediaIds(new Set());
        setStylePreset('tiktok');
        setDuration('28');
        setScriptNotes('');
        setIncludePrice(true);
        setIncludeContact(true);
        setUseProductGallery(true);
        setUseMediatechLibrary(true);
        setIncludePubliciteAssets(true);
        setPublishToChat(true);
        setPublishToProductCard(true);
        setMusicMode('pulse');
        setMusicVolume('0.28');
        setVoiceoverEnabled(false);
        setVoiceoverScript('');
        setVoiceoverLang('fr');
        setSubtitleLang('fr');
        setGenerateSquareVariant(true);
        setGenerateLandscapeVariant(false);
        setSelectedMusicTrackId(null);
        setAvailableAudioTracks([]);
        setSelectedChannels(new Set(['chat', 'product']));
    }, [visible, primaryProduct]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        if (!selectedProduct) {
            setHeadline('');
            setCallToAction('Commandez maintenant sur Yukpomnang ✅');
            setIncludePromotion(false);
            setSelectedRelatedProducts(new Set());
            setProductMedia([]);
            setServiceMedia([]);
            setAvailableAudioTracks([]);
            setSelectedMusicTrackId(null);
            setSubtitleLang('fr');
            refreshMedia(null);
            return;
        }

        const productName = normalizeProductName(selectedProduct);
        const defaultHeadline = `🎯 ${productName} en ${getFieldValue(selectedProduct.city) || 'promo'}`;
        const defaultCTA = `📲 Contactez ${extractServiceName(selectedProduct, 'nous')} sur Yukpomnang`;

        setHeadline(defaultHeadline);
        setCallToAction(defaultCTA);
        setIncludePromotion(Boolean(selectedProduct.promotionActive));
        setSelectedRelatedProducts(new Set());
        setVoiceoverScript(
            buildDefaultVoiceover(productName, defaultHeadline, defaultCTA, [])
        );

        void refreshMedia(selectedProduct);
    }, [visible, selectedProduct, refreshMedia]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        setLoadingLibrary(true);
        mediaApi.getAudioLibrary()
            .then((response) => {
                if (response.success && Array.isArray((response.data as any)?.loops)) {
                    setAudioLibrary((response.data as any).loops);
                }
            })
            .catch((error) => {
                console.warn('[ProductVideoCreationModal] Impossible de charger la bibliothèque audio:', error);
            })
            .finally(() => setLoadingLibrary(false));
    }, [visible]);

    const groupedProducts: GroupedProducts[] = useMemo(() => {
        const groups = new Map<string, GroupedProducts>();

        console.log('[ProductVideoCreationModal] 📦 Traitement produits:', products.length);

        products.forEach((product) => {
            const serviceId = product.serviceId || 'service';
            const existing = groups.get(serviceId);
            const item: ManagedProduct = product;

            if (existing) {
                existing.items.push(item);
            } else {
                groups.set(serviceId, {
                    serviceId,
                    serviceTitre: extractServiceName(product, 'Service'),
                    items: [item],
                });
            }
        });

        const result = Array.from(groups.values());
        console.log('[ProductVideoCreationModal] 📦 Groupes créés:', result.length, 'services');
        return result;
    }, [products]);

    const productsSameService = useMemo(() => {
        if (!selectedProduct) {
            return [];
        }
        // ✅ CORRIGÉ: Vérifier que products est un tableau avant d'appeler .filter()
        if (!Array.isArray(products)) {
            return [];
        }
        return products
            .filter(
                (product) =>
                    product &&
                    product.serviceId === selectedProduct.serviceId &&
                    product.product_index !== selectedProduct.product_index
            )
            .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    }, [products, selectedProduct]);

    const toggleRelatedProduct = (productIndex?: number) => {
        if (typeof productIndex !== 'number') {
            return;
        }

        setSelectedRelatedProducts((prev) => {
            const next = new Set(prev);
            if (next.has(productIndex)) {
                next.delete(productIndex);
            } else {
                next.add(productIndex);
            }
            return next;
        });
    };

    const toggleMediaSelection = (mediaId: number) => {
        setSelectedMediaIds((prev) => {
            const next = new Set(prev);
            if (next.has(mediaId)) {
                next.delete(mediaId);
            } else {
                next.add(mediaId);
            }
            return next;
        });
    };

    const toggleSelection = useCallback((value: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(value)) {
                next.delete(value);
            } else {
                next.add(value);
            }
            return next;
        });
    }, []);

    // ✅ NOUVEAU: Fonction helper pour calculer les styles dynamiquement avec insets
    const getStepContentStyle = useCallback(() => ({
        padding: 20,
        gap: 20,
        paddingBottom: 100 + insets.bottom, // ✅ Espace pour les boutons fixes + safe area
        flexGrow: 1,
        // ✅ CORRECTION: Permettre le scroll même si le contenu est plus petit que la hauteur visible
        minHeight: '100%',
    }), [insets.bottom]);

    const getFixedBottomButtonStyle = useCallback(() => ({
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 16),
        backgroundColor: modernColors.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
        minHeight: 80 + insets.bottom,
    }), [insets.bottom]);

    // ✅ NOUVEAU: Fonctions de rendu par étape - Réorganisées en 6 étapes courtes
    // ✅ NOUVEAU: Charger Templates Narratifs Serveur (depuis Wizard)
    useEffect(() => {
        const loadTemplates = async () => {
            setStoryTemplatesLoading(true);
            try {
                const templates = await studioService.listTemplates();
                if (Array.isArray(templates)) {
                    setStoryTemplates(templates);
                    if (templates.length > 0 && !templates.some((spec) => spec.id === storyTemplateId)) {
                        setStoryTemplateId(templates[0].id);
                    }
                }
            } catch (error) {
                console.warn('[ProductVideoCreationModal] Templates indisponibles', error);
            } finally {
                setStoryTemplatesLoading(false);
            }
        };
        if (visible && selectedProduct) {
            loadTemplates();
        }
    }, [visible, selectedProduct, storyTemplateId]);

    // ✅ NOUVEAU: Marquer étape complétée (depuis Wizard)
    const markStepCompleted = useCallback((stepNum: number) => {
        setCompletedSteps((prev) => new Set([...prev, stepNum]));
    }, []);

    // ✅ NOUVEAU: Ensure Studio Session (depuis Wizard)
    const ensureStudioSession = useCallback(async (): Promise<string | undefined> => {
        if (studioSessionId) {
            return studioSessionId;
        }
        if (!selectedProduct || typeof selectedProduct.serviceId === 'undefined') {
            return undefined;
        }
        try {
            const existing = await studioService.listSessions();
            if (existing.length > 0) {
                setStudioSessionId(existing[0].id);
                return existing[0].id;
            }
            const payload: import('../services/studioService').CreateStudioSessionPayload = {
                service_id: Number(selectedProduct.serviceId),
                brief: { raw: scriptNotes || headline || normalizeProductName(selectedProduct) },
                metadata: {
                    product_name: normalizeProductName(selectedProduct),
                },
                distribution_plan: [],
            };
            const aggregate = await studioService.createSession(payload);
            setStudioSessionId(aggregate.session.id);
            return aggregate.session.id;
        } catch (error) {
            console.warn('[ProductVideoCreationModal] session Studio indisponible', error);
            return undefined;
        }
    }, [selectedProduct, scriptNotes, headline, studioSessionId]);

    // ✅ NOUVEAU: Generate Storyboard via Studio (depuis Wizard)
    const handleGenerateStoryboard = useCallback(async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', 'Sélectionnez un produit avant de générer un storyboard.');
            return;
        }
        const startedAt = Date.now();
        trackUxEvent('storyboard_generate_click', {
            device: 'mobile',
            serviceId: Number(selectedProduct.serviceId),
            productIndex: selectedProduct.product_index,
            sessionId: studioSessionId,
            step: activeStep,
        });
        const sessionId = await ensureStudioSession();
        if (!sessionId) {
            Alert.alert('Erreur', 'Impossible de créer une session Studio. Vérifiez votre connexion.');
            return;
        }
        setStoryboardLoading(true);
        try {
            const request: import('../services/studioService').StoryboardRequest = {
                script_outline: scriptNotes
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .slice(0, 6),
                product_name: normalizeProductName(selectedProduct),
                headline: headline || undefined,
                call_to_action: callToAction || undefined,
                style: stylePreset,
                duration_seconds: ensureNumber(duration, 28),
                template_id: storyTemplateId !== 'blog' ? storyTemplateId : undefined,
                business_context: undefined,
                ai_hints: [],
            };
            const result = await studioService.generateStoryboard(sessionId, request);
            setStoryboard(result);
            const durationMs = Date.now() - startedAt;
            trackUxEvent('storyboard_generate_completed', {
                device: 'mobile',
                serviceId: Number(selectedProduct.serviceId),
                productIndex: selectedProduct.product_index,
                sessionId,
                step: activeStep,
                durationMs,
                extra: { scenes: result.scenes.length },
            });
            Alert.alert('Storyboard généré', `${result.scenes.length} scènes créées.`);
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur génération storyboard:', error);
            const durationMs = Date.now() - startedAt;
            trackUxEvent('storyboard_generate_failed', {
                device: 'mobile',
                serviceId: Number(selectedProduct.serviceId),
                productIndex: selectedProduct.product_index,
                sessionId: studioSessionId,
                step: activeStep,
                durationMs,
                extra: { error: error?.message ?? 'unknown' },
            });
            Alert.alert('Erreur', error?.message || 'Impossible de générer le storyboard.');
        } finally {
            setStoryboardLoading(false);
        }
    }, [selectedProduct, ensureStudioSession, scriptNotes, headline, callToAction, stylePreset, duration, storyTemplateId, studioSessionId, activeStep]);

    // ✅ NOUVEAU: Request Short Preview (depuis Wizard)
    const handleShortPreview = useCallback(async () => {
        if (!studioSessionId) {
            Alert.alert('Session requise', 'Générez d\'abord un storyboard pour créer une session Studio.');
            return;
        }
        const startedAt = Date.now();
        trackUxEvent('preview_short_click', {
            device: 'mobile',
            serviceId: selectedProduct ? Number(selectedProduct.serviceId) : undefined,
            productIndex: selectedProduct?.product_index,
            sessionId: studioSessionId,
            step: activeStep,
        });
        setShortPreviewLoading(true);
        try {
            // ✅ NOUVEAU: Utiliser prewarmed preview si disponible (depuis Wizard)
            if (prewarmedShortPreviewUrl) {
                const { Linking } = require('react-native');
                Linking.openURL(prewarmedShortPreviewUrl);
                const durationMs = Date.now() - startedAt;
                trackUxEvent('preview_short_completed', {
                    device: 'mobile',
                    serviceId: selectedProduct ? Number(selectedProduct.serviceId) : undefined,
                    productIndex: selectedProduct?.product_index,
                    sessionId: studioSessionId,
                    step: activeStep,
                    durationMs,
                    prewarmed: true,
                });
                return;
            }
            const response = await studioService.requestShortPreview(studioSessionId);
            if (response.preview_url) {
                setShortPreviewUrl(response.preview_url);
                setPrewarmedShortPreviewUrl(response.preview_url);
                // Ouvrir dans le lecteur natif
                const { Linking } = require('react-native');
                Linking.openURL(response.preview_url);
                const durationMs = Date.now() - startedAt;
                trackUxEvent('preview_short_completed', {
                    device: 'mobile',
                    serviceId: selectedProduct ? Number(selectedProduct.serviceId) : undefined,
                    productIndex: selectedProduct?.product_index,
                    sessionId: studioSessionId,
                    step: activeStep,
                    durationMs,
                    prewarmed: false,
                });
                Alert.alert('Preview ouverte', 'La prévisualisation s\'ouvre dans votre lecteur vidéo.');
            } else {
                throw new Error('Aucune URL de preview retournée');
            }
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur short preview:', error);
            const durationMs = Date.now() - startedAt;
            trackUxEvent('preview_short_failed', {
                device: 'mobile',
                serviceId: selectedProduct ? Number(selectedProduct.serviceId) : undefined,
                productIndex: selectedProduct?.product_index,
                sessionId: studioSessionId,
                step: activeStep,
                durationMs,
                extra: { error: error?.message ?? 'unknown' },
            });
            Alert.alert('Erreur', error?.message || 'Impossible de générer la prévisualisation.');
        } finally {
            setShortPreviewLoading(false);
        }
    }, [studioSessionId, prewarmedShortPreviewUrl, selectedProduct, activeStep]);

    const renderStep1 = () => {
        // Étape 1 : Sélection produit uniquement (nettoyée - éléments essentiels seulement)
        return (
            <>
                {renderProductSelection()}
            </>
        );
    };

    const renderStep2 = () => {
        // Étape 2 : Sélection médias uniquement
        if (!selectedProduct) {
            return (
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Sélectionnez d'abord un produit</Text>
                    <Text style={styles.sectionSubtitle}>
                        Retournez à l'étape 1 pour sélectionner un produit.
                    </Text>
                </NativeCard>
            );
        }

        return (
            <NativeCard style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>📸 Sélection des médias</Text>
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={handleAnalyzeMedia}
                        disabled={isAnalyzingMedia}
                    >
                        {isAnalyzingMedia ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : (
                            <SafeIcon name="scan" size={16} color={modernColors.primary} />
                        )}
                        <Text style={styles.linkButtonText}>
                            {isAnalyzingMedia ? 'Analyse…' : 'Analyse IA'}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.sectionSubtitle}>
                    Choisissez les images/vidéos à utiliser dans votre vidéo, ou créez une vidéo AR immersive.
                </Text>

                {/* ✅ NOUVEAU Phase 3.2: Bouton pour créer vidéo AR */}
                <View style={styles.arButtonContainer}>
                    <NativeButton
                        title="🎬 Créer vidéo AR immersive"
                        variant="primary"
                        size="medium"
                        onPress={() => setShowAREditor(true)}
                        style={styles.arButton}
                    />
                    <Text style={styles.arButtonHint}>
                        Capturez votre produit en réalité augmentée avec effets 3D
                    </Text>
                </View>

                {Array.isArray(mediaAnalysis.dominantColors) && mediaAnalysis.dominantColors.length > 0 && (
                    <View style={styles.mediaInsightsBox}>
                        <Text style={styles.mediaInsightsTitle}>Palette dominante</Text>
                        <View style={styles.colorRow}>
                            {mediaAnalysis.dominantColors.map((color, idx) => (
                                <View
                                    key={`color_${idx}`}
                                    style={[styles.colorSwatch, { backgroundColor: color }]}
                                >
                                    <Text style={styles.colorLabel}>{color}</Text>
                                </View>
                            ))}
                        </View>
                        {mediaAnalysis.detectedObjects && mediaAnalysis.detectedObjects.length > 0 && (
                            <Text style={styles.mediaInsightsText}>
                                Objets repérés : {mediaAnalysis.detectedObjects.join(', ')}
                            </Text>
                        )}
                    </View>
                )}
                <View style={styles.toggleRow}>
                    <View style={styles.toggleText}>
                        <Text style={styles.toggleLabel}>Galerie produit</Text>
                        <Text style={styles.toggleDescription}>
                            Utiliser les images de la fiche produit.
                        </Text>
                    </View>
                    <Switch
                        value={useProductGallery}
                        onValueChange={setUseProductGallery}
                        trackColor={{ true: '#6366F1' }}
                    />
                </View>
                <View style={styles.toggleRow}>
                    <View style={styles.toggleText}>
                        <Text style={styles.toggleLabel}>Médiathèque service</Text>
                        <Text style={styles.toggleDescription}>
                            Ajouter vos assets généraux (logos, publicités).
                        </Text>
                    </View>
                    <Switch
                        value={useMediatechLibrary}
                        onValueChange={setUseMediatechLibrary}
                        trackColor={{ true: '#6366F1' }}
                    />
                </View>
                <View style={styles.toggleRow}>
                    <View style={styles.toggleText}>
                        <Text style={styles.toggleLabel}>Visuels publicitaires</Text>
                        <Text style={styles.toggleDescription}>
                            Inclure les bannières de vos campagnes.
                        </Text>
                    </View>
                    <Switch
                        value={includePubliciteAssets}
                        onValueChange={setIncludePubliciteAssets}
                        trackColor={{ true: '#6366F1' }}
                    />
                </View>
                {renderMediaGrid(
                    productMedia,
                    'Images et vidéos du produit',
                    'Ajoutez des médias à cette fiche pour dynamiser la vidéo.',
                    '#6366F1',
                )}
                {renderMediaGrid(
                    serviceMedia,
                    'Médiathèque prestataire',
                    'Aucun média global enregistré pour ce service pour le moment.',
                    '#8B5CF6',
                )}
            </NativeCard>
        );
    };

    const renderStep3 = () => {
        // Étape 3 : Style et effets uniquement
        if (!selectedProduct) {
            return (
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Sélectionnez d'abord un produit</Text>
                    <Text style={styles.sectionSubtitle}>
                        Retournez à l'étape 1 pour sélectionner un produit.
                    </Text>
                </NativeCard>
            );
        }

        return (
            <NativeCard style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🎨 Style et effets</Text>
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={handleGenerateStyleSuggestion}
                        disabled={isGeneratingStyle}
                    >
                        {isGeneratingStyle ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : (
                            <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                        )}
                        <Text style={styles.linkButtonText}>
                            {isGeneratingStyle ? 'Analyse…' : 'Effets IA'}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.sectionSubtitle}>
                    Choisissez le style visuel et les effets pour votre vidéo.
                </Text>
                <View style={styles.styleRow}>
                    {VIDEO_STYLE_OPTIONS.map((option) => {
                        const selected = stylePreset === option.key;
                        return (
                            <TouchableOpacity
                                key={option.key}
                                style={[
                                    styles.styleChip,
                                    selected && styles.styleChipSelected,
                                ]}
                                onPress={() => setStylePreset(option.key)}
                            >
                                <Text
                                    style={[
                                        styles.styleChipLabel,
                                        selected && styles.styleChipLabelSelected,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                                <Text style={styles.styleChipDescription} numberOfLines={1}>
                                    {option.description}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {styleSuggestion && (
                    <View style={styles.suggestionSection}>
                        <Text style={styles.suggestionTitle}>Effets recommandés</Text>
                        <View style={styles.suggestionRow}>
                            {Array.isArray(styleSuggestion.effects) ? styleSuggestion.effects.map((effect) => {
                                const active = selectedEffects.has(effect);
                                return (
                                    <TouchableOpacity
                                        key={`effect_${effect}`}
                                        style={[
                                            styles.suggestionChip,
                                            active && styles.suggestionChipSelected,
                                        ]}
                                        onPress={() => toggleSelection(effect, setSelectedEffects)}
                                    >
                                        <Text
                                            style={[
                                                styles.suggestionChipText,
                                                active && styles.suggestionChipTextSelected,
                                            ]}
                                        >
                                            {effect}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }) : null}
                        </View>

                        <Text style={styles.suggestionTitle}>Transitions</Text>
                        <View style={styles.suggestionRow}>
                            {Array.isArray(styleSuggestion.transitions) ? styleSuggestion.transitions.map((transition) => {
                                const active = selectedTransitions.has(transition);
                                return (
                                    <TouchableOpacity
                                        key={`transition_${transition}`}
                                        style={[
                                            styles.suggestionChip,
                                            active && styles.suggestionChipSelected,
                                        ]}
                                        onPress={() => toggleSelection(transition, setSelectedTransitions)}
                                    >
                                        <Text
                                            style={[
                                                styles.suggestionChipText,
                                                active && styles.suggestionChipTextSelected,
                                            ]}
                                        >
                                            {transition}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }) : null}
                        </View>

                        <Text style={styles.suggestionTitle}>Overlays & tips</Text>
                        <View style={styles.suggestionRow}>
                            {Array.isArray(styleSuggestion.overlay_tips) ? styleSuggestion.overlay_tips.map((tip) => {
                                const active = selectedOverlayTips.has(tip);
                                return (
                                    <TouchableOpacity
                                        key={`tip_${tip}`}
                                        style={[
                                            styles.suggestionChip,
                                            active && styles.suggestionChipSelected,
                                        ]}
                                        onPress={() => toggleSelection(tip, setSelectedOverlayTips)}
                                    >
                                        <Text
                                            style={[
                                                styles.suggestionChipText,
                                                active && styles.suggestionChipTextSelected,
                                            ]}
                                        >
                                            {tip}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }) : null}
                        </View>

                        <Text style={styles.suggestionTitle}>Palette de couleurs</Text>
                        <NativeInput
                            value={colorPalette}
                            onChangeText={setColorPalette}
                            placeholder={styleSuggestion.color_palette || '#6366F1 / #0EA5E9'}
                        />

                        <Text style={styles.suggestionTitle}>Ambiance musicale recommandée</Text>
                        <NativeInput
                            value={styleMusicHint}
                            onChangeText={setStyleMusicHint}
                            placeholder={styleSuggestion.music_hint || 'Ex: Beat afro-pop énergique'}
                        />
                    </View>
                )}
            </NativeCard>
        );
    };

    const renderStep4 = () => {
        // Étape 4 : Script et timeline uniquement
        if (!selectedProduct) {
            return (
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Sélectionnez d'abord un produit</Text>
                    <Text style={styles.sectionSubtitle}>
                        Retournez à l'étape 1 pour sélectionner un produit.
                    </Text>
                </NativeCard>
            );
        }

        return (
            <>
                <NativeCard style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>📝 Script de montage</Text>
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={handleGenerateBrief}
                            disabled={isGeneratingBrief}
                        >
                            {isGeneratingBrief ? (
                                <ActivityIndicator size="small" color={modernColors.primary} />
                            ) : (
                                <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                            )}
                            <Text style={styles.linkButtonText}>
                                {isGeneratingBrief ? 'Génération…' : 'Brief IA'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Titre percutant</Text>
                        <NativeInput
                            value={headline}
                            onChangeText={setHeadline}
                            placeholder="Ex: 🚀 Promotion spéciale sur nos mèches premium !"
                            multiline
                            minLines={2}
                        />
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Call-to-action</Text>
                        <NativeInput
                            value={callToAction}
                            onChangeText={setCallToAction}
                            placeholder="Ex: Réservez en ligne et profitez de la livraison express !"
                            multiline
                            minLines={2}
                        />
                    </View>
                    <View style={styles.fieldGroup}>
                        <View style={styles.fieldLabelRow}>
                            <Text style={styles.fieldLabel}>📝 Script de montage</Text>
                            <Text style={styles.fieldRequired}>*</Text>
                        </View>
                        <Text style={styles.fieldHint}>
                            Décrivez les messages clés, avantages, garanties. Une ligne = une scène.
                        </Text>
                        <NativeInput
                            value={scriptNotes}
                            onChangeText={setScriptNotes}
                            placeholder={`Exemple:\nDécouvrez notre nouveau produit\nQualité premium garantie\nPrix spécial limité\nLivraison express disponible`}
                            multiline
                            minLines={4}
                            style={scriptNotes.trim().length === 0 ? styles.scriptInputRequired : undefined}
                        />
                        {scriptNotes.trim().length === 0 && (
                            <Text style={styles.fieldError}>
                                ⚠️ Le script est requis pour générer la vidéo
                            </Text>
                        )}
                    </View>
                    <View style={styles.durationRow}>
                        <Text style={styles.fieldLabel}>Durée cible</Text>
                        <View style={styles.durationInputRow}>
                            <NativeInput
                                value={duration}
                                onChangeText={setDuration}
                                keyboardType="numeric"
                                style={styles.durationInput}
                            />
                            <Text style={styles.durationUnit}>secondes</Text>
                        </View>
                        <Text style={styles.durationHint}>
                            Astuce : 25-35s performe mieux sur les réseaux sociaux.
                        </Text>
                    </View>
                </NativeCard>

                {/* ✅ NOUVEAU: Sélecteur de variantes de timeline */}
                {!generatedTimeline && !isEditingTimeline && scriptNotes.trim().length > 0 && (
                    <TimelineVariantSelector
                        timelineRequest={{
                            brief: {
                                script_outline: scriptNotes.split('\n').filter(l => l.trim().length > 0),
                                headline,
                                call_to_action: callToAction,
                            },
                            style: {
                                effects: Array.from(selectedEffects),
                                transitions: Array.from(selectedTransitions),
                                color_palette: styleSuggestion?.color_palette || undefined,
                            },
                            available_media: Array.from(selectedMediaIds).map(id => ({
                                id: id.toString(),
                                media_type: 'image',
                            })),
                            duration_seconds: Number.parseFloat(duration) || 30,
                            voiceover_script: voiceoverEnabled ? voiceoverScript : undefined,
                            music_track_id: selectedMusicTrackId?.toString(),
                            lang: voiceoverLang || subtitleLang || 'fr',
                            variant_count: 3,
                        }}
                        onVariantSelected={(variant) => {
                            console.log('[ProductVideoCreationModal] Variante sélectionnée:', variant.variant_name);
                            setGeneratedTimeline(variant.timeline);
                        }}
                    />
                )}

                {/* Prévisualisation de la timeline générée */}
                {generatedTimeline && !isEditingTimeline && (
                    <>
                        <NativeCard style={styles.sectionCard}>
                            <TimelinePreview
                                timeline={generatedTimeline}
                                onEdit={() => setIsEditingTimeline(true)}
                                onScenePress={(sceneIndex) => {
                                    console.log('[ProductVideoCreationModal] Scène pressée:', sceneIndex);
                                }}
                            />
                        </NativeCard>

                        {/* ✅ NOUVEAU: Preview rapide */}
                        <QuickPreview
                            timeline={generatedTimeline}
                            onPreviewReady={(preview) => {
                                console.log('[ProductVideoCreationModal] Preview prêt:', preview.preview_url);
                            }}
                        />

                        {/* ✅ NOUVEAU: Short Preview via Studio (depuis Wizard) */}
                        {studioSessionId && (
                            <View style={styles.shortPreviewContainer}>
                                <NativeButton
                                    title={shortPreviewLoading ? "Génération preview…" : "🎬 Preview courte (Studio)"}
                                    variant="outline"
                                    size="medium"
                                    onPress={handleShortPreview}
                                    disabled={shortPreviewLoading}
                                    style={styles.shortPreviewButton}
                                />
                                <Text style={styles.shortPreviewHint}>
                                    Génère une prévisualisation courte avant la génération finale
                                </Text>
                            </View>
                        )}
                    </>
                )}

                {/* Éditeur de timeline */}
                {isEditingTimeline && generatedTimeline && (
                    <NativeCard style={styles.sectionCard}>
                        <TimelineEditor
                            timeline={generatedTimeline}
                            onSave={(editedTimeline) => {
                                setGeneratedTimeline(editedTimeline);
                                setIsEditingTimeline(false);
                            }}
                            onCancel={() => setIsEditingTimeline(false)}
                        />
                    </NativeCard>
                )}

                {/* ✅ NOUVEAU: Auto-cut intelligent */}
                {generatedTimeline && !isEditingTimeline && generatedTimeline.scenes.length > 0 && (
                    <AutoCutPanel
                        videoUrl={generatedTimeline.scenes[0]?.media_url || ''}
                        videoId={undefined}
                        onScenesSelected={(scenes) => {
                            console.log('[ProductVideoCreationModal] Scènes sélectionnées:', scenes);
                            // Appliquer les scènes sélectionnées à la timeline
                            if (scenes.length > 0 && generatedTimeline) {
                                const updatedScenes = generatedTimeline.scenes.map((originalScene, idx) => {
                                    const matchingScene = scenes.find(s =>
                                        Math.abs(s.start_time - originalScene.start_time) < 0.5
                                    );
                                    if (matchingScene) {
                                        return {
                                            ...originalScene,
                                            start_time: matchingScene.start_time,
                                            duration: matchingScene.duration,
                                        };
                                    }
                                    return originalScene;
                                });
                                setGeneratedTimeline({
                                    ...generatedTimeline,
                                    scenes: updatedScenes,
                                    total_duration: scenes.reduce((sum, s) => sum + s.duration, 0),
                                });
                            }
                        }}
                    />
                )}

                {/* ✅ NOUVEAU: Color grading automatique */}
                {selectedMediaIds.size > 0 && Array.from(selectedMediaIds).length > 0 && (
                    <ColorGradingPanel
                        mediaUrl={Array.from(selectedMediaIds)[0]?.toString() || ''}
                        onGradingComplete={(gradedUrl) => {
                            console.log('[ProductVideoCreationModal] Color grading appliqué:', gradedUrl);
                        }}
                    />
                )}

                {/* ✅ NOUVEAU: Carousel de previews d'effets */}
                {styleSuggestion && styleSuggestion.effects && styleSuggestion.effects.length > 0 && selectedMediaIds.size > 0 && (
                    <EffectPreviewCarousel
                        effectNames={styleSuggestion.effects}
                        sampleMediaUrl={Array.from(selectedMediaIds)[0]?.toString() || ''}
                        onEffectSelected={(effectName, preview) => {
                            console.log('[ProductVideoCreationModal] Effet sélectionné:', effectName, preview.preview_url);
                            // Ajouter l'effet sélectionné
                            setSelectedEffects(prev => new Set(prev).add(effectName));
                        }}
                    />
                )}

                {/* ✅ NOUVEAU: Sous-titres automatiques */}
                {generatedTimeline && !isEditingTimeline && (
                    <AutoCaptionsPanel
                        videoUrl={generatedTimeline.scenes[0]?.media_url || ''}
                        lang={voiceoverLang || 'fr'}
                        onCaptionsGenerated={(subtitles, subtitleFileUrl) => {
                            console.log('[ProductVideoCreationModal] Sous-titres générés:', subtitles.length);
                        }}
                    />
                )}
            </>
        );
    };

    const renderStep5 = () => {
        // Étape 5 : Audio uniquement (musique + voiceover)
        if (!selectedProduct) {
            return (
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Sélectionnez d'abord un produit</Text>
                    <Text style={styles.sectionSubtitle}>
                        Retournez à l'étape 1 pour sélectionner un produit.
                    </Text>
                </NativeCard>
            );
        }

        return (
            <>
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>🎵 Ambiance musicale</Text>
                    <Text style={styles.sectionSubtitle}>
                        Choisissez une ambiance générée automatiquement ou importez votre propre piste.
                    </Text>
                    <View style={styles.styleRow}>
                        {MUSIC_MODE_OPTIONS.map((option) => {
                            const selected = musicMode === option.key;
                            return (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[
                                        styles.styleChip,
                                        selected && styles.styleChipSelected,
                                    ]}
                                    onPress={() => setMusicMode(option.key)}
                                >
                                    <Text
                                        style={[
                                            styles.styleChipLabel,
                                            selected && styles.styleChipLabelSelected,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    <Text style={styles.styleChipDescription} numberOfLines={1}>
                                        {option.description}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {musicMode !== 'none' && (
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Volume musique (0.10 - 0.60)</Text>
                            <NativeInput
                                value={musicVolume}
                                onChangeText={setMusicVolume}
                                keyboardType="decimal-pad"
                            />
                            <View style={styles.audioActionsRow}>
                                <TouchableOpacity
                                    style={styles.audioImportButton}
                                    onPress={handleImportAudioTrack}
                                    disabled={isUploadingAudio}
                                >
                                    {isUploadingAudio ? (
                                        <ActivityIndicator size="small" color={modernColors.primary} />
                                    ) : (
                                        <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                    )}
                                    <Text style={styles.audioImportText}>
                                        {isUploadingAudio ? 'Import en cours…' : "Importer une piste depuis l'appareil"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {availableAudioTracks.length > 0 && (
                                <>
                                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                                        Sélectionner une piste audio existante
                                    </Text>
                                    {/* ✅ NOUVEAU: Panel de suggestions audio contextuelles IA */}
                                    {selectedProduct && (
                                        <AudioSuggestionPanel
                                            productName={selectedProduct.name || 'Produit'}
                                            productType={selectedProduct.category}
                                            tone={'energetic'}
                                            channel={Array.from(selectedChannels)[0] || 'tiktok'}
                                            durationSeconds={Number.parseFloat(duration) || 30}
                                            onTrackSelected={(track) => {
                                                console.log('[ProductVideoCreationModal] Piste audio sélectionnée:', track.track_id);
                                                // TODO: Intégrer la piste sélectionnée
                                                setSelectedMusicTrackId(Number.parseInt(track.track_id) || null);
                                            }}
                                        />
                                    )}

                                    {/* ✅ CORRIGÉ: Affichage en 2 colonnes au lieu d'un scroll horizontal */}
                                    <View style={styles.audioRowGrid}>
                                        {availableAudioTracks.map((track) => {
                                            const selected = selectedMusicTrackId === track.id;
                                            return (
                                                <TouchableOpacity
                                                    key={`audio_${track.id}`}
                                                    style={[
                                                        styles.audioChipGrid,
                                                        selected && styles.audioChipSelected,
                                                    ]}
                                                    onPress={() => setSelectedMusicTrackId(selected ? null : track.id)}
                                                >
                                                    <SafeIcon
                                                        name={selected ? 'music' : 'headphones'}
                                                        size={16}
                                                        color={selected ? '#0EA5E9' : modernColors.primary}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.audioChipText,
                                                            selected && styles.audioChipTextSelected,
                                                        ]}
                                                        numberOfLines={2}
                                                    >
                                                        {track.ai_description || `Piste ${track.id}`}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </>
                            )}
                            {audioLibrary.length > 0 && (
                                <>
                                    <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                                        Bibliothèque audio Yukpo
                                    </Text>
                                    {loadingLibrary ? (
                                        <View style={styles.audioRowGrid}>
                                            <ActivityIndicator size="small" color={modernColors.primary} />
                                        </View>
                                    ) : (
                                        <View style={styles.audioRowGrid}>
                                            {audioLibrary.map((loop) => {
                                                const isAttaching = attachingLoopId === loop.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={loop.id}
                                                        style={[
                                                            styles.audioChipGrid,
                                                            isAttaching && styles.audioChipSelected,
                                                        ]}
                                                        onPress={() => handleAttachAudioLoop(loop.id)}
                                                        disabled={isAttaching}
                                                    >
                                                        {isAttaching ? (
                                                            <ActivityIndicator size="small" color={modernColors.primary} />
                                                        ) : (
                                                            <SafeIcon name="music" size={18} color={modernColors.primary} />
                                                        )}
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.audioChipText} numberOfLines={2}>
                                                                {loop.title}
                                                            </Text>
                                                            <Text style={styles.audioChipSubtitle} numberOfLines={1}>
                                                                {loop.genre} • {loop.bpm} BPM
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </NativeCard>

                <NativeCard style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>🎤 Narration vocale IA</Text>
                        <Switch
                            value={voiceoverEnabled}
                            onValueChange={(value) => {
                                setVoiceoverEnabled(value);
                                if (value && voiceoverScript.trim().length === 0) {
                                    const storyboardLines = scriptNotes
                                        .split(/\r?\n/)
                                        .map((line) => line.trim())
                                        .filter((line) => line.length > 0);
                                    setVoiceoverScript(
                                        buildDefaultVoiceover(
                                            normalizeProductName(selectedProduct),
                                            headline,
                                            callToAction,
                                            storyboardLines,
                                        ),
                                    );
                                }
                            }}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                    <Text style={styles.sectionSubtitle}>
                        Génère une voix off automatique. Vous pouvez ajuster le script avant synthèse.
                    </Text>
                    {voiceoverEnabled && (
                        <>
                            <View style={styles.voiceRow}>
                                {VOICE_LANG_OPTIONS.map((option) => {
                                    const selected = voiceoverLang === option.value;
                                    return (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.voiceChip,
                                                selected && styles.voiceChipSelected,
                                            ]}
                                            onPress={() => setVoiceoverLang(option.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.voiceChipText,
                                                    selected && styles.voiceChipTextSelected,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <NativeInput
                                value={voiceoverScript}
                                onChangeText={setVoiceoverScript}
                                placeholder="Texte de narration..."
                                multiline
                                minLines={3}
                            />
                        </>
                    )}
                </NativeCard>
            </>
        );
    };

    const renderStep6 = () => {
        // Étape 6 : Publication et distribution
        if (!selectedProduct) {
            return (
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Sélectionnez d'abord un produit</Text>
                    <Text style={styles.sectionSubtitle}>
                        Retournez à l'étape 1 pour sélectionner un produit.
                    </Text>
                </NativeCard>
            );
        }

        return (
            <>
                {/* ✅ ESSENTIEL: Options de publication principales */}
                <NativeCard style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>📤 Publication</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                        Choisissez où votre vidéo sera automatiquement publiée après sa génération.
                    </Text>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleText}>
                            <Text style={styles.toggleLabel}>Envoyer dans le Chat Commerce</Text>
                            <Text style={styles.toggleDescription}>
                                Permet à vos prospects de visionner la vidéo directement dans la conversation.
                            </Text>
                        </View>
                        <Switch
                            value={publishToChat}
                            onValueChange={setPublishToChat}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleText}>
                            <Text style={styles.toggleLabel}>Afficher sur la carte produit</Text>
                            <Text style={styles.toggleDescription}>
                                Ajoute la vidéo dans la galerie principale du produit (mobile & web).
                            </Text>
                        </View>
                        <Switch
                            value={publishToProductCard}
                            onValueChange={setPublishToProductCard}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                </NativeCard>

                {/* ✅ CORRIGÉ 2025-11-30: Prévisualisation de la timeline générée à l'étape 6 */}
                {!generatedTimeline && !isGeneratingTimeline && (
                    <NativeCard style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>🎬 Structure de la vidéo</Text>
                            <TouchableOpacity
                                style={styles.linkButton}
                                onPress={async () => {
                                    // Générer la timeline si elle n'existe pas
                                    if (!selectedProduct || !briefVariants.length || !styleSuggestion) {
                                        Alert.alert('Prérequis manquants', 'Générez d\'abord le brief et le style pour créer la timeline.');
                                        return;
                                    }
                                    setIsGeneratingTimeline(true);
                                    try {
                                        const availableMedia = [
                                            ...productMedia.map(m => ({
                                                id: m.id.toString(),
                                                url: m.path ? `${config.API_BASE_URL}/${m.path}` : undefined,
                                                media_type: (m.type || m.media_type || 'image') === 'image' ? 'image' : 'video',
                                            })),
                                            ...serviceMedia.map(m => ({
                                                id: m.id.toString(),
                                                url: m.path ? `${config.API_BASE_URL}/${m.path}` : undefined,
                                                media_type: (m.type || m.media_type || 'image') === 'image' ? 'image' : 'video',
                                            })),
                                        ];
                                        const selectedBrief = briefVariants[0];
                                        const timelineResponse = await mediaApi.generateVideoTimeline({
                                            brief: {
                                                script_outline: selectedBrief.script_outline || [],
                                                headline: selectedBrief.headline,
                                                call_to_action: selectedBrief.call_to_action,
                                            },
                                            style: {
                                                effects: styleSuggestion.effects || [],
                                                transitions: styleSuggestion.transitions || [],
                                                color_palette: styleSuggestion.color_palette || undefined,
                                            },
                                            available_media: availableMedia,
                                            duration_seconds: ensureNumber(duration, 28),
                                            voiceover_script: voiceoverEnabled ? voiceoverScript.trim() : undefined,
                                            music_track_id: selectedMusicTrackId ?? undefined,
                                            lang: subtitleLang || voiceoverLang || 'fr',
                                        });
                                        if (timelineResponse.success && timelineResponse.data) {
                                            const responseData = timelineResponse.data as { success?: boolean; timeline?: VideoTimelineType };
                                            if (responseData.timeline) {
                                                setGeneratedTimeline(responseData.timeline);
                                            }
                                        }
                                    } catch (error) {
                                        console.error('[ProductVideoCreationModal] Erreur génération timeline:', error);
                                        Alert.alert('Erreur', 'Impossible de générer la timeline. La vidéo sera créée avec le script texte.');
                                    } finally {
                                        setIsGeneratingTimeline(false);
                                    }
                                }}
                            >
                                {isGeneratingTimeline ? (
                                    <ActivityIndicator size="small" color={modernColors.primary} />
                                ) : (
                                    <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                                )}
                                <Text style={styles.linkButtonText}>
                                    {isGeneratingTimeline ? 'Génération…' : 'Générer la timeline'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            La timeline permet de visualiser la structure de votre vidéo avant la génération finale.
                        </Text>
                    </NativeCard>
                )}
                {generatedTimeline && !isEditingTimeline && (
                    <NativeCard style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>🎬 Structure de la vidéo</Text>
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            Visualisez la structure de votre vidéo avant la génération finale.
                        </Text>
                        <TimelinePreview
                            timeline={generatedTimeline}
                            onEdit={() => setIsEditingTimeline(true)}
                            onScenePress={(sceneIndex) => {
                                console.log('[ProductVideoCreationModal] Scène pressée:', sceneIndex);
                            }}
                        />
                    </NativeCard>
                )}

                {/* ✅ AJOUTÉ: Éditeur de timeline à l'étape 6 */}
                {isEditingTimeline && generatedTimeline && (
                    <NativeCard style={styles.sectionCard}>
                        <TimelineEditor
                            timeline={generatedTimeline}
                            onSave={(editedTimeline) => {
                                setGeneratedTimeline(editedTimeline);
                                setIsEditingTimeline(false);
                            }}
                            onCancel={() => setIsEditingTimeline(false)}
                        />
                    </NativeCard>
                )}

                {/* ✅ Distribution automatique avec plan IA */}
                <NativeCard style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Diffusion automatique</Text>
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={handleGenerateDistribution}
                            disabled={isGeneratingDistribution}
                        >
                            {isGeneratingDistribution ? (
                                <ActivityIndicator size="small" color={modernColors.primary} />
                            ) : (
                                <SafeIcon name="send" size={16} color={modernColors.primary} />
                            )}
                            <Text style={styles.linkButtonText}>
                                {isGeneratingDistribution ? 'Planification…' : 'Plan IA'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                        Contrôlez où la vidéo sera mise en avant immédiatement après sa génération.
                    </Text>
                    {distributionPlan && (
                        <View style={styles.planBox}>
                            {distributionPlan.summary && (
                                <Text style={styles.planSummary}>{distributionPlan.summary}</Text>
                            )}
                            {distributionPlan.hashtags?.length > 0 && (
                                <Text style={styles.planHashtags}>
                                    Hashtags : {Array.isArray(distributionPlan.hashtags) ? distributionPlan.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ') : ''}
                                </Text>
                            )}
                            {distributionPlan.schedule?.length > 0 && (
                                <View style={styles.planSchedule}>
                                    {Array.isArray(distributionPlan.schedule) ? distributionPlan.schedule.map((item, idx) => (
                                        <View key={`schedule_${idx}`} style={styles.planScheduleRow}>
                                            <Text style={styles.planScheduleChannel}>{item.channel}</Text>
                                            <Text style={styles.planScheduleTime}>{item.best_time}</Text>
                                            {item.call_to_action && (
                                                <Text style={styles.planScheduleCTA}>{item.call_to_action}</Text>
                                            )}
                                        </View>
                                    )) : null}
                                </View>
                            )}
                        </View>
                    )}
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleText}>
                            <Text style={styles.toggleLabel}>Envoyer dans le Chat Commerce</Text>
                            <Text style={styles.toggleDescription}>
                                Permet à vos prospects de visionner la vidéo directement dans la
                                conversation.
                            </Text>
                        </View>
                        <Switch
                            value={publishToChat}
                            onValueChange={setPublishToChat}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleText}>
                            <Text style={styles.toggleLabel}>Afficher sur la carte produit</Text>
                            <Text style={styles.toggleDescription}>
                                Ajoute la vidéo dans la galerie principale du produit (mobile & web).
                            </Text>
                        </View>
                        <Switch
                            value={publishToProductCard}
                            onValueChange={setPublishToProductCard}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                    <Text style={[styles.sectionSubtitle, { marginTop: 8 }]}>
                        Ciblez aussi des canaux externes à planifier (export automatique disponible) :
                    </Text>
                    <View style={styles.voiceRow}>
                        {DISTRIBUTION_OPTIONS.map((option) => {
                            const selected = selectedChannels.has(option.key);
                            return (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[
                                        styles.voiceChip,
                                        selected && styles.voiceChipSelected,
                                    ]}
                                    onPress={() =>
                                        setSelectedChannels((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(option.key)) {
                                                next.delete(option.key);
                                            } else {
                                                next.add(option.key);
                                            }
                                            return next;
                                        })
                                    }
                                >
                                    <Text
                                        style={[
                                            styles.voiceChipText,
                                            selected && styles.voiceChipTextSelected,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={styles.distributionHint}>
                        Les canaux externes seront exportés au format adapté (carré ou paysage) pour faciliter vos publications.
                    </Text>
                </NativeCard>

                {/* ✅ OPTIONNEL: Options avancées (pliable) */}
                <NativeCard style={styles.sectionCard}>
                    <TouchableOpacity
                        style={styles.advancedOptionsHeader}
                        onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.advancedOptionsTitleRow}>
                            <Text style={styles.sectionTitle}>⚙️ Options avancées</Text>
                            <View style={styles.optionalBadge}>
                                <Text style={styles.optionalBadgeText}>Optionnel</Text>
                            </View>
                        </View>
                        <SafeIcon
                            name={showAdvancedOptions ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={modernColors.textSecondary}
                        />
                    </TouchableOpacity>
                    {showAdvancedOptions && (
                        <View style={styles.advancedOptionsContent}>
                            {/* ✅ SUPPRIMÉ 2025-11-30: Estimation de coût retirée des options - Affichée dans un toast au clic sur "Générer la vidéo" */}

                            {/* Chaînage de vidéos */}
                            <View style={styles.advancedSection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.advancedSectionTitle}>🔗 Chaînage de vidéos</Text>
                                    <Switch
                                        value={showVideoChaining}
                                        onValueChange={setShowVideoChaining}
                                        trackColor={{ true: '#6366F1' }}
                                    />
                                </View>
                                {showVideoChaining && (
                                    <View style={styles.videoChainingContainer}>
                                        <Text style={styles.sectionSubtitle}>
                                            Liez cette vidéo à des vidéos précédentes pour créer une séquence.
                                        </Text>
                                        {availableSessions.length > 0 ? (
                                            <View style={styles.sessionsList}>
                                                {availableSessions.map((session) => {
                                                    const isSelected = selectedLinkedSessions.includes(session.id);
                                                    return (
                                                        <TouchableOpacity
                                                            key={session.id}
                                                            style={[
                                                                styles.sessionChip,
                                                                isSelected && styles.sessionChipSelected,
                                                            ]}
                                                            onPress={() => {
                                                                if (isSelected) {
                                                                    setSelectedLinkedSessions(
                                                                        selectedLinkedSessions.filter((id) => id !== session.id)
                                                                    );
                                                                } else {
                                                                    setSelectedLinkedSessions([
                                                                        ...selectedLinkedSessions,
                                                                        session.id,
                                                                    ]);
                                                                }
                                                            }}
                                                        >
                                                            <SafeIcon
                                                                name={isSelected ? 'check-circle' : 'circle'}
                                                                size={16}
                                                                color={isSelected ? '#10B981' : modernColors.primary}
                                                            />
                                                            <Text
                                                                style={[
                                                                    styles.sessionChipText,
                                                                    isSelected && styles.sessionChipTextSelected,
                                                                ]}
                                                                numberOfLines={1}
                                                            >
                                                                {session.title || `Session ${session.id.substring(0, 8)}`}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        ) : (
                                            <Text style={styles.emptyStateText}>
                                                Aucune session précédente disponible
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Formats de sortie */}
                            <View style={styles.advancedSection}>
                                <Text style={styles.advancedSectionTitle}>📐 Formats de sortie</Text>
                                <Text style={styles.sectionSubtitle}>
                                    Générer des variantes dans d'autres formats pour une diffusion multi-plateformes.
                                </Text>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleText}>
                                        <Text style={styles.toggleLabel}>Format carré (1080x1080)</Text>
                                        <Text style={styles.toggleDescription}>
                                            Idéal pour Instagram, WhatsApp et fiches produits.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={generateSquareVariant}
                                        onValueChange={setGenerateSquareVariant}
                                        trackColor={{ true: '#6366F1' }}
                                    />
                                </View>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleText}>
                                        <Text style={styles.toggleLabel}>Format paysage (1920x1080)</Text>
                                        <Text style={styles.toggleDescription}>
                                            Parfait pour écrans larges et présentations.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={generateLandscapeVariant}
                                        onValueChange={setGenerateLandscapeVariant}
                                        trackColor={{ true: '#6366F1' }}
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                </NativeCard>

                {/* Informations à intégrer automatiquement */}
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>ℹ️ Informations automatiques</Text>
                    <Text style={styles.sectionSubtitle}>
                        Choisissez quelles informations du produit seront intégrées automatiquement dans la vidéo.
                    </Text>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleText}>
                            <Text style={styles.toggleLabel}>Prix & devise</Text>
                            <Text style={styles.toggleDescription}>
                                Affiche automatiquement le prix actuel du produit.
                            </Text>
                        </View>
                        <Switch
                            value={includePrice}
                            onValueChange={setIncludePrice}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleText}>
                            <Text style={styles.toggleLabel}>Promotions actives</Text>
                            <Text style={styles.toggleDescription}>
                                Ajoute badges et messages promo détectés dans votre fiche produit.
                            </Text>
                        </View>
                        <Switch
                            value={includePromotion}
                            onValueChange={setIncludePromotion}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleText}>
                            <Text style={styles.toggleLabel}>Coordonnées & CTA</Text>
                            <Text style={styles.toggleDescription}>
                                Ajoute votre CTA + boutons vers le chat Yukpomnang.
                            </Text>
                        </View>
                        <Switch
                            value={includeContact}
                            onValueChange={setIncludeContact}
                            trackColor={{ true: '#6366F1' }}
                        />
                    </View>
                </NativeCard>

                {/* ✅ NOUVEAU: Synchronisation audio-vidéo */}
                {musicMode !== 'none' && generatedTimeline && generatedTimeline.scenes.length > 0 && (
                    <AudioSyncPanel
                        videoUrl={generatedTimeline.scenes[0]?.media_url || ''}
                        musicTrackId={selectedMusicTrackId || undefined}
                        videoTransitions={generatedTimeline.scenes.map((s) => s.start_time)}
                        onSyncComplete={(syncedAudioUrl, beats) => {
                            console.log('[ProductVideoCreationModal] Audio synchronisé:', syncedAudioUrl, beats.length);
                            // Mettre à jour la timeline avec les points de synchronisation
                            if (generatedTimeline && beats.length > 0) {
                                const updatedScenes = generatedTimeline.scenes.map((scene, idx) => {
                                    // Trouver le beat le plus proche pour cette scène
                                    const closestBeat = beats.reduce((closest, beat) => {
                                        const sceneDist = Math.abs(beat.time - scene.start_time);
                                        const closestDist = Math.abs(closest.time - scene.start_time);
                                        return sceneDist < closestDist ? beat : closest;
                                    }, beats[0]);

                                    // Ajuster le timing de la scène pour s'aligner sur le beat
                                    if (Math.abs(closestBeat.time - scene.start_time) < 0.5) {
                                        return {
                                            ...scene,
                                            start_time: closestBeat.time,
                                            audio_cue: closestBeat.time,
                                        };
                                    }
                                    return scene;
                                });

                                setGeneratedTimeline({
                                    ...generatedTimeline,
                                    scenes: updatedScenes,
                                });
                            }
                        }}
                    />
                )}
            </>
        );
    };

    // ✅ NOUVEAU: Fonction pour rendre le contenu de l'étape active
    const renderStepContent = () => {
        switch (activeStep) {
            case 1:
                return renderStep1();
            case 2:
                return renderStep2();
            case 3:
                return renderStep3();
            case 4:
                return renderStep4();
            case 5:
                return renderStep5();
            case 6:
                return renderStep6();
            default:
                return renderStep1();
        }
    };

    // ✅ NOUVEAU: Fonction pour gérer la navigation entre les étapes
    const handleStepChange = (newStep: ModalStep) => {
        // Validation basique : on ne peut pas avancer si aucun produit n'est sélectionné (sauf étape 1)
        if (newStep > 1 && !selectedProduct) {
            Alert.alert(
                'Produit requis',
                'Veuillez d\'abord sélectionner un produit à l\'étape 1.',
                [{ text: 'OK' }]
            );
            return;
        }
        setActiveStep(newStep);
    };

    // ✅ CORRECTION: Remettre le scroll au début lors du changement d'étape
    useEffect(() => {
        if (mainScrollViewRef.current) {
            // Utiliser un petit délai pour s'assurer que le ScrollView est rendu
            setTimeout(() => {
                mainScrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }, 100);
        }
    }, [activeStep]);

    // ✅ CORRIGÉ: Fonction wrapper pour applyBriefVariant avec les setters du composant
    // ✅ CORRIGÉ 2025-11-28: Retiré les setters des dépendances car ils sont stables
    const handleApplyBriefVariant = useCallback((variant: AIVideoBriefVariant) => {
        applyBriefVariant(
            variant,
            setHeadline,
            setCallToAction,
            setScriptNotes,
            setVoiceoverScript,
            setVariantPickerVisible
        );
    }, []); // Setters useState sont stables, pas besoin de dépendances

    const coachPanel = useMemo(() => {
        if (!selectedProduct) {
            return null;
        }
        const hasInsights = briefVariants.length > 0 || styleSuggestion || distributionPlan;
        if (!hasInsights && !coachLoading) {
            return null;
        }

        const topVariant = briefVariants[0];
        const scriptPreview =
            topVariant?.headline ||
            topVariant?.script_outline?.[0] ||
            topVariant?.call_to_action ||
            '';
        // ✅ CORRIGÉ: Vérifier que hashtags est un tableau avant d'appeler .slice() et .map()
        const limitedHashtags =
            (Array.isArray(distributionPlan?.hashtags)
                ? distributionPlan.hashtags.slice(0, 3).map((tag) => `#${String(tag || '').replace(/^#/, '')}`)
                : []) || [];
        const nextSchedule = distributionPlan?.schedule?.[0];

        return (
            <NativeCard style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Coach IA Yukpo</Text>
                    <TouchableOpacity style={styles.linkButton} onPress={handleRefreshCoach}>
                        {coachLoading ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : (
                            <SafeIcon name="refresh-cw" size={16} color={modernColors.primary} />
                        )}
                        <Text style={styles.linkButtonText}>
                            {coachLoading ? 'Analyse…' : 'Actualiser'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {coachLoading && !hasInsights ? (
                    <View style={styles.coachLoading}>
                        <ActivityIndicator size="small" color={modernColors.primary} />
                        <Text style={styles.coachLoadingText}>
                            Le coach prépare vos recommandations personnalisées…
                        </Text>
                    </View>
                ) : (
                    <>
                        {topVariant && (
                            <View style={styles.coachRow}>
                                <SafeIcon
                                    name="align-left"
                                    size={18}
                                    color={modernColors.primary}
                                />
                                <View style={styles.coachContent}>
                                    <Text style={styles.coachLabel}>Script IA</Text>
                                    {scriptPreview ? (
                                        <Text style={styles.coachText} numberOfLines={2}>
                                            {scriptPreview}
                                        </Text>
                                    ) : null}
                                    <TouchableOpacity
                                        style={styles.coachAction}
                                        onPress={() => setVariantPickerVisible(true)}
                                    >
                                        <SafeIcon name="sparkles" size={14} color={modernColors.primary} />
                                        <Text style={styles.coachActionText}>
                                            Voir les {briefVariants.length} variantes
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {styleSuggestion && (
                            <View style={styles.coachRow}>
                                <SafeIcon
                                    name="film"
                                    size={18}
                                    color={modernColors.primary}
                                />
                                <View style={styles.coachContent}>
                                    <Text style={styles.coachLabel}>Effets recommandés</Text>
                                    {Array.isArray(styleSuggestion.effects) && styleSuggestion.effects.length > 0 ? (
                                        <Text style={styles.coachText} numberOfLines={2}>
                                            Effets : {styleSuggestion.effects.slice(0, 3).join(', ')}
                                        </Text>
                                    ) : null}
                                    {Array.isArray(styleSuggestion.transitions) && styleSuggestion.transitions.length > 0 ? (
                                        <Text style={styles.coachMeta}>
                                            Transitions : {styleSuggestion.transitions.slice(0, 2).join(', ')}
                                        </Text>
                                    ) : null}
                                    <TouchableOpacity
                                        style={styles.coachAction}
                                        onPress={() => applyStyleSuggestion(styleSuggestion)}
                                    >
                                        <SafeIcon name="plus-circle" size={14} color={modernColors.primary} />
                                        <Text style={styles.coachActionText}>Appliquer les effets</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {distributionPlan && (
                            <View style={styles.coachRow}>
                                <SafeIcon
                                    name="send"
                                    size={18}
                                    color={modernColors.primary}
                                />
                                <View style={styles.coachContent}>
                                    <Text style={styles.coachLabel}>Plan de diffusion</Text>
                                    {distributionPlan.summary ? (
                                        <Text style={styles.coachText} numberOfLines={2}>
                                            {distributionPlan.summary}
                                        </Text>
                                    ) : null}
                                    {limitedHashtags.length > 0 ? (
                                        <Text style={styles.coachMeta}>
                                            Hashtags : {limitedHashtags.join(' ')}
                                        </Text>
                                    ) : null}
                                    {nextSchedule ? (
                                        <Text style={styles.coachMeta}>
                                            Prochaine diffusion : {nextSchedule.channel} • {nextSchedule.best_time}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        )}
                    </>
                )}
            </NativeCard>
        );
    }, [
        applyStyleSuggestion,
        briefVariants,
        coachLoading,
        distributionPlan,
        handleRefreshCoach,
        selectedProduct,
        // ✅ CORRIGÉ: setVariantPickerVisible retiré des dépendances car c'est un setter useState stable
        styleSuggestion,
    ]);

    const handleSubmit = async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', "Sélectionnez d'abord le produit principal à mettre en avant.");
            return;
        }

        if (typeof selectedProduct.product_index !== 'number') {
            Alert.alert('Produit incomplet', "Ce produit ne possède pas d'index. Rechargez la page et réessayez.");
            return;
        }

        if (!headline.trim()) {
            Alert.alert('Titre manquant', 'Ajoutez un titre accrocheur pour votre vidéo.');
            return;
        }

        // ✅ NOUVEAU: Vérifier que le script est rempli
        if (!scriptNotes.trim()) {
            Alert.alert(
                'Script requis',
                'Le script de montage vidéo est requis. Décrivez les messages clés, avantages, garanties, etc. Une ligne = une scène.'
            );
            return;
        }

        const durationSeconds = ensureNumber(duration, 28);
        if (durationSeconds < 10 || durationSeconds > 90) {
            Alert.alert('Durée invalide', 'Choisissez une durée comprise entre 10 et 90 secondes.');
            return;
        }

        if (voiceoverEnabled) {
            if (voiceoverScript.trim().length < 10) {
                Alert.alert('Narration insuffisante', 'Le texte de la voix off doit contenir au moins 10 caractères.');
                return;
            }
        }

        const parsedMusicVolume = Number.parseFloat(musicVolume);
        const safeMusicVolume = Number.isFinite(parsedMusicVolume)
            ? Math.min(Math.max(parsedMusicVolume, 0.05), 0.7)
            : 0.28;

        // ✅ NOUVEAU 2025-11-30: Estimer le coût et afficher dans un toast avant de générer
        try {
            setCostLoading(true);
            const serviceId = selectedProduct.serviceId;
            if (!serviceId) {
                Alert.alert('Service invalide', 'Impossible d\'estimer le coût.');
                return;
            }

            const payloadForEstimation: VideoGenerationPayload = {
                style: stylePreset,
                duration_seconds: durationSeconds,
                headline: headline.trim(),
                call_to_action: callToAction.trim(),
                include_price: includePrice,
                include_promotion: includePromotion,
                include_contact: includeContact,
                selected_media_ids: Array.from(selectedMediaIds.values()),
                related_product_indices: Array.from(selectedRelatedProducts.values()),
                use_product_gallery: useProductGallery,
                use_service_mediatech: useMediatechLibrary,
                include_publicite_assets: includePubliciteAssets,
                publish_to_chat: publishToChat,
                publish_to_product_card: publishToProductCard,
                timeline: generatedTimeline ? {
                    total_duration: generatedTimeline.total_duration,
                    scenes: generatedTimeline.scenes.map(s => ({
                        scene_index: s.scene_index,
                        start_time: s.start_time,
                        duration: s.duration,
                        media_id: s.media_id,
                        media_url: s.media_url,
                        text: s.text,
                        text_position: s.text_position,
                        transition: s.transition,
                        effects: s.effects,
                        audio_cue: s.audio_cue,
                    }))
                } : undefined,
                auto_storyboard: autoStoryboard,
                storyboard: generatedTimeline
                    ? undefined
                    : scriptNotes
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0),
                music_mode: musicMode,
                music_volume: musicMode === 'none' ? undefined : safeMusicVolume,
                music_track_id: selectedMusicTrackId ?? undefined,
                voiceover_script: voiceoverEnabled ? voiceoverScript.trim() : undefined,
                voiceover_lang: voiceoverEnabled ? voiceoverLang : undefined,
                voiceover_voice: voiceoverEnabled ? voiceoverLang : undefined,
                subtitle_lang: subtitleLang,
                generate_square_variant: generateSquareVariant,
                generate_landscape_variant: generateLandscapeVariant,
                distribute_channels: Array.from(selectedChannels.values()),
                style_effects: selectedEffects.size > 0 ? Array.from(selectedEffects) : undefined,
                style_transitions: selectedTransitions.size > 0 ? Array.from(selectedTransitions) : undefined,
                style_overlay_tips: selectedOverlayTips.size > 0 ? Array.from(selectedOverlayTips) : undefined,
                style_color_palette: colorPalette.trim().length > 0 ? colorPalette.trim() : undefined,
                style_music_hint: styleMusicHint.trim().length > 0 ? styleMusicHint.trim() : undefined,
                // ✅ NOTE: linked_session_ids retiré car non supporté dans VideoGenerationPayload
            };

            const response = await iaApi.estimateVideoCost(serviceId, selectedProduct.product_index, payloadForEstimation);
            const estimationResponse = response.data as VideoCostEstimateResponse | VideoCostEstimation | undefined;
            const estimation =
                estimationResponse && 'data' in estimationResponse
                    ? estimationResponse.data
                    : (estimationResponse as VideoCostEstimation | undefined);

            setCostLoading(false);

            if (!estimation) {
                Alert.alert('Estimation impossible', 'Impossible d\'estimer le coût pour le moment. Réessayez plus tard.');
                return;
            }

            // Construire le message d'estimation
            const totalCost = estimation.total_cost_fcfa || estimation.required_fcfa || 0;
            const currentBalance = estimation.current_balance_fcfa || 0;
            const isAffordable = estimation.affordable !== false;

            let costMessage = `💰 Estimation du coût de génération\n\n`;
            costMessage += `Coût total : ${totalCost.toLocaleString('fr-FR')} FCFA\n`;
            if (estimation.breakdown) {
                costMessage += `\nDétail :\n`;
                costMessage += `• Tokens IA : ${estimation.breakdown.tokens_cost_usd.toFixed(2)} USD\n`;
                if (estimation.breakdown.audio_mastering_usd > 0) {
                    costMessage += `• Mastering audio : ${estimation.breakdown.audio_mastering_usd.toFixed(2)} USD\n`;
                }
                if (estimation.breakdown.broll_generation_usd > 0) {
                    costMessage += `• Génération B-roll : ${estimation.breakdown.broll_generation_usd.toFixed(2)} USD\n`;
                }
            }
            costMessage += `\nSolde actuel : ${currentBalance.toLocaleString('fr-FR')} FCFA\n`;

            if (!isAffordable) {
                costMessage += `\n⚠️ Solde insuffisant !`;
            }

            // Afficher l'Alert avec confirmation
            Alert.alert(
                'Estimation du coût',
                costMessage,
                [
                    {
                        text: 'Annuler',
                        style: 'cancel',
                    },
                    {
                        text: isAffordable ? 'Confirmer et générer' : 'Recharger des tokens',
                        onPress: async () => {
                            if (!isAffordable) {
                                // Rediriger vers la page de recharge
                                Alert.alert('Solde insuffisant', 'Veuillez recharger vos tokens avant de générer la vidéo.');
                                return;
                            }
                            // Continuer avec la génération
                            await proceedWithVideoGeneration(payloadForEstimation);
                        },
                    },
                ],
                { cancelable: true }
            );
        } catch (error: any) {
            setCostLoading(false);
            console.error('[ProductVideoCreationModal] Erreur estimation coût:', error);
            const message = error?.message || 'Erreur lors de l\'estimation du coût';
            Alert.alert('Erreur d\'estimation', message);
        }
    };

    // ✅ CORRIGÉ 2025-12-12: Fonction séparée pour la génération effective de la vidéo avec polling du job
    const proceedWithVideoGeneration = async (payload: VideoGenerationPayload) => {
        if (!selectedProduct) {
            return;
        }

        setIsSubmitting(true);

        try {
            // ✅ ÉTAPE 1: Lancer la génération (retourne job_id)
            const response = await mediaApi.generateProductVideo(
                selectedProduct.serviceId,
                selectedProduct.product_index,
                payload
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Génération impossible');
            }

            // ✅ ÉTAPE 2: Récupérer le job_id de la réponse
            const jobData = response.data as { job_id?: string; status?: string };
            const jobId = jobData.job_id || (response.data as any)?.job_id;

            if (!jobId) {
                // Fallback: Si pas de job_id, peut-être que c'est une réponse synchrone (ancienne version)
                if ((response.data as any)?.video_url || (response.data as any)?.media_id) {
                    const result = response.data as GeneratedVideoResponse;
                    await onSuccess(result);
                    return;
                }
                throw new Error('Aucun job_id reçu du serveur');
            }

            console.log('[ProductVideoCreationModal] ✅ Job lancé avec job_id:', jobId);

            // ✅ NOUVEAU: Afficher le modal de progression
            setCurrentJobId(jobId);
            setCurrentJobStatus('running');
            setShowProgressModal(true);
            setCurrentProgressSteps([]);
            setCurrentStepNumber(0);

            // ✅ ÉTAPE 3: Poller le statut du job jusqu'à ce qu'il soit terminé
            const pollJobStatus = async (): Promise<GeneratedVideoResponse> => {
                const maxAttempts = 240; // ✅ AUGMENTÉ: 4 minutes max (1 seconde par tentative) pour correspondre au timeout backend de 2h
                let attempts = 0;

                while (attempts < maxAttempts) {
                    try {
                        const statusResponse = await mediaApi.getVideoJobStatus(jobId);
                        
                        if (!statusResponse.success || !statusResponse.data) {
                            throw new Error(statusResponse.error || 'Impossible de récupérer le statut');
                        }

                        const jobStatus = statusResponse.data;
                        console.log('[ProductVideoCreationModal] Job status:', jobStatus.status, `(${attempts}/${maxAttempts})`);

                        // ✅ NOUVEAU: Mettre à jour le modal de progression
                        setCurrentJobStatus(jobStatus.status as 'pending' | 'running' | 'completed' | 'failed');
                        
                        // Extraire les progress_steps depuis le jobStatus
                        if (jobStatus.progress_steps && Array.isArray(jobStatus.progress_steps)) {
                            const steps = jobStatus.progress_steps.map((step: any) => ({
                                key: step.key || '',
                                label: step.label || '',
                                status: step.status || 'pending',
                                detail: step.detail || undefined,
                            }));
                            setCurrentProgressSteps(steps);
                            
                            // ✅ CORRIGÉ: Calculer le numéro d'étape actuel basé sur les étapes complétées
                            const completedSteps = steps.filter((s: any) => s.status === 'completed').length;
                            const runningSteps = steps.filter((s: any) => s.status === 'running').length;
                            // Le numéro d'étape = étapes complétées + 1 si une étape est en cours
                            const currentStep = completedSteps + (runningSteps > 0 ? 1 : 0);
                            const totalSteps = 120; // Nombre total d'étapes
                            setCurrentStepNumber(Math.min(Math.max(currentStep, 0), totalSteps));
                            
                            console.log(`[ProductVideoCreationModal] 📊 Progression: ${currentStep}/${totalSteps} (${completedSteps} complétées, ${runningSteps} en cours)`);
                        } else if (jobStatus.progress_steps && typeof jobStatus.progress_steps === 'object') {
                            // Si progress_steps est un objet, essayer de le convertir
                            try {
                                const stepsArray = Object.values(jobStatus.progress_steps) as any[];
                                if (Array.isArray(stepsArray)) {
                                    const steps = stepsArray.map((step: any) => ({
                                        key: step.key || '',
                                        label: step.label || '',
                                        status: step.status || 'pending',
                                        detail: step.detail || undefined,
                                    }));
                                    setCurrentProgressSteps(steps);
                                    
                                    const completedSteps = steps.filter((s: any) => s.status === 'completed').length;
                                    const runningSteps = steps.filter((s: any) => s.status === 'running').length;
                                    const currentStep = completedSteps + (runningSteps > 0 ? 1 : 0);
                                    setCurrentStepNumber(Math.min(Math.max(currentStep, 0), 120));
                                }
                            } catch (e) {
                                console.warn('[ProductVideoCreationModal] Erreur parsing progress_steps:', e);
                            }
                        } else {
                            // ✅ FALLBACK: Si pas de progress_steps, estimer depuis le statut
                            if (jobStatus.status === 'running') {
                                // Estimer la progression basée sur le temps écoulé (approximation)
                                const estimatedProgress = Math.min(attempts * 0.5, 118); // Max 118 jusqu'à ce que les étapes finales soient ajoutées
                                setCurrentStepNumber(Math.round(estimatedProgress));
                            }
                        }

                        if (jobStatus.status === 'completed') {
                            // ✅ Job terminé avec succès
                            if (jobStatus.result_payload) {
                                const result = jobStatus.result_payload as GeneratedVideoResponse;
                                return result;
                            } else if (jobStatus.result_media_id) {
                                // Fallback: Construire la réponse à partir du media_id
                                return {
                                    success: true,
                                    media_id: jobStatus.result_media_id,
                                    service_id: selectedProduct.serviceId,
                                    product_index: selectedProduct.product_index,
                                    video_url: '', // Sera rempli plus tard
                                    path: '',
                                    duration_seconds: 0,
                                    used_media_ids: [],
                                    script_outline: [],
                                    voiceover_generated: false,
                                    additional_outputs: [],
                                    quality_score: 0,
                                    job_id: jobId,
                                } as GeneratedVideoResponse;
                            } else {
                                throw new Error('Job terminé mais aucun résultat disponible');
                            }
                        } else if (jobStatus.status === 'failed') {
                            // ✅ Job échoué
                            const errorMsg = jobStatus.error_message || 'La génération de la vidéo a échoué';
                            setCurrentJobStatus('failed');
                            setCurrentErrorMessage(errorMsg);
                            // Le modal restera ouvert pour afficher l'erreur
                            throw new Error(errorMsg);
                        } else if (jobStatus.status === 'running' || jobStatus.status === 'pending') {
                            // ✅ Job encore en cours, continuer le polling
                            attempts++;
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde
                            continue;
                        } else {
                            // Statut inconnu
                            attempts++;
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                    } catch (error: any) {
                        // Erreur de polling, mais continuer jusqu'à maxAttempts
                        console.warn('[ProductVideoCreationModal] Erreur polling job:', error);
                        attempts++;
                        if (attempts >= maxAttempts) {
                            throw new Error('Timeout: La génération prend trop de temps. Vérifiez vos vidéos dans quelques instants.');
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2 secondes avant retry
                    }
                }

                throw new Error('Timeout: La génération prend trop de temps. Vérifiez vos vidéos dans quelques instants.');
            };

            // Lancer le polling
            const result = await pollJobStatus();
            
            // ✅ NOUVEAU: Marquer comme complété dans le modal
            setCurrentJobStatus('completed');
            
            // Attendre un peu pour que l'utilisateur voie le succès
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Fermer le modal et appeler onSuccess
            setShowProgressModal(false);
            await onSuccess(result);

        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur génération vidéo:', error);

            // ✅ NOUVEAU: Mettre à jour le modal avec l'erreur
            setCurrentJobStatus('failed');
            
            // ✅ CORRECTION: Améliorer les messages d'erreur avec des détails spécifiques
            let errorMessage = 'Nous ne parvenons pas à générer la vidéo.';

            if (error?.message) {
                const msg = error.message.toLowerCase();
                if (msg.includes('aucune image') || msg.includes('image trouvée')) {
                    errorMessage = 'Aucune image disponible pour générer la vidéo.\n\n' +
                        'Solutions :\n' +
                        '• Ajoutez des images dans la médiathèque du service\n' +
                        '• Ajoutez des images au produit\n' +
                        '• La génération automatique d\'images IA sera activée lors de la prochaine tentative';
                } else if (msg.includes('timeout') || msg.includes('trop de temps')) {
                    errorMessage = error.message; // Message déjà bien formulé
                } else if (msg.includes('400') || msg.includes('bad request')) {
                    errorMessage = 'Demande invalide.\n\n' +
                        'Vérifiez que tous les champs sont correctement remplis et réessayez.';
                } else if (msg.includes('500') || msg.includes('internal')) {
                    errorMessage = 'Erreur serveur temporaire.\n\n' +
                        'Veuillez réessayer dans quelques instants. Si le problème persiste, contactez le support.';
                } else {
                    errorMessage = error.message;
                }
            }

            // ✅ NOUVEAU: Mettre à jour le message d'erreur dans le modal
            setCurrentErrorMessage(errorMessage);
            
            // Le modal affichera l'erreur et l'utilisateur pourra le fermer manuellement
            // Ne pas afficher d'Alert supplémentaire car le modal gère déjà l'affichage de l'erreur
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderProductSelection = () => {
        if (selectedProduct) {
            const imagePreview = (selectedProduct.images && selectedProduct.images[0]) || null;

            return (
                <NativeCard style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Produit principal</Text>
                        <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.linkButton}>
                            <SafeIcon name="refresh-ccw" size={16} color={modernColors.primary} />
                            <Text style={styles.linkButtonText}>Changer</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.selectedProductContainer}>
                        {imagePreview ? (
                            <Image source={{ uri: imagePreview }} style={styles.selectedProductImage} />
                        ) : (
                            <View style={styles.selectedProductPlaceholder}>
                                <SafeIcon name="image" size={28} color={modernColors.primary} />
                            </View>
                        )}
                        <View style={styles.selectedProductInfo}>
                            <Text style={styles.selectedProductName} numberOfLines={2}>
                                {normalizeProductName(selectedProduct)}
                            </Text>
                            <Text style={styles.selectedProductService} numberOfLines={1}>
                                {extractServiceName(selectedProduct, 'Service')}
                            </Text>
                            {(() => {
                                const prix = getFieldValue(selectedProduct.prix);
                                const devise = getFieldValue(selectedProduct.devise) || 'XAF';
                                return prix ? (
                                    <Text style={styles.selectedProductPrice}>
                                        {prix} {devise}
                                    </Text>
                                ) : null;
                            })()}
                        </View>
                    </View>
                </NativeCard>
            );
        }

        // ✅ Vérifier si des produits sont disponibles
        if (!groupedProducts || groupedProducts.length === 0) {
            return (
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Sélectionnez le produit à mettre en avant</Text>
                    <Text style={styles.sectionSubtitle}>
                        Aucun produit disponible. Créez d'abord un produit dans vos services.
                    </Text>
                </NativeCard>
            );
        }

        return (
            <NativeCard style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Sélectionnez le produit à mettre en avant</Text>
                <Text style={styles.sectionSubtitle}>
                    Choisissez un service puis un produit pour lancer la création automatique de votre vidéo verticale.
                </Text>
                {/* ✅ CORRECTION: Utiliser ScrollView pour permettre le scroll vertical de tous les produits */}
                <ScrollView 
                    style={styles.productSelectionList}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.productSelectionListContent}
                >
                    {Array.isArray(groupedProducts) && groupedProducts.length > 0 ? (
                        groupedProducts.map((group) => {
                            // ✅ CORRIGÉ: Vérifier que group et group.items sont définis
                            if (!group || !Array.isArray(group.items)) {
                                return null;
                            }

                            return (
                                <View key={group.serviceId || 'unknown'} style={styles.productGroup}>
                                    <Text style={styles.productGroupTitle}>
                                        {extractServiceName(group, 'Service sans nom')}
                                    </Text>
                                    {group.items.map((product, idx) => {
                                        // ✅ CORRIGÉ: Vérifier que product est défini
                                        if (!product) return null;

                                        return (
                                            <TouchableOpacity
                                                key={`${group.serviceId}_${product.product_index ?? product.id ?? idx}`}
                                                style={styles.productSelectItem}
                                                onPress={() => {
                                                    console.log('[ProductVideoCreationModal] Produit sélectionné:', product);

                                                    // ✅ CORRIGÉ: Vérifier que le produit est valide
                                                    if (!product) {
                                                        console.error('[ProductVideoCreationModal] Produit null/undefined');
                                                        return;
                                                    }

                                                    // ✅ CORRIGÉ: Normaliser le produit en extrayant les valeurs des wrappers
                                                    const normalizedProduct: ManagedProduct = {
                                                        ...product,
                                                        nom: getFieldValue(product.nom) ||
                                                            getFieldValue((product as any).nom_produit) ||
                                                            'Produit sans nom',
                                                        nom_produit: getFieldValue((product as any).nom_produit) ||
                                                            getFieldValue(product.nom) ||
                                                            'Produit sans nom',
                                                        // Normaliser aussi les autres champs qui pourraient avoir des wrappers
                                                        prix: getFieldValue(product.prix),
                                                        devise: getFieldValue(product.devise),
                                                        description: getFieldValue(product.description),
                                                    };

                                                    setSelectedProduct(normalizedProduct);
                                                    console.log('[ProductVideoCreationModal] Produit normalisé:', normalizedProduct);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.productSelectIcon}>
                                                    <SafeIcon name="package" size={18} color={modernColors.primary} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.productSelectName} numberOfLines={2}>
                                                        {normalizeProductName(product)}
                                                    </Text>
                                                    <Text style={styles.productSelectMeta} numberOfLines={1}>
                                                        {getFieldValue(product.type) || 'produit'}
                                                        {(() => {
                                                            const prix = getFieldValue(product.prix);
                                                            const devise = getFieldValue(product.devise) || 'XAF';
                                                            return prix ? ` • ${prix} ${devise}` : '';
                                                        })()}
                                                    </Text>
                                                </View>
                                                <SafeIcon name="chevron-right" size={18} color={modernColors.textSecondary} />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>Aucun produit disponible</Text>
                        </View>
                    )}
                </ScrollView>
            </NativeCard>
        );
    };

    const renderRelatedProducts = () => {
        if (!selectedProduct || productsSameService.length === 0) {
            return null;
        }

        return (
            <NativeCard style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Associer d'autres produits</Text>
                <Text style={styles.sectionSubtitle}>
                    Ajoutez des produits complémentaires pour générer des tags et liens cliquables directement depuis la
                    vidéo.
                </Text>
                <View style={styles.relatedProductsContainer}>
                    {Array.isArray(productsSameService) && productsSameService.length > 0 ? (
                        productsSameService.map((product) => {
                            const index = typeof product.product_index === 'number' ? product.product_index : undefined;
                            const selected = index !== undefined && selectedRelatedProducts.has(index);
                            return (
                                <TouchableOpacity
                                    key={`related_${product.id}_${product.product_index}`}
                                    style={[
                                        styles.relatedProductChip,
                                        selected && styles.relatedProductChipSelected,
                                    ]}
                                    onPress={() => toggleRelatedProduct(index)}
                                >
                                    <SafeIcon
                                        name={selected ? 'check-circle' : 'circle'}
                                        size={16}
                                        color={selected ? '#10B981' : modernColors.primary}
                                    />
                                    <Text
                                        style={[
                                            styles.relatedProductText,
                                            selected && styles.relatedProductTextSelected,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {normalizeProductName(product)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <Text style={styles.emptyStateText}>Aucun produit complémentaire disponible</Text>
                    )}
                </View>
            </NativeCard>
        );
    };

    const renderMediaGrid = (
        items: MediaLibraryItem[],
        title: string,
        emptyMessage: string,
        accentColor: string,
    ) => (
        <View style={styles.mediaSection}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <View style={[styles.mediaBadge, { backgroundColor: accentColor }]}>
                    <Text style={styles.mediaBadgeText}>{items.length}</Text>
                </View>
            </View>
            {mediaLoading ? (
                <View style={styles.mediaLoading}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                    <Text style={styles.mediaLoadingText}>Récupération de vos médias…</Text>
                </View>
            ) : items.length === 0 ? (
                <View style={styles.emptyMediaState}>
                    <SafeIcon name="image-off" size={24} color={modernColors.textSecondary} />
                    <Text style={styles.emptyMediaText}>{emptyMessage}</Text>
                </View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaList}>
                    {items.map((item) => {
                        const uri = buildMediaUrl(item.path);
                        const isSelected = selectedMediaIds.has(item.id);
                        const iconName =
                            (item.type || item.media_type)?.toLowerCase().includes('video') ? 'video' : 'image';

                        return (
                            <TouchableOpacity
                                key={`media_${item.id}`}
                                style={[styles.mediaItem, isSelected && styles.mediaItemSelected]}
                                onPress={() => toggleMediaSelection(item.id)}
                                activeOpacity={0.85}
                            >
                                {uri ? (
                                    <Image source={{ uri }} style={styles.mediaThumbnail} resizeMode="cover" />
                                ) : (
                                    <View style={styles.mediaThumbnailFallback}>
                                        <SafeIcon name={iconName as any} size={28} color={modernColors.primary} />
                                    </View>
                                )}
                                <View style={styles.mediaOverlay}>
                                    <SafeIcon name={iconName as any} size={14} color="#FFFFFF" />
                                    {item.ai_description ? (
                                        <Text style={styles.mediaCaption} numberOfLines={2}>
                                            {item.ai_description}
                                        </Text>
                                    ) : null}
                                </View>
                                {isSelected && (
                                    <View style={styles.mediaSelectedBadge}>
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );

    const handleGenerateDistribution = useCallback(async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', 'Sélectionnez un produit avant de générer un plan de diffusion.');
            return;
        }

        setIsGeneratingDistribution(true);
        try {
            const response = await mediaApi.generateDistributionPlan({
                product_name: normalizeProductName(selectedProduct),
                channels: Array.from(selectedChannels.values()),
                target_audience: Array.from(selectedChannels.values()).join(', '),
                marketing_angle: mediaAnalysis.marketingAngle || undefined,
                lang: subtitleLang || voiceoverLang,
            });

            if (!response.success || !(response.data as any)?.plan) {
                throw new Error(response.error || 'Plan IA indisponible');
            }

            setDistributionPlan((response.data as any).plan);
            Alert.alert('Plan IA généré', 'Le plan de diffusion et hashtags ont été ajoutés.');
        } catch (error) {
            console.error('[ProductVideoCreationModal] Plan IA impossible:', error);
            Alert.alert(
                'Erreur IA',
                error instanceof Error ? error.message : 'Impossible de générer le plan de diffusion pour le moment.'
            );
        } finally {
            setIsGeneratingDistribution(false);
        }
    }, [selectedProduct, selectedChannels, mediaAnalysis, subtitleLang, voiceoverLang]);

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                transparent
                onRequestClose={() => {
                    if (!isSubmitting) {
                        onClose();
                    }
                }}
            >
                <View style={styles.overlay}>
                    <NativeCard style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Studio vidéo produit</Text>
                                <Text style={styles.modalSubtitle}>
                                    Assemblez en 30 secondes une vidéo verticale prête pour TikTok, Reels et votre fiche
                                    produit.
                                </Text>
                                {/* ✅ NOUVEAU: Indicateur d'étapes (masqué à l'étape 1 pour éviter la confusion) */}
                                {activeStep > 1 && (
                                    <View style={styles.stepIndicator}>
                                        {[1, 2, 3, 4, 5, 6].map((step) => (
                                            <View
                                                key={step}
                                                style={[
                                                    styles.stepDot,
                                                    activeStep === step && styles.stepDotActive,
                                                    activeStep > step && styles.stepDotCompleted,
                                                ]}
                                            />
                                        ))}
                                        <Text style={styles.stepText}>
                                            Étape {activeStep} sur 6
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={onClose} disabled={isSubmitting} style={styles.closeButton}>
                                <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            ref={(ref) => { mainScrollViewRef.current = ref; }}
                            style={styles.modalBody}
                            contentContainerStyle={getStepContentStyle()}
                            showsVerticalScrollIndicator={activeStep === 1}
                            nestedScrollEnabled={true}
                        >
                            {renderStepContent()}
                        </ScrollView>

                        {/* ✅ NOUVEAU Phase 3.2: Modal AR Video Editor */}
                        <Modal
                            visible={showAREditor}
                            animationType="slide"
                            presentationStyle="fullScreen"
                            onRequestClose={() => {
                                if (!isUploadingARVideo) {
                                    setShowAREditor(false);
                                }
                            }}
                        >
                            <ARVideoEditor
                                productName={normalizeProductName(selectedProduct)}
                                serviceId={selectedProduct ? Number(selectedProduct.serviceId) : undefined}
                                productIndex={selectedProduct?.product_index}
                                onVideoCaptured={handleARVideoCaptured}
                                onClose={() => {
                                    if (!isUploadingARVideo) {
                                        setShowAREditor(false);
                                    }
                                }}
                            />
                        </Modal>

                        {/* ✅ NOUVEAU: Boutons de navigation par étape */}
                        <View style={getFixedBottomButtonStyle()}>
                            {activeStep === 1 && (
                                <NativeButton
                                    title={selectedProduct ? "Suivant" : "Sélectionnez un produit"}
                                    variant="primary"
                                    size="large"
                                    onPress={() => {
                                        if (selectedProduct) {
                                            markStepCompleted(1);
                                            // Tracking step completion
                                            markStepCompleted(1);
                                        }
                                        handleStepChange(2);
                                    }}
                                    disabled={!selectedProduct}
                                />
                            )}
                            {activeStep === 2 && (
                                <View style={styles.navigationRow}>
                                    <NativeButton
                                        title="Précédent"
                                        variant="secondary"
                                        onPress={() => handleStepChange(1)}
                                    />
                                    <NativeButton
                                        title="Suivant"
                                        variant="primary"
                                        onPress={() => handleStepChange(3)}
                                    />
                                </View>
                            )}
                            {activeStep === 3 && (
                                <View style={styles.navigationRow}>
                                    <NativeButton
                                        title="Précédent"
                                        variant="secondary"
                                        onPress={() => handleStepChange(2)}
                                        style={styles.navigationButtonLeft} // ✅ AJOUTÉ: Style pour positionner à gauche
                                    />
                                    <NativeButton
                                        title="Suivant"
                                        variant="primary"
                                        onPress={() => handleStepChange(4)}
                                        style={styles.navigationButtonRight} // ✅ AJOUTÉ: Style pour positionner à droite
                                    />
                                </View>
                            )}
                            {activeStep === 4 && (
                                <View style={styles.navigationRow}>
                                    <NativeButton
                                        title="Précédent"
                                        variant="secondary"
                                        onPress={() => handleStepChange(3)}
                                        style={styles.navigationButtonLeft} // ✅ AJOUTÉ: Style pour positionner à gauche
                                    />
                                    <NativeButton
                                        title="Suivant"
                                        variant="primary"
                                        onPress={() => handleStepChange(5)}
                                        style={styles.navigationButtonRight} // ✅ AJOUTÉ: Style pour positionner à droite
                                    />
                                </View>
                            )}
                            {activeStep === 5 && (
                                <View style={styles.navigationRow}>
                                    <NativeButton
                                        title="Précédent"
                                        variant="secondary"
                                        onPress={() => handleStepChange(4)}
                                        style={styles.navigationButtonLeft} // ✅ AJOUTÉ: Style pour positionner à gauche
                                    />
                                    <NativeButton
                                        title="Suivant"
                                        variant="primary"
                                        onPress={() => handleStepChange(6)}
                                        style={styles.navigationButtonRight} // ✅ AJOUTÉ: Style pour positionner à droite
                                    />
                                </View>
                            )}
                            {activeStep === 6 && (
                                <View style={styles.navigationRow}>
                                    <NativeButton
                                        title="Précédent"
                                        variant="secondary"
                                        onPress={() => handleStepChange(5)}
                                    />
                                    <NativeButton
                                        title={isSubmitting ? 'Génération en cours...' : 'Générer la vidéo'}
                                        variant="primary"
                                        onPress={handleSubmit}
                                        disabled={isSubmitting || !selectedProduct}
                                    />
                                </View>
                            )}
                            {/* ✅ SUPPRIMÉ: Doublon de boutons pour l'étape 4 - Les boutons sont déjà gérés au-dessus */}
                        </View>
                    </NativeCard>
                </View>
            </Modal>

            <Modal
                visible={variantPickerVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setVariantPickerVisible(false)}
            >
                <View style={styles.variantModalBackdrop}>
                    <View style={styles.variantModalContainer}>
                        <Text style={styles.variantModalTitle}>Choisissez un scénario IA</Text>
                        <ScrollView style={{ maxHeight: 320 }}>
                            {briefVariants.map((variant, index) => (
                                <TouchableOpacity
                                    key={`brief_variant_${index}`}
                                    style={styles.variantCard}
                                    onPress={() => handleApplyBriefVariant(variant)}
                                >
                                    <Text style={styles.variantCardTitle}>
                                        Variante {index + 1}
                                    </Text>
                                    {variant.hook && (
                                        <Text style={styles.variantCardHook}>{variant.hook}</Text>
                                    )}
                                    <View style={styles.variantOutline}>
                                        {Array.isArray(variant.script_outline) ? variant.script_outline.map((line, idx) => (
                                            <Text key={idx} style={styles.variantOutlineLine}>
                                                • {line}
                                            </Text>
                                        )) : null}
                                    </View>
                                    {variant.hashtags?.length > 0 && (
                                        <Text style={styles.variantHashtags}>
                                            {Array.isArray(variant.hashtags) ? variant.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ') : ''}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.variantCloseButton}
                            onPress={() => setVariantPickerVisible(false)}
                        >
                            <Text style={styles.variantCloseText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal de progression visuelle pour la génération vidéo */}
            <VideoGenerationProgressModal
                visible={showProgressModal}
                jobId={currentJobId}
                status={currentJobStatus}
                progressSteps={currentProgressSteps}
                currentStep={currentStepNumber}
                totalSteps={120}
                errorMessage={currentErrorMessage || (currentJobStatus === 'failed' ? 'Une erreur est survenue lors de la génération' : undefined)}
                onClose={() => {
                    setShowProgressModal(false);
                    setCurrentJobId(undefined);
                    setCurrentJobStatus('pending');
                    setCurrentProgressSteps([]);
                    setCurrentStepNumber(0);
                    setCurrentErrorMessage(undefined);
                }}
            />
        </>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        padding: 16,
        justifyContent: 'flex-end',
    },
    modalCard: {
        borderRadius: 28,
        padding: 0,
        maxHeight: '94%',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    modalSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 4,
        lineHeight: 18,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        paddingHorizontal: 20,
        flex: 1, // ✅ Permettre au ScrollView de prendre toute la hauteur disponible
    },
    sectionCard: {
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 18,
        padding: 20,
        backgroundColor: '#FFFFFF',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 8, // ✅ AJOUTÉ: Espacement entre titre et bouton
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        flexShrink: 1, // ✅ AJOUTÉ: Permet au titre de se rétrécir si nécessaire pour laisser de l'espace au bouton
    },
    sectionSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
        marginBottom: 12,
    },
    coachLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
    },
    coachLoadingText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        flex: 1,
    },
    coachRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
    },
    coachIcon: {
        marginTop: 2,
    },
    coachContent: {
        flex: 1,
        gap: 6,
    },
    coachLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.text,
    },
    coachText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    coachMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    coachAction: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    coachActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minWidth: 100, // ✅ AJOUTÉ: Largeur minimale pour que "Analyse IA" soit entièrement visible
        flexShrink: 0, // ✅ AJOUTÉ: Empêcher le bouton de rétrécir
        borderRadius: 999,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#E0E7FF',
    },
    linkButtonText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
        flexShrink: 0, // ✅ AJOUTÉ: Empêcher le texte de se rétrécir
    },
    selectedProductContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginTop: 12,
    },
    selectedProductImage: {
        width: 72,
        height: 72,
        borderRadius: 16,
    },
    selectedProductPlaceholder: {
        width: 72,
        height: 72,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E0E7FF',
    },
    selectedProductInfo: {
        flex: 1,
        gap: 4,
    },
    selectedProductName: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    selectedProductService: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    selectedProductPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#10B981',
    },
    productSelectionList: {
        marginTop: 12,
        maxHeight: 400, // ✅ Hauteur maximale pour permettre le scroll
    },
    productSelectionListContent: {
        paddingBottom: 8, // ✅ Espace en bas pour le dernier produit
    },
    productGroup: {
        marginBottom: 16,
    },
    productGroupTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 8,
    },
    productSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    productSelectIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productSelectName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    productSelectMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    fieldGroup: {
        marginTop: 12,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    styleRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8, // ✅ CORRIGÉ: Réduit de 12 à 8 pour garantir 2 colonnes
        marginTop: 12,
        justifyContent: 'flex-start', // ✅ CORRIGÉ: flex-start au lieu de space-between pour meilleur contrôle
    },
    styleChip: {
        // ✅ CORRIGÉ: 2 colonnes avec taille réduite pour meilleure UX
        // Calcul: (100% - 8px gap) / 2 = 46% par colonne pour garantir l'affichage
        width: '46%', // ✅ CORRIGÉ: Réduit de 48% à 46% pour garantir 2 colonnes avec gap
        minWidth: 0, // ✅ Permet au width de fonctionner correctement
        borderRadius: 10, // ✅ Réduit de 12 à 10
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 8, // ✅ CORRIGÉ: Réduit de 10 à 8 pour plus de compacité
        gap: 3, // ✅ Réduit de 4 à 3
        backgroundColor: '#F8FAFC',
    },
    styleChipSelected: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
    },
    styleChipLabel: {
        fontSize: 11, // ✅ CORRIGÉ: Réduit de 12 à 11 pour plus de compacité
        fontWeight: '700',
        color: modernColors.text,
    },
    styleChipLabelSelected: {
        color: modernColors.primary,
    },
    styleChipDescription: {
        fontSize: 10, // ✅ CORRIGÉ: Réduit de 11 à 10 pour plus de compacité
        color: modernColors.textSecondary,
        lineHeight: 12, // ✅ CORRIGÉ: Réduit de 14 à 12
    },
    voiceRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        marginBottom: 12,
    },
    audioRow: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 8,
    },
    // ✅ CORRIGÉ: Style pour afficher les ambiances musicales en 2 colonnes
    audioRowGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8, // ✅ CORRIGÉ: Réduit de 12 à 8 pour garantir 2 colonnes
        marginTop: 12,
        justifyContent: 'flex-start', // ✅ CORRIGÉ: flex-start au lieu de space-between pour meilleur contrôle
    },
    // ✅ CORRIGÉ: Style pour les cartes d'ambiances musicales en 2 colonnes
    audioChipGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6, // ✅ CORRIGÉ: Réduit de 8 à 6
        paddingHorizontal: 10, // ✅ CORRIGÉ: Réduit de 12 à 10
        paddingVertical: 8,
        borderRadius: 10, // ✅ CORRIGÉ: Réduit de 12 à 10
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        width: '46%', // ✅ CORRIGÉ: Réduit de 48% à 46% pour garantir 2 colonnes avec gap
        minWidth: 0, // ✅ Permet au width de fonctionner correctement
    },
    audioActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    audioImportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${modernColors.primary}33`,
        backgroundColor: '#EEF2FF',
    },
    audioImportText: {
        marginLeft: 8,
        color: modernColors.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    audioChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        maxWidth: 220,
    },
    audioChipSelected: {
        borderColor: '#0EA5E9',
        backgroundColor: '#E0F2FE',
    },
    audioChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        flexShrink: 1,
    },
    audioChipTextSelected: {
        color: '#0F172A',
    },
    audioChipSubtitle: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    voiceChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    voiceChipSelected: {
        backgroundColor: '#EEF2FF',
        borderColor: '#6366F1',
    },
    voiceChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    voiceChipTextSelected: {
        color: modernColors.primary,
    },
    distributionHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 16,
    },
    durationRow: {
        marginTop: 18,
    },
    durationInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    durationInput: {
        flex: 0.4,
    },
    durationUnit: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    durationHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 6,
        lineHeight: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        gap: 12,
    },
    toggleText: {
        flex: 1,
        gap: 2,
    },
    toggleLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    toggleDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
    relatedProductsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    relatedProductChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E0E7FF',
        backgroundColor: '#F8FAFC',
    },
    relatedProductChipSelected: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    relatedProductText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        maxWidth: 160,
    },
    relatedProductTextSelected: {
        color: '#047857',
    },
    mediaSection: {
        marginTop: 16,
    },
    mediaBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: '#6366F1',
    },
    mediaBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    mediaLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    mediaLoadingText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    emptyMediaState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 8,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyMediaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 16,
        paddingHorizontal: 24,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    emptyStateText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 16,
    },
    mediaList: {
        gap: 12,
        paddingVertical: 12,
    },
    mediaItem: {
        width: 120,
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    mediaItemSelected: {
        borderColor: '#6366F1',
        shadowColor: '#6366F1',
        shadowRadius: 8,
        shadowOpacity: 0.25,
        elevation: 4,
    },
    mediaThumbnail: {
        width: '100%',
        height: '100%',
    },
    mediaThumbnailFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EEF2FF',
    },
    mediaOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 8,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        gap: 6,
    },
    mediaCaption: {
        fontSize: 11,
        color: '#FFFFFF',
    },
    mediaSelectedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsRow: {
        padding: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
    },
    primaryActionButton: {
        flex: 1.4,
    },
    // ✅ NOUVEAU: Styles pour le système d'étapes
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.border,
    },
    stepDotActive: {
        backgroundColor: modernColors.primary,
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    stepDotCompleted: {
        backgroundColor: '#10B981',
    },
    stepText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginLeft: 4,
        fontWeight: '500',
    },
    navigationRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        justifyContent: 'space-between', // ✅ AJOUTÉ: Positionner Précédent à gauche et Suivant à droite
    },
    navigationButtonLeft: {
        flex: 0, // ✅ AJOUTÉ: Ne pas prendre tout l'espace
        minWidth: 120, // ✅ AJOUTÉ: Largeur minimale pour le bouton
    },
    navigationButtonRight: {
        flex: 0, // ✅ AJOUTÉ: Ne pas prendre tout l'espace
        minWidth: 120, // ✅ AJOUTÉ: Largeur minimale pour le bouton
        marginLeft: 'auto', // ✅ AJOUTÉ: Pousser le bouton vers la droite
    },
    variantModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    variantModalContainer: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        gap: 16,
    },
    variantModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    variantCard: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        backgroundColor: '#F8FAFC',
    },
    variantCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 6,
    },
    variantCardHook: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 6,
    },
    variantOutline: {
        gap: 4,
    },
    variantOutlineLine: {
        fontSize: 13,
        color: '#334155',
        lineHeight: 18,
    },
    variantHashtags: {
        marginTop: 8,
        fontSize: 12,
        color: modernColors.primary,
    },
    variantCloseButton: {
        alignSelf: 'center',
        marginTop: 4,
        paddingVertical: 8,
        paddingHorizontal: 18,
    },
    variantCloseText: {
        color: modernColors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    // ✅ NOUVEAU: Styles pour le champ script amélioré
    fieldLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    fieldRequired: {
        fontSize: 14,
        fontWeight: '700',
        color: '#EF4444',
    },
    fieldHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 16,
    },
    scriptInputRequired: {
        borderColor: '#EF4444',
        borderWidth: 2,
    },
    fieldError: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Styles pour estimation de coût
    costEstimationContainer: {
        marginTop: 12,
        padding: 16,
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    costRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    costLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    costValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10B981',
    },
    costBreakdown: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#BBF7D0',
        gap: 8,
    },
    costItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    costItemLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    costItemValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    costHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
        fontStyle: 'italic',
    },
    // ✅ NOUVEAU: Styles pour chaînage de vidéos
    videoChainingContainer: {
        marginTop: 12,
        gap: 12,
    },
    sessionsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    sessionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    sessionChipSelected: {
        backgroundColor: modernColors.primary + '15',
        borderColor: modernColors.primary,
    },
    sessionChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: modernColors.text,
    },
    sessionChipTextSelected: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    // ✅ NOUVEAU: Styles pour options avancées
    advancedOptionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    advancedOptionsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    optionalBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    optionalBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#0369A1',
        textTransform: 'uppercase',
    },
    advancedOptionsContent: {
        marginTop: 16,
        gap: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    advancedSection: {
        gap: 12,
    },
    advancedSectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    suggestionSection: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    suggestionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
    },
    suggestionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    suggestionChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    suggestionChipSelected: {
        backgroundColor: '#EEF2FF',
        borderColor: '#6366F1',
    },
    suggestionChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    suggestionChipTextSelected: {
        color: modernColors.primary,
    },
    mediaInsightsBox: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    mediaInsightsTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B',
    },
    mediaInsightsText: {
        fontSize: 12,
        color: '#475569',
    },
    colorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    colorSwatch: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 90,
    },
    colorLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFF',
        textShadowColor: 'rgba(15, 23, 42, 0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    planBox: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        gap: 6,
    },
    planSummary: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0C4A6E',
    },
    planHashtags: {
        fontSize: 12,
        color: '#0369A1',
    },
    planSchedule: {
        marginTop: 6,
        gap: 6,
    },
    planScheduleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    planScheduleChannel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0F172A',
        flex: 1,
    },
    planScheduleTime: {
        fontSize: 12,
        color: '#0369A1',
        flex: 1,
        textAlign: 'center',
    },
    planScheduleCTA: {
        fontSize: 12,
        color: '#0F172A',
        flex: 1,
        textAlign: 'right',
    },
    // ✅ NOUVEAU Phase 3.2: Styles pour le bouton AR
    arButtonContainer: {
        marginTop: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        borderWidth: 2,
        borderColor: '#6366F1',
        borderStyle: 'dashed',
        alignItems: 'center',
        gap: 8,
    },
    arButton: {
        width: '100%',
    },
    arButtonHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    // ✅ NOUVEAU: Styles pour storyboard IA
    storyboardList: {
        marginTop: 12,
        gap: 8,
    },
    storyboardItem: {
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    storyboardSceneType: {
        fontSize: 11,
        fontWeight: '700',
        color: modernColors.primary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    storyboardSceneText: {
        fontSize: 13,
        color: modernColors.text,
        lineHeight: 18,
    },
    // ✅ NOUVEAU: Styles pour short preview
    shortPreviewContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#F0F9FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    shortPreviewButton: {
        width: '100%',
    },
    shortPreviewHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    // ✅ NOUVEAU: Styles pour templates narratifs (depuis Wizard)
    templateList: {
        marginTop: 12,
        gap: 12,
    },
    templateCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    templateCardActive: {
        backgroundColor: '#EEF2FF',
        borderColor: modernColors.primary,
    },
    templateTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    templateTitleActive: {
        color: modernColors.primary,
    },
    templateDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 18,
    },
    templateMeta: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Styles pour inline row (depuis Wizard)
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingVertical: 8,
    },
    inlineLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
});

export default ProductVideoCreationModal;


