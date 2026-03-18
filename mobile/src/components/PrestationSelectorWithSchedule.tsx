/**
 * PrestationSelectorWithSchedule - Sélecteur de prestations avec planification inline
 * UX améliorée : sélection dans un modal, planification immédiate après sélection
 */

import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lundi', short: 'L' },
    { value: 2, label: 'Mardi', short: 'M' },
    { value: 3, label: 'Mercredi', short: 'M' },
    { value: 4, label: 'Jeudi', short: 'J' },
    { value: 5, label: 'Vendredi', short: 'V' },
    { value: 6, label: 'Samedi', short: 'S' },
    { value: 7, label: 'Dimanche', short: 'D' },
];

const TIME_SLOTS = [
    '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', // ✅ AJOUTÉ: Heures nocturnes
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

// ✅ REFONTE : Structure pour horaires indépendants par jour
export interface PrestationWithSchedule {
    prestation: string;
    // ✅ NOUVEAU : Horaires spécifiques par jour (chaque jour peut avoir ses propres horaires)
    scheduleByDay: Array<{
        day: number; // 1=Lundi, 2=Mardi, ..., 7=Dimanche
        timeSlots: Array<{ start: string; end: string }>;
    }>;
    // ✅ DÉPRÉCIÉ : days et timeSlots (conservés pour compatibilité)
    days?: number[];
    timeSlots?: Array<{ start: string; end: string }>;
}

interface PrestationSelectorWithScheduleProps {
    label: string;
    options: string[];
    selected: PrestationWithSchedule[];
    onSelectionChange: (prestations: PrestationWithSchedule[]) => void;
    allowCustom?: boolean;
    placeholder?: string;
}

const PrestationSelectorWithSchedule: React.FC<PrestationSelectorWithScheduleProps> = ({
    label,
    options,
    selected,
    onSelectionChange,
    allowCustom = true,
    placeholder = 'Ajouter une prestation personnalisée'
}) => {
    const [showSelectionModal, setShowSelectionModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [currentPrestation, setCurrentPrestation] = useState<string | null>(null);
    const [customInput, setCustomInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filtrer les options disponibles (celles non sélectionnées)
    const availableOptions = options.filter(
        opt => !selected.some(s => s.prestation === opt)
    );

    // Filtrer selon la recherche
    const filteredOptions = availableOptions.filter(opt =>
        opt.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectPrestation = (prestation: string) => {
        // Vérifier si déjà sélectionnée
        const exists = selected.some(s => s.prestation === prestation);
        if (exists) {
            // Retirer
            onSelectionChange(selected.filter(s => s.prestation !== prestation));
        } else {
            // ✅ NOUVEAU : Ajouter avec structure scheduleByDay (horaires indépendants par jour)
            const newPrestation: PrestationWithSchedule = {
                prestation,
                scheduleByDay: [
                    { day: 1, timeSlots: [{ start: '08:00', end: '17:00' }] }, // Lundi
                    { day: 2, timeSlots: [{ start: '08:00', end: '17:00' }] }, // Mardi
                    { day: 3, timeSlots: [{ start: '08:00', end: '17:00' }] }, // Mercredi
                    { day: 4, timeSlots: [{ start: '08:00', end: '17:00' }] }, // Jeudi
                    { day: 5, timeSlots: [{ start: '08:00', end: '17:00' }] }, // Vendredi
                ],
                // Compatibilité avec ancien format
                days: [1, 2, 3, 4, 5],
                timeSlots: [{ start: '08:00', end: '17:00' }]
            };
            onSelectionChange([...selected, newPrestation]);
            // Ouvrir immédiatement le modal de planification
            setCurrentPrestation(prestation);
            setShowSelectionModal(false);
            setShowScheduleModal(true);
        }
    };

    const handleAddCustom = () => {
        if (customInput.trim() && !selected.some(s => s.prestation === customInput.trim())) {
            // ✅ NOUVEAU : Structure scheduleByDay
            const newPrestation: PrestationWithSchedule = {
                prestation: customInput.trim(),
                scheduleByDay: [
                    { day: 1, timeSlots: [{ start: '08:00', end: '17:00' }] },
                    { day: 2, timeSlots: [{ start: '08:00', end: '17:00' }] },
                    { day: 3, timeSlots: [{ start: '08:00', end: '17:00' }] },
                    { day: 4, timeSlots: [{ start: '08:00', end: '17:00' }] },
                    { day: 5, timeSlots: [{ start: '08:00', end: '17:00' }] },
                ],
                days: [1, 2, 3, 4, 5],
                timeSlots: [{ start: '08:00', end: '17:00' }]
            };
            onSelectionChange([...selected, newPrestation]);
            setCustomInput('');
            setShowSelectionModal(false);
            setCurrentPrestation(newPrestation.prestation);
            setShowScheduleModal(true);
        }
    };

    const handleConfigureSchedule = (prestation: string) => {
        setCurrentPrestation(prestation);
        setShowScheduleModal(true);
    };

    const updateSchedule = (prestation: string, updates: Partial<PrestationWithSchedule>) => {
        onSelectionChange(selected.map(s =>
            s.prestation === prestation ? { ...s, ...updates } : s
        ));
    };

    // ✅ NOUVEAU : Toggle un jour (ajouter/retirer de scheduleByDay)
    const toggleDay = (prestation: string, day: number) => {
        const prestationData = selected.find(s => s.prestation === prestation);
        if (!prestationData) return;

        const scheduleByDay = prestationData.scheduleByDay || [];
        const dayExists = scheduleByDay.some(d => d.day === day);

        let newScheduleByDay: Array<{ day: number; timeSlots: Array<{ start: string; end: string }> }>;

        if (dayExists) {
            // Retirer le jour
            newScheduleByDay = scheduleByDay.filter(d => d.day !== day);
        } else {
            // Ajouter le jour avec horaires par défaut
            newScheduleByDay = [...scheduleByDay, { day, timeSlots: [{ start: '08:00', end: '17:00' }] }];
        }

        // Mettre à jour aussi days pour compatibilité
        const newDays = newScheduleByDay.map(d => d.day).sort();

        updateSchedule(prestation, {
            scheduleByDay: newScheduleByDay,
            days: newDays // Compatibilité
        });
    };

    // ✅ NOUVEAU : Mettre à jour un créneau horaire pour un jour spécifique
    const updateTimeSlot = (prestation: string, day: number, slotIndex: number, field: 'start' | 'end', value: string) => {
        const prestationData = selected.find(s => s.prestation === prestation);
        if (!prestationData) return;

        const scheduleByDay = prestationData.scheduleByDay || [];
        const daySchedule = scheduleByDay.find(d => d.day === day);

        if (!daySchedule) return;

        const updatedSlots = daySchedule.timeSlots.map((slot, idx) =>
            idx === slotIndex ? { ...slot, [field]: value } : slot
        );

        const newScheduleByDay = scheduleByDay.map(d =>
            d.day === day ? { ...d, timeSlots: updatedSlots } : d
        );

        updateSchedule(prestation, { scheduleByDay: newScheduleByDay });
    };

    // ✅ NOUVEAU : Ajouter un créneau horaire pour un jour spécifique
    const addTimeSlot = (prestation: string, day: number) => {
        const prestationData = selected.find(s => s.prestation === prestation);
        if (!prestationData) return;

        const scheduleByDay = prestationData.scheduleByDay || [];
        const daySchedule = scheduleByDay.find(d => d.day === day);

        if (!daySchedule) {
            // Si le jour n'existe pas, l'ajouter avec le nouveau créneau
            const newScheduleByDay = [...scheduleByDay, {
                day,
                timeSlots: [{ start: '08:00', end: '17:00' }]
            }];
            updateSchedule(prestation, { scheduleByDay: newScheduleByDay });
            return;
        }

        const newScheduleByDay = scheduleByDay.map(d =>
            d.day === day
                ? { ...d, timeSlots: [...d.timeSlots, { start: '08:00', end: '17:00' }] }
                : d
        );

        updateSchedule(prestation, { scheduleByDay: newScheduleByDay });
    };

    // ✅ NOUVEAU : Retirer un créneau horaire pour un jour spécifique
    const removeTimeSlot = (prestation: string, day: number, slotIndex: number) => {
        const prestationData = selected.find(s => s.prestation === prestation);
        if (!prestationData) return;

        const scheduleByDay = prestationData.scheduleByDay || [];
        const daySchedule = scheduleByDay.find(d => d.day === day);

        if (!daySchedule || daySchedule.timeSlots.length <= 1) return;

        const newScheduleByDay = scheduleByDay.map(d =>
            d.day === day
                ? { ...d, timeSlots: d.timeSlots.filter((_, idx) => idx !== slotIndex) }
                : d
        );

        updateSchedule(prestation, { scheduleByDay: newScheduleByDay });
    };

    const getScheduleSummary = (prestation: PrestationWithSchedule): string => {
        // ✅ NOUVEAU : Utiliser scheduleByDay si disponible
        const scheduleByDay = prestation.scheduleByDay || [];
        const days = scheduleByDay.length > 0
            ? scheduleByDay.map(d => d.day).sort()
            : (prestation.days || []);

        if (days.length === 0) return 'Non planifié';

        const daysStr = days.length === 7 ? 'Tous les jours' :
            days.length === 5 && days.every(d => d <= 5) ? 'Lun-Ven' :
                `${days.length} jour(s)`;

        // ✅ NOUVEAU : Afficher un résumé des horaires (peut varier par jour)
        if (scheduleByDay.length > 0) {
            const allTimeSlots = scheduleByDay.flatMap(d => d.timeSlots);
            if (allTimeSlots.length > 0) {
                const uniqueSlots = Array.from(new Set(allTimeSlots.map(s => `${s.start}-${s.end}`)));
                const timeStr = uniqueSlots.length === 1
                    ? uniqueSlots[0]
                    : `${uniqueSlots.length} créneau(x)`;
                return `${daysStr} • ${timeStr}`;
            }
        }

        // Fallback ancien format
        const timeStr = prestation.timeSlots && prestation.timeSlots.length > 0
            ? `${prestation.timeSlots[0].start}-${prestation.timeSlots[0].end}`
            : '';
        return `${daysStr} ${timeStr}`;
    };

    const currentPrestationData = currentPrestation
        ? selected.find(s => s.prestation === currentPrestation)
        : null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowSelectionModal(true)}
                >
                    <SafeIcon name="plus" size={18} color={modernColors.primary} />
                    <Text style={styles.addButtonText}>Ajouter</Text>
                </TouchableOpacity>
            </View>

            {/* Liste des prestations sélectionnées */}
            {selected.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Aucune prestation sélectionnée</Text>
                    <Text style={styles.emptyHint}>Appuyez sur "Ajouter" pour commencer</Text>
                </View>
            ) : (
                <View style={styles.selectedList}>
                    {selected.map((prestation, index) => (
                        <View key={index} style={styles.prestationCard}>
                            <View style={styles.prestationHeader}>
                                <View style={styles.prestationInfo}>
                                    <Text style={styles.prestationName}>{prestation.prestation}</Text>
                                    <Text style={styles.prestationSchedule}>
                                        {getScheduleSummary(prestation)}
                                    </Text>
                                </View>
                                <View style={styles.prestationActions}>
                                    <TouchableOpacity
                                        style={styles.configButton}
                                        onPress={() => handleConfigureSchedule(prestation.prestation)}
                                    >
                                        <SafeIcon name="calendar" size={16} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => handleSelectPrestation(prestation.prestation)}
                                    >
                                        <SafeIcon name="x" size={16} color="#DC2626" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Modal de sélection */}
            <Modal
                visible={showSelectionModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSelectionModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Sélectionner une prestation</Text>
                            <TouchableOpacity onPress={() => setShowSelectionModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={18} color="#9CA3AF" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <ScrollView style={styles.optionsList}>
                            {filteredOptions.length === 0 ? (
                                <Text style={styles.noResults}>Aucun résultat</Text>
                            ) : (
                                filteredOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={styles.optionItem}
                                        onPress={() => handleSelectPrestation(option)}
                                    >
                                        <Text style={styles.optionText}>{option}</Text>
                                        <SafeIcon name="plus" size={18} color={modernColors.primary} />
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>

                        {allowCustom && (
                            <View style={styles.customContainer}>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder={placeholder}
                                    value={customInput}
                                    onChangeText={setCustomInput}
                                    onSubmitEditing={handleAddCustom}
                                />
                                <TouchableOpacity
                                    style={styles.customButton}
                                    onPress={handleAddCustom}
                                    disabled={!customInput.trim()}
                                >
                                    <SafeIcon name="plus" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal de planification */}
            {currentPrestationData && (
                <Modal
                    visible={showScheduleModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowScheduleModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.scheduleModalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    Planifier: {currentPrestation}
                                </Text>
                                <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                                    <SafeIcon name="x" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.scheduleContent}
                                nestedScrollEnabled={true}
                                scrollEnabled={true}
                                showsVerticalScrollIndicator={true}
                                bounces={true}
                            >
                                {/* ✅ NOUVEAU : Planification par jour avec horaires indépendants */}
                                <Text style={styles.infoText}>
                                    Configurez les horaires pour chaque jour indépendamment
                                </Text>

                                {DAYS_OF_WEEK.map(day => {
                                    const scheduleByDay = currentPrestationData.scheduleByDay || [];
                                    const daySchedule = scheduleByDay.find(d => d.day === day.value);
                                    const isDaySelected = daySchedule !== undefined;

                                    return (
                                        <View key={day.value} style={styles.dayScheduleCard}>
                                            {/* En-tête du jour */}
                                            <View style={styles.dayScheduleHeader}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.dayToggleButton,
                                                        isDaySelected && styles.dayToggleButtonSelected
                                                    ]}
                                                    onPress={() => toggleDay(currentPrestation, day.value)}
                                                >
                                                    <Text style={[
                                                        styles.dayToggleText,
                                                        isDaySelected && styles.dayToggleTextSelected
                                                    ]}>
                                                        {day.label}
                                                    </Text>
                                                    {isDaySelected && (
                                                        <SafeIcon name="check" size={16} color="#fff" />
                                                    )}
                                                </TouchableOpacity>
                                            </View>

                                            {/* Horaires pour ce jour (si sélectionné) */}
                                            {isDaySelected && daySchedule && (
                                                <View style={styles.dayTimeSlotsContainer}>
                                                    {daySchedule.timeSlots.map((slot, slotIndex) => (
                                                        <View key={slotIndex} style={styles.timeSlotCard}>
                                                            <View style={styles.timeSlotRow}>
                                                                <View style={styles.timeInputGroup}>
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
                                                                                onPress={() => updateTimeSlot(currentPrestation, day.value, slotIndex, 'start', time)}
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
                                                                <View style={styles.timeInputGroup}>
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
                                                                                onPress={() => updateTimeSlot(currentPrestation, day.value, slotIndex, 'end', time)}
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
                                                                    onPress={() => removeTimeSlot(currentPrestation, day.value, slotIndex)}
                                                                >
                                                                    <SafeIcon name="trash-2" size={16} color="#DC2626" />
                                                                    <Text style={styles.removeSlotText}>Supprimer</Text>
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    ))}
                                                    <TouchableOpacity
                                                        style={styles.addSlotButton}
                                                        onPress={() => addTimeSlot(currentPrestation, day.value)}
                                                    >
                                                        <SafeIcon name="plus" size={18} color="#fff" />
                                                        <Text style={styles.addSlotText}>Ajouter un horaire supplémentaire</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            <View style={styles.scheduleFooter}>
                                <TouchableOpacity
                                    style={styles.doneButton}
                                    onPress={() => setShowScheduleModal(false)}
                                >
                                    <Text style={styles.doneButtonText}>Terminé</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 16 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: `${modernColors.primary}15`,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    emptyState: {
        padding: 20,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    emptyHint: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    selectedList: {
        gap: 8,
    },
    prestationCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    prestationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    prestationInfo: {
        flex: 1,
    },
    prestationName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    prestationSchedule: {
        fontSize: 12,
        color: '#6B7280',
    },
    prestationActions: {
        flexDirection: 'row',
        gap: 8,
    },
    configButton: {
        padding: 6,
    },
    removeButton: {
        padding: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    scheduleModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    optionsList: {
        padding: 16,
        maxHeight: 400,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        marginBottom: 8,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
    },
    noResults: {
        textAlign: 'center',
        padding: 20,
        color: '#6B7280',
    },
    customContainer: {
        flexDirection: 'row',
        gap: 8,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    customInput: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 14,
    },
    customButton: {
        padding: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scheduleContent: {
        padding: 16,
    },
    scheduleSection: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 12,
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
        backgroundColor: '#F3F4F6',
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
    timeSlotCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    timeSlotRow: {
        gap: 12,
    },
    timeInputGroup: {
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
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginRight: 8,
    },
    timeOptionSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    timeOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    timeOptionTextSelected: {
        color: '#fff',
    },
    removeSlotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        alignSelf: 'flex-end',
    },
    removeSlotText: {
        fontSize: 12,
        color: '#DC2626',
        fontWeight: '600',
    },
    addSlotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 8,
    },
    addSlotText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    scheduleFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    doneButton: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    doneButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    infoText: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 16,
        fontStyle: 'italic',
    },
    dayScheduleCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dayScheduleHeader: {
        marginBottom: 12,
    },
    dayToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dayToggleButtonSelected: {
        backgroundColor: `${modernColors.primary}15`,
        borderColor: modernColors.primary,
    },
    dayToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    dayToggleTextSelected: {
        color: modernColors.primary,
    },
    dayTimeSlotsContainer: {
        gap: 12,
    },
});

export default PrestationSelectorWithSchedule;

