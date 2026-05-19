// =============================================================================
// parentCommandesApi.ts — 2026-05-19 MVP3
// Wrappers pour la timeline parent (suivi commande + refus livraison)
// =============================================================================

import { apiGet, apiPost } from './apiService';
import type { BookDeliveryPackage } from './bourseDeliveryApi';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MaCommandeLivreNeuf {
  id: string;
  titre: string;
  auteur?: string;
  classe?: string;
  matiere?: string;
  prix_final?: number;
  quantite?: number;
  statut_validation?: string;
  librairie_validateur_id?: string;
}

export interface MaCommandeLivreOccasion {
  id: string;
  titre: string;
  auteur?: string;
  prix?: number;
  vendeur_id?: number;
  statut?: string;
}

export interface MaCommandeDetail {
  commande: {
    id: string;
    reference_commande?: string;
    statut?: string;
    budget_total?: number;
    devise?: string;
    adresse_livraison?: string;
    gps_livraison?: string;
    created_at?: string;
    updated_at?: string;
  };
  livres_neufs: MaCommandeLivreNeuf[];
  livres_occasion: MaCommandeLivreOccasion[];
}

// -----------------------------------------------------------------------------
// Endpoints existants
// -----------------------------------------------------------------------------

export async function getMaCommandeDetail(commandeId: string): Promise<MaCommandeDetail> {
  const r = await apiGet(`/librairie-network/commandes/${commandeId}/details`);
  return r.json();
}

export async function listMesCommandes(): Promise<MaCommandeDetail['commande'][]> {
  const r = await apiGet('/librairie-network/mes-commandes');
  const data: any = await r.json();
  return data.commandes ?? data ?? [];
}

/** Liste les paquets où je suis destinataire (à recevoir). */
export async function listMesPaquetsRecevoir(): Promise<BookDeliveryPackage[]> {
  const r = await apiGet('/bourse-livre/v2/user/book-dashboard');
  const data: any = await r.json();
  return data.paquets_a_recevoir ?? [];
}

// -----------------------------------------------------------------------------
// MVP3 — Refus livraison (POST parent-refuse-article)
// -----------------------------------------------------------------------------

export interface ParentRefuseArticleRequest {
  commande_livre_neuf_id: string;
  motif?: string;
}

export async function parentRefuseArticle(
  packageId: number,
  payload: ParentRefuseArticleRequest,
): Promise<{
  success: boolean;
  nouveau_nombre_livres: number;
  montant_deduit: number;
  titre_refuse: string;
}> {
  const r = await apiPost(
    `/bourse-livre/v2/packages/${packageId}/parent-refuse-article`,
    payload,
  );
  return r.json();
}
