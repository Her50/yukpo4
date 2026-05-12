import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet default marker icons (sinon brisés sous Vite/Webpack)
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/**
 * Picker GPS pour la livraison Bourse du Livre (OpenStreetMap + Nominatim).
 *
 * UX :
 *   - Recherche d'adresse via Nominatim (gratuit, pas d'API key)
 *   - Bouton "Ma position" qui zoom + place le marqueur
 *   - Tap/drag sur la carte pour ajuster manuellement
 *   - "Confirmer" qui renvoie { lat, lng, address }
 *
 * Rationale (2026-05-12) : passage de Google Maps à OSM/Leaflet pour
 * éliminer la dépendance GCP (billing, API key, restrictions referrer)
 * qui causait des "Oops! Something went wrong" silencieux côté parent.
 */

// 🗺️ Carte de base : CartoDB Voyager — gratuit, sans API key, rendu détaillé
//    avec bâtiments + rues nommées + parcs. Bien plus lisible qu'OSM Standard.
const TILE_VOYAGER = 'https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png';
// 🛰️ Couche satellite optionnelle : Esri World Imagery — gratuit pour usage
//    raisonnable, montre les bâtiments en image aérienne (utile en milieu rural CM).
const TILE_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TILE_VOYAGER_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const TILE_SATELLITE_ATTR = 'Tiles &copy; Esri';

const DEFAULT_CENTER: [number, number] = [4.0511, 9.7679]; // Douala, CM
// 🔎 Géocodeur : Photon (komoot) — conçu pour l'autocomplete, plus rapide
//    que Nominatim et sans rate-limit strict côté public. Permet le biais
//    par lat/lon pour prioriser les résultats proches de l'utilisateur.
const PHOTON = 'https://photon.komoot.io/api';
const CACHED_GPS_KEY = 'yukpo_last_gps';

function readCachedGps(): [number, number] | null {
  try {
    const raw = localStorage.getItem(CACHED_GPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = parsed?.coords?.lat;
    const lon = parsed?.coords?.lon;
    const ts = parsed?.ts;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    if (typeof ts === 'number' && Date.now() - ts > 60 * 60 * 1000) return null;
    return [lat, lon];
  } catch {
    return null;
  }
}

export interface DeliveryMapPickerProps {
  initialLocation?: { lat: number; lng: number };
  onClose: () => void;
  onConfirm: (loc: { lat: number; lng: number; address?: string }) => void;
}

// Format d'une feature GeoJSON renvoyée par Photon
interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    type?: string;
  };
}

interface Suggestion {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

function formatPhotonLabel(f: PhotonFeature): string {
  const p = f.properties;
  const parts = [
    p.name,
    [p.housenumber, p.street].filter(Boolean).join(' '),
    [p.postcode, p.city].filter(Boolean).join(' '),
    p.state,
    p.country,
  ].filter((s) => s && s.trim().length > 0);
  // Dédoublonne (parfois name = street)
  const dedup: string[] = [];
  for (const s of parts) if (s && !dedup.includes(s)) dedup.push(s);
  return dedup.join(', ');
}

// Re-centre la carte avec animation flyTo dès que `target` change.
// On utilise un ref sur les coords précédentes pour skipper le premier render
// (sinon flyTo se déclenche inutilement au montage).
const RecenterMap: React.FC<{ target: [number, number]; zoom: number }> = ({ target, zoom }) => {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (prev.current && (prev.current[0] !== target[0] || prev.current[1] !== target[1])) {
      map.flyTo(target, zoom, { duration: 0.6 });
    } else if (!prev.current) {
      map.setView(target, zoom);
    }
    prev.current = target;
  }, [map, target, zoom]);
  return null;
};

// Capture les clics sur la carte pour repositionner le marqueur.
const ClickHandler: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
};

const DeliveryMapPicker: React.FC<DeliveryMapPickerProps> = ({
  initialLocation,
  onClose,
  onConfirm,
}) => {
  // Position initiale : (1) prop explicite, sinon (2) GPS caché en localStorage
  // (max 1 h), sinon (3) Douala — on tentera ensuite un getCurrentPosition
  // silencieux pour recentrer si l'autorisation est encore active.
  const cachedInit = !initialLocation ? readCachedGps() : null;
  const [coords, setCoords] = useState<[number, number]>(
    initialLocation
      ? [initialLocation.lat, initialLocation.lng]
      : cachedInit ?? DEFAULT_CENTER,
  );
  const [zoom, setZoom] = useState<number>(initialLocation || cachedInit ? 15 : 13);
  const [address, setAddress] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [predictions, setPredictions] = useState<Suggestion[]>([]);
  const [showSatellite, setShowSatellite] = useState(false);
  const [showPreds, setShowPreds] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);

  // ⚡ Au montage, si on n'a NI prop initialLocation NI cache, on tente une
  // détection GPS silencieuse (sans bloquer l'UI) pour ouvrir la carte sur la
  // position réelle de l'user. 2 étages (low-acc puis high-acc sur timeout).
  useEffect(() => {
    if (initialLocation || cachedInit || !navigator.geolocation) return;
    const onOk = (pos: GeolocationPosition) => {
      setCoords([pos.coords.latitude, pos.coords.longitude]);
      setZoom(15);
    };
    navigator.geolocation.getCurrentPosition(
      onOk,
      (err) => {
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            onOk,
            () => {
              /* silencieux */
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          );
        }
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse-geocode via Photon (renvoie une feature au plus proche)
  useEffect(() => {
    if (reverseAbortRef.current) reverseAbortRef.current.abort();
    const ctrl = new AbortController();
    reverseAbortRef.current = ctrl;
    const t = window.setTimeout(async () => {
      try {
        const url = `${PHOTON}/reverse?lon=${coords[1]}&lat=${coords[0]}&lang=fr&limit=1`;
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) return;
        const data = await r.json();
        const feat: PhotonFeature | undefined = data?.features?.[0];
        if (feat) setAddress(formatPhotonLabel(feat));
      } catch {
        // ignore : reverse geocoding optionnel
      }
    }, 400);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [coords]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setShowPreds(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (val.trim().length < 3) {
      setPredictions([]);
      return;
    }
    setSearching(true);
    // Capture la position de référence pour biaiser la recherche (utilise
    // les coords courantes affichées sur la carte, qui correspondent à la
    // position auto-détectée si OK, sinon Douala).
    const biasLat = coords[0];
    const biasLon = coords[1];
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url = `${PHOTON}/?q=${encodeURIComponent(val)}&lang=fr&limit=8&lat=${biasLat}&lon=${biasLon}`;
        const r = await fetch(url);
        if (!r.ok) {
          console.warn('[Photon] HTTP', r.status);
          setPredictions([]);
          return;
        }
        const data = await r.json();
        const feats: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
        const items: Suggestion[] = feats
          .filter((f) => f?.geometry?.coordinates?.length === 2)
          .map((f, i) => ({
            id: `${f.properties?.osm_id ?? i}-${i}`,
            label: formatPhotonLabel(f),
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }));
        setPredictions(items);
      } catch (err) {
        console.warn('[Photon] search error:', err);
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [coords]);

  const pickPrediction = (p: Suggestion) => {
    setCoords([p.lat, p.lng]);
    setZoom(16);
    setAddress(p.label);
    setSearchQuery(p.label);
    setShowPreds(false);
    setPredictions([]);
  };

  const useMyLocation = () => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError('Géolocalisation non supportée. Choisissez le lieu sur la carte.');
      return;
    }
    setLocating(true);
    // ✅ Stratégie 2 étages — voir GpsGate pour les détails.
    const onSuccess = (pos: GeolocationPosition) => {
      setCoords([pos.coords.latitude, pos.coords.longitude]);
      setZoom(16);
      setLocating(false);
    };
    const onFinalFail = (err?: GeolocationPositionError) => {
      console.warn('[DeliveryMapPicker] geoloc failed:', err?.code, err?.message);
      setLocating(false);
      if (err?.code === err?.PERMISSION_DENIED) {
        setLocateError("Détection refusée par votre navigateur. Cherchez ou cliquez sur la carte.");
      } else if (err?.code === err?.POSITION_UNAVAILABLE) {
        setLocateError("Votre appareil ne fournit pas de position GPS. Cherchez ou cliquez sur la carte.");
      } else {
        setLocateError("La détection a échoué. Cherchez ou cliquez sur la carte.");
      }
    };
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.TIMEOUT) {
          // Retry high-accuracy (GPS hardware)
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            onFinalFail,
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          );
          return;
        }
        onFinalFail(err);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white sm:rounded-2xl w-full sm:max-w-2xl flex flex-col max-h-screen sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
          <MapPin className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-gray-900 text-base flex-1">Choisir le lieu de collecte</h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative px-4 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => predictions.length > 0 && setShowPreds(true)}
              onBlur={() => window.setTimeout(() => setShowPreds(false), 200)}
              placeholder="Rechercher : quartier, rue, point de repère…"
              autoComplete="off"
              className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 outline-none focus:border-amber-400"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />
            )}
          </div>
          {showPreds && predictions.length > 0 && (
            <div className="absolute z-10 left-4 right-4 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
              {predictions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => pickPrediction(p)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 border-b border-gray-100 last:border-b-0 flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{p.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-gray-100 min-h-[300px]">
          <MapContainer
            center={coords}
            zoom={zoom}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom
            doubleClickZoom
            touchZoom
            zoomControl
          >
            {showSatellite ? (
              <TileLayer
                key="sat"
                url={TILE_SATELLITE}
                attribution={TILE_SATELLITE_ATTR}
                maxZoom={19}
              />
            ) : (
              <TileLayer
                key="voyager"
                url={TILE_VOYAGER}
                attribution={TILE_VOYAGER_ATTR}
                maxZoom={20}
              />
            )}
            <RecenterMap target={coords} zoom={zoom} />
            <ClickHandler onClick={(lat, lng) => setCoords([lat, lng])} />
            <Marker
              position={coords}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  setCoords([lat, lng]);
                },
              }}
            />
          </MapContainer>

          {/* Toggle satellite */}
          <button
            onClick={() => setShowSatellite((v) => !v)}
            className="absolute top-3 right-3 bg-white rounded-lg px-2.5 py-1.5 shadow-lg border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-amber-50 z-[400]"
            title={showSatellite ? 'Passer en vue plan' : 'Passer en vue satellite'}
          >
            {showSatellite ? '🗺️ Plan' : '🛰️ Satellite'}
          </button>

          {/* Bouton "Ma position" superposé */}
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="absolute bottom-4 right-4 bg-white rounded-full p-2.5 shadow-lg border border-gray-200 hover:bg-amber-50 z-[400]"
            title="Utiliser ma position GPS"
          >
            {locating ? (
              <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
            ) : (
              <Crosshair className="w-5 h-5 text-amber-600" />
            )}
          </button>
        </div>

        {/* Adresse + actions */}
        <div className="border-t border-gray-100 p-3 shrink-0 space-y-2">
          {locateError && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 leading-snug">
              {locateError}
            </div>
          )}
          {address && (
            <div className="text-xs text-gray-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 leading-snug">
              📍 {address}
            </div>
          )}
          <div className="text-[11px] text-gray-500 tabular-nums">
            Coordonnées : {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={() => onConfirm({ lat: coords[0], lng: coords[1], address })}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold"
            >
              Confirmer ce lieu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryMapPicker;
