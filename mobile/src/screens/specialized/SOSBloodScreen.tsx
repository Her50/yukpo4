import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, FlatList, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const GROUPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const URGENCES = [
    { key: 'critical', label: 'CRITIQUE', color: '#DC2626', bg: '#FEE2E2' },
    { key: 'urgent', label: 'URGENT', color: '#D97706', bg: '#FEF3C7' },
    { key: 'normal', label: 'Normal', color: '#059669', bg: '#D1FAE5' },
];

const SOSBloodScreen: React.FC = () => {
    const navigation = useNavigation();
    const [form, setForm] = useState({ groupe_sanguin: 'O+', quantite: '2', hopital: '', message: '', urgency: 'urgent' });
    const [donors, setDonors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSend = async () => {
        if (!form.hopital.trim()) { Alert.alert('Champ requis', 'Veuillez indiquer le nom de l\'hôpital.'); return; }
        setLoading(true);
        try {
            await apiPost('/api/banques-sang/sos-requests', form);
            const res = await apiGet('/api/banques-sang/sos-requests/compatible-donors', { params: { groupe: form.groupe_sanguin } });
            setDonors(res?.data || []);
            setSent(true);
            Alert.alert('Alerte SOS envoyée', 'Les donneurs compatibles à proximité ont été notifiés.');
        } catch { Alert.alert('Erreur', 'Impossible d\'envoyer l\'alerte SOS.'); }
        finally { setLoading(false); }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.sosHeader}>
                <Text style={styles.sosIcon}>🆘</Text>
                <View>
                    <Text style={styles.sosTitle}>Alerte SOS Don de Sang</Text>
                    <Text style={styles.sosSubtitle}>Notifiez les donneurs compatibles en urgence</Text>
                </View>
            </View>

            <Text style={styles.label}>Groupe sanguin requis</Text>
            <View style={styles.groupesGrid}>
                {GROUPES.map(g => (
                    <TouchableOpacity key={g} style={[styles.groupeChip, form.groupe_sanguin === g && styles.groupeChipActive]} onPress={() => setForm(f => ({ ...f, groupe_sanguin: g }))}>
                        <Text style={[styles.groupeChipText, form.groupe_sanguin === g && styles.groupeChipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Niveau d'urgence</Text>
            <View style={styles.urgenceRow}>
                {URGENCES.map(u => (
                    <TouchableOpacity key={u.key} style={[styles.urgenceChip, { backgroundColor: form.urgency === u.key ? u.color : '#F3F4F6' }]} onPress={() => setForm(f => ({ ...f, urgency: u.key }))}>
                        <Text style={[styles.urgenceText, { color: form.urgency === u.key ? '#fff' : '#374151' }]}>{u.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Nombre de poches requises</Text>
            <View style={styles.qtyRow}>
                {['1', '2', '3', '4', '5+'].map(q => (
                    <TouchableOpacity key={q} style={[styles.qtyChip, form.quantite === q && styles.qtyChipActive]} onPress={() => setForm(f => ({ ...f, quantite: q }))}>
                        <Text style={[styles.qtyChipText, form.quantite === q && styles.qtyChipTextActive]}>{q}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Hôpital / Établissement *</Text>
            <TextInput style={styles.input} value={form.hopital} onChangeText={v => setForm(f => ({ ...f, hopital: v }))} placeholder="Nom de l'hôpital ou clinique" />

            <Text style={styles.label}>Message (optionnel)</Text>
            <TextInput style={styles.textarea} value={form.message} onChangeText={v => setForm(f => ({ ...f, message: v }))} placeholder="Informations complémentaires pour les donneurs..." multiline numberOfLines={3} textAlignVertical="top" />

            <TouchableOpacity style={[styles.sosBtn, loading && styles.sosBtnDisabled]} onPress={handleSend} disabled={loading || sent}>
                <SafeIcon name="alert-triangle" size={20} color="#fff" />
                <Text style={styles.sosBtnText}>{sent ? 'Alerte envoyée ✓' : loading ? 'Envoi en cours...' : 'LANCER L\'ALERTE SOS'}</Text>
            </TouchableOpacity>

            {donors.length > 0 && (
                <View style={styles.donorsSection}>
                    <Text style={styles.donorsTitle}>{donors.length} donneur{donors.length > 1 ? 's' : ''} compatible{donors.length > 1 ? 's' : ''} notifié{donors.length > 1 ? 's' : ''}</Text>
                    {donors.map((d, i) => (
                        <View key={i} style={styles.donorItem}>
                            <View style={styles.donorInfo}>
                                <Text style={styles.donorName}>{d.prenom || 'Donneur'} {d.nom?.[0] || ''}.</Text>
                                <Text style={styles.donorMeta}>Groupe {d.groupe_sanguin} · {d.distance_km?.toFixed(1) || '?'} km</Text>
                            </View>
                            {d.telephone && (
                                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${d.telephone}`)}>
                                    <SafeIcon name="phone" size={16} color="#fff" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    sosHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, marginBottom: 24 },
    sosIcon: { fontSize: 36 },
    sosTitle: { fontSize: 18, fontWeight: '700', color: '#991B1B' },
    sosSubtitle: { fontSize: 13, color: '#B91C1C', marginTop: 2 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 16 },
    groupesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    groupeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#fff', minWidth: 56, alignItems: 'center' },
    groupeChipActive: { borderColor: '#DC2626', backgroundColor: '#DC2626' },
    groupeChipText: { fontSize: 14, fontWeight: '700', color: '#374151' },
    groupeChipTextActive: { color: '#fff' },
    urgenceRow: { flexDirection: 'row', gap: 8 },
    urgenceChip: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    urgenceText: { fontSize: 13, fontWeight: '700' },
    qtyRow: { flexDirection: 'row', gap: 8 },
    qtyChip: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff', alignItems: 'center' },
    qtyChipActive: { borderColor: '#DC2626', backgroundColor: '#DC2626' },
    qtyChipText: { fontSize: 14, fontWeight: '700', color: '#374151' },
    qtyChipTextActive: { color: '#fff' },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14 },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 14, minHeight: 80 },
    sosBtn: { marginTop: 24, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 12 },
    sosBtnDisabled: { opacity: 0.6 },
    sosBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
    donorsSection: { marginTop: 24 },
    donorsTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    donorItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8 },
    donorInfo: { flex: 1 },
    donorName: { fontSize: 14, fontWeight: '600', color: '#111827' },
    donorMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
});

export default SOSBloodScreen;
