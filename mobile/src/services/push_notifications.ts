// ✅ Phase 6.1: Service de notifications push pour services spécialisés

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
// ✅ CORRIGÉ: Utiliser SafeStorage au lieu d'AsyncStorage directement
import SafeStorage from '../utils/safeStorage';

// Configuration des notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export interface NotificationPreferences {
    pharmacy_on_duty: boolean;
    carpool_match: boolean;
    taxi_nearby: boolean;
    weekly_summary: boolean;
    live_events: boolean;
    flash_promos: boolean;
}

export class PushNotificationService {
    private static instance: PushNotificationService;
    private expoPushToken: string | null = null;
    private preferences: NotificationPreferences = {
        pharmacy_on_duty: true,
        carpool_match: true,
        taxi_nearby: true,
        weekly_summary: true,
        live_events: true,
        flash_promos: true,
    };

    private constructor() { }

    static getInstance(): PushNotificationService {
        if (!PushNotificationService.instance) {
            PushNotificationService.instance = new PushNotificationService();
        }
        return PushNotificationService.instance;
    }

    /**
     * Demander les permissions et enregistrer le token
     * ✅ Phase 6.1: Envoie automatiquement le token au backend
     */
    async registerForPushNotifications(userId?: number): Promise<string | null> {
        try {
            // Demander les permissions
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

            // Obtenir le token Expo avec projectId EAS
            const projectId =
                Constants.expoConfig?.extra?.eas?.projectId ||
                (Constants as any).manifest2?.extra?.eas?.projectId ||
                (Constants as any).manifest?.extra?.eas?.projectId;
            if (!projectId) {
                console.warn('[PushNotificationService] ⚠️ projectId Expo/EAS introuvable');
                return null;
            }
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId,
            });
            this.expoPushToken = tokenData.data;
            console.log('[PushNotificationService] Token obtenu:', this.expoPushToken);

            // ✅ Phase 6.1: Envoyer le token au backend si userId fourni
            if (userId && this.expoPushToken) {
                try {
                    const { apiPost } = require('./api');
                    const Device = require('expo-device').default || require('expo-device');
                    const response = await apiPost('/api/push/register', {
                        push_token: this.expoPushToken,
                        device_type: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
                        device_id: Device?.deviceId || Device?.deviceName || null,
                    });
                    if (response.success) {
                        console.log('[PushNotificationService] ✅ Token enregistré au backend');
                    } else {
                        console.warn('[PushNotificationService] Échec enregistrement token:', response.error);
                    }
                } catch (error: any) {
                    console.error('[PushNotificationService] Erreur enregistrement token au backend:', error);
                    // Ne pas bloquer si l'enregistrement échoue
                }
            }

            // Configuration Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            return this.expoPushToken;
        } catch (error) {
            console.error('[PushNotificationService] Erreur enregistrement:', error);
            return null;
        }
    }

    /**
     * Obtenir le token push actuel
     */
    getExpoPushToken(): string | null {
        return this.expoPushToken;
    }

    /**
     * Envoyer une notification locale
     */
    async scheduleLocalNotification(
        title: string,
        body: string,
        data?: any
    ): Promise<string> {
        try {
            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: data || {},
                    sound: true,
                },
                trigger: null, // Immédiat
            });
            return notificationId;
        } catch (error) {
            console.error('[PushNotificationService] Erreur notification locale:', error);
            throw error;
        }
    }

    /**
     * Gérer les notifications reçues
     */
    setupNotificationHandlers(
        onNotificationReceived?: (notification: Notifications.Notification) => void,
        onNotificationTapped?: (response: Notifications.NotificationResponse) => void
    ) {
        // Notification reçue en foreground
        Notifications.addNotificationReceivedListener((notification) => {
            console.log('[PushNotificationService] Notification reçue:', notification);
            if (onNotificationReceived) {
                onNotificationReceived(notification);
            }
        });

        // Notification tapée par l'utilisateur
        Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('[PushNotificationService] Notification tapée:', response);
            if (onNotificationTapped) {
                onNotificationTapped(response);
            }
        });
    }

    /**
     * Charger les préférences de notifications
     */
    async loadPreferences(): Promise<NotificationPreferences> {
        try {
            // ✅ CORRIGÉ: Utiliser SafeStorage directement (déjà importé)
            const saved = await SafeStorage.getItem('notification_preferences');
            if (saved) {
                this.preferences = JSON.parse(saved);
            }
            return this.preferences;
        } catch (error) {
            console.error('[PushNotificationService] Erreur chargement préférences:', error);
            return this.preferences;
        }
    }

    /**
     * Sauvegarder les préférences de notifications
     */
    async savePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
        try {
            this.preferences = { ...this.preferences, ...preferences };
            // ✅ CORRIGÉ: Utiliser SafeStorage directement (déjà importé)
            await SafeStorage.setItem('notification_preferences', JSON.stringify(this.preferences));
        } catch (error) {
            console.error('[PushNotificationService] Erreur sauvegarde préférences:', error);
            throw error;
        }
    }

    /**
     * Vérifier si un type de notification est activé
     */
    isNotificationEnabled(type: keyof NotificationPreferences): boolean {
        return this.preferences[type];
    }

    /**
     * Traiter une notification de service spécialisé
     */
    async handleSpecializedNotification(notification: Notifications.Notification) {
        const data = notification.request.content.data;
        const notificationType = data?.type;

        if (!notificationType) return;

        switch (notificationType) {
            case 'pharmacy_on_duty':
                if (this.isNotificationEnabled('pharmacy_on_duty')) {
                    // Naviguer vers la pharmacie
                    console.log('[PushNotificationService] Notification pharmacie:', data);
                }
                break;
            case 'carpool_match':
                if (this.isNotificationEnabled('carpool_match')) {
                    // Naviguer vers le covoiturage
                    console.log('[PushNotificationService] Notification covoiturage:', data);
                }
                break;
            case 'taxi_nearby':
                if (this.isNotificationEnabled('taxi_nearby')) {
                    // Naviguer vers les taxis
                    console.log('[PushNotificationService] Notification taxi:', data);
                }
                break;
            case 'weekly_summary':
                if (this.isNotificationEnabled('weekly_summary')) {
                    // Naviguer vers le dashboard
                    console.log('[PushNotificationService] Notification résumé:', data);
                }
                break;
            case 'live_scheduled':
            case 'live_live_now':
            case 'live_replay_ready':
                if (this.isNotificationEnabled('live_events')) {
                    console.log('[PushNotificationService] Notification Live:', notificationType, data);
                }
                break;
            case 'live_flash_sale_scheduled':
            case 'live_flash_sale_live':
            case 'live_flash_sale_ending':
            case 'live_flash_sale_commentary':
                if (this.isNotificationEnabled('flash_promos')) {
                    console.log('[PushNotificationService] Notification Flash Promo:', notificationType, data);
                }
                break;
        }
    }
}

export const pushNotificationService = PushNotificationService.getInstance();

