// Modal d'alerte pour demande de don de sang urgente
// S'affiche automatiquement quand l'utilisateur est matché comme donneur potentiel

import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface BloodDonationAlertModalProps {
    visible: boolean;
    onClose: () => void;
    requestData: {
        request_id: string;
        match_id: string;
        groupe_sanguin: string;
        banque_sang_nom: string;
        is_urgent: boolean;
        urgence_level: string;
        distance_km?: number;
        location?: string;
        patient_name?: string;
        hospital_name?: string;
    };
    onAccept?: (shouldPromptBloodGroup?: boolean) => void;
    onDecline?: () => void;
}

const BloodDonationAlertModal: React.FC<BloodDonationAlertModalProps> = ({
    visible,
    onClose,
    requestData,
    onAccept,
    onDecline,
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [loading, setLoading] = useState(false);
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

    useEffect(() => {
        if (visible) {
            // Obtenir la position GPS actuelle de l'utilisateur
            getCurrentLocation();
        }
    }, [visible]);

    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            setUserLocation(location);
        } catch (error) {
            console.error('[BloodDonationAlertModal] Erreur GPS:', error);
        }
    };

    const handleAccept = async () => {
        try {
            setLoading(true);

            // Mettre à jour le statut du match à "accepted"
            const response = await apiPost('/api/blood-donation/matches/update-status', {
                match_id: requestData.match_id,
                new_status: 'accepted',
            });

            if (response.success) {
                // ✅ NOUVEAU: Vérifier si on doit proposer de renseigner le groupe sanguin
                const shouldPrompt = response.should_prompt_blood_group === true;

                if (shouldPrompt) {
                    // Fermer ce modal et laisser le parent afficher le modal de groupe sanguin
                    onAccept?.(true);
                    onClose();
                    return;
                }

                Alert.alert(
                    '✅ Merci !',
                    t('bloodDonationAlertModal.votreAcceptationAEteEnregistreeLa'),
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onAccept?.(false);
                                onClose();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'accepter la demande');
            }
        } catch (error: any) {
            console.error('[BloodDonationAlertModal] Erreur acceptation:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        Alert.alert(
            'Refuser la demande',
            t('bloodDonationAlertModal.etesvousSurDeVouloirRefuserCette'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Refuser',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);

                            const response = await apiPost('/api/blood-donation/matches/update-status', {
                                match_id: requestData.match_id,
                                new_status: 'declined',
                                declined_reason: t('bloodDonationAlertModal.refuseParLeDonneur'),
                            });

                            if (response.success) {
                                onDecline?.();
                                onClose();
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible de refuser la demande');
                            }
                        } catch (error: any) {
                            console.error('[BloodDonationAlertModal] Erreur refus:', error);
                            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleCallBanque = () => {
        // TODO: Récupérer le numéro de téléphone de la banque depuis l'API
        Alert.alert('Appeler', t('bloodDonationAlertModal.fonctionnaliteAVenir'));
    };

    const handleNavigateToBanque = () => {
        // TODO: Ouvrir la navigation vers la banque de sang
        Alert.alert('Navigation', t('bloodDonationAlertModal.fonctionnaliteAVenir'));
    };

    const getUrgencyColor = () => {
        switch (requestData.urgence_level) {
            case 'critique':
                return '#DC2626'; // Rouge vif
            case 'urgent':
                return '#F59E0B'; // Orange
            default:
                return modernColors.primary;
        }
    };

    const getUrgencyIcon = () => {
        switch (requestData.urgence_level) {
            case 'critique':
                return 'alert-circle';
            case 'urgent':
                return 'alert-triangle';
            default:
                return 'droplet';
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalContent, { borderTopColor: getUrgencyColor() }]}>
                    {/* Header avec badge urgence */}
                    <View style={[styles.header, { backgroundColor: `${getUrgencyColor()}15` }]}>
                        <View style={styles.headerLeft}>
                            <View style={[styles.urgencyIconContainer, { backgroundColor: getUrgencyColor() }]}>
                                <SafeIcon name={getUrgencyIcon()} size={32} color="#fff" />
                            </View>
                            <View style={styles.headerText}>
                                <Text style={[styles.urgencyTitle, { color: getUrgencyColor() }]}>
                                    {requestData.is_urgent && requestData.urgence_level === 'critique'
                                        ? '🚨 URGENCE CRITIQUE'
                                        : requestData.is_urgent
                                            ? '⚠️ URGENCE'
                                            : '🩸 Demande de don'}
                                </Text>
                                <Text style={styles.banqueName}>{requestData.banque_sang_nom}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                        {/* Groupe sanguin requis */}
                        <View style={styles.section}>
                            <View style={styles.groupeSanguinBadge}>
                                <Text style={styles.groupeSanguinText}>
                                    Groupe sanguin requis : {requestData.groupe_sanguin}
                                </Text>
                            </View>
                        </View>

                        {/* Informations de localisation */}
                        {requestData.distance_km && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Distance</Text>
                                    <Text style={styles.infoValue}>
                                        {requestData.distance_km.toFixed(1)} km
                                    </Text>
                                </View>
                            </View>
                        )}

                        {requestData.location && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="navigation" size={18} color={modernColors.primary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>{t('bloodDonationAlert.localisation')}</Text>
                                    <Text style={styles.infoValue}>{requestData.location}</Text>
                                </View>
                            </View>
                        )}

                        {/* Informations patient/hôpital */}
                        {requestData.patient_name && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="user" size={18} color={modernColors.primary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Patient</Text>
                                    <Text style={styles.infoValue}>{requestData.patient_name}</Text>
                                </View>
                            </View>
                        )}

                        {requestData.hospital_name && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="hospital" size={18} color={modernColors.primary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>{t('bloodDonationAlert.hopital')}</Text>
                                    <Text style={styles.infoValue}>{requestData.hospital_name}</Text>
                                </View>
                            </View>
                        )}

                        {/* Message d'urgence */}
                        {requestData.is_urgent && (
                            <View style={[styles.alertBanner, { backgroundColor: `${getUrgencyColor()}20` }]}>
                                <SafeIcon name="alert-circle" size={20} color={getUrgencyColor()} />
                                <Text style={[styles.alertText, { color: getUrgencyColor() }]}>
                                    {requestData.urgence_level === 'critique'
                                        ? 'Cette demande est CRITIQUE. Votre aide est vitale !'
                                        : 'Cette demande est urgente. Votre aide est importante.'}
                                </Text>
                            </View>
                        )}

                        {/* Informations importantes */}
                        <View style={styles.importantInfo}>
                            <Text style={styles.importantInfoTitle}>{t('bloodDonationAlert.informationsImportantes')}</Text>
                            <Text style={styles.importantInfoText}>
                                • Vous avez été sélectionné car votre groupe sanguin ({requestData.groupe_sanguin}) est compatible
                            </Text>
                            <Text style={styles.importantInfoText}>
                                • Assurez-vous d'être en bonne santé et de respecter les délais entre dons (8 semaines minimum)
                            </Text>
                            <Text style={styles.importantInfoText}>
                                • La banque de sang vous contactera pour confirmer les détails
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.declineButton]}
                            onPress={handleDecline}
                            disabled={loading}
                        >
                            <Text style={styles.declineButtonText}>Refuser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.acceptButton, { backgroundColor: getUrgencyColor() }]}
                            onPress={handleAccept}
                            disabled={loading}
                        >
                            <SafeIcon name="check-circle" size={20} color="#fff" />
                            <Text style={styles.acceptButtonText}>Accepter</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Actions secondaires */}
                    <View style={styles.secondaryActions}>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleCallBanque}
                        >
                            <SafeIcon name="phone" size={18} color={modernColors.primary} />
                            <Text style={styles.secondaryButtonText}>Appeler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleNavigateToBanque}
                        >
                            <SafeIcon name="navigation" size={18} color={modernColors.primary} />
                            <Text style={styles.secondaryButtonText}>Y aller</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 4,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    urgencyIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    urgencyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    banqueName: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
    body: {
        padding: 20,
        maxHeight: 400,
    },
    section: {
        marginBottom: 20,
    },
    groupeSanguinBadge: {
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#DC2626',
        alignItems: 'center',
    },
    groupeSanguinText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#DC2626',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    infoTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    alertText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    importantInfo: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    importantInfoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    importantInfoText: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 6,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    declineButton: {
        backgroundColor: '#F3F4F6',
    },
    declineButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    acceptButton: {
        backgroundColor: modernColors.primary,
    },
    acceptButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    secondaryActions: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    secondaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 6,
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default BloodDonationAlertModal;

