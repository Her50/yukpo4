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
  /** Optionnel — restreint les suggestions aux classes listées (cas d'un
   *  établissement partenaire dont le programme ne couvre qu'un sous-ensemble).
   *  Match insensible casse/accents sur le couple (niveau, classe). */
  allowedClasses?: Array<{ niveau?: string | null; classe: string }>;
}

/** Alias courants → forme canonique. Insensible à la casse/accents.
 *  ✅ 2026-05-15 : Enrichi avec les NOMS LONGS (Première, Deuxième, etc.)
 *  pour que l'autocomplete trouve la classe même quand l'user tape la
 *  forme longue au lieu de l'abréviation. */
const ALIASES: Record<string, string> = {
  // Maternelle CM-fr — l'app utilise "Maternelle 1ère année" / "2ème année"
  'ps': 'Maternelle 1ère année',
  'petite section': 'Maternelle 1ère année',
  'maternelle 1': 'Maternelle 1ère année',
  'maternelle premiere annee': 'Maternelle 1ère année',
  'maternelle 1ere annee': 'Maternelle 1ère année',
  'mat 1': 'Maternelle 1ère année',
  'ms': 'Maternelle 1ère année', // moyenne section → on map vers 1ère année (système CM = 2 ans)
  'moyenne section': 'Maternelle 1ère année',
  'gs': 'Maternelle 2ème année',
  'grande section': 'Maternelle 2ème année',
  'maternelle 2': 'Maternelle 2ème année',
  'maternelle deuxieme annee': 'Maternelle 2ème année',
  'maternelle 2eme annee': 'Maternelle 2ème année',
  'mat 2': 'Maternelle 2ème année',
  // Anglophone Nursery
  'nursery': 'Nursery 1',
  'nursery a': 'Nursery 1',
  'nursery b': 'Nursery 2',
  'pre-school 1': 'Nursery 1',
  'pre-school 2': 'Nursery 2',
  // Primaire FR
  'sil': 'SIL',
  'section initiation langue': 'SIL',
  'cours preparatoire': 'CP',
  'cours élémentaire 1': 'CE1',
  'cours elementaire 1': 'CE1',
  'cours élémentaire 2': 'CE2',
  'cours elementaire 2': 'CE2',
  'cours moyen 1': 'CM1',
  'cours moyen 2': 'CM2',
  // Collège FR : 6ème, 5ème, 4ème, 3ème
  'sixieme': '6ème',
  'cinquieme': '5ème',
  'quatrieme': '4ème',
  'troisieme': '3ème',
  // Lycée FR : Seconde / Première / Terminale
  'seconde': '2nde',
  'premiere': '1ère',
  'première': '1ère',
  'terminale': 'Tle',
  'terminale a': 'Tle A',
  'terminale c': 'Tle C',
  'terminale d': 'Tle D',
  'terminale ti': 'Tle TI',
  'terminale f2': 'Tle F2',
  'terminale f3': 'Tle F3',
  'premiere a': '1ère A',
  'premiere c': '1ère C',
  'premiere d': '1ère D',
  'seconde a': '2nde A',
  'seconde c': '2nde C',
  // Anglais — Form/Class
  'class one': 'Class 1',
  'class two': 'Class 2',
  'class three': 'Class 3',
  'class four': 'Class 4',
  'class five': 'Class 5',
  'class six': 'Class 6',
  'form one': 'Form 1',
  'form two': 'Form 2',
  'form three': 'Form 3',
  'form four': 'Form 4',
  'form five': 'Form 5',
  'upper sixth': 'Upper Sixth',
  'lower sixth': 'Lower Sixth',
};

/** Inverse de ALIASES : pour chaque forme canonique (valeur), liste les
 *  longueurs qui y mènent. Utilisé pour matcher la query contre les noms
 *  longs en plus de la forme canonique. */
const ALIASES_INVERSE: Record<string, string[]> = (() => {
  const inv: Record<string, string[]> = {};
  for (const [longForm, canonical] of Object.entries(ALIASES)) {
    if (!inv[canonical]) inv[canonical] = [];
    inv[canonical].push(longForm);
  }
  return inv;
})();

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
  allowedClasses,
}) => {
  const [pays, setPays] = useState<PaysCode>(initialPays);
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Précalcule le set de classes autorisées (clé normalisée "niveau|classe")
  // pour un filtrage O(1). Si non fourni, pas de restriction.
  const allowedSet = useMemo(() => {
    if (!allowedClasses) return null;
    const s = new Set<string>();
    for (const ac of allowedClasses) {
      // Stocke 2 clés : une avec niveau, une sans (pour tolérer un niveau absent
      // côté schoolSystems vs DB programmes_scolaires).
      const c = norm(ac.classe);
      s.add(`|${c}`);
      if (ac.niveau) s.add(`${norm(ac.niveau)}|${c}`);
    }
    return s;
  }, [allowedClasses]);

  // Toutes les options du pays + leur score de match avec la requête.
  // L'alias résout d'abord (ex: "PS" → "Maternelle 1ère année"), puis on
  // calcule le score sur la forme canonique.
  const matchedOptions = useMemo(() => {
    let opts = buildOptionsForPays(pays);
    // Filtre par allowedClasses si fourni
    if (allowedSet) {
      opts = opts.filter(o => {
        const c = norm(o.classe);
        const n = norm(o.niveau);
        return allowedSet.has(`|${c}`) || allowedSet.has(`${n}|${c}`);
      });
    }
    const nq = norm(query);
    if (!nq) return opts.slice(0, 30); // Vue par défaut : 30 premières

    // ✅ 2026-05-15 : Résolution alias enrichie. Si la query exacte match
    // une clé d'alias, on prend la forme canonique pour le score principal.
    // En plus, pour chaque option on score aussi contre TOUS les long-forms
    // alias (ex : "terminale a" matche aussi "Tle A"). Permet à l'user de
    // taper "terminale", "premiere", "deuxieme année" sans connaître l'abrev.
    const aliasResolved = ALIASES[nq];
    const effectiveQ = aliasResolved ? norm(aliasResolved) : nq;

    const scored = opts
      .map(o => {
        // Score sur la classe complète et sur le niveau (utile pour fuzzy)
        const scoreClasse = scoreMatch(effectiveQ, o.classe);
        const scoreNiveau = scoreMatch(effectiveQ, o.niveau);
        // Score aussi contre les long-forms enregistrés pour cette classe.
        // Ex : si o.classe = "Tle A" et user tape "terminal", on score nq
        // contre "terminale a" et on prend le meilleur.
        const longForms = ALIASES_INVERSE[o.classe] || [];
        let scoreLongForm = 0;
        for (const lf of longForms) {
          const s = scoreMatch(nq, lf);
          if (s > scoreLongForm) scoreLongForm = s;
        }
        const finalScore = Math.max(scoreClasse, scoreNiveau * 0.3, scoreLongForm);
        return { ...o, matchScore: finalScore };
      })
      .filter(o => o.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    return scored.slice(0, 30);
  }, [pays, query, allowedSet]);

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
