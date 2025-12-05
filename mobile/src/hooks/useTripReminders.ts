// ✅ Hook pour gérer les rappels de trajets
// Date: 2025-01-29

import { useCallback, useEffect } from 'react';
import { apiPost } from '../services/apiService';
import PushNotificationService, { TripReminderNotification } from '../services/pushNotificationService';

interface UseTripRemindersOptions {
    reservationId: number;
    tripId: number;
    depart: string;
    destination: string;
    departureTime: Date | string;
    autoSchedule?: boolean; // Planifier automatiquement au montage
}

/**
 * Hook pour gérer les rappels de trajets
 */
export const useTripReminders = (options: UseTripRemindersOptions) => {
    const {
        reservationId,
        tripId,
        depart,
        destination,
        departureTime,
        autoSchedule = false,
    } = options;

    // Planifier les rappels
    const scheduleReminders = useCallback(async () => {
        try {
            // S'assurer que les permissions sont accordées
            await PushNotificationService.registerForPushNotifications();

            // Planifier les rappels locaux
            const departureDate = typeof departureTime === 'string'
                ? new Date(departureTime)
                : departureTime;

            const reminder: Omit<TripReminderNotification, 'reminderType'> = {
                reservationId,
                tripId,
                depart,
                destination,
                departureTime: departureDate,
            };

            const { reminder24h, reminder2h } = await PushNotificationService.scheduleTripReminders(reminder);

            // Notifier le backend (pour backup)
            try {
                await apiPost(`/api/reservations/${reservationId}/schedule-notifications`);
            } catch (err) {
                console.error('[useTripReminders] Erreur notification backend:', err);
            }

            return { reminder24h, reminder2h };
        } catch (error) {
            console.error('[useTripReminders] Erreur planification rappels:', error);
            return { reminder24h: null, reminder2h: null };
        }
    }, [reservationId, tripId, depart, destination, departureTime]);

    // Annuler les rappels
    const cancelReminders = useCallback(async () => {
        try {
            await PushNotificationService.cancelAllTripReminders(reservationId);
        } catch (error) {
            console.error('[useTripReminders] Erreur annulation rappels:', error);
        }
    }, [reservationId]);

    // Planification automatique au montage
    useEffect(() => {
        if (autoSchedule) {
            scheduleReminders();
        }

        // Nettoyage à la destruction
        return () => {
            if (autoSchedule) {
                cancelReminders();
            }
        };
    }, [autoSchedule, scheduleReminders, cancelReminders]);

    return {
        scheduleReminders,
        cancelReminders,
    };
};

