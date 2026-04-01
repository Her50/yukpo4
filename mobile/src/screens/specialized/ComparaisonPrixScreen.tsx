import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

type Filter = 'all' | 'instock' | 'cheapest';

const ComparaisonPrixScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const [query, setQuery] = useState(route.params?.medicamentName || '');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const res = await apiGet('/api/pharmacies/products/compare', { params: { q: query.trim() } });
            setResults(res?.data || []);
        } catch { Alert.alert('Erreur', 'Recherche impossible.'); }
        finally { setLoading(false); }
    };

    const handleStockAlert = async (productId: number, pharmacyId: number) => {
        try {
            await apiPost(`/api/medicines/${productId}/stock-alert`, { pharmacy_id: pharmacyId });
            Alert.alert('Alerte créée', 'Vous serez notifié dès que le médicament sera disponible.');
        } catch { Alert.alert('Erreur', 'Impossible de créer l\'alerte.'); }
    };

    const filtered = results.filter(r => {
        if (filter === 'instock') return r.en_stock;
        if (filter === 'cheapest') return true;
        return true;
    }).sort((a, b) => filter === 'cheapest' ? (a.prix || 999999) - (b.prix || 999999) : 0);

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
                <Text style={styles.pharmacyName}>{item.pharmacie_nom || 'Pharmacie'}</Text>
                {item.en_stock
                    ? <View style={styles.stockBadge}><Text style={styles.stockText}>En stock</Text></View>
                    : <View style={styles.ruptureBadge}><Text style={styles.ruptureText}>Rupture</Text></View>}
            </View>
            <Text style={styles.distance}>{item.distance_km?.toFixed(1)} km · {item.quartier}</Text>
            <View style={styles.resultFooter}>
                <Text style={styles.price}>{item.prix ? `${item.prix.toLocaleString()} FCFA` : 'Prix non renseigné'}</Text>
                {item.en_stock
                    ? <TouchableOpacity style={styles.orderBtn} onPress={() => (navigation as any).navigate('PharmacieDetails', { serviceId: item.service_id })}>
                        <Text style={styles.orderBtnText}>Commander</Text>
                    </TouchableOpacity>
                    : <TouchableOpacity style={styles.alertBtn} onPress={() => handleStockAlert(item.product_id, item.pharmacy_id)}>
                        <SafeIcon name="bell" size={14} color={modernColors.primary} />
                        <Text style={styles.alertBtnText}>M'alerter</Text>
                    </TouchableOpacity>}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchBar}>
                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Nom du médicament..." returnKeyType="search" onSubmitEditing={handleSearch} />
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                    <SafeIcon name="search" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.scanBtn} onPress={() => (navigation as any).navigate('MedicamentScan', { onScan: (name: string) => setQuery(name) })}>
                    <SafeIcon name="camera" size={20} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {results.length > 0 && (
                <View style={styles.filterRow}>
                    {([['all', 'Tous'], ['instock', 'En stock'], ['cheapest', 'Moins cher']] as [Filter, string][]).map(([f, label]) => (
                        <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
                            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                    ))}
                    <Text style={styles.resultCount}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</Text>
                </View>
            )}

            {loading
                ? <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>
                : <FlatList data={filtered} renderItem={renderItem} keyExtractor={(_, i) => i.toString()} contentContainerStyle={styles.list}
                    ListEmptyComponent={!loading && query ? <View style={styles.center}><Text style={styles.emptyText}>Aucun résultat pour "{query}"</Text></View> : null} />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    searchBar: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    searchInput: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#F9FAFB' },
    searchBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: modernColors.primary, justifyContent: 'center', alignItems: 'center' },
    scanBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: modernColors.primary, justifyContent: 'center', alignItems: 'center' },
    filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6' },
    filterChipActive: { backgroundColor: modernColors.primary },
    filterChipText: { fontSize: 13, color: '#374151' },
    filterChipTextActive: { color: '#fff' },
    resultCount: { marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' },
    list: { padding: 16, gap: 12 },
    resultCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    pharmacyName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
    stockBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    stockText: { fontSize: 12, color: '#059669', fontWeight: '600' },
    ruptureBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    ruptureText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
    distance: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
    resultFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    price: { fontSize: 18, fontWeight: '700', color: modernColors.primary },
    orderBtn: { backgroundColor: modernColors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    orderBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    alertBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: modernColors.primary },
    alertBtnText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 14, color: '#9CA3AF' },
});

export default ComparaisonPrixScreen;
