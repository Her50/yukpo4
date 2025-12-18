// ✅ Liste des résultats de recherche d'agences de voyage (Mobile)
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
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
import { NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface AgenceVoyage {
    id: number;
    service_id: number;
    user_id: number;
    nom_agence: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    destinations?: string[];
    compagnies_bus?: string[];
    telephone?: string;
    distance_km?: number;
}

const AgenceVoyageListScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as any;

    const [agences, setAgences] = useState<AgenceVoyage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadAgences();
    }, []);

    const loadAgences = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const filters = params?.filters || {};
            const queryParams = new URLSearchParams();
            if (filters.ville) queryParams.append('ville', filters.ville);
            if (filters.quartier) queryParams.append('quartier', filters.quartier);
            if (filters.lat) queryParams.append('lat', filters.lat.toString());
            if (filters.lng) queryParams.append('lng', filters.lng.toString());
            if (filters.max_distance_km) queryParams.append('max_distance_km', filters.max_distance_km.toString());
            if (filters.destination) queryParams.append('destination', filters.destination);
            if (filters.compagnie_bus) queryParams.append('compagnie_bus', filters.compagnie_bus);
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/agences-voyage/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newAgences = response.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setAgences(newAgences);
                } else {
                    setAgences([...agences, ...newAgences]);
                }
                setHasMore(newAgences.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les agences de voyage');
            }
        } catch (error: any) {
            console.error('[AgenceVoyageListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les agences de voyage');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadAgences();
        }
    };

    const handleAgencePress = (agence: AgenceVoyage) => {
        navigation.navigate('AgenceVoyageDetails' as never, { agenceId: agence.id } as never);
    };

    const renderAgence = ({ item }: { item: AgenceVoyage }) => (
        <TouchableOpacity onPress={() => handleAgencePress(item)}>
            <NativeCard style={styles.agenceCard}>
                <View style={styles.agenceHeader}>
                    <View style={styles.agenceInfo}>
                        <Text style={styles.agenceNom}>{item.nom_agence}</Text>
                    </View>
                    <View style={[styles.statusBadge, item.is_available_now && styles.statusBadgeAvailable]}>
                        <Text style={[styles.statusText, item.is_available_now && styles.statusTextAvailable]}>
                            {item.is_available_now ? 'Disponible' : 'Indisponible'}
                        </Text>
                    </View>
                </View>

                {(item.ville || item.quartier) && (
                    <View style={styles.locationRow}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.locationText}>
                            {[item.ville, item.quartier].filter(Boolean).join(', ')}
                        </Text>
                    </View>
                )}

                {item.distance_km !== undefined && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.distanceText}>{item.distance_km.toFixed(1)} km</Text>
                    </View>
                )}

                {item.telephone && (
                    <View style={styles.phoneRow}>
                        <SafeIcon name="phone" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.phoneText}>{item.telephone}</Text>
                    </View>
                )}

                {item.destinations && item.destinations.length > 0 && (
                    <View style={styles.destinationsContainer}>
                        <Text style={styles.destinationsLabel}>Destinations:</Text>
                        <View style={styles.destinationsRow}>
                            {item.destinations.slice(0, 3).map((dest, idx) => (
                                <View key={idx} style={styles.destinationBadge}>
                                    <Text style={styles.destinationText}>{dest}</Text>
                                </View>
                            ))}
                            {item.destinations.length > 3 && (
                                <Text style={styles.destinationMore}>
                                    +{item.destinations.length - 3}
                                </Text>
                            )}
                        </View>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && agences.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des agences de voyage...</Text>
            </View>
        );
    }

    if (agences.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="bus" size={64} color={modernColors.textSecondary} />
                <Text style={styles.emptyTitle}>Aucune agence de voyage trouvée</Text>
                <Text style={styles.emptyText}>Essayez de modifier vos critères de recherche</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>Nouvelle recherche</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {agences.length} agence{agences.length > 1 ? 's' : ''} de voyage
                </Text>
            </View>

            <FlatList
                data={agences}
                renderItem={renderAgence}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadAgences(true)}
                        colors={[modernColors.primary]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    hasMore && loading ? (
                        <ActivityIndicator size="small" color={modernColors.primary} style={styles.footerLoader} />
                    ) : null
                }
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    listContent: {
        padding: 16,
    },
    agenceCard: {
        marginBottom: 12,
        padding: 16,
    },
    agenceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    agenceInfo: {
        flex: 1,
    },
    agenceNom: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#F3F4F6',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    statusTextAvailable: {
        color: '#065F46',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    phoneText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    destinationsContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    destinationsLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 6,
    },
    destinationsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    destinationBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#DBEAFE',
    },
    destinationText: {
        fontSize: 12,
        color: '#1E40AF',
        fontWeight: '600',
    },
    destinationMore: {
        fontSize: 12,
        color: modernColors.textSecondary,
        alignSelf: 'center',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    footerLoader: {
        marginVertical: 16,
    },
});

export default AgenceVoyageListScreen;

