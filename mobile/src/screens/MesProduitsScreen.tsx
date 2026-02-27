// @ts-nocheck
// ✅ MIGRÉ: Utilise react-native-reanimated pour de meilleures performances
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    DeviceEventEmitter,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import ProductDeliveryConfigModal from '../components/delivery/ProductDeliveryConfigModal';
import NavigatorToolbar from '../components/NavigatorToolbar';
import ProductVideoCreationModal from '../components/ProductVideoCreationModal';
import SafeIcon from '../components/SafeIcon';
import { NativeCard } from '../components/SafeNativeDesign';
import ServiceMediaGallery from '../components/ServiceMediaGallery';
import ServiceTeamManager from '../components/ServiceTeamManager';
import config from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost, mediaApi } from '../services/api';
import { productsService } from '../services/productsService';
import { genererSuggestionsService } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import { GeneratedVideoResponse } from '../types/VideoGeneration';
import { getFieldValue } from '../utils/productNormalizer';
import { generateProductShareMessage, generateSmartShareLink } from '../utils/productShareHelper';
import { navigateToVideoWizard } from '../utils/videoNavigation';

// ✅ CORRIGÉ: Utiliser getFieldValue standardisé au lieu d'extractValue locale
const extractValue = (field: any): string | null => {
    const value = getFieldValue(field);
    if (!value) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return null;
};

// ✅ Helper pour construire l'URL complète d'un média
// ✅ CORRIGÉ 2025-11-30: Utiliser l'endpoint /api/media/files pour les chemins uploads/
const buildMediaUrl = (path?: string | null): string | null => {
    if (!path || typeof path !== 'string') {
        return null;
    }
    const trimmed = path.trim();
    if (trimmed.length === 0) {
        return null;
    }
    // Si c'est déjà une URL complète (http/https/data), retourner tel quel
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

const normalizeCategoryKey = (product: Record<string, any>): string | null => {
    const raw = extractValue(product?.categorie_produit)
        ?? extractValue(product?.categorie)
        ?? extractValue(product?.category)
        ?? extractValue(product?.type)
        ?? extractValue(product?.service_category)  // ✅ CORRECTION 2025-11-28: Support service_category depuis backend
        ?? extractValue(product?.serviceCategorie);

    return raw ? raw.toLowerCase() : null;
};

const getProductTypeLabel = (type: string | null | undefined): string => {
    if (!type) return 'Non catégorisé';
    const key = type.toLowerCase();
    const labels: Record<string, string> = {
        'electronique': '📱 Électronique',
        'informatique': '💻 Informatique',
        'plombier': '🔧 Plomberie',
        'plomberie': '🔧 Plomberie',
        'electricite': '⚡ Électricité',
        'automobile': '🚗 Automobile',
        'agriculture': '🌾 Agriculture',
        'beaute': '💄 Beauté',
        'sante': '🩺 Santé',
        'immobilier': '🏢 Immobilier',
        'service': '💼 Service',
        'prestation': '💼 Prestation',
        'ticket_voyage': '🚌 Ticket de voyage',
    };

    if (labels[key]) {
        return labels[key];
    }

    if (!key) {
        return 'Autres catégories';
    }

    return key.charAt(0).toUpperCase() + key.slice(1);
};

const formatStatValue = (value?: number): string => {
    const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
    if (safe >= 1_000_000) {
        return `${(safe / 1_000_000).toFixed(1)}M`;
    }
    if (safe >= 1_000) {
        return `${(safe / 1_000).toFixed(1)}k`;
    }
    return safe.toLocaleString('fr-FR');
};

const resolveNumericId = (value: any): number | null => {
    if (value === null || value === undefined) {
        return null;
    }
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseDateToTimestamp = (value: any): number => {
    if (!value) {
        return 0;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        if (!trimmed) {
            return 0;
        }

        // Essayer de parser un entier (timestamp déjà numérique)
        const numericCandidate = Number(trimmed);
        if (!Number.isNaN(numericCandidate) && Number.isFinite(numericCandidate)) {
            if (numericCandidate > 10_000_000_000) {
                // Probablement un timestamp en millisecondes
                return numericCandidate;
            }

            if (numericCandidate > 10_000_000) {
                // Probablement un timestamp en secondes
                return numericCandidate * 1000;
            }
        }

        const parsedDate = Date.parse(trimmed.replace(/\.\d{3}Z$/, 'Z'));

        if (!Number.isNaN(parsedDate)) {
            return parsedDate;
        }
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.getTime();
    }

    return 0;
};

const resolveProductTimestamp = (product: Record<string, any>, fallback?: number): number => {
    if (!product || typeof product !== 'object') {
        return fallback || 0;
    }

    const candidates: any[] = [
        product.created_at_ts,
        product.created_at,
        product.createdAt,
        product.created_at_api,
        product.created_at_iso,
        product.created_at_app,
        product.createdAtISO,
        product.createdAtMs,
        product.created_at_ms,
        product.lifecycle_created_at,
        product.lifecycleCreatedAt,
        product.updated_at,
        product.updatedAt,
        product.date_creation,
        product.dateCreation,
        product.metadata?.created_at,
        product.metadata?.createdAt,
        product.stats?.created_at,
        product.stats?.createdAt,
    ];

    for (const candidate of candidates) {
        const timestamp = parseDateToTimestamp(candidate);
        if (timestamp) {
            return timestamp;
        }
    }

    if (typeof fallback === 'number' && fallback > 0) {
        return fallback;
    }

    if (product.rawProductId) {
        const numericId = Number(product.rawProductId);
        if (!Number.isNaN(numericId) && Number.isFinite(numericId)) {
            return numericId;
        }
    }

    return 0;
};

const HEADER_HEIGHT = Platform.OS === 'ios' ? 88 : 72;

const MesProduitsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [products, setProducts] = useState<ManagedProduct[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [showTeamManager, setShowTeamManager] = useState(false);
    const [teamManagerServiceId, setTeamManagerServiceId] = useState<string>('');
    const [videoCreatorVisible, setVideoCreatorVisible] = useState(false);
    const [videoCreatorProduct, setVideoCreatorProduct] = useState<ManagedProduct | null>(null);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showDeliveryConfigModal, setShowDeliveryConfigModal] = useState(false);
    const [deliveryConfigProduct, setDeliveryConfigProduct] = useState<ManagedProduct | null>(null);
    const [showMediaGallery, setShowMediaGallery] = useState(false);
    const [selectedServiceForGallery, setSelectedServiceForGallery] = useState<any>(null);
    // ✅ MIGRÉ: Utilise useSharedValue au lieu de Animated.Value
    const scrollY = useSharedValue(0);
    const [headerHeight, setHeaderHeight] = useState(HEADER_HEIGHT);

    // ✅ MIGRÉ: Handler de scroll avec Reanimated
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // ✅ MIGRÉ: Style animé du header avec Reanimated
    const headerAnimatedStyle = useAnimatedStyle(() => {
        const collapseDistance = Math.max(headerHeight - 48, 0);
        const translateY = scrollY.value > collapseDistance
            ? -collapseDistance
            : -scrollY.value;
        return {
            transform: [{ translateY: Math.max(translateY, -collapseDistance) }],
        };
    });

    const handleHeaderLayout = useCallback(({ nativeEvent }: any) => {
        const { height } = nativeEvent.layout;
        if (height && Math.abs(height - headerHeight) > 4) {
            setHeaderHeight(height);
        }
    }, [headerHeight]);

    // Charger tous les produits de tous les services du prestataire
    const loadProducts = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // ✅ PHASE 4: Charger les produits directement depuis l'API service_products
            if (!user?.id) {
                console.warn('[MesProduitsScreen] ⚠️ Utilisateur non connecté');
                setProducts([]);
                return;
            }

            // ✅ NETTOYÉ: Plus de fallback JSONB - utiliser uniquement service_products
            const products = await productsService.getProductsByUser(user.id);
            console.log('[MesProduitsScreen] ✅ Produits récupérés depuis service_products:', products.length);

            // ✅ Convertir les produits de l'API service_products en format ManagedProduct
            const allProducts: ManagedProduct[] = products.map((product) => {
                const productData = product.product_data || {};

                // ✅ product_index est garanti par la table service_products (NOT NULL)
                if (typeof product.product_index !== 'number' || product.product_index < 0) {
                    console.error('[MesProduitsScreen] ❌ product_index invalide depuis service_products:', {
                        product_id: product.id,
                        service_id: product.service_id,
                        product_name: product.product_name,
                        product_index: product.product_index
                    });
                    throw new Error(`Produit ${product.id} a un product_index invalide: ${product.product_index}`);
                }

                const productIndex = product.product_index;

                // ✅ CORRIGÉ 2026-02-10: Extraire le prix correctement (sans conversion incorrecte)
                // product_price est déjà en unités (pas en centimes), donc on l'utilise tel quel
                // Le backend sérialise Decimal en string ou number selon la configuration
                let prixValue: number | string | undefined = undefined;

                // Priorité 1: product_price depuis la colonne générée (déjà en unités)
                if (product.product_price !== null && product.product_price !== undefined) {
                    // ✅ CORRIGÉ: Convertir Decimal (sérialisé en string ou number) en number
                    if (typeof product.product_price === 'number') {
                        prixValue = product.product_price;
                    } else if (typeof product.product_price === 'string') {
                        prixValue = parseFloat(product.product_price) || 0;
                    } else {
                        // Si c'est un objet Decimal, le convertir en string puis en number
                        prixValue = parseFloat(String(product.product_price)) || 0;
                    }
                }

                // Priorité 2: prix depuis product_data (déjà en unités)
                if (!prixValue || prixValue === 0) {
                    const prixFromData = productData.prix || productData.prix_produit;
                    if (prixFromData !== null && prixFromData !== undefined) {
                        if (typeof prixFromData === 'object' && 'valeur' in prixFromData) {
                            const valeur = prixFromData.valeur;
                            prixValue = typeof valeur === 'number'
                                ? valeur
                                : parseFloat(String(valeur)) || 0;
                        } else {
                            prixValue = typeof prixFromData === 'number'
                                ? prixFromData
                                : parseFloat(String(prixFromData)) || 0;
                        }
                    }
                }

                // ✅ DEBUG: Logger les prix pour diagnostiquer le problème de multiplication
                if (__DEV__ && prixValue && prixValue > 0) {
                    const priceVariant = productData.price_variant || productData.variabilite_prix || productData.variation_prix;
                    console.log(`[MesProduitsScreen] 💰 Prix produit ${product.id}:`, {
                        product_price: product.product_price,
                        prixValue,
                        hasPriceVariant: !!priceVariant,
                        priceVariantModalites: priceVariant && typeof priceVariant === 'object' && 'modalites' in priceVariant
                            ? (priceVariant.modalites || []).map((m: any) => ({ valeur: m.valeur, prix: m.prix }))
                            : null,
                        productDataPrix: productData.prix,
                        productDataPrixProduit: productData.prix_produit,
                    });
                }

                return {
                    // ✅ CORRIGÉ 2026-02-27: Spread productData EN PREMIER pour que les champs explicites
                    // puissent l'overrider (sinon productData.images écrase nos arrays normalisés)
                    ...productData,
                    id: `${product.service_id}_${productIndex}`,
                    rawProductId: product.id.toString(),
                    serviceId: product.service_id.toString(),
                    productIndex: productIndex,
                    product_index: productIndex,
                    nom: product.product_name || productData.nom || productData.nom_produit || 'Produit sans nom',
                    prix: prixValue || 0,
                    devise: productData.devise || productData.devise_produit || 'XAF',
                    description: productData.description || productData.description_produit || '',
                    categorie: product.product_type || productData.categorie || productData.categorie_produit || '',
                    // ✅ CORRIGÉ 2026-02-27: Gérer le format {valeur: [...]} du formulaire dynamique IA
                    images: Array.isArray(productData.images) ? productData.images
                        : (productData.images && typeof productData.images === 'object' && Array.isArray(productData.images.valeur)) ? productData.images.valeur
                            : (typeof productData.images === 'string' && productData.images.trim()) ? [productData.images]
                                : [],
                    videos: Array.isArray(productData.videos) ? productData.videos
                        : (productData.videos && typeof productData.videos === 'object' && Array.isArray(productData.videos.valeur)) ? productData.videos.valeur
                            : (typeof productData.videos === 'string' && productData.videos.trim()) ? [productData.videos]
                                : [],
                    is_active: product.is_active,
                    createdAt: product.created_at,
                    updatedAt: product.updated_at,
                    serviceTitre: undefined,
                } as ManagedProduct;
            });

            // Trier par date de création (plus récent en premier)
            allProducts.sort((a, b) => {
                const dateA = parseDateToTimestamp(a.createdAt || a.created_at) || 0;
                const dateB = parseDateToTimestamp(b.createdAt || b.created_at) || 0;
                return dateB - dateA;
            });

            setProducts(allProducts);
            console.log('[MesProduitsScreen] ✅ Produits chargés depuis service_products:', allProducts.length);

            // ✅ CORRIGÉ 2026-02-27: Charger les services pour que l'icône galerie médias fonctionne
            // Sans cela, services reste [] et le bouton affiche "Aucun service"
            try {
                const servicesResponse = await apiGet('/api/prestataire/services', {
                    params: { page: 0, limit: 20 }
                });
                const servicesData = servicesResponse.success
                    ? (Array.isArray(servicesResponse.data) ? servicesResponse.data : servicesResponse.data?.services || servicesResponse.data?.data || [])
                    : [];
                if (servicesData.length > 0) {
                    setServices(servicesData);
                }
            } catch (e) {
                console.warn('[MesProduitsScreen] ⚠️ Erreur chargement services (non bloquant):', e);
            }
        } catch (error) {
            // ✅ Erreur lors du chargement - afficher et logger
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('[MesProduitsScreen] ❌ Erreur chargement produits depuis service_products:', {
                message: errorMessage,
                stack: errorStack,
                error
            });
            setProducts([]);
            Alert.alert(
                'Erreur de chargement',
                'Impossible de charger les produits. Veuillez réessayer.\n\n' + errorMessage
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useFocusEffect(
        useCallback(() => {
            // ✅ CORRECTION: Recharger les produits à chaque fois que l'écran est focus
            loadProducts();
        }, [loadProducts])
    );

    // ✅ NOUVEAU: Écouter aussi les événements de création de produit
    React.useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que DeviceEventEmitter existe
        if (!DeviceEventEmitter || typeof DeviceEventEmitter.addListener !== 'function') {
            console.warn('[MesProduitsScreen] DeviceEventEmitter.addListener non disponible');
            return;
        }

        const subscription = DeviceEventEmitter.addListener('product:created', () => {
            console.log('[MesProduitsScreen] 📦 Événement product:created reçu, rechargement des produits');
            if (typeof loadProducts === 'function') {
                loadProducts(true);
            }
        });

        return () => {
            // ✅ SÉCURITÉ: Vérifier que subscription existe avant de la nettoyer
            if (subscription && typeof subscription.remove === 'function') {
                subscription.remove();
            }
        };
    }, [loadProducts]);

    const onRefresh = () => {
        loadProducts(true);
    };

    React.useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que DeviceEventEmitter existe
        if (!DeviceEventEmitter || typeof DeviceEventEmitter.addListener !== 'function') {
            console.warn('[MesProduitsScreen] DeviceEventEmitter.addListener non disponible');
            return;
        }

        const subscription = DeviceEventEmitter.addListener('service:refresh', () => {
            if (typeof loadProducts === 'function') {
                loadProducts(true);
            }
        });

        return () => {
            // ✅ SÉCURITÉ: Vérifier que subscription existe avant de la nettoyer
            if (subscription && typeof subscription.remove === 'function') {
                subscription.remove();
            }
        };
    }, [loadProducts]);

    const openVideoCreatorForProduct = (product: ManagedProduct) => {
        const serviceId = product.serviceId;
        // ✅ AMÉLIORÉ: Validation plus robuste de productIndex
        const productIndex = typeof product.productIndex === 'number' && product.productIndex >= 0
            ? product.productIndex
            : (product.product_index !== undefined ? Number(product.product_index) : undefined);
        // ✅ CORRECTION: Chercher aussi nom_produit pour les produits créés via AjouterProduitSimpleScreen
        const productName = product.nom || (product as any).nom_produit || product.name || product.title;

        // ✅ Validation améliorée
        if (!serviceId || serviceId === 0) {
            Alert.alert(
                'Service requis',
                'Ce produit n\'est associé à aucun service. Veuillez vérifier la configuration du produit.',
                [{ text: 'OK' }]
            );
            return;
        }

        if (productIndex === undefined || productIndex === null || productIndex < 0) {
            Alert.alert(
                'Index produit invalide',
                'Impossible de déterminer l\'index du produit. Veuillez réessayer ou contacter le support.',
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ AMÉLIORÉ: Utiliser VideoCreationWizard avec validation
        const success = navigateToVideoWizard(navigation, {
            serviceId: Number(serviceId),
            productIndex: Number(productIndex),
            productName: productName
        });

        // Si la navigation échoue, fallback vers le modal
        if (!success) {
            setVideoCreatorProduct(product);
            setVideoCreatorVisible(true);
        }
    };

    const openVideoCreatorGlobal = () => {
        setVideoCreatorProduct(null);
        setVideoCreatorVisible(true);
    };

    const closeVideoCreator = () => {
        setVideoCreatorVisible(false);
        setVideoCreatorProduct(null);
    };

    const handleVideoCreatorSuccess = useCallback(async (result: GeneratedVideoResponse) => {
        console.log('[MesProduitsScreen] 🎬 Vidéo générée:', result);

        try {
            // ✅ CORRECTION 2025-12-01: Vérifier que media_id existe avant d'appeler trackMediaView
            if (result.media_id) {
                await mediaApi.trackMediaView(result.media_id, { channel: 'studio_preview' });
            } else {
                console.warn('[MesProduitsScreen] media_id manquant dans result, skip tracking', result);
            }
            if (Array.isArray(result.distribution_targets) && result.distribution_targets.length > 0) {
                await Promise.all(
                    result.distribution_targets.map((target) =>
                        mediaApi.updateMediaDistribution(result.media_id, target, {
                            status: 'planned',
                            metadata: { triggered_at: Date.now() },
                        })
                    )
                );
            }
            await loadProducts(true);
        } catch (error) {
            // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('[MesProduitsScreen] Erreur rafraîchissement après vidéo:', {
                message: errorMessage,
                stack: errorStack,
                error: error
            });
        } finally {
            DeviceEventEmitter.emit('service:refresh');
            setVideoCreatorVisible(false);
            setVideoCreatorProduct(null);
        }

        const message = result?.headline
            ? `${result.headline}\n\nVotre vidéo est maintenant disponible. Vous pouvez la voir dans la galerie du produit.`
            : 'Votre vidéo est maintenant disponible. Vous pouvez la voir dans la galerie du produit.';

        // Navigation vers le service pour voir la vidéo
        const serviceId = result?.service_id;
        const productIndex = result?.product_index;

        Alert.alert(
            '🎬 Vidéo créée avec succès',
            message,
            [
                { text: 'OK', style: 'default' },
                ...(serviceId ? [{
                    text: '👁️ Voir la vidéo',
                    onPress: () => {
                        try {
                            (navigation as any).navigate('ServiceDetail', {
                                serviceId: String(serviceId),
                                highlightProductIndex: productIndex !== undefined ? Number(productIndex) : undefined,
                                openGallery: true // Flag pour ouvrir automatiquement la galerie
                            });
                        } catch (error) {
                            console.error('[MesProduitsScreen] Erreur navigation vers ServiceDetail:', error);
                            Alert.alert('Information', 'La vidéo est disponible dans la galerie de votre produit.');
                        }
                    }
                }] : [])
            ]
        );
    }, [loadProducts]);

    // Activer/Désactiver un produit spécifique
    const handleToggleProduct = async (product: ManagedProduct) => {
        try {
            const newStatus = !product.is_active;
            const productIdForToggle = resolveNumericId(product.rawProductId ?? product.id);

            if (productIdForToggle === null) {
                Alert.alert(
                    'Identifiant introuvable',
                    'Impossible de déterminer l\'identifiant de ce produit. Veuillez réessayer après actualisation.'
                );
                return;
            }

            // Si RÉACTIVATION (inactif → actif)
            if (newStatus) {
                // 🚌 SPÉCIAL: Bloquer réactivation tickets de voyage expirés
                if (product.type === 'ticket_voyage' && product.dateDepart) {
                    try {
                        const [day, month, year] = product.dateDepart.split('/');
                        const departureDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        const now = new Date();

                        if (departureDate < now) {
                            Alert.alert(
                                '⚠️ Réactivation impossible',
                                `Ce ticket de voyage est expiré.\n\nDépart prévu: ${product.dateDepart}\nDate actuelle: ${now.toLocaleDateString('fr-FR')}\n\n🚫 Les tickets expirés ne peuvent pas être réactivés.\n\n✅ Créez un nouveau ticket avec une date future.`,
                                [{ text: 'Compris' }]
                            );
                            return;
                        }
                    } catch (dateError) {
                        console.warn('Erreur parsing date:', dateError);
                        // Continuer si erreur de parsing
                    }
                }

                // Vérifier le solde et facturer 1000 FCFA
                const activationCost = 1000;
                const balanceResponse = await apiGet('/api/users/balance');

                if (!balanceResponse.success || !balanceResponse.data) {
                    Alert.alert('Erreur', 'Impossible de vérifier votre solde');
                    return;
                }

                const currentBalance = balanceResponse.data.tokens_balance || 0;

                if (currentBalance < activationCost) {
                    Alert.alert(
                        '💰 Solde insuffisant',
                        `Coût de réactivation: ${activationCost.toLocaleString()} FCFA\nVotre solde: ${currentBalance.toLocaleString()} FCFA\n\nVeuillez recharger votre compte.`,
                        [
                            { text: 'Annuler', style: 'cancel' },
                            { text: 'Recharger', onPress: () => (navigation as any).navigate('RechargeTokens') },
                        ]
                    );
                    return;
                }

                Alert.alert(
                    '✅ Réactiver le produit',
                    `"${product.nom}"\n\n💰 Coût: ${activationCost.toLocaleString()} FCFA\nSolde après: ${(currentBalance - activationCost).toLocaleString()} FCFA`,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Confirmer',
                            onPress: async () => {
                                try {
                                    // Déduire le coût
                                    const deductResponse = await apiPost('/api/users/deduct-balance', {
                                        amount: activationCost,
                                        reason: 'product_reactivation'
                                    });

                                    if (!deductResponse.success) {
                                        Alert.alert('Erreur', 'Impossible de déduire le montant');
                                        return;
                                    }

                                    // Toggle le produit
                                    const response = await apiPatch(`/api/products/${productIdForToggle}/toggle-status`, {
                                        is_active: newStatus
                                    });

                                    if (response.success) {
                                        setProducts(prevProducts =>
                                            prevProducts.map((p) => {
                                                const candidateId = resolveNumericId(p.rawProductId ?? p.id);
                                                return candidateId === productIdForToggle
                                                    ? { ...p, is_active: newStatus }
                                                    : p;
                                            })
                                        );

                                        Alert.alert(
                                            '✅ Produit réactivé',
                                            `${activationCost.toLocaleString()} FCFA débités\nNouveau solde: ${(currentBalance - activationCost).toLocaleString()} FCFA`
                                        );
                                    } else {
                                        Alert.alert('Erreur', response.error || 'Impossible de réactiver');
                                    }
                                } catch (error: any) {
                                    // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
                                    const errorMessage = error instanceof Error ? error.message : (error?.message || 'Impossible de réactiver');
                                    const errorStack = error instanceof Error ? error.stack : undefined;
                                    console.error('[MesProduitsScreen] Erreur réactivation:', {
                                        message: errorMessage,
                                        stack: errorStack,
                                        productId: productIdForToggle,
                                        error: error
                                    });
                                    const finalErrorMessage = errorMessage;
                                    const is404 = errorMessage.includes('404') || errorMessage.includes('not found');
                                    Alert.alert(
                                        '❌ Erreur',
                                        is404
                                            ? 'Produit introuvable. Il a peut-être déjà été supprimé.'
                                            : errorMessage
                                    );
                                    // ✅ CORRECTION: Recharger les produits en cas d'erreur pour restaurer l'état
                                    await loadProducts(true);
                                }
                            }
                        }
                    ]
                );
            } else {
                // DÉSACTIVATION (actif → inactif) = GRATUIT
                Alert.alert(
                    '⏸️ Désactiver le produit',
                    `"${product.nom}"\n\n✅ Désactivation gratuite\n\nLe produit ne sera plus visible dans les recherches.`,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Désactiver',
                            onPress: async () => {
                                try {
                                    const response = await apiPatch(`/api/products/${productIdForToggle}/toggle-status`, {
                                        is_active: newStatus
                                    });

                                    if (response.success) {
                                        setProducts(prevProducts =>
                                            prevProducts.map((p) => {
                                                const candidateId = resolveNumericId(p.rawProductId ?? p.id);
                                                return candidateId === productIdForToggle
                                                    ? { ...p, is_active: newStatus }
                                                    : p;
                                            })
                                        );

                                        Alert.alert('✅ Succès', 'Produit désactivé avec succès');
                                    } else {
                                        Alert.alert('Erreur', response.error || 'Impossible de désactiver');
                                    }
                                } catch (error: any) {
                                    // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
                                    const errorMessage = error instanceof Error ? error.message : (error?.message || 'Impossible de désactiver');
                                    const errorStack = error instanceof Error ? error.stack : undefined;
                                    console.error('[MesProduitsScreen] Erreur désactivation:', {
                                        message: errorMessage,
                                        stack: errorStack,
                                        productId: productIdForToggle,
                                        error: error
                                    });
                                    const finalErrorMessage = errorMessage;
                                    const is404 = errorMessage.includes('404') || errorMessage.includes('not found');
                                    Alert.alert(
                                        '❌ Erreur',
                                        is404
                                            ? 'Produit introuvable. Il a peut-être déjà été supprimé.'
                                            : errorMessage
                                    );
                                    // ✅ CORRECTION: Recharger les produits en cas d'erreur pour restaurer l'état
                                    await loadProducts(true);
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('[MesProduitsScreen] Erreur toggle product:', {
                message: errorMessage,
                stack: errorStack,
                error: error
            });
        }
    };

    // Supprimer un produit
    const handleDeleteProduct = async (product: ManagedProduct) => {
        // ✅ CORRECTION: Afficher la confirmation AVANT toute action
        Alert.alert(
            '🗑️ Supprimer le produit',
            `Êtes-vous sûr de vouloir supprimer "${product.nom || 'ce produit'}" ?\n\n⚠️ Cette action est irréversible et supprimera définitivement le produit.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // ✅ PHASE 4: Utiliser l'endpoint API service_products avec serviceId et productIndex
                            // ✅ CORRIGÉ: Vérifier les deux propriétés possibles (product_index et productIndex)
                            const productIndexValue = product.product_index ?? product.productIndex;
                            const serviceIdValue = product.serviceId;

                            // ✅ CORRIGÉ: Validation robuste des identifiants
                            if (!serviceIdValue) {
                                console.error('[MesProduitsScreen] ❌ serviceId manquant pour suppression:', {
                                    serviceId: serviceIdValue,
                                    product_index: product.product_index,
                                    productIndex: product.productIndex,
                                    product: product
                                });
                                Alert.alert(
                                    '❌ Identifiant introuvable',
                                    'Impossible de supprimer ce produit car l\'identifiant du service est manquant.'
                                );
                                return;
                            }

                            if (typeof productIndexValue !== 'number' || isNaN(productIndexValue) || productIndexValue < 0) {
                                console.error('[MesProduitsScreen] ❌ productIndex invalide pour suppression:', {
                                    serviceId: serviceIdValue,
                                    product_index: product.product_index,
                                    productIndex: product.productIndex,
                                    productIndexValue: productIndexValue,
                                    product: product
                                });
                                Alert.alert(
                                    '❌ Identifiant introuvable',
                                    'Impossible de supprimer ce produit car l\'index du produit est invalide.'
                                );
                                return;
                            }

                            const serviceId = Number(serviceIdValue);
                            if (isNaN(serviceId) || serviceId <= 0) {
                                console.error('[MesProduitsScreen] ❌ serviceId invalide (ne peut pas être converti en nombre):', {
                                    serviceIdValue: serviceIdValue,
                                    serviceId: serviceId,
                                    product: product
                                });
                                Alert.alert(
                                    '❌ Identifiant introuvable',
                                    'Impossible de supprimer ce produit car l\'identifiant du service est invalide.'
                                );
                                return;
                            }

                            const productIndex = productIndexValue;

                            console.log('[MesProduitsScreen] 🗑️ Suppression produit:', {
                                serviceId,
                                productIndex,
                                productName: product.nom
                            });

                            // ✅ CORRECTION: Supprimer d'abord de l'état local pour feedback immédiat
                            setProducts(prevProducts => prevProducts.filter((p) => {
                                return !(p.serviceId === product.serviceId && p.product_index === productIndex);
                            }));

                            // ✅ PHASE 4: Appeler l'API service_products au lieu de /api/products/{id}
                            const response = await apiDelete(`/api/services/${serviceId}/products/${productIndex}`);

                            if (response.success) {
                                // ✅ CORRECTION: Recharger les produits depuis le serveur pour synchronisation
                                await loadProducts(true);
                                // ✅ CORRECTION: Afficher le message de succès après rechargement
                                Alert.alert('✅ Succès', 'Produit supprimé avec succès');
                            } else {
                                // ✅ CORRECTION: En cas d'erreur, recharger pour restaurer l'état
                                await loadProducts(true);
                                Alert.alert(
                                    '❌ Erreur',
                                    response.error || 'Impossible de supprimer le produit. Le produit a été restauré.'
                                );
                            }
                        } catch (error: any) {
                            // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
                            const errorMessage = error instanceof Error ? error.message : (error?.message || 'Impossible de supprimer le produit');
                            const errorStack = error instanceof Error ? error.stack : undefined;
                            const productIndexValue = product.product_index ?? product.productIndex;
                            console.error('[MesProduitsScreen] Erreur suppression:', {
                                message: errorMessage,
                                stack: errorStack,
                                serviceId: product.serviceId,
                                productIndex: productIndexValue,
                                productName: product.nom,
                                error: error
                            });
                            // ✅ CORRECTION: Recharger en cas d'erreur pour restaurer l'état
                            await loadProducts(true);
                            const finalErrorMessage = errorMessage;
                            const is404 = finalErrorMessage.includes('404') || finalErrorMessage.includes('not found');
                            Alert.alert(
                                '❌ Erreur',
                                is404
                                    ? 'Produit introuvable. Il a peut-être déjà été supprimé.'
                                    : finalErrorMessage
                            );
                        }
                    }
                }
            ]
        );
    };

    // Modifier un produit (naviguer vers le service parent en mode édition)
    const handleEditProduct = async (product: ManagedProduct) => {
        const productIdForUpdate = resolveNumericId(product.rawProductId ?? product.id);

        if (productIdForUpdate === null) {
            Alert.alert('Identifiant introuvable', 'Impossible de modifier ce produit car son identifiant est manquant.');
            return;
        }

        try {
            // ✅ CORRECTION CRITIQUE: Charger les médias depuis l'API avant de construire le prefill
            let loadedImages: string[] = [];
            let loadedVideos: string[] = [];
            let loadedAudios: string[] = [];
            let loadedDocuments: string[] = [];

            if (typeof product.product_index === 'number' && product.serviceId) {
                console.log('[MesProduitsScreen] 📥 Chargement des médias pour édition produit:', {
                    serviceId: product.serviceId,
                    productIndex: product.product_index
                });

                try {
                    const mediaResponse = await mediaApi.getProductMedia(product.serviceId, product.product_index);
                    if (mediaResponse.success && mediaResponse.data) {
                        const entries = mediaResponse.data.data || mediaResponse.data;
                        if (Array.isArray(entries)) {
                            entries.forEach((entry: any) => {
                                const mediaType = entry.media_type || entry.type || 'image';
                                const path = entry.path || entry.url || entry.file_path;

                                // ✅ Construire l'URL complète depuis le path
                                const fullUrl = buildMediaUrl(path);

                                if (fullUrl) {
                                    if (mediaType === 'image') {
                                        loadedImages.push(fullUrl);
                                    } else if (mediaType === 'video') {
                                        loadedVideos.push(fullUrl);
                                    } else if (mediaType === 'audio') {
                                        loadedAudios.push(fullUrl);
                                    } else if (mediaType === 'document') {
                                        loadedDocuments.push(fullUrl);
                                    }
                                }
                            });

                            console.log('[MesProduitsScreen] ✅ Médias chargés depuis API:', {
                                images: loadedImages.length,
                                videos: loadedVideos.length,
                                audios: loadedAudios.length,
                                documents: loadedDocuments.length
                            });
                        }
                    }
                } catch (mediaError) {
                    console.warn('[MesProduitsScreen] ⚠️ Erreur chargement médias depuis API, utilisation médias du produit:', mediaError);
                    // Continuer avec les médias du produit si l'API échoue
                }
            }

            const prefill = buildProductPrefill(product);

            // ✅ CORRECTION: Utiliser les médias chargés depuis l'API en priorité, sinon ceux du prefill
            const finalImages = loadedImages.length > 0 ? loadedImages : (Array.isArray(prefill.images) ? prefill.images : []);
            const finalVideos = loadedVideos.length > 0 ? loadedVideos : (Array.isArray(prefill.videos) ? prefill.videos : []);
            const finalAudios = loadedAudios.length > 0 ? loadedAudios : (Array.isArray(prefill.audios) ? prefill.audios : []);
            const finalDocuments = loadedDocuments.length > 0 ? loadedDocuments : (Array.isArray(prefill.documents) ? prefill.documents : []);

            // Mettre à jour le prefill avec les médias chargés
            prefill.images = finalImages;
            prefill.videos = finalVideos;
            prefill.audios = finalAudios;
            prefill.documents = finalDocuments;

            const mediaData = {
                base64_image: finalImages,
                video_base64: finalVideos,
                audio_base64: finalAudios,
                doc_base64: finalDocuments,
            };

            console.log('[MesProduitsScreen] 📦 Prefill final pour édition:', {
                nom_produit: prefill.nom_produit,
                images_count: finalImages.length,
                videos_count: finalVideos.length,
                audios_count: finalAudios.length,
                documents_count: finalDocuments.length
            });

            navigation.navigate('AjouterProduitSimple' as never, {
                mode: 'edit',
                serviceId: product.serviceId,
                productId: productIdForUpdate,
                productIndex: product.product_index ?? 0,
                prefill,
                mediaData,
            } as never);
        } catch (error) {
            console.error('[MesProduitsScreen] ❌ Erreur lors de l\'édition du produit:', error);
            Alert.alert('Erreur', 'Impossible de charger les données du produit pour l\'édition');
        }
    };

    const recordProductShare = async (product: ManagedProduct, channel: string) => {
        try {
            if (typeof product.product_index !== 'number') return;
            const mediaResponse = await mediaApi.getProductMedia(product.serviceId, product.product_index);
            if (!mediaResponse.success) return;
            const entries = mediaResponse.data?.data;
            if (!Array.isArray(entries) || entries.length === 0) return;
            const firstVideo = entries.find(
                (item: any) => (item.media_type || item.type) === 'video'
            ) || entries[0];
            if (firstVideo?.id) {
                await mediaApi.trackMediaShare(firstVideo.id, {
                    channel,
                    metadata: { product_id: product.id, service_id: product.serviceId },
                });
            }
        } catch (error) {
            console.warn('[MesProduitsScreen] Échec enregistrement partage média:', error);
        }
    };

    // Partager un produit
    const handleShareProduct = async (product: ManagedProduct) => {
        try {
            // ✅ NOUVEAU 2026-01-XX: Utiliser la fonction utilitaire pour générer le message de partage uniforme
            // Extraire la localisation si disponible (depuis les données brutes du produit)
            const location = product.location || product.lieu || product.adresse || product.address || undefined;

            // Préparer le prix (peut être string ou number)
            const price = product.prix
                ? (typeof product.prix === 'string' ? parseFloat(product.prix) || undefined : product.prix)
                : undefined;

            // Générer le message de partage avec le format uniforme (description avant prix, lieu, lien intelligent unique)
            const shareMessage = generateProductShareMessage({
                productName: product.nom,
                productDescription: product.description,
                price,
                devise: product.devise || 'XAF',
                location,
                productId: product.id,
                serviceId: product.serviceId,
            });

            // ✅ CORRIGÉ: Utiliser le lien intelligent (HTTPS) dans l'URL du Share
            // Le lien HTTPS sera intercepté par l'app si installée (via intentFilters)
            // Sinon, il ouvrira la page web. C'est un seul lien intelligent qui fonctionne partout.
            const smartLink = generateSmartShareLink(product.id, product.serviceId);

            const result = await Share.share({
                message: shareMessage,
                title: `Découvrez: ${product.nom}`,
                url: smartLink, // ✅ Utiliser le lien intelligent HTTPS qui sera intercepté par l'app si disponible
            });

            if (result.action === Share.sharedAction) {
                console.log('✅ Produit partagé:', product.nom, 'via', result.activityType || 'partage natif');
                await recordProductShare(product, result.activityType || 'native_share');
            } else if (result.action === Share.dismissedAction) {
                console.log('⚠️ Partage annulé');
            }
        } catch (error) {
            console.error('Erreur partage produit:', error);
            Alert.alert('Erreur', 'Impossible de partager ce produit');
        }
    };

    // Dupliquer un produit
    const handleDuplicateProduct = async (product: ManagedProduct) => {
        try {
            // ✅ CORRECTION CRITIQUE: Charger les médias depuis l'API avant de construire le prefill
            let loadedImages: string[] = [];
            let loadedVideos: string[] = [];
            let loadedAudios: string[] = [];
            let loadedDocuments: string[] = [];

            if (typeof product.product_index === 'number' && product.serviceId) {
                console.log('[MesProduitsScreen] 📥 Chargement des médias pour duplication produit:', {
                    serviceId: product.serviceId,
                    productIndex: product.product_index
                });

                try {
                    const mediaResponse = await mediaApi.getProductMedia(product.serviceId, product.product_index);
                    if (mediaResponse.success && mediaResponse.data) {
                        const entries = mediaResponse.data.data || mediaResponse.data;
                        if (Array.isArray(entries)) {
                            entries.forEach((entry: any) => {
                                const mediaType = entry.media_type || entry.type || 'image';
                                const path = entry.path || entry.url || entry.file_path;

                                // ✅ Construire l'URL complète depuis le path
                                const fullUrl = buildMediaUrl(path);

                                if (fullUrl) {
                                    if (mediaType === 'image') {
                                        loadedImages.push(fullUrl);
                                    } else if (mediaType === 'video') {
                                        loadedVideos.push(fullUrl);
                                    } else if (mediaType === 'audio') {
                                        loadedAudios.push(fullUrl);
                                    } else if (mediaType === 'document') {
                                        loadedDocuments.push(fullUrl);
                                    }
                                }
                            });

                            console.log('[MesProduitsScreen] ✅ Médias chargés depuis API:', {
                                images: loadedImages.length,
                                videos: loadedVideos.length,
                                audios: loadedAudios.length,
                                documents: loadedDocuments.length
                            });
                        }
                    }
                } catch (mediaError) {
                    console.warn('[MesProduitsScreen] ⚠️ Erreur chargement médias depuis API, utilisation médias du produit:', mediaError);
                    // Continuer avec les médias du produit si l'API échoue
                }
            }

            const prefill = buildProductPrefill(product);
            const originalName = prefill.nom_produit || product.nom || 'Produit';
            prefill.nom_produit = `${originalName} (Copie)`;

            // ✅ CORRECTION: Utiliser les médias chargés depuis l'API en priorité, sinon ceux du prefill
            const finalImages = loadedImages.length > 0 ? loadedImages : (Array.isArray(prefill.images) ? prefill.images : []);
            const finalVideos = loadedVideos.length > 0 ? loadedVideos : (Array.isArray(prefill.videos) ? prefill.videos : []);
            const finalAudios = loadedAudios.length > 0 ? loadedAudios : (Array.isArray(prefill.audios) ? prefill.audios : []);
            const finalDocuments = loadedDocuments.length > 0 ? loadedDocuments : (Array.isArray(prefill.documents) ? prefill.documents : []);

            // Mettre à jour le prefill avec les médias chargés
            prefill.images = finalImages;
            prefill.videos = finalVideos;
            prefill.audios = finalAudios;
            prefill.documents = finalDocuments;

            const mediaData = {
                base64_image: finalImages,
                video_base64: finalVideos,
                audio_base64: finalAudios,
                doc_base64: finalDocuments,
            };

            console.log('[MesProduitsScreen] 📦 Prefill final pour duplication:', {
                nom_produit: prefill.nom_produit,
                images_count: finalImages.length,
                videos_count: finalVideos.length,
                audios_count: finalAudios.length,
                documents_count: finalDocuments.length
            });

            navigation.navigate('AjouterProduitSimple' as never, {
                mode: 'duplicate',
                serviceId: product.serviceId,
                prefill,
                mediaData,
            } as never);
        } catch (error) {
            console.error('[MesProduitsScreen] ❌ Erreur lors de la duplication du produit:', error);
            Alert.alert('Erreur', 'Impossible de charger les données du produit pour la duplication');
        }
    };

    // Promouvoir un produit
    const handlePromoteProduct = (product: ManagedProduct) => {
        Alert.alert(
            '🎉 Promouvoir le produit',
            `Booster "${product.nom}" pour augmenter sa visibilité ?\n\n✨ Votre produit apparaîtra en tête des résultats de recherche.\n\n💰 Coût: À définir`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Créer une publicité',
                    onPress: () => {
                        navigation.navigate('CreatePublicite' as never, {
                            productId: product.id,
                            productName: product.nom,
                            serviceId: product.serviceId
                        });
                    }
                }
            ]
        );
    };

    // ✅ NOUVEAU: Créer un nouveau produit (choisir un service puis ouvrir le formulaire)
    const handleCreateNewProduct = async () => {
        try {
            // ✅ NOUVEAU: Charger les services avec pagination
            const servicesResponse = await apiGet('/api/prestataire/services', {
                params: {
                    page: 0,
                    limit: 20
                }
            });

            // ✅ CORRIGÉ: Gérer le nouveau format avec pagination et différentes structures de réponse
            let servicesData: any[] = [];

            if (servicesResponse.success && servicesResponse.data) {
                // Essayer différentes structures possibles
                if (Array.isArray(servicesResponse.data)) {
                    servicesData = servicesResponse.data;
                } else if (Array.isArray(servicesResponse.data.data)) {
                    servicesData = servicesResponse.data.data;
                } else if (Array.isArray(servicesResponse.data.services)) {
                    servicesData = servicesResponse.data.services;
                } else if (Array.isArray(servicesResponse.data.items)) {
                    servicesData = servicesResponse.data.items;
                } else if (servicesResponse.data && typeof servicesResponse.data === 'object') {
                    // Si c'est un objet unique, le mettre dans un tableau
                    servicesData = [servicesResponse.data];
                }
            }

            console.log('[MesProduitsScreen] handleCreateNewProduct - Services trouvés:', {
                success: servicesResponse.success,
                servicesCount: servicesData.length,
                dataStructure: servicesResponse.data ? Object.keys(servicesResponse.data) : 'no data'
            });

            if (!servicesResponse.success || !servicesData || servicesData.length === 0) {
                Alert.alert(
                    'Aucun service',
                    'Vous devez d\'abord créer un service avant de pouvoir ajouter des produits.\n\nVoulez-vous créer un service maintenant ?',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Créer un service',
                            onPress: async () => {
                                try {
                                    // ✅ CORRECTION: Générer les suggestions IA avant de naviguer (comme dans HomeScreen)
                                    const input = {
                                        texte: 'Création d\'un nouveau service',
                                    };

                                    const result = await genererSuggestionsService(input);
                                    console.log('[MesProduitsScreen] Résultat génération suggestions:', JSON.stringify(result, null, 2));

                                    if (result && result.data) {
                                        // Extraire les données comme dans HomeScreen
                                        const suggestionData = result.data.service_data?.data || result.data.data || result.data;

                                        (navigation as any).navigate('FormulaireYukpoIntelligent', {
                                            suggestion: {
                                                data: suggestionData,
                                                intention: result.data.intention || 'creation_service',
                                                confidence: result.data.confidence || 1.0,
                                                tokens_consumed: result.data.tokens_consumed || 0,
                                                session_id: result.data.session_id,
                                            },
                                            type: 'creation_service',
                                            mode: 'create',
                                            fromMesProduits: true,
                                        });
                                    } else {
                                        // Fallback : naviguer sans suggestion si la génération échoue
                                        console.warn('[MesProduitsScreen] Échec génération suggestions, navigation sans données IA');
                                        (navigation as any).navigate('FormulaireYukpoIntelligent', {
                                            fromMesProduits: true,
                                        });
                                    }
                                } catch (error) {
                                    console.error('[MesProduitsScreen] Erreur génération suggestions:', error);
                                    // Fallback : naviguer sans suggestion en cas d'erreur
                                    (navigation as any).navigate('FormulaireYukpoIntelligent', {
                                        fromMesProduits: true,
                                    });
                                }
                            }
                        }
                    ]
                );
                return;
            }

            // ✅ CORRECTION: servicesData est déjà déclaré ci-dessus, pas besoin de le redéclarer
            setServices(servicesData);

            // ✅ CORRECTION: Extraire correctement l'ID du service (gérer différents formats)
            const getServiceId = (service: any): number | null => {
                if (!service) return null;
                const id = service.id || service.service_id || service.serviceId;
                if (id === undefined || id === null) return null;
                return typeof id === 'string' ? parseInt(id, 10) : id;
            };

            // Si un seul service, l'ouvrir directement
            if (servicesData.length === 1) {
                const service = servicesData[0];
                const serviceId = getServiceId(service);
                if (serviceId) {
                    console.log('[MesProduitsScreen] handleCreateNewProduct - Navigation vers AjouterProduitSimple avec serviceId:', serviceId);
                    navigation.navigate('AjouterProduitSimple' as never, {
                        mode: 'create',
                        serviceId: serviceId,
                    } as never);
                } else {
                    console.error('[MesProduitsScreen] handleCreateNewProduct - Service ID introuvable:', service);
                    Alert.alert('Erreur', 'Impossible de déterminer l\'ID du service');
                }
            } else {
                // Plusieurs services : proposer de choisir
                const serviceOptions = servicesData
                    .filter((service: any) => getServiceId(service) !== null) // Filtrer les services sans ID
                    .map((service: any) => {
                        const serviceId = getServiceId(service);
                        return {
                            text: service.data?.titre_service?.valeur || service.titre || `Service ${serviceId}`,
                            onPress: () => {
                                if (serviceId) {
                                    console.log('[MesProduitsScreen] handleCreateNewProduct - Navigation vers AjouterProduitSimple avec serviceId:', serviceId);
                                    navigation.navigate('AjouterProduitSimple' as never, {
                                        mode: 'create',
                                        serviceId: serviceId,
                                    } as never);
                                }
                            }
                        };
                    });

                Alert.alert(
                    '📦 Choisir un service',
                    'Dans quel service voulez-vous ajouter un nouveau produit ?',
                    [
                        ...serviceOptions.slice(0, 5), // Limiter à 5 services pour éviter un menu trop long
                        { text: 'Annuler', style: 'cancel' }
                    ]
                );
            }
        } catch (error) {
            // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('[MesProduitsScreen] Erreur création produit:', {
                message: errorMessage,
                stack: errorStack,
                error: error
            });
            Alert.alert('Erreur', 'Impossible de charger vos services');
        }
    };

    const openTeamManager = (serviceId?: string) => {
        setTeamManagerServiceId(serviceId ? String(serviceId) : undefined);
        setShowTeamManager(true);
    };

    const handleManageMembers = () => {
        if (!services || services.length === 0) {
            Alert.alert(
                'Aucun service',
                'Vous n\'avez pas encore de service pour gérer des membres. Créez un service pour définir les droits d\'accès.'
            );
            return;
        }

        if (services.length === 1) {
            openTeamManager(String(services[0].id));
            return;
        }

        openTeamManager(undefined);
    };

    const handleManageMembersForService = (serviceId: string | number | undefined) => {
        // ✅ CORRECTION: Vérifier que serviceId est valide
        if (!serviceId) {
            Alert.alert(
                'Erreur',
                'Impossible de gérer les membres : service ID manquant.'
            );
            return;
        }
        openTeamManager(String(serviceId));
    };

    // ✅ NOUVEAU 2025-11-06: Éditer les informations générales du service
    const handleEditServiceInfo = async () => {
        try {
            // ✅ NOUVEAU: Charger les services avec pagination
            const servicesResponse = await apiGet('/api/prestataire/services', {
                params: {
                    page: 0,
                    limit: 20
                }
            });

            // ✅ CORRIGÉ: Gérer le nouveau format avec pagination
            const servicesData = Array.isArray(servicesResponse.data)
                ? servicesResponse.data
                : (servicesResponse.data?.data || servicesResponse.data || []);

            if (!servicesResponse.success || !servicesData || servicesData.length === 0) {
                Alert.alert(
                    'Aucun service',
                    'Vous n\'avez pas encore de service à éditer.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const service = servicesData[0]; // Premier service
            const serviceData = service.data || {};

            console.log('[MesProduitsScreen] 📝 Édition service', service.id);

            // Naviguer vers le formulaire en mode edit_service_info
            (navigation as any).navigate('FormulaireYukpoIntelligent', {
                mode: 'edit_service_info', // ✅ NOUVEAU mode
                serviceId: service.id,
                serviceData: serviceData,
                suggestion: {
                    data: serviceData,
                    intention: 'modification_service_info',
                    confidence: 1.0
                },
                type: 'modification_service_info',
                fromMesProduits: true
            });
        } catch (error) {
            // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('[MesProduitsScreen] Erreur édition service:', {
                message: errorMessage,
                stack: errorStack,
                error: error
            });
            Alert.alert('Erreur', 'Impossible de charger les données du service');
        }
    };

    // Voir les statistiques d'un produit
    const handleViewStats = (product: ManagedProduct) => {
        const stats = `📊 Statistiques de "${product.nom}"\n\n` +
            `👁️ Vues: ${product.views || 0}\n` +
            `💬 Interactions: ${product.interactions || 0}\n` +
            `📅 Créé le: ${product.createdAt ? new Date(product.createdAt).toLocaleDateString('fr-FR') : 'N/A'}\n` +
            `✅ Statut: ${product.is_active ? 'Actif' : 'Inactif'}\n` +
            `🏷️ Catégorie: ${getProductTypeLabel(product.category_key || product.type)}`;

        Alert.alert('📊 Statistiques', stats, [{ text: 'OK' }]);
    };

    const handleViewGlobalStats = () => {
        const totalViews = products.reduce((sum, item) => sum + (Number(item.views) || 0), 0);
        const totalShares = products.reduce((sum, item) => sum + (Number(item.shares) || 0), 0);
        const totalSaves = products.reduce((sum, item) => sum + (Number(item.saves) || 0), 0);

        Alert.alert(
            '📊 Vue d’ensemble',
            `👁️ Vues cumulées : ${totalViews.toLocaleString('fr-FR')}\n` +
            `🔁 Partages : ${totalShares.toLocaleString('fr-FR')}\n` +
            `⭐ Favoris : ${totalSaves.toLocaleString('fr-FR')}`,
            [{ text: 'OK' }]
        );
    };

    // Filtrer les produits
    // ✅ CORRECTION: S'assurer que products est toujours un tableau
    const filteredProducts = (products || []).filter(product => {
        // Filtre par statut
        if (filter === 'actif' && !product.is_active) return false;
        if (filter === 'inactif' && product.is_active) return false;

        return true;
    });

    // ✅ CORRECTION: S'assurer que products est toujours un tableau
    const productsArray = products || [];
    const totalProducts = productsArray.length;
    const activeProducts = productsArray.filter((p) => p.is_active).length;
    const inactiveProducts = Math.max(totalProducts - activeProducts, 0);

    const headerSummary = useMemo(() => (
        [
            { label: 'Produits', value: totalProducts, accentColor: '#4F46E5' },
            { label: 'Actifs', value: activeProducts, accentColor: '#10B981' },
            { label: 'En pause', value: inactiveProducts, accentColor: '#F97316' },
        ]
    ), [totalProducts, activeProducts, inactiveProducts]);

    const buildProductPrefill = (product: ManagedProduct) => {
        // ✅ CORRECTION CRITIQUE: Extraire les valeurs depuis les objets structurés si nécessaire
        // (Format FormulaireYukpoIntelligentScreen avec type_donnee/valeur)
        const extractValue = (field: any): any => {
            if (field === null || field === undefined) return undefined;
            if (typeof field === 'object' && 'valeur' in field) {
                return field.valeur;
            }
            return field;
        };

        // ✅ CORRECTION CRITIQUE: Copier TOUS les champs du produit ORIGINAL (avant normalisation)
        // Mais d'abord, on doit reconstruire la structure originale si elle a été normalisée
        // Les produits de FormulaireYukpoIntelligentScreen ont leurs champs dans format { type_donnee: '...', valeur: ... }
        // Les produits d'AjouterProduitSimpleScreen ont leurs champs directement

        // ✅ NOUVEAU: Préserver TOUS les champs du produit, y compris ceux qui sont dans le format structuré
        const prefill: Record<string, any> = {};

        // ✅ CORRECTION CRITIQUE: Copier TOUS les champs du produit, en extrayant les valeurs depuis objets structurés
        Object.keys(product).forEach(key => {
            // Ignorer les champs métadonnées ajoutés par MesProduitsScreen
            if (['id', 'rawProductId', 'product_index', 'category_key', 'category_label',
                'serviceId', 'serviceTitre', 'is_active', 'created_at_ts', 'views',
                'shares', 'saves'].includes(key)) {
                return;
            }

            const value = product[key];
            if (value !== undefined && value !== null) {
                // Extraire depuis objets structurés si nécessaire
                const extracted = extractValue(value);
                if (extracted !== undefined) {
                    prefill[key] = extracted;
                } else {
                    prefill[key] = value;
                }
            }
        });

        // ✅ CORRECTION CRITIQUE: Champs de base avec extraction depuis objets structurés
        // S'assurer que les champs sont bien présents même s'ils ont été normalisés
        const nomRaw = product.nom || product.nom_produit;
        const categorieRaw = product.categorie_produit || product.categorie || product.category;
        const descriptionRaw = product.description || product.description_produit;

        // ✅ CORRECTION: Toujours extraire et définir les valeurs, même si elles sont vides
        // Cela garantit que les champs sont toujours présents dans le prefill
        const nomValue = extractValue(nomRaw);
        if (nomValue !== undefined && nomValue !== null && String(nomValue).trim().length > 0) {
            prefill.nom_produit = typeof nomValue === 'string' ? nomValue : String(nomValue);
        } else if (typeof nomRaw === 'string' && nomRaw.trim().length > 0) {
            prefill.nom_produit = nomRaw.trim();
        } else if (!prefill.nom_produit) {
            prefill.nom_produit = '';
        }

        const categorieValue = extractValue(categorieRaw);
        if (categorieValue !== undefined && categorieValue !== null && String(categorieValue).trim().length > 0) {
            prefill.categorie_produit = typeof categorieValue === 'string' ? categorieValue : String(categorieValue);
        } else if (typeof categorieRaw === 'string' && categorieRaw.trim().length > 0) {
            prefill.categorie_produit = categorieRaw.trim();
        } else if (!prefill.categorie_produit) {
            prefill.categorie_produit = '';
        }

        const descriptionValue = extractValue(descriptionRaw);
        if (descriptionValue !== undefined && descriptionValue !== null && String(descriptionValue).trim().length > 0) {
            prefill.description_produit = typeof descriptionValue === 'string' ? descriptionValue : String(descriptionValue);
        } else if (typeof descriptionRaw === 'string' && descriptionRaw.trim().length > 0) {
            prefill.description_produit = descriptionRaw.trim();
        } else if (!prefill.description_produit) {
            prefill.description_produit = '';
        }

        // ✅ CORRECTION: Extraire prix depuis objets structurés
        // Toujours définir le prix, même s'il est vide ou 0
        if (!prefill.prix_produit || prefill.prix_produit === '' || prefill.prix_produit === '0') {
            const prixRaw = product.prix_produit || product.prix;
            const prixValue = extractValue(prixRaw);

            if (prixValue !== undefined && prixValue !== null && prixValue !== '' && prixValue !== '0') {
                prefill.prix_produit = typeof prixValue === 'number'
                    ? prixValue.toString()
                    : (typeof prixValue === 'string' ? prixValue : String(prixValue));
            } else if (product.prix !== undefined && product.prix !== null && product.prix !== '' && product.prix !== 0) {
                prefill.prix_produit = typeof product.prix === 'number'
                    ? product.prix.toString()
                    : (typeof product.prix === 'string' ? product.prix : String(product.prix));
            } else {
                prefill.prix_produit = '';
            }
        }

        // ✅ CORRECTION: Extraire devise depuis objets structurés
        // Toujours définir la devise, avec fallback sur XAF
        if (!prefill.devise_produit) {
            const deviseRaw = product.devise_produit || product.devise;
            const deviseValue = extractValue(deviseRaw);
            prefill.devise_produit = (deviseValue && typeof deviseValue === 'string' && deviseValue.trim().length > 0)
                ? deviseValue.trim().toUpperCase()
                : (typeof deviseRaw === 'string' && deviseRaw.trim().length > 0)
                    ? deviseRaw.trim().toUpperCase()
                    : 'XAF';
        }

        // ✅ CORRECTION CRITIQUE: Extraire lieu_produit depuis objets structurés avec tous les fallbacks
        // Ne pas écraser si déjà présent dans prefill
        if (!prefill.lieu_produit) {
            const lieuRaw = product.lieu_produit || product.lieu || product.lieu_commercial || product.lieu_commercialisation || product.location;
            const lieuValue = extractValue(lieuRaw);
            if (lieuValue !== undefined && lieuValue !== null) {
                prefill.lieu_produit = typeof lieuValue === 'string' ? lieuValue : String(lieuValue);
            } else if (typeof lieuRaw === 'string' && lieuRaw.trim().length > 0) {
                prefill.lieu_produit = lieuRaw.trim();
            }
        }

        // ✅ CORRECTION CRITIQUE: Gestion des produits (autocomplete) avec extraction depuis objets structurés
        const produitsRaw = product.produits;
        let produitsExtracted: any = null;

        // Extraire depuis format listeproduit ou objet structuré
        if (produitsRaw && typeof produitsRaw === 'object') {
            if (produitsRaw.type_donnee === 'listeproduit' && Array.isArray(produitsRaw.valeur)) {
                // Format listeproduit: extraire le premier produit et reconstruire l'autocomplete
                const firstProduct = produitsRaw.valeur[0];
                if (firstProduct) {
                    if (firstProduct.combinaison_brute) {
                        produitsExtracted = [firstProduct.combinaison_brute];
                    } else if (Array.isArray(firstProduct.characteristic_vector)) {
                        produitsExtracted = [firstProduct.characteristic_vector.filter(Boolean).join(', ')];
                    }
                }
            } else if (Array.isArray(produitsRaw.valeur)) {
                // Format autocomplete avec valeur array
                produitsExtracted = produitsRaw.valeur;
            } else if (produitsRaw.type_donnee === 'autocomplete' && Array.isArray(produitsRaw.valeur)) {
                produitsExtracted = produitsRaw.valeur;
            }
        }

        // ✅ CORRECTION: Toujours définir produits, même si vide
        if (produitsExtracted) {
            prefill.produits = Array.isArray(produitsExtracted) ? produitsExtracted : [produitsExtracted];
        } else if (Array.isArray(product.produits)) {
            prefill.produits = product.produits;
        } else if (product.combinaison_brute) {
            prefill.produits = [product.combinaison_brute];
        } else if (Array.isArray(product.characteristic_vector) && product.characteristic_vector.length > 0) {
            prefill.produits = [product.characteristic_vector.filter(Boolean).join(', ')];
        } else if (!prefill.produits) {
            prefill.produits = [];
        }

        // ✅ CORRECTION CRITIQUE: Gestion des sous-caractéristiques avec extraction
        const sousCaracsRaw = product.sous_caracteristiques;
        let sousCaracsExtracted: any = null;

        if (sousCaracsRaw && typeof sousCaracsRaw === 'object') {
            if ('valeur' in sousCaracsRaw) {
                sousCaracsExtracted = sousCaracsRaw.valeur;
            } else {
                sousCaracsExtracted = sousCaracsRaw;
            }
        }

        // ✅ CORRECTION: Toujours définir sous_caracteristiques, même si vide
        if (sousCaracsExtracted && typeof sousCaracsExtracted === 'object' && Object.keys(sousCaracsExtracted).length > 0) {
            prefill.sous_caracteristiques = sousCaracsExtracted;
        } else if (product.sous_caracteristiques && typeof product.sous_caracteristiques === 'object' && Object.keys(product.sous_caracteristiques).length > 0) {
            prefill.sous_caracteristiques = product.sous_caracteristiques;
        } else if (Array.isArray(product.product_labels) && Array.isArray(product.characteristic_vector) && product.product_labels.length > 0 && product.characteristic_vector.length > 0) {
            const map: Record<string, string[]> = {};
            product.product_labels.forEach((label: string, index: number) => {
                const value = product.characteristic_vector[index];
                if (!label || !value) {
                    return;
                }
                if (!map[label]) {
                    map[label] = [];
                }
                if (!map[label].includes(value)) {
                    map[label].push(value);
                }
            });
            if (Object.keys(map).length > 0) {
                prefill.sous_caracteristiques = map;
            } else if (!prefill.sous_caracteristiques) {
                prefill.sous_caracteristiques = {};
            }
        } else if (!prefill.sous_caracteristiques) {
            prefill.sous_caracteristiques = {};
        }

        // ✅ CORRECTION CRITIQUE 2026-01-04: Extraire variabilite_prix depuis productData (qui vient de ...productData)
        // Ne pas écraser si déjà présent dans prefill
        if (!prefill.variabilite_prix && !prefill.price_variant) {
            // Chercher dans product directement (déjà copié depuis ...productData)
            const variantRaw = product.variabilite_prix || product.price_variant || product.variation_prix;

            // Si variantRaw est un objet avec 'valeur', extraire la valeur
            let variantValue = variantRaw;
            if (variantRaw && typeof variantRaw === 'object' && 'valeur' in variantRaw) {
                variantValue = variantRaw.valeur;
            }

            // Si variantValue est valide, l'assigner
            if (variantValue !== undefined && variantValue !== null) {
                // Si variantValue est déjà un objet avec modalites, l'utiliser tel quel
                if (typeof variantValue === 'object' && 'modalites' in variantValue) {
                    prefill.variabilite_prix = variantValue;
                    prefill.price_variant = variantValue;
                } else if (variantRaw && typeof variantRaw === 'object' && !('valeur' in variantRaw)) {
                    // Si variantRaw est un objet direct (pas avec valeur), l'utiliser tel quel
                    prefill.variabilite_prix = variantRaw;
                    prefill.price_variant = variantRaw;
                } else {
                    // Sinon, utiliser variantValue tel quel
                    prefill.variabilite_prix = variantValue;
                    prefill.price_variant = variantValue;
                }
            }
        }

        // ✅ CORRECTION CRITIQUE: Médias avec extraction depuis objets structurés et toutes variantes
        const extractMediaArray = (field: any): any[] => {
            if (!field) return [];
            if (Array.isArray(field)) return field;
            if (typeof field === 'object' && 'valeur' in field && Array.isArray(field.valeur)) {
                return field.valeur;
            }
            return [];
        };

        // Extraire images depuis toutes les variantes possibles (images, base64_image, image_base64)
        const imagesFromImages = extractMediaArray(product.images);
        const imagesFromBase64 = extractMediaArray(product.base64_image);
        const imagesFromImageBase64 = extractMediaArray(product.image_base64);
        const allImages = [...imagesFromImages, ...imagesFromBase64, ...imagesFromImageBase64].filter((img, idx, arr) => arr.indexOf(img) === idx);
        if (allImages.length > 0) {
            prefill.images = allImages;
        }

        // Extraire videos depuis toutes les variantes possibles (videos, video_base64)
        const videosFromVideos = extractMediaArray(product.videos);
        const videosFromBase64 = extractMediaArray(product.video_base64);
        const allVideos = [...videosFromVideos, ...videosFromBase64].filter((vid, idx, arr) => arr.indexOf(vid) === idx);
        if (allVideos.length > 0) {
            prefill.videos = allVideos;
        }

        // Extraire audios depuis toutes les variantes possibles (audios, audio_base64)
        const audiosFromAudios = extractMediaArray(product.audios);
        const audiosFromBase64 = extractMediaArray(product.audio_base64);
        const allAudios = [...audiosFromAudios, ...audiosFromBase64].filter((aud, idx, arr) => arr.indexOf(aud) === idx);
        if (allAudios.length > 0) {
            prefill.audios = allAudios;
        }

        // Extraire documents depuis toutes les variantes possibles (documents, doc_base64)
        const docsFromDocs = extractMediaArray(product.documents);
        const docsFromBase64 = extractMediaArray(product.doc_base64);
        const allDocs = [...docsFromDocs, ...docsFromBase64].filter((doc, idx, arr) => arr.indexOf(doc) === idx);
        if (allDocs.length > 0) {
            prefill.documents = allDocs;
        }

        // ✅ Préserver characteristic_vector et combinaison_brute
        if (Array.isArray(product.characteristic_vector)) {
            prefill.characteristic_vector = product.characteristic_vector;
        }
        if (product.combinaison_brute) {
            prefill.combinaison_brute = product.combinaison_brute;
        }
        // ✅ CORRECTION CRITIQUE: Préserver product_vector et product_labels pour reconstruction des caractéristiques
        if (Array.isArray(product.product_vector)) {
            prefill.product_vector = product.product_vector;
        }
        if (Array.isArray(product.product_labels)) {
            prefill.product_labels = product.product_labels;
        }

        // ✅ CORRECTION CRITIQUE: Préserver TOUS les champs spécialisés (typeVetement, marqueVetement, etc.)
        // Ces champs ne doivent pas être supprimés car ils sont nécessaires pour la modification
        const specializedFields = [
            'typeVetement', 'marqueVetement', 'tailleVetement', 'couleurVetement', 'etatVetement',
            'typeChaussure', 'marqueChaussure', 'pointureChaussure', 'couleurChaussure',
            'typeTelephone', 'marqueTelephone', 'modeleTelephone', 'etatTelephone',
            'typeVehicule', 'marqueVehicule', 'modeleVehicule', 'anneeVehicule',
            'typeMobilier', 'categorieMobilier', 'styleMobilier', 'materiauMobilier',
            'lieu_produit', 'lieu_commercial', 'lieu_commercialisation',
            'variabilite_prix', 'price_variant', 'variation_prix',
            // ... et tous les autres champs spécialisés
        ];

        specializedFields.forEach(fieldName => {
            if (product[fieldName] !== undefined && product[fieldName] !== null) {
                const extracted = extractValue(product[fieldName]);
                if (extracted !== undefined) {
                    prefill[fieldName] = extracted;
                } else {
                    prefill[fieldName] = product[fieldName];
                }
            }
        });

        // ✅ CORRECTION CRITIQUE: Ne PAS supprimer les champs 'nom', 'prix', 'devise', 'description', 'categorie', 'category'
        // Car ils peuvent être nécessaires pour les produits créés via FormulaireYukpoIntelligentScreen
        // On les garde dans le prefill pour compatibilité

        // ✅ Supprimer UNIQUEMENT les champs métadonnées ajoutés par MesProduitsScreen
        delete prefill.id;
        delete prefill.rawProductId;
        delete prefill.product_index;
        delete prefill.category_key;
        delete prefill.category_label;
        delete prefill.serviceId;
        delete prefill.serviceTitre;
        delete prefill.is_active;
        delete prefill.created_at_ts;
        delete prefill.views;
        delete prefill.shares;
        delete prefill.saves;

        // ✅ DEBUG: Log pour vérifier le contenu du prefill (avec détails pour debugging)
        console.log('[MesProduitsScreen] buildProductPrefill - Prefill généré:', {
            nom_produit: prefill.nom_produit || 'VIDE',
            categorie_produit: prefill.categorie_produit || 'VIDE',
            description_produit: prefill.description_produit || 'VIDE',
            prix_produit: prefill.prix_produit || 'VIDE',
            devise_produit: prefill.devise_produit || 'VIDE',
            produits: prefill.produits ? (Array.isArray(prefill.produits) ? `${prefill.produits.length} élément(s)` : 'non-array') : 'VIDE',
            sous_caracteristiques: prefill.sous_caracteristiques
                ? (typeof prefill.sous_caracteristiques === 'object' ? `${Object.keys(prefill.sous_caracteristiques).length} dimension(s)` : 'présent')
                : 'VIDE',
            lieu_produit: prefill.lieu_produit || 'VIDE',
            variabilite_prix: prefill.variabilite_prix ? 'présent' : 'VIDE',
            price_variant: prefill.price_variant ? 'présent' : 'VIDE',
            totalKeys: Object.keys(prefill).length,
            allKeys: Object.keys(prefill).filter(k => !['images', 'videos', 'audios', 'documents'].includes(k))
        });

        return prefill;
    };

    const renderProductCard = (product: ManagedProduct) => {
        // ✅ CORRIGÉ: Extraire la devise du produit (priorité: devise_produit > devise)
        const productCurrency = product.devise_produit || product.devise;

        // ✅ CORRIGÉ 2026-02-10: Vérifier les variations de prix avant d'afficher le prix unique
        // Si le produit a des variations de prix, calculer le prix minimum
        const priceVariant = product.price_variant || product.variabilite_prix || product.variation_prix;
        const hasVariants = priceVariant && typeof priceVariant === 'object' && Array.isArray(priceVariant.modalites) && priceVariant.modalites.length > 0;

        let priceValue: string | null = null;

        if (hasVariants) {
            // ✅ CORRIGÉ 2026-02-10: Calculer le prix minimum des variations
            const modalites = priceVariant.modalites || [];
            const variantPrices = modalites
                .map((m: any) => {
                    const prix = m.prix || m.price || 0;
                    return typeof prix === 'number' ? prix : parseFloat(String(prix)) || 0;
                })
                .filter((p: number) => p > 0);

            if (variantPrices.length > 0) {
                const minPrice = Math.min(...variantPrices);
                const prixFormatted = minPrice.toLocaleString('fr-FR');
                const variantCurrency = modalites[0]?.devise || modalites[0]?.currency || productCurrency || 'XAF';
                priceValue = variantCurrency && variantCurrency.trim()
                    ? `À partir de ${prixFormatted} ${variantCurrency.trim()}`
                    : `À partir de ${prixFormatted}`;
            }
        }

        // Si pas de variations ou pas de prix dans les variations, utiliser le prix unique
        if (!priceValue) {
            priceValue = product.prix !== undefined && product.prix !== null && product.prix !== 0
                ? (() => {
                    const prixNum = typeof product.prix === 'number' ? product.prix : parseFloat(String(product.prix)) || 0;
                    const prixFormatted = prixNum.toLocaleString('fr-FR');
                    // ✅ CORRIGÉ: N'afficher la devise que si elle existe, sinon ne pas en mettre
                    return productCurrency && productCurrency.trim()
                        ? `${prixFormatted} ${productCurrency.trim()}`
                        : prixFormatted;
                })()
                : product.prix_produit && product.prix_produit !== 0
                    ? (() => {
                        const prixNum = typeof product.prix_produit === 'number' ? product.prix_produit : parseFloat(String(product.prix_produit)) || 0;
                        const prixFormatted = prixNum.toLocaleString('fr-FR');
                        return productCurrency && productCurrency.trim()
                            ? `${prixFormatted} ${productCurrency.trim()}`
                            : prixFormatted;
                    })()
                    : null;
        }

        const productDescription = product.description
            || product.description_produit
            || product.resume
            || product.details
            || '';

        const categoryLabel = product.category_label || getProductTypeLabel(product.category_key ?? product.type ?? null);
        const viewsLabel = formatStatValue(product.views);
        const sharesLabel = formatStatValue(product.shares);
        const savesLabel = formatStatValue(product.saves);

        return (
            <NativeCard
                key={`${product.serviceId}_${product.id}_${product.product_index}`}
                style={styles.productCard}
            >
                {/* ✅ NOUVEAU 2026-02-27: Thumbnail produit */}
                {(() => {
                    const allMedia = [...(Array.isArray(product.images) ? product.images : []), ...(Array.isArray(product.videos) ? product.videos : [])];
                    const firstImage = allMedia.find((m: any) => typeof m === 'string' && !m.includes('.mp4') && !m.includes('.webm'));
                    const thumbUrl = firstImage ? buildMediaUrl(firstImage) : null;
                    if (thumbUrl) {
                        return (
                            <Image
                                source={{ uri: thumbUrl }}
                                style={{ width: '100%', height: 160, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
                                resizeMode="cover"
                            />
                        );
                    }
                    return (
                        <View style={{ width: '100%', height: 80, backgroundColor: '#F3F4F6', borderTopLeftRadius: 12, borderTopRightRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                            <SafeIcon name="image" size={32} color="#D1D5DB" />
                            <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>Aucune image</Text>
                        </View>
                    );
                })()}

                <View style={styles.productHeader}>
                    <View style={styles.productTitleContainer}>
                        <Text style={styles.productName} numberOfLines={2}>
                            {(product.nom?.trim() || product.nom_produit?.trim() || 'Produit sans nom')}
                        </Text>
                        <View style={[
                            styles.productStatusBadge,
                            { backgroundColor: product.is_active ? '#10B981' : '#9CA3AF' }
                        ]}>
                            <Text style={styles.productStatusText}>
                                {product.is_active ? 'Actif' : 'En pause'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.productInfo}>
                    <View style={styles.productInfoRow}>
                        <SafeIcon name="folder" size={14} color="#6B7280" />
                        <Text style={styles.productServiceName} numberOfLines={1}>
                            {(() => {
                                // ✅ CORRIGÉ: Éviter affichage JSON brut
                                const titre = product.serviceTitre;
                                if (!titre) return 'Service sans titre';
                                if (typeof titre === 'string') {
                                    // Éviter d'afficher des objets JSON stringifiés
                                    if (titre.trim().startsWith('{') || titre.trim().startsWith('[')) {
                                        try {
                                            const parsed = JSON.parse(titre.trim());
                                            if (typeof parsed === 'object' && parsed !== null) {
                                                if ('valeur' in parsed && typeof parsed.valeur === 'string') {
                                                    return parsed.valeur.trim() || 'Service sans titre';
                                                }
                                                return 'Service sans titre';
                                            }
                                        } catch {
                                            // Ce n'est pas du JSON valide, retourner tel quel
                                        }
                                    }
                                    return titre.trim() || 'Service sans titre';
                                }
                                // Si c'est un objet, essayer d'extraire la valeur
                                if (typeof titre === 'object' && titre !== null) {
                                    if ('valeur' in titre && typeof titre.valeur === 'string') {
                                        return titre.valeur.trim() || 'Service sans titre';
                                    }
                                    return 'Service sans titre';
                                }
                                return 'Service sans titre';
                            })()}
                        </Text>
                    </View>

                    <View style={styles.productInfoRow}>
                        <SafeIcon name="tag" size={14} color="#6B7280" />
                        <Text style={styles.productCategory} numberOfLines={1}>
                            {categoryLabel || 'Non catégorisé'}
                        </Text>
                    </View>

                    {productDescription ? (
                        <Text style={styles.productDescription} numberOfLines={2}>
                            {productDescription}
                        </Text>
                    ) : null}

                    {priceValue && (
                        <View style={styles.productInfoRow}>
                            <SafeIcon name="shopping-cart" size={14} color="#10B981" />
                            <Text style={styles.productPrix}>{priceValue}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.productStatsRow}>
                    <View style={styles.statItem}>
                        <SafeIcon name="eye" size={14} color="#6B7280" />
                        <Text style={styles.statItemText}>{viewsLabel}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <SafeIcon name="share-2" size={14} color="#6B7280" />
                        <Text style={styles.statItemText}>{sharesLabel}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <SafeIcon name="heart" size={14} color="#6B7280" />
                        <Text style={styles.statItemText}>{savesLabel}</Text>
                    </View>
                </View>

                <View style={styles.productPrimaryActions}>
                    <TouchableOpacity
                        style={[styles.primaryButton, styles.editPrimaryButton]}
                        onPress={() => handleEditProduct(product)}
                    >
                        <SafeIcon name="edit" size={16} color="#FFFFFF" />
                        <Text style={styles.primaryButtonText}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            product.is_active ? styles.pausePrimaryButton : styles.activatePrimaryButton
                        ]}
                        onPress={() => handleToggleProduct(product)}
                    >
                        <SafeIcon
                            name={product.is_active ? 'pause' : 'play'}
                            size={18}
                            color="#FFFFFF"
                        />
                        <Text style={styles.primaryButtonText}>
                            {product.is_active ? 'Mettre en pause' : 'Activer'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.secondaryActions}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleShareProduct(product)}
                    >
                        <SafeIcon name="share-2" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleDuplicateProduct(product)}
                    >
                        <SafeIcon name="copy" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleViewStats(product)}
                    >
                        <SafeIcon name="bar-chart-2" size={20} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handlePromoteProduct(product)}
                    >
                        <SafeIcon name="trending-up" size={20} color="#F59E0B" />
                    </TouchableOpacity>
                    {/* ✅ CORRECTION: Bouton suppression toujours visible */}
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleDeleteProduct(product)}
                    >
                        <SafeIcon name="trash-2" size={20} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </NativeCard>
        );
    };

    // ✅ Fonction pour ouvrir la configuration de livraison pour un produit spécifique
    const handleOpenDeliveryConfig = (product: ManagedProduct) => {
        setShowMenuModal(false);
        const serviceId = product.serviceId || product.data?.serviceId;
        const productIndex = product.product_index ?? product.data?.product_index ?? 0;

        if (!serviceId) {
            Alert.alert(
                'Erreur',
                'Impossible de configurer la livraison : service ID manquant pour ce produit.'
            );
            return;
        }

        setDeliveryConfigProduct(product);
        setShowDeliveryConfigModal(true);
    };

    // ✅ Menu regroupant toutes les actions
    const menuActions = [
        {
            label: 'Configuration livraison',
            icon: 'truck',
            onPress: () => {
                setShowMenuModal(false);
                if (filteredProducts && filteredProducts.length > 0) {
                    // Prendre le premier produit actif, sinon le premier disponible
                    const firstProduct = filteredProducts.find(p => p.is_active) || filteredProducts[0];
                    handleOpenDeliveryConfig(firstProduct);
                } else {
                    Alert.alert('Aucun produit', 'Vous devez d\'abord créer un produit pour configurer la livraison.');
                }
            },
        },
        {
            label: 'Membres',
            icon: 'users',
            onPress: () => {
                setShowMenuModal(false);
                handleManageMembers();
            },
        },
        {
            label: 'Mes videos',
            icon: 'video',
            onPress: () => {
                setShowMenuModal(false);
                (navigation as any).navigate('VideoFeed');
            },
        },
        {
            label: 'Analytics des videos',
            icon: 'bar-chart-2',
            onPress: () => {
                setShowMenuModal(false);
                (navigation as any).navigate('VideoAnalytics');
            },
        },
        {
            label: 'Créer une publicité',
            icon: 'megaphone',
            onPress: () => {
                setShowMenuModal(false);
                (navigation as any).navigate('CreatePublicite');
            },
        },
        {
            label: 'Statistiques',
            icon: 'trending-up',
            onPress: () => {
                setShowMenuModal(false);
                handleViewGlobalStats();
            },
        },
        {
            label: 'Éditer service',
            icon: 'settings',
            onPress: () => {
                setShowMenuModal(false);
                handleEditServiceInfo();
            },
        },
    ];

    // ✅ CORRECTION: Gérer l'état de chargement sans crasher
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de vos produits...</Text>
            </View>
        );
    }

    // ✅ CORRECTION: S'assurer que products est toujours défini
    const safeProducts = products || [];

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.animatedHeader, headerAnimatedStyle]}
            >
                <View onLayout={handleHeaderLayout}>
                    <View style={styles.headerContainer}>
                        <NavigatorToolbar
                            tone="light"
                            showHandle={false}
                            density="comfortable"
                            backIcon={false}
                            title="Produits"
                            subtitle={`${filteredProducts.length} produit${filteredProducts.length > 1 ? 's' : ''}`}
                            rightSlot={(
                                <View style={styles.headerActions}>
                                    {/* ✅ ORDRE CORRIGÉ : Vidéo → Galerie médias → Black Friday → Menu (trois points) */}
                                    <TouchableOpacity
                                        style={styles.headerIconButton}
                                        onPress={openVideoCreatorGlobal}
                                    >
                                        <SafeIcon name="video" size={18} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    {/* ✅ NOUVEAU : Bouton galerie médias des produits */}
                                    <TouchableOpacity
                                        style={styles.headerIconButton}
                                        onPress={() => {
                                            if (services && services.length > 0) {
                                                setSelectedServiceForGallery(services[0]);
                                                setShowMediaGallery(true);
                                            } else {
                                                Alert.alert('Aucun service', 'Vous devez d\'abord créer un service pour accéder à la galerie médias.');
                                            }
                                        }}
                                    >
                                        <SafeIcon name="image" size={18} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    {/* ✅ NOUVEAU : Bouton participation Black Friday */}
                                    <TouchableOpacity
                                        style={styles.headerBlackFridayButton}
                                        onPress={() => (navigation as any).navigate('GlobalPromoSubmission')}
                                    >
                                        <Text style={styles.headerBlackFridayIcon}>🔥</Text>
                                    </TouchableOpacity>
                                    {/* ✅ NOUVEAU : Bouton Configuration Flash Promo */}
                                    <TouchableOpacity
                                        style={[styles.headerIconButton, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' }]}
                                        onPress={() => {
                                            if (!products || products.length === 0) {
                                                Alert.alert('Aucun produit', 'Vous devez d\'abord créer des produits avant de créer un flash promo.');
                                                return;
                                            }
                                            // Prendre le premier produit actif, sinon le premier disponible
                                            const firstProduct = products.find(p => p.is_active) || products[0];
                                            if (firstProduct && firstProduct.serviceId) {
                                                (navigation as any).navigate('CreateFlashPromo', {
                                                    serviceId: parseInt(String(firstProduct.serviceId), 10),
                                                    productIndex: firstProduct.product_index ?? 0,
                                                });
                                            } else {
                                                Alert.alert('Erreur', 'Impossible de créer un flash promo : service ID manquant.');
                                            }
                                        }}
                                    >
                                        <SafeIcon name="zap" size={18} color="#F59E0B" type="lucide" />
                                    </TouchableOpacity>
                                    {/* ✅ Menu (trois points) à la fin */}
                                    <TouchableOpacity
                                        style={styles.headerMenuButton}
                                        onPress={() => setShowMenuModal(true)}
                                    >
                                        <SafeIcon name="more-vertical" size={18} color={modernColors.primary} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    </View>

                    <View style={styles.statsRowContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.statsRowContent}
                        >
                            {(headerSummary || []).map((item) => (
                                <View key={item.label} style={styles.miniStatCard}>
                                    <Text
                                        style={[
                                            styles.miniStatValue,
                                            { color: item.accentColor }
                                        ]}
                                    >
                                        {item.value}
                                    </Text>
                                    <Text style={styles.miniStatLabel} numberOfLines={1}>{item.label}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.filtersContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            {['tous', 'actif', 'inactif'].map((filterOption) => (
                                <TouchableOpacity
                                    key={filterOption}
                                    style={[
                                        styles.filterChip,
                                        filter === filterOption && styles.filterChipActive
                                    ]}
                                    onPress={() => setFilter(filterOption as any)}
                                >
                                    <Text style={[
                                        styles.filterChipText,
                                        filter === filterOption && styles.filterChipTextActive
                                    ]}>
                                        {filterOption === 'tous' ? '📦 Tous' :
                                            filterOption === 'actif' ? '✅ Actifs' : '⏸️ Inactifs'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                    </View>
                </View>
            </Animated.View>

            <Animated.ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 16 }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                {!Array.isArray(filteredProducts) || filteredProducts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <SafeIcon name="package" size={64} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>Aucun produit</Text>
                        <Text style={styles.emptySubtitle}>
                            {filter !== 'tous'
                                ? `Aucun produit ${filter}`
                                : 'Ajoutez des produits à vos services'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.productsList}>
                        {(filteredProducts || []).map(renderProductCard)}
                    </View>
                )}
            </Animated.ScrollView>
            <ProductVideoCreationModal
                visible={videoCreatorVisible}
                primaryProduct={videoCreatorProduct}
                products={products || []}
                onClose={closeVideoCreator}
                onSuccess={handleVideoCreatorSuccess}
            />
            {/* ✅ NOUVEAU: Modal configuration livraison */}
            {deliveryConfigProduct && (() => {
                // ✅ CORRECTION CRITIQUE: Extraire et valider le serviceId
                const serviceIdStr = deliveryConfigProduct.serviceId || deliveryConfigProduct.data?.serviceId;
                const serviceIdNum = serviceIdStr ? parseInt(String(serviceIdStr), 10) : NaN;

                // ✅ PROTECTION: Vérifier que serviceId est valide avant de rendre le modal
                if (!serviceIdNum || isNaN(serviceIdNum)) {
                    console.error('[MesProduitsScreen] ServiceId invalide pour configuration livraison:', {
                        serviceIdStr,
                        serviceIdNum,
                        product: deliveryConfigProduct
                    });
                    return null;
                }

                const productIndex = deliveryConfigProduct.product_index ?? deliveryConfigProduct.data?.product_index ?? 0;

                // ✅ CORRECTION CRITIQUE: Normaliser productName pour s'assurer que c'est toujours une string valide
                const getProductName = (product: any): string => {
                    if (!product) return 'Produit';
                    // Essayer plusieurs champs possibles
                    const candidates = [
                        product.nom,
                        product.nom_produit,
                        product.name,
                        product.title,
                        product.data?.nom,
                        product.data?.nom_produit,
                        product.data?.name
                    ];
                    for (const candidate of candidates) {
                        if (candidate && typeof candidate === 'string') {
                            const trimmed = candidate.trim();
                            if (trimmed.length > 0) return trimmed;
                        }
                        // Si c'est un objet avec une propriété 'valeur'
                        if (candidate && typeof candidate === 'object' && 'valeur' in candidate) {
                            const valeur = candidate.valeur;
                            if (valeur && typeof valeur === 'string') {
                                const trimmed = valeur.trim();
                                if (trimmed.length > 0) return trimmed;
                            }
                        }
                    }
                    return 'Produit';
                };

                const productName = getProductName(deliveryConfigProduct);

                return (
                    <ProductDeliveryConfigModal
                        visible={showDeliveryConfigModal}
                        onClose={() => {
                            setShowDeliveryConfigModal(false);
                            setDeliveryConfigProduct(null);
                        }}
                        serviceId={serviceIdNum}
                        productIndex={productIndex}
                        productName={productName}
                        onSuccess={() => {
                            setShowDeliveryConfigModal(false);
                            setDeliveryConfigProduct(null);
                            loadProducts(true); // Recharger les produits après configuration
                        }}
                    />
                );
            })()}
            <Modal
                visible={showTeamManager}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowTeamManager(false)}
            >
                <ServiceTeamManager
                    serviceId={teamManagerServiceId}
                    onClose={() => {
                        setShowTeamManager(false);
                        loadProducts(true);
                    }}
                />
            </Modal>

            {/* ✅ Menu modal avec toutes les actions */}
            <Modal
                visible={showMenuModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowMenuModal(false)}
            >
                <TouchableOpacity
                    style={styles.menuModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenuModal(false)}
                >
                    <View style={styles.menuModalContent}>
                        {(menuActions || []).map((action, index) => (
                            <TouchableOpacity
                                key={action.label}
                                style={[
                                    styles.menuActionItem,
                                    index === 0 && styles.menuActionItemFirst,
                                    index === menuActions.length - 1 && styles.menuActionItemLast,
                                ]}
                                onPress={action.onPress}
                            >
                                <SafeIcon name={action.icon} size={20} color={modernColors.primary} />
                                <Text style={styles.menuActionText}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ✅ Modal galerie médias des produits */}
            {selectedServiceForGallery && (
                <ServiceMediaGallery
                    visible={showMediaGallery}
                    service={selectedServiceForGallery}
                    onClose={() => {
                        setShowMediaGallery(false);
                        setSelectedServiceForGallery(null);
                    }}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    animatedHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        elevation: 12,
    },
    headerContainer: {
        paddingTop: Platform.OS === 'ios' ? 8 : 8, // ✅ CORRIGÉ: Réduit pour remonter le titre et éviter le masquage par les icônes
        paddingBottom: 12, // ✅ Augmenté pour compenser le paddingTop réduit
        paddingHorizontal: 0, // ✅ Retiré car NavigatorToolbar gère déjà le padding horizontal
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerMenuButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    headerIconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0FDF4',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    headerBlackFridayButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    headerBlackFridayIcon: {
        fontSize: 18,
    },
    statsRowContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    statsRowContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    miniStatCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minWidth: 64,
        gap: 2,
    },
    miniStatValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    miniStatLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
        letterSpacing: 0.1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    menuModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingRight: 16,
    },
    menuModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 8,
        minWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    menuActionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuActionItemFirst: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    menuActionItemLast: {
        borderBottomWidth: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    menuActionText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    filtersContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterRow: {
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    categoryChipActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    categoryChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366F1',
    },
    categoryChipTextActive: {
        color: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 120,
    },
    productsList: {
        padding: 16,
    },
    // ✅ NOUVEAU 2025-11-06: Styles pour regroupement par catégorie
    categoryGroup: {
        marginBottom: 24,
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginBottom: 12,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    categoryCountBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 28,
        alignItems: 'center',
    },
    categoryCountText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    productCard: {
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productHeader: {
        marginBottom: 12,
    },
    productTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    productName: {
        fontSize: 17,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
        marginRight: 8,
    },
    productStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    productStatusText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    productInfo: {
        gap: 8,
        marginBottom: 16,
    },
    productInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    productServiceName: {
        fontSize: 13,
        color: '#6B7280',
        flex: 1,
    },
    productCategory: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366F1',
    },
    productPrix: {
        fontSize: 14,
        fontWeight: '700',
        color: '#10B981',
    },
    productDescription: {
        fontSize: 13,
        color: '#9CA3AF',
        lineHeight: 18,
        marginTop: 4,
    },
    productStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statItemText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
    },
    productPrimaryActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    primaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        paddingVertical: 14,
        backgroundColor: '#6366F1',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
    },
    primaryButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    editPrimaryButton: {
        backgroundColor: '#4F46E5',
    },
    pausePrimaryButton: {
        backgroundColor: '#F97316',
    },
    activatePrimaryButton: {
        backgroundColor: '#10B981',
    },
    productActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    activateButton: {
        backgroundColor: '#10B981',
    },
    deactivateButton: {
        backgroundColor: '#F59E0B',
    },
    editButton: {
        backgroundColor: '#6366F1',
    },
    deleteButton: {
        backgroundColor: '#EF4444',
        flex: 0,
        paddingHorizontal: 14,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    actionButtonDisabled: {
        backgroundColor: '#E5E7EB',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        opacity: 0.7,
    },
    actionButtonTextDisabled: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    secondaryActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 8,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    metricsContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    metricCard: {
        minWidth: 120,
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
    },
    metricValue: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    metricLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.78)',
        marginTop: 2,
    },
    manageActionsContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    manageActionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        minWidth: 160,
    },
    manageActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
        flexShrink: 1,
    },
    manageActionsScroll: {
        backgroundColor: '#FFFFFF',
    },
});

export default MesProduitsScreen;
