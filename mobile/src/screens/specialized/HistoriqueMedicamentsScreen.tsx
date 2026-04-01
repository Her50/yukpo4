import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

type Period = '1m' | '3m' | 'all';

const HistoriqueMedicamentsScreen: React.FC = () => {
    const [history, setHistory] = useState<any[]>([]);
    const [period, setPeriod] = useState<Period>('3m');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadHistory(); }, [period]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await apiGet('/api/users/medication-history', { params: { period } });
            setHistory(res?.data || []);
        } catch { setHistory([]); }
        finally { setLoading(false); }
    };

    const exportPDF = async () => {
        const rows = history.map(h => `<tr><td>${h.nom || h.medication_name}</td><td>${h.date ? new Date(h.date).toLocaleDateString('fr-FR') : 'N/A'}</td><td>${h.pharmacie || '-'}</td></tr>`).join('');
        const html = `<html><body><h2>Historique médicaments</h2><table border="1" style="width:100%;border-collapse:collapse"><tr><th>Médicament</th><th>Date</th><th>Pharmacie</th></tr>${rows}</table></body></html>`;
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.item}>
            <View style={styles.iconWrap}><Text style={styles.icon}>💊</Text></View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.nom || item.medication_name || 'Médicament'}</Text>
                <Text style={styles.itemMeta}>{item.pharmacie || 'Pharmacie'} · {item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-'}</Text>
                {item.ordonnance_id && <Text style={styles.itemBadge}>📋 Sur ordonnance</Text>}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.filters}>
                    {(['1m', '3m', 'all'] as Period[]).map(p => (
                        <TouchableOpacity key={p} style={[styles.filterBtn, period === p && styles.filterBtnActive]} onPress={() => setPeriod(p)}>
                            <Text style={[styles.filterBtnText, period === p && styles.filterBtnTextActive]}>{p === '1m' ? '1 mois' : p === '3m' ? '3 mois' : 'Tout'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={styles.exportBtn} onPress={exportPDF}>
                    <SafeIcon name="download" size={16} color={modernColors.primary} />
                    <Text style={styles.exportBtnText}>PDF</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={history}
                renderItem={renderItem}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<View style={styles.empty}><SafeIcon name="inbox" size={48} color="#D1D5DB" /><Text style={styles.emptyText}>{loading ? 'Chargement...' : 'Aucun médicament trouvé'}</Text></View>}
                refreshing={loading}
                onRefresh={loadHistory}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    filters: { flexDirection: 'row', gap: 8 },
    filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6' },
    filterBtnActive: { backgroundColor: modernColors.primary },
    filterBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    filterBtnTextActive: { color: '#fff' },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: modernColors.primary },
    exportBtnText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },
    list: { padding: 16, gap: 12 },
    item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    icon: { fontSize: 22 },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
    itemMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    itemBadge: { fontSize: 12, color: '#059669', marginTop: 4 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 14, color: '#9CA3AF' },
});

export default HistoriqueMedicamentsScreen;
