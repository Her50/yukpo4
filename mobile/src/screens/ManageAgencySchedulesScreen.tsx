// Écran de gestion des horaires de départ pour les agences de voyage
// Permet de créer, modifier et gérer les horaires de départ par trajet

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiDelete, apiGet, apiPost, apiPut } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
    { value: 6, label: 'Samedi' },
    { value: 7, label: 'Dimanche' },
];

interface Schedule {
    id: string;
    departure_city: string;
    arrival_city: string;
    departure_time: string;
    day_of_week: number[];
    is_active: boolean;
    created_at: string;
}

const ManageAgencySchedulesScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

    // Formulaire
    const [departureCity, setDepartureCity] = useState('');
    const [arrivalCity, setArrivalCity] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/bus-tickets/agencies/schedules');

            if (response.success && response.data) {
                setSchedules(response.data as any);
            }
        } catch (error: any) {
            console.error('[ManageAgencySchedulesScreen] Erreur chargement:', error);
            Alert.alert(t('message.error'), t('agencySchedules.cannotLoad'));
        } finally {
            setLoading(false);
        }
    };

    const handleAddSchedule = () => {
        setEditingSchedule(null);
        setDepartureCity('');
        setArrivalCity('');
        setDepartureTime('');
        setSelectedDays([]);
        setIsActive(true);
        setShowAddModal(true);
    };

    const handleEditSchedule = (schedule: Schedule) => {
        setEditingSchedule(schedule);
        setDepartureCity(schedule.departure_city);
        setArrivalCity(schedule.arrival_city);
        setDepartureTime(schedule.departure_time);
        setSelectedDays(schedule.day_of_week || []);
        setIsActive(schedule.is_active);
        setShowAddModal(true);
    };

    const handleSaveSchedule = async () => {
        if (!departureCity.trim() || !arrivalCity.trim() || !departureTime.trim()) {
            Alert.alert(t('message.error'), t('agencySchedules.fillRequiredFields'));
            return;
        }

        if (selectedDays.length === 0) {
            Alert.alert(t('message.error'), t('agencySchedules.selectAtLeastOneDay'));
            return;
        }

        // Valider le format de l'heure (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(departureTime)) {
            Alert.alert(t('message.error'), t('agencySchedules.invalidTimeFormat'));
            return;
        }

        try {
            if (editingSchedule) {
                // Mise à jour
                const response = await apiPut(`/api/bus-tickets/agencies/schedules/${editingSchedule.id}`, {
                    departure_times: [departureTime],
                    day_of_week: selectedDays,
                    is_active: isActive,
                });

                if (response.success) {
                    Alert.alert(t('message.success'), t('agencySchedules.scheduleUpdated'));
                    setShowAddModal(false);
                    loadSchedules();
                } else {
                    Alert.alert(t('message.error'), response.error || t('agencySchedules.cannotUpdate'));
                }
            } else {
                // Création
                const response = await apiPost('/api/bus-tickets/agencies/schedules', {
                    departure_city: departureCity.trim(),
                    arrival_city: arrivalCity.trim(),
                    departure_times: [departureTime],
                    day_of_week: selectedDays.length === 7 ? null : selectedDays[0], // Pour l'instant, un seul jour
                    notes: null,
                });

                if (response.success) {
                    Alert.alert(t('message.success'), t('agencySchedules.scheduleCreated'));
                    setShowAddModal(false);
                    loadSchedules();
                } else {
                    Alert.alert(t('message.error'), response.error || t('agencySchedules.cannotCreate'));
                }
            }
        } catch (error: any) {
            console.error('[ManageAgencySchedulesScreen] Erreur sauvegarde:', error);
            Alert.alert(t('message.error'), error.message || t('agencySchedules.genericError'));
        }
    };

    const handleDeleteSchedule = (schedule: Schedule) => {
        Alert.alert(
            t('agencySchedules.deleteSchedule'),
            t('agencySchedules.deleteConfirm', { from: schedule.departure_city, to: schedule.arrival_city, time: schedule.departure_time }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiDelete(`/api/bus-tickets/agencies/schedules/${schedule.id}`);
                            if (response.success) {
                                Alert.alert(t('message.success'), t('agencySchedules.scheduleDeleted'));
                                loadSchedules();
                            } else {
                                Alert.alert(t('message.error'), response.error || t('agencySchedules.cannotDelete'));
                            }
                        } catch (error: any) {
                            console.error('[ManageAgencySchedulesScreen] Erreur suppression:', error);
                            Alert.alert(t('message.error'), error.message || t('agencySchedules.genericError'));
                        }
                    },
                },
            ]
        );
    };

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('manageAgencySchedules.chargement')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('manageAgencySchedules.horairesDeDepart')}</Text>
                <TouchableOpacity onPress={handleAddSchedule} style={styles.addButton}>
                    <SafeIcon name="plus" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {schedules.length === 0 ? (
                    <View style={styles.emptyState}>
                        <SafeIcon name="clock" size={64} color="#D1D5DB" />
                        <Text style={styles.emptyStateTitle}>{t('manageAgencySchedules.aucunHoraireConfigure')}</Text>
                        <Text style={styles.emptyStateText}>
                            Créez votre premier horaire de départ pour permettre aux clients de sélectionner l'heure de retour souhaitée
                        </Text>
                        <TouchableOpacity style={styles.emptyStateButton} onPress={handleAddSchedule}>
                            <SafeIcon name="plus" size={20} color="#fff" />
                            <Text style={styles.emptyStateButtonText}>{t('manageAgencySchedules.creerUnHoraire')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    schedules.map((schedule) => (
                        <View key={schedule.id} style={styles.scheduleCard}>
                            <View style={styles.scheduleHeader}>
                                <View style={styles.scheduleRoute}>
                                    <Text style={styles.scheduleRouteText}>
                                        {schedule.departure_city} → {schedule.arrival_city}
                                    </Text>
                                    <Text style={styles.scheduleTime}>{schedule.departure_time}</Text>
                                </View>
                                <Switch
                                    value={schedule.is_active}
                                    onValueChange={async (value) => {
                                        try {
                                            await apiPut(`/api/bus-tickets/agencies/schedules/${schedule.id}`, {
                                                is_active: value,
                                            });
                                            loadSchedules();
                                        } catch (error) {
                                            Alert.alert(t('message.error'), t('agencySchedules.cannotUpdate'));
                                        }
                                    }}
                                    trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                                />
                            </View>
                            <View style={styles.scheduleDays}>
                                {schedule.day_of_week && schedule.day_of_week.length > 0 ? (
                                    schedule.day_of_week.map(day => (
                                        <View key={day} style={styles.dayBadge}>
                                            <Text style={styles.dayBadgeText}>
                                                {DAYS_OF_WEEK.find(d => d.value === day)?.label || `Jour ${day}`}
                                            </Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.allDaysText}>{t('manageAgencySchedules.tousLesJours')}</Text>
                                )}
                            </View>
                            <View style={styles.scheduleActions}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleEditSchedule(schedule)}
                                >
                                    <SafeIcon name="edit" size={18} color={modernColors.primary} />
                                    <Text style={styles.actionButtonText}>{t('manageAgencySchedulesScreen.modifier')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.deleteButton]}
                                    onPress={() => handleDeleteSchedule(schedule)}
                                >
                                    <SafeIcon name="trash-2" size={18} color="#DC2626" />
                                    <Text style={[styles.actionButtonText, styles.deleteButtonText]}>{t('manageAgencySchedulesScreen.supprimer')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Modal d'ajout/modification */}
            {showAddModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingSchedule ? 'Modifier l\'horaire' : 'Nouvel horaire'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>{t('manageAgencySchedules.villeDeDepart')}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={departureCity}
                                    onChangeText={setDepartureCity}
                                    placeholder="Ex: Douala"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>{t('manageAgencySchedules.villeDarrivee')}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={arrivalCity}
                                    onChangeText={setArrivalCity}
                                    placeholder={t('manageAgencySchedules.exYaounde')}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>{t('manageAgencySchedules.heureDeDepart')}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={departureTime}
                                    onChangeText={setDepartureTime}
                                    placeholder="HH:MM (ex: 08:00)"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>{t('manageAgencySchedules.joursDeLaSemaine')}/Text>
                                <View style={styles.daysGrid}>
                                    {DAYS_OF_WEEK.map((day) => (
                                        <TouchableOpacity
                                            key={day.value}
                                            style={[
                                                styles.dayButton,
                                                selectedDays.includes(day.value) && styles.dayButtonSelected,
                                            ]}
                                            onPress={() => toggleDay(day.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.dayButtonText,
                                                    selectedDays.includes(day.value) && styles.dayButtonTextSelected,
                                                ]}
                                            >
                                                {day.label.substring(0, 3)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <View style={styles.switchRow}>
                                    <Text style={styles.label}>Actif</Text>
                                    <Switch
                                        value={isActive}
                                        onValueChange={setIsActive}
                                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>{t('manageAgencySchedulesScreen.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSaveSchedule}
                            >
                                <Text style={styles.saveButtonText}>
                                    {editingSchedule ? 'Modifier' : t('manageAgencySchedulesScreen.creer')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    addButton: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
        paddingHorizontal: 32,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    emptyStateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    emptyStateButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    scheduleCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    scheduleRoute: {
        flex: 1,
    },
    scheduleRouteText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    scheduleTime: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    scheduleDays: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    dayBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    dayBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    allDaysText: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    scheduleActions: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        gap: 6,
        flex: 1,
        justifyContent: 'center',
    },
    deleteButton: {
        backgroundColor: '#FEF2F2',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    deleteButtonText: {
        color: '#DC2626',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 500,
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
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalBody: {
        padding: 20,
        maxHeight: 400,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#111827',
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
        backgroundColor: '#F9FAFB',
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
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    saveButton: {
        backgroundColor: modernColors.primary,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default ManageAgencySchedulesScreen;

