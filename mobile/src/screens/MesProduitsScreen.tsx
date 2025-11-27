// @ts-nocheck
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    DeviceEventEmitter,
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
import ProductDeliveryConfigModal from '../components/delivery/ProductDeliveryConfigModal';
import { NativeCard } from '../components/NativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
import ProductVideoCreationModal from '../components/ProductVideoCreationModal';
import SafeIcon from '../components/SafeIcon';
import ServiceTeamManager from '../components/ServiceTeamManager';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost, mediaApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import { GeneratedVideoResponse } from '../types/VideoGeneration';
import { navigateToVideoWizard } from '../utils/videoNavigation';

const normalizeCategoryKey = (product: Record<string, any>): string => {
    const raw = product?.categorie_produit
        ?? product?.categorie
        ?? product?.category
        ?? product?.type
        ?? product?.serviceCategorie
        ?? 'autre';

    return String(raw).trim().toLowerCase();
};

const getProductTypeLabel = (type: string): string => {
    const key = (type || '').toLowerCase();
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
    const [categoryFilter, setCategoryFilter] = useState<string>('tous');
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [showTeamManager, setShowTeamManager] = useState(false);
    const [teamManagerServiceId, setTeamManagerServiceId] = useState<string>('');
    const [videoCreatorVisible, setVideoCreatorVisible] = useState(false);
    const [videoCreatorProduct, setVideoCreatorProduct] = useState<ManagedProduct | null>(null);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showDeliveryConfigModal, setShowDeliveryConfigModal] = useState(false);
    const [deliveryConfigProduct, setDeliveryConfigProduct] = useState<ManagedProduct | null>(null);
    const scrollY = useMemo(() => new Animated.Value(0), []);
    const [headerHeight, setHeaderHeight] = useState(HEADER_HEIGHT);

    const headerTranslate = useMemo(() => {
        const collapseDistance = Math.max(headerHeight - 48, 0);
        return scrollY.interpolate({
            inputRange: [0, collapseDistance],
            outputRange: [0, -collapseDistance],
            extrapolate: 'clamp',
        });
    }, [headerHeight, scrollY]);

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

            // Charger tous les services du prestataire
            const servicesResponse = await apiGet('/api/prestataire/services');

            if (servicesResponse.success && servicesResponse.data) {
                const servicesData = servicesResponse.data;
                console.log('[MesProduitsScreen] 📦 Services reçus:', servicesData.length);
                setServices(servicesData);

                // Extraire tous les produits de tous les services
                const allProducts: ManagedProduct[] = [];

                servicesData.forEach((service: any) => {
                    const serviceId = service.id.toString();
                    const serviceTitre = service.data?.titre_service?.valeur || service.titre || 'Service sans titre';
                    // ✅ CORRIGÉ: Extraire les produits de différentes structures possibles
                    let produits: any = null;

                    // Format 1: listeproduit avec type_donnee (FormulaireYukpoIntelligentScreen)
                    if (service.data?.produits?.type_donnee === 'listeproduit' && Array.isArray(service.data.produits.valeur)) {
                        produits = service.data.produits.valeur;
                        console.log('[MesProduitsScreen] ✅ Format listeproduit détecté:', produits.length, 'produits');
                    }
                    // Format 2: Array direct (AjouterProduitSimple)
                    else if (Array.isArray(service.data?.produits)) {
                        produits = service.data.produits;
                        console.log('[MesProduitsScreen] ✅ Format array direct détecté:', produits.length, 'produits');
                    }
                    // Format 3: Objet avec valeur (ancien format)
                    else if (service.data?.produits?.valeur && Array.isArray(service.data.produits.valeur)) {
                        produits = service.data.produits.valeur;
                        console.log('[MesProduitsScreen] ✅ Format valeur détecté:', produits.length, 'produits');
                    }
                    // Format 4: service.produits (fallback)
                    else if (Array.isArray(service.produits?.valeur)) {
                        produits = service.produits.valeur;
                    }
                    else if (Array.isArray(service.produits)) {
                        produits = service.produits;
                    }

                    console.log('[MesProduitsScreen] 🔍 Service:', serviceId, 'Titre:', serviceTitre);
                    console.log('[MesProduitsScreen] 🔍 Produits trouvés:', produits ? (Array.isArray(produits) ? produits.length : 'non-array') : 'null/undefined');

                    const serviceCreatedAtTs = parseDateToTimestamp(
                        service.created_at || service.createdAt || service.data?.created_at
                    );

                    if (produits && Array.isArray(produits) && produits.length > 0) {
                        console.log('[MesProduitsScreen] ✅ Ajout de', produits.length, 'produits du service', serviceId);
                        produits.forEach((product: any, index: number) => {
                            // ✅ CORRECTION CRITIQUE: Normaliser le produit pour extraire les valeurs depuis objets structurés
                            const normalizeProductField = (field: any, fallback?: any): any => {
                                if (field === null || field === undefined) return fallback;
                                if (typeof field === 'object' && 'valeur' in field) {
                                    return field.valeur;
                                }
                                return field !== undefined ? field : fallback;
                            };

                            // ✅ CORRECTION CRITIQUE: Normaliser le produit en préservant TOUS les champs spécialisés
                            // Commencer par copier tous les champs du produit original
                            const normalizedProduct: any = { ...product };

                            // ✅ Normaliser les champs de base (extraire depuis objets structurés si nécessaire)
                            const nomNormalized = normalizeProductField(product.nom);
                            const nomProduitNormalized = normalizeProductField(product.nom_produit);
                            if (nomNormalized !== undefined) normalizedProduct.nom = nomNormalized;
                            if (nomProduitNormalized !== undefined) normalizedProduct.nom_produit = nomProduitNormalized;
                            // ✅ CORRECTION: Utiliser nom_produit comme fallback pour nom si nom n'existe pas
                            if (!normalizedProduct.nom && normalizedProduct.nom_produit) {
                                normalizedProduct.nom = normalizedProduct.nom_produit;
                            }
                            if (!normalizedProduct.nom && !normalizedProduct.nom_produit) {
                                normalizedProduct.nom = '';
                                normalizedProduct.nom_produit = '';
                            }

                            const prixNormalized = normalizeProductField(product.prix);
                            const prixProduitNormalized = normalizeProductField(product.prix_produit);
                            if (prixNormalized !== undefined && prixNormalized !== null) normalizedProduct.prix = prixNormalized;
                            if (prixProduitNormalized !== undefined && prixProduitNormalized !== null) normalizedProduct.prix_produit = prixProduitNormalized;

                            const deviseNormalized = normalizeProductField(product.devise);
                            const deviseProduitNormalized = normalizeProductField(product.devise_produit);
                            if (deviseNormalized) normalizedProduct.devise = deviseNormalized;
                            if (deviseProduitNormalized) normalizedProduct.devise_produit = deviseProduitNormalized;
                            if (!normalizedProduct.devise && !normalizedProduct.devise_produit) {
                                normalizedProduct.devise = 'XAF';
                                normalizedProduct.devise_produit = 'XAF';
                            }

                            const descriptionNormalized = normalizeProductField(product.description);
                            const descriptionProduitNormalized = normalizeProductField(product.description_produit);
                            if (descriptionNormalized !== undefined) normalizedProduct.description = descriptionNormalized;
                            if (descriptionProduitNormalized !== undefined) normalizedProduct.description_produit = descriptionProduitNormalized;

                            const categorieNormalized = normalizeProductField(product.categorie);
                            const categorieProduitNormalized = normalizeProductField(product.categorie_produit);
                            const categoryNormalized = normalizeProductField(product.category);
                            if (categorieNormalized) normalizedProduct.categorie = categorieNormalized;
                            if (categorieProduitNormalized) normalizedProduct.categorie_produit = categorieProduitNormalized;
                            if (categoryNormalized) normalizedProduct.category = categoryNormalized;

                            // ✅ CORRECTION CRITIQUE: Normaliser les champs complexes (sous_caracteristiques, produits, etc.)
                            if (product.sous_caracteristiques) {
                                const sousCaracsNormalized = normalizeProductField(product.sous_caracteristiques);
                                normalizedProduct.sous_caracteristiques = sousCaracsNormalized !== undefined ? sousCaracsNormalized : product.sous_caracteristiques;
                            }

                            // ✅ CORRECTION CRITIQUE: Normaliser TOUS les autres champs du produit (lieu_produit, variabilite_prix, etc.)
                            // Pour les produits créés via FormulaireYukpoIntelligentScreen, tous les champs sont dans format { type_donnee: '...', valeur: ... }
                            Object.keys(product).forEach(key => {
                                // Ignorer les champs déjà normalisés
                                if (['nom', 'nom_produit', 'prix', 'prix_produit', 'devise', 'devise_produit',
                                    'description', 'description_produit', 'categorie', 'categorie_produit', 'category',
                                    'sous_caracteristiques', 'images', 'videos', 'audios', 'documents',
                                    'base64_image', 'video_base64', 'audio_base64', 'doc_base64',
                                    'image_base64'].includes(key)) {
                                    return;
                                }

                                // Normaliser les autres champs (lieu_produit, variabilite_prix, etc.)
                                const fieldValue = product[key];
                                if (fieldValue !== undefined && fieldValue !== null) {
                                    const normalized = normalizeProductField(fieldValue);
                                    if (normalized !== undefined) {
                                        normalizedProduct[key] = normalized;
                                    }
                                }
                            });

                            // ✅ CORRECTION CRITIQUE: Normaliser TOUS les médias depuis différents formats
                            const normalizeMediaField = (field: any): any[] => {
                                if (!field) return [];
                                if (Array.isArray(field)) return field;
                                if (typeof field === 'object' && 'valeur' in field && Array.isArray(field.valeur)) {
                                    return field.valeur;
                                }
                                return [];
                            };

                            // Normaliser images (depuis images, base64_image, image_base64)
                            const imagesFromImages = normalizeMediaField(product.images);
                            const imagesFromBase64 = normalizeMediaField(product.base64_image);
                            const imagesFromImageBase64 = normalizeMediaField(product.image_base64);
                            const allImages = [...imagesFromImages, ...imagesFromBase64, ...imagesFromImageBase64].filter((img, idx, arr) => arr.indexOf(img) === idx);
                            if (allImages.length > 0) {
                                normalizedProduct.images = allImages;
                                normalizedProduct.base64_image = allImages; // Préserver aussi pour compatibilité
                            }

                            // Normaliser videos (depuis videos, video_base64)
                            const videosFromVideos = normalizeMediaField(product.videos);
                            const videosFromBase64 = normalizeMediaField(product.video_base64);
                            const allVideos = [...videosFromVideos, ...videosFromBase64].filter((vid, idx, arr) => arr.indexOf(vid) === idx);
                            if (allVideos.length > 0) {
                                normalizedProduct.videos = allVideos;
                                normalizedProduct.video_base64 = allVideos; // Préserver aussi pour compatibilité
                            }

                            // Normaliser audios (depuis audios, audio_base64)
                            const audiosFromAudios = normalizeMediaField(product.audios);
                            const audiosFromBase64 = normalizeMediaField(product.audio_base64);
                            const allAudios = [...audiosFromAudios, ...audiosFromBase64].filter((aud, idx, arr) => arr.indexOf(aud) === idx);
                            if (allAudios.length > 0) {
                                normalizedProduct.audios = allAudios;
                                normalizedProduct.audio_base64 = allAudios; // Préserver aussi pour compatibilité
                            }

                            // Normaliser documents (depuis documents, doc_base64)
                            const docsFromDocs = normalizeMediaField(product.documents);
                            const docsFromBase64 = normalizeMediaField(product.doc_base64);
                            const allDocs = [...docsFromDocs, ...docsFromBase64].filter((doc, idx, arr) => arr.indexOf(doc) === idx);
                            if (allDocs.length > 0) {
                                normalizedProduct.documents = allDocs;
                                normalizedProduct.doc_base64 = allDocs; // Préserver aussi pour compatibilité
                            }

                            // ✅ TOUS les autres champs sont préservés via le spread initial {...product}

                            const productIndex = typeof normalizedProduct.product_index === 'number'
                                ? normalizedProduct.product_index
                                : index;

                            const rawProductIdCandidate = normalizedProduct.lifecycle_id
                                ?? normalizedProduct.product_lifecycle_id
                                ?? normalizedProduct.productLifecycleId
                                ?? normalizedProduct.product_id
                                ?? normalizedProduct.id
                                ?? null;

                            const numericProductId = resolveNumericId(rawProductIdCandidate);

                            const categoryKey = normalizeCategoryKey(normalizedProduct);
                            const categoryLabel = getProductTypeLabel(categoryKey);

                            const fallbackTimestamp =
                                serviceCreatedAtTs || (numericProductId ? numericProductId * 1000 : 0);
                            const productTimestamp = resolveProductTimestamp(normalizedProduct, fallbackTimestamp);

                            const views = Number(
                                normalizedProduct.views
                                ?? normalizedProduct.stats?.views
                                ?? normalizedProduct.analytics?.views
                                ?? 0
                            );
                            const shares = Number(
                                normalizedProduct.shares
                                ?? normalizedProduct.stats?.shares
                                ?? normalizedProduct.analytics?.shares
                                ?? 0
                            );
                            const saves = Number(
                                normalizedProduct.saves
                                ?? normalizedProduct.stats?.favorites
                                ?? normalizedProduct.analytics?.favorites
                                ?? normalizedProduct.favoris
                                ?? 0
                            );

                            allProducts.push({
                                ...normalizedProduct,
                                id: numericProductId ? String(numericProductId) : `${serviceId}_${productIndex}`,
                                rawProductId: numericProductId ?? undefined,
                                product_index: productIndex,
                                category_key: categoryKey,
                                category_label: categoryLabel,
                                serviceId,
                                serviceTitre,
                                is_active: normalizedProduct.is_active !== undefined ? normalizedProduct.is_active : true,
                                created_at_ts: productTimestamp,
                                views,
                                shares,
                                saves,
                            });
                        });
                    }
                });

                allProducts.sort((a, b) => {
                    const tsA = a.created_at_ts || 0;
                    const tsB = b.created_at_ts || 0;

                    if (tsA !== tsB) {
                        return tsB - tsA;
                    }

                    const rawA = Number(a.rawProductId || 0);
                    const rawB = Number(b.rawProductId || 0);

                    if (rawA !== rawB) {
                        return rawB - rawA;
                    }

                    return (b.product_index ?? 0) - (a.product_index ?? 0);
                });

                console.log('[MesProduitsScreen] 📦 Total produits extraits:', allProducts.length);
                setProducts(allProducts);
            } else {
                // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et contexte
                const errorMessage = servicesResponse.error instanceof Error
                    ? servicesResponse.error.message
                    : String(servicesResponse.error || 'Erreur inconnue');
                console.error('[MesProduitsScreen] Erreur chargement services:', {
                    message: errorMessage,
                    error: servicesResponse.error,
                    response: servicesResponse
                });
                setServices([]);
                setProducts([]);
            }
        } catch (error) {
            // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('[MesProduitsScreen] Erreur:', {
                message: errorMessage,
                stack: errorStack,
                error: error
            });
            Alert.alert('Erreur', 'Impossible de charger vos produits');
            setServices([]);
            setProducts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadProducts();
        }, [loadProducts])
    );

    const onRefresh = () => {
        loadProducts(true);
    };

    React.useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('service:refresh', () => {
            loadProducts(true);
        });

        return () => {
            subscription.remove();
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
            await mediaApi.trackMediaView(result.media_id, { channel: 'studio_preview' });
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
            ? `${result.headline}\n\nVotre vidéo est maintenant disponible dans votre médiathèque.`
            : 'Votre vidéo est maintenant disponible dans votre médiathèque.';

        Alert.alert('🎬 Vidéo créée avec succès', message);
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
                        `Coût de réactivation: ${activationCost.toLocaleString()} FCFA\nVotre solde: ${currentBalance.toLocaleString()} FCFA\n\nVeuillez recharger votre compte.`
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
                            const productIdForDelete = resolveNumericId(product.rawProductId ?? product.id);

                            if (productIdForDelete === null) {
                                Alert.alert(
                                    '❌ Identifiant introuvable',
                                    'Impossible de supprimer ce produit car son identifiant est manquant.'
                                );
                                return;
                            }

                            // ✅ CORRECTION: Supprimer d'abord de l'état local pour feedback immédiat
                            setProducts(prevProducts => prevProducts.filter((p) => {
                                const candidateId = resolveNumericId(p.rawProductId ?? p.id);
                                return candidateId !== productIdForDelete;
                            }));

                            // ✅ CORRECTION: Appeler l'API après mise à jour de l'état local
                            const response = await apiDelete(`/api/products/${productIdForDelete}`);

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
                            console.error('[MesProduitsScreen] Erreur suppression:', {
                                message: errorMessage,
                                stack: errorStack,
                                productId: productIdForDelete,
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
    const handleEditProduct = (product: ManagedProduct) => {
        const productIdForUpdate = resolveNumericId(product.rawProductId ?? product.id);

        if (productIdForUpdate === null) {
            Alert.alert('Identifiant introuvable', 'Impossible de modifier ce produit car son identifiant est manquant.');
            return;
        }

        const prefill = buildProductPrefill(product);
        const mediaData = {
            base64_image: Array.isArray(prefill.images) ? prefill.images : [],
            video_base64: Array.isArray(prefill.videos) ? prefill.videos : [],
            audio_base64: Array.isArray(prefill.audios) ? prefill.audios : [],
            doc_base64: Array.isArray(prefill.documents) ? prefill.documents : [],
        };

        navigation.navigate('AjouterProduitSimple' as never, {
            mode: 'edit',
            serviceId: product.serviceId,
            productId: productIdForUpdate,
            productIndex: product.product_index ?? 0,
            prefill,
            mediaData,
        } as never);
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
            // Générer le lien deep link pour ouvrir l'app directement sur ce produit
            const deepLink = `yukpomnang://product/${product.id}?serviceId=${product.serviceId}`;
            const webLink = `https://yukpomnang.com/product/${product.id}`;

            const shareMessage = `🛍️ ${product.nom}\n\n` +
                `💰 Prix: ${typeof product.prix === 'string' ? product.prix : product.prix.toLocaleString()} ${product.devise || 'FCFA'}\n\n` +
                `${product.description || ''}\n\n` +
                `📦 Service: ${product.serviceTitre}\n\n` +
                `📱 Voir dans l'app: ${deepLink}\n` +
                `🌐 Voir en ligne: ${webLink}`;

            const result = await Share.share({
                message: shareMessage,
                title: `Découvrez: ${product.nom}`,
                url: webLink, // URL pour partage sur réseaux sociaux
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
    const handleDuplicateProduct = (product: ManagedProduct) => {
        const prefill = buildProductPrefill(product);
        const originalName = prefill.nom_produit || product.nom || 'Produit';
        prefill.nom_produit = `${originalName} (Copie)`;

        const mediaData = {
            base64_image: Array.isArray(prefill.images) ? prefill.images : [],
            video_base64: Array.isArray(prefill.videos) ? prefill.videos : [],
            audio_base64: Array.isArray(prefill.audios) ? prefill.audios : [],
            doc_base64: Array.isArray(prefill.documents) ? prefill.documents : [],
        };

        navigation.navigate('AjouterProduitSimple' as never, {
            mode: 'duplicate',
            serviceId: product.serviceId,
            prefill,
            mediaData,
        } as never);
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
            // Charger tous les services du prestataire
            const servicesResponse = await apiGet('/api/prestataire/services');

            if (!servicesResponse.success || !servicesResponse.data || servicesResponse.data.length === 0) {
                Alert.alert(
                    'Aucun service',
                    'Vous devez d\'abord créer un service avant de pouvoir ajouter des produits.\n\nVoulez-vous créer un service maintenant ?',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Créer un service',
                            onPress: () => navigation.navigate('FormulaireYukpoIntelligent' as never)
                        }
                    ]
                );
                return;
            }

            const servicesData = servicesResponse.data;
            setServices(servicesData);

            // Si un seul service, l'ouvrir directement
            if (servicesData.length === 1) {
                const service = servicesData[0];
                navigation.navigate('AjouterProduitSimple' as never, {
                    mode: 'create',
                    serviceId: service.id,
                } as never);
            } else {
                // Plusieurs services : proposer de choisir
                const serviceOptions = servicesData.map((service: any) => ({
                    text: service.data?.titre_service?.valeur || service.titre || `Service ${service.id}`,
                    onPress: () => {
                        navigation.navigate('AjouterProduitSimple' as never, {
                            mode: 'create',
                            serviceId: service.id,
                        } as never);
                    }
                }));

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

    const handleManageMembersForService = (serviceId: string) => {
        openTeamManager(serviceId);
    };

    // ✅ NOUVEAU 2025-11-06: Éditer les informations générales du service
    const handleEditServiceInfo = async () => {
        try {
            // Charger le premier service du prestataire
            const servicesResponse = await apiGet('/api/prestataire/services');

            if (!servicesResponse.success || !servicesResponse.data || servicesResponse.data.length === 0) {
                Alert.alert(
                    'Aucun service',
                    'Vous n\'avez pas encore de service à éditer.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const service = servicesResponse.data[0]; // Premier service
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

        // Filtre par catégorie
        if (categoryFilter !== 'tous' && (product.category_key || 'autre') !== categoryFilter) return false;

        return true;
    });

    const categories = useMemo(() => {
        // ✅ CORRECTION: S'assurer que products est toujours un tableau
        const productsArray = products || [];
        const map = new Map<string, string>();

        productsArray.forEach((product) => {
            const key = product.category_key || 'autre';
            if (!map.has(key)) {
                map.set(key, product.category_label || getProductTypeLabel(key));
            }
        });

        return [
            { key: 'tous', label: 'Toutes catégories' },
            ...Array.from(map.entries()).map(([key, label]) => ({ key, label })),
        ];
    }, [products]);

    // ✅ CORRECTION: S'assurer que products est toujours un tableau
    const productsArray = products || [];
    const totalProducts = productsArray.length;
    const activeProducts = productsArray.filter((p) => p.is_active).length;
    const inactiveProducts = Math.max(totalProducts - activeProducts, 0);
    const totalCategories = Math.max((categories || []).length - 1, 0);

    const headerSummary = useMemo(() => (
        [
            { label: 'Produits', value: totalProducts, accentColor: '#4F46E5' },
            { label: 'Actifs', value: activeProducts, accentColor: '#10B981' },
            { label: 'En pause', value: inactiveProducts, accentColor: '#F97316' },
            { label: 'Catégories', value: totalCategories, accentColor: '#6366F1' },
        ]
    ), [totalProducts, activeProducts, inactiveProducts, totalCategories]);

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

        // ✅ CORRECTION: Ne pas écraser si déjà présent dans prefill
        if (!prefill.nom_produit) {
            prefill.nom_produit = extractValue(nomRaw) || (typeof nomRaw === 'string' ? nomRaw : '');
        }
        if (!prefill.categorie_produit) {
            prefill.categorie_produit = extractValue(categorieRaw) || (typeof categorieRaw === 'string' ? categorieRaw : '');
        }
        if (!prefill.description_produit) {
            prefill.description_produit = extractValue(descriptionRaw) || (typeof descriptionRaw === 'string' ? descriptionRaw : '');
        }

        // ✅ CORRECTION: Extraire prix depuis objets structurés
        // Ne pas écraser si déjà présent dans prefill
        if (!prefill.prix_produit) {
            const prixRaw = product.prix_produit || product.prix;
            const prixValue = extractValue(prixRaw);

            if (prixValue !== undefined && prixValue !== null) {
                prefill.prix_produit = typeof prixValue === 'number'
                    ? prixValue.toString()
                    : (typeof prixValue === 'string' ? prixValue : String(prixValue));
            } else if (product.prix !== undefined && product.prix !== null) {
                prefill.prix_produit = typeof product.prix === 'number'
                    ? product.prix.toString()
                    : product.prix;
            }
        }

        // ✅ CORRECTION: Extraire devise depuis objets structurés
        // Ne pas écraser si déjà présent dans prefill
        if (!prefill.devise_produit) {
            const deviseRaw = product.devise_produit || product.devise;
            prefill.devise_produit = extractValue(deviseRaw) || (typeof deviseRaw === 'string' ? deviseRaw : 'XAF');
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

        if (produitsExtracted) {
            prefill.produits = produitsExtracted;
        } else if (Array.isArray(product.produits)) {
            prefill.produits = product.produits;
        } else if (product.combinaison_brute) {
            prefill.produits = [product.combinaison_brute];
        } else if (Array.isArray(product.characteristic_vector)) {
            prefill.produits = [product.characteristic_vector.filter(Boolean).join(', ')];
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

        if (sousCaracsExtracted) {
            prefill.sous_caracteristiques = sousCaracsExtracted;
        } else if (product.sous_caracteristiques) {
            prefill.sous_caracteristiques = product.sous_caracteristiques;
        } else if (Array.isArray(product.product_labels) && Array.isArray(product.characteristic_vector)) {
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
            }
        }

        prefill.variabilite_prix = product.variabilite_prix || product.price_variant || null;
        prefill.lieu_produit = product.lieu_produit || product.lieu || product.location || null;

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

        // ✅ DEBUG: Log pour vérifier le contenu du prefill
        console.log('[MesProduitsScreen] buildProductPrefill - Prefill généré:', {
            nom_produit: prefill.nom_produit,
            categorie_produit: prefill.categorie_produit,
            description_produit: prefill.description_produit,
            prix_produit: prefill.prix_produit,
            devise_produit: prefill.devise_produit,
            produits: prefill.produits ? (Array.isArray(prefill.produits) ? prefill.produits.length : 'non-array') : 'undefined',
            sous_caracteristiques: prefill.sous_caracteristiques ? 'présent' : 'absent',
            lieu_produit: prefill.lieu_produit,
            totalKeys: Object.keys(prefill).length,
            allKeys: Object.keys(prefill)
        });

        return prefill;
    };

    const renderProductCard = (product: ManagedProduct) => {
        const priceValue = product.prix !== undefined && product.prix !== null
            ? (typeof product.prix === 'number'
                ? `${product.prix.toLocaleString('fr-FR')} ${product.devise || 'FCFA'}`
                : `${product.prix} ${product.devise || 'FCFA'}`)
            : product.prix_produit
                ? `${product.prix_produit} ${product.devise_produit || 'FCFA'}`
                : null;

        const productDescription = product.description
            || product.description_produit
            || product.resume
            || product.details
            || '';

        const categoryLabel = product.category_label || getProductTypeLabel(product.category_key || product.type);
        const viewsLabel = formatStatValue(product.views);
        const sharesLabel = formatStatValue(product.shares);
        const savesLabel = formatStatValue(product.saves);

        return (
            <NativeCard
                key={`${product.serviceId}_${product.id}_${product.product_index}`}
                style={styles.productCard}
            >
                <View style={styles.productHeader}>
                    <View style={styles.productTitleContainer}>
                        <Text style={styles.productName} numberOfLines={2}>
                            {product.nom || product.nom_produit || 'Produit sans nom'}
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
                            {product.serviceTitre || 'Service sans titre'}
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
                            <SafeIcon name="dollar-sign" size={14} color="#10B981" />
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
                        onPress={() => handleManageMembersForService(product.serviceId)}
                    >
                        <SafeIcon name="users" size={20} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleShareProduct(product)}
                    >
                        <SafeIcon name="share-2" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => openVideoCreatorForProduct(product)}
                    >
                        <SafeIcon name="video" size={20} color="#EC4899" />
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
                    {/* ✅ NOUVEAU: Bouton configuration livraison (uniquement pour produits, pas prestations) */}
                    {product.type !== 'prestation_service' && (
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => {
                                setDeliveryConfigProduct(product);
                                setShowDeliveryConfigModal(true);
                            }}
                        >
                            <SafeIcon name="truck" size={20} color="#10B981" />
                        </TouchableOpacity>
                    )}
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

    // ✅ Menu regroupant toutes les actions
    const menuActions = [
        {
            label: 'Membres',
            icon: 'users',
            onPress: () => {
                setShowMenuModal(false);
                handleManageMembers();
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
            icon: 'bar-chart-2',
            onPress: () => {
                setShowMenuModal(false);
                handleViewGlobalStats();
            },
        },
        {
            label: 'Studio vidéo',
            icon: 'video',
            onPress: () => {
                setShowMenuModal(false);
                openVideoCreatorGlobal();
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
            <Animated.View style={[styles.animatedHeader, { transform: [{ translateY: headerTranslate }] }]}
            >
                <View onLayout={handleHeaderLayout}>
                    <View style={styles.headerContainer}>
                        <NavigatorToolbar
                            tone="light"
                            showHandle={false}
                            density="comfortable"
                            backIcon="back"
                            title="Mes Produits"
                            subtitle={`${filteredProducts.length} produit${filteredProducts.length > 1 ? 's' : ''}`}
                            rightSlot={(
                                <View style={styles.headerActions}>
                                    {/* ✅ ORDRE CORRIGÉ : Vidéo → Black Friday → Menu (trois points) */}
                                    <TouchableOpacity
                                        style={styles.headerIconButton}
                                        onPress={openVideoCreatorGlobal}
                                    >
                                        <SafeIcon name="video" size={18} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    {/* ✅ NOUVEAU : Bouton participation Black Friday */}
                                    <TouchableOpacity
                                        style={styles.headerBlackFridayButton}
                                        onPress={() => (navigation as any).navigate('GlobalPromoSubmission')}
                                    >
                                        <Text style={styles.headerBlackFridayIcon}>🔥</Text>
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

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            {(categories || []).map(({ key, label }) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[
                                        styles.categoryChip,
                                        categoryFilter === key && styles.categoryChipActive
                                    ]}
                                    onPress={() => setCategoryFilter(key)}
                                >
                                    <Text style={[
                                        styles.categoryChipText,
                                        categoryFilter === key && styles.categoryChipTextActive
                                    ]}>
                                        {key === 'tous' ? `🏷️ ${label}` : label}
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
                onScroll={Animated.event([
                    { nativeEvent: { contentOffset: { y: scrollY } } },
                ], { useNativeDriver: true })}
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
                ) : categoryFilter === 'tous' ? (
                    <View style={styles.productsList}>
                        {(categories || []).slice(1).map(({ key, label }) => {
                            const categoryProducts = (filteredProducts || []).filter(
                                (product) => (product?.category_key || 'autre') === key
                            );

                            if (!categoryProducts || categoryProducts.length === 0) {
                                return null;
                            }

                            return (
                                <View key={key} style={styles.categoryGroup}>
                                    <View style={styles.categoryHeader}>
                                        <Text style={styles.categoryTitle}>{label || 'Sans catégorie'}</Text>
                                        <View style={styles.categoryCountBadge}>
                                            <Text style={styles.categoryCountText}>
                                                {categoryProducts.length}
                                            </Text>
                                        </View>
                                    </View>

                                    {(categoryProducts || []).map(renderProductCard)}
                                </View>
                            );
                        })}
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
            {deliveryConfigProduct && (
                <ProductDeliveryConfigModal
                    visible={showDeliveryConfigModal}
                    onClose={() => {
                        setShowDeliveryConfigModal(false);
                        setDeliveryConfigProduct(null);
                    }}
                    serviceId={parseInt(deliveryConfigProduct.serviceId, 10)}
                    productIndex={deliveryConfigProduct.product_index ?? 0}
                    productName={deliveryConfigProduct.nom || 'Produit'}
                    onSuccess={() => {
                        setShowDeliveryConfigModal(false);
                        setDeliveryConfigProduct(null);
                        loadProducts(true); // Recharger les produits après configuration
                    }}
                />
            )}
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
        paddingTop: Platform.OS === 'ios' ? 24 : 12,
        paddingBottom: 8,
        paddingHorizontal: 16,
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
