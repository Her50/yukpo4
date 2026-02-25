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
    AppState,
    AppStateStatus,
    DeviceEventEmitter,
    Platform,
    ScrollView,
    StatusBar,
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
import { API_ENDPOINTS } from '../config/api.config';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet } from '../services/api';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { hapticError } from '../utils/hapticFeedback';

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
        // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour fluidité
        // hapticPress();
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
        // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour navigation fluide
        // hapticPress();
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
    // ✅ NOUVEAU: Nombre de notifications non lues
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    // ✅ NOUVEAU: Nombre de messages chat non lus
    const [unreadChatCount, setUnreadChatCount] = useState(0);


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

    // ✅ NOUVEAU: Charger le nombre de notifications non lues
    const loadUnreadNotificationsCount = useCallback(async () => {
        if (!user?.id) {
            setUnreadNotificationsCount(0);
            return;
        }

        try {
            const response = await apiGet(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT(String(user.id)));
            // ✅ CORRIGÉ: Le backend retourne { success: true, count: number }
            const count = (response.data as any)?.count ?? 0;
            setUnreadNotificationsCount(typeof count === 'number' ? count : 0);
            console.log('[HomeScreen] 📬 Notifications non lues:', count);
        } catch (error) {
            console.error('[HomeScreen] Erreur chargement notifications non lues:', error);
            setUnreadNotificationsCount(0);
        }
    }, [user?.id]);

    // ✅ NOUVEAU: Charger le nombre de messages chat non lus
    const loadUnreadChatCount = useCallback(async () => {
        if (!user?.id) {
            setUnreadChatCount(0);
            return;
        }

        try {
            const response = await apiGet('/api/chat/conversations');
            if (response.success && Array.isArray(response.data)) {
                const totalUnread = (response.data as any[]).reduce(
                    (total: number, conv: any) => total + (conv.unread_count || conv.unreadCount || 0),
                    0
                );
                setUnreadChatCount(totalUnread);
                console.log('[HomeScreen] 💬 Messages chat non lus:', totalUnread);
            } else {
                setUnreadChatCount(0);
            }
        } catch (error) {
            console.error('[HomeScreen] Erreur chargement chat non lus:', error);
            setUnreadChatCount(0);
        }
    }, [user?.id]);

    // ✅ NOUVEAU: Charger le nombre au démarrage et quand l'utilisateur change
    React.useEffect(() => {
        loadUnreadNotificationsCount();
        loadUnreadChatCount();
    }, [loadUnreadNotificationsCount, loadUnreadChatCount]);

    // ✅ NOUVEAU: Recharger le nombre quand l'écran est focus (utilisateur revient sur l'écran)
    useFocusEffect(
        useCallback(() => {
            loadUnreadNotificationsCount();
            loadUnreadChatCount();
        }, [loadUnreadNotificationsCount, loadUnreadChatCount])
    );

    // ✅ NOUVEAU: Recharger le nombre quand l'app revient au premier plan (notification reçue en arrière-plan)
    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // L'app revient au premier plan, recharger le nombre de notifications et chat
                loadUnreadNotificationsCount();
                loadUnreadChatCount();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [loadUnreadNotificationsCount, loadUnreadChatCount]);

    // ✅ NOUVEAU: Écouter les événements de notifications reçues pour mettre à jour le badge en temps réel
    React.useEffect(() => {
        const listener = DeviceEventEmitter.addListener('notification:received', () => {
            // Recharger le nombre de notifications non lues quand une notification est reçue
            console.log('[HomeScreen] 📬 Notification reçue, mise à jour du badge...');
            loadUnreadNotificationsCount();
            loadUnreadChatCount();
        });

        return () => {
            listener.remove();
        };
    }, [loadUnreadNotificationsCount, loadUnreadChatCount]);

    // ✅ NOUVEAU: Recharger quand le modal de notifications se ferme (notifications lues)
    const handleNotificationModalClose = useCallback(() => {
        setShowNotificationModal(false);
        // Recharger le nombre après un court délai pour laisser le temps au backend de mettre à jour
        setTimeout(() => {
            loadUnreadNotificationsCount();
        }, 500);
    }, [loadUnreadNotificationsCount]);

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
                // ✅ AMÉLIORÉ: Messages d'erreur plus clairs selon le type d'erreur
                let errorTitle = 'Erreur de recherche';
                let errorMessage = result.message || 'Une erreur est survenue lors de la recherche';

                if (result.error === 'TIMEOUT') {
                    errorTitle = 'Recherche trop longue';
                    errorMessage = 'La recherche a pris trop de temps. Cela peut être dû à une connexion internet lente ou à un serveur occupé. Veuillez réessayer.';
                } else if (result.error === 'NETWORK_ERROR') {
                    errorTitle = 'Problème de connexion';
                    errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.';
                } else if (result.error === 'AUTH_REQUIRED') {
                    errorTitle = 'Authentification requise';
                    errorMessage = 'Vous devez être connecté pour effectuer une recherche. Veuillez vous reconnecter.';
                } else if (result.error?.startsWith('HTTP_')) {
                    const statusCode = result.error.replace('HTTP_', '');
                    if (statusCode === '502') {
                        errorTitle = 'Serveur en démarrage';
                        errorMessage = 'Le serveur est en cours de démarrage (Bad Gateway). Cela peut prendre quelques secondes. Veuillez réessayer.';
                    } else if (statusCode === '503') {
                        errorTitle = 'Service indisponible';
                        errorMessage = 'Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.';
                    } else if (statusCode === '504') {
                        errorTitle = 'Timeout serveur';
                        errorMessage = 'Le serveur a pris trop de temps à répondre. Veuillez réessayer.';
                    } else if (statusCode === '500') {
                        errorTitle = 'Erreur serveur';
                        errorMessage = 'Une erreur interne du serveur s\'est produite. Veuillez réessayer.';
                    } else if (statusCode === '500' || statusCode === '503' || statusCode === '504') {
                        errorTitle = 'Serveur indisponible';
                        errorMessage = 'Le serveur est temporairement indisponible. Veuillez réessayer dans quelques instants.';
                    }
                }

                console.error('[HomeScreen] Erreur recherche:', {
                    error: result.error,
                    message: result.message,
                    title: errorTitle
                });

                Alert.alert(errorTitle, errorMessage);
                setLoading(false);
                return;
            }

            // ✅ AMÉLIORÉ: Extraction et normalisation robuste des résultats
            let results: any[] = [];

            try {
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
                    } else {
                        // ✅ NOUVEAU: Vérifier si result.resultats est directement un objet avec des résultats
                        console.warn('[HomeScreen] Format de résultats inattendu, tentative d\'extraction:', result.resultats);
                    }
                } else if (result.data) {
                    // ✅ NOUVEAU: Vérifier result.data si result.resultats n'existe pas
                    if (Array.isArray(result.data.resultats)) {
                        results = result.data.resultats;
                    } else if (Array.isArray(result.data)) {
                        results = result.data;
                    }
                }

                // ✅ AMÉLIORÉ: Filtrer les résultats invalides
                results = results.filter((r: any) => {
                    if (!r || typeof r !== 'object') {
                        console.warn('[HomeScreen] Résultat invalide filtré:', r);
                        return false;
                    }
                    // Vérifier qu'il y a au moins un service_id ou un id
                    if (!r.service_id && !r.id) {
                        console.warn('[HomeScreen] Résultat sans service_id/id filtré:', r);
                        return false;
                    }
                    return true;
                });

                console.log('[HomeScreen] ✅ Résultats normalisés:', results.length, 'résultats valides');

                if (results.length > 0) {
                    // Navigation vers les résultats
                    // ResultatBesoinScreen gère déjà la normalisation, donc on peut passer directement
                    navigate('ResultatBesoin', {
                        results: results, // Array de résultats validés
                        type: 'recherche_besoin',
                        searchQuery: input.texte || input.text || input.description || '',
                        hasError: false,
                    });
                } else {
                    Alert.alert('Aucun résultat', 'Aucun service trouvé pour votre recherche');
                }
            } catch (extractError: any) {
                console.error('[HomeScreen] ÔØî Erreur lors de l\'extraction des résultats:', extractError);
                console.error('[HomeScreen] Structure reçue:', JSON.stringify(result, null, 2));
                Alert.alert(
                    'Erreur',
                    'Erreur lors du traitement des résultats de recherche. Veuillez réessayer.'
                );
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);
            setLoading(false);

            // ✅ AMÉLIORÉ: Messages d'erreur plus clairs selon le type d'erreur
            let errorTitle = 'Erreur de recherche';
            let errorMessage = error?.message || 'Une erreur est survenue lors de la recherche';

            if (error?.name === 'AbortError' || error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
                errorTitle = 'Recherche trop longue';
                errorMessage = 'La recherche a pris trop de temps. Vérifiez votre connexion internet et réessayez.';
            } else if (error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
                errorTitle = 'Problème de connexion';
                errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.';
            } else if (error?.message?.includes('Token') || error?.message?.includes('authentification')) {
                errorTitle = 'Authentification requise';
                errorMessage = 'Vous devez être connecté pour effectuer une recherche. Veuillez vous reconnecter.';
            }

            hapticError(); // ✅ Haptic feedback pour erreur critique
            Alert.alert(errorTitle, errorMessage);
        }
    }, [user, navigate]);

    // Handler création service
    const handleCreateService = useCallback(async (input: any) => {
        try {
            if (!user) {
                hapticError(); // ✅ Haptic feedback pour erreur critique
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
                    // ✅ CORRECTION : Passer toute la réponse complète pour préserver service_data
                    // La structure attendue : result.data contient { data: {...}, service_data: { data: {...}, base64_image: [...] } }
                    // On passe result.data tel quel pour que AjouterProduitSimpleScreen puisse extraire depuis service_data.data
                    console.log('[HomeScreen] Structure complète de result.data:', JSON.stringify(result.data, null, 2));
                    console.log('[HomeScreen] service_data présent?', !!result.data.service_data);
                    console.log('[HomeScreen] service_data.data présent?', !!result.data.service_data?.data);

                    navigate('AjouterProduitSimple', {
                        serviceId: foundServiceId,
                        mode: 'create',
                        suggestionIA: result.data, // ✅ Passer result.data tel quel pour préserver service_data
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
                    // Si les suggestions échouent, naviguer quand mème vers AjouterProduitSimple
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
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue lors de la création');
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
        // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour fluidité
        // hapticPress();
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
            console.log('[HomeScreen] öä Écran focus - Remise en mode recherche automatique');
            setIsCreateService(false);
        }, [])
    );


    // ✅ NOUVEAU: Calculer le paddingTop du header pour tenir compte du safe area
    const getStatusBarHeight = () => {
        if (Platform.OS === 'android') {
            return StatusBar.currentHeight || 24;
        }
        // iOS - valeurs approximatives selon le modèle
        return 44;
    };

    const statusBarHeight = getStatusBarHeight();
    const headerPaddingTop = statusBarHeight + 4; // 4px de marge supplémentaire
    const headerTotalHeight = headerPaddingTop + 56; // paddingTop + minHeight du header

    return (
        <SafeNativeView style={styles.container}>
            {/* Header fixe avec avatar, langue, trophée et branding Yukpo */}
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
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
                            // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour navigation fluide
                            // hapticPress();
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
                        style={[styles.headerButton, styles.notificationButton]}
                        onPress={() => {
                            // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour fluidité
                            // hapticPress();
                            setShowChatModal(true);
                        }}
                    >
                        <Text style={styles.headerButtonIcon}>💬</Text>
                        {/* ✅ NOUVEAU: Badge rouge avec le nombre de messages chat non lus */}
                        {unreadChatCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {unreadChatCount > 99 ? '99+' : String(unreadChatCount)}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerButton, styles.notificationButton]}
                        onPress={() => {
                            // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour fluidité
                            // hapticPress();
                            setShowNotificationModal(true);
                        }}
                    >
                        <Text style={styles.headerButtonIcon}>🔔</Text>
                        {/* ✅ NOUVEAU: Badge rouge avec le nombre de notifications non lues */}
                        {unreadNotificationsCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {unreadNotificationsCount > 99 ? '99+' : String(unreadNotificationsCount)}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                // ✅ CRITIQUE: S'assurer que le ScrollView respecte le paddingTop du SafeNativeView
                contentInsetAdjustmentBehavior="automatic"
            >
                {/* ✅ AJOUTÉ: Espace pour compenser la hauteur de l'en-tète fixe */}
                <View style={{ height: headerTotalHeight }} />

                {/* Sélecteur de mode */}
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            !isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour fluidité
                            // hapticPress();
                            setIsCreateService(false);
                        }}
                    >
                        <Text
                            style={[
                                styles.modeButtonText,
                                !isCreateService && styles.modeButtonTextActive
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit={false} // ✅ DÉSACTIVÉ: Pour éviter le rétrécissement du texte
                        >
                            🔍 Rechercher
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour fluidité
                            // hapticPress();
                            setIsCreateService(true);
                        }}
                    >
                        <Text
                            style={[
                                styles.modeButtonText,
                                isCreateService && styles.modeButtonTextActive
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit={false} // ✅ DÉSACTIVÉ: Pour éviter le rétrécissement du texte
                        >
                            Créer produit
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
                            showAutocomplete={false} // ✅ DÉSACTIVÉ: Autocomplete désactivée pour améliorer les performances
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
                                // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour navigation fluide
                                // hapticPress();
                                console.log('[HomeScreen] Service pressé:', serviceId);
                                // ✅ CORRIGÉ: Mapping complet des services spécialisés vers leurs écrans spécifiques
                                // ÔÜá´©Å IMPORTANT: Uniquement écrans UTILISATEURS (Home/Search/List/Details)
                                // ÔØî JAMAIS d'écrans PARTENAIRES (Form/Create/Manage) depuis HomeScreen
                                const searchRoutes: Record<string, string> = {
                                    // Services Santé - Navigation directe vers chaque écran spécifique (UTILISATEURS)
                                    'pharmacie': 'PharmacieSearch',        // ✅ Utilisateur: PharmacieHomeScreen
                                    'hopital': 'HopitalSearch',            // ✅ Utilisateur: HopitalHomeScreen
                                    'laboratoire': 'LaboratoireSearch',    // ✅ Utilisateur: LaboratoireHomeScreen
                                    'banque_sang': 'BanqueSangSearch',     // ✅ Utilisateur: BanqueSangSearchScreen
                                    // Services Transport - Navigation directe vers chaque écran spécifique (UTILISATEURS)
                                    'agence_voyage': 'BusTicketSearch',    // ✅ Utilisateur: TicketVoyageHomeScreen
                                    'covoiturage': 'CovoiturageSearch',    // ✅ Utilisateur: CovoiturageHomeScreen
                                    'taxi': 'TaxiSearch',                  // ✅ Utilisateur: TaxiHomeScreen
                                    // Services Éducation (UTILISATEURS)
                                    'orientation_scolaire': 'OrientationScolaireHub', // ✅ Utilisateur: OrientationScolaireHomeScreen
                                    'bourse_livre': 'LivreScolaireSearch',           // ✅ Utilisateur: LivreScolaireHomeScreen
                                    // Services Emploi (UTILISATEURS)
                                    'offres_emploi': 'OffresEmploiHub',    // ✅ Utilisateur: OffresEmploiHomeScreen
                                    // Services Vie quotidienne (UTILISATEURS)
                                    'menu_planning': 'MenuPlanningHub',    // ✅ Utilisateur: MenuPlanningHubScreen
                                    'bayamselam': 'BayamSelamSearch',      // ✅ Utilisateur: SupermarketHomeScreen
                                    // Services Immobilier (UTILISATEURS) - ✅ Routes séparées pour hôtel/meublé
                                    'immo': 'ImmobilierSearch',           // ✅ Utilisateur: ImmobilierHomeScreen
                                    'hotel': 'HotelSearch',              // ✅ Utilisateur: ImmobilierHomeScreen (filtré pour hôtels)
                                    'meuble': 'MeubleSearch',            // ✅ Utilisateur: ImmobilierHomeScreen (filtré pour meublés)
                                };
                                const route = searchRoutes[serviceId] || 'Home';
                                console.log('[HomeScreen] Navigation vers:', route, 'pour service:', serviceId);

                                // ✅ NOUVEAU: Passer des paramètres de filtre pour hôtel/meublé
                                const routeParams: any = {};
                                if (serviceId === 'hotel') {
                                    routeParams.initialFilter = { type_bien: 'hotel' };
                                } else if (serviceId === 'meuble') {
                                    routeParams.initialFilter = { type_bien: 'meuble' };
                                }

                                const success = navigate(route, routeParams);
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
                    onClose={handleNotificationModalClose}
                    onChange={loadUnreadNotificationsCount} // ✅ NOUVEAU: Recharger le nombre quand les notifications changent
                />
            )}

            {/* Modal Chat */}
            {showChatModal && (
                <ChatHistoryModal
                    isOpen={true}
                    onClose={() => {
                        setShowChatModal(false);
                        // ✅ NOUVEAU: Recharger le nombre de messages non lus après fermeture du chat
                        setTimeout(() => { loadUnreadChatCount(); }, 500);
                    }}
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
        backgroundColor: '#FFFFFF', // ✅ CORRIGÉ: Fond blanc pour le corps de l'application
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 8,
        backgroundColor: modernColors.background,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        minHeight: 56, // Hauteur minimale du contenu du header
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
    notificationButton: {
        position: 'relative', // ✅ NOUVEAU: Pour positionner le badge
    },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444', // Rouge vif
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        zIndex: 10,
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    deliveryButton: {
        width: 40, // ✅ CORRIGÉ: Mème taille que les autres boutons
        height: 40, // ✅ CORRIGÉ: Mème taille que les autres boutons
        borderRadius: 20,
        backgroundColor: '#F3F4F6', // ✅ CORRIGÉ: Mème fond que les autres boutons (chat/notification)
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
        marginTop: 8, // ✅ RÉDUIT: De 16 à 8 pour réduire l'espace en haut
        marginBottom: 8, // ✅ RÉDUIT: De 16 à 8 pour réduire l'espace avec ChatInputMobile
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 5, // ✅ AUGMENTÉ: De 4 à 5 pour plus d'espace autour des boutons
        gap: 4, // ✅ AJOUTÉ: Espacement entre les boutons
    },
    modeButton: {
        flex: 1, // ✅ HARMONISÉ: Les deux boutons (Rechercher et Créer produit) ont la mème taille
        paddingVertical: 12, // ✅ AUGMENTÉ: De 10 à 12 pour plus de hauteur
        paddingHorizontal: 10, // ✅ CORRIGÉ 2026-01-14: Padding égal pour centrer le texte
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44, // ✅ AUGMENTÉ: De 40 à 44 pour plus de hauteur
    },
    modeButtonActive: {
        backgroundColor: '#6366F1', // ✅ AMÉLIORÉ: Couleur indigo harmonieuse pour les boutons actifs
    },
    modeButtonText: {
        fontSize: 16, // ✅ AUGMENTÉ: De 14 à 16 pour une meilleure lisibilité
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center', // ✅ AJOUTÉ 2026-01-14: Pour centrer le texte
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    darkBackgroundContainer: {
        backgroundColor: '#FFFFFF', // ✅ CORRIGÉ: Fond blanc pur pour plus de gaieté
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 12, // ✅ RÉDUIT: De 16 à 12 pour compacter davantage
        marginTop: 0, // ✅ CORRIGÉ: Pas de marge en haut (gérée par modeSelector)
        marginBottom: 12, // ✅ RÉDUIT: De 16 à 12 pour remonter les éléments
    },
    inputContainer: {
        marginBottom: 4, // ✅ RÉDUIT: De 8 à 4 pour réduire l'espace avec les promotions
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
        marginTop: 12, // ✅ RÉDUIT: De 16 à 12 pour remonter les éléments
        marginHorizontal: 0, // Pas de marge horizontale car déjà dans le conteneur
        marginBottom: 12, // ✅ RÉDUIT: De 16 à 12 pour équilibrer
    },
    promotionsMainButton: {
        backgroundColor: modernColors.background, // ✅ RÉTABLI: Couleur originale des boutons
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: modernColors.border, // ✅ CORRIGÉ: Mème bordure que les autres boutons (#e2e8f0)
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
        width: 44, // ✅ AUGMENTÉ: De 36 à 44 pour plus de visibilité
        height: 44, // ✅ AUGMENTÉ: De 36 à 44 pour plus de visibilité
        borderRadius: 22, // ✅ AUGMENTÉ: De 18 à 22 pour correspondre à la taille
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    promotionsMainIcon: {
        fontSize: 28, // ✅ AUGMENTÉ: De 20 à 28 pour plus de visibilité
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
        marginTop: 16, // ✅ RÉDUIT: De 24 à 16 pour remonter les éléments
        marginBottom: 12, // ✅ RÉDUIT: De 16 à 12 pour équilibrer
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

