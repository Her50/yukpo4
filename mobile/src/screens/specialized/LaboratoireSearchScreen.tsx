// ✅ Écran de recherche de laboratoires (Mobile) - VERSION REFONDUE
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
    View,
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';

interface LaboratoireSearchFilters {
    ville?: string;
    quartier?: string;
    service_type?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    prestation_analyse?: string;
    rdv_en_ligne?: boolean;
    available_only?: boolean;
}

const LaboratoireSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [serviceType, setServiceType] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [rdvEnLigne, setRdvEnLigne] = useState(false);
    const [prestationAnalyse, setPrestationAnalyse] = useState<string>('');
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
        const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
        const quartierStr = typeof quartier === 'string' ? quartier : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';
        
        if (!villeStr.trim() && !quartierStr.trim() && !gpsData && !serviceType && !prestationAnalyse) {
            Alert.alert('Erreur', 'Veuillez renseigner au moins un critère de recherche');
            return;
        }

        const filters: LaboratoireSearchFilters = {};
        if (villeStr.trim()) filters.ville = villeStr.trim();
        if (quartierStr.trim()) filters.quartier = quartierStr.trim();
        if (serviceType.trim()) filters.service_type = serviceType.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (rdvEnLigne) filters.rdv_en_ligne = true;
        if (prestationAnalyse) filters.prestation_analyse = prestationAnalyse;
        if (availableOnly) filters.available_only = true;

        navigation.navigate('LaboratoireList' as never, { filters } as never);
    };

    const typesEtablissement = ['Laboratoire', 'Centre d\'imagerie', 'Les deux'];
    const prestationsAnalyses = [
        'Biologie', 'Hématologie', 'Biochimie', 'Microbiologie', 
        'Sérologie', 'Immunologie', 'Radiologie', 'Échographie'
    ];

    // Recherches rapides spécifiques laboratoires
    const quickSearches = [
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
            id: 'rdv',
            title: 'RDV en ligne',
            icon: 'calendar',
            description: 'Prise de rendez-vous',
            action: () => {
                hapticPress();
                setRdvEnLigne(true);
                setAvailableOnly(true);
            }
        },
        {
            id: 'resultats',
            title: 'Résultats en ligne',
            icon: 'file-text',
            description: 'Consultation digitale',
            action: () => {
                hapticPress();
                setAvailableOnly(true);
                // Note: Le filtre resultats_en_ligne sera géré côté backend
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient indigo (santé professionnelle) */}
            <LinearGradient
                colors={['#6366F1', '#818CF8']}
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
                            <SafeIcon name="flask" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher un laboratoire</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez rapidement un laboratoire d'analyses ou d'imagerie
                        </Text>
                    </View>
                </View>
            </LinearGradient>

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
                                        color="#6366F1"
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
                            value={ville}
                            onSelect={(location) => setVille(location)}
                            placeholder="Rechercher une ville..."
                            scope="city"
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* Quartier */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier (optionnel)"
                            value={quartier}
                            onSelect={(location) => setQuartier(location)}
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

                    {/* Type établissement */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" /> Type d'établissement
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !serviceType && styles.chipActive]}
                                onPress={() => {
                                    hapticPress();
                                    setServiceType('');
                                }}
                            >
                                <Text style={[styles.chipText, !serviceType && styles.chipTextActive]}>
                                    Tous
                                </Text>
                            </TouchableOpacity>
                            {typesEtablissement.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, serviceType === type && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setServiceType(serviceType === type ? '' : type);
                                    }}
                                >
                                    <Text style={[styles.chipText, serviceType === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Prestation d'analyse */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="test-tube" size={14} color={modernColors.primary} type="lucide" /> Type d'analyse
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !prestationAnalyse && styles.chipActive]}
                                onPress={() => {
                                    hapticPress();
                                    setPrestationAnalyse('');
                                }}
                            >
                                <Text style={[styles.chipText, !prestationAnalyse && styles.chipTextActive]}>
                                    Toutes
                                </Text>
                            </TouchableOpacity>
                            {prestationsAnalyses.map((prestation) => (
                                <TouchableOpacity
                                    key={prestation}
                                    style={[styles.chip, prestationAnalyse === prestation && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setPrestationAnalyse(prestationAnalyse === prestation ? '' : prestation);
                                    }}
                                >
                                    <Text style={[styles.chipText, prestationAnalyse === prestation && styles.chipTextActive]}>
                                        {prestation}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Options */}
                    <View style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>⚙️ Options de recherche</Text>
                        
                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="calendar" size={20} color="#6366F1" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Rendez-vous en ligne</Text>
                                    <Text style={styles.optionDescription}>
                                        Laboratoires proposant la prise de rendez-vous en ligne
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={rdvEnLigne}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setRdvEnLigne(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
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
                                        Filtrer selon les horaires d'ouverture actuels
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
                        <SafeIcon name="info" size={20} color="#6366F1" type="lucide" />
                        <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Certains laboratoires proposent la consultation des résultats en ligne{'\n'}
                        • Vérifiez les horaires d'ouverture avant de vous déplacer{'\n'}
                        • La prise de rendez-vous en ligne permet d'éviter les files d'attente{'\n'}
                        • Les résultats peuvent être disponibles sous 24-48h selon le type d'analyse
                    </Text>
                </View>
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsData || undefined}
            />
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
        backgroundColor: '#EEF2FF',
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
        backgroundColor: '#6366F1',
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
    chipContainer: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
    },
    chipActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    chipTextActive: {
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
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#C7D2FE',
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
        color: '#4338CA',
    },
    infoText: {
        fontSize: 13,
        color: '#4338CA',
        lineHeight: 20,
    },
});

export default LaboratoireSearchScreen;

