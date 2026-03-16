/**
 * PassiveActivityTracker — Service de suivi automatique des déplacements
 * 
 * Fonctionne en arrière-plan même quand l'app est fermée.
 * Détecte automatiquement les déplacements significatifs et enregistre
 * les sessions d'activité (marche, vélo, transport) sans action de l'utilisateur.
 * 
 * Utilise expo-task-manager + expo-location pour le background tracking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiPost } from './api';

// ── Constantes ──
const BACKGROUND_LOCATION_TASK = 'YUKPO_BACKGROUND_LOCATION_TASK';
const STORAGE_KEY_SESSION = '@yukpo_passive_session';
const STORAGE_KEY_ENABLED = '@yukpo_passive_tracking_enabled';
const STORAGE_KEY_PENDING_SESSIONS = '@yukpo_passive_pending_sessions';

// Seuils de détection
const MIN_MOVEMENT_METERS = 15;       // Mouvement minimum pour compter (évite le bruit GPS)
const STATIONARY_TIMEOUT_MS = 3 * 60 * 1000; // 3 min immobile → fin de session
const MIN_SESSION_DISTANCE_M = 50;    // Distance minimum pour enregistrer une session
const MIN_SESSION_DURATION_S = 60;    // Durée minimum (1 min)
const MAX_SINGLE_JUMP_M = 500;        // Ignorer les sauts GPS > 500m (téléportation)

// Estimation du mode de déplacement par vitesse moyenne
const detectTravelMode = (avgSpeedKmh: number): string => {
    if (avgSpeedKmh < 1) return 'stationary';
    if (avgSpeedKmh < 8) return 'walking';
    if (avgSpeedKmh < 25) return 'bicycling';
    if (avgSpeedKmh < 60) return 'transit';
    return 'driving';
};

// Calcul distance haversine
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Estimation calories
const estimateCalories = (distKm: number, durationMin: number, mode: string, avgSpeed: number): number => {
    let met = mode === 'walking' ? (avgSpeed < 4 ? 2.5 : avgSpeed < 5.5 ? 3.5 : 4.5)
        : mode === 'bicycling' ? (avgSpeed < 16 ? 4.0 : 6.8)
            : mode === 'transit' ? 1.3 : 1.5;
    return (met * 70 * durationMin) / 60;
};

// ── Type de session en cours ──
interface PassiveSession {
    startedAt: string;
    lastUpdateAt: string;
    totalDistance: number;
    speedSamples: number[];
    maxSpeed: number;
    originLat: number;
    originLng: number;
    lastLat: number;
    lastLng: number;
    pointCount: number;
}

// ── Enregistrer la session dans le backend ──
const saveSession = async (session: PassiveSession): Promise<void> => {
    const dM = session.totalDistance;
    const dKm = dM / 1000;
    const dSec = Math.round((new Date(session.lastUpdateAt).getTime() - new Date(session.startedAt).getTime()) / 1000);
    const dMin = dSec / 60;

    if (dSec < MIN_SESSION_DURATION_S || dM < MIN_SESSION_DISTANCE_M) {
        console.log('[PassiveTracker] Session trop courte, ignorée:', { dM, dSec });
        return;
    }

    const avg = session.speedSamples.length > 0
        ? session.speedSamples.reduce((a, b) => a + b, 0) / session.speedSamples.length : 0;
    const mode = detectTravelMode(avg);

    if (mode === 'stationary') return;

    const cal = estimateCalories(dKm, dMin, mode, avg);
    const variance = session.speedSamples.length > 0
        ? session.speedSamples.reduce((s, v) => s + (v - avg) ** 2, 0) / session.speedSamples.length : 0;
    const consistency = Math.max(0, 100 - Math.sqrt(variance) * 5);
    const pacePerKm = dKm > 0.01 ? dSec / dKm : 0;

    // Score de qualité simplifié
    let qual = 50;
    if (consistency > 70) qual += 15;
    if (dKm > 1) qual += 10;
    if (dMin > 10) qual += 10;
    if (mode === 'walking' && avg >= 3 && avg <= 7) qual += 15;
    qual = Math.min(100, Math.max(0, qual));

    const payload = {
        travel_mode: mode,
        origin_address: 'Détection automatique',
        destination_address: 'Détection automatique',
        origin_lat: session.originLat,
        origin_lng: session.originLng,
        dest_lat: session.lastLat,
        dest_lng: session.lastLng,
        distance_meters: Math.round(dM),
        duration_seconds: dSec,
        avg_speed_kmh: Math.round(avg * 10) / 10,
        max_speed_kmh: Math.round(session.maxSpeed * 10) / 10,
        calories_burned: Math.round(cal),
        quality_score: qual,
        speed_consistency: Math.round(consistency * 10) / 10,
        pace_per_km_seconds: Math.round(pacePerKm),
        checkpoints_reported: 0,
        checkpoints_encountered: 0,
        was_off_route: false,
        started_at: session.startedAt,
    };

    try {
        await apiPost('/api/navigation/activity/log', payload);
        console.log('[PassiveTracker] ✅ Session enregistrée:', {
            mode, distKm: dKm.toFixed(2), durMin: Math.round(dMin), cal: Math.round(cal), qual
        });
    } catch (e) {
        console.warn('[PassiveTracker] ❌ Erreur enregistrement session, mise en queue offline:', e);
        // Queue la session pour envoi ultérieur quand le réseau revient
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY_PENDING_SESSIONS);
            const pending: any[] = raw ? JSON.parse(raw) : [];
            pending.push({ payload, queuedAt: new Date().toISOString() });
            // Limiter la queue à 50 sessions max pour éviter saturation stockage
            const trimmed = pending.slice(-50);
            await AsyncStorage.setItem(STORAGE_KEY_PENDING_SESSIONS, JSON.stringify(trimmed));
            console.log('[PassiveTracker] 📦 Session mise en queue offline (' + trimmed.length + ' en attente)');
        } catch (queueError) {
            console.warn('[PassiveTracker] Erreur mise en queue:', queueError);
        }
    }
};

// ── Retry des sessions en attente (appelé quand le réseau revient) ──
const retryPendingSessions = async (): Promise<void> => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_PENDING_SESSIONS);
        if (!raw) return;
        const pending: Array<{ payload: any; queuedAt: string }> = JSON.parse(raw);
        if (pending.length === 0) return;

        console.log('[PassiveTracker] 🔄 Retry de', pending.length, 'sessions en attente...');
        const failed: typeof pending = [];

        for (const item of pending) {
            try {
                await apiPost('/api/navigation/activity/log', item.payload);
                console.log('[PassiveTracker] ✅ Session en attente envoyée (du', item.queuedAt, ')');
            } catch {
                failed.push(item);
            }
        }

        if (failed.length > 0) {
            await AsyncStorage.setItem(STORAGE_KEY_PENDING_SESSIONS, JSON.stringify(failed));
            console.log('[PassiveTracker] ⚠️', failed.length, 'sessions toujours en échec');
        } else {
            await AsyncStorage.removeItem(STORAGE_KEY_PENDING_SESSIONS);
            console.log('[PassiveTracker] ✅ Toutes les sessions en attente envoyées');
        }
    } catch (e) {
        console.warn('[PassiveTracker] Erreur retry sessions:', e);
    }
};

// ── Définition de la tâche en arrière-plan ──
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
        console.warn('[PassiveTracker] Erreur tâche background:', error.message);
        return;
    }
    if (!data?.locations?.length) return;

    const location = data.locations[data.locations.length - 1]; // Dernière position
    const { latitude, longitude, speed } = location.coords;
    const spdKmh = Math.max(0, (speed || 0) * 3.6);
    const now = new Date().toISOString();

    try {
        // Charger la session en cours depuis AsyncStorage
        const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
        let session: PassiveSession | null = raw ? JSON.parse(raw) : null;

        if (session) {
            const timeSinceLastUpdate = Date.now() - new Date(session.lastUpdateAt).getTime();
            const dist = haversine(session.lastLat, session.lastLng, latitude, longitude);

            // Si immobile trop longtemps → terminer la session
            if (timeSinceLastUpdate > STATIONARY_TIMEOUT_MS) {
                console.log('[PassiveTracker] Immobile >3min → fin de session');
                await saveSession(session);
                await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
                return;
            }

            // Ignorer les sauts GPS aberrants
            if (dist > MAX_SINGLE_JUMP_M) {
                console.log('[PassiveTracker] Saut GPS ignoré:', dist.toFixed(0), 'm');
                session.lastUpdateAt = now;
                await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
                return;
            }

            // Mouvement significatif → accumuler
            if (dist > MIN_MOVEMENT_METERS) {
                session.totalDistance += dist;
                session.lastLat = latitude;
                session.lastLng = longitude;
                session.lastUpdateAt = now;
                session.speedSamples.push(spdKmh);
                if (spdKmh > session.maxSpeed) session.maxSpeed = spdKmh;
                session.pointCount += 1;
                await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
            } else {
                // Pas de mouvement, juste mettre à jour le timestamp
                session.lastUpdateAt = now;
                await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
            }
        } else {
            // Pas de session en cours → démarrer si mouvement détecté
            if (spdKmh > 1.5) {
                const newSession: PassiveSession = {
                    startedAt: now,
                    lastUpdateAt: now,
                    totalDistance: 0,
                    speedSamples: [spdKmh],
                    maxSpeed: spdKmh,
                    originLat: latitude,
                    originLng: longitude,
                    lastLat: latitude,
                    lastLng: longitude,
                    pointCount: 1,
                };
                await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(newSession));
                console.log('[PassiveTracker] 🚀 Nouvelle session détectée (vitesse:', spdKmh.toFixed(1), 'km/h)');
            }
        }
    } catch (e) {
        console.warn('[PassiveTracker] Erreur traitement position:', e);
    }
});

// ── API publique du service ──

export const PassiveActivityTracker = {
    /**
     * Démarrer le tracking passif en arrière-plan.
     * Appelé après connexion de l'utilisateur.
     */
    start: async (): Promise<boolean> => {
        try {
            // Vérifier si déjà actif
            const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
                .catch(() => false);
            if (isRunning) {
                console.log('[PassiveTracker] Déjà actif');
                return true;
            }

            // Demander les permissions foreground d'abord
            const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
            if (fgStatus !== 'granted') {
                console.warn('[PassiveTracker] Permission foreground refusée');
                return false;
            }

            // Demander la permission background
            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus !== 'granted') {
                console.warn('[PassiveTracker] Permission background refusée');
                // On continue quand même en mode foreground-only
            }

            // Démarrer le suivi en arrière-plan
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 15000,         // Toutes les 15s
                distanceInterval: 20,        // Ou tous les 20m
                deferredUpdatesInterval: 30000, // Batch: toutes les 30s en background
                deferredUpdatesDistance: 50,  // Ou 50m en background
                showsBackgroundLocationIndicator: true,
                foregroundService: {
                    notificationTitle: 'Yukpo — Suivi d\'activité',
                    notificationBody: 'Vos déplacements sont enregistrés automatiquement',
                    notificationColor: '#7C3AED',
                },
                pausesUpdatesAutomatically: true, // iOS: pause auto si immobile
                activityType: Location.ActivityType.Fitness,
            });

            await AsyncStorage.setItem(STORAGE_KEY_ENABLED, 'true');
            console.log('[PassiveTracker] ✅ Tracking passif démarré');
            return true;
        } catch (e) {
            console.warn('[PassiveTracker] ❌ Erreur démarrage:', e);
            return false;
        }
    },

    /**
     * Arrêter le tracking passif.
     */
    stop: async (): Promise<void> => {
        try {
            const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
                .catch(() => false);
            if (isRunning) {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            }

            // Sauvegarder toute session en cours
            const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
            if (raw) {
                const session: PassiveSession = JSON.parse(raw);
                await saveSession(session);
                await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
            }

            await AsyncStorage.setItem(STORAGE_KEY_ENABLED, 'false');
            console.log('[PassiveTracker] ⏹ Tracking passif arrêté');
        } catch (e) {
            console.warn('[PassiveTracker] Erreur arrêt:', e);
        }
    },

    /**
     * Vérifier si le tracking passif est actif.
     */
    isRunning: async (): Promise<boolean> => {
        try {
            return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        } catch {
            return false;
        }
    },

    /**
     * Reprendre le tracking si c'était activé avant (au démarrage de l'app).
     */
    resumeIfEnabled: async (): Promise<void> => {
        try {
            const enabled = await AsyncStorage.getItem(STORAGE_KEY_ENABLED);
            if (enabled === 'true') {
                const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
                    .catch(() => false);
                if (!isRunning) {
                    console.log('[PassiveTracker] Reprise automatique du tracking passif');
                    await PassiveActivityTracker.start();
                }
            }
            // Toujours essayer de renvoyer les sessions en attente au réseau
            retryPendingSessions().catch(() => { });
        } catch (e) {
            console.warn('[PassiveTracker] Erreur reprise:', e);
        }
    },

    /**
     * Forcer la clôture et l'enregistrement de la session en cours (ex: à la déconnexion).
     */
    flushCurrentSession: async (): Promise<void> => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
            if (raw) {
                const session: PassiveSession = JSON.parse(raw);
                await saveSession(session);
                await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
                console.log('[PassiveTracker] Session flushed');
            }
        } catch (e) {
            console.warn('[PassiveTracker] Erreur flush:', e);
        }
    },

    /**
     * Obtenir les infos de la session en cours (pour l'UI).
     */
    getCurrentSession: async (): Promise<PassiveSession | null> => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
};

export default PassiveActivityTracker;
