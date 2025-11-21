import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { config } from '../config/environment';
import { mediaApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import { AIDistributionPlan, AIVideoBriefVariant, AIVideoStyleSuggestion, GeneratedVideoResponse } from '../types/VideoGeneration';
import { NativeButton, NativeCard, NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';

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

const buildMediaUrl = (path: string | undefined | null): string => {
    if (!path) {
        return '';
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:image')) {
        return path;
    }

    const base = config.UPLOAD_BASE_URL ? config.UPLOAD_BASE_URL.replace(/\/$/, '') : '';
    const sanitizedPath = path.replace(/^\//, '');

    return base ? `${base}/${sanitizedPath}` : sanitizedPath;
};

const normalizeProductName = (product?: ManagedProduct | null): string => {
    if (!product) {
        return 'Votre produit';
    }
    return product.nom || product.name || product.title || 'Votre produit';
};

const ensureNumber = (value: any, fallback: number): number => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
        return parsed;
    }
    return fallback;
};

const computePriceLabel = (product: ManagedProduct | null | undefined): string | undefined => {
    if (!product || product.prix === undefined || product.prix === null || product.prix === '') {
        return undefined;
    }
    const value =
        typeof product.prix === 'number'
            ? product.prix.toLocaleString()
            : String(product.prix).trim();
    if (!value) {
        return undefined;
    }
    return `${value} ${product.devise || 'XAF'}`;
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

const ProductVideoCreationModal: React.FC<ProductVideoCreationModalProps> = ({
    visible,
    primaryProduct,
    products,
    onClose,
    onSuccess,
}) => {
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

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
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

                const productMediaItems: MediaLibraryItem[] = Array.isArray(productMediaResponse.data?.data)
                    ? productMediaResponse.data.data
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
            if (briefVariants.length === 0) {
                try {
                    const response = await mediaApi.generateVideoBrief({
                        product_name: normalizeProductName(selectedProduct),
                        description: selectedProduct.description,
                        price: priceLabel,
                        promotion: promotionValue,
                        highlights,
                        target_audience: channelsArray.join(', '),
                        tone: stylePreset,
                        lang,
                        variant_count: 3,
                    });
                    if (response.success && Array.isArray(response.data?.variants) && response.data.variants.length > 0) {
                        setBriefVariants(response.data.variants);
                    }
                } catch (error) {
                    console.warn('[ProductVideoCreationModal] Coach IA: brief indisponible', error);
                }
            }

            if (!styleSuggestion) {
                try {
                    const channelPriority = ['shorts', 'instagram', 'youtube', 'chat', 'product'];
                    const preferredChannel = channelPriority.find((key) => selectedChannels.has(key)) || 'shorts';
                    const response = await mediaApi.generateVideoStyle({
                        channel: preferredChannel,
                        product_type: selectedProduct.type || selectedProduct.category_label,
                        tone: stylePreset,
                        promotion: promotionValue,
                        highlights,
                        lang,
                    });
                    if (response.success && response.data?.suggestion) {
                        setStyleSuggestion(response.data.suggestion);
                    }
                } catch (error) {
                    console.warn('[ProductVideoCreationModal] Coach IA: style indisponible', error);
                }
            }

            if (!distributionPlan) {
                try {
                    const response = await mediaApi.generateDistributionPlan({
                        product_name: normalizeProductName(selectedProduct),
                        channels: channelsArray,
                        target_audience: channelsArray.join(', '),
                        marketing_angle: mediaAnalysis.marketingAngle || undefined,
                        lang,
                    });
                    if (response.success && response.data?.plan) {
                        setDistributionPlan(response.data.plan);
                    }
                } catch (error) {
                    console.warn('[ProductVideoCreationModal] Coach IA: plan indisponible', error);
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
    ]);

    const handleRefreshCoach = useCallback(() => {
        coachPrefetchDoneRef.current = false;
        prefetchCoachInsights().catch((error) =>
            console.warn('[ProductVideoCreationModal] Coach IA: rafraîchissement impossible', error)
        );
    }, [prefetchCoachInsights]);

    useEffect(() => {
        if (!visible) {
            coachPrefetchDoneRef.current = false;
            setCoachLoading(false);
        }
    }, [visible]);

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

            if (!result || result.type === 'cancel') {
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
                description: selectedProduct.description,
                price: priceLabel,
                promotion: promotionValue,
                highlights,
                target_audience: Array.from(selectedChannels.values()).join(', '),
                tone: stylePreset,
                lang: subtitleLang || voiceoverLang,
                variant_count: 3,
            });

            if (!response.success || !response.data?.variants) {
                throw new Error(response.error || 'Génération IA impossible');
            }

            const variants: AIVideoBriefVariant[] = response.data.variants;
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
    }, [selectedProduct, selectedChannels, stylePreset, subtitleLang, voiceoverLang, applyBriefVariant]);

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

            if (!response.success || !response.data?.suggestion) {
                throw new Error(response.error || 'Impossible de récupérer les suggestions IA');
            }

            applyStyleSuggestion(response.data.suggestion);
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

            const response = await mediaApi.analyzeMedia({
                product_name: normalizeProductName(selectedProduct),
                media_tags: tags,
                description: selectedProduct.description,
                lang: subtitleLang || voiceoverLang,
            });

            if (!response.success || !response.data?.analysis) {
                throw new Error(response.error || 'Analyse IA indisponible');
            }

            const analysis = response.data.analysis;
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
        const defaultHeadline = `🎯 ${productName} en ${selectedProduct.city || 'promo'}`;
        const defaultCTA = `📲 Contactez ${selectedProduct.serviceTitre || 'nous'} sur Yukpomnang`;

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
                if (response.success && Array.isArray(response.data?.loops)) {
                    setAudioLibrary(response.data.loops);
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
                    serviceTitre: product.serviceTitre || 'Service',
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
        return products
            .filter(
                (product) =>
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

    const applyStyleSuggestion = useCallback((suggestion: AIVideoStyleSuggestion) => {
        setStyleSuggestion(suggestion);
        setSelectedEffects(new Set(suggestion.effects || []));
        setSelectedTransitions(new Set(suggestion.transitions || []));
        setSelectedOverlayTips(new Set(suggestion.overlay_tips || []));
        setColorPalette(suggestion.color_palette || '');
        setStyleMusicHint(suggestion.music_hint || '');
    }, []);

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
        const limitedHashtags =
            distributionPlan?.hashtags?.slice(0, 3)?.map((tag) => `#${tag.replace(/^#/, '')}`) || [];
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
                                    style={styles.coachIcon}
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
                                    style={styles.coachIcon}
                                />
                                <View style={styles.coachContent}>
                                    <Text style={styles.coachLabel}>Effets recommandés</Text>
                                    {styleSuggestion.effects?.length ? (
                                        <Text style={styles.coachText} numberOfLines={2}>
                                            Effets : {styleSuggestion.effects.slice(0, 3).join(', ')}
                                        </Text>
                                    ) : null}
                                    {styleSuggestion.transitions?.length ? (
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
                                    style={styles.coachIcon}
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
        setVariantPickerVisible,
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

        const payload = {
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
            storyboard: scriptNotes
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
        };

        setIsSubmitting(true);

        try {
            const response = await mediaApi.generateProductVideo(
                selectedProduct.serviceId,
                selectedProduct.product_index,
                payload
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Génération impossible');
            }

            const result = response.data as GeneratedVideoResponse;
            await onSuccess(result);
        } catch (error: any) {
            console.error('[ProductVideoCreationModal] Erreur génération vidéo:', error);
            Alert.alert(
                'Génération impossible',
                error?.message || 'Nous ne parvenons pas à générer la vidéo. Vérifiez votre connexion et réessayez.'
            );
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
                                {selectedProduct.serviceTitre || 'Service'}
                            </Text>
                            {selectedProduct.prix && (
                                <Text style={styles.selectedProductPrice}>
                                    {selectedProduct.prix} {selectedProduct.devise || 'XAF'}
                                </Text>
                            )}
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
                {/* ✅ CORRECTION: Remplacer ScrollView imbriqué par View pour éviter les problèmes de toucher */}
                <View style={styles.productSelectionList}>
                    {groupedProducts.map((group) => (
                        <View key={group.serviceId} style={styles.productGroup}>
                            <Text style={styles.productGroupTitle}>{group.serviceTitre}</Text>
                            {group.items.map((product) => (
                                <TouchableOpacity
                                    key={`${group.serviceId}_${product.product_index ?? product.id}`}
                                    style={styles.productSelectItem}
                                    onPress={() => {
                                        console.log('[ProductVideoCreationModal] Produit sélectionné:', product);
                                        setSelectedProduct(product);
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
                                            {product.type || 'produit'}
                                            {product.prix ? ` • ${product.prix} ${product.devise || 'XAF'}` : ''}
                                        </Text>
                                    </View>
                                    <SafeIcon name="chevron-right" size={18} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                </View>
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
                    {productsSameService.map((product) => {
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
                    })}
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

            if (!response.success || !response.data?.plan) {
                throw new Error(response.error || 'Plan IA indisponible');
            }

            setDistributionPlan(response.data.plan);
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
                            <View>
                                <Text style={styles.modalTitle}>Studio vidéo produit</Text>
                                <Text style={styles.modalSubtitle}>
                                    Assemblez en 30 secondes une vidéo verticale prête pour TikTok, Reels et votre fiche
                                    produit.
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} disabled={isSubmitting} style={styles.closeButton}>
                                <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {renderProductSelection()}
                            {coachPanel}

                            {selectedProduct && (
                                <>
                                    <NativeCard style={styles.sectionCard}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.sectionTitle}>Brief & script marketing</Text>
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
                                            <Text style={styles.fieldLabel}>Call-to-action principal</Text>
                                            <NativeInput
                                                value={callToAction}
                                                onChangeText={setCallToAction}
                                                placeholder="Ex: Réservez en ligne et profitez de la livraison express !"
                                                multiline
                                                minLines={2}
                                            />
                                        </View>
                                        <View style={styles.fieldGroup}>
                                            <Text style={styles.fieldLabel}>Brief marketing (optionnel)</Text>
                                            <NativeInput
                                                value={scriptNotes}
                                                onChangeText={setScriptNotes}
                                                placeholder={`Décrivez les messages clés, avantages, garanties, etc.\nUne ligne = une scène.`}
                                                multiline
                                                minLines={3}
                                            />
                                        </View>
                                    </NativeCard>

                                    <NativeCard style={styles.sectionCard}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.sectionTitle}>Style et rythme de la vidéo</Text>
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
                                                        <Text style={styles.styleChipDescription} numberOfLines={2}>
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
                                                    {styleSuggestion.effects.map((effect) => {
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
                                                    })}
                                                </View>

                                                <Text style={styles.suggestionTitle}>Transitions</Text>
                                                <View style={styles.suggestionRow}>
                                                    {styleSuggestion.transitions.map((transition) => {
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
                                                    })}
                                                </View>

                                                <Text style={styles.suggestionTitle}>Overlays & tips</Text>
                                                <View style={styles.suggestionRow}>
                                                    {styleSuggestion.overlay_tips.map((tip) => {
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
                                                    })}
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
                                                Astuce : 25-35s performe mieux sur les réseaux sociaux. Yukpomnang gère les
                                                transitions automatiquement.
                                            </Text>
                                        </View>
                                    </NativeCard>

                                    <NativeCard style={styles.sectionCard}>
                                        <Text style={styles.sectionTitle}>Ambiance musicale</Text>
                                        <Text style={styles.sectionSubtitle}>
                                            Choisissez une ambiance générée automatiquement. Vous pouvez ajouter vos propres pistes via la médiathèque.
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
                                                        <Text style={styles.styleChipDescription} numberOfLines={2}>
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
                                                        <ScrollView
                                                            horizontal
                                                            showsHorizontalScrollIndicator={false}
                                                            contentContainerStyle={styles.audioRow}
                                                        >
                                                            {availableAudioTracks.map((track) => {
                                                                const selected = selectedMusicTrackId === track.id;
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={`audio_${track.id}`}
                                                                        style={[
                                                                            styles.audioChip,
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
                                                                            numberOfLines={1}
                                                                        >
                                                                            {track.ai_description || `Piste ${track.id}`}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </ScrollView>
                                                    </>
                                                )}
                                                {audioLibrary.length > 0 && (
                                                    <>
                                                        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                                                            Bibliothèque audio Yukpomnang
                                                        </Text>
                                                        {loadingLibrary ? (
                                                            <View style={styles.audioRow}>
                                                                <ActivityIndicator size="small" color={modernColors.primary} />
                                                            </View>
                                                        ) : (
                                                            <ScrollView
                                                                horizontal
                                                                showsHorizontalScrollIndicator={false}
                                                                contentContainerStyle={styles.audioRow}
                                                            >
                                                                {audioLibrary.map((loop) => {
                                                                    const isAttaching = attachingLoopId === loop.id;
                                                                    return (
                                                                        <TouchableOpacity
                                                                            key={loop.id}
                                                                            style={styles.audioChip}
                                                                            onPress={() => handleAttachAudioLoop(loop.id)}
                                                                            disabled={isAttaching}
                                                                        >
                                                                            {isAttaching ? (
                                                                                <ActivityIndicator size="small" color={modernColors.primary} />
                                                                            ) : (
                                                                                <SafeIcon name="download-cloud" size={16} color={modernColors.primary} />
                                                                            )}
                                                                            <View style={{ flex: 1 }}>
                                                                                <Text style={styles.audioChipText} numberOfLines={1}>
                                                                                    {loop.title}
                                                                                </Text>
                                                                                <Text style={styles.audioChipSubtitle} numberOfLines={1}>
                                                                                    {loop.genre} • {loop.bpm} BPM
                                                                                </Text>
                                                                            </View>
                                                                        </TouchableOpacity>
                                                                    );
                                                                })}
                                                            </ScrollView>
                                                        )}
                                                    </>
                                                )}
                                            </View>
                                        )}
                                    </NativeCard>

                                    <NativeCard style={styles.sectionCard}>
                                        <Text style={styles.sectionTitle}>Informations à intégrer automatiquement</Text>
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

                                    {renderRelatedProducts()}

                                    <NativeCard style={styles.sectionCard}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.sectionTitle}>Narration vocale IA</Text>
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
                                            Génère une voix off automatique (espeak doit être installé sur le serveur). Vous pouvez ajuster le script avant synthèse.
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
                                                                onPress={() => {
                                                                    setVoiceoverLang(option.value);
                                                                    setSubtitleLang(option.value);
                                                                }}
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

                                    <NativeCard style={styles.sectionCard}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.sectionTitle}>Sources médias</Text>
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
                                            Sélectionnez les images/vidéos à mettre en avant. Vous pouvez combiner votre
                                            galerie produit et la médiathèque générale.
                                        </Text>
                                        {mediaAnalysis.dominantColors && mediaAnalysis.dominantColors.length > 0 && (
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
                                                {mediaAnalysis.ambiance && (
                                                    <Text style={styles.mediaInsightsText}>
                                                        Ambiance : {mediaAnalysis.ambiance}
                                                    </Text>
                                                )}
                                                {mediaAnalysis.marketingAngle && (
                                                    <Text style={styles.mediaInsightsText}>
                                                        Angle marketing : {mediaAnalysis.marketingAngle}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                        <View style={styles.toggleRow}>
                                            <View style={styles.toggleText}>
                                                <Text style={styles.toggleLabel}>Galerie produit intelligente</Text>
                                                <Text style={styles.toggleDescription}>
                                                    Yukpomnang exploitera automatiquement les images enregistrées dans cette
                                                    fiche produit.
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
                                                <Text style={styles.toggleLabel}>Médiathèque du prestataire</Text>
                                                <Text style={styles.toggleDescription}>
                                                    Ajoute vos assets généraux (logos, publicités, vidéos verticales) pour un
                                                    rendu premium.
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
                                                <Text style={styles.toggleLabel}>Inclure vos visuels publicitaires</Text>
                                                <Text style={styles.toggleDescription}>
                                                    Ajoute automatiquement les bannières/affiches déjà configurées dans vos
                                                    campagnes.
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
                                                        Hashtags : {distributionPlan.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}
                                                    </Text>
                                                )}
                                                {distributionPlan.schedule?.length > 0 && (
                                                    <View style={styles.planSchedule}>
                                                        {distributionPlan.schedule.map((item, idx) => (
                                                            <View key={`schedule_${idx}`} style={styles.planScheduleRow}>
                                                                <Text style={styles.planScheduleChannel}>{item.channel}</Text>
                                                                <Text style={styles.planScheduleTime}>{item.best_time}</Text>
                                                                {item.call_to_action && (
                                                                    <Text style={styles.planScheduleCTA}>{item.call_to_action}</Text>
                                                                )}
                                                            </View>
                                                        ))}
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
                                        <View style={styles.toggleRow}>
                                            <View style={styles.toggleText}>
                                                <Text style={styles.toggleLabel}>Générer aussi un format carré (1080x1080)</Text>
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
                                                <Text style={styles.toggleLabel}>Générer un format paysage (1920x1080)</Text>
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
                                    </NativeCard>
                                </>
                            )}
                        </ScrollView>

                        <View style={styles.actionsRow}>
                            <NativeButton
                                title="Annuler"
                                variant="outline"
                                onPress={onClose}
                                disabled={isSubmitting}
                                style={styles.actionButton}
                            />
                            <NativeButton
                                title={isSubmitting ? 'Génération en cours...' : 'Créer la vidéo maintenant'}
                                onPress={handleSubmit}
                                disabled={isSubmitting || !selectedProduct}
                                style={styles.primaryActionButton}
                            />
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
                                    onPress={() => applyBriefVariant(variant)}
                                >
                                    <Text style={styles.variantCardTitle}>
                                        Variante {index + 1}
                                    </Text>
                                    {variant.hook && (
                                        <Text style={styles.variantCardHook}>{variant.hook}</Text>
                                    )}
                                    <View style={styles.variantOutline}>
                                        {variant.script_outline.map((line, idx) => (
                                            <Text key={idx} style={styles.variantOutlineLine}>
                                                • {line}
                                            </Text>
                                        ))}
                                    </View>
                                    {variant.hashtags?.length > 0 && (
                                        <Text style={styles.variantHashtags}>
                                            {variant.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}
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
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
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
        borderRadius: 999,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#E0E7FF',
    },
    linkButtonText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
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
        // ✅ Pas de maxHeight car le ScrollView parent gère le scroll
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
        gap: 12,
        marginTop: 12,
    },
    styleChip: {
        flexBasis: '48%',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 12,
        gap: 6,
        backgroundColor: '#F8FAFC',
    },
    styleChipSelected: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
    },
    styleChipLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.text,
    },
    styleChipLabelSelected: {
        color: modernColors.primary,
    },
    styleChipDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
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
});

export default ProductVideoCreationModal;


