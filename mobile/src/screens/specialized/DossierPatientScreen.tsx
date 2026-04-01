import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { dossierPatientService, DossierPatient } from '../../services/dossierPatientService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const GROUPES_SANGUINS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const DossierPatientScreen: React.FC = () => {
    const [dossier, setDossier] = useState<DossierPatient>({
        groupe_sanguin: '', allergies: [], antecedents: '', traitements_en_cours: '',
        contact_urgence_nom: '', contact_urgence_telephone: '', partage_avec_medecin: false,
    });
    const [newAllergie, setNewAllergie] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        dossierPatientService.getDossier().then(d => { setDossier(d); setLoading(false); });
    }, []);

    const addAllergie = () => {
        if (!newAllergie.trim()) return;
        setDossier(d => ({ ...d, allergies: [...d.allergies, newAllergie.trim()] }));
        setNewAllergie('');
    };

    const removeAllergie = (idx: number) => {
        setDossier(d => ({ ...d, allergies: d.allergies.filter((_, i) => i !== idx) }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await dossierPatientService.updateDossier(dossier);
            Alert.alert('Enregistré', 'Votre dossier patient a été mis à jour.');
        } catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
        finally { setSaving(false); }
    };

    if (loading) return <View style={styles.center}><Text>Chargement...</Text></View>;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Groupe sanguin</Text>
            <View style={styles.pickerWrap}>
                <Picker selectedValue={dossier.groupe_sanguin} onValueChange={v => setDossier(d => ({ ...d, groupe_sanguin: v }))}>
                    {GROUPES_SANGUINS.map(g => <Picker.Item key={g} label={g || 'Non renseigné'} value={g} />)}
                </Picker>
            </View>

            <Text style={styles.sectionTitle}>Allergies</Text>
            <View style={styles.chipsWrap}>
                {dossier.allergies.map((a, i) => (
                    <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{a}</Text>
                        <TouchableOpacity onPress={() => removeAllergie(i)}>
                            <SafeIcon name="x" size={14} color="#374151" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
            <View style={styles.addRow}>
                <TextInput style={styles.addInput} value={newAllergie} onChangeText={setNewAllergie} placeholder="Ex: Pénicilline, Arachides..." />
                <TouchableOpacity style={styles.addBtn} onPress={addAllergie}>
                    <SafeIcon name="plus" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Antécédents médicaux</Text>
            <TextInput style={styles.textarea} value={dossier.antecedents} onChangeText={v => setDossier(d => ({ ...d, antecedents: v }))} placeholder="Ex: Diabète type 2, Hypertension..." multiline numberOfLines={3} textAlignVertical="top" />

            <Text style={styles.sectionTitle}>Traitements en cours</Text>
            <TextInput style={styles.textarea} value={dossier.traitements_en_cours} onChangeText={v => setDossier(d => ({ ...d, traitements_en_cours: v }))} placeholder="Ex: Metformine 1g matin et soir..." multiline numberOfLines={3} textAlignVertical="top" />

            <Text style={styles.sectionTitle}>Contact d'urgence</Text>
            <TextInput style={styles.input} value={dossier.contact_urgence_nom} onChangeText={v => setDossier(d => ({ ...d, contact_urgence_nom: v }))} placeholder="Nom" />
            <TextInput style={[styles.input, { marginTop: 8 }]} value={dossier.contact_urgence_telephone} onChangeText={v => setDossier(d => ({ ...d, contact_urgence_telephone: v }))} placeholder="Téléphone" keyboardType="phone-pad" />

            <TouchableOpacity style={styles.shareToggle} onPress={() => setDossier(d => ({ ...d, partage_avec_medecin: !d.partage_avec_medecin }))}>
                <View style={[styles.toggle, dossier.partage_avec_medecin && styles.toggleActive]}>
                    <View style={[styles.toggleThumb, dossier.partage_avec_medecin && styles.toggleThumbActive]} />
                </View>
                <Text style={styles.shareLabel}>Partager avec mes médecins</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Enregistrement...' : 'Enregistrer le dossier'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 10 },
    pickerWrap: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 6 },
    chipText: { fontSize: 13, color: '#1D4ED8' },
    addRow: { flexDirection: 'row', gap: 8 },
    addInput: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14 },
    addBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: modernColors.primary, justifyContent: 'center', alignItems: 'center' },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', minHeight: 80, backgroundColor: '#fff' },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14 },
    shareToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
    toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#D1D5DB', justifyContent: 'center', paddingHorizontal: 2 },
    toggleActive: { backgroundColor: modernColors.primary },
    toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
    toggleThumbActive: { alignSelf: 'flex-end' },
    shareLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
    saveBtn: { marginTop: 32, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default DossierPatientScreen;
