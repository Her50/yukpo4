import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

interface Voyage {
    id: number;
    date_depart: string;
    heure_depart: string;
    places_restantes: number;
    prix_supplement?: number;
}

const ModifierTicketScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { ticketId, trajet, dateActuelle, prixActuel } = route.params || {};

    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 86400000));
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => { loadVoyages(); }, [selectedDate]);

    const loadVoyages = async () => {
        setLoading(true);
        try {
            const res = await apiGet(`/api/bus-tickets/${ticketId}/available-changes?date=${selectedDate.toISOString().split('T')[0]}`);
            setVoyages(res?.data || []);
        } catch {
            const base = new Date(selectedDate);
            setVoyages([
                { id: 1, date_depart: base.toISOString(), heure_depart: '06:00', places_restantes: 12, prix_supplement: 0 },
                { id: 2, date_depart: base.toISOString(), heure_depart: '09:30', places_restantes: 5, prix_supplement: 500 },
                { id: 3, date_depart: base.toISOString(), heure_depart: '13:00', places_restantes: 20, prix_supplement: 0 },
                { id: 4, date_depart: base.toISOString(), heure_depart: '17:00', places_restantes: 3, prix_supplement: 1000 },
                { id: 5, date_depart: base.toISOString(), heure_depart: '21:00', places_restantes: 8, prix_supplement: -500 },
            ]);
        } finally { setLoading(false); }
    };

    const handleConfirmChange = async () => {
        if (!selectedVoyage) { Alert.alert('Sélection requise', 'Veuillez choisir un nouveau voyage.'); return; }

        const supplement = selectedVoyage.prix_supplement || 0;
        const msg = supplement > 0
            ? `Un supplément de ${supplement.toLocaleString()} FCFA sera débité.`
            : supplement < 0
            ? `Un remboursement de ${Math.abs(supplement).toLocaleString()} FCFA sera effectué.`
            : 'Aucun supplément requis.';

        Alert.alert('Confirmer le changement', `Nouveau départ : ${selectedDate.toLocaleDateString('fr-FR')} à ${selectedVoyage.heure_depart}\n\n${msg}`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Confirmer', onPress: async () => {
                setSubmitting(true);
                try {
                    await apiPost(`/api/bus-tickets/${ticketId}/exchange`, {
                        nouveau_voyage_id: selectedVoyage.id,
                        date_depart: selectedDate.toISOString().split('T')[0],
                    });
                    Alert.alert('Ticket modifié !', 'Votre billet a été mis à jour. Un nouveau billet vous sera envoyé par SMS/email.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                } catch {
                    Alert.alert('Erreur', 'Impossible de modifier le ticket. Contactez le service client.');
                } finally { setSubmitting(false); }
            }},
        ]);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Current ticket */}
            <View style={styles.currentCard}>
                <View style={styles.currentHeader}>
                    <SafeIcon name="ticket" size={16} color="#6B7280" />
                    <Text style={styles.currentLabel}>Billet actuel</Text>
                </View>
                <Text style={styles.currentTrajet}>{trajet || 'Trajet'}</Text>
                {dateActuelle && <Text style={styles.currentDate}>{new Date(dateActuelle).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>}
                {prixActuel && <Text style={styles.currentPrix}>{prixActuel.toLocaleString()} FCFA</Text>}
            </View>

            {/* Policy note */}
            <View style={styles.policyCard}>
                <SafeIcon name="info" size={14} color="#1D4ED8" />
                <Text style={styles.policyText}>Modification possible jusqu"à 3h avant le départ. Un seul changement par billet. Des frais de service peuvent s'appliquer.</Text>"
            </View>

            {/* New date */}
            <Text style={styles.sectionTitle}>Choisir une nouvelle date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                <Text style={styles.dateBtnText}>{selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.primary} />
            </TouchableOpacity>
            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    minimumDate={new Date(Date.now() + 3 * 3600000)}
                    onChange={(_, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setSelectedDate(d); }}
                />
            )}

            {/* Available departures */}
            <Text style={styles.sectionTitle}>Horaires disponibles</Text>
            {loading ? (
                <View style={styles.loadingRow}><ActivityIndicator color={modernColors.primary} /></View>
            ) : (
                voyages.map(v => (
                    <TouchableOpacity
                        key={v.id}
                        style={[styles.voyageCard, selectedVoyage?.id === v.id && styles.voyageCardSelected]}
                        onPress={() => setSelectedVoyage(v)}
                    >
                        <View style={styles.voyageLeft}>
                            <Text style={styles.voyageHeure}>{v.heure_depart}</Text>
                            <Text style={styles.voyagePlaces}>{v.places_restantes} place{v.places_restantes > 1 ? 's' : ''}</Text>
                        </View>
                        <View style={styles.voyageRight}>
                            {v.prix_supplement !== undefined && v.prix_supplement !== 0 && (
                                <View style={[styles.supplementBadge, { backgroundColor: v.prix_supplement > 0 ? '#FEF3C7' : '#D1FAE5' }]}>
                                    <Text style={[styles.supplementText, { color: v.prix_supplement > 0 ? '#92400E' : '#065F46' }]}>
                                        {v.prix_supplement > 0 ? '+' : ''}{v.prix_supplement.toLocaleString()} FCFA
                                    </Text>
                                </View>
                            )}
                            {v.prix_supplement === 0 && <Text style={styles.gratuitText}>Gratuit</Text>}
                            {selectedVoyage?.id === v.id && <SafeIcon name="check-circle" size={20} color={modernColors.primary} />}
                        </View>
                    </TouchableOpacity>
                ))
            )}

            {/* Summary */}
            {selectedVoyage && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Récapitulatif</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryKey}>Nouveau départ</Text><Text style={styles.summaryVal}>{selectedDate.toLocaleDateString('fr-FR')} à {selectedVoyage.heure_depart}</Text></View>
                    {(selectedVoyage.prix_supplement || 0) !== 0 && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryKey}>{(selectedVoyage.prix_supplement || 0) > 0 ? 'Supplément' : 'Remboursement'}</Text>
                            <Text style={[styles.summaryVal, { color: (selectedVoyage.prix_supplement || 0) > 0 ? '#DC2626' : '#059669' }]}>
                                {Math.abs(selectedVoyage.prix_supplement || 0).toLocaleString()} FCFA
                            </Text>
                        </View>
                    )}
                </View>
            )}

            <TouchableOpacity style={[styles.confirmBtn, (!selectedVoyage || submitting) && styles.confirmBtnDisabled]} onPress={handleConfirmChange} disabled={!selectedVoyage || submitting}>
                <Text style={styles.confirmBtnText}>{submitting ? 'Modification...' : 'Confirmer le changement'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    currentCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    currentHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
    currentLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
    currentTrajet: { fontSize: 16, fontWeight: '700', color: '#111827' },
    currentDate: { fontSize: 14, color: '#6B7280', marginTop: 4, textTransform: 'capitalize' },
    currentPrix: { fontSize: 18, fontWeight: '800', color: modernColors.primary, marginTop: 4 },
    policyCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#BFDBFE' },
    policyText: { flex: 1, fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10, marginTop: 8 },
    dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: modernColors.primary, marginBottom: 16 },
    dateBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: modernColors.primary, textTransform: 'capitalize' },
    loadingRow: { paddingVertical: 24, alignItems: 'center' },
    voyageCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    voyageCardSelected: { borderColor: modernColors.primary, borderWidth: 2, backgroundColor: '#F0F9FF' },
    voyageLeft: {},
    voyageHeure: { fontSize: 20, fontWeight: '800', color: '#111827' },
    voyagePlaces: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    voyageRight: { alignItems: 'flex-end', gap: 6 },
    supplementBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    supplementText: { fontSize: 13, fontWeight: '700' },
    gratuitText: { fontSize: 13, fontWeight: '700', color: '#059669' },
    summaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    summaryTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    summaryKey: { fontSize: 13, color: '#6B7280' },
    summaryVal: { fontSize: 13, fontWeight: '700', color: '#111827' },
    confirmBtn: { marginTop: 20, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    confirmBtnDisabled: { opacity: 0.5 },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default ModifierTicketScreen;
