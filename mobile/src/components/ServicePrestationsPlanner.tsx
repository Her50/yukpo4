/**
 * ServicePrestationsPlanner - Planificateur de prestations avec jours et horaires
 * Permet de planifier chaque prestation avec ses jours et plages horaires spécifiques
 */

import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

interface PrestationSchedule {
    prestation: string;
    days: number[];
    timeSlots: Array<{ start: string; end: string }>;
}

interface ServicePrestationsPlannerProps {
    visible: boolean;
    onClose: () => void;
    onSave: (schedules: PrestationSchedule[]) => void;
    prestations: string[];
    initialSchedules?: PrestationSchedule[];
    title?: string;
}

const ServicePrestationsPlanner: React.FC<ServicePrestationsPlannerProps> = ({
    visible,
    onClose,
    onSave,
    prestations,
    initialSchedules = [],
    title = 'Planification des prestations'
}) => {
        const { t } = useLanguageSafe();
const [schedules, setSchedules] = useState<PrestationSchedule[]>(
        initialSchedules.length > 0
            ? initialSchedules
            : prestations.map(prestation => ({
                prestation,
                days: [],
                timeSlots: [{ start: '08:00', end: '17:00' }]
            }))
    );

    const toggleDay = (prestation: string, day: number) => {
        setSchedules(prev => prev.map(schedule => {
            if (schedule.prestation === prestation) {
                const newDays = schedule.days.includes(day)
                    ? schedule.days.filter(d => d !== day)
                    : [...schedule.days, day];
                return { ...schedule, days: newDays };
            }
            return schedule;
        }));
    };

    const updateTimeSlot = (prestation: string, slotIndex: number, field: 'start' | 'end', value: string) => {
        setSchedules(prev => prev.map(schedule => {
            if (schedule.prestation === prestation) {
                const updatedSlots = schedule.timeSlots.map((slot, idx) =>
                    idx === slotIndex ? { ...slot, [field]: value } : slot
                );
                return { ...schedule, timeSlots: updatedSlots };
            }
            return schedule;
        }));
    };

    const addTimeSlot = (prestation: string) => {
        setSchedules(prev => prev.map(schedule => {
            if (schedule.prestation === prestation) {
                return {
                    ...schedule,
                    timeSlots: [...schedule.timeSlots, { start: '08:00', end: '17:00' }]
                };
            }
            return schedule;
        }));
    };

    const removeTimeSlot = (prestation: string, slotIndex: number) => {
        setSchedules(prev => prev.map(schedule => {
            if (schedule.prestation === prestation) {
                return {
                    ...schedule,
                    timeSlots: schedule.timeSlots.filter((_, idx) => idx !== slotIndex)
                };
            }
            return schedule;
        }));
    };

    const handleSave = () => {
        const validSchedules = schedules.filter(s => s.days.length > 0 && s.timeSlots.length > 0);
        onSave(validSchedules);
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
                        {schedules.map((schedule, index) => (
                            <View key={index} style={styles.prestationSection}>
                                <Text style={styles.prestationTitle}>{schedule.prestation}</Text>

                                <View style={styles.daysContainer}>
                                    <Text style={styles.sectionLabel}>{t('servicePrestationsPlanner.joursDisponibles')}/Text>
                                    <View style={styles.daysGrid}>
                                        {DAYS_OF_WEEK.map(day => (
                                            <TouchableOpacity
                                                key={day.value}
                                                style={[
                                                    styles.dayButton,
                                                    schedule.days.includes(day.value) && styles.dayButtonSelected
                                                ]}
                                                onPress={() => toggleDay(schedule.prestation, day.value)}
                                            >
                                                <Text style={[
                                                    styles.dayButtonText,
                                                    schedule.days.includes(day.value) && styles.dayButtonTextSelected
                                                ]}>
                                                    {day.short}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {schedule.days.length > 0 && (
                                    <View style={styles.timeSlotsContainer}>
                                        <Text style={styles.sectionLabel}>Plages horaires</Text>
                                        {schedule.timeSlots.map((slot, slotIndex) => (
                                            <View key={slotIndex} style={styles.timeSlotRow}>
                                                <View style={styles.timeInputs}>
                                                    <View style={styles.timeInput}>
                                                        <Text style={styles.timeLabel}>{t('servicePrestationsPlanner.debut')}</Text>
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
                                                                    onPress={() => updateTimeSlot(schedule.prestation, slotIndex, 'start', time)}
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
                                                                    onPress={() => updateTimeSlot(schedule.prestation, slotIndex, 'end', time)}
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
                                                {schedule.timeSlots.length > 1 && (
                                                    <TouchableOpacity
                                                        style={styles.removeSlotButton}
                                                        onPress={() => removeTimeSlot(schedule.prestation, slotIndex)}
                                                    >
                                                        <SafeIcon name="trash-2" size={18} color="#DC2626" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ))}
                                        <TouchableOpacity
                                            style={styles.addSlotButton}
                                            onPress={() => addTimeSlot(schedule.prestation)}
                                        >
                                            <SafeIcon name="plus" size={18} color={modernColors.primary} />
                                            <Text style={styles.addSlotText}>{t('servicePrestationsPlanner.ajouterUnePlageHoraire')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelButtonText}>{t('servicePrestationsPlanner.annuler')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                        >
                            <Text style={styles.saveButtonText}>{t('servicePrestationsPlanner.enregistrer')}</Text>
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
    prestationSection: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    prestationTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 12,
    },
    daysContainer: {
        marginBottom: 16,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dayButtonSelected: {
        backgroundColor: `${modernColors.primary}15`,
        borderColor: modernColors.primary,
    },
    dayButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    dayButtonTextSelected: {
        color: modernColors.primary,
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

export default ServicePrestationsPlanner;

