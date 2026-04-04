// ✅ Écran commandes reçues pour partenaire pharmacie
// - Liste les commandes entrantes avec statut, montant, mode livraison
// - Bouton "Valider / Scanner QR" pour naviguer vers PharmacyOrderValidationScreen
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { PharmacyOrder, pharmacyService } from '../../services/pharmacyService';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending:     { label: 'En attente',    color: '#F59E0B' },
    confirmed:   { label: 'Confirmée',     color: '#3B82F6' },
    processing:  { label: 'En préparation', color: '#8B5CF6' },
    ready:       { label: 'Prête',         color: '#10B981' },
    in_delivery: { label: 'En livraison',  color: '#06B6D4' },
    delivered:   { label: 'Livrée ✓',     color: '#059669' },
    cancelled:   { label: 'Annulée',       color: '#EF4444' },
};

const FILTERS = [
    { key: null,          label: 'Toutes' },
    { key: 'pending',     label: 'En attente' },
    { key: 'confirmed',   label: 'Confirmées' },
    { key: 'ready',       label: 'Prêtes' },
    { key: 'in_delivery', label: 'En livraison' },
    { key: 'delivered',   label: 'Livrées' },
];

const PharmacyPartnerOrdersScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { pharmacyId } = (route.params as any) || {};

    const [orders, setOrders] = useState<PharmacyOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const LIMIT = 20;

    const loadOrders = useCallback(async (reset = false) => {
        if (!pharmacyId) return;
        try {
            if (reset) {
                setLoading(true);
                setPage(1);
                setHasMore(true);
            } else {
                setLoadingMore(true);
            }
            const currentPage = reset ? 1 : page;
            const res = await pharmacyService.getPartnerOrders(pharmacyId, {
                status: statusFilter || undefined,
                page: currentPage,
                limit: LIMIT,
            });
            if (res.success) {
                const newOrders = (res as any).orders || [];
                if (reset) {
                    setOrders(newOrders);
                } else {
                    setOrders(prev => [...prev, ...newOrders]);
                }
                setHasMore(newOrders.length === LIMIT);
                setPage(currentPage + 1);
            } else {
                Alert.alert('Erreur', (res as any).error || 'Impossible de charger les commandes');
            }
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Erreur réseau');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [pharmacyId, statusFilter, page]);

    useFocusEffect(useCallback(() => {
        loadOrders(true);
    }, [pharmacyId, statusFilter]));

    const handleRefresh = () => {
        setRefreshing(true);
        loadOrders(true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) loadOrders(false);
    };

    const renderOrder = ({ item }: { item: PharmacyOrder }) => {
        const statusInfo = STATUS_LABELS[item.status || ''] || { label: item.status || '?', color: '#6B7280' };
        const isDelivery = item.delivery_method === 'delivery';
        const isDone = item.status === 'delivered' || item.status === 'cancelled';

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.cardLeft}>
                        <Text style={styles.orderId} numberOfLines={1}>
                            #{item.id.slice(0, 8).toUpperCase()}
                        </Text>
                        <View style={styles.modeRow}>
                            <SafeIcon
                                name={isDelivery ? 'truck' : 'shopping-bag'}
                                size={13}
                                color="#6B7280"
                                type="lucide"
                            />
                            <Text style={styles.modeText}>
                                {isDelivery ? 'Livraison coursier' : 'Retrait pharmacie'}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.amountRow}>
                    <SafeIcon name="credit-card" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.amountText}>
                        {item.total_amount
                            ? `${Number(item.total_amount).toLocaleString()} FCFA`
                            : '—'}
                    </Text>
                    <Text style={styles.dateText}>
                        {new Date(item.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                    </Text>
                </View>

                {!isDone && (
                    <TouchableOpacity
                        style={styles.validateButton}
                        onPress={() =>
                            (navigation as any).navigate('PharmacyOrderValidation', { orderId: item.id })
                        }
                    >
                        <SafeIcon name="qr-code" size={16} color="#FFFFFF" type="lucide" />
                        <Text style={styles.validateButtonText}>Scanner QR / Valider</Text>
                    </TouchableOpacity>
                )}

                {isDone && (
                    <View style={styles.doneRow}>
                        <SafeIcon name="check-circle" size={14} color="#059669" type="lucide" />
                        <Text style={styles.doneText}>
                            {item.status === 'delivered' ? 'Commande terminée' : 'Annulée'}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={['#EC4899', '#F472B6']} style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Commandes reçues</Text>
                    <Text style={styles.headerSub}>Validez les commandes via QR code</Text>
                </View>
                <TouchableOpacity style={styles.backButton} onPress={() => loadOrders(true)}>
                    <SafeIcon name="refresh-cw" size={20} color="#FFFFFF" type="lucide" />
                </TouchableOpacity>
            </LinearGradient>

            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <FlatList
                    data={FILTERS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={f => f.key ?? 'all'}
                    renderItem={({ item: f }) => (
                        <TouchableOpacity
                            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
                            onPress={() => setStatusFilter(f.key)}
                        >
                            <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#EC4899" />
                </View>
            ) : orders.length === 0 ? (
                <View style={styles.center}>
                    <SafeIcon name="inbox" size={56} color="#D1D5DB" type="lucide" />
                    <Text style={styles.emptyTitle}>Aucune commande</Text>
                    <Text style={styles.emptyText}>
                        {statusFilter
                            ? 'Aucune commande avec ce statut.'
                            : 'Vous n\'avez pas encore reçu de commandes.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={item => item.id}
                    renderItem={renderOrder}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#EC4899']} />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore
                            ? <ActivityIndicator size="small" color="#EC4899" style={{ marginVertical: 16 }} />
                            : null
                    }
                />
            )}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 20,
        gap: 12,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    filtersContainer: { paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: { backgroundColor: '#EC4899', borderColor: '#EC4899' },
    filterChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    filterChipTextActive: { color: '#FFFFFF' },
    listContent: { padding: 16, gap: 12 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardLeft: { flex: 1, marginRight: 12 },
    orderId: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
    modeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    modeText: { fontSize: 12, color: '#6B7280' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontSize: 12, fontWeight: '700' },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    amountText: { fontSize: 14, fontWeight: '600', color: '#059669', flex: 1 },
    dateText: { fontSize: 11, color: '#9CA3AF' },
    validateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#EC4899',
        borderRadius: 12,
        paddingVertical: 10,
    },
    validateButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 6 },
    doneText: { fontSize: 13, color: '#059669', fontWeight: '500' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 8 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

export default PharmacyPartnerOrdersScreen;
