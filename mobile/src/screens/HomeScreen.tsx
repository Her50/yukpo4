/**
 * HomeScreen - RECONSTRUCTION COMPLÈTE
 * 
 * ✅ NOUVEAU: Fichier reconstruit entièrement depuis zéro
 * ✅ Référence: HomeScreen.backup-reference.tsx (version originale avec problèmes de verrouillage)
 * 
 * Reconstruction en 5 étapes:
 * 1. Structure de base + hooks essentiels
 * 2. Header avec toutes les fonctionnalités
 * 3. Zone de recherche et mode sélection
 * 4. Contenu principal (Carousel, Promotions, Feed)
 * 5. Navigation complète, modals et boutons flottants
 */

import * as ReactNavigation from '@react-navigation/native';
import React, { Suspense, useCallback, useEffect, useReducer } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { AnimatedCard } from '../components/AnimatedCard';
import ChatHistoryModal from '../components/ChatHistoryModal';
import ChatInputMobile from '../components/ChatInputMobile';
import ErrorBoundary from '../components/ErrorBoundary';
import { HomeHeader } from '../components/HomeHeader';
import MixedContentCarousel from '../components/MixedContentCarousel';
import ModernBackground from '../components/ModernBackground';
import ModernGPSModal from '../components/ModernGPSModal';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { SafeIcon } from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import ServiceProductSelector from '../components/ServiceProductSelector';
import { EnhancedSkeletonLoader, OfflineIndicator, RippleButton, ScreenTransition } from '../components/ux';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useRenderMonitor } from '../hooks/useRenderMonitor';
import { useScrollY } from '../hooks/useScrollY';
import { apiGet, deliveryApi } from '../services/api';
import gamificationService from '../services/gamificationService';
import { searchHistoryService } from '../services/searchHistoryService';
import userBehaviorService from '../services/userBehaviorService';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { API_TIMEOUTS, apiCallWithTimeout } from '../utils/apiTimeout';
import { printNotificationReport } from '../utils/debugNotifications';
import { hapticPress, hapticSelect, hapticSuccess } from '../utils/hapticFeedback';
import { navigateToVideoWizard } from '../utils/videoNavigation';
import { homeScreenReducer, initialState } from './HomeScreen.reducer';

// ============================================
// ✅ ÉTAPE 1: LAZY LOADING COMPOSANTS
// ============================================
const createSafeLazyComponent = <T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default?: T;[key: string]: any }>,
    fallbackName: string,
    fallbackMessage: string
): React.LazyExoticComponent<T> => {
    const SafeFallback: React.FC = () => (
        <View style={{ padding: 20, alignItems: 'center' }} pointerEvents="box-none">
            <Text style={{ fontSize: 14, color: '#666' }}>
                {fallbackMessage}
            </Text>
        </View>
    );
    SafeFallback.displayName = `${fallbackName}Fallback`;

    return React.lazy(() =>
        importFn()
            .then(module => {
                const Component = module.default || (module as any)[fallbackName] || (module as any).InfiniteFeed;
                if (!Component || typeof Component !== 'function') {
                    console.error(`[HomeScreen] ❌ ${fallbackName} invalide`);
                    return { default: SafeFallback as T };
                }
                return { default: Component as T };
            })
            .catch((error) => {
                console.error(`[HomeScreen] ❌ Erreur chargement ${fallbackName}:`, error);
                return { default: SafeFallback as T };
            })
    );
};

const GlobalPromoHighlights = createSafeLazyComponent(
    () => import('../components/promotions/GlobalPromoHighlights'),
    'GlobalPromoHighlights',
    'Promotions temporairement indisponibles'
);

const InfiniteFeed = createSafeLazyComponent(
    () => import('../components/InfiniteFeed'),
    'InfiniteFeed',
    'Feed temporairement indisponible'
);

// Dimensions statiques
const { width: STATIC_WIDTH, height: STATIC_HEIGHT } = Dimensions.get('window');

// ============================================
// ✅ ÉTAPE 1: COMPOSANT PRINCIPAL - STRUCTURE DE BASE
// ============================================
const HomeScreen: React.FC = () => {
    // Monitoring des re-renders
    useRenderMonitor('HomeScreen');

    // Navigation et contextes
    const navigation = ReactNavigation.useNavigation();
    const { user, refreshUser } = useAuth();
    const { language, setLanguage, t } = useLanguageSafe();
    const { location } = useLocationSafe();
    const { colors } = useTheme();

    // Support orientation
    const { orientation, isLandscape, width, height } = useDeviceOrientation();

    // State management avec reducer
    const [state, dispatch] = useReducer(homeScreenReducer, initialState);
    const { scrollY, onScroll } = useScrollY();

    // ============================================
    // ✅ ÉTAPE 1: NAVIGATION SIMPLIFIÉE (SANS VERROUILLAGE)
    // ============================================
    const navigate = useCallback((routeName: string, params?: any) => {
        try {
            if (!navigation || typeof (navigation as any).navigate !== 'function') {
                console.error('[HomeScreen] ❌ Navigation non disponible');
                return false;
            }
            (navigation as any).navigate(routeName, params);
            return true;
        } catch (error) {
            console.error('[HomeScreen] ❌ Erreur navigation:', error);
            return false;
        }
    }, [navigation]);

    // ============================================
    // ✅ ÉTAPE 2: CHARGEMENT DES DONNÉES HEADER
    // ============================================
    // Charger le nombre de notifications non lues
    const loadUnreadNotificationsCount = useCallback(async (): Promise<number> => {
        if (!user?.id) {
            return 0;
        }

        try {
            const response = await apiCallWithTimeout(
                () => apiGet(`/api/notifications/user/${user.id}/unread-count`),
                {
                    timeout: API_TIMEOUTS.DEFAULT,
                    errorMessage: 'Timeout chargement notifications',
                }
            );

            if (response.status === 401 || (!response.success && response.status === 401)) {
                console.warn('[HomeScreen] ⚠️ Token invalide/expiré (401)');
                return 0;
            }

            if (response.data && typeof (response.data as any).count === 'number') {
                return (response.data as any).count;
            }
            return 0;
        } catch (error: any) {
            if (error?.status === 401 || error?.statusCode === 401) {
                return 0;
            }
            console.error('[HomeScreen] Erreur chargement notifications:', error);
            return 0;
        }
    }, [user?.id]);

    // Charger le nombre de conversations non lues
    const loadUnreadChatCount = useCallback(async (): Promise<number> => {
        if (!user?.id) {
            return 0;
        }

        try {
            const response = await apiCallWithTimeout(
                () => apiGet('/api/chat/conversations'),
                {
                    timeout: API_TIMEOUTS.CHAT,
                    errorMessage: 'Timeout chargement conversations',
                }
            );

            if (response.status === 401 || (!response.success && response.status === 401)) {
                console.warn('[HomeScreen] ⚠️ Token invalide/expiré (401)');
                return 0;
            }

            if (response.success && response.data && Array.isArray(response.data)) {
                const unreadTotal = response.data.reduce((total: number, chat: any) => {
                    return total + (chat.unreadCount || 0);
                }, 0);
                return unreadTotal;
            }
            return 0;
        } catch (error: any) {
            if (error?.status === 401 || error?.statusCode === 401) {
                return 0;
            }
            console.error('[HomeScreen] Erreur chargement chat count:', error);
            return 0;
        }
    }, [user?.id]);

    // Charger les données initiales
    useEffect(() => {
        if (!user?.id) {
            dispatch({ type: 'SET_IS_COURIER', payload: false });
            dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: 0 });
            dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: 0 });
            dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: [] });
            return;
        }

        const loadInitialData = async () => {
            try {
                Promise.allSettled([
                    loadUnreadNotificationsCount().catch(() => 0),
                    loadUnreadChatCount().catch(() => 0),
                    userBehaviorService.getPreferredCategories(5).catch(() => []),
                    deliveryApi.getMyCourierStatus().catch(() => ({ data: { is_courier: false } })),
                ]).then((results) => {
                    const [notificationsResult, chatCountResult, behaviorResult, courierResult] = results as PromiseSettledResult<any>[];

                    if (notificationsResult?.status === 'fulfilled') {
                        dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: notificationsResult.value });
                    }
                    if (chatCountResult?.status === 'fulfilled') {
                        dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: chatCountResult.value });
                    }
                    if (behaviorResult?.status === 'fulfilled') {
                        dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: behaviorResult.value });
                    }
                    if (courierResult?.status === 'fulfilled') {
                        const data = (courierResult.value as any)?.data || courierResult.value;
                        const isCourierValue = data?.is_courier ?? data?.isCourier ?? false;
                        dispatch({ type: 'SET_IS_COURIER', payload: Boolean(isCourierValue) });
                    }
                });
            } catch (error) {
                console.warn('[HomeScreen] Erreur chargement données initiales:', error);
            }
        };

        const initTimeout = setTimeout(() => {
            loadInitialData().catch(error => {
                console.error('[HomeScreen] Erreur chargement données initiales:', error);
            });
        }, 100);

        return () => clearTimeout(initTimeout);
    }, [user?.id, loadUnreadChatCount, loadUnreadNotificationsCount]);

    // ============================================
    // ✅ ÉTAPE 2: HANDLERS HEADER
    // ============================================
    const handleDeliveryPress = useCallback(() => {
        console.log('[HomeScreen] 🚚 Navigation vers Delivery');
        hapticPress();
        navigate('Delivery');
        hapticSuccess();
    }, [navigate]);

    const handleChatPress = useCallback(() => {
        console.log('[HomeScreen] 💬 Ouverture chat');
        hapticPress();
        const wasOpen = state.ui.showChatModal;
        dispatch({ type: 'TOGGLE_CHAT_MODAL' });

        if (!wasOpen && loadUnreadChatCount) {
            loadUnreadChatCount()
                .then((count) => {
                    dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: count });
                })
                .catch((error) => {
                    console.error('[HomeScreen] Erreur chargement chat count:', error);
                });
        }
    }, [state.ui.showChatModal, loadUnreadChatCount]);

    const handleNotificationPress = useCallback(() => {
        console.log('[HomeScreen] 🔔 Ouverture notifications');
        hapticPress();
        dispatch({ type: 'TOGGLE_NOTIFICATION_MODAL' });
    }, []);

    const handleDebugNotifications = useCallback(async () => {
        if (!user?.id) return;

        try {
            console.log('[HomeScreen] 🔍 Débogage des notifications...');
            await printNotificationReport(String(user.id));

            // Note: Alert.alert sera ajouté dans l'étape 5 avec les modals
        } catch (error) {
            console.error('[HomeScreen] Erreur débogage:', error);
        }
    }, [user?.id]);

    // Rafraîchir le solde au focus
    useEffect(() => {
        if (!navigation || typeof navigation.addListener !== 'function') {
            return;
        }

        const handleFocus = () => {
            if (user?.id && refreshUser && typeof refreshUser === 'function') {
                refreshUser().catch(err => {
                    console.error('[HomeScreen] Erreur rafraîchissement solde:', err);
                });
            }
            dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: false });
        };

        const unsubscribe = navigation.addListener('focus', handleFocus);
        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [navigation, user?.id, refreshUser]);

    // ============================================
    // ✅ ÉTAPE 3: LOGIQUE DE RECHERCHE ET CRÉATION
    // ============================================
    // Fonction d'extraction des résultats unifiée
    const extractResults = useCallback((response: any): any[] => {
        if (!response) return [];
        const data = response?.data ?? response;
        if (!data) return [];

        if (Array.isArray(data)) return data;

        const nestedCandidates = [
            data?.resultats?.resultats,
            data?.resultats,
            data?.data,
            data?.items,
            data?.results,
        ];

        for (const candidate of nestedCandidates) {
            if (Array.isArray(candidate)) return candidate;
        }
        return [];
    }, []);

    // Handler pour la recherche
    const handleSearch = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour effectuer une recherche');
                return;
            }

            dispatch({ type: 'SET_LOADING', payload: true });
            console.log('[HomeScreen] Recherche avec:', input);

            // Tracker la recherche
            if (input.texte) {
                await userBehaviorService.trackSearch(input.texte);
            }

            // Gamification
            if (user?.id) {
                gamificationService.trackAction(user.id, 'search').catch(() => { });
            }

            // Enregistrer dans l'historique
            const searchQuery = input.texte || input.text || '';
            if (searchQuery) {
                searchHistoryService.recordSearch(
                    searchQuery,
                    input.base64_image?.length > 0 ? 'image' : 'text',
                    {
                        location_lat: location?.coords?.latitude,
                        location_lon: location?.coords?.longitude,
                    }
                ).catch(() => { });
            }

            // Rechercher les services
            const result = await apiCallWithTimeout(
                () => rechercherServices(input),
                {
                    timeout: API_TIMEOUTS.SEARCH,
                    errorMessage: 'La recherche a pris trop de temps',
                }
            );

            // Gestion recherche par image avec facturation
            if (result?.search_method === 'image_ai' && result?.billing) {
                const billing = result.billing;
                if (billing.charged && billing.amount > 0) {
                    Alert.alert(
                        '🖼️ Recherche par Image',
                        `${billing.results_found} résultat(s) trouvé(s)!\n\n` +
                        `💰 Coût: ${billing.amount} ${billing.currency}\n` +
                        `Nouveau solde: ${billing.new_balance} ${billing.currency}`
                    );
                }
            }

            // Gestion erreur solde insuffisant
            if (result?.status === 'error' && result?.error === 'insufficient_credits') {
                Alert.alert('💳 Solde Insuffisant', result.message || 'Votre solde est insuffisant pour effectuer une recherche par image.');
                dispatch({ type: 'SET_LOADING', payload: false });
                return;
            }

            // Extraire les résultats
            const results = extractResults(result);
            const safeResults = Array.isArray(results) ? results : [];

            // Afficher les résultats dans le carousel ou naviguer vers résultats
            if (safeResults.length > 0) {
                const displayResults = safeResults.slice(0, 15);
                dispatch({
                    type: 'SET_SEARCH_RESULTS',
                    payload: {
                        results: displayResults,
                        query: searchQuery,
                        total: safeResults.length,
                    },
                });
            } else {
                navigate('ResultatBesoin', {
                    results: safeResults,
                    type: 'recherche_besoin',
                    searchQuery: searchQuery,
                    hasError: false,
                });
            }

            dispatch({ type: 'SET_LOADING', payload: false });
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);
            dispatch({ type: 'SET_LOADING', payload: false });
            Alert.alert('Erreur', 'Une erreur est survenue lors de la recherche');
        }
    }, [user, location, extractResults, navigate]);

    // Handler pour la création de service
    const handleCreateService = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur', 'Vous devez être connecté pour créer un service');
                return;
            }

            dispatch({ type: 'SET_LOADING', payload: true });

            const result = await genererSuggestionsService(input);
            if (result && result.data) {
                navigate('FormulaireYukpoIntelligent', {
                    suggestions: result.data,
                    initialInput: input,
                });
            } else {
                Alert.alert('Erreur', 'Impossible de générer les suggestions');
            }

            dispatch({ type: 'SET_LOADING', payload: false });
        } catch (error: any) {
            console.error('[HomeScreen] Erreur création service:', error);
            dispatch({ type: 'SET_LOADING', payload: false });
            Alert.alert('Erreur', 'Une erreur est survenue lors de la création');
        }
    }, [user, navigate]);

    // Handler pour soumettre (recherche ou création selon le mode)
    const handleSubmit = useCallback(async (input: any) => {
        try {
            if (state.ui.isCreateService) {
                dispatch({ type: 'SET_PENDING_INPUT', payload: input });
                dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: true });
                return;
            }
            await handleSearch(input);
        } catch (error) {
            console.error('[HomeScreen] Erreur handleSubmit:', error);
        }
    }, [state.ui.isCreateService, handleSearch]);

    // Handlers pour changer de mode
    const handleSetSearchMode = useCallback(() => {
        hapticSelect();
        dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: false });
        dispatch({ type: 'CLEAR_SEARCH' });
    }, []);

    const handleSetCreateMode = useCallback(() => {
        hapticSelect();
        dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: true });
    }, []);

    // Handler GPS
    const handleGPSPress = useCallback(() => {
        hapticSelect();
        dispatch({ type: 'TOGGLE_GPS_MODAL' });
    }, []);

    // Handler confirmation création service
    const confirmCreateService = useCallback(async () => {
        if (state.data.pendingInput) {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
            try {
                await handleCreateService(state.data.pendingInput);
            } catch (error) {
                console.error('[HomeScreen] Erreur confirmCreateService:', error);
            }
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [state.data.pendingInput, handleCreateService]);

    const cancelCreateService = useCallback(() => {
        dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
        dispatch({ type: 'SET_PENDING_INPUT', payload: null });
        dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: false });
    }, []);

    // ============================================
    // ✅ ÉTAPE 4: HANDLERS CONTENU PRINCIPAL
    // ============================================
    const handleShowAllResults = useCallback(() => {
        hapticSelect();
        navigate('ResultatBesoin', {
            results: state.data.searchResults,
            type: 'recherche_besoin',
            searchQuery: state.data.searchQuery,
            hasError: false,
        });
    }, [state.data.searchResults, state.data.searchQuery, navigate]);

    const handleClearSearch = useCallback(() => {
        dispatch({ type: 'CLEAR_SEARCH' });
    }, [dispatch]);

    const handleFeedItemPress = useCallback((item: any) => {
        hapticSelect();
        const productId = item.id || item.service_id;
        if (!productId) {
            console.warn('[HomeScreen] ⚠️ ProductId manquant pour l\'item:', item);
            Alert.alert('Erreur', 'Identifiant du produit manquant.');
            return;
        }
        navigate('ProductDetail', {
            productId: String(productId),
        });
    }, [navigate]);

    const onRefresh = useCallback(async () => {
        dispatch({ type: 'SET_REFRESHING', payload: true });
        try {
            const refreshUserPromise = (user?.id && refreshUser && typeof refreshUser === 'function')
                ? refreshUser()
                : Promise.resolve();

            const notificationsPromise = loadUnreadNotificationsCount();
            const behaviorPromise = userBehaviorService.getPreferredCategories(5);

            await Promise.allSettled([
                refreshUserPromise,
                notificationsPromise,
                behaviorPromise,
            ]).then((results) => {
                const [userRefreshResult, notificationsResult, behaviorResult] = results as PromiseSettledResult<any>[];

                if (notificationsResult.status === 'fulfilled') {
                    dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: notificationsResult.value });
                }
                if (behaviorResult.status === 'fulfilled') {
                    dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: behaviorResult.value });
                }
            });
        } catch (error) {
            console.error('[HomeScreen] Erreur refresh:', error);
        } finally {
            dispatch({ type: 'SET_REFRESHING', payload: false });
        }
    }, [user?.id, refreshUser, loadUnreadNotificationsCount]);

    // ============================================
    // ✅ ÉTAPE 5: HANDLERS MODALS
    // ============================================
    const handleCloseGPSModal = useCallback(() => {
        dispatch({ type: 'TOGGLE_GPS_MODAL' });
    }, [dispatch]);

    const handleGPSSelect = useCallback((coordinatesString: string) => {
        try {
            const firstPoint = coordinatesString.split('|')[0].split(',');
            if (firstPoint.length === 2) {
                const lat = parseFloat(firstPoint[0]);
                const lng = parseFloat(firstPoint[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    dispatch({ type: 'SET_SELECTED_LOCATION', payload: { lat, lng } });
                    console.log('[HomeScreen] ✅ Localisation GPS définie:', { lat, lng });
                } else {
                    console.error('[HomeScreen] ❌ Coordonnées GPS invalides');
                    Alert.alert('Erreur', 'Coordonnées GPS invalides');
                }
            } else {
                console.error('[HomeScreen] ❌ Format de coordonnées invalide');
            }
        } catch (error) {
            console.error('[HomeScreen] ❌ Erreur parsing GPS:', error);
            Alert.alert('Erreur', 'Impossible de lire les coordonnées GPS');
        }
        dispatch({ type: 'TOGGLE_GPS_MODAL' });
    }, [dispatch]);

    const handleCloseNotificationModal = useCallback(() => {
        dispatch({ type: 'TOGGLE_NOTIFICATION_MODAL' });
    }, [dispatch]);

    const handleNotificationModalChange = useCallback(async () => {
        const count = await loadUnreadNotificationsCount();
        dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: count });
    }, [loadUnreadNotificationsCount]);

    const handleCloseChatModal = useCallback(() => {
        dispatch({ type: 'TOGGLE_CHAT_MODAL' });
    }, [dispatch]);

    const handleOpenChatFromHistory = useCallback((chatId: string) => {
        console.log('Ouvrir chat:', chatId);
        dispatch({ type: 'TOGGLE_CHAT_MODAL' });
        // Navigation vers le chat sera gérée par le composant ChatHistoryModal
    }, [dispatch]);

    const handleCloseConfirmationModal = useCallback(() => {
        dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
        dispatch({ type: 'SET_PENDING_INPUT', payload: null });
    }, [dispatch]);

    const handleCloseConfirmationModalByOverlay = useCallback(() => {
        dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
        dispatch({ type: 'SET_PENDING_INPUT', payload: null });
    }, [dispatch]);

    const handleCloseConfirmationModalByBackButton = useCallback(() => {
        console.log('[HomeScreen] 🔄 Fermeture modal par bouton retour Android');
        dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
        dispatch({ type: 'SET_PENDING_INPUT', payload: null });
    }, [dispatch]);

    const handleProductSelect = useCallback((product: any) => {
        if (product.serviceId && product.productIndex !== undefined) {
            navigateToVideoWizard(navigation, {
                serviceId: product.serviceId,
                productIndex: product.productIndex,
                productName: product.productName,
                serviceName: product.serviceName,
            });
        }
        dispatch({ type: 'TOGGLE_PRODUCT_SELECTOR' });
    }, [navigation]);

    const handleProductSelectorClose = useCallback(() => {
        dispatch({ type: 'TOGGLE_PRODUCT_SELECTOR' });
    }, [dispatch]);

    // ============================================
    // ✅ ÉTAPE 2: RENDU AVEC HEADER
    // ============================================
    return (
        <ModernBackground variant="home">
            <ScreenTransition type="fade" duration={300}>
                <SafeNativeView style={styles.container} pointerEvents="auto">
                    <OfflineIndicator />

                    {/* Header avec toutes les fonctionnalités */}
                    <View pointerEvents="box-none">
                        <HomeHeader
                            scrollY={scrollY}
                            user={user}
                            unreadNotificationsCount={state.metadata.unreadNotificationsCount}
                            unreadChatCount={state.metadata.unreadChatCount}
                            selectedLocation={state.metadata.selectedLocation}
                            onDeliveryPress={handleDeliveryPress}
                            onChatPress={handleChatPress}
                            onNotificationPress={handleNotificationPress}
                            onDebugNotifications={handleDebugNotifications}
                            navigation={navigation}
                            language={language}
                            onLanguageChange={setLanguage}
                            showLeaderboard={state.ui.showLeaderboard}
                            showChallenges={state.ui.showChallenges}
                            onShowLeaderboard={useCallback(() => dispatch({ type: 'TOGGLE_LEADERBOARD' }), [dispatch])}
                            onShowChallenges={useCallback(() => dispatch({ type: 'TOGGLE_CHALLENGES' }), [dispatch])}
                            onCloseLeaderboard={useCallback(() => dispatch({ type: 'TOGGLE_LEADERBOARD' }), [dispatch])}
                            onCloseChallenges={useCallback(() => dispatch({ type: 'TOGGLE_CHALLENGES' }), [dispatch])}
                            disabled={false}
                        />
                    </View>

                    {/* ============================================
                        ✅ ÉTAPE 3: ZONE DE RECHERCHE
                        ============================================ */}
                    <View style={styles.searchSection}>
                        {/* Sélecteur de mode (Rechercher / Créer) */}
                        <View style={styles.modeSelectorModern}>
                            <View style={[styles.modeButtonModern, !state.ui.isCreateService && styles.modeButtonActiveModern]}>
                                <RippleButton
                                    title={t('search.find')}
                                    icon="🔍"
                                    variant={!state.ui.isCreateService ? 'primary' : 'outline'}
                                    disabled={false}
                                    onPress={handleSetSearchMode}
                                    accessibilityLabel={t('search.find')}
                                />
                            </View>
                            <View style={[styles.modeButtonModern, state.ui.isCreateService && styles.modeButtonActiveModern]}>
                                <RippleButton
                                    title={t('search.create')}
                                    icon="➕"
                                    variant={state.ui.isCreateService ? 'primary' : 'outline'}
                                    disabled={false}
                                    onPress={handleSetCreateMode}
                                    accessibilityLabel={t('search.create')}
                                />
                            </View>
                        </View>

                        {/* ChatInput optimisé */}
                        <View pointerEvents="auto">
                            <ChatInputMobile
                                onSubmit={handleSubmit}
                                loading={state.ui.loading}
                                placeholder={state.ui.isCreateService
                                    ? t('search.create')
                                    : t('search.placeholder')}
                                onGPSPress={handleGPSPress}
                                showSendButton={true}
                                showAutocomplete={!state.ui.isCreateService}
                                isSearchMode={!state.ui.isCreateService}
                                isCreateService={state.ui.isCreateService}
                            />
                        </View>
                    </View>

                    {/* ============================================
                        ✅ ÉTAPE 4: CONTENU PRINCIPAL
                        ============================================ */}
                    <FlatList
                        data={[
                            { id: 'carousel', type: 'carousel' },
                            { id: 'promo', type: 'promo' },
                            { id: 'feed', type: 'feed' },
                        ]}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => {
                            if (!item || !item.type) {
                                return <View key="invalid-item" style={{ height: 0, width: 0 }} />;
                            }

                            // CAROUSEL - Produits et services recommandés
                            if (item.type === 'carousel') {
                                if (state.ui.loading && !state.data.userBehaviorCategories.length) {
                                    return (
                                        <View>
                                            <View style={styles.carouselHeader}>
                                                <Text style={styles.carouselSubtitle}>Produits et services recommandés</Text>
                                            </View>
                                            <View style={styles.carouselWrapper}>
                                                <EnhancedSkeletonLoader variant="carousel" count={3} />
                                            </View>
                                        </View>
                                    );
                                }

                                return (
                                    <AnimatedCard index={0} delay={0}>
                                        <View style={styles.carouselHeader}>
                                            <View style={styles.carouselHeaderLeft}>
                                                <Text style={styles.carouselSubtitle}>Produits et services recommandés</Text>
                                                <View style={styles.trendingBadge}>
                                                    <SafeIcon name="trending-up" size={14} color="#10B981" type="lucide" />
                                                    <Text style={styles.trendingBadgeText}>Tendance</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={[styles.carouselWrapper, isLandscape && styles.carouselWrapperLandscape]}>
                                            <MixedContentCarousel
                                                userId={user?.id}
                                                userBehavior={state.data.userBehaviorCategories}
                                                publiciteFrequency={3}
                                                mode={state.ui.searchMode}
                                                searchResults={state.data.searchResults}
                                                searchQuery={state.data.searchQuery}
                                                totalSearchResults={state.data.totalSearchResults}
                                                onShowAllResults={handleShowAllResults}
                                                onClearSearch={handleClearSearch}
                                            />
                                        </View>
                                    </AnimatedCard>
                                );
                            }

                            // PROMOTIONS
                            if (item.type === 'promo') {
                                return (
                                    <AnimatedCard index={1} delay={100}>
                                        <ErrorBoundary
                                            fallback={
                                                <View style={styles.errorFallback} pointerEvents="box-none">
                                                    <Text style={styles.errorTitle}>⚠️ Erreur de chargement</Text>
                                                    <Text style={styles.errorText}>
                                                        Impossible de charger les promotions. Veuillez réessayer.
                                                    </Text>
                                                </View>
                                            }
                                        >
                                            <Suspense
                                                fallback={
                                                    <View style={styles.loadingContainer} pointerEvents="box-none">
                                                        <ActivityIndicator size="small" color={modernColors.primary} />
                                                        <Text style={styles.loadingText}>
                                                            Chargement des promotions...
                                                        </Text>
                                                    </View>
                                                }
                                            >
                                                {GlobalPromoHighlights ? <GlobalPromoHighlights /> : (
                                                    <View style={styles.loadingContainer} pointerEvents="box-none">
                                                        <Text style={styles.loadingText}>
                                                            Promotions temporairement indisponibles
                                                        </Text>
                                                    </View>
                                                )}
                                            </Suspense>
                                        </ErrorBoundary>
                                    </AnimatedCard>
                                );
                            }

                            // FEED INFINI
                            if (item.type === 'feed') {
                                if (state.ui.loading) {
                                    return (
                                        <View style={styles.feedContainer}>
                                            <View style={styles.feedHeader}>
                                                <Text style={styles.feedTitle}>Découvrir plus</Text>
                                                <Text style={styles.feedSubtitle}>Explorer d'autres produits et services</Text>
                                            </View>
                                            <EnhancedSkeletonLoader variant="feed" count={2} />
                                        </View>
                                    );
                                }

                                return (
                                    <AnimatedCard index={2} delay={200}>
                                        <View style={styles.feedContainer}>
                                            <View style={styles.feedHeader}>
                                                <Text style={styles.feedTitle}>Découvrir plus</Text>
                                                <Text style={styles.feedSubtitle}>Explorer d'autres produits et services</Text>
                                            </View>
                                            <ErrorBoundary
                                                fallback={
                                                    <View style={styles.errorFallback} pointerEvents="box-none">
                                                        <Text style={styles.errorTitle}>⚠️ Erreur de chargement</Text>
                                                        <Text style={styles.errorText}>
                                                            Impossible de charger le feed. Veuillez réessayer.
                                                        </Text>
                                                    </View>
                                                }
                                            >
                                                <Suspense
                                                    fallback={
                                                        <View style={styles.loadingContainer} pointerEvents="box-none">
                                                            <ActivityIndicator size="small" color={modernColors.primary} />
                                                            <Text style={styles.loadingText}>
                                                                Chargement du feed...
                                                            </Text>
                                                        </View>
                                                    }
                                                >
                                                    {InfiniteFeed ? (
                                                        <InfiniteFeed
                                                            userId={user?.id}
                                                            location={state.metadata.selectedLocation ? {
                                                                lat: state.metadata.selectedLocation.lat,
                                                                lng: state.metadata.selectedLocation.lng,
                                                            } : null}
                                                            onItemPress={handleFeedItemPress}
                                                        />
                                                    ) : (
                                                        <View style={styles.loadingContainer} pointerEvents="box-none">
                                                            <Text style={styles.loadingText}>
                                                                Feed temporairement indisponible
                                                            </Text>
                                                        </View>
                                                    )}
                                                </Suspense>
                                            </ErrorBoundary>
                                        </View>
                                    </AnimatedCard>
                                );
                            }

                            return <View key={`empty-item-${item?.id || 'unknown'}`} style={{ height: 0, width: 0 }} />;
                        }}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                        refreshControl={
                            <RefreshControl
                                refreshing={state.ui.refreshing}
                                onRefresh={onRefresh}
                                tintColor={modernColors.primary}
                                colors={[modernColors.primary]}
                            />
                        }
                        onScrollBeginDrag={() => {
                            if (!state.metadata.hasUserScrolled) {
                                dispatch({ type: 'SET_USER_SCROLLED', payload: true });
                            }
                        }}
                        onLayout={() => {
                            if (!state.metadata.contentLoaded) {
                                dispatch({ type: 'SET_CONTENT_LOADED', payload: true });
                            }
                        }}
                        contentContainerStyle={styles.scrollContent}
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={2}
                        windowSize={3}
                        initialNumToRender={2}
                        nestedScrollEnabled={false}
                    />

                    {/* ============================================
                        ✅ ÉTAPE 5: MODALS
                        ============================================ */}
                    {/* Modal GPS */}
                    {state.ui.showGPSModal && (
                        <ErrorBoundary
                            fallback={
                                <Modal visible={true} transparent={true}>
                                    <View style={styles.modalErrorOverlay}>
                                        <View style={styles.modalErrorContent}>
                                            <Text style={styles.modalErrorIcon}>❌</Text>
                                            <Text style={styles.modalErrorTitle}>Erreur GPS</Text>
                                            <Text style={styles.modalErrorText}>
                                                Le module GPS ne peut pas se charger. Vérifiez vos permissions et votre connexion.
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.modalErrorButton}
                                                onPress={handleCloseGPSModal}
                                            >
                                                <Text style={styles.modalErrorButtonText}>Fermer</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>
                            }
                        >
                            <ModernGPSModal
                                visible={true}
                                onClose={handleCloseGPSModal}
                                onSelect={handleGPSSelect}
                                currentLocation={state.metadata.selectedLocation}
                                title="Sélectionner votre localisation"
                                allowZoneSelection={true}
                            />
                        </ErrorBoundary>
                    )}

                    {/* Modal Notifications */}
                    {state.ui.showNotificationModal && (
                        <NotificationHistoryModal
                            isOpen={true}
                            onClose={handleCloseNotificationModal}
                            onChange={handleNotificationModalChange}
                        />
                    )}

                    {/* Modal Chat/Conversations */}
                    {state.ui.showChatModal && (
                        <ChatHistoryModal
                            isOpen={true}
                            onClose={handleCloseChatModal}
                            onOpenChat={handleOpenChatFromHistory}
                        />
                    )}

                    {/* Modal Confirmation Création Service */}
                    {state.ui.showCreateServiceAlert && (
                        <Modal
                            animationType="fade"
                            transparent={true}
                            visible={true}
                            onRequestClose={handleCloseConfirmationModalByBackButton}
                        >
                            <View style={styles.confirmationModalOverlay} pointerEvents="box-none">
                                <TouchableOpacity
                                    style={StyleSheet.absoluteFill}
                                    activeOpacity={1}
                                    onPress={handleCloseConfirmationModalByOverlay}
                                />
                                <View style={styles.confirmationModal} pointerEvents="auto">
                                    <TouchableOpacity
                                        style={styles.confirmationCloseButton}
                                        onPress={handleCloseConfirmationModal}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={styles.confirmationCloseButtonText}>✕</Text>
                                    </TouchableOpacity>
                                    <View style={styles.confirmationHeader}>
                                        <Text style={styles.confirmationIcon}>🔐</Text>
                                        <Text style={styles.confirmationTitle}>Confirmation de création de service</Text>
                                    </View>
                                    <Text style={styles.confirmationMessage}>
                                        Êtes-vous sûr de vouloir créer un service/prestation sur la plateforme ?
                                    </Text>
                                    <View style={styles.confirmationButtons}>
                                        <TouchableOpacity
                                            style={[styles.confirmationButton, styles.confirmationButtonSecondary]}
                                            onPress={cancelCreateService}
                                            disabled={false}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.confirmationButtonTextSecondary}>Non, rechercher</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.confirmationButton, styles.confirmationButtonPrimary]}
                                            onPress={confirmCreateService}
                                            disabled={false}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.confirmationButtonTextPrimary}>
                                                {state.ui.loading ? 'Ouverture…' : 'Oui, créer un service'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </Modal>
                    )}

                    {/* Sélecteur de produit pour création vidéo */}
                    <ServiceProductSelector
                        visible={state.ui.showProductSelector}
                        products={state.data.productsForSelection}
                        onSelect={handleProductSelect}
                        onClose={handleProductSelectorClose}
                    />

                    {/* Bouton flottant coursier */}
                    {state.metadata.isCourier && (
                        <TouchableOpacity
                            style={styles.floatingCourierButton}
                            onPress={() => {
                                hapticPress();
                                navigate('CourierDashboard');
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.floatingCourierButtonIcon}>🚴</Text>
                            <Text style={styles.floatingCourierButtonText}>Mes courses</Text>
                        </TouchableOpacity>
                    )}
                </SafeNativeView>
            </ScreenTransition>
        </ModernBackground>
    );
};

// Styles - seront complétés dans les étapes suivantes
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchSection: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: 'transparent',
    },
    modeSelectorModern: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 2,
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modeButtonModern: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: STATIC_WIDTH > 400 ? 8 : 6,
        paddingHorizontal: STATIC_WIDTH > 400 ? 16 : 14,
        borderRadius: 8,
        gap: 4,
        backgroundColor: 'transparent',
        minHeight: STATIC_WIDTH > 400 ? 36 : 32,
    },
    modeButtonActiveModern: {
        backgroundColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    // Styles Carousel
    carouselHeader: {
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: 6,
        backgroundColor: 'transparent',
    },
    carouselHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    trendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#10B98115',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#10B98130',
    },
    trendingBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#10B981',
    },
    carouselWrapper: {
        marginTop: 4,
        marginBottom: 120,
        minHeight: STATIC_HEIGHT * 0.55,
    },
    carouselWrapperLandscape: {
        marginTop: 4,
        marginBottom: 80,
        minHeight: STATIC_HEIGHT * 0.4,
    },
    carouselSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    // Styles Feed
    feedContainer: {
        marginTop: 16,
        marginBottom: 24,
        paddingHorizontal: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        paddingVertical: 8,
    },
    feedHeader: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        marginBottom: 8,
    },
    feedTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    feedSubtitle: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '400',
        lineHeight: 20,
    },
    // Styles généraux
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    errorFallback: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        margin: 16,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    // Styles Modals
    modalErrorOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    modalErrorContent: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 16,
        maxWidth: 300,
    },
    modalErrorIcon: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalErrorTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalErrorText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalErrorButton: {
        backgroundColor: '#6366F1',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalErrorButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
    confirmationModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmationModal: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 20,
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
        position: 'relative',
    },
    confirmationCloseButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
    },
    confirmationCloseButtonText: {
        fontSize: 20,
        color: '#666',
        fontWeight: 'bold',
    },
    confirmationHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmationIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    confirmationTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'center',
    },
    confirmationMessage: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    confirmationButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    confirmationButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    confirmationButtonPrimary: {
        backgroundColor: '#3B82F6',
    },
    confirmationButtonSecondary: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    confirmationButtonTextPrimary: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    confirmationButtonTextSecondary: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    // Styles Bouton Flottant Coursier
    floatingCourierButton: {
        position: 'absolute',
        bottom: 80,
        right: 16,
        backgroundColor: modernColors.primary,
        borderRadius: 28,
        paddingVertical: 12,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 500,
        pointerEvents: 'auto',
    },
    floatingCourierButtonIcon: {
        fontSize: 20,
    },
    floatingCourierButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default HomeScreen;
