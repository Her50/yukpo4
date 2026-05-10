/**
 * Helpers de configuration d'un établissement scolaire.
 *
 * Reposent sur le référentiel `schoolSystems.ts` (déjà exhaustif :
 * 14 systèmes couvrant CM, CI, SN, GA, CG, CD, BJ, TG, BF, ML, NE, NG, GH).
 *
 * On expose :
 *  - le mapping `systeme_scolaire` DB → 1 ou 2 SystemeScolaire (cas bilingue)
 *  - la liste des cycles offerts canoniques (mat/prim/coll/lyc/tech/pro/sup)
 *  - un filtrage des niveaux selon les cycles offerts choisis
 */
import {
  PaysCode, SystemeScolaire, Niveau,
  SYSTEMES_SCOLAIRES, getSystemesForPays,
} from './schoolSystems';

export type SystemeScolaireDB = 'francophone' | 'anglophone' | 'bilingue';

export type CycleId =
  | 'maternelle'
  | 'primaire'
  | 'college'
  | 'lycee'
  | 'technique'
  | 'professionnelle'
  | 'superieur';

export interface CycleDef {
  id: CycleId;
  label: string;
  labelEn: string;
  /** Mots-clés (insensibles à la casse/accents) qui matchent un nom de niveau. */
  matchTerms: string[];
}

export const CYCLES: CycleDef[] = [
  {
    id: 'maternelle', label: 'Maternelle', labelEn: 'Pre-school',
    matchTerms: ['maternelle', 'preprimaire', 'préprimaire', 'nursery', 'kindergarten', 'kg'],
  },
  {
    id: 'primaire', label: 'Primaire', labelEn: 'Primary',
    matchTerms: ['primaire', 'primary', 'élémentaire', 'elementaire'],
  },
  {
    id: 'college', label: 'Collège (1er cycle secondaire)', labelEn: 'Junior secondary',
    matchTerms: ['collège', 'college', 'moyen', '1er cycle', 'cycle inférieur', 'junior secondary', 'jhs', 'jss'],
  },
  {
    id: 'lycee', label: 'Lycée général (2nd cycle)', labelEn: 'Senior secondary',
    matchTerms: ['lycée général', 'lycee general', 'secondaire général', 'secondaire general', 'cycle supérieur', 'humanités', 'senior secondary', 'shs', 'sss', 'high school', 'a level', 'o level'],
  },
  {
    id: 'technique', label: 'Technique / industriel', labelEn: 'Technical / industrial',
    matchTerms: ['technique', 'industriel', 'commercial', 'agro', 'hôtellerie', 'hotellerie', 'technical secondary'],
  },
  {
    id: 'professionnelle', label: 'Formation professionnelle', labelEn: 'Vocational',
    matchTerms: ['professionnelle', 'professionnel', 'cap', 'bep', 'bts', 'vocational'],
  },
  {
    id: 'superieur', label: 'Supérieur', labelEn: 'Higher education',
    matchTerms: ['supérieur', 'superieur', 'higher', 'university', 'université'],
  },
];

const norm = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Détecte le cycle canonique d'un niveau du référentiel à partir de son nom. */
export function detectCycle(niveauNom: string): CycleId | null {
  const n = norm(niveauNom);
  for (const cycle of CYCLES) {
    for (const term of cycle.matchTerms) {
      if (n.includes(norm(term))) return cycle.id;
    }
  }
  return null;
}

/**
 * Retourne les SystemeScolaire applicables à un établissement.
 * - 'francophone' : tous les systèmes `langue=='fr'` du pays
 * - 'anglophone'  : tous les systèmes `langue=='en'` du pays
 * - 'bilingue'    : tous les systèmes du pays (potentiellement 2)
 *
 * Fallback pays inconnu : on prend le premier système par langue dans le référentiel.
 */
export function getSystemesPourEtablissement(
  pays: PaysCode | string | null | undefined,
  systeme: SystemeScolaireDB,
): SystemeScolaire[] {
  const code = (pays || 'CM') as PaysCode;
  const all = getSystemesForPays(code);
  const filtered = (() => {
    if (systeme === 'bilingue') return all;
    if (systeme === 'francophone') return all.filter(s => s.langue === 'fr');
    if (systeme === 'anglophone') return all.filter(s => s.langue === 'en');
    return all;
  })();
  if (filtered.length > 0) return filtered;
  // Fallback : on cherche dans tous les pays par langue (utile si pays absent du référentiel)
  if (systeme === 'francophone') {
    const fr = SYSTEMES_SCOLAIRES.find(s => s.langue === 'fr');
    return fr ? [fr] : [];
  }
  if (systeme === 'anglophone') {
    const en = SYSTEMES_SCOLAIRES.find(s => s.langue === 'en');
    return en ? [en] : [];
  }
  return SYSTEMES_SCOLAIRES.slice(0, 2);
}

/** Filtre les niveaux d'un système selon les cycles offerts choisis. */
export function filtrerNiveauxParCycles(
  systeme: SystemeScolaire,
  cyclesOfferts: CycleId[],
): Niveau[] {
  if (cyclesOfferts.length === 0) return systeme.niveaux;
  const set = new Set(cyclesOfferts);
  return systeme.niveaux.filter(n => {
    const cycle = detectCycle(n.nom);
    return cycle ? set.has(cycle) : true; // niveau non-classifié → on le garde
  });
}

/**
 * Liste plate de toutes les classes (avec séries dépliées) pour un système et
 * un set de cycles. Utile pour l'auto-création de programmes vides.
 */
export function getClassesPlates(
  systeme: SystemeScolaire,
  cyclesOfferts: CycleId[],
): Array<{ niveau: string; classe: string; serie?: string; fullName: string }> {
  const niveaux = filtrerNiveauxParCycles(systeme, cyclesOfferts);
  const out: Array<{ niveau: string; classe: string; serie?: string; fullName: string }> = [];
  for (const n of niveaux) {
    for (const c of n.classes) {
      if (!c.series || c.series.length === 0) {
        out.push({ niveau: n.nom, classe: c.nom, fullName: c.nom });
      } else {
        for (const s of c.series) {
          out.push({
            niveau: n.nom,
            classe: c.nom,
            serie: s.code,
            fullName: `${c.nom} ${s.code}`,
          });
        }
      }
    }
  }
  return out;
}
