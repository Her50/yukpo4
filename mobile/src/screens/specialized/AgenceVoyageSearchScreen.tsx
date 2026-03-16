// ✅ Écran de recherche d'agences de voyage (Mobile) - VERSION REFONDUE
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface AgenceVoyageSearchFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    destination?: string;
    compagnie_bus?: string;
    available_only?: boolean;
    // ✅ NOUVEAU: Filtres tickets bus
    search_tickets?: boolean; // Activer recherche tickets
    date_depart?: string; // Date de départ
    heure_depart?: string; // Heure de départ
    ville_depart?: string; // Ville de départ
    ville_arrivee?: string; // Ville d'arrivée
    compagnie_bus_filter?: string; // Filtre par compagnie de bus
}

const AgenceVoyageSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [destination, setDestination] = useState('');
    const [compagnieBus, setCompagnieBus] = useState('');
    const [compagnieBusFilter, setCompagnieBusFilter] = useState(''); // Pour filtres tickets bus
    const [availableOnly, setAvailableOnly] = useState(true);
    const [loading, setLoading] = useState(false);
    // ✅ NOUVEAU: Mode recherche (agences vs tickets)
    const [searchMode, setSearchMode] = useState<'agences' | 'tickets'>('agences');
    const [dateDepart, setDateDepart] = useState('');
    const [heureDepart, setHeureDepart] = useState('');
    const [villeDepart, setVilleDepart] = useState<LocationObject | string>('');
    const [villeArrivee, setVilleArrivee] = useState<LocationObject | string>('');

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
        // ✅ RÉORIENTÉ: Priorité sur recherche de tickets bus plutôt que d'agences
        // Mode tickets bus (PRIORITAIRE)
        if (searchMode === 'tickets') {
            const villeDepartStr = typeof villeDepart === 'string' ? villeDepart : (villeDepart as LocationObject)?.components?.ville || (villeDepart as LocationObject)?.place_name || '';
            const villeArriveeStr = typeof villeArrivee === 'string' ? villeArrivee : (villeArrivee as LocationObject)?.components?.ville || (villeArrivee as LocationObject)?.place_name || '';

            if (!villeDepartStr.trim() || !villeArriveeStr.trim()) {
                Alert.alert('Erreur', 'Veuillez renseigner la ville de départ et d\'arrivée');
                return;
            }

            const filters: AgenceVoyageSearchFilters = {
                search_tickets: true,
                ville_depart: villeDepartStr.trim(),
                ville_arrivee: villeArriveeStr.trim(),
            };
            if (dateDepart.trim()) filters.date_depart = dateDepart.trim();
            if (heureDepart.trim()) filters.heure_depart = heureDepart.trim();
            if (compagnieBusFilter.trim()) filters.compagnie_bus_filter = compagnieBusFilter.trim();
            if (gpsData) {
                filters.lat = gpsData.lat;
                filters.lng = gpsData.lng;
            }
            if (maxDistance > 0) filters.max_distance_km = maxDistance;

            // Navigation vers recherche tickets
            navigation.navigate('BusTicketSearch' as never, { filters } as never);
            return;
        }

        // Sinon, recherche classique d'agences (secondaire)
        // GPS ou localisation optionnelle
        const filters: AgenceVoyageSearchFilters = {};
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

    // ✅ AMÉLIORÉ: Recherches rapides avec mode tickets
    const quickSearches = [
        {
            id: 'proche',
            title: 'Plus proche',
            icon: 'map-pin',
            description: t('agenceVoyageSearch.aProximite'),
            action: () => {
                hapticPress();
                setSearchMode('agences');
                setMaxDistance(15);
                setAvailableOnly(true);
            }
        },
        {
            id: 'tickets',
            title: t('agenceVoyageSearchScreen.rechercherTickets'),
            icon: 'ticket',
            description: 'Billets de bus',
            action: () => {
                hapticPress();
                setSearchMode('tickets');
            }
        },
        {
            id: 'mes_tickets',
            title: t('agenceVoyageSearch.mesTickets'),
            icon: 'file-text',
            description: t('agenceVoyageSearchScreen.voirMesBillets'),
            action: () => {
                hapticPress();
                navigation.navigate('MyBusTickets' as never);
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient violet (voyage) */}
            <LinearGradient
                colors={['#8B5CF6', '#A78BFA']}
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
                            <SafeIcon name="plane" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>{t('agenceVoyageSearch.rechercherUneAgenceDeVoyage')}</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez l'agence idéale pour organiser votre voyage
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAwareScreen
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ NOUVEAU: Sélecteur de mode */}
                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            searchMode === 'agences' && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            hapticPress();
                            setSearchMode('agences');
                        }}
                    >
                        <SafeIcon
                            name="building"
                            size={18}
                            color={searchMode === 'agences' ? '#FFFFFF' : '#8B5CF6'}
                            type="lucide"
                        />
                        <Text style={[
                            styles.modeButtonText,
                            searchMode === 'agences' && styles.modeButtonTextActive
                        ]}>
                            Agences
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            searchMode === 'tickets' && styles.modeButtonActive
                        ]}
                        onPress={() => {
                            hapticPress();
                            setSearchMode('tickets');
                        }}
                    >
                        <SafeIcon
                            name="ticket"
                            size={18}
                            color={searchMode === 'tickets' ? '#FFFFFF' : '#8B5CF6'}
                            type="lucide"
                        />
                        <Text style={[
                            styles.modeButtonText,
                            searchMode === 'tickets' && styles.modeButtonTextActive
                        ]}>
                            Tickets Bus
                        </Text>
                    </TouchableOpacity>
                </View>

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
                                        color="#8B5CF6"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ✅ RÉORIENTÉ: Formulaire de recherche - Priorité sur tickets bus */}
                <View style={styles.searchFormCard}>
                    {searchMode === 'tickets' ? (
                        <>
                            <Text style={styles.sectionTitle}>{t('agenceVoyageSearch.rechercheDeTicketsBus')}/Text>
                            <Text style={styles.sectionDescription}>
                                Recherchez des tickets de bus pour votre trajet. Les villes de départ et d'arrivée sont obligatoires.
                            </Text>

                            {/* Ville de départ - OBLIGATOIRE */}
                            <View style={styles.inputGroup}>
                                <LocationSelector
                                    label={t('agenceVoyageSearch.villeDeDepart')}
                                    value={typeof villeDepart === 'string' ? (villeDepart ? { raw: villeDepart, place_name: villeDepart } : '') : villeDepart}
                                    onSelect={(location: LocationObject) => {
                                        setVilleDepart(location);
                                    }}
                                    placeholder={t('agenceVoyageSearch.lieuDeDepartVilleQuartier')}
                                    scope="all"
                                    enrichWithBackend={true}
                                    required={true}
                                />
                                {!villeDepart && (
                                    <Text style={styles.requiredHint}>Ce champ est obligatoire</Text>
                                )}
                            </View>

                            {/* Ville d'arrivée - OBLIGATOIRE */}
                            <View style={styles.inputGroup}>
                                <LocationSelector
                                    label={t('agenceVoyageSearch.villeD')}arrivée *"
                                    value={typeof villeArrivee === 'string' ? (villeArrivee ? { raw: villeArrivee, place_name: villeArrivee } : '') : villeArrivee}
                                    onSelect={(location: LocationObject) => {
                                        setVilleArrivee(location);
                                    }}
                                    placeholder={t('agenceVoyageSearchScreen.lieuD')}arrivée (ville, quartier, gare...)"
                                    scope="all"
                                    enrichWithBackend={true}
                                    required={true}
                                />
                                {!villeArrivee && (
                                    <Text style={styles.requiredHint}>Ce champ est obligatoire</Text>
                                )}
                            </View>

                            {/* Date départ */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="calendar" size={14} color={modernColors.primary} type="lucide" />{t('agenceVoyageSearchScreen.dateDeDepartOptionnel')}
                                </Text>
                                <NativeInput
                                    value={dateDepart}
                                    onChangeText={setDateDepart}
                                    placeholder="JJ/MM/AAAA"
                                />
                            </View>

                            {/* Heure départ */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="clock" size={14} color={modernColors.primary} type="lucide" />{t('agenceVoyageSearchScreen.heureDeDepartOptionnel')}
                                </Text>
                                <NativeInput
                                    value={heureDepart}
                                    onChangeText={setHeureDepart}
                                    placeholder="HH:MM"
                                />
                            </View>

                            {/* Compagnie bus */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" /> Compagnie de bus (optionnel)
                                </Text>
                                <NativeInput
                                    value={compagnieBusFilter}
                                    onChangeText={setCompagnieBusFilter}
                                    placeholder="Ex: Amour Mezam, Guarantee Express"
                                />
                            </View>

                            {/* Localisation GPS (optionnelle pour tickets) */}
                            <Text style={styles.sectionTitle}>{t('agenceVoyageSearch.localisationOptionnelle')}/Text>
                            <Text style={styles.sectionDescription}>
                                Ajoutez votre position pour trouver des tickets à proximité
                            </Text>

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
                                        {gpsString || 'Utiliser ma position GPS (optionnel)'}
                                    </Text>
                                    <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            </View>

                            {/* Distance max */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="maximize-2" size={14} color={modernColors.primary} type="lucide" /> Distance maximale (optionnel)
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
                        </>
                    ) : (
                        <>
                            <Text style={styles.sectionTitle}>{t('agenceVoyageSearch.localisationOptionnelle')}/Text>
                            <Text style={styles.sectionDescription}>
                                Recherchez des agences de voyage à proximité
                            </Text>

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
                                        {gpsString || 'Utiliser ma position GPS (optionnel)'}
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

                            {/* Destination */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="map" size={14} color={modernColors.primary} type="lucide" />{t('agenceVoyageSearchScreen.destinationRechercheeOptionnel')}
                                </Text>
                                <NativeInput
                                    value={destination}
                                    onChangeText={setDestination}
                                    placeholder="Ex: Bafoussam, Buea"
                                />
                            </View>

                            {/* Compagnie bus */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" /> Compagnie de bus (optionnel)
                                </Text>
                                <NativeInput
                                    value={compagnieBus}
                                    onChangeText={setCompagnieBus}
                                    placeholder="Ex: Amour Mezam, Guarantee Express"
                                />
                            </View>
                        </>
                    )}

                    {/* Options */}
                    <View style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>{t('agenceVoyageSearch.optionsDeRecherche')}/Text>

                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="check-circle" size={20} color="#10B981" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Disponibles maintenant</Text>
                                    <Text style={styles.optionDescription}>
                                        Afficher seulement les agences ouvertes actuellement
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
                    <TouchableOpacity
                        onPress={handleSearch}
                        disabled={loading || (searchMode === 'tickets' && (!villeDepart || !villeArrivee))}
                        style={[
                            styles.searchButton,
                            (loading || (searchMode === 'tickets' && (!villeDepart || !villeArrivee))) && styles.searchButtonDisabled
                        ]}
                        activeOpacity={0.8}
                    >
                        <View style={styles.searchButtonContent}>
                            <SafeIcon name={searchMode === 'tickets' ? "ticket" : "search"} size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchButtonText}>
                                {loading
                                    ? 'Recherche en cours...'
                                    : searchMode === 'tickets'
                                        ? 'Rechercher des tickets'
                                        : 'Lancer la recherche'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#8B5CF6" type="lucide" />
                        <Text style={styles.infoTitle}>{t('agenceVoyageSearch.bonASavoir')}</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Les agences de voyage proposent des packages complets (transport + hébergement){'\n'}
                        • Vérifiez les horaires d'ouverture avant de vous déplacer{'\n'}
                        • Comparez les prix et services entre différentes agences{'\n'}
                        • Certaines agences proposent des réservations en ligne
                    </Text>
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
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
    sectionDescription: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 18,
    },
    requiredHint: {
        fontSize: 12,
        color: '#DC2626',
        marginTop: 4,
        fontStyle: 'italic',
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
        backgroundColor: '#EDE9FE',
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
        backgroundColor: '#8B5CF6',
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
        backgroundColor: '#8B5CF6',
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
        backgroundColor: '#F5F3FF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#DDD6FE',
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
        color: '#6B21A8',
    },
    infoText: {
        fontSize: 13,
        color: '#6B21A8',
        lineHeight: 20,
    },
    // ✅ NOUVEAU: Styles pour sélecteur de mode
    modeSelector: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    modeButtonActive: {
        backgroundColor: '#8B5CF6',
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
});

export default AgenceVoyageSearchScreen;

