// =============================================================================
// superLibrairieOpsApi.ts — 2026-05-19 MVP2
// Wrappers pour les endpoints Yukpo Librairie : cascade rupture grossiste,
// libération vers libraires_proches, assignation coursier.
//
// Backend correspondant :
//   - POST /api/librairie-network/super-librairie/marquer-rupture-articles
//     (librairie_network_controller.rs)
//   - POST /api/librairie-network/super-librairie/liberer-articles
//   - POST /api/bourse-livre/v2/packages/{id}/assign-courier
//     (bourse_livre_v2_controller.rs)
//   - GET  /api/librairie-network/super-librairie/commandes
//   - GET  /api/librairie-network/commandes/{id}/details
//   - GET  /api/couriers/available?pickup_latitude=…&pickup_longitude=…
// =============================================================================

import { apiGet, apiPost } from './apiService';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CommandeSuperLib {
  id: string;
  reference_commande?: string;
  user_id?: number;
  budget_total?: number;
  devise?: string;
  statut?: string;
  gps_livraison?: string;
  adresse_livraison?: string;
  livres_neufs_count?: number;
  livres_occasion_count?: number;
  created_at?: string;
}

export interface LivreNeufDetail {
  id: string;
  titre: string;
  auteur?: string;
  classe?: string;
  matiere?: string;
  prix_final?: number;
  quantite?: number;
  statut_validation?:
    | 'en_attente'
    | 'valide'
    | 'refuse'
    | 'rupture_grossiste'
    | 'libere_libraires'
    | 'annule_rupture'
    | 'refuse_coursier'
    | 'refuse_parent'
    | string;
  librairie_validateur_id?: string;
  grossiste_assigne_id?: string;
}

export interface RuptureItem {
  commande_id: string;
  livre_neuf_id: string;
  motif?: string;
  grossiste_id?: string;
}

export interface CourierAvailable {
  id: string;
  user_id: number;
  nom_complet?: string;
  email?: string;
  rating_average?: number;
  rating_count?: number;
  engine_type?: string;
  distance_to_pickup_meters?: number;
  current_latitude?: number;
  current_longitude?: number;
}

export interface BookDeliveryPackageDb {
  id: number;
  reference: string;
  destinataire_id: number;
  expediteur_id?: number;
  coursier_id?: number | null;
  destinataire_gps?: string;
  destinataire_adresse?: string;
  expediteur_gps?: string;
  expediteur_adresse?: string;
  nombre_livres: number;
  statut: string;
  valeur_totale?: number;
  created_at?: string;
}

// -----------------------------------------------------------------------------
// Commandes super-lib
// -----------------------------------------------------------------------------

export async function listCommandesSuperLib(limit = 100): Promise<CommandeSuperLib[]> {
  const r = await apiGet(`/librairie-network/super-librairie/commandes?limit=${limit}`);
  const data: any = await r.json();
  return data.commandes ?? data ?? [];
}

export async function getCommandeDetails(
  commandeId: string,
): Promise<{ commande: CommandeSuperLib; livres_neufs: LivreNeufDetail[]; livres_occasion: any[] }> {
  const r = await apiGet(`/librairie-network/commandes/${commandeId}/details`);
  return r.json();
}

// -----------------------------------------------------------------------------
// Rupture grossiste
// -----------------------------------------------------------------------------

export async function marquerRuptureArticles(ruptures: RuptureItem[]): Promise<{
  success: boolean;
  marked: number;
  skipped: number;
  errors: any[];
}> {
  const r = await apiPost('/librairie-network/super-librairie/marquer-rupture-articles', {
    ruptures,
  });
  return r.json();
}

export async function libererArticles(
  livre_neuf_ids: string[],
  options?: { rayon_km?: number; duree_heures?: number },
): Promise<{
  success: boolean;
  libere_count: number;
  skipped: number;
  libraires_notifies: number;
  rayon_km: number;
  expire_in_hours: number;
}> {
  const r = await apiPost('/librairie-network/super-librairie/liberer-articles', {
    livre_neuf_ids,
    rayon_km: options?.rayon_km,
    duree_heures: options?.duree_heures,
  });
  return r.json();
}

// -----------------------------------------------------------------------------
// Coursiers & paquets
// -----------------------------------------------------------------------------

export async function listAvailableCouriers(params?: {
  pickup_latitude?: number;
  pickup_longitude?: number;
  max_distance_km?: number;
}): Promise<CourierAvailable[]> {
  const q = new URLSearchParams();
  if (params?.pickup_latitude !== undefined) q.set('pickup_latitude', String(params.pickup_latitude));
  if (params?.pickup_longitude !== undefined) q.set('pickup_longitude', String(params.pickup_longitude));
  if (params?.max_distance_km !== undefined) q.set('max_distance_km', String(params.max_distance_km));
  const r = await apiGet(`/couriers/available${q.toString() ? `?${q.toString()}` : ''}`);
  const data: any = await r.json();
  return data.couriers ?? data ?? [];
}

export async function assignCourierToPackage(
  packageId: number,
  coursier_user_id: number,
): Promise<{ success: boolean; package?: BookDeliveryPackageDb }> {
  const r = await apiPost(`/bourse-livre/v2/packages/${packageId}/assign-courier`, {
    coursier_user_id,
  });
  return r.json();
}
