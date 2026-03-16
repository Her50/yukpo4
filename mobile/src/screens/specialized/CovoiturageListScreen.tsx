// ✅ Phase 3: Liste des résultats de recherche de covoiturages
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

interface Covoiturage {
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
}

interface CovoiturageListScreenParams {
    filters?: {
        depart?: string;
        destination?: string;
        date_depart?: string;
        min_places?: number;
        max_prix?: number;
    };
}

const CovoiturageListScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const params = route.params as CovoiturageListScreenParams;

    const [covoiturages, setCovoiturages] = useState<Covoiturage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadCovoiturages();
    }, []);

    const loadCovoiturages = async (isRefresh = false) => {
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
            if (filters.depart) queryParams.append('depart', filters.depart);
            if (filters.destination) queryParams.append('destination', filters.destination);
            if (filters.date_depart) queryParams.append('date_depart', filters.date_depart);
            if (filters.min_places) queryParams.append('min_places', filters.min_places.toString());
            if (filters.max_prix) queryParams.append('max_prix', filters.max_prix.toString());
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/covoiturages/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newCovoiturages = (response.data as any).data || [];
                if (isRefresh || currentPage === 1) {
                    setCovoiturages(newCovoiturages);
                } else {
                    setCovoiturages([...covoiturages, ...newCovoiturages]);
                }
                setHasMore(newCovoiturages.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les covoiturages');
            }
        } catch (error: any) {
            console.error('[CovoiturageListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les covoiturages');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadCovoiturages();
        }
    };

    const handleCovoituragePress = (covoiturage: Covoiturage) => {
        navigation.navigate('CovoiturageDetails' as never, { covoiturageId: covoiturage.id } as never);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            });
        } catch {
            return dateStr;
        }
    };

    const formatPrice = (prix: number, devise: string) => {
        return `${prix.toLocaleString('fr-FR')} ${devise}`;
    };

    const renderCovoiturage = ({ item }: { item: Covoiturage }) => (
        <TouchableOpacity onPress={() => handleCovoituragePress(item)}>
            <NativeCard style={styles.covoiturageCard}>
                <View style={styles.routeRow}>
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

                <View style={styles.detailsRow}>
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
                            {item.places_disponibles}/{item.nombre_places}
                        </Text>
                    </View>
                </View>

                <View style={styles.priceRow}>
                    <Text style={styles.priceText}>
                        {formatPrice(item.prix_par_place, item.devise)} / place
                    </Text>
                    <View style={[styles.statusBadge, item.statut === 'ouvert' && styles.statusBadgeOpen]}>
                        <Text style={[styles.statusText, item.statut === 'ouvert' && styles.statusTextOpen]}>
                            {item.statut}
                        </Text>
                    </View>
                </View>
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && covoiturages.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('covoiturageList.chargementDesTrajets')}</Text>
            </View>
        );
    }

    if (covoiturages.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('covoiturageList.resultatsDeRecherche')}</Text>
                </View>
                <View style={styles.centerContainer}>
                    <SafeIcon name="car" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>{t('covoiturageList.aucunTrajetTrouve')}</Text>
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
                    {covoiturages.length} trajet{covoiturages.length > 1 ? 's' : ''} trouvé{covoiturages.length > 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={covoiturages}
                renderItem={renderCovoiturage}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadCovoiturages(true)}
                        colors={[modernColors.primary]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loading && covoiturages.length > 0 ? (
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
    covoiturageCard: {
        padding: 16,
        marginBottom: 12,
    },
    routeRow: {
        marginBottom: 12,
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
    detailsRow: {
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
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
    },
    statusBadgeOpen: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    statusTextOpen: {
        color: '#059669',
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

export default CovoiturageListScreen;

