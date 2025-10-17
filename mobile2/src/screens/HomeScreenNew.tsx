// HomeScreen moderne inspiré du frontend avec ChatInputMobile intégré
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
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
import { NativeGradient } from '../components/NativeDesign';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { SafeIcon } from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useWeather } from '../hooks/useWeather';
import { genererSuggestionsService } from '../lib/yukpoaclient';
import { apiGet, servicesApi } from '../services/api';
import { modernStyles } from '../theme/modernTheme';

const HomeScreenNew: React.FC = () => {
    const { user } = useAuth();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [isCreateService, setIsCreateService] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

    // Météo - utiliser la position GPS si disponible, sinon Paris par défaut
    const { weather } = useWeather(
        selectedLocation?.lat || 48.8566,
        selectedLocation?.lng || 2.3522
    );

    // Vérifier que l'utilisateur est bien connecté
    useEffect(() => {
        try {
            if (!user) {
                console.warn('[HomeScreenNew] Aucun utilisateur connecté, redirection vers login');
                // navigation.navigate('Login' as never);
            } else {
                console.log('[HomeScreenNew] Utilisateur connecté:', user.email);
            }
        } catch (error) {
            console.error('[HomeScreenNew] Erreur dans useEffect user:', error);
        }
    }, [user]);

    // Charger le nombre de notifications non lues
    useEffect(() => {
        const loadUnreadNotificationsCount = async () => {
            if (user?.id) {
                try {
                    const response = await apiGet<{ count: number }>(`/api/notifications/user/${user.id}/unread-count`);
                    if (response.data && typeof response.data.count === 'number') {
                        setUnreadNotificationsCount(response.data.count);
                    }
                } catch (error) {
                    console.error('[HomeScreenNew] Erreur chargement nombre de notifications:', error);
                    setUnreadNotificationsCount(0);
                }
            }
        };

        loadUnreadNotificationsCount();

        // Recharger quand le modal de notifications se ferme
        if (!showNotifications) {
            loadUnreadNotificationsCount();
        }
    }, [user?.id, showNotifications]);

    // Détection GPS automatique au chargement (si activé dans les paramètres)
    useEffect(() => {
        const checkGPSAndActivate = async () => {
            try {
                // Vérifier si le GPS est activé dans les paramètres
                const gpsEnabled = await AsyncStorage.getItem('gpsEnabled');
                const isGPSEnabled = gpsEnabled !== null ? JSON.parse(gpsEnabled) : true; // Par défaut activé

                if (isGPSEnabled) {
                    // Demander les permissions de localisation
                    const { status } = await Location.requestForegroundPermissionsAsync();

                    if (status === 'granted') {
                        // Obtenir la position actuelle
                        const location = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.High,
                        });

                        const coords = {
                            lat: location.coords.latitude,
                            lng: location.coords.longitude
                        };
                        setSelectedLocation(coords);
                        console.log('[HomeScreenNew] GPS automatique activé:', coords);
                    } else {
                        console.warn('[HomeScreenNew] Permission de localisation refusée');
                    }
                } else {
                    console.log('[HomeScreenNew] GPS désactivé dans les paramètres');
                }
            } catch (error) {
                console.error('[HomeScreenNew] Erreur lors de la vérification GPS:', error);
            }
        };

        checkGPSAndActivate();
    }, []);

    const handleChatSubmit = async (input: any) => {
        try {
            setLoading(true);
            console.log('[HomeScreenNew] Données envoyées à Yukpo:', input);

            if (isCreateService) {
                // Logique de création de service (comme le frontend)
                await handleCreateService(input);
            } else {
                // Logique de recherche (comme le frontend)
                await handleSearch(input);
            }
        } catch (error: any) {
            console.error('❌ Erreur Yukpo détaillée:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Fonction pour gérer la recherche directe (identique au frontend)
    const handleSearch = async (input: any) => {
        try {
            console.log('[HomeScreenNew] Recherche directe...');
            const response = await servicesApi.searchDirect(input);

            if (response.success && response.data) {
                const data = response.data as any;
                const results = data?.resultats?.resultats || data?.resultats || [];
                console.log('[HomeScreenNew] Résultats trouvés:', results.length);

                // Naviguer vers ResultatBesoinScreen avec les résultats
                (navigation as any).navigate('ResultatBesoin', {
                    results: results,
                    searchType: 'direct',
                    initialInput: input
                });
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de la recherche');
            }
        } catch (error: any) {
            console.error('Erreur lors de la recherche:', error);
            Alert.alert('Erreur', 'Erreur lors de la recherche');
        }
    };

    // Fonction pour gérer la création de service (identique au frontend)
    const handleCreateService = async (input: any) => {
        try {
            console.log('[HomeScreenNew] Génération de suggestions pour création...');

            // Appeler genererSuggestionsService comme dans le frontend
            const result = await genererSuggestionsService(input);

            if (result && result.data) {
                console.log('[HomeScreenNew] Suggestions générées:', result.data);

                // TODO: Naviguer vers le formulaire de création quand l'écran sera créé
                Alert.alert('Succès', 'Suggestions générées ! Redirection vers le formulaire...');

                // Pour l'instant, rediriger vers Mes Services
                navigation.navigate('MesServices' as never);
            } else {
                Alert.alert('Erreur', 'Erreur lors de la génération des suggestions');
            }
        } catch (error: any) {
            console.error('Erreur lors de la création de service:', error);
            Alert.alert('Erreur', 'Erreur lors de la création de service');
        }
    };


    // Protection contre les erreurs de rendu
    if (!user) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Chargement de votre profil...</Text>
                </View>
            </SafeNativeView>
        );
    }

    // Protection supplémentaire contre les erreurs
    try {
        // Vérifier que les propriétés essentielles existent
        if (!user.email || !user.id) {
            console.warn('[HomeScreenNew] Données utilisateur incomplètes:', user);
            return (
                <SafeNativeView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Initialisation du profil...</Text>
                    </View>
                </SafeNativeView>
            );
        }
    } catch (error) {
        console.error('[HomeScreenNew] Erreur lors de la vérification utilisateur:', error);
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Erreur de chargement...</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <NativeGradient
                colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
                style={styles.gradientContainer}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header avec avatar, salutation, météo et boutons */}
                    <View style={styles.header}>
                        {/* Avatar à gauche */}
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                {user?.photo ? (
                                    <Text style={styles.avatarImage}>👤</Text>
                                ) : (
                                    <Text style={styles.avatarText}>
                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.headerCenter}>
                            <Text style={styles.greeting}>Bonjour 👋</Text>
                            <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
                            <View style={styles.balanceContainer}>
                                <Text style={styles.balanceLabel}>Votre solde</Text>
                                <Text style={styles.balanceValue}>
                                    {(user?.credits || 0).toLocaleString()} FCFA
                                </Text>
                            </View>
                        </View>

                        <View style={styles.headerRight}>
                            {/* Météo */}
                            {weather && (
                                <View style={styles.weatherContainer}>
                                    <Text style={styles.weatherIcon}>{weather.icon}</Text>
                                    <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
                                </View>
                            )}

                            {/* Boutons header */}
                            <View style={styles.headerButtonsRow}>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => setShowChatHistory(true)}
                                >
                                    <SafeIcon name="message" size={20} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => setShowNotifications(true)}
                                >
                                    <SafeIcon name="bell" size={20} color="white" />
                                    {unreadNotificationsCount > 0 && (
                                        <View style={styles.notificationBadge}>
                                            <Text style={styles.notificationBadgeText}>
                                                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Toggle pour basculer entre recherche et création - EN HAUT */}
                    <View style={styles.toggleSection}>
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleButton, !isCreateService && styles.toggleButtonActive]}
                                onPress={() => setIsCreateService(false)}
                            >
                                <SafeIcon name="search" size={18} color={!isCreateService ? "white" : "rgba(255,255,255,0.7)"} />
                                <Text style={[styles.toggleText, !isCreateService && styles.toggleTextActive]}>
                                    Rechercher
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, isCreateService && styles.toggleButtonActive]}
                                onPress={() => setIsCreateService(true)}
                            >
                                <SafeIcon name="plus" size={18} color={isCreateService ? "white" : "rgba(255,255,255,0.7)"} />
                                <Text style={[styles.toggleText, isCreateService && styles.toggleTextActive]}>
                                    Créer un service
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Section principale avec ChatInput */}
                    <View style={styles.mainSection}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.mainTitle}>
                                Yukpo
                            </Text>
                            <Text style={styles.subtitle}>
                                Créez ou trouvez un service en un instant.
                                {'\n'}Une description, une image, un audio ou un fichier suffit.
                            </Text>
                        </View>

                        {/* ChatInputMobile intégré */}
                        <View style={styles.chatInputContainer}>
                            <ChatInputMobile
                                onSubmit={handleChatSubmit}
                                loading={loading}
                                placeholder="Décrivez votre besoin ou service..."
                            />
                        </View>
                    </View>


                </ScrollView>
            </NativeGradient>

            {/* Modals */}
            <ChatHistoryModal
                isOpen={showChatHistory}
                onClose={() => setShowChatHistory(false)}
                onOpenChat={() => { }}
            />
            <NotificationHistoryModal
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradientContainer: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: modernStyles.spacing.lg,
        paddingTop: modernStyles.spacing.lg,
        paddingBottom: modernStyles.spacing.xl,
        gap: 12,
    },
    avatarContainer: {
        marginRight: 4,
        justifyContent: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    avatarText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
    },
    avatarImage: {
        fontSize: 24,
    },
    headerCenter: {
        flex: 1,
    },
    headerRight: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        justifyContent: 'center',
    },
    greeting: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 2,
    },
    userName: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: modernStyles.spacing.sm,
    },
    balanceContainer: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: modernStyles.borderRadius.medium,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    balanceLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 2,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    balanceValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    weatherContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    weatherIcon: {
        fontSize: 20,
    },
    weatherTemp: {
        fontSize: 13,
        color: 'white',
        fontWeight: '700',
        marginTop: 2,
    },
    headerButtonsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    headerButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    chatIcon: {
        fontSize: 18,
    },
    notificationIcon: {
        fontSize: 18,
    },
    toggleSection: {
        paddingHorizontal: modernStyles.spacing.lg,
        marginBottom: modernStyles.spacing.md,
    },
    mainSection: {
        paddingHorizontal: modernStyles.spacing.lg,
        marginBottom: modernStyles.spacing.xl,
    },
    titleContainer: {
        marginBottom: modernStyles.spacing.lg,
        alignItems: 'center',
    },
    mainTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        marginBottom: modernStyles.spacing.sm,
        lineHeight: 28,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 22,
    },
    chatInputContainer: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: modernStyles.borderRadius.large,
        padding: modernStyles.spacing.md,
        marginBottom: modernStyles.spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: modernStyles.borderRadius.medium,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: modernStyles.spacing.sm,
        paddingHorizontal: modernStyles.spacing.md,
        borderRadius: modernStyles.borderRadius.small,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    toggleButtonActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    toggleText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },
    toggleTextActive: {
        color: 'white',
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
});

export default HomeScreenNew;
