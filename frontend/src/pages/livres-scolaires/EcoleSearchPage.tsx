// ✅ Page recherche école partenaire (autocomplete)
// Date : 2026-05-07
import { ArrowLeft, Camera, ChevronRight, MapPin, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface EcoleSummary {
  id: number;
  nom_etablissement: string;
  nom_abrege: string | null;
  slug: string | null;
  ville: string | null;
  quartier: string | null;
  logo_url: string | null;
  type_etablissement: string | null;
}

const EcoleSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EcoleSummary[]>([]);
  const [expansions, setExpansions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fastDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smartDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Stratégie en 2 vagues :
    //   - vague 1 (300 ms) : pg_trgm pur — réponse quasi instantanée
    //   - vague 2 (1100 ms) : pg_trgm + expansion LLM (sigles, variantes ortho)
    // La 2e vague remplace les résultats si elle ramène autre chose.
    if (fastDebounce.current) clearTimeout(fastDebounce.current);
    if (smartDebounce.current) clearTimeout(smartDebounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setExpansions([]);
      return;
    }

    let cancelled = false;
    const fetchSearch = async (smart: boolean) => {
      try {
        const url = `/api/v2/etablissements/search?q=${encodeURIComponent(q)}&limit=12${smart ? '&smart=1' : ''}`;
        const res = await apiGet(url);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setResults(Array.isArray(data?.results) ? data.results : []);
          if (smart) {
            setExpansions(Array.isArray(data?.expansions) ? data.expansions : []);
          }
        }
      } catch {
        if (!cancelled && !smart) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fastDebounce.current = setTimeout(() => {
      setLoading(true);
      fetchSearch(false);
    }, 300);
    smartDebounce.current = setTimeout(() => {
      fetchSearch(true);
    }, 1100);

    return () => {
      cancelled = true;
      if (fastDebounce.current) clearTimeout(fastDebounce.current);
      if (smartDebounce.current) clearTimeout(smartDebounce.current);
    };
  }, [query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">{t('bourse.search.title')}</h1>
        </div>

        {/* Input */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('bourse.search.placeholder')}
              className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-amber-400"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            )}
          </div>
          {/* Suggestions IA — variantes orthographiques / sigles détectés */}
          {expansions.length > 0 && (
            <div className="flex items-start gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide pt-1">
                {t('bourse.search.also_tried')}
              </span>
              {expansions.slice(0, 4).map((e, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(e)}
                  className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 border border-amber-200"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Résultats */}
      <div className="px-4 py-4">
        {loading && (
          <div className="text-center text-sm text-gray-400 py-8">
            {t('bourse.search.loading')}
          </div>
        )}

        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-500 mb-4">{t('bourse.search.empty')}</p>
            <p className="text-xs text-gray-400 mb-5">
              {t('bourse.search.not_partner_yet')}
            </p>
            <button
              onClick={() => navigate('/scan-programme')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-full"
            >
              <Camera className="w-4 h-4" />
              {t('bourse.search.scan_fallback')}
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map(ecole => (
              <button
                key={ecole.id}
                onClick={() => ecole.slug && navigate(`/ecole/${ecole.slug}`)}
                disabled={!ecole.slug}
                className="w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 hover:border-amber-300 active:bg-amber-50 disabled:opacity-50 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shrink-0 overflow-hidden">
                  {ecole.logo_url ? (
                    <img src={ecole.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-amber-700">
                      {ecole.nom_etablissement.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {ecole.nom_etablissement}
                    {ecole.nom_abrege && (
                      <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 align-middle">
                        {ecole.nom_abrege}
                      </span>
                    )}
                  </p>
                  {(ecole.quartier || ecole.ville) && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {[ecole.quartier, ecole.ville].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {query.trim().length < 2 && (
          <div className="text-center text-xs text-gray-400 py-12">
            {t('bourse.search.min_chars')}
          </div>
        )}
      </div>
    </div>
  );
};

export default EcoleSearchPage;
