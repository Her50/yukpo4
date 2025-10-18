// @ts-nocheck
/**
 * Composant de communication interne (appels audio et vidéo)
 * Utilise WebRTC pour les appels internes entre utilisateurs de l'application
 * ✅ PAS BESOIN DE NUMÉRO DE TÉLÉPHONE - Fonctionne avec les IDs utilisateurs
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
    isIncoming?: boolean;
}

/**
 * Wrapper pour WebRTCCallModal
 * Permet aux utilisateurs de l'app de s'appeler directement (comme WhatsApp/Messenger)
 * sans avoir besoin de numéros de téléphone
 */
const InAppCallModal: React.FC<InAppCallModalProps> = (props) => {
    return <WebRTCCallModal {...props} />;
};

export default InAppCallModal;
