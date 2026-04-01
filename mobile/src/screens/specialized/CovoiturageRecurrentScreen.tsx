import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const CovoiturageRecurrentScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { prefill } = route.params || {};

    const [depart, setDepart] = useState(prefill?.depart || '');
    const [destination, setDestination] = useState(prefill?.destination || '');
    const [heureDepart, setHeureDepart] = useState('07:30');
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // weekdays by default
    const [places, setPlaces] = useState('2');
    const [contribution, setContribution] = useState('');
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleDay = (idx: number) => {
        setSelectedDays(d => d.includes(idx) ? d.filter(x => x !== idx) : [...d, idx].sort());
    };

    const handleSubmit = async () => {
        if (!depart.trim() || !destination.trim()) {
            Alert.alert('Champs requis', 'Veuillez indiquer départ et destination.');
            return;
        }
        if (selectedDays.length === 0) {
            Alert.alert('Jours requis', 'Sélectionnez au moins un jour de la semaine.');
            return;
        }
        setLoading(true);
        try {
            await apiPost('/api/covoiturages/recurrent', {
                depart: depart.trim(),
                destination: destination.trim(),
                heure_depart: heureDepart,
                jours_semaine: selectedDays,
                places_disponibles: parseInt(places) || 2,
                contribution_fcfa: parseFloat(contribution) || undefined,
                date_debut: dateDebut || undefined,
                date_fin: dateFin || undefined,
            });
            const joursLabel = selectedDays.map(d => JOURS[d]).join(', ');
            Alert.alert(
                'Trajet récurrent créé !',
                `Votre trajet ${depart} → ${destination} sera proposé chaque ${joursLabel} à ${heureDepart}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch {
            Alert.alert('Erreur', 'Impossible de créer le trajet récurrent.');
        } finally { setLoading(false); }
    };

    const totalSemaines = (() => {
        if (!dateDebut || !dateFin) return null;
        const d1 = new Date(dateDebut.split('/').reverse().join('-'));
        const d2 = new Date(dateFin.split('/').reverse().join('-'));
        const weeks = Math.ceil((d2.getTime() - d1.getTime()) / (7 * 86400000));
        return weeks > 0 ? weeks * selectedDays.length : null;
    })();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.infoCard}>
                <SafeIcon name="repeat" size={22} color={modernColors.primary} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>Trajet récurrent</Text>
                    <Text style={styles.infoSub}>Publiez votre trajet une fois, il sera proposé automatiquement chaque semaine.</Text>
                </View>
            </View>

            <Text style={styles.label}>Départ *</Text>
            <TextInput style={styles.input} value={depart} onChangeText={setDepart} placeholder="Adresse ou ville de départ" />

            <Text style={styles.label}>Destination *</Text>
            <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Adresse ou ville d'arrivée" />

            <Text style={styles.label}>Heure de départ *</Text>
            <TextInput style={styles.input} value={heureDepart} onChangeText={setHeureDepart} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />

            <Text style={styles.label}>Jours de la semaine *</Text>
            <View style={styles.daysRow}>
                {JOURS.map((j, i) => (
                    <TouchableOpacity
                        key={j}
                        style={[styles.dayBtn, selectedDays.includes(i) && styles.dayBtnActive]}
                        onPress={() => toggleDay(i)}
                    >
                        <Text style={[styles.dayBtnText, selectedDays.includes(i) && styles.dayBtnTextActive]}>{j}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {selectedDays.length > 0 && (
                <Text style={styles.daysSelected}>{selectedDays.map(d => JOURS_FULL[d]).join(', ')}</Text>
            )}

            <Text style={styles.label}>Places disponibles</Text>
            <View style={styles.placesRow}>
                {['1', '2', '3', '4'].map(p => (
                    <TouchableOpacity key={p} style={[styles.placesBtn, places === p && styles.placesBtnActive]} onPress={() => setPlaces(p)}>
                        <Text style={[styles.placesBtnText, places === p && styles.placesBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Contribution par passager (FCFA, optionnel)</Text>
            <TextInput style={styles.input} value={contribution} onChangeText={setContribution} placeholder="Ex: 2000" keyboardType="numeric" />

            <Text style={styles.sectionTitle}>Période de validité (optionnel)</Text>
            <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.labelSmall}>Début</Text>
                    <TextInput style={styles.input} value={dateDebut} onChangeText={setDateDebut} placeholder="JJ/MM/AAAA" keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.labelSmall}>Fin</Text>
                    <TextInput style={styles.input} value={dateFin} onChangeText={setDateFin} placeholder="JJ/MM/AAAA" keyboardType="numbers-and-punctuation" />
                </View>
            </View>

            {totalSemaines && (
                <View style={styles.summaryCard}>
                    <SafeIcon name="info" size={14} color="#1D4ED8" />
                    <Text style={styles.summaryText}>~{totalSemaines} trajets seront générés sur cette période.</Text>
                </View>
            )}

            <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Récapitulatif</Text>
                <Text style={styles.previewLine}><Text style={styles.previewKey}>Trajet : </Text>{depart || '—'} → {destination || '—'}</Text>
                <Text style={styles.previewLine}><Text style={styles.previewKey}>Heure : </Text>{heureDepart}</Text>
                <Text style={styles.previewLine}><Text style={styles.previewKey}>Jours : </Text>{selectedDays.length > 0 ? selectedDays.map(d => JOURS_FULL[d]).join(', ') : '—'}</Text>
                <Text style={styles.previewLine}><Text style={styles.previewKey}>Places : </Text>{places}</Text>
                {contribution ? <Text style={styles.previewLine}><Text style={styles.previewKey}>Contribution : </Text>{parseInt(contribution).toLocaleString()} FCFA</Text> : null}
            </View>

            <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
                <Text style={styles.submitBtnText}>{loading ? 'Création...' : 'Créer le trajet récurrent'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    infoCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginBottom: 24 },
    infoTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8', marginBottom: 4 },
    infoSub: { fontSize: 13, color: '#3B82F6' },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
    labelSmall: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14 },
    daysRow: { flexDirection: 'row', gap: 8 },
    dayBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: '#fff' },
    dayBtnActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    dayBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
    dayBtnTextActive: { color: '#fff' },
    daysSelected: { fontSize: 12, color: '#6B7280', marginTop: 8 },
    placesRow: { flexDirection: 'row', gap: 10 },
    placesBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: '#fff' },
    placesBtnActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    placesBtnText: { fontSize: 16, fontWeight: '700', color: '#374151' },
    placesBtnTextActive: { color: '#fff' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 24, marginBottom: 8 },
    dateRow: { flexDirection: 'row', gap: 12 },
    summaryCard: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, marginTop: 12 },
    summaryText: { flex: 1, fontSize: 13, color: '#1D4ED8' },
    previewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    previewTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
    previewLine: { fontSize: 13, color: '#374151', marginBottom: 6 },
    previewKey: { fontWeight: '600' },
    submitBtn: { marginTop: 24, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    cancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { fontSize: 15, color: '#6B7280' },
});

export default CovoiturageRecurrentScreen;
