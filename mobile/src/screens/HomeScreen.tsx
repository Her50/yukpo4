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
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ChatHistoryModal from '../components/ChatHistoryModal';
import ChatInputMobile from '../components/ChatInputMobile';
import LanguageSelector from '../components/LanguageSelector';
import ModernGPSModal from '../components/ModernGPSModal';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import UserAvatarMenu from '../components/UserAvatarMenu';
import YukpoServicesQuickAccess from '../components/YukpoServicesQuickAccess';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet } from '../services/api';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { hapticPress } from '../utils/hapticFeedback';

// NOUVEAU: Composant pour menu promotions regroupé
const PromotionsMenu: React.FC<{ navigate: (route: string) => boolean }> = ({ navigate }) => {
    const [expanded, setExpanded] = useState(false);
    const scaleAnim = useRef(new Animated.Value(0)).current;

    const promotions = [
        {
            id: 'flash',
            icon: '⚡',
            title: 'Flash Promo',
            subtitle: 'Promotions limitées',
            route: 'FlashPromosActive',
            color: '#F59E0B'
        },
        {
            id: 'blackfriday',
            icon: '🛍️',
            title: 'Black Friday',
            subtitle: 'Campagne globale',
            route: 'GlobalPromoCatalog',
            color: '#DC2626'
        },
        {
            id: 'live',
            icon: '📺',
            title: 'Lives',
            subtitle: 'Sessions live',
            route: 'VideoFeed',
            color: '#8B5CF6'
        }
    ];

    const toggleMenu = () => {
        hapticPress();
        const toValue = expanded ? 0 : 1;
        Animated.spring(scaleAnim, {
            toValue,
            useNativeDriver: true,
            tension: 50,
            friction: 7
        }).start();
        setExpanded(!expanded);
    };

    const handlePromoPress = (route: string) => {
        hapticPress();
        toggleMenu();
        setTimeout(() => navigate(route), 200);
    };

    return (
        <View style={styles.promotionsContainer}>
            {/* Bouton principal */}
            <TouchableOpacity
                style={styles.promotionsMainButton}
                onPress={toggleMenu}
                activeOpacity={0.8}
            >
                <View style={styles.promotionsMainButtonContent}>
                    <View style={styles.promotionsMainIconContainer}>
                        <Text style={styles.promotionsMainIcon}>🎯</Text>
                    </View>
                    <View style={styles.promotionsMainText}>
                        <Text style={styles.promotionsMainTitle}>Promotions & Lives</Text>
                        <Text style={styles.promotionsMainSubtitle}>3 options disponibles</Text>
                    </View>
                    <Animated.View
                        style={[
                            styles.promotionsChevron,
                            {
                                transform: [{
                                    rotate: scaleAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0deg', '180deg']
                                    })
                                }]
                            }
                        ]}
                    >
                        <SafeIcon name="chevron-down" size={20} color="#666" />
                    </Animated.View>
                </View>
            </TouchableOpacity>

            {/* Menu horizontal des promotions */}
            {expanded && (
                <Animated.View
                    style={[
                        styles.promotionsMenu,
                        {
                            opacity: scaleAnim,
                            transform: [{
                                scaleY: scaleAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.8, 1]
                                })
                            }]
                        }
                    ]}
                >
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.promotionsMenuContent}
                    >
                        {promotions.map((promo) => (
                            <TouchableOpacity
                                key={promo.id}
                                style={styles.promotionMenuItem}
                                onPress={() => handlePromoPress(promo.route)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.promotionMenuIconContainer, { backgroundColor: `${promo.color}15` }]}>
                                    <Text style={styles.promotionMenuIcon}>{promo.icon}</Text>
                                </View>
                                <Text style={styles.promotionMenuTitle} numberOfLines={1}>
                                    {promo.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Animated.View>
            )}
        </View>
    );
};

const HomeScreen: React.FC = () => {
    // Navigation et contextes
    const navigation = ReactNavigation.useNavigation();
    const { user } = useAuth();
    const { language, setLanguage } = useLanguageSafe();

    // États simples
    const [isCreateService, setIsCreateService] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);


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

    // REFONTE: Handler recherche simplifiée utilisant le nouveau service
    const handleSearch = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur', 'Vous devez être connecté pour effectuer une recherche');
                return;
            }

            setLoading(true);
            console.log('[HomeScreen] Recherche avec:', input);

            // Utiliser le nouveau service de recherche
            const result = await rechercherServices(input);
            console.log('[HomeScreen] Résultat reçu:', {
                success: result.success,
                count: result.resultats?.length || 0,
                structure: typeof result.resultats
            });

            // Vérifier si la recherche a réussi
            if (!result.success) {
                Alert.alert('Erreur', result.message || 'Une erreur est survenue lors de la recherche');
                setLoading(false);
                return;
            }

            // Extraire et normaliser les résultats
            let results: any[] = [];

            // Le service retourne déjà un array normalisé dans result.resultats
            if (Array.isArray(result.resultats)) {
                results = result.resultats;
            } else if (result.resultats && typeof result.resultats === 'object') {
                // Si c'est un objet, essayer d'extraire l'array
                if (Array.isArray(result.resultats.resultats)) {
                    results = result.resultats.resultats;
                } else if (Array.isArray(result.resultats.data)) {
                    results = result.resultats.data;
                } else if (Array.isArray(result.resultats.results)) {
                    results = result.resultats.results;
                }
            }

            console.log('[HomeScreen] Résultats normalisés:', results.length, 'résultats');

            if (results.length > 0) {
                // Navigation vers les résultats
                // ResultatBesoinScreen gère déjà la normalisation, donc on peut passer directement
                navigate('ResultatBesoin', {
                    results: results, // Array de résultats
                    type: 'recherche_besoin',
                    searchQuery: input.texte || input.text || input.description || '',
                    hasError: false,
                });
            } else {
                Alert.alert('Aucun résultat', 'Aucun service trouvé pour votre recherche');
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);
            setLoading(false);
            const errorMessage = error?.message || 'Une erreur est survenue lors de la recherche';
            Alert.alert('Erreur', errorMessage);
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

            // NOUVEAU: Vérifier d'abord si l'utilisateur a déjà un service existant
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
                            console.log('[HomeScreen] Service existant trouvé:', foundServiceId);
                        }
                    }
                }
            } catch (serviceError) {
                console.warn('[HomeScreen] Erreur lors de la vérification des services (continuation normale):', serviceError);
                // Continuer normalement si la vérification échoue
            }

            // Si un service existe, générer les suggestions et rediriger vers AjouterProduitSimpleScreen
            if (foundServiceId) {
                console.log('[HomeScreen] Service existant détecté, redirection vers AjouterProduitSimpleScreen');

                const result = await genererSuggestionsService(input);
                console.log('[HomeScreen] Résultat génération suggestions:', JSON.stringify(result, null, 2));

                if (result && result.data) {
                    // ✅ CORRECTION : Prioriser service_data.data qui contient les données complètes avec produits
                    const suggestionData = result.data.service_data?.data || result.data.data || result.data;
                    // ✅ Passer aussi toute la réponse pour avoir accès à service_data.base64_image, etc.
                    const fullSuggestionIA = {
                        ...result.data,
                        data: suggestionData,
                    };

                    navigate('AjouterProduitSimple', {
                        serviceId: foundServiceId,
                        mode: 'create',
                        suggestionIA: fullSuggestionIA,
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
            console.log('[HomeScreen] Aucun service existant, création nouveau service');

            const result = await genererSuggestionsService(input);
            console.log('[HomeScreen] Résultat génération suggestions:', JSON.stringify(result, null, 2));

            // CORRIGÉ: Le formulaire attend 'suggestion' (singulier) et non 'suggestions'
            // Format attendu: { suggestion: { data: {...}, ... }, type: 'creation_service', ... }
            // La réponse de l'API a la structure: { data: { data: {...}, service_data: {...}, ... } }
            if (result && result.data) {
                // ✅ CORRECTION : Prioriser service_data.data qui contient les données complètes avec produits
                // result.data.data contient seulement les champs de base (titre_service, category, etc.)
                // result.data.service_data.data contient les données complètes avec produits (nom_produit, etc.)
                const suggestionData = result.data.service_data?.data || result.data.data || result.data;

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
                // NOUVEAU: Toast de confirmation avant création de service
                Alert.alert(
                    'Confirmation',
                    'Voulez-vous vraiment créer un nouveau service ou produit ?',
                    [
                        {
                            text: 'Annuler',
                            style: 'cancel',
                            onPress: () => {
                                console.log('[HomeScreen] Création de service annulée par l\'utilisateur');
                                // NOUVEAU: Passer automatiquement en mode recherche lors de l'annulation
                                setIsCreateService(false);
                                console.log('[HomeScreen] Mode changé automatiquement en recherche');
                            }
                        },
                        {
                            text: 'Oui, créer',
                            style: 'default',
                            onPress: async () => {
                                console.log('[HomeScreen] Confirmation création de service acceptée');
                                await handleCreateService(input);
                            }
                        }
                    ],
                    { cancelable: true }
                );
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

    // ✅ NOUVEAU: Remettre automatiquement en mode recherche quand on revient sur l'écran
    // Cela garantit que après la création d'un service ou produit, le mode repasse en recherche
    useFocusEffect(
        useCallback(() => {
            console.log('[HomeScreen] 🔄 Écran focus - Remise en mode recherche automatique');
            setIsCreateService(false);
        }, [])
    );


    return (
        <SafeNativeView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header avec avatar, langue, trophée et branding Yukpo */}
                <View style={styles.header}>
                    {/* Colonne gauche: Avatar + Langue + Trophée */}
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarContainer}>
                            <UserAvatarMenu
                                onNavigate={(route) => (navigation as any).navigate(route)}
                                balance={user?.credits || 0}
                                weatherLocation={selectedLocation}
                            />
                        </View>
                        <LanguageSelector
                            selectedLanguage={language}
                            onLanguageChange={setLanguage}
                            compact={true}
                        />
                    </View>

                    {/* Titre centré avec branding Yukpo */}
                    <View style={styles.headerCenter}>
                        <Text style={styles.brandTitle}>
                            <Text style={styles.brandYuk}>Yuk</Text>
                            <Text style={styles.brandPo}>po</Text>
                        </Text>
                    </View>

                    {/* Colonne droite: Livraison + Chat + Notifications */}
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={styles.deliveryButton}
                            onPress={() => {
                                hapticPress();
                                navigate('Delivery');
                            }}
                        >
                            <SafeIcon
                                name="Bike"
                                size={22}
                                color="#6B7280"
                            />
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
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => {
                                hapticPress();
                                setShowNotificationModal(true);
                            }}
                        >
                            <Text style={styles.headerButtonIcon}>🔔</Text>
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

                {/* Conteneur principal pour ChatInputMobile et Services spécialisés */}
                <View style={styles.darkBackgroundContainer}>
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

                    {/* NOUVEAU: Bouton unique pour promotions avec menu horizontal */}
                    <PromotionsMenu navigate={navigate} />

                    {/* Services spécialisés Yukpo - Accès recherche uniquement */}
                    <View style={styles.specializedServicesContainer}>
                        <YukpoServicesQuickAccess
                            onServicePress={(serviceId) => {
                                hapticPress();
                                console.log('[HomeScreen] Service pressé:', serviceId);
                                // ✅ CORRIGÉ: Mapping complet des services spécialisés vers leurs écrans spécifiques
                                const searchRoutes: Record<string, string> = {
                                    // Services Santé - Navigation directe vers chaque écran spécifique
                                    'pharmacie': 'PharmacieSearch',
                                    'hopital': 'HopitalSearch',
                                    'laboratoire': 'LaboratoireSearch',
                                    'banque_sang': 'BanqueSangSearch',
                                    // Services Transport - Navigation directe vers chaque écran spécifique
                                    'agence_voyage': 'AgenceVoyageSearch',
                                    'covoiturage': 'CovoiturageSearch',
                                    'taxi': 'TaxiSearch',
                                    // Services Éducation
                                    'orientation_scolaire': 'EtablissementSearch',
                                    'bourse_livre': 'EtablissementSearch',
                                    // Services Emploi
                                    'offres_emploi': 'OffresEmploiHub',
                                    // Services Vie quotidienne
                                    'menu_planning': 'MenuPlanningHub',
                                    'bayamselam': 'BayamSelamSearch',
                                    // Services Immobilier
                                    'immo': 'ImmobilierSearch',
                                };
                                const route = searchRoutes[serviceId] || 'Home';
                                console.log('[HomeScreen] Navigation vers:', route, 'pour service:', serviceId);
                                const success = navigate(route);
                                if (!success) {
                                    console.error('[HomeScreen] Échec navigation vers:', route);
                                    Alert.alert('Navigation', `L'écran ${route} n'est pas encore disponible.`);
                                }
                            }}
                        />
                    </View>
                </View>

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
        backgroundColor: modernColors.background, // ✅ AMÉLIORÉ: Fond gris clair professionnel harmonisé avec le header
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
        backgroundColor: modernColors.background,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        minHeight: 60,
        // Ombre discrète pour effet premium
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 4,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        flex: 1,
        minWidth: 0,
    },
    avatarContainer: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingLeft: 0,
        paddingRight: 16,
    },
    brandTitle: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    brandYuk: {
        color: '#EAB308', // Jaune (branding Yuk)
    },
    brandPo: {
        color: '#DC2626', // Rouge (branding po)
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        flex: 1,
        minWidth: 0,
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
    deliveryButton: {
        width: 40, // ✅ CORRIGÉ: Même taille que les autres boutons
        height: 40, // ✅ CORRIGÉ: Même taille que les autres boutons
        borderRadius: 20,
        backgroundColor: '#F3F4F6', // ✅ CORRIGÉ: Même fond que les autres boutons (chat/notification)
        justifyContent: 'center',
        alignItems: 'center',
        // ✅ SUPPRIMÉ: borderWidth, borderColor, shadowColor spécifiques
    },
    deliveryButtonIcon: {
        fontSize: 22, // ✅ Taille de l'emoji coursier
    },
    headerButtonIcon: {
        fontSize: 20,
    },
    modeSelector: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8, // ✅ AMÉLIORÉ: Réduit l'écart entre modeSelector et ChatInputMobile
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
        backgroundColor: '#6366F1', // ✅ AMÉLIORÉ: Couleur indigo harmonieuse pour les boutons actifs
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    darkBackgroundContainer: {
        backgroundColor: '#FFFFFF', // ✅ CORRIGÉ: Fond blanc
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 16,
        marginTop: 4, // ✅ AMÉLIORÉ: Réduit l'écart entre modeSelector et ChatInputMobile
        marginBottom: 12,
        // ✅ SUPPRIMÉ: Bordure pour un look plus propre
    },
    inputContainer: {
        marginBottom: 8,
    },
    carouselErrorContainer: {
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 12,
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        alignItems: 'center',
    },
    carouselErrorText: {
        fontSize: 14,
        color: '#92400E',
        textAlign: 'center',
    },
    promotionsContainer: {
        marginTop: 8,
        marginHorizontal: 0, // Pas de marge horizontale car déjà dans le conteneur foncé
    },
    promotionsMainButton: {
        backgroundColor: '#F3F4F6', // ✅ Appliqué: Même couleur que les cartes des services spécialisés
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    promotionsMainButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    promotionsMainIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    promotionsMainIcon: {
        fontSize: 20,
    },
    promotionsMainText: {
        flex: 1,
    },
    promotionsMainTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    promotionsMainSubtitle: {
        fontSize: 11,
        color: '#6B7280',
    },
    promotionsChevron: {
        marginLeft: 'auto',
    },
    promotionsMenu: {
        marginTop: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    promotionsMenuContent: {
        gap: 12,
        paddingHorizontal: 4,
    },
    promotionMenuItem: {
        alignItems: 'center',
        minWidth: 80,
        paddingVertical: 8,
    },
    promotionMenuIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    promotionMenuIcon: {
        fontSize: 28,
    },
    promotionMenuTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
        textAlign: 'center',
    },
    specializedServicesContainer: {
        marginTop: 20, // ✅ AMÉLIORÉ: Écart augmenté entre Promotions et Services spécialisés
        marginBottom: 0, // Réduit car déjà dans le conteneur foncé
    },
    specializedServicesTitle: {
        fontSize: 17, // ✅ AUGMENTÉ: De 15 à 17 pour meilleure visibilité
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12, // ✅ AUGMENTÉ: De 8 à 12 pour plus d'espace
        marginTop: 4, // ✅ AJOUTÉ: Marge en haut pour séparation
    },
});

export default HomeScreen;

