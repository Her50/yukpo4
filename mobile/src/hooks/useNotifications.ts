import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { apiPost } from '../services/api';
import SafeStorage from '../utils/safeStorage';

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

        console.warn('[useNotifications] ⚠️ ProjectId Expo non trouvé dans la configuration');
        return null;
    } catch (error) {
        console.error('[useNotifications] ❌ Erreur récupération projectId:', error);
        return null;
    }
}

const PUSH_TOKEN_KEY = '@yukpomnang:push_token';

// Configuration du comportement des notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

interface NotificationData {
    type?: string;
    busId?: string;
    tripId?: string;
    returnDate?: string;
    [key: string]: any;
}

export const useNotifications = (userId?: string) => {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const notificationListener = useRef<any>();
    const responseListener = useRef<any>();

    // Enregistrer le token push sur le serveur
    const registerPushToken = async (token: string, userId: string) => {
        try {
            await apiPost('/api/notifications/register-token', {
                userId,
                pushToken: token,
                platform: Platform.OS,
            });
            console.log('✅ Token push enregistré sur le serveur');
        } catch (error) {
            console.error('❌ Erreur enregistrement token push:', error);
        }
    };

    // Obtenir le token de notification
    const registerForPushNotificationsAsync = async () => {
        let token: string | null = null;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366F1',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('❌ Permission notifications refusée');
                return null;
            }

            try {
                // ✅ CORRIGÉ: Utiliser getExpoProjectId() au lieu d'un projectId hardcodé
                const projectId = getExpoProjectId();
                if (!projectId) {
                    console.warn('⚠️ ProjectId Expo non disponible, impossible d\'obtenir le token push');
                    return null;
                }
                
                token = (await Notifications.getExpoPushTokenAsync({
                    projectId: projectId
                })).data;
                console.log('📱 Push token obtenu:', token);
            } catch (error: any) {
                // Gestion spécifique de l'erreur EXPERIENCE_NOT_FOUND
                const errorMessage = error?.message || '';
                const errorString = JSON.stringify(error || {});
                if (
                    errorMessage.includes('EXPERIENCE_NOT_FOUND') ||
                    errorString.includes('EXPERIENCE_NOT_FOUND') ||
                    errorMessage.includes('does not exist') ||
                    error?.code === 'ERR_NOTIFICATIONS_SERVER_ERROR'
                ) {
                    console.warn('⚠️ Expérience Expo non trouvée ou non configurée');
                    console.warn('💡 Vérifiez que le projectId Expo est correct dans app.json');
                    return null;
                }
                console.error('❌ Erreur obtention token:', error);
                return null;
            }
        } else {
            console.log('⚠️ Notifications push ne fonctionnent que sur un appareil physique');
        }

        return token;
    };

    // S'abonner aux notifications de retour de bus
    const subscribeToReturnBusNotifications = async (
        userId: string,
        originalBusId: string,
        returnDate: string,
        returnTime: string,
        departureCity: string,
        arrivalCity: string
    ) => {
        try {
            await apiPost('/api/notifications/subscribe-return-bus', {
                userId,
                originalBusId,
                returnDate,
                returnTime,
                departureCity,
                arrivalCity,
            });
            console.log('✅ Abonné aux notifications de bus retour');
        } catch (error) {
            console.error('❌ Erreur abonnement notifications:', error);
        }
    };

    // Se désabonner des notifications
    const unsubscribeFromReturnBusNotifications = async (userId: string, requestId: string) => {
        try {
            await apiPost('/api/notifications/unsubscribe-return-bus', {
                userId,
                requestId,
            });
            console.log('✅ Désabonné des notifications de bus retour');
        } catch (error) {
            console.error('❌ Erreur désabonnement notifications:', error);
        }
    };

    // Initialisation
    useEffect(() => {
        // Charger le token sauvegardé
        const loadToken = async () => {
            const savedToken = await SafeStorage.getItem(PUSH_TOKEN_KEY);
            if (savedToken) {
                setExpoPushToken(savedToken);
                if (userId) {
                    await registerPushToken(savedToken, userId);
                }
            }
        };

        loadToken();

        // Enregistrer pour les notifications
        registerForPushNotificationsAsync().then(async (token) => {
            if (token) {
                setExpoPushToken(token);
                await SafeStorage.setItem(PUSH_TOKEN_KEY, token);
                if (userId) {
                    await registerPushToken(token, userId);
                }
            }
        });

        // Listener pour les notifications reçues
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log('📩 Notification reçue:', notification);
            setNotification(notification);
        });

        // Listener pour les interactions avec les notifications
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('👆 Notification cliquée:', response);
            const data = response.notification.request.content.data as NotificationData;

            // Gérer la navigation en fonction du type de notification
            if (data.type === 'return_bus_available') {
                // Navigation vers le bus retour disponible
                console.log('🚌 Bus retour disponible, ID:', data.busId);
                // TODO: Implémenter la navigation
            }
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, [userId]);

    return {
        expoPushToken,
        notification,
        subscribeToReturnBusNotifications,
        unsubscribeFromReturnBusNotifications,
    };
};

// Fonction utilitaire pour envoyer une notification locale (pour les tests)
export const sendLocalNotification = async (title: string, body: string, data?: any) => {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data,
            sound: true,
        },
        trigger: null, // Envoyer immédiatement
    });
};

