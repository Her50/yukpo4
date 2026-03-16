// ✅ Écran de recherche de biens immobiliers (Mobile) - VERSION REFONDUE
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import RealEstateAIFeatures from '../../components/RealEstateAIFeatures';
import SafeIcon from '../../components/SafeIcon';
import { NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface ImmobilierSearchFilters {
    ville?: string;
    quartier?: string | string[]; // Support multiple quartiers
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    search_zone?: string; // Zone polygonale (format: "lat1,lng1|lat2,lng2|...")
    type_bien?: string;
    statut?: string;
    prix_min?: number;
    prix_max?: number;
    superficie_min?: number;
    superficie_max?: number;
    nb_chambres_min?: number;
    standing?: string;
}

const ImmobilierSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [selectedQuartiers, setSelectedQuartiers] = useState<string[]>([]);
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [searchZone, setSearchZone] = useState<string>(''); // Zone polygonale
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showZoneSelector, setShowZoneSelector] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [searchMode, setSearchMode] = useState<'point' | 'zone' | 'quartiers'>('point');
    const [typeBien, setTypeBien] = useState<string>('');
    const [statut, setStatut] = useState<string>('');
    const [prixMin, setPrixMin] = useState<string>('');
    const [prixMax, setPrixMax] = useState<string>('');
    const [superficieMin, setSuperficieMin] = useState<string>('');
    const [superficieMax, setSuperficieMax] = useState<string>('');
    const [nbChambresMin, setNbChambresMin] = useState<string>('');
    const [standing, setStanding] = useState<string>('');
    const [loading, setLoading] = useState(false);
    // ✅ NOUVEAU: Modal fonctionnalités IA
    const [showAIFeatures, setShowAIFeatures] = useState(false);

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
        if (searchMode === 'zone') {
            // Format polygonale: "lat1,lng1|lat2,lng2|..."
            setSearchZone(coordinates);
            setGpsString(t('immobilierSearchScreen.zoneDelimitee'));
        } else {
            // Point unique
            setGpsString(coordinates);
            const [lat, lng] = coordinates.split(',').map(parseFloat);
            if (!isNaN(lat) && !isNaN(lng)) {
                setGpsData({ lat, lng });
            }
        }
        setShowGPSModal(false);
    };

    const handleQuartierToggle = (q: string) => {
        if (selectedQuartiers.includes(q)) {
            setSelectedQuartiers(selectedQuartiers.filter((item) => item !== q));
        } else {
            setSelectedQuartiers([...selectedQuartiers, q]);
        }
    };

    // Quartiers populaires (à charger depuis l'API ou config)
    const popularQuartiers = [
        'Akwa', 'Bonanjo', 'Bonapriso', 'Deido', 'Makepe', 'Logpom', 'Kotto',
        'Bastos', 'Etoa-Meki', 'Mvog-Ada', 'Efoulan', 'Nlongkak', 'Mendong',
        'Biyem-Assi', 'Emana', 'Mbankomo', 'Nkoldongo', 'Mvog-Betsi',
    ];

    const handleSearch = () => {
        // Validation selon le mode de recherche
        if (searchMode === 'quartiers' && selectedQuartiers.length === 0) {
            Alert.alert('Erreur', 'Veuillez sélectionner au moins un quartier');
            return;
        }
        if (searchMode === 'zone' && !searchZone) {
            Alert.alert('Erreur', 'Veuillez délimiter une zone sur la carte');
            return;
        }
        const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
        const quartierStr = typeof quartier === 'string' ? quartier : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';

        if (searchMode === 'point' && !villeStr.trim() && !quartierStr.trim() && !gpsData) {
            Alert.alert('Erreur', 'Veuillez renseigner une ville/quartier ou sélectionner un point GPS');
            return;
        }

        const filters: ImmobilierSearchFilters = {};

        // Mode de recherche
        if (searchMode === 'quartiers') {
            filters.quartier = selectedQuartiers.length > 0 ? selectedQuartiers : undefined;
        } else if (searchMode === 'zone') {
            filters.search_zone = searchZone;
        } else {
            // Mode point
            if (villeStr.trim()) filters.ville = villeStr.trim();
            if (quartierStr.trim()) filters.quartier = quartierStr.trim();
            if (gpsData) {
                filters.lat = gpsData.lat;
                filters.lng = gpsData.lng;
            }
            if (maxDistance > 0) filters.max_distance_km = maxDistance;
        }

        // Filtres communs
        if (typeBien) filters.type_bien = typeBien;
        if (statut) filters.statut = statut;
        if (prixMin) filters.prix_min = parseFloat(prixMin);
        if (prixMax) filters.prix_max = parseFloat(prixMax);
        if (superficieMin) filters.superficie_min = parseFloat(superficieMin);
        if (superficieMax) filters.superficie_max = parseFloat(superficieMax);
        if (nbChambresMin) filters.nb_chambres_min = parseInt(nbChambresMin);
        if (standing) filters.standing = standing;

        navigation.navigate('ImmobilierList' as never, { filters } as never);
    };

    const typesBiens = ['Appartement', 'Villa', 'Studio', 'Duplex', 'Triplex', 'Maison', 'Bureau', 'Commerce'];
    const statuts = ['À vendre', 'À louer (bail)', t('immobilierSearchScreen.aLouerMeuble'), t('immobilierSearchScreen.locationCourteDuree'), 'Colocation'];
    const standings = ['Économique', 'Standard', 'Bon standing', 'Haut standing', 'Luxe / Prestige'];

    // Recherches rapides spécifiques immobilier
    const quickSearches = [
        {
            id: 'vente',
            title: t('immobilierSearch.aVendre'),
            icon: 'tag',
            description: 'Biens en vente',
            action: () => {
                hapticPress();
                setStatut('À vendre');
            }
        },
        {
            id: 'location',
            title: t('immobilierSearch.aLouer'),
            icon: 'key',
            description: t('immobilierSearch.biensALouer'),
            action: () => {
                hapticPress();
                setStatut('À louer (bail)');
            }
        },
        {
            id: 'proche',
            title: 'Plus proche',
            icon: 'map-pin',
            description: t('immobilierSearch.aProximite'),
            action: () => {
                hapticPress();
                setMaxDistance(10);
                setSearchMode('point');
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient bleu foncé (immobilier) */}
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
                            <SafeIcon name="home" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>{t('immobilierSearch.rechercherUnBienImmobilier')}</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez le bien idéal selon vos critères
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAwareScreen
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ NOUVEAU: Bannière fonctionnalités IA */}
                <TouchableOpacity
                    style={styles.aiFeaturesBanner}
                    onPress={() => {
                        hapticPress();
                        setShowAIFeatures(true);
                    }}
                >
                    <LinearGradient
                        colors={['#8B5CF6', '#A78BFA']}
                        style={styles.aiFeaturesBannerGradient}
                    >
                        <View style={styles.aiFeaturesBannerContent}>
                            <View style={styles.aiFeaturesBannerIcon}>
                                <SafeIcon name="sparkles" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <View style={styles.aiFeaturesBannerText}>
                                <Text style={styles.aiFeaturesBannerTitle}>{t('immobilierSearch.fonctionnalitesIa')}</Text>
                                <Text style={styles.aiFeaturesBannerSubtitle}>
                                    Recommandations, estimation prix, comparaison, alertes
                                </Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#FFFFFF" type="lucide" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

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
                    {/* Mode de recherche */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.sectionTitle}>{t('immobilierSearch.modeDeRecherche')}</Text>
                        <View style={styles.modeSelector}>
                            <TouchableOpacity
                                style={[styles.modeButton, searchMode === 'point' && styles.modeButtonActive]}
                                onPress={() => {
                                    hapticPress();
                                    setSearchMode('point');
                                }}
                            >
                                <SafeIcon name="map-pin" size={18} color={searchMode === 'point' ? '#fff' : '#1E40AF'} type="lucide" />
                                <Text style={[styles.modeButtonText, searchMode === 'point' && styles.modeButtonTextActive]}>
                                    Point GPS
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeButton, searchMode === 'zone' && styles.modeButtonActive]}
                                onPress={() => {
                                    hapticPress();
                                    setSearchMode('zone');
                                    setShowZoneSelector(true);
                                }}
                            >
                                <SafeIcon name="map" size={18} color={searchMode === 'zone' ? '#fff' : '#1E40AF'} type="lucide" />
                                <Text style={[styles.modeButtonText, searchMode === 'zone' && styles.modeButtonTextActive]}>
                                    Zone carte
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeButton, searchMode === 'quartiers' && styles.modeButtonActive]}
                                onPress={() => {
                                    hapticPress();
                                    setSearchMode('quartiers');
                                }}
                            >
                                <SafeIcon name="layers" size={18} color={searchMode === 'quartiers' ? '#fff' : '#1E40AF'} type="lucide" />
                                <Text style={[styles.modeButtonText, searchMode === 'quartiers' && styles.modeButtonTextActive]}>
                                    Quartiers
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Localisation selon le mode */}
                    {searchMode === 'point' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.sectionTitle}>{t('immobilierSearch.localisation')}</Text>
                            <LocationSelector
                                label={t('immobilierSearch.ville')}
                                value={typeof ville === 'string' ? (ville ? { raw: ville, place_name: ville } : '') : ville}
                                onSelect={(location: LocationObject) => {
                                    setVille(location);
                                }}
                                placeholder={t('immobilierSearch.rechercherUnLieuVilleQuartier')}
                                scope="all"
                                enrichWithBackend={true}
                            />
                            <View style={{ marginTop: 12 }}>
                                <LocationSelector
                                    label={t('immobilierSearch.quartierOptionnel')}
                                    value={typeof quartier === 'string' ? (quartier ? { raw: quartier, place_name: quartier } : '') : quartier}
                                    onSelect={(location: LocationObject) => {
                                        setQuartier(location);
                                    }}
                                    placeholder={t('immobilierSearch.rechercherUnLieuPrecisQuartier')}
                                    scope="all"
                                    cityContext={typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || ''}
                                    enrichWithBackend={true}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.gpsButton}
                                onPress={() => {
                                    hapticPress();
                                    setShowGPSModal(true);
                                }}
                            >
                                <SafeIcon name="map-pin" size={20} color="#1E40AF" type="lucide" />
                                <Text style={styles.gpsButtonText}>
                                    {gpsString || t('immobilierSearch.selectionnerUnPointGps')}
                                </Text>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {searchMode === 'zone' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.sectionTitle}>{t('immobilierSearch.zoneDeRecherche')}</Text>
                            <TouchableOpacity
                                style={styles.zoneButton}
                                onPress={() => {
                                    hapticPress();
                                    setShowZoneSelector(true);
                                }}
                            >
                                <SafeIcon name="map" size={20} color="#1E40AF" type="lucide" />
                                <Text style={styles.zoneButtonText}>
                                    {searchZone ? t('immobilierSearchScreen.zoneDelimiteeModifier') : 'Délimiter une zone sur la carte'}
                                </Text>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                            </TouchableOpacity>
                            {searchZone && (
                                <View style={styles.zoneInfo}>
                                    <SafeIcon name="check-circle" size={16} color="#10B981" type="lucide" />
                                    <Text style={styles.zoneInfoText}>
                                        Zone configurée ({searchZone.split('|').length} points)
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {searchMode === 'quartiers' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.sectionTitle}>{t('immobilierSearch.selectionnerDesQuartiers')}</Text>
                            <Text style={styles.sectionSubtitle}>
                                Sélectionnez un ou plusieurs quartiers pour filtrer la recherche
                            </Text>
                            <View style={styles.quartiersGrid}>
                                {popularQuartiers.map((q) => (
                                    <TouchableOpacity
                                        key={q}
                                        style={[
                                            styles.quartierChip,
                                            selectedQuartiers.includes(q) && styles.quartierChipActive,
                                        ]}
                                        onPress={() => {
                                            hapticPress();
                                            handleQuartierToggle(q);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.quartierChipText,
                                                selectedQuartiers.includes(q) && styles.quartierChipTextActive,
                                            ]}
                                        >
                                            {q}
                                        </Text>
                                        {selectedQuartiers.includes(q) && (
                                            <SafeIcon name="check" size={14} color="#fff" type="lucide" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {selectedQuartiers.length > 0 && (
                                <View style={styles.selectedQuartiersInfo}>
                                    <Text style={styles.selectedQuartiersText}>
                                        {selectedQuartiers.length} quartier{selectedQuartiers.length > 1 ? 's' : ''} sélectionné{selectedQuartiers.length > 1 ? 's' : ''}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Type et Statut */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.sectionTitle}>{t('immobilierSearch.typeDeBien')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {typesBiens.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, typeBien === type && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setTypeBien(typeBien === type ? '' : type);
                                    }}
                                >
                                    <Text style={[styles.chipText, typeBien === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.sectionTitle}>💰 Statut</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {statuts.map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.chip, statut === s && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setStatut(statut === s ? '' : statut);
                                    }}
                                >
                                    <Text style={[styles.chipText, statut === s && styles.chipTextActive]}>
                                        {s}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Prix */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.sectionTitle}>💵 Prix (FCFA)</Text>
                        <View style={styles.row}>
                            <NativeInput
                                placeholder={t('immobilierSearch.prixMin')}
                                value={prixMin}
                                onChangeText={setPrixMin}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                            />
                            <NativeInput
                                placeholder={t('immobilierSearch.prixMax')}
                                value={prixMax}
                                onChangeText={setPrixMax}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                            />
                        </View>
                    </View>

                    {/* Superficie */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.sectionTitle}>📐 Superficie (m²)</Text>
                        <View style={styles.row}>
                            <NativeInput
                                placeholder="Min"
                                value={superficieMin}
                                onChangeText={setSuperficieMin}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                            />
                            <NativeInput
                                placeholder="Max"
                                value={superficieMax}
                                onChangeText={setSuperficieMax}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                            />
                        </View>
                    </View>

                    {/* Caractéristiques */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.sectionTitle}>{t('immobilierSearch.caracteristiques')}</Text>
                        <NativeInput
                            placeholder={t('immobilierSearch.nombreDeChambresMinimum')}
                            value={nbChambresMin}
                            onChangeText={setNbChambresMin}
                            keyboardType="numeric"
                            style={styles.input}
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {standings.map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.chip, standing === s && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setStanding(standing === s ? '' : standing);
                                    }}
                                >
                                    <Text style={[styles.chipText, standing === s && styles.chipTextActive]}>
                                        {s}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Distance */}
                    {searchMode === 'point' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.sectionTitle}>📍 Distance maximum</Text>
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
                                        setMaxDistance(Math.min(100, maxDistance + 5));
                                    }}
                                >
                                    <SafeIcon name="plus" size={18} color="#FFFFFF" type="lucide" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Bouton recherche */}
                    <TouchableOpacity
                        onPress={handleSearch}
                        disabled={loading}
                        style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                        activeOpacity={0.8}
                    >
                        <View style={styles.searchButtonContent}>
                            <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchButtonText}>
                                {loading ? 'Recherche en cours...' : 'Lancer la recherche'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#1E40AF" type="lucide" />
                        <Text style={styles.infoTitle}>{t('immobilierSearch.bonASavoir')}</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • La recherche par zone permet de délimiter précisément votre zone d'intérêt{'\n'}
                        • Comparez les prix par quartier pour trouver les meilleures opportunités{'\n'}
                        • Les alertes prix vous notifient quand un bien correspond à vos critères{'\n'}
                        • Vérifiez les photos et visites virtuelles avant de réserver une visite
                    </Text>
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal || showZoneSelector}
                onClose={() => {
                    setShowGPSModal(false);
                    setShowZoneSelector(false);
                }}
                onSelect={handleGPSSelect}
                initialCoordinates={searchMode === 'zone' ? searchZone : gpsString}
                allowZoneSelection={searchMode === 'zone'}
                title={searchMode === 'zone' ? t('immobilierSearchScreen.delimiterUneZoneDeRecherche') : t('immobilierSearchScreen.selectionnerUnPointGps')}
            />

            {/* ✅ NOUVEAU: Modal fonctionnalités IA */}
            <RealEstateAIFeatures
                visible={showAIFeatures}
                onClose={() => setShowAIFeatures(false)}
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
    input: {
        marginBottom: 12,
    },
    halfInput: {
        flex: 1,
        marginRight: 8,
    },
    row: {
        flexDirection: 'row',
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
    searchButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1E40AF',
        paddingVertical: 16,
    },
    searchButtonDisabled: {
        opacity: 0.6,
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
    // ✅ NOUVEAU: Styles pour bannière fonctionnalités IA
    aiFeaturesBanner: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    aiFeaturesBannerGradient: {
        padding: 16,
    },
    aiFeaturesBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    aiFeaturesBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiFeaturesBannerText: {
        flex: 1,
    },
    aiFeaturesBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    aiFeaturesBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
    },
    modeSelector: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        gap: 6,
    },
    modeButtonActive: {
        backgroundColor: '#1E40AF',
        borderColor: '#1E40AF',
    },
    modeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E40AF',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    zoneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    zoneButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    zoneInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 12,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
        gap: 8,
    },
    zoneInfoText: {
        fontSize: 14,
        color: '#065F46',
        fontWeight: '500',
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
    },
    quartiersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    quartierChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        gap: 6,
    },
    quartierChipActive: {
        backgroundColor: '#1E40AF',
        borderColor: '#1E40AF',
    },
    quartierChipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    quartierChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    selectedQuartiersInfo: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#DBEAFE',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#93C5FD',
    },
    selectedQuartiersText: {
        fontSize: 14,
        color: '#1E3A8A',
        fontWeight: '600',
    },
});

export default ImmobilierSearchScreen;

