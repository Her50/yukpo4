/**
 * P3 - Rappels prise de médicaments
 * Liste et gestion des rappels journaliers/hebdomadaires
 */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import {
    MedicamentReminder,
    notificationSchedulerService,
} from '../../services/notificationSchedulerService';
import { modernColors } from '../../theme/modernTheme';

const TIME_OPTIONS = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '13:00', '14:00', '16:00', '18:00', '20:00', '21:00', '22:00'];

const RappelsMedicamentsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();

    const [reminders, setReminders] = useState<MedicamentReminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form
    const [newName, setNewName] = useState('');
    const [selectedTimes, setSelectedTimes] = useState<string[]>(['08:00']);
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
    const [saving, setSaving] = useState(false);

    const loadReminders = useCallback(async () => {
        setLoading(true);
        try {
            const list = await notificationSchedulerService.getAllMedicamentReminders();
            setReminders(list || []);
        } catch (err) {
            console.warn('[RappelsMedicaments] loadReminders error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReminders();
    }, [loadReminders]);

    const handleToggle = async (reminder: MedicamentReminder) => {
        try {
            if (reminder.active) {
                await notificationSchedulerService.cancelMedicamentReminder(reminder.id);
            } else {
                await notificationSchedulerService.scheduleMedicamentReminder(
                    reminder.name,
                    reminder.times,
                    reminder.frequency,
                    reminder.id
                );
            }
            loadReminders();
        } catch (err) {
            Alert.alert('Erreur', 'Impossible de modifier le rappel.');
        }
    };

    const handleDelete = (reminder: MedicamentReminder) => {
        Alert.alert(
            'Supprimer le rappel',
            `Supprimer le rappel pour "${reminder.name}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        await notificationSchedulerService.cancelMedicamentReminder(reminder.id);
                        loadReminders();
                    },
                },
            ]
        );
    };

    const handleAdd = async () => {
        if (!newName.trim()) {
            Alert.alert('Champ requis', 'Veuillez entrer le nom du médicament.');
            return;
        }
        if (selectedTimes.length === 0) {
            Alert.alert('Heure requise', 'Sélectionnez au moins une heure de prise.');
            return;
        }
        setSaving(true);
        try {
            await notificationSchedulerService.scheduleMedicamentReminder(
                newName.trim(),
                selectedTimes,
                frequency
            );
            setModalVisible(false);
            setNewName('');
            setSelectedTimes(['08:00']);
            setFrequency('daily');
            loadReminders();
        } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Impossible d\'ajouter le rappel.');
        } finally {
            setSaving(false);
        }
    };

    const toggleTime = (time: string) => {
        setSelectedTimes(prev =>
            prev.includes(time)
                ? prev.filter(t => t !== time)
                : [...prev, time].sort()
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={20} color={modernColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Rappels médicaments</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setModalVisible(true)}
                >
                    <SafeIcon name="plus" size={22} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {/* Liste */}
            <FlatList
                data={reminders}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadReminders}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.empty}>
                            <SafeIcon name="bell-off" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>Aucun rappel</Text>
                            <Text style={styles.emptyText}>
                                Ajoutez vos médicaments pour ne jamais oublier une prise.
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyAddBtn}
                                onPress={() => setModalVisible(true)}
                            >
                                <Text style={styles.emptyAddText}>Ajouter un rappel</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <View style={[styles.card, !item.active && styles.cardInactive]}>
                        <View style={styles.cardMain}>
                            <View style={styles.cardIcon}>
                                <SafeIcon name="clock" size={22} color={item.active ? modernColors.primary : '#9CA3AF'} />
                            </View>
                            <View style={styles.cardInfo}>
                                <Text style={styles.cardName}>{item.name}</Text>
                                <Text style={styles.cardTimes}>
                                    {item.times.join(' · ')}
                                </Text>
                                <Text style={styles.cardFreq}>
                                    {item.frequency === 'daily' ? 'Quotidien' :
                                        item.frequency === 'weekly' ? 'Hebdomadaire' : 'Personnalisé'}
                                </Text>
                            </View>
                            <Switch
                                value={item.active}
                                onValueChange={() => handleToggle(item)}
                                trackColor={{ false: '#D1D5DB', true: `${modernColors.primary}80` }}
                                thumbColor={item.active ? modernColors.primary : '#9CA3AF'}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDelete(item)}
                        >
                            <SafeIcon name="trash-2" size={16} color="#EF4444" />
                            <Text style={styles.deleteBtnText}>Supprimer</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />

            {/* Modal d'ajout */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nouveau rappel</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <SafeIcon name="x" size={22} color={modernColors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.fieldLabel}>Nom du médicament *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Ex: Paracétamol 500mg..."
                                placeholderTextColor="#9CA3AF"
                                value={newName}
                                onChangeText={setNewName}
                            />

                            <Text style={styles.fieldLabel}>Fréquence</Text>
                            <View style={styles.freqRow}>
                                {(['daily', 'weekly'] as const).map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                                        onPress={() => setFrequency(f)}
                                    >
                                        <Text style={[
                                            styles.freqChipText,
                                            frequency === f && styles.freqChipTextActive,
                                        ]}>
                                            {f === 'daily' ? 'Quotidien' : 'Hebdomadaire'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>Heures de prise *</Text>
                            <View style={styles.timesGrid}>
                                {TIME_OPTIONS.map(time => (
                                    <TouchableOpacity
                                        key={time}
                                        style={[
                                            styles.timeChip,
                                            selectedTimes.includes(time) && styles.timeChipActive,
                                        ]}
                                        onPress={() => toggleTime(time)}
                                    >
                                        <Text style={[
                                            styles.timeChipText,
                                            selectedTimes.includes(time) && styles.timeChipTextActive,
                                        ]}>
                                            {time}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                            onPress={handleAdd}
                            disabled={saving}
                        >
                            <SafeIcon name="bell" size={18} color="#fff" />
                            <Text style={styles.saveBtnText}>
                                {saving ? 'Enregistrement...' : 'Activer le rappel'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.textPrimary,
    },
    addBtn: { padding: 4 },
    list: { padding: 16, gap: 12 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    cardInactive: { opacity: 0.6 },
    cardMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '700', color: modernColors.textPrimary },
    cardTimes: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    cardFreq: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    deleteBtnText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: modernColors.textPrimary },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32 },
    emptyAddBtn: {
        marginTop: 8,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    emptyAddText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: modernColors.textPrimary },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        marginTop: 12,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: modernColors.textPrimary,
    },
    freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    freqChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    freqChipActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    freqChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
    freqChipTextActive: { color: '#fff' },
    timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    timeChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    timeChipActive: { backgroundColor: '#EEF2FF', borderColor: modernColors.primary },
    timeChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    timeChipTextActive: { color: modernColors.primary, fontWeight: '700' },
    saveBtn: {
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default RappelsMedicamentsScreen;
