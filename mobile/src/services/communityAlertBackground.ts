/**
 * Alertes communautaires en arrière-plan (app fermée / autre écran / conduite)
 * — même logique de seuils que NavigationScreen, mais exécutée depuis
 * PassiveActivityTracker (expo-task-manager + startLocationUpdatesAsync).
 *
 * Les checkpoints sont mis en cache AsyncStorage quand NavigationScreen charge l'API,
 * et rafraîchis périodiquement depuis cette tâche si besoin.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { communityAlertSoundService } from './communityAlertSoundService';
import { apiGet } from './api';

const STORAGE_CHECKPOINTS = '@yukpo_community_alert_checkpoints_v1';
const STORAGE_ENCOUNTERED = '@yukpo_community_alert_encountered_v1';
const STORAGE_FETCH_META = '@yukpo_community_alert_fetch_meta_v1';

/** Aligné sur NavigationScreen — distances max pour considérer une alerte */
const CHECKPOINT_ALERT_DISTANCE: Record<string, number> = {
  radar: 10000,
  police: 10000,
  transport_control: 10000,
  road_check: 10000,
  accident: 3000,
  danger: 2000,
  road_works: 2000,
  speed_bump: 500,
};

const CHECKPOINT_ALERT_THRESHOLDS: Record<string, number[]> = {
  radar: [10000, 5000, 2000, 500],
  police: [10000, 5000, 2000, 500],
  transport_control: [10000, 5000, 2000, 500],
  road_check: [10000, 5000, 2000, 500],
  accident: [3000, 1000, 300],
  danger: [2000, 800, 200],
  road_works: [2000, 800, 200],
  speed_bump: [500, 200],
};

type CheckpointRow = {
  id: string;
  checkpoint_type: string;
  latitude: number;
  longitude: number;
  speed_limit?: number;
};

const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const checkpointTypeToCommunityAlert = (
  checkpointType: string,
): Parameters<typeof communityAlertSoundService.sendFreeAlertSound>[0] | null => {
  const k = String(checkpointType || '').toLowerCase();
  switch (k) {
    case 'radar':
    case 'speed_bump':
      return 'speed_alert';
    case 'police':
    case 'transport_control':
      return 'police_control';
    case 'accident':
      return 'accident_report';
    case 'danger':
      return 'danger_zone';
    case 'road_check':
    case 'road_works':
      return 'road_work';
    default:
      return 'new_checkpoint';
  }
};

let lastProcessAt = 0;
const MIN_PROCESS_INTERVAL_MS = 4000;
const MIN_FETCH_INTERVAL_MS = 120000;
const MOVE_REFETCH_METERS = 8000;

function validateCoords(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

async function loadEncountered(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_ENCOUNTERED);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, number>;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

async function saveEncountered(enc: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_ENCOUNTERED, JSON.stringify(enc));
  } catch {
    /* ignore */
  }
}

async function loadCachedCheckpoints(): Promise<CheckpointRow[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_CHECKPOINTS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CheckpointRow[];
    return Array.isArray(arr) ? arr.filter((c) => c?.id && validateCoords(c.latitude, c.longitude)) : [];
  } catch {
    return [];
  }
}

async function saveCachedCheckpoints(rows: CheckpointRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_CHECKPOINTS, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

type FetchMeta = { t: number; lat: number; lng: number };

async function loadFetchMeta(): Promise<FetchMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_FETCH_META);
    if (!raw) return null;
    return JSON.parse(raw) as FetchMeta;
  } catch {
    return null;
  }
}

async function saveFetchMeta(lat: number, lng: number): Promise<void> {
  try {
    const m: FetchMeta = { t: Date.now(), lat, lng };
    await AsyncStorage.setItem(STORAGE_FETCH_META, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

async function fetchCheckpointsNear(lat: number, lng: number): Promise<CheckpointRow[]> {
  const oLat = lat - 0.04;
  const oLng = lng - 0.04;
  const dLat = lat + 0.04;
  const dLng = lng + 0.04;
  const r = await apiGet(
    `/api/navigation/checkpoints/along-route?origin_lat=${oLat}&origin_lng=${oLng}&dest_lat=${dLat}&dest_lng=${dLng}`,
  );
  const backendResp = r?.data as any;
  const checkpointsArray = Array.isArray(backendResp?.data?.checkpoints)
    ? backendResp.data.checkpoints
    : Array.isArray(backendResp?.checkpoints)
      ? backendResp.checkpoints
      : [];
  const out: CheckpointRow[] = [];
  for (const c of checkpointsArray) {
    if (c && validateCoords(c.latitude, c.longitude) && c.id) {
      out.push({
        id: String(c.id),
        checkpoint_type: String(c.checkpoint_type || ''),
        latitude: c.latitude,
        longitude: c.longitude,
        speed_limit: typeof c.speed_limit === 'number' ? c.speed_limit : undefined,
      });
    }
  }
  return out;
}

async function shouldFetchRemote(lat: number, lng: number, cached: CheckpointRow[]): Promise<boolean> {
  if (cached.length === 0) return true;
  const meta = await loadFetchMeta();
  if (!meta) return true;
  const dt = Date.now() - meta.t;
  if (dt > MIN_FETCH_INTERVAL_MS) return true;
  const moved = haversineMeters(lat, lng, meta.lat, meta.lng);
  return moved > MOVE_REFETCH_METERS;
}

/**
 * Appelé depuis NavigationScreen quand la liste des checkpoints est chargée / mise à jour.
 */
export async function persistCheckpointsForBackground(checkpoints: CheckpointRow[]): Promise<void> {
  const rows = (checkpoints || []).filter((c) => c?.id && validateCoords(c.latitude, c.longitude));
  await saveCachedCheckpoints(rows);
  /* meta optionnelle : évite un fetch immédiat en BG si l'utilisateur vient de charger la zone */
  if (rows.length > 0 && rows[0]) {
    await saveFetchMeta(rows[0].latitude, rows[0].longitude);
  }
}

/**
 * Fusionne l'état « déjà alerté » persistant (BG) dans la Map utilisée par NavigationScreen.
 */
export async function mergeStoredEncounteredIntoMap(target: Map<string, number>): Promise<void> {
  const enc = await loadEncountered();
  for (const [id, th] of Object.entries(enc)) {
    const cur = target.get(id);
    if (cur === undefined || th < cur) {
      target.set(id, th);
    }
  }
}

/**
 * Enregistre un franchissement de seuil (depuis NavigationScreen) pour rester cohérent avec la tâche BG.
 */
export async function recordEncounteredThreshold(checkpointId: string, threshold: number): Promise<void> {
  const enc = await loadEncountered();
  const cur = enc[checkpointId];
  if (cur === undefined || threshold < cur) {
    enc[checkpointId] = threshold;
    await saveEncountered(enc);
  }
}

/** Nouvelle session de navigation / marche libre : repartir des seuils d'alerte à zéro. */
export async function clearStoredEncounteredRecord(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_ENCOUNTERED);
  } catch {
    /* ignore */
  }
}

/**
 * Point d'entrée depuis PassiveActivityTracker (arrière-plan).
 */
export async function processBackgroundCommunityAlerts(lat: number, lng: number): Promise<void> {
  if (!validateCoords(lat, lng)) return;

  const now = Date.now();
  if (now - lastProcessAt < MIN_PROCESS_INTERVAL_MS) return;
  lastProcessAt = now;

  try {
    let checkpoints = await loadCachedCheckpoints();
    if (await shouldFetchRemote(lat, lng, checkpoints)) {
      try {
        checkpoints = await fetchCheckpointsNear(lat, lng);
        await saveCachedCheckpoints(checkpoints);
        await saveFetchMeta(lat, lng);
      } catch (e) {
        console.warn('[CommunityAlertBG] fetch checkpoints failed', e);
        if (checkpoints.length === 0) return;
      }
    }

    if (checkpoints.length === 0) return;

    let encountered = await loadEncountered();

    for (const cp of checkpoints) {
      const dist = haversineMeters(lat, lng, cp.latitude, cp.longitude);
      const alertDist = CHECKPOINT_ALERT_DISTANCE[cp.checkpoint_type] || 2000;
      if (dist > alertDist) continue;

      const thresholds = CHECKPOINT_ALERT_THRESHOLDS[cp.checkpoint_type] || [2000, 500];
      const lastAlertedThreshold = encountered[cp.id] ?? Infinity;
      let currentThreshold = Infinity;
      for (const th of thresholds) {
        if (dist <= th && th < currentThreshold) currentThreshold = th;
      }
      if (currentThreshold === Infinity) currentThreshold = thresholds[thresholds.length - 1];

      if (currentThreshold < lastAlertedThreshold) {
        encountered[cp.id] = currentThreshold;
        await saveEncountered(encountered);

        const alertType = checkpointTypeToCommunityAlert(cp.checkpoint_type);
        if (alertType) {
          const distanceForTemplate = Math.max(0, Math.round(dist));
          await communityAlertSoundService.sendFreeAlertSound(alertType, {
            distance: distanceForTemplate,
            limit: cp.speed_limit ?? '',
            description: '',
            checkpointType: cp.checkpoint_type,
            checkpointId: cp.id,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[CommunityAlertBG] process error', e);
  }
}
