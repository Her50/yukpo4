// ✅ Phase 3: Écran de recherche de taxis
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';

interface TaxiSearchFilters {
    zone?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    available_only?: boolean;
    type_vehicule?: string;
}

const TaxiSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [zone, setZone] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [typeVehicule, setTypeVehicule] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Initialiser GPS avec position actuelle
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
        if (!zone.trim() && !gpsData) {
            Alert.alert('Erreur', 'Veuillez renseigner une zone ou sélectionner un point GPS');
            return;
        }

        const filters: TaxiSearchFilters = {};
        if (zone.trim()) filters.zone = zone.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (availableOnly) filters.available_only = true;
        if (typeVehicule) filters.type_vehicule = typeVehicule;

        navigation.navigate('TaxiList' as never, { filters } as never);
    };

    const typesVehicules = ['Berline', 'SUV', 'Van', 'Moto', 'Vélo'];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher un taxi</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.searchForm}>
                    {/* Zone */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Zone / Quartier</Text>
                        <NativeInput
                            value={zone}
                            onChangeText={setZone}
                            placeholder="Ex: Douala, Centre-ville"
                            autoCapitalize="words"
                        />
                    </View>

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Position GPS (optionnel)</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {gpsString || 'Sélectionner un point GPS'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Distance max */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Distance maximale: {maxDistance} km</Text>
                        <View style={styles.sliderContainer}>
                            <TouchableOpacity
                                style={styles.sliderButton}
                                onPress={() => setMaxDistance(Math.max(5, maxDistance - 5))}
                            >
                                <SafeIcon name="minus" size={16} color={modernColors.primary} />
                            </TouchableOpacity>
                            <Text style={styles.sliderValue}>{maxDistance} km</Text>
                            <TouchableOpacity
                                style={styles.sliderButton}
                                onPress={() => setMaxDistance(Math.min(200, maxDistance + 5))}
                            >
                                <SafeIcon name="plus" size={16} color={modernColors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Disponibilité */}
                    <View style={styles.inputGroup}>
                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setAvailableOnly(!availableOnly)}
                        >
                            <SafeIcon
                                name={availableOnly ? "check-square" : "square"}
                                size={24}
                                color={availableOnly ? modernColors.primary : "#9CA3AF"}
                            />
                            <Text style={styles.checkboxLabel}>Uniquement les taxis disponibles</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Type véhicule */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Type de véhicule (optionnel)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !typeVehicule && styles.chipActive]}
                                onPress={() => setTypeVehicule('')}
                            >
                                <Text style={[styles.chipText, !typeVehicule && styles.chipTextActive]}>
                                    Tous
                                </Text>
                            </TouchableOpacity>
                            {typesVehicules.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, typeVehicule === type && styles.chipActive]}
                                    onPress={() => setTypeVehicule(typeVehicule === type ? '' : type)}
                                >
                                    <Text style={[styles.chipText, typeVehicule === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Boutons recherche */}
                    <View style={styles.buttonsRow}>
                        <NativeButton
                            title="Recherche classique"
                            onPress={handleSearch}
                            disabled={loading}
                            icon="search"
                            variant="secondary"
                            style={styles.searchButton}
                        />
                        <NativeButton
                            title="Recherche intelligente"
                            onPress={() => navigation.navigate('TaxiIntelligentSearch' as never)}
                            icon="sparkles"
                            variant="primary"
                            style={styles.searchButton}
                        />
                    </View>
                </View>
            </ScrollView>

            {/* Modal GPS */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsData || undefined}
            />
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
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        gap: 8,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#6B7280',
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
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#374151',
    },
    chipsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    chipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
    },
    chipTextActive: {
        color: '#fff',
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    searchButton: {
        flex: 1,
    },
});

export default TaxiSearchScreen;

