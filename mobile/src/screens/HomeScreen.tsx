import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ChatHistoryModal from '../components/ChatHistoryModal';
import ChatInputMobile from '../components/ChatInputMobile';
import GPSSelector from '../components/GPSSelector';
import GPSSelectorMobile from '../components/GPSSelectorMobile';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    // Debug pour vérifier les données utilisateur
    React.useEffect(() => {
        console.log('[HomeScreen] Utilisateur chargé:', {
            name: user?.name,
            email: user?.email,
            credits: user?.credits,
            role: user?.role
        });
    }, [user]);
    const [loading, setLoading] = useState(false);
    const [isCreateService, setIsCreateService] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showGPSMobileModal, setShowGPSMobileModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [showCreateServiceAlert, setShowCreateServiceAlert] = useState(false);
    const [pendingInput, setPendingInput] = useState<any>(null);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);

    // Détection GPS automatique au chargement
    React.useEffect(() => {
        if (typeof navigator !== 'undefined' && (navigator as any).geolocation) {
            (navigator as any).geolocation.getCurrentPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setSelectedLocation(coords);
                    console.log('[HomeScreen] GPS automatique:', coords);
                },
                (error) => {
                    console.warn('[HomeScreen] GPS non disponible:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        }
    }, []);

    // Fonction de recherche directe (utilise yukpoclient comme frontend)
    const handleSearch = async (input: any) => {
        try {
            setLoading(true);
            console.log('[HomeScreen] Recherche avec:', input);

            // Utiliser yukpoclient (comme le frontend)
            const result = await rechercherServices(input);

            // Rediriger vers ResultatBesoin avec les résultats
            const results = result?.resultats?.resultats || result?.resultats || [];
            (navigation as any).navigate('ResultatBesoin', {
                results: results,
                type: 'recherche_besoin',
                suggestion: result
            });
        } catch (error: any) {
            console.error('Erreur recherche:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'effectuer la recherche. Vérifiez votre connexion.');
        } finally {
            setLoading(false);
        }
    };

    // Fonction de création de service (utilise yukpoclient comme frontend)
    const handleCreateService = async (input: any) => {
        try {
            setLoading(true);
            console.log('[HomeScreen] Création service avec:', input);

            // Utiliser yukpoclient (comme le frontend)
            const result = await genererSuggestionsService(input);

            // Extraire les médias de la réponse
            const mediaData = {
                base64_image: result.data.service_data?.base64_image || input.base64_image,
                audio_base64: result.data.service_data?.audio_base64 || input.audio_base64,
                video_base64: result.data.service_data?.video_base64 || input.video_base64,
                doc_base64: result.data.service_data?.doc_base64 || input.doc_base64
            };

            // Extraire les données GPS
            const gpsData = {
                gps_mobile: input.gps_mobile || selectedLocation,
                gps_zone: input.gps_zone,
                gps_fixe: input.gps_fixe,
                gps_fixe_coords: input.gps_fixe_coords
            };

            // Rediriger vers FormulaireYukpoIntelligent avec les suggestions (comme frontend)
            (navigation as any).navigate('FormulaireYukpoIntelligent', {
                suggestion: {
                    ...result.data,
                    intention: 'creation_service',
                    data: result.data.suggestions || result.data.data || result.data
                },
                type: 'creation_service',
                mediaData: mediaData,
                gpsData: gpsData
            });
        } catch (error: any) {
            console.error('Erreur création:', error);
            Alert.alert('Erreur', error.message || 'Impossible de générer les suggestions. Vérifiez votre connexion.');
        } finally {
            setLoading(false);
        }
    };

    // Gestion de la soumission (comme frontend)
    const handleSubmit = async (input: any) => {
        if (isCreateService) {
            // Demander confirmation pour création
            setPendingInput(input);
            setShowCreateServiceAlert(true);
            return;
        }

        // Par défaut: recherche directe
        await handleSearch(input);
    };

    // Confirmation création
    const confirmCreateService = () => {
        if (pendingInput) {
            handleCreateService(pendingInput);
            setShowCreateServiceAlert(false);
            setPendingInput(null);
        }
    };

    // Annulation → faire recherche à la place
    const cancelCreateService = () => {
        if (pendingInput) {
            handleSearch(pendingInput);
            setShowCreateServiceAlert(false);
            setPendingInput(null);
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Arrière-plan moderne avec dégradé */}
            <View style={styles.backgroundGradient} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header moderne avec dégradé */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View style={styles.userInfo}>
                            <Text style={styles.greetingText}>
                                Bonjour {user?.name ? user.name.split(' ')[0] : '👋'}
                            </Text>
                            <TouchableOpacity
                                style={styles.balanceContainer}
                                onPress={() => (navigation as any).navigate('Historique')}
                            >
                                <View style={styles.balanceIcon}>
                                    <Text style={styles.walletIcon}>💰</Text>
                                </View>
                                <Text style={styles.balanceText}>
                                    {user?.credits ? (user.credits / 10).toLocaleString('fr-FR') : 0} FCFA
                                </Text>
                                <Text style={styles.balanceHint}>👆 Voir l'historique</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.headerButton}
                                onPress={() => setShowNotificationModal(true)}
                            >
                                <Text style={styles.notificationIcon}>🔔</Text>
                                <View style={styles.notificationBadge} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.headerButton}
                                onPress={() => setShowChatModal(true)}
                            >
                                <Text style={styles.chatIcon}>💬</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Titre principal avec design moderne */}
                <View style={styles.titleContainer}>
                    <View style={styles.brandContainer}>
                        <Text style={styles.brandTitle}>
                            <Text style={styles.brandYuk}>Yuk</Text>
                            <Text style={styles.brandPo}>po</Text>
                        </Text>
                        <View style={styles.brandSubtitle}>
                            <Text style={styles.subtitle}>
                                Créez ou trouvez un service en un instant
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Sélecteur de mode moderne */}
                <View style={styles.modeSelector}>
                    <View style={styles.modeSelectorContainer}>
                        <TouchableOpacity
                            style={[styles.modeButton, !isCreateService && styles.modeButtonActive]}
                            onPress={() => setIsCreateService(false)}
                        >
                            <View style={styles.modeButtonContent}>
                                <Text style={[styles.tabIcon, { color: !isCreateService ? '#FFF' : '#06B6D4' }]}>🔍</Text>
                                <Text style={[
                                    styles.modeButtonText,
                                    !isCreateService && styles.modeButtonTextActive
                                ]}>
                                    Rechercher
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modeButton, isCreateService && styles.modeButtonActive]}
                            onPress={() => setIsCreateService(true)}
                        >
                            <View style={styles.modeButtonContent}>
                                <Text style={[styles.tabIcon, { color: isCreateService ? '#FFF' : '#06B6D4' }]}>➕</Text>
                                <Text style={[
                                    styles.modeButtonText,
                                    isCreateService && styles.modeButtonTextActive
                                ]}>
                                    Créer un service
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ChatInput avec support multimédia */}
                <ChatInputMobile
                    onSubmit={handleSubmit}
                    loading={loading}
                    placeholder={isCreateService
                        ? "Décrivez le service que vous proposez..."
                        : "Décrivez ce que vous recherchez..."}
                    gpsData={selectedLocation}
                    onGPSPress={() => setShowGPSMobileModal(true)}
                />

            </ScrollView>

            {/* Modal de confirmation création */}
            {showCreateServiceAlert && (
                <View style={styles.alertOverlay}>
                    <View style={styles.alertContainer}>
                        <Text style={styles.alertTitle}>
                            Confirmation de création de service
                        </Text>
                        <Text style={styles.alertText}>
                            Êtes-vous sûr de vouloir créer un service/prestation sur la plateforme ?
                        </Text>
                        <View style={styles.alertButtons}>
                            <TouchableOpacity
                                onPress={cancelCreateService}
                                disabled={loading}
                                style={[styles.alertButton, styles.alertButtonSecondary]}
                            >
                                <Text style={styles.alertButtonTextSecondary}>Non, rechercher</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmCreateService}
                                disabled={loading}
                                style={[styles.alertButton, styles.alertButtonPrimary]}
                            >
                                <Text style={styles.alertButtonText}>
                                    {loading ? 'Ouverture...' : 'Oui, créer'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Modal GPS */}
            <GPSSelector
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coordinates) => {
                    setSelectedLocation(coordinates);
                    setShowGPSModal(false);
                }}
                currentLocation={selectedLocation}
            />

            {/* Modal GPS Mobile */}
            <GPSSelectorMobile
                visible={showGPSMobileModal}
                onClose={() => setShowGPSMobileModal(false)}
                onLocationSelect={(location) => {
                    setSelectedLocation({ lat: location.latitude, lng: location.longitude });
                    setShowGPSMobileModal(false);
                }}
                currentLocation={selectedLocation ? {
                    latitude: selectedLocation.lat,
                    longitude: selectedLocation.lng
                } : null}
            />

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
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    backgroundGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 300,
        backgroundColor: '#06B6D4', // Teal/Cyan moderne - très tendance 2024
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30,
        marginBottom: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    userInfo: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    greetingText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 4,
        fontWeight: '500',
    },
    userName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    balanceIcon: {
        marginRight: 8,
    },
    balanceText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginRight: 8,
    },
    balanceHint: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        fontStyle: 'italic',
    },
    walletIcon: {
        fontSize: 18,
    },
    headerButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    notificationIcon: {
        fontSize: 22,
    },
    chatIcon: {
        fontSize: 22,
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
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    brandContainer: {
        alignItems: 'center',
    },
    brandTitle: {
        fontSize: 40,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    brandYuk: {
        color: '#FFC107',
    },
    brandPo: {
        color: '#EF4444',
    },
    brandSubtitle: {
        alignItems: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
        fontWeight: '500',
    },
    modeSelector: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    modeSelectorContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 6,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeButtonActive: {
        backgroundColor: '#06B6D4',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    modeButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
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
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    alertTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 16,
        textAlign: 'center',
    },
    alertText: {
        fontSize: 16,
        color: '#666',
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
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    alertButtonPrimary: {
        backgroundColor: '#6366F1',
    },
    alertButtonSecondary: {
        backgroundColor: '#F0F0F0',
    },
    alertButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },
    alertButtonTextSecondary: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
    },
});

export default HomeScreen;




