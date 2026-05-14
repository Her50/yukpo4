// Hook GPS réutilisable avec stratégie de fallback à 3 étages — calqué sur
// la logique de [GpsGate.tsx](../components/livres-scolaires/GpsGate.tsx)
// (Bourse du Livre) mais sans bloquer l'écran : utilisable en arrière-plan
// dans les PWA spécialisées (pharmacie, restaurant, etc.).
//
// Stratégie :
//   1. Cache localStorage `yukpo_last_gps` (TTL 1 h) → retour instantané sans popup système
//   2. Sinon navigator.geolocation low-accuracy (Wi-Fi/cellulaire, 8 s)
//   3. Sur TIMEOUT, retry high-accuracy (GPS hardware, 15 s)
//   4. Sur échec final, status passe à 'manual_required' — l'UI peut afficher
//      un CTA pour ouvrir un picker carte (DeliveryMapPicker, etc.)

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GpsCoords {
  lat: number;
  lng: number;
}

interface CachedGps {
  coords: GpsCoords;
  ts: number;
}

const STORAGE_KEY = 'yukpo_last_gps';
const TTL_MS = 60 * 60 * 1000;

type GpsStatus = 'idle' | 'detecting' | 'ready' | 'manual_required' | 'unsupported';

function readCachedGps(): GpsCoords | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: CachedGps = JSON.parse(raw);
    if (Date.now() - parsed.ts > TTL_MS) return null;
    // Compat : Bourse stocke `coords.lon`, on supporte les deux.
    const c = parsed.coords as any;
    const lat = typeof c?.lat === 'number' ? c.lat : null;
    const lng = typeof c?.lng === 'number' ? c.lng : (typeof c?.lon === 'number' ? c.lon : null);
    if (lat === null || lng === null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function persistGps(coords: GpsCoords): void {
  try {
    // On écrit sous les deux formes (lat/lng + lat/lon) pour rester compatible
    // avec Bourse du Livre qui lit `coords.lon`.
    const payload = { coords: { lat: coords.lat, lng: coords.lng, lon: coords.lng }, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage indisponible : on continue sans persistance */
  }
}

export interface UseGpsWithFallback {
  gps: GpsCoords | null;
  status: GpsStatus;
  /** Force une nouvelle détection (ignore le cache). */
  detect: () => void;
  /** L'utilisateur a choisi un point manuellement (depuis un picker carte). */
  setManual: (coords: GpsCoords) => void;
  /** Vide le cache et l'état. */
  reset: () => void;
}

export function useGpsWithFallback(opts: { autoDetect?: boolean } = {}): UseGpsWithFallback {
  const { autoDetect = true } = opts;
  const [gps, setGps] = useState<GpsCoords | null>(null);
  const [status, setStatus] = useState<GpsStatus>('idle');
  const triedRef = useRef(false);

  const setManual = useCallback((coords: GpsCoords) => {
    persistGps(coords);
    setGps(coords);
    setStatus('ready');
  }, []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setGps(null);
    setStatus('idle');
    triedRef.current = false;
  }, []);

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    setStatus('detecting');

    const onSuccess = (pos: GeolocationPosition) => {
      const coords: GpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      persistGps(coords);
      setGps(coords);
      setStatus('ready');
    };

    const onFinalFail = () => {
      setStatus('manual_required');
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            onFinalFail,
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          );
          return;
        }
        onFinalFail();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;

    const cached = readCachedGps();
    if (cached) {
      setGps(cached);
      setStatus('ready');
      return;
    }
    if (!autoDetect) return;
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    // Si la permission est explicitement refusée, on ne déclenche pas la popup —
    // on passe directement en 'manual_required' pour que l'UI propose un picker.
    (async () => {
      try {
        const perm = await navigator.permissions?.query?.({ name: 'geolocation' as PermissionName });
        if (perm?.state === 'denied') {
          setStatus('manual_required');
          return;
        }
      } catch { /* Permissions API absente (Safari ancien) — on tente quand même */ }
      detect();
    })();
  }, [autoDetect, detect]);

  return { gps, status, detect, setManual, reset };
}
