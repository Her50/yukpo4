// ✅ Écran de recherche de banques de sang (Mobile) - VERSION REFONDUE MODERNE
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost } from '../../services/api';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface BanqueSangSearchFilters {
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    groupe_sanguin?: string;
    urgence?: boolean;
    available_only?: boolean;
    check_stocks?: boolean;
}

// ✅ Composant pour bouton don de sang avec animation élégante
const BloodDonationButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Animation de pulsation continue et élégante
    React.useEffect(() => {
        // Animation de pulsation pour l'effet de lueur
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );

        // Animation de pulsation pour l'icône (scale)
        const scaleAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.12,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );

        // Animation de clignotement d'opacité élégant
        const opacityAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacityAnim, {
                    toValue: 0.7,
                    duration: 1300,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 1300,
                    useNativeDriver: true,
                }),
            ])
        );

        // Démarrer toutes les animations
        pulseAnimation.start();
        scaleAnimation.start();
        opacityAnimation.start();

        // Nettoyer les animations au démontage
        return () => {
            pulseAnimation.stop();
            scaleAnimation.stop();
            opacityAnimation.stop();
        };
    }, []);

    return (
        <TouchableOpacity
            style={styles.bloodDonationButton}
            onPress={() => {
                hapticPress();
                onPress();
            }}
            activeOpacity={0.8}
        >
            {/* Effet de lueur animée en arrière-plan */}
            <Animated.View
                style={[
                    styles.bloodDonationGlow,
                    {
                        transform: [{ scale: pulseAnim }],
                        opacity: opacityAnim.interpolate({
                            inputRange: [0.7, 1],
                            outputRange: [0.2, 0.5],
                        }),
                    },
                ]}
            />
            {/* Contenu du bouton avec animation */}
            <Animated.View
                style={[
                    styles.bloodDonationButtonContent,
                    {
                        transform: [{ scale: scaleAnim }],
                        opacity: opacityAnim,
                    },
                ]}
            >
                <SafeIcon
                    name="heart"
                    size={22}
                    color="#DC2626"
                    type="lucide"
                />
            </Animated.View>
        </TouchableOpacity>
    );
};

const BanqueSangSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();

    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [locationText, setLocationText] = useState<string>('');
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [loading, setLoading] = useState(false);
    const [userBloodGroup, setUserBloodGroup] = useState<string>('');
    const [compatibleGroups, setCompatibleGroups] = useState<string[]>([]);
    const [showCompatibility, setShowCompatibility] = useState(false);

    // Charger la localisation GPS automatiquement
    useEffect(() => {
        if (location?.coords) {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setGpsData({ lat, lng });
            convertGpsToText(lat, lng);
        }
    }, [location]);

    // Convertir les coordonnées GPS en texte d'adresse
    const convertGpsToText = async (lat: number, lng: number) => {
        try {
            setLoadingLocation(true);
            const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (reverseGeocode && reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                const addressParts = [
                    addr.street,
                    addr.streetNumber,
                    addr.city,
                    addr.region,
                    addr.country
                ].filter(Boolean);
                setLocationText(addressParts.join(', ') || t('banqueSangSearch.positionGps'));
            } else {
                setLocationText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
        } catch (error) {
            console.error('[BanqueSangSearchScreen] Erreur géocodage inverse:', error);
            setLocationText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleGPSSelect = async (coordinates: string) => {
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
            await convertGpsToText(lat, lng);
        }
        setShowGPSModal(false);
    };

    // Fonction unifiée qui combine recherche classique et matching intelligent
    const handleUnifiedSearch = async () => {
        if (!gpsData) {
            Alert.alert('Erreur', 'Veuillez sélectionner une localisation GPS');
            return;
        }

        hapticPress();
        setLoading(true);

        try {
            // Si l'utilisateur est connecté, utiliser le matching intelligent
            if (user && userBloodGroup) {
                // Navigation vers l'écran de matching avec les paramètres de recherche
                navigation.navigate('BloodDonation' as never, {
                    searchParams: {
                        lat: gpsData.lat,
                        lng: gpsData.lng,
                        max_distance_km: maxDistance,
                        blood_group: userBloodGroup,
                        urgency: false, // Par défaut, pas d'urgence
                    }
                } as never);
            } else {
                // Sinon, recherche classique
                const filters: BanqueSangSearchFilters = {
                    lat: gpsData.lat,
                    lng: gpsData.lng,
                    max_distance_km: maxDistance,
                    available_only: true, // Par défaut, seulement les disponibles
                    check_stocks: true,
                };
                if (userBloodGroup) {
                    filters.groupe_sanguin = userBloodGroup;
                }

                navigation.navigate('BanqueSangList' as never, { filters } as never);
            }
        } catch (error: any) {
            console.error('[BanqueSangSearchScreen] Erreur recherche:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue lors de la recherche');
        } finally {
            setLoading(false);
        }
    };

    const groupesSanguins = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']; // Utilisé uniquement pour la modal d'enregistrement

    // Charger le groupe sanguin de l'utilisateur
    useEffect(() => {
        loadUserBloodGroup();
    }, [user]);

    const loadUserBloodGroup = async () => {
        if (!user) return;
        try {
            const response = await apiGet('/api/blood-donation/donor/blood-groups');
            const rdata: any = response?.data;
            if (response?.success && rdata && rdata.length > 0) {
                // ✅ CORRIGÉ: Le backend renvoie "groupe_sanguin", pas "blood_group"
                const firstGroup = rdata[0].groupe_sanguin;
                setUserBloodGroup(firstGroup);
                loadCompatibility(firstGroup);
            }
        } catch (error) {
            console.error('[BanqueSangSearchScreen] Erreur chargement groupe sanguin:', error);
        }
    };

    const loadCompatibility = async (group: string) => {
        try {
            const response = await apiGet(`/api/blood-donation/compatibility/${group}`);
            if (response?.success && response?.data) {
                setCompatibleGroups((response.data as any).compatible_groups || []);
            }
        } catch (error) {
            console.error('[BanqueSangSearchScreen] Erreur chargement compatibilité:', error);
        }
    };

    const saveBloodGroup = async (group: string) => {
        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté pour enregistrer votre groupe sanguin');
            return;
        }
        try {
            setLoading(true);
            // ✅ CORRIGÉ: Le backend attend "groupe_sanguin", pas "blood_group"
            const response = await apiPost('/api/blood-donation/donor/blood-group', {
                groupe_sanguin: group,
            });
            if (response?.success) {
                setUserBloodGroup(group);
                loadCompatibility(group);
                Alert.alert('Succès', 'Votre groupe sanguin a été enregistré');
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible d\'enregistrer le groupe sanguin');
            }
        } catch (error: any) {
            console.error('[BanqueSangSearchScreen] Erreur enregistrement:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient moderne (rouge doux) */}
            <LinearGradient
                colors={['#F87171', '#FB923C']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            hapticPress();
                            navigation.goBack();
                        }}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>{t('banqueSangSearch.rechercherUneBanqueDeSang')}</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez rapidement une banque de sang pour un don ou une demande urgente
                        </Text>
                    </View>
                    {/* ✅ Bouton "Devenir donneur" animé - affiché uniquement si l'utilisateur n'est pas déjà volontaire */}
                    {!userBloodGroup && (
                        <BloodDonationButton
                            onPress={() => {
                                navigation.navigate('BloodDonation' as never);
                            }}
                        />
                    )}
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Bannière groupe sanguin (si utilisateur connecté) */}
                {user && (
                    <View style={styles.bloodGroupBanner}>
                        <LinearGradient
                            colors={['#FEE2E2', '#FECACA']}
                            style={styles.bloodGroupBannerGradient}
                        >
                            <View style={styles.bloodGroupBannerContent}>
                                <View style={styles.bloodGroupBannerIcon}>
                                    <SafeIcon name="droplet" size={20} color="#DC2626" type="lucide" />
                                </View>
                                <View style={styles.bloodGroupBannerText}>
                                    <Text style={styles.bloodGroupBannerTitle}>
                                        {userBloodGroup ? `Groupe sanguin: ${userBloodGroup}` : 'Enregistrer votre groupe sanguin'}
                                    </Text>
                                    {userBloodGroup && compatibleGroups.length > 0 && (
                                        <Text style={styles.bloodGroupBannerSubtitle}>
                                            Compatible avec: {compatibleGroups.join(', ')}
                                        </Text>
                                    )}
                                </View>
                                {!userBloodGroup && (
                                    <TouchableOpacity
                                        style={styles.bloodGroupBannerButton}
                                        onPress={() => {
                                            hapticPress();
                                            setShowCompatibility(true);
                                        }}
                                    >
                                        <SafeIcon name="plus" size={18} color="#DC2626" type="lucide" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* Formulaire de recherche */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>{t('banqueSangSearch.localisation')}/Text>

                    {/* Localisation GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" /> Localisation
                        </Text>
                        <TouchableOpacity
                            style={styles.locationButton}
                            onPress={() => {
                                hapticPress();
                                setShowGPSModal(true);
                            }}
                            activeOpacity={0.7}
                        >
                            {loadingLocation ? (
                                <ActivityIndicator size="small" color="#6B7280" />
                            ) : (
                                <SafeIcon name="map-pin" size={18} color="#6B7280" type="lucide" />
                            )}
                            <Text style={styles.locationButtonText} numberOfLines={2}>
                                {locationText || t('banqueSangSearch.selectionnerUneLocalisationGps')}
                            </Text>
                            <SafeIcon name="chevron-right" size={18} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Distance max */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="maximize-2" size={14} color="#6B7280" type="lucide" /> Distance maximale
                        </Text>
                        <View style={styles.distanceCard}>
                            <TouchableOpacity
                                style={styles.distanceButton}
                                onPress={() => {
                                    hapticPress();
                                    setMaxDistance(Math.max(5, maxDistance - 5));
                                }}
                            >
                                <SafeIcon name="minus" size={16} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                            <View style={styles.distanceValueContainer}>
                                <Text style={styles.distanceValue}>{maxDistance}</Text>
                                <Text style={styles.distanceUnit}>km</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.distanceButton}
                                onPress={() => {
                                    hapticPress();
                                    setMaxDistance(Math.min(200, maxDistance + 5));
                                }}
                            >
                                <SafeIcon name="plus" size={16} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bouton unique : Recherche intelligente (combine matching + recherche) */}
                    <TouchableOpacity
                        onPress={handleUnifiedSearch}
                        disabled={loading || !gpsData}
                        style={[styles.unifiedSearchButton, (loading || !gpsData) && styles.unifiedSearchButtonDisabled]}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#F87171', '#FB923C']}
                            style={styles.unifiedSearchButtonGradient}
                        >
                            <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.unifiedSearchButtonText}>
                                {loading ? 'Recherche en cours...' : user ? 'Recherche intelligente' : 'Lancer la recherche'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={18} color="#F87171" type="lucide" />
                        <Text style={styles.infoTitle}>{t('banqueSangSearch.bonASavoir')}</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Les banques de sang acceptent les dons volontaires{'\n'}
                        • En cas dt('banqueSangSearchScreen.urgenceContactezDirectementLeTelephoneDurgence')\n'}
                        • Vérifiez les stocks disponibles avant de vous déplacer{'\n'}
                        • Les groupes sanguins compatibles sont automatiquement suggérés
                    </Text>
                </View>
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
            />

            {/* Modal enregistrement groupe sanguin */}
            {showCompatibility && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('banqueSangSearchScreen.enregistrerVotreGroupeSanguin')}</Text>
                            <TouchableOpacity
                                onPress={() => setShowCompatibility(false)}
                                style={styles.modalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.modalDescription}>
                                Enregistrez votre groupe sanguin pour faciliter les recherches et le matching avec les donneurs.
                            </Text>
                            <View style={styles.bloodGroupModalContainer}>
                                {groupesSanguins.map((groupe) => (
                                    <TouchableOpacity
                                        key={groupe}
                                        style={[
                                            styles.bloodGroupModalButton,
                                            userBloodGroup === groupe && styles.bloodGroupModalButtonActive
                                        ]}
                                        onPress={() => {
                                            hapticPress();
                                            saveBloodGroup(groupe);
                                            setShowCompatibility(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.bloodGroupModalText,
                                            userBloodGroup === groupe && styles.bloodGroupModalTextActive
                                        ]}>
                                            {groupe}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        position: 'relative',
    },
    backButton: {
        marginRight: 12,
        marginTop: 4,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.95)',
        lineHeight: 18,
    },
    // ✅ Styles pour bouton don de sang avec animation
    bloodDonationButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FEE2E2', // Fond rose clair pour attirer l'attention
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1.5,
        borderColor: '#DC2626', // Bordure rouge pour visibilité
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        marginTop: 4,
    },
    bloodDonationButtonContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    bloodDonationGlow: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#DC2626',
        opacity: 0.4,
        zIndex: 1,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    bloodGroupBanner: {
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    bloodGroupBannerGradient: {
        padding: 14,
    },
    bloodGroupBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bloodGroupBannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(220, 38, 38, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bloodGroupBannerText: {
        flex: 1,
    },
    bloodGroupBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#991B1B',
        marginBottom: 2,
    },
    bloodGroupBannerSubtitle: {
        fontSize: 11,
        color: '#B91C1C',
        lineHeight: 14,
    },
    bloodGroupBannerButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchFormCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    locationButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    distanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    distanceButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F87171',
        justifyContent: 'center',
        alignItems: 'center',
    },
    distanceValueContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
    },
    distanceUnit: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
    },
    unifiedSearchButton: {
        marginTop: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    unifiedSearchButtonDisabled: {
        opacity: 0.5,
    },
    unifiedSearchButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        gap: 10,
    },
    unifiedSearchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    infoCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#991B1B',
    },
    infoText: {
        fontSize: 12,
        color: '#991B1B',
        lineHeight: 18,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        width: '90%',
        maxHeight: '70%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBody: {
        padding: 20,
    },
    modalDescription: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 20,
        lineHeight: 18,
    },
    bloodGroupModalContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    bloodGroupModalButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        minWidth: 80,
        alignItems: 'center',
    },
    bloodGroupModalButtonActive: {
        backgroundColor: '#F87171',
        borderColor: '#F87171',
    },
    bloodGroupModalText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
    },
    bloodGroupModalTextActive: {
        color: '#FFFFFF',
    },
});

export default BanqueSangSearchScreen;
