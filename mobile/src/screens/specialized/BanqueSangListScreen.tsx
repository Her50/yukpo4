// ✅ Liste des résultats de recherche de banques de sang (Mobile)
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

interface BanqueSang {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    stocks?: Record<string, number>;
    telephone?: string;
    distance_km?: number;
}

const BanqueSangListScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as any;

    const [banques, setBanques] = useState<BanqueSang[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadBanques();
    }, []);

    const loadBanques = async (isRefresh = false) => {
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
            if (filters.groupe_sanguin) queryParams.append('groupe_sanguin', filters.groupe_sanguin);
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/banques-sang/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newBanques = (response.data as any).data || [];
                if (isRefresh || currentPage === 1) {
                    setBanques(newBanques);
                } else {
                    setBanques([...banques, ...newBanques]);
                }
                setHasMore(newBanques.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les banques de sang');
            }
        } catch (error: any) {
            console.error('[BanqueSangListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les banques de sang');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadBanques();
        }
    };

    const handleBanquePress = (banque: BanqueSang) => {
        navigation.navigate('BanqueSangDetails' as never, { banqueId: banque.id } as never);
    };

    const renderBanque = ({ item }: { item: BanqueSang }) => (
        <TouchableOpacity onPress={() => handleBanquePress(item)}>
            <NativeCard style={styles.banqueCard}>
                <View style={styles.banqueHeader}>
                    <View style={styles.banqueInfo}>
                        <Text style={styles.banqueNom}>{item.nom}</Text>
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

                {item.stocks && Object.keys(item.stocks).length > 0 && (
                    <View style={styles.stocksContainer}>
                        <Text style={styles.stocksLabel}>Stocks disponibles:</Text>
                        <View style={styles.stocksRow}>
                            {Object.entries(item.stocks).slice(0, 4).map(([groupe, qty]) => (
                                <View key={groupe} style={styles.stockBadge}>
                                    <Text style={styles.stockText}>{groupe}: {qty}</Text>
                                </View>
                            ))}
                            {Object.keys(item.stocks).length > 4 && (
                                <Text style={styles.stockMore}>
                                    +{Object.keys(item.stocks).length - 4}
                                </Text>
                            )}
                        </View>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && banques.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des banques de sang...</Text>
            </View>
        );
    }

    if (banques.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="droplet" size={64} color={modernColors.textSecondary} />
                <Text style={styles.emptyTitle}>Aucune banque de sang trouvée</Text>
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
                    {banques.length} banque{banques.length > 1 ? 's' : ''} de sang
                </Text>
            </View>

            <FlatList
                data={banques}
                renderItem={renderBanque}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadBanques(true)}
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
    banqueCard: {
        marginBottom: 12,
        padding: 16,
    },
    banqueHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    banqueInfo: {
        flex: 1,
    },
    banqueNom: {
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
    stocksContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    stocksLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 6,
    },
    stocksRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    stockBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#FEE2E2',
    },
    stockText: {
        fontSize: 12,
        color: '#991B1B',
        fontWeight: '600',
    },
    stockMore: {
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

export default BanqueSangListScreen;

