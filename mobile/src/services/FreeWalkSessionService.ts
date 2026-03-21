import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const FREE_WALK_TASK = 'YUKPO_FREE_WALK_SESSION_TASK';
const STORAGE_KEY_SESSION = '@yukpo_free_walk_session';

type FreeWalkSession = {
  startedAt: string;
  lastUpdateAt: string;
  totalDistance: number;
  maxSpeedKmh: number;
  speedSampleCount: number;
  speedSampleSum: number;
  lastLat: number;
  lastLng: number;
  currentSpeedKmh: number;
};

export type FreeWalkSummary = {
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  calories: number;
  lastLat?: number;
  lastLng?: number;
};

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimateCalories = (distKm: number, durationMin: number, avgSpeedKmh: number): number => {
  const met = avgSpeedKmh < 4 ? 2.5 : avgSpeedKmh < 5.5 ? 3.5 : avgSpeedKmh < 7 ? 4.5 : 6.0;
  return (met * 70 * durationMin) / 60;
};

/** Mise à jour session (partagée tâche arrière-plan + repli watchPosition premier plan) */
const persistWalkLocation = async (latitude: number, longitude: number, speed: number | null) => {
  const now = new Date().toISOString();
  const speedKmh = Math.max(0, (speed || 0) * 3.6);
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
    let session: FreeWalkSession | null = raw ? JSON.parse(raw) : null;
    if (!session) {
      session = {
        startedAt: now,
        lastUpdateAt: now,
        totalDistance: 0,
        maxSpeedKmh: speedKmh,
        speedSampleCount: 1,
        speedSampleSum: speedKmh,
        lastLat: latitude,
        lastLng: longitude,
        currentSpeedKmh: speedKmh,
      };
      await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      return;
    }

    const d = haversine(session.lastLat, session.lastLng, latitude, longitude);
    if (d >= 500) {
      session.lastUpdateAt = now;
      session.currentSpeedKmh = speedKmh;
      await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      return;
    }
    if (d > 2) session.totalDistance += d;
    session.lastLat = latitude;
    session.lastLng = longitude;
    session.lastUpdateAt = now;
    session.currentSpeedKmh = speedKmh;
    session.speedSampleCount += 1;
    session.speedSampleSum += speedKmh;
    if (speedKmh > session.maxSpeedKmh) session.maxSpeedKmh = speedKmh;
    await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch {
    // noop
  }
};

/** Repli si startLocationUpdatesAsync échoue (FGS Android, config, etc.) — même persistance AsyncStorage */
let foregroundWalkSubscription: Location.LocationSubscription | null = null;

/** Traitement batch : une seule lecture/écriture AsyncStorage pour N positions */
const persistWalkLocationsBatch = async (
  locations: Array<{ latitude: number; longitude: number; speed: number | null }>
) => {
  if (locations.length === 0) return;
  const now = new Date().toISOString();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
    let session: FreeWalkSession | null = raw ? JSON.parse(raw) : null;

    for (const loc of locations) {
      const speedKmh = Math.max(0, (loc.speed || 0) * 3.6);

      if (!session) {
        session = {
          startedAt: now,
          lastUpdateAt: now,
          totalDistance: 0,
          maxSpeedKmh: speedKmh,
          speedSampleCount: 1,
          speedSampleSum: speedKmh,
          lastLat: loc.latitude,
          lastLng: loc.longitude,
          currentSpeedKmh: speedKmh,
        };
        continue;
      }

      const d = haversine(session.lastLat, session.lastLng, loc.latitude, loc.longitude);
      if (d >= 500) continue;
      if (d > 2) session.totalDistance += d;
      session.lastLat = loc.latitude;
      session.lastLng = loc.longitude;
      session.lastUpdateAt = now;
      session.currentSpeedKmh = speedKmh;
      session.speedSampleCount += 1;
      session.speedSampleSum += speedKmh;
      if (speedKmh > session.maxSpeedKmh) session.maxSpeedKmh = speedKmh;
    }

    if (session) {
      await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    }
  } catch {
    // noop
  }
};

const registerTask = () => {
  try {
    if (TaskManager.isTaskDefined(FREE_WALK_TASK)) return;
  } catch {
    // noop
  }

  try {
    TaskManager.defineTask(FREE_WALK_TASK, async ({ data, error }: any) => {
      if (error || !data?.locations?.length) return;
      await persistWalkLocationsBatch(
        data.locations.map((l: any) => ({
          latitude: l.coords.latitude,
          longitude: l.coords.longitude,
          speed: l.coords.speed,
        }))
      );
    });
  } catch {
    // noop
  }
};

registerTask();

const buildSummary = (session: FreeWalkSession): FreeWalkSummary => {
  const endedAt = new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000));
  const avgSpeedKmh = session.speedSampleCount > 0 ? session.speedSampleSum / session.speedSampleCount : 0;
  const calories = estimateCalories(session.totalDistance / 1000, durationSeconds / 60, avgSpeedKmh);
  return {
    startedAt: session.startedAt,
    endedAt,
    distanceMeters: session.totalDistance,
    durationSeconds,
    avgSpeedKmh,
    maxSpeedKmh: session.maxSpeedKmh,
    calories,
    lastLat: session.lastLat,
    lastLng: session.lastLng,
  };
};

export const FreeWalkSessionService = {
  start: async (): Promise<boolean> => {
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(FREE_WALK_TASK).catch(() => false);
      if (running) return true;
      if (foregroundWalkSubscription) return true;

      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') return false;
      await Location.requestBackgroundPermissionsAsync().catch(() => null);

      const seedLoc = await Location.getCurrentPositionAsync({}).catch(() => null);
      const now = new Date().toISOString();
      if (seedLoc?.coords) {
        const speedKmh = Math.max(0, (seedLoc.coords.speed || 0) * 3.6);
        const seed: FreeWalkSession = {
          startedAt: now,
          lastUpdateAt: now,
          totalDistance: 0,
          maxSpeedKmh: speedKmh,
          speedSampleCount: 1,
          speedSampleSum: speedKmh,
          lastLat: seedLoc.coords.latitude,
          lastLng: seedLoc.coords.longitude,
          currentSpeedKmh: speedKmh,
        };
        await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(seed));
      }

      try {
        await Location.startLocationUpdatesAsync(FREE_WALK_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
          deferredUpdatesInterval: 10000,
          deferredUpdatesDistance: 15,
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.Fitness,
          foregroundService: {
            notificationTitle: 'Yukpo — Marche libre active',
            notificationBody: 'Session en cours, suivi des stats en arrière-plan',
            notificationColor: '#10B981',
          },
          showsBackgroundLocationIndicator: true,
        });
      } catch (bgErr) {
        console.warn('[FreeWalkSession] startLocationUpdatesAsync failed, using foreground watchPosition', bgErr);
        try {
          foregroundWalkSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 3000,
              distanceInterval: 5,
            },
            (loc) => {
              const { latitude, longitude, speed } = loc.coords;
              void persistWalkLocation(latitude, longitude, speed);
            },
          );
        } catch (watchErr) {
          console.warn('[FreeWalkSession] watchPositionAsync also failed', watchErr);
          return false;
        }
      }
      return true;
    } catch (e) {
      console.warn('[FreeWalkSession] start failed', e);
      return false;
    }
  },

  stop: async (): Promise<FreeWalkSummary | null> => {
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(FREE_WALK_TASK).catch(() => false);
      if (running) {
        await Location.stopLocationUpdatesAsync(FREE_WALK_TASK);
      }
      if (foregroundWalkSubscription) {
        try {
          foregroundWalkSubscription.remove();
        } catch {
          // noop
        }
        foregroundWalkSubscription = null;
      }
      const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
      if (!raw) return null;
      const session: FreeWalkSession = JSON.parse(raw);
      await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
      return buildSummary(session);
    } catch {
      return null;
    }
  },

  isRunning: async (): Promise<boolean> => {
    if (foregroundWalkSubscription) return true;
    try {
      return await Location.hasStartedLocationUpdatesAsync(FREE_WALK_TASK);
    } catch {
      return false;
    }
  },

  getSessionSnapshot: async (): Promise<FreeWalkSession | null> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

export default FreeWalkSessionService;
