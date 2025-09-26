import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, Paragraph, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
// import { useGlobalIAStats } from '../components/intelligence/GlobalIAStats';
import ChatHistoryModal from '../components/ChatHistoryModal';
import GPSSelector from '../components/GPSSelector';
import LanguageSelector from '../components/LanguageSelector';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import TranslatedText from '../components/TranslatedText';
import { theme } from '../theme/theme';

const HomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    // const { stats, updateStats } = useGlobalIAStats();
    const [stats, setStats] = useState({ totalRequests: 0, lastActivity: null as Date | null });
    const [loading, setLoading] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isCreateService, setIsCreateService] = useState(false);
    const [showCreateServiceAlert, setShowCreateServiceAlert] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [currentGPS, setCurrentGPS] = useState<string | null>(null);

    const { width, height } = Dimensions.get('window');

    // Détection automatique GPS au chargement (comme dans le frontend)
    React.useEffect(() => {
        if (typeof navigator !== 'undefined' && (navigator as any).geolocation) {
            (navigator as any).geolocation.getCurrentPosition(
                (position: any) => {
                    const coords = `${position.coords.latitude},${position.coords.longitude}`;
                    setCurrentGPS(coords);
                    console.log('[HomeScreen] Position GPS automatique:', coords);
                },
                (error: any) => {
                    console.warn('[HomeScreen] Impossible d\'obtenir la position GPS:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes de cache
                }
            );
        }
    }, []);

    const handleSubmit = async () => {
        if (!inputText.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir une description');
            return;
        }

        try {
            setLoading(true);
            setStats({
                totalRequests: stats.totalRequests + 1,
                lastActivity: new Date(),
            });

            if (isCreateService) {
                setShowCreateServiceAlert(true);
                setLoading(false);
                return;
            }

            // Par défaut : RECHERCHE DIRECTE
            await handleSearch();

        } catch (err: any) {
            console.error('❌ Erreur Yukpo:', err);
            Alert.alert('Erreur', 'Une erreur est survenue lors du traitement');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        try {
            // Simuler l'appel API de recherche
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Rediriger vers les résultats de recherche
            (navigation as any).navigate('ResultatBesoin', {
                searchQuery: inputText,
                type: 'recherche_besoin',
                gpsData: selectedLocation ? {
                    gps_fixe: `${selectedLocation.lat},${selectedLocation.lng}`,
                    gps_fixe_coords: JSON.stringify([selectedLocation])
                } : undefined
            });
        } catch (err: any) {
            console.error('Erreur lors de la recherche:', err);
            Alert.alert('Erreur', 'Impossible d\'effectuer la recherche');
        }
    };

    const handleCreateService = async () => {
        try {
            // Simuler l'appel API de création de service
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Rediriger vers le formulaire de création
            (navigation as any).navigate('FormulaireYukpoIntelligent', {
                inputText: inputText,
                type: 'creation_service',
                gpsData: selectedLocation ? {
                    gps_fixe: `${selectedLocation.lat},${selectedLocation.lng}`,
                    gps_fixe_coords: JSON.stringify([selectedLocation])
                } : undefined
            });
        } catch (error) {
            console.error('Erreur lors de la création:', error);
            Alert.alert('Erreur', 'Impossible de créer le service');
        }
    };

    const confirmCreateService = () => {
        setLoading(true);
        handleCreateService();
        setShowCreateServiceAlert(false);
    };

    const cancelCreateService = () => {
        handleSearch();
        setShowCreateServiceAlert(false);
    };

    const YukpoBrand = () => (
        <Text style={styles.brandText}>Yukpomnang</Text>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header avec notifications et chat */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Title style={styles.welcomeText}>
                            <TranslatedText text={`Bonjour ${user?.name || 'Utilisateur'} 👋`} />
                        </Title>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setShowNotificationModal(true)}
                        >
                            <Ionicons name="notifications" size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setShowChatModal(true)}
                        >
                            <Ionicons name="chatbubbles" size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Contenu principal */}
                <View style={styles.mainContent}>
                    {/* Titre et description */}
                    <View style={styles.titleSection}>
                        <Title style={styles.title}>
                            <YukpoBrand />
                        </Title>
                        <Paragraph style={styles.subtitle}>
                            <TranslatedText text="Créez ou trouvez un service en un instant.{'\n'}Une description, une image, un audio ou un fichier suffit." />
                        </Paragraph>
                    </View>

                    {/* Case à cocher pour création de service */}
                    <View style={styles.checkboxSection}>
                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setIsCreateService(!isCreateService)}
                        >
                            <View style={[styles.checkbox, isCreateService && styles.checkboxChecked]}>
                                {isCreateService && <Ionicons name="checkmark" size={16} color="white" />}
                            </View>
                            <Text style={styles.checkboxLabel}>
                                <TranslatedText text="Je souhaite créer un service/prestation" />
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Zone de saisie */}
                    <Card style={styles.inputCard}>
                        <Card.Content>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Décrivez votre besoin ou service..."
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />

                            {/* Sélection GPS */}
                            <View style={styles.gpsContainer}>
                                <TouchableOpacity
                                    style={styles.gpsButton}
                                    onPress={() => setShowGPSModal(true)}
                                >
                                    <Ionicons
                                        name={selectedLocation ? "location" : "location-outline"}
                                        size={20}
                                        color={selectedLocation ? theme.colors.primary : theme.colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.gpsButtonText,
                                        selectedLocation && styles.gpsButtonTextActive
                                    ]}>
                                        {selectedLocation ? 'Position sélectionnée' : 'Sélectionner une position'}
                                    </Text>
                                </TouchableOpacity>

                                {selectedLocation && (
                                    <View style={styles.locationInfo}>
                                        <Text style={styles.locationText}>
                                            📍 {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => setSelectedLocation(null)}
                                            style={styles.clearLocationButton}
                                        >
                                            <Ionicons name="close-circle" size={16} color="#F44336" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </Card.Content>
                    </Card>

                    {/* Bouton d'envoi moderne et responsive */}
                    <View style={[styles.submitContainer, { width: width - 32 }]}>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={loading || !inputText.trim()}
                            style={[styles.submitButton, { width: width - 64 }]}
                        >
                            <Text style={styles.submitButtonLabel}>
                                {loading ? 'Traitement...' : (isCreateService ? 'Créer un service' : 'Rechercher')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Indicateurs visuels */}
                    <View style={styles.featuresSection}>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>🎯</Text>
                            <Text style={styles.featureText}>Détection intelligente</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>⚡</Text>
                            <Text style={styles.featureText}>Traitement rapide</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>🔐</Text>
                            <Text style={styles.featureText}>100% sécurisé</Text>
                        </View>
                    </View>

                </View>
            </ScrollView>

            {/* Alerte de confirmation pour création de service */}
            {showCreateServiceAlert && (
                <View style={styles.alertOverlay}>
                    <View style={styles.alertContainer}>
                        <Title style={styles.alertTitle}>
                            Confirmation de création de service
                        </Title>
                        <Paragraph style={styles.alertText}>
                            Êtes-vous sûr de vouloir créer un service/prestation sur la plateforme ?
                        </Paragraph>
                        <View style={styles.alertButtons}>
                            <TouchableOpacity
                                onPress={cancelCreateService}
                                disabled={loading}
                                style={styles.alertButton}
                            >
                                <Text>Non, rechercher</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmCreateService}
                                disabled={loading}
                                style={[styles.alertButton, styles.alertButtonPrimary]}
                            >
                                <Text>Oui, créer un service</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Menu d'accès rapide */}
            <View style={styles.quickAccessSection}>
                <Card style={styles.quickAccessCard}>
                    <Card.Content>
                        <View style={styles.quickAccessHeader}>
                            <Title style={styles.quickAccessTitle}>
                                <TranslatedText text="Accès rapide" />
                            </Title>
                        </View>
                        <View style={styles.quickAccessButtons}>
                            <TouchableOpacity
                                style={styles.quickAccessButton}
                                onPress={() => (navigation as any).navigate('MesServices')}
                            >
                                <Ionicons name="briefcase" size={20} color={theme.colors.primary} />
                                <Text style={styles.quickAccessButtonText}>
                                    <TranslatedText text="Mes Services" />
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.quickAccessButton}
                                onPress={() => (navigation as any).navigate('Historique')}
                            >
                                <Ionicons name="time" size={20} color={theme.colors.primary} />
                                <Text style={styles.quickAccessButtonText}>
                                    <TranslatedText text="Mon Historique" />
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.quickAccessButton}
                                onPress={() => (navigation as any).navigate('RechargeTokens')}
                            >
                                <Ionicons name="card" size={20} color={theme.colors.primary} />
                                <Text style={styles.quickAccessButtonText}>
                                    <TranslatedText text="Recharger Tokens" />
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.quickAccessButton}
                                onPress={() => setShowLanguageModal(true)}
                            >
                                <Ionicons name="language" size={20} color={theme.colors.primary} />
                                <Text style={styles.quickAccessButtonText}>
                                    <TranslatedText text="Langue" />
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Card.Content>
                </Card>
            </View>

            {/* Modales */}
            <NotificationHistoryModal
                isOpen={showNotificationModal}
                onClose={() => setShowNotificationModal(false)}
            />
            <ChatHistoryModal
                isOpen={showChatModal}
                onClose={() => setShowChatModal(false)}
                onOpenChat={(chatId: string) => {
                    console.log('Ouvrir chat:', chatId);
                    setShowChatModal(false);
                }}
            />

            <GPSSelector
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coordinates) => {
                    setSelectedLocation(coordinates);
                    setShowGPSModal(false);
                }}
                currentLocation={selectedLocation}
            />

            <LanguageSelector
                visible={showLanguageModal}
                onClose={() => setShowLanguageModal(false)}
                onLanguageChange={(languageCode) => {
                    console.log('Langue changée:', languageCode);
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerLeft: {
        flex: 1,
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: theme.colors.surface,
    },
    mainContent: {
        flex: 1,
        alignItems: 'center',
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    brandText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    checkboxSection: {
        marginBottom: 24,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        borderRadius: 4,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: theme.colors.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        color: theme.colors.text,
    },
    inputCard: {
        width: '100%',
        marginBottom: 24,
        elevation: 2,
    },
    textInput: {
        fontSize: 16,
        color: theme.colors.text,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 12,
    },
    gpsContainer: {
        marginTop: 8,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    gpsButtonText: {
        marginLeft: 8,
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    gpsButtonTextActive: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#e8f5e8',
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.primary,
    },
    locationText: {
        fontSize: 12,
        color: theme.colors.text,
        fontFamily: 'monospace',
        flex: 1,
    },
    clearLocationButton: {
        padding: 4,
    },
    submitContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    submitButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 12,
        elevation: 4,
    },
    submitButtonContent: {
        paddingVertical: 12,
    },
    submitButtonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    featuresSection: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 32,
    },
    featureItem: {
        alignItems: 'center',
    },
    featureIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    featureText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    alertOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    alertTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    alertText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
    },
    alertButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    alertButton: {
        flex: 1,
    },
    alertButtonPrimary: {
        backgroundColor: theme.colors.primary,
    },
    quickAccessSection: {
        marginTop: 24,
        marginBottom: 16,
    },
    quickAccessCard: {
        elevation: 2,
    },
    quickAccessHeader: {
        marginBottom: 16,
    },
    quickAccessTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        textAlign: 'center',
    },
    quickAccessButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickAccessButton: {
        flex: 1,
        minWidth: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    quickAccessButtonText: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default HomeScreen;












