// ✅ Écran de recherche de banques de sang (Mobile) - VERSION REFONDUE
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { useAuth } from '../../contexts/AuthContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import { apiGet, apiPost } from '../../services/api';

interface BanqueSangSearchFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    groupe_sanguin?: string;
    urgence?: boolean;
    available_only?: boolean;
    check_stocks?: boolean; // ✅ NOUVEAU: Vérifier stocks
}

const BanqueSangSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { user } = useAuth();

    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [groupeSanguin, setGroupeSanguin] = useState('');
    const [urgence, setUrgence] = useState(false);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [loading, setLoading] = useState(false);
    // ✅ NOUVEAU: Fonctionnalités avancées
    const [userBloodGroup, setUserBloodGroup] = useState<string>('');
    const [compatibleGroups, setCompatibleGroups] = useState<string[]>([]);
    const [showMatching, setShowMatching] = useState(false);
    const [showCompatibility, setShowCompatibility] = useState(false);

    React.useEffect(() => {
        if (location?.coords) {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setGpsString(`${lat},${lng}`);
            setGpsData({ lat, lng });
        }
    }, [location]);

    const handleGPSSelect = (coordinates: string) => {
        setGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
        }
        setShowGPSModal(false);
    };

    const handleSearch = () => {
        const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
        const quartierStr = typeof quartier === 'string' ? quartier : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';
        
        if (!villeStr.trim() && !quartierStr.trim() && !gpsData) {
            Alert.alert('Erreur', 'Veuillez renseigner une ville/quartier ou sélectionner un point GPS');
            return;
        }

        const filters: BanqueSangSearchFilters = {};
        if (villeStr.trim()) filters.ville = villeStr.trim();
        if (quartierStr.trim()) filters.quartier = quartierStr.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (groupeSanguin) filters.groupe_sanguin = groupeSanguin;
        if (urgence) filters.urgence = true;
        if (availableOnly) filters.available_only = true;
        // ✅ NOUVEAU: Vérifier stocks si groupe sanguin spécifié
        if (groupeSanguin) filters.check_stocks = true;

        navigation.navigate('BanqueSangList' as never, { filters } as never);
    };

    const groupesSanguins = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    // ✅ NOUVEAU: Charger le groupe sanguin de l'utilisateur
    React.useEffect(() => {
        loadUserBloodGroup();
    }, [user]);

    const loadUserBloodGroup = async () => {
        if (!user) return;
        try {
            const response = await apiGet('/api/blood-donation/donor/blood-groups');
            if (response?.success && response?.data && response.data.length > 0) {
                const firstGroup = response.data[0].blood_group;
                setUserBloodGroup(firstGroup);
                // Charger les groupes compatibles
                loadCompatibility(firstGroup);
            }
        } catch (error) {
            console.error('[BanqueSangSearchScreen] Erreur chargement groupe sanguin:', error);
        }
    };

    // ✅ NOUVEAU: Charger la compatibilité
    const loadCompatibility = async (group: string) => {
        try {
            const response = await apiGet(`/api/blood-donation/compatibility/${group}`);
            if (response?.success && response?.data) {
                setCompatibleGroups(response.data.compatible_groups || []);
            }
        } catch (error) {
            console.error('[BanqueSangSearchScreen] Erreur chargement compatibilité:', error);
        }
    };

    // ✅ NOUVEAU: Enregistrer groupe sanguin
    const saveBloodGroup = async (group: string) => {
        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté pour enregistrer votre groupe sanguin');
            return;
        }
        try {
            setLoading(true);
            const response = await apiPost('/api/blood-donation/donor/blood-group', {
                blood_group: group,
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

    // Recherches rapides spécifiques banque de sang
    const quickSearches = [
        {
            id: 'urgence',
            title: 'Urgence 24h',
            icon: 'alert-triangle',
            description: 'Disponible immédiatement',
            action: () => {
                hapticPress();
                setUrgence(true);
                setAvailableOnly(true);
                setMaxDistance(30);
            }
        },
        {
            id: 'proche',
            title: 'Plus proche',
            icon: 'map-pin',
            description: 'À proximité',
            action: () => {
                hapticPress();
                setMaxDistance(15);
                setAvailableOnly(true);
            }
        },
        {
            id: 'dons',
            title: 'Accepte dons',
            icon: 'heart',
            description: 'Pour donner du sang',
            action: () => {
                hapticPress();
                setAvailableOnly(true);
                // Note: Le filtre accepte_dons sera géré côté backend
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient rouge (urgence médicale) */}
            <LinearGradient
                colors={['#DC2626', '#F87171']}
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
                        <View style={styles.headerIconContainer}>
                            <SafeIcon name="heart" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher une banque de sang</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez rapidement une banque de sang pour un don ou une demande urgente
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ NOUVEAU: Bannière groupe sanguin et matching */}
                {user && (
                    <View style={styles.bloodGroupBanner}>
                        <LinearGradient
                            colors={['#DC2626', '#F87171']}
                            style={styles.bloodGroupBannerGradient}
                        >
                            <View style={styles.bloodGroupBannerContent}>
                                <View style={styles.bloodGroupBannerIcon}>
                                    <SafeIcon name="droplet" size={24} color="#FFFFFF" type="lucide" />
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
                                        <SafeIcon name="plus" size={20} color="#DC2626" type="lucide" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* ✅ NOUVEAU: Bouton "Devenir donneur" */}
                <TouchableOpacity
                    style={styles.becomeDonorBanner}
                    onPress={() => {
                        hapticPress();
                        navigation.navigate('BloodGroupManagement' as never);
                    }}
                >
                    <LinearGradient
                        colors={['#DC2626', '#F87171']}
                        style={styles.becomeDonorBannerGradient}
                    >
                        <View style={styles.becomeDonorBannerContent}>
                            <View style={styles.becomeDonorBannerIcon}>
                                <SafeIcon name="heart" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <View style={styles.becomeDonorBannerText}>
                                <Text style={styles.becomeDonorBannerTitle}>Devenir donneur de sang</Text>
                                <Text style={styles.becomeDonorBannerSubtitle}>
                                    Enregistrez votre groupe sanguin et sauvez des vies
                                </Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#FFFFFF" type="lucide" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* ✅ NOUVEAU: Bouton matching intelligent */}
                {user && (
                    <TouchableOpacity
                        style={styles.matchingBanner}
                        onPress={() => {
                            hapticPress();
                            navigation.navigate('BloodDonationMatching' as never);
                        }}
                    >
                        <LinearGradient
                            colors={['#10B981', '#34D399']}
                            style={styles.matchingBannerGradient}
                        >
                            <View style={styles.matchingBannerContent}>
                                <View style={styles.matchingBannerIcon}>
                                    <SafeIcon name="heart-handshake" size={24} color="#FFFFFF" type="lucide" />
                                </View>
                                <View style={styles.matchingBannerText}>
                                    <Text style={styles.matchingBannerTitle}>Matching intelligent</Text>
                                    <Text style={styles.matchingBannerSubtitle}>
                                        Créer une demande ou trouver des donneurs compatibles
                                    </Text>
                                </View>
                                <SafeIcon name="chevron-right" size={20} color="#FFFFFF" type="lucide" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Recherches rapides */}
                <View style={styles.quickSearchesSection}>
                    <Text style={styles.sectionTitle}>🔍 Recherches rapides</Text>
                    <View style={styles.quickSearchesGrid}>
                        {quickSearches.map((search) => (
                            <TouchableOpacity
                                key={search.id}
                                style={styles.quickSearchCard}
                                onPress={search.action}
                                activeOpacity={0.7}
                            >
                                <View style={styles.quickSearchIconContainer}>
                                    <SafeIcon
                                        name={search.icon}
                                        size={24}
                                        color="#DC2626"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Formulaire de recherche */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>📍 Localisation</Text>
                    
                    {/* Ville */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Ville"
                            value={typeof ville === 'string' ? (ville ? { raw: ville, place_name: ville } : '') : ville}
                            onSelect={(location: LocationObject) => {
                                setVille(location);
                            }}
                            placeholder="Rechercher une ville..."
                            scope="city"
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* Quartier */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier (optionnel)"
                            value={typeof quartier === 'string' ? (quartier ? { raw: quartier, place_name: quartier } : '') : quartier}
                            onSelect={(location: LocationObject) => {
                                setQuartier(location);
                            }}
                            placeholder="Rechercher un quartier..."
                            scope="neighborhood"
                            cityContext={typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || ''}
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} type="lucide" /> Position GPS
                        </Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => {
                                hapticPress();
                                setShowGPSModal(true);
                            }}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} type="lucide" />
                            <Text style={styles.gpsButtonText} numberOfLines={1}>
                                {gpsString || 'Utiliser ma position GPS'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Distance max */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="maximize-2" size={14} color={modernColors.primary} type="lucide" /> Distance maximale
                        </Text>
                        <View style={styles.distanceCard}>
                            <TouchableOpacity
                                style={styles.distanceButton}
                                onPress={() => {
                                    hapticPress();
                                    setMaxDistance(Math.max(5, maxDistance - 5));
                                }}
                            >
                                <SafeIcon name="minus" size={18} color="#FFFFFF" type="lucide" />
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
                                <SafeIcon name="plus" size={18} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Groupe sanguin */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>
                                <SafeIcon name="droplet" size={14} color={modernColors.primary} type="lucide" /> Groupe sanguin recherché
                            </Text>
                            {userBloodGroup && (
                                <TouchableOpacity
                                    style={styles.useMyGroupButton}
                                    onPress={() => {
                                        hapticPress();
                                        setGroupeSanguin(userBloodGroup);
                                    }}
                                >
                                    <Text style={styles.useMyGroupText}>Utiliser mon groupe ({userBloodGroup})</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.bloodGroupContainer}>
                            <TouchableOpacity
                                style={[styles.bloodGroupButton, !groupeSanguin && styles.bloodGroupButtonActive]}
                                onPress={() => {
                                    hapticPress();
                                    setGroupeSanguin('');
                                }}
                            >
                                <Text style={[styles.bloodGroupText, !groupeSanguin && styles.bloodGroupTextActive]}>
                                    Tous
                                </Text>
                            </TouchableOpacity>
                            {groupesSanguins.map((groupe) => {
                                const isCompatible = userBloodGroup && compatibleGroups.includes(groupe);
                                return (
                                    <TouchableOpacity
                                        key={groupe}
                                        style={[
                                            styles.bloodGroupButton,
                                            groupeSanguin === groupe && styles.bloodGroupButtonActive,
                                            isCompatible && groupeSanguin !== groupe && styles.bloodGroupButtonCompatible
                                        ]}
                                        onPress={() => {
                                            hapticPress();
                                            setGroupeSanguin(groupeSanguin === groupe ? '' : groupe);
                                        }}
                                    >
                                        <Text style={[
                                            styles.bloodGroupText,
                                            groupeSanguin === groupe && styles.bloodGroupTextActive,
                                            isCompatible && groupeSanguin !== groupe && styles.bloodGroupTextCompatible
                                        ]}>
                                            {groupe}
                                        </Text>
                                        {isCompatible && (
                                            <SafeIcon name="check" size={12} color="#10B981" type="lucide" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {userBloodGroup && compatibleGroups.length > 0 && (
                            <Text style={styles.compatibilityHint}>
                                💡 Les groupes {compatibleGroups.join(', ')} sont compatibles avec votre groupe ({userBloodGroup})
                            </Text>
                        )}
                    </View>

                    {/* Options */}
                    <View style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>⚙️ Options de recherche</Text>
                        
                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="alert-triangle" size={20} color="#DC2626" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Urgence 24h</Text>
                                    <Text style={styles.optionDescription}>
                                        Banques de sang disponibles en urgence 24h/24
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={urgence}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setUrgence(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#DC2626' }}
                                thumbColor="#FFFFFF"
                            />
                        </View>

                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="check-circle" size={20} color="#10B981" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Disponibles maintenant</Text>
                                    <Text style={styles.optionDescription}>
                                        Filtrer selon la disponibilité actuelle
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={availableOnly}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setAvailableOnly(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>

                    {/* Bouton recherche */}
                    <TouchableOpacity
                        onPress={handleSearch}
                        disabled={loading}
                        style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                        activeOpacity={0.8}
                    >
                        <View style={styles.searchButtonContent}>
                            <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchButtonText}>
                                {loading ? 'Recherche en cours...' : 'Lancer la recherche'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#DC2626" type="lucide" />
                        <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Les banques de sang acceptent les dons volontaires{'\n'}
                        • En cas d'urgence, contactez directement le téléphone d'urgence{'\n'}
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

            {/* ✅ NOUVEAU: Modal enregistrement groupe sanguin */}
            {showCompatibility && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Enregistrer votre groupe sanguin</Text>
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
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
    },
    backButton: {
        marginRight: 12,
        marginTop: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    quickSearchesSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    quickSearchesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickSearchCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    quickSearchIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickSearchTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
        textAlign: 'center',
    },
    quickSearchDescription: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
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
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    gpsButtonText: {
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
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
    },
    distanceValueContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    distanceUnit: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    bloodGroupContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    bloodGroupButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        minWidth: 60,
        alignItems: 'center',
    },
    bloodGroupButtonActive: {
        backgroundColor: '#DC2626',
        borderColor: '#DC2626',
    },
    bloodGroupText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '700',
    },
    bloodGroupTextActive: {
        color: '#FFFFFF',
    },
    optionsSection: {
        marginTop: 8,
        marginBottom: 8,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
    },
    searchButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#DC2626',
        paddingVertical: 16,
    },
    searchButtonDisabled: {
        opacity: 0.6,
    },
    searchButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 16,
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
        fontSize: 16,
        fontWeight: '600',
        color: '#991B1B',
    },
    infoText: {
        fontSize: 13,
        color: '#991B1B',
        lineHeight: 20,
    },
    // ✅ NOUVEAU: Styles pour bannières
    bloodGroupBanner: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    bloodGroupBannerGradient: {
        padding: 16,
    },
    bloodGroupBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bloodGroupBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bloodGroupBannerText: {
        flex: 1,
    },
    bloodGroupBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    bloodGroupBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
    },
    bloodGroupBannerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    becomeDonorBanner: {
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    becomeDonorBannerGradient: {
        padding: 16,
    },
    becomeDonorBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    becomeDonorBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    becomeDonorBannerText: {
        flex: 1,
    },
    becomeDonorBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    becomeDonorBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
    },
    matchingBanner: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    matchingBannerGradient: {
        padding: 16,
    },
    matchingBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    matchingBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    matchingBannerText: {
        flex: 1,
    },
    matchingBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    matchingBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    useMyGroupButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
    },
    useMyGroupText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    bloodGroupButtonCompatible: {
        borderColor: '#10B981',
        borderWidth: 2,
    },
    bloodGroupTextCompatible: {
        color: '#10B981',
    },
    compatibilityHint: {
        fontSize: 12,
        color: '#059669',
        marginTop: 8,
        fontStyle: 'italic',
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
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
        lineHeight: 20,
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
        backgroundColor: '#DC2626',
        borderColor: '#DC2626',
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

