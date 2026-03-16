/**
 * Composant global pour gérer les push notifications
 * - Enregistre le token au démarrage si l'utilisateur est connecté
 * - Gère les notifications d'appels entrants
 * - Affiche les notifications en foreground
 */
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { notificationSoundService } from '../services/notificationSoundService';
import { setupForegroundNotificationHandler, setupNotificationResponseHandler } from '../services/pushNotifications';
import InAppCallModal from './InAppCallModal';
import { useLanguageSafe } from '../contexts/LanguageContext';

const PushNotificationManager: React.FC = () => {
    const { user } = useAuth();
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const notificationListener = useRef<any>();
    const responseListener = useRef<any>();

    useEffect(() => {
        if (!user) return;

        console.log('[PushNotificationManager] 📱 Configuration des listeners de notifications...');

        // Listener pour notifications reçues en foreground
        notificationListener.current = setupForegroundNotificationHandler((notification) => {
            const data = notification.request.content.data;

            console.log('[PushNotificationManager] 🔔 Notification reçue:', notification.request.content);

            // ✅ NOUVEAU: Émettre un événement global pour mettre à jour les badges de notifications
            DeviceEventEmitter.emit('notification:received', {
                type: data?.type,
                notification: notification.request.content
            });
            console.log('[PushNotificationManager] ✅ Événement notification:received émis');

            // Gérer les appels entrants
            if (data?.type === 'incoming_call') {
                console.log('[PushNotificationManager] 📞 Appel entrant détecté:', data);

                setIncomingCall({
                    callType: data.call_type || 'audio',
                    callerName: data.caller_name || t('pushNotificationManager.utilisateur'),
                    callerId: data.caller_id,
                    serviceId: data.service_id,
                });
            }
            // ✅ NOUVEAU: Gérer les notifications de messages
            else if (data?.type === 'new_message') {
                console.log('[PushNotificationManager] 💬 Nouveau message détecté:', data);

                // Afficher une alerte avec option d'ouvrir le chat
                Alert.alert(
                    notification.request.content.title || t('pushNotificationManager.nouveauMessage'),
                    notification.request.content.body || '',
                    [
                        { text: t('common.close'), style: 'cancel' },
                        {
                            text: t('common.view'),
                            onPress: () => {
                                // Ouvrir l'historique des conversations ou le service
                                if (data.service_id) {
                                    (navigation as any).navigate('ServiceDetail', {
                                        serviceId: data.service_id
                                    });
                                }
                            }
                        }
                    ]
                );
            }
            // ✅ NOUVEAU: Gérer les notifications de livraison disponible (foreground)
            else if (data?.type === 'delivery_available') {
                console.log('[PushNotificationManager] 📦 Notification de livraison disponible (foreground):', data.delivery_id);

                // Son + TTS contextuel pour coursiers dans le rayon de recherche
                notificationSoundService.notifyDeliveryEvent('new_delivery_available', {
                    distance: data.distance,
                    destination: data.destination,
                }, { pushNotification: false }).catch(console.error);

                // Afficher une alerte avec options d'accepter ou voir les détails
                Alert.alert(
                    notification.request.content.title || t('pushNotificationManager.nouvelleLivraisonDisponible'),
                    notification.request.content.body || '',
                    [
                        { text: t('common.close'), style: 'cancel' },
                        {
                            text: t('common.view'),
                            onPress: () => {
                                if (data.delivery_id) {
                                    (navigation as any).navigate('DeliveryShoppingTracking', {
                                        deliveryId: data.delivery_id,
                                        showAcceptButton: true,
                                    });
                                }
                            }
                        }
                    ]
                );
            }
            // ✅ NOUVEAU: Notifications de statut livraison avec TTS contextuel
            else if (data?.type === 'delivery_status_update' || data?.type === 'delivery_event') {
                console.log('[PushNotificationManager] 📦 Mise à jour livraison (foreground):', data.eventType || data.status);

                const eventType = data.eventType || data.status;
                if (eventType) {
                    notificationSoundService.notifyDeliveryEvent(eventType, {
                        courierName: data.courier_name,
                        etaMinutes: data.eta_minutes,
                        destination: data.destination,
                        itemCount: data.item_count,
                    }, { pushNotification: false }).catch(console.error);
                }

                // Alerte visuelle aussi
                Alert.alert(
                    notification.request.content.title || t('pushNotificationManager.miseAJourLivraison'),
                    notification.request.content.body || '',
                    [
                        { text: 'OK' },
                        ...(data.delivery_id ? [{
                            text: t('common.view'),
                            onPress: () => {
                                (navigation as any).navigate('DeliveryShoppingTracking', {
                                    deliveryId: data.delivery_id,
                                });
                            }
                        }] : []),
                    ]
                );
            }
            // ✅ Notifications Live (live programmé, en direct, replay)
            else if (data?.event === 'live_scheduled' || data?.event === 'live_live_now' || data?.event === 'live_replay_ready') {
                console.log('[PushNotificationManager] 🎥 Notification Live:', data.event, data.live_session_id);

                const buttonText = data.event === 'live_live_now' ? 'Rejoindre'
                    : data.event === 'live_replay_ready' ? 'Voir le replay' : 'Voir';

                Alert.alert(
                    notification.request.content.title || '🎥 Live',
                    notification.request.content.body || '',
                    [
                        { text: t('common.close'), style: 'cancel' },
                        {
                            text: buttonText,
                            onPress: () => {
                                if (data.live_session_id) {
                                    (navigation as any).navigate('LiveViewerScreen', {
                                        sessionId: data.live_session_id,
                                        serviceId: data.primary_service_id,
                                    });
                                } else if (data.primary_service_id) {
                                    (navigation as any).navigate('ServiceDetail', {
                                        serviceId: data.primary_service_id,
                                    });
                                }
                            }
                        }
                    ]
                );
            }
            // ✅ Notifications Flash Promo (programmée, en direct, fin imminente, commentaire)
            else if (data?.event === 'live_flash_sale_scheduled' || data?.event === 'live_flash_sale_live' || data?.event === 'live_flash_sale_ending' || data?.event === 'live_flash_sale_commentary') {
                console.log('[PushNotificationManager] ⚡ Notification Flash Promo:', data.event, data.flash_sale_id);

                const buttonText = data.event === 'live_flash_sale_live' ? 'Acheter maintenant'
                    : data.event === 'live_flash_sale_ending' ? t('pushNotificationManager.derniereChance') : 'Voir';

                Alert.alert(
                    notification.request.content.title || '⚡ Flash Promo',
                    notification.request.content.body || '',
                    [
                        { text: t('common.close'), style: 'cancel' },
                        {
                            text: buttonText,
                            onPress: () => {
                                if (data.live_session_id) {
                                    (navigation as any).navigate('LiveViewerScreen', {
                                        sessionId: data.live_session_id,
                                        serviceId: data.primary_service_id,
                                        highlightFlashSale: data.flash_sale_id,
                                    });
                                } else if (data.primary_service_id) {
                                    (navigation as any).navigate('ServiceDetail', {
                                        serviceId: data.primary_service_id,
                                    });
                                }
                            }
                        }
                    ]
                );
            }
            // ✅ Alertes Publicités (performance faible, CTR bas, CPC élevé, fin imminente)
            else if (data?.type === 'publicite_alert') {
                console.log('[PushNotificationManager] 📊 Alerte Publicité:', data.alert_type, data.campaign_id);

                Alert.alert(
                    notification.request.content.title || t('pushNotificationManager.alertePublicite'),
                    notification.request.content.body || '',
                    [
                        { text: t('common.close'), style: 'cancel' },
                        {
                            text: t('pushNotificationManager.voirLeDashboard'),
                            onPress: () => {
                                (navigation as any).navigate('PubliciteDashboard');
                            }
                        }
                    ]
                );
            }
            else {
                // Autres notifications - afficher une alerte
                Alert.alert(
                    notification.request.content.title || 'Notification',
                    notification.request.content.body || ''
                );
            }
        });

        // Listener pour interactions avec notifications (tap)
        responseListener.current = setupNotificationResponseHandler((response) => {
            const data = response.notification.request.content.data;

            console.log('[PushNotificationManager] 👆 Notification tapée:', data);

            // ✅ NOUVEAU: Émettre un événement pour mettre à jour le badge quand une notification est tapée
            DeviceEventEmitter.emit('notification:received', {
                type: data?.type,
                notification: response.notification.request.content
            });

            // Gérer les appels entrants
            if (data?.type === 'incoming_call') {
                setIncomingCall({
                    callType: data.call_type || 'audio',
                    callerName: data.caller_name || t('pushNotificationManager.utilisateur'),
                    callerId: data.caller_id,
                    serviceId: data.service_id,
                });
            }
            // ✅ NOUVEAU: Gérer les notifications de messages
            else if (data?.type === 'new_message') {
                console.log('[PushNotificationManager] 💬 Navigation vers le service pour voir le message');

                // Naviguer vers le service ou le chat
                if (data.service_id) {
                    (navigation as any).navigate('ServiceDetail', {
                        serviceId: data.service_id,
                        openChat: true // Flag pour ouvrir automatiquement le chat
                    });
                }
            }
            // ✅ NOUVEAU: Gérer les notifications de livraison disponible
            else if (data?.type === 'delivery_available') {
                console.log('[PushNotificationManager] 📦 Notification de livraison disponible:', data.delivery_id);

                // Naviguer vers l'écran de suivi de livraison
                if (data.delivery_id) {
                    (navigation as any).navigate('DeliveryShoppingTracking', {
                        deliveryId: data.delivery_id,
                        showAcceptButton: true,
                    });
                }
            }
            // ✅ Tap sur notification Live → naviguer vers le live
            else if (data?.event === 'live_scheduled' || data?.event === 'live_live_now' || data?.event === 'live_replay_ready') {
                console.log('[PushNotificationManager] 🎥 Tap notification Live:', data.event);
                if (data.live_session_id) {
                    (navigation as any).navigate('LiveViewerScreen', {
                        sessionId: data.live_session_id,
                        serviceId: data.primary_service_id,
                    });
                } else if (data.primary_service_id) {
                    (navigation as any).navigate('ServiceDetail', { serviceId: data.primary_service_id });
                }
            }
            // ✅ Tap sur notification Flash Promo → naviguer vers le live + flash sale
            else if (data?.event === 'live_flash_sale_scheduled' || data?.event === 'live_flash_sale_live' || data?.event === 'live_flash_sale_ending' || data?.event === 'live_flash_sale_commentary') {
                console.log('[PushNotificationManager] ⚡ Tap notification Flash Promo:', data.event);
                if (data.live_session_id) {
                    (navigation as any).navigate('LiveViewerScreen', {
                        sessionId: data.live_session_id,
                        serviceId: data.primary_service_id,
                        highlightFlashSale: data.flash_sale_id,
                    });
                } else if (data.primary_service_id) {
                    (navigation as any).navigate('ServiceDetail', { serviceId: data.primary_service_id });
                }
            }
            // ✅ Tap sur alerte publicité → naviguer vers le dashboard
            else if (data?.type === 'publicite_alert') {
                console.log('[PushNotificationManager] 📊 Tap alerte Publicité:', data.alert_type);
                (navigation as any).navigate('PubliciteDashboard');
            }
        });

        // Cleanup
        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, [user]);

    return (
        <>
            {/* Modal d'appel entrant */}
            {incomingCall && (
                <InAppCallModal
                    visible={!!incomingCall}
                    onClose={() => setIncomingCall(null)}
                    callType={incomingCall.callType}
                    recipientName={incomingCall.callerName}
                    recipientId={incomingCall.callerId}
                    currentUserId={user?.id || ''}
                    serviceId={incomingCall.serviceId}
                />
            )}
        </>
    );
};

export default PushNotificationManager;

