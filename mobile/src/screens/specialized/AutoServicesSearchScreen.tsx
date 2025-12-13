// ✅ Écran de recherche Automobile - Véhicules (Mobile) - VERSION REFONDUE
import { LinearGradient } from 'expo-linear-gradient';
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
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';

interface SearchFilters {
    type_vehicule?: string;
    marque_modele?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    prix_min?: number;
    prix_max?: number;
    annee_min?: number;
    annee_max?: number;
    occasion?: boolean;
}

const AutoServicesSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [typeVehicule, setTypeVehicule] = useState('');
    const [marqueModele, setMarqueModele] = useState('');
    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [rayonKm, setRayonKm] = useState(10);
    const [prixMin, setPrixMin] = useState('');
    const [prixMax, setPrixMax] = useState('');
    const [anneeMin, setAnneeMin] = useState('');
    const [anneeMax, setAnneeMax] = useState('');
    const [occasion, setOccasion] = useState<boolean | null>(null);
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
        const filters: SearchFilters = {};
        if (typeVehicule.trim()) filters.type_vehicule = typeVehicule.trim();
        if (marqueModele.trim()) filters.marque_modele = marqueModele.trim();
        const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
        const quartierStr = typeof quartier === 'string' ? quartier : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';
        if (villeStr.trim()) filters.ville = villeStr.trim();
        if (quartierStr.trim()) filters.quartier = quartierStr.trim();
        if (gpsData) {
            filters.gps_lat = gpsData.lat;
            filters.gps_lon = gpsData.lng;
            filters.rayon_km = rayonKm;
        }
        if (prixMin.trim()) filters.prix_min = parseFloat(prixMin);
        if (prixMax.trim()) filters.prix_max = parseFloat(prixMax);
        if (anneeMin.trim()) filters.annee_min = parseInt(anneeMin);
        if (anneeMax.trim()) filters.annee_max = parseInt(anneeMax);
        if (occasion !== null) filters.occasion = occasion;

        navigation.navigate('AutoServicesResults' as never, { filters } as never);
    };

    const typesVehicules = ['Berline', 'SUV', '4x4', 'Pick-up', 'Moto', 'Vélo', 'Camion', 'Bus'];
    const marques = ['Toyota', 'Mercedes', 'BMW', 'Audi', 'Volkswagen', 'Peugeot', 'Renault', 'Hyundai', 'Kia', 'Nissan'];

    // Recherches rapides spécifiques automobile
    const quickSearches = [
        {
            id: 'suv',
            title: 'SUV',
            icon: 'car',
            description: 'Véhicules tout-terrain',
            action: () => {
                hapticPress();
                setTypeVehicule('SUV');
            }
        },
        {
            id: 'occasion',
            title: 'Occasion',
            icon: 'refresh-cw',
            description: 'Véhicules d\'occasion',
            action: () => {
                hapticPress();
                setOccasion(true);
            }
        },
        {
            id: 'proche',
            title: 'Près de moi',
            icon: 'map-pin',
            description: 'Véhicules à proximité',
            action: () => {
                hapticPress();
                setRayonKm(5);
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient gris (automobile) */}
            <LinearGradient
                colors={['#6B7280', '#9CA3AF']}
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
                            <SafeIcon name="car" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher un véhicule</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez le véhicule qui correspond à vos besoins
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
                                        color="#6B7280"
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
                    <Text style={styles.sectionTitle}>🚗 Type de véhicule</Text>
                    
                    {/* Type véhicule */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="car" size={14} color={modernColors.primary} type="lucide" /> Type de véhicule
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {typesVehicules.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, typeVehicule === type && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setTypeVehicule(typeVehicule === type ? '' : type);
                                    }}
                                >
                                    <Text style={[styles.chipText, typeVehicule === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Marque et modèle */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="tag" size={14} color={modernColors.primary} type="lucide" /> Marque et modèle
                        </Text>
                        <NativeInput
                            value={marqueModele}
                            onChangeText={setMarqueModele}
                            placeholder="Ex: Toyota Corolla, Mercedes C200"
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {marques.map((marque) => (
                                <TouchableOpacity
                                    key={marque}
                                    style={[styles.chip, marqueModele.includes(marque) && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setMarqueModele(marqueModele.includes(marque) ? marqueModele.replace(marque, '').trim() : `${marqueModele} ${marque}`.trim());
                                    }}
                                >
                                    <Text style={[styles.chipText, marqueModele.includes(marque) && styles.chipTextActive]}>
                                        {marque}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* État du véhicule */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="check-circle" size={14} color={modernColors.primary} type="lucide" /> État
                        </Text>
                        <View style={styles.stateRow}>
                            <TouchableOpacity
                                style={[styles.stateButton, occasion === false && styles.stateButtonActive]}
                                onPress={() => {
                                    hapticPress();
                                    setOccasion(occasion === false ? null : false);
                                }}
                            >
                                <Text style={[styles.stateButtonText, occasion === false && styles.stateButtonTextActive]}>
                                    Neuf
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.stateButton, occasion === true && styles.stateButtonActive]}
                                onPress={() => {
                                    hapticPress();
                                    setOccasion(occasion === true ? null : true);
                                }}
                            >
                                <Text style={[styles.stateButtonText, occasion === true && styles.stateButtonTextActive]}>
                                    Occasion
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Localisation */}
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

                    {/* Rayon de recherche */}
                    {gpsData && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <SafeIcon name="maximize-2" size={14} color={modernColors.primary} type="lucide" /> Rayon de recherche
                            </Text>
                            <View style={styles.distanceCard}>
                                <TouchableOpacity
                                    style={styles.distanceButton}
                                    onPress={() => {
                                        hapticPress();
                                        setRayonKm(Math.max(1, rayonKm - 1));
                                    }}
                                >
                                    <SafeIcon name="minus" size={18} color="#FFFFFF" type="lucide" />
                                </TouchableOpacity>
                                <View style={styles.distanceValueContainer}>
                                    <Text style={styles.distanceValue}>{rayonKm}</Text>
                                    <Text style={styles.distanceUnit}>km</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.distanceButton}
                                    onPress={() => {
                                        hapticPress();
                                        setRayonKm(Math.min(50, rayonKm + 1));
                                    }}
                                >
                                    <SafeIcon name="plus" size={18} color="#FFFFFF" type="lucide" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Prix */}
                    <Text style={styles.sectionTitle}>💰 Prix</Text>
                    
                    <View style={styles.priceRow}>
                        <View style={styles.priceInputContainer}>
                            <Text style={styles.label}>Prix minimum (FCFA)</Text>
                            <NativeInput
                                value={prixMin}
                                onChangeText={setPrixMin}
                                placeholder="Min"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.priceInputContainer}>
                            <Text style={styles.label}>Prix maximum (FCFA)</Text>
                            <NativeInput
                                value={prixMax}
                                onChangeText={setPrixMax}
                                placeholder="Max"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {/* Année */}
                    <Text style={styles.sectionTitle}>📅 Année</Text>
                    
                    <View style={styles.priceRow}>
                        <View style={styles.priceInputContainer}>
                            <Text style={styles.label}>Année minimum</Text>
                            <NativeInput
                                value={anneeMin}
                                onChangeText={setAnneeMin}
                                placeholder="Ex: 2015"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.priceInputContainer}>
                            <Text style={styles.label}>Année maximum</Text>
                            <NativeInput
                                value={anneeMax}
                                onChangeText={setAnneeMax}
                                placeholder="Ex: 2024"
                                keyboardType="numeric"
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
                                {loading ? 'Recherche en cours...' : 'Rechercher un véhicule'}
                            </Text>
                        </View>
                    </NativeButton>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#6B7280" type="lucide" />
                        <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Vérifiez l'historique du véhicule avant l'achat{'\n'}
                        • Demandez à voir les documents du véhicule{'\n'}
                        • Faites une inspection mécanique si possible{'\n'}
                        • Comparez les prix avec d'autres annonces similaires
                    </Text>
                </View>
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsString}
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
        marginTop: 8,
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
        backgroundColor: '#F3F4F6',
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
    chipsContainer: {
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
        backgroundColor: '#6B7280',
        borderColor: '#6B7280',
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    stateRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    stateButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stateButtonActive: {
        backgroundColor: '#6B7280',
        borderColor: '#6B7280',
    },
    stateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    stateButtonTextActive: {
        color: '#FFFFFF',
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
        backgroundColor: '#6B7280',
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
    priceRow: {
        flexDirection: 'row',
        gap: 12,
    },
    priceInputContainer: {
        flex: 1,
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
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
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
        color: '#374151',
    },
    infoText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 20,
    },
});

export default AutoServicesSearchScreen;

