import React, { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { NativeButton } from '../SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface TimeSlot {
    start: string;
    end: string;
}

interface DaySchedule {
    [day: string]: TimeSlot[];
}

interface TimeSlotPickerProps {
    value: string; // JSON string
    onChange: (jsonString: string) => void;
}

const DAYS = [
    { key: 'lundi', label: 'Lundi' },
    { key: 'mardi', label: 'Mardi' },
    { key: 'mercredi', label: 'Mercredi' },
    { key: 'jeudi', label: 'Jeudi' },
    { key: 'vendredi', label: 'Vendredi' },
    { key: 'samedi', label: 'Samedi' },
    { key: 'dimanche', label: 'Dimanche' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
});

const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({ value, onChange }) => {
        const { t } = useLanguageSafe();
const [schedule, setSchedule] = useState<DaySchedule>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{ day: string; index: number; field: 'start' | 'end' } | null>(null);

    // Parser le JSON initial (une seule fois au montage ou si value change vraiment)
    useEffect(() => {
        try {
            const parsed = value ? JSON.parse(value) : {};
            // Normaliser les clés (monday -> lundi, etc.)
            const normalized: DaySchedule = {};
            DAYS.forEach(day => {
                const englishKey = day.key === 'lundi' ? 'monday' :
                    day.key === 'mardi' ? 'tuesday' :
                        day.key === 'mercredi' ? 'wednesday' :
                            day.key === 'jeudi' ? 'thursday' :
                                day.key === 'vendredi' ? 'friday' :
                                    day.key === 'samedi' ? 'saturday' :
                                        day.key === 'dimanche' ? 'sunday' : day.key;

                if (parsed[day.key] || parsed[englishKey]) {
                    normalized[day.key] = parsed[day.key] || parsed[englishKey] || [];
                }
            });
            // Ne mettre à jour que si différent pour éviter les boucles
            const currentJson = JSON.stringify(normalized);
            const existingJson = JSON.stringify(schedule);
            if (currentJson !== existingJson) {
                setSchedule(normalized);
            }
        } catch (e) {
            if (Object.keys(schedule).length > 0) {
                setSchedule({});
            }
        }
    }, [value]); // Seulement quand value change depuis l'extérieur

    // Mettre à jour le JSON quand le schedule change (mais pas si c'est nous qui avons changé value)
    useEffect(() => {
        const jsonString = JSON.stringify(schedule, null, 2);
        // Vérifier que le JSON est différent pour éviter les boucles
        if (jsonString !== value) {
            onChange(jsonString);
        }
    }, [schedule]); // eslint-disable-line react-hooks/exhaustive-deps

    const addSlot = (day: string) => {
        setSchedule(prev => ({
            ...prev,
            [day]: [...(prev[day] || []), { start: '08:00', end: '18:00' }],
        }));
    };

    const removeSlot = (day: string, index: number) => {
        setSchedule(prev => {
            const newSlots = [...(prev[day] || [])];
            newSlots.splice(index, 1);
            if (newSlots.length === 0) {
                const { [day]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [day]: newSlots };
        });
    };

    const updateSlot = (day: string, index: number, field: 'start' | 'end', time: string) => {
        setSchedule(prev => {
            const newSlots = [...(prev[day] || [])];
            newSlots[index] = { ...newSlots[index], [field]: time };
            return { ...prev, [day]: newSlots };
        });
    };

    const getDaySummary = (day: string): string => {
        const slots = schedule[day];
        if (!slots || slots.length === 0) return t('timeSlotPicker.ferme');
        return slots.map(s => `${s.start}-${s.end}`).join(', ');
    };

    const configuredDays = DAYS.filter(d => schedule[d.key] && schedule[d.key].length > 0);
    const totalSlots = Object.values(schedule).reduce((sum, slots) => sum + slots.length, 0);

    return (
        <View>
            <TouchableOpacity
                style={styles.trigger}
                onPress={() => setModalVisible(true)}
            >
                <View style={styles.triggerContent}>
                    {configuredDays.length === 0 ? (
                        <Text style={styles.triggerPlaceholder}>Configurer les horaires...</Text>
                    ) : (
                        <View style={styles.triggerSummary}>
                            <View style={styles.triggerChips}>
                                {configuredDays.map(d => (
                                    <View key={d.key} style={styles.dayChip}>
                                        <Text style={styles.dayChipText}>{d.label.substring(0, 3)}</Text>
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.triggerSubtext}>
                                {configuredDays.length} jour(s) • {totalSlots} plage(s)
                            </Text>
                        </View>
                    )}
                </View>
                <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('timeSlotPicker.plagesHorairesDeDepart')}</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {DAYS.map(day => {
                            const slots = schedule[day.key] || [];
                            return (
                                <View key={day.key} style={styles.daySection}>
                                    <View style={styles.dayHeader}>
                                        <Text style={styles.dayLabel}>{day.label}</Text>
                                        <View style={styles.dayActions}>
                                            <TouchableOpacity
                                                style={styles.addButton}
                                                onPress={() => addSlot(day.key)}
                                            >
                                                <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                                <Text style={styles.addButtonText}>{t('timeSlotPicker.ajouter')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {slots.length === 0 ? (
                                        <Text style={styles.closedText}>{t('timeSlotPicker.ferme')}</Text>
                                    ) : (
                                        slots.map((slot, index) => (
                                            <View key={index} style={styles.slotRow}>
                                                <View style={styles.timeContainer}>
                                                    <TouchableOpacity
                                                        style={styles.timeButton}
                                                        onPress={() => {
                                                            setEditingSlot({ day: day.key, index, field: 'start' });
                                                        }}
                                                    >
                                                        <Text style={styles.timeText}>{slot.start}</Text>
                                                    </TouchableOpacity>
                                                    <Text style={styles.separator}>-</Text>
                                                    <TouchableOpacity
                                                        style={styles.timeButton}
                                                        onPress={() => {
                                                            setEditingSlot({ day: day.key, index, field: 'end' });
                                                        }}
                                                    >
                                                        <Text style={styles.timeText}>{slot.end}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <TouchableOpacity
                                                    style={styles.removeButton}
                                                    onPress={() => removeSlot(day.key, index)}
                                                >
                                                    <SafeIcon name="trash-2" size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <View style={styles.footerSummary}>
                            <SafeIcon name="check-circle" size={16} color={configuredDays.length > 0 ? '#10B981' : '#9CA3AF'} />
                            <Text style={[styles.footerSummaryText, configuredDays.length > 0 && styles.footerSummaryTextActive]}>
                                {configuredDays.length === 0
                                    ? t('timeSlotPicker.aucunJourConfigure')
                                    : `${configuredDays.length} jour(s), ${totalSlots} plage(s) horaire(s)`}
                            </Text>
                        </View>
                        <NativeButton
                            title={t('timeSlotPicker.validerLesHoraires')}
                            variant="primary"
                            onPress={() => setModalVisible(false)}
                        />
                    </View>
                </View>
            </Modal>

            {/* Modal pour sélectionner l'heure */}
            {editingSlot && (
                <Modal
                    visible={editingSlot !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setEditingSlot(null)}
                >
                    <View style={styles.timeModalOverlay}>
                        <View style={styles.timeModalContent}>
                            <Text style={styles.timeModalTitle}>
                                Heure {editingSlot.field === 'start' ? t('timeSlotPicker.deDebut') : 'de fin'}
                            </Text>
                            <ScrollView style={styles.hoursList}>
                                {HOURS.map(hour => (
                                    <TouchableOpacity
                                        key={hour}
                                        style={styles.hourOption}
                                        onPress={() => {
                                            if (editingSlot) {
                                                updateSlot(editingSlot.day, editingSlot.index, editingSlot.field, hour);
                                                setEditingSlot(null);
                                            }
                                        }}
                                    >
                                        <Text style={styles.hourText}>{hour}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setEditingSlot(null)}
                            >
                                <Text style={styles.cancelButtonText}>{t('timeSlotPicker.annuler')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#FFFFFF',
    },
    triggerContent: {
        flex: 1,
        marginRight: 8,
    },
    triggerPlaceholder: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    triggerSummary: {
        gap: 6,
    },
    triggerChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    dayChip: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    dayChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    triggerSubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    daySection: {
        marginBottom: 24,
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    dayLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    dayActions: {
        flexDirection: 'row',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: modernColors.primary + '20',
        borderRadius: 6,
    },
    addButtonText: {
        fontSize: 12,
        color: modernColors.primary,
        marginLeft: 4,
    },
    closedText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    slotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    timeContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 6,
        padding: 12,
        backgroundColor: '#FFFFFF',
    },
    separator: {
        marginHorizontal: 8,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    timeText: {
        fontSize: 14,
        color: modernColors.text,
    },
    removeButton: {
        marginLeft: 8,
        padding: 8,
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 10,
    },
    footerSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingBottom: 4,
    },
    footerSummaryText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    footerSummaryTextActive: {
        color: '#10B981',
    },
    timeModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        width: '80%',
        maxHeight: '60%',
    },
    timeModalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    hoursList: {
        maxHeight: 300,
    },
    hourOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    hourText: {
        fontSize: 14,
        color: modernColors.text,
    },
    cancelButton: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
});

export default TimeSlotPicker;

