// ✅ Phase 3: Liste des résultats de recherche de taxis
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
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface Taxi {
    id: number;
    service_id: number;
    user_id: number;
    zone: string;
    gps_actuel?: string;
    is_available_now: boolean;
    type_vehicule?: string;
    marque_modele?: string;
    telephone?: string;
    distance_km?: number;
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
    };
}

interface TaxiListScreenParams {
    filters?: {
        zone?: string;
        lat?: number;
        lng?: number;
        max_distance_km?: number;
        available_only?: boolean;
        type_vehicule?: string;
    };
}

const TaxiListScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as TaxiListScreenParams;

    const [taxis, setTaxis] = useState<Taxi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadTaxis();
    }, []);

    const loadTaxis = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const filters = params?.filters || {};

            // Construire query params
            const queryParams = new URLSearchParams();
            if (filters.zone) queryParams.append('zone', filters.zone);
            if (filters.lat) queryParams.append('lat', filters.lat.toString());
            if (filters.lng) queryParams.append('lng', filters.lng.toString());
            if (filters.max_distance_km) queryParams.append('max_distance_km', filters.max_distance_km.toString());
            if (filters.available_only) queryParams.append('available_only', 'true');
            if (filters.type_vehicule) queryParams.append('type_vehicule', filters.type_vehicule);
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/taxis/search?${queryParams.toString()}`);

            const r = response.data as any;
            if (response.success && r) {
                const newTaxis = r.data || [];
                if (isRefresh || currentPage === 1) {
                    setTaxis(newTaxis);
                } else {
                    setTaxis([...taxis, ...newTaxis]);
                }
                setHasMore(newTaxis.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les taxis');
            }
        } catch (error: any) {
            console.error('[TaxiListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les taxis');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadTaxis();
        }
    };

    const handleTaxiPress = (taxi: Taxi) => {
        navigation.navigate('TaxiDetails' as never, { taxiId: taxi.id } as never);
    };

    const renderTaxi = ({ item }: { item: Taxi }) => (
        <TouchableOpacity onPress={() => handleTaxiPress(item)}>
            <NativeCard style={styles.taxiCard}>
                <View style={styles.taxiHeader}>
                    <View style={styles.taxiInfo}>
                        <Text style={styles.taxiZone}>{item.zone}</Text>
                        {item.type_vehicule && (
                            <Text style={styles.taxiType}>{item.type_vehicule}</Text>
                        )}
                    </View>
                    <View style={[styles.statusBadge, item.is_available_now && styles.statusBadgeAvailable]}>
                        <Text style={[styles.statusText, item.is_available_now && styles.statusTextAvailable]}>
                            {item.is_available_now ? 'Disponible' : 'Occupé'}
                        </Text>
                    </View>
                </View>

                {item.marque_modele && (
                    <Text style={styles.taxiModel}>{item.marque_modele}</Text>
                )}

                {item.distance_km !== undefined && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.distanceText}>
                            {item.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}

                {item.telephone && (
                    <View style={styles.phoneRow}>
                        <SafeIcon name="phone" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.phoneText}>{item.telephone}</Text>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && taxis.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des taxis...</Text>
            </View>
        );
    }

    if (taxis.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Résultats de recherche</Text>
                </View>
                <View style={styles.centerContainer}>
                    <SafeIcon name="taxi" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Aucun taxi trouvé</Text>
                    <Text style={styles.emptySubtext}>
                        Essayez de modifier vos critères de recherche
                    </Text>
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
                <Text style={styles.title}>
                    {taxis.length} taxi{taxis.length > 1 ? 's' : ''} trouvé{taxis.length > 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={taxis}
                renderItem={renderTaxi}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadTaxis(true)}
                        colors={[modernColors.primary]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loading && taxis.length > 0 ? (
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
    listContent: {
        padding: 16,
        gap: 12,
    },
    taxiCard: {
        padding: 16,
        marginBottom: 12,
    },
    taxiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    taxiInfo: {
        flex: 1,
    },
    taxiZone: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    taxiType: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    statusTextAvailable: {
        color: '#059669',
    },
    taxiModel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    phoneText: {
        fontSize: 14,
        color: modernColors.textSecondary,
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
    footerLoader: {
        marginVertical: 16,
    },
});

export default TaxiListScreen;

