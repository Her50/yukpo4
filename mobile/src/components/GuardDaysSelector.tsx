/**
 * GuardDaysSelector - Sélecteur visuel des jours de garde sur plusieurs mois
 * Permet de sélectionner les jours sans saisie manuelle
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

const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface GuardDaysSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (days: Record<string, number[]>) => void; // { '2025-01': [1, 3, 5], ... }
    initialDays?: Record<string, number[]>;
    title?: string;
}

const GuardDaysSelector: React.FC<GuardDaysSelectorProps> = ({
    visible,
    onClose,
    onSave,
    initialDays = {},
    title = 'Planifier les jours de garde'
}) => {
    // Générer les 12 prochains mois
    const generateMonths = () => {
        const months: Array<{ key: string; label: string; year: number; month: number }> = [];
        const today = new Date();

        for (let i = 0; i < 12; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;
            const label = `${MONTHS[month]} ${year}`;

            months.push({ key, label, year, month: month + 1 });
        }

        return months;
    };

    const months = generateMonths();
    const [selectedDays, setSelectedDays] = useState<Record<string, number[]>>(initialDays);

    const toggleDay = (monthKey: string, dayValue: number) => {
        setSelectedDays(prev => {
            const monthDays = prev[monthKey] || [];
            const newDays = monthDays.includes(dayValue)
                ? monthDays.filter(d => d !== dayValue)
                : [...monthDays, dayValue].sort();

            return {
                ...prev,
                [monthKey]: newDays.length > 0 ? newDays : undefined
            };
        });
    };

    const toggleAllDaysInMonth = (monthKey: string) => {
        setSelectedDays(prev => {
            const monthDays = prev[monthKey] || [];
            const allDays = DAYS_OF_WEEK.map(d => d.value);
            const hasAll = allDays.every(d => monthDays.includes(d));

            return {
                ...prev,
                [monthKey]: hasAll ? undefined : allDays
            };
        });
    };

    const clearMonth = (monthKey: string) => {
        setSelectedDays(prev => {
            const updated = { ...prev };
            delete updated[monthKey];
            return updated;
        });
    };

    const handleSave = () => {
        // Nettoyer les mois vides
        const cleaned = Object.fromEntries(
            Object.entries(selectedDays).filter(([_, days]) => days && days.length > 0)
        );
        onSave(cleaned);
        onClose();
    };

    const getTotalDaysSelected = () => {
        return Object.values(selectedDays).reduce((sum, days) => sum + (days?.length || 0), 0);
    };

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
                        {getTotalDaysSelected()} jour(s) de garde sélectionné(s) sur {Object.keys(selectedDays).length} mois
                    </Text>
                </View>

                <ScrollView style={styles.content}>
                    {months.map((month) => {
                        const monthDays = selectedDays[month.key] || [];
                        const allSelected = DAYS_OF_WEEK.every(d => monthDays.includes(d.value));

                        return (
                            <View key={month.key} style={styles.monthSection}>
                                <View style={styles.monthHeader}>
                                    <Text style={styles.monthTitle}>{month.label}</Text>
                                    <View style={styles.monthActions}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => toggleAllDaysInMonth(month.key)}
                                        >
                                            <Text style={styles.actionButtonText}>
                                                {allSelected ? 'Désélectionner' : 'Tout'}
                                            </Text>
                                        </TouchableOpacity>
                                        {monthDays.length > 0 && (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.clearButton]}
                                                onPress={() => clearMonth(month.key)}
                                            >
                                                <Text style={[styles.actionButtonText, styles.clearButtonText]}>Effacer</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.daysGrid}>
                                    {DAYS_OF_WEEK.map((day) => {
                                        const isSelected = monthDays.includes(day.value);
                                        return (
                                            <TouchableOpacity
                                                key={day.value}
                                                style={[
                                                    styles.dayChip,
                                                    isSelected && styles.dayChipSelected
                                                ]}
                                                onPress={() => toggleDay(month.key, day.value)}
                                            >
                                                <Text style={[
                                                    styles.dayChipText,
                                                    isSelected && styles.dayChipTextSelected
                                                ]}>
                                                    {day.short}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {monthDays.length > 0 && (
                                    <Text style={styles.selectedDaysText}>
                                        {monthDays.length} jour(s) sélectionné(s)
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={onClose}
                    >
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.saveButton]}
                        onPress={handleSave}
                    >
                        <Text style={styles.saveButtonText}>Enregistrer</Text>
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
    },
    monthSection: {
        margin: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    monthActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    clearButton: {
        backgroundColor: '#FEE2E2',
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    clearButtonText: {
        color: '#DC2626',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    dayChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minWidth: 70,
        alignItems: 'center',
    },
    dayChipSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dayChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    dayChipTextSelected: {
        color: '#fff',
    },
    selectedDaysText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
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

export default GuardDaysSelector;

