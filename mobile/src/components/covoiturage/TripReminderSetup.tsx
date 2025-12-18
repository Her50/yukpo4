// ✅ Composant pour configurer les rappels de trajet
// Date: 2025-01-29

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTripReminders } from '../../hooks/useTripReminders';
import PushNotificationService from '../../services/pushNotificationService';
import { NativeButton } from '../SafeNativeDesign';
import { SafeIcon } from '../SafeIcon';

interface TripReminderSetupProps {
    reservationId: number;
    tripId: number;
    depart: string;
    destination: string;
    departureTime: Date | string;
    onRemindersScheduled?: () => void;
}

export const TripReminderSetup: React.FC<TripReminderSetupProps> = ({
    reservationId,
    tripId,
    depart,
    destination,
    departureTime,
    onRemindersScheduled,
}) => {
    const [loading, setLoading] = useState(false);
    const [scheduled, setScheduled] = useState(false);
    const [permissionsGranted, setPermissionsGranted] = useState(false);

    const { scheduleReminders } = useTripReminders({
        reservationId,
        tripId,
        depart,
        destination,
        departureTime,
        autoSchedule: false,
    });

    useEffect(() => {
        checkPermissions();
    }, []);

    const checkPermissions = async () => {
        try {
            const token = await PushNotificationService.registerForPushNotifications();
            setPermissionsGranted(!!token);
        } catch (error) {
            console.error('[TripReminderSetup] Erreur vérification permissions:', error);
            setPermissionsGranted(false);
        }
    };

    const handleScheduleReminders = async () => {
        try {
            setLoading(true);
            const result = await scheduleReminders();

            if (result.reminder24h || result.reminder2h) {
                setScheduled(true);
                onRemindersScheduled?.();
            }
        } catch (error) {
            console.error('[TripReminderSetup] Erreur planification:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!permissionsGranted) {
        return (
            <View style={styles.container}>
                <SafeIcon name="bell-off" size={24} color="#9CA3AF" />
                <Text style={styles.text}>
                    Les notifications sont désactivées. Activez-les dans les paramètres pour recevoir des rappels.
                </Text>
                <NativeButton variant="secondary" onPress={checkPermissions} style={styles.button}>
                    Vérifier les permissions
                </NativeButton>
            </View>
        );
    }

    if (scheduled) {
        return (
            <View style={styles.container}>
                <SafeIcon name="check-circle" size={24} color="#10B981" />
                <Text style={styles.successText}>
                    Rappels planifiés : 24h et 2h avant le départ
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeIcon name="bell" size={24} color="#6366F1" />
            <Text style={styles.text}>
                Recevez des rappels automatiques 24h et 2h avant votre trajet
            </Text>
            <NativeButton
                variant="primary"
                onPress={handleScheduleReminders}
                loading={loading}
                style={styles.button}
            >
                Activer les rappels
            </NativeButton>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        alignItems: 'center',
        marginVertical: 8,
    },
    text: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 12,
    },
    successText: {
        fontSize: 14,
        color: '#10B981',
        textAlign: 'center',
        marginTop: 8,
        fontWeight: '600',
    },
    button: {
        marginTop: 8,
    },
});

