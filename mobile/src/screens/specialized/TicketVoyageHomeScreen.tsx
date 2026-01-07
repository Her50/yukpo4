// ✅ Écran Tickets de Voyage MODERNE - Refonte complète avec UX de niveau mondial
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { busTicketService, BusTicketSearchFilters, BusTicketSearchResult } from '../../services/busTicketService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'time_asc' | 'time_desc' | 'date_asc';

const TicketVoyageHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    
    // ✅ NOUVEAU: Détection automatique de devise depuis GPS
    const detectedCurrency = useCurrencyDetection();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [tickets, setTickets] = useState<BusTicketSearchResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);

    // États UI
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [showFilters, setShowFilters] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);

    // États de filtres
    const [filters, setFilters] = useState<BusTicketSearchFilters>({
        radius_km: 50,
        min_seats: 1,
    });
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);

    // États pour les champs de recherche
    const [departureCity, setDepartureCity] = useState<LocationObject | string>('');
    const [arrivalCity, setArrivalCity] = useState<LocationObject | string>('');
    const [departureDate, setDepartureDate] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [agencyName, setAgencyName] = useState('');

    const sortOptions: { value: SortOption; label: string; icon: string }[] = [
        { value: 'relevance', label: 'Pertinence', icon: 'star' },
        { value: 'price_asc', label: 'Prix croissant', icon: 'arrow-up' },
        { value: 'price_desc', label: 'Prix décroissant', icon: 'arrow-down' },
        { value: 'time_asc', label: 'Heure départ (tôt)', icon: 'clock' },
        { value: 'time_desc', label: 'Heure départ (tard)', icon: 'clock' },
        { value: 'date_asc', label: 'Date (proche)', icon: 'calendar' },
    ];

    // Quick filters (recherches rapides)
    const quickFilters = [
        { id: 'today', label: "Aujourd'hui", icon: 'calendar', date: getTodayDate() },
        { id: 'tomorrow', label: 'Demain', icon: 'calendar', date: getTomorrowDate() },
        { id: 'weekend', label: 'Week-end', icon: 'calendar' },
        { id: 'proche', label: 'Proche de moi', icon: 'map-pin', distance: 20 },
    ];

    function getTodayDate(): string {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    function getTomorrowDate(): string {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    }

    // Initialiser avec localisation GPS
    useEffect(() => {
        if (location?.coords) {
            setFilters(prev => ({
                ...prev,
                user_lat: location.coords.latitude,
                user_lng: location.coords.longitude,
            }));
        }
    }, [location]);

    // Charger les voyages disponibles à l'ouverture (sans filtres stricts)
    useEffect(() => {
        loadTickets(true);
    }, []);

    // Compter les filtres actifs
    useEffect(() => {
        let count = 0;
        if (filters.departure_city) count++;
        if (filters.arrival_city) count++;
        if (filters.departure_date) count++;
        if (filters.agency_name) count++;
        if (filters.min_seats && filters.min_seats > 1) count++;
        setActiveFiltersCount(count);
    }, [filters]);

    // Charger les tickets
    const loadTickets = useCallback(async (initialLoad: boolean = false) => {
        try {
            if (initialLoad) {
                setLoading(true);
                setError(null);
            }

            const searchFilters: BusTicketSearchFilters = {
                ...filters,
                departure_city: typeof departureCity === 'string' 
                    ? departureCity 
                    : (departureCity as LocationObject)?.components?.ville || (departureCity as LocationObject)?.place_name || undefined,
                arrival_city: typeof arrivalCity === 'string'
                    ? arrivalCity
                    : (arrivalCity as LocationObject)?.components?.ville || (arrivalCity as LocationObject)?.place_name || undefined,
                departure_date: departureDate || undefined,
                agency_name: agencyName || undefined,
            };

            // Si recherche textuelle, utiliser comme ville de départ par défaut
            if (searchQuery.trim() && !searchFilters.departure_city && !searchFilters.arrival_city) {
                searchFilters.departure_city = searchQuery.trim();
            }

            const response = await busTicketService.searchBusTickets(searchFilters);
            
            if (response.success && response.data?.results) {
                let results = response.data.results;
                
                // Limiter à 20 résultats pour l'affichage initial
                if (initialLoad && results.length > 20) {
                    results = results.slice(0, 20);
                }

                // Tri côté client
                if (sortBy !== 'relevance') {
                    results = [...results].sort((a, b) => {
                        switch (sortBy) {
                            case 'price_asc':
                                const priceA = a.ticket_price || 0;
                                const priceB = b.ticket_price || 0;
                                return priceA - priceB;
                            case 'price_desc':
                                const priceA2 = a.ticket_price || 0;
                                const priceB2 = b.ticket_price || 0;
                                return priceB2 - priceA2;
                            case 'time_asc':
                                const timeA = a.departure_time || '';
                                const timeB = b.departure_time || '';
                                return timeA.localeCompare(timeB);
                            case 'time_desc':
                                const timeA2 = a.departure_time || '';
                                const timeB2 = b.departure_time || '';
                                return timeB2.localeCompare(timeA2);
                            case 'date_asc':
                                const dateA = a.departure_date || '';
                                const dateB = b.departure_date || '';
                                return dateA.localeCompare(dateB);
                            default:
                                return 0;
                        }
                    });
                }
                
                setTickets(results);
                setTotalResults(results.length);
            } else {
                setError('Aucun ticket trouvé');
                setTickets([]);
            }
        } catch (err: any) {
            console.error('[TicketVoyageHomeScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
            setTickets([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters, departureCity, arrivalCity, departureDate, agencyName, searchQuery, sortBy]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadTickets(false);
    };

    const handleTicketPress = (ticket: BusTicketSearchResult) => {
        hapticPress();
        // Navigation vers détails du ticket
        (navigation as any).navigate('BusTicketDetails', {
            ticketId: ticket.product_id,
            agencyId: ticket.agency_id,
        });
    };

    const handleQuickFilter = (filter: typeof quickFilters[0]) => {
        hapticPress();
        if (filter.date) {
            setDepartureDate(filter.date);
        }
        if (filter.distance) {
            setFilters(prev => ({
                ...prev,
                radius_km: filter.distance,
            }));
        }
        loadTickets(false);
    };

    const clearFilters = () => {
        hapticPress();
        setFilters({
            radius_km: 50,
            min_seats: 1,
            user_lat: location?.coords?.latitude,
            user_lng: location?.coords?.longitude,
        });
        setDepartureCity('');
        setArrivalCity('');
        setDepartureDate('');
        setDepartureTime('');
        setAgencyName('');
        setSearchQuery('');
        loadTickets(false);
    };

    const handleSearch = () => {
        hapticPress();
        loadTickets(false);
    };

    const formatPrice = (price?: number, currency?: string) => {
        if (!price) return 'Prix sur demande';
        return `${price.toLocaleString()} ${currency || detectedCurrency}`; // ✅ Utilise la devise détectée
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        } catch {
            return dateStr;
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec recherche */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#8B5CF6', '#A78BFA']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>Tickets de Voyage</Text>
                            {totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {totalResults} voyage{totalResults > 1 ? 's' : ''} disponible{totalResults > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                setShowFilters(!showFilters);
                            }}
                            style={styles.filterButton}
                        >
                            <SafeIcon 
                                name="sliders-h" 
                                size={22} 
                                color="#FFFFFF" 
                                type="lucide" 
                            />
                            {activeFiltersCount > 0 && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche */}
                    <View style={styles.searchContainer}>
                        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher une ville, agence..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        handleSearch();
                                    }}
                                    style={styles.clearButton}
                                >
                                    <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </LinearGradient>

                {/* Quick filters */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickFiltersContainer}
                    style={styles.quickFiltersScroll}
                >
                    {quickFilters.map((filter) => (
                        <TouchableOpacity
                            key={filter.id}
                            style={styles.quickFilterChip}
                            onPress={() => handleQuickFilter(filter)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name={filter.icon} size={16} color="#8B5CF6" type="lucide" />
                            <Text style={styles.quickFilterText}>{filter.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Barre d'actions (tri) */}
                <View style={styles.actionsBar}>
                    <TouchableOpacity
                        style={styles.sortButton}
                        onPress={() => {
                            hapticPress();
                            setShowSortModal(true);
                        }}
                    >
                        <SafeIcon name="arrow-up-down" size={18} color="#6B7280" type="lucide" />
                        <Text style={styles.sortButtonText}>
                            {sortOptions.find(o => o.value === sortBy)?.label || 'Trier'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Liste des tickets */}
            {loading && tickets.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Recherche de voyages...</Text>
                </View>
            ) : error && tickets.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="ticket" size={64} color="#9CA3AF" />
                    <Text style={styles.errorText}>{error}</Text>
                    <Text style={styles.errorSubtext}>
                        Essayez de modifier vos critères de recherche
                    </Text>
                    {activeFiltersCount > 0 && (
                        <TouchableOpacity
                            style={styles.clearFiltersButton}
                            onPress={clearFilters}
                        >
                            <Text style={styles.clearFiltersText}>Réinitialiser les filtres</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    data={tickets}
                    keyExtractor={(item) => `${item.product_id}-${item.agency_id}`}
                    renderItem={({ item }) => (
                        <TicketCard
                            ticket={item}
                            onPress={() => handleTicketPress(item)}
                            formatPrice={formatPrice}
                            formatDate={formatDate}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="ticket" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucun ticket trouvé</Text>
                            <Text style={styles.emptySubtext}>
                                Essayez de modifier vos critères de recherche
                            </Text>
                            {activeFiltersCount > 0 && (
                                <TouchableOpacity
                                    style={styles.clearFiltersButton}
                                    onPress={clearFilters}
                                >
                                    <Text style={styles.clearFiltersText}>Réinitialiser les filtres</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* Modal de filtres avancés */}
            <FiltersModal
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                filters={filters}
                onFiltersChange={setFilters}
                departureCity={departureCity}
                setDepartureCity={setDepartureCity}
                arrivalCity={arrivalCity}
                setArrivalCity={setArrivalCity}
                departureDate={departureDate}
                setDepartureDate={setDepartureDate}
                departureTime={departureTime}
                setDepartureTime={setDepartureTime}
                agencyName={agencyName}
                setAgencyName={setAgencyName}
                location={location}
                onSearch={handleSearch}
                detectedCurrency={detectedCurrency}
            />

            {/* Modal de tri */}
            <SortModal
                visible={showSortModal}
                onClose={() => setShowSortModal(false)}
                sortBy={sortBy}
                onSortChange={setSortBy}
                sortOptions={sortOptions}
            />
        </SafeNativeView>
    );
};

// Composant Card pour un ticket
interface TicketCardProps {
    ticket: BusTicketSearchResult;
    onPress: () => void;
    formatPrice: (price?: number, currency?: string) => string;
    formatDate: (dateStr?: string) => string;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, onPress, formatPrice, formatDate }) => {
    const availabilityPercent = ticket.total_seats 
        ? (ticket.available_seats / ticket.total_seats) * 100 
        : 0;

    return (
        <TouchableOpacity style={styles.ticketCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.ticketHeader}>
                <View style={styles.ticketHeaderLeft}>
                    <View style={styles.agencyBadge}>
                        <SafeIcon name="building" size={14} color="#8B5CF6" type="lucide" />
                        <Text style={styles.agencyName} numberOfLines={1}>
                            {ticket.agency_nom}
                        </Text>
                    </View>
                    {ticket.bus_number && (
                        <Text style={styles.busNumber}>Bus #{ticket.bus_number}</Text>
                    )}
                </View>
                <View style={styles.availabilityBadge}>
                    <Text style={styles.availabilityText}>
                        {ticket.available_seats} place{ticket.available_seats > 1 ? 's' : ''}
                    </Text>
                </View>
            </View>

            <View style={styles.ticketRoute}>
                <View style={styles.routePoint}>
                    <View style={styles.routeDot} />
                    <View style={styles.routeContent}>
                        <Text style={styles.routeCity}>{ticket.departure_city || 'Départ'}</Text>
                        {ticket.departure_time && (
                            <Text style={styles.routeTime}>{ticket.departure_time}</Text>
                        )}
                    </View>
                </View>
                <View style={styles.routeLine}>
                    <View style={styles.routeLineInner} />
                </View>
                <View style={styles.routePoint}>
                    <View style={[styles.routeDot, styles.routeDotArrival]} />
                    <View style={styles.routeContent}>
                        <Text style={styles.routeCity}>{ticket.arrival_city || 'Arrivée'}</Text>
                    </View>
                </View>
            </View>

            {ticket.departure_date && (
                <View style={styles.ticketDate}>
                    <SafeIcon name="calendar" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.ticketDateText}>{formatDate(ticket.departure_date)}</Text>
                </View>
            )}

            <View style={styles.ticketFooter}>
                <View style={styles.ticketPriceContainer}>
                    <Text style={styles.ticketPrice}>
                        {formatPrice(ticket.ticket_price, ticket.currency)}
                    </Text>
                    {ticket.distance_km && (
                        <Text style={styles.ticketDistance}>
                            {ticket.distance_km.toFixed(1)} km
                        </Text>
                    )}
                </View>
                <View style={styles.ticketActions}>
                    <View style={styles.availabilityBar}>
                        <View 
                            style={[
                                styles.availabilityBarFill,
                                { width: `${availabilityPercent}%` },
                                availabilityPercent < 20 && styles.availabilityBarLow,
                            ]} 
                        />
                    </View>
                    <TouchableOpacity style={styles.bookButton}>
                        <Text style={styles.bookButtonText}>Réserver</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// Modal de filtres avancés
interface FiltersModalProps {
    visible: boolean;
    onClose: () => void;
    filters: BusTicketSearchFilters;
    onFiltersChange: (filters: BusTicketSearchFilters) => void;
    departureCity: LocationObject | string;
    setDepartureCity: (city: LocationObject | string) => void;
    arrivalCity: LocationObject | string;
    setArrivalCity: (city: LocationObject | string) => void;
    departureDate: string;
    setDepartureDate: (date: string) => void;
    departureTime: string;
    setDepartureTime: (time: string) => void;
    agencyName: string;
    setAgencyName: (name: string) => void;
    location: any;
    onSearch: () => void;
    detectedCurrency?: string; // ✅ Ajout pour éviter les erreurs de référence
}

const FiltersModal: React.FC<FiltersModalProps> = ({
    visible,
    onClose,
    filters,
    onFiltersChange,
    departureCity,
    setDepartureCity,
    arrivalCity,
    setArrivalCity,
    departureDate,
    setDepartureDate,
    departureTime,
    setDepartureTime,
    agencyName,
    setAgencyName,
    location,
    onSearch,
    detectedCurrency = 'XAF', // ✅ Valeur par défaut pour éviter les erreurs
}) => {
    const applyFilters = () => {
        const newFilters: BusTicketSearchFilters = {
            ...filters,
            departure_city: typeof departureCity === 'string' 
                ? departureCity 
                : (departureCity as LocationObject)?.components?.ville || (departureCity as LocationObject)?.place_name || undefined,
            arrival_city: typeof arrivalCity === 'string'
                ? arrivalCity
                : (arrivalCity as LocationObject)?.components?.ville || (arrivalCity as LocationObject)?.place_name || undefined,
            departure_date: departureDate || undefined,
            agency_name: agencyName || undefined,
            user_lat: location?.coords?.latitude,
            user_lng: location?.coords?.longitude,
        };
        onFiltersChange(newFilters);
        onSearch();
        onClose();
    };

    const clearAll = () => {
        onFiltersChange({
            radius_km: 50,
            min_seats: 1,
            user_lat: location?.coords?.latitude,
            user_lng: location?.coords?.longitude,
        });
        setDepartureCity('');
        setArrivalCity('');
        setDepartureDate('');
        setDepartureTime('');
        setAgencyName('');
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Filtres</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {/* Ville de départ */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Ville de départ</Text>
                            <LocationSelector
                                label="Ville de départ"
                                value={typeof departureCity === 'string' ? (departureCity ? { raw: departureCity, place_name: departureCity } : '') : departureCity}
                                onSelect={(location: LocationObject) => setDepartureCity(location)}
                                placeholder="Rechercher une ville..."
                                scope="city"
                                enrichWithBackend={true}
                            />
                        </View>

                        {/* Ville d'arrivée */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Ville d'arrivée</Text>
                            <LocationSelector
                                label="Ville d'arrivée"
                                value={typeof arrivalCity === 'string' ? (arrivalCity ? { raw: arrivalCity, place_name: arrivalCity } : '') : arrivalCity}
                                onSelect={(location: LocationObject) => setArrivalCity(location)}
                                placeholder="Rechercher une ville..."
                                scope="city"
                                enrichWithBackend={true}
                            />
                        </View>

                        {/* Date de départ */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Date de départ</Text>
                            <TextInput
                                style={styles.singleInput}
                                placeholder="YYYY-MM-DD"
                                value={departureDate}
                                onChangeText={setDepartureDate}
                            />
                        </View>

                        {/* Heure de départ */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Heure de départ</Text>
                            <TextInput
                                style={styles.singleInput}
                                placeholder="HH:MM"
                                value={departureTime}
                                onChangeText={setDepartureTime}
                            />
                        </View>

                        {/* Agence */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Nom de l'agence</Text>
                            <TextInput
                                style={styles.singleInput}
                                placeholder="Ex: Amour Mezam, Guarantee Express"
                                value={agencyName}
                                onChangeText={setAgencyName}
                            />
                        </View>

                        {/* Distance */}
                        {location?.coords && (
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Distance maximum (km)</Text>
                                <TextInput
                                    style={styles.singleInput}
                                    placeholder="Ex: 50"
                                    value={filters.radius_km?.toString() || '50'}
                                    onChangeText={(text) => {
                                        const value = text ? parseFloat(text) : 50;
                                        onFiltersChange({
                                            ...filters,
                                            radius_km: value,
                                        });
                                    }}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}

                        {/* Places minimum */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Places minimum</Text>
                            <TextInput
                                style={styles.singleInput}
                                placeholder="Ex: 1"
                                value={filters.min_seats?.toString() || '1'}
                                onChangeText={(text) => {
                                    const value = text ? parseInt(text) : 1;
                                    onFiltersChange({
                                        ...filters,
                                        min_seats: value,
                                    });
                                }}
                                keyboardType="numeric"
                            />
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={clearAll}
                        >
                            <Text style={styles.clearButtonText}>Tout effacer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={applyFilters}
                        >
                            <Text style={styles.applyButtonText}>Appliquer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// Modal de tri
interface SortModalProps {
    visible: boolean;
    onClose: () => void;
    sortBy: SortOption;
    onSortChange: (sort: SortOption) => void;
    sortOptions: { value: SortOption; label: string; icon: string }[];
}

const SortModal: React.FC<SortModalProps> = ({
    visible,
    onClose,
    sortBy,
    onSortChange,
    sortOptions,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.sortModalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.sortModalContent}>
                    {sortOptions.map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.sortOption,
                                sortBy === option.value && styles.sortOptionActive,
                            ]}
                            onPress={() => {
                                hapticPress();
                                onSortChange(option.value);
                                onClose();
                            }}
                        >
                            <SafeIcon
                                name={option.icon}
                                size={20}
                                color={sortBy === option.value ? '#8B5CF6' : '#6B7280'}
                                type="lucide"
                            />
                            <Text
                                style={[
                                    styles.sortOptionText,
                                    sortBy === option.value && styles.sortOptionTextActive,
                                ]}
                            >
                                {option.label}
                            </Text>
                            {sortBy === option.value && (
                                <SafeIcon name="check" size={20} color="#8B5CF6" type="lucide" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 2,
    },
    filterButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    filterBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    searchContainer: {
        marginTop: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    searchBarFocused: {
        borderColor: '#8B5CF6',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearButton: {
        padding: 4,
    },
    quickFiltersScroll: {
        maxHeight: 60,
    },
    quickFiltersContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    quickFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
        marginRight: 8,
    },
    quickFilterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    actionsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sortButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    errorSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    clearFiltersButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    clearFiltersText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
    },
    // Ticket Card styles
    ticketCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    ticketHeaderLeft: {
        flex: 1,
    },
    agencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: 'flex-start',
        gap: 6,
        marginBottom: 6,
    },
    agencyName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    busNumber: {
        fontSize: 12,
        color: '#6B7280',
    },
    availabilityBadge: {
        backgroundColor: '#10B981',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    availabilityText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    ticketRoute: {
        marginBottom: 16,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    routeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#8B5CF6',
    },
    routeDotArrival: {
        backgroundColor: '#10B981',
    },
    routeContent: {
        flex: 1,
    },
    routeCity: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    routeTime: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    routeLine: {
        height: 20,
        width: 12,
        alignItems: 'center',
        marginLeft: 6,
    },
    routeLineInner: {
        flex: 1,
        width: 2,
        backgroundColor: '#D1D5DB',
    },
    ticketDate: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    ticketDateText: {
        fontSize: 14,
        color: '#6B7280',
    },
    ticketFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    ticketPriceContainer: {
        flex: 1,
    },
    ticketPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: '#8B5CF6',
    },
    ticketDistance: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    ticketActions: {
        alignItems: 'flex-end',
        gap: 8,
    },
    availabilityBar: {
        width: 100,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        overflow: 'hidden',
    },
    availabilityBarFill: {
        height: '100%',
        backgroundColor: '#10B981',
    },
    availabilityBarLow: {
        backgroundColor: '#EF4444',
    },
    bookButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    bookButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        padding: 20,
    },
    filterSection: {
        marginBottom: 24,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    singleInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    clearButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#8B5CF6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Sort modal
    sortModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sortModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 8,
        minWidth: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    sortOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        borderRadius: 8,
    },
    sortOptionActive: {
        backgroundColor: '#F5F3FF',
    },
    sortOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    sortOptionTextActive: {
        color: '#8B5CF6',
        fontWeight: '600',
    },
});

export default TicketVoyageHomeScreen;

