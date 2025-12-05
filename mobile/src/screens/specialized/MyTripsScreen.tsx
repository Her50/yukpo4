// ✅ Phase 4: Mes trajets de covoiturage (conducteur)
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface Trip {
    id: number;
    service_id: number;
    user_id: number;
    depart: string;
    destination: string;
    date_depart: string;
    heure_depart?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    statut: string;
    type_vehicule?: string;
    marque_modele?: string;
    reservations_count: number;
    created_at: string;
}

const MyTripsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useFocusEffect(
        useCallback(() => {
            if (user) {
                loadTrips(true);
            } else {
                Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos trajets');
                navigation.goBack();
            }
        }, [user])
    );

    const loadTrips = async (isRefresh = false) => {
        if (!user) return;

        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const queryParams = new URLSearchParams();
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');
            if (statusFilter !== 'all') {
                queryParams.append('status', statusFilter);
            }

            const response = await apiGet(`/api/covoiturages/my-trips?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newTrips = response.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setTrips(newTrips);
                } else {
                    setTrips([...trips, ...newTrips]);
                }
                setHasMore(newTrips.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger vos trajets');
            }
        } catch (error: any) {
            console.error('[MyTripsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger vos trajets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadTrips();
        }
    };

    const handleTripPress = (trip: Trip) => {
        navigation.navigate('CovoiturageDetails' as never, { covoiturageId: trip.id } as never);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const formatPrice = (prix: number, devise: string) => {
        return `${prix.toLocaleString('fr-FR')} ${devise}`;
    };

    const getStatusColor = (statut: string) => {
        switch (statut) {
            case 'ouvert':
                return '#059669';
            case 'complet':
                return '#DC2626';
            case 'annule':
                return '#9CA3AF';
            default:
                return modernColors.textSecondary;
        }
    };

    const renderTrip = ({ item }: { item: Trip }) => (
        <TouchableOpacity onPress={() => handleTripPress(item)}>
            <NativeCard style={styles.tripCard}>
                <View style={styles.tripHeader}>
                    <View style={styles.routeInfo}>
                        <View style={styles.routePoint}>
                            <View style={styles.routeDot} />
                            <Text style={styles.routeText}>{item.depart}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routePoint}>
                            <View style={[styles.routeDot, styles.routeDotDestination]} />
                            <Text style={styles.routeText}>{item.destination}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.statut) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.statut) }]}>
                            {item.statut}
                        </Text>
                    </View>
                </View>

                <View style={styles.tripDetails}>
                    <View style={styles.detailItem}>
                        <SafeIcon name="calendar" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>{formatDate(item.date_depart)}</Text>
                    </View>
                    {item.heure_depart && (
                        <View style={styles.detailItem}>
                            <SafeIcon name="clock" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.detailText}>{item.heure_depart.substring(0, 5)}</Text>
                        </View>
                    )}
                    <View style={styles.detailItem}>
                        <SafeIcon name="users" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>
                            {item.places_disponibles}/{item.nombre_places} places
                        </Text>
                    </View>
                    {item.reservations_count > 0 && (
                        <View style={styles.detailItem}>
                            <SafeIcon name="user-check" size={14} color={modernColors.primary} />
                            <Text style={[styles.detailText, styles.reservationsText]}>
                                {item.reservations_count} réservation{item.reservations_count > 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.priceRow}>
                    <Text style={styles.priceText}>
                        {formatPrice(item.prix_par_place, item.devise)} / place
                    </Text>
                </View>
            </NativeCard>
        </TouchableOpacity>
    );

    const statusFilters = [
        { key: 'all', label: 'Tous' },
        { key: 'ouvert', label: 'Ouverts' },
        { key: 'complet', label: 'Complets' },
        { key: 'annule', label: 'Annulés' },
    ];

    if (loading && trips.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Mes trajets</Text>
                </View>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement de vos trajets...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Mes trajets</Text>
            </View>

            {/* Filtres de statut */}
            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
                    {statusFilters.map((filter) => (
                        <TouchableOpacity
                            key={filter.key}
                            style={[
                                styles.filterChip,
                                statusFilter === filter.key && styles.filterChipActive,
                            ]}
                            onPress={() => {
                                setStatusFilter(filter.key);
                                setPage(1);
                                loadTrips(true);
                            }}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    statusFilter === filter.key && styles.filterChipTextActive,
                                ]}
                            >
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {trips.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="car" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Aucun trajet trouvé</Text>
                    <Text style={styles.emptySubtext}>
                        {statusFilter === 'all'
                            ? 'Créez votre premier trajet de covoiturage'
                            : `Aucun trajet avec le statut "${statusFilters.find(f => f.key === statusFilter)?.label}"`}
                    </Text>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => {
                            navigation.navigate('CovoiturageForm' as never, { mode: 'create' } as never);
                        }}
                    >
                        <SafeIcon name="plus" size={20} color="#fff" />
                        <Text style={styles.createButtonText}>Créer un trajet</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={trips}
                    renderItem={renderTrip}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadTrips(true)}
                            colors={[modernColors.primary]}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loading && trips.length > 0 ? (
                            <ActivityIndicator size="small" color={modernColors.primary} style={styles.footerLoader} />
                        ) : null
                    }
                />
            )}
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
        fontWeight: '600',
        color: '#111827',
    },
    filtersContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filtersContent: {
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    tripCard: {
        padding: 16,
        marginBottom: 12,
    },
    tripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    routeInfo: {
        flex: 1,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.primary,
    },
    routeDotDestination: {
        backgroundColor: '#DC2626',
    },
    routeLine: {
        width: 2,
        height: 20,
        backgroundColor: '#D1D5DB',
        marginLeft: 3,
        marginVertical: 4,
    },
    routeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tripDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    reservationsText: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    priceText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    footerLoader: {
        marginVertical: 16,
    },
});

export default MyTripsScreen;

