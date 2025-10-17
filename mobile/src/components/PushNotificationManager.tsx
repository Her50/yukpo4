// @ts-nocheck
/**
 * Composant global pour gérer les push notifications
 * - Enregistre le token au démarrage si l'utilisateur est connecté
 * - Gère les notifications d'appels entrants
 * - Affiche les notifications en foreground
 */
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { setupForegroundNotificationHandler, setupNotificationResponseHandler } from '../services/pushNotifications';
import InAppCallModal from './InAppCallModal';

const PushNotificationManager: React.FC = () => {
    const { user } = useAuth();
    const navigation = useNavigation();
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

            // Gérer les appels entrants
            if (data?.type === 'incoming_call') {
                console.log('[PushNotificationManager] 📞 Appel entrant détecté:', data);
                
                setIncomingCall({
                    callType: data.call_type || 'audio',
                    callerName: data.caller_name || 'Utilisateur',
                    callerId: data.caller_id,
                    serviceId: data.service_id,
                });
            } 
            // ✅ NOUVEAU: Gérer les notifications de messages
            else if (data?.type === 'new_message') {
                console.log('[PushNotificationManager] 💬 Nouveau message détecté:', data);
                
                // Afficher une alerte avec option d'ouvrir le chat
                Alert.alert(
                    notification.request.content.title || '💬 Nouveau message',
                    notification.request.content.body || '',
                    [
                        { text: 'Fermer', style: 'cancel' },
                        {
                            text: 'Voir',
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

            // Gérer les appels entrants
            if (data?.type === 'incoming_call') {
                setIncomingCall({
                    callType: data.call_type || 'audio',
                    callerName: data.caller_name || 'Utilisateur',
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

