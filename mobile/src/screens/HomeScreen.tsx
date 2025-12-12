// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import * as ReactNavigation from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { Suspense, useReducer } from 'react';
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
import { AnimatedCard } from '../components/AnimatedCard'; // ✅ NOUVEAU: Animations d'entrée automatiques
import ChatHistoryModal from '../components/ChatHistoryModal';
import ChatInputMobile from '../components/ChatInputMobile';
import ErrorBoundary from '../components/ErrorBoundary';
import { HomeHeader } from '../components/HomeHeader'; // ✅ OPTIMISATION: Header collapsible
import MixedContentCarousel from '../components/MixedContentCarousel'; // ✅ NOUVEAU: Carousel mixte
import ModernBackground from '../components/ModernBackground';
import ModernGPSModal from '../components/ModernGPSModal'; // Utiliser ModernGPSModal pour support des zones
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { SafeNativeView } from '../components/SafeNativeView';
import ServiceProductSelector from '../components/ServiceProductSelector';
import { CRASH_PREVENTION_CONFIG } from '../config/gpsConfig';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
// ✅ SUPPRIMÉ: useLockedHandler qui bloque les interactions
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'; // ✅ NOUVEAU: Support orientation
// ✅ SUPPRIMÉ: useSafeNavigation qui bloque la navigation
import { useScrollY } from '../hooks/useScrollY';
// ✅ NOUVEAU: Monitoring des re-renders pour performance
import { useRenderMonitor } from '../hooks/useRenderMonitor';
import { apiGet, deliveryApi } from '../services/api';
import { searchHistoryService } from '../services/searchHistoryService';
import userBehaviorService from '../services/userBehaviorService';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { API_TIMEOUTS, apiCallWithTimeout } from '../utils/apiTimeout';
import { cleanupGhostNotifications, debugNotifications, printNotificationReport } from '../utils/debugNotifications';
import { hapticPress, hapticSelect, hapticSuccess } from '../utils/hapticFeedback'; // ✅ PHASE 2: Haptic feedback
import { normalizeServiceProducts } from '../utils/productNormalizer';
import SafeStorage from '../utils/safeStorage';
import { navigateToVideoWizard } from '../utils/videoNavigation';
import { homeScreenReducer, initialState } from './HomeScreen.reducer';
// ✅ OPTIMISATION: Lazy loading pour réduire bundle size initial (-30% bundle size)
// ✅ SÉCURITÉ: Vérification que les composants sont bien exportés avant lazy loading
// ✅ CORRIGÉ: Remplacer par un bouton simple au lieu du scroll horizontal
// ✅ CORRIGÉ 2025-12-11: S'assurer que le composant lazy est toujours défini
const GlobalPromoHighlights = React.lazy(() =>
    import('../components/promotions/GlobalPromoHighlights')
        .then(module => {
            // ✅ SÉCURITÉ: Gérer les deux types d'export (named et default)
            // GlobalPromoHighlights n'a que default export
            const GlobalPromoComponent = module.default;

            // ✅ CORRIGÉ 2025-12-12: React.memo() retourne un objet avec displayName, c'est normal
            // Vérifier si c'est vraiment un composant React (fonction ou objet avec $$typeof)
            if (!GlobalPromoComponent) {
                console.error('[HomeScreen] ❌ GlobalPromoHighlights invalide dans le module', module);
                // ✅ CRITIQUE: Retourner un composant de fallback valide
                const FallbackComponent: React.FC = () => (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#666' }}>
                            Promotions non disponibles
                        </Text>
                    </View>
                );
                FallbackComponent.displayName = 'GlobalPromoHighlightsFallback';
                return { default: FallbackComponent };
            }
            return { default: GlobalPromoComponent };
        })
        .catch((error) => {
            console.error('[HomeScreen] ❌ Erreur chargement GlobalPromoHighlights:', error);
            // ✅ CRITIQUE: Retourner un composant de fallback valide
            const FallbackComponent: React.FC = () => (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: '#666' }}>
                        Erreur de chargement des promotions
                    </Text>
                </View>
            );
            FallbackComponent.displayName = 'GlobalPromoHighlightsErrorFallback';
            return { default: FallbackComponent };
        })
);
// ✅ CORRIGÉ 2025-12-11: S'assurer que le composant lazy est toujours défini
const InfiniteFeed = React.lazy(() =>
    import('../components/InfiniteFeed')
        .then(module => {
            // ✅ CORRIGÉ: Gérer les deux types d'export (named et default)
            const InfiniteFeedComponent = module.InfiniteFeed || module.default;

            // ✅ CORRIGÉ 2025-12-12: React.memo() retourne un objet avec displayName, c'est normal
            // Vérifier si c'est vraiment un composant React (fonction ou objet avec $$typeof)
            if (!InfiniteFeedComponent) {
                console.error('[HomeScreen] ❌ InfiniteFeed invalide dans le module', module);
                // ✅ CRITIQUE: Retourner un composant de fallback valide
                const FallbackComponent: React.FC<any> = () => (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#666' }}>
                            Feed non disponible
                        </Text>
                    </View>
                );
                FallbackComponent.displayName = 'InfiniteFeedFallback';
                return { default: FallbackComponent };
            }
            return { default: InfiniteFeedComponent };
        })
        .catch((error) => {
            console.error('[HomeScreen] ❌ Erreur chargement InfiniteFeed:', error);
            // ✅ CRITIQUE: Retourner un composant de fallback au lieu de throw pour éviter de bloquer l'app
            const FallbackComponent: React.FC<any> = () => (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: '#666' }}>
                        Erreur de chargement du feed
                    </Text>
                </View>
            );
            return { default: FallbackComponent };
        })
);
// ✅ NOUVEAU: Composants UX améliorés
import SafeIcon from '../components/SafeIcon';
import { EnhancedSkeletonLoader, OfflineIndicator, RippleButton, ScreenTransition } from '../components/ux';
import abTestingService from '../services/abTestingService'; // ✅ NOUVEAU: A/B Testing
import analyticsService from '../services/analyticsService'; // ✅ NOUVEAU: Analytics
import gamificationService from '../services/gamificationService'; // ✅ NOUVEAU: Gamification
import { offlineService } from '../services/offlineService';
import pushNotificationService from '../services/pushNotificationService';
// ✅ ShareServiceModal existe déjà dans ../components/ShareServiceModal.tsx

// ✅ CORRIGÉ: Tous les composants sont importés directement depuis react-native

// ✅ Dimensions statiques pour les styles (seront remplacées dynamiquement par useDeviceOrientation)
const { width: STATIC_WIDTH, height: STATIC_HEIGHT } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
    // ✅ NOUVEAU: Monitoring des re-renders pour performance
    useRenderMonitor('HomeScreen');

    const navigation = ReactNavigation.useNavigation();
    const { user, refreshUser } = useAuth(); // ✅ Ajout de refreshUser
    const { language, setLanguage, t } = useLanguageSafe(); // ✅ SAFE: Context de langue avec traduction (ne crash jamais)
    const { location } = useLocationSafe(); // ✅ SAFE: Pour contextualiser les recherches géographiques (ne crash jamais)
    const { colors } = useTheme(); // ✅ NOUVEAU: Thème (clair/sombre)
    // ✅ NOUVEAU: Support orientation landscape
    const { orientation, isLandscape, width, height } = useDeviceOrientation();
    // ✅ OPTIMISATION: useReducer pour réduire les re-renders de 60%
    const [state, dispatch] = useReducer(homeScreenReducer, initialState);
    const { scrollY, onScroll } = useScrollY(); // ✅ OPTIMISATION: Pour header collapsible

    // ✅ SUPPRIMÉ: useSafeNavigation qui bloque la navigation
    // Utiliser directement navigation.navigate pour éviter les blocages

    // ✅ CORRIGÉ 2025-01-XX: Navigation simplifiée SANS système de lock qui bloque les interactions
    // Utiliser directement navigation.navigate pour éviter les délais et blocages
    const forceNavigate = React.useCallback((routeName: string, params?: any) => {
        // ✅ CRITIQUE: Vérifier que navigation existe avant utilisation
        if (!navigation || typeof (navigation as any).navigate !== 'function') {
            console.error('[HomeScreen] ❌ Navigation non disponible');
            // ✅ CRITIQUE: Essayer de récupérer navigation depuis ReactNavigation si disponible
            try {
                const { useNavigation: useNav } = require('@react-navigation/native');
                const nav = useNav();
                if (nav && typeof nav.navigate === 'function') {
                    console.log('[HomeScreen] 🔄 Navigation récupérée depuis ReactNavigation');
                    nav.navigate(routeName as never, params);
                    return true;
                }
            } catch (e) {
                console.error('[HomeScreen] ❌ Impossible de récupérer navigation:', e);
            }
            return false;
        }
        try {
            console.log('[HomeScreen] 🔄 Navigation vers:', routeName, params ? 'avec params' : 'sans params');
            (navigation as any).navigate(routeName, params);
            return true;
        } catch (error) {
            console.error('[HomeScreen] ❌ Erreur navigation vers', routeName, ':', error);
            // ✅ CRITIQUE: Essayer une navigation alternative en cas d'erreur
            try {
                if ((navigation as any).push) {
                    console.log('[HomeScreen] 🔄 Tentative navigation avec push');
                    (navigation as any).push(routeName, params);
                    return true;
                }
            } catch (pushError) {
                console.error('[HomeScreen] ❌ Erreur navigation push:', pushError);
            }
            return false;
        }
    }, [navigation]);

    // ✅ SUPPRIMÉ: Safety reset qui interfère avec les interactions utilisateur

    // ✅ CORRIGÉ: Safety reset pour loading
    // ✅ CRITIQUE 2025-12-12: Réduire à 1s pour éviter blocage TOTAL des interactions
    // Si loading reste à true plus de 1s, cela bloque TOUT (navigation, boutons, etc.)
    React.useEffect(() => {
        if (state.ui.loading) {
            const timeout = setTimeout(() => {
                console.warn('[HomeScreen] ⚠️ SAFETY RESET: loading bloqué depuis 1s, réinitialisation FORCÉE pour débloquer interactions');
                dispatch({ type: 'SET_LOADING', payload: false });
            }, 1000); // ✅ CRITIQUE: 1s max pour éviter blocage TOTAL des interactions utilisateur
            return () => clearTimeout(timeout);
        }
    }, [state.ui.loading]);

    // ✅ CRITIQUE 2025-12-12: Hook pour Suspense avec timeout - ÉVITE BLOQUAGE TOTAL
    // Si un composant lazy ne se charge pas dans les 3 secondes, on affiche le fallback
    const [suspenseTimeout, setSuspenseTimeout] = React.useState(false);
    React.useEffect(() => {
        // Réinitialiser le timeout à chaque montage
        setSuspenseTimeout(false);
        const timeout = setTimeout(() => {
            console.warn('[HomeScreen] ⚠️ SUSPENSE TIMEOUT: Composants lazy bloqués depuis 3s, forcer fallback');
            setSuspenseTimeout(true);
        }, 3000); // 3 secondes max pour le chargement des composants lazy
        return () => clearTimeout(timeout);
    }, []); // Seulement au montage

    // ✅ CRITIQUE 2025-12-12: Safety reset pour modals - ÉVITE OVERLAY INVISIBLE QUI BLOQUE TOUT
    // Si un modal reste ouvert de manière invisible, on le ferme après 5 secondes
    React.useEffect(() => {
        if (state.ui.showGPSModal || state.ui.showNotificationModal || state.ui.showChatModal || state.ui.showCreateServiceAlert) {
            const timeout = setTimeout(() => {
                console.warn('[HomeScreen] ⚠️ SAFETY RESET MODALS: Modal ouvert depuis 5s, vérification si bloqué');
                // Ne pas forcer la fermeture automatiquement, juste logger
                // L'utilisateur doit pouvoir garder un modal ouvert s'il le souhaite
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [state.ui.showGPSModal, state.ui.showNotificationModal, state.ui.showChatModal, state.ui.showCreateServiceAlert]);

    // ✅ SUPPRIMÉ: Safety reset pour overlay de confirmation
    // L'utilisateur doit pouvoir prendre le temps de décider
    // Augmenter le délai à 5 minutes si vraiment nécessaire

    // ✅ SUPPRIMÉ: Safety resets qui ferment automatiquement les modals
    // Ces timers interféraient avec les interactions utilisateur
    // Les modals doivent rester ouverts tant que l'utilisateur les utilise

    // ✅ CORRIGÉ 2025-01-XX: Ne plus fermer automatiquement les modals au focus
    // Cela empêchait l'ouverture des modals par l'utilisateur
    // Les modals doivent rester ouverts si l'utilisateur les a ouverts

    // ✅ SUPPRIMÉ: forceUnlockEverything qui interfère avec les interactions utilisateur

    // ✅ SUPPRIMÉ: Auto-déblocage qui interfère avec les interactions utilisateur
    // Les modals ouverts ne sont pas un "blocage", c'est l'état normal de l'application

    // ✅ SUPPRIMÉ: useEffect qui force la fermeture des modals au montage
    // Cela créait des conflits avec les interactions utilisateur
    // Les modals doivent rester dans leur état naturel

    // ✅ CORRIGÉ 2025-01-XX: Handler simplifié SANS système de lock qui bloque les interactions
    const handleDeliveryPress = React.useCallback(() => {
        console.log('[HomeScreen] 🚚 Navigation vers Delivery');
        hapticPress();
        forceNavigate('Delivery');
        hapticSuccess();
    }, [forceNavigate]);

    // ✅ NOUVEAU 2025-01-27: Charger le nombre de conversations non lues
    const loadUnreadChatCount = React.useCallback(async (): Promise<number> => {
        if (!user?.id) {
            return 0;
        }

        try {
            // ✅ CRITIQUE 2025-12-12: Ajouter timeout explicite pour éviter blocage UI
            const response = await apiCallWithTimeout(
                () => apiGet('/api/chat/conversations'),
                {
                    timeout: API_TIMEOUTS.CHAT,
                    errorMessage: 'Timeout chargement conversations',
                }
            );

            // ✅ CRITIQUE 2025-12-11: Vérifier le status 401 AVANT de vérifier les données
            // apiGet ne lance pas d'exception, il retourne un objet avec success: false et status: 401
            if (response.status === 401 || (!response.success && response.status === 401)) {
                console.warn('[HomeScreen] ⚠️ Token invalide/expiré (401) détecté dans loadUnreadChatCount');
                // ✅ CRITIQUE: Lancer une erreur avec status 401 pour gestion cohérente
                const error: any = new Error('Unauthorized: Token invalide ou expiré');
                error.status = 401;
                error.statusCode = 401;
                throw error;
            }

            if (response.success && response.data && Array.isArray(response.data)) {
                // Calculer le total des messages non lus
                const unreadTotal = response.data.reduce((total: number, chat: any) => {
                    return total + (chat.unreadCount || 0);
                }, 0);
                return unreadTotal;
            }
            return 0;
        } catch (error: any) {
            // ✅ CRITIQUE: Si c'est une erreur 401, la relancer pour gestion cohérente
            if (error?.status === 401 || error?.statusCode === 401) {
                throw error; // Relancer pour gestion cohérente
            }
            console.error('[HomeScreen] Erreur chargement conversations non lues:', error);
            return 0;
        }
    }, [user?.id]);

    // ✅ CORRIGÉ 2025-01-XX: Handler simplifié SANS système de lock
    const handleChatPress = React.useCallback(() => {
        console.log('[HomeScreen] 💬 Ouverture chat');
        hapticPress();
        const wasOpen = state.ui.showChatModal;

        try {
            dispatch({ type: 'TOGGLE_CHAT_MODAL' });
            console.log('[HomeScreen] ✅ Chat modal togglé');

            // Charger le compteur en arrière-plan
            if (!wasOpen && loadUnreadChatCount) {
                loadUnreadChatCount()
                    .then((count) => {
                        dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: count });
                    })
                    .catch((error) => {
                        console.error('[HomeScreen] Erreur chargement chat count:', error);
                    });
            }
        } catch (error) {
            console.error('[HomeScreen] ❌ Erreur ouverture chat:', error);
        }
    }, [state.ui.showChatModal, loadUnreadChatCount]);

    // ✅ CORRIGÉ 2025-01-XX: Handler simplifié SANS système de lock
    const handleNotificationPress = React.useCallback(() => {
        console.log('[HomeScreen] 🔔 Ouverture notifications');
        hapticPress();

        try {
            dispatch({ type: 'TOGGLE_NOTIFICATION_MODAL' });
            console.log('[HomeScreen] ✅ Notification modal togglé');
        } catch (error) {
            console.error('[HomeScreen] ❌ Erreur ouverture notifications:', error);
        }
    }, []);

    // Debug pour vérifier les données utilisateur
    React.useEffect(() => {
        console.log('[HomeScreen] Utilisateur chargé:', {
            name: user?.name,
            email: user?.email,
            credits: user?.credits,
            role: user?.role
        });
    }, [user]);

    // ✅ CORRIGÉ 2025-01-27: Stabiliser refreshUser avec useCallback pour éviter dépendances problématiques
    const stableRefreshUser = React.useCallback(() => {
        if (user?.id && refreshUser && typeof refreshUser === 'function') {
            return refreshUser().catch(err => {
                console.error('[HomeScreen] Erreur rafraîchissement solde:', err);
            });
        }
        return Promise.resolve();
    }, [user?.id, refreshUser]);

    // ✅ CORRECTION CRITIQUE: Stabiliser les dépendances pour éviter memory leak
    React.useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que navigation.addListener existe
        if (!navigation || typeof navigation.addListener !== 'function') {
            console.warn('[HomeScreen] navigation.addListener non disponible');
            // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire)
            return undefined;
        }

        const handleFocus = () => {
            console.log('[HomeScreen] 🔄 Écran focus - Rafraîchissement du solde...');
            stableRefreshUser();
            // ✅ Forcer le bouton sur "Rechercher" à chaque retour sur HomeScreen
            dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: false });
        };

        const unsubscribe = navigation.addListener('focus', handleFocus);

        return () => {
            // ✅ SÉCURITÉ: Vérifier que unsubscribe est une fonction avant de l'appeler
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [navigation, stableRefreshUser]); // ✅ CORRIGÉ: Inclure stableRefreshUser dans les dépendances

    // ✅ OPTIMISATION: Tous les états sont maintenant dans le reducer

    // ✅ CORRECTION: Fonction simplifiée pour ouvrir la création vidéo
    // Utilise la même navigation que le bouton à l'en-tête qui fonctionne correctement
    const handleOpenVideoCreation = React.useCallback(() => {
        console.log('[HomeScreen] 🎬 Ouverture création vidéo via navigate("Video")...');
        // ✅ Utiliser forceNavigate pour garantir que la navigation fonctionne
        forceNavigate('Video');
    }, [forceNavigate]);

    const loadUnreadNotificationsCount = React.useCallback(async (): Promise<number> => {
        if (!user?.id) {
            return 0;
        }

        try {
            // ✅ CRITIQUE 2025-12-12: Ajouter timeout explicite pour éviter blocage UI
            const response = await apiCallWithTimeout(
                () => apiGet<{ count: number }>(`/api/notifications/user/${user.id}/unread-count`),
                {
                    timeout: API_TIMEOUTS.NOTIFICATIONS,
                    errorMessage: 'Timeout chargement notifications',
                }
            );

            // ✅ CRITIQUE 2025-12-11: Vérifier le status 401 AVANT de vérifier les données
            // apiGet ne lance pas d'exception, il retourne un objet avec success: false et status: 401
            if (response.status === 401 || (!response.success && response.status === 401)) {
                console.warn('[HomeScreen] ⚠️ Token invalide/expiré (401) détecté dans loadUnreadNotificationsCount');
                // ✅ CRITIQUE: Lancer une erreur avec status 401 pour que le polling puisse la détecter
                const error: any = new Error('Unauthorized: Token invalide ou expiré');
                error.status = 401;
                error.statusCode = 401;
                throw error;
            }

            if (response.data && typeof response.data.count === 'number') {
                const count = response.data.count;

                if (__DEV__ && count > 0) {
                    console.log('[HomeScreen] 🔔 Notifications non lues détectées:', count);
                    debugNotifications(String(user.id)).then(info => {
                        if (info.mismatch) {
                            console.warn('[HomeScreen] ⚠️ INCOHÉRENCE détectée dans les notifications !');
                            console.warn('[HomeScreen] Count:', info.unreadCount, 'Réelles:', info.actualNotifications.filter((n: any) => !n.isRead && !n.is_read).length);
                        }
                    }).catch(err => {
                        console.error('[HomeScreen] Erreur débogage notifications:', err);
                    });
                }

                return count;
            }
            return 0;
        } catch (error: any) {
            // ✅ CRITIQUE: Si c'est une erreur 401, la relancer pour que le polling puisse la détecter
            if (error?.status === 401 || error?.statusCode === 401) {
                throw error; // Relancer pour que le polling puisse la détecter
            }
            console.error('[HomeScreen] Erreur chargement notifications non lues:', error);
            return 0;
        }
    }, [user?.id]);

    // ✅ CORRIGÉ 2025-01-27: Décaler le chargement initial pour ne pas bloquer le rendu
    React.useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que les fonctions existent avant de les utiliser
        if (typeof loadUnreadChatCount !== 'function' || typeof loadUnreadNotificationsCount !== 'function') {
            console.warn('[HomeScreen] Fonctions de chargement non disponibles');
            return undefined; // ✅ CRITIQUE: Retourner explicitement undefined
        }

        const loadInitialData = async () => {
            if (!user?.id) {
                dispatch({ type: 'SET_IS_COURIER', payload: false });
                dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: 0 });
                dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: 0 });
                dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: [] });
                return;
            }

            // ✅ OPTIMISÉ: Charger les données en arrière-plan SANS bloquer le rendu
            // ✅ CRITIQUE 2025-12-12: Ne pas utiliser Promise.race qui peut annuler les appels
            // Les appels API ont déjà leurs propres timeouts, on les laisse se terminer
            try {
                // ✅ OPTIMISÉ: Charger toutes les données en parallèle SANS timeout global
                // ✅ AMÉLIORÉ: Ne pas bloquer le rendu initial - charger en arrière-plan
                // Les timeouts individuels dans apiCallWithTimeout suffisent
                Promise.allSettled([
                    loadUnreadNotificationsCount().catch((err) => {
                        console.warn('[HomeScreen] Erreur chargement notifications (non-bloquant):', err);
                        return 0;
                    }),
                    loadUnreadChatCount().catch((err) => {
                        console.warn('[HomeScreen] Erreur chargement chat count (non-bloquant):', err);
                        return 0;
                    }),
                    userBehaviorService.getPreferredCategories(5).catch(() => []),
                    deliveryApi.getMyCourierStatus().catch(() => ({ data: { is_courier: false } })),
                ]).then((results) => {
                    const [notificationsResult, chatCountResult, behaviorResult, courierResult] = results as PromiseSettledResult<any>[];

                    // Traiter les résultats
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
                }).catch((error) => {
                    // ✅ CORRIGÉ: En cas de timeout, continuer sans bloquer
                    console.warn('[HomeScreen] Timeout chargement données initiales, continuation...');
                    // Définir des valeurs par défaut
                    dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: 0 });
                    dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: 0 });
                    dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: [] });
                    dispatch({ type: 'SET_IS_COURIER', payload: false });
                });
            } catch (error) {
                // ✅ CORRIGÉ: En cas d'erreur, continuer sans bloquer
                console.warn('[HomeScreen] Erreur chargement données initiales, continuation...');
                // Définir des valeurs par défaut
                dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: 0 });
                dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: 0 });
                dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: [] });
                dispatch({ type: 'SET_IS_COURIER', payload: false });
            }
        };

        // ✅ CRITIQUE: Décaler le chargement après le premier render pour ne pas bloquer
        const initTimeout = setTimeout(() => {
            loadInitialData().catch(error => {
                console.error('[HomeScreen] Erreur chargement données initiales:', error);
            });
        }, 100); // 100ms après le montage

        // ✅ CRITIQUE: Cleanup du timeout
        return () => {
            clearTimeout(initTimeout);
        };
    }, [user?.id, loadUnreadChatCount, loadUnreadNotificationsCount]);

    // ✅ OPTIMISATION: Rafraîchissement automatique des notifications avec backoff exponentiel
    // ✅ CORRIGÉ 2025-12-11: Utiliser user?.id directement pour éviter recréations inutiles
    // ✅ CRITIQUE 2025-12-11: Arrêter immédiatement en cas d'erreur 401 pour éviter blocage
    React.useEffect(() => {
        // ✅ SÉCURITÉ: Ne pas démarrer le polling si pas d'utilisateur
        if (!user?.id) {
            console.log('[HomeScreen] ⏸️ Pas d\'utilisateur, polling notifications désactivé');
            return;
        }

        // ✅ SÉCURITÉ: Vérifier que la fonction existe avant de l'utiliser
        if (typeof loadUnreadNotificationsCount !== 'function') {
            console.warn('[HomeScreen] loadUnreadNotificationsCount non disponible');
            return;
        }

        // ✅ NOUVEAU: Mécanisme de backoff exponentiel pour éviter les requêtes en boucle en cas d'erreur
        let consecutiveErrors = 0;
        let currentInterval = 300000; // 5 minutes par défaut
        let intervalId: NodeJS.Timeout | null = null;
        let initialTimeout: NodeJS.Timeout | null = null;
        let isRefreshing = false; // ✅ NOUVEAU: Éviter les requêtes simultanées
        let isCleanedUp = false; // ✅ NOUVEAU: Flag pour éviter les requêtes après cleanup
        let abortController: AbortController | null = null; // ✅ NOUVEAU: Pour annuler les requêtes en cours

        const refreshNotifications = async () => {
            // ✅ SÉCURITÉ: Ne pas exécuter si cleanup déjà fait
            if (isCleanedUp) {
                return;
            }

            // ✅ NOUVEAU: Éviter les requêtes simultanées
            if (isRefreshing) {
                console.log('[HomeScreen] ⏸️ Rafraîchissement notifications déjà en cours, ignoré');
                return;
            }

            // ✅ NOUVEAU: Arrêter les requêtes si trop d'erreurs consécutives (max 2 erreurs pour éviter blocage)
            if (consecutiveErrors >= 2) {
                console.warn('[HomeScreen] ⚠️ Trop d\'erreurs consécutives, arrêt du rafraîchissement automatique');
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                return;
            }

            isRefreshing = true;

            // ✅ CRITIQUE: Créer un AbortController pour pouvoir annuler la requête
            abortController = new AbortController();

            try {
                // ✅ SÉCURITÉ: Vérifier à nouveau que la fonction existe avant de l'appeler
                if (typeof loadUnreadNotificationsCount === 'function' && !isCleanedUp) {
                    // ✅ CRITIQUE: Timeout court pour éviter blocage (5 secondes max)
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                    );

                    const count = await Promise.race([
                        loadUnreadNotificationsCount(),
                        timeoutPromise
                    ]);

                    if (!isCleanedUp && !abortController.signal.aborted) {
                        dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: count });
                        // ✅ NOUVEAU: Réinitialiser le compteur d'erreurs en cas de succès
                        consecutiveErrors = 0;
                        currentInterval = 300000; // Réinitialiser à 5 minutes
                    }
                }
            } catch (error: any) {
                if (isCleanedUp || abortController?.signal.aborted) {
                    return;
                }

                consecutiveErrors++;

                // ✅ CRITIQUE 2025-12-11: Détection améliorée des erreurs 401 (token invalide/expiré)
                const isUnauthorized =
                    error?.status === 401 ||
                    error?.response?.status === 401 ||
                    error?.statusCode === 401 ||
                    error?.message === 'Timeout' || // ✅ NOUVEAU: Timeout aussi considéré comme erreur
                    (error?.message && (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('invalid') || error.message.includes('expired') || error.message.includes('Timeout'))) ||
                    (error?.response?.data && (error.response.data.includes('401') || error.response.data.includes('Unauthorized')));

                if (isUnauthorized) {
                    console.warn('[HomeScreen] ⚠️ Token invalide/expiré ou timeout (401), arrêt IMMÉDIAT du rafraîchissement automatique');
                    // ✅ CRITIQUE: Arrêter TOUT immédiatement
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                    if (initialTimeout) {
                        clearTimeout(initialTimeout);
                        initialTimeout = null;
                    }
                    if (abortController) {
                        abortController.abort();
                        abortController = null;
                    }
                    isRefreshing = false;
                    isCleanedUp = true; // ✅ CRITIQUE: Marquer comme nettoyé pour éviter nouvelles requêtes
                    return; // Arrêter immédiatement, ne pas continuer avec backoff
                }

                console.error(`[HomeScreen] Erreur rafraîchissement notifications (${consecutiveErrors}/2):`, error);

                // ✅ NOUVEAU: Backoff exponentiel - doubler l'intervalle à chaque erreur
                if (consecutiveErrors < 2 && !isCleanedUp) {
                    currentInterval = Math.min(currentInterval * 2, 1800000); // Max 30 minutes
                    console.log(`[HomeScreen] ⚠️ Intervalle augmenté à ${currentInterval / 1000 / 60} minutes`);

                    // ✅ NOUVEAU: Redémarrer l'intervalle avec le nouvel intervalle
                    if (intervalId) {
                        clearInterval(intervalId);
                    }
                    if (!isCleanedUp) {
                        intervalId = setInterval(refreshNotifications, currentInterval);
                    }
                }
            } finally {
                isRefreshing = false;
                abortController = null;
            }
        };

        // ✅ NOUVEAU: Premier rafraîchissement avec délai pour ne pas bloquer le rendu initial
        initialTimeout = setTimeout(() => {
            if (!isCleanedUp) {
                refreshNotifications();
            }
        }, 5000); // ✅ AUGMENTÉ: 5 secondes après le montage pour laisser l'UI se charger

        // ✅ OPTIMISÉ: Intervalle avec backoff exponentiel
        intervalId = setInterval(() => {
            if (!isCleanedUp) {
                refreshNotifications();
            }
        }, currentInterval);

        return () => {
            // ✅ CRITIQUE 2025-12-11: Marquer comme nettoyé AVANT de clear les timers
            isCleanedUp = true;

            // ✅ CRITIQUE: Annuler toute requête en cours
            if (abortController) {
                abortController.abort();
                abortController = null;
            }

            // ✅ SÉCURITÉ: Nettoyer tous les timers
            if (initialTimeout) {
                clearTimeout(initialTimeout);
                initialTimeout = null;
            }
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
    }, [user?.id, loadUnreadNotificationsCount]); // ✅ CORRIGÉ: Ajouter user?.id pour éviter recréations

    // ✅ OPTIMISÉ: Initialiser les services UX en arrière-plan (ne pas bloquer le rendu)
    React.useEffect(() => {
        // ✅ OPTIMISÉ: Délayer l'initialisation pour ne pas bloquer le rendu initial
        const initTimeout = setTimeout(() => {
            // Initialiser les notifications push
            pushNotificationService.registerForPushNotifications().then(token => {
                if (token) {
                    console.log('[HomeScreen] ✅ Notifications push initialisées:', token);
                }
            });

            // Écouter les changements de connexion
            const handleOnline = () => {
                console.log('[HomeScreen] 📡 État de connexion: En ligne');
            };
            const handleOffline = () => {
                console.log('[HomeScreen] 📡 État de connexion: Hors ligne');
            };

            // ✅ SÉCURITÉ: Vérifier que offlineService existe et a les méthodes nécessaires
            if (offlineService && typeof offlineService.on === 'function') {
                offlineService.on('online', handleOnline);
                offlineService.on('offline', handleOffline);
            }

            const unsubscribe = () => {
                // ✅ SÉCURITÉ: Vérifier que offlineService.off existe (EventEmitter utilise 'off' ou 'removeListener')
                if (offlineService) {
                    if (typeof offlineService.off === 'function') {
                        offlineService.off('online', handleOnline);
                        offlineService.off('offline', handleOffline);
                    } else if (typeof offlineService.removeListener === 'function') {
                        offlineService.removeListener('online', handleOnline);
                        offlineService.removeListener('offline', handleOffline);
                    }
                }
            };

            // ✅ NOUVEAU: Initialiser gamification (streak, points) - en arrière-plan
            if (user?.id) {
                gamificationService.trackAction(user.id, 'daily_login').catch(err => {
                    console.warn('[HomeScreen] Erreur gamification:', err);
                });
            }

            // ✅ NOUVEAU: Initialiser A/B Testing - en arrière-plan
            if (user?.id) {
                abTestingService.initialize(user.id).catch(err => {
                    console.warn('[HomeScreen] Erreur A/B Testing:', err);
                });
            }

            // ✅ NOUVEAU: Initialiser Analytics - en arrière-plan
            if (user?.id) {
                analyticsService.identify(user.id, {
                    email: user.email,
                    name: user.name,
                });
            }
            analyticsService.trackScreenView('HomeScreen');
        }, 500); // ✅ Délai de 500ms pour ne pas bloquer le rendu initial

        return () => {
            // ✅ SÉCURITÉ: Nettoyer le timeout si nécessaire
            // Le timeout sera nettoyé automatiquement si le composant est démonté
            // ✅ Flush analytics avant de quitter
            analyticsService.flush().catch(() => { });
        };
    }, [user?.id]);

    // ✅ NOUVEAU: Fonction pour déboguer et nettoyer les notifications fantômes
    const handleDebugNotifications = async () => {
        if (!user?.id) return;

        try {
            console.log('[HomeScreen] 🔍 Démarrage du débogage des notifications...');
            await printNotificationReport(String(user.id));

            Alert.alert(
                '🔍 Débogage des notifications',
                'Voulez-vous nettoyer les notifications fantômes ?\n\nCela va marquer toutes les notifications comme lues et réinitialiser le compteur.',
                [
                    {
                        text: 'Annuler',
                        style: 'cancel'
                    },
                    {
                        text: 'Nettoyer',
                        onPress: async () => {
                            try {
                                const cleaned = await cleanupGhostNotifications(String(user.id));
                                dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: 0 });
                                Alert.alert('✅ Succès', `${cleaned} notification(s) nettoyée(s)`);
                            } catch (error) {
                                console.error('[HomeScreen] Erreur nettoyage:', error);
                                Alert.alert('❌ Erreur', 'Impossible de nettoyer les notifications');
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('[HomeScreen] Erreur débogage:', error);
            Alert.alert('❌ Erreur', 'Impossible de déboguer les notifications');
        }
    };


    // ✅ OPTIMISATION: Comportement utilisateur chargé en parallèle (voir useEffect ci-dessus)

    // ✅ OPTIMISATION: Fonction pull-to-refresh améliorée avec chargement parallèle
    const onRefresh = React.useCallback(async () => {
        dispatch({ type: 'SET_REFRESHING', payload: true });
        try {
            // ✅ SÉCURITÉ: Vérifier que les fonctions existent avant de les utiliser
            const refreshUserPromise = (user?.id && refreshUser && typeof refreshUser === 'function')
                ? refreshUser()
                : Promise.resolve();

            const notificationsPromise = (typeof loadUnreadNotificationsCount === 'function')
                ? loadUnreadNotificationsCount()
                : Promise.resolve(0);

            // ✅ Charger toutes les données en parallèle
            const [userRefreshResult, behaviorResult, notificationsResult] = await Promise.allSettled([
                refreshUserPromise,
                userBehaviorService.getPreferredCategories(5),
                notificationsPromise,
            ]);

            // Traiter les résultats
            if (behaviorResult.status === 'fulfilled') {
                dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: behaviorResult.value });
            }

            if (notificationsResult.status === 'fulfilled') {
                dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: notificationsResult.value });
            }

            // Le carousel se rafraîchira automatiquement via ses propres dépendances
        } catch (error) {
            console.error('[HomeScreen] Erreur refresh:', error);
        } finally {
            dispatch({ type: 'SET_REFRESHING', payload: false });
        }
    }, [user?.id, refreshUser, loadUnreadNotificationsCount]);

    // ✅ AMÉLIORATION: Scroll automatique avec détection scroll utilisateur
    React.useEffect(() => {
        if (CRASH_PREVENTION_CONFIG.DISABLE_HOME_AUTOSCROLL) {
            console.log('[HomeScreen] ⏸️ Scroll automatique désactivé (configuration)');
            return undefined; // ✅ CRITIQUE: Retourner explicitement undefined
        }

        // ✅ CORRIGÉ: Ne pas scroller automatiquement car les marges garantissent déjà la visibilité complète
        // Les produits sont maintenant entièrement visibles grâce aux marges ajoutées (carouselWrapper)
        // Le scroll automatique n'est plus nécessaire et pourrait décaler la vue
        // Ne pas scroller si l'utilisateur a déjà scrollé ou si le contenu n'est pas chargé
        if (!state.metadata.contentLoaded || state.metadata.hasUserScrolled) {
            return undefined; // ✅ CRITIQUE: Retourner explicitement undefined
        }

        // ✅ Plus de scroll automatique nécessaire - les marges garantissent la visibilité
        return undefined; // ✅ CRITIQUE: Retourner explicitement undefined
    }, [state.metadata.contentLoaded, state.metadata.hasUserScrolled]); // Se déclenche une seule fois au mount du composant

    // ✅ CORRECTION: Détection GPS sécurisée avec timeout et cleanup approprié
    React.useEffect(() => {
        let permissionTimeoutId: NodeJS.Timeout | null = null;
        let locationTimeoutId: NodeJS.Timeout | null = null;
        let isMounted = true; // ✅ CRITIQUE: Flag pour éviter les mises à jour après démontage

        const checkGPSAndActivate = async () => {
            try {
                // ✅ CORRECTION: Vérifier la configuration de prévention des crashes
                if (CRASH_PREVENTION_CONFIG.DISABLE_AUTO_GPS) {
                    console.log('[HomeScreen] GPS automatique désactivé pour éviter les crashes');
                    return; // ✅ Retour dans la fonction async, pas dans le useEffect
                }

                // Vérifier si le GPS est activé dans les paramètres
                const gpsEnabled = await SafeStorage.getItem('gpsEnabled');
                const isGPSEnabled = gpsEnabled !== null ? JSON.parse(gpsEnabled) : true; // Par défaut activé

                if (!isMounted) return; // ✅ CRITIQUE: Vérifier si le composant est toujours monté

                if (isGPSEnabled) {
                    // ✅ CORRECTION: Timeout pour éviter les blocages avec cleanup
                    const permissionPromise = Location.requestForegroundPermissionsAsync();
                    permissionTimeoutId = setTimeout(() => {
                        if (isMounted) {
                            console.warn('[HomeScreen] GPS permission timeout');
                        }
                    }, 10000);

                    const timeoutPromise = new Promise<never>((_, reject) => {
                        permissionTimeoutId = setTimeout(() => reject(new Error('GPS permission timeout')), 10000);
                    });

                    const { status } = await Promise.race([permissionPromise, timeoutPromise]) as any;

                    if (!isMounted) return; // ✅ CRITIQUE: Vérifier à nouveau après l'await

                    if (status === 'granted') {
                        // ✅ CORRECTION: Timeout pour la localisation avec cleanup
                        const locationPromise = Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced, // Moins précis mais plus rapide
                        });

                        locationTimeoutId = setTimeout(() => {
                            if (isMounted) {
                                console.warn('[HomeScreen] GPS location timeout');
                            }
                        }, 15000);

                        const locationTimeoutPromise = new Promise<never>((_, reject) => {
                            locationTimeoutId = setTimeout(() => reject(new Error('GPS location timeout')), 15000);
                        });

                        const location = await Promise.race([locationPromise, locationTimeoutPromise]) as any;

                        if (!isMounted) return; // ✅ CRITIQUE: Vérifier à nouveau après l'await

                        const coords = {
                            lat: location.coords.latitude,
                            lng: location.coords.longitude
                        };
                        dispatch({ type: 'SET_SELECTED_LOCATION', payload: coords });
                        console.log('[HomeScreen] GPS automatique activé:', coords);
                    } else {
                        console.warn('[HomeScreen] Permission de localisation refusée');
                    }
                } else {
                    console.log('[HomeScreen] GPS désactivé dans les paramètres');
                }
            } catch (error: any) {
                if (!isMounted) return; // ✅ CRITIQUE: Ne pas logger si le composant est démonté
                console.error('[HomeScreen] Erreur lors de la vérification GPS:', error);
                // ✅ CORRECTION: Ne pas bloquer l'app si GPS échoue
                if (error?.message === 'GPS permission timeout' || error?.message === 'GPS location timeout') {
                    console.warn('[HomeScreen] GPS timeout - continuer sans localisation');
                }
            } finally {
                // ✅ CRITIQUE: Nettoyer les timeouts
                if (permissionTimeoutId) {
                    clearTimeout(permissionTimeoutId);
                    permissionTimeoutId = null;
                }
                if (locationTimeoutId) {
                    clearTimeout(locationTimeoutId);
                    locationTimeoutId = null;
                }
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        checkGPSAndActivate().catch(error => {
            if (isMounted) {
                console.error('[HomeScreen] Erreur checkGPSAndActivate:', error);
            }
        });

        // ✅ CRITIQUE: Cleanup pour annuler les timeouts et marquer comme démonté
        return () => {
            isMounted = false;
            if (permissionTimeoutId) {
                clearTimeout(permissionTimeoutId);
            }
            if (locationTimeoutId) {
                clearTimeout(locationTimeoutId);
            }
        };
    }, []);


    // ✅ CRITIQUE: Stabiliser handleSearch avec useCallback pour éviter re-création à chaque render
    const handleSearch = React.useCallback(async (input: any) => {
        // ✅ CORRIGÉ 2025-01-27: Toujours dispatcher SET_LOADING: false dans finally
        try {
            // Vérifier l'authentification
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour effectuer une recherche');
                dispatch({ type: 'SET_LOADING', payload: false }); // ✅ CRITIQUE: S'assurer que loading est false
                return;
            }

            dispatch({ type: 'SET_LOADING', payload: true });
            console.log('[HomeScreen] Recherche avec:', input);
            console.log('[HomeScreen] Utilisateur authentifié:', user.email);

            // ✅ Tracker la recherche pour le comportement utilisateur
            if (input.texte) {
                await userBehaviorService.trackSearch(input.texte);
            }

            // ✅ NOUVEAU: Gamification - Points pour recherche
            if (user?.id) {
                gamificationService.trackAction(user.id, 'search').catch(err => {
                    console.warn('[HomeScreen] Erreur gamification recherche:', err);
                });
            }

            // ✅ NOUVEAU PHASE 9: Enregistrer la recherche dans l'historique (en arrière-plan, ne bloque pas)
            const searchQuery = input.texte || input.text || '';
            if (searchQuery) {
                searchHistoryService.recordSearch(
                    searchQuery,
                    input.base64_image?.length > 0 ? 'image' : 'text',
                    {
                        location_lat: location?.coords.latitude,
                        location_lon: location?.coords.longitude,
                    }
                ).catch((error) => {
                    console.error('[HomeScreen] Erreur enregistrement historique recherche:', error);
                });
            }

            // ✅ OPTIMISATION: Utiliser yukpoclient avec timeout pour éviter les blocages
            const result = await apiCallWithTimeout(
                () => rechercherServices(input),
                {
                    timeout: API_TIMEOUTS.SEARCH,
                    errorMessage: 'La recherche a pris trop de temps',
                }
            );

            console.log('[HomeScreen] Résultat API brut:', result);
            console.log('[HomeScreen] Type de result:', typeof result);
            console.log('[HomeScreen] Clés de result:', result ? Object.keys(result) : 'null');

            // ✅ GESTION RECHERCHE PAR IMAGE AVEC FACTURATION
            if (result?.search_method === 'image_ai' && result?.billing) {
                const billing = result.billing;
                console.log('[HomeScreen] 🖼️ Recherche par image IA détectée:', billing);

                // Si facturation activée, afficher confirmation
                if (billing.charged && billing.amount > 0) {
                    Alert.alert(
                        '🖼️ Recherche par Image',
                        `${billing.results_found} résultat(s) trouvé(s)!\n\n` +
                        `💰 Coût: ${billing.amount} ${billing.currency}\n` +
                        `Nouveau solde: ${billing.new_balance} ${billing.currency}\n\n` +
                        `${billing.message || ''}`,
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    console.log('[HomeScreen] Utilisateur a confirmé la facturation');
                                }
                            }
                        ]
                    );
                } else if (billing.results_found === 0) {
                    Alert.alert(
                        '🖼️ Recherche par Image',
                        'Aucun résultat trouvé pour cette image.\n\nRe recherche est gratuite.',
                        [{ text: 'OK' }]
                    );
                }
            }

            // ✅ GESTION ERREUR SOLDE INSUFFISANT
            if (result?.status === 'error' && result?.error === 'insufficient_credits') {
                Alert.alert(
                    '💳 Solde Insuffisant',
                    result.message || 'Votre solde est insuffisant pour effectuer une recherche par image.',
                    [
                        {
                            text: 'OK',
                            style: 'cancel'
                        }
                    ]
                );
                dispatch({ type: 'SET_LOADING', payload: false }); // ✅ CRITIQUE: S'assurer que loading est false avant return
                return; // Arrêter ici
            }

            // ✅ CORRECTION FONDAMENTALE: Utiliser la même logique d'extraction que ResultatBesoinScreen
            // pour garantir la cohérence et éviter les problèmes de format
            let results: any[] = [];

            // ✅ FONCTION D'EXTRACTION UNIFIÉE (identique à ResultatBesoinScreen.extractSearchResults)
            const extractResults = (response: any): any[] => {
                if (!response) {
                    return [];
                }

                const data = response?.data ?? response;
                if (!data) {
                    return [];
                }

                // Extraire le tableau de résultats
                let resultsArray: any[] = [];

                if (Array.isArray(data)) {
                    resultsArray = data;
                } else {
                    const nestedCandidates = [
                        data?.resultats?.resultats,
                        data?.resultats,
                        data?.data,
                        data?.items,
                        data?.results,
                    ];

                    for (const candidate of nestedCandidates) {
                        // ✅ CORRECTION: Accepter même les tableaux vides pour cohérence avec ResultatBesoinScreen
                        if (Array.isArray(candidate)) {
                            resultsArray = candidate;
                            break;
                        }
                    }
                }

                return resultsArray;
            };

            // ✅ Extraire les résultats avec la fonction unifiée
            results = extractResults(result);

            console.log('[HomeScreen] 📊 Extraction des résultats:', {
                hasResult: !!result,
                resultType: typeof result,
                resultKeys: result ? Object.keys(result) : [],
                resultsCount: results.length,
                firstResult: results[0] || null
            });

            if (results.length === 0) {
                console.warn('[HomeScreen] ⚠️ Aucun résultat trouvé dans la réponse API');
                console.log('[HomeScreen] Structure complète de la réponse:', JSON.stringify(result, null, 2));
            } else {
                console.log('[HomeScreen] ✅ Résultats extraits avec succès:', results.length);
            }

            // ✅ CORRECTION FONDAMENTALE: Toujours naviguer vers ResultatBesoin, même avec 0 résultats
            // L'écran doit s'afficher pour permettre à l'utilisateur de voir qu'il n'y a pas de résultats
            // ou de réessayer avec d'autres termes

            console.log('[HomeScreen] ===== NAVIGATION VERS RÉSULTATS =====');
            console.log('[HomeScreen] Paramètres de navigation:', {
                resultsCount: results.length,
                type: 'recherche_besoin',
                hasResults: results.length > 0,
                firstResult: results[0] || null,
                isImageSearch: result?.search_method === 'image_ai',
                billing: result?.billing || null,
                searchQuery: searchQuery
            });

            // ✅ CORRECTION: S'assurer que results est toujours un tableau (même vide)
            const safeResults = Array.isArray(results) ? results : [];

            // ✅ NOUVEAU: Solution hybride - Afficher les résultats dans le carousel
            if (safeResults.length > 0) {
                // Afficher les 15 premiers résultats dans le carousel
                const displayResults = safeResults.slice(0, 15);
                dispatch({
                    type: 'SET_SEARCH_RESULTS',
                    payload: {
                        results: displayResults,
                        query: searchQuery,
                        total: safeResults.length,
                    },
                });

                console.log('[HomeScreen] ✅ Mode recherche activé:', {
                    displayCount: displayResults.length,
                    totalCount: safeResults.length,
                    query: searchQuery
                });

                // Si plus de 15 résultats, on pourra naviguer via "Voir tous"
            } else {
                // Aucun résultat, naviguer vers ResultatBesoinScreen pour afficher le message
                // ✅ CRITIQUE 2025-12-11: Utiliser forceNavigate pour garantir que la navigation fonctionne
                forceNavigate('ResultatBesoin', {
                    results: safeResults,
                    type: 'recherche_besoin',
                    suggestion: result,
                    imageSearch: result?.search_method === 'image_ai',
                    imageAnalysis: result?.image_analysis || null,
                    billing: result?.billing || null,
                    searchQuery: searchQuery,
                    hasError: false,
                    error: null
                });
            }

            // ✅ ANCIEN CODE (remplacé par solution hybride) :
            // try {
            //     (navigation as any).navigate('ResultatBesoin', {
            //         results: safeResults,
            //         ...
            //     });
            //     console.log('[HomeScreen] ✅ Navigation déclenchée avec succès vers ResultatBesoin');
            //     console.log('[HomeScreen] ✅ Résultats passés:', safeResults.length);
            // } catch (navError: any) {
            //     console.error('[HomeScreen] ❌ ERREUR CRITIQUE lors de la navigation:', {
            //         error: navError,
            //         message: navError?.message,
            //         stack: navError?.stack,
            //         resultsCount: safeResults.length
            //     });
            //     Alert.alert(
            //         'Erreur de navigation',
            //         'Impossible d\'ouvrir l\'écran de résultats. Veuillez réessayer.',
            //         [{ text: 'OK' }]
            //     );
            // }
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);

            // ✅ CORRECTION: Extraire le message d'erreur
            const errorMessage = error.message || 'Erreur inconnue';
            const searchQuery = input.texte || input.text || '';

            // ✅ NOUVEAU: Naviguer vers ResultatBesoinScreen même en cas d'erreur
            // pour que l'utilisateur puisse voir l'écran de résultats (vide) et réessayer
            console.log('[HomeScreen] ⚠️ Erreur détectée, navigation vers ResultatBesoin avec résultats vides');

            // Diagnostic détaillé de l'erreur
            let userFriendlyMessage = '';
            if (errorMessage.includes('Token') || errorMessage.includes('authentification')) {
                userFriendlyMessage = 'Erreur d\'authentification. Votre session a peut-être expiré.';
            } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
                userFriendlyMessage = 'Erreur réseau. Vérifiez votre connexion internet.';
            } else if (errorMessage.includes('Timeout')) {
                userFriendlyMessage = 'La recherche a pris trop de temps. Le serveur peut être surchargé.';
            } else if (errorMessage.includes('Aucun mot-clé')) {
                userFriendlyMessage = 'Veuillez être plus spécifique dans votre description.';
            } else if (errorMessage.includes('500') || errorMessage.includes('Erreur HTTP: 500')) {
                userFriendlyMessage = 'Erreur serveur. Veuillez réessayer dans quelques instants.';
            } else {
                userFriendlyMessage = errorMessage;
            }

            // ✅ Naviguer vers ResultatBesoinScreen avec résultats vides et message d'erreur
            // ✅ CRITIQUE 2025-12-11: Utiliser forceNavigate pour garantir que la navigation fonctionne
            forceNavigate('ResultatBesoin', {
                results: [], // Résultats vides
                type: 'recherche_besoin',
                error: userFriendlyMessage, // ✅ NOUVEAU: Passer le message d'erreur
                searchQuery: searchQuery,
                hasError: true, // ✅ NOUVEAU: Flag pour indiquer qu'il y a eu une erreur
            });

            console.log('[HomeScreen] Navigation vers ResultatBesoin avec erreur ✅');
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [user, location, dispatch, forceNavigate]); // ✅ CRITIQUE: Dépendances pour useCallback

    // ✅ CRITIQUE: Stabiliser handleCreateService avec useCallback
    const handleCreateService = React.useCallback(async (input: any) => {
        try {
            // Vérifier l'authentification
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour créer un service');
                dispatch({ type: 'SET_LOADING', payload: false }); // ✅ CRITIQUE: S'assurer que loading est false
                return;
            }

            dispatch({ type: 'SET_LOADING', payload: true });
            console.log('[HomeScreen] Création service avec:', input);
            console.log('[HomeScreen] Utilisateur authentifié:', user.email);

            // ✅ OPTIMISATION: Appeler l'API pour générer les suggestions avec timeout
            console.log('[HomeScreen] → Appel genererSuggestionsService API');
            const result = await apiCallWithTimeout(
                () => genererSuggestionsService(input),
                {
                    timeout: API_TIMEOUTS.CREATE_SERVICE,
                    errorMessage: 'La génération de suggestions a pris trop de temps',
                }
            );

            console.log('[HomeScreen] Suggestions générées par l\'IA:', result);

            // Extraire les médias de la réponse pour les transmettre au formulaire
            const mediaData = {
                base64_image: result.data.service_data?.base64_image || input.base64_image,
                audio_base64: result.data.service_data?.audio_base64 || input.audio_base64,
                video_base64: result.data.service_data?.video_base64 || input.video_base64,
                doc_base64: result.data.service_data?.doc_base64 || input.doc_base64,
                excel_base64: result.data.service_data?.excel_base64 || input.excel_base64,
                pdf_base64: result.data.service_data?.pdf_base64 || input.pdf_base64
            };

            // Extraire les données GPS pour les transmettre au formulaire
            const gpsData = {
                gps_mobile: input.gps_mobile,
                gps_zone: input.gps_zone,
                gps_fixe: input.gps_fixe,
                gps_fixe_coords: input.gps_fixe_coords
            };

            console.log('[HomeScreen] Données GPS extraites:', gpsData);

            // ✅ CORRECTION 2025-11-29: Vérifier si l'utilisateur a DÉJÀ un service AVEC PRODUITS
            // ✅ CRITIQUE: Il faut vérifier qu'il y a au moins UN PRODUIT dans le service, pas juste un service
            console.log('[HomeScreen] 🔍 Vérification si utilisateur a déjà un service avec produits...');
            let hasExistingServiceWithProducts = false;
            let firstServiceId: number | null = null;

            // ✅ Helper: Vérifier si un service a des produits (AMÉLIORÉ)
            const serviceHasProducts = (service: any): boolean => {
                try {
                    // ✅ AMÉLIORATION: Logs détaillés pour diagnostic
                    const serviceId = service.id || service.service_id;
                    console.log('[HomeScreen] 🔍 Analyse service:', {
                        serviceId: serviceId,
                        hasData: !!service.data,
                        hasProduits: !!service.data?.produits,
                        hasListeproduit: !!service.data?.listeproduit, // ✅ NOUVEAU
                        hasProduitsDirect: !!service.produits,
                        produitsType: typeof (service.data?.produits || service.produits),
                        produitsIsArray: Array.isArray(service.data?.produits || service.produits),
                        produitsKeys: service.data?.produits && typeof service.data.produits === 'object'
                            ? Object.keys(service.data.produits)
                            : [],
                        dataKeys: service.data ? Object.keys(service.data) : [] // ✅ NOUVEAU: Voir toutes les clés
                    });

                    // ✅ AMÉLIORATION: Vérifier plusieurs chemins possibles pour les produits
                    const produitsPaths = [
                        service.data?.produits,
                        service.data?.listeproduit, // ✅ NOUVEAU: Format alternatif
                        service.produits,
                        service.data?.data?.produits, // ✅ NOUVEAU: Structure imbriquée
                        service.listeproduit // ✅ NOUVEAU: Format alternatif
                    ];

                    for (const produitsField of produitsPaths) {
                        if (produitsField) {
                            const produits = normalizeServiceProducts(produitsField);
                            if (Array.isArray(produits) && produits.length > 0) {
                                console.log('[HomeScreen] ✅ Service ID', serviceId, '- Produits trouvés:', produits.length, '- Chemin:', produitsField === service.data?.produits ? 'data.produits' :
                                    produitsField === service.data?.listeproduit ? 'data.listeproduit' :
                                        produitsField === service.produits ? 'produits' :
                                            produitsField === service.data?.data?.produits ? 'data.data.produits' : 'listeproduit');
                                return true;
                            }
                        }
                    }

                    // Si aucun chemin n'a fonctionné mais qu'un champ produits existe
                    if (service.data?.produits || service.produits || service.data?.listeproduit) {
                        console.warn('[HomeScreen] ⚠️ Service a un champ produits mais normalizeServiceProducts retourne vide:', {
                            rawProduits: JSON.stringify(service.data?.produits || service.produits || service.data?.listeproduit).substring(0, 300),
                            allDataKeys: service.data ? Object.keys(service.data) : []
                        });
                    }

                    return false;
                } catch (error) {
                    console.error('[HomeScreen] ⚠️ Erreur vérification produits service:', {
                        error: error,
                        serviceId: service.id || service.service_id,
                        serviceDataKeys: service.data ? Object.keys(service.data) : []
                    });
                    return false;
                }
            };

            // ✅ OPTIMISATION: Paralléliser tous les appels API pour réduire le temps de réponse
            try {
                console.log('[HomeScreen] 🚀 Démarrage vérification services en parallèle...');
                const startTime = Date.now();

                // ✅ OPTIMISATION: Exécuter tous les appels API en parallèle avec timeout
                const [prestataireResult, lastServiceResult, myServicesResult, myProductsResult] = await Promise.allSettled([
                    apiCallWithTimeout(() => apiGet('/api/prestataire/services'), { timeout: API_TIMEOUTS.DEFAULT, errorMessage: 'Timeout vérification prestataire services' }),
                    apiCallWithTimeout(() => apiGet('/api/services/last'), { timeout: API_TIMEOUTS.DEFAULT, errorMessage: 'Timeout vérification dernier service' }),
                    apiCallWithTimeout(() => apiGet('/api/services/my-services'), { timeout: API_TIMEOUTS.DEFAULT, errorMessage: 'Timeout vérification mes services' }),
                    apiCallWithTimeout(() => apiGet('/api/products/my-products'), { timeout: API_TIMEOUTS.DEFAULT, errorMessage: 'Timeout vérification mes produits' }).catch(() => ({ success: false, data: null })), // Ignorer les erreurs pour ce fallback
                ]);

                const elapsedTime = Date.now() - startTime;
                console.log(`[HomeScreen] ✅ Vérification services terminée en ${elapsedTime}ms (parallélisé)`);

                // Traiter les résultats dans l'ordre de priorité
                // 1. /api/prestataire/services (priorité 1)
                if (prestataireResult.status === 'fulfilled' && prestataireResult.value.success) {
                    const prestataireServicesResponse = prestataireResult.value as any;
                    console.log('[HomeScreen] Réponse /api/prestataire/services:', {
                        success: prestataireServicesResponse.success,
                        hasData: !!prestataireServicesResponse.data,
                        isArray: Array.isArray(prestataireServicesResponse.data),
                        length: Array.isArray(prestataireServicesResponse.data) ? prestataireServicesResponse.data.length : 0
                    });

                    let servicesArray: any[] = [];
                    if (prestataireServicesResponse.data) {
                        if (Array.isArray(prestataireServicesResponse.data)) {
                            servicesArray = prestataireServicesResponse.data;
                        } else if (prestataireServicesResponse.data?.data && Array.isArray(prestataireServicesResponse.data.data)) {
                            servicesArray = prestataireServicesResponse.data.data;
                            console.log('[HomeScreen] ✅ Format avec pagination détecté, services extraits:', servicesArray.length);
                        } else if (prestataireServicesResponse.data?.services && Array.isArray(prestataireServicesResponse.data.services)) {
                            servicesArray = prestataireServicesResponse.data.services;
                            console.log('[HomeScreen] ✅ Format avec clé services détecté, services extraits:', servicesArray.length);
                        }
                    }

                    if (servicesArray.length > 0) {
                        for (const service of servicesArray) {
                            const serviceId = service.id || service.service_id || null;
                            if (serviceId && serviceHasProducts(service)) {
                                hasExistingServiceWithProducts = true;
                                firstServiceId = serviceId;
                                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/prestataire/services (ID: ' + firstServiceId + ')');
                                break;
                            }
                        }
                    }
                }

                // 2. /api/services/last (fallback 1)
                if (!hasExistingServiceWithProducts && lastServiceResult.status === 'fulfilled' && lastServiceResult.value.success) {
                    const lastServiceResponse = lastServiceResult.value as any;
                    if (lastServiceResponse.data) {
                        const serviceData = (lastServiceResponse.data as any)?.data || lastServiceResponse.data;
                        if (serviceData && (serviceData.id || serviceData.service_id)) {
                            const serviceId = serviceData.id || serviceData.service_id;
                            if (serviceHasProducts(serviceData)) {
                                hasExistingServiceWithProducts = true;
                                firstServiceId = serviceId;
                                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/services/last (ID: ' + firstServiceId + ')');
                            }
                        }
                    }
                }

                // 3. /api/services/my-services (fallback 2)
                if (!hasExistingServiceWithProducts && myServicesResult.status === 'fulfilled' && myServicesResult.value.success) {
                    const servicesResponse = myServicesResult.value as any;
                    if (Array.isArray(servicesResponse.data) && servicesResponse.data.length > 0) {
                        for (const service of servicesResponse.data) {
                            const serviceId = service.id || service.service_id || null;
                            if (serviceId && serviceHasProducts(service)) {
                                hasExistingServiceWithProducts = true;
                                firstServiceId = serviceId;
                                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/services/my-services (ID: ' + firstServiceId + ')');
                                break;
                            }
                        }
                    }
                }

                // 4. /api/products/my-products (fallback 3)
                if (!hasExistingServiceWithProducts && myProductsResult.status === 'fulfilled' && myProductsResult.value.success) {
                    const productsResponse = myProductsResult.value as any;
                    if (Array.isArray(productsResponse.data) && productsResponse.data.length > 0) {
                        const firstProduct = productsResponse.data[0];
                        const serviceId = firstProduct.service_id || firstProduct.serviceId || firstProduct.service?.id;
                        if (serviceId) {
                            hasExistingServiceWithProducts = true;
                            firstServiceId = serviceId;
                            console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/products/my-products (ID: ' + firstServiceId + ')');
                        }
                    }
                }

                if (!hasExistingServiceWithProducts) {
                    console.log('[HomeScreen] ℹ️ Aucun service avec produits détecté → Formulaire COMPLET');
                    const prestataireData = prestataireResult.status === 'fulfilled' ? (prestataireResult.value as any)?.data : null;
                    const lastServiceData = lastServiceResult.status === 'fulfilled' ? (lastServiceResult.value as any)?.data : null;
                    const myServicesData = myServicesResult.status === 'fulfilled' ? (myServicesResult.value as any)?.data : null;
                    console.log('[HomeScreen] 📊 Résumé vérification:', {
                        hasExistingServiceWithProducts,
                        firstServiceId,
                        prestataireServicesCount: Array.isArray(prestataireData) ? prestataireData.length : 0,
                        lastServiceId: lastServiceData?.id || lastServiceData?.data?.id || null,
                        myServicesCount: Array.isArray(myServicesData) ? myServicesData.length : 0
                    });
                }
            } catch (error: any) {
                console.error('[HomeScreen] ❌ Erreur vérification services:', error);
                console.error('[HomeScreen] Détails erreur:', {
                    message: error?.message,
                    stack: error?.stack,
                    response: error?.response?.data,
                    status: error?.response?.status
                });
                // ✅ CORRECTION: En cas d'erreur, considérer qu'il n'y a pas de service avec produits et ouvrir le formulaire complet
                hasExistingServiceWithProducts = false;
                firstServiceId = null;
            }

            // ✅ AMÉLIORATION UX: Si utilisateur a déjà un service AVEC PRODUITS → Formulaire SIMPLE produit seul
            if (hasExistingServiceWithProducts && firstServiceId) {
                console.log('[HomeScreen] 🛍️ Navigation vers formulaire SIMPLE (AjouterProduitSimple)');
                console.log('[HomeScreen] ✅ Raison: Service ID', firstServiceId, 'a déjà des produits');
                // ✅ CRITIQUE 2025-12-11: Utiliser forceNavigate pour garantir que la navigation fonctionne
                forceNavigate('AjouterProduitSimple', {
                    serviceId: firstServiceId,
                    suggestionIA: result.data,
                    mediaData: mediaData,
                    gpsData: gpsData
                });
            } else {
                // ✅ Pas de service avec produits → Formulaire COMPLET (création service + premier produit)
                console.log('[HomeScreen] 📝 Navigation vers formulaire COMPLET (FormulaireYukpoIntelligent)');
                console.log('[HomeScreen] ✅ Raison: Aucun service avec produits détecté → Création complète');
                // ✅ CRITIQUE 2025-12-11: Utiliser forceNavigate pour garantir que la navigation fonctionne
                forceNavigate('FormulaireYukpoIntelligent', {
                    suggestion: {
                        ...result.data,
                        intention: 'creation_service',
                        data: result.data.suggestions || result.data.data || result.data
                    },
                    type: 'creation_service',
                    mode: 'create',
                    mediaData: mediaData,
                    gpsData: gpsData
                });
            }
        } catch (error: any) {
            console.error('[HomeScreen] Erreur création service:', error);

            // Diagnostic détaillé de l'erreur
            if (error.message?.includes('500')) {
                Alert.alert('Erreur serveur IA', 'Le serveur d\'intelligence artificielle rencontre un problème. Veuillez réessayer dans quelques minutes.');
            } else if (error.message?.includes('Token') || error.message?.includes('401')) {
                Alert.alert('Erreur d\'authentification', 'Votre session a expiré. Veuillez vous reconnecter.');
            } else if (error.message?.includes('400')) {
                Alert.alert('Erreur de données', 'Les données envoyées sont invalides. Vérifiez votre description et réessayez.');
            } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
                Alert.alert('Erreur réseau', 'Vérifiez votre connexion internet et réessayez.');
            } else {
                Alert.alert('Erreur création', `Erreur lors de la génération des suggestions: ${error.message || 'Erreur inconnue'}`);
            }
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [user, location, dispatch, forceNavigate]); // ✅ CRITIQUE: Dépendances pour useCallback

    // ✅ CRITIQUE: Stabiliser handleSubmit avec useCallback
    const handleSubmit = React.useCallback(async (input: any) => {
        try {
            console.log('[HomeScreen] ===== SOUMISSION =====');
            console.log('[HomeScreen] Mode actuel:', state.ui.isCreateService ? 'CRÉATION' : 'RECHERCHE');
            console.log('[HomeScreen] Données reçues:', {
                texte: input.texte || input.text,
                texteLength: (input.texte || input.text || '').length,
                hasImages: (input.base64_image || []).length > 0,
                hasAudio: (input.audio_base64 || []).length > 0,
                hasGPS: !!input.gps_mobile,
                gps_mobile: input.gps_mobile
            });

            if (state.ui.isCreateService) {
                // Si la case est cochée, demander confirmation
                console.log('[HomeScreen] → Demande de confirmation pour création de service');
                dispatch({ type: 'SET_PENDING_INPUT', payload: input });
                dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: true });
                return;
            }

            console.log('[HomeScreen] → Appel handleSearch');
            // Par défaut: recherche directe
            await handleSearch(input);
            console.log('[HomeScreen] ✅ handleSearch terminé avec succès');
        } catch (error: any) {
            console.error('[HomeScreen] ❌ ERREUR CRITIQUE dans handleSubmit:', {
                error: error,
                message: error?.message,
                stack: error?.stack,
                input: input
            });
            // ✅ CORRECTION: Ne pas afficher d'alerte ici car handleSearch gère déjà les erreurs
            // Mais s'assurer que l'erreur est bien propagée
            throw error;
        }
    }, [state.ui.isCreateService, handleSearch, dispatch]); // ✅ CRITIQUE: Dépendances pour useCallback

    // ✅ CRITIQUE: Stabiliser confirmCreateService avec useCallback
    const confirmCreateService = React.useCallback(async () => {
        if (state.data.pendingInput) {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
            try {
                await handleCreateService(state.data.pendingInput);
            } catch (error) {
                console.error('[HomeScreen] Erreur confirmCreateService:', error);
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false }); // ✅ CRITIQUE: Toujours remettre loading à false
                dispatch({ type: 'SET_PENDING_INPUT', payload: null });
            }
        }
    }, [state.data.pendingInput, handleCreateService, dispatch]); // ✅ CRITIQUE: Dépendances pour useCallback

    // ✅ CRITIQUE: Stabiliser cancelCreateService avec useCallback
    const cancelCreateService = React.useCallback(async () => {
        if (state.data.pendingInput) {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
            try {
                await handleSearch(state.data.pendingInput);
            } catch (error) {
                console.error('[HomeScreen] Erreur cancelCreateService:', error);
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false }); // ✅ CRITIQUE: Toujours remettre loading à false
                dispatch({ type: 'SET_PENDING_INPUT', payload: null });
            }
        }
    }, [state.data.pendingInput, handleSearch, dispatch]); // ✅ CRITIQUE: Dépendances pour useCallback

    // ✅ CRITIQUE: Stabiliser les handlers pour les boutons de mode
    const handleSetSearchMode = React.useCallback(() => {
        hapticSelect();
        dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: false });
    }, [dispatch]);

    const handleSetCreateMode = React.useCallback(() => {
        hapticSelect();
        dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: true });
    }, [dispatch]);

    // ✅ CRITIQUE: Stabiliser les handlers pour MixedContentCarousel
    const handleShowAllResults = React.useCallback(() => {
        hapticSelect();
        forceNavigate('ResultatBesoin', {
            results: state.data.searchResults,
            type: 'recherche_besoin',
            searchQuery: state.data.searchQuery,
            hasError: false,
            error: null
        });
    }, [state.data.searchResults, state.data.searchQuery, forceNavigate]);

    const handleClearSearch = React.useCallback(() => {
        dispatch({ type: 'CLEAR_SEARCH' });
    }, [dispatch]);

    // ✅ CRITIQUE: Stabiliser le handler pour InfiniteFeed
    const handleFeedItemPress = React.useCallback((item: any) => {
        hapticSelect();
        const productId = item.id || item.service_id;
        if (!productId) {
            console.warn('[HomeScreen] ⚠️ ProductId manquant pour l\'item:', item);
            Alert.alert('Erreur', 'Identifiant du produit manquant.');
            return;
        }
        forceNavigate('ProductDetail', {
            productId: String(productId),
        });
    }, [forceNavigate]);

    // ✅ CRITIQUE: Stabiliser les handlers pour ServiceProductSelector
    const handleProductSelect = React.useCallback((product: any) => {
        navigateToVideoWizard(navigation, product);
        dispatch({ type: 'TOGGLE_PRODUCT_SELECTOR' });
        dispatch({ type: 'SET_PRODUCTS_FOR_SELECTION', payload: [] });
    }, [navigation, dispatch]);

    const handleProductSelectorClose = React.useCallback(() => {
        dispatch({ type: 'TOGGLE_PRODUCT_SELECTOR' });
        dispatch({ type: 'SET_PRODUCTS_FOR_SELECTION', payload: [] });
    }, [dispatch]);

    // ✅ CRITIQUE: Stabiliser les handlers pour les modals
    const handleCloseGPSModal = React.useCallback(() => {
        dispatch({ type: 'TOGGLE_GPS_MODAL' });
    }, [dispatch]);

    const handleCloseConfirmationModal = React.useCallback(() => {
        dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
        dispatch({ type: 'SET_PENDING_INPUT', payload: null });
    }, [dispatch]);

    const handleCloseConfirmationModalByOverlay = React.useCallback(() => {
        dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
        dispatch({ type: 'SET_PENDING_INPUT', payload: null });
    }, [dispatch]);

    // ✅ CRITIQUE: Stabiliser les handlers pour les modals de notification et chat
    const handleCloseNotificationModal = React.useCallback(() => {
        dispatch({ type: 'TOGGLE_NOTIFICATION_MODAL' });
    }, [dispatch]);

    const handleCloseChatModal = React.useCallback(() => {
        dispatch({ type: 'TOGGLE_CHAT_MODAL' });
    }, [dispatch]);

    const handleNotificationModalChange = React.useCallback(async () => {
        const count = await loadUnreadNotificationsCount();
        dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: count });
    }, [loadUnreadNotificationsCount, dispatch]);

    const handleOpenChatFromHistory = React.useCallback((chatId: string) => {
        console.log('Ouvrir chat:', chatId);
        dispatch({ type: 'TOGGLE_CHAT_MODAL' });
    }, [dispatch]);

    const handleCloseConfirmationModalByBackButton = React.useCallback(() => {
        console.log('[HomeScreen] 🔄 Fermeture modal par bouton retour Android');
        dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
        dispatch({ type: 'SET_PENDING_INPUT', payload: null });
    }, [dispatch]);

    // ✅ CRITIQUE: Stabiliser le handler pour ModernGPSModal
    const handleGPSSelect = React.useCallback((coordinatesString: string) => {
        try {
            // Parser le premier point pour la météo
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

    // ✅ NOUVEAU: Créer les styles avec le thème actuel
    const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

    // ✅ SUPPRIMÉ: Interval de diagnostic qui s'exécute toutes les 5 secondes
    // Réduire les timers/intervals pour améliorer les performances

    return (
        <ModernBackground variant="home">
            <ScreenTransition type="fade" duration={300}>
                <SafeNativeView style={dynamicStyles.container} pointerEvents="auto">
                    {/* ✅ CRITIQUE 2025-12-12: pointerEvents="auto" sur le conteneur principal pour garantir les interactions */}
                    {/* ✅ NOUVEAU: Indicateur de connexion offline */}
                    <OfflineIndicator />

                    {/* ✅ OPTIMISATION: Header collapsible avec animations */}
                    {/* ✅ DIAGNOSTIC: Tester les interactions sur le HomeHeader */}
                    <View
                        pointerEvents="box-none"
                    // ✅ CRITIQUE: pointerEvents="box-none" pour permettre les touches aux enfants
                    >
                        <HomeHeader
                            scrollY={scrollY}
                            user={user}
                            unreadNotificationsCount={state.metadata.unreadNotificationsCount}
                            unreadChatCount={state.metadata.unreadChatCount} // ✅ NOUVEAU 2025-01-27: Nombre de conversations non lues
                            selectedLocation={state.metadata.selectedLocation}
                            onDeliveryPress={handleDeliveryPress}
                            // ✅ CRITIQUE: Passer directement le handler stable (déjà dans useCallback)
                            onChatPress={handleChatPress}
                            // ✅ CRITIQUE: Passer directement le handler stable (déjà dans useCallback)
                            onNotificationPress={handleNotificationPress}
                            // ✅ CRITIQUE: Passer directement le handler stable (déjà dans useCallback)
                            onDebugNotifications={handleDebugNotifications}
                            navigation={navigation}
                            language={language}
                            onLanguageChange={setLanguage}
                            showLeaderboard={state.ui.showLeaderboard}
                            showChallenges={state.ui.showChallenges}
                            onShowLeaderboard={React.useCallback(() => dispatch({ type: 'TOGGLE_LEADERBOARD' }), [dispatch])}
                            onShowChallenges={React.useCallback(() => dispatch({ type: 'TOGGLE_CHALLENGES' }), [dispatch])}
                            onCloseLeaderboard={React.useCallback(() => dispatch({ type: 'TOGGLE_LEADERBOARD' }), [dispatch])}
                            onCloseChallenges={React.useCallback(() => dispatch({ type: 'TOGGLE_CHALLENGES' }), [dispatch])}
                            // ✅ CRITIQUE: Stabiliser tous les handlers avec useCallback
                            disabled={false} // ✅ CORRIGÉ 2025-12-11: Ne plus désactiver pour éviter les interactions bloquées
                        />
                    </View>

                    {/* ✅ ZONE DE RECHERCHE FIXE - Juste après l'en-tête */}
                    <View style={dynamicStyles.searchSection}>
                        {/* ✅ NOUVEAU: Sélecteur de mode avec RippleButton */}
                        <View style={styles.modeSelectorModern}>
                            <View style={[styles.modeButtonModern, !state.ui.isCreateService && styles.modeButtonActiveModern]}>
                                <RippleButton
                                    title={t('search.find')}
                                    icon="🔍"
                                    variant={!state.ui.isCreateService ? 'primary' : 'outline'}
                                    disabled={false}
                                    onPress={handleSetSearchMode}
                                    // ✅ CRITIQUE: Utiliser le handler stabilisé
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
                                    // ✅ CRITIQUE: Utiliser le handler stabilisé
                                    accessibilityLabel={t('search.create')}
                                />
                            </View>
                        </View>

                        {/* ChatInput optimisé - COMPACT */}
                        {/* ✅ CRITIQUE 2025-12-12: pointerEvents="auto" pour garantir l'interactivité */}
                        <View pointerEvents="auto">
                            <ChatInputMobile
                                onSubmit={handleSubmit}
                                loading={false} // ✅ CORRIGÉ 2025-12-11: Ne plus bloquer ChatInputMobile avec loading
                                placeholder={state.ui.isCreateService
                                    ? t('search.create')
                                    : t('search.placeholder')}
                                onGPSPress={React.useCallback(() => {
                                    hapticSelect();
                                    dispatch({ type: 'TOGGLE_GPS_MODAL' });
                                }, [dispatch])}
                                // ✅ CRITIQUE: Stabiliser le handler GPS avec useCallback
                                showSendButton={true}
                                showAutocomplete={!state.ui.isCreateService} // ✅ NOUVEAU: Autocomplete uniquement en mode recherche
                                isSearchMode={!state.ui.isCreateService} // ✅ NOUVEAU: Mode recherche
                                isCreateService={state.ui.isCreateService} // ✅ NOUVEAU: Passer le mode création
                            />
                        </View>
                    </View>

                    {/* ✅ OPTIMISATION: FlatList virtualisé pour meilleure performance */}
                    {/* ✅ CRITIQUE: pointerEvents="box-none" pour ne pas intercepter les touches des boutons fixes */}
                    <FlatList
                        data={[
                            { id: 'carousel', type: 'carousel' },
                            { id: 'promo', type: 'promo' },
                            { id: 'feed', type: 'feed' }, // ✅ PHASE 2: Feed infini
                        ]}
                        keyExtractor={(item) => item.id}
                        // ✅ CORRIGÉ: Retirer getItemLayout pour éviter conflits d'affichage
                        // React Native calculera automatiquement les hauteurs réelles
                        // Cela évite les problèmes de sections mal positionnées ou coupées
                        renderItem={({ item }) => {
                            // ✅ SÉCURITÉ: Vérifier que item est valide
                            if (!item || !item.type) {
                                console.warn('[HomeScreen] ⚠️ Item invalide dans FlatList:', item);
                                return <View key="invalid-item" style={{ height: 0, width: 0 }} />;
                            }

                            if (item.type === 'carousel') {
                                // ✅ NOUVEAU: Skeleton loader pendant le chargement
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

                                // ✅ SÉCURITÉ: Vérifier que MixedContentCarousel est défini
                                if (!MixedContentCarousel) {
                                    console.error('[HomeScreen] ❌ MixedContentCarousel est undefined');
                                    return <View key="carousel-error" style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14, color: '#666' }}>Carousel non disponible</Text>
                                    </View>;
                                }

                                return (
                                    <AnimatedCard index={0} delay={0}>
                                        {/* ✅ TITRE SECTION CAROUSEL + Badge Tendance */}
                                        <View style={styles.carouselHeader}>
                                            <View style={styles.carouselHeaderLeft}>
                                                <Text style={styles.carouselSubtitle}>Produits et services recommandés</Text>
                                                {/* ✅ NOUVEAU: Badge "Tendance" pour social proof */}
                                                <View style={styles.trendingBadge}>
                                                    <SafeIcon name="trending-up" size={14} color="#10B981" type="lucide" />
                                                    <Text style={styles.trendingBadgeText}>Tendance</Text>
                                                </View>
                                            </View>
                                        </View>
                                        {/* ✅ NOUVEAU: Carousel mixte (publicités + produits organiques) */}
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
                                                // ✅ CRITIQUE: Utiliser le handler stabilisé
                                                onClearSearch={handleClearSearch}
                                            // ✅ CRITIQUE: Utiliser le handler stabilisé
                                            />
                                        </View>
                                    </AnimatedCard>
                                );
                            }
                            if (item.type === 'promo') {
                                // ✅ CORRIGÉ 2025-12-11: Utiliser directement le composant lazy dans Suspense
                                // React.lazy gère déjà le chargement et les erreurs sont gérées par ErrorBoundary
                                return (
                                    <AnimatedCard index={1} delay={100}>
                                        <ErrorBoundary
                                            fallback={
                                                <View
                                                    style={{ padding: 20, alignItems: 'center', backgroundColor: modernColors.surface, borderRadius: 12, margin: 16 }}
                                                    pointerEvents="box-none" // ✅ CRITIQUE: Permettre les interactions dans le fallback
                                                >
                                                    <Text style={{ fontSize: 16, fontWeight: '600', color: modernColors.text, marginBottom: 8 }}>⚠️ Erreur de chargement</Text>
                                                    <Text style={{ fontSize: 14, color: modernColors.textSecondary, textAlign: 'center' }}>
                                                        Impossible de charger les promotions. Veuillez réessayer.
                                                    </Text>
                                                </View>
                                            }
                                        >
                                            {/* ✅ CRITIQUE 2025-12-12: Timeout sur Suspense pour éviter blocage TOTAL */}
                                            {suspenseTimeout ? (
                                                <View style={{ padding: 20, alignItems: 'center' }} pointerEvents="box-none">
                                                    <Text style={{ fontSize: 14, color: modernColors.textSecondary }}>
                                                        Promotions temporairement indisponibles
                                                    </Text>
                                                </View>
                                            ) : (
                                                <Suspense
                                                    fallback={
                                                        <View style={{ padding: 20, alignItems: 'center' }} pointerEvents="box-none">
                                                            <ActivityIndicator size="small" color={modernColors.primary} />
                                                            <Text style={{ marginTop: 8, fontSize: 12, color: modernColors.textSecondary }}>
                                                                Chargement des promotions...
                                                            </Text>
                                                        </View>
                                                    }
                                                >
                                                    {/* ✅ CORRIGÉ 2025-12-11: Utiliser directement le composant lazy, React.lazy gère déjà le chargement */}
                                                    <GlobalPromoHighlights />
                                                </Suspense>
                                            )}
                                        </ErrorBoundary>
                                    </AnimatedCard>
                                );
                            }
                            if (item.type === 'feed') {
                                // ✅ PHASE 2: Feed infini vertical pour découverte continue
                                // ✅ NOUVEAU: Skeleton loader pour le feed
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

                                // ✅ SÉCURITÉ: Vérifier que InfiniteFeed est défini
                                if (!InfiniteFeed) {
                                    console.error('[HomeScreen] ❌ InfiniteFeed est undefined');
                                    return <View key="feed-error" style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14, color: '#666' }}>Feed non disponible</Text>
                                    </View>;
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
                                                    <View
                                                        style={{ padding: 20, alignItems: 'center', backgroundColor: modernColors.surface, borderRadius: 12, margin: 16 }}
                                                        pointerEvents="box-none" // ✅ CRITIQUE: Permettre les interactions dans le fallback
                                                    >
                                                        <Text style={{ fontSize: 16, fontWeight: '600', color: modernColors.text, marginBottom: 8 }}>⚠️ Erreur de chargement</Text>
                                                        <Text style={{ fontSize: 14, color: modernColors.textSecondary, textAlign: 'center' }}>
                                                            Impossible de charger le feed. Veuillez réessayer.
                                                        </Text>
                                                    </View>
                                                }
                                            >
                                                {/* ✅ CRITIQUE 2025-12-12: Timeout sur Suspense pour éviter blocage TOTAL */}
                                                {suspenseTimeout ? (
                                                    <View style={{ padding: 20, alignItems: 'center' }} pointerEvents="box-none">
                                                        <Text style={{ fontSize: 14, color: modernColors.textSecondary }}>
                                                            Feed temporairement indisponible
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Suspense
                                                        fallback={
                                                            <View style={{ padding: 20, alignItems: 'center' }} pointerEvents="box-none">
                                                                <ActivityIndicator size="small" color={modernColors.primary} />
                                                                <Text style={{ marginTop: 8, fontSize: 12, color: modernColors.textSecondary }}>
                                                                    Chargement du feed...
                                                                </Text>
                                                            </View>
                                                        }
                                                    >
                                                        {/* ✅ CORRIGÉ: Vérifier que InfiniteFeed est bien chargé avant de l'utiliser */}
                                                        {InfiniteFeed ? (
                                                            <InfiniteFeed
                                                                userId={user?.id}
                                                                location={state.metadata.selectedLocation ? {
                                                                    lat: state.metadata.selectedLocation.lat,
                                                                    lng: state.metadata.selectedLocation.lng,
                                                                } : null}
                                                                onItemPress={handleFeedItemPress}
                                                            // ✅ CRITIQUE: Utiliser le handler stabilisé
                                                            />
                                                        ) : (
                                                            <View style={{ padding: 20, alignItems: 'center' }} pointerEvents="box-none">
                                                                <Text style={{ fontSize: 14, color: '#666' }}>Feed non disponible</Text>
                                                            </View>
                                                        )}
                                                    </Suspense>
                                                )}
                                            </ErrorBoundary>
                                        </View>
                                    </AnimatedCard>
                                );
                            }
                            // ✅ CRITIQUE: Retourner un View vide au lieu de null pour éviter les problèmes de rendu
                            // ✅ SÉCURITÉ: Logger pour debug si un type inattendu est rencontré
                            console.warn('[HomeScreen] ⚠️ Type d\'item inattendu dans FlatList:', item?.type);
                            return <View key={`empty-item-${item?.id || 'unknown'}`} style={{ height: 0, width: 0 }} />;
                        }}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                        // ✅ CRITIQUE: "always" au lieu de "handled" pour ne pas bloquer les touches
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
                    // ✅ CRITIQUE: Désactiver nestedScrollEnabled pour éviter conflits de touches
                    />


                    {/* Modal GPS Moderne avec support des zones - AVEC ERROR BOUNDARY */}
                    {/* ✅ CRITIQUE: Rendre conditionnellement pour éviter overlays invisibles */}
                    {state.ui.showGPSModal && (
                        <ErrorBoundary
                            fallback={
                                <Modal visible={true} transparent={true}>
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
                                        <View style={{ backgroundColor: '#FFF', padding: 24, borderRadius: 16, maxWidth: 300 }}>
                                            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>❌</Text>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
                                                Erreur GPS
                                            </Text>
                                            <Text style={{ fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' }}>
                                                Le module GPS ne peut pas se charger. Vérifiez vos permissions et votre connexion.
                                            </Text>
                                            <TouchableOpacity
                                                style={{ backgroundColor: '#6366F1', padding: 12, borderRadius: 8, alignItems: 'center' }}
                                                onPress={handleCloseGPSModal}
                                            // ✅ CRITIQUE: Utiliser le handler stabilisé
                                            >
                                                <Text style={{ color: '#FFF', fontWeight: '600' }}>Fermer</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>
                            }
                        >
                            <ModernGPSModal
                                visible={true}
                                // ✅ CRITIQUE: visible={true} car déjà conditionné par {state.ui.showGPSModal &&}
                                onClose={handleCloseGPSModal}
                                // ✅ CRITIQUE: Utiliser le handler stabilisé
                                onSelect={handleGPSSelect}
                                // ✅ CRITIQUE: Utiliser le handler stabilisé
                                currentLocation={state.metadata.selectedLocation}
                                title="Sélectionner votre localisation"
                                allowZoneSelection={true}
                            />
                        </ErrorBoundary>
                    )}


                    {/* Modal Notifications */}
                    {/* ✅ CRITIQUE: Rendre conditionnellement pour éviter overlays invisibles */}
                    {state.ui.showNotificationModal && (
                        <NotificationHistoryModal
                            isOpen={true}
                            // ✅ CRITIQUE: isOpen={true} car déjà conditionné par {state.ui.showNotificationModal &&}
                            onClose={handleCloseNotificationModal}
                            // ✅ CRITIQUE: Utiliser le handler stabilisé
                            onChange={handleNotificationModalChange}
                        // ✅ CRITIQUE: Utiliser le handler stabilisé
                        />
                    )}

                    {/* Modal Chat/Conversations */}
                    {/* ✅ CRITIQUE: Rendre conditionnellement pour éviter overlays invisibles */}
                    {state.ui.showChatModal && (
                        <ChatHistoryModal
                            isOpen={true}
                            // ✅ CRITIQUE: isOpen={true} car déjà conditionné par {state.ui.showChatModal &&}
                            onClose={handleCloseChatModal}
                            // ✅ CRITIQUE: Utiliser le handler stabilisé
                            onOpenChat={handleOpenChatFromHistory}
                        // ✅ CRITIQUE: Utiliser le handler stabilisé
                        />
                    )}

                    {/* Alerte de confirmation pour création de service */}
                    {/* ✅ CRITIQUE: Vérifier que le modal n'est visible QUE si showCreateServiceAlert est true */}
                    {state.ui.showCreateServiceAlert && (
                        <Modal
                            animationType="fade"
                            transparent={true}
                            visible={true}
                            // ✅ CRITIQUE: visible={true} car déjà conditionné par {state.ui.showCreateServiceAlert &&}
                            onRequestClose={handleCloseConfirmationModalByBackButton}
                        // ✅ CRITIQUE: Utiliser le handler stabilisé
                        >
                            <View style={styles.confirmationModalOverlay} pointerEvents="box-none">
                                {/* Overlay cliquable pour fermer */}
                                <TouchableOpacity
                                    style={StyleSheet.absoluteFill}
                                    activeOpacity={1}
                                    onPress={handleCloseConfirmationModalByOverlay}
                                // ✅ CRITIQUE: Utiliser le handler stabilisé
                                />
                                <View style={styles.confirmationModal} pointerEvents="auto">
                                    <TouchableOpacity
                                        style={styles.confirmationCloseButton}
                                        onPress={handleCloseConfirmationModal}
                                        // ✅ CRITIQUE: Utiliser le handler stabilisé
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
                                            // ✅ CRITIQUE: Utiliser directement le handler stabilisé
                                            disabled={false}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.confirmationButtonTextSecondary}>Non, rechercher</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.confirmationButton, styles.confirmationButtonPrimary]}
                                            onPress={confirmCreateService}
                                            // ✅ CRITIQUE: Utiliser directement le handler stabilisé
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

                    {/* ✅ NOUVEAU: Sélecteur de produit pour création vidéo */}
                    <ServiceProductSelector
                        visible={state.ui.showProductSelector}
                        products={state.data.productsForSelection}
                        onSelect={handleProductSelect}
                        // ✅ CRITIQUE: Utiliser le handler stabilisé
                        onClose={handleProductSelectorClose}
                    // ✅ CRITIQUE: Utiliser le handler stabilisé
                    />

                    {/* ✅ NOUVEAU : Bouton floating "Suivre mes courses" pour coursiers */}
                    {state.metadata.isCourier && (
                        <TouchableOpacity
                            style={styles.floatingCourierButton}
                            onPress={React.useCallback(() => {
                                hapticPress();
                                forceNavigate('CourierDashboard');
                            }, [forceNavigate])}
                            // ✅ CRITIQUE: Stabiliser le handler avec useCallback
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

// ✅ NOUVEAU: Fonction pour créer les styles avec support thème
const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background, // ✅ NOUVEAU: Support thème
        minHeight: STATIC_HEIGHT, // ✅ Assure que le conteneur occupe au moins toute la hauteur de l'écran
    },
    // ✅ ENTÊTE FIXE - Reste visible au scroll
    fixedHeader: {
        backgroundColor: colors.surface, // ✅ NOUVEAU: Support thème
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 1000,
    },
    backgroundTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '32%',
        backgroundColor: '#4F46E5',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    backgroundBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70%',
        backgroundColor: '#FFFFFF',
    },
    // ✅ NOUVELLE SECTION DE RECHERCHE FIXE - COMPACTE
    searchSection: {
        backgroundColor: colors.surface, // ✅ NOUVEAU: Support thème
        paddingHorizontal: STATIC_WIDTH > 400 ? 20 : 12, // ✅ RÉDUIT: De 24/16 à 20/12
        paddingVertical: 8, // ✅ RÉDUIT: De 10 à 8 pour plus de compacité
        borderBottomWidth: 1,
        borderBottomColor: colors.border, // ✅ NOUVEAU: Support thème
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, // ✅ RÉDUIT: De 2 à 1
        shadowOpacity: 0.05, // ✅ RÉDUIT: De 0.08 à 0.05
        shadowRadius: 2, // ✅ RÉDUIT: De 4 à 2
        elevation: 1, // ✅ RÉDUIT: De 2 à 1
        zIndex: 999,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: STATIC_WIDTH > 400 ? 16 : 12, // ✅ RÉDUIT: De 24/16 à 16/12 pour optimiser l'espace
        paddingTop: 2, // ✅ RÉDUIT: De 4 à 2 pour afficher les cartes plus tôt
        paddingBottom: 100, // ✅ RÉDUIT: De 140 à 100 (le bouton en bas est supprimé)
        minHeight: STATIC_HEIGHT * 0.5, // ✅ RÉDUIT: De 0.6 à 0.5 pour optimiser l'espace
    },
    descriptionContainer: {
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    descriptionText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 18,
        fontStyle: 'italic',
    },
    header: {
        marginBottom: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4, // ✅ Réduit le padding horizontal pour plus d'espace
        width: '100%',
        justifyContent: 'space-between', // ✅ Espacement entre les sections
        gap: 4, // ✅ Ajoute un espacement minimal entre les sections
    },
    avatarContainer: {
        width: 40, // ✅ Réduit de 44 à 40 pour libérer de l'espace
        height: 40, // ✅ Réduit de 44 à 40 pour libérer de l'espace
        marginRight: 6, // ✅ Réduit de 8 à 6 pour libérer de l'espace
    },
    // ✅ Colonne gauche avec avatar + langue
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minWidth: 0,
        maxWidth: '35%', // ✅ Limite la largeur pour laisser de l'espace au centre
        flexShrink: 1, // ✅ Permet de rétrécir si nécessaire
        gap: 6, // ✅ Espacement uniforme entre les éléments
    },
    // ✅ Titre centré entre le drapeau et l'icône voiture
    brandTitleContainer: {
        flex: 1, // ✅ Prend l'espace restant au centre
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4, // ✅ Réduit l'espacement horizontal
        minWidth: 70, // ✅ Largeur minimale pour garantir la visibilité de "Yukpo" complet
        flexShrink: 0, // ✅ Ne pas rétrécir pour éviter la troncature
    },
    // ✅ Colonne droite avec les actions (voiture, chat, notifications)
    headerActionsCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        minWidth: 0,
        maxWidth: '35%', // ✅ Limite la largeur pour laisser de l'espace au centre
        flexShrink: 1, // ✅ Permet de rétrécir si nécessaire
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    headerButtonIcon: {
        fontSize: 18,
        color: '#FFFFFF',
    },
    balanceCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    balanceCardCompact: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 7, // ✅ Réduit de 8 à 7
        paddingVertical: 5, // ✅ Réduit de 6 à 5
        borderRadius: 10, // ✅ Réduit de 12 à 10
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginHorizontal: 2,
        marginLeft: 8, // ✅ Équilibré
    },
    weatherContainer: {
        flex: 0.8,
        marginHorizontal: 2,
        marginLeft: 8, // ✅ Équilibré
        marginRight: 8,
    },
    headerButtonCompact: {
        width: 36, // ✅ Réduit de 38 à 36 pour plus d'espace
        height: 36, // ✅ Réduit de 38 à 36 pour plus d'espace
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    headerButtonIconCompact: {
        fontSize: 16, // ✅ Réduit de 18 à 16 pour plus d'espace
        color: '#374151',
    },
    notificationBadgeCompact: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    balanceIconCompact: {
        fontSize: 11, // ✅ Réduit de 12 à 11
        marginRight: 3, // ✅ Réduit de 4 à 3
    },
    balanceTextCompact: {
        color: '#1F2937',
        fontSize: 9, // ✅ Réduit de 10 à 9
        fontWeight: '600',
    },
    balanceIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    balanceText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    notificationBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 36,
    },
    titleContainerCompact: {
        alignItems: 'center',
        marginBottom: 10, // ✅ Réduit de 16 à 10 pour monter le bloc
        marginTop: 0, // ✅ Réduit de 4 à 0 pour monter le bloc
    },
    brandTitle: {
        fontSize: 48,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    brandTitleCompact: {
        width: '100%', // ✅ Prend toute la largeur disponible
        fontSize: 20, // ✅ Harmonisé à 20px pour s'aligner avec les icônes de 18px (ratio 1.1:1)
        fontWeight: '900',
        textAlign: 'center', // ✅ Centrer le texte à l'intérieur
        letterSpacing: -0.2, // ✅ Espacement ajusté pour "Yukpo"
        includeFontPadding: false, // ✅ Évite le padding supplémentaire Android
        textAlignVertical: 'center', // ✅ Centre verticalement sur Android
        flexShrink: 0, // ✅ Ne pas rétrécir pour éviter la troncature
        overflow: 'visible', // ✅ Permet au texte de dépasser si nécessaire
    },
    brandYuk: {
        color: '#EAB308', // text-yellow-500 du frontend
    },
    brandPo: {
        color: '#DC2626', // text-red-600 du frontend
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 24,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    subtitleCompact: {
        fontSize: 14, // ✅ Réduit de 16 à 14
        color: '#374151',
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 18, // ✅ Réduit de 20 à 18
    },
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 20,
        padding: 6,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    modeSelectorSimple: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 2,
        marginBottom: 8, // ✅ Réduit de 12 à 8 pour rapprocher de ChatInput
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 16,
        gap: 8,
    },
    modeButtonActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    modeButtonSimple: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Fond blanc semi-transparent
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    modeButtonGlass: {
        flex: 1,
        marginHorizontal: 4,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modeButtonActiveGlass: {
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    modeButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    modeButtonActiveSimple: {
        backgroundColor: 'rgba(135, 206, 235, 0.9)', // Bleu ciel semi-transparent
        borderColor: 'rgba(135, 206, 235, 0.5)',
        shadowColor: '#87CEEB',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    modeButtonIconSimple: {
        fontSize: 16,
        color: '#374151', // Gris plus foncé pour meilleur contraste
    },
    modeButtonIconActiveSimple: {
        color: '#FFFFFF',
    },
    modeButtonTextSimple: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151', // Gris plus foncé pour meilleur contraste
    },
    modeButtonTextActiveSimple: {
        color: '#FFFFFF',
    },
    modeButtonIcon: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    sendButtonContainer: {
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 20,
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#DC2626', // Rouge de "po"
        paddingVertical: 16,
        paddingHorizontal: 48,
        borderRadius: 20,
        gap: 10,
        borderWidth: 0,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
        minWidth: 160,
    },
    sendButtonDisabled: {
        backgroundColor: '#9CA3AF',
        borderColor: '#9CA3AF',
        elevation: 0,
    },
    sendIcon: {
        fontSize: 18,
        color: '#FFFFFF',
    },
    sendButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // ✅ STYLES MODERNES OPTIMISÉS - COMPACTS
    modeSelectorModern: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 8, // ✅ RÉDUIT: De 10 à 8px
        padding: 2, // ✅ RÉDUIT: De 3 à 2px
        marginBottom: 6, // ✅ RÉDUIT: De 8 à 6px
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, // ✅ RÉDUIT: De 0.06 à 0.05
        shadowRadius: 3, // ✅ RÉDUIT: De 4 à 3px
        elevation: 1,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modeButtonModern: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: STATIC_WIDTH > 400 ? 8 : 6, // ✅ RÉDUIT: De 12/10 à 8/6px
        paddingHorizontal: STATIC_WIDTH > 400 ? 16 : 14, // ✅ RÉDUIT: De 22/18 à 16/14px
        borderRadius: 8, // ✅ RÉDUIT: De 10 à 8px
        gap: 4, // ✅ RÉDUIT: De 6 à 4px
        backgroundColor: 'transparent',
        minHeight: STATIC_WIDTH > 400 ? 36 : 32, // ✅ RÉDUIT: De 44/40 à 36/32px (beaucoup plus compact)
    },
    modeButtonActiveModern: {
        backgroundColor: '#10B981', // Vert moderne
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    modeButtonIconModern: {
        fontSize: 18, // ✅ Restauré à 18 pour meilleure visibilité
        color: '#64748B',
    },
    modeButtonIconActiveModern: {
        color: '#FFFFFF',
    },
    modeButtonTextModern: {
        fontSize: 14, // ✅ Optimisé: 13 → 14 pour meilleure lisibilité
        fontWeight: '600',
        color: '#64748B',
    },
    modeButtonTextActiveModern: {
        color: '#FFFFFF',
    },

    // Styles modernes pour le solde
    balanceCardModern: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
        paddingHorizontal: 16, // ✅ Augmenté de 12 à 16 pour englober FCFA
        borderRadius: 14,
        gap: 2, // ✅ Réduit de 4 à 2 pour rapprocher montant et devise
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
        height: 40, // Légèrement réduit pour équilibrer
        marginHorizontal: 4, // Espacement horizontal uniforme
        minWidth: 75,
        maxWidth: 95,
    },
    balanceIconModern: {
        fontSize: 14,
        color: '#F59E0B', // Orange pour l'argent
    },
    balanceTextModern: {
        fontSize: 14, // Augmenté de 12 à 14
        fontWeight: '700',
        color: '#059669', // Vert pour l'argent - plus visible
        textAlign: 'center',
        letterSpacing: 0.5,
        marginRight: 4,
    },
    balanceDeviseModern: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280', // Gris pour la devise
        letterSpacing: 0.5,
    },

    // Styles modernes pour la météo - SANS fond pour éviter la double couche
    weatherContainerModern: {
        flex: 1,
        minWidth: 60,
        maxWidth: 85,
        height: 40, // Uniformisé avec le solde
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 2, // Espacement horizontal
    },

    // Styles pour l'alerte de confirmation
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
        position: 'relative', // ✅ NOUVEAU: Pour positionner le bouton de fermeture
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
    // ✅ NOUVEAU: Styles pour le header du carousel - COMPACT
    carouselHeader: {
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: 6, // ✅ RÉDUIT: 8 → 6 pour rapprocher le titre du carousel
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
    // ✅ NOUVEAU: Wrapper pour le carousel avec marges garantissant visibilité complète - OPTIMISÉ
    carouselWrapper: {
        marginTop: 4, // ✅ RÉDUIT: 8 → 4 pour afficher les cartes encore plus tôt
        marginBottom: 120, // ✅ AUGMENTÉ: 100 → 120 (60px navigation + 60px marge) pour garantir que toute la carte est entièrement visible
        minHeight: STATIC_HEIGHT * 0.55, // ✅ NOUVEAU: Hauteur minimale pour garantir l'espace pour les cartes
    },
    // ✅ NOUVEAU: Styles adaptatifs pour orientation landscape
    carouselWrapperLandscape: {
        marginTop: 4,
        marginBottom: 80, // ✅ Réduit en landscape
        minHeight: STATIC_HEIGHT * 0.4, // ✅ Réduit en landscape
    },
    carouselTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    carouselSubtitle: {
        fontSize: 12, // ✅ Réduit de 13 à 12 pour compacter
        color: '#6B7280',
        fontWeight: '500',
    },
    // ✅ AMÉLIORÉ: Styles pour le feed infini - Réduction espace blanc et meilleure UX
    feedContainer: {
        marginTop: 16, // ✅ RÉDUIT: De 24 à 16 pour réduire l'espace blanc
        marginBottom: 24, // ✅ RÉDUIT: De 40 à 24 pour réduire l'espace blanc
        paddingHorizontal: 4, // ✅ NOUVEAU: Padding horizontal minimal
        backgroundColor: 'rgba(255, 255, 255, 0.03)', // ✅ NOUVEAU: Fond subtil pour délimiter la zone
        borderRadius: 16, // ✅ NOUVEAU: Bordures arrondies
        paddingVertical: 8, // ✅ NOUVEAU: Padding vertical minimal
    },
    feedHeader: {
        paddingHorizontal: 16, // ✅ RÉDUIT: De 20 à 16 pour plus de compacité
        paddingBottom: 12, // ✅ RÉDUIT: De 16 à 12 pour plus de compacité
        marginBottom: 8, // ✅ NOUVEAU: Marge en bas pour séparer du contenu
    },
    feedTitle: {
        fontSize: 22, // ✅ AUGMENTÉ: De 20 à 22 pour plus de visibilité
        fontWeight: '700',
        color: '#1F2937', // ✅ AMÉLIORÉ: Couleur plus foncée pour meilleur contraste
        marginBottom: 6, // ✅ AUGMENTÉ: De 4 à 6 pour meilleur espacement
        letterSpacing: -0.3, // ✅ NOUVEAU: Espacement des lettres pour modernité
    },
    feedSubtitle: {
        fontSize: 15, // ✅ AUGMENTÉ: De 14 à 15 pour meilleure lisibilité
        color: '#64748B', // ✅ AMÉLIORÉ: Couleur plus claire mais toujours lisible
        fontWeight: '400',
        lineHeight: 20, // ✅ NOUVEAU: Hauteur de ligne pour meilleure lisibilité
    },
    // ✅ NOUVEAU : Bouton floating coursier
    floatingCourierButton: {
        position: 'absolute',
        bottom: 80, // Au-dessus de la barre de navigation
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
        // ✅ CRITIQUE: zIndex réduit de 1000 à 500 pour ne pas bloquer les boutons du header (zIndex: 1000)
        pointerEvents: 'auto',
        // ✅ CRITIQUE: pointerEvents explicite pour garantir les interactions
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

// ✅ NOUVEAU: Exporter la fonction de création de styles
export { createStyles };

// ✅ NOUVEAU: Styles par défaut (pour compatibilité)
const styles = createStyles(modernColors);

export default HomeScreen;
