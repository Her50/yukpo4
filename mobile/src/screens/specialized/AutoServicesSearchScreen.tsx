// ✅ Écran de recherche Automobile - Véhicules (Mobile) - VERSION REFONDUE
// ✅ AMÉLIORÉ 2026-03-07: Filtres dynamiques extraits de la base de données via /api/auto/filters
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet } from '../../services/api';
import { hapticPress } from '../../utils/hapticFeedback';

interface SearchFilters {
    q?: string;
    type_vehicule?: string;
    marque?: string;
    carburant?: string;
    transmission?: string;
    couleur?: string;
    etat?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    prix_min?: number;
    prix_max?: number;
    annee_min?: number;
    annee_max?: number;
    km_max?: number;
    sort?: string;
}

interface FacetItem {
    label: string;
    count: number;
}

interface AutoFilters {
    marques: FacetItem[];
    types_vehicule: FacetItem[];
    carburants: FacetItem[];
    transmissions: FacetItem[];
    couleurs: FacetItem[];
    etats: FacetItem[];
    prix_range: { min: number | null; max: number | null };
    annee_range: { min: number | null; max: number | null };
    total_products: number;
}

const ACCENT_COLOR = '#1E3A5F';
const ACCENT_LIGHT = '#2563EB';
const ACCENT_BG = '#EFF6FF';

const AutoServicesSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    // Filtres dynamiques depuis la base
    const [dynamicFilters, setDynamicFilters] = useState<AutoFilters | null>(null);
    const [filtersLoading, setFiltersLoading] = useState(true);

    // Champs de recherche
    const [searchText, setSearchText] = useState('');
    const [typeVehicule, setTypeVehicule] = useState('');
    const [marque, setMarque] = useState('');
    const [carburant, setCarburant] = useState('');
    const [transmission, setTransmission] = useState('');
    const [couleur, setCouleur] = useState('');
    const [etat, setEtat] = useState('');
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
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Charger les filtres dynamiques depuis le backend
    const loadDynamicFilters = useCallback(async () => {
        try {
            setFiltersLoading(true);
            const response = await apiGet<AutoFilters>('/api/auto/filters');
            if (response.success && response.data) {
                // response.data contient le JSON backend complet
                const backendData = response.data as any;
                setDynamicFilters(backendData);
                console.log('[AutoSearch] Filtres dynamiques chargés:', backendData.total_products, 'produits');
            }
        } catch (error) {
            console.error('[AutoSearch] Erreur chargement filtres:', error);
        } finally {
            setFiltersLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDynamicFilters();
    }, [loadDynamicFilters]);

    useEffect(() => {
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
        if (searchText.trim()) filters.q = searchText.trim();
        if (typeVehicule.trim()) filters.type_vehicule = typeVehicule.trim();
        if (marque.trim()) filters.marque = marque.trim();
        if (carburant.trim()) filters.carburant = carburant.trim();
        if (transmission.trim()) filters.transmission = transmission.trim();
        if (couleur.trim()) filters.couleur = couleur.trim();
        if (etat.trim()) filters.etat = etat.trim();
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

        navigation.navigate('AutoServicesResults' as never, { filters } as never);
    };

    const handleQuickSearch = (preset: Partial<SearchFilters>) => {
        hapticPress();
        navigation.navigate('AutoServicesResults' as never, { filters: preset } as never);
    };

    const resetFilters = () => {
        hapticPress();
        setSearchText('');
        setTypeVehicule('');
        setMarque('');
        setCarburant('');
        setTransmission('');
        setCouleur('');
        setEtat('');
        setVille('');
        setQuartier('');
        setPrixMin('');
        setPrixMax('');
        setAnneeMin('');
        setAnneeMax('');
    };

    const activeFiltersCount = [
        searchText, typeVehicule, marque, carburant, transmission, couleur, etat, prixMin, prixMax, anneeMin, anneeMax
    ].filter(v => v.trim()).length;

    // Composant chip de filtre dynamique
    const renderFilterChips = (
        items: FacetItem[],
        selectedValue: string,
        onSelect: (val: string) => void,
        maxShow: number = 10
    ) => {
        const displayed = items.slice(0, maxShow);
        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                <View style={styles.chipsRow}>
                    {displayed.map((item) => (
                        <TouchableOpacity
                            key={item.label}
                            style={[styles.chip, selectedValue === item.label && styles.chipActive]}
                            onPress={() => {
                                hapticPress();
                                onSelect(selectedValue === item.label ? '' : item.label);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.chipText, selectedValue === item.label && styles.chipTextActive]}>
                                {item.label}
                            </Text>
                            <Text style={[styles.chipCount, selectedValue === item.label && styles.chipCountActive]}>
                                {item.count}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        );
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient automobile professionnel */}
            <LinearGradient
                colors={[ACCENT_COLOR, '#2D4A6F']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => { hapticPress(); navigation.goBack(); }}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <SafeIcon name="car" size={28} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Recherche Automobile</Text>
                        <Text style={styles.headerSubtitle}>
                            {dynamicFilters
                                ? `${dynamicFilters.total_products} vehicule${dynamicFilters.total_products > 1 ? 's' : ''} disponible${dynamicFilters.total_products > 1 ? 's' : ''}`
                                : 'Chargement du catalogue...'}
                        </Text>
                    </View>
                    <View style={{ width: 24 }} />
                </View>

                {/* Barre de recherche intégrée */}
                <View style={styles.searchBarContainer}>
                    <SafeIcon name="search" size={20} color="rgba(255,255,255,0.7)" type="lucide" />
                    <NativeInput
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Rechercher marque, modèle, type..."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        style={styles.searchBarInput}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {searchText ? (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <SafeIcon name="x" size={20} color="rgba(255,255,255,0.7)" type="lucide" />
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={styles.searchBarSubmitBtn}
                        onPress={handleSearch}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="arrow-right" size={20} color="#FFFFFF" type="lucide" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Recherches rapides */}
                <View style={styles.quickSection}>
                    <Text style={styles.sectionLabel}>Recherches rapides</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.quickRow}>
                            <TouchableOpacity style={styles.quickCard} onPress={() => handleQuickSearch({})}>
                                <View style={[styles.quickIcon, { backgroundColor: '#EFF6FF' }]}>
                                    <SafeIcon name="list" size={20} color={ACCENT_LIGHT} type="lucide" />
                                </View>
                                <Text style={styles.quickLabel}>Tout voir</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickCard} onPress={() => handleQuickSearch({ etat: 'Occasion' })}>
                                <View style={[styles.quickIcon, { backgroundColor: '#FEF3C7' }]}>
                                    <SafeIcon name="refresh-cw" size={20} color="#D97706" type="lucide" />
                                </View>
                                <Text style={styles.quickLabel}>Occasion</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickCard} onPress={() => handleQuickSearch({ etat: 'Neuf' })}>
                                <View style={[styles.quickIcon, { backgroundColor: '#D1FAE5' }]}>
                                    <SafeIcon name="star" size={20} color="#059669" type="lucide" />
                                </View>
                                <Text style={styles.quickLabel}>Neuf</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickCard} onPress={() => handleQuickSearch({ sort: 'price_asc' })}>
                                <View style={[styles.quickIcon, { backgroundColor: '#FEE2E2' }]}>
                                    <SafeIcon name="trending-down" size={20} color="#DC2626" type="lucide" />
                                </View>
                                <Text style={styles.quickLabel}>Moins cher</Text>
                            </TouchableOpacity>
                            {gpsData && (
                                <TouchableOpacity style={styles.quickCard} onPress={() => handleQuickSearch({
                                    gps_lat: gpsData.lat, gps_lon: gpsData.lng, rayon_km: 10, sort: 'distance'
                                })}>
                                    <View style={[styles.quickIcon, { backgroundColor: '#E0E7FF' }]}>
                                        <SafeIcon name="map-pin" size={20} color="#4F46E5" type="lucide" />
                                    </View>
                                    <Text style={styles.quickLabel}>Proche</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* Filtres dynamiques */}
                {filtersLoading ? (
                    <View style={styles.loadingFilters}>
                        <ActivityIndicator size="small" color={ACCENT_LIGHT} />
                        <Text style={styles.loadingText}>Chargement des filtres intelligents...</Text>
                    </View>
                ) : dynamicFilters ? (
                    <View style={styles.filtersCard}>
                        <View style={styles.filterHeaderRow}>
                            <Text style={styles.sectionTitle}>Filtres intelligents</Text>
                            {activeFiltersCount > 0 && (
                                <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
                                    <SafeIcon name="x" size={14} color={ACCENT_LIGHT} type="lucide" />
                                    <Text style={styles.resetText}>Effacer ({activeFiltersCount})</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Marques */}
                        {dynamicFilters.marques.length > 0 && (
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterLabel}>
                                    <SafeIcon name="tag" size={14} color={ACCENT_COLOR} type="lucide" /> Marque
                                </Text>
                                {renderFilterChips(dynamicFilters.marques, marque, setMarque)}
                            </View>
                        )}

                        {/* Types de véhicule */}
                        {dynamicFilters.types_vehicule.length > 0 && (
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterLabel}>
                                    <SafeIcon name="car" size={14} color={ACCENT_COLOR} type="lucide" /> Type
                                </Text>
                                {renderFilterChips(dynamicFilters.types_vehicule, typeVehicule, setTypeVehicule)}
                            </View>
                        )}

                        {/* État */}
                        {dynamicFilters.etats.length > 0 && (
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterLabel}>
                                    <SafeIcon name="check-circle" size={14} color={ACCENT_COLOR} type="lucide" /> État
                                </Text>
                                {renderFilterChips(dynamicFilters.etats, etat, setEtat)}
                            </View>
                        )}

                        {/* Prix */}
                        <View style={styles.filterGroup}>
                            <Text style={styles.filterLabel}>
                                <SafeIcon name="dollar-sign" size={14} color={ACCENT_COLOR} type="lucide" /> Prix (FCFA)
                                {dynamicFilters.prix_range.min != null && dynamicFilters.prix_range.max != null && (
                                    <Text style={styles.rangeHint}>
                                        {' '}({Math.round(dynamicFilters.prix_range.min).toLocaleString()} - {Math.round(dynamicFilters.prix_range.max).toLocaleString()})
                                    </Text>
                                )}
                            </Text>
                            <View style={styles.rangeRow}>
                                <View style={styles.rangeInput}>
                                    <NativeInput
                                        value={prixMin}
                                        onChangeText={setPrixMin}
                                        placeholder={dynamicFilters.prix_range.min ? `Min: ${Math.round(dynamicFilters.prix_range.min).toLocaleString()}` : 'Min'}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <Text style={styles.rangeSeparator}>-</Text>
                                <View style={styles.rangeInput}>
                                    <NativeInput
                                        value={prixMax}
                                        onChangeText={setPrixMax}
                                        placeholder={dynamicFilters.prix_range.max ? `Max: ${Math.round(dynamicFilters.prix_range.max).toLocaleString()}` : 'Max'}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Année */}
                        <View style={styles.filterGroup}>
                            <Text style={styles.filterLabel}>
                                <SafeIcon name="calendar" size={14} color={ACCENT_COLOR} type="lucide" /> Année
                                {dynamicFilters.annee_range.min != null && dynamicFilters.annee_range.max != null && (
                                    <Text style={styles.rangeHint}>
                                        {' '}({dynamicFilters.annee_range.min} - {dynamicFilters.annee_range.max})
                                    </Text>
                                )}
                            </Text>
                            <View style={styles.rangeRow}>
                                <View style={styles.rangeInput}>
                                    <NativeInput
                                        value={anneeMin}
                                        onChangeText={setAnneeMin}
                                        placeholder={dynamicFilters.annee_range.min ? `Depuis ${dynamicFilters.annee_range.min}` : 'Depuis'}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <Text style={styles.rangeSeparator}>-</Text>
                                <View style={styles.rangeInput}>
                                    <NativeInput
                                        value={anneeMax}
                                        onChangeText={setAnneeMax}
                                        placeholder={dynamicFilters.annee_range.max ? `Jusqu'à ${dynamicFilters.annee_range.max}` : "Jusqu'à"}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Filtres avancés (dépliable) */}
                        <TouchableOpacity
                            style={styles.advancedToggle}
                            onPress={() => { hapticPress(); setShowAdvancedFilters(!showAdvancedFilters); }}
                        >
                            <SafeIcon name={showAdvancedFilters ? 'chevron-up' : 'chevron-down'} size={16} color={ACCENT_LIGHT} type="lucide" />
                            <Text style={styles.advancedToggleText}>
                                {showAdvancedFilters ? 'Masquer les filtres avancés' : 'Plus de filtres'}
                            </Text>
                        </TouchableOpacity>

                        {showAdvancedFilters && (
                            <View style={styles.advancedSection}>
                                {/* Carburant */}
                                {dynamicFilters.carburants.length > 0 && (
                                    <View style={styles.filterGroup}>
                                        <Text style={styles.filterLabel}>
                                            <SafeIcon name="zap" size={14} color={ACCENT_COLOR} type="lucide" /> Carburant
                                        </Text>
                                        {renderFilterChips(dynamicFilters.carburants, carburant, setCarburant)}
                                    </View>
                                )}

                                {/* Transmission */}
                                {dynamicFilters.transmissions.length > 0 && (
                                    <View style={styles.filterGroup}>
                                        <Text style={styles.filterLabel}>
                                            <SafeIcon name="settings" size={14} color={ACCENT_COLOR} type="lucide" /> Transmission
                                        </Text>
                                        {renderFilterChips(dynamicFilters.transmissions, transmission, setTransmission)}
                                    </View>
                                )}

                                {/* Couleur */}
                                {dynamicFilters.couleurs.length > 0 && (
                                    <View style={styles.filterGroup}>
                                        <Text style={styles.filterLabel}>
                                            <SafeIcon name="palette" size={14} color={ACCENT_COLOR} type="lucide" /> Couleur
                                        </Text>
                                        {renderFilterChips(dynamicFilters.couleurs, couleur, setCouleur, 15)}
                                    </View>
                                )}

                                {/* Localisation */}
                                <View style={styles.filterGroup}>
                                    <Text style={styles.filterLabel}>
                                        <SafeIcon name="map-pin" size={14} color={ACCENT_COLOR} type="lucide" /> Localisation
                                    </Text>
                                    <LocationSelector
                                        label=""
                                        value={typeof ville === 'string' ? (ville ? { raw: ville, place_name: ville } : '') : ville}
                                        onSelect={(loc: LocationObject) => setVille(loc)}
                                        placeholder="Ville, quartier, adresse..."
                                        scope="all"
                                        enrichWithBackend={true}
                                    />
                                </View>

                                {/* GPS */}
                                <View style={styles.filterGroup}>
                                    <TouchableOpacity
                                        style={styles.gpsButton}
                                        onPress={() => { hapticPress(); setShowGPSModal(true); }}
                                    >
                                        <SafeIcon name="navigation" size={18} color={ACCENT_LIGHT} type="lucide" />
                                        <Text style={styles.gpsButtonText} numberOfLines={1}>
                                            {gpsString ? `GPS: ${gpsString.substring(0, 25)}...` : 'Utiliser ma position GPS'}
                                        </Text>
                                        <SafeIcon name="chevron-right" size={16} color="#9CA3AF" type="lucide" />
                                    </TouchableOpacity>
                                </View>

                                {gpsData && (
                                    <View style={styles.filterGroup}>
                                        <Text style={styles.filterLabel}>Rayon: {rayonKm} km</Text>
                                        <View style={styles.radiusRow}>
                                            {[5, 10, 20, 50].map(r => (
                                                <TouchableOpacity
                                                    key={r}
                                                    style={[styles.radiusChip, rayonKm === r && styles.radiusChipActive]}
                                                    onPress={() => { hapticPress(); setRayonKm(r); }}
                                                >
                                                    <Text style={[styles.radiusText, rayonKm === r && styles.radiusTextActive]}>{r} km</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                ) : null}

                {/* Bouton recherche principal */}
                <TouchableOpacity
                    onPress={handleSearch}
                    style={styles.searchButton}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[ACCENT_LIGHT, ACCENT_COLOR]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.searchButtonGradient}
                    >
                        <SafeIcon name="search" size={22} color="#FFFFFF" type="lucide" />
                        <Text style={styles.searchButtonText}>Rechercher</Text>
                        {activeFiltersCount > 0 && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Info */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <SafeIcon name="info" size={16} color={ACCENT_LIGHT} type="lucide" />
                        <Text style={styles.infoText}>
                            Les filtres s'adaptent automatiquement aux véhicules disponibles dans le catalogue.
                        </Text>
                    </View>
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
        backgroundColor: '#F8FAFC',
    },
    headerGradient: {
        paddingTop: 16,
        paddingBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    backButton: {
        padding: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginHorizontal: 16,
        gap: 10,
    },
    searchBarInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingVertical: 8,
        marginBottom: 0,
    },
    searchBarSubmitBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    quickSection: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    quickRow: {
        flexDirection: 'row',
        gap: 10,
    },
    quickCard: {
        alignItems: 'center',
        width: 72,
    },
    quickIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    quickLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
    },
    loadingFilters: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 10,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748B',
    },
    filtersCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    filterHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: ACCENT_BG,
    },
    resetText: {
        fontSize: 12,
        fontWeight: '600',
        color: ACCENT_LIGHT,
    },
    filterGroup: {
        marginBottom: 14,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    rangeHint: {
        fontSize: 12,
        fontWeight: '400',
        color: '#94A3B8',
    },
    chipsScroll: {
        flexDirection: 'row',
    },
    chipsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    chipActive: {
        backgroundColor: ACCENT_COLOR,
        borderColor: ACCENT_COLOR,
    },
    chipText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    chipCount: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
    },
    chipCountActive: {
        color: 'rgba(255,255,255,0.7)',
    },
    rangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rangeInput: {
        flex: 1,
    },
    rangeSeparator: {
        fontSize: 16,
        color: '#94A3B8',
        fontWeight: '600',
    },
    advancedToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        marginTop: 4,
    },
    advancedToggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: ACCENT_LIGHT,
    },
    advancedSection: {
        marginTop: 8,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 10,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
    },
    radiusRow: {
        flexDirection: 'row',
        gap: 8,
    },
    radiusChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    radiusChipActive: {
        backgroundColor: ACCENT_COLOR,
        borderColor: ACCENT_COLOR,
    },
    radiusText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    radiusTextActive: {
        color: '#FFFFFF',
    },
    searchButton: {
        marginBottom: 16,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: ACCENT_COLOR,
    },
    searchButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
    filterBadge: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: ACCENT_COLOR,
    },
    infoCard: {
        backgroundColor: ACCENT_BG,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#334155',
        lineHeight: 19,
    },
});

export default AutoServicesSearchScreen;

