// ✅ Phase 3: Écran de recherche d'hôpitaux
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

interface HopitalSearchFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    type_etablissement?: string;
    prestation?: string;
    urgences_only?: boolean;
    available_only?: boolean;
}

const HopitalSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [ville, setVille] = useState('');
    const [quartier, setQuartier] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [typeEtablissement, setTypeEtablissement] = useState<string>('');
    const [prestation, setPrestation] = useState<string>('');
    const [urgencesOnly, setUrgencesOnly] = useState(false);
    const [availableOnly, setAvailableOnly] = useState(true);
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
        if (!ville.trim() && !quartier.trim() && !gpsData) {
            Alert.alert('Erreur', 'Veuillez renseigner une ville/quartier ou sélectionner un point GPS');
            return;
        }

        const filters: HopitalSearchFilters = {};
        if (ville.trim()) filters.ville = ville.trim();
        if (quartier.trim()) filters.quartier = quartier.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (typeEtablissement) filters.type_etablissement = typeEtablissement;
        if (prestation) filters.prestation = prestation;
        if (urgencesOnly) filters.urgences_only = true;
        if (availableOnly) filters.available_only = true;

        navigation.navigate('HopitalList' as never, { filters } as never);
    };

    const typesEtablissements = ['Hôpital', 'Clinique', 'Dispensaire'];
    const prestations = ['Chirurgie', 'Pédiatrie', 'Urgences', 'Maternité', 'Cardiologie', 'Neurologie'];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher un hôpital</Text>
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
                        <View style={styles.sliderContainer}>
                            <Text style={styles.sliderLabel}>5 km</Text>
                            <View style={styles.slider}>
                                <TouchableOpacity
                                    style={[styles.sliderThumb, { left: `${((maxDistance - 5) / 95) * 100}%` }]}
                                    onPress={() => {
                                        const newValue = maxDistance === 100 ? 5 : maxDistance + 5;
                                        setMaxDistance(Math.min(100, Math.max(5, newValue)));
                                    }}
                                />
                            </View>
                            <Text style={styles.sliderLabel}>100 km</Text>
                        </View>
                    </View>

                    {/* Type établissement */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Type d'établissement</Text>
                        <View style={styles.chipContainer}>
                            {typesEtablissements.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.chip,
                                        typeEtablissement === type && styles.chipActive
                                    ]}
                                    onPress={() => setTypeEtablissement(typeEtablissement === type ? '' : type)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        typeEtablissement === type && styles.chipTextActive
                                    ]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Prestation */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Prestation médicale</Text>
                        <View style={styles.chipContainer}>
                            {prestations.map((prest) => (
                                <TouchableOpacity
                                    key={prest}
                                    style={[
                                        styles.chip,
                                        prestation === prest && styles.chipActive
                                    ]}
                                    onPress={() => setPrestation(prestation === prest ? '' : prest)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        prestation === prest && styles.chipTextActive
                                    ]}>
                                        {prest}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Options */}
                    <View style={styles.inputGroup}>
                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setUrgencesOnly(!urgencesOnly)}
                        >
                            <View style={[styles.checkbox, urgencesOnly && styles.checkboxChecked]}>
                                {urgencesOnly && <SafeIcon name="check" size={16} color="#fff" />}
                            </View>
                            <Text style={styles.checkboxLabel}>Urgences disponibles uniquement</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setAvailableOnly(!availableOnly)}
                        >
                            <View style={[styles.checkbox, availableOnly && styles.checkboxChecked]}>
                                {availableOnly && <SafeIcon name="check" size={16} color="#fff" />}
                            </View>
                            <Text style={styles.checkboxLabel}>Disponibles maintenant</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Bouton recherche */}
                    <NativeButton
                        onPress={handleSearch}
                        disabled={loading}
                        style={styles.searchButton}
                    >
                        <SafeIcon name="search" size={20} color="#fff" />
                        <Text style={styles.searchButtonText}>
                            {loading ? 'Recherche...' : 'Rechercher'}
                        </Text>
                    </NativeButton>
                </View>
            </ScrollView>

            {/* Modal GPS */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                initialCoordinates={gpsString}
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
        backgroundColor: '#fff',
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
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    gpsButtonText: {
        marginLeft: 8,
        color: '#6B7280',
        flex: 1,
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    slider: {
        flex: 1,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginHorizontal: 12,
        position: 'relative',
    },
    sliderThumb: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: modernColors.primary,
        top: -8,
    },
    sliderLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
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
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#374151',
    },
    searchButton: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchButtonText: {
        marginLeft: 8,
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default HopitalSearchScreen;

