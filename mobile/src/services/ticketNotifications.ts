/**
 * Service de notifications push pour les tickets de voyage
 * Gère les rappels, confirmations, et alertes
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import SafeStorage from '../utils/safeStorage';
import { analytics } from './analytics';

// Configuration des notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

interface NotificationData {
    ticketId: string;
    paymentId: string;
    departureDate: string;
    departureTime: string;
    departureCity: string;
    arrivalCity: string;
    type: 'reminder_24h' | 'reminder_2h' | 'confirmation' | 'delay' | 'change';
}

class TicketNotificationService {
    private initialized = false;
    private expoPushToken: string | null = null;

    /**
     * Initialiser le service de notifications
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Vérifier que c'est un appareil physique
            if (!Device.isDevice) {
                console.warn('[TicketNotifications] Les notifications ne fonctionnent que sur un appareil physique');
                return;
            }

            // Demander les permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.warn('[TicketNotifications] Permission de notification refusée');
                return;
            }

            // Obtenir le token Expo Push
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: '944bbf0d-5541-4e56-ba75-87ffc4c5e51f', // EAS project ID
            });
            this.expoPushToken = tokenData.data;

            // Sauvegarder le token
            await SafeStorage.setItem('expo_push_token', this.expoPushToken);

            // Envoyer le token au backend
            await this.registerTokenWithBackend(this.expoPushToken);

            // Configurer les gestionnaires d'événements
            this.setupNotificationHandlers();

            this.initialized = true;
            console.log('[TicketNotifications] Service initialisé avec token:', this.expoPushToken);
        } catch (error) {
            console.error('[TicketNotifications] Erreur initialisation:', error);
        }
    }

    /**
     * Enregistrer le token avec le backend
     */
    private async registerTokenWithBackend(token: string) {
        try {
            // TODO: Appel API pour enregistrer le token
            // await apiPost('/api/push/register', { token, platform: Platform.OS });
        } catch (error) {
            console.error('[TicketNotifications] Erreur enregistrement token:', error);
        }
    }

    /**
     * Configurer les gestionnaires d'événements
     */
    private setupNotificationHandlers() {
        // Notification reçue pendant que l'app est au premier plan
        Notifications.addNotificationReceivedListener((notification) => {
            console.log('[TicketNotifications] Notification reçue:', notification);
            analytics.track('notification_received', {
                notification_id: notification.request.identifier,
                notification_type: notification.request.content.data?.type,
            });
        });

        // Notification tapée par l'utilisateur
        Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('[TicketNotifications] Notification tapée:', response);
            const data = response.notification.request.content.data as NotificationData;

            analytics.track('notification_tapped', {
                notification_id: response.notification.request.identifier,
                notification_type: data?.type,
            });

            // TODO: Navigation vers l'écran approprié
            // navigation.navigate('BusTicketDetails', { paymentId: data.paymentId });
        });
    }

    /**
     * Planifier un rappel 24h avant le départ
     */
    async scheduleReminder24h(data: NotificationData) {
        try {
            const departureDate = new Date(`${data.departureDate} ${data.departureTime}`);
            const reminderDate = new Date(departureDate);
            reminderDate.setHours(reminderDate.getHours() - 24);

            // Ne pas planifier si c'est dans le passé
            if (reminderDate <= new Date()) {
                console.warn('[TicketNotifications] Rappel 24h dans le passé, ignoré');
                return;
            }

            const identifier = await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Rappel : Votre voyage demain',
                    body: `${data.departureCity} → ${data.arrivalCity} demain à ${data.departureTime}`,
                    data: { ...data, type: 'reminder_24h' },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: { type: 'date', date: reminderDate } as any,
            });

            // Sauvegarder l'identifiant pour pouvoir l'annuler
            await this.saveNotificationId(data.paymentId, 'reminder_24h', identifier);

            console.log('[TicketNotifications] Rappel 24h planifié:', identifier);
        } catch (error) {
            console.error('[TicketNotifications] Erreur planification rappel 24h:', error);
        }
    }

    /**
     * Planifier un rappel 2h avant le départ
     */
    async scheduleReminder2h(data: NotificationData) {
        try {
            const departureDate = new Date(`${data.departureDate} ${data.departureTime}`);
            const reminderDate = new Date(departureDate);
            reminderDate.setHours(reminderDate.getHours() - 2);

            // Ne pas planifier si c'est dans le passé
            if (reminderDate <= new Date()) {
                console.warn('[TicketNotifications] Rappel 2h dans le passé, ignoré');
                return;
            }

            const identifier = await Notifications.scheduleNotificationAsync({
                content: {
                    title: '⏰ Départ dans 2 heures !',
                    body: `N'oubliez pas votre voyage ${data.departureCity} → ${data.arrivalCity} à ${data.departureTime}`,
                    data: { ...data, type: 'reminder_2h' },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: { type: 'date', date: reminderDate } as any,
            });

            await this.saveNotificationId(data.paymentId, 'reminder_2h', identifier);

            console.log('[TicketNotifications] Rappel 2h planifié:', identifier);
        } catch (error) {
            console.error('[TicketNotifications] Erreur planification rappel 2h:', error);
        }
    }

    /**
     * Envoyer une notification de confirmation
     */
    async sendConfirmation(data: NotificationData) {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '✅ Réservation confirmée',
                    body: `Votre ticket ${data.departureCity} → ${data.arrivalCity} est confirmé`,
                    data: { ...data, type: 'confirmation' },
                    sound: true,
                },
                trigger: null, // Envoyer immédiatement
            });

            analytics.track('notification_sent', {
                notification_type: 'confirmation',
                ticket_id: data.ticketId,
            });
        } catch (error) {
            console.error('[TicketNotifications] Erreur envoi confirmation:', error);
        }
    }

    /**
     * Envoyer une notification de retard
     */
    async sendDelayNotification(data: NotificationData, delayMinutes: number) {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '⚠️ Retard annoncé',
                    body: `Votre bus ${data.departureCity} → ${data.arrivalCity} a ${delayMinutes} minutes de retard`,
                    data: { ...data, type: 'delay', delayMinutes },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null,
            });
        } catch (error) {
            console.error('[TicketNotifications] Erreur envoi retard:', error);
        }
    }

    /**
     * Annuler toutes les notifications pour un ticket
     */
    async cancelTicketNotifications(paymentId: string) {
        try {
            const notificationIds = await this.getNotificationIds(paymentId);

            for (const id of notificationIds) {
                await Notifications.cancelScheduledNotificationAsync(id);
            }

            // Supprimer les IDs sauvegardés
            await SafeStorage.removeItem(`notification_ids_${paymentId}`);
        } catch (error) {
            console.error('[TicketNotifications] Erreur annulation notifications:', error);
        }
    }

    /**
     * Sauvegarder l'ID d'une notification
     */
    private async saveNotificationId(
        paymentId: string,
        type: string,
        identifier: string
    ) {
        try {
            const key = `notification_ids_${paymentId}`;
            const existing = await SafeStorage.getItem(key);
            const ids = existing ? JSON.parse(existing) : {};
            ids[type] = identifier;
            await SafeStorage.setItem(key, JSON.stringify(ids));
        } catch (error) {
            console.error('[TicketNotifications] Erreur sauvegarde ID:', error);
        }
    }

    /**
     * Récupérer les IDs de notifications pour un ticket
     */
    private async getNotificationIds(paymentId: string): Promise<string[]> {
        try {
            const key = `notification_ids_${paymentId}`;
            const data = await SafeStorage.getItem(key);
            if (data) {
                const ids = JSON.parse(data);
                return Object.values(ids) as string[];
            }
            return [];
        } catch (error) {
            console.error('[TicketNotifications] Erreur récupération IDs:', error);
            return [];
        }
    }

    /**
     * Planifier tous les rappels pour un ticket
     */
    async scheduleAllReminders(data: NotificationData) {
        await this.scheduleReminder24h(data);
        await this.scheduleReminder2h(data);
    }

    /**
     * Obtenir le token Expo Push
     */
    getExpoPushToken(): string | null {
        return this.expoPushToken;
    }
}

// Instance singleton
export const ticketNotifications = new TicketNotificationService();

// Initialiser automatiquement
ticketNotifications.initialize();

export default ticketNotifications;


