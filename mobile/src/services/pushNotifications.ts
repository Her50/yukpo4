// Service de push notifications avec Expo
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api.config';

// ✅ CORRIGÉ: Utilise la configuration centralisée
const API_URL = API_BASE_URL;

/**
 * Obtenir le projectId Expo depuis la configuration
 * @returns Le projectId ou null si non disponible
 */
function getExpoProjectId(): string | null {
    try {
        // Essayer d'obtenir depuis Constants.expoConfig (recommandé)
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (projectId && typeof projectId === 'string') {
            return projectId;
        }

        // Fallback: essayer depuis Constants.manifest2 (nouveau système)
        const manifestProjectId = (Constants as any).manifest2?.extra?.eas?.projectId;
        if (manifestProjectId && typeof manifestProjectId === 'string') {
            return manifestProjectId;
        }

        // Fallback: essayer depuis Constants.manifest (ancien système)
        const legacyProjectId = (Constants as any).manifest?.extra?.eas?.projectId;
        if (legacyProjectId && typeof legacyProjectId === 'string') {
            return legacyProjectId;
        }

        console.warn('[PushNotifications] ⚠️ ProjectId Expo non trouvé dans la configuration');
        return null;
    } catch (error) {
        console.error('[PushNotifications] ❌ Erreur récupération projectId:', error);
        return null;
    }
}

// Configuration du comportement des notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Enregistrer l'appareil pour les push notifications
 * @param userToken - Token JWT de l'utilisateur
 * @returns Promise<string | null> - Token push ou null si échec
 */
export async function registerForPushNotificationsAsync(userToken: string): Promise<string | null> {
    try {
        console.log('[PushNotifications] 📱 Enregistrement pour push notifications...');

        // Vérifier si c'est un appareil physique
        if (!Device.isDevice) {
            console.warn('[PushNotifications] ⚠️ Push notifications non supportées sur émulateur');
            return null;
        }

        // Demander les permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.warn('[PushNotifications] ❌ Permission refusée pour push notifications');
            return null;
        }

        // Obtenir le token Expo Push
        let expoPushToken: string;
        try {
            // ✅ CORRIGÉ: Obtenir le projectId depuis la configuration Expo
            const projectId = getExpoProjectId();
            if (!projectId) {
                console.warn('[PushNotifications] ⚠️ ProjectId Expo non disponible, impossible d\'obtenir le token push');
                return null;
            }

            console.log('[PushNotifications] 📋 Utilisation projectId Expo:', projectId.substring(0, 8) + '...');

            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: projectId
            });
            expoPushToken = tokenData.data;
            console.log('[PushNotifications] ✅ Token Expo obtenu:', expoPushToken.substring(0, 20) + '...');
        } catch (tokenError: any) {
            // Gestion spécifique de l'erreur Firebase sur Android
            if (Platform.OS === 'android' && tokenError?.code === 'E_REGISTRATION_FAILED') {
                console.warn('[PushNotifications] ⚠️ Firebase non configuré pour Android');
                console.warn('[PushNotifications] 📖 Suivez le guide: https://docs.expo.dev/push-notifications/fcm-credentials/');
                // Ne pas faire crasher l'app, retourner null gracieusement
                return null;
            }

            // Gestion de l'erreur EXPERIENCE_NOT_FOUND (expérience Expo non trouvée)
            const errorMessage = tokenError?.message || '';
            const errorString = JSON.stringify(tokenError || {});
            if (
                errorMessage.includes('EXPERIENCE_NOT_FOUND') ||
                errorString.includes('EXPERIENCE_NOT_FOUND') ||
                errorMessage.includes('does not exist') ||
                tokenError?.code === 'ERR_NOTIFICATIONS_SERVER_ERROR'
            ) {
                console.warn('[PushNotifications] ⚠️ Expérience Expo non trouvée ou non configurée');
                console.warn('[PushNotifications] 💡 Vérifiez que le projectId Expo est correct dans app.json');
                // Ne pas faire crasher l'app, retourner null gracieusement
                return null;
            }

            // Pour les autres erreurs, logger en warning plutôt qu'en erreur
            console.warn('[PushNotifications] ⚠️ Erreur lors de la récupération du token Expo:', tokenError?.message || tokenError);
            // Ne pas faire crasher l'app, retourner null gracieusement
            return null;
        }

        // Configurer le canal de notifications pour Android
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Notifications Yukpo',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366F1',
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
            });

            // Canal spécial pour les appels
            await Notifications.setNotificationChannelAsync('calls', {
                name: 'Appels entrants',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 500, 500],
                lightColor: '#10B981',
                sound: 'call_ringtone',
                enableVibrate: true,
                showBadge: true,
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            });
        }

        // Enregistrer le token sur le serveur
        const deviceId = await getDeviceId();
        const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';

        const response = await fetch(`${API_URL}/api/push/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
                push_token: expoPushToken,
                device_type: deviceType,
                device_id: deviceId
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[PushNotifications] ✅ Token enregistré sur le serveur:', data);
        } else {
            console.error('[PushNotifications] ❌ Erreur enregistrement serveur:', response.status);
        }

        return expoPushToken;

    } catch (error) {
        console.error('[PushNotifications] ❌ Erreur:', error);
        return null;
    }
}

/**
 * Obtenir l'ID unique de l'appareil
 */
async function getDeviceId(): Promise<string | undefined> {
    try {
        // Pour Android, utiliser androidId
        if (Platform.OS === 'android') {
            return Device.osInternalBuildId || undefined;
        }
        // Pour iOS, utiliser identifierForVendor
        // Note: Nécessite expo-device
        return undefined;
    } catch (error) {
        console.error('[PushNotifications] Erreur récupération device ID:', error);
        return undefined;
    }
}

/**
 * Désactiver le token push (lors de la déconnexion)
 */
export async function unregisterPushToken(pushToken: string, userToken: string): Promise<boolean> {
    try {
        console.log('[PushNotifications] 🔕 Désactivation token push...');

        const response = await fetch(`${API_URL}/api/push/deactivate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
                push_token: pushToken
            })
        });

        if (response.ok) {
            console.log('[PushNotifications] ✅ Token désactivé');
            return true;
        }

        return false;
    } catch (error) {
        console.error('[PushNotifications] ❌ Erreur désactivation:', error);
        return false;
    }
}

/**
 * Gérer les notifications reçues quand l'app est au premier plan
 */
export function setupForegroundNotificationHandler(
    onNotificationReceived: (notification: Notifications.Notification) => void
) {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('[PushNotifications] 🔔 Notification reçue (foreground):', notification);
        onNotificationReceived(notification);
    });

    return subscription;
}

/**
 * Gérer les interactions avec les notifications (tap)
 */
export function setupNotificationResponseHandler(
    onNotificationTap: (response: Notifications.NotificationResponse) => void
) {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('[PushNotifications] 👆 Notification tapée:', response);
        onNotificationTap(response);
    });

    return subscription;
}

/**
 * Envoyer une notification locale (test)
 */
export async function sendLocalNotification(
    title: string,
    body: string,
    data?: any
): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data,
            sound: 'default',
        },
        trigger: null, // Immédiat
    });
}

/**
 * Annuler toutes les notifications planifiées
 */
export async function cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Mettre à jour le badge de l'icône
 */
export async function setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
}

