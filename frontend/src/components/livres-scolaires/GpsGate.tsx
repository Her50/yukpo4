// ✅ GpsGate — composant qui bloque l'écran tant que la position GPS n'a
// pas été accordée. Utilisé en amont des flows troc/vente livre d'occasion
// pour s'assurer que Yukpo connaît l'adresse de collecte avant d'engager
// le parent dans la photo capture.
//
// Stratégie :
//   1. Au montage, on récupère la dernière position connue depuis
//      localStorage (clé `yukpo_last_gps`, validité 1 h).
//   2. Sinon, on lance navigator.geolocation.getCurrentPosition.
//   3. Si refusé : écran d'instructions avec bouton Réessayer.
//   4. Si accepté : on persiste les coords + on appelle onGranted.
//
// Évite que le bouton "Préparation…" bloque infiniment côté VendreLivresPage
// quand le parent n'a pas accordé la géoloc.

import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

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
  title = 'Localisation requise',
  reason = 'Yukpo a besoin de votre position pour organiser la collecte ou la livraison de vos livres.',
  onGranted,
  onCancel,
}) => {
  const [status, setStatus] = useState<'idle' | 'asking' | 'denied' | 'unsupported'>('idle');

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    setStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GpsCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        persistGps(coords);
        onGranted(coords);
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [onGranted]);

  // Au montage : si on a déjà des coords valides en cache, on saute l'écran.
  // Sinon on déclenche immédiatement la demande système.
  useEffect(() => {
    const cached = readCachedGps();
    if (cached) {
      onGranted(cached);
      return;
    }
    requestGps();
  }, [onGranted, requestGps]);

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

          {status === 'denied' && (
            <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-3 leading-snug">
              Vous avez refusé la géolocalisation. Autorisez-la dans les
              paramètres de votre navigateur puis cliquez sur Réessayer.
            </p>
          )}

          {status === 'unsupported' && (
            <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-3 leading-snug">
              Votre navigateur ne supporte pas la géolocalisation. Ouvrez la
              page sur un appareil mobile récent.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={requestGps}
              disabled={status === 'asking'}
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
                  {status === 'denied' ? 'Réessayer' : 'Autoriser la localisation'}
                </>
              )}
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
