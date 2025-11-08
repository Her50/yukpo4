// @ts-nocheck
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
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
import { NativeCard } from '../components/NativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
import SafeIcon from '../components/SafeIcon';
import ServiceTeamManager from '../components/ServiceTeamManager';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface Product {
    id: string;
    nom: string;
    type: string;
    prix: number | string;
    devise?: string;
    description?: string;
    is_active?: boolean;
    serviceId: string;
    serviceTitre: string;
    images?: string[];
    [key: string]: any;
    rawProductId?: number;
    product_index?: number;
    category_key?: string;
    category_label?: string;
    views?: number;
    shares?: number;
    saves?: number;
}

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
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
    const [categoryFilter, setCategoryFilter] = useState<string>('tous');
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [showTeamManager, setShowTeamManager] = useState(false);
    const [teamManagerServiceId, setTeamManagerServiceId] = useState<string>('');
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
    const loadProducts = async (isRefresh = false) => {
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
                const allProducts: Product[] = [];

                servicesData.forEach((service: any) => {
                    const serviceId = service.id.toString();
                    const serviceTitre = service.data?.titre_service?.valeur || service.titre || 'Service sans titre';
                    const produits = service.data?.produits?.valeur;
                    const serviceCreatedAtTs = parseDateToTimestamp(
                        service.created_at || service.createdAt || service.data?.created_at
                    );

                    if (produits && Array.isArray(produits)) {
                        produits.forEach((product: any, index: number) => {
                            const productIndex = typeof product.product_index === 'number'
                                ? product.product_index
                                : index;

                            const rawProductIdCandidate = product.lifecycle_id
                                ?? product.product_lifecycle_id
                                ?? product.productLifecycleId
                                ?? product.product_id
                                ?? product.id
                                ?? null;

                            const numericProductId = resolveNumericId(rawProductIdCandidate);

                            const categoryKey = normalizeCategoryKey(product);
                            const categoryLabel = getProductTypeLabel(categoryKey);

                            const fallbackTimestamp =
                                serviceCreatedAtTs || (numericProductId ? numericProductId * 1000 : 0);
                            const productTimestamp = resolveProductTimestamp(product, fallbackTimestamp);

                            const views = Number(
                                product.views
                                ?? product.stats?.views
                                ?? product.analytics?.views
                                ?? 0
                            );
                            const shares = Number(
                                product.shares
                                ?? product.stats?.shares
                                ?? product.analytics?.shares
                                ?? 0
                            );
                            const saves = Number(
                                product.saves
                                ?? product.stats?.favorites
                                ?? product.analytics?.favorites
                                ?? product.favoris
                                ?? 0
                            );

                            allProducts.push({
                                ...product,
                                id: numericProductId ? String(numericProductId) : `${serviceId}_${productIndex}`,
                                rawProductId: numericProductId ?? undefined,
                                product_index: productIndex,
                                category_key: categoryKey,
                                category_label: categoryLabel,
                                serviceId,
                                serviceTitre,
                                is_active: product.is_active !== undefined ? product.is_active : true,
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
                console.error('[MesProduitsScreen] Erreur chargement services:', servicesResponse.error);
                setServices([]);
                setProducts([]);
            }
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger vos produits');
            setServices([]);
            setProducts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadProducts();
        }, [])
    );

    const onRefresh = () => {
        loadProducts(true);
    };

    // Activer/Désactiver un produit spécifique
    const handleToggleProduct = async (product: Product) => {
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
                                    console.error('[MesProduitsScreen] Erreur réactivation:', error);
                                    Alert.alert('Erreur', error.message || 'Impossible de réactiver');
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
                                    console.error('[MesProduitsScreen] Erreur désactivation:', error);
                                    Alert.alert('Erreur', error.message || 'Impossible de désactiver');
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur toggle product:', error);
        }
    };

    // Supprimer un produit
    const handleDeleteProduct = async (product: Product) => {
        Alert.alert(
            'Supprimer le produit',
            `Êtes-vous sûr de vouloir supprimer "${product.nom}" ?\n\nCette action est irréversible.`,
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
                                    'Identifiant introuvable',
                                    'Impossible de supprimer ce produit car son identifiant est manquant.'
                                );
                                return;
                            }

                            const response = await apiDelete(`/api/products/${productIdForDelete}`);

                            if (response.success) {
                                setProducts(prevProducts => prevProducts.filter((p) => {
                                    const candidateId = resolveNumericId(p.rawProductId ?? p.id);
                                    return candidateId !== productIdForDelete;
                                }));
                                await loadProducts(true);
                                Alert.alert('✅ Succès', 'Produit supprimé avec succès');
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible de supprimer le produit');
                            }
                        } catch (error: any) {
                            console.error('[MesProduitsScreen] Erreur suppression:', error);
                            Alert.alert('Erreur', error.message || 'Impossible de supprimer le produit');
                        }
                    }
                }
            ]
        );
    };

    // Modifier un produit (naviguer vers le service parent en mode édition)
    const handleEditProduct = (product: Product) => {
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

    // Partager un produit
    const handleShareProduct = async (product: Product) => {
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
            } else if (result.action === Share.dismissedAction) {
                console.log('⚠️ Partage annulé');
            }
        } catch (error) {
            console.error('Erreur partage produit:', error);
            Alert.alert('Erreur', 'Impossible de partager ce produit');
        }
    };

    // Dupliquer un produit
    const handleDuplicateProduct = (product: Product) => {
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
    const handlePromoteProduct = (product: Product) => {
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
            console.error('[MesProduitsScreen] Erreur création produit:', error);
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
            console.error('[MesProduitsScreen] Erreur édition service:', error);
            Alert.alert('Erreur', 'Impossible de charger les données du service');
        }
    };

    // Voir les statistiques d'un produit
    const handleViewStats = (product: Product) => {
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
    const filteredProducts = products.filter(product => {
        // Filtre par statut
        if (filter === 'actif' && !product.is_active) return false;
        if (filter === 'inactif' && product.is_active) return false;

        // Filtre par catégorie
        if (categoryFilter !== 'tous' && (product.category_key || 'autre') !== categoryFilter) return false;

        return true;
    });

    const categories = useMemo(() => {
        const map = new Map<string, string>();

        products.forEach((product) => {
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

    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.is_active).length;
    const inactiveProducts = Math.max(totalProducts - activeProducts, 0);
    const totalCategories = Math.max(categories.length - 1, 0);

    const headerSummary = useMemo(() => (
        [
            { label: 'Produits', value: totalProducts, accentColor: '#4F46E5' },
            { label: 'Actifs', value: activeProducts, accentColor: '#10B981' },
            { label: 'En pause', value: inactiveProducts, accentColor: '#F97316' },
            { label: 'Catégories', value: totalCategories, accentColor: '#6366F1' },
        ]
    ), [totalProducts, activeProducts, inactiveProducts, totalCategories]);

    const buildProductPrefill = (product: Product) => {
        const prefill: Record<string, any> = {};

        prefill.nom_produit = product.nom || product.nom_produit || '';
        prefill.categorie_produit = product.categorie_produit || product.categorie || product.category || '';
        prefill.description_produit = product.description || product.description_produit || '';

        if (product.prix_produit) {
            prefill.prix_produit = product.prix_produit.toString();
        } else if (product.prix !== undefined && product.prix !== null) {
            prefill.prix_produit = typeof product.prix === 'number'
                ? product.prix.toString()
                : product.prix;
        }

        prefill.devise_produit = product.devise_produit || product.devise || 'XAF';

        if (Array.isArray(product.produits)) {
            prefill.produits = product.produits;
        } else if (product.combinaison_brute) {
            prefill.produits = [product.combinaison_brute];
        } else if (Array.isArray(product.characteristic_vector)) {
            prefill.produits = [product.characteristic_vector.filter(Boolean).join(', ')];
        }

        if (product.sous_caracteristiques) {
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

        if (Array.isArray(product.images)) {
            prefill.images = product.images;
        }
        if (Array.isArray(product.videos)) {
            prefill.videos = product.videos;
        }
        if (Array.isArray(product.audios)) {
            prefill.audios = product.audios;
        }
        if (Array.isArray(product.documents)) {
            prefill.documents = product.documents;
        }
        if (Array.isArray(product.characteristic_vector)) {
            prefill.characteristic_vector = product.characteristic_vector;
        }
        if (product.combinaison_brute) {
            prefill.combinaison_brute = product.combinaison_brute;
        }

        return prefill;
    };

    const renderProductCard = (product: Product) => {
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
                            {product.serviceTitre}
                        </Text>
                    </View>

                    <View style={styles.productInfoRow}>
                        <SafeIcon name="tag" size={14} color="#6B7280" />
                        <Text style={styles.productCategory} numberOfLines={1}>
                            {categoryLabel}
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

    const quickActions = [
        {
            label: 'Éditer service',
            icon: 'settings',
            onPress: handleEditServiceInfo,
        },
        {
            label: 'Membres',
            icon: 'users',
            onPress: handleManageMembers,
        },
        {
            label: 'Créer une publicité',
            icon: 'megaphone',
            onPress: () => (navigation as any).navigate('CreatePublicite'),
        },
        {
            label: 'Statistiques',
            icon: 'bar-chart-2',
            onPress: handleViewGlobalStats,
        },
    ];

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de vos produits...</Text>
            </View>
        );
    }

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
                                <TouchableOpacity
                                    style={styles.editServiceButton}
                                    onPress={handleEditServiceInfo}
                                >
                                    <SafeIcon name="settings" size={18} color={modernColors.primary} />
                                </TouchableOpacity>
                            )}
                        />
                    </View>

                    <View style={styles.statsRowContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.statsRowContent}
                        >
                            {headerSummary.map((item) => (
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

                    <View style={styles.quickActionsRow}>
                        {quickActions.slice(1).map((action) => (
                            <TouchableOpacity
                                key={action.label}
                                style={styles.quickActionButton}
                                onPress={action.onPress}
                            >
                                <SafeIcon name={action.icon} size={16} color={modernColors.primary} />
                                <Text style={styles.quickActionText} numberOfLines={1}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
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
                            {categories.map(({ key, label }) => (
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
                {filteredProducts.length === 0 ? (
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
                        {categories.slice(1).map(({ key, label }) => {
                            const categoryProducts = filteredProducts.filter(
                                (product) => (product.category_key || 'autre') === key
                            );

                            if (categoryProducts.length === 0) {
                                return null;
                            }

                            return (
                                <View key={key} style={styles.categoryGroup}>
                                    <View style={styles.categoryHeader}>
                                        <Text style={styles.categoryTitle}>{label}</Text>
                                        <View style={styles.categoryCountBadge}>
                                            <Text style={styles.categoryCountText}>
                                                {categoryProducts.length}
                                            </Text>
                                        </View>
                                    </View>

                                    {categoryProducts.map(renderProductCard)}
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.productsList}>
                        {filteredProducts.map(renderProductCard)}
                    </View>
                )}
            </Animated.ScrollView>

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
    editServiceButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E0E7FF',
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
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 8,
    },
    quickActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E7FF',
        gap: 6,
        minHeight: 36,
    },
    quickActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        flexShrink: 1,
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
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
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
