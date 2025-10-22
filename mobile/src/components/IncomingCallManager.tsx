/**
 * Gestionnaire d'appels entrants
 * Écoute les notifications d'appel WebSocket et affiche le modal WebRTC
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../utils/errorHandler';
import WebRTCCallModal from './WebRTCCallModal';

interface IncomingCallData {
    caller_id: string;
    caller_name: string;
    call_type: 'audio' | 'video';
    service_id?: string;
    call_id?: string;
}

const IncomingCallManager: React.FC = () => {
    const { user } = useAuth();
    const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
    const [showCallModal, setShowCallModal] = useState(false);

    useEffect(() => {
        if (!user?.id) return;

        console.log('[IncomingCallManager] 📞 Écoute des appels entrants pour user:', user.id);

        // ✅ CORRECTION: Importer WebSocket seulement si user existe
        const setupWebSocketHandler = async () => {
            try {
                const webSocketModule = await import('../contexts/WebSocketContext');
                console.log('[IncomingCallManager] ✅ WebSocket context chargé');
                // Cette partie sera exécutée seulement si user existe
            } catch (error) {
                handleError(error, {
                    component: 'IncomingCallManager',
                    action: 'setup_websocket_handler',
                    details: { userId: user.id }
                });
                console.warn('[IncomingCallManager] Utilisation du fallback WebSocket');
            }
        };

        setupWebSocketHandler();

        // TODO: Réactiver les notifications WebSocket une fois le système stabilisé
        /*
        const unsubscribe = registerNotificationHandler((notification) => {
            console.log('[IncomingCallManager] 📨 Notification reçue:', notification.type, notification.data);

            // Vérifier si c'est une notification d'appel
            if (notification.data.type === 'incoming_call') {
                console.log('[IncomingCallManager] 📞 Appel entrant détecté:', notification.data);

                setIncomingCall({
                    caller_id: notification.data.caller_id || notification.data.from,
                    caller_name: notification.data.caller_name || 'Un utilisateur',
                    call_type: notification.data.call_type || 'audio',
                    service_id: notification.data.service_id,
                    call_id: notification.data.call_id
                });

                setShowCallModal(true);
            }
        });

        return () => {
            console.log('[IncomingCallManager] 🔌 Nettoyage listener d\'appels');
            unsubscribe();
        };
        */
    }, [user?.id]);

    const handleCloseCall = () => {
        console.log('[IncomingCallManager] ❌ Fermeture modal d\'appel');
        setShowCallModal(false);
        setIncomingCall(null);
    };

    // Si pas d'appel entrant, ne rien afficher
    if (!incomingCall || !user) {
        return null;
    }

    return (
        <WebRTCCallModal
            visible={showCallModal}
            onClose={handleCloseCall}
            callType={incomingCall.call_type}
            recipientName={incomingCall.caller_name}
            recipientId={incomingCall.caller_id}
            currentUserId={user.id}
            serviceId={incomingCall.service_id}
            isIncoming={true} // ✅ NOUVEAU: Indiquer qu'il s'agit d'un appel entrant
        />
    );
};

export default IncomingCallManager;

