/**
 * WeekScheduleSelector - Sélecteur visuel de planning hebdomadaire
 * Permet de sélectionner les jours et plages horaires sans saisie manuelle
 */

import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lundi', short: 'Lun' },
    { value: 2, label: 'Mardi', short: 'Mar' },
    { value: 3, label: 'Mercredi', short: 'Mer' },
    { value: 4, label: 'Jeudi', short: 'Jeu' },
    { value: 5, label: 'Vendredi', short: 'Ven' },
    { value: 6, label: 'Samedi', short: 'Sam' },
    { value: 7, label: 'Dimanche', short: 'Dim' },
];

const TIME_SLOTS = [
    '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', // ✅ AJOUTÉ: Heures nocturnes
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

interface ScheduleDay {
    day: number;
    enabled: boolean;
    timeSlots: Array<{ start: string; end: string }>;
}

interface WeekScheduleSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (schedule: ScheduleDay[]) => void;
    initialSchedule?: ScheduleDay[];
    title?: string;
}

const WeekScheduleSelector: React.FC<WeekScheduleSelectorProps> = ({
    visible,
    onClose,
    onSave,
    initialSchedule,
    title = 'Planification hebdomadaire'
}) => {
    const [schedule, setSchedule] = useState<ScheduleDay[]>(
        initialSchedule || DAYS_OF_WEEK.map(day => ({
            day: day.value,
            enabled: false,
            timeSlots: []
        }))
    );

    const toggleDay = (dayValue: number) => {
        setSchedule(prev => prev.map(day =>
            day.day === dayValue
                ? { ...day, enabled: !day.enabled }
                : day
        ));
    };

    const addTimeSlot = (dayValue: number) => {
        setSchedule(prev => prev.map(day => {
            if (day.day === dayValue && day.enabled) {
                const newSlots = [...day.timeSlots, { start: '08:00', end: '17:00' }];
                return { ...day, timeSlots: newSlots };
            }
            return day;
        }));
    };

    const removeTimeSlot = (dayValue: number, slotIndex: number) => {
        setSchedule(prev => prev.map(day => {
            if (day.day === dayValue) {
                return {
                    ...day,
                    timeSlots: day.timeSlots.filter((_, idx) => idx !== slotIndex)
                };
            }
            return day;
        }));
    };

    const updateTimeSlot = (dayValue: number, slotIndex: number, field: 'start' | 'end', value: string) => {
        setSchedule(prev => prev.map(day => {
            if (day.day === dayValue) {
                const updatedSlots = day.timeSlots.map((slot, idx) =>
                    idx === slotIndex ? { ...slot, [field]: value } : slot
                );
                return { ...day, timeSlots: updatedSlots };
            }
            return day;
        }));
    };

    const handleSave = () => {
        const enabledDays = schedule.filter(day => day.enabled && day.timeSlots.length > 0);
        onSave(enabledDays);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {DAYS_OF_WEEK.map(dayInfo => {
                            const daySchedule = schedule.find(d => d.day === dayInfo.value);
                            if (!daySchedule) return null;

                            return (
                                <View key={dayInfo.value} style={styles.daySection}>
                                    <TouchableOpacity
                                        style={[
                                            styles.dayHeader,
                                            daySchedule.enabled && styles.dayHeaderEnabled
                                        ]}
                                        onPress={() => toggleDay(dayInfo.value)}
                                    >
                                        <View style={styles.dayHeaderLeft}>
                                            <View style={[
                                                styles.dayCheckbox,
                                                daySchedule.enabled && styles.dayCheckboxEnabled
                                            ]}>
                                                {daySchedule.enabled && (
                                                    <SafeIcon name="check" size={16} color="#fff" />
                                                )}
                                            </View>
                                            <Text style={[
                                                styles.dayLabel,
                                                daySchedule.enabled && styles.dayLabelEnabled
                                            ]}>
                                                {dayInfo.label}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {daySchedule.enabled && (
                                        <View style={styles.timeSlotsContainer}>
                                            {daySchedule.timeSlots.map((slot, slotIndex) => (
                                                <View key={slotIndex} style={styles.timeSlotRow}>
                                                    <View style={styles.timeInputs}>
                                                        <View style={styles.timeInput}>
                                                            <Text style={styles.timeLabel}>Début</Text>
                                                            <ScrollView
                                                                horizontal
                                                                showsHorizontalScrollIndicator={false}
                                                                style={styles.timePicker}
                                                            >
                                                                {TIME_SLOTS.map(time => (
                                                                    <TouchableOpacity
                                                                        key={time}
                                                                        style={[
                                                                            styles.timeOption,
                                                                            slot.start === time && styles.timeOptionSelected
                                                                        ]}
                                                                        onPress={() => updateTimeSlot(dayInfo.value, slotIndex, 'start', time)}
                                                                    >
                                                                        <Text style={[
                                                                            styles.timeOptionText,
                                                                            slot.start === time && styles.timeOptionTextSelected
                                                                        ]}>
                                                                            {time}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </ScrollView>
                                                        </View>
                                                        <View style={styles.timeInput}>
                                                            <Text style={styles.timeLabel}>Fin</Text>
                                                            <ScrollView
                                                                horizontal
                                                                showsHorizontalScrollIndicator={false}
                                                                style={styles.timePicker}
                                                            >
                                                                {TIME_SLOTS.map(time => (
                                                                    <TouchableOpacity
                                                                        key={time}
                                                                        style={[
                                                                            styles.timeOption,
                                                                            slot.end === time && styles.timeOptionSelected
                                                                        ]}
                                                                        onPress={() => updateTimeSlot(dayInfo.value, slotIndex, 'end', time)}
                                                                    >
                                                                        <Text style={[
                                                                            styles.timeOptionText,
                                                                            slot.end === time && styles.timeOptionTextSelected
                                                                        ]}>
                                                                            {time}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </ScrollView>
                                                        </View>
                                                    </View>
                                                    {daySchedule.timeSlots.length > 1 && (
                                                        <TouchableOpacity
                                                            style={styles.removeSlotButton}
                                                            onPress={() => removeTimeSlot(dayInfo.value, slotIndex)}
                                                        >
                                                            <SafeIcon name="trash-2" size={18} color="#DC2626" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            ))}
                                            <TouchableOpacity
                                                style={styles.addSlotButton}
                                                onPress={() => addTimeSlot(dayInfo.value)}
                                            >
                                                <SafeIcon name="plus" size={18} color={modernColors.primary} />
                                                <Text style={styles.addSlotText}>Ajouter une plage horaire</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                        >
                            <Text style={styles.saveButtonText}>Enregistrer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 16,
        maxHeight: 500,
    },
    daySection: {
        marginBottom: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    dayHeaderEnabled: {
        // Style pour jour activé
    },
    dayHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dayCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayCheckboxEnabled: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dayLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    dayLabelEnabled: {
        color: '#111827',
    },
    timeSlotsContainer: {
        marginTop: 12,
        gap: 12,
    },
    timeSlotRow: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    timeInputs: {
        gap: 12,
    },
    timeInput: {
        gap: 8,
    },
    timeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    timePicker: {
        maxHeight: 50,
    },
    timeOption: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
    },
    timeOptionSelected: {
        backgroundColor: modernColors.primary,
    },
    timeOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    timeOptionTextSelected: {
        color: '#fff',
    },
    removeSlotButton: {
        marginTop: 8,
        alignSelf: 'flex-end',
        padding: 4,
    },
    addSlotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderStyle: 'dashed',
        gap: 8,
    },
    addSlotText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    cancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    saveButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default WeekScheduleSelector;

