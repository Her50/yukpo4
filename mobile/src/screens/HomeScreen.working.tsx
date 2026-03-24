// @ts-nocheck
/**
 * HomeScreen - VERSION DE BASE SIMPLIFI├ëE
 *
 * Composants essentiels:
 * - ChatInputMobile (recherche et cr├®ation)
 * - Mode recherche/cr├®ation
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
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { API_ENDPOINTS } from '../config/api.config';
import { apiGet } from '../services/api';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { hapticError, hapticPress } from '../utils/hapticFeedback';

// NOUVEAU: Composant pour menu promotions regroup├®
const PromotionsMenu: React.FC<{ navigate: (route: string) => boolean }> = ({ navigate }) => {
        const { t } = useLanguageSafe();
const [expanded, setExpanded] = useState(false);
    const scaleAnim = useRef(new Animated.Value(0)).current;

    const promotions = [
        {
            id: 'flash',
            icon: 'ÔÜí',
            title: 'Flash Promo',
            subtitle: 'Promotions limit├®es',
            route: 'FlashPromosActive',
            color: '#F59E0B'
        },
        {
            id: 'blackfriday',
            icon: '­ƒøì´©Å',
            title: 'Black Friday',
            subtitle: 'Campagne globale',
            route: 'GlobalPromoCatalog',
            color: '#DC2626'
        },
        {
            id: 'live',
            icon: '­ƒô║',
            title: 'Lives',
            subtitle: 'Sessions live',
            route: 'VideoFeed',
            color: '#8B5CF6'
        }
    ];

    const toggleMenu = () => {
        // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour fluidit├®
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
        // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour navigation fluide
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
                        <Text style={styles.promotionsMainIcon}>­ƒÄ»</Text>
                    </View>
                    <View style={styles.promotionsMainText}>
                        <Text style={styles.promotionsMainTitle}>{t('homeScreen.working.promotionsLives')}</Text>
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

    // ├ëtats simples
    const [isCreateService, setIsCreateService] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    // Ô£à NOUVEAU: Nombre de notifications non lues
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);


    // Navigation simplifi├®e
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

    // Ô£à NOUVEAU: Charger le nombre de notifications non lues
    const loadUnreadNotificationsCount = useCallback(async () => {
        if (!user?.id) {
            setUnreadNotificationsCount(0);
            return;
        }

        try {
            const response = await apiGet(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT(String(user.id)));
            // Ô£à CORRIG├ë: Le backend retourne { success: true, count: number }
            const count = response.data?.count ?? 0;
            setUnreadNotificationsCount(typeof count === 'number' ? count : 0);
            console.log('[HomeScreen] ­ƒô¼ Notifications non lues:', count);
        } catch (error) {
            console.error('[HomeScreen] Erreur chargement notifications non lues:', error);
            setUnreadNotificationsCount(0);
        }
    }, [user?.id]);

    // Ô£à NOUVEAU: Charger le nombre au d├®marrage et quand l'utilisateur change
    React.useEffect(() => {
        loadUnreadNotificationsCount();
    }, [loadUnreadNotificationsCount]);

    // Ô£à NOUVEAU: Recharger le nombre quand l'├®cran est focus (utilisateur revient sur l'├®cran)
    useFocusEffect(
        useCallback(() => {
            loadUnreadNotificationsCount();
        }, [loadUnreadNotificationsCount])
    );

    // Ô£à NOUVEAU: Recharger le nombre quand l'app revient au premier plan (notification re├ºue en arri├¿re-plan)
    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // L'app revient au premier plan, recharger le nombre de notifications
                loadUnreadNotificationsCount();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [loadUnreadNotificationsCount]);

    // Ô£à NOUVEAU: ├ëcouter les ├®v├®nements de notifications re├ºues pour mettre ├á jour le badge en temps r├®el
    React.useEffect(() => {
        const listener = DeviceEventEmitter.addListener('notification:received', () => {
            // Recharger le nombre de notifications non lues quand une notification est re├ºue
            console.log('[HomeScreen] ­ƒô¼ Notification re├ºue, mise ├á jour du badge...');
            loadUnreadNotificationsCount();
        });

        return () => {
            listener.remove();
        };
    }, [loadUnreadNotificationsCount]);

    // Ô£à NOUVEAU: Recharger quand le modal de notifications se ferme (notifications lues)
    const handleNotificationModalClose = useCallback(() => {
        setShowNotificationModal(false);
        // Recharger le nombre apr├¿s un court d├®lai pour laisser le temps au backend de mettre ├á jour
        setTimeout(() => {
            loadUnreadNotificationsCount();
        }, 500);
    }, [loadUnreadNotificationsCount]);

    // REFONTE: Handler recherche simplifi├®e utilisant le nouveau service
    const handleSearch = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur', 'Vous devez ├¬tre connect├® pour effectuer une recherche');
                return;
            }

            setLoading(true);
            console.log('[HomeScreen] Recherche avec:', input);

            // Utiliser le nouveau service de recherche
            const result = await rechercherServices(input);
            console.log('[HomeScreen] R├®sultat re├ºu:', {
                success: result.success,
                count: result.resultats?.length || 0,
                structure: typeof result.resultats
            });

            // V├®rifier si la recherche a r├®ussi
            if (!result.success) {
                // Ô£à AM├ëLIOR├ë: Messages d'erreur plus clairs selon le type d'erreur
                let errorTitle = 'Erreur de recherche';
                let errorMessage = result.message || t('homeScreen.working.uneErreurEstSurvenueLors');
                
                if (result.error === 'TIMEOUT') {
                    errorTitle = 'Recherche trop longue';
                    errorMessage = 'La recherche a pris trop de temps. Cela peut ├¬tre d├╗ ├á une connexion internet lente ou ├á un serveur occup├®. Veuillez r├®essayer.';
                } else if (result.error === 'NETWORK_ERROR') {
                    errorTitle = 'Probl├¿me de connexion';
                    errorMessage = 'Impossible de se connecter au serveur. V├®rifiez votre connexion internet et r├®essayez.';
                } else if (result.error === 'AUTH_REQUIRED') {
                    errorTitle = 'Authentification requise';
                    errorMessage = 'Vous devez ├¬tre connect├® pour effectuer une recherche. Veuillez vous reconnecter.';
                } else if (result.error?.startsWith('HTTP_')) {
                    const statusCode = result.error.replace('HTTP_', '');
                    if (statusCode === '502') {
                        errorTitle = 'Serveur en d├®marrage';
                        errorMessage = 'Le serveur est en cours de d├®marrage (Bad Gateway). Cela peut prendre quelques secondes. Veuillez r├®essayer.';
                    } else if (statusCode === '503') {
                        errorTitle = 'Service indisponible';
                        errorMessage = 'Le service est temporairement indisponible. Veuillez r├®essayer dans quelques instants.';
                    } else if (statusCode === '504') {
                        errorTitle = 'Timeout serveur';
                        errorMessage = 'Le serveur a pris trop de temps ├á r├®pondre. Veuillez r├®essayer.';
                    } else if (statusCode === '500') {
                        errorTitle = 'Erreur serveur';
                        errorMessage = 'Une erreur interne du serveur s\'est produite. Veuillez r├®essayer.';
                    } else if (statusCode === '500' || statusCode === '503' || statusCode === '504') {
                        errorTitle = 'Serveur indisponible';
                        errorMessage = 'Le serveur est temporairement indisponible. Veuillez r├®essayer dans quelques instants.';
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

            // Ô£à AM├ëLIOR├ë: Extraction et normalisation robuste des r├®sultats
            let results: any[] = [];

            try {
                // Le service retourne d├®j├á un array normalis├® dans result.resultats
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
                        // Ô£à NOUVEAU: V├®rifier si result.resultats est directement un objet avec des r├®sultats
                        console.warn('[HomeScreen] Format de r├®sultats inattendu, tentative d\'extraction:', result.resultats);
                    }
                } else if (result.data) {
                    // Ô£à NOUVEAU: V├®rifier result.data si result.resultats n'existe pas
                    if (Array.isArray(result.data.resultats)) {
                        results = result.data.resultats;
                    } else if (Array.isArray(result.data)) {
                        results = result.data;
                    }
                }

                // Ô£à AM├ëLIOR├ë: Filtrer les r├®sultats invalides
                results = results.filter((r: any) => {
                    if (!r || typeof r !== 'object') {
                        console.warn('[HomeScreen] R├®sultat invalide filtr├®:', r);
                        return false;
                    }
                    // V├®rifier qu'il y a au moins un service_id ou un id
                    if (!r.service_id && !r.id) {
                        console.warn('[HomeScreen] R├®sultat sans service_id/id filtr├®:', r);
                        return false;
                    }
                    return true;
                });

                console.log('[HomeScreen] Ô£à R├®sultats normalis├®s:', results.length, 'r├®sultats valides');

                if (results.length > 0) {
                    // Navigation vers les r├®sultats
                    // ResultatBesoinScreen g├¿re d├®j├á la normalisation, donc on peut passer directement
                    navigate('ResultatBesoin', {
                        results: results, // Array de r├®sultats valid├®s
                        type: 'recherche_besoin',
                        searchQuery: input.texte || input.text || input.description || '',
                        hasError: false,
                    });
                } else {
                    Alert.alert('Aucun r├®sultat', 'Aucun service trouv├® pour votre recherche');
                }
            } catch (extractError: any) {
                console.error('[HomeScreen] ÔØî Erreur lors de l\'extraction des r├®sultats:', extractError);
                console.error('[HomeScreen] Structure re├ºue:', JSON.stringify(result, null, 2));
                Alert.alert(
                    'Erreur',
                    'Erreur lors du traitement des r├®sultats de recherche. Veuillez r├®essayer.'
                );
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);
            setLoading(false);
            
            // Ô£à AM├ëLIOR├ë: Messages d'erreur plus clairs selon le type d'erreur
            let errorTitle = 'Erreur de recherche';
            let errorMessage = error?.message || t('homeScreen.working.uneErreurEstSurvenueLors');
            
            if (error?.name === 'AbortError' || error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
                errorTitle = 'Recherche trop longue';
                errorMessage = 'La recherche a pris trop de temps. V├®rifiez votre connexion internet et r├®essayez.';
            } else if (error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
                errorTitle = 'Probl├¿me de connexion';
                errorMessage = 'Impossible de se connecter au serveur. V├®rifiez votre connexion internet et r├®essayez.';
            } else if (error?.message?.includes('Token') || error?.message?.includes('authentification')) {
                errorTitle = 'Authentification requise';
                errorMessage = 'Vous devez ├¬tre connect├® pour effectuer une recherche. Veuillez vous reconnecter.';
            }
            
            hapticError(); // Ô£à Haptic feedback pour erreur critique
            Alert.alert(errorTitle, errorMessage);
        }
    }, [user, navigate]);

    // Handler cr├®ation service
    const handleCreateService = useCallback(async (input: any) => {
        try {
            if (!user) {
                hapticError(); // Ô£à Haptic feedback pour erreur critique
                Alert.alert('Erreur', 'Vous devez ├¬tre connect├® pour cr├®er un service');
                return;
            }

            setLoading(true);

            // NOUVEAU: V├®rifier d'abord si l'utilisateur a d├®j├á un service existant
            // Si oui, rediriger vers AjouterProduitSimpleScreen au lieu de FormulaireYukpoIntelligentScreen
            let foundServiceId: number | undefined;

            try {
                console.log('[HomeScreen] V├®rification des services existants...');
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
                            console.log('[HomeScreen] Service existant trouv├®:', foundServiceId);
                        }
                    }
                }
            } catch (serviceError) {
                console.warn('[HomeScreen] Erreur lors de la v├®rification des services (continuation normale):', serviceError);
                // Continuer normalement si la v├®rification ├®choue
            }

            // Si un service existe, g├®n├®rer les suggestions et rediriger vers AjouterProduitSimpleScreen
            if (foundServiceId) {
                console.log('[HomeScreen] Service existant d├®tect├®, redirection vers AjouterProduitSimpleScreen');

                const result = await genererSuggestionsService(input);
                console.log('[HomeScreen] R├®sultat g├®n├®ration suggestions:', JSON.stringify(result, null, 2));

                if (result && result.data) {
                    // Ô£à CORRECTION : Passer toute la r├®ponse compl├¿te pour pr├®server service_data
                    // La structure attendue : result.data contient { data: {...}, service_data: { data: {...}, base64_image: [...] } }
                    // On passe result.data tel quel pour que AjouterProduitSimpleScreen puisse extraire depuis service_data.data
                    console.log('[HomeScreen] Structure compl├¿te de result.data:', JSON.stringify(result.data, null, 2));
                    console.log('[HomeScreen] service_data pr├®sent?', !!result.data.service_data);
                    console.log('[HomeScreen] service_data.data pr├®sent?', !!result.data.service_data?.data);

                    navigate('AjouterProduitSimple', {
                        serviceId: foundServiceId,
                        mode: 'create',
                        suggestionIA: result.data, // Ô£à Passer result.data tel quel pour pr├®server service_data
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
                    // Si les suggestions ├®chouent, naviguer quand m├¬me vers AjouterProduitSimple
                    navigate('AjouterProduitSimple', {
                        serviceId: foundServiceId,
                        mode: 'create',
                    });
                }

                setLoading(false);
                return;
            }

            // Aucun service existant, g├®n├®rer les suggestions et naviguer vers FormulaireYukpoIntelligentScreen
            console.log('[HomeScreen] Aucun service existant, cr├®ation nouveau service');

            const result = await genererSuggestionsService(input);
            console.log('[HomeScreen] R├®sultat g├®n├®ration suggestions:', JSON.stringify(result, null, 2));

            // CORRIG├ë: Le formulaire attend 'suggestion' (singulier) et non 'suggestions'
            // Format attendu: { suggestion: { data: {...}, ... }, type: 'creation_service', ... }
            // La r├®ponse de l'API a la structure: { data: { data: {...}, service_data: {...}, ... } }
            if (result && result.data) {
                // Ô£à CORRECTION : Prioriser service_data.data qui contient les donn├®es compl├¿tes avec produits
                // result.data.data contient seulement les champs de base (titre_service, category, etc.)
                // result.data.service_data.data contient les donn├®es compl├¿tes avec produits (nom_produit, etc.)
                const suggestionData = result.data.service_data?.data || result.data.data || result.data;

                console.log('[HomeScreen] Donn├®es suggestion extraites:', JSON.stringify(suggestionData, null, 2));

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
                console.error('[HomeScreen] Donn├®es invalides re├ºues:', result);
                Alert.alert('Erreur', 'Impossible de g├®n├®rer les suggestions. Veuillez r├®essayer.');
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur cr├®ation service:', error);
            setLoading(false);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la cr├®ation');
        }
    }, [user, navigate]);

    // Handler soumission
    const handleSubmit = useCallback(async (input: any) => {
        try {
            if (isCreateService) {
                // NOUVEAU: Toast de confirmation avant cr├®ation de service
                Alert.alert(
                    'Confirmation',
                    'Voulez-vous vraiment cr├®er un nouveau service ou produit ?',
                    [
                        {
                            text: t('common.cancel'),
                            style: 'cancel',
                            onPress: () => {
                                console.log('[HomeScreen] Cr├®ation de service annul├®e par l\'utilisateur');
                                // NOUVEAU: Passer automatiquement en mode recherche lors de l'annulation
                                setIsCreateService(false);
                                console.log('[HomeScreen] Mode chang├® automatiquement en recherche');
                            }
                        },
                        {
                            text: t('homeScreen.working.ouiCrer'),
                            style: 'default',
                            onPress: async () => {
                                console.log('[HomeScreen] Confirmation cr├®ation de service accept├®e');
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
        // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour fluidit├®
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
                    console.log('[HomeScreen] Localisation GPS d├®finie:', { lat, lng });
                }
            }
        } catch (error) {
            console.error('[HomeScreen] Erreur parsing GPS:', error);
        }
        setShowGPSModal(false);
    }, []);

    // Ô£à NOUVEAU: Remettre automatiquement en mode recherche quand on revient sur l'├®cran
    // Cela garantit que apr├¿s la cr├®ation d'un service ou produit, le mode repasse en recherche
    useFocusEffect(
        useCallback(() => {
            console.log('[HomeScreen] ­ƒöä ├ëcran focus - Remise en mode recherche automatique');
            setIsCreateService(false);
        }, [])
    );


    // Ô£à NOUVEAU: Calculer le paddingTop du header pour tenir compte du safe area
    const getStatusBarHeight = () => {
        if (Platform.OS === 'android') {
            return StatusBar.currentHeight || 24;
        }
        // iOS - valeurs approximatives selon le mod├¿le
        return 44;
    };

    const statusBarHeight = getStatusBarHeight();
    const headerPaddingTop = statusBarHeight + 4; // 4px de marge suppl├®mentaire
    const headerTotalHeight = headerPaddingTop + 56; // paddingTop + minHeight du header

    return (
        <SafeNativeView style={styles.container}>
            {/* Header fixe avec avatar, langue, troph├®e et branding Yukpo */}
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
                {/* Colonne gauche: Avatar + Langue + Troph├®e */}
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

                {/* Titre centr├® avec branding Yukpo */}
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
                            // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour navigation fluide
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
                        style={styles.headerButton}
                        onPress={() => {
                            // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour fluidit├®
                            // hapticPress();
                            setShowChatModal(true);
                        }}
                    >
                        <Text style={styles.headerButtonIcon}>­ƒÆ¼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerButton, styles.notificationButton]}
                        onPress={() => {
                            // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour fluidit├®
                            // hapticPress();
                            setShowNotificationModal(true);
                        }}
                    >
                        <Text style={styles.headerButtonIcon}>­ƒöö</Text>
                        {/* Ô£à NOUVEAU: Badge rouge avec le nombre de notifications non lues */}
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
                // Ô£à CRITIQUE: S'assurer que le ScrollView respecte le paddingTop du SafeNativeView
                contentInsetAdjustmentBehavior="automatic"
            >
                {/* Ô£à AJOUT├ë: Espace pour compenser la hauteur de l'en-t├¬te fixe */}
                <View style={{ height: headerTotalHeight }} />

                {/* S├®lecteur de mode */}
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            !isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour fluidit├®
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
                            adjustsFontSizeToFit={false} // Ô£à D├ëSACTIV├ë: Pour ├®viter le r├®tr├®cissement du texte
                        >
                            ­ƒöì Rechercher
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour fluidit├®
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
                            adjustsFontSizeToFit={false} // Ô£à D├ëSACTIV├ë: Pour ├®viter le r├®tr├®cissement du texte
                        >
                            Cr├®er produit
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Conteneur principal pour ChatInputMobile et Services sp├®cialis├®s */}
                <View style={styles.darkBackgroundContainer}>
                    {/* ChatInputMobile */}
                    <View style={styles.inputContainer}>
                        <ChatInputMobile
                            onSubmit={handleSubmit}
                            loading={loading}
                            placeholder={
                                isCreateService
                                    ? 'D├®crivez le service que vous voulez cr├®er...'
                                    : 'D├®crivez votre besoin...'
                            }
                            onGPSPress={handleGPSPress}
                            showSendButton={true}
                            showAutocomplete={false} // Ô£à D├ëSACTIV├ë: Autocomplete d├®sactiv├®e pour am├®liorer les performances
                            isSearchMode={!isCreateService}
                            isCreateService={isCreateService}
                        />
                    </View>

                    {/* NOUVEAU: Bouton unique pour promotions avec menu horizontal */}
                    <PromotionsMenu navigate={navigate} />

                    {/* Services sp├®cialis├®s Yukpo - Acc├¿s recherche uniquement */}
                    <View style={styles.specializedServicesContainer}>
                        <YukpoServicesQuickAccess
                            onServicePress={(serviceId) => {
                                // Ô£à D├ëSACTIV├ë: Haptic feedback d├®sactiv├® pour navigation fluide
                                // hapticPress();
                                console.log('[HomeScreen] Service press├®:', serviceId);
                                // Ô£à CORRIG├ë: Mapping complet des services sp├®cialis├®s vers leurs ├®crans sp├®cifiques
                                // ÔÜá´©Å IMPORTANT: Uniquement ├®crans UTILISATEURS (Home/Search/List/Details)
                                // ÔØî JAMAIS d'├®crans PARTENAIRES (Form/Create/Manage) depuis HomeScreen
                                const searchRoutes: Record<string, string> = {
                                    // Services Santé — hubs utilisateur (aligné Transport: *Home)
                                    'pharmacie': 'PharmacieHome',
                                    'hopital': 'HopitalHome',
                                    'laboratoire': 'LaboratoireHome',
                                    'banque_sang': 'BanqueSangSearch',
                                    // Services Transport - Navigation directe vers chaque ├®cran sp├®cifique (UTILISATEURS)
                                    'agence_voyage': 'BusTicketSearch',    // Ô£à Utilisateur: TicketVoyageHomeScreen
                                    'covoiturage': 'CovoiturageSearch',    // Ô£à Utilisateur: CovoiturageHomeScreen
                                    'taxi': 'TaxiSearch',                  // Ô£à Utilisateur: TaxiHomeScreen
                                    // Services ├ëducation (UTILISATEURS)
                                    'orientation_scolaire': 'OrientationScolaireHub', // Ô£à Utilisateur: OrientationScolaireHomeScreen
                                    'bourse_livre': 'LivreScolaireSearch',           // Ô£à Utilisateur: LivreScolaireHomeScreen
                                    // Services Emploi (UTILISATEURS)
                                    'offres_emploi': 'OffresEmploiHub',    // Ô£à Utilisateur: OffresEmploiHomeScreen
                                    // Services Vie quotidienne (UTILISATEURS)
                                    'menu_planning': 'MenuPlanningHub',    // Ô£à Utilisateur: MenuPlanningHubScreen
                                    'bayamselam': 'BayamSelamSearch',      // Ô£à Utilisateur: SupermarketHomeScreen
                                    // Services Immobilier (UTILISATEURS) - Ô£à Routes s├®par├®es pour h├┤tel/meubl├®
                                    'immo': 'ImmobilierSearch',           // Ô£à Utilisateur: ImmobilierHomeScreen
                                    'hotel': 'HotelSearch',              // Ô£à Utilisateur: ImmobilierHomeScreen (filtr├® pour h├┤tels)
                                    'meuble': 'MeubleSearch',            // Ô£à Utilisateur: ImmobilierHomeScreen (filtr├® pour meubl├®s)
                                };
                                const route = searchRoutes[serviceId] || 'Home';
                                console.log('[HomeScreen] Navigation vers:', route, 'pour service:', serviceId);
                                
                                // Ô£à NOUVEAU: Passer des param├¿tres de filtre pour h├┤tel/meubl├®
                                const routeParams: any = {};
                                if (serviceId === 'hotel') {
                                    routeParams.initialFilter = { type_bien: 'hotel' };
                                } else if (serviceId === 'meuble') {
                                    routeParams.initialFilter = { type_bien: 'meuble' };
                                }
                                
                                const success = navigate(route, routeParams);
                                if (!success) {
                                    console.error('[HomeScreen] ├ëchec navigation vers:', route);
                                    Alert.alert('Navigation', `L'├®cran ${route} n'est pas encore disponible.`);
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
                    title="S├®lectionner votre localisation"
                    allowZoneSelection={true}
                />
            )}

            {/* Modal Notifications */}
            {showNotificationModal && (
                <NotificationHistoryModal
                    isOpen={true}
                    onClose={handleNotificationModalClose}
                    onChange={loadUnreadNotificationsCount} // Ô£à NOUVEAU: Recharger le nombre quand les notifications changent
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
        backgroundColor: '#FFFFFF', // Ô£à CORRIG├ë: Fond blanc pour le corps de l'application
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
        // Ombre discr├¿te pour effet premium
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
        position: 'relative', // Ô£à NOUVEAU: Pour positionner le badge
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
        width: 40, // Ô£à CORRIG├ë: M├¬me taille que les autres boutons
        height: 40, // Ô£à CORRIG├ë: M├¬me taille que les autres boutons
        borderRadius: 20,
        backgroundColor: '#F3F4F6', // Ô£à CORRIG├ë: M├¬me fond que les autres boutons (chat/notification)
        justifyContent: 'center',
        alignItems: 'center',
        // Ô£à SUPPRIM├ë: borderWidth, borderColor, shadowColor sp├®cifiques
    },
    deliveryButtonIcon: {
        fontSize: 22, // Ô£à Taille de l'emoji coursier
    },
    headerButtonIcon: {
        fontSize: 20,
    },
    modeSelector: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 8, // Ô£à R├ëDUIT: De 16 ├á 8 pour r├®duire l'espace en haut
        marginBottom: 8, // Ô£à R├ëDUIT: De 16 ├á 8 pour r├®duire l'espace avec ChatInputMobile
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 5, // Ô£à AUGMENT├ë: De 4 ├á 5 pour plus d'espace autour des boutons
        gap: 4, // Ô£à AJOUT├ë: Espacement entre les boutons
    },
    modeButton: {
        flex: 1, // Ô£à HARMONIS├ë: Les deux boutons (Rechercher et Cr├®er produit) ont la m├¬me taille
        paddingVertical: 12, // Ô£à AUGMENT├ë: De 10 ├á 12 pour plus de hauteur
        paddingHorizontal: 10, // Ô£à CORRIG├ë 2026-01-14: Padding ├®gal pour centrer le texte
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44, // Ô£à AUGMENT├ë: De 40 ├á 44 pour plus de hauteur
    },
    modeButtonActive: {
        backgroundColor: '#6366F1', // Ô£à AM├ëLIOR├ë: Couleur indigo harmonieuse pour les boutons actifs
    },
    modeButtonText: {
        fontSize: 16, // Ô£à AUGMENT├ë: De 14 ├á 16 pour une meilleure lisibilit├®
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center', // Ô£à AJOUT├ë 2026-01-14: Pour centrer le texte
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    darkBackgroundContainer: {
        backgroundColor: '#FFFFFF', // Ô£à CORRIG├ë: Fond blanc pour le corps de l'application
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 12, // Ô£à R├ëDUIT: De 16 ├á 12 pour compacter davantage
        marginTop: 0, // Ô£à CORRIG├ë: Pas de marge en haut (g├®r├®e par modeSelector)
        marginBottom: 12, // Ô£à R├ëDUIT: De 16 ├á 12 pour remonter les ├®l├®ments
    },
    inputContainer: {
        marginBottom: 4, // Ô£à R├ëDUIT: De 8 ├á 4 pour r├®duire l'espace avec les promotions
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
        marginTop: 12, // Ô£à R├ëDUIT: De 16 ├á 12 pour remonter les ├®l├®ments
        marginHorizontal: 0, // Pas de marge horizontale car d├®j├á dans le conteneur
        marginBottom: 12, // Ô£à R├ëDUIT: De 16 ├á 12 pour ├®quilibrer
    },
    promotionsMainButton: {
        backgroundColor: modernColors.background, // Ô£à CORRIG├ë: M├¬me couleur que les boutons des services sp├®cialis├®s (#f8fafc)
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: modernColors.border, // Ô£à CORRIG├ë: M├¬me bordure que les autres boutons (#e2e8f0)
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
        width: 44, // Ô£à AUGMENT├ë: De 36 ├á 44 pour plus de visibilit├®
        height: 44, // Ô£à AUGMENT├ë: De 36 ├á 44 pour plus de visibilit├®
        borderRadius: 22, // Ô£à AUGMENT├ë: De 18 ├á 22 pour correspondre ├á la taille
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    promotionsMainIcon: {
        fontSize: 28, // Ô£à AUGMENT├ë: De 20 ├á 28 pour plus de visibilit├®
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
        marginTop: 16, // Ô£à R├ëDUIT: De 24 ├á 16 pour remonter les ├®l├®ments
        marginBottom: 12, // Ô£à R├ëDUIT: De 16 ├á 12 pour ├®quilibrer
    },
    specializedServicesTitle: {
        fontSize: 17, // Ô£à AUGMENT├ë: De 15 ├á 17 pour meilleure visibilit├®
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12, // Ô£à AUGMENT├ë: De 8 ├á 12 pour plus d'espace
        marginTop: 4, // Ô£à AJOUT├ë: Marge en haut pour s├®paration
    },
});

export default HomeScreen;

