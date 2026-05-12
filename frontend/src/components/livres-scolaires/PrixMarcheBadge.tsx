import { Loader2, MapPin, Store, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../../services/apiService';

/**
 * Badge "marché" qui, au clic, ouvre un popover affichant :
 *   - les libraires Yukpo proposant ce livre dans un rayon de 25 km
 *   - leur prix, leur état (Bon / Acceptable), leur distance GPS
 *   - la médiane calculée côté client à partir de la liste retournée
 *
 * Source : GET /api/bourse-livre/search?classe_actuelle=X&matiere=Y&mode_listing=vente
 *          (endpoint déjà exposé, pas de changement backend nécessaire)
 *
 * Logique de matching :
 *   - Pré-filtre serveur : (classe_actuelle, matiere, gps, rayon_km)
 *   - Filtre client supplémentaire si `titre` fourni (similarité approximative)
 */

export interface PrixMarcheBadgeProps {
  classe?: string;
  matiere?: string;
  /** Optionnel : aide à filtrer côté client si plusieurs livres matchent
   *  le couple (classe, matière) — ex: livres de mathématiques 6e variantes */
  titre?: string;
  gps?: { lat: number; lon: number } | null;
  /** Devise affichée (défaut XAF). */
  devise?: string;
}

interface LibraireListing {
  id: number;
  user_id?: number;
  titre?: string;
  prix_detecte?: number;
  etat_livre?: string;
  etat_classification?: string;
  ville?: string;
  quartier?: string;
  gps?: string;
  distance_km?: number;
  mode_listing?: string;
}

const PrixMarcheBadge: React.FC<PrixMarcheBadgeProps> = ({
  classe, matiere, titre, gps, devise = 'XAF',
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listings, setListings] = useState<LibraireListing[]>([]);
  const [fetched, setFetched] = useState(false);

  const fetchListings = useCallback(async () => {
    if (!classe || !matiere) {
      setError('Classe et matière requises');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        classe_actuelle: classe,
        matiere: matiere,
        mode_listing: 'vente',
        limit: '20',
      });
      if (gps) {
        params.set('gps_lat', String(gps.lat));
        params.set('gps_lon', String(gps.lon));
        params.set('rayon_km', '25');
      }
      const res = await apiGet(`/api/bourse-livre/search?${params}`, { isAuthenticated: false });
      const data = await res.json().catch(() => ({}));
      const raw: any[] = data?.livres || data?.data?.livres || data?.data || [];
      // Filtre similarité titre si fourni (évite faux-positifs entre livres de la
      // même classe+matière mais de titres très différents).
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      const wantedTokens = titre ? norm(titre).split(/\s+/).filter(t => t.length > 2) : [];
      const filtered = wantedTokens.length > 0
        ? raw.filter(l => {
            const lt = norm(l.titre || '');
            const score = wantedTokens.filter(t => lt.includes(t)).length / wantedTokens.length;
            return score >= 0.4;
          })
        : raw;
      setListings(filtered);
      setFetched(true);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [classe, matiere, titre, gps]);

  const handleOpen = () => {
    setOpen(true);
    if (!fetched && !loading) fetchListings();
  };

  // Médiane des prix
  const median = (() => {
    const prices = listings
      .map(l => Number(l.prix_detecte))
      .filter(n => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);
    if (prices.length === 0) return null;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  })();

  if (!classe || !matiere) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100"
        title="Voir les libraires Yukpo proches"
      >
        <Store className="w-3 h-3" />
        Marché
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 pb-8 sm:pb-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Libraires proches</h3>
                <p className="text-xs text-gray-500 truncate">{titre || `${matiere} · ${classe}`}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {loading && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-1" />
                <p className="text-xs text-gray-500">Recherche dans le réseau Yukpo…</p>
              </div>
            )}

            {error && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                <p className="text-xs text-red-700">{error}</p>
                <button onClick={fetchListings} className="mt-1 text-xs underline text-red-700 font-semibold">
                  Réessayer
                </button>
              </div>
            )}

            {!loading && !error && listings.length === 0 && fetched && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <Store className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-700 font-semibold mb-1">Aucun libraire ne propose ce livre actuellement</p>
                <p className="text-[11px] text-gray-500">
                  Yukpo cherchera automatiquement dès la commande passée.
                </p>
              </div>
            )}

            {!loading && !error && listings.length > 0 && (
              <>
                {median && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                    <p className="text-[11px] text-amber-700">Prix médian observé</p>
                    <p className="text-lg font-bold text-amber-800">
                      {median.toLocaleString('fr-FR')} {devise}
                      <span className="text-xs font-normal text-amber-600 ml-1">
                        · {listings.length} libraire{listings.length > 1 ? 's' : ''}
                      </span>
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  {listings.slice(0, 15).map(l => (
                    <div key={l.id} className="bg-white border border-gray-100 rounded-xl p-2.5">
                      <div className="flex items-start gap-2">
                        <Store className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{l.titre || 'Livre'}</p>
                          <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
                            {l.ville && <span className="truncate">{l.ville}</span>}
                            {l.distance_km !== undefined && (
                              <>
                                <MapPin className="w-2.5 h-2.5" />
                                <span>{l.distance_km.toFixed(1)} km</span>
                              </>
                            )}
                            {l.etat_livre && (
                              <span className="bg-gray-100 px-1 py-0.5 rounded">{l.etat_livre}</span>
                            )}
                          </p>
                        </div>
                        {l.prix_detecte !== undefined && l.prix_detecte > 0 && (
                          <p className="text-xs font-bold text-amber-700 shrink-0">
                            {l.prix_detecte.toLocaleString('fr-FR')} {devise}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-center text-[10px] text-gray-400 mt-3">
                  Données issues du réseau Yukpo · mises à jour en continu
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PrixMarcheBadge;
