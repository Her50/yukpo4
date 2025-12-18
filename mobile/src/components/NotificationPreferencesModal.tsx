// ✅ Phase 6.1: Composant pour gérer les préférences de notifications

import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NotificationPreferences, pushNotificationService } from '../services/push_notifications';
import { modernColors } from '../theme/modernTheme';
import { NativeButton } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface NotificationPreferencesModalProps {
    visible: boolean;
    onClose: () => void;
}

const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
    visible,
    onClose,
}) => {
    const [preferences, setPreferences] = useState<NotificationPreferences>({
        pharmacy_on_duty: true,
        carpool_match: true,
        taxi_nearby: true,
        weekly_summary: true,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            loadPreferences();
        }
    }, [visible]);

    const loadPreferences = async () => {
        try {
            const prefs = await pushNotificationService.loadPreferences();
            setPreferences(prefs);
        } catch (error) {
            console.error('[NotificationPreferencesModal] Erreur chargement:', error);
        }
    };

    const handleToggle = async (key: keyof NotificationPreferences) => {
        const newPreferences = {
            ...preferences,
            [key]: !preferences[key],
        };
        setPreferences(newPreferences);

        try {
            await pushNotificationService.savePreferences({ [key]: newPreferences[key] });
        } catch (error) {
            console.error('[NotificationPreferencesModal] Erreur sauvegarde:', error);
            Alert.alert('Erreur', 'Impossible de sauvegarder les préférences');
            // Restaurer l'ancienne valeur
            setPreferences(preferences);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            await pushNotificationService.savePreferences(preferences);
            Alert.alert('Succès', 'Préférences sauvegardées');
            onClose();
        } catch (error) {
            console.error('[NotificationPreferencesModal] Erreur sauvegarde:', error);
            Alert.alert('Erreur', 'Impossible de sauvegarder les préférences');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <SafeIcon name="bell" size={32} color={modernColors.primary} />
                        </View>
                        <Text style={styles.title}>Préférences de Notifications</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        <Text style={styles.description}>
                            Choisissez les types de notifications que vous souhaitez recevoir
                        </Text>

                        <View style={styles.preferenceSection}>
                            <View style={styles.preferenceItem}>
                                <View style={styles.preferenceInfo}>
                                    <SafeIcon name="pill" size={24} color={modernColors.primary} />
                                    <View style={styles.preferenceText}>
                                        <Text style={styles.preferenceTitle}>Pharmacie de garde</Text>
                                        <Text style={styles.preferenceDescription}>
                                            Notifications quand une pharmacie de garde est disponible
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={preferences.pharmacy_on_duty}
                                    onValueChange={() => handleToggle('pharmacy_on_duty')}
                                    trackColor={{
                                        false: '#E5E7EB',
                                        true: modernColors.primary + '80',
                                    }}
                                    thumbColor={preferences.pharmacy_on_duty ? modernColors.primary : '#9CA3AF'}
                                />
                            </View>

                            <View style={styles.preferenceItem}>
                                <View style={styles.preferenceInfo}>
                                    <SafeIcon name="car" size={24} color={modernColors.primary} />
                                    <View style={styles.preferenceText}>
                                        <Text style={styles.preferenceTitle}>Covoiturage correspondant</Text>
                                        <Text style={styles.preferenceDescription}>
                                            Notifications quand un covoiturage correspond à votre recherche
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={preferences.carpool_match}
                                    onValueChange={() => handleToggle('carpool_match')}
                                    trackColor={{
                                        false: '#E5E7EB',
                                        true: modernColors.primary + '80',
                                    }}
                                    thumbColor={preferences.carpool_match ? modernColors.primary : '#9CA3AF'}
                                />
                            </View>

                            <View style={styles.preferenceItem}>
                                <View style={styles.preferenceInfo}>
                                    <SafeIcon name="taxi" size={24} color={modernColors.primary} />
                                    <View style={styles.preferenceText}>
                                        <Text style={styles.preferenceTitle}>Taxi disponible</Text>
                                        <Text style={styles.preferenceDescription}>
                                            Notifications quand un taxi est disponible dans votre zone
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={preferences.taxi_nearby}
                                    onValueChange={() => handleToggle('taxi_nearby')}
                                    trackColor={{
                                        false: '#E5E7EB',
                                        true: modernColors.primary + '80',
                                    }}
                                    thumbColor={preferences.taxi_nearby ? modernColors.primary : '#9CA3AF'}
                                />
                            </View>

                            <View style={styles.preferenceItem}>
                                <View style={styles.preferenceInfo}>
                                    <SafeIcon name="bar-chart" size={24} color={modernColors.primary} />
                                    <View style={styles.preferenceText}>
                                        <Text style={styles.preferenceTitle}>Résumé hebdomadaire</Text>
                                        <Text style={styles.preferenceDescription}>
                                            Recevoir un résumé hebdomadaire de vos services
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={preferences.weekly_summary}
                                    onValueChange={() => handleToggle('weekly_summary')}
                                    trackColor={{
                                        false: '#E5E7EB',
                                        true: modernColors.primary + '80',
                                    }}
                                    thumbColor={preferences.weekly_summary ? modernColors.primary : '#9CA3AF'}
                                />
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <NativeButton
                            variant="primary"
                            onPress={handleSave}
                            disabled={loading}
                            title="Sauvegarder"
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 12,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 20,
    },
    description: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
        lineHeight: 20,
    },
    preferenceSection: {
        gap: 16,
    },
    preferenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
    },
    preferenceInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    preferenceText: {
        flex: 1,
    },
    preferenceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    preferenceDescription: {
        fontSize: 12,
        color: '#6B7280',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
});

export default NotificationPreferencesModal;



