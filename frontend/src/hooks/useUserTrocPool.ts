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

  /** Cherche un livre du pool qui matche le titre + classe (optionnelle).
   *  Renvoie le PoolItem le plus proche au-dessus du seuil 0.5, sinon null. */
  const findMatchInPool = useMemo(() => {
    return (titre: string, classe?: string): PoolItem | null => {
      if (!pool || pool.length === 0) return null;
      const titleNorm = norm(titre);
      if (!titleNorm) return null;
      let best: { item: PoolItem; score: number } | null = null;
      for (const it of pool) {
        const s = similarity(titre, it.titre);
        if (s < 0.5) continue;
        // Filtre classe si fournie : ignore si la classe diffère trop
        if (classe) {
          const cn = norm(classe);
          const cc = norm(it.classe_actuelle);
          const cs = norm(it.classe_souhaitee);
          if (cn && cc && !cn.includes(cc) && !cc.includes(cn) && cs !== cn) {
            // skip — classe ne matche pas
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
