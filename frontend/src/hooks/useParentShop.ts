import { useCallback, useEffect, useState } from 'react';
import {
  CLASSES_PAR_SYSTEME_NIVEAU_LEGACY as CPSN_LEGACY,
  getSystemeById,
  NIVEAUX_PAR_SYSTEME_LEGACY as NPS_LEGACY,
  PAYS_PAR_DEFAUT,
  type PaysCode,
} from '../data/schoolSystemsLegacy';

/** Backward-compat types (avant multi-pays) */
export type Systeme = 'francophone' | 'anglophone';
export type TypeItem = 'livre' | 'cahier' | 'fourniture' | 'autre';
export type Choix = 'neuf' | 'occasion' | 'indifferent';

export interface Enfant {
  // ✅ 2026-05-10 : volontairement pas de `prenom` ni d'identifiant nominatif.
  // Les "enfants" du parent sont identifiés uniquement par leur classe — on ne
  // collecte aucune donnée nominative côté UX comme côté localStorage.
  id: string;
  systeme: Systeme;
  niveau: string;
  classe: string;
  /** Nouveau champs (optionnels pour compatibilité v3) */
  pays?: PaysCode;
  serie?: string;
  systemeId?: string;       // ex : "CM-fr", "CM-en"
  etablissementId?: number; // lien après choix autocomplete
  etablissementNom?: string;
  /** Slug de l'établissement partenaire (utilisé pour rediriger vers
   *  /ecole/:slug/commander quand le parent veut ajouter une classe
   *  dans la même école — workflow "frère/sœur dans la même école"). */
  etablissementSlug?: string;
  sessionAcademique?: string; // "2025-2026"
}

export interface PanierItem {
  id: string;
  enfantId: string;
  titre: string;
  auteur?: string;
  matiere?: string;
  type: TypeItem;
  editeur?: string;
  isbn?: string;
  prixNeuf?: number;
  prixOccasion?: number;
  choix: Choix;
  quantite?: number;        // nouveau : pour accessoires
  gamme?: 'entree' | 'standard' | 'premium'; // nouveau : pour accessoires
  /** ID du livre dans la table livres_scolaires si l'utilisateur a proposé un livre
   *  pour cet item via le workflow troc (photo capture). Permet de référencer ce
   *  livre dans le payload de POST /api/librairie-network/commandes (livres_occasion[]). */
  trocLivreId?: number;
  /** Intention de troc cochée par l'utilisateur sur la page scan (avant que la
   *  photo soit prise). Si true et trocLivreId vide → /rentree ouvre la
   *  capture photo pour matcher cet item à un livre concret. */
  troc_intent?: boolean;
}

/* ─── Exports legacy (ancien code qui n'a pas migré) ─── */
export const NIVEAUX_PAR_SYSTEME = NPS_LEGACY;
export const CLASSES_PAR_SYSTEME_NIVEAU = CPSN_LEGACY;
export const CLASSES_PAR_NIVEAU = CPSN_LEGACY.francophone;
export { PAYS_PAR_DEFAUT };

export function getClassesForEnfant(systeme: Systeme, niveau: string): string[] {
  // Accès dynamique au mapping legacy (les clés sont typées const, mais on en
  // ignore le typage strict pour permettre une lookup par chaîne quelconque).
  const niveauxDuSysteme = CPSN_LEGACY[systeme] as Record<string, readonly string[]> | undefined;
  const classes = niveauxDuSysteme?.[niveau];
  return classes ? Array.from(classes) : [];
}

/* ─── Hook ─── */
const STORAGE_KEY = 'yukpo_parent_shop_v4';

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useParentShop() {
  const [enfants, setEnfants] = useState<Enfant[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw).enfants ?? [];
      // Migration v3 → v4
      const v3 = localStorage.getItem('yukpo_parent_shop_v3');
      if (v3) {
        const parsed = JSON.parse(v3);
        return (parsed.enfants ?? []).map((e: any) => ({
          ...e,
          pays: e.pays ?? PAYS_PAR_DEFAUT,
          systemeId: e.systemeId ?? `${PAYS_PAR_DEFAUT}-${e.systeme === 'anglophone' ? 'en' : 'fr'}`,
        }));
      }
      // Migration v2 → v4
      const v2 = localStorage.getItem('yukpo_parent_shop_v2');
      if (v2) {
        const parsed = JSON.parse(v2);
        return (parsed.enfants ?? []).map((e: any) => ({
          ...e,
          systeme: e.systeme ?? 'francophone',
          pays: PAYS_PAR_DEFAUT,
          systemeId: `${PAYS_PAR_DEFAUT}-fr`,
        }));
      }
      return [];
    } catch { return []; }
  });

  const [panier, setPanier] = useState<PanierItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw).panier ?? [];
      const v3 = localStorage.getItem('yukpo_parent_shop_v3');
      if (v3) return JSON.parse(v3).panier ?? [];
      const v2 = localStorage.getItem('yukpo_parent_shop_v2');
      if (v2) return JSON.parse(v2).panier ?? [];
      return [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enfants, panier }));
  }, [enfants, panier]);

  const addEnfant = useCallback((data: Omit<Enfant, 'id'>): Enfant => {
    const e: Enfant = { ...data, id: genId() };
    setEnfants(prev => [...prev, e]);
    return e;
  }, []);

  const updateEnfant = useCallback((id: string, data: Partial<Omit<Enfant, 'id'>>) => {
    setEnfants(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));
  }, []);

  const removeEnfant = useCallback((id: string) => {
    setEnfants(prev => prev.filter(e => e.id !== id));
    setPanier(prev => prev.filter(p => p.enfantId !== id));
  }, []);

  const toggleItem = useCallback((item: Omit<PanierItem, 'id'>) => {
    setPanier(prev => {
      const idx = prev.findIndex(p => p.enfantId === item.enfantId && p.titre === item.titre);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [...prev, { ...item, id: genId() }];
    });
  }, []);

  const addItems = useCallback((items: Omit<PanierItem, 'id'>[]) => {
    setPanier(prev => {
      const next = [...prev];
      for (const item of items) {
        const exists = next.some(p => p.enfantId === item.enfantId && p.titre === item.titre);
        if (!exists) next.push({ ...item, id: genId() });
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setPanier(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateChoix = useCallback((id: string, choix: Choix) => {
    setPanier(prev => prev.map(p => (p.id === id ? { ...p, choix } : p)));
  }, []);

  /** Associe un livre proposé au troc (livres_scolaires.id) à un item du panier. */
  const updateTrocMatch = useCallback((id: string, trocLivreId: number | undefined) => {
    setPanier(prev => prev.map(p => (p.id === id ? { ...p, trocLivreId } : p)));
  }, []);

  /** Efface l'intention de troc — utilisé quand l'utilisateur abandonne ou
   *  rejette la capture photo : l'item reste en occasion mais n'est plus
   *  candidat à un échange. */
  const clearTrocIntent = useCallback((id: string) => {
    setPanier(prev => prev.map(p => (p.id === id ? { ...p, troc_intent: false } : p)));
  }, []);

  /** ✅ 2026-05-16 — Toggle direct de l'intention troc (utilisé par le
   *  sélecteur 3-état Neuf/Occasion/Échange dans le récap). */
  const setTrocIntent = useCallback((id: string, intent: boolean) => {
    setPanier(prev => prev.map(p => (p.id === id ? { ...p, troc_intent: intent } : p)));
  }, []);

  const updateQuantite = useCallback((id: string, quantite: number) => {
    setPanier(prev => prev.map(p => (p.id === id ? { ...p, quantite: Math.max(0, quantite) } : p)));
  }, []);

  const updateGamme = useCallback((id: string, gamme: 'entree' | 'standard' | 'premium') => {
    setPanier(prev => prev.map(p => (p.id === id ? { ...p, gamme } : p)));
  }, []);

  const isInPanier = useCallback(
    (enfantId: string, titre: string) =>
      panier.some(p => p.enfantId === enfantId && p.titre === titre),
    [panier]
  );

  const getItemsForEnfant = useCallback(
    (enfantId: string) => panier.filter(p => p.enfantId === enfantId),
    [panier]
  );

  const countByEnfant = useCallback(
    (enfantId: string) => panier.filter(p => p.enfantId === enfantId).length,
    [panier]
  );

  const clearPanierForEnfant = useCallback((enfantId: string) => {
    setPanier(prev => prev.filter(p => p.enfantId !== enfantId));
  }, []);

  const clearPanier = useCallback(() => {
    setPanier([]);
  }, []);

  return {
    enfants,
    panier,
    addEnfant,
    updateEnfant,
    removeEnfant,
    toggleItem,
    addItems,
    removeItem,
    updateChoix,
    updateTrocMatch,
    clearTrocIntent,
    setTrocIntent,
    updateQuantite,
    updateGamme,
    isInPanier,
    getItemsForEnfant,
    countByEnfant,
    clearPanierForEnfant,
    clearPanier,
    totalItems: panier.length,
    // Helpers système scolaire
    getSystemeById,
  };
}
