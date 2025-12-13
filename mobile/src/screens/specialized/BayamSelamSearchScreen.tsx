// ✅ Écran de recherche BayamSelam - Comparateur de prix (Mobile) - VERSION REFONDUE
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
    produit?: string;
    categorie?: string;
    ville?: string;
    quartier?: string;
    marche?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    prix_min?: number;
    prix_max?: number;
}

const BayamSelamSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [produit, setProduit] = useState('');
    const [categorie, setCategorie] = useState('');
    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [marche, setMarche] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [rayonKm, setRayonKm] = useState(10);
    const [prixMin, setPrixMin] = useState('');
    const [prixMax, setPrixMax] = useState('');
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
        if (!produit.trim() && !categorie.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner au moins un produit ou une catégorie');
            return;
        }

        const filters: SearchFilters = {};
        if (produit.trim()) filters.produit = produit.trim();
        if (categorie.trim()) filters.categorie = categorie.trim();
        const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
        const quartierStr = typeof quartier === 'string' ? quartier : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';
        if (villeStr.trim()) filters.ville = villeStr.trim();
        if (quartierStr.trim()) filters.quartier = quartierStr.trim();
        if (marche.trim()) filters.marche = marche.trim();
        if (gpsData) {
            filters.gps_lat = gpsData.lat;
            filters.gps_lon = gpsData.lng;
            filters.rayon_km = rayonKm;
        }
        if (prixMin.trim()) filters.prix_min = parseFloat(prixMin);
        if (prixMax.trim()) filters.prix_max = parseFloat(prixMax);

        navigation.navigate('BayamSelamResults' as never, { filters } as never);
    };

    const categories = ['Fruits & Légumes', 'Viande & Poisson', 'Céréales', 'Épicerie', 'Boissons', 'Produits laitiers'];
    const marches = ['Marché Central', 'Marché Mokolo', 'Marché Mfoundi', 'Marché Etoa-Meki', 'Marché Makepe'];

    // Recherches rapides spécifiques BayamSelam
    const quickSearches = [
        {
            id: 'fruits',
            title: 'Fruits & Légumes',
            icon: 'apple',
            description: 'Prix du marché',
            action: () => {
                hapticPress();
                setCategorie('Fruits & Légumes');
            }
        },
        {
            id: 'viande',
            title: 'Viande & Poisson',
            icon: 'fish',
            description: 'Comparer les prix',
            action: () => {
                hapticPress();
                setCategorie('Viande & Poisson');
            }
        },
        {
            id: 'proche',
            title: 'Près de moi',
            icon: 'map-pin',
            description: 'Marchés à proximité',
            action: () => {
                hapticPress();
                setRayonKm(5);
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient orange (marché) */}
            <LinearGradient
                colors={['#F97316', '#FB923C']}
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
                            <SafeIcon name="shopping-bag" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>BayamSelam</Text>
                        <Text style={styles.headerSubtitle}>
                            Comparez les prix des produits sur les marchés
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
                                        color="#F97316"
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
                    <Text style={styles.sectionTitle}>🛒 Produit recherché</Text>
                    
                    {/* Produit */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="package" size={14} color={modernColors.primary} type="lucide" /> Produit *
                        </Text>
                        <NativeInput
                            value={produit}
                            onChangeText={setProduit}
                            placeholder="Ex: Tomates, Riz, Poulet"
                        />
                    </View>

                    {/* Catégorie */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="grid" size={14} color={modernColors.primary} type="lucide" /> Catégorie
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.chip, categorie === cat && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setCategorie(categorie === cat ? '' : cat);
                                    }}
                                >
                                    <Text style={[styles.chipText, categorie === cat && styles.chipTextActive]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
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

                    {/* Marché */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="store" size={14} color={modernColors.primary} type="lucide" /> Marché spécifique
                        </Text>
                        <NativeInput
                            value={marche}
                            onChangeText={setMarche}
                            placeholder="Ex: Marché Central"
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {marches.map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.chip, marche === m && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setMarche(marche === m ? '' : m);
                                    }}
                                >
                                    <Text style={[styles.chipText, marche === m && styles.chipTextActive]}>
                                        {m}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
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
                    <Text style={styles.sectionTitle}>💰 Fourchette de prix</Text>
                    
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

                    {/* Bouton recherche */}
                    <NativeButton
                        onPress={handleSearch}
                        disabled={loading}
                        style={styles.searchButton}
                    >
                        <View style={styles.searchButtonContent}>
                            <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchButtonText}>
                                {loading ? 'Recherche en cours...' : 'Comparer les prix'}
                            </Text>
                        </View>
                    </NativeButton>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#F97316" type="lucide" />
                        <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Comparez les prix du même produit sur plusieurs marchés{'\n'}
                        • Les prix peuvent varier selon la saison et la disponibilité{'\n'}
                        • Utilisez la recherche GPS pour trouver les marchés les plus proches{'\n'}
                        • Les prix sont mis à jour régulièrement par les vendeurs
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
        backgroundColor: '#FED7AA',
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
        backgroundColor: '#F97316',
        borderColor: '#F97316',
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    chipTextActive: {
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
        backgroundColor: '#F97316',
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
        backgroundColor: '#FFF7ED',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FED7AA',
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
        color: '#9A3412',
    },
    infoText: {
        fontSize: 13,
        color: '#9A3412',
        lineHeight: 20,
    },
});

export default BayamSelamSearchScreen;

