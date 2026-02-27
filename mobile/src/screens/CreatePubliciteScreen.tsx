// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
// ✅ CORRECTION: expo-video n'est pas installé, on le remplace par un placeholder
// import { getThumbnailAsync } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { ABTestingVariants } from '../components/ABTestingVariants';
import { AdCreationStepper } from '../components/AdCreationStepper';
import { AdPreviewCard } from '../components/AdPreviewCard';
import { AdTemplates } from '../components/AdTemplates';
import { AdvancedABTesting } from '../components/AdvancedABTesting';
import { AdvancedTargeting } from '../components/AdvancedTargeting';
import { AISuggestionsGenerator } from '../components/AISuggestionsGenerator';
import { AssetLibrary } from '../components/AssetLibrary';
import { AutoOptimizationSettings } from '../components/AutoOptimizationSettings';
import { BidStrategySelector, BidStrategyType } from '../components/BidStrategySelector';
import { BudgetSlider } from '../components/BudgetSlider';
import { CampaignScheduler } from '../components/CampaignScheduler';
import { CustomAudienceManager } from '../components/CustomAudienceManager';
import NavigatorToolbar from '../components/NavigatorToolbar';
import { PlacementSelector, PlacementType } from '../components/PlacementSelector';
import ProductVideoCreationModal from '../components/ProductVideoCreationModal';
import { RetargetingOptions } from '../components/RetargetingOptions';
import SafeIcon from '../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../components/SafeNativeDesign';
import { config } from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { productsService } from '../services/productsService';
import { modernColors } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import { GeneratedVideoResponse } from '../types/VideoGeneration';

const { width } = Dimensions.get('window');

interface PubliciteData {
    titre: string;
    description: string;
    produitsIndexes: string[]; // IDs des produits
    videos: string[]; // Base64 des vidéos
    thumbnails: string[]; // Miniatures des vidéos
    duree: number; // Durée en jours
    budget: number; // Budget total
    zone_geographique: string; // Zone d'impact
}

// ✅ Taux de conversion des devises (base FCFA = 1)
const EXCHANGE_RATES: { [key: string]: number } = {
    'FCFA': 1,
    'XOF': 1,
    'USD': 600,
    'EUR': 650,
    'GBP': 750,
    'CNY': 85,
    'INR': 7.5,
    'XAF': 1,
};

const PRICE_PER_DAY_FCFA = 500; // 500 FCFA par jour

// ✅ CORRIGÉ 2025-11-30: Utiliser l'endpoint /api/media/files pour les chemins uploads/
const buildMediaUrl = (path?: string | null): string | null => {
    if (!path || typeof path !== 'string') {
        return null;
    }
    const trimmed = path.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return trimmed;
    }
    // ✅ CORRIGÉ: Utiliser /api/media/files pour les chemins uploads/
    if (trimmed.startsWith('uploads/') || trimmed.startsWith('/uploads/')) {
        const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
        const base = (config.API_BASE_URL || config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        if (!base) {
            return null;
        }
        return `${base}/api/media/files/${cleanPath}`;
    }
    // Pour les autres chemins, utiliser aussi /api/media/files
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const base = (config.API_BASE_URL || config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
    if (!base) {
        return null;
    }
    return `${base}/api/media/files/${cleanPath}`;
};

const stripDataUriPrefix = (value: string): string => value.replace(/^data:.*;base64,/, '');

const looksLikeBase64Media = (value?: string | null): boolean => {
    if (!value || typeof value !== 'string') {
        return false;
    }
    const sanitized = value.replace(/\s/g, '');
    if (sanitized.startsWith('data:')) {
        return false;
    }
    return sanitized.length > 64 && /^[A-Za-z0-9+/=]+$/.test(sanitized);
};

const downloadAsBase64 = async (url: string, extension: string): Promise<string | null> => {
    try {
        const targetPath = `${FileSystem.cacheDirectory}publicite_media_${Date.now()}.${extension}`;
        const download = await FileSystem.downloadAsync(url, targetPath);
        const base64 = await FileSystem.readAsStringAsync(download.uri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.deleteAsync(download.uri, { idempotent: true });
        return base64;
    } catch (error) {
        console.error('[CreatePublicite] Conversion base64 impossible:', error);
        return null;
    }
};

const pickSquareVideoUrl = (result: GeneratedVideoResponse): string | null => {
    const variants = Array.isArray(result.additional_outputs) ? result.additional_outputs : [];
    const squareVariant = variants.find((variant) => {
        const format = String((variant as any)?.format || '').toLowerCase();
        return format.includes('square') || format.includes('1x1') || format.includes('feed');
    });

    const candidate =
        (squareVariant as any)?.video_url ||
        (squareVariant as any)?.path ||
        result.video_url ||
        null;

    if (!candidate) {
        return null;
    }
    return buildMediaUrl(candidate) || candidate;
};

const pickSquareThumbnail = async (
    result: GeneratedVideoResponse,
    product: ManagedProduct | null,
): Promise<string | null> => {
    const variants = Array.isArray(result.additional_outputs) ? result.additional_outputs : [];
    const squareVariant = variants.find((variant) => {
        const format = String((variant as any)?.format || '').toLowerCase();
        return format.includes('square') || format.includes('1x1') || format.includes('feed');
    });

    if ((squareVariant as any)?.thumbnail_base64) {
        return stripDataUriPrefix((squareVariant as any).thumbnail_base64);
    }

    if ((squareVariant as any)?.thumbnail_url) {
        const url = buildMediaUrl((squareVariant as any).thumbnail_url) || (squareVariant as any).thumbnail_url;
        if (url && url.startsWith('http')) {
            const base64 = await downloadAsBase64(url, 'jpg');
            if (base64) {
                return base64;
            }
        }
    }

    if (product?.images && product.images.length > 0) {
        const imageSource = product.images[0];
        if (typeof imageSource === 'string' && imageSource.length > 0) {
            if (imageSource.startsWith('data:image')) {
                return stripDataUriPrefix(imageSource);
            }
            if (looksLikeBase64Media(imageSource)) {
                return imageSource;
            }
            const remoteUrl = buildMediaUrl(imageSource) || imageSource;
            if (remoteUrl && remoteUrl.startsWith('http')) {
                const base64 = await downloadAsBase64(remoteUrl, 'jpg');
                if (base64) {
                    return base64;
                }
            }
        }
    }

    return null;
};

const STEPS = [
    { id: 'info', label: 'Infos', icon: 'file-text' },
    { id: 'products', label: 'Produits', icon: 'package' },
    { id: 'media', label: 'Médias', icon: 'video' },
    { id: 'budget', label: 'Budget', icon: 'dollar-sign' },
    { id: 'targeting', label: 'Ciblage', icon: 'target' },
    { id: 'confirm', label: 'Créer', icon: 'check-circle' },
];

const CreatePubliciteScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t, language } = useLanguageSafe();

    // ✅ Mode: 'create', 'edit', ou 'relance'
    const publiciteId = (route.params as any)?.publiciteId;
    const relanceId = (route.params as any)?.relanceId;
    const mode = publiciteId ? 'edit' : relanceId ? 'relance' : 'create';
    const isEditMode = mode === 'edit';
    const isRelanceMode = mode === 'relance';
    const isExistingMode = isEditMode || isRelanceMode;
    const existingNoticeShownRef = useRef(false);

    const [loading, setLoading] = useState(false);
    const [mesServices, setMesServices] = useState<any[]>([]);
    const [produitsList, setProduitsList] = useState<ManagedProduct[]>([]);
    const [selectedProduits, setSelectedProduits] = useState<string[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [titre, setTitre] = useState('');
    const [description, setDescription] = useState('');
    const [duree, setDuree] = useState('7'); // 7 jours par défaut
    const [zoneGeographique, setZoneGeographique] = useState('local'); // local, regional, international
    const [coutEstime, setCoutEstime] = useState(0);
    const [userCurrency, setUserCurrency] = useState('FCFA');
    const [videoCreatorVisible, setVideoCreatorVisible] = useState(false);
    const [primaryProduct, setPrimaryProduct] = useState<ManagedProduct | null>(null);
    const [isConvertingVideo, setIsConvertingVideo] = useState(false);

    // ✅ NOUVEAU: États pour l'UX améliorée
    const [currentStep, setCurrentStep] = useState(0);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [showTemplates, setShowTemplates] = useState(false);

    const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

    // ✅ NOUVEAU: États pour fonctionnalités avancées (100% parité)
    const [targeting, setTargeting] = useState({
        ageRange: { min: 18, max: 65 },
        gender: 'all' as 'all' | 'male' | 'female' | 'other',
        interests: [] as string[],
        behaviors: [] as string[],
        locations: [] as string[],
    });
    const [abVariants, setAbVariants] = useState<any[]>([
        { id: '1', titre: '', description: '', isActive: true },
    ]);
    const [schedule, setSchedule] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
        startTime: null as Date | null,
        endTime: null as Date | null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        pauseOnWeekends: false,
        pauseHours: null as { start: number; end: number } | null,
    });
    const [placements, setPlacements] = useState([
        { type: 'feed' as PlacementType, label: 'Feed Principal', icon: 'grid', description: '', enabled: true, budget: 0 },
        { type: 'stories' as PlacementType, label: 'Stories', icon: 'circle', description: '', enabled: false, budget: 0 },
        { type: 'carousel' as PlacementType, label: 'Carousel', icon: 'layers', description: '', enabled: false, budget: 0 },
        { type: 'search' as PlacementType, label: 'Résultats de recherche', icon: 'search', description: '', enabled: false, budget: 0 },
        { type: 'reels' as PlacementType, label: 'Reels', icon: 'video', description: '', enabled: false, budget: 0 },
        { type: 'sidebar' as PlacementType, label: 'Barre latérale', icon: 'sidebar', description: '', enabled: false, budget: 0 },
    ]);
    const [bidStrategy, setBidStrategy] = useState({
        type: 'auto' as BidStrategyType,
        label: 'Optimisation automatique',
        description: '',
        icon: 'zap',
        bidAmount: undefined as number | undefined,
    });
    const [retargetingRules, setRetargetingRules] = useState([
        { id: '1', type: 'viewed_product' as const, label: 'A vu un produit', description: '', enabled: false, daysSince: 7 },
        { id: '2', type: 'abandoned_cart' as const, label: 'Panier abandonné', description: '', enabled: false, daysSince: 7 },
        { id: '3', type: 'visited_service' as const, label: 'A visité un service', description: '', enabled: false, daysSince: 7 },
        { id: '4', type: 'searched' as const, label: 'A recherché', description: '', enabled: false, daysSince: 7 },
    ]);
    const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

    // Charger les services et produits de l'utilisateur
    useEffect(() => {
        loadMesServicesEtProduits();
        loadUserCurrency();

        // Si mode modification ou relance, charger les données de la publicité
        if (isEditMode && publiciteId) {
            loadPubliciteData(publiciteId);
        } else if (isRelanceMode && relanceId) {
            loadPubliciteData(relanceId);
        }
    }, []);

    useEffect(() => {
        if (isExistingMode && !existingNoticeShownRef.current) {
            existingNoticeShownRef.current = true;
            Alert.alert(
                'ℹ️ Yukpo IA',
                'Les vidéos existantes ne sont pas rechargées automatiquement. Pensez à les importer à nouveau ou à générer une nouvelle version carrée avec Yukpo IA.',
            );
        }
    }, [isExistingMode]);

    const loadUserCurrency = async () => {
        try {
            // Récupérer la devise de l'utilisateur depuis son profil
            const response = await apiGet('/api/users/profile');
            if (response.success && (response.data as any)?.devise_preferee) {
                setUserCurrency((response.data as any).devise_preferee);
            }
        } catch (error) {
            console.log('[CreatePublicite] Devise par défaut: FCFA');
        }
    };

    // ✅ Charger les données d'une publicité existante (pour modification ou relance)
    const loadPubliciteData = async (pubId: string) => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/publicites/${pubId}`);

            if (response.success && response.data) {
                const pub = response.data as any;
                setTitre(pub.titre || '');
                setDescription(pub.description || '');
                setDuree(pub.duree_jours?.toString() || '7');
                setZoneGeographique(pub.zone_geographique || 'local');
                setSelectedProduits(pub.produits_indexes || []);

                // Pour les vidéos, on ne peut pas les recharger depuis base64,
                // l'utilisateur devra les ajouter à nouveau si nécessaire
            }
            setLoading(false);
        } catch (error) {
            console.error('[CreatePublicite] Erreur chargement publicité:', error);
            setLoading(false);
        }
    };

    const loadMesServicesEtProduits = async () => {
        try {
            setLoading(true);

            // ✅ PHASE 5: Utiliser getProductsByUser (plus de fallback JSONB)
            if (!user?.id) {
                console.warn('[CreatePubliciteScreen] ⚠️ Utilisateur non connecté');
                setProduitsList([]);
                setLoading(false);
                return;
            }

            const products = await productsService.getProductsByUser(user.id);
            console.log('[CreatePubliciteScreen] ✅ Produits récupérés depuis API:', products.length);

            // Convertir les produits de l'API en format ManagedProduct
            const allProducts: ManagedProduct[] = products.map((product) => {
                const productData = product.product_data || {};
                return {
                    id: `${product.service_id}_${product.product_index}`,
                    rawProductId: product.id.toString(),
                    serviceId: product.service_id.toString(),
                    productIndex: product.product_index,
                    nom: product.product_name || productData.nom || productData.nom_produit || 'Produit sans nom',
                    prix: product.product_price || productData.prix || productData.prix_produit || 0,
                    devise: productData.devise || 'FCFA',
                    type: product.product_type || productData.type || 'autre',
                    description: productData.description || productData.desc || '',
                    images: productData.images || [],
                    videos: productData.videos || [],
                    serviceTitre: '', // Pourra être enrichi si nécessaire
                    is_active: product.is_active,
                    category_key: productData.categorie_produit || productData.categorie || productData.category,
                    category_label: productData.categorie_produit || productData.categorie || productData.category,
                };
            });

            setProduitsList(allProducts);

            // Charger aussi les services pour autres usages
            const response = await apiGet('/api/prestataire/services');
            if (response.success && response.data) {
                setMesServices(response.data as any[]);
            }
            setLoading(false);
        } catch (error) {
            console.error('[CreatePublicite] Erreur chargement:', error);
            setLoading(false);
        }
    };

    // ✅ Calculer le coût estimé avec conversion de devise et coût vidéos
    useEffect(() => {
        const nbJours = parseInt(duree) || 7;
        const nbVideos = videos.length;

        // Calcul en FCFA
        // Base: 500 FCFA/jour + 2000 FCFA par vidéo
        const coutBase = nbJours * PRICE_PER_DAY_FCFA;
        const coutVideos = nbVideos * 2000;
        const totalFCFA = coutBase + coutVideos;

        // Conversion dans la devise de l'utilisateur
        const exchangeRate = EXCHANGE_RATES[userCurrency] || 1;
        const totalInUserCurrency = Math.round(totalFCFA / exchangeRate);

        setCoutEstime(totalInUserCurrency);
    }, [duree, userCurrency, videos]);

    // ✅ NOUVEAU: Calculer les métriques estimées (portée, impressions)
    const estimatedMetrics = useMemo(() => {
        const nbJours = parseInt(duree) || 7;
        const baseReach = 1000; // Base de 1000 personnes par jour
        const baseImpressions = 3000; // Base de 3000 impressions par jour

        // Multiplicateurs selon la zone
        const zoneMultiplier = {
            local: 1,
            regional: 2.5,
            international: 5,
        }[zoneGeographique] || 1;

        const estimatedReach = Math.round(baseReach * nbJours * zoneMultiplier);
        const estimatedImpressions = Math.round(baseImpressions * nbJours * zoneMultiplier);

        return { estimatedReach, estimatedImpressions };
    }, [duree, zoneGeographique]);

    // ✅ NOUVEAU: Générer des suggestions intelligentes pour titre/description via IA
    const generateSuggestions = useCallback(async (field: 'titre' | 'description') => {
        if (selectedProduits.length === 0 || isLoadingSuggestions) return;

        try {
            setIsLoadingSuggestions(true);
            const selectedProducts = produitsList.filter(p => selectedProduits.includes(p.id));

            // Utiliser le nouveau composant AISuggestionsGenerator via l'API backend
            const response = await apiPost('/api/publicites/ai/generate-suggestions', {
                field,
                products: selectedProducts.map(p => ({
                    nom: p.nom,
                    nom_produit: p.nom,
                    name: p.nom,
                    prix: p.prix,
                    description: p.description,
                    category_key: p.category_key,
                })),
                target_audience: targeting.gender !== 'all' ? {
                    ageRange: targeting.ageRange,
                    gender: targeting.gender,
                    interests: targeting.interests,
                } : undefined,
                campaign_goal: 'conversion', // Par défaut
                count: 5,
            });

            if (response.success && response.data?.suggestions) {
                setSuggestions(response.data.suggestions.map((s: any) => s.text));
            } else {
                // Fallback si l'IA échoue
                const productNames = selectedProducts.map(p => p.nom).join(', ');
                const suggestionsMap: Record<string, string[]> = {
                    titre: [
                        `Promotion ${productNames} - Offre spéciale`,
                        `Découvrez ${productNames} - Prix réduits`,
                        `${productNames} - Promotion limitée`,
                        `Offre exclusive sur ${productNames}`,
                    ],
                    description: [
                        `Profitez de nos produits ${productNames} à prix réduits. Offre limitée dans le temps !`,
                        `Découvrez notre sélection ${productNames}. Qualité garantie et livraison rapide.`,
                        `Ne manquez pas cette opportunité sur ${productNames}. Commandez maintenant !`,
                    ],
                };
                setSuggestions(suggestionsMap[field] || []);
            }
        } catch (error) {
            console.error('[CreatePublicite] Erreur génération suggestions:', error);
            // Fallback en cas d'erreur
            const selectedProducts = produitsList.filter(p => selectedProduits.includes(p.id));
            const productNames = selectedProducts.map(p => p.nom).join(', ');
            const suggestionsMap: Record<string, string[]> = {
                titre: [`Promotion ${productNames} - Offre spéciale`],
                description: [`Profitez de nos produits ${productNames} à prix réduits.`],
            };
            setSuggestions(suggestionsMap[field] || []);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [selectedProduits, produitsList, isLoadingSuggestions, targeting]);

    // ✅ NOUVEAU: Validation en temps réel
    useEffect(() => {
        const errors: Record<string, string> = {};

        if (titre.trim().length < 5) {
            errors.titre = 'Le titre doit contenir au moins 5 caractères';
        }

        if (titre.trim().length > 100) {
            errors.titre = 'Le titre ne peut pas dépasser 100 caractères';
        }

        setValidationErrors(errors);
    }, [titre, description]);

    // ✅ NOUVEAU: Appliquer un template
    const handleTemplateSelect = useCallback((template: any) => {
        switch (template.id) {
            case 'promo':
                setTitre('Promotion Flash - Offre limitée !');
                setDescription('Profitez de nos prix réduits pour une durée limitée. Ne manquez pas cette opportunité !');
                setDuree('7');
                break;
            case 'new_product':
                setTitre('Nouveau Produit - Découvrez maintenant !');
                setDescription('Soyez parmi les premiers à découvrir notre nouveau produit. Qualité garantie !');
                setDuree('14');
                break;
            case 'seasonal':
                setTitre('Offre Saisonnière - Spécial événement');
                setDescription('Célébrez avec nous ! Offres spéciales pour cette occasion unique.');
                setDuree('30');
                break;
            case 'testimonial':
                setTitre('Nos clients recommandent - Avis vérifiés');
                setDescription('Rejoignez nos clients satisfaits. Découvrez pourquoi ils nous font confiance.');
                setDuree('14');
                break;
        }
        setShowTemplates(false);
    }, []);

    // ✅ NOUVEAU: Obtenir la miniature pour la prévisualisation
    const previewThumbnail = useMemo(() => {
        if (videos.length > 0 && videos[0].thumbnail) {
            return `data:image/jpeg;base64,${videos[0].thumbnail}`;
        }
        if (selectedProduits.length > 0) {
            const product = produitsList.find(p => selectedProduits.includes(p.id));
            if (product?.images && product.images.length > 0) {
                const img = product.images[0];
                if (typeof img === 'string') {
                    if (img.startsWith('data:image')) return img;
                    if (img.startsWith('http')) return img;
                    return buildMediaUrl(img) || null;
                }
            }
        }
        return undefined;
    }, [videos, selectedProduits, produitsList]);

    // Sélection de vidéos
    const handleSelectVideo = async () => {
        try {
            // ✅ CORRIGÉ: Protection contre undefined pour MediaType.Videos
            if (!ImagePicker || !ImagePicker.MediaType) {
                console.error('[CreatePubliciteScreen] ImagePicker ou MediaType est undefined');
                Alert.alert('Erreur', 'Impossible d\'accéder à la galerie. Veuillez réessayer.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaType.Videos,
                allowsEditing: false,
                quality: 0.8,
                // ✅ CORRECTION: Suppression de la contrainte de durée vidéo
            });

            if (!result.canceled && result.assets[0]) {
                const video = result.assets[0];

                // ✅ CORRECTION: expo-video non installé, on utilise la première frame
                try {
                    // const { uri: thumbnailUri } = await getThumbnailAsync(video.uri, {
                    //     time: 1000,
                    // });
                    const thumbnailUri = video.uri; // Utiliser l'URI vidéo directement

                    // Convertir en base64
                    const videoBase64 = await FileSystem.readAsStringAsync(video.uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    const thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    const durationSeconds = typeof video.duration === 'number' ? video.duration : 0;
                    const durationMs = durationSeconds > 0 && durationSeconds < 1000
                        ? Math.round(durationSeconds * 1000)
                        : Math.round(durationSeconds);

                    setVideos((prev) => [
                        ...prev,
                        {
                            uri: video.uri,
                            base64: videoBase64,
                            thumbnail: thumbnailBase64,
                            duration: durationMs,
                            source: 'manual',
                            format: 'video',
                            ai_generated: false,
                        },
                    ]);
                } catch (thumbError) {
                    console.error('Erreur génération miniature:', thumbError);
                    Alert.alert(t('message.error'), 'Impossible de générer la miniature de la vidéo');
                }
            }
        } catch (error) {
            console.error('Erreur sélection vidéo:', error);
            Alert.alert(t('message.error'), 'Impossible de sélectionner la vidéo');
        }
    };

    // ✅ Soumettre la publicité avec gestion recharge
    const handleCreatePublicite = async () => {
        // Validation basique
        if (!titre.trim()) {
            Alert.alert(t('message.error'), 'Veuillez saisir un titre pour la publicité');
            return;
        }

        // ✅ CORRECTION: Produit optionnel (avertissement seulement)
        if (selectedProduits.length === 0) {
            console.warn('[CreatePublicite] ⚠️ Aucun produit sélectionné');
            // Ne pas bloquer, juste avertir
        }

        if (!titre.trim()) {
            Alert.alert(t('message.error'), 'Veuillez entrer un titre pour la publicité');
            return;
        }

        // Vérifier le solde
        try {
            setLoading(true);

            const balanceResponse = await apiGet('/api/users/balance');
            if (!balanceResponse.success) {
                Alert.alert(t('message.error'), 'Impossible de vérifier votre solde');
                setLoading(false);
                return;
            }

            const solde = (balanceResponse.data as any)?.tokens_balance || 0;

            // Convertir le coût en FCFA pour la comparaison avec le solde (qui est en FCFA)
            const exchangeRate = EXCHANGE_RATES[userCurrency] || 1;
            const coutEnFCFA = Math.round(coutEstime * exchangeRate);

            if (solde < coutEnFCFA) {
                Alert.alert(
                    `💸 ${t('publicite.balance_insufficient')}`,
                    `${t('publicite.total_cost')} : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
                    `Votre solde : ${Math.round(solde / exchangeRate).toLocaleString()} ${userCurrency}\n\n` +
                    `${t('publicite.recharge_account')}`,
                    [
                        { text: t('button.cancel'), style: 'cancel', onPress: () => setLoading(false) },
                        {
                            text: '💳 Recharger',
                            onPress: () => {
                                setLoading(false);
                                (navigation as any).navigate('RechargeTokens');
                            }
                        }
                    ]
                );
                return;
            }

            // Confirmation
            Alert.alert(
                `💰 ${t('button.confirm')}`,
                `Créer cette publicité ?\n\n` +
                `${t('publicite.products')} : ${selectedProduits.length}\n` +
                `${t('publicite.videos')} : ${videos.length}\n` +
                `${t('publicite.duration')} : ${duree} jours\n` +
                `${t('publicite.zone')} : ${getZoneLabel(zoneGeographique)}\n\n` +
                `${t('publicite.total_cost')} : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
                `Solde après : ${Math.round((solde - coutEnFCFA) / exchangeRate).toLocaleString()} ${userCurrency}`,
                [
                    { text: t('button.cancel'), style: 'cancel', onPress: () => setLoading(false) },
                    {
                        text: t('button.confirm'),
                        onPress: async () => {
                            try {
                                const publiciteData = {
                                    user_id: parseInt(user?.id || '0'),
                                    titre,
                                    description,
                                    produits_indexes: selectedProduits,
                                    videos: videos.map(v => v.base64),
                                    thumbnails: videos.map(v => v.thumbnail),
                                    videos_meta: videos.map((video) => ({
                                        format: typeof video.format === 'string'
                                            ? video.format
                                            : (typeof video.source === 'string' && video.source.includes('ai') ? 'square' : undefined),
                                        source: typeof video.source === 'string' ? video.source : undefined,
                                        duration_ms: typeof video.duration === 'number' ? video.duration : undefined,
                                        ai_generated: typeof video.ai_generated === 'boolean'
                                            ? video.ai_generated
                                            : (typeof video.source === 'string' && video.source.includes('ai')),
                                    })),
                                    duree_jours: parseInt(duree),
                                    cout: coutEnFCFA, // Toujours en FCFA côté backend
                                    zone_geographique: zoneGeographique,
                                    devise_utilisateur: userCurrency,
                                    // ✅ NOUVEAU: Données avancées pour 100% parité
                                    targeting: {
                                        age_range: { min: targeting.ageRange.min, max: targeting.ageRange.max },
                                        gender: targeting.gender,
                                        interests: targeting.interests,
                                        behaviors: targeting.behaviors,
                                        locations: targeting.locations,
                                    },
                                    ab_testing: {
                                        variants: abVariants.map(v => ({
                                            titre: v.titre,
                                            description: v.description,
                                            is_active: v.isActive,
                                        })),
                                    },
                                    schedule: schedule.startDate ? {
                                        start_date: schedule.startDate.toISOString(),
                                        end_date: schedule.endDate?.toISOString() || null,
                                        start_time: schedule.startTime?.toISOString() || null,
                                        end_time: schedule.endTime?.toISOString() || null,
                                        timezone: schedule.timezone,
                                        pause_on_weekends: schedule.pauseOnWeekends,
                                        pause_hours: schedule.pauseHours,
                                    } : null,
                                    placements: placements.filter(p => p.enabled).map(p => ({
                                        type: p.type,
                                        budget: p.budget || 0,
                                    })),
                                    bid_strategy: {
                                        type: bidStrategy.type,
                                        bid_amount: bidStrategy.bidAmount,
                                    },
                                    retargeting: {
                                        rules: retargetingRules.filter(r => r.enabled).map(r => ({
                                            type: r.type,
                                            days_since: r.daysSince || 7,
                                        })),
                                    },
                                };

                                // ✅ Appel API selon le mode
                                const response = mode === 'edit' && publiciteId
                                    ? await apiPost(`/api/publicites/${publiciteId}/update`, publiciteData)
                                    : await apiPost('/api/publicites/create', publiciteData);

                                if (response.success) {
                                    Alert.alert(
                                        `✅ ${t('publicite.create_success')}`,
                                        `${t('publicite.total_cost')} : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
                                        `${t('publicite.duration')} : ${duree} jours`,
                                        [
                                            {
                                                text: 'OK',
                                                onPress: () => {
                                                    // Rediriger vers le dashboard des publicités
                                                    (navigation as any).navigate('PubliciteDashboard');
                                                }
                                            }
                                        ]
                                    );
                                } else {
                                    Alert.alert(t('message.error'), response.error || 'Impossible de créer la publicité');
                                }

                                setLoading(false);
                            } catch (error) {
                                console.error('[CreatePublicite] Erreur création:', error);
                                Alert.alert(t('message.error'), 'Une erreur est survenue');
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('[CreatePublicite] Erreur:', error);
            setLoading(false);
        }
    };

    const toggleProduitSelection = (produitId: string) => {
        if (selectedProduits.includes(produitId)) {
            setSelectedProduits(selectedProduits.filter(id => id !== produitId));
        } else {
            setSelectedProduits([...selectedProduits, produitId]);
        }
    };

    const removeVideo = (index: number) => {
        setVideos(videos.filter((_, i) => i !== index));
    };

    const openVideoCreator = () => {
        if (produitsList.length === 0) {
            Alert.alert(t('message.error'), 'Ajoutez au moins un produit pour générer une vidéo.');
            return;
        }

        const preferredProduct =
            produitsList.find((prod) => selectedProduits.includes(prod.id)) || produitsList[0];

        setPrimaryProduct(preferredProduct || null);
        setVideoCreatorVisible(true);
    };

    const handleVideoGenerationSuccess = async (result: GeneratedVideoResponse) => {
        try {
            setIsConvertingVideo(true);
            const squareVideoUrl = pickSquareVideoUrl(result);

            if (!squareVideoUrl) {
                Alert.alert(t('message.error'), 'Impossible de récupérer la vidéo générée.');
                return;
            }

            const normalizedVideoUrl =
                squareVideoUrl.startsWith('data:')
                    ? squareVideoUrl
                    : buildMediaUrl(squareVideoUrl) || squareVideoUrl;

            if (!normalizedVideoUrl || (!normalizedVideoUrl.startsWith('http') && !normalizedVideoUrl.startsWith('data:'))) {
                Alert.alert(t('message.error'), 'Format de vidéo inattendu.');
                return;
            }

            const videoBase64 = normalizedVideoUrl.startsWith('data:video')
                ? stripDataUriPrefix(normalizedVideoUrl)
                : await downloadAsBase64(normalizedVideoUrl, 'mp4');

            if (!videoBase64) {
                Alert.alert(t('message.error'), 'Conversion de la vidéo IA impossible.');
                return;
            }

            const thumbnailBase64 =
                (await pickSquareThumbnail(result, primaryProduct)) ||
                (await pickSquareThumbnail(result, produitsList.find((prod) => selectedProduits.includes(prod.id)) || null)) ||
                '';

            const durationMs = (result.duration_seconds || 0) * 1000;

            setVideos((prev) => [
                ...prev,
                {
                    uri: normalizedVideoUrl,
                    base64: videoBase64,
                    thumbnail: thumbnailBase64,
                    duration: durationMs,
                    source: 'ai',
                    format: 'square',
                    ai_generated: true,
                },
            ]);

            setVideoCreatorVisible(false);
            Alert.alert('✅ Vidéo ajoutée', 'La vidéo carrée IA est prête pour votre publicité.');
        } catch (error) {
            console.error('[CreatePublicite] Erreur intégration vidéo IA:', error);
            Alert.alert(t('message.error'), 'Impossible d’intégrer la vidéo générée.');
        } finally {
            setIsConvertingVideo(false);
        }
    };

    useEffect(() => {
        if (selectedProduits.length === 0 || produitsList.length === 0) {
            return;
        }
        const firstSelected = produitsList.find((prod) => selectedProduits.includes(prod.id));
        if (firstSelected) {
            setPrimaryProduct(firstSelected);
        }
    }, [selectedProduits, produitsList]);

    const getZoneLabel = (zone: string): string => {
        const labels: { [key: string]: string } = {
            'local': t('publicite.zone.local'),
            'regional': t('publicite.zone.regional'),
            'international': t('publicite.zone.international')
        };
        return labels[zone] || zone;
    };

    // ✅ Navigation manuelle uniquement via boutons Précédent/Suivant
    // (plus d'auto-calcul de currentStep qui empêchait la navigation)

    // Navigation directe par clic sur le stepper
    const handleStepPress = useCallback((stepIndex: number) => {
        setCurrentStep(stepIndex);
    }, []);

    return (
        <View style={styles.container}>
            <LinearGradient colors={modernColors.primaryGradient} style={styles.header}>
                <NavigatorToolbar
                    tone="dark"
                    showHandle={false}
                    density="compact"
                    backIcon="back"
                    title={mode === 'edit' ? 'Modifier une Publicité' : mode === 'relance' ? 'Relancer une Publicité' : t('publicite.create')}
                    subtitle="Boostez vos produits"
                />
            </LinearGradient>

            {/* ✅ NOUVEAU: Stepper de progression */}
            <View style={styles.stepperContainer}>
                <AdCreationStepper
                    currentStep={currentStep}
                    steps={STEPS}
                    onStepPress={handleStepPress}
                />
            </View>

            <KeyboardAwareScrollView
                ref={scrollViewRef}
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                enableOnAndroid={true}
                enableAutomaticScroll={true}
                extraHeight={Platform.OS === 'android' ? 200 : 100}
                extraScrollHeight={Platform.OS === 'ios' ? 100 : 0}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                scrollEnabled={true}
                bounces={true}
                nestedScrollEnabled={true}
                enableResetScrollToCoords={false}
            >
                {/* ═══════════ ÉTAPE 0 : INFORMATIONS ═══════════ */}
                {currentStep === 0 && (
                    <View>
                        {/* Templates rapides */}
                        {!titre && !showTemplates && (
                            <NativeCard style={styles.templatesCard}>
                                <TouchableOpacity
                                    style={styles.templatesToggle}
                                    onPress={() => setShowTemplates(true)}
                                >
                                    <SafeIcon name="sparkles" size={20} color={modernColors.primary} />
                                    <Text style={styles.templatesToggleText}>Utiliser un template</Text>
                                    <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            </NativeCard>
                        )}
                        {showTemplates && (
                            <NativeCard style={styles.templatesCard}>
                                <View style={styles.templatesHeader}>
                                    <Text style={styles.templatesTitle}>Templates</Text>
                                    <TouchableOpacity onPress={() => setShowTemplates(false)}>
                                        <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <AdTemplates onSelectTemplate={handleTemplateSelect} />
                            </NativeCard>
                        )}

                        <NativeCard style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>📝 Informations générales</Text>

                            <View style={styles.fieldContainer}>
                                <View style={styles.fieldLabelRow}>
                                    <Text style={styles.fieldLabel}>
                                        {t('publicite.title')} <Text style={styles.required}>*</Text>
                                    </Text>
                                </View>
                                <NativeInput
                                    placeholder="Ex: Promotion Immobilier - 20% de remise"
                                    value={titre}
                                    onChangeText={setTitre}
                                    style={[styles.input, validationErrors.titre && styles.inputError]}
                                />
                                {validationErrors.titre && (
                                    <Text style={styles.errorText}>{validationErrors.titre}</Text>
                                )}
                                {selectedProduits.length > 0 && (
                                    <AISuggestionsGenerator
                                        field="titre"
                                        products={produitsList.filter(p => selectedProduits.includes(p.id))}
                                        targetAudience={{ ageRange: targeting.ageRange, gender: targeting.gender, interests: targeting.interests }}
                                        campaignGoal="conversion"
                                        onSuggestionSelect={(s) => { setTitre(s); setSuggestions([]); }}
                                        currentValue={titre}
                                    />
                                )}
                            </View>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>{t('publicite.description')}</Text>
                                <NativeInput
                                    placeholder="Décrivez votre offre promotionnelle..."
                                    value={description}
                                    onChangeText={setDescription}
                                    style={styles.input}
                                    multiline
                                    numberOfLines={3}
                                />
                                {selectedProduits.length > 0 && (
                                    <AISuggestionsGenerator
                                        field="description"
                                        products={produitsList.filter(p => selectedProduits.includes(p.id))}
                                        targetAudience={{ ageRange: targeting.ageRange, gender: targeting.gender, interests: targeting.interests }}
                                        campaignGoal="conversion"
                                        onSuggestionSelect={(s) => setDescription(s)}
                                        currentValue={description}
                                    />
                                )}
                            </View>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>{t('publicite.duration')} <Text style={styles.required}>*</Text></Text>
                                <View style={styles.dureeButtons}>
                                    {['7', '14', '30', '60', '90'].map((d) => (
                                        <TouchableOpacity
                                            key={d}
                                            style={[styles.dureeButton, duree === d && styles.dureeButtonActive]}
                                            onPress={() => setDuree(d)}
                                        >
                                            <Text style={[styles.dureeText, duree === d && styles.dureeTextActive]}>{d} jours</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>{t('publicite.zone')} <Text style={styles.required}>*</Text></Text>
                                <Text style={styles.fieldHint}>{t('publicite.zone.select')}</Text>
                                <View style={styles.zoneButtons}>
                                    {['local', 'regional', 'international'].map((zone) => (
                                        <TouchableOpacity
                                            key={zone}
                                            style={[styles.zoneButton, zoneGeographique === zone && styles.zoneButtonActive]}
                                            onPress={() => setZoneGeographique(zone)}
                                        >
                                            <SafeIcon
                                                name={zone === 'local' ? 'map-pin' : 'globe'}
                                                size={20}
                                                color={zoneGeographique === zone ? '#fff' : modernColors.primary}
                                            />
                                            <Text style={[styles.zoneText, zoneGeographique === zone && styles.zoneTextActive]}>
                                                {getZoneLabel(zone)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </NativeCard>
                    </View>
                )}

                {/* ═══════════ ÉTAPE 1 : PRODUITS ═══════════ */}
                {currentStep === 1 && (
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>📦 {t('publicite.products')} ({selectedProduits.length})</Text>
                        <Text style={styles.sectionHint}>Optionnel — Sélectionnez les produits à promouvoir</Text>

                        {loading ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : produitsList.length === 0 ? (
                            <View style={styles.emptyState}>
                                <SafeIcon name="package" size={48} color="#D1D5DB" />
                                <Text style={styles.emptyText}>Aucun produit disponible</Text>
                                <Text style={styles.emptySubtext}>Créez d'abord un service avec des produits</Text>
                            </View>
                        ) : (
                            <View style={styles.productsList}>
                                {produitsList.map((produit) => {
                                    const isSelected = selectedProduits.includes(produit.id);
                                    return (
                                        <TouchableOpacity
                                            key={produit.id}
                                            style={[styles.productItem, isSelected && styles.productItemSelected]}
                                            onPress={() => toggleProduitSelection(produit.id)}
                                        >
                                            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                                {isSelected && <SafeIcon name="check" size={16} color="#fff" />}
                                            </View>
                                            <View style={styles.productInfo}>
                                                <Text style={styles.productName}>{produit.nom || 'Produit'}</Text>
                                                <Text style={styles.productService}>Service: {produit.serviceTitre}</Text>
                                                {produit.prix ? (
                                                    <Text style={styles.productPrice}>{produit.prix} {produit.devise || 'FCFA'}</Text>
                                                ) : null}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </NativeCard>
                )}

                {/* ═══════════ ÉTAPE 2 : MÉDIAS ═══════════ */}
                {currentStep === 2 && (
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>🎬 {t('publicite.videos')} ({videos.length})</Text>
                        <Text style={styles.sectionHint}>Maximum 30 secondes par vidéo</Text>

                        <TouchableOpacity
                            style={[styles.addVideoButton, isConvertingVideo && styles.addVideoButtonDisabled]}
                            onPress={handleSelectVideo}
                            disabled={isConvertingVideo}
                        >
                            <SafeIcon name="video" size={20} color={modernColors.primary} />
                            <Text style={styles.addVideoText}>Ajouter une vidéo</Text>
                        </TouchableOpacity>

                        {isExistingMode && (
                            <View style={styles.noticeRow}>
                                <SafeIcon name="info" size={16} color={modernColors.primary} />
                                <Text style={styles.noticeText}>
                                    Les vidéos existantes ne sont pas rechargées. Importez-les à nouveau ou générez une nouvelle version avec Yukpo IA.
                                </Text>
                            </View>
                        )}

                        <Text style={[styles.fieldHint, { marginTop: 12 }]}>
                            Générer automatiquement une vidéo carrée optimisée grâce à Yukpo IA.
                        </Text>
                        <NativeButton
                            title={isConvertingVideo ? 'Génération IA en cours...' : 'Générer une vidéo carrée IA'}
                            onPress={openVideoCreator}
                            variant="secondary"
                            size="medium"
                            disabled={isConvertingVideo || produitsList.length === 0}
                            style={styles.generateButton}
                        />
                        {isConvertingVideo && (
                            <View style={styles.aiProgressRow}>
                                <ActivityIndicator size="small" color={modernColors.primary} />
                                <Text style={styles.aiProgressText}>Conversion du média IA...</Text>
                            </View>
                        )}

                        {videos.length > 0 && (
                            <View style={styles.videosGrid}>
                                {videos.map((video, index) => (
                                    <View key={index} style={styles.videoCard}>
                                        <Image
                                            source={{ uri: `data:image/jpeg;base64,${video.thumbnail}` }}
                                            style={styles.videoThumbnail}
                                        />
                                        <TouchableOpacity style={styles.removeVideoButton} onPress={() => removeVideo(index)}>
                                            <SafeIcon name="x" size={16} color="#fff" />
                                        </TouchableOpacity>
                                        <View style={styles.videoDuration}>
                                            <SafeIcon name="play" size={12} color="#fff" />
                                            <Text style={styles.videoDurationText}>{String(Math.round((video.duration || 0) / 1000))}s</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Bibliothèque de Médias */}
                        <View style={{ marginTop: 16 }}>
                            <AssetLibrary
                                type="all"
                                onSelectAsset={(asset) => {
                                    if (asset.type === 'video') {
                                        setVideos((prev) => [...prev, {
                                            uri: asset.url, base64: '', thumbnail: asset.thumbnail || '',
                                            duration: 0, source: 'library', format: 'video', ai_generated: false,
                                        }]);
                                    }
                                    setSelectedAssets([...selectedAssets, asset.id]);
                                }}
                                userId={user ? parseInt(user.id) : undefined}
                                selectedAssets={selectedAssets}
                            />
                        </View>
                    </NativeCard>
                )}

                {/* ═══════════ ÉTAPE 3 : BUDGET ═══════════ */}
                {currentStep === 3 && (
                    <View>
                        {/* Info facturation */}
                        <NativeCard style={styles.infoCard}>
                            <View style={styles.infoHeader}>
                                <SafeIcon name="info" size={20} color={modernColors.primary} />
                                <Text style={styles.infoTitle}>{t('publicite.pricing')}</Text>
                            </View>
                            <Text style={styles.infoText}>• {t('publicite.price_per_day')}</Text>
                            <Text style={styles.infoText}>• +2 000 FCFA par vidéo</Text>
                            <Text style={styles.infoText}>• Conversion automatique en {userCurrency}</Text>
                        </NativeCard>

                        <NativeCard style={[styles.sectionCard, styles.summaryCard]}>
                            <Text style={styles.sectionTitle}>💰 Budget & Performance</Text>

                            <BudgetSlider
                                value={coutEstime}
                                min={Math.max(100, Math.round(coutEstime * 0.5))}
                                max={Math.round(coutEstime * 3)}
                                step={100}
                                currency={userCurrency}
                                onValueChange={(value) => {
                                    const exchangeRate = EXCHANGE_RATES[userCurrency] || 1;
                                    const valueFCFA = Math.round(value * exchangeRate);
                                    const baseCost = 2000 * videos.length;
                                    const daysFromBudget = Math.max(1, Math.round((valueFCFA - baseCost) / PRICE_PER_DAY_FCFA));
                                    if (daysFromBudget <= 90) setDuree(daysFromBudget.toString());
                                }}
                                estimatedReach={estimatedMetrics.estimatedReach}
                                estimatedImpressions={estimatedMetrics.estimatedImpressions}
                            />

                            <BidStrategySelector strategy={bidStrategy} onStrategyChange={setBidStrategy} />

                            <View style={styles.divider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.products_selected')}</Text>
                                <Text style={styles.summaryValue}>{selectedProduits.length}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.videos_added')}</Text>
                                <Text style={styles.summaryValue}>{videos.length}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.duration')}</Text>
                                <Text style={styles.summaryValue}>{duree} jours</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.zone')}</Text>
                                <Text style={styles.summaryValue}>{getZoneLabel(zoneGeographique)}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.totalLabel}>{t('publicite.total_cost')}</Text>
                                <Text style={styles.totalValue}>{coutEstime.toLocaleString()} {userCurrency}</Text>
                            </View>
                        </NativeCard>
                    </View>
                )}

                {/* ═══════════ ÉTAPE 4 : CIBLAGE & OPTIONS ═══════════ */}
                {currentStep === 4 && (
                    <View>
                        <AdvancedTargeting targeting={targeting} onTargetingChange={setTargeting} />

                        <ABTestingVariants
                            variants={abVariants}
                            onVariantsChange={setAbVariants}
                            onAddVariant={() => setAbVariants([...abVariants, { id: Date.now().toString(), titre: '', description: '', isActive: false }])}
                            onRemoveVariant={(id) => setAbVariants(abVariants.filter(v => v.id !== id))}
                        />

                        {abVariants.length > 0 && (
                            <AdvancedABTesting
                                campaignId={publiciteId || undefined}
                                variants={abVariants}
                                onVariantsChange={setAbVariants}
                                onAddVariant={() => setAbVariants([...abVariants, { id: Date.now().toString(), titre: '', description: '', isActive: false }])}
                                onRemoveVariant={(id) => setAbVariants(abVariants.filter(v => v.id !== id))}
                                userId={user ? parseInt(user.id) : undefined}
                            />
                        )}

                        <AutoOptimizationSettings
                            userId={user ? parseInt(user.id) : undefined}
                            campaignId={publiciteId || undefined}
                            onSettingsChange={(settings) => console.log('[CreatePubliciteScreen] Auto optimization:', settings)}
                        />

                        <CampaignScheduler schedule={schedule} onScheduleChange={setSchedule} />

                        <PlacementSelector placements={placements} onPlacementsChange={setPlacements} totalBudget={coutEstime} />

                        <RetargetingOptions rules={retargetingRules} onRulesChange={setRetargetingRules} />

                        <CustomAudienceManager
                            selectedAudiences={selectedAudiences}
                            onAudiencesChange={setSelectedAudiences}
                            userId={user ? parseInt(user.id) : undefined}
                        />
                    </View>
                )}

                {/* ═══════════ ÉTAPE 5 : CONFIRMATION & CRÉATION ═══════════ */}
                {currentStep === 5 && (
                    <View>
                        {/* Aperçu final */}
                        {(titre || videos.length > 0 || selectedProduits.length > 0) && (
                            <NativeCard style={styles.previewCard}>
                                <Text style={styles.previewTitle}>Aperçu de votre publicité</Text>
                                <AdPreviewCard
                                    titre={titre || 'Titre de votre publicité'}
                                    description={description}
                                    thumbnail={previewThumbnail}
                                    videoCount={videos.length}
                                    productCount={selectedProduits.length}
                                    zone={zoneGeographique}
                                    duree={parseInt(duree) || 7}
                                />
                            </NativeCard>
                        )}

                        {/* Récapitulatif final */}
                        <NativeCard style={[styles.sectionCard, styles.summaryCard]}>
                            <Text style={styles.sectionTitle}>Récapitulatif</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Titre</Text>
                                <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>{titre || '—'}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.products_selected')}</Text>
                                <Text style={styles.summaryValue}>{selectedProduits.length}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.videos_added')}</Text>
                                <Text style={styles.summaryValue}>{videos.length}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.duration')}</Text>
                                <Text style={styles.summaryValue}>{duree} jours</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('publicite.zone')}</Text>
                                <Text style={styles.summaryValue}>{getZoneLabel(zoneGeographique)}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.totalLabel}>{t('publicite.total_cost')}</Text>
                                <Text style={styles.totalValue}>{coutEstime.toLocaleString()} {userCurrency}</Text>
                            </View>
                        </NativeCard>

                        {/* Bouton de création */}
                        <NativeButton
                            title={loading ? t('message.loading') :
                                mode === 'edit' ? 'Enregistrer les modifications' :
                                    mode === 'relance' ? 'Relancer la publicité' :
                                        t('publicite.create')}
                            onPress={handleCreatePublicite}
                            disabled={loading || !titre.trim()}
                            variant="primary"
                            size="large"
                            style={styles.createButton}
                        />
                    </View>
                )}

                <View style={{ height: 100 }} />
            </KeyboardAwareScrollView>

            {/* Boutons de navigation sticky en bas */}
            <View style={styles.stickyNavigationButtons}>
                {currentStep > 0 ? (
                    <TouchableOpacity
                        style={[styles.navButton, styles.navButtonPrev]}
                        onPress={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    >
                        <SafeIcon name="chevron-left" size={20} color={modernColors.primary} />
                        <Text style={styles.navButtonTextPrev}>Précédent</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.navButton} />
                )}
                {currentStep < STEPS.length - 1 ? (
                    <TouchableOpacity
                        style={[styles.navButton, styles.navButtonNext]}
                        onPress={() => {
                            if (currentStep === 0 && !titre.trim()) {
                                Alert.alert('Champ requis', 'Veuillez saisir un titre pour continuer');
                                return;
                            }
                            setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1));
                        }}
                    >
                        <Text style={styles.navButtonTextNext}>Suivant</Text>
                        <SafeIcon name="chevron-right" size={20} color="#fff" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.navButton} />
                )}
            </View>

            <ProductVideoCreationModal
                visible={videoCreatorVisible}
                primaryProduct={primaryProduct}
                products={produitsList}
                onClose={() => setVideoCreatorVisible(false)}
                onSuccess={handleVideoGenerationSuccess}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    content: {
        flex: 1,
        // ✅ CORRIGÉ: S'assurer que le ScrollView peut scroller librement
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 250, // ✅ CORRIGÉ: Espace suffisant pour les boutons sticky en bas et tous les éléments
        // ✅ CORRIGÉ: Supprimé flexGrow: 1 qui peut bloquer le scroll
    },
    infoCard: {
        padding: 16,
        marginBottom: 16,
        backgroundColor: '#EFF6FF',
        borderColor: '#DBEAFE',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    infoText: {
        fontSize: 13,
        color: '#60A5FA',
        marginBottom: 4,
    },
    sectionCard: {
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    sectionHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    fieldContainer: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    fieldHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    required: {
        color: '#EF4444',
    },
    input: {
        width: '100%',
    },
    dureeButtons: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    dureeButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    dureeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dureeText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    dureeTextActive: {
        color: '#fff',
    },
    zoneButtons: {
        flexDirection: 'column',
        gap: 10,
    },
    zoneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    zoneButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    zoneText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    zoneTextActive: {
        color: '#fff',
    },
    productsList: {
        // ✅ CORRIGÉ: Supprimé maxHeight pour permettre l'affichage de tous les produits
        // Le scroll est géré par le KeyboardAwareScrollView parent
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    productItemSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    productService: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    productPrice: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
        marginTop: 4,
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 8,
    },
    emptySubtext: {
        fontSize: 13,
        color: modernColors.textTertiary,
        marginTop: 4,
    },
    addVideoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    addVideoButtonDisabled: {
        opacity: 0.6,
    },
    addVideoText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    noticeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 10,
        padding: 12,
    },
    noticeText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
        color: modernColors.textSecondary,
    },
    generateButton: {
        marginTop: 12,
    },
    aiProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    aiProgressText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    videosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 16,
    },
    videoCard: {
        width: (width - 64) / 2,
        height: 120,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
    },
    removeVideoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoDuration: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    videoDurationText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    summaryCard: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    divider: {
        height: 1,
        backgroundColor: modernColors.border,
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.success,
    },
    createButton: {
        marginTop: 8,
        marginBottom: 16,
    },
    // ✅ NOUVEAU: Styles pour les nouvelles fonctionnalités
    stepperContainer: {
        backgroundColor: modernColors.surface,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    templatesCard: {
        marginBottom: 16,
    },
    templatesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    templatesTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    templatesToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
    },
    templatesToggleText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    previewCard: {
        marginBottom: 16,
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    previewTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    showPreviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        marginBottom: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
    },
    showPreviewText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    fieldLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    suggestionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
    suggestionButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
    },
    inputError: {
        borderColor: modernColors.error,
        borderWidth: 1,
    },
    errorText: {
        fontSize: 11,
        color: modernColors.error,
        marginTop: 4,
    },
    suggestionsContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        gap: 8,
    },
    suggestionsTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    suggestionText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.text,
    },
    // ✅ AMÉLIORÉ: Styles pour les boutons de navigation sticky
    stickyNavigationButtons: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        padding: 16,
        paddingBottom: 20,
        backgroundColor: modernColors.background,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    // ✅ ANCIEN: Navigation dans le scroll (conservé pour compatibilité)
    navigationButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 24,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    navButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        minHeight: 48,
    },
    navButtonPrev: {
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    navButtonNext: {
        backgroundColor: modernColors.primary,
    },
    navButtonTextPrev: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.primary,
    },
    navButtonTextNext: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});

export default CreatePubliciteScreen;
