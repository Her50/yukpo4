// Gestionnaire global pour les alertes de don de sang
// Écoute les notifications push et affiche le modal d'alerte

import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { setupForegroundNotificationHandler, setupNotificationResponseHandler } from '../services/pushNotifications';
import BloodDonationAlertModal from './blood/BloodDonationAlertModal';
import BloodGroupPromptModal from './blood/BloodGroupPromptModal';

const BloodDonationAlertManager: React.FC = () => {
    const { user } = useAuth();
    const [alertData, setAlertData] = useState<any>(null);
    const [showAlert, setShowAlert] = useState(false);
    const [showBloodGroupPrompt, setShowBloodGroupPrompt] = useState(false);
    const notificationListener = useRef<any>();
    const responseListener = useRef<any>();

    useEffect(() => {
        if (!user?.id) return;

        // Écouter les notifications en foreground
        notificationListener.current = setupForegroundNotificationHandler((notification) => {
            const data = notification.request.content.data;

            // Vérifier si c'est une notification de demande de don de sang
            if (data?.type === 'blood_donation_request') {
                console.log('[BloodDonationAlertManager] 🩸 Notification demande de don reçue:', data);

                setAlertData({
                    request_id: data.request_id,
                    match_id: data.match_id,
                    groupe_sanguin: data.groupe_sanguin,
                    banque_sang_nom: data.banque_sang_nom,
                    is_urgent: data.is_urgent || false,
                    urgence_level: data.urgence_level || 'normal',
                    distance_km: data.distance_km,
                    location: data.location,
                    patient_name: data.patient_name,
                    hospital_name: data.hospital_name,
                });
                setShowAlert(true);
            }
        });

        // Écouter les interactions avec notifications (tap)
        responseListener.current = setupNotificationResponseHandler((response) => {
            const data = response.notification.request.content.data;

            if (data?.type === 'blood_donation_request') {
                console.log('[BloodDonationAlertManager] 👆 Notification demande de don tapée:', data);

                setAlertData({
                    request_id: data.request_id,
                    match_id: data.match_id,
                    groupe_sanguin: data.groupe_sanguin,
                    banque_sang_nom: data.banque_sang_nom,
                    is_urgent: data.is_urgent || false,
                    urgence_level: data.urgence_level || 'normal',
                    distance_km: data.distance_km,
                    location: data.location,
                    patient_name: data.patient_name,
                    hospital_name: data.hospital_name,
                });
                setShowAlert(true);
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
    }, [user?.id]);

    const handleClose = () => {
        setShowAlert(false);
        setAlertData(null);
    };


    const handleDecline = () => {
        console.log('[BloodDonationAlertManager] ❌ Demande refusée');
        // Le modal gère déjà l'API call
    };

    // ✅ NOUVEAU: Callback pour gérer l'affichage du prompt de groupe sanguin
    const handleAccept = (shouldPromptBloodGroup?: boolean) => {
        setShowAlert(false);
        if (shouldPromptBloodGroup) {
            setShowBloodGroupPrompt(true);
        } else {
            setAlertData(null);
        }
    };

    const handleBloodGroupPromptClose = () => {
        setShowBloodGroupPrompt(false);
        setAlertData(null);
    };

    const handleBloodGroupPromptSuccess = () => {
        console.log('[BloodDonationAlertManager] ✅ Groupe sanguin enregistré');
        setShowBloodGroupPrompt(false);
        setAlertData(null);
    };

    return (
        <>
            {alertData && showAlert && (
                <BloodDonationAlertModal
                    visible={showAlert}
                    onClose={handleClose}
                    requestData={alertData}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                />
            )}
            <BloodGroupPromptModal
                visible={showBloodGroupPrompt}
                onClose={handleBloodGroupPromptClose}
                onSuccess={handleBloodGroupPromptSuccess}
            />
        </>
    );
};

export default BloodDonationAlertManager;

