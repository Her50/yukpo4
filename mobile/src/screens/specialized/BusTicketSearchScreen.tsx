// ✅ Écran de recherche de tickets bus (Mobile) - VERSION REFONDUE
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import CityAutocomplete from '../../components/CityAutocomplete';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import SearchFiltersComponent, { SearchFilters } from '../../components/SearchFilters';
import SkeletonCard from '../../components/SkeletonCard';
import { useLocation } from '../../contexts/LocationContext';
import { trackSearch } from '../../services/analytics';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
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
            const backendData = (response?.data || response) as any;

            if (backendData?.results) {
                // ✅ NOUVEAU: Appliquer tri côté client si nécessaire
                let sortedResults = [...backendData.results];
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

    // Recherches rapides spécifiques bus
    const quickSearches = [
        {
            id: 'aujourdhui',
            title: "Aujourd'hui",
            icon: 'calendar',
            description: 'Départ aujourd\'hui',
            action: () => {
                hapticPress();
                setDepartureDate(new Date());
            }
        },
        {
            id: 'demain',
            title: 'Demain',
            icon: 'calendar-days',
            description: 'Départ demain',
            action: () => {
                hapticPress();
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setDepartureDate(tomorrow);
            }
        },
        {
            id: 'weekend',
            title: 'Week-end',
            icon: 'calendar-range',
            description: 'Ce week-end',
            action: () => {
                hapticPress();
                const today = new Date();
                const dayOfWeek = today.getDay();
                const daysUntilSaturday = 6 - dayOfWeek;
                const saturday = new Date(today);
                saturday.setDate(today.getDate() + daysUntilSaturday);
                setDepartureDate(saturday);
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient orange (transport public) */}
            <LinearGradient
                colors={['#F59E0B', '#FBBF24']}
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
                            <SafeIcon name="bus" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher un trajet</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez et réservez vos tickets de bus en quelques clics
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
                    <Text style={styles.sectionTitle}>\uD83D\uDD0D Recherches rapides</Text>
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
                                        color="#F59E0B"
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
                    <Text style={styles.sectionTitle}>\uD83D\uDCCD Recherche de trajet</Text>
                    {/* Ville de départ */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} type="lucide" /> Ville de départ *
                        </Text>
                        <CityAutocomplete
                            label=""
                            value={departureCity}
                            onChangeText={setDepartureCity}
                            onSelect={(city) => {
                                hapticPress();
                                setDepartureCity(city.main_text);
                            }}
                            placeholder="Ex: Yaoundé"
                        />
                    </View>

                    {/* Ville d'arrivée */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="navigation" size={14} color={modernColors.primary} type="lucide" /> Ville d'arrivée *
                        </Text>
                        <CityAutocomplete
                            label=""
                            value={arrivalCity}
                            onChangeText={setArrivalCity}
                            onSelect={(city) => {
                                hapticPress();
                                setArrivalCity(city.main_text);
                            }}
                            placeholder="Ex: Douala"
                        />
                    </View>

                    {/* Date de départ */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="calendar" size={14} color={modernColors.primary} type="lucide" /> Date de départ
                        </Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => {
                                hapticPress();
                                setShowDatePicker(true);
                            }}
                        >
                            <SafeIcon name="calendar" size={20} color="#F59E0B" type="lucide" />
                            <Text style={styles.dateButtonText}>{formatDate(departureDate)}</Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
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

                    {/* Option Aller-Retour */}
                    <View style={styles.inputGroup}>
                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="rotate-ccw" size={20} color="#F59E0B" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Aller-Retour</Text>
                                    <Text style={styles.optionDescription}>
                                        Réserver un trajet aller et retour
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={isRoundTrip}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setIsRoundTrip(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>

                    {isRoundTrip && (
                        <>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="calendar" size={14} color={modernColors.primary} type="lucide" /> Date de retour
                                </Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => {
                                        hapticPress();
                                        setShowReturnDatePicker(true);
                                    }}
                                >
                                    <SafeIcon name="calendar" size={20} color="#F59E0B" type="lucide" />
                                    <Text style={styles.dateButtonText}>{formatDate(returnDate)}</Text>
                                    <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            </View>

                            {showReturnDatePicker && (
                                <DateTimePicker
                                    value={returnDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    minimumDate={departureDate}
                                    onChange={(event, selectedDate) => {
                                        setShowReturnDatePicker(Platform.OS === 'ios');
                                        if (selectedDate) {
                                            setReturnDate(selectedDate);
                                        }
                                    }}
                                />
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="clock" size={14} color={modernColors.primary} type="lucide" /> Heure de retour (optionnel)
                                </Text>
                                <NativeInput
                                    value={returnTime}
                                    onChangeText={setReturnTime}
                                    placeholder="HH:MM (ex: 14:30)"
                                    keyboardType="default"
                                />
                            </View>
                        </>
                    )}

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.filtersButton}
                            onPress={() => {
                                hapticPress();
                                setShowFilters(true);
                            }}
                        >
                            <SafeIcon name="filter" size={18} color="#F59E0B" type="lucide" />
                            <Text style={styles.filtersButtonText}>Filtres</Text>
                            {(filters.minPrice || filters.maxPrice || filters.timeRange || filters.company) && (
                                <View style={styles.filtersBadge}>
                                    <Text style={styles.filtersBadgeText}>!</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <NativeButton
                            onPress={handleSearch}
                            disabled={loading || !departureCity.trim() || !arrivalCity.trim()}
                            style={styles.searchButton}
                        >
                            <View style={styles.searchButtonContent}>
                                <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                                <Text style={styles.searchButtonText}>
                                    {loading ? 'Recherche...' : 'Rechercher'}
                                </Text>
                            </View>
                        </NativeButton>
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
                                            \uD83D\uDCCD {result.distance_km.toFixed(1)} km
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Info section */}
                {!loading && results.length === 0 && (
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <SafeIcon name="info" size={20} color="#F59E0B" type="lucide" />
                            <Text style={styles.infoTitle}>\uD83D\uDCA1 Bon à savoir</Text>
                        </View>
                        <Text style={styles.infoText}>
                            • Réservez vos tickets à l'avance pour garantir votre place{'\n'}
                            • Les prix peuvent varier selon la période et la disponibilité{'\n'}
                            • Vérifiez les horaires de départ avant de réserver{'\n'}
                            • L'option aller-retour permet d'économiser sur les trajets réguliers
                        </Text>
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
        backgroundColor: '#FEF3C7',
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
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    dateButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
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
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    filtersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#F59E0B',
        backgroundColor: '#FFFFFF',
        position: 'relative',
    },
    filtersButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F59E0B',
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
        backgroundColor: '#FFFBEB',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginTop: 16,
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
        color: '#92400E',
    },
    infoText: {
        fontSize: 13,
        color: '#92400E',
        lineHeight: 20,
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

