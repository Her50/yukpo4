import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const AnnulationCovoiturageScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { bookingId, departureDate, amount } = route.params || {};
    const [policy, setPolicy] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => { loadPolicy(); }, []);

    const loadPolicy = async () => {
        try {
            const res = await apiGet(`/api/covoiturages/bookings/${bookingId}/cancellation-policy`);
            setPolicy(res?.data);
        } catch {
            const now = new Date();
            const dep = new Date(departureDate || Date.now() + 86400000 * 2);
            const hoursLeft = (dep.getTime() - now.getTime()) / 3600000;
            const refundPct = hoursLeft > 24 ? 100 : hoursLeft > 2 ? 50 : 0;
            setPolicy({ refund_percentage: refundPct, refund_amount: ((amount || 0) * refundPct) / 100, hours_left: Math.floor(hoursLeft) });
        } finally { setLoading(false); }
    };

    const handleCancel = async () => {
        Alert.alert('Confirmer l\'annulation', 'Cette action est irréversible.', [
            { text: 'Retour', style: 'cancel' },
            { text: 'Confirmer', style: 'destructive', onPress: async () => {
                setCancelling(true);
                try {
                    await apiPost(`/api/covoiturages/bookings/${bookingId}/cancel`, {});
                    Alert.alert('Annulation confirmée', `Remboursement de ${policy?.refund_amount?.toLocaleString() || 0} FCFA en cours.`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
                } catch { Alert.alert('Erreur', 'Impossible d\'annuler la réservation.'); }
                finally { setCancelling(false); }
            }},
        ]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    const pct = policy?.refund_percentage || 0;
    const color = pct === 100 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.policyCard}>
                <Text style={styles.policyTitle}>Politique d'annulation</Text>
                <View style={styles.policyRow}><Text style={styles.policyRule}>Annulation &gt; 24h avant :</Text><Text style={styles.policyValue100}>100% remboursé</Text></View>
                <View style={styles.policyRow}><Text style={styles.policyRule}>Entre 24h et 2h avant :</Text><Text style={styles.policyValue50}>50% remboursé</Text></View>
                <View style={styles.policyRow}><Text style={styles.policyRule}>Moins de 2h avant :</Text><Text style={styles.policyValue0}>0% remboursé</Text></View>
            </View>

            <View style={styles.refundCard}>
                <Text style={styles.refundLabel}>Montant qui vous sera remboursé</Text>
                <Text style={[styles.refundAmount, { color }]}>{policy?.refund_amount?.toLocaleString() || 0} FCFA</Text>
                <Text style={styles.refundPct}>{pct}% du montant payé</Text>
                {policy?.hours_left !== undefined && <Text style={styles.refundHours}>Départ dans environ {policy.hours_left}h</Text>}
            </View>

            {pct === 0 && (
                <View style={styles.warningCard}>
                    <SafeIcon name="alert-triangle" size={20} color="#B45309" />
                    <Text style={styles.warningText}>Aucun remboursement possible à moins de 2h du départ.</Text>
                </View>
            )}

            <TouchableOpacity style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]} onPress={handleCancel} disabled={cancelling}>
                <Text style={styles.cancelBtnText}>{cancelling ? 'Annulation...' : 'Confirmer l\'annulation'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backBtnText}>Retour sans annuler</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    policyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    policyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
    policyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    policyRule: { fontSize: 13, color: '#374151' },
    policyValue100: { fontSize: 13, fontWeight: '700', color: '#059669' },
    policyValue50: { fontSize: 13, fontWeight: '700', color: '#D97706' },
    policyValue0: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
    refundCard: { backgroundColor: '#fff', borderRadius: 12, padding: 24, marginBottom: 16, alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
    refundLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
    refundAmount: { fontSize: 36, fontWeight: '800' },
    refundPct: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
    refundHours: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
    warningCard: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 14, marginBottom: 16 },
    warningText: { flex: 1, fontSize: 13, color: '#92400E' },
    cancelBtn: { backgroundColor: '#DC2626', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    cancelBtnDisabled: { opacity: 0.6 },
    cancelBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    backBtn: { paddingVertical: 14, alignItems: 'center' },
    backBtnText: { fontSize: 15, color: '#6B7280' },
});

export default AnnulationCovoiturageScreen;
