import { apiGet, apiPatch, apiPost } from './api';

export type CommandeMixteListeItem = {
    id: string;
    reference_commande?: string | null;
    statut?: string | null;
    budget_total?: number | null;
    created_at?: string | null;
};

export type LigneNeufBornes = {
    ligne_id: string;
    prix_officiel: number;
    prix_final: number;
    quantite: number;
    titre: string;
    prix_officiel_verrouille: boolean;
    prix_plancher?: number | null;
    prix_plafond?: number | null;
    prix_suggere?: number | null;
    bornes_source?: string | null;
    /** `en_attente` | `valide` | `indisponible` | `en_cours_validation` */
    statut_validation?: string | null;
    classe?: string | null;
    matiere?: string | null;
};

type BornesResponseBody = {
    success?: boolean;
    commande_id?: string;
    lignes?: LigneNeufBornes[];
};

export async function getLibrairieMesCommandesMixtes(): Promise<{ commandes: CommandeMixteListeItem[] }> {
    const r = await apiGet<{ success?: boolean; commandes?: CommandeMixteListeItem[] }>(
        '/api/librairie-network/librairie/mes-commandes-mixtes'
    );
    if (!r.success || r.data == null) {
        throw new Error((r as { error?: string }).error || 'Erreur réseau');
    }
    const body = r.data as { commandes?: CommandeMixteListeItem[] };
    return { commandes: Array.isArray(body.commandes) ? body.commandes : [] };
}

export async function getLignesNeufsBornes(commandeId: string): Promise<{ lignes: LigneNeufBornes[] }> {
    const r = await apiGet<BornesResponseBody>(
        `/api/librairie-network/commandes/${encodeURIComponent(commandeId)}/lignes-neufs/bornes`
    );
    if (!r.success || r.data == null) {
        throw new Error((r as { error?: string }).error || 'Erreur réseau');
    }
    const body = r.data as BornesResponseBody;
    return { lignes: Array.isArray(body.lignes) ? body.lignes : [] };
}

export async function patchLigneNeufPrix(commandeId: string, ligneId: string, prix_final: number): Promise<void> {
    const r = await apiPatch<{ success?: boolean; ligne_id?: string; prix_final?: number }>(
        `/api/librairie-network/commandes/${encodeURIComponent(commandeId)}/lignes-neufs/${encodeURIComponent(ligneId)}/prix`,
        { prix_final }
    );
    if (!r.success) {
        throw new Error((r as { error?: string }).error || 'Enregistrement refusé');
    }
}

export type ValiderLignesResponse = {
    success?: boolean;
    message?: string;
    statut_validation?: string;
    livres_valides?: number;
};

/** POST /api/librairie-network/validation/valider — panier partiel multi-librairies. */
export async function postValiderLignesCommande(
    commandeId: string,
    payload: {
        livres_valides: string[];
        livres_indisponibles: string[];
        notes_validation?: string;
    }
): Promise<ValiderLignesResponse> {
    const r = await apiPost<ValiderLignesResponse>('/api/librairie-network/validation/valider', {
        commande_id: commandeId,
        livres_valides: payload.livres_valides,
        livres_indisponibles: payload.livres_indisponibles,
        notes_validation: payload.notes_validation?.trim() || undefined,
    });
    if (!r.success) {
        throw new Error((r as { error?: string }).error || 'Validation refusée');
    }
    return (r.data ?? {}) as ValiderLignesResponse;
}
