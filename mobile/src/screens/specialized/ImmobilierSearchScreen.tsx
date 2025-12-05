// ✅ Écran de recherche de biens immobiliers
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';

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

    const [ville, setVille] = useState('');
    const [quartier, setQuartier] = useState('');
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
            setGpsString('Zone délimitée');
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
        if (searchMode === 'point' && !ville.trim() && !quartier.trim() && !gpsData) {
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
            if (ville.trim()) filters.ville = ville.trim();
            if (quartier.trim()) filters.quartier = quartier.trim();
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
    const statuts = ['À vendre', 'À louer (bail)', 'À louer meublé', 'Location courte durée', 'Colocation'];
    const standings = ['Économique', 'Standard', 'Bon standing', 'Haut standing', 'Luxe / Prestige'];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher un bien immobilier</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Mode de recherche */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔍 Mode de recherche</Text>
                    <View style={styles.modeSelector}>
                        <TouchableOpacity
                            style={[styles.modeButton, searchMode === 'point' && styles.modeButtonActive]}
                            onPress={() => setSearchMode('point')}
                        >
                            <SafeIcon name="map-pin" size={18} color={searchMode === 'point' ? '#fff' : modernColors.primary} />
                            <Text style={[styles.modeButtonText, searchMode === 'point' && styles.modeButtonTextActive]}>
                                Point GPS
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeButton, searchMode === 'zone' && styles.modeButtonActive]}
                            onPress={() => {
                                setSearchMode('zone');
                                setShowZoneSelector(true);
                            }}
                        >
                            <SafeIcon name="map" size={18} color={searchMode === 'zone' ? '#fff' : modernColors.primary} />
                            <Text style={[styles.modeButtonText, searchMode === 'zone' && styles.modeButtonTextActive]}>
                                Zone carte
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeButton, searchMode === 'quartiers' && styles.modeButtonActive]}
                            onPress={() => setSearchMode('quartiers')}
                        >
                            <SafeIcon name="layers" size={18} color={searchMode === 'quartiers' ? '#fff' : modernColors.primary} />
                            <Text style={[styles.modeButtonText, searchMode === 'quartiers' && styles.modeButtonTextActive]}>
                                Quartiers
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Localisation selon le mode */}
                {searchMode === 'point' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📍 Localisation</Text>
                        <NativeInput
                            placeholder="Ville (ex: Douala, Yaoundé)"
                            value={ville}
                            onChangeText={setVille}
                            style={styles.input}
                        />
                        <NativeInput
                            placeholder="Quartier (ex: Akwa, Bonanjo)"
                            value={quartier}
                            onChangeText={setQuartier}
                            style={styles.input}
                        />
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => {
                                setShowGPSModal(true);
                            }}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {gpsString || 'Sélectionner un point GPS'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {searchMode === 'zone' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🗺️ Zone de recherche</Text>
                        <TouchableOpacity
                            style={styles.zoneButton}
                            onPress={() => setShowZoneSelector(true)}
                        >
                            <SafeIcon name="map" size={20} color={modernColors.primary} />
                            <Text style={styles.zoneButtonText}>
                                {searchZone ? 'Zone délimitée (modifier)' : 'Délimiter une zone sur la carte'}
                            </Text>
                        </TouchableOpacity>
                        {searchZone && (
                            <View style={styles.zoneInfo}>
                                <SafeIcon name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.zoneInfoText}>
                                    Zone configurée ({searchZone.split('|').length} points)
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {searchMode === 'quartiers' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🏘️ Sélectionner des quartiers</Text>
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
                                    onPress={() => handleQuartierToggle(q)}
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
                                        <SafeIcon name="check" size={14} color="#fff" />
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
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🏠 Type de bien</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                        {typesBiens.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.chip, typeBien === type && styles.chipActive]}
                                onPress={() => setTypeBien(typeBien === type ? '' : type)}
                            >
                                <Text style={[styles.chipText, typeBien === type && styles.chipTextActive]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💰 Statut</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                        {statuts.map((s) => (
                            <TouchableOpacity
                                key={s}
                                style={[styles.chip, statut === s && styles.chipActive]}
                                onPress={() => setStatut(statut === s ? '' : statut)}
                            >
                                <Text style={[styles.chipText, statut === s && styles.chipTextActive]}>
                                    {s}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Prix */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💵 Prix</Text>
                    <View style={styles.row}>
                        <NativeInput
                            placeholder="Prix min (FCFA)"
                            value={prixMin}
                            onChangeText={setPrixMin}
                            keyboardType="numeric"
                            style={[styles.input, styles.halfInput]}
                        />
                        <NativeInput
                            placeholder="Prix max (FCFA)"
                            value={prixMax}
                            onChangeText={setPrixMax}
                            keyboardType="numeric"
                            style={[styles.input, styles.halfInput]}
                        />
                    </View>
                </View>

                {/* Superficie */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📐 Superficie</Text>
                    <View style={styles.row}>
                        <NativeInput
                            placeholder="Min (m²)"
                            value={superficieMin}
                            onChangeText={setSuperficieMin}
                            keyboardType="numeric"
                            style={[styles.input, styles.halfInput]}
                        />
                        <NativeInput
                            placeholder="Max (m²)"
                            value={superficieMax}
                            onChangeText={setSuperficieMax}
                            keyboardType="numeric"
                            style={[styles.input, styles.halfInput]}
                        />
                    </View>
                </View>

                {/* Caractéristiques */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🏡 Caractéristiques</Text>
                    <NativeInput
                        placeholder="Nombre de chambres minimum"
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
                                onPress={() => setStanding(standing === s ? '' : standing)}
                            >
                                <Text style={[styles.chipText, standing === s && styles.chipTextActive]}>
                                    {s}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Distance */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📍 Distance maximum</Text>
                    <Text style={styles.distanceText}>{maxDistance} km</Text>
                    <View style={styles.sliderContainer}>
                        <TouchableOpacity
                            style={styles.sliderButton}
                            onPress={() => setMaxDistance(Math.max(5, maxDistance - 5))}
                        >
                            <Text style={styles.sliderButtonText}>-</Text>
                        </TouchableOpacity>
                        <View style={styles.sliderTrack}>
                            <View style={[styles.sliderFill, { width: `${(maxDistance / 100) * 100}%` }]} />
                        </View>
                        <TouchableOpacity
                            style={styles.sliderButton}
                            onPress={() => setMaxDistance(Math.min(100, maxDistance + 5))}
                        >
                            <Text style={styles.sliderButtonText}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <NativeButton
                    title="🔍 Rechercher"
                    onPress={handleSearch}
                    style={styles.searchButton}
                    loading={loading}
                />
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal || showZoneSelector}
                onClose={() => {
                    setShowGPSModal(false);
                    setShowZoneSelector(false);
                }}
                onSelect={handleGPSSelect}
                initialCoordinates={searchMode === 'zone' ? searchZone : gpsString}
                allowZoneSelection={searchMode === 'zone'}
                title={searchMode === 'zone' ? 'Délimiter une zone de recherche' : 'Sélectionner un point GPS'}
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
        fontWeight: '700',
        color: '#111827',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
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
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginTop: 8,
    },
    gpsButtonText: {
        marginLeft: 8,
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '500',
    },
    chipsContainer: {
        flexDirection: 'row',
        marginTop: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
    },
    chipActive: {
        backgroundColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#6B7280',
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    distanceText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 8,
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sliderButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sliderButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    sliderTrack: {
        flex: 1,
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginHorizontal: 12,
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
    },
    searchButton: {
        marginTop: 24,
        marginBottom: 32,
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
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        gap: 6,
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    modeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    modeButtonTextActive: {
        color: '#fff',
    },
    zoneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginTop: 8,
    },
    zoneButtonText: {
        marginLeft: 12,
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    zoneInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
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
        gap: 6,
    },
    quartierChipActive: {
        backgroundColor: modernColors.primary,
    },
    quartierChipText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    quartierChipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    selectedQuartiersInfo: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    selectedQuartiersText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
});

export default ImmobilierSearchScreen;

