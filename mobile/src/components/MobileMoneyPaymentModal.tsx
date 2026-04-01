/**
 * Modal paiement Mobile Money - MTN MoMo & Orange Money (Cameroun)
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SafeIcon from './SafeIcon';
import { apiGet, apiPost } from '../services/api';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: (paymentId: number, transactionRef: string) => void;
    amount: number;
    reservationId?: number;
    currency?: string;
}

const PROVIDERS = [
    { key: 'mtn', label: 'MTN MoMo', color: '#FCD34D', bg: '#FFFBEB' },
    { key: 'orange', label: 'Orange Money', color: '#F97316', bg: '#FFF7ED' },
];

const MobileMoneyPaymentModal: React.FC<Props> = ({
    visible, onClose, onSuccess, amount, reservationId, currency = 'XAF',
}) => {
    const [provider, setProvider] = useState<'mtn' | 'orange'>('mtn');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
    const [txRef, setTxRef] = useState('');
    const [ussdCode, setUssdCode] = useState('');

    const reset = () => { setStep('form'); setPhone(''); setTxRef(''); setUssdCode(''); };

    const handlePay = async () => {
        if (phone.replace(/[^0-9]/g, '').length < 9) {
            Alert.alert('Numéro invalide', 'Entrez votre numéro complet (9 chiffres).');
            return;
        }
        try {
            setLoading(true);
            const res = await apiPost('/api/payments/mobile-money', {
                reservation_id: reservationId,
                amount,
                phone_number: phone,
                provider,
                currency,
            });
            const data = (res?.data || res) as any;
            if (data?.success) {
                const pid = data.payment?.payment_id;
                setTxRef(data.payment?.transaction_ref || '');
                setUssdCode(data.payment?.ussd_code || '');
                setStep('processing');
                pollStatus(pid);
            } else {
                Alert.alert('Erreur', data?.error || 'Paiement impossible.');
            }
        } catch (err: any) {
            Alert.alert('Erreur', err?.message || 'Erreur réseau.');
        } finally {
            setLoading(false);
        }
    };

    const pollStatus = (pid: number) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await apiGet('/api/payments/' + pid + '/status');
                const data = (res?.data || res) as any;
                if (data?.payment?.status === 'completed') {
                    clearInterval(interval);
                    setStep('success');
                    onSuccess(pid, data.payment.transaction_ref);
                } else if (data?.payment?.status === 'failed' || attempts >= 10) {
                    clearInterval(interval);
                    if (data?.payment?.status === 'failed') {
                        Alert.alert('Échec', data?.payment?.error_message || 'Paiement échoué.');
                        setStep('form');
                    }
                }
            } catch { }
        }, 3000);
    };

    const sel = PROVIDERS.find(p => p.key === provider)!;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={st.overlay}>
                <View style={st.sheet}>
                    <View style={st.header}>
                        <Text style={st.title}>Paiement Mobile Money</Text>
                        <TouchableOpacity onPress={() => { reset(); onClose(); }}>
                            <SafeIcon name="x" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {step === 'form' && (
                        <>
                            <View style={st.amountBadge}>
                                <Text style={st.amountLabel}>Montant</Text>
                                <Text style={st.amountValue}>{amount.toLocaleString()} {currency}</Text>
                            </View>
                            <Text style={st.label}>Opérateur</Text>
                            <View style={st.providerRow}>
                                {PROVIDERS.map(p => (
                                    <TouchableOpacity
                                        key={p.key}
                                        style={[st.providerCard, provider === p.key && {
                                            borderColor: p.color, borderWidth: 2, backgroundColor: p.bg,
                                        }]}
                                        onPress={() => setProvider(p.key as 'mtn' | 'orange')}
                                    >
                                        <View style={[st.dot, { backgroundColor: p.color }]} />
                                        <Text style={[st.providerName, provider === p.key && { color: p.color, fontWeight: '700' }]}>
                                            {p.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={st.label}>Numéro {sel.label}</Text>
                            <View style={st.phoneRow}>
                                <View style={st.prefix}><Text style={st.prefixText}>+237</Text></View>
                                <TextInput
                                    style={st.phoneInput}
                                    placeholder="6XX XXX XXX"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    maxLength={12}
                                />
                            </View>
                            <TouchableOpacity
                                style={[st.payBtn, { backgroundColor: sel.color }, loading && { opacity: 0.6 }]}
                                onPress={handlePay}
                                disabled={loading}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" />
                                    : <SafeIcon name="credit-card" size={18} color="#fff" />}
                                <Text style={st.payBtnText}>
                                    {loading ? 'Traitement...' : `Payer ${amount.toLocaleString()} ${currency}`}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'processing' && (
                        <View style={st.center}>
                            <ActivityIndicator size="large" color={sel.color} />
                            <Text style={st.procTitle}>En attente de confirmation</Text>
                            <Text style={st.procText}>Confirmez le paiement sur votre téléphone.</Text>
                            {!!ussdCode && <Text style={st.ussd}>Code USSD : {ussdCode}</Text>}
                            <Text style={st.ref}>Réf : {txRef}</Text>
                        </View>
                    )}

                    {step === 'success' && (
                        <View style={st.center}>
                            <SafeIcon name="check-circle" size={56} color="#10B981" />
                            <Text style={st.successTitle}>Paiement confirmé !</Text>
                            <Text style={st.successText}>Votre réservation est payée.</Text>
                            <Text style={st.ref}>Réf : {txRef}</Text>
                            <TouchableOpacity style={st.doneBtn} onPress={() => { reset(); onClose(); }}>
                                <Text style={st.doneBtnText}>Fermer</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const st = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 18, fontWeight: '700', color: '#111827' },
    amountBadge: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
    amountLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
    amountValue: { fontSize: 28, fontWeight: '800', color: '#065F46' },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
    providerRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    providerCard: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, alignItems: 'center', gap: 4 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    providerName: { fontSize: 13, color: '#374151' },
    phoneRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, overflow: 'hidden', marginBottom: 20 },
    prefix: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, justifyContent: 'center' },
    prefixText: { fontSize: 14, color: '#374151', fontWeight: '600' },
    phoneInput: { flex: 1, fontSize: 16, padding: 12, color: '#111827' },
    payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
    payBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    center: { alignItems: 'center', paddingVertical: 24, gap: 12 },
    procTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    procText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
    ussd: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 8 },
    ref: { fontSize: 11, color: '#9CA3AF' },
    successTitle: { fontSize: 22, fontWeight: '800', color: '#065F46' },
    successText: { fontSize: 14, color: '#047857' },
    doneBtn: { marginTop: 12, backgroundColor: '#10B981', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
    doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default MobileMoneyPaymentModal;
