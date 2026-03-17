// ✅ Phase 2: Écran liste des commandes pharmacies pour le client
import { useNavigation } from '@react-navigation/native';
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
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useAuth } from '../../contexts/AuthContext';
import { PharmacyOrder, pharmacyService } from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const MyPharmacyOrdersScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();

    const [orders, setOrders] = useState<PharmacyOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const limit = 20;

    useEffect(() => {
        if (user) {
            loadOrders(true);
        } else {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos commandes');
            navigation.goBack();
        }
    }, [statusFilter]);

    const loadOrders = async (reset = false) => {
        try {
            if (reset) {
                setPage(1);
                setOrders([]);
                setHasMore(true);
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const currentPage = reset ? 1 : page;
            const response = await pharmacyService.getMyOrders(currentPage, limit);

            if (response.success && response.data) {
                const newOrders = response.data.orders || [];

                // Filtrer par statut si nécessaire
                const filteredOrders = statusFilter
                    ? newOrders.filter(order => order.status?.toLowerCase() === statusFilter.toLowerCase())
                    : newOrders;

                if (reset) {
                    setOrders(filteredOrders);
                } else {
                    setOrders(prev => [...prev, ...filteredOrders]);
                }

                setHasMore(newOrders.length === limit);
                setPage(currentPage + 1);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de charger les commandes');
            }
        } catch (error: any) {
            console.error('[MyPharmacyOrdersScreen] Erreur chargement:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les commandes');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadOrders(true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadOrders(false);
        }
    };

    const getStatusColor = (status: string | null) => {
        if (!status) return modernColors.textSecondary;
        switch (status.toLowerCase()) {
            case 'pending':
            case 'en_attente':
                return modernColors.warning;
            case 'confirmed':
            case t('myPharmacyOrdersScreen.confirmee'):
                return modernColors.info;
            case 'processing':
            case 'en_traitement':
                return modernColors.primary;
            case 'ready':
            case t('myPharmacyOrdersScreen.prete'):
                return '#059669';
            case 'delivered':
            case t('myPharmacyOrdersScreen.livree'):
                return modernColors.success;
            case 'cancelled':
            case t('myPharmacyOrdersScreen.annulee'):
                return modernColors.error;
            default:
                return modernColors.textSecondary;
        }
    };

    const getStatusLabel = (status: string | null) => {
        if (!status) return 'Inconnu';
        switch (status.toLowerCase()) {
            case 'pending':
            case 'en_attente':
                return 'En attente';
            case 'confirmed':
            case t('myPharmacyOrdersScreen.confirmee'):
                return t('myPharmacyOrdersScreen.confirmee');
            case 'processing':
            case 'en_traitement':
                return 'En traitement';
            case 'ready':
            case t('myPharmacyOrdersScreen.prete'):
                return t('myPharmacyOrdersScreen.preteARecuperer');
            case 'delivered':
            case t('myPharmacyOrdersScreen.livree'):
                return t('myPharmacyOrdersScreen.livree');
            case 'cancelled':
            case t('myPharmacyOrdersScreen.annulee'):
                return t('myPharmacyOrdersScreen.annulee');
            default:
                return status;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return t('myPharmacyOrdersScreen.nonSpecifie');
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const formatAmount = (amount: string | null) => {
        if (!amount) return t('myPharmacyOrdersScreen.nonSpecifie');
        try {
            const num = parseFloat(amount);
            return `${num.toLocaleString('fr-FR')} XAF`;
        } catch {
            return amount;
        }
    };

    const handleViewDetails = (order: PharmacyOrder) => {
        navigation.navigate('PharmacieDetails' as never, {
            pharmacieId: order.pharmacy_id,
        } as never);
    };

    const renderOrder = ({ item }: { item: PharmacyOrder }) => {
        const statusColor = getStatusColor(item.status);
        const statusLabel = getStatusLabel(item.status);
        const deliveryMethod = item.delivery_method === 'delivery' ? 'Livraison' : t('myPharmacyOrdersScreen.aRetirer');

        return (
            <TouchableOpacity
                onPress={() => handleViewDetails(item)}
                activeOpacity={0.8}
            >
                <NativeCard style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.pharmacyInfo}>
                            <SafeIcon name="pill" size={24} color={modernColors.primary} />
                            <View style={styles.pharmacyDetails}>
                                <Text style={styles.pharmacyName}>
                                    {item.pharmacy_name || t('myPharmacyOrders.pharmacieNonSpecifiee')}
                                </Text>
                                <Text style={styles.deliveryMethod}>
                                    {deliveryMethod}
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {statusLabel}
                            </Text>
                        </View>
                    </View>

                    {item.total_amount && (
                        <View style={styles.amountRow}>
                            <SafeIcon name="currency" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.amountText}>
                                {formatAmount(item.total_amount)}
                            </Text>
                        </View>
                    )}

                    {item.delivery_address && (
                        <View style={styles.addressRow}>
                            <SafeIcon name="map-pin" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.addressText} numberOfLines={2}>
                                {item.delivery_address}
                            </Text>
                        </View>
                    )}

                    <View style={styles.cardFooter}>
                        <Text style={styles.createdDate}>
                            Commande du {formatDate(item.created_at)}
                        </Text>
                        <NativeButton
                            title={t('myPharmacyOrders.voirDetails')}
                            onPress={() => handleViewDetails(item)}
                            variant="outline"
                            size="small"
                        />
                    </View>
                </NativeCard>
            </TouchableOpacity>
        );
    };

    const renderFilters = () => (
        <View style={styles.filtersContainer}>
            <Text style={styles.filtersTitle}>Filtrer par statut:</Text>
            <View style={styles.filtersRow}>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === null && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter(null)}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === null && styles.filterButtonTextActive,
                        ]}
                    >
                        Tous
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'pending' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('pending')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'pending' && styles.filterButtonTextActive,
                        ]}
                    >
                        En attente
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'processing' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('processing')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'processing' && styles.filterButtonTextActive,
                        ]}
                    >
                        En traitement
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'ready' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('ready')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'ready' && styles.filterButtonTextActive,
                        ]}
                    >
                        Prêtes
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'delivered' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('delivered')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'delivered' && styles.filterButtonTextActive,
                        ]}
                    >
                        Livrées
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('myPharmacyOrders.mesCommandes')}</Text>
            </View>

            {renderFilters()}

            {loading && orders.length === 0 ? (
                <View style={styles.listContent}>
                    <SkeletonList count={5} />
                </View>
            ) : orders.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="shopping-cart" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyTitle}>{t('myPharmacyOrders.aucuneCommande')}</Text>
                    <Text style={styles.emptyText}>
                        Vous n'avez pas encore passé de commande dans une pharmacie.
                    </Text>
                    <NativeButton
                        title={t('myPharmacyOrders.rechercherUnePharmacie')}
                        onPress={() => navigation.navigate('PharmacieSearch' as never)}
                        variant="primary"
                        style={styles.emptyButton}
                    />
                </View>
            ) : (
                <FlatList
                    data={orders}
                    renderItem={renderOrder}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[modernColors.primary]}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator size="small" color={modernColors.primary} style={styles.loader} />
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
    filtersContainer: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filtersTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterButtonText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    listContent: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    pharmacyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    pharmacyDetails: {
        marginLeft: 12,
        flex: 1,
    },
    pharmacyName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    deliveryMethod: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    amountText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#059669',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 8,
        flex: 1,
    },
    addressText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    createdDate: {
        fontSize: 12,
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
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyButton: {
        marginTop: 8,
    },
    loader: {
        marginVertical: 16,
    },
});

export default MyPharmacyOrdersScreen;

