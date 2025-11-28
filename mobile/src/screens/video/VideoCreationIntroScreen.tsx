import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import ServiceProductSelector from '../../components/ServiceProductSelector';
import VideoCreationTutorial from '../../components/VideoCreationTutorial';
import VideoExampleModal from '../../components/VideoExampleModal';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { apiCallWithRetry } from '../../utils/retryWithBackoff';
import { navigateToVideoWizard } from '../../utils/videoNavigation';

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
    const headerAnim = useRef(new Animated.Value(0)).current;
    const heroAnim = useRef(new Animated.Value(0)).current;
    const contentAnim = useRef(new Animated.Value(0)).current;
    const actionsAnim = useRef(new Animated.Value(0)).current;

    const [userServices, setUserServices] = useState<any[]>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [showProductSelector, setShowProductSelector] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
    const [showExampleModal, setShowExampleModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);

    // ✅ PHASE 3: Animations améliorées avec transitions plus fluides
    useEffect(() => {
        Animated.stagger(100, [
            Animated.spring(headerAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(heroAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(contentAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(actionsAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    }, [headerAnim, heroAnim, contentAnim, actionsAnim]);

    // ✅ CORRIGÉ: Ne plus ouvrir automatiquement le tutoriel au montage
    // Le tutoriel ne s'ouvrira plus automatiquement au premier clic sur le bouton vidéo
    // Il peut être affiché manuellement si nécessaire via un bouton d'aide
    // useEffect(() => {
    //     const checkTutorial = async () => {
    //         try {
    //             const hasSeenTutorial = await AsyncStorage.getItem('video_creation_tutorial_seen');
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

                if (response.success && Array.isArray(response.data)) {
                    setUserServices(response.data);
                } else {
                    console.warn('[VideoCreationIntroScreen] Réponse API invalide:', response);
                }
            } catch (error: any) {
                console.error('[VideoCreationIntroScreen] Erreur chargement services:', error);
                if (error.message === 'Timeout') {
                    Alert.alert(
                        'Chargement lent',
                        'Le chargement prend plus de temps que prévu. Vérifiez votre connexion internet.',
                        [{ text: 'OK' }]
                    );
                }
            } finally {
                setLoadingServices(false);
            }
        };
        loadServices();
    }, []);

    const fadeUp = (anim: Animated.Value, offset = 16) => ({
        opacity: anim,
        transform: [
            {
                translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [offset, 0],
                }),
            },
        ],
    });

    const handleStart = async () => {
        console.log('[VideoCreationIntroScreen] 🎬 Démarrage création vidéo', params);

        // Si params déjà présents → Navigation directe
        if (params.serviceId && params.productIndex !== undefined) {
            const success = navigateToVideoWizard(navigation, {
                serviceId: params.serviceId,
                productIndex: params.productIndex,
                productName: params.productName
            });
            if (success) return;
        }

        // Si l'utilisateur a des services → Extraire les produits
        if (userServices.length > 0) {
            const allProducts: Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }> = [];

            // ✅ CORRECTION 2025-11-28: Fonction pour extraire les produits (tous formats)
            const extractProduits = (service: any): any[] => {
                const serviceData = service.data || service;

                // Format 1 - produits.valeur (tableau)
                if (serviceData?.produits?.valeur) {
                    const valeur = serviceData.produits.valeur;
                    if (Array.isArray(valeur) && valeur.length > 0) {
                        const filtered = valeur.filter((v: any) => v !== null && v !== undefined && v !== '');
                        if (filtered.length > 0) return filtered;
                    }
                }

                // Format 2 - produits directement un tableau
                if (Array.isArray(serviceData?.produits) && serviceData.produits.length > 0) {
                    return serviceData.produits;
                }

                // Format 3 - produits.items ou produits.list
                if (serviceData?.produits && typeof serviceData.produits === 'object') {
                    const produitsObj = serviceData.produits;
                    if (Array.isArray(produitsObj.items) && produitsObj.items.length > 0) {
                        return produitsObj.items;
                    } else if (Array.isArray(produitsObj.list) && produitsObj.list.length > 0) {
                        return produitsObj.list;
                    }
                }

                // Format 4 - produits dans le service brut
                if (Array.isArray(service.produits) && service.produits.length > 0) {
                    return service.produits;
                }

                return [];
            };

            userServices.forEach((service: any) => {
                const produits = extractProduits(service);
                const serviceId = service.id || service.service_id;
                const serviceName = service.data?.titre_service?.valeur || service.titre || `Service #${serviceId}`;

                if (Array.isArray(produits) && produits.length > 0) {
                    produits.forEach((product: any, index: number) => {
                        // ✅ CORRECTION: Extraire le nom du produit depuis différents formats
                        let productName = 'Produit sans nom';
                        if (typeof product === 'string') {
                            // Si c'est une string, prendre la première partie (avant la virgule)
                            productName = product.split(',')[0].trim() || `Produit ${index + 1}`;
                        } else if (typeof product === 'object' && product !== null) {
                            productName = product.nom || product.name || product.title || product.valeur || `Produit ${index + 1}`;
                        }

                        allProducts.push({
                            serviceId: Number(serviceId),
                            productIndex: index,
                            productName: productName,
                            serviceName: serviceName
                        });
                    });
                }
            });

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

            // ✅ CORRIGÉ: Toujours afficher le sélecteur, même pour un seul produit
            // Cela permet à l'utilisateur de voir et confirmer son choix avant de naviguer
            setAvailableProducts(allProducts);
            setShowProductSelector(true);
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
                <Animated.View style={[styles.header, fadeUp(headerAnim, 18)]}>
                    <SafeIcon name="sparkles" size={32} color={modernColors.primary} />
                    <Text style={styles.title}>{t('video.intro.title')}</Text>
                    <Text style={styles.subtitle}>{t('video.intro.subtitle')}</Text>
                </Animated.View>

                <Animated.View style={[fadeUp(heroAnim, 20)]}>
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
                    <Animated.View style={[styles.servicesInfo, fadeUp(contentAnim, 14)]}>
                        <SafeIcon name="check-circle" size={20} color="#10B981" />
                        <Text style={styles.servicesInfoText}>
                            {userServices.length} service(s) disponible(s) - Prêt à créer une vidéo
                        </Text>
                    </Animated.View>
                )}

                <Animated.View style={[styles.benefits, fadeUp(contentAnim, 14)]}>
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

                <Animated.View style={[styles.actions, fadeUp(actionsAnim, 10)]}>
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
                    // Mode unique (fallback)
                    navigateToVideoWizard(navigation, product);
                }}
                onSelectMultiple={(selectedProducts) => {
                    // ✅ Mode multiple : naviguer avec le premier produit pour l'instant
                    // TODO: Adapter navigateToVideoWizard pour gérer plusieurs produits
                    if (selectedProducts.length > 0) {
                        navigateToVideoWizard(navigation, selectedProducts[0]);
                    }
                }}
                onClose={() => {
                    setShowProductSelector(false);
                    setAvailableProducts([]);
                }}
            />

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
                    await AsyncStorage.setItem('video_creation_tutorial_seen', 'true');
                }}
                onSkip={async () => {
                    setShowTutorial(false);
                    await AsyncStorage.setItem('video_creation_tutorial_seen', 'true');
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
