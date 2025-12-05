// ✅ Liste des résultats de recherche de pharmacies (Mobile)
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
import { NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface Pharmacie {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    is_on_duty: boolean;
    telephone?: string;
    distance_km?: number;
}

const PharmacieListScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as any;

    const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadPharmacies();
    }, []);

    const loadPharmacies = async (isRefresh = false) => {
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
            if (filters.on_duty_only) queryParams.append('on_duty_only', 'true');
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/pharmacies/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newPharmacies = response.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setPharmacies(newPharmacies);
                } else {
                    setPharmacies([...pharmacies, ...newPharmacies]);
                }
                setHasMore(newPharmacies.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les pharmacies');
            }
        } catch (error: any) {
            console.error('[PharmacieListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les pharmacies');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadPharmacies();
        }
    };

    const handlePharmaciePress = (pharmacie: Pharmacie) => {
        navigation.navigate('PharmacieDetails' as never, { pharmacieId: pharmacie.id } as never);
    };

    const renderPharmacie = ({ item }: { item: Pharmacie }) => (
        <TouchableOpacity onPress={() => handlePharmaciePress(item)}>
            <NativeCard style={styles.pharmacieCard}>
                <View style={styles.pharmacieHeader}>
                    <View style={styles.pharmacieInfo}>
                        <Text style={styles.pharmacieNom}>{item.nom}</Text>
                    </View>
                    <View style={styles.badgesContainer}>
                        <View style={[styles.statusBadge, item.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, item.is_available_now && styles.statusTextAvailable]}>
                                {item.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Text>
                        </View>
                        {item.is_on_duty && (
                            <View style={styles.dutyBadge}>
                                <Text style={styles.dutyText}>De garde</Text>
                            </View>
                        )}
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
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && pharmacies.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des pharmacies...</Text>
            </View>
        );
    }

    if (pharmacies.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="pill" size={64} color={modernColors.textSecondary} />
                <Text style={styles.emptyTitle}>Aucune pharmacie trouvée</Text>
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
                    {pharmacies.length} pharmacie{pharmacies.length > 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={pharmacies}
                renderItem={renderPharmacie}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadPharmacies(true)}
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
    pharmacieCard: {
        marginBottom: 12,
        padding: 16,
    },
    pharmacieHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    pharmacieInfo: {
        flex: 1,
    },
    pharmacieNom: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    badgesContainer: {
        flexDirection: 'row',
        gap: 8,
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
    dutyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#DBEAFE',
    },
    dutyText: {
        fontSize: 12,
        color: '#1E40AF',
        fontWeight: '600',
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

export default PharmacieListScreen;

