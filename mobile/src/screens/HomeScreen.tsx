/**
 * HomeScreen - VERSION DE BASE SIMPLIFIÉE
 * 
 * Composants essentiels:
 * - ChatInputMobile (recherche et création)
 * - Mode recherche/création
 * - Bouton d'envoi
 * - Modaux (GPS, notifications, chat)
 */

import * as ReactNavigation from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
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
import ModernGPSModal from '../components/ModernGPSModal';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { genererSuggestionsService, rechercherServices } from '../services/yukpoclient';
import { modernColors } from '../theme/modernTheme';
import { hapticPress } from '../utils/hapticFeedback';

const HomeScreen: React.FC = () => {
    // Navigation et contextes
    const navigation = ReactNavigation.useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocationSafe();
    const { colors } = useTheme();

    // États simples
    const [isCreateService, setIsCreateService] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Navigation simplifiée
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

    // Handler recherche
    const handleSearch = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur', 'Vous devez être connecté pour effectuer une recherche');
                return;
            }

            setLoading(true);
            console.log('[HomeScreen] Recherche avec:', input);

            const result = await rechercherServices(input);
            const results = result?.data || result?.resultats?.resultats || result?.resultats || [];

            if (Array.isArray(results) && results.length > 0) {
                navigate('ResultatBesoin', {
                    results: results,
                    type: 'recherche_besoin',
                    searchQuery: input.texte || input.text || '',
                    hasError: false,
                });
            } else {
                Alert.alert('Aucun résultat', 'Aucun service trouvé pour votre recherche');
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur recherche:', error);
            setLoading(false);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la recherche');
        }
    }, [user, navigate]);

    // Handler création service
    const handleCreateService = useCallback(async (input: any) => {
        try {
            if (!user) {
                Alert.alert('Erreur', 'Vous devez être connecté pour créer un service');
                return;
            }

            setLoading(true);

            const result = await genererSuggestionsService(input);
            if (result && result.data) {
                navigate('FormulaireYukpoIntelligent', {
                    suggestions: result.data,
                    initialInput: input,
                });
            } else {
                Alert.alert('Erreur', 'Impossible de générer les suggestions');
            }

            setLoading(false);
        } catch (error: any) {
            console.error('[HomeScreen] Erreur création service:', error);
            setLoading(false);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la création');
        }
    }, [user, navigate]);

    // Handler soumission
    const handleSubmit = useCallback(async (input: any) => {
        try {
            if (isCreateService) {
                await handleCreateService(input);
            } else {
                await handleSearch(input);
            }
        } catch (error) {
            console.error('[HomeScreen] Erreur handleSubmit:', error);
        }
    }, [isCreateService, handleSearch, handleCreateService]);

    // Handler GPS
    const handleGPSPress = useCallback(() => {
        hapticPress();
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
                    console.log('[HomeScreen] Localisation GPS définie:', { lat, lng });
                }
            }
        } catch (error) {
            console.error('[HomeScreen] Erreur parsing GPS:', error);
        }
        setShowGPSModal(false);
    }, []);

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header simple */}
                <View style={styles.header}>
                    <Text style={styles.title}>Yukpomnang</Text>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => {
                                hapticPress();
                                setShowNotificationModal(true);
                            }}
                        >
                            <Text style={styles.headerButtonIcon}>🔔</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => {
                                hapticPress();
                                setShowChatModal(true);
                            }}
                        >
                            <Text style={styles.headerButtonIcon}>💬</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Sélecteur de mode */}
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            !isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            hapticPress();
                            setIsCreateService(false);
                        }}
                    >
                        <Text style={[
                            styles.modeButtonText,
                            !isCreateService && styles.modeButtonTextActive
                        ]}>
                            🔍 Rechercher
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            isCreateService && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            hapticPress();
                            setIsCreateService(true);
                        }}
                    >
                        <Text style={[
                            styles.modeButtonText,
                            isCreateService && styles.modeButtonTextActive
                        ]}>
                            ➕ Créer un service
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ChatInputMobile */}
                <View style={styles.inputContainer}>
                    <ChatInputMobile
                        onSubmit={handleSubmit}
                        loading={loading}
                        placeholder={
                            isCreateService
                                ? 'Décrivez le service que vous voulez créer...'
                                : 'Décrivez votre besoin...'
                        }
                        onGPSPress={handleGPSPress}
                        showSendButton={true}
                        showAutocomplete={!isCreateService}
                        isSearchMode={!isCreateService}
                        isCreateService={isCreateService}
                    />
                </View>

                {/* Zone de contenu vide pour l'instant */}
                <View style={styles.contentArea}>
                    <Text style={styles.contentText}>
                        {isCreateService
                            ? 'Créez votre service en remplissant le formulaire ci-dessus'
                            : 'Recherchez des services en remplissant le formulaire ci-dessus'}
                    </Text>
                </View>
            </ScrollView>

            {/* Modal GPS */}
            {showGPSModal && (
                <ModernGPSModal
                    visible={true}
                    onClose={() => setShowGPSModal(false)}
                    onSelect={handleGPSSelect}
                    currentLocation={selectedLocation}
                    title="Sélectionner votre localisation"
                    allowZoneSelection={true}
                />
            )}

            {/* Modal Notifications */}
            {showNotificationModal && (
                <NotificationHistoryModal
                    isOpen={true}
                    onClose={() => setShowNotificationModal(false)}
                    onChange={() => { }}
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
        backgroundColor: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerButtonIcon: {
        fontSize: 20,
    },
    modeSelector: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 4,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    inputContainer: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    contentArea: {
        paddingHorizontal: 16,
        paddingVertical: 40,
        alignItems: 'center',
    },
    contentText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
});

export default HomeScreen;
