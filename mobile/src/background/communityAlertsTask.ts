import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';
import SafeStorage from '../utils/safeStorage';
import { Platform } from 'react-native';

/**
 * Background task: surveille les alertes communautaires (checkpoints) autour de l'utilisateur
 * et déclenche une notification sonore même si l'app est fermée.
 *
 * Notes plateforme:
 * - Android: fonctionne correctement avec startLocationUpdatesAsync (Foreground service recommandé).
 * - iOS: nécessite permission "Toujours" + background location activé; le système peut throttler.
 */

export const COMMUNITY_ALERTS_TASK = 'COMMUNITY_ALERTS_BACKGROUND_TASK';

const STORAGE_KEY = '@community_alerts_last_seen_v1';
const COOLDOWN_MS = 3 * 60 * 1000; // anti-spam: 3 minutes
const MAX_TRACKED = 64;

type LastSeen = Record<string, number>; // checkpointId -> lastNotifiedAt (ms)

function getApiBase(): string {
  const extra = (Constants.expoConfig as any)?.extra || (Constants.manifest as any)?.extra || {};
  const apiUrl = extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || '';
  return String(apiUrl || '').replace(/\/+$/, '');
}

function nowMs(): number {
  return Date.now();
}

function normalizeCheckpointId(cp: any): string | null {
  const id = cp?.id ?? cp?.checkpoint_id ?? cp?._id;
  if (typeof id === 'string' && id.trim()) return id.trim();
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  return null;
}

function validateCoords(lat: any, lng: any): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng);
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    // Canal générique (fallback)
    await Notifications.setNotificationChannelAsync('community_alerts', {
      name: 'Alertes communautaires',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#EF4444',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Canal "urgence" : son custom (si embarqué), sinon fallback système
    await Notifications.setNotificationChannelAsync('community_alerts_urgent', {
      name: 'Alertes communautaires urgentes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 350, 150, 350],
      lightColor: '#DC2626',
      // Le fichier doit être déclaré via plugin expo-notifications (app.config.js -> sounds)
      sound: 'phone-ring.mp3',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Canal "info" : son système par défaut
    await Notifications.setNotificationChannelAsync('community_alerts_info', {
      name: 'Alertes communautaires info',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120, 80, 120],
      lightColor: '#F59E0B',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    // ignore
  }
}

async function loadLastSeen(): Promise<LastSeen> {
  try {
    const raw = await SafeStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as LastSeen;
  } catch {
    return {};
  }
}

async function saveLastSeen(map: LastSeen): Promise<void> {
  try {
    const entries = Object.entries(map)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, MAX_TRACKED);
    const trimmed: LastSeen = {};
    for (const [k, v] of entries) trimmed[k] = v;
    await SafeStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

async function fetchCheckpointsNear(apiBase: string, lat: number, lng: number, authToken?: string | null) {
  const url = `${apiBase}/api/navigation/checkpoints/nearby?lat=${lat}&lng=${lng}&radius_km=10&limit=80`;
  const r = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const cps = Array.isArray(data?.data?.checkpoints)
    ? data.data.checkpoints
    : Array.isArray(data?.checkpoints)
      ? data.checkpoints
      : [];
  return cps;
}

function alertDistanceForType(type: string): number {
  const t = String(type || '').toLowerCase();
  // Radars/controles: plus loin ; autres: plus proche
  if (t.includes('radar') || t.includes('police') || t.includes('transport')) return 10000;
  return 2000;
}

function iconForType(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t.includes('radar')) return '📸';
  if (t.includes('police')) return '👮';
  if (t.includes('accident')) return '🚨';
  if (t.includes('danger')) return '⚠️';
  if (t.includes('work')) return '🚧';
  if (t.includes('bump')) return '🔶';
  return '⚠️';
}

function titleForType(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t.includes('radar')) return 'Radar';
  if (t.includes('police')) return 'Police';
  if (t.includes('transport')) return 'Contrôle';
  if (t.includes('accident')) return 'Accident';
  if (t.includes('danger')) return 'Danger';
  if (t.includes('work')) return 'Travaux';
  if (t.includes('bump')) return "Dos-d'âne";
  return 'Alerte';
}

function channelForType(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t.includes('accident') || t.includes('danger') || t.includes('police') || t.includes('radar')) {
    return 'community_alerts_urgent';
  }
  return 'community_alerts_info';
}

function soundForType(type: string): 'default' | 'phone-ring.mp3' {
  const t = String(type || '').toLowerCase();
  if (t.includes('accident') || t.includes('danger') || t.includes('police') || t.includes('radar')) {
    return 'phone-ring.mp3';
  }
  return 'default';
}

TaskManager.defineTask(COMMUNITY_ALERTS_TASK, async ({ data, error }: any) => {
  if (error) {
    return;
  }

  const apiBase = getApiBase();
  if (!apiBase) return;

  try {
    await ensureAndroidChannel();
  } catch {
    // ignore
  }

  const locations = data?.locations as Array<{ coords?: { latitude: number; longitude: number } }> | undefined;
  const first = locations?.[0]?.coords;
  const lat = first?.latitude;
  const lng = first?.longitude;

  if (!validateCoords(lat, lng)) return;

  const authToken = await SafeStorage.getItem('auth_token');
  if (!authToken) return;

  let checkpoints: any[] = [];
  try {
    checkpoints = await fetchCheckpointsNear(apiBase, lat, lng, authToken);
  } catch {
    return;
  }

  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return;

  const lastSeen = await loadLastSeen();
  const now = nowMs();

  // Trouver les checkpoints pertinents proches (1 ou 2 max par tick)
  const candidates: Array<{ id: string; type: string; dist: number }> = [];
  for (const cp of checkpoints) {
    const id = normalizeCheckpointId(cp);
    const cLat = cp?.latitude;
    const cLng = cp?.longitude;
    const type = String(cp?.checkpoint_type || '');
    if (!id || !validateCoords(cLat, cLng)) continue;
    const dist = distanceMeters(lat, lng, cLat, cLng);
    const limit = alertDistanceForType(type);
    if (dist > limit) continue;
    const last = lastSeen[id] || 0;
    if (now - last < COOLDOWN_MS) continue;
    candidates.push({ id, type, dist });
  }

  candidates.sort((a, b) => a.dist - b.dist);
  const picked = candidates.slice(0, 2);
  if (picked.length === 0) return;

  for (const p of picked) {
    try {
      const icon = iconForType(p.type);
      const title = `${icon} ${titleForType(p.type)}`;
      const body = `${titleForType(p.type)} à ${Math.round(p.dist)} m`;

      const isUrgent = channelForType(p.type) === 'community_alerts_urgent';
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: soundForType(p.type),
          ...(Platform.OS === 'android'
            ? { channelId: channelForType(p.type) }
            : {
                // iOS 15+ : passe en mode timeSensitive pour couper le Focus Mode
                interruptionLevel: (isUrgent ? 'timeSensitive' : 'active') as any,
              }),
          data: {
            type: 'community_alert',
            checkpoint_type: p.type,
            distance_meters: Math.round(p.dist),
          },
        },
        trigger: null,
      });

      lastSeen[p.id] = now;
    } catch {
      // ignore
    }
  }

  await saveLastSeen(lastSeen);
});

