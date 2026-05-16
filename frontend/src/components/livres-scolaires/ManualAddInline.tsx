// ============================================================================
// ManualAddInline — bouton "+ Ajouter manuellement" par section
// ============================================================================
// Composant réutilisable affiché en footer des sections (Manuels / Cahiers
// / Fournitures) dans :
//   - SuggestionsModal (RentreeCenterPage)
//   - BrowseProgrammeByEtablissementPage
//
// 1er clic → ouvre un input autocomplete. La recherche interroge
// /api/v2/parent/articles-search (cross-classes : programmes_scolaires +
// accessoires_populaires_par_classe pour fournitures). Quand l'user pioche
// un item, le callback onPick le reçoit pour intégration au panier parent.
// ============================================================================

import { Loader2, Plus, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../../services/apiService';
import type { PaysCode } from '../../data/schoolSystems';

/** Catégorie de section pour orienter la recherche (livres vs fournitures). */
export type ManualAddCat = 'livres' | 'cahiers' | 'fournitures';

/** Shape minimal d'un article retourné par l'API. Compatible avec
 *  les shapes utilisés dans Suggestions (SuggestionItem) et Browse
 *  (ProgrammeItem). Le parent fait le mapping vers son type local. */
export interface ManualAddItem {
  source?: string;
  type_article?: string;
  titre: string;
  auteur?: string | null;
  editeur?: string | null;
  matiere?: string | null;
  niveau?: string | null;
  prix_officiel?: number | null;
  devise?: string | null;
  quantite_defaut?: number;
  est_obligatoire?: boolean | null;
}

export interface ManualAddInlineProps {
  cat: ManualAddCat;
  pays: PaysCode;
  onPick: (item: ManualAddItem) => void;
  /** ✅ 2026-05-16 — Si défini, la recherche est figée sur cette classe.
   *  Utilisé dans le Récap où l'utilisateur ajoute un manuel pour une classe
   *  d'enfant déjà sélectionnée — on évite les résultats hors classe. */
  classe?: string | null;
  /** Niveau pour back-end (passé tel quel si besoin). */
  niveau?: string | null;
}

const ManualAddInline: React.FC<ManualAddInlineProps> = ({ cat, pays, onPick, classe, niveau }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ManualAddItem[]>([]);
  const [loading, setLoading] = useState(false);
  const groupeForSearch: 'livres' | 'fournitures' = cat === 'livres' ? 'livres' : 'fournitures';

  // Debounce 250ms pour éviter de spammer l'endpoint à chaque keystroke.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('q', q);
        params.set('type_groupe', groupeForSearch);
        params.set('pays', pays);
        // ✅ 2026-05-16 — Si classe spécifiée, on fige la recherche dessus.
        // Le backend (articles-search) accepte ?classe=... pour filtrer.
        if (classe && classe.trim()) params.set('classe', classe.trim());
        if (niveau && niveau.trim()) params.set('niveau', niveau.trim());
        const res = await apiGet(`/api/v2/parent/articles-search?${params}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setResults((data?.items || []) as ManualAddItem[]);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, groupeForSearch, pays, classe, niveau]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 active:bg-amber-100 border-t border-gray-100 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        {t(
          cat === 'livres'
            ? 'bourse.rentree.manual_add_book'
            : cat === 'cahiers'
              ? 'bourse.rentree.manual_add_notebook'
              : 'bourse.rentree.manual_add_supply',
        )}
      </button>
    );
  }

  return (
    <div className="border-t border-gray-100 p-2 bg-gray-50">
      <div className="relative">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('bourse.rentree.manual_add_placeholder')}
          className="w-full px-3 py-2 pl-9 pr-9 bg-white border border-amber-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm">🔍</span>
        <button
          onClick={() => {
            setOpen(false);
            setQuery('');
            setResults([]);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          aria-label={t('bourse.rentree.manual_add_close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {query.trim().length >= 2 && (
        <div className="mt-2 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {loading && (
            <div className="px-3 py-3 text-center text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-1" />
              {t('bourse.rentree.manual_add_loading')}
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-3 text-center text-xs text-gray-500">
              {t('bourse.rentree.manual_add_no_results')}
            </div>
          )}
          {!loading &&
            results.map((r, i) => (
              <button
                key={`${r.titre}-${i}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(r);
                  setQuery('');
                  setResults([]);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-amber-50 active:bg-amber-100"
              >
                <div className="font-semibold text-[13px] text-gray-900 truncate" dir="auto">
                  {r.titre}
                </div>
                <div className="text-[10px] text-gray-500 flex items-center gap-1.5 flex-wrap" dir="auto">
                  {r.matiere && <span>{r.matiere}</span>}
                  {r.matiere && r.editeur && <span className="text-gray-300">·</span>}
                  {r.editeur && <span className="text-purple-700">{r.editeur}</span>}
                  {r.prix_officiel ? (
                    <span className="text-amber-700 font-semibold tabular-nums">
                      {r.prix_officiel.toLocaleString('fr-FR')} {r.devise || 'XAF'}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
        </div>
      )}
      {query.trim().length < 2 && (
        <p className="mt-1.5 text-[10px] text-gray-500 leading-snug">
          {t('bourse.rentree.manual_add_hint')}
        </p>
      )}
    </div>
  );
};

export default ManualAddInline;
