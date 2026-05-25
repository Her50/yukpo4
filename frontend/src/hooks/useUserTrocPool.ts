// ✅ useUserTrocPool — détection cross-flow
//
// Charge UNE fois la liste des livres que le parent a déjà déposés en
// troc/vente/don non encore conclus, et expose un helper `findMatchInPool`
// qui détecte fuzzy match (titre normalisé + classe optionnelle) pour
// flagger sur les listes scolaires les livres "déjà couverts par votre
// échange". Évite que le parent achète à nouveau un livre qu'il a déjà
// mis en troc.
//
// Le pool n'est pas refetched automatiquement — on garde un cache simple
// au niveau de la session. Pour invalider après un ajout/retrait, exposer
// un refresh() côté consumer si besoin.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../services/apiService';

export interface PoolItem {
  id: number;
  titre: string;
  auteur?: string;
  classe_actuelle?: string;
  classe_souhaitee?: string;
  matiere?: string;
  mode_listing: 'troc' | 'vente' | 'don';
  troc_status: 'pending' | 'matched' | 'chained' | string;
  valeur?: number | null;
}

/** Critère de matching pool — la classe cible affichée correspond à
 *  l'objectif d'un troc (classe_souhaitee du livre déjà déposé) ou,
 *  par tolérance, à la classe terminée (classe_actuelle).
 *  La règle métier veut que le parent voie son livre 5ème grisé si
 *  un troc 6ème→5ème est déjà engagé pour la même matière. */
export interface PoolMatchCriteria {
  /** Titre du livre affiché dans la liste scolaire. */
  titre: string;
  /** Matière du livre affiché (math, français, etc.). */
  matiere?: string;
  /** Classe cible affichée (= classe à venir de l'enfant, ex. "5ème"). */
  classeCible?: string;
}

/** Normalisation minimaliste : lower + sans accents + espaces compactés. */
function norm(s: string | undefined | null): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire diacritiques
    .replace(/[^a-z0-9\s]/g, ' ')    // ponctuation → espace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distance simple : ratio de mots communs sur le nombre de mots total
 *  de la requête. Très permissif (≥ 0.5) pour absorber variantes d'édition. */
function similarity(a: string, b: string): number {
  const wa = norm(a).split(' ').filter(Boolean);
  const wb = new Set(norm(b).split(' ').filter(Boolean));
  if (wa.length === 0 || wb.size === 0) return 0;
  let hits = 0;
  for (const w of wa) if (wb.has(w)) hits += 1;
  return hits / wa.length;
}

export function useUserTrocPool() {
  const [pool, setPool] = useState<PoolItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/troc-livres/my-pool');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setPool((data?.items || []) as PoolItem[]);
    } catch (e: any) {
      // En cas d'erreur (non auth, réseau), on traite comme un pool vide
      // pour ne pas casser les pages qui consomment le hook.
      setPool([]);
      setError(e?.message || 'Erreur chargement pool troc');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Cherche un livre du pool qui matche le titre + matière + classe cible.
   *  Règle métier: la classe affichée (`classeCible`) est la classe À VENIR de
   *  l'enfant — donc on doit la comparer en priorité à `classe_souhaitee` du
   *  pool (la classe que le parent vise via son troc).
   *  Accepte deux signatures pour rétro-compatibilité :
   *    findMatchInPool(titre)
   *    findMatchInPool({ titre, matiere, classeCible })
   *  Renvoie le PoolItem le plus proche au-dessus du seuil 0.5, sinon null. */
  const findMatchInPool = useMemo(() => {
    return (
      titreOrCriteria: string | PoolMatchCriteria,
      _legacyClasse?: string,
    ): PoolItem | null => {
      const criteria: PoolMatchCriteria =
        typeof titreOrCriteria === 'string'
          ? { titre: titreOrCriteria, classeCible: _legacyClasse }
          : titreOrCriteria;
      const { titre, matiere, classeCible } = criteria;
      if (!pool || pool.length === 0) return null;
      const titleNorm = norm(titre);
      if (!titleNorm) return null;
      const matNorm = norm(matiere);
      const cibleNorm = norm(classeCible);
      let best: { item: PoolItem; score: number } | null = null;
      for (const it of pool) {
        const s = similarity(titre, it.titre);
        if (s < 0.5) continue;
        // Filtre matière : doit correspondre si fournie de part et d'autre
        if (matNorm && it.matiere) {
          const im = norm(it.matiere);
          if (im && im !== matNorm && !im.includes(matNorm) && !matNorm.includes(im)) {
            continue;
          }
        }
        // Filtre classe cible : la classe affichée (cible) doit correspondre à
        // ce que le parent VEUT obtenir via son troc (= classe_souhaitee), ou
        // à défaut à la classe déjà entrée (cas vente/don sans progression).
        if (cibleNorm) {
          const cs = norm(it.classe_souhaitee);
          const cc = norm(it.classe_actuelle);
          const matchesTarget = cs && (cs === cibleNorm || cs.includes(cibleNorm) || cibleNorm.includes(cs));
          const matchesCurrent = cc && (cc === cibleNorm || cc.includes(cibleNorm) || cibleNorm.includes(cc));
          if (!matchesTarget && !matchesCurrent) {
            continue;
          }
        }
        if (!best || s > best.score) {
          best = { item: it, score: s };
        }
      }
      return best?.item ?? null;
    };
  }, [pool]);

  return {
    pool: pool ?? [],
    loading,
    error,
    refresh,
    findMatchInPool,
  };
}
