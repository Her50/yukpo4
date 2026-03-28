import { apiGet, apiPatch } from './api';

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
