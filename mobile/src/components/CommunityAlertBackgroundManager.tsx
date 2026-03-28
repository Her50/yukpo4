import React from 'react';
import * as Location from 'expo-location';
import { COMMUNITY_ALERTS_TASK } from '../background/communityAlertsTask';

/**
 * Démarre la surveillance des alertes communautaires en arrière-plan si possible.
 *
 * - Ne force pas de popup agressive: si l'utilisateur n'a pas "Toujours",
 *   on tente "WhenInUse" + enregistre la nécessité.
 * - Android: démarre un service de localisation (foreground) pour fiabiliser.
 */
export default function CommunityAlertBackgroundManager() {
  React.useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(COMMUNITY_ALERTS_TASK);
        if (hasStarted) return;
      } catch {
        // ignore
      }

      // Permissions
      try {
        // Demande minimale: when-in-use d'abord (sinon background impossible à demander sur certains flows)
        const fg = await Location.getForegroundPermissionsAsync();
        if (!fg.granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          if (!req.granted) return;
        }

        // Background (iOS/Android). Sans "Toujours", iOS n'exécutera pas fiable.
        const bg = await Location.getBackgroundPermissionsAsync();
        if (!bg.granted) {
          await Location.requestBackgroundPermissionsAsync().catch(() => {});
        }
      } catch {
        // ignore
      }

      if (cancelled) return;

      // Démarrer les updates (task) — le handler est défini via l'import dans index.js
      try {
        await Location.startLocationUpdatesAsync(COMMUNITY_ALERTS_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30_000,
          distanceInterval: 120,
          foregroundService: {
            notificationTitle: 'Yukpo',
            notificationBody: 'Surveillance des alertes communautaires',
            notificationColor: '#6366F1',
          },
          showsBackgroundLocationIndicator: false,
          pausesUpdatesAutomatically: true,
          deferredUpdatesInterval: 60_000,
          deferredUpdatesDistance: 250,
          activityType: Location.ActivityType.Other,
        } as any);
      } catch (e) {
        // ignore
      }
    };

    start().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

