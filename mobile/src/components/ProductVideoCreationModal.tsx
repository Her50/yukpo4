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
import { apiGet, iaApi, mediaApi } from '../services/api';
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
import ProductDeliveryConfigModal from './delivery/ProductDeliveryConfigModal';
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
import { EffectPreviewCarousel } from './EffectPreviewCarousel';
import { QuickPreview } from './QuickPreview';
import { TimelineVariantSelector } from './TimelineVariantSelector';
// ✅ NOUVEAU Phase 3.2: Éditeur AR immersif - Import dynamique pour éviter les crashes
// Note: L'import est fait dynamiquement dans le Modal pour gérer les erreurs

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
    navigation?: any; // ✅ AJOUTÉ: Navigation pour rediriger vers la recharge
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

const ensureNumber = (...args: any[]): number => {
    for (const value of args) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return 0;
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
        lines.push(headline.replace(/[✅⚠️🎵🔥📞📦📝🎬…]+/g, '').trim());
    } else {
        lines.push(`Découvrez ${productName} sur Yukpo.`);
    }

    storyboardLines.slice(0, 3).forEach((line) => {
        if (line.trim().length > 0) {
            lines.push(line.replace(/[✅⚠️🎵🔥📞📦📝🎬…]+/g, '').trim());
        }
    });

    if (callToAction) {
        lines.push(callToAction.replace(/[✅⚠️🎵🔥📞📦📝🎬…]+/g, '').trim());
    } else {
        lines.push('Contactez-nous dès maintenant via Yukpo.');
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
    navigation, // ✅ AJOUTÉ: Navigation pour rediriger vers la recharge
}) => {
    const insets = useSafeAreaInsets();
    const [activeStep, setActiveStep] = useState<ModalStep>(1);
    const [selectedProduct, setSelectedProduct] = useState<ManagedProduct | null>(primaryProduct);
    const [selectedRelatedProducts, setSelectedRelatedProducts] = useState<Set<number>>(new Set());
    const [selectedMediaIds, setSelectedMediaIds] = useState<Set<number>>(new Set());

    const [productMedia, setProductMedia] = useState<MediaLibraryItem[]>([]);
    const [serviceMedia, setServiceMedia] = useState<MediaLibraryItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(false);

    const [stylePreset, setStylePreset] = useState<VideoStylePreset>('tiktok');
    const [duration, setDuration] = useState<string>('28');
    const [headline, setHeadline] = useState<string>('');
    const [callToAction, setCallToAction] = useState<string>('Commandez maintenant sur Yukpo ✅');
    const [scriptNotes, setScriptNotes] = useState<string>('');

    const [includePrice, setIncludePrice] = useState<boolean>(true);
    const [includePromotion, setIncludePromotion] = useState<boolean>(false);
    const [includeContact, setIncludeContact] = useState<boolean>(true);
    const [enableDelivery, setEnableDelivery] = useState<boolean>(false);
    const [deliveryConfig, setDeliveryConfig] = useState<{
        pickup_address?: string;
        pickup_latitude?: number;
        pickup_longitude?: number;
        preparation_time_minutes?: number;
        required_vehicle_type_id?: number;
        is_configured?: boolean;
    } | null>(null);
    const [loadingDeliveryConfig, setLoadingDeliveryConfig] = useState<boolean>(false);
    const [showDeliveryConfigModal, setShowDeliveryConfigModal] = useState<boolean>(false);
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

    // ✅ NOUVEAU: États pour le suivi du job de génération vidéo
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<'queued' | 'running' | 'completed' | 'failed' | null>(null);
    const [jobProgress, setJobProgress] = useState<number>(0);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const completionHandledRef = useRef(false);

    // ✅ NOUVEAU: Studio Sessions (depuis Wizard)
    const [studioSessionId, setStudioSessionId] = useState<string | undefined>();
    const [storyboard, setStoryboard] = useState<import('../services/studioService').Storyboard | null>(null);
    const [storyboardLoading, setStoryboardLoading] = useState<boolean>(false);
    const [shortPreviewUrl, setShortPreviewUrl] = useState<string | null>(null);
    const [shortPreviewLoading, setShortPreviewLoading] = useState<boolean>(false);
    const [prewarmedShortPreviewUrl, setPrewarmedShortPreviewUrl] = useState<string | undefined>();

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
    // ✅ NOUVEAU: Stocker le produit courant au moment de l'ouverture de l'éditeur AR
    const [arEditorProduct, setArEditorProduct] = useState<ManagedProduct | null>(null);
    const [isUploadingARVideo, setIsUploadingARVideo] = useState<boolean>(false);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // ✅ CORRIGÉ 2025-12-24: Ref pour le ScrollView principal pour scroller vers le haut lors du changement d'étape
    const mainScrollViewRef = useRef<ScrollView>(null);

    // ✅ NOUVEAU Phase 3.2: Gérer la vidéo AR capturée
    const handleARVideoCaptured = useCallback(async (videoUri: string) => {
        // ✅ CORRIGÉ: Utiliser le produit stocké au moment de l'ouverture de l'éditeur AR
        // Cela garantit que la vidéo AR est liée au produit qui était sélectionné lors de l'ouverture de l'éditeur
        const productToUse = arEditorProduct || selectedProduct || primaryProduct;

        if (!productToUse) {
            Alert.alert(
                'Produit requis',
                'Aucun produit n\'est sélectionné. Veuillez sélectionner un produit avant de sauvegarder la vidéo AR.',
                [{ text: 'OK', onPress: () => setShowAREditor(false) }]
            );
            return;
        }

        // ✅ CORRIGÉ: Extraire product_index de manière robuste (vérifier product_index ET productIndex)
        const productIndexValue = (() => {
            // Priorité 1: product_index (standard)
            if (typeof productToUse.product_index === 'number' && productToUse.product_index >= 0) {
                return productToUse.product_index;
            }
            // Priorité 2: productIndex (alternative)
            if (typeof productToUse.productIndex === 'number' && productToUse.productIndex >= 0) {
                return productToUse.productIndex;
            }
            // Priorité 3: Essayer de convertir depuis id si format "serviceId_index"
            if (typeof productToUse.id === 'string' && productToUse.id.includes('_')) {
                const parts = productToUse.id.split('_');
                if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1];
                    const parsed = parseInt(lastPart, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                        return parsed;
                    }
                }
            }
            return null;
        })();

        if (productIndexValue === null || productIndexValue < 0) {
            console.error('[ProductVideoCreationModal] ❌ product_index invalide:', {
                product_id: productToUse.id,
                product_index: productToUse.product_index,
                productIndex: productToUse.productIndex,
                serviceId: productToUse.serviceId,
                product_name: productToUse.nom || productToUse.titre
            });
            Alert.alert(
                'Produit invalide',
                'Le produit sélectionné n\'a pas d\'index valide. Veuillez sélectionner un autre produit ou contacter le support.',
                [{ text: 'OK', onPress: () => setShowAREditor(false) }]
            );
            return;
        }

        if (!productToUse.serviceId) {
            Alert.alert(
                'Service invalide',
                'Le produit sélectionné n\'a pas de service associé. Veuillez sélectionner un autre produit.',
                [{ text: 'OK', onPress: () => setShowAREditor(false) }]
            );
            return;
        }

        // ✅ S'assurer que selectedProduct est mis à jour si on utilise primaryProduct
        if (!selectedProduct && productToUse) {
            setSelectedProduct(productToUse);
        }

        setIsUploadingARVideo(true);
        try {
            // ✅ CORRIGÉ: Utiliser productToUse et productIndexValue extrait robustement
            const serviceId = Number(productToUse.serviceId);
            const productIndex = productIndexValue;

            console.log('[ProductVideoCreationModal] 📤 Début upload vidéo AR:', {
                serviceId,
                productIndex,
                product_name: productToUse.nom || productToUse.titre,
                videoUri: videoUri.substring(0, 50) + '...',
                arEditorProduct: arEditorProduct ? {
                    serviceId: arEditorProduct.serviceId,
                    product_index: arEditorProduct.product_index
                } : null,
            });

            // Upload vers le cloud
            const uploadResult = await uploadToCloud(
                videoUri,
                'video',
                `ar_video_${Date.now()}.mp4`
            );

            console.log('[ProductVideoCreationModal] 📥 Résultat upload:', {
                success: uploadResult.success,
                hasUrl: !!uploadResult.url,
                error: uploadResult.error,
            });

            if (!uploadResult.success || !uploadResult.url) {
                const errorMessage = uploadResult.error || 'Erreur lors de l\'upload';
                console.error('[ProductVideoCreationModal] ❌ Erreur upload:', errorMessage);
                throw new Error(errorMessage);
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

            console.log('[ProductVideoCreationModal] ✅ Vidéo AR ajoutée avec succès, fermeture du modal');
            setShowAREditor(false);

            // ✅ NOUVEAU: Réinitialiser le produit stocké pour l'éditeur AR
            setArEditorProduct(null);

            // ✅ NOUVEAU: Afficher l'alerte après la fermeture du modal pour éviter les conflits
            setTimeout(() => {
                Alert.alert('Succès', `Vidéo AR ajoutée à la médiathèque du produit "${productToUse.nom || productToUse.titre || 'sélectionné'}"`);
            }, 300);

            // Rafraëchir les médias pour obtenir l'ID réel depuis le serveur
            // ✅ CORRIGÉ: Utiliser productToUse au lieu de selectedProduct pour garantir la cohérence
            try {
                await refreshMedia(productToUse);
                console.log('[ProductVideoCreationModal] ✅ Médias rafraëchis après upload AR pour le produit:', {
                    serviceId: productToUse.serviceId,
                    product_index: productToUse.product_index
                });
            } catch (refreshError: any) {
                console.warn('[ProductVideoCreationModal] ⚠️ Erreur rafraîchissement médias:', refreshError);
                // Ne pas bloquer l'utilisateur si le rafraîchissement échoue
            }
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] ❌ Erreur upload vidéo AR:', {
                message: error?.message,
                stack: error?.stack,
                name: error?.name,
                response: error?.response?.data,
                status: error?.response?.status,
            });

            // ✅ CORRIGÉ: Fermer le modal même en cas d'erreur pour permettre à l'utilisateur de réessayer
            setShowAREditor(false);

            // ✅ NOUVEAU: Réinitialiser le produit stocké même en cas d'erreur
            setArEditorProduct(null);

            // Afficher un message d'erreur plus détaillé
            let errorMessage = 'Impossible d\'ajouter la vidéo AR. Réessayez plus tard.';
            if (error?.response?.status === 500) {
                errorMessage = 'Erreur serveur (500). Veuillez réessayer ou contacter le support.';
            } else if (error?.message) {
                errorMessage = error.message;
            }

            // ✅ NOUVEAU: Afficher l'alerte après la fermeture du modal
            setTimeout(() => {
                Alert.alert('Erreur', errorMessage);
            }, 300);
        } finally {
            setIsUploadingARVideo(false);
        }
    }, [arEditorProduct, selectedProduct, primaryProduct, uploadToCloud, refreshMedia]);

    // ✅ Fonction pour charger la configuration de livraison
    const loadDeliveryConfig = useCallback(async (serviceId: number, productIndex: number) => {
        setLoadingDeliveryConfig(true);
        try {
            const response = await apiGet<{
                config?: {
                    is_configured?: boolean;
                    pickup_address?: string;
                    pickup_latitude?: number;
                    pickup_longitude?: number;
                    preparation_time_minutes?: number;
                    required_vehicle_type_id?: number;
                };
            }>(`/api/delivery/product-config/${serviceId}/${productIndex}`);

            if (response.success && response.data?.config) {
                const config = response.data.config;
                setDeliveryConfig({
                    pickup_address: config?.pickup_address || undefined,
                    pickup_latitude: config.pickup_latitude || undefined,
                    pickup_longitude: config.pickup_longitude || undefined,
                    preparation_time_minutes: config.preparation_time_minutes || undefined,
                    required_vehicle_type_id: config.required_vehicle_type_id || undefined,
                    is_configured: config.is_configured || false,
                });
                // Activer automatiquement le toggle si la config existe
                if (config.is_configured) {
                    setEnableDelivery(true);
                }
            } else {
                setDeliveryConfig(null);
            }
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur chargement config livraison:', error);
            // ✅ CORRIGÉ: Logger l'erreur complète pour debug
            if (error?.message) {
                console.error('[ProductVideoCreationModal] Détails erreur:', error.message);
            }
            setDeliveryConfig(null);
        } finally {
            setLoadingDeliveryConfig(false);
        }
    }, []);

    // ✅ CORRIGÉ: Synchroniser selectedProduct avec primaryProduct quand le modal s'ouvre ou que primaryProduct change
    useEffect(() => {
        if (visible && primaryProduct) {
            console.log('[ProductVideoCreationModal] Synchronisation selectedProduct avec primaryProduct:', primaryProduct);
            setSelectedProduct(primaryProduct);
            // ✅ CORRIGÉ À LA RACINE: Passer automatiquement à l'étape 2 si un produit est déjà sélectionné
            // Cela évite l'écran intermédiaire redondant où l'utilisateur doit re-choisir le produit
            setActiveStep(2);
            console.log('[ProductVideoCreationModal] ✅ Produit pré-sélectionné détecté, passage automatique à l\'étape 2');
        } else if (!visible) {
            // Réinitialiser à l'étape 1 quand le modal se ferme
            setActiveStep(1);
        }
    }, [visible, primaryProduct]);

    // ✅ Charger la config de livraison quand un produit est sélectionné
    useEffect(() => {
        if (visible && selectedProduct?.serviceId && typeof selectedProduct.product_index === 'number') {
            loadDeliveryConfig(Number(selectedProduct.serviceId), selectedProduct.product_index);
        }
    }, [visible, selectedProduct, loadDeliveryConfig]);

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
                // ✅ CORRIGÉ 2025-12-24: Convertir serviceId en nombre pour l'API
                const serviceIdNum = Number(product.serviceId);
                if (isNaN(serviceIdNum) || serviceIdNum <= 0) {
                    console.error('[ProductVideoCreationModal] serviceId invalide:', product.serviceId);
                    throw new Error('Service ID invalide');
                }

                const productIndexNum = Number(product.product_index);
                if (isNaN(productIndexNum) || productIndexNum < 0) {
                    console.error('[ProductVideoCreationModal] product_index invalide:', product.product_index);
                    throw new Error('Product index invalide');
                }

                console.log('[ProductVideoCreationModal] Chargement médias pour serviceId:', serviceIdNum, 'productIndex:', productIndexNum);

                const [productMediaResponse, serviceMediaResponse] = await Promise.all([
                    mediaApi.getProductMedia(serviceIdNum, productIndexNum),
                    mediaApi.getServiceMediaDetailed(serviceIdNum),
                ]);

                console.log('[ProductVideoCreationModal] Réponse productMedia:', {
                    success: productMediaResponse.success,
                    hasData: !!productMediaResponse.data,
                    dataType: typeof productMediaResponse.data,
                    dataKeys: productMediaResponse.data ? Object.keys(productMediaResponse.data) : [],
                });

                // ✅ NOUVEAU: Ne pas throw si l'API échoue, on utilisera le fallback
                if (!productMediaResponse.success) {
                    console.warn('[ProductVideoCreationModal] ⚠️ API productMedia échouée, utilisation fallback depuis product:', productMediaResponse.error);
                    // Ne pas throw, on continuera avec productMediaData vide et utiliserons le fallback
                }

                if (!serviceMediaResponse.success) {
                    console.warn('[ProductVideoCreationModal] Erreur serviceMediaResponse:', serviceMediaResponse.error);
                    // Ne pas faire échouer si serviceMedia échoue, on continue avec productMedia
                }

                // ✅ CORRIGÉ 2025-12-24: Vérifier plusieurs structures de réponse possibles
                let productMediaData: any[] = [];

                // Structure 1: response.data.data (tableau)
                if (Array.isArray((productMediaResponse.data as any)?.data)) {
                    productMediaData = (productMediaResponse.data as any).data;
                }
                // Structure 2: response.data directement (tableau)
                else if (Array.isArray(productMediaResponse.data)) {
                    productMediaData = productMediaResponse.data;
                }
                // Structure 3: response.data.images ou response.data.videos
                else if (productMediaResponse.data && typeof productMediaResponse.data === 'object') {
                    const images = (productMediaResponse.data as any).images || (productMediaResponse.data as any).Images || [];
                    const videos = (productMediaResponse.data as any).videos || (productMediaResponse.data as any).Videos || [];
                    productMediaData = [...(Array.isArray(images) ? images : []), ...(Array.isArray(videos) ? videos : [])];
                }

                console.log('[ProductVideoCreationModal] Médias extraits:', productMediaData.length, 'items');

                const productMediaItems: MediaLibraryItem[] = productMediaData
                    .map((item: any, index: number) => {
                        // ✅ CORRIGÉ: Gérer différents formats de réponse
                        const mediaId = ensureNumber(item.id, item.media_id, index + 1);
                        const mediaPath = item.path || item.url || item.uri || item.image_url || item.video_url;

                        return {
                            id: mediaId,
                            path: mediaPath,
                            type: item.media_type ?? item.type ?? (mediaPath?.includes('video') ? 'video' : 'image'),
                            media_type: item.media_type ?? item.type ?? (mediaPath?.includes('video') ? 'video' : 'image'),
                            product_index: item.product_index ?? productIndexNum,
                            ai_description: item.ai_description ?? item.description ?? null,
                        };
                    })
                    .filter((item: MediaLibraryItem) => item.id > 0 && item.path && item.path.trim().length > 0);

                console.log('[ProductVideoCreationModal] Médias filtrés:', productMediaItems.length, 'items valides');

                // ✅ NOUVEAU: Fallback - Utiliser les images du produit directement si l'API ne retourne rien
                if (productMediaItems.length === 0 && product) {
                    console.log('[ProductVideoCreationModal] ⚠️ Aucun média depuis API, utilisation fallback depuis product.images');

                    // Extraire les images du produit (gérer différents formats)
                    const extractImagesFromProduct = (product: ManagedProduct): string[] => {
                        const images: string[] = [];

                        // Format 1: product.images (tableau de strings)
                        if (Array.isArray(product.images)) {
                            product.images.forEach((img: any) => {
                                if (typeof img === 'string' && img.trim().length > 0) {
                                    images.push(img);
                                } else if (typeof img === 'object' && img !== null) {
                                    // Gérer les objets avec valeur, url, path, etc.
                                    const imgUrl = img.valeur || img.url || img.path || img.uri || img.image_url;
                                    if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim().length > 0) {
                                        images.push(imgUrl);
                                    }
                                }
                            });
                        }

                        // Format 2: product.data?.images
                        if (product.data && typeof product.data === 'object') {
                            const dataImages = (product.data as any).images;
                            if (Array.isArray(dataImages)) {
                                dataImages.forEach((img: any) => {
                                    if (typeof img === 'string' && img.trim().length > 0) {
                                        images.push(img);
                                    } else if (typeof img === 'object' && img !== null) {
                                        const imgUrl = img.valeur || img.url || img.path || img.uri || img.image_url;
                                        if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim().length > 0) {
                                            images.push(imgUrl);
                                        }
                                    }
                                });
                            }
                        }

                        // Format 3: product.base64_image (uniquement si pas déjà dans images)
                        if (product.base64_image && typeof product.base64_image === 'string' && !images.includes(product.base64_image)) {
                            images.push(product.base64_image);
                        }

                        // Dédupliquer
                        return Array.from(new Set(images));
                    };

                    const fallbackImages = extractImagesFromProduct(product);
                    console.log('[ProductVideoCreationModal] ✅ Images extraites depuis produit (fallback):', fallbackImages.length);

                    if (fallbackImages.length > 0) {
                        // Créer des MediaLibraryItem depuis les images du produit
                        const fallbackMediaItems: MediaLibraryItem[] = fallbackImages.map((imgUrl: string, index: number) => ({
                            id: 10000 + index, // IDs temporaires élevés pour éviter conflits
                            path: imgUrl,
                            type: 'image',
                            media_type: 'image',
                            product_index: product.product_index || 0,
                            ai_description: null,
                        }));

                        productMediaItems.push(...fallbackMediaItems);
                        console.log('[ProductVideoCreationModal] ✅ Médias fallback ajoutés:', fallbackMediaItems.length);
                    }

                    // Faire de même pour les vidéos
                    const extractVideosFromProduct = (product: ManagedProduct): string[] => {
                        const videos: string[] = [];

                        if (Array.isArray(product.videos)) {
                            product.videos.forEach((vid: any) => {
                                if (typeof vid === 'string' && vid.trim().length > 0) {
                                    videos.push(vid);
                                } else if (typeof vid === 'object' && vid !== null) {
                                    const vidUrl = vid.valeur || vid.url || vid.path || vid.uri || vid.video_url;
                                    if (vidUrl && typeof vidUrl === 'string' && vidUrl.trim().length > 0) {
                                        videos.push(vidUrl);
                                    }
                                }
                            });
                        }

                        if (product.data && typeof product.data === 'object') {
                            const dataVideos = (product.data as any).videos;
                            if (Array.isArray(dataVideos)) {
                                dataVideos.forEach((vid: any) => {
                                    if (typeof vid === 'string' && vid.trim().length > 0) {
                                        videos.push(vid);
                                    } else if (typeof vid === 'object' && vid !== null) {
                                        const vidUrl = vid.valeur || vid.url || vid.path || vid.uri || vid.video_url;
                                        if (vidUrl && typeof vidUrl === 'string' && vidUrl.trim().length > 0) {
                                            videos.push(vidUrl);
                                        }
                                    }
                                });
                            }
                        }

                        return Array.from(new Set(videos));
                    };

                    const fallbackVideos = extractVideosFromProduct(product);
                    if (fallbackVideos.length > 0) {
                        const fallbackVideoItems: MediaLibraryItem[] = fallbackVideos.map((vidUrl: string, index: number) => ({
                            id: 20000 + index,
                            path: vidUrl,
                            type: 'video',
                            media_type: 'video',
                            product_index: product.product_index || 0,
                            ai_description: null,
                        }));

                        productMediaItems.push(...fallbackVideoItems);
                        console.log('[ProductVideoCreationModal] ✅ Vidéos fallback ajoutées:', fallbackVideoItems.length);
                    }
                }

                // ✅ CORRIGÉ 2025-12-24: Gérer serviceMedia même si l'API échoue (non bloquant)
                let serviceMediaData: any[] = [];
                if (serviceMediaResponse.success) {
                    const svcRaw = serviceMediaResponse.data as any;
                    if (Array.isArray(svcRaw)) {
                        serviceMediaData = svcRaw;
                    } else if (svcRaw && Array.isArray(svcRaw.data)) {
                        serviceMediaData = svcRaw.data;
                    } else if (svcRaw && Array.isArray(svcRaw.items)) {
                        serviceMediaData = svcRaw.items;
                    } else if (svcRaw && Array.isArray(svcRaw.media)) {
                        serviceMediaData = svcRaw.media;
                    } else if (svcRaw && typeof svcRaw === 'object') {
                        const images = svcRaw.images || svcRaw.Images || [];
                        const videos = svcRaw.videos || svcRaw.Videos || [];
                        serviceMediaData = [...(Array.isArray(images) ? images : []), ...(Array.isArray(videos) ? videos : [])];
                    }
                }

                const serviceMediaItems: MediaLibraryItem[] = serviceMediaData
                    .map((item: any, index: number) => {
                        const mediaId = ensureNumber(item.id, item.media_id, index + 1);
                        const mediaPath = item.path || item.url || item.uri || item.image_url || item.video_url;

                        return {
                            id: mediaId,
                            path: mediaPath,
                            type: item.media_type ?? item.type ?? (mediaPath?.includes('video') ? 'video' : 'image'),
                            media_type: item.media_type ?? item.type ?? (mediaPath?.includes('video') ? 'video' : 'image'),
                            product_index: item.product_index ?? null,
                            ai_description: item.ai_description ?? item.description ?? null,
                        };
                    })
                    .filter((item: MediaLibraryItem) => item.id > 0 && item.path && item.path.trim().length > 0);

                setProductMedia(productMediaItems);
                setServiceMedia(serviceMediaItems);

                const audioTracks = [...serviceMediaItems, ...productMediaItems].filter((item) => {
                    const kind = (item.media_type || item.type || '').toLowerCase();
                    return kind.includes('audio');
                });
                setAvailableAudioTracks(audioTracks);

                // ✅ AMÉLIORÉ: Sélection intelligente - Prioriser les vidéos (surtout AR)
                const defaultIds = new Set<number>();

                // 1. D'abord sélectionner toutes les vidéos (priorité aux vidéos AR qui ont "AR" dans la description)
                const videos = productMediaItems.filter(item =>
                    (item.type === 'video' || item.media_type === 'video')
                );
                const arVideos = videos.filter(item =>
                    item.ai_description?.toLowerCase().includes('ar') ||
                    item.ai_description?.toLowerCase().includes('immersive')
                );

                // Sélectionner d'abord les vidéos AR, puis les autres vidéos
                [...arVideos, ...videos.filter(v => !arVideos.includes(v))].forEach(item => {
                    defaultIds.add(item.id);
                });

                // 2. Ensuite compléter avec des images si on n'a pas encore 4 médias
                if (defaultIds.size < 4) {
                    const images = productMediaItems.filter(item =>
                        item.type !== 'video' && item.media_type !== 'video'
                    );
                    images.slice(0, 4 - defaultIds.size).forEach(item => {
                        defaultIds.add(item.id);
                    });
                }

                // 3. Si aucune vidéo n'est disponible, sélectionner les 4 premiers médias (comportement par défaut)
                if (defaultIds.size === 0) {
                    productMediaItems.slice(0, 4).forEach((item) => defaultIds.add(item.id));
                }

                setSelectedMediaIds(defaultIds);
                console.log('[ProductVideoCreationModal] ✅ Sélection automatique:', {
                    total: defaultIds.size,
                    videos: videos.length,
                    arVideos: arVideos.length,
                    selectedIds: Array.from(defaultIds),
                });

                return audioTracks;
            } catch (error) {
                console.error('[ProductVideoCreationModal] Erreur chargement médias:', error);

                // ✅ NOUVEAU: Fallback en cas d'erreur - Utiliser les images du produit directement
                if (product) {
                    console.log('[ProductVideoCreationModal] ⚠️ Erreur API, utilisation fallback depuis product.images');

                    try {
                        const extractImagesFromProduct = (product: ManagedProduct): string[] => {
                            const images: string[] = [];
                            if (Array.isArray(product.images)) {
                                product.images.forEach((img: any) => {
                                    if (typeof img === 'string' && img.trim().length > 0) {
                                        images.push(img);
                                    } else if (typeof img === 'object' && img !== null) {
                                        const imgUrl = img.valeur || img.url || img.path || img.uri || img.image_url;
                                        if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim().length > 0) {
                                            images.push(imgUrl);
                                        }
                                    }
                                });
                            }
                            if (product.data && typeof product.data === 'object') {
                                const dataImages = (product.data as any).images;
                                if (Array.isArray(dataImages)) {
                                    dataImages.forEach((img: any) => {
                                        if (typeof img === 'string' && img.trim().length > 0) {
                                            images.push(img);
                                        } else if (typeof img === 'object' && img !== null) {
                                            const imgUrl = img.valeur || img.url || img.path || img.uri || img.image_url;
                                            if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim().length > 0) {
                                                images.push(imgUrl);
                                            }
                                        }
                                    });
                                }
                            }
                            return Array.from(new Set(images));
                        };

                        const extractVideosFromProduct = (product: ManagedProduct): string[] => {
                            const videos: string[] = [];
                            if (Array.isArray(product.videos)) {
                                product.videos.forEach((vid: any) => {
                                    if (typeof vid === 'string' && vid.trim().length > 0) {
                                        videos.push(vid);
                                    } else if (typeof vid === 'object' && vid !== null) {
                                        const vidUrl = vid.valeur || vid.url || vid.path || vid.uri || vid.video_url;
                                        if (vidUrl && typeof vidUrl === 'string' && vidUrl.trim().length > 0) {
                                            videos.push(vidUrl);
                                        }
                                    }
                                });
                            }
                            return Array.from(new Set(videos));
                        };

                        const fallbackImages = extractImagesFromProduct(product);
                        const fallbackVideos = extractVideosFromProduct(product);

                        if (fallbackImages.length > 0 || fallbackVideos.length > 0) {
                            const fallbackItems: MediaLibraryItem[] = [
                                ...fallbackImages.map((imgUrl: string, index: number) => ({
                                    id: 10000 + index,
                                    path: imgUrl,
                                    type: 'image' as const,
                                    media_type: 'image' as const,
                                    product_index: product.product_index || 0,
                                    ai_description: null,
                                })),
                                ...fallbackVideos.map((vidUrl: string, index: number) => ({
                                    id: 20000 + index,
                                    path: vidUrl,
                                    type: 'video' as const,
                                    media_type: 'video' as const,
                                    product_index: product.product_index || 0,
                                    ai_description: null,
                                })),
                            ];

                            setProductMedia(fallbackItems);
                            // ✅ AMÉLIORÉ: Même logique de sélection intelligente pour le fallback
                            const defaultIds = new Set<number>();
                            const videos = fallbackItems.filter(item =>
                                (item.type === 'video' || item.media_type === 'video')
                            );
                            [...videos, ...fallbackItems.filter(v => !videos.includes(v))].slice(0, 4).forEach((item) => {
                                defaultIds.add(item.id);
                            });
                            setSelectedMediaIds(defaultIds);
                            console.log('[ProductVideoCreationModal] ✅ Fallback appliqué:', fallbackItems.length, 'médias');
                            return [];
                        }
                    } catch (fallbackError) {
                        console.error('[ProductVideoCreationModal] Erreur fallback:', fallbackError);
                    }
                }

                // Seulement afficher l'alerte si le fallback n'a rien trouvé
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
                    // ✅ CORRIGÉ: Préparer les médias disponibles avec validation
                    const availableMedia = [
                        ...productMedia
                            .filter(m => m.path && m.path.trim().length > 0) // Filtrer les médias sans path
                            .map(m => {
                                const mediaUrl = m.path ? buildMediaUrl(m.path) : undefined;
                                return {
                                    id: m.id.toString(),
                                    url: mediaUrl,
                                    media_type: (m.type || m.media_type || 'image') === 'image' ? 'image' : 'video',
                                };
                            })
                            .filter(m => m.url && m.url.trim().length > 0), // Filtrer les médias sans URL valide
                        ...serviceMedia
                            .filter(m => m.path && m.path.trim().length > 0) // Filtrer les médias sans path
                            .map(m => {
                                const mediaUrl = m.path ? buildMediaUrl(m.path) : undefined;
                                return {
                                    id: m.id.toString(),
                                    url: mediaUrl,
                                    media_type: (m.type || m.media_type || 'image') === 'image' ? 'image' : 'video',
                                };
                            })
                            .filter(m => m.url && m.url.trim().length > 0), // Filtrer les médias sans URL valide
                    ];

                    // ✅ CORRIGÉ: Log pour diagnostic
                    console.log('[ProductVideoCreationModal] Médias disponibles pour timeline:', {
                        productMediaCount: productMedia.length,
                        serviceMediaCount: serviceMedia.length,
                        availableMediaCount: availableMedia.length,
                        availableMedia: availableMedia.map(m => ({ id: m.id, url: m.url?.substring(0, 50) + '...', media_type: m.media_type })),
                    });

                    // ✅ CORRIGÉ: Vérifier qu'il y a des médias disponibles
                    if (availableMedia.length === 0) {
                        console.warn('[ProductVideoCreationModal] ⚠️ Aucun média disponible pour générer la timeline');
                        // Ne pas générer la timeline si aucun média n'est disponible
                        return;
                    }

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
                            // ✅ CORRIGÉ: Vérifier que la timeline contient des médias valides
                            const hasValidMedia = responseData.timeline.scenes.some((scene: any) => {
                                return (scene.media_url && typeof scene.media_url === 'string' && scene.media_url.trim().length > 0) ||
                                    (scene.media_id !== null && scene.media_id !== undefined);
                            });

                            if (!hasValidMedia) {
                                console.warn('[ProductVideoCreationModal] ⚠️ Timeline générée sans médias valides:', responseData.timeline);
                                // Ne pas définir la timeline si elle n'a pas de médias
                                // L'utilisateur devra utiliser le storyboard texte à la place
                            } else {
                                console.log('[ProductVideoCreationModal] ✅ Timeline générée avec médias:', responseData.timeline);
                                setGeneratedTimeline(responseData.timeline);

                                // ✅ CORRIGÉ À LA RACINE: Sauvegarder la timeline dans la session Studio
                                try {
                                    let sessionId = studioSessionId;

                                    // Créer la session si elle n'existe pas
                                    if (!sessionId && selectedProduct?.serviceId) {
                                        const serviceIdNum = Number(selectedProduct.serviceId);
                                        if (Number.isFinite(serviceIdNum) && serviceIdNum > 0) {
                                            try {
                                                const existing = await studioService.listSessions();
                                                if (existing.length > 0) {
                                                    sessionId = existing[0].id;
                                                    setStudioSessionId(sessionId);
                                                } else {
                                                    const payload: import('../services/studioService').CreateStudioSessionPayload = {
                                                        service_id: serviceIdNum,
                                                        brief: { raw: scriptNotes || headline || normalizeProductName(selectedProduct) },
                                                        metadata: {
                                                            product_name: normalizeProductName(selectedProduct),
                                                            product_index: selectedProduct.product_index,
                                                        },
                                                        distribution_plan: [],
                                                    };
                                                    const aggregate = await studioService.createSession(payload);
                                                    if (aggregate?.session?.id) {
                                                        sessionId = aggregate.session.id;
                                                        setStudioSessionId(sessionId);
                                                    }
                                                }
                                            } catch (sessionError: any) {
                                                console.warn('[ProductVideoCreationModal] ⚠️ Erreur création session pour timeline:', sessionError);
                                            }
                                        }
                                    }

                                    if (sessionId && responseData.timeline.scenes.length > 0) {
                                        // ✅ CORRIGÉ: Mapper les médias disponibles pour remplir media_url si manquant
                                        const allMedia = [...productMedia, ...serviceMedia];
                                        const mediaMap = new Map<number | string, string>();
                                        allMedia.forEach(media => {
                                            if (media.path) {
                                                const url = buildMediaUrl(media.path);
                                                if (url) {
                                                    mediaMap.set(media.id, url);
                                                }
                                            }
                                        });

                                        // Convertir les scènes en TimelineClipInput[]
                                        const clips: import('../services/studioService').TimelineClipInput[] = responseData.timeline.scenes.map((scene) => {
                                            // ✅ CORRIGÉ: Remplir media_url si manquant en utilisant media_id
                                            let mediaUrl = scene.media_url;
                                            if (!mediaUrl && scene.media_id) {
                                                const mediaId = typeof scene.media_id === 'string'
                                                    ? parseInt(scene.media_id, 10)
                                                    : scene.media_id;
                                                if (!isNaN(mediaId)) {
                                                    mediaUrl = mediaMap.get(mediaId) || undefined;
                                                }
                                            }

                                            // ✅ FALLBACK: Si toujours pas de media_url, utiliser le premier média disponible
                                            if (!mediaUrl && allMedia.length > 0) {
                                                const firstMedia = allMedia[0];
                                                if (firstMedia.path) {
                                                    mediaUrl = buildMediaUrl(firstMedia.path);
                                                }
                                            }

                                            return {
                                                position: scene.scene_index,
                                                lane: null,
                                                duration_seconds: scene.duration,
                                                payload: {
                                                    scene_index: scene.scene_index,
                                                    start_time: scene.start_time,
                                                    media_id: scene.media_id,
                                                    media_url: mediaUrl || null,
                                                    text: scene.text,
                                                    text_position: scene.text_position,
                                                    transition: scene.transition,
                                                    effects: scene.effects,
                                                    audio_cue: scene.audio_cue,
                                                },
                                            };
                                        });

                                        console.log('[ProductVideoCreationModal] 💾 Sauvegarde timeline dans session Studio:', {
                                            sessionId,
                                            clipsCount: clips.length,
                                        });

                                        await studioService.saveTimeline(sessionId, clips);
                                        console.log('[ProductVideoCreationModal] ✅ Timeline sauvegardée avec succès');
                                    } else {
                                        console.warn('[ProductVideoCreationModal] ⚠️ Impossible de sauvegarder timeline: sessionId manquant ou timeline vide', {
                                            sessionId,
                                            scenesCount: responseData.timeline.scenes.length,
                                        });
                                    }
                                } catch (saveError: any) {
                                    console.error('[ProductVideoCreationModal] ❌ Erreur sauvegarde timeline:', saveError);
                                    // Ne pas bloquer l'utilisateur si la sauvegarde échoue
                                }

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
        studioSessionId,
        scriptNotes,
        headline,
    ]);

    const handleRefreshCoach = useCallback(() => {
        coachPrefetchDoneRef.current = false;
        prefetchCoachInsights().catch((error) =>
            console.warn('[ProductVideoCreationModal] Coach IA: rafraëchissement impossible', error)
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

    // ✅ NOUVEAU: Charger les sessions disponibles pour le chaënage
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

    // ✅ CORRIGÉ 2025-12-24: Scroller vers le haut automatiquement lors du changement d'étape
    useEffect(() => {
        if (visible && mainScrollViewRef.current) {
            // Petit délai pour s'assurer que le contenu est rendu
            setTimeout(() => {
                if (mainScrollViewRef.current) {
                    mainScrollViewRef.current.scrollTo({ y: 0, animated: true });
                }
            }, 150);
        }
    }, [activeStep, visible]);

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
                Alert.alert('Brief généré', 'Le script et le CTA ont été optimisés par Yukpo IA.');
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
            setCallToAction('Commandez maintenant sur Yukpo ✅');
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
        const defaultHeadline = `🔥 ${productName} en ${getFieldValue(selectedProduct.city) || 'promo'}`;
        const defaultCTA = `📞 Contactez ${extractServiceName(selectedProduct, 'nous')} sur Yukpo`;

        setHeadline(defaultHeadline);
        setCallToAction(defaultCTA);
        setIncludePromotion(Boolean(selectedProduct.promotionActive));
        setSelectedRelatedProducts(new Set());
        setVoiceoverScript(
            buildDefaultVoiceover(productName, defaultHeadline, defaultCTA, [])
        );

        void refreshMedia(selectedProduct);
    }, [visible, selectedProduct, refreshMedia]);

    // ✅ NOUVEAU: Rafraîchir les médias quand on arrive à l'étape 4 pour s'assurer qu'ils sont disponibles
    useEffect(() => {
        if (visible && selectedProduct && activeStep === 3) { // activeStep est 0-indexed, étape 4 = index 3
            console.log('[ProductVideoCreationModal] Rafraîchissement des médias pour l\'étape 4');
            void refreshMedia(selectedProduct);
        }
    }, [visible, selectedProduct, activeStep, refreshMedia]);

    // ✅ NOUVEAU: Analyse automatique des médias sélectionnés (images et vidéos)
    useEffect(() => {
        // Analyser automatiquement quand des médias sont sélectionnés et qu'on est à l'étape 2
        if (visible && selectedProduct && activeStep === 2 && selectedMediaIds.size > 0 && productMedia.length > 0) {
            // Attendre un peu pour éviter les analyses multiples lors du chargement initial
            const timeoutId = setTimeout(() => {
                // Vérifier qu'il y a des médias avec des descriptions IA à analyser
                const hasMediaWithDescriptions = [...productMedia, ...serviceMedia].some(item =>
                    item.ai_description && item.ai_description.trim() !== ''
                );

                // Analyser seulement si on n'a pas déjà une analyse récente
                if (hasMediaWithDescriptions && Object.keys(mediaAnalysis).length === 0) {
                    console.log('[ProductVideoCreationModal] 🔍 Analyse automatique des médias sélectionnés');
                    handleAnalyzeMedia().catch(error => {
                        console.warn('[ProductVideoCreationModal] ⚠️ Erreur analyse automatique:', error);
                        // Ne pas bloquer l'utilisateur si l'analyse automatique échoue
                    });
                }
            }, 2000); // Attendre 2 secondes après la sélection

            return () => clearTimeout(timeoutId);
        }
    }, [visible, selectedProduct, activeStep, selectedMediaIds, productMedia, serviceMedia, mediaAnalysis, handleAnalyzeMedia]);

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
        if (!selectedProduct || !selectedProduct.serviceId) {
            console.warn('[ProductVideoCreationModal] ensureStudioSession: selectedProduct ou serviceId manquant', {
                selectedProduct: selectedProduct ? { serviceId: selectedProduct.serviceId } : null,
            });
            return undefined;
        }

        // ✅ CORRIGÉ: Convertir serviceId en nombre (peut être string ou number)
        const serviceIdStr = String(selectedProduct.serviceId).trim();
        const serviceIdNum = Number(serviceIdStr);

        if (!Number.isFinite(serviceIdNum) || serviceIdNum <= 0) {
            console.warn('[ProductVideoCreationModal] ensureStudioSession: serviceId invalide', {
                serviceId: selectedProduct.serviceId,
                serviceIdType: typeof selectedProduct.serviceId,
            });
            return undefined;
        }

        try {
            // ✅ AMÉLIORÉ: Logging détaillé pour diagnostic
            console.log('[ProductVideoCreationModal] ensureStudioSession: Vérification sessions existantes...');
            const existing = await studioService.listSessions();
            console.log('[ProductVideoCreationModal] ensureStudioSession: Sessions existantes:', existing.length);

            if (existing.length > 0) {
                const sessionId = existing[0].id;
                console.log('[ProductVideoCreationModal] ensureStudioSession: Réutilisation session existante:', sessionId);
                setStudioSessionId(sessionId);
                return sessionId;
            }

            // ✅ AMÉLIORÉ: Créer une nouvelle session avec payload complet
            const payload: import('../services/studioService').CreateStudioSessionPayload = {
                service_id: serviceIdNum,
                brief: { raw: scriptNotes || headline || normalizeProductName(selectedProduct) },
                metadata: {
                    product_name: normalizeProductName(selectedProduct),
                    product_index: selectedProduct.product_index,
                },
                distribution_plan: [],
            };

            console.log('[ProductVideoCreationModal] ensureStudioSession: Création nouvelle session avec payload:', {
                service_id: payload.service_id,
                brief: payload.brief,
            });

            const aggregate = await studioService.createSession(payload);

            if (!aggregate || !aggregate.session || !aggregate.session.id) {
                console.error('[ProductVideoCreationModal] ensureStudioSession: Réponse invalide de createSession:', aggregate);
                throw new Error('Réponse invalide de l\'API Studio');
            }

            const sessionId = aggregate.session.id;
            console.log('[ProductVideoCreationModal] ensureStudioSession: ✅ Session créée avec succès:', sessionId);
            setStudioSessionId(sessionId);
            return sessionId;
        } catch (error: any) {
            // ✅ AMÉLIORÉ: Logging détaillé de l'erreur
            console.error('[ProductVideoCreationModal] ensureStudioSession: ❌ Erreur création session Studio', {
                error: error?.message || String(error),
                stack: error?.stack,
                response: error?.response?.data,
                status: error?.response?.status,
                serviceId: selectedProduct?.serviceId,
            });

            // ✅ AMÉLIORÉ: Message d'erreur plus informatif pour l'utilisateur
            const errorMessage = error?.response?.data?.error || error?.message || 'Erreur inconnue';
            console.warn('[ProductVideoCreationModal] session Studio indisponible:', errorMessage);

            return undefined;
        }
    }, [selectedProduct, scriptNotes, headline, studioSessionId]);

    // ✅ NOUVEAU: Generate Storyboard via Studio (depuis Wizard)
    const handleGenerateStoryboard = useCallback(async () => {
        if (!selectedProduct) {
            Alert.alert('Produit requis', 'Sélectionnez un produit avant de générer un storyboard.');
            return;
        }

        // ✅ AMÉLIORÉ: Vérifier que le serviceId est valide (peut être string ou number)
        const serviceIdStr = String(selectedProduct.serviceId || '').trim();
        const serviceIdNum = Number(serviceIdStr);

        if (!serviceIdStr || !Number.isFinite(serviceIdNum) || serviceIdNum <= 0) {
            Alert.alert(
                'Erreur',
                'Le service associé au produit est invalide. Veuillez sélectionner un autre produit.'
            );
            console.error('[ProductVideoCreationModal] handleGenerateStoryboard: serviceId invalide', {
                serviceId: selectedProduct.serviceId,
                serviceIdType: typeof selectedProduct.serviceId,
                product: selectedProduct,
            });
            return;
        }

        const startedAt = Date.now();
        trackUxEvent('storyboard_generate_click', {
            device: 'mobile',
            serviceId: serviceIdNum,
            productIndex: selectedProduct.product_index,
            sessionId: studioSessionId,
            step: activeStep,
        });

        // ✅ AMÉLIORÉ: Gestion d'erreur plus détaillée
        let sessionId: string | undefined;
        try {
            sessionId = await ensureStudioSession();
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] handleGenerateStoryboard: Erreur ensureStudioSession', error);
            Alert.alert(
                'Erreur de session',
                `Impossible de créer une session Studio: ${error?.message || 'Erreur inconnue'}. Vérifiez votre connexion et réessayez.`
            );
            return;
        }

        if (!sessionId) {
            Alert.alert(
                'Erreur de session',
                'Impossible de créer une session Studio. Vérifiez que:\n• Votre connexion internet est active\n• Le service est valide\n• Vous avez les permissions nécessaires'
            );
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
                serviceId: serviceIdNum,
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
                serviceId: serviceIdNum,
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

            // ✅ NOUVEAU: Vérifier que la timeline existe et attacher les médias manquants
            try {
                const session = await studioService.getSession(studioSessionId);
                if (!session || !session.timeline || session.timeline.length === 0) {
                    throw new Error('La timeline est vide. Ajoutez d\'abord des médias à votre timeline.');
                }

                // ✅ CORRIGÉ: Attacher les médias disponibles comme assets dynamiques si nécessaire
                const allMedia = [...productMedia, ...serviceMedia];
                if (allMedia.length > 0) {
                    console.log('[ProductVideoCreationModal] 📎 Attachement des médias à la session...');
                    for (const media of allMedia.slice(0, 10)) { // Limiter à 10 médias
                        if (media.path) {
                            const mediaUrl = buildMediaUrl(media.path);
                            if (mediaUrl) {
                                try {
                                    await studioService.attachAsset(studioSessionId, {
                                        asset_type: (media.type || media.media_type || 'image') === 'video' ? 'video' : 'image',
                                        public_url: mediaUrl,
                                        metadata: {
                                            media_id: media.id,
                                            product_index: media.product_index,
                                        },
                                    });
                                } catch (attachError: any) {
                                    console.warn('[ProductVideoCreationModal] ⚠️ Erreur attachement média:', attachError);
                                    // Continuer même si l'attachement échoue
                                }
                            }
                        }
                    }
                    console.log('[ProductVideoCreationModal] ✅ Médias attachés à la session');
                }
            } catch (checkError: any) {
                console.warn('[ProductVideoCreationModal] Vérification timeline:', checkError);
                // Si la vérification échoue, on continue quand même (l'API retournera une erreur plus claire)
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

            // ✅ CORRIGÉ: Message d'erreur plus informatif selon le type d'erreur
            let errorMessage = error?.message || 'Impossible de générer la prévisualisation.';

            // ✅ AMÉLIORÉ: Détecter les erreurs de configuration du renderer
            if (errorMessage.includes('n\'est pas configuré') ||
                errorMessage.includes('VIDEO_RENDERER') ||
                errorMessage.includes('Configuration manquante')) {
                errorMessage = 'Le service de prévisualisation vidéo n\'est pas configuré sur le serveur.\n\n' +
                    'Contactez l\'administrateur pour activer le service de rendu vidéo.\n\n' +
                    'En attendant, vous pouvez utiliser le "Preview Rapide" ci-dessus pour avoir un aperçu de votre vidéo.';
            } else if (errorMessage.includes('temporairement indisponible') ||
                errorMessage.includes('indisponible')) {
                errorMessage = 'Le service de prévisualisation vidéo est temporairement indisponible.\n\n' +
                    'Vous pouvez utiliser le "Preview Rapide" ci-dessus pour avoir un aperçu de votre vidéo.';
            } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request') ||
                errorMessage.includes('Erreur de configuration')) {
                // ✅ CORRIGÉ: Message plus détaillé pour l'erreur 400
                // Vérifier si le message d'erreur contient des détails du backend
                const backendError = (error as any)?.response?.data?.error ||
                    (error as any)?.response?.data?.message ||
                    errorMessage;

                if (backendError.includes('timeline') ||
                    backendError.includes('sans timeline') ||
                    backendError.includes('Impossible de générer un aperçu sans timeline')) {
                    errorMessage = 'Impossible de générer la prévisualisation : la timeline est vide.\n\n' +
                        'Solutions :\n' +
                        '• Générez d\'abord un storyboard (étape 1)\n' +
                        '• Ajoutez des médias à votre timeline\n' +
                        '• Utilisez le "Preview Rapide" ci-dessus pour avoir un aperçu';
                } else if (backendError.includes('Erreur temporaire') ||
                    backendError.includes('réessayer')) {
                    errorMessage = 'Erreur temporaire lors de la génération de la prévisualisation.\n\n' +
                        'Veuillez réessayer dans quelques instants.\n\n' +
                        'Si le problème persiste, utilisez le "Preview Rapide" ci-dessus.';
                } else {
                    errorMessage = 'Erreur lors de la génération de la prévisualisation.\n\n' +
                        (backendError !== errorMessage ? backendError + '\n\n' : '') +
                        'Vérifiez que votre timeline contient des médias et réessayez.\n\n' +
                        'Si le problème persiste, utilisez le "Preview Rapide" ci-dessus.';
                }
            }

            Alert.alert('Erreur', errorMessage);
        } finally {
            setShortPreviewLoading(false);
        }
    }, [studioSessionId, prewarmedShortPreviewUrl, selectedProduct, activeStep]);

    const renderStep1 = () => {
        // ✅ ÉTAPE 1 NETTOYÉE : Sélection produit + Configuration livraison uniquement
        return (
            <>
                {renderProductSelection()}

                {/* ✅ Configuration de livraison */}
                {selectedProduct && (
                    <NativeCard style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>🚚 Configuration de livraison</Text>
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            Activez la livraison pour permettre aux clients de commander directement depuis la vidéo (bouton "Me livrer").
                        </Text>
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleText}>
                                <Text style={styles.toggleLabel}>Livraison activée</Text>
                                <Text style={styles.toggleDescription}>
                                    Les clients pourront commander la livraison directement depuis la vidéo
                                </Text>
                            </View>
                            <Switch
                                value={enableDelivery}
                                onValueChange={(value) => {
                                    setEnableDelivery(value);
                                    if (value && selectedProduct?.serviceId && typeof selectedProduct.product_index === 'number') {
                                        // Charger la config existante si elle existe
                                        loadDeliveryConfig(Number(selectedProduct.serviceId), selectedProduct.product_index);
                                    }
                                }}
                                trackColor={{ true: modernColors.primary }}
                            />
                        </View>
                        {enableDelivery && (
                            <>
                                {loadingDeliveryConfig ? (
                                    <ActivityIndicator size="small" color={modernColors.primary} style={{ marginTop: 12 }} />
                                ) : deliveryConfig?.is_configured ? (
                                    <View style={styles.deliveryConfigStatus}>
                                        <SafeIcon name="check-circle" size={16} color="#10B981" />
                                        <Text style={styles.deliveryConfigStatusText}>
                                            ✅ Configuration complète - Le bouton "Me livrer" apparaîtra sur la vidéo
                                        </Text>
                                        {deliveryConfig?.pickup_address && (
                                            <Text style={styles.deliveryConfigAddress}>
                                                📍 {deliveryConfig?.pickup_address}
                                            </Text>
                                        )}
                                        <TouchableOpacity
                                            style={styles.configureButton}
                                            onPress={() => setShowDeliveryConfigModal(true)}
                                        >
                                            <SafeIcon name="settings" size={16} color={modernColors.primary} />
                                            <Text style={styles.configureButtonText}>
                                                Modifier la configuration
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.deliveryConfigHint}>
                                        <SafeIcon name="info" size={16} color={modernColors.primary} />
                                        <Text style={styles.deliveryConfigHintText}>
                                            ⚠️ Configuration incomplète - Configurez les détails de livraison pour activer le bouton "Me livrer"
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.configureButton}
                                            onPress={() => setShowDeliveryConfigModal(true)}
                                        >
                                            <SafeIcon name="settings" size={16} color={modernColors.primary} />
                                            <Text style={styles.configureButtonText}>
                                                Configurer la livraison
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}
                    </NativeCard>
                )}

                {/* ✅ SUPPRIMÉ: coachPanel retiré de l'étape 1 pour éviter le doublon avec les autres étapes */}
                {selectedProduct && renderRelatedProducts()}
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
                        onPress={async () => {
                            // ✅ CORRIGÉ 2025-12-24: Vérifier les permissions avant d'ouvrir AR avec gestion d'erreur robuste
                            try {
                                // ✅ CORRIGÉ: Utiliser primaryProduct comme fallback si selectedProduct n'est pas défini
                                const productToUse = selectedProduct || primaryProduct;

                                if (!productToUse) {
                                    Alert.alert(
                                        'Produit requis',
                                        'Veuillez d\'abord sélectionner un produit avant d\'ouvrir l\'éditeur AR.'
                                    );
                                    return;
                                }

                                // ✅ CORRIGÉ: Extraire product_index de manière robuste (vérifier product_index ET productIndex)
                                const productIndexValue = (() => {
                                    // Priorité 1: product_index (standard)
                                    if (typeof productToUse.product_index === 'number' && productToUse.product_index >= 0) {
                                        return productToUse.product_index;
                                    }
                                    // Priorité 2: productIndex (alternative)
                                    if (typeof productToUse.productIndex === 'number' && productToUse.productIndex >= 0) {
                                        return productToUse.productIndex;
                                    }
                                    // Priorité 3: Essayer de convertir depuis id si format "serviceId_index"
                                    if (typeof productToUse.id === 'string' && productToUse.id.includes('_')) {
                                        const parts = productToUse.id.split('_');
                                        if (parts.length >= 2) {
                                            const lastPart = parts[parts.length - 1];
                                            const parsed = parseInt(lastPart, 10);
                                            if (!isNaN(parsed) && parsed >= 0) {
                                                return parsed;
                                            }
                                        }
                                    }
                                    return null;
                                })();

                                if (productIndexValue === null || productIndexValue < 0) {
                                    console.error('[ProductVideoCreationModal] ❌ product_index invalide avant ouverture AR:', {
                                        product_id: productToUse.id,
                                        product_index: productToUse.product_index,
                                        productIndex: productToUse.productIndex,
                                        serviceId: productToUse.serviceId,
                                        product_name: productToUse.nom || productToUse.titre
                                    });
                                    Alert.alert(
                                        'Produit invalide',
                                        'Le produit sélectionné n\'a pas d\'index valide. Veuillez sélectionner un autre produit ou contacter le support.'
                                    );
                                    return;
                                }

                                if (!productToUse.serviceId) {
                                    Alert.alert(
                                        'Service invalide',
                                        'Le produit sélectionné n\'a pas de service associé. Veuillez sélectionner un autre produit.'
                                    );
                                    return;
                                }

                                // ✅ S'assurer que selectedProduct est mis à jour si on utilise primaryProduct
                                if (!selectedProduct && productToUse) {
                                    setSelectedProduct(productToUse);
                                }

                                // ✅ NOUVEAU: Stocker le produit courant au moment de l'ouverture de l'éditeur AR
                                // Cela garantit que la vidéo AR sera liée au bon produit même si selectedProduct change
                                // ✅ CORRIGÉ: Créer un produit normalisé avec product_index garanti
                                const normalizedProduct = {
                                    ...productToUse,
                                    product_index: productIndexValue,
                                    productIndex: productIndexValue
                                };
                                setArEditorProduct(normalizedProduct);
                                console.log('[ProductVideoCreationModal] 📌 Produit stocké pour AR:', {
                                    serviceId: productToUse.serviceId,
                                    product_index: productIndexValue,
                                    product_name: productToUse.nom || productToUse.titre
                                });

                                // ✅ CORRIGÉ: Vérifier que react-native-vision-camera est disponible avec try-catch robuste
                                let CameraModule: any = null;
                                try {
                                    const visionCameraModule = await import('react-native-vision-camera');
                                    CameraModule = visionCameraModule?.Camera || visionCameraModule?.default?.Camera;
                                    if (!CameraModule) {
                                        throw new Error('Camera module not available');
                                    }
                                } catch (importError: any) {
                                    console.error('[ProductVideoCreationModal] Camera module not available:', importError);
                                    Alert.alert(
                                        'Fonctionnalité non disponible',
                                        'L\'éditeur AR nécessite react-native-vision-camera. Veuillez mettre à jour l\'application.'
                                    );
                                    return;
                                }

                                // ✅ CORRIGÉ: Vérifier que le composant ARVideoEditor peut être chargé
                                try {
                                    setShowAREditor(true);
                                } catch (arError: any) {
                                    console.error('[ProductVideoCreationModal] Erreur ouverture AR:', arError);
                                    Alert.alert(
                                        'Erreur',
                                        `Impossible d'ouvrir l'éditeur AR: ${arError?.message || 'Erreur inconnue'}`
                                    );
                                }
                            } catch (error: any) {
                                console.error('[ProductVideoCreationModal] Erreur générale ouverture AR:', error);
                                Alert.alert(
                                    'Erreur',
                                    `Impossible d'ouvrir l'éditeur AR: ${error?.message || 'Erreur inconnue'}`
                                );
                            }
                        }}
                        style={styles.arButton}
                        disabled={!selectedProduct}
                    />
                    {/* ✅ CORRIGÉ: Protection contre l'affichage de booléens comme texte */}
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
                {/* ✅ Templates Narratifs Serveur (déplacé depuis étape 1) */}
                {selectedProduct && storyTemplates.length > 0 && (
                    <NativeCard style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>📝 Templates narratifs</Text>
                            {storyTemplatesLoading && (
                                <ActivityIndicator size="small" color={modernColors.primary} />
                            )}
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            Choisissez un template pour structurer votre vidéo.
                        </Text>
                        <View style={styles.templateList}>
                            {storyTemplates.slice(0, 4).map((spec) => {
                                const active = spec.id === storyTemplateId;
                                return (
                                    <TouchableOpacity
                                        key={spec.id}
                                        style={[styles.templateCard, active && styles.templateCardActive]}
                                        onPress={() => setStoryTemplateId(spec.id)}
                                    >
                                        <Text style={[styles.templateTitle, active && styles.templateTitleActive]}>
                                            {spec.label}
                                        </Text>
                                        <Text style={styles.templateDescription} numberOfLines={2}>
                                            {spec.description}
                                        </Text>
                                        <Text style={styles.templateMeta}>
                                            {spec.suggestedScenes} scènes • ~{spec.defaultDurationSeconds}s
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </NativeCard>
                )}

                {/* ✅ Storyboard IA via Studio (déplacé depuis étape 1) */}
                {selectedProduct && (
                    <NativeCard style={styles.sectionCard}>
                        <Text style={[styles.sectionTitle, { marginBottom: 12 }]} numberOfLines={1}>🎬 Storyboard IA</Text>
                        <TouchableOpacity
                            style={[styles.linkButton, { alignSelf: 'flex-start' }]}
                            onPress={handleGenerateStoryboard}
                            disabled={storyboardLoading}
                        >
                            {storyboardLoading ? (
                                <ActivityIndicator size="small" color={modernColors.primary} />
                            ) : (
                                <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                            )}
                            <Text style={styles.linkButtonText}>
                                {storyboardLoading ? 'Génération…' : 'Générer storyboard'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.sectionSubtitle}>
                            Génère une proposition de scènes (intro, bénéfices, preuves, CTA) à partir de ton brief.
                        </Text>
                        {/* ✅ Auto-Storyboard Toggle */}
                        <View style={styles.inlineRow}>
                            <Text style={styles.inlineLabel}>Storyboard automatique</Text>
                            <Switch
                                value={autoStoryboard}
                                onValueChange={setAutoStoryboard}
                                trackColor={{ true: modernColors.primary }}
                            />
                        </View>
                        {storyboard && storyboard.scenes.length > 0 && (
                            <View style={styles.storyboardList}>
                                {storyboard.scenes.slice(0, 4).map((scene) => {
                                    // ✅ CORRIGÉ 2025-12-24: Nettoyer et formater le texte pour un meilleur rendu
                                    const sceneText = (scene.headline || scene.body || 'Scène générée')
                                        .replace(/\n+/g, ' ') // Remplacer les retours à la ligne multiples par un espace
                                        .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul espace
                                        .trim(); // Supprimer les espaces en début/fin

                                    return (
                                        <View key={scene.index} style={styles.storyboardItem}>
                                            <Text style={styles.storyboardSceneType}>
                                                {scene.sceneType}
                                            </Text>
                                            <Text
                                                style={styles.storyboardSceneText}
                                                numberOfLines={2}
                                                ellipsizeMode="tail"
                                            >
                                                {sceneText}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </NativeCard>
                )}

                <NativeCard style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>✍️ Script de montage</Text>
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
                            placeholder="Ex: 🎯 Promotion spéciale sur nos mèches premium !"
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
                            <Text style={styles.fieldLabel}>✍️ Script de montage</Text>
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

                {/* ✅ NOUVEAU: Auto-cut intelligent - CORRIGÉ: Utiliser les vidéos sélectionnées, fallback sur timeline générée */}
                {(() => {
                    let videoUrl = '';
                    let videoId: number | undefined = undefined;

                    // ✅ ÉTAPE 1: Essayer d'utiliser les vidéos sélectionnées
                    if (selectedMediaIds.size > 0) {
                        const selectedVideoIds = Array.from(selectedMediaIds).filter(id => {
                            const media = productMedia.find(m => m.id === id) || serviceMedia.find(m => m.id === id);
                            return media && (media.type === 'video' || media.media_type === 'video');
                        });

                        if (selectedVideoIds.length > 0) {
                            const firstVideoId = selectedVideoIds[0];
                            const firstVideo = productMedia.find(m => m.id === firstVideoId) ||
                                serviceMedia.find(m => m.id === firstVideoId);
                            const url = firstVideo ? buildMediaUrl(firstVideo.path) : '';

                            if (url) {
                                videoUrl = url;
                                videoId = firstVideoId;
                                console.log('[ProductVideoCreationModal] AutoCutPanel: Utilisation vidéo sélectionnée, videoId:', videoId);
                            }
                        }
                    }

                    // ✅ ÉTAPE 2: Fallback - Utiliser la timeline générée si elle contient des vidéos
                    if (!videoUrl && generatedTimeline && generatedTimeline.scenes.length > 0) {
                        // Chercher la première scène avec un media_url valide (vidéo)
                        for (const scene of generatedTimeline.scenes) {
                            if (scene.media_url && scene.media_url.trim() !== '') {
                                // Vérifier si c'est une vidéo (extension .mp4, .mov, etc. ou contient 'video' dans l'URL)
                                const urlLower = scene.media_url.toLowerCase();
                                const hasVideoExtension = /\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv|3gp)(\?|$)/i.test(scene.media_url);
                                const containsVideo = urlLower.includes('video') || urlLower.includes('/videos/');

                                // Si c'est clairement une vidéo, l'utiliser
                                if (hasVideoExtension || containsVideo) {
                                    videoUrl = scene.media_url;
                                    console.log('[ProductVideoCreationModal] AutoCutPanel: Utilisation timeline générée (fallback), media_url:', videoUrl.substring(0, 100));
                                    break;
                                }
                                // ✅ Si aucune vidéo n'a été trouvée mais qu'il y a un media_url, 
                                // on peut quand même l'essayer (peut être une vidéo sans extension visible)
                                // mais on préfère chercher d'abord une vraie vidéo
                            }
                        }

                        // ✅ Si toujours aucune vidéo trouvée mais qu'il y a au moins une scène avec media_url,
                        // utiliser la première scène avec media_url (peut être une vidéo)
                        if (!videoUrl) {
                            for (const scene of generatedTimeline.scenes) {
                                if (scene.media_url && scene.media_url.trim() !== '') {
                                    videoUrl = scene.media_url;
                                    console.log('[ProductVideoCreationModal] AutoCutPanel: Utilisation timeline générée (fallback - première scène avec media_url)');
                                    break;
                                }
                            }
                        }
                    }

                    // ✅ Ne pas afficher si aucune vidéo n'est disponible
                    if (!videoUrl) {
                        return null;
                    }

                    return (
                        <AutoCutPanel
                            videoUrl={videoUrl}
                            videoId={videoId}
                            onScenesSelected={(scenes) => {
                                console.log('[ProductVideoCreationModal] Scènes sélectionnées:', scenes);
                                // Appliquer les scènes sélectionnées à la timeline si elle existe
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
                    );
                })()}

                {/* ✅ NOUVEAU: Color grading automatique */}
                {selectedMediaIds.size > 0 && Array.from(selectedMediaIds).length > 0 && (() => {
                    // ✅ CORRIGÉ: Convertir l'ID du média en URL
                    const firstMediaId = Array.from(selectedMediaIds)[0];
                    const firstMedia = productMedia.find(m => m.id === firstMediaId) ||
                        serviceMedia.find(m => m.id === firstMediaId);
                    const mediaUrl = firstMedia ? buildMediaUrl(firstMedia.path) : '';

                    // ✅ Ne pas afficher si aucune URL n'est disponible
                    if (!mediaUrl) {
                        console.warn('[ProductVideoCreationModal] Aucune URL média trouvée pour ColorGradingPanel, mediaId:', firstMediaId);
                        return null;
                    }

                    return (
                        <ColorGradingPanel
                            mediaUrl={mediaUrl}
                            onGradingComplete={(gradedUrl) => {
                                console.log('[ProductVideoCreationModal] Color grading appliqué:', gradedUrl);
                            }}
                        />
                    );
                })()}

                {/* ✅ NOUVEAU: Carousel de previews d'effets */}
                {styleSuggestion && styleSuggestion.effects && styleSuggestion.effects.length > 0 && selectedMediaIds.size > 0 && (() => {
                    // ✅ CORRIGÉ: Convertir l'ID du média en URL
                    const firstMediaId = Array.from(selectedMediaIds)[0];
                    const firstMedia = productMedia.find(m => m.id === firstMediaId) ||
                        serviceMedia.find(m => m.id === firstMediaId);
                    const sampleMediaUrl = firstMedia ? buildMediaUrl(firstMedia.path) : '';

                    // ✅ Ne pas afficher si aucune URL n'est disponible
                    if (!sampleMediaUrl) {
                        console.warn('[ProductVideoCreationModal] Aucune URL média trouvée pour EffectPreviewCarousel, mediaId:', firstMediaId);
                        return null;
                    }

                    return (
                        <EffectPreviewCarousel
                            effectNames={styleSuggestion.effects}
                            sampleMediaUrl={sampleMediaUrl}
                            onEffectSelected={(effectName, preview) => {
                                console.log('[ProductVideoCreationModal] Effet sélectionné:', effectName, preview.preview_url);
                                // Ajouter l'effet sélectionné
                                setSelectedEffects(prev => new Set(prev).add(effectName));
                            }}
                        />
                    );
                })()}

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
        // ✅ NOUVEAU: Afficher la progression du job si un job est en cours
        if (currentJobId && jobStatus && jobStatus !== 'completed' && jobStatus !== 'failed') {
            return (
                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>🎬 Génération en cours</Text>
                        </View>

                        <View style={styles.jobProgressContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} style={styles.jobProgressSpinner} />
                            <Text style={styles.jobProgressText}>
                                {jobStatus === 'queued' ? 'En attente...' : 'Génération de la vidéo...'}
                            </Text>
                            <Text style={styles.jobProgressSubtext}>
                                Job ID: {currentJobId.substring(0, 8)}...
                            </Text>

                            {/* Barre de progression */}
                            <View style={styles.progressBarContainer}>
                                <View style={[styles.progressBar, { width: `${jobProgress}%` }]} />
                            </View>
                            <Text style={styles.progressPercentage}>{Math.round(jobProgress)}%</Text>
                        </View>

                        <View style={styles.jobInfoContainer}>
                            <Text style={styles.jobInfoText}>
                                ⏱️ La génération peut prendre quelques minutes selon la durée et la complexité de la vidéo.
                            </Text>
                            <Text style={styles.jobInfoText}>
                                📱 Vous pouvez fermer cette fenêtre, vous recevrez une notification une fois la vidéo prête.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            );
        }

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
                                <Text style={styles.advancedSectionTitle}>💾 Formats de sortie</Text>
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
                                Ajoute votre CTA + boutons vers le chat Yukpo.
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

        // ✅ CORRIGÉ 2025-12-24: Scroller vers le haut lors du changement d'étape
        setTimeout(() => {
            if (mainScrollViewRef.current) {
                mainScrollViewRef.current.scrollTo({ y: 0, animated: true });
            }
        }, 100);
    };

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

        // ✅ CORRIGÉ: Vérifier que le script est rempli OU qu'un storyboard/brief existe
        const hasScript = scriptNotes.trim().length > 0;
        const hasStoryboard = storyboard && storyboard.scenes.length > 0;
        const hasBrief = briefVariants.length > 0 && briefVariants[0]?.script_outline?.length > 0;

        if (!hasScript && !hasStoryboard && !hasBrief) {
            Alert.alert(
                'Script requis',
                'Le script de montage vidéo est requis. Vous pouvez :\n\n' +
                '• Remplir manuellement le script\n' +
                '• Générer un storyboard IA (étape 1)\n' +
                '• Générer un brief IA (étape 4)\n\n' +
                'Une ligne = une scène.'
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
        // ✅ CORRIGÉ: Ne pas bloquer la génération si l'estimation échoue

        // ✅ CORRIGÉ: Construire le payload AVANT les vérifications pour pouvoir l'utiliser en cas d'erreur
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
                : (hasStoryboard && storyboard
                    ? storyboard.scenes.map(s => s.body || s.headline || '').filter(Boolean)
                    : hasBrief && briefVariants[0]?.script_outline
                        ? briefVariants[0].script_outline
                        : scriptNotes
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter((line) => line.length > 0)),
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
            // ✅ CORRIGÉ: Activer auto_generate_images par défaut si aucun média n'est disponible
            auto_generate_images: true,
            // ✅ NOTE: linked_session_ids retiré car non supporté dans VideoGenerationPayload
        };

        // ✅ NOUVEAU 2025-11-30: Estimer le coût et afficher dans un toast avant de générer
        // ✅ CORRIGÉ: Ne pas bloquer la génération si l'estimation échoue
        try {
            setCostLoading(true);
            const serviceId = selectedProduct.serviceId;

            // ✅ CORRIGÉ: Validations avant l'appel d'estimation
            if (!serviceId || serviceId === null || serviceId === undefined) {
                console.warn('[ProductVideoCreationModal] Service ID manquant, génération sans estimation de coût');
                setCostLoading(false);
                // ✅ CORRIGÉ: Continuer quand même avec la génération
                await proceedWithVideoGeneration(payloadForEstimation);
                return;
            }

            if (selectedProduct.product_index === null || selectedProduct.product_index === undefined || isNaN(Number(selectedProduct.product_index))) {
                console.warn('[ProductVideoCreationModal] Index produit invalide, génération sans estimation de coût');
                setCostLoading(false);
                // ✅ CORRIGÉ: Continuer quand même avec la génération (l'index peut être optionnel selon le backend)
                await proceedWithVideoGeneration(payloadForEstimation);
                return;
            }

            // ✅ CORRIGÉ: Vérifier que le payload contient les données minimales
            if (!payloadForEstimation || !payloadForEstimation.duration_seconds) {
                console.warn('[ProductVideoCreationModal] Payload incomplet, génération sans estimation de coût');
                setCostLoading(false);
                // ✅ CORRIGÉ: Continuer quand même avec la génération (le backend peut gérer les valeurs par défaut)
                await proceedWithVideoGeneration(payloadForEstimation);
                return;
            }

            const response = await iaApi.estimateVideoCost(serviceId, selectedProduct.product_index, payloadForEstimation);

            // ✅ CORRIGÉ: Validation de la réponse - Ne pas bloquer si l'estimation échoue
            if (!response || !response.success) {
                setCostLoading(false);
                const errorMsg = response?.error || 'Impossible d\'estimer le coût pour le moment.';
                console.warn('[ProductVideoCreationModal] Erreur estimation coût:', errorMsg);

                // ✅ CORRIGÉ: Proposer de continuer quand même
                Alert.alert(
                    'Estimation impossible',
                    errorMsg + '\n\nSouhaitez-vous continuer avec la génération de la vidéo ?',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Continuer quand même',
                            onPress: async () => {
                                await proceedWithVideoGeneration(payloadForEstimation);
                            },
                        },
                    ]
                );
                return;
            }

            const estimationResponse = response.data as VideoCostEstimateResponse | VideoCostEstimation | undefined;
            const estimation =
                estimationResponse && 'data' in estimationResponse
                    ? estimationResponse.data
                    : (estimationResponse as VideoCostEstimation | undefined);

            setCostLoading(false);

            if (!estimation) {
                setCostLoading(false);
                console.warn('[ProductVideoCreationModal] Estimation vide, proposer de continuer quand même');
                // ✅ CORRIGÉ: Proposer de continuer quand même
                Alert.alert(
                    'Estimation impossible',
                    'Impossible d\'estimer le coût pour le moment.\n\n' +
                    'Souhaitez-vous continuer avec la génération de la vidéo ?',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Continuer quand même',
                            onPress: async () => {
                                await proceedWithVideoGeneration(payloadForEstimation);
                            },
                        },
                    ]
                );
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

            // ✅ CORRIGÉ: Messages d'erreur améliorés
            let errorMessage = 'Erreur lors de l\'estimation du coût.';

            if (error?.message) {
                const msg = error.message.toLowerCase();
                if (msg.includes('500') || msg.includes('internal') || msg.includes('erreur 500')) {
                    errorMessage = 'Erreur serveur temporaire.\n\n' +
                        'Le serveur a rencontré une erreur lors de l\'estimation.\n\n' +
                        'Veuillez réessayer dans quelques instants.';
                } else if (msg.includes('400') || msg.includes('bad request') || msg.includes('invalide')) {
                    errorMessage = 'Demande invalide.\n\n' +
                        'Vérifiez que tous les champs sont correctement remplis et réessayez.';
                } else if (msg.includes('timeout') || msg.includes('timed out')) {
                    errorMessage = 'Le délai d\'attente a expiré.\n\n' +
                        'Veuillez réessayer.';
                } else {
                    errorMessage = error.message;
                }
            }

            Alert.alert('Erreur d\'estimation', errorMessage, [{ text: 'OK' }]);
        }
    };

    // ✅ NOUVEAU 2025-11-30: Fonction séparée pour la génération effective de la vidéo
    const proceedWithVideoGeneration = async (payload: VideoGenerationPayload) => {
        // ✅ CORRIGÉ: Validations complètes avant l'appel API
        if (!selectedProduct) {
            Alert.alert('Produit requis', 'Aucun produit sélectionné. Veuillez sélectionner un produit avant de générer la vidéo.');
            return;
        }

        const serviceId = selectedProduct.serviceId;
        const productIndex = selectedProduct.product_index;

        if (!serviceId || serviceId === null || serviceId === undefined) {
            Alert.alert(
                'Service invalide',
                'Le service ID est manquant ou invalide.\n\nVeuillez sélectionner un produit valide.',
                [{ text: 'OK' }]
            );
            return;
        }

        if (productIndex === null || productIndex === undefined || isNaN(Number(productIndex))) {
            Alert.alert(
                'Index produit invalide',
                'L\'index du produit est manquant ou invalide.\n\nVeuillez sélectionner un produit valide.',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Vérifier que le payload contient les données minimales
        if (!payload) {
            Alert.alert(
                'Données manquantes',
                'Les données de génération sont manquantes.\n\nVeuillez remplir les champs requis et réessayez.',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Vérifier que la durée est valide
        const durationSeconds = payload.duration_seconds || ensureNumber(duration, 28);
        if (!durationSeconds || durationSeconds < 10 || durationSeconds > 90) {
            Alert.alert(
                'Durée invalide',
                'La durée de la vidéo doit être comprise entre 10 et 90 secondes.\n\nVeuillez ajuster la durée et réessayez.',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Vérifier qu'il y a au moins un script, storyboard ou timeline
        const hasScript = payload.voiceover_script && payload.voiceover_script.trim().length > 0;
        const hasStoryboard = payload.storyboard && Array.isArray(payload.storyboard) && payload.storyboard.length > 0;
        const hasTimeline = payload.timeline && payload.timeline.scenes && payload.timeline.scenes.length > 0;

        if (!hasScript && !hasStoryboard && !hasTimeline) {
            Alert.alert(
                'Script requis',
                'Aucun script, storyboard ou timeline disponible.\n\n' +
                'Solutions :\n' +
                '• Remplissez le script de montage\n' +
                '• Générez un storyboard IA\n' +
                '• Générez un brief IA\n' +
                '• Créez une timeline avec des médias',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Vérifier qu'il y a des médias disponibles si nécessaire
        // Si auto_generate_images est activé, on permet la génération même sans médias
        const autoGenerateImages = payload.auto_generate_images !== false; // true par défaut
        const hasSelectedMedia = payload.selected_media_ids && Array.isArray(payload.selected_media_ids) && payload.selected_media_ids.length > 0;
        const useProductGallery = payload.use_product_gallery === true;
        const useServiceMediatech = payload.use_service_mediatech === true;
        const hasTimelineMedia = hasTimeline && payload.timeline.scenes.some((scene: any) => scene.media_id || scene.media_url);

        if (!autoGenerateImages && !hasSelectedMedia && !useProductGallery && !useServiceMediatech && !hasTimelineMedia) {
            Alert.alert(
                'Médias requis',
                'Aucun média disponible pour générer la vidéo.\n\n' +
                'Solutions :\n' +
                '• Sélectionnez des médias dans la médiathèque\n' +
                '• Activez "Utiliser galerie produit"\n' +
                '• Activez "Utiliser médiathèque service"\n' +
                '• Ajoutez des médias à la timeline\n' +
                '• La génération automatique d\'images IA sera activée automatiquement',
                [{ text: 'OK' }]
            );
            // ✅ CORRIGÉ: Activer auto_generate_images automatiquement si aucun média n'est disponible
            payload.auto_generate_images = true;
        }

        setIsSubmitting(true);

        try {
            // ✅ CORRIGÉ: S'assurer que le payload contient tous les champs requis
            const finalPayload: VideoGenerationPayload = {
                ...payload,
                duration_seconds: durationSeconds,
                // ✅ S'assurer que auto_generate_images est activé si aucun média n'est disponible
                auto_generate_images: payload.auto_generate_images !== false,
            };

            // ✅ DEBUG: Log du payload pour diagnostic
            console.log('[ProductVideoCreationModal] 🎬 Génération vidéo - Payload:', JSON.stringify(finalPayload, null, 2));
            console.log('[ProductVideoCreationModal] 🎬 Service ID:', serviceId);
            console.log('[ProductVideoCreationModal] 🎬 Product Index:', productIndex);

            const response = await mediaApi.generateProductVideo(
                serviceId,
                productIndex,
                finalPayload
            );

            // ✅ DEBUG: Log de la réponse
            console.log('[ProductVideoCreationModal] 🎬 Réponse génération:', response);

            if (!response.success || !response.data) {
                // ✅ CORRIGÉ: Extraire le message d'erreur du backend si disponible
                const backendError = response.error || 'Génération impossible';
                throw new Error(backendError);
            }

            const result = response.data as any;

            // ✅ CORRIGÉ: Le backend retourne maintenant un job_id (génération asynchrone)
            // Si job_id est présent, la génération est en cours
            if (result.job_id) {
                console.log('[ProductVideoCreationModal] ✅ Génération démarrée, job_id:', result.job_id);

                // ✅ NOUVEAU: Démarrer le polling pour suivre le statut
                setCurrentJobId(result.job_id);
                setJobStatus('queued');
                setJobProgress(0);
                completionHandledRef.current = false;

                // Démarrer le polling
                startJobPolling(result.job_id);

                // Afficher un message informatif mais ne pas fermer le modal immédiatement
                Alert.alert(
                    'Génération en cours',
                    'Votre vidéo est en cours de génération.\n\n' +
                    'Vous pouvez suivre la progression ci-dessous.\n\n' +
                    'Le modal restera ouvert pour afficher le résultat.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                // Ne pas fermer, continuer à afficher la progression
                            }
                        }
                    ]
                );
                return;
            }

            // ✅ Fallback: Si video_url est présent (ancienne version synchrone)
            if (result.video_url) {
                const videoResult = result as GeneratedVideoResponse;
                await onSuccess(videoResult);
                return;
            }

            // ✅ Si ni job_id ni video_url, c'est une erreur
            throw new Error('Réponse invalide : ni job_id ni video_url reçu');
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur génération vidéo:', error);

            // ✅ CORRIGÉ: Messages d'erreur améliorés avec détails spécifiques
            let errorMessage = 'Nous ne parvenons pas à générer la vidéo.';

            if (error?.message) {
                const msg = error.message.toLowerCase();
                if (msg.includes('aucune image') || msg.includes('image trouvée') || msg.includes('no media') || msg.includes('aucun média')) {
                    errorMessage = 'Aucun média disponible pour générer la vidéo.\n\n' +
                        'Solutions :\n' +
                        '• Ajoutez des images dans la médiathèque du service\n' +
                        '• Ajoutez des images au produit\n' +
                        '• Activez "Utiliser galerie produit" ou "Utiliser médiathèque service"\n' +
                        '• La génération automatique d\'images IA sera activée automatiquement lors de la prochaine tentative';
                } else if (msg.includes('400') || msg.includes('bad request') || msg.includes('invalide') || msg.includes('demande invalide')) {
                    // ✅ AMÉLIORÉ: Extraire les détails du message d'erreur du backend si disponible
                    const backendDetails = error.message.includes('Solutions possibles')
                        ? '\n\n' + error.message.split('Solutions possibles')[1]
                        : '';
                    errorMessage = 'Demande invalide.\n\n' +
                        'Vérifiez que tous les champs sont correctement remplis et réessayez.\n\n' +
                        'Champs requis :\n' +
                        '• Durée (10-90 secondes)\n' +
                        '• Script, storyboard ou timeline\n' +
                        '• Au moins un média disponible ou génération IA activée' +
                        backendDetails;
                } else if (msg.includes('500') || msg.includes('internal') || msg.includes('erreur 500') || msg.includes('renderer vidéo indisponible')) {
                    if (msg.includes('renderer') || msg.includes('prévisualisation')) {
                        errorMessage = 'Service de prévisualisation temporairement indisponible.\n\n' +
                            'La génération de la vidéo principale peut toujours fonctionner.\n\n' +
                            'Veuillez réessayer la prévisualisation plus tard.';
                    } else {
                        errorMessage = 'Erreur serveur temporaire.\n\n' +
                            'Le serveur a rencontré une erreur lors de la génération.\n\n' +
                            'Veuillez réessayer dans quelques instants. Si le problème persiste, contactez le support.';
                    }
                } else if (msg.includes('timeout') || msg.includes('timed out')) {
                    errorMessage = 'La génération prend plus de temps que prévu.\n\n' +
                        'La vidéo est peut-être en cours de création. Vérifiez vos vidéos dans quelques instants.';
                } else if (msg.includes('solde') || msg.includes('balance') || msg.includes('tokens') || msg.includes('insuffisant')) {
                    // ✅ AMÉLIORÉ: Message plus informatif avec bouton de redirection
                    errorMessage = 'Solde insuffisant pour générer cette vidéo.\n\n' +
                        'Coût estimé : ' + (msg.match(/\d+/)?.[0] || 'inconnu') + ' FCFA\n' +
                        'Votre solde actuel est insuffisant.';

                    // ✅ AMÉLIORÉ: Alert avec bouton de redirection vers la recharge
                    Alert.alert(
                        'Solde insuffisant',
                        errorMessage,
                        [
                            {
                                text: 'Annuler',
                                style: 'cancel'
                            },
                            {
                                text: 'Recharger mes tokens',
                                style: 'default',
                                onPress: () => {
                                    // Fermer le modal de création vidéo
                                    onClose();
                                    // Rediriger vers l'écran de recharge
                                    if (navigation) {
                                        navigation.navigate('RechargeTokens' as never);
                                    }
                                }
                            }
                        ]
                    );
                    return; // ✅ ARRÊTER: Ne pas continuer avec l'Alert standard
                } else {
                    errorMessage = error.message;
                }
            }

            Alert.alert(
                'Erreur de création vidéo',
                errorMessage + '\n\nConseils :\n• Vérifiez que vous avez des images dans votre médiathèque\n• Activez "Générer images automatiquement" si vous n\'avez pas d\'images\n• Assurez-vous que le script ou le brief est rempli\n• Vérifiez votre connexion internet',
                [{ text: 'OK' }]
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // ✅ NOUVEAU: Fonction pour démarrer le polling du statut du job
    const startJobPolling = useCallback((jobId: string) => {
        // Arrêter le polling précédent s'il existe
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        const pollStatus = async () => {
            try {
                const statusResponse = await mediaApi.getVideoJobStatus(jobId);
                if (!statusResponse.success || !statusResponse.data) {
                    console.warn('[ProductVideoCreationModal] ⚠️ Impossible de récupérer le statut du job');
                    return;
                }

                const job = statusResponse.data;
                console.log('[ProductVideoCreationModal] 📊 Statut job:', job.status, 'Progress:', job.progress_steps?.length || 0);

                // Mettre à jour le statut et la progression
                setJobStatus(job.status as 'queued' | 'running' | 'completed' | 'failed');

                // Calculer la progression basée sur les steps
                if (job.progress_steps && Array.isArray(job.progress_steps)) {
                    const completedSteps = job.progress_steps.filter((step: any) => step.status === 'completed').length;
                    const totalSteps = job.progress_steps.length;
                    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
                    // ✅ CORRIGÉ: Ne pas mettre 100% tant que la vidéo n'est pas vraiment disponible
                    const hasVideoResult = !!(job.result_payload || job.result_media_id || (job as any).video_url);
                    const finalProgress = (job.status === 'completed' && hasVideoResult) ? 100 : Math.min(progress, 95);
                    setJobProgress(finalProgress);
                }

                // ✅ CORRIGÉ: Vérifier que la vidéo est vraiment disponible avant de considérer comme terminé
                const hasVideoResult = !!(job.result_payload || job.result_media_id || (job as any).video_url);

                // Gérer les états terminaux - seulement si le statut est "completed" ET que la vidéo est disponible
                // Si le statut est "completed" mais que la vidéo n'est pas disponible, continuer le polling
                if (job.status === 'completed') {
                    if (!hasVideoResult) {
                        // Le statut est "completed" mais la vidéo n'est pas encore disponible
                        // Continuer le polling (ne pas arrêter)
                        console.log('[ProductVideoCreationModal] ⏳ Statut completed mais vidéo pas encore disponible, continuation du polling...');
                        return;
                    }

                    // La vidéo est disponible, on peut arrêter le polling
                    if (completionHandledRef.current) {
                        return;
                    }
                    completionHandledRef.current = true;

                    // Arrêter le polling
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    setJobStatus('completed');
                    setJobProgress(100);

                    // Récupérer le résultat
                    if (job.result_payload) {
                        const videoResult = job.result_payload as GeneratedVideoResponse;
                        // ✅ NOUVEAU: Afficher directement la vidéo sans passer par l'alerte
                        await onSuccess(videoResult);
                    } else if (job.result_media_id) {
                        // Si on a seulement l'ID du média, construire un résultat minimal
                        // La vidéo sera disponible dans la galerie du produit
                        const videoResult = {
                            media_id: job.result_media_id,
                            service_id: (job as any).service_id,
                            product_index: (job as any).product_index,
                            success: true,
                        } as GeneratedVideoResponse;
                        await onSuccess(videoResult);
                    } else if ((job as any).video_url) {
                        // Si on a directement l'URL de la vidéo
                        const videoResult = {
                            video_url: (job as any).video_url,
                            media_id: job.result_media_id,
                            service_id: (job as any).service_id,
                            product_index: (job as any).product_index,
                        } as GeneratedVideoResponse;
                        await onSuccess(videoResult);
                    }

                    // Réinitialiser les états
                    setCurrentJobId(null);
                    setIsSubmitting(false);
                } else if (job.status === 'failed') {
                    if (completionHandledRef.current) {
                        return;
                    }
                    completionHandledRef.current = true;

                    // Arrêter le polling
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    setJobStatus('failed');
                    const errorMsg = job.error_message || 'Erreur inconnue lors de la génération';

                    Alert.alert(
                        '❌ Génération échouée',
                        'La génération de la vidéo a échoué.\n\n' +
                        'Erreur: ' + errorMsg + '\n\n' +
                        'Veuillez réessayer ou contacter le support si le problème persiste.',
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    setCurrentJobId(null);
                                    setIsSubmitting(false);
                                }
                            }
                        ]
                    );
                }
            } catch (error: any) {
                console.error('[ProductVideoCreationModal] ❌ Erreur polling job:', error);
                // Continuer le polling même en cas d'erreur temporaire
            }
        };

        // Poller immédiatement puis toutes les 3 secondes
        pollStatus();
        pollingIntervalRef.current = setInterval(pollStatus, 3000) as unknown as NodeJS.Timeout;
    }, [onSuccess, onClose]);

    // ✅ NOUVEAU: Nettoyer le polling quand le modal se ferme
    useEffect(() => {
        if (!visible) {
            // Arrêter le polling
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            // Réinitialiser les états
            setCurrentJobId(null);
            setJobStatus(null);
            setJobProgress(0);
            completionHandledRef.current = false;
        }
    }, [visible]);

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
                {/* ✅ CORRIGÉ 2025-12-24: Utiliser ScrollView pour permettre le scroll vertical */}
                <ScrollView
                    style={styles.productSelectionList}
                    contentContainerStyle={styles.productSelectionListContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
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
                                    {/* ✅ AMÉLIORÉ: Badge visible pour les vidéos */}
                                    {(item.type || item.media_type)?.toLowerCase().includes('video') && (
                                        <View style={styles.mediaVideoBadge}>
                                            <SafeIcon name="video" size={12} color="#FFFFFF" />
                                            <Text style={styles.mediaVideoBadgeText}>VIDÉO</Text>
                                        </View>
                                    )}
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
                                {/* ✅ NOUVEAU: Indicateur d'étapes */}
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
                            </View>
                            <TouchableOpacity onPress={onClose} disabled={isSubmitting} style={styles.closeButton}>
                                <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            ref={mainScrollViewRef}
                            style={styles.modalBody}
                            contentContainerStyle={getStepContentStyle()}
                            showsVerticalScrollIndicator={false}
                        >
                            {renderStepContent()}
                        </ScrollView>

                        {/* ✅ NOUVEAU Phase 3.2: Modal AR Video Editor avec gestion d'erreur robuste */}
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
                            {(() => {
                                try {
                                    // ✅ CORRIGÉ: Rendre l'import dynamique pour éviter les crashes
                                    const ARVideoEditorComponent = require('./ARVideoEditor').ARVideoEditor || require('./ARVideoEditor').default;
                                    if (!ARVideoEditorComponent) {
                                        throw new Error('ARVideoEditor component not found');
                                    }
                                    return (
                                        <ARVideoEditorComponent
                                            productName={normalizeProductName(selectedProduct)}
                                            serviceId={selectedProduct ? Number(selectedProduct.serviceId) : undefined}
                                            productIndex={selectedProduct?.product_index}
                                            onVideoCaptured={handleARVideoCaptured}
                                            isUploading={isUploadingARVideo}
                                            onClose={() => {
                                                if (!isUploadingARVideo) {
                                                    setShowAREditor(false);
                                                }
                                            }}
                                        />
                                    );
                                } catch (error: any) {
                                    console.error('[ProductVideoCreationModal] Erreur chargement ARVideoEditor:', error);
                                    return (
                                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                                            <SafeIcon name="camera-off" size={64} color={modernColors.error} />
                                            <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
                                                Éditeur AR non disponible
                                            </Text>
                                            <Text style={{ fontSize: 14, color: modernColors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                                                {error?.message || 'L\'éditeur AR nécessite react-native-vision-camera. Veuillez mettre à jour l\'application.'}
                                            </Text>
                                            <NativeButton
                                                title="Fermer"
                                                variant="primary"
                                                size="medium"
                                                onPress={() => setShowAREditor(false)}
                                                style={{ marginTop: 24 }}
                                            />
                                        </View>
                                    );
                                }
                            })()}
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

            {/* ✅ Modal de configuration de livraison */}
            {selectedProduct && selectedProduct.serviceId && typeof selectedProduct.product_index === 'number' && (
                <ProductDeliveryConfigModal
                    visible={showDeliveryConfigModal}
                    onClose={() => setShowDeliveryConfigModal(false)}
                    serviceId={Number(selectedProduct.serviceId)}
                    productIndex={selectedProduct.product_index}
                    productName={normalizeProductName(selectedProduct)}
                    onSuccess={() => {
                        // Recharger la configuration après sauvegarde
                        if (selectedProduct?.serviceId && typeof selectedProduct.product_index === 'number') {
                            loadDeliveryConfig(Number(selectedProduct.serviceId), selectedProduct.product_index);
                        }
                        setShowDeliveryConfigModal(false);
                    }}
                />
            )}
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
        maxHeight: 400, // ✅ CORRIGÉ 2025-12-24: Limiter la hauteur pour permettre le scroll
    },
    productSelectionListContent: {
        paddingBottom: 16, // ✅ CORRIGÉ 2025-12-24: Padding en bas pour le scroll
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
    deliveryConfigHint: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    deliveryConfigHintText: {
        flex: 1,
        fontSize: 12,
        color: '#0369A1',
        lineHeight: 16,
    },
    deliveryConfigStatus: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#ECFDF5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#10B981',
        gap: 8,
    },
    deliveryConfigStatusText: {
        flex: 1,
        fontSize: 12,
        color: '#065F46',
        lineHeight: 16,
        fontWeight: '500',
    },
    deliveryConfigAddress: {
        fontSize: 11,
        color: '#047857',
        marginTop: 4,
        fontStyle: 'italic',
    },
    configureButton: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    configureButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
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
    mediaVideoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    mediaVideoBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
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
    // ✅ NOUVEAU: Styles pour chaënage de vidéos
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
    // ✅ NOUVEAU: Styles pour l'affichage de progression du job
    jobProgressContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 16,
    },
    jobProgressSpinner: {
        marginBottom: 8,
    },
    jobProgressText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    jobProgressSubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    progressBarContainer: {
        width: '100%',
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 4,
        transition: 'width 0.3s ease',
    },
    progressPercentage: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginTop: 4,
    },
    jobInfoContainer: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        gap: 8,
    },
    jobInfoText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
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
        // ✅ CORRIGÉ 2025-12-24: Améliorer l'affichage du texte avec retours à la ligne
        minHeight: 60,
        justifyContent: 'flex-start',
    },
    storyboardSceneType: {
        fontSize: 11,
        fontWeight: '700',
        color: modernColors.primary,
        textTransform: 'uppercase',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    storyboardSceneText: {
        fontSize: 13,
        color: modernColors.text,
        lineHeight: 18,
        // ✅ CORRIGÉ 2025-12-24: Améliorer le rendu du texte avec retours à la ligne
        flexShrink: 1,
        textAlign: 'left',
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


