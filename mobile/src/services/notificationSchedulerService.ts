// Service générique pour toutes les notifications planifiées - H0 Foundation
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEDICAMENT_REMINDERS_KEY = '@yukpo_medicament_reminders';

export interface MedicamentReminder {
    id: string;
    name: string;
    times: string[];       // ex: ["08:00", "14:00", "20:00"]
    frequency: 'daily' | 'weekly' | 'custom';
    notificationIds: string[];
    createdAt: string;
    active: boolean;
}

export const notificationSchedulerService = {
    // ── Permissions ─────────────────────────────────────────────────
    requestPermissions: async (): Promise<boolean> => {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    },

    // ── Rappel RDV ────────────────────────────────────────────────────
    scheduleRDVReminder: async (
        date: Date,
        title: string,
        body: string,
        id?: string
    ): Promise<string | null> => {
        try {
            const granted = await notificationSchedulerService.requestPermissions();
            if (!granted) return null;

            // Rappel 24h avant
            const reminderDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
            if (reminderDate <= new Date()) return null;

            const notifId = await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title,
                    body,
                    sound: true,
                    data: { type: 'rdv_reminder' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: reminderDate,
                },
            });
            return notifId;
        } catch (error) {
            console.warn('[notificationSchedulerService] scheduleRDVReminder error:', error);
            return null;
        }
    },

    cancelReminder: async (id: string): Promise<void> => {
        try {
            await Notifications.cancelScheduledNotificationAsync(id);
        } catch (error) {
            console.warn('[notificationSchedulerService] cancelReminder error:', error);
        }
    },

    // ── Feedback post-consultation ────────────────────────────────────
    schedulePostConsultationFeedback: async (
        date: Date,
        consultationId: string
    ): Promise<string | null> => {
        try {
            const granted = await notificationSchedulerService.requestPermissions();
            if (!granted) return null;

            // 2h après la consultation
            const feedbackDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);
            if (feedbackDate <= new Date()) return null;

            const notifId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Comment s\'est passée votre consultation ?',
                    body: 'Donnez votre avis pour aider la communauté',
                    sound: true,
                    data: { type: 'post_consultation_feedback', consultationId },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: feedbackDate,
                },
            });
            return notifId;
        } catch (error) {
            console.warn('[notificationSchedulerService] schedulePostConsultationFeedback error:', error);
            return null;
        }
    },

    // ── Don de sang ────────────────────────────────────────────────────
    scheduleBloodDonationReminder: async (date: Date): Promise<string | null> => {
        try {
            const granted = await notificationSchedulerService.requestPermissions();
            if (!granted) return null;
            if (date <= new Date()) return null;

            const notifId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Rappel don de sang',
                    body: 'Votre rendez-vous pour le don de sang approche',
                    sound: true,
                    data: { type: 'blood_donation_reminder' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date,
                },
            });
            return notifId;
        } catch (error) {
            console.warn('[notificationSchedulerService] scheduleBloodDonationReminder error:', error);
            return null;
        }
    },

    // ── Rappels médicament ────────────────────────────────────────────
    scheduleMedicamentReminder: async (
        name: string,
        times: string[],    // ["08:00", "14:00"]
        frequency: 'daily' | 'weekly' | 'custom',
        id?: string
    ): Promise<string> => {
        const reminderId = id || `med_${Date.now()}`;
        const notificationIds: string[] = [];

        try {
            const granted = await notificationSchedulerService.requestPermissions();
            if (granted) {
                for (const time of times) {
                    const [hours, minutes] = time.split(':').map(Number);
                    const notifId = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: `Médicament : ${name}`,
                            body: `Il est temps de prendre votre médicament`,
                            sound: true,
                            data: { type: 'medicament_reminder', reminderId, name },
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.DAILY,
                            hour: hours,
                            minute: minutes,
                        },
                    });
                    notificationIds.push(notifId);
                }
            }

            // Sauvegarder dans AsyncStorage
            const existing = await notificationSchedulerService.getAllMedicamentReminders();
            const updated = existing.filter(r => r.id !== reminderId);
            updated.push({
                id: reminderId,
                name,
                times,
                frequency,
                notificationIds,
                createdAt: new Date().toISOString(),
                active: true,
            });
            await AsyncStorage.setItem(MEDICAMENT_REMINDERS_KEY, JSON.stringify(updated));
        } catch (error) {
            console.warn('[notificationSchedulerService] scheduleMedicamentReminder error:', error);
        }

        return reminderId;
    },

    cancelMedicamentReminder: async (id: string): Promise<void> => {
        try {
            const reminders = await notificationSchedulerService.getAllMedicamentReminders();
            const reminder = reminders.find(r => r.id === id);
            if (reminder) {
                for (const notifId of reminder.notificationIds) {
                    await Notifications.cancelScheduledNotificationAsync(notifId);
                }
                const updated = reminders.map(r =>
                    r.id === id ? { ...r, active: false, notificationIds: [] } : r
                );
                await AsyncStorage.setItem(MEDICAMENT_REMINDERS_KEY, JSON.stringify(updated));
            }
        } catch (error) {
            console.warn('[notificationSchedulerService] cancelMedicamentReminder error:', error);
        }
    },

    getAllMedicamentReminders: async (): Promise<MedicamentReminder[]> => {
        try {
            const raw = await AsyncStorage.getItem(MEDICAMENT_REMINDERS_KEY);
            if (!raw) return [];
            return JSON.parse(raw) as MedicamentReminder[];
        } catch {
            return [];
        }
    },
};

export default notificationSchedulerService;
