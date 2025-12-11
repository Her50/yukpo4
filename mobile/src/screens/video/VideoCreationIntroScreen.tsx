// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
// ✅ MIGRÉ: Utilise react-native-reanimated pour de meilleures performances
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import ProductVideoCreationModal from '../../components/ProductVideoCreationModal';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import ServiceProductSelector from '../../components/ServiceProductSelector';
import VideoCreationTutorial from '../../components/VideoCreationTutorial';
import VideoExampleModal from '../../components/VideoExampleModal';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import type { ManagedProduct } from '../../types/ManagedProduct';
import type { GeneratedVideoResponse } from '../../types/VideoGeneration';
import { extractProductName, extractServiceName } from '../../utils/displayHelpers';
import { normalizeServiceProducts } from '../../utils/productNormalizer';
import { apiCallWithRetry } from '../../utils/retryWithBackoff';
import SafeStorage from '../../utils/safeStorage';

interface VideoCreationIntroParams {
    serviceId?: number;
    productId?: number;
    productIndex?: number;
    productName?: string;
}

const VideoCreationIntroScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params || {}) as VideoCreationIntroParams;
    const { t } = useLanguageSafe();
    // ✅ MIGRÉ: Utilise useSharedValue au lieu de Animated.Value
    const headerAnim = useSharedValue(0);
    const heroAnim = useSharedValue(0);
    const contentAnim = useSharedValue(0);
    const actionsAnim = useSharedValue(0);

    const [userServices, setUserServices] = useState<any[]>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [showProductSelector, setShowProductSelector] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
    const [showExampleModal, setShowExampleModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    // ✅ NOUVEAU: État pour le modal de création vidéo unifié
    const [showVideoCreationModal, setShowVideoCreationModal] = useState(false);
    const [productsForVideoCreation, setProductsForVideoCreation] = useState<ManagedProduct[]>([]);

    // ✅ MIGRÉ: Animations avec Reanimated (60fps garanti, pas de conflit)
    // Simule Animated.stagger avec des délais
    useEffect(() => {
        headerAnim.value = withSpring(1, { tension: 50, friction: 8 });
        setTimeout(() => {
            heroAnim.value = withSpring(1, { tension: 50, friction: 8 });
        }, 100);
        setTimeout(() => {
            contentAnim.value = withSpring(1, { tension: 50, friction: 8 });
        }, 200);
        setTimeout(() => {
            actionsAnim.value = withSpring(1, { tension: 50, friction: 8 });
        }, 300);
    }, []);

    // ✅ MIGRÉ: Styles animés avec useAnimatedStyle
    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: headerAnim.value,
            transform: [
                {
                    translateY: headerAnim.value * 18 - 18, // offset de 18
                },
            ],
        };
    });

    const heroAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: heroAnim.value,
            transform: [
                {
                    translateY: heroAnim.value * 20 - 20, // offset de 20
                },
            ],
        };
    });

    const contentAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: contentAnim.value,
            transform: [
                {
                    translateY: contentAnim.value * 14 - 14, // offset de 14
                },
            ],
        };
    });

    const actionsAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: actionsAnim.value,
            transform: [
                {
                    translateY: actionsAnim.value * 10 - 10, // offset de 10
                },
            ],
        };
    });

    // ✅ CORRIGÉ: Ne plus ouvrir automatiquement le tutoriel au montage
    // Le tutoriel ne s'ouvrira plus automatiquement au premier clic sur le bouton vidéo
    // Il peut être affiché manuellement si nécessaire via un bouton d'aide
    // useEffect(() => {
    //     const checkTutorial = async () => {
    //         try {
    //             const hasSeenTutorial = await SafeStorage.getItem('video_creation_tutorial_seen');
    //             if (!hasSeenTutorial) {
    //                 // Attendre un peu pour que l'écran soit chargé
    //                 setTimeout(() => {
    //                     setShowTutorial(true);
    //                 }, 1000);
    //             }
    //         } catch (error) {
    //             console.error('[VideoCreationIntroScreen] Erreur vérification tutoriel:', error);
    //         }
    //     };
    //     checkTutorial();
    // }, []);

    // Charger les services de l'utilisateur avec timeout
    useEffect(() => {
        const loadServices = async () => {
            try {
                setLoadingServices(true);

                // ✅ Timeout de 10 secondes
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Timeout')), 10000);
                });

                // ✅ PHASE 1: Retry automatique avec backoff
                const response = await apiCallWithRetry(() =>
                    Promise.race([
                        apiGet('/api/prestataire/services'),
                        timeoutPromise
                    ]) as Promise<any>
                );

                console.log('[VideoCreationIntroScreen] 🔍 Réponse API chargement services:', {
                    success: response.success,
                    hasData: !!response.data,
                    isArray: Array.isArray(response.data),
                    length: Array.isArray(response.data) ? response.data.length : 0,
                    dataType: typeof response.data
                });

                if (response.success && Array.isArray(response.data)) {
                    setUserServices(response.data);
                    console.log('[VideoCreationIntroScreen] ✅ Services chargés:', response.data.length);

                    // ✅ AMÉLIORATION: Vérifier immédiatement si des produits sont disponibles
                    let totalProducts = 0;
                    response.data.forEach((service: any) => {
                        const produits = normalizeServiceProducts(service.data?.produits || service.produits);
                        if (Array.isArray(produits)) {
                            totalProducts += produits.length;
                        }
                    });
                    console.log('[VideoCreationIntroScreen] 📊 Total produits détectés:', totalProducts);

                    if (totalProducts === 0) {
                        console.warn('[VideoCreationIntroScreen] ⚠️ Aucun produit trouvé dans les services chargés');
                    }
                } else {
                    console.warn('[VideoCreationIntroScreen] ⚠️ Réponse API invalide:', response);
                    // ✅ AMÉLIORATION: Afficher une alerte si la réponse est invalide
                    if (response.success === false) {
                        Alert.alert(
                            'Erreur de chargement',
                            'Impossible de charger vos services. Veuillez réessayer.',
                            [{ text: 'OK' }]
                        );
                    } else if (response.data && !Array.isArray(response.data)) {
                        // ✅ CORRECTION: Essayer d'extraire les données d'une structure imbriquée
                        console.log('[VideoCreationIntroScreen] 🔍 Tentative extraction données depuis structure imbriquée...');
                        let extractedData = null;
                        if (response.data && typeof response.data === 'object') {
                            if (Array.isArray((response.data as any).data)) {
                                extractedData = (response.data as any).data;
                            } else if (Array.isArray((response.data as any).services)) {
                                extractedData = (response.data as any).services;
                            } else if (Array.isArray((response.data as any).items)) {
                                extractedData = (response.data as any).items;
                            }
                        }

                        if (extractedData && Array.isArray(extractedData)) {
                            console.log('[VideoCreationIntroScreen] ✅ Données extraites depuis structure imbriquée:', extractedData.length);
                            setUserServices(extractedData);
                        } else {
                            console.error('[VideoCreationIntroScreen] ❌ Impossible d\'extraire les données');
                            Alert.alert(
                                'Format de données invalide',
                                'Les données reçues ne sont pas dans le format attendu. Veuillez réessayer.',
                                [{ text: 'OK' }]
                            );
                        }
                    }
                }
            } catch (error: any) {
                console.error('[VideoCreationIntroScreen] ❌ Erreur chargement services:', error);
                if (error.message === 'Timeout') {
                    Alert.alert(
                        'Chargement lent',
                        'Le chargement prend plus de temps que prévu. Vérifiez votre connexion internet.',
                        [{ text: 'OK' }]
                    );
                } else {
                    // ✅ AMÉLIORATION: Afficher une alerte pour les autres erreurs
                    Alert.alert(
                        'Erreur de chargement',
                        'Impossible de charger vos services. Veuillez réessayer plus tard.',
                        [{ text: 'OK' }]
                    );
                }
            } finally {
                setLoadingServices(false);
            }
        };
        loadServices();
    }, []);

    // ✅ MIGRÉ: fadeUp remplacé par useAnimatedStyle (voir styles animés ci-dessus)

    // ✅ NOUVEAU: Fonction helper pour convertir un produit en ManagedProduct
    // (Similaire à celle utilisée dans MesServicesScreen)
    const convertToManagedProduct = (
        service: any,
        product: any,
        productIndex: number
    ): ManagedProduct | null => {
        try {
            const serviceId = service.id || service.service_id;
            const serviceName = extractServiceName(service, `Service #${serviceId}`);

            // Extraire les données du produit (gérer différents formats)
            const productData = product.data || product;

            return {
                id: product.id || `${serviceId}_${productIndex}`,
                serviceId: String(serviceId),
                product_index: productIndex,
                rawProductId: productIndex,
                nom: extractProductName(product, `Produit ${productIndex + 1}`),
                description: productData?.description || product.description || '',
                prix: productData?.prix || product.prix || product.price,
                devise: productData?.devise || product.devise || product.currency || 'XAF',
                type: productData?.type || product.type || product.categorie || 'produit',
                serviceTitre: serviceName,
                images: productData?.images || product.images || [],
                videos: productData?.videos || product.videos || [],
                is_active: productData?.is_active !== false,
                // Inclure toutes les autres propriétés
                ...productData,
                ...product,
            };
        } catch (error) {
            console.error('[VideoCreationIntroScreen] Erreur conversion ManagedProduct:', error);
            return null;
        }
    };

    // ✅ NOUVEAU: Fonction pour charger les produits et ouvrir le modal
    const openVideoCreationModal = async (selectedProduct: { serviceId: number; productIndex: number; productName: string; serviceName: string }) => {
        try {
            // Trouver le service correspondant
            const service = userServices.find(
                (s: any) => (s.id || s.service_id) === selectedProduct.serviceId
            );

            if (!service) {
                Alert.alert('Erreur', 'Service introuvable');
                return;
            }

            // Normaliser les produits du service
            const produitsRaw = service.data?.produits || service.produits || service.data?.data?.produits;
            const produits = normalizeServiceProducts(produitsRaw);

            if (!Array.isArray(produits) || produits.length === 0) {
                Alert.alert('Erreur', 'Aucun produit trouvé dans ce service');
                return;
            }

            // Convertir tous les produits en ManagedProduct
            const managedProducts: ManagedProduct[] = produits
                .map((product: any, index: number) => convertToManagedProduct(service, product, index))
                .filter((p): p is ManagedProduct => p !== null);

            if (managedProducts.length === 0) {
                Alert.alert('Erreur', 'Impossible de charger les produits');
                return;
            }

            // Trouver le produit principal (celui sélectionné)
            const primaryProduct = managedProducts.find(
                (p) => p.product_index === selectedProduct.productIndex
            ) || managedProducts[0];

            // Ouvrir le modal
            setProductsForVideoCreation(managedProducts);
            setShowVideoCreationModal(true);
        } catch (error) {
            console.error('[VideoCreationIntroScreen] Erreur ouverture modal:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir l\'éditeur de vidéo');
        }
    };

    const handleStart = async () => {
        console.log('[VideoCreationIntroScreen] 🎬 Démarrage création vidéo', params);

        // ✅ UNIFIÉ: Si params déjà présents → Ouvrir directement le modal
        if (params.serviceId && params.productIndex !== undefined) {
            const service = userServices.find(
                (s: any) => (s.id || s.service_id) === params.serviceId
            );
            if (service) {
                await openVideoCreationModal({
                    serviceId: params.serviceId,
                    productIndex: params.productIndex,
                    productName: params.productName || 'Produit',
                    serviceName: extractServiceName(service, `Service #${params.serviceId}`)
                });
                return;
            }
        }

        // Si l'utilisateur a des services → Extraire les produits
        if (userServices.length > 0) {
            const allProducts: Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }> = [];

            console.log('[VideoCreationIntroScreen] 🔍 Analyse des services:', {
                servicesCount: userServices.length,
                services: userServices.map(s => ({
                    id: s.id || s.service_id,
                    hasData: !!s.data,
                    hasProduits: !!(s.data?.produits || s.produits)
                }))
            });

            userServices.forEach((service: any) => {
                try {
                    const serviceId = service.id || service.service_id;

                    if (!serviceId) {
                        console.warn('[VideoCreationIntroScreen] ⚠️ Service sans ID, ignoré:', service);
                        return;
                    }

                    // ✅ CORRECTION: Utiliser extractServiceName pour éviter l'affichage de JSON
                    const serviceName = extractServiceName(service, `Service #${serviceId}`);

                    // ✅ CORRECTION: Utiliser normalizeServiceProducts qui gère tous les formats
                    // Essayer plusieurs sources possibles pour les produits
                    const produitsRaw = service.data?.produits ||
                        service.produits ||
                        service.data?.data?.produits ||
                        (service.data && typeof service.data === 'object' && (service.data as any).produits);

                    console.log('[VideoCreationIntroScreen] 🔍 Service', serviceId, 'produits raw:', {
                        type: typeof produitsRaw,
                        isArray: Array.isArray(produitsRaw),
                        hasValue: !!produitsRaw,
                        structure: produitsRaw && typeof produitsRaw === 'object' ? Object.keys(produitsRaw) : [],
                        hasDataProduits: !!service.data?.produits,
                        hasProduits: !!service.produits
                    });

                    const produits = normalizeServiceProducts(produitsRaw);

                    console.log('[VideoCreationIntroScreen] 🔍 Service', serviceId, 'produits normalisés:', {
                        type: typeof produits,
                        isArray: Array.isArray(produits),
                        length: Array.isArray(produits) ? produits.length : 0
                    });

                    if (Array.isArray(produits) && produits.length > 0) {
                        produits.forEach((product: any, index: number) => {
                            try {
                                // ✅ CORRECTION: Utiliser extractProductName pour éviter l'affichage de JSON
                                const productName = extractProductName(product, `Produit ${index + 1}`);

                                console.log('[VideoCreationIntroScreen] ✅ Produit extrait:', {
                                    serviceId: Number(serviceId),
                                    productIndex: index,
                                    productName: productName,
                                    serviceName: serviceName
                                });

                                allProducts.push({
                                    serviceId: Number(serviceId),
                                    productIndex: index,
                                    productName: productName,
                                    serviceName: serviceName
                                });
                            } catch (productError) {
                                console.error('[VideoCreationIntroScreen] ❌ Erreur extraction produit', index, ':', productError);
                            }
                        });
                    } else {
                        console.warn('[VideoCreationIntroScreen] ⚠️ Service', serviceId, 'n\'a pas de produits valides:', {
                            produitsType: typeof produits,
                            produitsIsArray: Array.isArray(produits),
                            produitsLength: Array.isArray(produits) ? produits.length : 'N/A',
                            serviceKeys: service.data ? Object.keys(service.data) : []
                        });
                    }
                } catch (serviceError) {
                    console.error('[VideoCreationIntroScreen] ❌ Erreur traitement service:', serviceError);
                }
            });

            console.log('[VideoCreationIntroScreen] 📊 Total produits extraits:', allProducts.length);

            if (allProducts.length === 0) {
                Alert.alert(
                    'Produit requis',
                    'Vous n\'avez pas encore de produit. Créez d\'abord un produit pour pouvoir créer une vidéo.',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Aller à Mes Services',
                            onPress: () => {
                                const parent = (navigation as any).getParent();
                                if (parent) {
                                    parent.navigate('Services');
                                } else {
                                    navigation.navigate('Services' as never);
                                }
                            }
                        }
                    ]
                );
                return;
            }

            // ✅ CORRECTION 2025-12-01: Toujours ouvrir directement ProductVideoCreationModal
            // L'étape 1 du modal permet déjà de sélectionner le produit, pas besoin du sélecteur intermédiaire
            // Charger tous les produits de tous les services en ManagedProduct
            const allManagedProducts: ManagedProduct[] = [];

            userServices.forEach((service: any) => {
                try {
                    const serviceId = service.id || service.service_id;
                    if (!serviceId) return;

                    const produitsRaw = service.data?.produits ||
                        service.produits ||
                        service.data?.data?.produits ||
                        (service.data && typeof service.data === 'object' && (service.data as any).produits);

                    const produits = normalizeServiceProducts(produitsRaw);

                    if (Array.isArray(produits) && produits.length > 0) {
                        produits.forEach((product: any, index: number) => {
                            const managedProduct = convertToManagedProduct(service, product, index);
                            if (managedProduct) {
                                allManagedProducts.push(managedProduct);
                            }
                        });
                    }
                } catch (serviceError) {
                    console.error('[VideoCreationIntroScreen] ❌ Erreur traitement service pour modal:', serviceError);
                }
            });

            if (allManagedProducts.length > 0) {
                // Ouvrir directement le modal avec tous les produits disponibles
                // L'utilisateur pourra sélectionner le produit à l'étape 1 du modal
                setProductsForVideoCreation(allManagedProducts);
                setShowVideoCreationModal(true);
                return;
            }

            // Fallback: Si on ne peut pas charger les produits, afficher une erreur
            Alert.alert(
                'Erreur',
                'Impossible de charger les produits. Veuillez réessayer.',
                [{ text: 'OK' }]
            );
            return;
        }

        // Pas de services → Rediriger vers MesServices
        Alert.alert(
            'Service requis',
            'Pour créer une vidéo, vous devez d\'abord créer un service avec au moins un produit.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Aller à Mes Services',
                    onPress: () => {
                        const parent = (navigation as any).getParent();
                        if (parent) {
                            parent.navigate('Services');
                        } else {
                            navigation.navigate('Services' as never);
                        }
                    }
                }
            ]
        );
    };

    const handleShowExample = () => {
        console.log('[VideoCreationIntroScreen] 📺 Affichage d\'un exemple vidéo');
        // ✅ PHASE 2: Afficher le modal avec exemple vidéo réel
        setShowExampleModal(true);
    };

    const handleShowTutorial = () => {
        console.log('[VideoCreationIntroScreen] 📚 Affichage du tutoriel manuel');
        setShowTutorial(true);
    };

    return (
        <SafeNativeView style={styles.container} edges={['top', 'bottom']}>
            {/* ✅ NOUVEAU: Bouton d'aide dans le header */}
            <View style={styles.topBar}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    style={styles.helpButton}
                    onPress={handleShowTutorial}
                    accessibilityLabel="Afficher l'aide"
                    accessibilityHint="Ouvre le tutoriel de création vidéo"
                >
                    <SafeIcon name="help-circle" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
            >
                <Animated.View style={[styles.header, headerAnimatedStyle]}>
                    <SafeIcon name="sparkles" size={32} color={modernColors.primary} />
                    <Text style={styles.title}>{t('video.intro.title')}</Text>
                    <Text style={styles.subtitle}>{t('video.intro.subtitle')}</Text>
                </Animated.View>

                <Animated.View style={heroAnimatedStyle}>
                    <NativeCard style={styles.heroCard}>
                        {!imageError ? (
                            <Image
                                source={{
                                    uri: 'https://cdn.yukpo.com/illustrations/video-immersive-hero.png',
                                }}
                                style={styles.heroImage}
                                resizeMode="cover"
                                onError={() => {
                                    // ✅ AMÉLIORATION: Réduire niveau log (image optionnelle, non bloquant)
                                    console.debug('[VideoCreationIntroScreen] Erreur chargement image hero (non bloquant)');
                                    setImageError(true);
                                }}
                            />
                        ) : (
                            <View style={styles.heroFallback}>
                                <SafeIcon name="film" size={64} color={modernColors.primary} />
                                <Text style={styles.heroFallbackText}>
                                    {t('video.intro.heroTitle')}
                                </Text>
                            </View>
                        )}
                        <View style={styles.heroOverlay}>
                            <Text style={styles.heroTitle}>{t('video.intro.heroTitle')}</Text>
                            <Text style={styles.heroDescription}>{t('video.intro.heroDescription')}</Text>
                        </View>
                    </NativeCard>
                </Animated.View>

                {/* ✅ NOUVEAU: Afficher les services disponibles */}
                {loadingServices ? (
                    <View style={styles.servicesInfo}>
                        <ActivityIndicator size="small" color={modernColors.primary} />
                        <Text style={styles.servicesInfoText}>Chargement de vos services...</Text>
                    </View>
                ) : userServices.length > 0 && (
                    <Animated.View style={[styles.servicesInfo, contentAnimatedStyle]}>
                        <SafeIcon name="check-circle" size={20} color="#10B981" />
                        <Text style={styles.servicesInfoText}>
                            {userServices.length} service(s) disponible(s) - Prêt à créer une vidéo
                        </Text>
                    </Animated.View>
                )}

                <Animated.View style={[styles.benefits, contentAnimatedStyle]}>
                    <View style={styles.benefitItem}>
                        <Text style={styles.benefitIcon}>🎬</Text>
                        <Text style={styles.benefitText}>{t('video.intro.benefit.timeline')}</Text>
                    </View>
                    <View style={styles.benefitItem}>
                        <Text style={styles.benefitIcon}>✨</Text>
                        <Text style={styles.benefitText}>{t('video.intro.benefit.broll')}</Text>
                    </View>
                    <View style={styles.benefitItem}>
                        <Text style={styles.benefitIcon}>🔊</Text>
                        <Text style={styles.benefitText}>{t('video.intro.benefit.audio')}</Text>
                    </View>
                </Animated.View>

                <Animated.View style={[styles.actions, actionsAnimatedStyle]}>
                    <NativeButton
                        title={loadingServices ? 'Chargement...' : t('video.intro.createButton')}
                        size="large"
                        variant="primary"
                        onPress={handleStart}
                        disabled={loadingServices}
                    />
                    <NativeButton
                        title={t('video.intro.exampleButton')}
                        size="large"
                        variant="secondary"
                        onPress={handleShowExample}
                    />
                </Animated.View>
            </ScrollView>

            {/* ✅ NOUVEAU: Sélecteur de produit avec sélection multiple */}
            <ServiceProductSelector
                visible={showProductSelector}
                products={availableProducts}
                allowMultiple={true} // ✅ Permettre sélection multiple
                onSelect={(product) => {
                    // ✅ UNIFIÉ: Ouvrir le modal au lieu de naviguer vers wizard
                    openVideoCreationModal(product);
                    setShowProductSelector(false);
                }}
                onSelectMultiple={(selectedProducts) => {
                    // ✅ UNIFIÉ: Pour l'instant, utiliser le premier produit sélectionné
                    // TODO: Adapter ProductVideoCreationModal pour gérer plusieurs produits
                    if (selectedProducts.length > 0) {
                        openVideoCreationModal(selectedProducts[0]);
                        setShowProductSelector(false);
                    }
                }}
                onClose={() => {
                    setShowProductSelector(false);
                    setAvailableProducts([]);
                }}
            />

            {/* ✅ UNIFIÉ: Modal de création vidéo (même que dans MesServicesScreen) */}
            {showVideoCreationModal && productsForVideoCreation.length > 0 && (
                <ProductVideoCreationModal
                    visible={showVideoCreationModal}
                    primaryProduct={productsForVideoCreation[0]}
                    products={productsForVideoCreation}
                    onClose={() => {
                        setShowVideoCreationModal(false);
                        setProductsForVideoCreation([]);
                    }}
                    onSuccess={async (result: GeneratedVideoResponse) => {
                        console.log('[VideoCreationIntroScreen] ✅ Vidéo créée avec succès:', result);
                        setShowVideoCreationModal(false);
                        setProductsForVideoCreation([]);
                        // ✅ Optionnel: Naviguer vers l'écran de résultat
                        // (navigation as any).navigate('VideoGenerationResult', { videoId: result.video_id });
                    }}
                />
            )}

            {/* ✅ PHASE 2: Modal exemple vidéo */}
            <VideoExampleModal
                visible={showExampleModal}
                onClose={() => setShowExampleModal(false)}
                onStartCreation={handleStart}
            />

            {/* ✅ PHASE 3: Tutoriel interactif */}
            <VideoCreationTutorial
                visible={showTutorial}
                onClose={async () => {
                    setShowTutorial(false);
                    await SafeStorage.setItem('video_creation_tutorial_seen', 'true');
                }}
                onSkip={async () => {
                    setShowTutorial(false);
                    await SafeStorage.setItem('video_creation_tutorial_seen', 'true');
                }}
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20, // ✅ CORRIGÉ : Réduit de 24 à 20 pour réduire les espaces
        paddingBottom: 24, // ✅ CORRIGÉ : Réduit de 32 à 24 pour réduire l'espace en bas
    },
    header: {
        marginBottom: 12, // ✅ CORRIGÉ : Réduit de 16 à 12 pour réduire l'espace
        gap: 8, // ✅ CORRIGÉ : Réduit de 12 à 8 pour réduire l'espace entre les éléments
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.text,
        paddingRight: 8, // ✅ Ajout de padding à droite pour éviter le débordement
    },
    subtitle: {
        fontSize: 15,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    heroCard: {
        height: 200,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 12, // ✅ CORRIGÉ : Réduit de 24 à 12 pour réduire l'espace vide
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroOverlay: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        padding: 20,
        justifyContent: 'flex-end',
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 6,
    },
    heroDescription: {
        fontSize: 15,
        color: '#F8FAFC',
        lineHeight: 20,
    },
    benefits: {
        marginBottom: 16, // ✅ CORRIGÉ : Réduit de 32 à 16 pour réduire l'espace vide
        gap: 12, // ✅ CORRIGÉ : Réduit de 18 à 12 pour réduire l'espace entre les items
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10, // ✅ CORRIGÉ : Réduit de 12 à 10 pour réduire l'espace entre icône et texte
    },
    benefitIcon: {
        fontSize: 24, // ✅ CORRIGÉ : Taille d'icône adaptée pour les emojis
        lineHeight: 24,
        marginRight: 2, // ✅ Ajustement pour l'espacement
    },
    benefitText: {
        fontSize: 15,
        color: modernColors.text,
        flex: 1,
    },
    actions: {
        marginTop: 12, // ✅ CORRIGÉ : Réduit de 24 à 12 pour réduire l'espace au-dessus des boutons
        gap: 10, // ✅ CORRIGÉ : Réduit de 12 à 10 pour réduire l'espace entre les boutons
        paddingBottom: 8, // ✅ CORRIGÉ : Réduit de 16 à 8 pour réduire l'espace en bas
    },
    heroFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: modernColors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    heroFallbackText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        textAlign: 'center',
    },
    servicesInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10, // ✅ CORRIGÉ : Réduit de 12 à 10 pour réduire le padding
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        marginBottom: 12, // ✅ CORRIGÉ : Réduit de 16 à 12 pour réduire l'espace en bas
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    servicesInfoText: {
        fontSize: 14,
        color: '#166534',
        fontWeight: '500',
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
    },
    helpButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.primary + '30',
    },
});

export default VideoCreationIntroScreen;
