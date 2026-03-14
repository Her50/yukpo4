// ✅ Service push notifications pour rappels covoiturage
// Date: 2025-01-29

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuration des notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export interface TripReminderNotification {
    reservationId: number;
    tripId: number;
    depart: string;
    destination: string;
    departureTime: Date;
    reminderType: '24h' | '2h';
}

class PushNotificationService {
    private static instance: PushNotificationService;
    private expoPushToken: string | null = null;

    private constructor() { }

    static getInstance(): PushNotificationService {
        if (!PushNotificationService.instance) {
            PushNotificationService.instance = new PushNotificationService();
        }
        return PushNotificationService.instance;
    }

    /**
     * Demande les permissions et enregistre le token
     */
    async registerForPushNotifications(): Promise<string | null> {
        try {
            // Demander permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.warn('[PushNotificationService] Permissions refusées');
                return null;
            }

            // Obtenir token Expo
            // Note: projectId est optionnel, Expo le détecte automatiquement
            const tokenData = await Notifications.getExpoPushTokenAsync();

            this.expoPushToken = tokenData.data;
            console.log('[PushNotificationService] Token obtenu:', this.expoPushToken);

            // Configuration Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('trip-reminders', {
                    name: 'Rappels trajets',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                    sound: 'default',
                });
            }

            return this.expoPushToken;
        } catch (error) {
            console.error('[PushNotificationService] Erreur enregistrement:', error);
            return null;
        }
    }

    /**
     * Planifie une notification locale pour rappel trajet
     */
    async scheduleTripReminder(reminder: TripReminderNotification): Promise<string | null> {
        try {
            const now = new Date();
            const departureTime = new Date(reminder.departureTime);

            // Calculer le temps jusqu'au rappel
            let triggerTime: Date;
            if (reminder.reminderType === '24h') {
                triggerTime = new Date(departureTime.getTime() - 24 * 60 * 60 * 1000);
            } else {
                triggerTime = new Date(departureTime.getTime() - 2 * 60 * 60 * 1000);
            }

            // Vérifier que le rappel est dans le futur
            if (triggerTime <= now) {
                console.warn('[PushNotificationService] Rappel dans le passé, ignoré');
                return null;
            }

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: reminder.reminderType === '24h'
                        ? 'Rappel trajet - Demain'
                        : 'Rappel trajet - Dans 2h',
                    body: `Votre trajet ${reminder.depart} → ${reminder.destination} part ${reminder.reminderType === '24h' ? 'demain' : 'dans 2h'}`,
                    data: {
                        reservationId: reminder.reservationId,
                        tripId: reminder.tripId,
                        type: 'trip_reminder',
                        reminderType: reminder.reminderType,
                    },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: {
                    type: 'date',
                    date: triggerTime,
                } as any,
            });

            console.log(`[PushNotificationService] Rappel ${reminder.reminderType} planifié:`, notificationId);
            return notificationId;
        } catch (error) {
            console.error('[PushNotificationService] Erreur planification rappel:', error);
            return null;
        }
    }

    /**
     * Planifie les deux rappels (24h et 2h) pour un trajet
     */
    async scheduleTripReminders(reminder: Omit<TripReminderNotification, 'reminderType'>): Promise<{
        reminder24h: string | null;
        reminder2h: string | null;
    }> {
        const reminder24h = await this.scheduleTripReminder({
            ...reminder,
            reminderType: '24h',
        });

        const reminder2h = await this.scheduleTripReminder({
            ...reminder,
            reminderType: '2h',
        });

        return { reminder24h, reminder2h };
    }

    /**
     * Annule une notification planifiée
     */
    async cancelNotification(notificationId: string): Promise<void> {
        try {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
            console.log('[PushNotificationService] Notification annulée:', notificationId);
        } catch (error) {
            console.error('[PushNotificationService] Erreur annulation:', error);
        }
    }

    /**
     * Annule toutes les notifications d'un type
     */
    async cancelAllTripReminders(reservationId: number): Promise<void> {
        try {
            const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

            for (const notification of scheduledNotifications) {
                if (notification.content.data?.reservationId === reservationId) {
                    await this.cancelNotification(notification.identifier);
                }
            }
        } catch (error) {
            console.error('[PushNotificationService] Erreur annulation rappels:', error);
        }
    }

    /**
     * Obtient le token Expo actuel
     */
    getExpoPushToken(): string | null {
        return this.expoPushToken;
    }
}

export default PushNotificationService.getInstance();
