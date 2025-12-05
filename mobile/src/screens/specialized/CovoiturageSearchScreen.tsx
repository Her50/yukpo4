// ✅ Phase 1.2: Écran de recherche de covoiturages avec GPS et carte
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
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';

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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher un covoiturage</Text>
            </View>

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
                        onPress={() => setShowMap(false)}
                    >
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    <View style={styles.searchForm}>
                        {/* Recherche GPS */}
                        <View style={styles.inputGroup}>
                            <View style={styles.switchRow}>
                                <View style={styles.switchInfo}>
                                    <Text style={styles.label}>Rechercher près de moi</Text>
                                    <Text style={styles.switchSubtext}>
                                        Trouvez des trajets à proximité de votre position
                                    </Text>
                                </View>
                                <Switch
                                    value={searchNearby}
                                    onValueChange={(value) => {
                                        setSearchNearby(value);
                                        if (value && !location) {
                                            Alert.alert('GPS requis', 'Activez votre GPS pour utiliser cette fonctionnalité');
                                        }
                                    }}
                                    trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                                />
                            </View>
                            {searchNearby && location && (
                                <View style={styles.radiusSelector}>
                                    <Text style={styles.radiusLabel}>Rayon: {radiusKm} km</Text>
                                    <View style={styles.radiusButtons}>
                                        {[10, 25, 50, 100].map((km) => (
                                            <TouchableOpacity
                                                key={km}
                                                style={[
                                                    styles.radiusButton,
                                                    radiusKm === km && styles.radiusButtonActive
                                                ]}
                                                onPress={() => setRadiusKm(km)}
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
                                            onPress={() => setShowMap(true)}
                                        >
                                            <SafeIcon name="map" size={20} color={modernColors.primary} />
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
                                <Text style={styles.label}>Lieu de départ *</Text>
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
                                <Text style={styles.label}>Destination *</Text>
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
                            <Text style={styles.label}>Date de départ</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                                <Text style={styles.dateButtonText}>{formatDate(dateDepart)}</Text>
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
                            <Text style={styles.label}>Places minimum: {minPlaces}</Text>
                            <View style={styles.sliderContainer}>
                                <TouchableOpacity
                                    style={styles.sliderButton}
                                    onPress={() => setMinPlaces(Math.max(1, minPlaces - 1))}
                                >
                                    <SafeIcon name="minus" size={16} color={modernColors.primary} />
                                </TouchableOpacity>
                                <Text style={styles.sliderValue}>{minPlaces} place{minPlaces > 1 ? 's' : ''}</Text>
                                <TouchableOpacity
                                    style={styles.sliderButton}
                                    onPress={() => setMinPlaces(Math.min(10, minPlaces + 1))}
                                >
                                    <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Prix max */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Prix maximum (FCFA) - optionnel</Text>
                            <NativeInput
                                value={maxPrix}
                                onChangeText={setMaxPrix}
                                placeholder="Ex: 5000"
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Bouton recherche */}
                        <NativeButton
                            title="Rechercher"
                            onPress={handleSearch}
                            disabled={loading}
                            style={styles.searchButton}
                        />
                    </View>
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    searchForm: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        gap: 8,
    },
    dateButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sliderButton: {
        padding: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    sliderValue: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    searchButton: {
        marginTop: 8,
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
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchInfo: {
        flex: 1,
        marginRight: 12,
    },
    switchSubtext: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    radiusSelector: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    radiusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    radiusButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    radiusButton: {
        flex: 1,
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    radiusButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    radiusButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    radiusButtonTextActive: {
        color: '#fff',
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    mapButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default CovoiturageSearchScreen;

