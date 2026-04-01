import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const RAISONS = [
    'Empêchement personnel',
    'Annulation du voyage par la compagnie',
    'Décès dans la famille',
    'Hospitalisation',
    'Problème de visa/documents',
    'Autre raison',
];

interface RefundPolicy {
    pourcentage: number;
    montant_rembourse: number;
    frais_annulation: number;
    delai_remboursement_jours: number;
    eligible: boolean;
    message?: string;
}

const RemboursementTicketScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { ticketId, trajet, dateDepart, montantPaye } = route.params || {};

    const [policy, setPolicy] = useState<RefundPolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [raisonSelectionnee, setRaisonSelectionnee] = useState('');
    const [justification, setJustification] = useState('');
    const [methodePaiement, setMethodePaiement] = useState<'mobile_money' | 'virement'>('mobile_money');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { loadPolicy(); }, []);

    const loadPolicy = async () => {
        try {
            const res = await apiGet(`/api/bus-tickets/${ticketId}/refund-policy`);
            setPolicy(res?.data);
        } catch {
            const now = new Date();
            const dep = new Date(dateDepart || Date.now() + 86400000 * 2);
            const hoursLeft = (dep.getTime() - now.getTime()) / 3600000;
            const montant = montantPaye || 10000;

            let pourcentage = 0;
            let frais = 0;
            if (hoursLeft > 48) { pourcentage = 100; frais = 500; }
            else if (hoursLeft > 24) { pourcentage = 75; frais = 1000; }
            else if (hoursLeft > 6) { pourcentage = 50; frais = 1500; }
            else { pourcentage = 0; }

            setPolicy({
                pourcentage,
                montant_rembourse: Math.max(0, (montant * pourcentage / 100) - frais),
                frais_annulation: frais,
                delai_remboursement_jours: 5,
                eligible: pourcentage > 0,
                message: pourcentage === 0 ? 'Aucun remboursement possible à moins de 6h du départ.' : undefined,
            });
        } finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        if (!raisonSelectionnee) { Alert.alert('Raison requise', 'Veuillez sélectionner une raison.'); return; }
        if (!policy?.eligible) { Alert.alert('Non éligible', 'Ce billet n\'est pas éligible au remboursement.'); return; }

        Alert.alert(
            'Confirmer la demande',
            `Remboursement de ${policy.montant_rembourse.toLocaleString()} FCFA sous ${policy.delai_remboursement_jours} jours ouvrés.`,
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Confirmer', onPress: async () => {
                    setSubmitting(true);
                    try {
                        await apiPost(`/api/bus-tickets/${ticketId}/refund`, {
                            raison: raisonSelectionnee,
                            justification: justification.trim(),
                            methode_remboursement: methodePaiement,
                        });
                        Alert.alert(
                            'Demande envoyée',
                            `Votre demande de remboursement a été enregistrée. Vous recevrez ${policy.montant_rembourse.toLocaleString()} FCFA sous ${policy.delai_remboursement_jours} jours ouvrés.`,
                            [{ text: 'OK', onPress: () => navigation.goBack() }]
                        );
                    } catch {
                        Alert.alert('Erreur', 'Impossible de soumettre la demande.');
                    } finally { setSubmitting(false); }
                }},
            ]
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    const pct = policy?.pourcentage || 0;
    const pctColor = pct >= 75 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Ticket info */}
            <View style={styles.ticketCard}>
                <SafeIcon name="ticket" size={16} color="#6B7280" />
                <View style={{ flex: 1 }}>
                    <Text style={styles.ticketTrajet}>{trajet || 'Votre trajet'}</Text>
                    {dateDepart && <Text style={styles.ticketDate}>{new Date(dateDepart).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>}
                    {montantPaye && <Text style={styles.ticketPrix}>{montantPaye.toLocaleString()} FCFA payés</Text>}
                </View>
            </View>

            {/* Refund amounts */}
            <View style={styles.refundCard}>
                <View style={styles.refundHeader}>
                    <Text style={styles.refundTitle}>Politique de remboursement</Text>
                </View>
                <View style={styles.policyGrid}>
                    <View style={styles.policyItem}><Text style={styles.policyWhen}>+48h avant</Text><Text style={[styles.policyPct, { color: '#059669' }]}>100%</Text></View>
                    <View style={styles.policyItem}><Text style={styles.policyWhen}>24h - 48h</Text><Text style={[styles.policyPct, { color: '#D97706' }]}>75%</Text></View>
                    <View style={styles.policyItem}><Text style={styles.policyWhen}>6h - 24h</Text><Text style={[styles.policyPct, { color: '#EF4444' }]}>50%</Text></View>
                    <View style={styles.policyItem}><Text style={styles.policyWhen}>-6h</Text><Text style={[styles.policyPct, { color: '#9CA3AF' }]}>0%</Text></View>
                </View>
            </View>

            {/* Current eligibility */}
            <View style={[styles.eligibilityCard, { borderColor: policy?.eligible ? '#A7F3D0' : '#FCA5A5' }]}>
                {policy?.eligible ? (
                    <>
                        <View style={styles.eligibilityHeader}>
                            <SafeIcon name="check-circle" size={20} color="#059669" />
                            <Text style={styles.eligibilityTitle}>Éligible au remboursement</Text>
                        </View>
                        <Text style={[styles.refundAmount, { color: pctColor }]}>{policy.montant_rembourse.toLocaleString()} FCFA</Text>
                        <Text style={styles.refundPct}>{pct}% du montant payé</Text>
                        {policy.frais_annulation > 0 && <Text style={styles.fraisText}>Frais de dossier : {policy.frais_annulation.toLocaleString()} FCFA déduits</Text>}
                        <Text style={styles.delaiText}>Délai : {policy.delai_remboursement_jours} jours ouvrés</Text>
                    </>
                ) : (
                    <>
                        <SafeIcon name="x-circle" size={20} color="#DC2626" />
                        <Text style={styles.nonEligibleText}>{policy?.message || 'Non éligible au remboursement.'}</Text>
                    </>
                )}
            </View>

            {policy?.eligible && (
                <>
                    {/* Reason */}
                    <Text style={styles.sectionTitle}>Raison de l'annulation *</Text>
                    {RAISONS.map(r => (
                        <TouchableOpacity key={r} style={[styles.raisonBtn, raisonSelectionnee === r && styles.raisonBtnActive]} onPress={() => setRaisonSelectionnee(r)}>
                            <View style={[styles.raisonRadio, raisonSelectionnee === r && styles.raisonRadioActive]}>
                                {raisonSelectionnee === r && <View style={styles.raisonRadioDot} />}
                            </View>
                            <Text style={[styles.raisonText, raisonSelectionnee === r && styles.raisonTextActive]}>{r}</Text>
                        </TouchableOpacity>
                    ))}

                    {/* Justification */}
                    <Text style={styles.sectionTitle}>Précisions (optionnel)</Text>
                    <TextInput
                        style={styles.textarea}
                        value={justification}
                        onChangeText={setJustification}
                        placeholder="Informations complémentaires..."
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    {/* Payment method */}
                    <Text style={styles.sectionTitle}>Méthode de remboursement</Text>
                    <View style={styles.methodRow}>
                        <TouchableOpacity style={[styles.methodBtn, methodePaiement === 'mobile_money' && styles.methodBtnActive]} onPress={() => setMethodePaiement('mobile_money')}>
                            <Text style={styles.methodEmoji}>📱</Text>
                            <Text style={[styles.methodText, methodePaiement === 'mobile_money' && styles.methodTextActive]}>Mobile Money</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.methodBtn, methodePaiement === 'virement' && styles.methodBtnActive]} onPress={() => setMethodePaiement('virement')}>
                            <Text style={styles.methodEmoji}>🏦</Text>
                            <Text style={[styles.methodText, methodePaiement === 'virement' && styles.methodTextActive]}>Virement bancaire</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
                        <Text style={styles.submitBtnText}>{submitting ? 'Envoi...' : 'Soumettre la demande'}</Text>
                    </TouchableOpacity>
                </>
            )}

            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backBtnText}>Retour</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    ticketCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    ticketTrajet: { fontSize: 15, fontWeight: '700', color: '#111827' },
    ticketDate: { fontSize: 13, color: '#6B7280', marginTop: 3, textTransform: 'capitalize' },
    ticketPrix: { fontSize: 14, fontWeight: '700', color: modernColors.primary, marginTop: 3 },
    refundCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
    refundHeader: { marginBottom: 12 },
    refundTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
    policyGrid: { flexDirection: 'row', gap: 8 },
    policyItem: { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10 },
    policyWhen: { fontSize: 10, color: '#6B7280', textAlign: 'center', marginBottom: 4 },
    policyPct: { fontSize: 16, fontWeight: '800' },
    eligibilityCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 2, alignItems: 'center', gap: 6 },
    eligibilityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    eligibilityTitle: { fontSize: 15, fontWeight: '700', color: '#059669' },
    refundAmount: { fontSize: 36, fontWeight: '800' },
    refundPct: { fontSize: 14, color: '#6B7280' },
    fraisText: { fontSize: 12, color: '#9CA3AF' },
    delaiText: { fontSize: 13, color: '#374151', fontWeight: '600' },
    nonEligibleText: { fontSize: 14, color: '#DC2626', textAlign: 'center', marginTop: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10, marginTop: 4 },
    raisonBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    raisonBtnActive: { borderColor: modernColors.primary, backgroundColor: '#F0F9FF' },
    raisonRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
    raisonRadioActive: { borderColor: modernColors.primary },
    raisonRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: modernColors.primary },
    raisonText: { fontSize: 14, color: '#374151' },
    raisonTextActive: { color: modernColors.primary, fontWeight: '600' },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 14, minHeight: 80, marginBottom: 8 },
    methodRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    methodBtn: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    methodBtnActive: { borderColor: modernColors.primary, backgroundColor: '#F0F9FF' },
    methodEmoji: { fontSize: 24 },
    methodText: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
    methodTextActive: { color: modernColors.primary },
    submitBtn: { marginTop: 16, backgroundColor: '#DC2626', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    backBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 14 },
    backBtnText: { fontSize: 15, color: '#6B7280' },
});

export default RemboursementTicketScreen;
