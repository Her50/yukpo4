// HomeScreen moderne inspiré du frontend avec ChatInputMobile intégré
import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatInputMobile from '../components/ChatInputMobile';
import { ChatHistoryModal } from '../components/ChatHistoryModal';
import { NotificationHistoryModal } from '../components/NotificationHistoryModal';
import { useAuth } from '../contexts/AuthContext';
import { searchApi, serviceApi } from '../services/api';
import { genererSuggestionsService } from '../lib/yukpoaclient';
import { useWeather } from '../hooks/useWeather';
import { modernColors, modernStyles } from '../theme/modernTheme';

const HomeScreenNew: React.FC = () => {
    const { user } = useAuth();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [isCreateService, setIsCreateService] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    
    // Météo - utiliser les coordonnées par défaut si pas de GPS
    const { weather } = useWeather(48.8566, 2.3522); // Paris par défaut

    // Vérifier que l'utilisateur est bien connecté
    useEffect(() => {
        if (!user) {
            console.warn('[HomeScreenNew] Aucun utilisateur connecté, redirection vers login');
            // navigation.navigate('Login' as never);
        } else {
            console.log('[HomeScreenNew] Utilisateur connecté:', user.email);
        }
    }, [user]);

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
            const response = await searchApi.search(input);

            if (response.success && response.data) {
                const results = response.data?.resultats?.resultats || response.data?.resultats || [];
                console.log('[HomeScreenNew] Résultats trouvés:', results.length);
                
                // TODO: Naviguer vers les résultats quand l'écran sera créé
                Alert.alert('Résultats', `Trouvé ${results.length} résultats`);
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
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Chargement de votre profil...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#667eea', '#764ba2', '#f093fb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientContainer}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header avec salutation, météo et boutons */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Text style={styles.greeting}>Bonjour 👋</Text>
                            <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
                            <View style={styles.balanceContainer}>
                                <Text style={styles.balanceLabel}>Votre solde</Text>
                                <Text style={styles.balanceValue}>{user?.credits?.toLocaleString() || 0} tokens</Text>
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
                            <TouchableOpacity 
                                style={styles.headerButton}
                                onPress={() => setShowChatHistory(true)}
                            >
                                <Text style={styles.chatIcon}>💬</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.headerButton}
                                onPress={() => setShowNotifications(true)}
                            >
                                <Text style={styles.notificationIcon}>🔔</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                     {/* Toggle pour basculer entre recherche et création - EN HAUT */}
                     <View style={styles.toggleSection}>
                         <View style={styles.toggleContainer}>
                             <TouchableOpacity
                                 style={[styles.toggleButton, !isCreateService && styles.toggleButtonActive]}
                                 onPress={() => setIsCreateService(false)}
                             >
                                 <Text style={[styles.toggleText, !isCreateService && styles.toggleTextActive]}>
                                     🔍 Rechercher
                                 </Text>
                             </TouchableOpacity>
                             <TouchableOpacity
                                 style={[styles.toggleButton, isCreateService && styles.toggleButtonActive]}
                                 onPress={() => setIsCreateService(true)}
                             >
                                 <Text style={[styles.toggleText, isCreateService && styles.toggleTextActive]}>
                                     ➕ Créer un service
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
            </LinearGradient>
            
            {/* Modals */}
            <ChatHistoryModal
                isOpen={showChatHistory}
                onClose={() => setShowChatHistory(false)}
            />
            <NotificationHistoryModal
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />
        </SafeAreaView>
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
        alignItems: 'flex-start',
        paddingHorizontal: modernStyles.spacing.lg,
        paddingTop: modernStyles.spacing.lg,
        paddingBottom: modernStyles.spacing.xl,
    },
    headerLeft: {
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4,
    },
    userName: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: modernStyles.spacing.md,
    },
    balanceContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: modernStyles.spacing.lg,
        paddingVertical: modernStyles.spacing.md,
        borderRadius: modernStyles.borderRadius.large,
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
    },
    balanceValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    weatherContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    weatherIcon: {
        fontSize: 16,
    },
    weatherTemp: {
        fontSize: 12,
        color: 'white',
        fontWeight: '600',
    },
    headerButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
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
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: modernStyles.borderRadius.large,
        padding: modernStyles.spacing.md,
        marginBottom: modernStyles.spacing.lg,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: modernStyles.borderRadius.medium,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: modernStyles.spacing.sm,
        paddingHorizontal: modernStyles.spacing.md,
        borderRadius: modernStyles.borderRadius.small,
        alignItems: 'center',
    },
    toggleButtonActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
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
