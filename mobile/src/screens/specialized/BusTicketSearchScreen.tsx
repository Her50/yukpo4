import DateTimePicker from '@react-native-community/datetimepicker';
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
import CityAutocomplete from '../../components/CityAutocomplete';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import SearchFiltersComponent, { SearchFilters } from '../../components/SearchFilters';
import SkeletonCard from '../../components/SkeletonCard';
import { useLocation } from '../../contexts/LocationContext';
import { trackSearch } from '../../services/analytics';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { measureScreenLoad } from '../../utils/metrics';

interface BusTicketResult {
    product_id: string;
    agency_nom: string;
    agency_ville?: string;
    agency_telephone?: string;
    product_name: string;
    bus_number?: string;
    departure_city?: string;
    arrival_city?: string;
    departure_date?: string;
    departure_time?: string;
    ticket_price?: number;
    available_seats: number;
    distance_km?: number;
}

const BusTicketSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    // Mesurer le temps de chargement
    React.useEffect(() => {
        const endMeasure = measureScreenLoad('BusTicketSearchScreen');
        return endMeasure;
    }, []);

    const [departureCity, setDepartureCity] = useState('');
    const [arrivalCity, setArrivalCity] = useState('');
    const [departureDate, setDepartureDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BusTicketResult[]>([]);
    // ✅ NOUVEAU: Options aller-retour
    const [isRoundTrip, setIsRoundTrip] = useState(false);
    const [returnDate, setReturnDate] = useState(new Date());
    const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);
    const [returnTime, setReturnTime] = useState('');

    // ✅ NOUVEAU: Filtres et tri
    const [filters, setFilters] = useState<SearchFilters>({
        minPrice: null,
        maxPrice: null,
        timeRange: null,
        company: null,
        sortBy: 'price',
        sortOrder: 'asc',
    });
    const [showFilters, setShowFilters] = useState(false);

    const handleSearch = async () => {
        if (!departureCity.trim() || !arrivalCity.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner la ville de départ et d\'arrivée');
            return;
        }

        // Track search event
        trackSearch(departureCity.trim(), arrivalCity.trim(), {
            is_round_trip: isRoundTrip,
            has_filters: filters.minPrice !== null || filters.maxPrice !== null || filters.timeRange !== null,
            sort_by: filters.sortBy,
        });

        try {
            setLoading(true);
            const dateStr = departureDate.toISOString().split('T')[0]; // YYYY-MM-DD

            const params = new URLSearchParams({
                departure_city: departureCity.trim(),
                arrival_city: arrivalCity.trim(),
                departure_date: dateStr,
                ...(location?.coords && {
                    user_lat: location.coords.latitude.toString(),
                    user_lng: location.coords.longitude.toString(),
                }),
                radius_km: '100',
                min_seats: '1',
                // ✅ NOUVEAU: Ajouter filtres
                ...(filters.minPrice && { min_price: filters.minPrice.toString() }),
                ...(filters.maxPrice && { max_price: filters.maxPrice.toString() }),
                ...(filters.timeRange && { time_range: filters.timeRange }),
                ...(filters.company && { company: filters.company }),
                sort_by: filters.sortBy,
                sort_order: filters.sortOrder,
            });

            const response = await apiGet(`/api/bus-tickets/search?${params.toString()}`);

            if (response.results) {
                // ✅ NOUVEAU: Appliquer tri côté client si nécessaire
                let sortedResults = [...response.results];
                if (filters.sortBy === 'price') {
                    sortedResults.sort((a, b) => {
                        const priceA = a.ticket_price || 0;
                        const priceB = b.ticket_price || 0;
                        return filters.sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
                    });
                } else if (filters.sortBy === 'time') {
                    sortedResults.sort((a, b) => {
                        const timeA = a.departure_time || '';
                        const timeB = b.departure_time || '';
                        return filters.sortOrder === 'asc'
                            ? timeA.localeCompare(timeB)
                            : timeB.localeCompare(timeA);
                    });
                }

                setResults(sortedResults);
                if (sortedResults.length === 0) {
                    Alert.alert('Aucun résultat', 'Aucun trajet trouvé pour cette recherche');
                }
            } else {
                Alert.alert('Erreur', 'Impossible de rechercher les tickets');
            }
        } catch (error: any) {
            console.error('[BusTicketSearchScreen] Erreur recherche:', error);
            Alert.alert('Erreur', error.message || 'Impossible de rechercher les tickets');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatTime = (timeStr?: string) => {
        if (!timeStr) return '';
        return timeStr.substring(0, 5); // HH:MM
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix non disponible';
        return `${price.toLocaleString('fr-FR')} FCFA`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher un trajet</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Formulaire de recherche */}
                <View style={styles.searchForm}>
                    <View style={styles.inputGroup}>
                        <CityAutocomplete
                            label="Ville de départ *"
                            value={departureCity}
                            onChangeText={setDepartureCity}
                            onSelect={(city) => {
                                setDepartureCity(city.main_text);
                            }}
                            placeholder="Ex: Yaoundé"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <CityAutocomplete
                            label="Ville d'arrivée *"
                            value={arrivalCity}
                            onChangeText={setArrivalCity}
                            onSelect={(city) => {
                                setArrivalCity(city.main_text);
                            }}
                            placeholder="Ex: Douala"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date de départ</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                            <Text style={styles.dateButtonText}>{formatDate(departureDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={departureDate}
                            mode="date"
                            display="default"
                            minimumDate={new Date()}
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) {
                                    setDepartureDate(selectedDate);
                                }
                            }}
                        />
                    )}

                    {/* ✅ NOUVEAU: Option Aller-Retour */}
                    <View style={styles.inputGroup}>
                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setIsRoundTrip(!isRoundTrip)}
                        >
                            <SafeIcon
                                name={isRoundTrip ? "check-square" : "square"}
                                size={24}
                                color={isRoundTrip ? modernColors.primary : "#9CA3AF"}
                            />
                            <Text style={styles.checkboxLabel}>Aller-Retour</Text>
                        </TouchableOpacity>
                    </View>

                    {isRoundTrip && (
                        <>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Date de retour</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowReturnDatePicker(true)}
                                >
                                    <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                                    <Text style={styles.dateButtonText}>{formatDate(returnDate)}</Text>
                                </TouchableOpacity>
                            </View>

                            {showReturnDatePicker && (
                                <DateTimePicker
                                    value={returnDate}
                                    mode="date"
                                    display="default"
                                    minimumDate={departureDate}
                                    onChange={(event, selectedDate) => {
                                        setShowReturnDatePicker(false);
                                        if (selectedDate) {
                                            setReturnDate(selectedDate);
                                        }
                                    }}
                                />
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Heure de retour (optionnel)</Text>
                                <NativeInput
                                    value={returnTime}
                                    onChangeText={setReturnTime}
                                    placeholder="HH:MM (ex: 14:30)"
                                    keyboardType="default"
                                />
                            </View>
                        </>
                    )}

                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.filtersButton}
                            onPress={() => setShowFilters(true)}
                        >
                            <SafeIcon name="filter" size={20} color={modernColors.primary} />
                            <Text style={styles.filtersButtonText}>Filtres</Text>
                            {(filters.minPrice || filters.maxPrice || filters.timeRange || filters.company) && (
                                <View style={styles.filtersBadge}>
                                    <Text style={styles.filtersBadgeText}>!</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <NativeButton
                            title={loading ? 'Recherche...' : 'Rechercher'}
                            onPress={handleSearch}
                            disabled={loading || !departureCity.trim() || !arrivalCity.trim()}
                            variant="primary"
                            size="large"
                            style={styles.searchButton}
                        />
                    </View>
                </View>

                {/* Résultats */}
                {loading && (
                    <View style={styles.resultsContainer}>
                        <SkeletonCard count={3} />
                    </View>
                )}

                {!loading && results.length > 0 && (
                    <View style={styles.resultsContainer}>
                        <Text style={styles.resultsTitle}>
                            {results.length} trajet(s) trouvé(s)
                        </Text>

                        {results.map((result) => (
                            <TouchableOpacity
                                key={result.product_id}
                                style={styles.resultCard}
                                onPress={() => {
                                    navigation.navigate('BusTicketBooking' as never, {
                                        productId: result.product_id,
                                        ticketData: result,
                                        isRoundTrip,
                                        returnDate: isRoundTrip ? returnDate.toISOString().split('T')[0] : undefined,
                                        returnTime: isRoundTrip ? returnTime : undefined,
                                    } as never);
                                }}
                            >
                                <View style={styles.resultHeader}>
                                    <View style={styles.resultHeaderLeft}>
                                        <Text style={styles.agencyName}>{result.agency_nom}</Text>
                                        {result.bus_number && (
                                            <Text style={styles.busNumber}>Bus #{result.bus_number}</Text>
                                        )}
                                    </View>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.price}>{formatPrice(result.ticket_price)}</Text>
                                    </View>
                                </View>

                                <View style={styles.routeContainer}>
                                    <View style={styles.cityContainer}>
                                        <View style={styles.cityDot} />
                                        <View style={styles.cityInfo}>
                                            <Text style={styles.cityName}>
                                                {result.departure_city || 'Départ'}
                                            </Text>
                                            <Text style={styles.time}>
                                                {formatTime(result.departure_time)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.routeLine} />

                                    <View style={styles.cityContainer}>
                                        <View style={[styles.cityDot, styles.cityDotArrival]} />
                                        <View style={styles.cityInfo}>
                                            <Text style={styles.cityName}>
                                                {result.arrival_city || 'Arrivée'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.resultFooter}>
                                    <View style={styles.seatsInfo}>
                                        <SafeIcon name="users" size={16} color="#6B7280" />
                                        <Text style={styles.seatsText}>
                                            {result.available_seats} place(s) disponible(s)
                                        </Text>
                                    </View>
                                    {result.distance_km && (
                                        <Text style={styles.distanceText}>
                                            📍 {result.distance_km.toFixed(1)} km
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Modal Filtres */}
            <SearchFiltersComponent
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                filters={filters}
                onApply={(newFilters) => {
                    setFilters(newFilters);
                    // Relancer la recherche avec les nouveaux filtres
                    if (departureCity.trim() && arrivalCity.trim()) {
                        handleSearch();
                    }
                }}
                companies={Array.from(new Set(results.map(r => r.agency_nom)))}
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
        fontWeight: '700',
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
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dateButtonText: {
        fontSize: 14,
        color: '#111827',
        flex: 1,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    filtersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#fff',
        position: 'relative',
    },
    filtersButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    filtersBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filtersBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    searchButton: {
        flex: 1,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    resultsContainer: {
        marginTop: 8,
    },
    resultsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    resultCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    resultHeaderLeft: {
        flex: 1,
    },
    agencyName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    busNumber: {
        fontSize: 12,
        color: '#6B7280',
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    price: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    routeContainer: {
        marginBottom: 16,
    },
    cityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cityDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: modernColors.primary,
    },
    cityDotArrival: {
        backgroundColor: '#10B981',
    },
    cityInfo: {
        flex: 1,
    },
    cityName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    time: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    routeLine: {
        width: 2,
        height: 24,
        backgroundColor: '#E5E7EB',
        marginLeft: 5,
        marginVertical: 4,
    },
    resultFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    seatsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    seatsText: {
        fontSize: 12,
        color: '#6B7280',
    },
    distanceText: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default BusTicketSearchScreen;

