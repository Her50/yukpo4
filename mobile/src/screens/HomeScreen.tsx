import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ReactNavigation from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import ReactNative from 'react-native';
import ChatHistoryModal from '../components/ChatHistoryModal';
import ChatInputMobile from '../components/ChatInputMobile';
import ErrorBoundary from '../components/ErrorBoundary';
import LanguageSelector from '../components/LanguageSelector';
import MixedContentCarousel from '../components/MixedContentCarousel'; // ✅ NOUVEAU: Carousel mixte
import ModernBackground from '../components/ModernBackground';
import ModernGPSModal from '../components/ModernGPSModal'; // Utiliser ModernGPSModal pour support des zones
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { SafeNativeView } from '../components/SafeNativeView';
import UserAvatarMenu from '../components/UserAvatarMenu';
import { CRASH_PREVENTION_CONFIG } from '../config/gpsConfig';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocation } from '../contexts/LocationContext';
import { apiGet } from '../services/api';
import { searchHistoryService } from '../services/searchHistoryService';
import userBehaviorService from '../services/userBehaviorService';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { cleanupGhostNotifications, debugNotifications, printNotificationReport } from '../utils/debugNotifications';

const { Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, KeyboardAvoidingView, Platform } = ReactNative;

const { width, height } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
    const navigation = ReactNavigation.useNavigation();
    const { user, refreshUser } = useAuth(); // ✅ Ajout de refreshUser
    const { language, setLanguage, t } = useLanguageSafe(); // ✅ SAFE: Context de langue avec traduction (ne crash jamais)
    const { location } = useLocation(); // ✅ NOUVEAU PHASE 9: Pour contextualiser les recherches géographiques
    const scrollViewRef = React.useRef<ScrollView>(null); // ✅ NOUVEAU: Référence pour scroll automatique

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
        const handleFocus = () => {
            console.log('[HomeScreen] 🔄 Écran focus - Rafraîchissement du solde...');
            if (user?.id && refreshUser) {
                refreshUser().catch(err => {
                    console.error('[HomeScreen] Erreur rafraîchissement solde:', err);
                });
            }
            // ✅ Forcer le bouton sur "Rechercher" à chaque retour sur HomeScreen
            setIsCreateService(false);
        };

        const unsubscribe = navigation.addListener('focus', handleFocus);

        return () => {
            unsubscribe();
        };
    }, []); // ✅ CORRECTION: Deps vides pour éviter re-création du listener

    const [loading, setLoading] = useState(false);
    const [isCreateService, setIsCreateService] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [showCreateServiceAlert, setShowCreateServiceAlert] = useState(false);
    const [pendingInput, setPendingInput] = useState<any>(null);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const [userBehaviorCategories, setUserBehaviorCategories] = useState<string[]>([]);

    // Charger le nombre de notifications non lues
    React.useEffect(() => {
        const loadUnreadNotificationsCount = async () => {
            if (user?.id) {
                try {
                    const response = await apiGet<{ count: number }>(`/api/notifications/user/${user.id}/unread-count`);
                    if (response.data && typeof response.data.count === 'number') {
                        setUnreadNotificationsCount(response.data.count);

                        // ✅ DÉBOGAGE: Si count > 0, vérifier qu'il y a vraiment des notifications
                        if (__DEV__ && response.data.count > 0) {
                            console.log('[HomeScreen] 🔔 Notifications non lues détectées:', response.data.count);
                            // Vérification asynchrone en arrière-plan
                            debugNotifications(String(user.id)).then(info => {
                                if (info.mismatch) {
                                    console.warn('[HomeScreen] ⚠️ INCOHÉRENCE détectée dans les notifications !');
                                    console.warn('[HomeScreen] Count:', info.unreadCount, 'Réelles:', info.actualNotifications.filter((n: any) => !n.isRead && !n.is_read).length);
                                }
                            }).catch(err => {
                                console.error('[HomeScreen] Erreur débogage notifications:', err);
                            });
                        }
                    }
                } catch (error) {
                    console.error('[HomeScreen] Erreur chargement nombre de notifications:', error);
                    setUnreadNotificationsCount(0);
                }
            }
        };

        // Charger immédiatement
        loadUnreadNotificationsCount();

        // Recharger quand le modal de notifications se ferme
        if (!showNotificationModal) {
            loadUnreadNotificationsCount();
        }

        // Rafraîchissement automatique toutes les 30 secondes
        const interval = setInterval(() => {
            if (user?.id) {
                console.log('[HomeScreen] 🔄 Rafraîchissement automatique des notifications');
                loadUnreadNotificationsCount();
            }
        }, 30000); // 30 secondes

        // Nettoyer l'intervalle quand le composant se démonte
        return () => {
            clearInterval(interval);
        };
    }, [user?.id, showNotificationModal]);

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
                                setUnreadNotificationsCount(0);
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

    // Charger le comportement utilisateur au démarrage
    React.useEffect(() => {
        const loadUserBehavior = async () => {
            try {
                const categories = await userBehaviorService.getPreferredCategories(5);
                setUserBehaviorCategories(categories);
                console.log('[HomeScreen] Catégories préférées chargées:', categories);
            } catch (error) {
                console.error('[HomeScreen] Erreur chargement comportement:', error);
            }
        };
        loadUserBehavior();
    }, []);

    // ✅ NOUVEAU: Scroll automatique vers le carousel au démarrage de l'app
    React.useEffect(() => {
        // Attendre que le layout soit stabilisé, puis scroller vers le carousel
        const timer = setTimeout(() => {
            scrollViewRef.current?.scrollTo({
                y: 100, // Scroll léger pour rendre le carousel visible
                animated: true,
            });
            console.log('[HomeScreen] 🎯 Scroll automatique vers le carousel au démarrage');
        }, 1500); // 1.5 secondes pour laisser le temps au contenu de charger

        return () => clearTimeout(timer);
    }, []); // Se déclenche une seule fois au mount du composant

    // ✅ CORRECTION: Détection GPS sécurisée avec timeout
    React.useEffect(() => {
        const checkGPSAndActivate = async () => {
            try {
                // ✅ CORRECTION: Vérifier la configuration de prévention des crashes
                if (CRASH_PREVENTION_CONFIG.DISABLE_AUTO_GPS) {
                    console.log('[HomeScreen] GPS automatique désactivé pour éviter les crashes');
                    return;
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
                        setSelectedLocation(coords);
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

        checkGPSAndActivate();
    }, []);


    // Fonction de recherche directe (utilise yukpoclient comme frontend)
    const handleSearch = async (input: any) => {
        try {
            // Vérifier l'authentification
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour effectuer une recherche');
                return;
            }

            setLoading(true);
            console.log('[HomeScreen] Recherche avec:', input);
            console.log('[HomeScreen] Utilisateur authentifié:', user.email);

            // ✅ Tracker la recherche pour le comportement utilisateur
            if (input.texte) {
                await userBehaviorService.trackSearch(input.texte);
            }

            // ✅ NOUVEAU PHASE 9: Enregistrer la recherche dans l'historique (en arrière-plan, ne bloque pas)
            const searchQuery = input.texte || input.text || '';
            if (searchQuery) {
                searchHistoryService.recordSearch(
                    searchQuery,
                    input.base64_image?.length > 0 ? 'image' : 'text',
                    {
                        location_lat: location?.lat,
                        location_lon: location?.lon,
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

            // Rediriger vers ResultatBesoin avec les résultats
            // CORRECTION: Parser correctement la structure de réponse du backend
            let results = [];

            // Structure de réponse du backend /api/search/direct:
            // { "resultats": { "resultats": [...], "nombre_matchings": 5 } }
            if (result?.resultats?.resultats && Array.isArray(result.resultats.resultats)) {
                results = result.resultats.resultats;
                console.log('[HomeScreen] ✅ Résultats trouvés dans result.resultats.resultats:', results.length);
            }
            // Fallback pour d'autres structures possibles
            else if (result?.resultats && Array.isArray(result.resultats)) {
                results = result.resultats;
                console.log('[HomeScreen] ✅ Résultats trouvés dans result.resultats:', results.length);
            }
            else if (result?.results && Array.isArray(result.results)) {
                results = result.results;
                console.log('[HomeScreen] ✅ Résultats trouvés dans result.results:', results.length);
            }
            else if (result?.data?.resultats && Array.isArray(result.data.resultats)) {
                results = result.data.resultats;
                console.log('[HomeScreen] ✅ Résultats trouvés dans result.data.resultats:', results.length);
            }
            else if (result?.data && Array.isArray(result.data)) {
                results = result.data;
                console.log('[HomeScreen] ✅ Résultats trouvés dans result.data:', results.length);
            }
            else {
                console.warn('[HomeScreen] ⚠️ Aucun résultat trouvé dans la réponse API');
                console.log('[HomeScreen] Structure complète de la réponse:', JSON.stringify(result, null, 2));
                console.log('[HomeScreen] Types détectés:', {
                    'result.resultats': typeof result?.resultats,
                    'result.resultats.resultats': typeof result?.resultats?.resultats,
                    'result.results': typeof result?.results,
                    'result.data': typeof result?.data
                });
            }

            console.log('[HomeScreen] Résultats finaux extraits:', results);
            console.log('[HomeScreen] Nombre de résultats:', results.length);

            // Log avant navigation pour débogage
            console.log('[HomeScreen] ===== NAVIGATION VERS RÉSULTATS =====');
            console.log('[HomeScreen] Paramètres de navigation:', {
                resultsCount: results.length,
                type: 'recherche_besoin',
                hasResults: results.length > 0,
                firstResult: results[0] || null,
                isImageSearch: result?.search_method === 'image_ai',
                billing: result?.billing || null
            });

            (navigation as any).navigate('ResultatBesoin', {
                results: results,
                type: 'recherche_besoin',
                suggestion: result,
                imageSearch: result?.search_method === 'image_ai',
                imageAnalysis: result?.image_analysis || null,
                billing: result?.billing || null,
                searchQuery: searchQuery // ✅ NOUVEAU PHASE 9: Passer la requête de recherche pour l'historique
            });

            console.log('[HomeScreen] Navigation déclenchée ✅');
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);

            // Diagnostic détaillé de l'erreur
            if (error.message?.includes('Token')) {
                Alert.alert('Erreur d\'authentification', 'Votre session a expiré. Veuillez vous reconnecter.');
            } else if (error.message?.includes('Network')) {
                Alert.alert('Erreur réseau', 'Vérifiez votre connexion internet et réessayez.');
            } else if (error.message?.includes('Aucun mot-clé')) {
                Alert.alert('Recherche impossible', 'Veuillez être plus spécifique dans votre description. Essayez avec des mots-clés comme "restaurant", "plomberie", "informatique".');
            } else {
                Alert.alert('Erreur', `Impossible de rechercher des services: ${error.message || 'Erreur inconnue'}`);
            }
        } finally {
            setLoading(false);
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

            setLoading(true);
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

            // Rediriger vers le formulaire de création avec les suggestions de l'IA
            (navigation as any).navigate('FormulaireYukpoIntelligent', {
                suggestion: {
                    ...result.data,
                    intention: 'creation_service', // AJOUT: Propriété intention manquante
                    data: result.data.suggestions || result.data.data || result.data
                },
                type: 'creation_service',
                mediaData: mediaData, // NOUVEAU: Transmettre les médias
                gpsData: gpsData // NOUVEAU: Transmettre les données GPS
            });
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
            setLoading(false);
        }
    };

    // Gestion de la soumission (comme frontend - direct)
    const handleSubmit = async (input: any) => {
        console.log('[HomeScreen] ===== SOUMISSION =====');
        console.log('[HomeScreen] Mode actuel:', isCreateService ? 'CRÉATION' : 'RECHERCHE');
        console.log('[HomeScreen] Données reçues:', {
            texte: input.texte || input.text,
            hasImages: (input.base64_image || []).length > 0,
            hasAudio: (input.audio_base64 || []).length > 0,
            hasGPS: !!input.gps_mobile
        });

        if (isCreateService) {
            // Si la case est cochée, demander confirmation
            console.log('[HomeScreen] → Demande de confirmation pour création de service');
            setPendingInput(input);
            setShowCreateServiceAlert(true);
            return;
        }

        console.log('[HomeScreen] → Appel handleSearch');
        // Par défaut: recherche directe
        await handleSearch(input);
    };

    // Fonction pour confirmer la création de service
    const confirmCreateService = async () => {
        if (pendingInput) {
            setLoading(true);
            setShowCreateServiceAlert(false);
            await handleCreateService(pendingInput);
            setPendingInput(null);
        }
    };

    // Fonction pour annuler la création de service
    const cancelCreateService = async () => {
        if (pendingInput) {
            setLoading(true);
            setShowCreateServiceAlert(false);
            await handleSearch(pendingInput);
            setPendingInput(null);
        }
    };

    return (
        <ModernBackground variant="home">
            <SafeNativeView style={styles.container}>
                {/* ✅ ENTÊTE FIXE - Reste visible au scroll */}
                <View style={styles.fixedHeader}>
                    <View style={styles.headerRow}>
                        {/* Colonne gauche: Avatar + Langue */}
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

                        {/* Titre principal PARFAITEMENT centré */}
                        <View style={styles.brandTitleContainer}>
                            <Text style={styles.brandTitleCompact}>
                                <Text style={styles.brandYuk}>Yuk</Text>
                                <Text style={styles.brandPo}>po</Text>
                            </Text>
                        </View>

                        {/* Colonne droite: Actions */}
                        <View style={styles.headerActionsCompact}>
                            <TouchableOpacity
                                style={styles.headerButtonCompact}
                                onPress={() => setShowChatModal(true)}
                            >
                                <Text style={styles.headerButtonIconCompact}>💬</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.headerButtonCompact}
                                onPress={() => setShowNotificationModal(true)}
                                onLongPress={handleDebugNotifications}
                                delayLongPress={1000}
                            >
                                <Text style={styles.headerButtonIconCompact}>🔔</Text>
                                {unreadNotificationsCount > 0 && (
                                    <View style={styles.notificationBadgeCompact}>
                                        {unreadNotificationsCount < 10 && (
                                            <Text style={styles.notificationBadgeText}>{unreadNotificationsCount}</Text>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* ✅ ZONE DE RECHERCHE FIXE - Juste après l'en-tête */}
                <View style={styles.searchSection}>
                    {/* Sélecteur de mode moderne */}
                    <View style={styles.modeSelectorModern}>
                        <TouchableOpacity
                            style={[styles.modeButtonModern, !isCreateService && styles.modeButtonActiveModern]}
                            onPress={() => setIsCreateService(false)}
                        >
                            <Text style={[styles.modeButtonIconModern, !isCreateService && styles.modeButtonIconActiveModern]}>🔍</Text>
                            <Text style={[styles.modeButtonTextModern, !isCreateService && styles.modeButtonTextActiveModern]}>
                                {t('search.find')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modeButtonModern, isCreateService && styles.modeButtonActiveModern]}
                            onPress={() => setIsCreateService(true)}
                        >
                            <Text style={[styles.modeButtonIconModern, isCreateService && styles.modeButtonIconActiveModern]}>➕</Text>
                            <Text style={[styles.modeButtonTextModern, isCreateService && styles.modeButtonTextActiveModern]}>
                                {t('search.create')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ChatInput optimisé - COMPACT */}
                    <ChatInputMobile
                        onSubmit={handleSubmit}
                        loading={loading}
                        placeholder={isCreateService
                            ? t('search.create')
                            : t('search.placeholder')}
                        onGPSPress={() => setShowGPSModal(true)}
                        showSendButton={true}
                    />
                </View>

                {/* ✅ ZONE DE CONTENU SCROLLABLE - Contenu mixte intelligent */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View>
                        {/* ✅ TITRE SECTION CAROUSEL */}
                        <View style={styles.carouselHeader}>
                            <Text style={styles.carouselSubtitle}>Produits et services recommandés</Text>
                        </View>

                        {/* ✅ NOUVEAU: Carousel mixte (publicités + produits organiques) */}
                        <MixedContentCarousel
                            userId={user?.id}
                            userBehavior={userBehaviorCategories}
                            publiciteFrequency={3} // 1 pub toutes les 3 cartes
                        />
                    </View>
                </ScrollView>


                {/* Modal GPS Moderne avec support des zones - AVEC ERROR BOUNDARY */}
                {showGPSModal && (
                    <ErrorBoundary
                        fallback={
                            <Modal visible={showGPSModal} transparent={true}>
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
                                            onPress={() => setShowGPSModal(false)}
                                        >
                                            <Text style={{ color: '#FFF', fontWeight: '600' }}>Fermer</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Modal>
                        }
                    >
                        <ModernGPSModal
                            visible={showGPSModal}
                            onClose={() => setShowGPSModal(false)}
                            onSelect={(coordinatesString) => {
                                try {
                                    // Parser le premier point pour la météo
                                    const firstPoint = coordinatesString.split('|')[0].split(',');
                                    if (firstPoint.length === 2) {
                                        const lat = parseFloat(firstPoint[0]);
                                        const lng = parseFloat(firstPoint[1]);
                                        if (!isNaN(lat) && !isNaN(lng)) {
                                            setSelectedLocation({ lat, lng });
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
                                setShowGPSModal(false);
                            }}
                            currentLocation={selectedLocation}
                            title="Sélectionner votre localisation"
                            allowZoneSelection={true}
                        />
                    </ErrorBoundary>
                )}


                {/* Modal Notifications */}
                <NotificationHistoryModal
                    isOpen={showNotificationModal}
                    onClose={() => setShowNotificationModal(false)}
                />

                {/* Modal Chat/Conversations */}
                <ChatHistoryModal
                    isOpen={showChatModal}
                    onClose={() => setShowChatModal(false)}
                    onOpenChat={(chatId: string) => {
                        console.log('Ouvrir chat:', chatId);
                        setShowChatModal(false);
                    }}
                />

                {/* Alerte de confirmation pour création de service */}
                {showCreateServiceAlert && (
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
                                    disabled={loading}
                                >
                                    <Text style={styles.confirmationButtonTextSecondary}>Non, rechercher</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.confirmationButton, styles.confirmationButtonPrimary]}
                                    onPress={confirmCreateService}
                                    disabled={loading}
                                >
                                    <Text style={styles.confirmationButtonTextPrimary}>
                                        {loading ? 'Ouverture…' : 'Oui, créer un service'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </SafeNativeView>
        </ModernBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        minHeight: height, // ✅ Assure que le conteneur occupe au moins toute la hauteur de l'écran
    },
    // ✅ ENTÊTE FIXE - Reste visible au scroll
    fixedHeader: {
        backgroundColor: '#FFFFFF',
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
    // ✅ NOUVELLE SECTION DE RECHERCHE FIXE
    searchSection: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: width > 400 ? 24 : 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 999,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: width > 400 ? 24 : 16,
        paddingTop: 16, // ✅ Réduit car la recherche est maintenant fixe
        paddingBottom: 150,
        minHeight: height * 0.4, // ✅ Réduit car moins de contenu
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
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    avatarContainer: {
        width: 44,
        height: 44,
        marginRight: 8,
    },
    // ✅ NOUVEAU: Colonne gauche avec avatar + langue
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 120, // ✅ Largeur minimale pour équilibrer
    },
    // ✅ Conteneur pour le titre PARFAITEMENT centré au milieu
    brandTitleContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: -1, // ✅ En arrière-plan pour ne pas bloquer les clics
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
    headerActionsCompact: {
        flexDirection: 'row',
        gap: 8,
        flex: 1,
        justifyContent: 'flex-end', // ✅ Aligner à droite
        minWidth: 120, // ✅ Même largeur que headerLeft pour équilibrer
    },
    headerButtonCompact: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    headerButtonIconCompact: {
        fontSize: 20,
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
        fontSize: 24, // ✅ Réduit de 28 à 24 pour éviter le retour à la ligne
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -0.5, // Rapproche les lettres
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

    // ✅ STYLES MODERNES OPTIMISÉS
    modeSelectorModern: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 12, // ✅ Réduit de 16 à 12
        padding: 4, // ✅ Réduit de 6 à 4
        marginBottom: 12, // ✅ Réduit de 24 à 12
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, // ✅ Réduit shadow
        shadowOpacity: 0.08, // ✅ Réduit opacité
        shadowRadius: 6, // ✅ Réduit radius
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modeButtonModern: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: width > 400 ? 18 : 14, // ✅ Padding adaptatif
        paddingHorizontal: width > 400 ? 28 : 20, // ✅ Padding adaptatif
        borderRadius: 12,
        gap: 8,
        backgroundColor: 'transparent',
        minHeight: width > 400 ? 60 : 52, // ✅ Hauteur adaptative
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
        fontSize: 18,
        color: '#64748B', // Gris moyen pour inactif
    },
    modeButtonIconActiveModern: {
        color: '#FFFFFF',
    },
    modeButtonTextModern: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B', // Gris moyen pour inactif
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
    // ✅ NOUVEAU: Styles pour le header du carousel
    carouselHeader: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: 'transparent',
    },
    carouselTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    carouselSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
});

export default HomeScreen;
