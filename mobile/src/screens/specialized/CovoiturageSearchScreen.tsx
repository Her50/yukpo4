// ✅ Écran de recherche de covoiturages (Mobile) - VERSION REFONDUE
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import CovoiturageMapView from '../../components/covoiturage/CovoiturageMapView';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface CovoiturageSearchFilters {
    depart?: string;
    destination?: string;
    date_depart?: string;
    min_places?: number;
    max_prix?: number;
    lat?: number;
    lng?: number;
    radius_km?: number;
}

const CovoiturageSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [depart, setDepart] = useState('');
    const [destination, setDestination] = useState('');
    const [dateDepart, setDateDepart] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [minPlaces, setMinPlaces] = useState(1);
    const [maxPrix, setMaxPrix] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchNearby, setSearchNearby] = useState(false);
    const [radiusKm, setRadiusKm] = useState(50);
    const [showMap, setShowMap] = useState(false);
    const [nearbyTrips, setNearbyTrips] = useState<any[]>([]);

    useEffect(() => {
        if (searchNearby && location) {
            loadNearbyTrips();
        }
    }, [searchNearby, location, radiusKm]);

    const loadNearbyTrips = async () => {
        if (!location) return;
        try {
            setLoading(true);
            const { apiGet } = require('../../services/api');
            const response = await apiGet(
                `/api/covoiturages/nearby?lat=${location.coords.latitude}&lng=${location.coords.longitude}&radius_km=${radiusKm}&date_depart=${dateDepart.toISOString().split('T')[0]}`
            );
            if (response.success && response.data) {
                setNearbyTrips(response.data.data || []);
            }
        } catch (error: any) {
            console.error('[CovoiturageSearchScreen] Erreur chargement trajets proches:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (searchNearby && location) {
            // Recherche GPS
            const filters: CovoiturageSearchFilters = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                radius_km: radiusKm,
                date_depart: dateDepart.toISOString().split('T')[0],
            };
            if (minPlaces > 1) filters.min_places = minPlaces;
            if (maxPrix) {
                const prix = parseInt(maxPrix);
                if (!isNaN(prix) && prix > 0) filters.max_prix = prix;
            }
            navigation.navigate('CovoiturageList' as never, { filters, searchType: 'nearby' } as never);
        } else {
            // Recherche classique
            if (!depart.trim() || !destination.trim()) {
                Alert.alert('Erreur', 'Veuillez renseigner le lieu de départ et la destination');
                return;
            }

            try {
                setLoading(true);
                const filters: CovoiturageSearchFilters = {
                    depart: depart.trim(),
                    destination: destination.trim(),
                    date_depart: dateDepart.toISOString().split('T')[0],
                };

                if (minPlaces > 1) filters.min_places = minPlaces;
                if (maxPrix) {
                    const prix = parseInt(maxPrix);
                    if (!isNaN(prix) && prix > 0) filters.max_prix = prix;
                }

                navigation.navigate('CovoiturageList' as never, { filters, searchType: 'classic' } as never);
            } catch (error: any) {
                Alert.alert('Erreur', error.message || 'Erreur lors de la recherche');
            } finally {
                setLoading(false);
            }
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    // Recherches rapides spécifiques covoiturage
    const quickSearches = [
        {
            id: 'proche',
            title: 'Près de moi',
            icon: 'map-pin',
            description: 'Trajets proches',
            action: () => {
                hapticPress();
                if (!location) {
                    Alert.alert('GPS requis', 'Activez votre GPS pour utiliser cette fonctionnalité');
                    return;
                }
                setSearchNearby(true);
                setRadiusKm(25);
            }
        },
        {
            id: 'aujourdhui',
            title: "Aujourd'hui",
            icon: 'calendar',
            description: 'Départ aujourd\'hui',
            action: () => {
                hapticPress();
                setDateDepart(new Date());
                setSearchNearby(false);
            }
        },
        {
            id: 'intelligent',
            title: 'Intelligent',
            icon: 'sparkles',
            description: 'Matching IA',
            action: () => {
                hapticPress();
                (navigation as any).navigate('CovoiturageIntelligentSearch');
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient vert (transport partagé) */}
            <LinearGradient
                colors={['#10B981', '#34D399']}
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
                            <SafeIcon name="users" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher un covoiturage</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez des trajets partagés pour économiser et voyager ensemble
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {showMap && searchNearby && location ? (
                <View style={styles.mapContainer}>
                    <CovoiturageMapView
                        trips={nearbyTrips}
                        currentLocation={{
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude
                        }}
                        showNearbyOnly={true}
                        radiusKm={radiusKm}
                        onTripPress={(trip) => {
                            navigation.navigate('CovoiturageDetails' as never, { covoiturageId: trip.id } as never);
                        }}
                    />
                    <TouchableOpacity
                        style={styles.closeMapButton}
                        onPress={() => {
                            hapticPress();
                            setShowMap(false);
                        }}
                    >
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
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
                                            color="#10B981"
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
                        <Text style={styles.sectionTitle}>📍 Recherche</Text>
                        
                        {/* Recherche GPS */}
                        <View style={styles.inputGroup}>
                            <View style={styles.optionCard}>
                                <View style={styles.optionContent}>
                                    <View style={styles.optionIconContainer}>
                                        <SafeIcon name="map-pin" size={20} color="#10B981" type="lucide" />
                                    </View>
                                    <View style={styles.optionTextContainer}>
                                        <Text style={styles.optionTitle}>Rechercher près de moi</Text>
                                        <Text style={styles.optionDescription}>
                                            Trouvez des trajets à proximité de votre position
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={searchNearby}
                                    onValueChange={(value) => {
                                        hapticPress();
                                        setSearchNearby(value);
                                        if (value && !location) {
                                            Alert.alert('GPS requis', 'Activez votre GPS pour utiliser cette fonctionnalité');
                                        }
                                    }}
                                    trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>
                            {searchNearby && location && (
                                <View style={styles.radiusSelector}>
                                    <Text style={styles.radiusLabel}>
                                        <SafeIcon name="maximize-2" size={14} color="#10B981" type="lucide" /> Rayon: {radiusKm} km
                                    </Text>
                                    <View style={styles.radiusButtons}>
                                        {[10, 25, 50, 100].map((km) => (
                                            <TouchableOpacity
                                                key={km}
                                                style={[
                                                    styles.radiusButton,
                                                    radiusKm === km && styles.radiusButtonActive
                                                ]}
                                                onPress={() => {
                                                    hapticPress();
                                                    setRadiusKm(km);
                                                }}
                                            >
                                                <Text
                                                    style={[
                                                        styles.radiusButtonText,
                                                        radiusKm === km && styles.radiusButtonTextActive
                                                    ]}
                                                >
                                                    {km} km
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {nearbyTrips.length > 0 && (
                                        <TouchableOpacity
                                            style={styles.mapButton}
                                            onPress={() => {
                                                hapticPress();
                                                setShowMap(true);
                                            }}
                                        >
                                            <SafeIcon name="map" size={20} color="#10B981" type="lucide" />
                                            <Text style={styles.mapButtonText}>
                                                Voir sur la carte ({nearbyTrips.length} trajets)
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Départ */}
                        {!searchNearby && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="map-pin" size={14} color={modernColors.primary} type="lucide" /> Lieu de départ *
                                </Text>
                                <NativeInput
                                    value={depart}
                                    onChangeText={setDepart}
                                    placeholder="Ex: Douala, Centre-ville"
                                    autoCapitalize="words"
                                />
                            </View>
                        )}

                        {/* Destination */}
                        {!searchNearby && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="navigation" size={14} color={modernColors.primary} type="lucide" /> Destination *
                                </Text>
                                <NativeInput
                                    value={destination}
                                    onChangeText={setDestination}
                                    placeholder="Ex: Yaoundé, Centre-ville"
                                    autoCapitalize="words"
                                />
                            </View>
                        )}

                        {/* Date départ */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <SafeIcon name="calendar" size={14} color={modernColors.primary} type="lucide" /> Date de départ
                            </Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => {
                                    hapticPress();
                                    setShowDatePicker(true);
                                }}
                            >
                                <SafeIcon name="calendar" size={20} color="#10B981" type="lucide" />
                                <Text style={styles.dateButtonText}>{formatDate(dateDepart)}</Text>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={dateDepart}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                minimumDate={new Date()}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(Platform.OS === 'ios');
                                    if (selectedDate) {
                                        setDateDepart(selectedDate);
                                    }
                                }}
                            />
                        )}

                        {/* Places min */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <SafeIcon name="users" size={14} color={modernColors.primary} type="lucide" /> Places minimum
                            </Text>
                            <View style={styles.placesCard}>
                                <TouchableOpacity
                                    style={styles.placesButton}
                                    onPress={() => {
                                        hapticPress();
                                        setMinPlaces(Math.max(1, minPlaces - 1));
                                    }}
                                >
                                    <SafeIcon name="minus" size={18} color="#FFFFFF" type="lucide" />
                                </TouchableOpacity>
                                <View style={styles.placesValueContainer}>
                                    <Text style={styles.placesValue}>{minPlaces}</Text>
                                    <Text style={styles.placesUnit}>place{minPlaces > 1 ? 's' : ''}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.placesButton}
                                    onPress={() => {
                                        hapticPress();
                                        setMinPlaces(Math.min(10, minPlaces + 1));
                                    }}
                                >
                                    <SafeIcon name="plus" size={18} color="#FFFFFF" type="lucide" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Prix max */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <SafeIcon name="dollar-sign" size={14} color={modernColors.primary} type="lucide" /> Prix maximum (FCFA)
                            </Text>
                            <NativeInput
                                value={maxPrix}
                                onChangeText={setMaxPrix}
                                placeholder="Ex: 5000"
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Bouton recherche */}
                        <NativeButton
                            onPress={handleSearch}
                            disabled={loading}
                            style={styles.searchButton}
                        >
                            <View style={styles.searchButtonContent}>
                                <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                                <Text style={styles.searchButtonText}>
                                    {loading ? 'Recherche en cours...' : 'Lancer la recherche'}
                                </Text>
                            </View>
                        </NativeButton>
                    </View>

                    {/* Info section */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <SafeIcon name="info" size={20} color="#10B981" type="lucide" />
                            <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                        </View>
                        <Text style={styles.infoText}>
                            • Le covoiturage permet de partager les frais de transport{'\n'}
                            • Vérifiez les avis et le profil du conducteur avant de réserver{'\n'}
                            • La recherche intelligente utilise l'IA pour trouver le meilleur match{'\n'}
                            • Les trajets à proximité sont mis à jour en temps réel
                        </Text>
                    </View>
                </ScrollView>
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
        backgroundColor: '#D1FAE5',
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
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
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
    radiusSelector: {
        marginTop: 12,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    radiusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    radiusButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    radiusButton: {
        flex: 1,
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    radiusButtonActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    radiusButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    radiusButtonTextActive: {
        color: '#FFFFFF',
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        padding: 16,
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    mapButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
        flex: 1,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    dateButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    placesCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    placesButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placesValueContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placesValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    placesUnit: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    searchButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
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
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#A7F3D0',
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
        color: '#065F46',
    },
    infoText: {
        fontSize: 13,
        color: '#065F46',
        lineHeight: 20,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    closeMapButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
});

export default CovoiturageSearchScreen;

