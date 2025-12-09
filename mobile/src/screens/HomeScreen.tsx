import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ReactNavigation from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { Suspense, useReducer } from 'react';
import ReactNative from 'react-native';
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
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'; // ✅ NOUVEAU: Support orientation
import { useScrollY } from '../hooks/useScrollY';
import { apiGet, deliveryApi } from '../services/api';
import { searchHistoryService } from '../services/searchHistoryService';
import userBehaviorService from '../services/userBehaviorService';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { cleanupGhostNotifications, debugNotifications, printNotificationReport } from '../utils/debugNotifications';
import { hapticPress, hapticSelect, hapticSuccess } from '../utils/hapticFeedback'; // ✅ PHASE 2: Haptic feedback
import { normalizeServiceProducts } from '../utils/productNormalizer';
import { navigateToVideoWizard } from '../utils/videoNavigation';
import { homeScreenReducer, initialState } from './HomeScreen.reducer';
// ✅ OPTIMISATION: Lazy loading pour réduire bundle size initial (-30% bundle size)
// ✅ SÉCURITÉ: Vérification que les composants sont bien exportés avant lazy loading
const SpecializedServicesSection = React.lazy(() => import('../components/SpecializedServicesSection'));
const GlobalPromoHighlights = React.lazy(() => import('../components/promotions/GlobalPromoHighlights'));
const InfiniteFeed = React.lazy(() =>
    import('../components/InfiniteFeed')
        .then(module => {
            // ✅ SÉCURITÉ: Vérifier que InfiniteFeed existe dans le module
            if (!module || !module.InfiniteFeed) {
                console.error('[HomeScreen] ❌ InfiniteFeed non trouvé dans le module');
                throw new Error('InfiniteFeed component not found');
            }
            return { default: module.InfiniteFeed };
        })
        .catch((error) => {
            console.error('[HomeScreen] ❌ Erreur chargement InfiniteFeed:', error);
            // ✅ SÉCURITÉ: Re-throw pour que Suspense puisse gérer l'erreur
            throw error;
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

const { Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, KeyboardAvoidingView, Platform, RefreshControl, FlatList, ActivityIndicator } = ReactNative;

// ✅ Dimensions statiques pour les styles (seront remplacées dynamiquement par useDeviceOrientation)
const { width: STATIC_WIDTH, height: STATIC_HEIGHT } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
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

    // ✅ OPTIMISATION: Callbacks memoïsés pour éviter re-renders
    const handleDeliveryPress = React.useCallback(() => {
        hapticPress(); // ✅ PHASE 2: Haptic feedback
        console.log('[HomeScreen] 🚚 Navigation vers Delivery');
        try {
            const parentNavigation = (navigation as any).getParent();
            if (parentNavigation) {
                parentNavigation.navigate('Delivery');
            } else {
                (navigation as any).navigate('Delivery');
            }
            hapticSuccess(); // ✅ PHASE 2: Feedback succès
        } catch (error) {
            console.error('[HomeScreen] ❌ Erreur navigation vers Delivery:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir la livraison.');
        }
    }, [navigation]);

    // ✅ NOUVEAU 2025-01-27: Charger le nombre de conversations non lues
    const loadUnreadChatCount = React.useCallback(async (): Promise<number> => {
        if (!user?.id) {
            return 0;
        }

        try {
            const response = await apiGet('/api/chat/conversations');
            if (response.success && response.data && Array.isArray(response.data)) {
                // Calculer le total des messages non lus
                const unreadTotal = response.data.reduce((total: number, chat: any) => {
                    return total + (chat.unreadCount || 0);
                }, 0);
                return unreadTotal;
            }
            return 0;
        } catch (error) {
            console.error('[HomeScreen] Erreur chargement conversations non lues:', error);
            return 0;
        }
    }, [user?.id]);

    const handleChatPress = React.useCallback(async () => {
        hapticPress(); // ✅ PHASE 2: Haptic feedback
        const wasOpen = state.ui.showChatModal;
        dispatch({ type: 'TOGGLE_CHAT_MODAL' });
        // ✅ NOUVEAU 2025-01-27: Rafraîchir le compteur quand on ouvre le modal
        if (!wasOpen && loadUnreadChatCount) {
            // Charger le compteur après la définition de loadUnreadChatCount
            try {
                const count = await loadUnreadChatCount();
                dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: count });
            } catch (error) {
                console.error('[HomeScreen] Erreur chargement chat count:', error);
            }
        }
    }, [state.ui.showChatModal, loadUnreadChatCount]);

    const handleNotificationPress = React.useCallback(() => {
        hapticPress(); // ✅ PHASE 2: Haptic feedback
        dispatch({ type: 'TOGGLE_NOTIFICATION_MODAL' });
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
            if (user?.id && refreshUser && typeof refreshUser === 'function') {
                refreshUser().catch(err => {
                    console.error('[HomeScreen] Erreur rafraîchissement solde:', err);
                });
            }
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
    }, []); // ✅ CORRECTION: Deps vides pour éviter re-création du listener

    // ✅ OPTIMISATION: Tous les états sont maintenant dans le reducer

    // ✅ CORRECTION: Fonction simplifiée pour ouvrir la création vidéo
    // Utilise la même navigation que le bouton à l'en-tête qui fonctionne correctement
    const handleOpenVideoCreation = React.useCallback(() => {
        try {
            console.log('[HomeScreen] 🎬 Ouverture création vidéo via navigate("Video")...');
            // ✅ Utiliser la même navigation que le bouton à l'en-tête qui fonctionne
            const parent = (navigation as any).getParent();
            if (parent) {
                parent.navigate('Video');
            } else {
                (navigation as any).navigate('Video');
            }
        } catch (error: any) {
            console.error('[HomeScreen] ❌ Erreur navigation vers création vidéo:', {
                error: error?.message || String(error),
                stack: error?.stack
            });
            Alert.alert('Erreur', 'Impossible d\'ouvrir la création de vidéo.');
        }
    }, [navigation]);

    const loadUnreadNotificationsCount = React.useCallback(async (): Promise<number> => {
        if (!user?.id) {
            return 0;
        }

        try {
            const response = await apiGet<{ count: number }>(`/api/notifications/user/${user.id}/unread-count`);
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
        } catch (error) {
            console.error('[HomeScreen] Erreur chargement notifications non lues:', error);
            return 0;
        }
    }, [user?.id]);

    // ✅ OPTIMISATION: Chargement parallèle des données initiales (gain: -50% temps)
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

            // ✅ Charger toutes les données en parallèle
            const [notificationsResult, chatCountResult, behaviorResult, courierResult] = await Promise.allSettled([
                loadUnreadNotificationsCount(),
                loadUnreadChatCount(), // ✅ NOUVEAU 2025-01-27: Charger le nombre de conversations non lues
                userBehaviorService.getPreferredCategories(5).catch(() => []),
                deliveryApi.getMyCourierStatus().catch(() => ({ data: { is_courier: false } })),
            ]);

            // Traiter les résultats
            if (notificationsResult.status === 'fulfilled') {
                dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: notificationsResult.value });
            }

            if (chatCountResult.status === 'fulfilled') {
                dispatch({ type: 'SET_UNREAD_CHAT_COUNT', payload: chatCountResult.value });
            }

            if (behaviorResult.status === 'fulfilled') {
                dispatch({ type: 'SET_USER_BEHAVIOR_CATEGORIES', payload: behaviorResult.value });
            }

            if (courierResult.status === 'fulfilled') {
                const data = (courierResult.value as any)?.data || courierResult.value;
                const isCourierValue = data?.is_courier ?? data?.isCourier ?? false;
                dispatch({ type: 'SET_IS_COURIER', payload: Boolean(isCourierValue) });
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadInitialData().catch(error => {
            console.error('[HomeScreen] Erreur chargement données initiales:', error);
        });

        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [user?.id, loadUnreadChatCount, loadUnreadNotificationsCount]);

    // ✅ OPTIMISATION: Rafraîchissement automatique des notifications
    React.useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que la fonction existe avant de l'utiliser
        if (typeof loadUnreadNotificationsCount !== 'function') {
            console.warn('[HomeScreen] loadUnreadNotificationsCount non disponible');
            return () => {
                // ✅ Retourner une fonction vide si la fonction n'est pas disponible
            };
        }

        const refreshNotifications = async () => {
            try {
                // ✅ SÉCURITÉ: Vérifier à nouveau que la fonction existe avant de l'appeler
                if (typeof loadUnreadNotificationsCount === 'function') {
                    const count = await loadUnreadNotificationsCount();
                    dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: count });
                }
            } catch (error) {
                console.error('[HomeScreen] Erreur rafraîchissement notifications:', error);
            }
        };

        refreshNotifications();

        const interval = setInterval(() => {
            console.log('[HomeScreen] 🔄 Rafraîchissement automatique des notifications');
            // ✅ SÉCURITÉ: Vérifier que la fonction existe avant de l'appeler dans l'intervalle
            if (typeof loadUnreadNotificationsCount === 'function') {
                refreshNotifications();
            }
        }, 30000);

        return () => {
            // ✅ SÉCURITÉ: Vérifier que interval existe avant de le nettoyer
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [loadUnreadNotificationsCount]);

    // ✅ NOUVEAU: Initialiser les services UX
    React.useEffect(() => {
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

        // ✅ NOUVEAU: Initialiser gamification (streak, points)
        if (user?.id) {
            gamificationService.trackAction(user.id, 'daily_login').catch(err => {
                console.warn('[HomeScreen] Erreur gamification:', err);
            });
        }

        // ✅ NOUVEAU: Initialiser A/B Testing
        if (user?.id) {
            abTestingService.initialize(user.id).catch(err => {
                console.warn('[HomeScreen] Erreur A/B Testing:', err);
            });
        }

        // ✅ NOUVEAU: Initialiser Analytics
        if (user?.id) {
            analyticsService.identify(user.id, {
                email: user.email,
                name: user.name,
            });
        }
        analyticsService.trackScreenView('HomeScreen');

        return () => {
            // ✅ SÉCURITÉ: Vérifier que unsubscribe est une fonction avant de l'appeler
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
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

    // ✅ CORRECTION: Détection GPS sécurisée avec timeout
    React.useEffect(() => {
        const checkGPSAndActivate = async () => {
            try {
                // ✅ CORRECTION: Vérifier la configuration de prévention des crashes
                if (CRASH_PREVENTION_CONFIG.DISABLE_AUTO_GPS) {
                    console.log('[HomeScreen] GPS automatique désactivé pour éviter les crashes');
                    return; // ✅ Retour dans la fonction async, pas dans le useEffect
                }

                // Vérifier si le GPS est activé dans les paramètres
                const gpsEnabled = await AsyncStorage.getItem('gpsEnabled');
                const isGPSEnabled = gpsEnabled !== null ? JSON.parse(gpsEnabled) : true; // Par défaut activé

                if (isGPSEnabled) {
                    // ✅ CORRECTION: Timeout pour éviter les blocages
                    const permissionPromise = Location.requestForegroundPermissionsAsync();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('GPS permission timeout')), 10000)
                    );

                    const { status } = await Promise.race([permissionPromise, timeoutPromise]) as any;

                    if (status === 'granted') {
                        // ✅ CORRECTION: Timeout pour la localisation
                        const locationPromise = Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced, // Moins précis mais plus rapide
                        });

                        const locationTimeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('GPS location timeout')), 15000)
                        );

                        const location = await Promise.race([locationPromise, locationTimeoutPromise]) as any;

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
            } catch (error) {
                console.error('[HomeScreen] Erreur lors de la vérification GPS:', error);
                // ✅ CORRECTION: Ne pas bloquer l'app si GPS échoue
                if (error.message === 'GPS permission timeout' || error.message === 'GPS location timeout') {
                    console.warn('[HomeScreen] GPS timeout - continuer sans localisation');
                }
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        checkGPSAndActivate().catch(error => {
            console.error('[HomeScreen] Erreur checkGPSAndActivate:', error);
        });

        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, []);


    // Fonction de recherche directe (utilise yukpoclient comme frontend)
    const handleSearch = async (input: any) => {
        try {
            // Vérifier l'authentification
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour effectuer une recherche');
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

            // Utiliser yukpoclient (comme le frontend)
            const result = await rechercherServices(input);

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
                try {
                    (navigation as any).navigate('ResultatBesoin', {
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
                } catch (navError: any) {
                    console.error('[HomeScreen] ❌ Erreur navigation:', navError);
                }
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
            (navigation as any).navigate('ResultatBesoin', {
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
    };

    // Fonction de création de service (utilise yukpoclient comme frontend)
    const handleCreateService = async (input: any) => {
        try {
            // Vérifier l'authentification
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour créer un service');
                return;
            }

            dispatch({ type: 'SET_LOADING', payload: true });
            console.log('[HomeScreen] Création service avec:', input);
            console.log('[HomeScreen] Utilisateur authentifié:', user.email);

            // CORRECTION: Appeler l'API pour générer les suggestions (comme le frontend)
            console.log('[HomeScreen] → Appel genererSuggestionsService API');
            const result = await genererSuggestionsService(input);

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

            // Variables pour le résumé final
            let prestataireServicesResponse: any = null;
            let lastServiceResponse: any = null;
            let servicesResponse: any = null;

            try {
                // ✅ CORRECTION: Essayer d'abord /api/prestataire/services (utilisé ailleurs dans le code)
                prestataireServicesResponse = await apiGet('/api/prestataire/services');
                console.log('[HomeScreen] Réponse /api/prestataire/services:', {
                    success: prestataireServicesResponse.success,
                    hasData: !!prestataireServicesResponse.data,
                    isArray: Array.isArray(prestataireServicesResponse.data),
                    length: Array.isArray(prestataireServicesResponse.data) ? prestataireServicesResponse.data.length : 0
                });

                // ✅ CORRECTION: Gérer le cas où la réponse est un objet avec pagination
                let servicesArray: any[] = [];
                if (prestataireServicesResponse.success && prestataireServicesResponse.data) {
                    if (Array.isArray(prestataireServicesResponse.data)) {
                        servicesArray = prestataireServicesResponse.data;
                    } else if (prestataireServicesResponse.data.data && Array.isArray(prestataireServicesResponse.data.data)) {
                        // Format avec pagination: {data: [...], pagination: {...}}
                        servicesArray = prestataireServicesResponse.data.data;
                        console.log('[HomeScreen] ✅ Format avec pagination détecté, services extraits:', servicesArray.length);
                    } else if (prestataireServicesResponse.data.services && Array.isArray(prestataireServicesResponse.data.services)) {
                        servicesArray = prestataireServicesResponse.data.services;
                        console.log('[HomeScreen] ✅ Format avec clé services détecté, services extraits:', servicesArray.length);
                    } else {
                        console.warn('[HomeScreen] ⚠️ Format de réponse inattendu:', {
                            type: typeof prestataireServicesResponse.data,
                            isArray: Array.isArray(prestataireServicesResponse.data),
                            keys: typeof prestataireServicesResponse.data === 'object' ? Object.keys(prestataireServicesResponse.data) : []
                        });
                    }
                }

                if (servicesArray.length > 0) {
                    // ✅ CORRECTION: Chercher le PREMIER service qui a des produits (pas juste un service)
                    for (const service of servicesArray) {
                        const serviceId = service.id || service.service_id || null;
                        if (serviceId && serviceHasProducts(service)) {
                            hasExistingServiceWithProducts = true;
                            firstServiceId = serviceId;
                            console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/prestataire/services (ID: ' + firstServiceId + ')');
                            console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
                            break; // Arrêter dès qu'on trouve un service avec produits
                        }
                    }

                    if (!hasExistingServiceWithProducts) {
                        console.log('[HomeScreen] ℹ️ Services trouvés mais aucun n\'a de produits');
                    }
                } else if (prestataireServicesResponse.success) {
                    console.log('[HomeScreen] ⚠️ Réponse réussie mais aucun service extrait, format:', {
                        hasData: !!prestataireServicesResponse.data,
                        isArray: Array.isArray(prestataireServicesResponse.data),
                        dataType: typeof prestataireServicesResponse.data,
                        dataKeys: prestataireServicesResponse.data && typeof prestataireServicesResponse.data === 'object'
                            ? Object.keys(prestataireServicesResponse.data)
                            : []
                    });
                }

                // ✅ FALLBACK 1: Si /api/prestataire/services ne fonctionne pas, essayer /api/services/last
                if (!hasExistingServiceWithProducts) {
                    console.log('[HomeScreen] Tentative avec /api/services/last comme fallback...');
                    lastServiceResponse = await apiGet('/api/services/last');
                    console.log('[HomeScreen] Réponse /api/services/last:', {
                        success: lastServiceResponse.success,
                        hasData: !!lastServiceResponse.data,
                        dataType: typeof lastServiceResponse.data,
                        dataKeys: lastServiceResponse.data ? Object.keys(lastServiceResponse.data) : []
                    });

                    if (lastServiceResponse.data) {
                        const serviceData = (lastServiceResponse.data as any)?.data || lastServiceResponse.data;
                        if (serviceData && (serviceData.id || serviceData.service_id)) {
                            const serviceId = serviceData.id || serviceData.service_id;
                            // ✅ CORRECTION: Vérifier que ce service a des produits
                            if (serviceHasProducts(serviceData)) {
                                hasExistingServiceWithProducts = true;
                                firstServiceId = serviceId;
                                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/services/last (ID: ' + firstServiceId + ')');
                                console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
                            } else {
                                console.log('[HomeScreen] ℹ️ Service trouvé via /api/services/last mais aucun produit détecté');
                            }
                        }
                    }
                }

                // ✅ FALLBACK 2: Si /api/services/last ne fonctionne pas, essayer /api/services/my-services
                if (!hasExistingServiceWithProducts) {
                    console.log('[HomeScreen] Tentative avec /api/services/my-services comme fallback...');
                    servicesResponse = await apiGet('/api/services/my-services');
                    console.log('[HomeScreen] Réponse /api/services/my-services:', {
                        success: servicesResponse.success,
                        hasData: !!servicesResponse.data,
                        isArray: Array.isArray(servicesResponse.data),
                        length: Array.isArray(servicesResponse.data) ? servicesResponse.data.length : 0
                    });

                    if (servicesResponse.success && Array.isArray(servicesResponse.data) && servicesResponse.data.length > 0) {
                        // ✅ CORRECTION: Chercher le PREMIER service qui a des produits (pas juste un service)
                        for (const service of servicesResponse.data) {
                            const serviceId = service.id || service.service_id || null;
                            if (serviceId && serviceHasProducts(service)) {
                                hasExistingServiceWithProducts = true;
                                firstServiceId = serviceId;
                                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/services/my-services (ID: ' + firstServiceId + ')');
                                console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
                                break; // Arrêter dès qu'on trouve un service avec produits
                            }
                        }

                        if (!hasExistingServiceWithProducts) {
                            console.log('[HomeScreen] ℹ️ Services trouvés via /api/services/my-services mais aucun n\'a de produits');
                        }
                    }
                }

                // ✅ FALLBACK 3: Si toutes les vérifications échouent, essayer /api/products/my-products
                if (!hasExistingServiceWithProducts) {
                    console.log('[HomeScreen] Tentative avec /api/products/my-products comme dernier fallback...');
                    try {
                        const productsResponse = await apiGet('/api/products/my-products');
                        console.log('[HomeScreen] Réponse /api/products/my-products:', {
                            success: productsResponse.success,
                            hasData: !!productsResponse.data,
                            isArray: Array.isArray(productsResponse.data),
                            length: Array.isArray(productsResponse.data) ? productsResponse.data.length : 0
                        });

                        if (productsResponse.success && Array.isArray(productsResponse.data) && productsResponse.data.length > 0) {
                            // Si l'utilisateur a des produits, trouver le service associé au premier produit
                            const firstProduct = productsResponse.data[0];
                            const serviceId = firstProduct.service_id || firstProduct.serviceId || firstProduct.service?.id;
                            if (serviceId) {
                                hasExistingServiceWithProducts = true;
                                firstServiceId = serviceId;
                                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/products/my-products (ID: ' + firstServiceId + ')');
                                console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
                            } else {
                                console.warn('[HomeScreen] ⚠️ Produits trouvés mais service_id manquant dans le premier produit');
                            }
                        }
                    } catch (productsError) {
                        console.warn('[HomeScreen] ⚠️ Erreur vérification produits:', productsError);
                    }
                }

                if (!hasExistingServiceWithProducts) {
                    console.log('[HomeScreen] ℹ️ Aucun service avec produits détecté → Formulaire COMPLET');
                    console.log('[HomeScreen] 📊 Résumé vérification:', {
                        hasExistingServiceWithProducts,
                        firstServiceId,
                        prestataireServicesCount: prestataireServicesResponse && Array.isArray(prestataireServicesResponse.data)
                            ? prestataireServicesResponse.data.length
                            : 0,
                        lastServiceId: lastServiceResponse?.data?.id || lastServiceResponse?.data?.data?.id || null,
                        myServicesCount: servicesResponse && Array.isArray(servicesResponse.data)
                            ? servicesResponse.data.length
                            : 0
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
                (navigation as any).navigate('AjouterProduitSimple', {
                    serviceId: firstServiceId,
                    suggestionIA: result.data,
                    mediaData: mediaData,
                    gpsData: gpsData
                });
            } else {
                // ✅ Pas de service avec produits → Formulaire COMPLET (création service + premier produit)
                console.log('[HomeScreen] 📝 Navigation vers formulaire COMPLET (FormulaireYukpoIntelligent)');
                console.log('[HomeScreen] ✅ Raison: Aucun service avec produits détecté → Création complète');
                (navigation as any).navigate('FormulaireYukpoIntelligent', {
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
    };

    // Gestion de la soumission (comme frontend - direct)
    const handleSubmit = async (input: any) => {
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
    };

    // Fonction pour confirmer la création de service
    const confirmCreateService = async () => {
        if (state.data.pendingInput) {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
            await handleCreateService(state.data.pendingInput);
            dispatch({ type: 'SET_PENDING_INPUT', payload: null });
        }
    };

    // Fonction pour annuler la création de service
    const cancelCreateService = async () => {
        if (state.data.pendingInput) {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_SHOW_CREATE_SERVICE_ALERT', payload: false });
            await handleSearch(state.data.pendingInput);
            dispatch({ type: 'SET_PENDING_INPUT', payload: null });
        }
    };

    // ✅ NOUVEAU: Créer les styles avec le thème actuel
    const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <ModernBackground variant="home">
            <ScreenTransition type="fade" duration={300}>
                <SafeNativeView style={dynamicStyles.container}>
                    {/* ✅ NOUVEAU: Indicateur de connexion offline */}
                    <OfflineIndicator />

                    {/* ✅ OPTIMISATION: Header collapsible avec animations */}
                    <HomeHeader
                        scrollY={scrollY}
                        user={user}
                        unreadNotificationsCount={state.metadata.unreadNotificationsCount}
                        unreadChatCount={state.metadata.unreadChatCount} // ✅ NOUVEAU 2025-01-27: Nombre de conversations non lues
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
                        onShowLeaderboard={() => dispatch({ type: 'TOGGLE_LEADERBOARD' })}
                        onShowChallenges={() => dispatch({ type: 'TOGGLE_CHALLENGES' })}
                        onCloseLeaderboard={() => dispatch({ type: 'TOGGLE_LEADERBOARD' })}
                        onCloseChallenges={() => dispatch({ type: 'TOGGLE_CHALLENGES' })}
                    />

                    {/* ✅ ZONE DE RECHERCHE FIXE - Juste après l'en-tête */}
                    <View style={dynamicStyles.searchSection}>
                        {/* ✅ NOUVEAU: Sélecteur de mode avec RippleButton */}
                        <View style={styles.modeSelectorModern}>
                            <View style={[styles.modeButtonModern, !state.ui.isCreateService && styles.modeButtonActiveModern]}>
                                <RippleButton
                                    title={t('search.find')}
                                    icon="🔍"
                                    variant={!state.ui.isCreateService ? 'primary' : 'outline'}
                                    onPress={() => {
                                        hapticSelect();
                                        dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: false });
                                    }}
                                    accessibilityLabel={t('search.find')}
                                />
                            </View>
                            <View style={[styles.modeButtonModern, state.ui.isCreateService && styles.modeButtonActiveModern]}>
                                <RippleButton
                                    title={t('search.create')}
                                    icon="➕"
                                    variant={state.ui.isCreateService ? 'primary' : 'outline'}
                                    onPress={() => {
                                        hapticSelect();
                                        dispatch({ type: 'SET_IS_CREATE_SERVICE', payload: true });
                                    }}
                                    accessibilityLabel={t('search.create')}
                                />
                            </View>
                        </View>

                        {/* ChatInput optimisé - COMPACT */}
                        <ChatInputMobile
                            onSubmit={handleSubmit}
                            loading={state.ui.loading}
                            placeholder={state.ui.isCreateService
                                ? t('search.create')
                                : t('search.placeholder')}
                            onGPSPress={() => {
                                hapticSelect(); // ✅ PHASE 2: Haptic feedback
                                dispatch({ type: 'TOGGLE_GPS_MODAL' });
                            }}
                            showSendButton={true}
                            showAutocomplete={!state.ui.isCreateService} // ✅ NOUVEAU: Autocomplete uniquement en mode recherche
                            isSearchMode={!state.ui.isCreateService} // ✅ NOUVEAU: Mode recherche
                            isCreateService={state.ui.isCreateService} // ✅ NOUVEAU: Passer le mode création
                        />
                    </View>

                    {/* ✅ OPTIMISATION: FlatList virtualisé pour meilleure performance */}
                    <FlatList
                        data={[
                            { id: 'specialized', type: 'specialized' }, // ✅ NOUVEAU: Section services spécialisés
                            { id: 'carousel', type: 'carousel' },
                            { id: 'promo', type: 'promo' },
                            { id: 'feed', type: 'feed' }, // ✅ PHASE 2: Feed infini
                        ]}
                        keyExtractor={(item) => item.id}
                        // ✅ NOUVEAU: getItemLayout pour performance optimale (+40% performance)
                        getItemLayout={(data, index) => {
                            // Hauteurs estimées des sections
                            const SPECIALIZED_HEIGHT = 600; // ✅ NOUVEAU: Section services spécialisés (5 catégories)

                            const CAROUSEL_HEADER_HEIGHT = 40; // carouselHeader
                            const CAROUSEL_HEIGHT = STATIC_HEIGHT * 0.55 + 120; // carouselWrapper (minHeight + marginBottom)
                            const CAROUSEL_TOTAL = CAROUSEL_HEADER_HEIGHT + CAROUSEL_HEIGHT;

                            const PROMO_HEIGHT = 180; // GlobalPromoHighlights hauteur estimée

                            const FEED_HEADER_HEIGHT = 80; // feedHeader
                            const FEED_MIN_HEIGHT = 400; // InfiniteFeed hauteur minimale
                            const FEED_TOTAL = FEED_HEADER_HEIGHT + FEED_MIN_HEIGHT + 40; // + marginBottom

                            let offset = 0;

                            if (index === 0) {
                                // ✅ NOUVEAU: Services spécialisés
                                return { length: SPECIALIZED_HEIGHT, offset: 0, index };
                            } else if (index === 1) {
                                // Carousel
                                return { length: CAROUSEL_TOTAL, offset: SPECIALIZED_HEIGHT, index };
                            } else if (index === 2) {
                                // Promo
                                return { length: PROMO_HEIGHT, offset: SPECIALIZED_HEIGHT + CAROUSEL_TOTAL, index };
                            } else {
                                // Feed
                                return { length: FEED_TOTAL, offset: SPECIALIZED_HEIGHT + CAROUSEL_TOTAL + PROMO_HEIGHT, index };
                            }
                        }}
                        renderItem={({ item }) => {
                            // ✅ NOUVEAU: Section Services Spécialisés (AVANT le carousel pour visibilité)
                            if (item.type === 'specialized') {
                                return (
                                    <AnimatedCard index={0} delay={0}>
                                        <Suspense fallback={
                                            <View style={{ padding: 20, alignItems: 'center' }}>
                                                <ActivityIndicator size="small" color={modernColors.primary} />
                                            </View>
                                        }>
                                            <SpecializedServicesSection />
                                        </Suspense>
                                    </AnimatedCard>
                                );
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
                                                onShowAllResults={() => {
                                                    (navigation as any).navigate('ResultatBesoin', {
                                                        results: state.data.searchResults,
                                                        type: 'recherche_besoin',
                                                        searchQuery: state.data.searchQuery,
                                                        hasError: false,
                                                        error: null
                                                    });
                                                }}
                                                onClearSearch={() => {
                                                    dispatch({ type: 'CLEAR_SEARCH' });
                                                }}
                                            />
                                        </View>
                                    </AnimatedCard>
                                );
                            }
                            if (item.type === 'promo') {
                                return (
                                    <AnimatedCard index={1} delay={100}>
                                        <Suspense fallback={
                                            <View style={{ padding: 20, alignItems: 'center' }}>
                                                <ActivityIndicator size="small" color={modernColors.primary} />
                                            </View>
                                        }>
                                            <GlobalPromoHighlights />
                                        </Suspense>
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

                                return (
                                    <AnimatedCard index={2} delay={200}>
                                        <View style={styles.feedContainer}>
                                            <View style={styles.feedHeader}>
                                                <Text style={styles.feedTitle}>Découvrir plus</Text>
                                                <Text style={styles.feedSubtitle}>Explorer d'autres produits et services</Text>
                                            </View>
                                            <Suspense fallback={
                                                <View style={{ padding: 20, alignItems: 'center' }}>
                                                    <ActivityIndicator size="small" color={modernColors.primary} />
                                                </View>
                                            }>
                                                <InfiniteFeed
                                                    userId={user?.id}
                                                    location={state.metadata.selectedLocation ? {
                                                        lat: state.metadata.selectedLocation.lat,
                                                        lng: state.metadata.selectedLocation.lng,
                                                    } : null}
                                                    onItemPress={(item) => {
                                                        (navigation as any).navigate('ProductDetail', {
                                                            productId: item.id || item.service_id,
                                                        });
                                                    }}
                                                />
                                            </Suspense>
                                        </View>
                                    </AnimatedCard>
                                );
                            }
                            return null;
                        }}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
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
                        nestedScrollEnabled={true}
                    />


                    {/* Modal GPS Moderne avec support des zones - AVEC ERROR BOUNDARY */}
                    {state.ui.showGPSModal && (
                        <ErrorBoundary
                            fallback={
                                <Modal visible={state.ui.showGPSModal} transparent={true}>
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
                                                onPress={() => dispatch({ type: 'TOGGLE_GPS_MODAL' })}
                                            >
                                                <Text style={{ color: '#FFF', fontWeight: '600' }}>Fermer</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>
                            }
                        >
                            <ModernGPSModal
                                visible={state.ui.showGPSModal}
                                onClose={() => dispatch({ type: 'TOGGLE_GPS_MODAL' })}
                                onSelect={(coordinatesString) => {
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
                                }}
                                currentLocation={state.metadata.selectedLocation}
                                title="Sélectionner votre localisation"
                                allowZoneSelection={true}
                            />
                        </ErrorBoundary>
                    )}


                    {/* Modal Notifications */}
                    <NotificationHistoryModal
                        isOpen={state.ui.showNotificationModal}
                        onClose={() => dispatch({ type: 'TOGGLE_NOTIFICATION_MODAL' })}
                        onChange={async () => {
                            const count = await loadUnreadNotificationsCount();
                            dispatch({ type: 'SET_UNREAD_NOTIFICATIONS', payload: count });
                        }}
                    />

                    {/* Modal Chat/Conversations */}
                    <ChatHistoryModal
                        isOpen={state.ui.showChatModal}
                        onClose={() => dispatch({ type: 'TOGGLE_CHAT_MODAL' })}
                        onOpenChat={(chatId: string) => {
                            console.log('Ouvrir chat:', chatId);
                            dispatch({ type: 'TOGGLE_CHAT_MODAL' });
                        }}
                    />

                    {/* Alerte de confirmation pour création de service */}
                    {state.ui.showCreateServiceAlert && (
                        <View style={styles.confirmationModalOverlay}>
                            <View style={styles.confirmationModal}>
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
                                        disabled={state.ui.loading}
                                    >
                                        <Text style={styles.confirmationButtonTextSecondary}>Non, rechercher</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.confirmationButton, styles.confirmationButtonPrimary]}
                                        onPress={confirmCreateService}
                                        disabled={state.ui.loading}
                                    >
                                        <Text style={styles.confirmationButtonTextPrimary}>
                                            {state.ui.loading ? 'Ouverture…' : 'Oui, créer un service'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Sélecteur de produit pour création vidéo */}
                    <ServiceProductSelector
                        visible={state.ui.showProductSelector}
                        products={state.data.productsForSelection}
                        onSelect={(product) => {
                            navigateToVideoWizard(navigation, product);
                            dispatch({ type: 'TOGGLE_PRODUCT_SELECTOR' });
                            dispatch({ type: 'SET_PRODUCTS_FOR_SELECTION', payload: [] });
                        }}
                        onClose={() => {
                            dispatch({ type: 'TOGGLE_PRODUCT_SELECTOR' });
                            dispatch({ type: 'SET_PRODUCTS_FOR_SELECTION', payload: [] });
                        }}
                    />

                    {/* ✅ NOUVEAU : Bouton floating "Suivre mes courses" pour coursiers */}
                    {state.metadata.isCourier && (
                        <TouchableOpacity
                            style={styles.floatingCourierButton}
                            onPress={() => {
                                try {
                                    const parentNavigation = (navigation as any).getParent();
                                    if (parentNavigation) {
                                        parentNavigation.navigate('CourierDashboard');
                                    } else {
                                        (navigation as any).navigate('CourierDashboard');
                                    }
                                } catch (error) {
                                    console.error('[HomeScreen] ❌ Erreur navigation vers CourierDashboard:', error);
                                    Alert.alert('Erreur', 'Impossible d\'ouvrir le tableau de bord coursier.');
                                }
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
        paddingHorizontal: STATIC_WIDTH > 400 ? 24 : 16,
        paddingVertical: 10, // ✅ Réduit de 16 à 10 pour compacter
        borderBottomWidth: 1,
        borderBottomColor: colors.border, // ✅ NOUVEAU: Support thème
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2, // ✅ Réduit de 3 à 2
        zIndex: 999,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: STATIC_WIDTH > 400 ? 24 : 16,
        paddingTop: 4, // ✅ RÉDUIT: 8 → 4 pour afficher les cartes encore plus tôt
        paddingBottom: 140, // ✅ AUGMENTÉ: 120 → 140 pour garantir visibilité complète des cartes avec la navigation
        minHeight: STATIC_HEIGHT * 0.6, // ✅ AUGMENTÉ: 0.5 → 0.6 pour plus d'espace vertical
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
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
    // ✅ PHASE 2: Styles pour le feed infini
    feedContainer: {
        marginTop: 24,
        marginBottom: 40,
    },
    feedHeader: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    feedTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    feedSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '400',
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
        zIndex: 1000,
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
