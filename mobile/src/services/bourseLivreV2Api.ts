// ✅ Service API V2 pour Bourse du Livre - Sessions, Recto-Verso, Paquets, Dons

import { apiGet, apiPatch, apiPost } from './api';

// ============================================================================
// TYPES
// ============================================================================

export interface UploadSession {
    id: string;
    user_id: number;
    total_livres: number;
    livres_analyses: number;
    livres_acceptes: number;
    livres_rejetes: number;
    recap_par_classe: Record<string, any>;
    valeur_totale: number;
    devise: string;
    gps_recuperation: string;
    adresse_recuperation?: string;
    mode_listing_defaut: string;
    statut: string;
    created_at: string;
    updated_at: string;
}

export interface RectoVersoAnalysis {
    titre?: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe_actuelle?: string;
    classe_souhaitee?: string;
    matiere?: string;
    niveau?: string;
    prix_detecte?: number;
    devise_detectee?: string;
    etat_classification: string; // 'bon', 'acceptable', 'rejete'
    etat_description: string;
    est_au_programme?: boolean;
    programme_scolaire_id?: number;
    programme_match_details?: string;
    confidence: number;
    notes?: string;
}

export interface AnalyzedBook {
    livre: any; // LivreScolaire
    analysis: RectoVersoAnalysis;
    valeur_calculee: number;
    ratio_etat: number;
    etat_classification: string;
    is_rejected: boolean;
}

export interface BookDeliveryPackage {
    id: number;
    reference: string;
    destinataire_id: number;
    destinataire_gps?: string;
    destinataire_adresse?: string;
    expediteur_id: number;
    expediteur_gps?: string;
    expediteur_adresse?: string;
    livres: Array<{ livre_id: number; titre: string; valeur: number; mode: string }>;
    nombre_livres: number;
    valeur_totale: number;
    commission_app: number;
    frais_livraison: number;
    montant_net_a_payer: number;
    devise: string;
    statut: string;
    created_at: string;
    // Phase 3: Delivery bridge
    delivery_uuid?: string;
    matching_status?: string;
    coursier_id?: number;
    // Disponibilité
    creneau_expediteur_debut?: string;
    creneau_expediteur_fin?: string;
    expediteur_instructions?: string;
    creneau_destinataire_debut?: string;
    creneau_destinataire_fin?: string;
    destinataire_instructions?: string;
    // Itinéraire et tracking
    itineraire?: Array<{
        type: 'pickup' | 'dropoff';
        gps: string;
        adresse?: string;
        user_id: number;
        ordre: number;
        instructions?: string;
    }>;
    eta_minutes?: number;
    distance_totale_metres?: number;
    coursier_gps_actuel?: string;
    coursier_gps_updated_at?: string;
}

export interface ProgrammeScolaire {
    id: number;
    pays: string;
    systeme_educatif: string;
    niveau: string;
    classe: string;
    matiere: string;
    titre_livre: string;
    auteur_livre?: string;
    editeur_livre?: string;
    isbn_livre?: string;
    annee_scolaire?: string;
    est_obligatoire: boolean;
    prix_officiel?: number;
    // V2 Phase 2
    fichier_url?: string;
    fichier_type?: string;
    fichier_nom?: string;
    periode_academique?: string;
    extraction_status?: string;
    livres_extraits?: any[];
    nombre_livres_extraits?: number;
}

export interface ProgrammeExtractionResult {
    livres: Array<{
        titre: string;
        auteur?: string;
        editeur?: string;
        isbn?: string;
        classe?: string;
        matiere?: string;
        prix_officiel?: number;
        est_obligatoire?: boolean;
    }>;
    nombre_total: number;
    classes_couvertes: string[];
    matieres_couvertes: string[];
    notes?: string;
    confidence: number;
}

export interface ProgrammeMatchResult {
    matched: boolean;
    programme_scolaire_id?: number;
    periode_academique_detectee?: string;
    score_match: number;
    titre_programme?: string;
    est_obligatoire?: boolean;
    prix_officiel?: number;
    reasoning: string;
    alternatives: any[];
}

export interface BookPurchase {
    id: number;
    acheteur_id: number;
    livre_id: number;
    vendeur_id?: number;
    prix_achat: number;
    commission_app?: number;
    montant_vendeur?: number;
    frais_livraison?: number;
    montant_total?: number;
    devise?: string;
    package_id?: number;
    mode_livraison?: string;
    adresse_livraison?: string;
    gps_livraison?: string;
    paiement_statut?: string;
    paiement_reference?: string;
    paiement_methode?: string;
    statut: string;
    created_at: string;
    updated_at: string;
}

export interface PurchaseBreakdown {
    prix_livre: number;
    commission_app: number;
    montant_vendeur: number;
    frais_livraison: number;
    montant_total: number;
    devise: string;
}

export interface DonationRequest {
    id: number;
    demandeur_id: number;
    livre_id: number;
    motif: string;
    justificatif_url?: string;
    est_verifie: boolean;
    statut: string;
    created_at: string;
}

export interface NetCalculation {
    valeur_livres_recus: number;
    valeur_livres_donnes: number;
    commission: number;
    frais_livraison: number;
    montant_net_a_payer: number;
    devise: string;
    detail: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export const bourseLivreV2Api = {

    // ============================
    // SESSIONS D'UPLOAD
    // ============================

    createSession: async (gps_recuperation: string, adresse?: string, mode?: string): Promise<UploadSession> => {
        const response = await apiPost<{ success: boolean; session: UploadSession }>(
            '/api/bourse-livre/v2/sessions',
            { gps_recuperation, adresse_recuperation: adresse, mode_listing_defaut: mode || 'troc' }
        );
        const r = response.data as any;
        return r?.session || r;
    },

    getSession: async (sessionId: string): Promise<{ session: UploadSession; livres: any[] }> => {
        const response = await apiGet<{ success: boolean; session: UploadSession; livres: any[] }>(
            `/api/bourse-livre/v2/sessions/${sessionId}`
        );
        const r = response.data as any;
        return { session: r?.session, livres: r?.livres || [] };
    },

    finalizeSession: async (sessionId: string, livresModes: Array<{ livre_id: number; mode_listing: string }>): Promise<void> => {
        await apiPost(
            `/api/bourse-livre/v2/sessions/${sessionId}/finalize`,
            { livres_modes: livresModes }
        );
    },

    // ============================
    // ANALYSE RECTO-VERSO
    // ============================

    analyzeRectoVerso: async (
        imageRecto: string,
        imageVerso: string,
        sessionId: string,
        userLat?: number,
        userLng?: number
    ): Promise<AnalyzedBook> => {
        const rectoUri = imageRecto.startsWith('data:') ? imageRecto : `data:image/jpeg;base64,${imageRecto}`;
        const versoUri = imageVerso.startsWith('data:') ? imageVerso : `data:image/jpeg;base64,${imageVerso}`;

        const response = await apiPost<{ success: boolean } & AnalyzedBook>(
            '/api/bourse-livre/v2/analyze-recto-verso',
            {
                image_recto: rectoUri,
                image_verso: versoUri,
                session_id: sessionId,
                user_lat: userLat,
                user_lng: userLng,
            }
        );
        const r = response.data as any;
        return {
            livre: r?.livre,
            analysis: r?.analysis,
            valeur_calculee: r?.valeur_calculee || 0,
            ratio_etat: r?.ratio_etat || 0,
            etat_classification: r?.etat_classification || 'acceptable',
            is_rejected: r?.is_rejected || false,
        };
    },

    // ============================
    // PROGRAMMES SCOLAIRES
    // ============================

    getProgrammes: async (classe?: string, matiere?: string, niveau?: string): Promise<ProgrammeScolaire[]> => {
        const params: any = {};
        if (classe) params.classe = classe;
        if (matiere) params.matiere = matiere;
        if (niveau) params.niveau = niveau;

        const response = await apiGet<{ success: boolean; programmes: ProgrammeScolaire[] }>(
            '/api/bourse-livre/v2/programmes',
            { params }
        );
        const r = response.data as any;
        return r?.programmes || [];
    },

    // ============================
    // PAQUETS LIVRAISON
    // ============================

    createPackage: async (
        destinataireId: number,
        livreIds: number[],
        destinataireGps?: string,
        destinataireAdresse?: string,
        expediteurGps?: string,
        expediteurAdresse?: string,
        trocIds?: number[]
    ): Promise<BookDeliveryPackage> => {
        const response = await apiPost<{ success: boolean; package: BookDeliveryPackage }>(
            '/api/bourse-livre/v2/packages',
            {
                destinataire_id: destinataireId,
                livre_ids: livreIds,
                destinataire_gps: destinataireGps,
                destinataire_adresse: destinataireAdresse,
                expediteur_gps: expediteurGps,
                expediteur_adresse: expediteurAdresse,
                troc_ids: trocIds,
            }
        );
        const r = response.data as any;
        return r?.package || r;
    },

    getMyPackages: async (): Promise<BookDeliveryPackage[]> => {
        const response = await apiGet<{ success: boolean; packages: BookDeliveryPackage[] }>(
            '/api/bourse-livre/v2/packages/my'
        );
        const r = response.data as any;
        return r?.packages || [];
    },

    getCourierPackages: async (): Promise<BookDeliveryPackage[]> => {
        const response = await apiGet<{ success: boolean; packages: BookDeliveryPackage[] }>(
            '/api/bourse-livre/v2/packages/courier'
        );
        const r = response.data as any;
        return r?.packages || [];
    },

    updatePackageStatus: async (packageId: number, statut: string): Promise<BookDeliveryPackage> => {
        const response = await apiPatch<{ success: boolean; package: BookDeliveryPackage }>(
            `/api/bourse-livre/v2/packages/${packageId}/status`,
            { statut }
        );
        const r = response.data as any;
        return r?.package || r;
    },

    // ============================
    // DONS
    // ============================

    requestDonation: async (livreId: number, motif: string, justificatifUrl?: string): Promise<DonationRequest> => {
        const response = await apiPost<{ success: boolean; donation_request: DonationRequest }>(
            '/api/bourse-livre/v2/donations/request',
            { livre_id: livreId, motif, justificatif_url: justificatifUrl }
        );
        const r = response.data as any;
        return r?.donation_request || r;
    },

    getMyDonationRequests: async (): Promise<DonationRequest[]> => {
        const response = await apiGet<{ success: boolean; donation_requests: DonationRequest[] }>(
            '/api/bourse-livre/v2/donations/my'
        );
        const r = response.data as any;
        return r?.donation_requests || [];
    },

    // ============================
    // CALCUL NET
    // ============================

    calculateNet: async (
        livresRecusIds: number[],
        livresDonnesIds: number[],
        fraisLivraison?: number
    ): Promise<NetCalculation> => {
        const response = await apiPost<{ success: boolean } & NetCalculation>(
            '/api/bourse-livre/v2/calculate-net',
            {
                livres_recus_ids: livresRecusIds,
                livres_donnes_ids: livresDonnesIds,
                frais_livraison: fraisLivraison,
            }
        );
        const r = response.data as any;
        return {
            valeur_livres_recus: r?.valeur_livres_recus || 0,
            valeur_livres_donnes: r?.valeur_livres_donnes || 0,
            commission: r?.commission || 0,
            frais_livraison: r?.frais_livraison || 0,
            montant_net_a_payer: r?.montant_net_a_payer || 0,
            devise: r?.devise || 'XAF',
            detail: r?.detail || '',
        };
    },

    // ============================
    // UPLOAD FICHIER PROGRAMME (Admin)
    // ============================

    uploadProgrammeFile: async (params: {
        niveau: string;
        periode_academique: string;
        fichier_base64: string;
        fichier_nom: string;
        fichier_type: 'pdf' | 'excel' | 'image';
        pays?: string;
        systeme_educatif?: string;
        classe?: string;
        date_debut_validite?: string;
        date_fin_validite?: string;
    }): Promise<{ programme_id: number; extraction: ProgrammeExtractionResult | null; message: string }> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/admin/programmes/upload',
            params
        );
        const r = response.data as any;
        return {
            programme_id: r?.programme_id || 0,
            extraction: r?.extraction || null,
            message: r?.message || '',
        };
    },

    // ============================
    // MATCHING IA LIVRE ↔ PROGRAMME
    // ============================

    matchLivreProgramme: async (livreId: number, dateTroc?: string): Promise<{
        matching: ProgrammeMatchResult;
        livre_id: number;
        date_troc: string;
    }> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/match-programme',
            { livre_id: livreId, date_troc: dateTroc }
        );
        const r = response.data as any;
        return {
            matching: r?.matching || { matched: false, score_match: 0, reasoning: '', alternatives: [] },
            livre_id: r?.livre_id || livreId,
            date_troc: r?.date_troc || '',
        };
    },

    // ============================
    // ACHATS DIRECTS (sans échange)
    // ============================

    createPurchase: async (params: {
        livre_id: number;
        adresse_livraison?: string;
        gps_livraison?: string;
        mode_livraison?: string;
        paiement_methode?: string;
    }): Promise<{ purchase: BookPurchase; breakdown: PurchaseBreakdown }> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/purchases',
            params
        );
        const r = response.data as any;
        return {
            purchase: r?.purchase,
            breakdown: r?.breakdown || {},
        };
    },

    getMyPurchases: async (): Promise<BookPurchase[]> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/purchases/my');
        const r = response.data as any;
        return r?.purchases || [];
    },

    updatePurchaseStatus: async (
        purchaseId: number,
        statut: string,
        paiementReference?: string
    ): Promise<BookPurchase> => {
        const response = await apiPatch<any>(
            `/api/bourse-livre/v2/purchases/${purchaseId}/status`,
            { statut, paiement_reference: paiementReference }
        );
        const r = response.data as any;
        return r?.purchase || r;
    },

    // ============================
    // PAQUET DÉPÔT-SEULEMENT
    // ============================

    createDepotOnlyPackage: async (params: {
        purchase_id: number;
        gps_depot: string;
        adresse_depot?: string;
        notes_coursier?: string;
    }): Promise<BookDeliveryPackage> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/packages/depot-only',
            params
        );
        const r = response.data as any;
        return r?.package || r;
    },

    // ============================
    // PHASE 3: DISPATCH & MATCHING COURSIER
    // ============================

    dispatchPackage: async (packageId: number): Promise<{
        delivery_uuid: string;
        matching_status: string;
        itineraire: any[];
        eta_minutes: number;
        distance_metres: number;
        frais_livraison: number;
    }> => {
        const response = await apiPost<any>(
            `/api/bourse-livre/v2/packages/${packageId}/dispatch`,
            {}
        );
        const r = response.data as any;
        return {
            delivery_uuid: r?.delivery_uuid || '',
            matching_status: r?.matching_status || 'pending',
            itineraire: r?.itineraire || [],
            eta_minutes: r?.eta_minutes || 0,
            distance_metres: r?.distance_metres || 0,
            frais_livraison: r?.frais_livraison || 0,
        };
    },

    updateAvailability: async (packageId: number, params: {
        role: 'expediteur' | 'destinataire';
        creneau_debut?: string;
        creneau_fin?: string;
        instructions?: string;
    }): Promise<void> => {
        await apiPatch(
            `/api/bourse-livre/v2/packages/${packageId}/availability`,
            params
        );
    },

    // ============================
    // PHASE 3: DASHBOARDS
    // ============================

    getCourierBookDashboard: async (): Promise<{
        mes_paquets: BookDeliveryPackage[];
        paquets_disponibles: BookDeliveryPackage[];
        stats: {
            actifs: number;
            completes: number;
            livres: number;
            gains_totaux_xaf: number;
        };
    }> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/courier/dashboard');
        const r = response.data as any;
        return {
            mes_paquets: r?.mes_paquets || [],
            paquets_disponibles: r?.paquets_disponibles || [],
            stats: r?.stats || { actifs: 0, completes: 0, livres: 0, gains_totaux_xaf: 0 },
        };
    },

    courierAcceptPackage: async (packageId: number): Promise<BookDeliveryPackage> => {
        const response = await apiPost<any>(
            `/api/bourse-livre/v2/courier/accept/${packageId}`,
            {}
        );
        const r = response.data as any;
        return r?.package || r;
    },

    getUserBookDashboard: async (): Promise<{
        paquets_a_envoyer: BookDeliveryPackage[];
        paquets_a_recevoir: BookDeliveryPackage[];
        achats_en_cours: BookPurchase[];
        historique: BookDeliveryPackage[];
        stats: {
            total_envoyes: number;
            total_recus: number;
            en_cours_envoi: number;
            en_cours_reception: number;
        };
    }> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/user/book-dashboard');
        const r = response.data as any;
        return {
            paquets_a_envoyer: r?.paquets_a_envoyer || [],
            paquets_a_recevoir: r?.paquets_a_recevoir || [],
            achats_en_cours: r?.achats_en_cours || [],
            historique: r?.historique || [],
            stats: r?.stats || { total_envoyes: 0, total_recus: 0, en_cours_envoi: 0, en_cours_reception: 0 },
        };
    },
};
