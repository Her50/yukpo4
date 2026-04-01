import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const CollecteADomicileScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { laboratoryId, laboratoryName } = route.params || {};
    const [examinationTypes, setExaminationTypes] = useState<any[]>([]);
    const [slots, setSlots] = useState<string[]>([]);
    const [form, setForm] = useState({ examination_type_id: '', address: '', date: '', slot: '', notes: '' });
    const [loading, setLoading] = useState(false);

    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() + i + 1);
        return d.toISOString().split('T')[0];
    });

    useEffect(() => {
        apiGet(`/api/laboratoires/${laboratoryId}/examination-types`).then(r => setExaminationTypes(r?.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (form.date) {
            apiGet(`/api/laboratoires/${laboratoryId}/home-collection/slots`, { params: { date: form.date } })
                .then(r => setSlots(r?.data || ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']))
                .catch(() => setSlots(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']));
        }
    }, [form.date]);

    const handleSubmit = async () => {
        if (!form.examination_type_id || !form.address || !form.date || !form.slot) {
            Alert.alert('Formulaire incomplet', 'Veuillez remplir tous les champs obligatoires.'); return;
        }
        setLoading(true);
        try {
            await apiPost(`/api/laboratoires/${laboratoryId}/home-collection`, {
                ...form, scheduled_at: `${form.date}T${form.slot}:00`,
            });
            Alert.alert('Demande envoyée', 'Un technicien viendra à votre domicile au créneau choisi.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch { Alert.alert('Erreur', 'Impossible de créer la demande.'); }
        finally { setLoading(false); }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.infoCard}>
                <SafeIcon name="home" size={24} color={modernColors.primary} />
                <View style={styles.infoText}>
                    <Text style={styles.infoTitle}>Collecte à domicile</Text>
                    <Text style={styles.infoSubtitle}>{laboratoryName} · Un technicien se déplace chez vous</Text>
                </View>
            </View>

            <Text style={styles.label}>Type d'examen *</Text>
            <View style={styles.optionsGrid}>
                {(examinationTypes.length > 0 ? examinationTypes : [
                    { id: '1', nom: 'Prise de sang' }, { id: '2', nom: 'Bilan complet' },
                    { id: '3', nom: 'NFS' }, { id: '4', nom: 'Glycémie' },
                ]).map(t => (
                    <TouchableOpacity key={t.id} style={[styles.optionChip, form.examination_type_id === String(t.id) && styles.optionChipActive]} onPress={() => setForm(f => ({ ...f, examination_type_id: String(t.id) }))}>
                        <Text style={[styles.optionChipText, form.examination_type_id === String(t.id) && styles.optionChipTextActive]}>{t.nom}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Adresse de collecte *</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} placeholder="Quartier, rue, numéro de porte..." />

            <Text style={styles.label}>Date *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll} contentContainerStyle={{ gap: 8 }}>
                {dates.map(d => {
                    const label = new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                    return (
                        <TouchableOpacity key={d} style={[styles.dateChip, form.date === d && styles.dateChipActive]} onPress={() => setForm(f => ({ ...f, date: d, slot: '' }))}>
                            <Text style={[styles.dateChipText, form.date === d && styles.dateChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {form.date && slots.length > 0 && (<>
                <Text style={styles.label}>Créneau horaire *</Text>
                <View style={styles.slotsGrid}>
                    {slots.map(s => (
                        <TouchableOpacity key={s} style={[styles.slotChip, form.slot === s && styles.slotChipActive]} onPress={() => setForm(f => ({ ...f, slot: s }))}>
                            <Text style={[styles.slotChipText, form.slot === s && styles.slotChipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </>)}

            <Text style={styles.label}>Notes (optionnel)</Text>
            <TextInput style={styles.textarea} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Instructions d'accès, étage, interphone..." multiline numberOfLines={3} textAlignVertical="top" />

            <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
                <Text style={styles.submitBtnText}>{loading ? 'Envoi...' : 'Confirmer la collecte à domicile'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    infoCard: { flexDirection: 'row', gap: 14, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, marginBottom: 24, alignItems: 'center' },
    infoText: { flex: 1 },
    infoTitle: { fontSize: 16, fontWeight: '700', color: '#1D4ED8' },
    infoSubtitle: { fontSize: 13, color: '#3B82F6', marginTop: 2 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 16 },
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
    optionChipActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    optionChipText: { fontSize: 13, color: '#374151' },
    optionChipTextActive: { color: '#fff' },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14, color: '#111827' },
    datesScroll: { marginBottom: 4 },
    dateChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
    dateChipActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    dateChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    dateChipTextActive: { color: '#fff' },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
    slotChipActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    slotChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
    slotChipTextActive: { color: '#fff' },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 14, minHeight: 80 },
    submitBtn: { marginTop: 28, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default CollecteADomicileScreen;
