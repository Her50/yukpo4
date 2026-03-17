/**
 * WeekDaysSelector - Sélecteur simple des jours de la semaine
 * Permet de sélectionner les jours d'ouverture sans étendre sur plusieurs mois
 */

import React, { useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
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

interface WeekDaysSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (days: number[]) => void; // [1, 2, 3, 4, 5] pour Lun-Ven
    initialDays?: number[];
    title?: string;
}

const WeekDaysSelector: React.FC<WeekDaysSelectorProps> = ({
    visible,
    onClose,
    onSave,
    initialDays = [],
    title={t('weekDaysSelector.selectionnerLesJoursD')}ouverture'
}) => {
        const { t } = useLanguageSafe();
const [selectedDays, setSelectedDays] = useState<number[]>(initialDays);

    const toggleDay = (dayValue: number) => {
        setSelectedDays(prev =>
            prev.includes(dayValue)
                ? prev.filter(d => d !== dayValue)
                : [...prev, dayValue].sort()
        );
    };

    const selectAll = () => {
        const allDays = DAYS_OF_WEEK.map(d => d.value);
        setSelectedDays(prev =>
            prev.length === allDays.length ? [] : allDays
        );
    };

    const handleSave = () => {
        onSave(selectedDays);
        onClose();
    };

    const allSelected = selectedDays.length === DAYS_OF_WEEK.length;
    const weekdaysSelected = selectedDays.length === 5 && selectedDays.every(d => d <= 5);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <View style={styles.summary}>
                    <Text style={styles.summaryText}>
                        {selectedDays.length === 0
                            ? t('weekDaysSelector.aucunJourSelectionne')
                            : selectedDays.length === 7
                                ? 'Tous les jours'
                                : weekdaysSelected
                                    ? 'Lundi - Vendredi'
                                    : t('weekDaysSelector.joursSelectionnes', { selectedDays_length: selectedDays.length })}
                    </Text>
                </View>

                <View style={styles.content}>
                    <TouchableOpacity
                        style={[styles.selectAllButton, allSelected && styles.selectAllButtonActive]}
                        onPress={selectAll}
                    >
                        <Text style={[styles.selectAllText, allSelected && styles.selectAllTextActive]}>
                            {allSelected ? t('weekDaysSelector.deselectionnerTout') : t('weekDaysSelector.selectionnerTousLesJours')}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.daysGrid}>
                        {DAYS_OF_WEEK.map((day) => {
                            const isSelected = selectedDays.includes(day.value);
                            return (
                                <TouchableOpacity
                                    key={day.value}
                                    style={[
                                        styles.dayChip,
                                        isSelected && styles.dayChipSelected
                                    ]}
                                    onPress={() => toggleDay(day.value)}
                                >
                                    <Text style={[
                                        styles.dayChipText,
                                        isSelected && styles.dayChipTextSelected
                                    ]}>
                                        {day.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={onClose}
                    >
                        <Text style={styles.cancelButtonText}>{t('weekDaysSelector.annuler')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.saveButton]}
                        onPress={handleSave}
                    >
                        <Text style={styles.saveButtonText}>{t('weekDaysSelector.enregistrer')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    summary: {
        padding: 16,
        backgroundColor: '#EEF2FF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    summaryText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    selectAllButton: {
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginBottom: 16,
        alignItems: 'center',
    },
    selectAllButtonActive: {
        backgroundColor: modernColors.primary,
    },
    selectAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    selectAllTextActive: {
        color: '#fff',
    },
    daysGrid: {
        gap: 12,
    },
    dayChip: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    dayChipSelected: {
        backgroundColor: `${modernColors.primary}15`,
        borderColor: modernColors.primary,
    },
    dayChipText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    dayChipTextSelected: {
        color: modernColors.primary,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    saveButton: {
        backgroundColor: modernColors.primary,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default WeekDaysSelector;

