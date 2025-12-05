/**
 * 🔔 Hook pour notifications de livraison
 * Intégration complète avec le système de livraison
 */

import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { sendDeliveryStatusNotification } from '../components/delivery/NotificationManager';
import { useDeliveryContext } from '../contexts/DeliveryContext';
import { DeliveryRealtimeEvent } from '../types/delivery';

/**
 * Hook pour gérer les notifications de livraison
 */
export const useDeliveryNotifications = (userId?: string | number) => {
    const { registerDeliveryListener, deliveries } = useDeliveryContext();
    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();

    useEffect(() => {
        // Configurer les notifications
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
            }),
        });

        // Écouter les notifications reçues
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('[useDeliveryNotifications] Notification reçue:', notification);
        });

        // Écouter les notifications pressées
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            console.log('[useDeliveryNotifications] Notification pressée:', data);
            // Navigation sera gérée par le composant parent
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

    // Écouter les événements de livraison et envoyer des notifications
    useEffect(() => {
        if (!userId) return;

        const unsubscribers: (() => void)[] = [];

        // S'abonner à toutes les livraisons actives
        Object.values(deliveries).forEach(delivery => {
            const unsubscribe = registerDeliveryListener(delivery.id, (event: DeliveryRealtimeEvent) => {
                handleDeliveryEvent(delivery.id, event);
            });
            unsubscribers.push(unsubscribe);
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [userId, deliveries, registerDeliveryListener]);

    const handleDeliveryEvent = async (deliveryId: string, event: DeliveryRealtimeEvent) => {
        switch (event.type) {
            case 'delivery_status':
                const status = event.payload?.status || event.payload;
                const statusLabels: Record<string, { title: string; body: string }> = {
                    'assigned': {
                        title: 'Coursier assigné',
                        body: 'Un coursier a été assigné à votre livraison',
                    },
                    'en_route_pickup': {
                        title: 'Coursier en route',
                        body: 'Le coursier se dirige vers le point de collecte',
                    },
                    'shopping_in_progress': {
                        title: 'Courses en cours',
                        body: 'Le coursier fait vos courses',
                    },
                    'en_route_delivery': {
                        title: 'En route vers vous',
                        body: 'Le coursier se dirige vers votre adresse',
                    },
                    'delivered': {
                        title: 'Livré !',
                        body: 'Votre livraison a été complétée avec succès',
                    },
                    'cancelled': {
                        title: 'Livraison annulée',
                        body: 'Votre livraison a été annulée',
                    },
                };

                const label = statusLabels[status] || { title: 'Mise à jour', body: 'Statut de livraison mis à jour' };
                await sendDeliveryStatusNotification(deliveryId, status, label.title, label.body);
                break;

            case 'delivery_location':
                // Notification optionnelle pour les mises à jour de position
                // (peut être désactivée pour éviter le spam)
                break;

            case 'delivery_pricing':
                await sendDeliveryStatusNotification(
                    deliveryId,
                    'pricing',
                    'Prix mis à jour',
                    `Le prix de votre livraison a été mis à jour`
                );
                break;

            case 'shopping_update':
                await sendDeliveryStatusNotification(
                    deliveryId,
                    'shopping',
                    'Panier mis à jour',
                    'Votre panier de courses a été mis à jour'
                );
                break;
        }
    };

    return {
        // Fonctions utilitaires si nécessaire
    };
};

export default useDeliveryNotifications;


