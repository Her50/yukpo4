// ✅ Phase 3: Écran de recherche de laboratoires
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';

interface LaboratoireSearchFilters {
    service_type?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    prestation_analyse?: string;
    rdv_en_ligne?: boolean;
}

const LaboratoireSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [serviceType, setServiceType] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [rdvEnLigne, setRdvEnLigne] = useState(false);
    const [prestationAnalyse, setPrestationAnalyse] = useState<string>('');
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
        if (!serviceType.trim() && !gpsData && !rdvEnLigne && !prestationAnalyse) {
            Alert.alert('Erreur', 'Veuillez renseigner au moins un critère de recherche.');
            return;
        }

        const filters: LaboratoireSearchFilters = {};
        if (serviceType.trim()) filters.service_type = serviceType.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (rdvEnLigne) filters.rdv_en_ligne = true;
        if (prestationAnalyse) filters.prestation_analyse = prestationAnalyse;

        navigation.navigate('LaboratoireList' as never, { filters } as never);
    };

    const typesEtablissement = ['Laboratoire', 'Centre d\'imagerie', 'Les deux'];
    const prestationsAnalyses = ['Biologie', 'Hématologie', 'Biochimie', 'Microbiologie', 'Sérologie', 'Immunologie'];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher un Laboratoire</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.searchForm}>
                    {/* Type d'établissement */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Type d'établissement (optionnel)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !serviceType && styles.chipActive]}
                                onPress={() => setServiceType('')}
                            >
                                <Text style={[styles.chipText, !serviceType && styles.chipTextActive]}>
                                    Tous
                                </Text>
                            </TouchableOpacity>
                            {typesEtablissement.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, serviceType === type && styles.chipActive]}
                                    onPress={() => setServiceType(serviceType === type ? '' : type)}
                                >
                                    <Text style={[styles.chipText, serviceType === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
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

                    {/* Rendez-vous en ligne */}
                    <View style={styles.inputGroup}>
                        <View style={styles.switchRow}>
                            <Text style={styles.label}>Rendez-vous en ligne</Text>
                            <Switch
                                value={rdvEnLigne}
                                onValueChange={setRdvEnLigne}
                                trackColor={{ false: "#E5E7EB", true: modernColors.primary }}
                                thumbColor={rdvEnLigne ? "#FFFFFF" : "#F3F4F6"}
                            />
                        </View>
                    </View>

                    {/* Prestation d'analyse */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Prestation d'analyse (optionnel)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !prestationAnalyse && styles.chipActive]}
                                onPress={() => setPrestationAnalyse('')}
                            >
                                <Text style={[styles.chipText, !prestationAnalyse && styles.chipTextActive]}>
                                    Toutes
                                </Text>
                            </TouchableOpacity>
                            {prestationsAnalyses.map((prestation) => (
                                <TouchableOpacity
                                    key={prestation}
                                    style={[styles.chip, prestationAnalyse === prestation && styles.chipActive]}
                                    onPress={() => setPrestationAnalyse(prestationAnalyse === prestation ? '' : prestation)}
                                >
                                    <Text style={[styles.chipText, prestationAnalyse === prestation && styles.chipTextActive]}>
                                        {prestation}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Bouton recherche */}
                    <NativeButton
                        title="Rechercher"
                        onPress={handleSearch}
                        disabled={loading}
                        icon="search"
                        style={styles.searchButton}
                    />
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
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
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
    searchButton: {
        marginTop: 8,
    },
});

export default LaboratoireSearchScreen;

