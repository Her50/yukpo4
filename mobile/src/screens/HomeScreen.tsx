/**
 * HomeScreen - VERSION DE BASE SIMPLIFIÉE
 * 
 * Composants essentiels:
 * - ChatInputMobile (recherche et création)
 * - Mode recherche/création
 * - Bouton d'envoi
 * - Modaux (GPS, notifications, chat)
 */

import * as ReactNavigation from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ChatHistoryModal from '../components/ChatHistoryModal';
import ChatInputMobile from '../components/ChatInputMobile';
import ModernGPSModal from '../components/ModernGPSModal';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { hapticPress } from '../utils/hapticFeedback';
import { navigateToVideoWizard } from '../utils/videoNavigation';

const HomeScreen: React.FC = () => {
    // Navigation et contextes
    const navigation = ReactNavigation.useNavigation();
    const { user } = useAuth();

    // États simples
    const [isCreateService, setIsCreateService] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

    // ✅ NOUVEAU: États pour la section "Mes services"
    const [userServices, setUserServices] = useState<any[]>([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [hasServices, setHasServices] = useState(false);

    // Navigation simplifiée
    const navigate = useCallback((routeName: string, params?: any) => {
        try {
            if (!navigation || typeof (navigation as any).navigate !== 'function') {
                console.error('[HomeScreen] Navigation non disponible');
                return false;
            }
            (navigation as any).navigate(routeName, params);
            return true;
        } catch (error) {
            console.error('[HomeScreen] Erreur navigation:', error);
            return false;
        }
    }, [navigation]);

    // Handler recherche
    const handleSearch = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur', 'Vous devez être connecté pour effectuer une recherche');
                return;
            }

            setLoading(true);
            console.log('[HomeScreen] Recherche avec:', input);

            const result = await rechercherServices(input);
            const results = result?.data || result?.resultats?.resultats || result?.resultats || [];

            if (Array.isArray(results) && results.length > 0) {
                navigate('ResultatBesoin', {
                    results: results,
                    type: 'recherche_besoin',
                    searchQuery: input.texte || input.text || '',
                    hasError: false,
                });
            } else {
                Alert.alert('Aucun résultat', 'Aucun service trouvé pour votre recherche');
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);
            setLoading(false);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la recherche');
        }
    }, [user, navigate]);

    // Handler création service
    const handleCreateService = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur', 'Vous devez être connecté pour créer un service');
                return;
            }

            setLoading(true);

            // ✅ NOUVEAU: Vérifier d'abord si l'utilisateur a déjà un service existant
            // Si oui, rediriger vers AjouterProduitSimpleScreen au lieu de FormulaireYukpoIntelligentScreen
            let foundServiceId: number | undefined;

            try {
                console.log('[HomeScreen] Vérification des services existants...');
                const servicesResponse = await apiGet('/api/prestataire/services');

                if (servicesResponse?.success && servicesResponse?.data) {
                    const responseData = servicesResponse.data as any;
                    const servicesData = Array.isArray(responseData)
                        ? responseData
                        : (responseData?.data || responseData?.services || []);

                    if (servicesData.length > 0) {
                        // Trouver le premier service actif ou le premier service
                        const activeService = servicesData.find((s: any) => s.is_active !== false && s.actif !== false) || servicesData[0];

                        if (activeService && activeService.id) {
                            foundServiceId = typeof activeService.id === 'string'
                                ? parseInt(activeService.id, 10)
                                : activeService.id;
                            console.log('[HomeScreen] ✅ Service existant trouvé:', foundServiceId);
                        }
                    }
                }
            } catch (serviceError) {
                console.warn('[HomeScreen] ⚠️ Erreur lors de la vérification des services (continuation normale):', serviceError);
                // Continuer normalement si la vérification échoue
            }

            // Si un service existe, générer les suggestions et rediriger vers AjouterProduitSimpleScreen
            if (foundServiceId) {
                console.log('[HomeScreen] 🎯 Service existant détecté, redirection vers AjouterProduitSimpleScreen');

                const result = await genererSuggestionsService(input);
                console.log('[HomeScreen] Résultat génération suggestions:', JSON.stringify(result, null, 2));

                if (result && result.data) {
                    const suggestionData = result.data.data || result.data.service_data?.data || result.data;

                    navigate('AjouterProduitSimple', {
                        serviceId: foundServiceId,
                        mode: 'create',
                        suggestionIA: {
                            data: suggestionData,
                            session_id: result.data.session_id,
                        },
                        mediaData: {
                            base64_image: input.base64_image || [],
                            video_base64: input.video_base64 || [],
                            audio_base64: input.audio_base64 || [],
                            doc_base64: input.doc_base64 || [],
                        },
                        gpsData: {
                            gps_mobile: input.gps_mobile,
                            gps_fixe: input.gps_fixe,
                        },
                    });
                } else {
                    // Si les suggestions échouent, naviguer quand même vers AjouterProduitSimple
                    navigate('AjouterProduitSimple', {
                        serviceId: foundServiceId,
                        mode: 'create',
                    });
                }

                setLoading(false);
                return;
            }

            // Aucun service existant, générer les suggestions et naviguer vers FormulaireYukpoIntelligentScreen
            console.log('[HomeScreen] 🆕 Aucun service existant, création nouveau service');

            const result = await genererSuggestionsService(input);
            console.log('[HomeScreen] Résultat génération suggestions:', JSON.stringify(result, null, 2));

            // ✅ CORRIGÉ: Le formulaire attend 'suggestion' (singulier) et non 'suggestions'
            // Format attendu: { suggestion: { data: {...}, ... }, type: 'creation_service', ... }
            // La réponse de l'API a la structure: { data: { data: {...}, service_data: {...}, ... } }
            if (result && result.data) {
                // Extraire les données de suggestion depuis la réponse
                const suggestionData = result.data.data || result.data.service_data?.data || result.data;

                console.log('[HomeScreen] Données suggestion extraites:', JSON.stringify(suggestionData, null, 2));

                navigate('FormulaireYukpoIntelligent', {
                    suggestion: {
                        data: suggestionData,
                        intention: result.data.intention || 'creation_service',
                        confidence: result.data.confidence || 1.0,
                        tokens_consumed: result.data.tokens_consumed || 0,
                        session_id: result.data.session_id,
                    },
                    type: 'creation_service',
                    mode: 'create',
                    initialInput: input,
                });
            } else {
                console.error('[HomeScreen] Données invalides reçues:', result);
                Alert.alert('Erreur', 'Impossible de générer les suggestions. Veuillez réessayer.');
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur création service:', error);
            setLoading(false);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la création');
        }
    }, [user, navigate]);

    // Handler soumission
    const handleSubmit = useCallback(async (input: any) => {
        try {
            if (isCreateService) {
                await handleCreateService(input);
            } else {
                await handleSearch(input);
            }
        } catch (error) {
            console.error('[HomeScreen] Erreur handleSubmit:', error);
        }
    }, [isCreateService, handleSearch, handleCreateService]);

    // Handler GPS
    const handleGPSPress = useCallback(() => {
        hapticPress();
        setShowGPSModal(true);
    }, []);

    const handleGPSSelect = useCallback((coordinatesString: string) => {
        try {
            const firstPoint = coordinatesString.split('|')[0].split(',');
            if (firstPoint.length === 2) {
                const lat = parseFloat(firstPoint[0]);
                const lng = parseFloat(firstPoint[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    setSelectedLocation({ lat, lng });
                    console.log('[HomeScreen] Localisation GPS définie:', { lat, lng });
                }
            }
        } catch (error) {
            console.error('[HomeScreen] Erreur parsing GPS:', error);
        }
        setShowGPSModal(false);
    }, []);

    // ✅ NOUVEAU: Charger les services de l'utilisateur
    const loadUserServices = useCallback(async () => {
        if (!user) {
            setHasServices(false);
            setUserServices([]);
            return;
        }

        try {
            setLoadingServices(true);
            console.log('[HomeScreen] 🔍 Chargement des services utilisateur...');

            const response = await apiGet('/api/prestataire/services');

            if (response?.success && response?.data) {
                const responseData = response.data as any;
                const servicesData = Array.isArray(responseData)
                    ? responseData
                    : (responseData?.data || responseData?.services || []);

                // Filtrer les services actifs avec produits
                const activeServicesWithProducts = servicesData.filter((service: any) => {
                    const isActive = service.is_active !== false && service.actif !== false;
                    const hasProducts = !!(
                        service.data?.produits ||
                        service.produits ||
                        service.data?.listeproduit
                    );
                    return isActive && hasProducts;
                });

                console.log('[HomeScreen] ✅ Services chargés:', {
                    total: servicesData.length,
                    actifsAvecProduits: activeServicesWithProducts.length
                });

                if (activeServicesWithProducts.length > 0) {
                    setUserServices(activeServicesWithProducts);
                    setHasServices(true);
                } else {
                    setUserServices([]);
                    setHasServices(false);
                }
            } else {
                setUserServices([]);
                setHasServices(false);
            }
        } catch (error) {
            console.warn('[HomeScreen] ⚠️ Erreur chargement services:', error);
            setUserServices([]);
            setHasServices(false);
        } finally {
            setLoadingServices(false);
        }
    }, [user]);

    // ✅ NOUVEAU: Charger les services au montage et quand l'utilisateur change
    React.useEffect(() => {
        loadUserServices();
    }, [loadUserServices]);

    // ✅ NOUVEAU: Handler pour le bouton d'ajout de vidéo
    const handleAddVideo = useCallback(() => {
        if (!hasServices || userServices.length === 0) {
            Alert.alert(
                'Aucun service',
                'Vous devez avoir au moins un service avec des produits pour créer une vidéo.',
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Créer un service',
                        onPress: () => {
                            setIsCreateService(true);
                        }
                    }
                ]
            );
            return;
        }

        // Si un seul service, naviguer directement
        if (userServices.length === 1) {
            const service = userServices[0];
            const serviceId = service.id || service.service_id;

            // Extraire le premier produit
            const produits = service.data?.produits || service.produits || [];
            const produitsArray = Array.isArray(produits) ? produits :
                (produits.valeur ? (Array.isArray(produits.valeur) ? produits.valeur : []) : []);

            if (produitsArray.length > 0) {
                const firstProduct = produitsArray[0];
                const productIndex = firstProduct.product_index || firstProduct.index || 0;

                navigateToVideoWizard(navigation, {
                    serviceId: typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId,
                    productIndex: productIndex,
                    productName: firstProduct.nom || firstProduct.nom_produit || 'Produit'
                });
            } else {
                Alert.alert('Aucun produit', 'Ce service n\'a pas encore de produits.');
            }
        } else {
            // Plusieurs services → Naviguer vers VideoCreationIntro pour choisir
            navigate('VideoCreationIntro', {});
        }
    }, [hasServices, userServices, navigation]);

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header simple */}
                <View style={styles.header}>
                    <Text style={styles.title}>Yukpomnang</Text>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity
                            style={[styles.headerButton, { marginRight: 12 }]}
                            onPress={() => {
                                hapticPress();
                                setShowNotificationModal(true);
                            }}
                        >
                            <Text style={styles.headerButtonIcon}>🔔</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => {
                                hapticPress();
                                setShowChatModal(true);
                            }}
                        >
                            <Text style={styles.headerButtonIcon}>💬</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Sélecteur de mode */}
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            !isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            hapticPress();
                            setIsCreateService(false);
                        }}
                    >
                        <Text style={[
                            styles.modeButtonText,
                            !isCreateService && styles.modeButtonTextActive
                        ]}>
                            🔍 Rechercher
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            hapticPress();
                            setIsCreateService(true);
                        }}
                    >
                        <Text style={[
                            styles.modeButtonText,
                            isCreateService && styles.modeButtonTextActive
                        ]}>
                            ➕ Créer un service
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ChatInputMobile */}
                <View style={styles.inputContainer}>
                    <ChatInputMobile
                        onSubmit={handleSubmit}
                        loading={loading}
                        placeholder={
                            isCreateService
                                ? 'Décrivez le service que vous voulez créer...'
                                : 'Décrivez votre besoin...'
                        }
                        onGPSPress={handleGPSPress}
                        showSendButton={true}
                        showAutocomplete={!isCreateService}
                        isSearchMode={!isCreateService}
                        isCreateService={isCreateService}
                    />
                </View>

                {/* Zone de contenu vide pour l'instant */}
                <View style={styles.contentArea}>
                    <Text style={styles.contentText}>
                        {isCreateService
                            ? 'Créez votre service en remplissant le formulaire ci-dessus'
                            : 'Recherchez des services en remplissant le formulaire ci-dessus'}
                    </Text>
                </View>

                {/* ✅ NOUVEAU: Section "Mes services" en bas (affichée seulement si l'utilisateur a des services) */}
                {hasServices && userServices.length > 0 && (
                    <View style={styles.servicesSection}>
                        <View style={styles.servicesHeader}>
                            <Text style={styles.servicesTitle}>Mes services</Text>
                            <TouchableOpacity
                                style={styles.addVideoButton}
                                onPress={() => {
                                    hapticPress();
                                    handleAddVideo();
                                }}
                            >
                                <Text style={styles.addVideoButtonText}>➕ Vidéo</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingServices ? (
                            <View style={styles.servicesLoading}>
                                <Text style={styles.servicesLoadingText}>Chargement...</Text>
                            </View>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.servicesList}
                                contentContainerStyle={styles.servicesListContent}
                            >
                                {userServices.slice(0, 5).map((service: any, index: number) => {
                                    const serviceId = service.id || service.service_id;
                                    const titre = service.data?.titre_service?.valeur ||
                                        service.data?.titre?.valeur ||
                                        service.titre ||
                                        `Service #${serviceId}`;

                                    return (
                                        <TouchableOpacity
                                            key={serviceId || index}
                                            style={styles.serviceCard}
                                            onPress={() => {
                                                hapticPress();
                                                navigate('MesServices', {});
                                            }}
                                        >
                                            <Text style={styles.serviceCardTitle} numberOfLines={1}>
                                                {titre}
                                            </Text>
                                            <Text style={styles.serviceCardSubtitle}>
                                                {service.data?.produits?.valeur?.length ||
                                                    service.produits?.length ||
                                                    0} produit(s)
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Modal GPS */}
            {showGPSModal && (
                <ModernGPSModal
                    visible={true}
                    onClose={() => setShowGPSModal(false)}
                    onSelect={handleGPSSelect}
                    currentLocation={selectedLocation}
                    title="Sélectionner votre localisation"
                    allowZoneSelection={true}
                />
            )}

            {/* Modal Notifications */}
            {showNotificationModal && (
                <NotificationHistoryModal
                    isOpen={true}
                    onClose={() => setShowNotificationModal(false)}
                    onChange={() => { }}
                />
            )}

            {/* Modal Chat */}
            {showChatModal && (
                <ChatHistoryModal
                    isOpen={true}
                    onClose={() => setShowChatModal(false)}
                    onOpenChat={(chatId: string) => {
                        console.log('Ouvrir chat:', chatId);
                        setShowChatModal(false);
                    }}
                />
            )}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
    },
    headerButtons: {
        flexDirection: 'row',
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerButtonIcon: {
        fontSize: 20,
    },
    modeSelector: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 4,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    inputContainer: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    contentArea: {
        paddingHorizontal: 16,
        paddingVertical: 40,
        alignItems: 'center',
    },
    contentText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    // ✅ NOUVEAU: Styles pour la section "Mes services"
    servicesSection: {
        marginTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    servicesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    servicesTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    addVideoButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addVideoButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    servicesLoading: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    servicesLoadingText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    servicesList: {
        maxHeight: 100,
    },
    servicesListContent: {
        paddingRight: 16,
    },
    serviceCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        minWidth: 140,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    serviceCardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    serviceCardSubtitle: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default HomeScreen;

