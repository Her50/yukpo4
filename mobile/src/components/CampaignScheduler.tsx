import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ScheduleOptions {
    startDate: Date | null;
    endDate: Date | null;
    startTime: Date | null;
    endTime: Date | null;
    timezone: string;
    pauseOnWeekends: boolean;
    pauseHours: { start: number; end: number } | null;
}

interface CampaignSchedulerProps {
    schedule: ScheduleOptions;
    onScheduleChange: (schedule: ScheduleOptions) => void;
}

export const CampaignScheduler: React.FC<CampaignSchedulerProps> = ({
    schedule,
    onScheduleChange,
}) => {
        const { t } = useLanguageSafe();
const [expanded, setExpanded] = useState(false);
    const [showStartDate, setShowStartDate] = useState(false);
    const [showEndDate, setShowEndDate] = useState(false);
    const [showStartTime, setShowStartTime] = useState(false);
    const [showEndTime, setShowEndTime] = useState(false);

    const formatDate = (date: Date | null) => {
        if (!date) return t('campaignScheduler.nonDefini');
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatTime = (date: Date | null) => {
        if (!date) return t('campaignScheduler.nonDefini');
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    Planification {schedule.startDate ? t('campaignScheduler.activee') : '(optionnel)'}
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>📅 Planification</Text>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Date de début */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('campaignScheduler.dateDeDebut')}</Text>
                <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDate(true)}
                >
                    <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                    <Text style={styles.dateText}>
                        {formatDate(schedule.startDate)}
                    </Text>
                </TouchableOpacity>
                {showStartDate && (
                    <DateTimePicker
                        value={schedule.startDate || new Date()}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                            setShowStartDate(Platform.OS === 'ios');
                            if (selectedDate) {
                                onScheduleChange({
                                    ...schedule,
                                    startDate: selectedDate,
                                });
                            }
                        }}
                    />
                )}
            </View>

            {/* Heure de début */}
            {schedule.startDate && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('campaignScheduler.heureDeDebut')}</Text>
                    <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowStartTime(true)}
                    >
                        <SafeIcon name="clock" size={18} color={modernColors.primary} />
                        <Text style={styles.dateText}>
                            {formatTime(schedule.startTime)}
                        </Text>
                    </TouchableOpacity>
                    {showStartTime && (
                        <DateTimePicker
                            value={schedule.startTime || new Date()}
                            mode="time"
                            display="default"
                            onChange={(event, selectedTime) => {
                                setShowStartTime(Platform.OS === 'ios');
                                if (selectedTime) {
                                    onScheduleChange({
                                        ...schedule,
                                        startTime: selectedTime,
                                    });
                                }
                            }}
                        />
                    )}
                </View>
            )}

            {/* Date de fin */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('campaignScheduler.dateDeFin')}</Text>
                <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDate(true)}
                >
                    <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                    <Text style={styles.dateText}>
                        {formatDate(schedule.endDate)}
                    </Text>
                </TouchableOpacity>
                {showEndDate && (
                    <DateTimePicker
                        value={schedule.endDate || new Date()}
                        mode="date"
                        display="default"
                        minimumDate={schedule.startDate || new Date()}
                        onChange={(event, selectedDate) => {
                            setShowEndDate(Platform.OS === 'ios');
                            if (selectedDate) {
                                onScheduleChange({
                                    ...schedule,
                                    endDate: selectedDate,
                                });
                            }
                        }}
                    />
                )}
            </View>

            {/* Options avancées */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Options</Text>

                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => onScheduleChange({
                        ...schedule,
                        pauseOnWeekends: !schedule.pauseOnWeekends,
                    })}
                >
                    <Text style={styles.optionLabel}>Pause les weekends</Text>
                    <View
                        style={[
                            styles.toggle,
                            schedule.pauseOnWeekends && styles.toggleActive,
                        ]}
                    >
                        {schedule.pauseOnWeekends && (
                            <View style={styles.toggleThumb} />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {schedule.startDate && schedule.endDate && (
                <View style={styles.summaryBox}>
                    <SafeIcon name="info" size={16} color={modernColors.info} />
                    <Text style={styles.summaryText}>
                        La campagne sera active du {formatDate(schedule.startDate)} au {formatDate(schedule.endDate)}{schedule.pauseOnWeekends ? t('campaignScheduler.pausesWeekendsActivees') : ''}
                    </Text>
                </View>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        marginBottom: 16,
    },
    expandText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    dateText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    toggle: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.border,
        padding: 2,
        justifyContent: 'center',
    },
    toggleActive: {
        backgroundColor: modernColors.primary,
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignSelf: 'flex-end',
    },
    summaryBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    summaryText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
});

