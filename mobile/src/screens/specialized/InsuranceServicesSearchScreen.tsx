// ✅ Écran de recherche Assurance - Produits d'assurance (Mobile) - VERSION REFONDUE
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface SearchFilters {
    type_assurance?: string;
    compagnie?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    prix_min?: number;
    prix_max?: number;
}

const InsuranceServicesSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    const [typeAssurance, setTypeAssurance] = useState('');
    const [compagnie, setCompagnie] = useState('');
    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
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
        const filters: SearchFilters = {};
        if (typeAssurance.trim()) filters.type_assurance = typeAssurance.trim();
        if (compagnie.trim()) filters.compagnie = compagnie.trim();
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

        navigation.navigate('InsuranceServicesResults' as never, { filters } as never);
    };

    const handleRequestQuote = () => {
        hapticPress();
        navigation.navigate('InsuranceQuoteRequest' as never, {
            typeAssurance,
            compagnie,
            ville,
            quartier
        } as never);
    };

    const typesAssurance = ['Auto', t('insuranceServicesSearchScreen.sante'), 'Habitation', 'Vie', 'Voyage', 'Professionnelle', t('insuranceServicesSearchScreen.responsabiliteCivile')];
    const compagnies = ['AXA', 'Allianz', 'Sanlam', 'NSIA', 'Activa', 'GAT', 'Zenith', 'AAR'];

    // Recherches rapides spécifiques assurance
    const quickSearches = [
        {
            id: 'auto',
            title: 'Auto',
            icon: 'car',
            description: t('insuranceServicesSearch.assuranceVehicule'),
            action: () => {
                hapticPress();
                setTypeAssurance('Auto');
            }
        },
        {
            id: 'sante',
            title: t('insuranceServicesSearch.sante'),
            icon: 'heart',
            description: t('insuranceServicesSearch.assuranceSante'),
            action: () => {
                hapticPress();
                setTypeAssurance(t('insuranceServicesSearchScreen.sante'));
            }
        },
        {
            id: 'habitation',
            title: 'Habitation',
            icon: 'home',
            description: 'Assurance logement',
            action: () => {
                hapticPress();
                setTypeAssurance('Habitation');
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient bleu foncé (assurance) */}
            <LinearGradient
                colors={['#1E40AF', '#3B82F6']}
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
                            <SafeIcon name="shield" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>{t('insuranceServicesSearch.rechercherUneAssurance')}</Text>
                        <Text style={styles.headerSubtitle}>
                            Comparez les produits d'assurance et demandez un devis
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
                                        color="#1E40AF"
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
                    <Text style={styles.sectionTitle}>{t('insuranceServicesSearch.typeDassurance')}/Text>

                    {/* Type assurance */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="shield" size={14} color={modernColors.primary} type="lucide" /> Type d'assurance
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {typesAssurance.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, typeAssurance === type && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setTypeAssurance(typeAssurance === type ? '' : type);
                                    }}
                                >
                                    <Text style={[styles.chipText, typeAssurance === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Compagnie */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" /> Compagnie d'assurance
                        </Text>
                        <NativeInput
                            value={compagnie}
                            onChangeText={setCompagnie}
                            placeholder="Ex: AXA, Allianz, Sanlam"
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {compagnies.map((comp) => (
                                <TouchableOpacity
                                    key={comp}
                                    style={[styles.chip, compagnie === comp && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setCompagnie(compagnie === comp ? '' : comp);
                                    }}
                                >
                                    <Text style={[styles.chipText, compagnie === comp && styles.chipTextActive]}>
                                        {comp}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Localisation */}
                    <Text style={styles.sectionTitle}>{t('insuranceServicesSearch.localisation')}/Text>

                    {/* Ville */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label={t('insuranceServicesSearch.ville')}
                            value={typeof ville === 'string' ? (ville ? { raw: ville, place_name: ville } : '') : ville}
                            onSelect={(location: LocationObject) => {
                                setVille(location);
                            }}
                            placeholder={t('insuranceServicesSearch.rechercherUnLieuVilleQuartier')}
                            scope="all"
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* Quartier */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label={t('insuranceServicesSearch.quartierOptionnel')}
                            value={typeof quartier === 'string' ? (quartier ? { raw: quartier, place_name: quartier } : '') : quartier}
                            onSelect={(location: LocationObject) => {
                                setQuartier(location);
                            }}
                            placeholder={t('insuranceServicesSearch.rechercherUnLieuPrecisQuartier')}
                            scope="all"
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
                    <Text style={styles.sectionTitle}>💰 Prime annuelle</Text>

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

                    {/* Boutons */}
                    <View style={styles.buttonsRow}>
                        <NativeButton
                            onPress={handleSearch}
                            disabled={loading}
                            variant="secondary"
                            style={styles.searchButton}
                        >
                            <View style={styles.searchButtonContent}>
                                <SafeIcon name="search" size={20} color={modernColors.primary} type="lucide" />
                                <Text style={styles.searchButtonTextSecondary}>
                                    {loading ? 'Recherche...' : 'Rechercher'}
                                </Text>
                            </View>
                        </NativeButton>
                        <NativeButton
                            onPress={handleRequestQuote}
                            style={styles.quoteButton}
                        >
                            <View style={styles.searchButtonContent}>
                                <SafeIcon name="file-text" size={20} color="#FFFFFF" type="lucide" />
                                <Text style={styles.searchButtonText}>
                                    Demander un devis
                                </Text>
                            </View>
                        </NativeButton>
                    </View>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#1E40AF" type="lucide" />
                        <Text style={styles.infoTitle}>{t('insuranceServicesSearch.bonASavoir')}</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Comparez les garanties et les primes de plusieurs compagnies{'\n'}
                        • Lisez attentivement les conditions générales avant de souscrire{'\n'}
                        • Vérifiez les exclusions et les franchises{'\n'}
                        • Demandez un devis personnalisé pour obtenir le meilleur prix
                    </Text>
                </View>
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsString as any}
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
        backgroundColor: '#DBEAFE',
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
        backgroundColor: '#1E40AF',
        borderColor: '#1E40AF',
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
        backgroundColor: '#1E40AF',
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
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    searchButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    quoteButton: {
        flex: 1,
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
    searchButtonTextSecondary: {
        color: modernColors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#DBEAFE',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#93C5FD',
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
        color: '#1E3A8A',
    },
    infoText: {
        fontSize: 13,
        color: '#1E3A8A',
        lineHeight: 20,
    },
});

export default InsuranceServicesSearchScreen;

