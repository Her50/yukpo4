import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { taxiService } from '../../services/taxiService';
import { notificationSchedulerService } from '../../services/notificationSchedulerService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const TaxiScheduledRideScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { taxiId, taxiName } = route.params || {};
    const [depart, setDepart] = useState('');
    const [arrivee, setArrivee] = useState('');
    const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 3600000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!depart.trim() || !arrivee.trim()) { Alert.alert('Champs requis', 'Veuillez indiquer départ et arrivée.'); return; }
        if (scheduledDate <= new Date()) { Alert.alert('Heure invalide', 'La course doit être planifiée dans le futur.'); return; }
        setLoading(true);
        try {
            await taxiService.scheduleTaxiRide(taxiId, { origin: depart, destination: arrivee, scheduled_at: scheduledDate.toISOString(), notes });
            // Rappel 30 min avant
            const reminderDate = new Date(scheduledDate.getTime() - 30 * 60 * 1000);
            await notificationSchedulerService.scheduleRDVReminder(reminderDate.toISOString(), 'Taxi dans 30 minutes', `Votre course planifiée vers ${arrivee} part bientôt.`);
            Alert.alert('Course planifiée !', `Votre taxi sera disponible le ${scheduledDate.toLocaleDateString('fr-FR')} à ${scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch { Alert.alert('Erreur', 'Impossible de planifier la course.'); }
        finally { setLoading(false); }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.infoCard}>
                <SafeIcon name="clock" size={22} color={modernColors.primary} />
                <View>
                    <Text style={styles.infoTitle}>Course planifiée</Text>
                    {taxiName && <Text style={styles.infoSub}>{taxiName}</Text>}
                </View>
            </View>

            <Text style={styles.label}>Adresse de départ *</Text>
            <TextInput style={styles.input} value={depart} onChangeText={setDepart} placeholder="Votre point de départ" />

            <Text style={styles.label}>Destination *</Text>
            <TextInput style={styles.input} value={arrivee} onChangeText={setArrivee} placeholder="Votre destination" />

            <Text style={styles.label}>Date et heure *</Text>
            <View style={styles.dateTimeRow}>
                <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
                    <SafeIcon name="calendar" size={16} color={modernColors.primary} />
                    <Text style={styles.dateTimeBtnText}>{scheduledDate.toLocaleDateString('fr-FR')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
                    <SafeIcon name="clock" size={16} color={modernColors.primary} />
                    <Text style={styles.dateTimeBtnText}>{scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
            </View>

            {showDatePicker && <DateTimePicker value={scheduledDate} mode="date" minimumDate={new Date()} onChange={(_, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setScheduledDate(prev => { const n = new Date(d); n.setHours(prev.getHours(), prev.getMinutes()); return n; }); }} />}
            {showTimePicker && <DateTimePicker value={scheduledDate} mode="time" onChange={(_, d) => { setShowTimePicker(Platform.OS === 'ios'); if (d) setScheduledDate(prev => { const n = new Date(prev); n.setHours(d.getHours(), d.getMinutes()); return n; }); }} />}

            <Text style={styles.label}>Notes (optionnel)</Text>
            <TextInput style={styles.textarea} value={notes} onChangeText={setNotes} placeholder="Instructions pour le chauffeur..." multiline numberOfLines={3} textAlignVertical="top" />

            <View style={styles.reminderNote}>
                <SafeIcon name="bell" size={14} color="#6B7280" />
                <Text style={styles.reminderNoteText}>Un rappel vous sera envoyé 30 minutes avant la course.</Text>
            </View>

            <TouchableOpacity style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]} onPress={handleConfirm} disabled={loading}>
                <Text style={styles.confirmBtnText}>{loading ? 'Planification...' : 'Confirmer la course planifiée'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    infoCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginBottom: 24 },
    infoTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8' },
    infoSub: { fontSize: 13, color: '#3B82F6', marginTop: 2 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14 },
    dateTimeRow: { flexDirection: 'row', gap: 12 },
    dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: modernColors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
    dateTimeBtnText: { fontSize: 14, color: modernColors.primary, fontWeight: '600' },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 14, minHeight: 80 },
    reminderNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginTop: 16 },
    reminderNoteText: { flex: 1, fontSize: 13, color: '#6B7280' },
    confirmBtn: { marginTop: 24, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    confirmBtnDisabled: { opacity: 0.6 },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default TaxiScheduledRideScreen;
