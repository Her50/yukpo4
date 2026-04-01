import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeNativeView } from '../../components/SafeNativeView';
import { pharmacyService } from '../../services/pharmacyService';

const PharmacyFinancialScreen: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);
    const [withdrawInput, setWithdrawInput] = useState('');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res: any = await pharmacyService.getFinancialMovements(80);
            const payload = res?.data ?? res;
            if (payload?.success) setData(payload);
        } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible de charger les mouvements financiers');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleWithdraw = async () => {
        const amountXaf = Number(withdrawInput || 0);
        if (!Number.isFinite(amountXaf) || amountXaf <= 0) {
            Alert.alert('Montant invalide', 'Entrez un montant correct.');
            return;
        }
        try {
            setLoading(true);
            const amountCents = Math.round(amountXaf * 100);
            const res: any = await pharmacyService.requestWithdrawal({ amount_cents: amountCents, method: 'mobile_money' });
            const payload = res?.data ?? res;
            if (payload?.success) {
                Alert.alert('Retrait', 'Demande de retrait enregistrée.');
                setWithdrawInput('');
                await loadData();
                return;
            }
            Alert.alert('Retrait', payload?.message || 'Échec de la demande de retrait');
        } catch (e: any) {
            Alert.alert('Retrait', e?.message || 'Erreur lors du retrait');
        } finally {
            setLoading(false);
        }
    };

    const walletBalanceCents = data?.summary?.wallet_balance_cents || 0;
    const orders = data?.orders || [];
    const walletMoves = data?.wallet_movements || [];

    return (
        <SafeNativeView style={styles.container}>
            <Text style={styles.title}>Finances Pharmacie</Text>
            <Text style={styles.balance}>Solde wallet: {(walletBalanceCents / 100).toLocaleString()} XAF</Text>

            <View style={styles.withdrawCard}>
                <Text style={styles.sectionTitle}>Retrait</Text>
                <TextInput
                    value={withdrawInput}
                    onChangeText={setWithdrawInput}
                    placeholder="Montant en XAF"
                    keyboardType="numeric"
                    style={styles.input}
                />
                <TouchableOpacity style={styles.button} onPress={handleWithdraw} disabled={loading}>
                    <Text style={styles.buttonText}>Demander un retrait</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Commandes payées récentes</Text>
            <FlatList
                data={orders}
                keyExtractor={(item: any, idx) => `${item?.id || idx}`}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
                renderItem={({ item }: any) => (
                    <View style={styles.row}>
                        <Text style={styles.rowTitle}>#{String(item.id || '').slice(0, 8)} - {item.status}</Text>
                        <Text style={styles.rowSub}>{item.total_amount} XAF</Text>
                    </View>
                )}
                ListFooterComponent={
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Mouvements wallet</Text>
                        {walletMoves.map((m: any) => (
                            <View style={styles.row} key={`w-${m.id}`}>
                                <Text style={styles.rowTitle}>{m.transaction_type}</Text>
                                <Text style={styles.rowSub}>{(m.amount_cents / 100).toLocaleString()} XAF</Text>
                            </View>
                        ))}
                    </>
                }
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
    title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    balance: { fontSize: 16, fontWeight: '700', color: '#16A34A', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 8, marginTop: 8 },
    withdrawCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 12 },
    input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF' },
    button: { marginTop: 10, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    buttonText: { color: '#FFFFFF', fontWeight: '700' },
    row: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, marginBottom: 8 },
    rowTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
    rowSub: { fontSize: 13, color: '#374151', marginTop: 2 },
});

export default PharmacyFinancialScreen;
