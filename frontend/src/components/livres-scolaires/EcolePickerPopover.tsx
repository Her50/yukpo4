import { School, Search, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { apiGet } from '../../services/apiService';

export interface EtabSuggestion {
  id: number;
  nom: string;
  ville?: string;
  type_etablissement?: string;
  distance_km?: number;
}

interface RawEtab {
  id: number;
  nom?: string;
  nom_etablissement?: string;
  ville?: string;
  type_etablissement?: string;
  distance_km?: number;
}

export interface EcolePickerPopoverProps {
  currentNom?: string;
  gps: { lat: number; lon: number } | null;
  onSelect: (etab: { id: number; nom: string; ville?: string }) => void;
  onClose: () => void;
  title?: string;
  placeholder?: string;
}

const EcolePickerPopover: React.FC<EcolePickerPopoverProps> = ({
  currentNom,
  gps,
  onSelect,
  onClose,
  title = "Choisir l'école",
  placeholder = "Nom de l'école…",
}) => {
  const [q, setQ] = useState(currentNom ?? '');
  const [results, setResults] = useState<EtabSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (q.trim().length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: q.trim(), limit: '15' });
        if (gps) {
          params.set('gps_lat', String(gps.lat));
          params.set('gps_lon', String(gps.lon));
          params.set('rayon_km', '50');
        }
        const res = await apiGet(`/api/orientation-scolaire/etablissements/search?${params}`, { isAuthenticated: false });
        const data = await res.json();
        // Le backend renvoie : { success, data: [...EtablissementScolaire], pagination }
        // Le champ nom est sérialisé "nom_etablissement" côté backend.
        const rawList: RawEtab[] = Array.isArray(data?.data)
          ? data.data
          : (data?.data?.etablissements || data?.etablissements || []);
        const normalized: EtabSuggestion[] = rawList.map(r => ({
          id: r.id,
          nom: r.nom_etablissement || r.nom || 'École',
          ville: r.ville,
          type_etablissement: r.type_etablissement,
          distance_km: r.distance_km,
        }));
        setResults(normalized);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(handler);
  }, [q, gps]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 pb-10 sm:pb-6 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100" aria-label="Fermer">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        {loading && <p className="text-xs text-gray-400 text-center py-2">Recherche…</p>}
        {!loading && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">Aucune école trouvée</p>
        )}
        <div className="space-y-1.5">
          {results.map(etab => (
            <button
              key={etab.id}
              onClick={() => { onSelect({ id: etab.id, nom: etab.nom, ville: etab.ville }); onClose(); }}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-amber-300 text-left"
            >
              <School className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{etab.nom}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[etab.ville, etab.type_etablissement].filter(Boolean).join(' · ')}
                  {etab.distance_km !== undefined && ` · ${etab.distance_km.toFixed(1)} km`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EcolePickerPopover;
