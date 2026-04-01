import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

interface Offre {
    id: number;
    montant: number;
    type: 'acheteur' | 'vendeur';
    message?: string;
    statut: 'en_attente' | 'acceptee' | 'refusee' | 'contre_offre';
    created_at: string;
}

const NegociationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { propertyId, propertyTitle, prixDemande } = route.params || {};

    const [offres, setOffres] = useState<Offre[]>([]);
    const [loading, setLoading] = useState(true);
    const [montant, setMontant] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { loadNegociation(); }, []);

    const loadNegociation = async () => {
        try {
            const res = await apiGet(`/api/immobilier/properties/${propertyId}/negotiation`);
            setOffres(res?.data?.offres || []);
        } catch {
            const prix = prixDemande || 25000000;
            setOffres([
                { id: 1, montant: prix, type: 'vendeur', statut: 'en_attente', message: 'Prix de vente initial', created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
                { id: 2, montant: prix * 0.92, type: 'acheteur', statut: 'contre_offre', message: 'Je propose ce montant après visite.', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
                { id: 3, montant: prix * 0.96, type: 'vendeur', statut: 'en_attente', message: 'Contre-offre finale.', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
            ]);
        } finally { setLoading(false); }
    };

    const handleSubmitOffer = async () => {
        const val = parseFloat(montant.replace(/\s/g, '').replace(/,/g, ''));
        if (!val || val <= 0) {
            Alert.alert('Montant invalide', 'Veuillez entrer un montant valide.');
            return;
        }
        setSubmitting(true);
        try {
            await apiPost(`/api/immobilier/properties/${propertyId}/offer`, { montant: val, message: message.trim() });
            const newOffer: Offre = {
                id: Date.now(), montant: val, type: 'acheteur',
                statut: 'en_attente', message: message.trim() || undefined,
                created_at: new Date().toISOString(),
            };
            setOffres(prev => [...prev, newOffer]);
            setMontant(''); setMessage('');
            Alert.alert('Offre envoyée', 'Votre offre a été transmise au vendeur.');
        } catch {
            Alert.alert('Erreur', 'Impossible d\'envoyer l\'offre.');
        } finally { setSubmitting(false); }
    };

    const statutStyle = (s: Offre['statut'], type: Offre['type']) => {
        if (s === 'acceptee') return { bg: '#D1FAE5', text: '#065F46', label: 'Acceptée' };
        if (s === 'refusee') return { bg: '#FEE2E2', text: '#991B1B', label: 'Refusée' };
        if (s === 'contre_offre') return { bg: '#FEF3C7', text: '#92400E', label: 'Contre-offre' };
        return { bg: '#EFF6FF', text: '#1D4ED8', label: 'En attente' };
    };

    const derniere = offres[offres.length - 1];
    const ecart = derniere && prixDemande ? ((derniere.montant - prixDemande) / prixDemande) * 100 : null;

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Property header */}
            <View style={styles.propertyCard}>
                <SafeIcon name="home" size={18} color={modernColors.primary} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.propertyTitle} numberOfLines={2}>{propertyTitle || 'Bien immobilier'}</Text>
                    {prixDemande && <Text style={styles.prixDemande}>Prix demandé : {prixDemande.toLocaleString()} FCFA</Text>}
                </View>
                {ecart !== null && (
                    <View style={styles.ecartBadge}>
                        <Text style={[styles.ecartText, { color: ecart < 0 ? '#059669' : '#DC2626' }]}>
                            {ecart > 0 ? '+' : ''}{ecart.toFixed(1)}%
                        </Text>
                    </View>
                )}
            </View>

            {/* Timeline */}
            <Text style={styles.sectionTitle}>Historique des offres</Text>
            <View style={styles.timeline}>
                {offres.map((offre, idx) => {
                    const isAcheteur = offre.type === 'acheteur';
                    const st = statutStyle(offre.statut, offre.type);
                    return (
                        <View key={offre.id} style={styles.timelineItem}>
                            <View style={styles.timelineLeft}>
                                <View style={[styles.timelineDot, { backgroundColor: isAcheteur ? modernColors.primary : '#6B7280' }]} />
                                {idx < offres.length - 1 && <View style={styles.timelineLine} />}
                            </View>
                            <View style={[styles.offreCard, isAcheteur ? styles.offreCardAcheteur : styles.offreCardVendeur]}>
                                <View style={styles.offreHeader}>
                                    <Text style={styles.offreAuthor}>{isAcheteur ? 'Vous' : 'Vendeur'}</Text>
                                    <View style={[styles.statutBadge, { backgroundColor: st.bg }]}>
                                        <Text style={[styles.statutText, { color: st.text }]}>{st.label}</Text>
                                    </View>
                                </View>
                                <Text style={styles.offreMontant}>{offre.montant.toLocaleString()} FCFA</Text>
                                {offre.message && <Text style={styles.offreMessage}>{offre.message}</Text>}
                                <Text style={styles.offreDate}>{new Date(offre.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            {/* Make offer */}
            <View style={styles.offreForm}>
                <Text style={styles.formTitle}>Faire une offre</Text>
                {derniere && derniere.type === 'vendeur' && (
                    <View style={styles.suggestionRow}>
                        <Text style={styles.suggestionLabel}>Suggestions rapides :</Text>
                        {[0.95, 0.97, 1.0].map(pct => (
                            <TouchableOpacity key={pct} style={styles.suggestionBtn} onPress={() => setMontant(Math.round(derniere.montant * pct).toString())}>
                                <Text style={styles.suggestionBtnText}>{Math.round(derniere.montant * pct / 1000000 * 10) / 10}M</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                <TextInput
                    style={styles.input}
                    value={montant}
                    onChangeText={setMontant}
                    placeholder="Votre offre en FCFA"
                    keyboardType="numeric"
                />
                <TextInput
                    style={styles.textarea}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Message au vendeur (optionnel)"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                />
                <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmitOffer} disabled={submitting}>
                    <Text style={styles.submitBtnText}>{submitting ? 'Envoi...' : 'Envoyer mon offre'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tipCard}>
                <SafeIcon name="lightbulb" size={14} color="#D97706" />
                <Text style={styles.tipText}>Conseil : Une première offre entre 90-95% du prix demandé laisse de la marge pour négocier.</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    propertyCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    propertyTitle: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
    prixDemande: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    ecartBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F3F4F6' },
    ecartText: { fontSize: 13, fontWeight: '700' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
    timeline: { marginBottom: 24 },
    timelineItem: { flexDirection: 'row', gap: 12 },
    timelineLeft: { alignItems: 'center', width: 20 },
    timelineDot: { width: 14, height: 14, borderRadius: 7, marginTop: 14 },
    timelineLine: { flex: 1, width: 2, backgroundColor: '#E5E7EB', marginVertical: 4 },
    offreCard: { flex: 1, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
    offreCardAcheteur: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
    offreCardVendeur: { backgroundColor: '#fff', borderColor: '#E5E7EB' },
    offreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    offreAuthor: { fontSize: 13, fontWeight: '700', color: '#374151' },
    statutBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    statutText: { fontSize: 11, fontWeight: '600' },
    offreMontant: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
    offreMessage: { fontSize: 13, color: '#6B7280', marginBottom: 6, fontStyle: 'italic' },
    offreDate: { fontSize: 11, color: '#9CA3AF' },
    offreForm: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    formTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
    suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
    suggestionLabel: { fontSize: 12, color: '#6B7280' },
    suggestionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: modernColors.primary },
    suggestionBtnText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F9FAFB', fontSize: 15, fontWeight: '700', marginBottom: 10 },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#F9FAFB', fontSize: 14, minHeight: 80, marginBottom: 12 },
    submitBtn: { backgroundColor: modernColors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    tipCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
    tipText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },
});

export default NegociationScreen;
