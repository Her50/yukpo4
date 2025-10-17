// @ts-nocheck
/**
 * Composant de communication interne (appels audio et vidéo)
 * Utilise WebRTCCallModal pour les vrais appels WebRTC
 */
import React from 'react';
import WebRTCCallModal from './WebRTCCallModal';

interface InAppCallModalProps {
    visible: boolean;
    onClose: () => void;
    callType: 'audio' | 'video';
    recipientName: string;
    recipientId: string;
    currentUserId: string;
    serviceId?: string;
}

/**
 * Wrapper pour WebRTCCallModal
 * Permet de garder la compatibilité avec les composants existants
 */
const InAppCallModal: React.FC<InAppCallModalProps> = (props) => {
    return <WebRTCCallModal {...props} />;
};

export default InAppCallModal;
