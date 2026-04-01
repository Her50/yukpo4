import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { taxiService } from '../../services/taxiService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const statusColor: Record<string, string> = { completed: '#059669', cancelled: '#EF4444', ongoing: '#3B82F6' };
const statusLabel: Record<string, string> = { completed: 'Terminée', cancelled: 'Annulée', ongoing: 'En cours' };

const HistoriqueCoursesScreen: React.FC = () => {
    const navigation = useNavigation();
    const [rides, setRides] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => { loadRides(); }, []);

    const loadRides = async (p = 1) => {
        try {
            const res = await taxiService.getMyRidesHistory(p, 15);
            const items = res?.data || [];
            if (p === 1) setRides(items);
            else setRides(prev => [...prev, ...items]);
            setHasMore(items.length === 15);
            setPage(p);
        } catch { } finally { setLoading(false); }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.routeRow}>
                    <View style={styles.dotGreen} />
                    <Text style={styles.address} numberOfLines={1}>{item.departure_address || item.origin || 'Départ'}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                    <View style={styles.dotRed} />
                    <Text style={styles.address} numberOfLines={1}>{item.destination_address || item.destination || 'Arrivée'}</Text>
                </View>
            </View>
            <View style={styles.cardFooter}>
                <View>
                    <Text style={styles.date}>{item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</Text>
                    {item.driver_name && <Text style={styles.driver}>{item.driver_name}</Text>}
                </View>
                <View style={styles.right}>
                    {item.amount && <Text style={styles.amount}>{item.amount.toLocaleString()} FCFA</Text>}
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor[item.status] || '#6B7280'}20` }]}>
                        <Text style={[styles.statusText, { color: statusColor[item.status] || '#6B7280' }]}>{statusLabel[item.status] || item.status}</Text>
                    </View>
                </View>
            </View>
            <TouchableOpacity style={styles.repeatBtn} onPress={() => (navigation as any).navigate('TaxiBooking', { prefill: { departure: item.departure_address, destination: item.destination_address } })}>
                <SafeIcon name="repeat" size={14} color={modernColors.primary} />
                <Text style={styles.repeatBtnText}>Reprendre ce trajet</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <FlatList
            data={rides}
            renderItem={renderItem}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={styles.list}
            style={styles.container}
            refreshing={loading && page === 1}
            onRefresh={() => loadRides(1)}
            onEndReached={() => { if (hasMore && !loading) loadRides(page + 1); }}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={!loading ? <View style={styles.empty}><SafeIcon name="car" size={48} color="#D1D5DB" /><Text style={styles.emptyText}>Aucune course effectuée</Text></View> : null}
        />
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    list: { padding: 16, gap: 12 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    cardHeader: { marginBottom: 12 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    routeLine: { width: 2, height: 16, backgroundColor: '#E5E7EB', marginLeft: 6, marginVertical: 2 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
    address: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    date: { fontSize: 13, color: '#6B7280' },
    driver: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    right: { alignItems: 'flex-end', gap: 4 },
    amount: { fontSize: 16, fontWeight: '700', color: modernColors.primary },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    statusText: { fontSize: 11, fontWeight: '600' },
    repeatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    repeatBtnText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyText: { fontSize: 14, color: '#9CA3AF' },
});

export default HistoriqueCoursesScreen;
