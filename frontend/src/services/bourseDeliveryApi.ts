// =============================================================================
// bourseDeliveryApi.ts — Wrappers pour le flux livraison Bourse du Livre côté
// coursier. Couvre : récupération paquets assignés, détail paquet, refus livre
// dégradé (coursier), transitions de statut (constitue → en_route → livre →
// confirme).
//
// Backend : voir backend/src/routes/bourse_livre_routes.rs (routes
// /api/bourse-livre/v2/packages/*) et controller bourse_livre_v2_controller.rs
// (cancel_book_on_site notamment ligne 6346).
// =============================================================================

import { apiGet, apiPost } from './apiService';

// -----------------------------------------------------------------------------
// Types alignés sur le backend
// -----------------------------------------------------------------------------

export type PackageStatut =
  | 'en_construction'
  | 'constitue'
  | 'en_route'
  | 'livre'
  | 'confirme'
  | 'annule';

/**
 * Une entrée `livres[]` dans book_delivery_packages.livres (JSONB).
 * Le backend stocke chaque livre avec ses infos enrichies pour que le coursier
 * sache exactement quoi récupérer chez qui et combien encaisser au final.
 */
export interface BookDeliveryItem {
  /** ID du livre dans livres_scolaires (occasion/troc). null si neuf via grossiste. */
  livre_id?: number | null;
  /** ID dans commande_livres_neufs (achat neuf). */
  commande_livre_neuf_id?: string | null;
  /** ID dans commande_livres_occasion (achat occasion sans troc). */
  commande_livre_occasion_id?: string | null;
  titre: string;
  auteur?: string | null;
  classe?: string | null;
  matiere?: string | null;
  etat_livre?: string | null;
  /** 'neuf' | 'occasion' | 'troc' */
  mode: 'neuf' | 'occasion' | 'troc' | string;
  valeur?: number | null;
  prix?: number | null;
  vendeur_id?: number | null;
  vendeur_nom?: string | null;
  vendeur_telephone?: string | null;
  vendeur_gps?: string | null;
  /** Statut courant : à_collecter / collecté / refusé / livré / refusé_parent */
  statut?: string | null;
}

export interface BookDeliveryPackage {
  id: number; // SERIAL côté DB
  reference?: string | null;
  destinataire_id: number;
  destinataire_nom?: string | null;
  destinataire_telephone?: string | null;
  destinataire_gps?: string | null;
  destinataire_adresse?: string | null;
  coursier_id?: number | null;
  statut: PackageStatut;
  livres: BookDeliveryItem[];
  nombre_livres: number;
  montant_a_encaisser?: number | null;
  devise?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CancelBookRequest {
  /** ID du paquet (i32 côté backend, cf. book_delivery_packages.id SERIAL). */
  package_id: number;
  /** ID du livre côté livres_scolaires (occasion/troc). */
  livre_id: number;
  /** Texte libre ou code court (ex: "trop_degrade"). Le backend accepte Option<String>. */
  raison?: string;
}

// -----------------------------------------------------------------------------
// API calls
// -----------------------------------------------------------------------------

/** Liste les paquets Bourse du Livre assignés au coursier connecté. */
export async function listCourierPackages(): Promise<BookDeliveryPackage[]> {
  const r = await apiGet('/bourse-livre/v2/packages/courier');
  const data: any = await r.json();
  // L'endpoint peut renvoyer { packages: [...] } OU [...] directement.
  if (Array.isArray(data)) return data;
  return data.packages ?? [];
}

/** Détail complet d'un paquet (livres + adresses GPS + statuts). */
export async function getPackageDetail(packageId: number): Promise<BookDeliveryPackage> {
  const r = await apiGet(`/bourse-livre/v2/packages/${packageId}/detail`);
  const data: any = await r.json();
  // Backend peut envelopper sous { package: {...} }, on accepte les deux.
  return data.package ?? data;
}

/**
 * Coursier refuse un livre occasion/troc trop dégradé à la collecte.
 *
 * Appelle `POST /api/bourse-livre/v2/packages/cancel-book` (cancel_book_on_site).
 * Le backend retire le livre du JSON `livres` du paquet, recalcule
 * `nombre_livres` et `montant_a_encaisser`, et crédite le wallet du
 * destinataire si applicable (cas troc). Idempotent : un 2ème appel sur le
 * même livre est inoffensif (déjà retiré → credit_amount = 0).
 */
export async function coursierRefuseBook(payload: CancelBookRequest): Promise<{
  success: boolean;
  data?: { credit_amount?: number; message?: string };
}> {
  const r = await apiPost('/bourse-livre/v2/packages/cancel-book', payload);
  return r.json();
}

/**
 * Transitions de statut paquet : en_construction → constitue → en_route → livre → confirme.
 *
 * Appelle `POST /api/bourse-livre/v2/packages/{id}/status`.
 */
export async function updatePackageStatus(
  packageId: number,
  statut: PackageStatut,
  notes?: string,
): Promise<{ success: boolean; package?: BookDeliveryPackage }> {
  const r = await apiPost(`/bourse-livre/v2/packages/${packageId}/status`, {
    statut,
    notes: notes ?? null,
  });
  return r.json();
}
