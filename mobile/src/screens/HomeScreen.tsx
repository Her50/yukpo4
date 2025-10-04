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
import { servicesApi, iaApi } from '../services/api';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
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

    // Fonction de recherche directe (comme frontend - appel API puis navigation)
    const handleSearch = async (input: any) => {
        try {
            setLoading(true);
            console.log('[HomeScreen] Recherche avec:', input);

            // Préparer la requête comme le frontend
            const searchRequest = {
                texte: input.texte || input.description || '',
                base64_image: input.base64_image || [],
                audio_base64: input.audio_base64 || [],
                video_base64: input.video_base64 || [],
                doc_base64: input.doc_base64 || [],
                excel_base64: input.excel_base64 || [],
                pdf_base64: input.pdf_base64 || [],
                gps_mobile: input.gps_mobile || selectedLocation,
                gps_zone: input.gps_zone,
                gps_fixe: input.gps_fixe,
                gps_fixe_coords: input.gps_fixe_coords
            };

            // Appel direct à l'API de recherche (comme frontend)
            const response = await servicesApi.searchDirect(searchRequest);

            if (response.success && response.data) {
                const result = response.data as any;
                const results = result?.resultats?.resultats || result?.resultats || [];

                // Rediriger vers ResultatBesoin avec les résultats
                (navigation as any).navigate('ResultatBesoin', {
                    results: results,
                    type: 'recherche_besoin',
                    suggestion: result
                });
            } else {
                Alert.alert('Aucun résultat', 'Aucun service trouvé pour votre recherche');
            }
        } catch (error) {
            console.error('Erreur recherche:', error);
            Alert.alert('Erreur', 'Impossible d\'effectuer la recherche. Vérifiez votre connexion.');
        } finally {
            setLoading(false);
        }
    };

    // Fonction de création de service (comme frontend - génération de suggestions)
    const handleCreateService = async (input: any) => {
        try {
            setLoading(true);
            console.log('[HomeScreen] Création service avec:', input);

            // Préparer la requête comme le frontend
            const serviceRequest = {
                texte: input.texte || input.description || '',
                base64_image: input.base64_image || [],
                audio_base64: input.audio_base64 || [],
                video_base64: input.video_base64 || [],
                doc_base64: input.doc_base64 || [],
                excel_base64: input.excel_base64 || [],
                pdf_base64: input.pdf_base64 || []
            };

            // Appeler l'IA pour générer des suggestions (comme frontend)
            const response = await iaApi.generateServiceForm(serviceRequest);

            if (response.success && response.data) {
                const result = response.data as any;

                // Extraire les médias de la réponse
                const mediaData = {
                    base64_image: result.service_data?.base64_image || input.base64_image,
                    audio_base64: result.service_data?.audio_base64 || input.audio_base64,
                    video_base64: result.service_data?.video_base64 || input.video_base64,
                    doc_base64: result.service_data?.doc_base64 || input.doc_base64
                };

                // Extraire les données GPS
                const gpsData = {
                    gps_mobile: input.gps_mobile || selectedLocation,
                    gps_zone: input.gps_zone,
                    gps_fixe: input.gps_fixe,
                    gps_fixe_coords: input.gps_fixe_coords
                };

                // Rediriger vers FormulaireYukpoIntelligent avec les suggestions
                (navigation as any).navigate('FormulaireYukpoIntelligent', {
                    suggestion: {
                        ...result,
                        intention: 'creation_service',
                        data: result.suggestions || result.data || result
                    },
                    type: 'creation_service',
                    mediaData: mediaData,
                    gpsData: gpsData
                });
            } else {
                Alert.alert('Erreur', 'Impossible de générer les suggestions de service');
            }
        } catch (error) {
            console.error('Erreur création:', error);
            Alert.alert('Erreur', 'Impossible de générer les suggestions. Vérifiez votre connexion.');
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
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header moderne */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View>
                            <Text style={styles.greetingText}>Bonjour 👋</Text>
                            <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
                            <View style={styles.balanceContainer}>
                                <Text style={styles.walletIcon}>💰</Text>
                                <Text style={styles.balanceText}>{user?.credits?.toLocaleString() || 0} tokens</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setShowNotificationModal(true)}
                        >
                            <Text style={styles.notificationIcon}>🔔</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setShowChatModal(true)}
                        >
                            <Text style={styles.chatIcon}>💬</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Titre principal */}
                <View style={styles.titleContainer}>
                    <Text style={styles.brandTitle}>
                        <Text style={styles.brandYuk}>Yuk</Text>
                        <Text style={styles.brandPo}>po</Text>
                    </Text>
                    <Text style={styles.subtitle}>
                        Créez ou trouvez un service en un instant.{'\n'}
                        <Text style={styles.subtitleSecondary}>
                            Une description, une image, un audio ou un fichier suffit.
                        </Text>
                    </Text>
                </View>

                {/* Sélecteur de mode */}
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[styles.modeButton, !isCreateService && styles.modeButtonActive]}
                        onPress={() => setIsCreateService(false)}
                    >
                        <Text style={[styles.tabIcon, { color: !isCreateService ? '#FFF' : '#666' }]}>🔍</Text>
                        <Text style={[
                            styles.modeButtonText,
                            !isCreateService && styles.modeButtonTextActive
                        ]}>
                            Rechercher
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.modeButton, isCreateService && styles.modeButtonActive]}
                        onPress={() => setIsCreateService(true)}
                    >
                        <Text style={[styles.tabIcon, { color: isCreateService ? '#FFF' : '#666' }]}>➕</Text>
                        <Text style={[
                            styles.modeButtonText,
                            isCreateService && styles.modeButtonTextActive
                        ]}>
                            Créer un service
                        </Text>
                    </TouchableOpacity>
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

                {/* Indicateurs visuels */}
                <View style={styles.indicatorsSection}>
                    <View style={styles.indicator}>
                        <Text style={styles.indicatorIcon}>🎯</Text>
                        <Text style={styles.indicatorText}>Détection intelligente</Text>
                    </View>
                    <View style={styles.indicator}>
                        <Text style={styles.indicatorIcon}>⚡</Text>
                        <Text style={styles.indicatorText}>Traitement rapide</Text>
                    </View>
                    <View style={styles.indicator}>
                        <Text style={styles.indicatorIcon}>🔐</Text>
                        <Text style={styles.indicatorText}>100% sécurisé</Text>
                    </View>
                </View>
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
        backgroundColor: '#F8F9FA',
    },
    scrollContent: {
        paddingBottom: 32,
    },
    header: {
        backgroundColor: '#FFF',
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 24,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greetingText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    balanceText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366F1',
        marginLeft: 6,
    },
    walletIcon: {
        fontSize: 16,
    },
    notificationIcon: {
        fontSize: 24,
    },
    chatIcon: {
        fontSize: 24,
    },
    tabIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    headerButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    brandTitle: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    brandYuk: {
        color: '#FFC107',
        fontWeight: 'bold',
    },
    brandPo: {
        color: '#EF4444',
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 18,
        color: '#374151',
        textAlign: 'center',
        lineHeight: 28,
        fontWeight: '500',
    },
    subtitleSecondary: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '400',
    },
    modeSelector: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 24,
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    modeButtonActive: {
        backgroundColor: '#6366F1',
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    modeButtonTextActive: {
        color: '#FFF',
    },
    indicatorsSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginTop: 32,
        gap: 32,
    },
    indicator: {
        alignItems: 'center',
        flex: 1,
    },
    indicatorIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    indicatorText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        fontWeight: '400',
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




