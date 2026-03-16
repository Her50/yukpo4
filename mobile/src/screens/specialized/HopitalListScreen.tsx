// ✅ Phase 3: Liste des résultats de recherche d'hôpitaux
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
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Hopital {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_etablissement: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    urgences_disponible: boolean;
    prestations_medicales?: string[];
    telephone?: string;
    telephone_urgence?: string;
    distance_km?: number;
}

interface HopitalListScreenParams {
    filters?: {
        ville?: string;
        quartier?: string;
        lat?: number;
        lng?: number;
        max_distance_km?: number;
        type_etablissement?: string;
        prestation?: string;
        urgences_only?: boolean;
        available_only?: boolean;
    };
}

const HopitalListScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const params = route.params as HopitalListScreenParams;

    const [hopitaux, setHopitaux] = useState<Hopital[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadHopitaux();
    }, []);

    const loadHopitaux = async (isRefresh = false) => {
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
            if (filters.ville) queryParams.append('ville', filters.ville);
            if (filters.quartier) queryParams.append('quartier', filters.quartier);
            if (filters.lat) queryParams.append('lat', filters.lat.toString());
            if (filters.lng) queryParams.append('lng', filters.lng.toString());
            if (filters.max_distance_km) queryParams.append('max_distance_km', filters.max_distance_km.toString());
            if (filters.type_etablissement) queryParams.append('type_etablissement', filters.type_etablissement);
            if (filters.prestation) queryParams.append('prestation', filters.prestation);
            if (filters.urgences_only) queryParams.append('urgences_only', 'true');
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/hopitaux/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newHopitaux = (response.data as any).data || [];
                if (isRefresh || currentPage === 1) {
                    setHopitaux(newHopitaux);
                } else {
                    setHopitaux([...hopitaux, ...newHopitaux]);
                }
                setHasMore(newHopitaux.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les hôpitaux');
            }
        } catch (error: any) {
            console.error('[HopitalListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les hôpitaux');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadHopitaux();
        }
    };

    const handleHopitalPress = (hopital: Hopital) => {
        navigation.navigate('HopitalDetails' as never, { hospitalId: hopital.id } as never);
    };

    const renderHopital = ({ item }: { item: Hopital }) => (
        <TouchableOpacity onPress={() => handleHopitalPress(item)}>
            <NativeCard style={styles.hopitalCard}>
                <View style={styles.hopitalHeader}>
                    <View style={styles.hopitalInfo}>
                        <Text style={styles.hopitalNom}>{item.nom}</Text>
                        <Text style={styles.hopitalType}>{item.type_etablissement}</Text>
                    </View>
                    <View style={styles.badgesContainer}>
                        <View style={[styles.statusBadge, item.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, item.is_available_now && styles.statusTextAvailable]}>
                                {item.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Text>
                        </View>
                        {item.urgences_disponible && (
                            <View style={styles.urgenceBadge}>
                                <SafeIcon name="alert-circle" size={12} color="#DC2626" />
                                <Text style={styles.urgenceText}>Urgences</Text>
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

                {item.prestations_medicales && item.prestations_medicales.length > 0 && (
                    <View style={styles.prestationsContainer}>
                        <Text style={styles.prestationsLabel}>Prestations:</Text>
                        <View style={styles.prestationsChips}>
                            {item.prestations_medicales.slice(0, 3).map((prest, idx) => (
                                <View key={idx} style={styles.prestationChip}>
                                    <Text style={styles.prestationChipText}>{prest}</Text>
                                </View>
                            ))}
                            {item.prestations_medicales.length > 3 && (
                                <Text style={styles.prestationsMore}>
                                    +{item.prestations_medicales.length - 3}
                                </Text>
                            )}
                        </View>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && hopitaux.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('hopitalList.chargementDesHopitaux')}</Text>
            </View>
        );
    }

    if (hopitaux.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('hopitalList.resultatsDeRecherche')}</Text>
                </View>
                <View style={styles.centerContainer}>
                    <SafeIcon name="hospital" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>{t('hopitalList.aucunHopitalTrouve')}</Text>
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
                    {hopitaux.length} hôpital{hopitaux.length > 1 ? 'aux' : ''} trouvé{hopitaux.length > 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={hopitaux}
                renderItem={renderHopital}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadHopitaux(true)}
                        colors={[modernColors.primary]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loading && hopitaux.length > 0 ? (
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
    hopitalCard: {
        padding: 16,
        marginBottom: 12,
    },
    hopitalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    hopitalInfo: {
        flex: 1,
    },
    hopitalNom: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    hopitalType: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    badgesContainer: {
        flexDirection: 'column',
        gap: 4,
        alignItems: 'flex-end',
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
    urgenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
        gap: 4,
    },
    urgenceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#DC2626',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.textSecondary,
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
        marginBottom: 8,
    },
    phoneText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    prestationsContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    prestationsLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    prestationsChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    prestationChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#DBEAFE',
    },
    prestationChipText: {
        fontSize: 11,
        color: '#1E40AF',
    },
    prestationsMore: {
        fontSize: 11,
        color: modernColors.textSecondary,
        alignSelf: 'center',
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

export default HopitalListScreen;

