// ✅ GpsGate — composant qui bloque l'écran tant que la position GPS n'a
// pas été accordée. Utilisé en amont des flows troc/vente livre d'occasion
// pour s'assurer que Yukpo connaît l'adresse de collecte avant d'engager
// le parent dans la photo capture.
//
// Stratégie (2026-05-12) :
//   1. Au montage, on récupère la dernière position connue depuis
//      localStorage (clé `yukpo_last_gps`, validité 1 h) → bypass total.
//   2. Sinon, on affiche DEUX options équivalentes :
//        - Détecter automatiquement (popup système navigator.geolocation)
//        - Saisir manuellement sur la carte (DeliveryMapPicker)
//      On ne déclenche PLUS la popup système d'office : trop d'utilisateurs
//      la refusent et restent coincés sans alternative.
//   3. La sélection manuelle est TOUJOURS disponible, pas seulement après
//      refus — même fonctionne quand le navigateur ne supporte pas geoloc.
//   4. Coords persistés dans localStorage + onGranted appelé.

import { Loader2, MapPin, Pencil, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import DeliveryMapPicker from './DeliveryMapPicker';

const STORAGE_KEY = 'yukpo_last_gps';
const TTL_MS = 60 * 60 * 1000; // 1 heure

export interface GpsCoords {
  lat: number;
  lon: number;
}

interface CachedGps {
  coords: GpsCoords;
  ts: number;
}

function readCachedGps(): GpsCoords | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: CachedGps = JSON.parse(raw);
    if (Date.now() - parsed.ts > TTL_MS) return null;
    if (typeof parsed.coords?.lat !== 'number' || typeof parsed.coords?.lon !== 'number') return null;
    return parsed.coords;
  } catch {
    return null;
  }
}

function persistGps(coords: GpsCoords): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ coords, ts: Date.now() } as CachedGps),
    );
  } catch {
    // localStorage indisponible : on continue sans persistance
  }
}

interface GpsGateProps {
  /** Titre affiché dans l'écran de demande (ex : "Avant de scanner vos livres"). */
  title?: string;
  /** Sous-titre expliquant pourquoi le GPS est nécessaire (ex : "Yukpo doit
   *  savoir où collecter votre livre après le matching"). */
  reason?: string;
  /** Callback appelé une fois la position obtenue. */
  onGranted: (coords: GpsCoords) => void;
  /** Callback optionnel quand l'utilisateur abandonne (retour précédent). */
  onCancel?: () => void;
}

const GpsGate: React.FC<GpsGateProps> = ({
  title = 'Adresse de collecte du livre',
  reason = "Indiquez où le coursier viendra récupérer (ou livrer) votre livre. Vous pouvez utiliser votre position actuelle ou choisir un point sur la carte.",
  onGranted,
  onCancel,
}) => {
  const [status, setStatus] = useState<'idle' | 'asking' | 'unsupported'>('idle');
  const [showMapPicker, setShowMapPicker] = useState(false);

  const requestGps = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    // ✅ Si le navigateur a déjà mémorisé un refus, on ouvre directement la
    // carte sans afficher la popup système ni le message "refusé" — l'user
    // n'a aucune action navigateur à comprendre.
    try {
      const perm = await (navigator.permissions?.query?.({ name: 'geolocation' as PermissionName }));
      if (perm?.state === 'denied') {
        setShowMapPicker(true);
        return;
      }
    } catch {
      // Permissions API indisponible (Safari ancien) → on tente quand même
    }
    setStatus('asking');

    // ✅ Stratégie 2 étages :
    //   1) Tentative rapide low-accuracy (Wi-Fi/cellulaire, 8s) — bon ratio
    //      mobile + desktop. Si TIMEOUT, on retente high-accuracy.
    //   2) High-accuracy (GPS hardware, 15s) — meilleur pour mobile mais
    //      consomme batterie. Réservé au fallback.
    //   Toute autre erreur (perm denied, position unavailable) → carte.
    const onSuccess = (pos: GeolocationPosition) => {
      const coords: GpsCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      persistGps(coords);
      onGranted(coords);
    };
    const onFinalFail = (err?: GeolocationPositionError) => {
      console.warn('[GpsGate] geoloc failed:', err?.code, err?.message);
      setStatus('idle');
      setShowMapPicker(true);
    };
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        // Code 3 = TIMEOUT → on retente avec high-accuracy + timeout long.
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            onFinalFail,
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          );
          return;
        }
        // Code 1 (PERMISSION_DENIED) ou 2 (POSITION_UNAVAILABLE) : pas la
        // peine d'insister → bascule carte.
        onFinalFail(err);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, [onGranted]);

  // Au montage : si on a déjà des coords valides en cache, on saute l'écran.
  // Sinon on AFFICHE le choix (auto via navigateur ou saisie manuelle) sans
  // déclencher la popup système — beaucoup d'utilisateurs bloquent la perm
  // et restent coincés. Mieux vaut leur laisser choisir manuellement.
  useEffect(() => {
    const cached = readCachedGps();
    if (cached) onGranted(cached);
  }, [onGranted]);

  const handleManualConfirm = useCallback(
    (loc: { lat: number; lng: number }) => {
      const coords: GpsCoords = { lat: loc.lat, lon: loc.lng };
      persistGps(coords);
      setShowMapPicker(false);
      onGranted(coords);
    },
    [onGranted],
  );

  if (showMapPicker) {
    return (
      <DeliveryMapPicker
        onClose={() => setShowMapPicker(false)}
        onConfirm={handleManualConfirm}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-6 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full mx-auto flex items-center justify-center mb-3">
            {status === 'asking' ? (
              <Loader2 className="w-7 h-7 text-amber-700 animate-spin" />
            ) : (
              <MapPin className="w-7 h-7 text-amber-700" />
            )}
          </div>
          <h2 className="font-bold text-base text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{reason}</p>

          {status === 'unsupported' && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-3 leading-snug">
              Votre navigateur ne supporte pas la détection automatique.
              Choisissez le point de collecte sur la carte ci-dessous.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={requestGps}
              disabled={status === 'asking' || status === 'unsupported'}
              className="w-full bg-amber-500 disabled:bg-amber-300 text-white font-bold py-3 rounded-xl active:bg-amber-600 min-h-[48px] inline-flex items-center justify-center gap-2"
            >
              {status === 'asking' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Récupération…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Utiliser ma position actuelle
                </>
              )}
            </button>
            <button
              onClick={() => setShowMapPicker(true)}
              className="w-full bg-white border-2 border-amber-500 text-amber-700 font-bold py-3 rounded-xl active:bg-amber-50 min-h-[48px] inline-flex items-center justify-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Choisir un point sur la carte
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl min-h-[48px]"
              >
                Retour
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GpsGate;
