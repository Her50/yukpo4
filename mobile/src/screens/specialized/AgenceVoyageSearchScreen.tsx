// ✅ Écran de recherche d'agences de voyage (Mobile)
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
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';

interface AgenceVoyageSearchFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    destination?: string;
    compagnie_bus?: string;
    available_only?: boolean;
}

const AgenceVoyageSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [ville, setVille] = useState('');
    const [quartier, setQuartier] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [destination, setDestination] = useState('');
    const [compagnieBus, setCompagnieBus] = useState('');
    const [availableOnly, setAvailableOnly] = useState(true);
    const [loading, setLoading] = useState(false);

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
        if (!ville.trim() && !quartier.trim() && !gpsData) {
            Alert.alert('Erreur', 'Veuillez renseigner une ville/quartier ou sélectionner un point GPS');
            return;
        }

        const filters: AgenceVoyageSearchFilters = {};
        if (ville.trim()) filters.ville = ville.trim();
        if (quartier.trim()) filters.quartier = quartier.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (destination.trim()) filters.destination = destination.trim();
        if (compagnieBus.trim()) filters.compagnie_bus = compagnieBus.trim();
        if (availableOnly) filters.available_only = true;

        navigation.navigate('AgenceVoyageList' as never, { filters } as never);
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
                <Text style={styles.title}>Rechercher une agence de voyage</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.searchForm}>
                    {/* Ville */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ville</Text>
                        <NativeInput
                            value={ville}
                            onChangeText={setVille}
                            placeholder="Ex: Douala, Yaoundé"
                        />
                    </View>

                    {/* Quartier */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Quartier (optionnel)</Text>
                        <NativeInput
                            value={quartier}
                            onChangeText={setQuartier}
                            placeholder="Ex: Bonanjo, Akwa"
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
                        <View style={styles.distanceControls}>
                            <TouchableOpacity
                                style={styles.distanceButton}
                                onPress={() => setMaxDistance(Math.max(5, maxDistance - 5))}
                            >
                                <Text style={styles.distanceButtonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.distanceValue}>{maxDistance} km</Text>
                            <TouchableOpacity
                                style={styles.distanceButton}
                                onPress={() => setMaxDistance(Math.min(200, maxDistance + 5))}
                            >
                                <Text style={styles.distanceButtonText}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Destination */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Destination recherchée (optionnel)</Text>
                        <NativeInput
                            value={destination}
                            onChangeText={setDestination}
                            placeholder="Ex: Bafoussam, Buea"
                        />
                    </View>

                    {/* Compagnie bus */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Compagnie de bus (optionnel)</Text>
                        <NativeInput
                            value={compagnieBus}
                            onChangeText={setCompagnieBus}
                            placeholder="Ex: Amour Mezam, Guarantee Express"
                        />
                    </View>

                    {/* Options */}
                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Disponibles maintenant</Text>
                        <Switch
                            value={availableOnly}
                            onValueChange={setAvailableOnly}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <NativeButton
                        onPress={handleSearch}
                        disabled={loading}
                        style={styles.searchButton}
                    >
                        <Text style={styles.searchButtonText}>
                            {loading ? 'Recherche...' : 'Rechercher'}
                        </Text>
                    </NativeButton>
                </View>
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    searchForm: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        gap: 8,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#6B7280',
    },
    distanceControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    distanceButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    distanceButtonText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    distanceValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        minWidth: 60,
        textAlign: 'center',
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    searchButton: {
        marginTop: 8,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default AgenceVoyageSearchScreen;

