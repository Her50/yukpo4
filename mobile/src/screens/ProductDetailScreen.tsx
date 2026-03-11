// @ts-nocheck
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import NavigatorToolbar from '../components/NavigatorToolbar';
import ProductCard from '../components/ProductCard';
import SafeIcon from '../components/SafeIcon';
import { NativeButton } from '../components/SafeNativeDesign';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeStorage from '../utils/safeStorage';

const PENDING_DEEP_LINK_KEY = '@yukpomnang:pending_deep_link';

const ProductDetailScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const [product, setProduct] = useState<any>(null);
    const [service, setService] = useState<any>(null);
    const [prestataire, setPrestataire] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { productId, serviceId, productIndex } = route.params as any;

    useEffect(() => {
        loadProductDetails();
    }, [productId, serviceId, productIndex]);

    const loadProductDetails = async () => {
        try {
            setLoading(true);
            setError(null);

            // ✅ CORRIGÉ 2026-02-10: Parser productId qui peut être au format "service_id_product_index" (ex: "1_1")
            let finalServiceId = serviceId;
            let finalProductIndex = productIndex;

            if (productId && typeof productId === 'string') {
                // Vérifier si productId est au format "service_id_product_index"
                const underscoreIndex = productId.indexOf('_');
                if (underscoreIndex > 0) {
                    const parsedServiceId = parseInt(productId.substring(0, underscoreIndex), 10);
                    const parsedProductIndex = parseInt(productId.substring(underscoreIndex + 1), 10);
                    if (!isNaN(parsedServiceId) && !isNaN(parsedProductIndex)) {
                        finalServiceId = parsedServiceId;
                        finalProductIndex = parsedProductIndex;
                        console.log(`[ProductDetailScreen] ✅ ProductId parsé: serviceId=${finalServiceId}, productIndex=${finalProductIndex}`);
                    }
                } else if (!isNaN(Number(productId))) {
                    // Si productId est juste un nombre, c'est peut-être un productIndex
                    finalProductIndex = Number(productId);
                }
            }

            // Vérifier si l'utilisateur est connecté
            if (!user) {
                // Sauvegarder la destination pour redirection après login
                await SafeStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify({
                    type: 'product',
                    productId,
                    serviceId: finalServiceId,
                    productIndex: finalProductIndex,
                    timestamp: Date.now()
                }));

                Alert.alert(
                    '👋 Bienvenue sur Yukpo!',
                    'Pour voir ce produit, veuillez vous connecter ou créer un compte gratuitement.',
                    [
                        {
                            text: 'Créer un compte',
                            onPress: () => navigation.navigate('Register' as never)
                        },
                        {
                            text: 'Se connecter',
                            onPress: () => navigation.navigate('Login' as never)
                        }
                    ]
                );
                return;
            }

            console.log('🔍 Chargement produit:', productId || finalProductIndex, 'du service:', finalServiceId);

            // ✅ CORRIGÉ 2026-02-10: Utiliser le nouveau système (service_products via API)
            // Charger le service
            const serviceResponse = await apiGet(`/api/services/${finalServiceId}`);
            if (!serviceResponse.success || !serviceResponse.data) {
                throw new Error('Service non trouvé');
            }
            const loadedService = serviceResponse.data;
            setService(loadedService);

            // ✅ CORRIGÉ: Charger les produits depuis l'API service_products
            const productsResponse = await apiGet(`/api/services/${finalServiceId}/products`);
            let foundProduct: any = null;

            if (productsResponse.success && Array.isArray(productsResponse.data)) {
                // Chercher le produit par product_index
                if (finalProductIndex !== undefined && !isNaN(Number(finalProductIndex))) {
                    foundProduct = productsResponse.data.find(
                        (p: any) => p.product_index === Number(finalProductIndex)
                    );
                } else if (productId) {
                    // Fallback: chercher par productId (format service_id_product_index)
                    foundProduct = productsResponse.data.find(
                        (p: any) => `${p.service_id}_${p.product_index}` === productId
                    );
                }
            }

            // ✅ FALLBACK: Si pas trouvé dans service_products, essayer l'ancien système
            if (!foundProduct) {
                const produits = loadedService.data?.produits?.valeur || loadedService.data?.produits || [];
                if (finalProductIndex !== undefined && !isNaN(Number(finalProductIndex))) {
                    foundProduct = produits[Number(finalProductIndex)];
                } else if (productId) {
                    foundProduct = produits.find((p: any) => p.id === productId);
                } else if (produits.length > 0) {
                    // Si aucun des deux n'est fourni, prendre le premier produit
                    foundProduct = produits[0];
                }
            }

            if (!foundProduct) {
                throw new Error('Produit non trouvé dans ce service');
            }

            // ✅ CORRIGÉ 2026-02-10: Enrichir le produit avec le service parent
            // Si le produit vient de l'API service_products, il a déjà la structure correcte
            const productData = foundProduct.product_data || foundProduct;
            const productName = productData.nom || productData.nom_produit || foundProduct.product_name || foundProduct.nom || 'Produit';

            const enrichedProduct = {
                ...foundProduct,
                // ✅ S'assurer que les propriétés principales sont au niveau racine pour ProductCard
                nom: productName,
                nom_produit: productName,
                product_name: productName,
                _service: loadedService,
                _serviceId: finalServiceId,
                _productIndex: finalProductIndex !== undefined ? Number(finalProductIndex) : (foundProduct.product_index || 0),
            };

            setProduct(enrichedProduct);

            // Déterminer le type d'offre pour le bouton intelligent
            const typeOffre = loadedService.data?.type_offre?.valeur || loadedService.data?.type_offre || '';
            const category = loadedService.category || loadedService.data?.categorie_service?.valeur || '';

            // Charger les infos du prestataire
            if (loadedService.user_id) {
                try {
                    const prestataireResponse = await apiGet(`/api/users/profile/${loadedService.user_id}`);
                    if (prestataireResponse.success && prestataireResponse.data) {
                        setPrestataire(prestataireResponse.data);
                    }
                } catch (error) {
                    console.warn('Erreur chargement prestataire:', error);
                }
            }

            console.log('✅ Produit chargé:', productName);
        } catch (error: any) {
            console.error('❌ Erreur chargement produit:', error);
            setError(error.message || 'Impossible de charger ce produit');

            Alert.alert(
                'Produit introuvable',
                'Ce produit n\'existe plus ou a été supprimé.',
                [
                    {
                        text: 'Retour',
                        onPress: () => navigation.navigate('Home' as never)
                    }
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    // Bouton intelligent: "boutique" si produits, "prestations" si services
    const getSmartButtonLabel = () => {
        const typeOffre = service?.data?.type_offre?.valeur || service?.data?.type_offre || '';
        const category = service?.category || service?.data?.categorie_service?.valeur || '';
        const typeStr = String(typeOffre).toLowerCase();
        const catStr = String(category).toLowerCase();

        // Services de type prestation
        const isPrestation = typeStr === 'prestation' || typeStr === 'service' ||
            catStr.includes('service') || catStr.includes('prestation') ||
            catStr.includes('reparation') || catStr.includes('coiffure') ||
            catStr.includes('mecanique') || catStr.includes('plomberie') ||
            catStr.includes('electricite') || catStr.includes('nettoyage');

        if (isPrestation) {
            return '\u{1F527} Voir toutes les prestations';
        }
        return '\u{1F6CD}\u{FE0F} Voir la boutique';
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement du produit...</Text>
            </View>
        );
    }

    if (error || !product) {
        return (
            <View style={styles.errorContainer}>
                <SafeIcon name="alert-circle" size={64} color={modernColors.error} />
                <Text style={styles.errorTitle}>Produit introuvable</Text>
                <Text style={styles.errorText}>{error || 'Ce produit n\'existe plus'}</Text>
                <NativeButton
                    title="🏠 Retour à l'accueil"
                    onPress={() => navigation.navigate('Home' as never)}
                    variant="primary"
                    size="large"
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <NavigatorToolbar
                title="Détail du produit"
                subtitle={product?.nom ? product.nom.slice(0, 50) : undefined}
                showHandle={false}
                density="compact"
                backIcon="back"
            />

            <ScrollView style={styles.scrollView}>
                {/* Message d'arrivée via partage */}
                <View style={styles.welcomeBanner}>
                    <SafeIcon name="share-2" size={20} color={modernColors.primary} />
                    <Text style={styles.welcomeText}>
                        Produit partagé avec vous! 🎉
                    </Text>
                </View>

                {/* ProductCard */}
                <View style={styles.productCardWrapper}>
                    <ProductCard
                        product={product}
                        service={service}
                        prestataire={prestataire}
                        onPress={() => {
                            // Navigation vers résultats complets
                            navigation.navigate('ResultatBesoin' as never, {
                                results: [{ service_id: serviceId, data: product }],
                                productId,
                                highlightProduct: true
                            });
                        }}
                        onChatPress={() => {
                            navigation.navigate('ResultatBesoin' as never, {
                                results: [{ service_id: serviceId, data: product }],
                                productId,
                                openChat: true
                            });
                        }}
                        onBookSeat={() => {
                            navigation.navigate('ResultatBesoin' as never, {
                                results: [{ service_id: serviceId, data: product }],
                                productId,
                                openSeatSelector: true
                            });
                        }}
                    />
                </View>

                {/* Boutons d'action */}
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="🎬 Créer une vidéo immersive"
                        onPress={() => {
                            console.log('[ProductDetailScreen] 🎬 Navigation vers VideoCreationIntro');
                            try {
                                const parentNavigation = (navigation as any).getParent();
                                const params = {
                                    serviceId,
                                    productId,
                                    productIndex: product?._productIndex ?? 0,
                                    productName: product?.nom || product?.name || product?.title,
                                };
                                if (parentNavigation) {
                                    parentNavigation.navigate('VideoCreationIntro', params);
                                    console.log('[ProductDetailScreen] ✅ Navigation réussie via parent');
                                } else {
                                    navigation.navigate('VideoCreationIntro' as never, params as never);
                                    console.log('[ProductDetailScreen] ✅ Navigation réussie (directe)');
                                }
                            } catch (error) {
                                console.error('[ProductDetailScreen] ❌ Erreur navigation vers VideoCreationIntro:', error);
                                Alert.alert('Erreur', 'Impossible d\'ouvrir la création de vidéo.');
                            }
                        }}
                        variant="primary"
                        size="large"
                    />

                    <NativeButton
                        title="🔍 Voir tous les produits similaires"
                        onPress={() => {
                            navigation.navigate('ResultatBesoin' as never, {
                                results: [{ service_id: serviceId }],
                                type: product.type,
                                categoryFilter: product.type
                            });
                        }}
                        variant="outline"
                        size="large"
                    />

                    <NativeButton
                        title={getSmartButtonLabel()}
                        onPress={() => {
                            console.log('[ProductDetailScreen] Navigation vers ServiceDetailShared, serviceId:', serviceId);
                            navigation.navigate('ServiceDetailShared' as never, {
                                id: serviceId,
                                serviceId: serviceId,
                            });
                        }}
                        variant="outline"
                        size="large"
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
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
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: '#F9FAFB',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 16,
    },
    errorText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        marginBottom: 24,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    welcomeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        margin: 16,
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    welcomeText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        flex: 1,
    },
    productCardWrapper: {
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    actionsContainer: {
        padding: 16,
        gap: 12,
    },
});

export default ProductDetailScreen;

