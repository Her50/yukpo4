// ============================================================================
// Composant autocomplete intelligent de classe scolaire
// ============================================================================
// Permet à un utilisateur de saisir une classe et de la matcher contre le
// référentiel officiel (schoolSystems.ts) avec :
//   - Insensibilité à la casse (CP / cp / Cp)
//   - Insensibilité aux accents (1ère / 1ere)
//   - Alias maternelle FR (Petite Section / PS → "Maternelle 1ère année",
//     Grande Section / GS → "Maternelle 2ème année")
//   - Alias techniques (1ère F2, Tle F3, etc.)
//   - Tolérance erreurs de saisie courantes (préfixe partiel)
//   - Filtrage par pays (sélecteur intégré ou pays fixé en props)
//
// Renvoie un objet structuré { pays, systemeId, niveau, classe (canonique), serie? }
// que le parent peut utiliser pour créer un enfant, lancer une recherche, etc.
// ============================================================================

import { Search, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import {
  getSystemesForPays,
  LISTE_PAYS_UNIQUES,
  SYSTEMES_SCOLAIRES,
  type PaysCode,
} from '../../data/schoolSystems';

export interface ClasseSelection {
  pays: PaysCode;
  systemeId: string;
  systemeLabel: string;
  niveau: string;
  /** Forme canonique stockée en DB (ex: "2nde A", "Maternelle 1ère année"). */
  classe: string;
  /** Série/spécialité optionnelle (déjà incluse dans `classe`). */
  serie?: string;
}

interface ClasseAutocompleteProps {
  /** Pays initial (modifiable si `showPaysSelector`). Défaut : CM. */
  initialPays?: PaysCode;
  /** Si true, l'utilisateur peut changer de pays. Sinon le pays est fixé. */
  showPaysSelector?: boolean;
  /** Placeholder du champ de saisie. */
  placeholder?: string;
  /** Callback à la sélection d'une classe. */
  onSelect: (sel: ClasseSelection) => void;
  /** Texte initial du champ (par exemple pour re-éditer). */
  initialQuery?: string;
  /** Si true, focus auto à l'ouverture. */
  autoFocus?: boolean;
}

/** Alias courants → forme canonique. Insensible à la casse/accents. */
const ALIASES: Record<string, string> = {
  // Maternelle CM-fr — l'app utilise "Maternelle 1ère année" / "2ème année"
  'ps': 'Maternelle 1ère année',
  'petite section': 'Maternelle 1ère année',
  'maternelle 1': 'Maternelle 1ère année',
  'mat 1': 'Maternelle 1ère année',
  'ms': 'Maternelle 1ère année', // moyenne section → on map vers 1ère année (système CM = 2 ans)
  'moyenne section': 'Maternelle 1ère année',
  'gs': 'Maternelle 2ème année',
  'grande section': 'Maternelle 2ème année',
  'maternelle 2': 'Maternelle 2ème année',
  'mat 2': 'Maternelle 2ème année',
  // Anglophone Nursery
  'nursery': 'Nursery 1',
  'nursery a': 'Nursery 1',
  'nursery b': 'Nursery 2',
  'pre-school 1': 'Nursery 1',
  'pre-school 2': 'Nursery 2',
  // Primaire FR
  'sil': 'SIL',
  'cours préparatoire': 'CP',
  'cours élémentaire 1': 'CE1',
  'cours élémentaire 2': 'CE2',
  'cours moyen 1': 'CM1',
  'cours moyen 2': 'CM2',
  // Terminale → Tle (forme canonique)
  'terminale': 'Tle',
  'terminale a': 'Tle A',
  'terminale c': 'Tle C',
  'terminale d': 'Tle D',
  'terminale ti': 'Tle TI',
  // 2nde / Seconde
  'seconde': '2nde',
  // Anglais
  'class one': 'Class 1',
  'class two': 'Class 2',
  'class three': 'Class 3',
  'class four': 'Class 4',
  'class five': 'Class 5',
  'class six': 'Class 6',
};

/** Normalisation : minuscules + suppression accents + trim + double-espace. */
const norm = (s: string): string =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

/** Score de match entre la requête et un candidat. Plus c'est haut, mieux c'est.
 *  Heuristique simple : match exact >> préfixe >> contient >> mots en commun. */
const scoreMatch = (q: string, candidate: string): number => {
  const nq = norm(q);
  const nc = norm(candidate);
  if (!nq) return 0;
  if (nc === nq) return 100;
  if (nc.startsWith(nq)) return 80;
  if (nq.startsWith(nc)) return 70; // ex: user tape "tle a c d" → match "Tle A"
  if (nc.includes(nq)) return 50;
  // Mots en commun
  const qWords = nq.split(' ').filter(Boolean);
  const cWords = new Set(nc.split(' '));
  const hits = qWords.filter(w => cWords.has(w)).length;
  if (hits > 0) return 20 + hits * 5;
  return 0;
};

interface ClasseOption {
  pays: PaysCode;
  paysLabel: string;
  paysEmoji: string;
  systemeId: string;
  systemeLabel: string;
  niveau: string;
  classe: string;
  serie?: string;
  matchScore: number;
}

/** Génère toutes les options de classes pour un pays donné, applatissant
 *  les séries (ex: "2nde" + [A, C] → "2nde A", "2nde C"). */
const buildOptionsForPays = (pays: PaysCode): ClasseOption[] => {
  const systemes = getSystemesForPays(pays);
  if (systemes.length === 0) return [];
  const out: ClasseOption[] = [];
  for (const sys of systemes) {
    for (const niveau of sys.niveaux) {
      for (const c of niveau.classes) {
        if (!c.series || c.series.length === 0) {
          out.push({
            pays,
            paysLabel: sys.paysLabel,
            paysEmoji: sys.paysEmoji,
            systemeId: sys.id,
            systemeLabel: sys.systemeLabel,
            niveau: niveau.nom,
            classe: c.nom,
            matchScore: 0,
          });
        } else {
          for (const s of c.series) {
            out.push({
              pays,
              paysLabel: sys.paysLabel,
              paysEmoji: sys.paysEmoji,
              systemeId: sys.id,
              systemeLabel: sys.systemeLabel,
              niveau: niveau.nom,
              classe: `${c.nom} ${s.code}`,
              serie: s.code,
              matchScore: 0,
            });
          }
        }
      }
    }
  }
  return out;
};

const ClasseAutocomplete: React.FC<ClasseAutocompleteProps> = ({
  initialPays = 'CM',
  showPaysSelector = true,
  placeholder = 'Cherchez votre classe (ex: 6ème, CP, Form 1, Tle A, Petite Section...)',
  onSelect,
  initialQuery = '',
  autoFocus = false,
}) => {
  const [pays, setPays] = useState<PaysCode>(initialPays);
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toutes les options du pays + leur score de match avec la requête.
  // L'alias résout d'abord (ex: "PS" → "Maternelle 1ère année"), puis on
  // calcule le score sur la forme canonique.
  const matchedOptions = useMemo(() => {
    const opts = buildOptionsForPays(pays);
    const nq = norm(query);
    if (!nq) return opts.slice(0, 30); // Vue par défaut : 30 premières

    // Résolution alias
    const aliasResolved = ALIASES[nq];
    const effectiveQ = aliasResolved ? norm(aliasResolved) : nq;

    const scored = opts
      .map(o => {
        // Score sur la classe complète et sur le niveau (utile pour fuzzy)
        const scoreClasse = scoreMatch(effectiveQ, o.classe);
        const scoreNiveau = scoreMatch(effectiveQ, o.niveau);
        return { ...o, matchScore: Math.max(scoreClasse, scoreNiveau * 0.3) };
      })
      .filter(o => o.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    return scored.slice(0, 30);
  }, [pays, query]);

  const handleSelect = (opt: ClasseOption) => {
    setQuery(opt.classe);
    setFocused(false);
    inputRef.current?.blur();
    onSelect({
      pays: opt.pays,
      systemeId: opt.systemeId,
      systemeLabel: opt.systemeLabel,
      niveau: opt.niveau,
      classe: opt.classe,
      serie: opt.serie,
    });
  };

  return (
    <div className="space-y-2">
      {showPaysSelector && (
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide shrink-0">
            Pays
          </label>
          <select
            value={pays}
            onChange={e => setPays(e.target.value as PaysCode)}
            className="flex-1 px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:bg-white"
          >
            {LISTE_PAYS_UNIQUES.map(p => (
              <option key={p.code} value={p.code}>
                {p.emoji} {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full px-3 py-2.5 pl-9 bg-gray-50 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:bg-white"
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-1"
            aria-label="Effacer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Liste de suggestions */}
        {focused && matchedOptions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {matchedOptions.map((opt, i) => (
              <button
                key={`${opt.systemeId}-${opt.classe}-${i}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                className="w-full px-3 py-2 text-left hover:bg-amber-50 border-b border-gray-50 last:border-b-0 active:bg-amber-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{opt.classe}</span>
                  <span className="text-[10px] text-gray-400 truncate">
                    {opt.niveau} · {opt.systemeLabel}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {focused && query && matchedOptions.length === 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
            <p className="text-xs text-gray-500">
              Aucune classe ne correspond. Essayez « 6ème », « CP », « Tle A », « Petite Section »…
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClasseAutocomplete;
