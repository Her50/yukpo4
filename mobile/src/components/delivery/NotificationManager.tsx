/**
 * 🔔 Gestionnaire de notifications push pour livraisons
 * Système complet niveau Uber Eats / DoorDash
 */

import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary } from '../../types/delivery';
import { useLanguageSafe } from '../../contexts/LanguageContext';

// Configuration des notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

interface NotificationManagerProps {
    delivery?: DeliverySummary | null;
    onNotificationPress?: (deliveryId: string) => void;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({
    delivery,
    onNotificationPress,
}) => {
        const { t } = useLanguageSafe();
const [expoPushToken, setExpoPushToken] = useState<string>('');
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();

    useEffect(() => {
        // Demander les permissions
        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                setExpoPushToken(token);
            }
        }).catch(error => {
            console.error('[NotificationManager] Erreur registerForPushNotificationsAsync:', error);
        });

        // Écouter les notifications reçues
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        // Écouter les notifications pressées
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            if (data?.deliveryId && onNotificationPress) {
                onNotificationPress(data.deliveryId);
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
    }, []);

    return null; // Composant invisible, juste pour gérer les notifications
};

/**
 * Envoyer une notification pour un changement de statut de livraison
 */
export const sendDeliveryStatusNotification = async (
    deliveryId: string,
    status: string,
    title: string,
    body: string
) => {
    const statusEmojis: Record<string, string> = {
        'assigned': '👤',
        'en_route_pickup': '🚚',
        'shopping_in_progress': '🛒',
        'en_route_delivery': '📦',
        'delivered': '✅',
        'cancelled': '❌',
    };

    await Notifications.scheduleNotificationAsync({
        content: {
            title: `${statusEmojis[status] || '📦'} ${title}`,
            body,
            data: { deliveryId, status },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Immédiat
    });
};

/**
 * Envoyer une notification pour une nouvelle livraison disponible (coursier)
 */
export const sendNewDeliveryAvailableNotification = async (
    deliveryId: string,
    distance: number,
    estimatedEarnings: number
) => {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: t('notificationManager.nouvelleLivraisonDisponible'),
            body: t('notificationManager.livraisonAKmFcfa', { distance_toFixed(1): distance.toFixed(1), estimatedEarnings_toLocaleString('fr-FR'): estimatedEarnings.toLocaleString('fr-FR') }),
            data: { deliveryId, type: 'new_delivery' },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
    });
};

/**
 * Enregistrer pour les notifications push
 */
async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('delivery-updates', {
            name: t('notificationManager.misesAJourDeLivraison'),
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: modernColors.primary,
        });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('Permissions de notification non accordées');
        return null;
    }

    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: 'your-project-id', // À remplacer par votre project ID
        });
        token = tokenData.data;
    } catch (error) {
        console.error('Erreur obtention token push:', error);
    }

    return token;
}

export default NotificationManager;


