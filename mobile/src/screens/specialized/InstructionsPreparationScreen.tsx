import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../../services/api';
import { notificationSchedulerService } from '../../services/notificationSchedulerService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const ICONS: Record<string, string> = {
    jeune: '🚫', eau: '💧', medicaments: '💊', alcool: '🍷', sport: '🏃', sommeil: '😴', default: '📋',
};

const InstructionsPreparationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { examinationTypeId, examinationName, appointmentDate } = route.params || {};
    const [instructions, setInstructions] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [reminderSet, setReminderSet] = useState(false);

    useEffect(() => { loadInstructions(); }, []);

    const loadInstructions = async () => {
        try {
            const res = await apiGet(`/api/laboratoires/examination-types/${examinationTypeId}/preparation`);
            setInstructions(res?.data);
        } catch {
            setInstructions({
                jeune_requis: true, duree_jeune_heures: 12,
                items: ['Ne pas manger pendant 12 heures avant', 'Boire uniquement de l\'eau', 'Éviter le sport la veille', 'Prendre vos médicaments habituels sauf indication'],
            });
        } finally { setLoading(false); }
    };

    const scheduleReminder = async () => {
        if (!appointmentDate) return;
        const reminderDate = new Date(appointmentDate);
        reminderDate.setDate(reminderDate.getDate() - 1);
        reminderDate.setHours(20, 0, 0, 0);
        await notificationSchedulerService.scheduleRDVReminder(reminderDate.toISOString(), `Préparation : ${examinationName}`, 'Pensez à suivre les instructions de préparation pour votre examen demain.', `prep_${examinationTypeId}`);
        setReminderSet(true);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} /></View>;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>Préparation requise</Text>
                <Text style={styles.subtitle}>{examinationName}</Text>
            </View>

            {instructions?.jeune_requis && (
                <View style={styles.alertCard}>
                    <Text style={styles.alertIcon}>⏱</Text>
                    <View>
                        <Text style={styles.alertTitle}>Jeûne obligatoire</Text>
                        <Text style={styles.alertText}>{instructions.duree_jeune_heures || 8}h avant l'examen — ne pas manger ni boire (sauf eau)</Text>
                    </View>
                </View>
            )}

            <View style={styles.instructionsList}>
                {(instructions?.items || []).map((item: string, i: number) => {
                    const key = Object.keys(ICONS).find(k => item.toLowerCase().includes(k)) || 'default';
                    return (
                        <View key={i} style={styles.instructionItem}>
                            <Text style={styles.instructionIcon}>{ICONS[key]}</Text>
                            <Text style={styles.instructionText}>{item}</Text>
                        </View>
                    );
                })}
            </View>

            {instructions?.notes && (
                <View style={styles.notesCard}>
                    <Text style={styles.notesTitle}>Notes importantes</Text>
                    <Text style={styles.notesText}>{instructions.notes}</Text>
                </View>
            )}

            {appointmentDate && (
                <TouchableOpacity
                    style={[styles.reminderBtn, reminderSet && styles.reminderBtnDone]}
                    onPress={!reminderSet ? scheduleReminder : undefined}
                >
                    <SafeIcon name={reminderSet ? 'check-circle' : 'bell'} size={18} color="#fff" />
                    <Text style={styles.reminderBtnText}>{reminderSet ? 'Rappel programmé !' : 'Programmer un rappel la veille'}</Text>
                </TouchableOpacity>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: '700', color: '#111827' },
    subtitle: { fontSize: 15, color: '#6B7280', marginTop: 4 },
    alertCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, marginBottom: 20 },
    alertIcon: { fontSize: 32 },
    alertTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
    alertText: { fontSize: 13, color: '#78350F', marginTop: 2 },
    instructionsList: { gap: 12, marginBottom: 20 },
    instructionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#fff', borderRadius: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    instructionIcon: { fontSize: 24, width: 32 },
    instructionText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
    notesCard: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 20 },
    notesTitle: { fontSize: 14, fontWeight: '700', color: '#1D4ED8', marginBottom: 6 },
    notesText: { fontSize: 13, color: '#1E40AF', lineHeight: 18 },
    reminderBtn: { backgroundColor: modernColors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12 },
    reminderBtnDone: { backgroundColor: '#059669' },
    reminderBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default InstructionsPreparationScreen;
