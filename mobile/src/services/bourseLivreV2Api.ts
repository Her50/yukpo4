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
    livres: Array<{
        livre_id: number;
        titre: string;
        valeur: number;
        mode: string;
        matiere?: string;
        type_article?: string;
    }>;
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
    librairie_lieu_id?: number;
    succursale_label?: string;
    stock_disponible_succursale?: boolean;
    claimed_by_librairie_id?: number;
    claimed_by_user_id?: number;
    claimed_at?: string;
    released_at?: string;
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
    devise?: string;
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
    librairie_lieu_id?: number;
    succursale_label?: string;
    stock_disponible_succursale?: boolean;
    claimed_by_librairie_id?: number;
    claimed_by_user_id?: number;
    claimed_at?: string;
    released_at?: string;
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

export interface NewBookListing {
    id: number;
    titre: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe: string;
    matiere: string;
    niveau?: string;
    prix_neuf: number;
    devise?: string;
    image?: string;
    ville?: string;
    est_au_programme?: boolean;
    libraire_nom?: string;
    mode: 'neuf';
}

export interface PriceComparison {
    classe: string;
    matiere?: string;
    neufs: Array<{
        titre: string;
        matiere: string;
        prix: number;
        source: 'neuf';
        editeur?: string;
        auteur?: string;
        est_au_programme?: boolean;
        ville?: string;
    }>;
    occasions: Array<{
        titre: string;
        matiere: string;
        prix: number;
        source: string;
        etat?: string;
        etat_classification?: string;
        auteur?: string;
        ville?: string;
    }>;
    programme_officiel: Array<{
        titre: string;
        matiere: string;
        prix_officiel?: number;
        source: 'programme';
        editeur?: string;
        auteur?: string;
        est_obligatoire?: boolean;
    }>;
    resume: {
        total_neufs: number;
        total_occasions: number;
        total_programme: number;
    };
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
        const analysis = r?.analysis || r?.data?.analysis || {};
        const livre = r?.livre || r?.data?.livre;

        const rawEtat = String(
            r?.etat_classification ??
            analysis?.etat_classification ??
            livre?.etat_livre ??
            ''
        ).toLowerCase();
        const normalizedEtat = rawEtat.includes('rej') ? 'rejete' : rawEtat.includes('bon') ? 'bon' : 'acceptable';

        const isRejected = Boolean(r?.is_rejected ?? r?.rejete ?? analysis?.is_rejected ?? normalizedEtat === 'rejete');
        const detectedPrice = Number(
            analysis?.prix_detecte ??
            analysis?.prix_estime ??
            livre?.prix_reference ??
            livre?.prix_neuf ??
            0
        );
        const ETAT_RATIO: Record<string, number> = {
            bon: 0.7,
            acceptable: 0.40,
            rejete: 0,
        };
        const businessRatio = ETAT_RATIO[normalizedEtat] ?? 0;
        const ratioEtat = businessRatio;

        const backendValue = Number(
            r?.valeur_calculee ??
            analysis?.valeur_calculee ??
            livre?.valeur_calculee ??
            0
        );
        const strictCalculatedValue = detectedPrice > 0 ? Math.round(detectedPrice * businessRatio) : 0;
        const safeValue = isRejected
            ? 0
            : strictCalculatedValue > 0
                ? strictCalculatedValue
                : Math.max(Math.round(backendValue), 0);

        return {
            livre,
            analysis,
            valeur_calculee: safeValue,
            ratio_etat: ratioEtat,
            etat_classification: normalizedEtat,
            is_rejected: isRejected,
        };
    },

    // ============================
    // PROGRAMMES SCOLAIRES
    // ============================

    getProgrammes: async (
        classe?: string,
        matiere?: string,
        niveau?: string,
        options?: { pays?: string; etablissementId?: number; nationalOnly?: boolean }
    ): Promise<ProgrammeScolaire[]> => {
        const params: Record<string, string | number | boolean> = {};
        if (classe) params.classe = classe;
        if (matiere) params.matiere = matiere;
        if (niveau) params.niveau = niveau;
        if (options?.pays) params.pays = options.pays;
        if (options?.etablissementId != null) params.etablissement_id = options.etablissementId;
        if (options?.nationalOnly === true) params.national_only = true;

        const response = await apiGet<{ success: boolean; programmes: ProgrammeScolaire[] }>(
            '/api/bourse-livre/v2/programmes',
            { params }
        );
        const r = response.data as any;
        return r?.programmes || [];
    },

    getLibrairieProgrammesSynthese: async (params?: {
        rayon_km?: number;
        limit?: number;
    }): Promise<{
        synthese: Array<{
            titre_livre: string;
            matiere: string;
            classe: string;
            niveau?: string;
            periode?: string;
            occurrences: number;
            distance_km_min?: number;
            etablissements_count: number;
            plusieurs_etablissements: boolean;
            etablissements_a_afficher: string[];
            etablissements_resume: string;
        }>;
        meta?: { rayon_km: number; librairie_gps_detecte: boolean };
    }> => {
        const response = await apiGet<any>(
            '/api/bourse-livre/v2/libraire/programmes/synthese',
            { params }
        );
        const r = response.data as any;
        return {
            synthese: r?.synthese || [],
            meta: r?.meta,
        };
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
    // SUGGESTIONS INTELLIGENTES
    // ============================

    getSmartSuggestions: async (
        classe?: string,
        matiere?: string,
        query?: string,
    ): Promise<{
        classes_disponibles: string[];
        matieres_disponibles?: { matiere: string; count: number; troc: number; vente: number; don: number }[];
        total_livres_classe?: number;
        top_livres?: any[];
    }> => {
        const params = new URLSearchParams();
        if (classe) params.append('classe', classe);
        if (matiere) params.append('matiere', matiere);
        if (query) params.append('query', query);
        const response = await apiGet<any>(
            `/api/bourse-livre/v2/suggestions?${params.toString()}`
        );
        const r = response.data as any;
        return {
            classes_disponibles: r?.classes_disponibles || [],
            matieres_disponibles: r?.matieres_disponibles || [],
            total_livres_classe: r?.total_livres_classe,
            top_livres: r?.top_livres || [],
        };
    },

    // ============================
    // BROWSE PAR CLASSE (recherche multi-besoins)
    // ============================

    browseByClass: async (
        classe?: string,
        matiere?: string,
        niveau?: string,
        modeListing?: string,
        ville?: string,
        search?: string,
        limit?: number,
    ): Promise<any[]> => {
        const params = new URLSearchParams();
        if (classe) params.append('classe', classe);
        if (matiere) params.append('matiere', matiere);
        if (niveau) params.append('niveau', niveau);
        if (modeListing) params.append('mode_listing', modeListing);
        if (ville) params.append('ville', ville);
        if (search) params.append('search', search);
        if (limit) params.append('limit', String(limit));
        const response = await apiGet<any>(
            `/api/bourse-livre/v2/browse-by-class?${params.toString()}`
        );
        const r = response.data as any;
        return r?.livres || r?.data || [];
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

    // ============================
    // LIVRES NEUFS — Catalogue & Comparaison
    // ============================

    browseNewBooks: async (params?: {
        classe?: string;
        matiere?: string;
        niveau?: string;
        ville?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ livres: NewBookListing[]; total: number }> => {
        const qs = new URLSearchParams();
        if (params?.classe) qs.append('classe', params.classe);
        if (params?.matiere) qs.append('matiere', params.matiere);
        if (params?.niveau) qs.append('niveau', params.niveau);
        if (params?.ville) qs.append('ville', params.ville);
        if (params?.search) qs.append('search', params.search);
        if (params?.limit) qs.append('limit', String(params.limit));
        if (params?.offset) qs.append('offset', String(params.offset));
        const response = await apiGet<any>(
            `/api/bourse-livre/v2/new-books?${qs.toString()}`
        );
        const r = response.data as any;
        return {
            livres: r?.livres || [],
            total: r?.total || 0,
        };
    },

    comparePrices: async (classe: string, matiere?: string): Promise<PriceComparison> => {
        const qs = new URLSearchParams({ classe });
        if (matiere) qs.append('matiere', matiere);
        const response = await apiGet<any>(
            `/api/bourse-livre/v2/compare-prices?${qs.toString()}`
        );
        const r = response.data as any;
        return {
            classe: r?.classe || classe,
            matiere: r?.matiere,
            neufs: r?.neufs || [],
            occasions: r?.occasions || [],
            programme_officiel: r?.programme_officiel || [],
            resume: r?.resume || { total_neufs: 0, total_occasions: 0, total_programme: 0 },
        };
    },

    librairePublish: async (params: {
        livres: Array<{
            programme_scolaire_id?: number;
            titre: string;
            auteur?: string;
            editeur?: string;
            isbn?: string;
            classe: string;
            matiere: string;
            niveau?: string;
            prix: number;
            devise?: string;
            stock?: number;
            image_url?: string;
        }>;
        gps?: string;
        ville?: string;
        quartier?: string;
    }): Promise<{ published: Array<{ id: number; titre: string }>; errors: any[]; total_published: number }> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/libraire/publish',
            params
        );
        const r = response.data as any;
        return {
            published: r?.published || [],
            errors: r?.errors || [],
            total_published: r?.total_published || 0,
        };
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

    // ============================
    // CONSTITUTION INTELLIGENTE DES PAQUETS
    // ============================

    buildIntelligentPackages: async (): Promise<{
        packages_created: BookDeliveryPackage[];
        total_created: number;
    }> => {
        const response = await apiPost<any>('/api/bourse-livre/v2/packages/build-intelligent', {});
        const r = response.data as any;
        return {
            packages_created: r?.packages_created || [],
            total_created: r?.total_created || 0,
        };
    },

    buildAllPendingPackages: async (): Promise<{
        total_users: number;
        total_packages: number;
        results: Array<{ user_id: number; packages_created: number }>;
    }> => {
        const response = await apiPost<any>('/api/bourse-livre/v2/packages/build-all', {});
        const r = response.data as any;
        return {
            total_users: r?.total_users || 0,
            total_packages: r?.total_packages || 0,
            results: r?.results || [],
        };
    },

    validateNeedFulfillment: async (): Promise<{
        packages: any[];
        all_fulfilled: boolean;
    }> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/packages/validate-need');
        const r = response.data as any;
        return {
            packages: r?.packages || [],
            all_fulfilled: r?.all_fulfilled || false,
        };
    },

    computeOptimizedRoute: async (packageIds: number[]): Promise<{
        route: Array<{ ordre: number; gps: string; type: string; user_id: number }>;
        total_distance_metres: number;
        eta_minutes: number;
    }> => {
        const response = await apiPost<any>('/api/bourse-livre/v2/packages/optimized-route', {
            package_ids: packageIds,
        });
        const r = response.data as any;
        return {
            route: r?.route || [],
            total_distance_metres: r?.total_distance_metres || 0,
            eta_minutes: r?.eta_minutes || 0,
        };
    },

    getAllPackagesForUser: async (): Promise<BookDeliveryPackage[]> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/packages/user-packages');
        const r = response.data as any;
        return r?.packages || [];
    },

    getPackageDetailForCourier: async (packageId: number): Promise<{
        package: BookDeliveryPackage;
        livres_enrichis: any[];
    }> => {
        const response = await apiGet<any>(`/api/bourse-livre/v2/packages/${packageId}/detail`);
        const r = response.data as any;
        return {
            package: r?.package,
            livres_enrichis: r?.livres_enrichis || [],
        };
    },

    // ============================
    // CHAÎNES DE TROC (DAG)
    // ============================

    createChainFromMatching: async (params: {
        participants: Array<{ user_id: number; livre_offert_id: number; livre_souhaite_id?: number }>;
    }): Promise<{ chain_id: number; reference: string }> => {
        const response = await apiPost<any>('/api/bourse-livre/v2/chains/create', params);
        const r = response.data as any;
        return {
            chain_id: r?.chain_id || r?.chaine?.id || 0,
            reference: r?.reference || '',
        };
    },

    finalizeChain: async (chainId: number): Promise<{
        packages: BookDeliveryPackage[];
        total_packages: number;
    }> => {
        const response = await apiPost<any>(`/api/bourse-livre/v2/chains/${chainId}/finalize`, {});
        const r = response.data as any;
        return {
            packages: r?.packages || [],
            total_packages: r?.total_packages || 0,
        };
    },

    buildDeliverySchedule: async (chainId: number): Promise<{
        schedule: Array<{ jour: string; user_id: number; type: string; creneau_debut?: string; creneau_fin?: string }>;
    }> => {
        const response = await apiPost<any>(`/api/bourse-livre/v2/chains/${chainId}/schedule`, {});
        const r = response.data as any;
        return {
            schedule: r?.schedule || [],
        };
    },

    getChainDetails: async (chainId: number): Promise<any> => {
        const response = await apiGet<any>(`/api/bourse-livre/v2/chains/${chainId}`);
        const r = response.data as any;
        return r?.chaine || r;
    },

    // ============================
    // ANNULATION TERRAIN + QR CODES
    // ============================

    cancelBookOnSite: async (params: {
        package_id: number;
        livre_id: number;
        raison: string;
    }): Promise<{ credit_amount: number; message: string }> => {
        const response = await apiPost<any>('/api/bourse-livre/v2/packages/cancel-book', params);
        const r = response.data as any;
        return {
            credit_amount: r?.credit_amount || 0,
            message: r?.message || '',
        };
    },

    generatePackageQR: async (packageId: number, qrType: 'pickup' | 'delivery'): Promise<{
        qr_code: string;
        expires_at: string;
    }> => {
        const response = await apiPost<any>(`/api/bourse-livre/v2/packages/${packageId}/qr-generate`, {
            qr_type: qrType,
        });
        const r = response.data as any;
        return r?.qr || { qr_code: '', expires_at: '' };
    },

    validatePackageQR: async (qrCode: string): Promise<{
        valid: boolean;
        package_id?: number;
        message: string;
    }> => {
        const response = await apiPost<any>('/api/bourse-livre/v2/packages/qr-validate', {
            qr_code: qrCode,
        });
        const r = response.data as any;
        return r?.validation || { valid: false, message: '' };
    },

    // ============================
    // ADMIN: GESTION DES DONS
    // ============================

    adminListDonationRequests: async (): Promise<DonationRequest[]> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/admin/donations');
        const r = response.data as any;
        return r?.donation_requests || [];
    },

    adminApproveDonation: async (donationId: number, notes?: string): Promise<DonationRequest> => {
        const response = await apiPost<any>(`/api/bourse-livre/v2/admin/donations/${donationId}/approve`, {
            notes,
        });
        const r = response.data as any;
        return r?.donation_request || r;
    },

    adminRejectDonation: async (donationId: number, notes?: string): Promise<DonationRequest> => {
        const response = await apiPost<any>(`/api/bourse-livre/v2/admin/donations/${donationId}/reject`, {
            notes,
        });
        const r = response.data as any;
        return r?.donation_request || r;
    },

    // ============================
    // CLASSES AVEC PROGRAMMES
    // ============================

    getClassesWithProgrammes: async (): Promise<Array<{
        classe: string;
        niveau: string;
        total_livres: number;
        total_troc: number;
        total_vente: number;
        total_don: number;
    }>> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/classes-programmes');
        const r = response.data as any;
        return r?.classes || [];
    },

    // ============================
    // ÉQUIPE LIBRAIRE
    // ============================

    inviteTeamMember: async (telephone: string, role: 'manager' | 'preparer' | 'cashier', nom?: string): Promise<any> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/libraire/team/invite',
            { telephone, role, nom }
        );
        const r = response.data as any;
        return r?.member || r;
    },

    listTeamMembers: async (): Promise<{ librairie_id: number; members: any[]; total: number }> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/libraire/team');
        const r = response.data as any;
        return {
            librairie_id: r?.librairie_id || 0,
            members: r?.members || [],
            total: r?.total || 0,
        };
    },

    updateTeamMemberRole: async (memberId: number, role: 'manager' | 'preparer' | 'cashier'): Promise<void> => {
        await apiPatch(`/api/bourse-livre/v2/libraire/team/${memberId}/role`, { role });
    },

    removeTeamMember: async (memberId: number): Promise<void> => {
        const { apiDelete } = await import('./api');
        await apiDelete(`/api/bourse-livre/v2/libraire/team/${memberId}`);
    },

    teamScanCourierQR: async (qrCode: string, packageIds?: number[]): Promise<{
        validation: any;
        scanned_by: { user_id: number; role: string; librairie_id: number };
        packages_updated: number;
    }> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/libraire/team/scan-qr',
            { qr_code: qrCode, package_ids: packageIds }
        );
        const r = response.data as any;
        return {
            validation: r?.validation,
            scanned_by: r?.scanned_by || {},
            packages_updated: r?.packages_updated || 0,
        };
    },

    getTeamPendingPackages: async (): Promise<{
        librairie_id: number;
        packages: { a_constituer: any[]; constitues: any[] };
        purchases_pending: any[];
        lieux: Array<{ id: number; libelle: string; gps?: string; ville?: string; adresse?: string }>;
        stats: { a_constituer: number; prets_pour_coursier: number; achats_a_preparer: number };
    }> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/libraire/team/pending-packages');
        const r = response.data as any;
        return {
            librairie_id: r?.librairie_id || 0,
            packages: r?.packages || { a_constituer: [], constitues: [] },
            purchases_pending: r?.purchases_pending || [],
            lieux: r?.lieux || [],
            stats: r?.stats || { a_constituer: 0, prets_pour_coursier: 0, achats_a_preparer: 0 },
        };
    },

    teamValidateOrder: async (params: {
        package_id?: number;
        purchase_id?: number;
        action: 'en_preparation' | 'constitue' | 'pret' | 'liberer';
        librairie_lieu_id?: number;
        stock_disponible_succursale?: boolean;
    }): Promise<{
        type: string;
        id: number;
        new_status: string;
        validated_by: number;
        role: string;
        librairie_lieu_id?: number;
        succursale_label?: string;
        message?: string;
    }> => {
        const response = await apiPost<any>(
            '/api/bourse-livre/v2/libraire/team/validate-order',
            params
        );
        const r = response.data as any;
        return {
            type: r?.type || '',
            id: r?.id || 0,
            new_status: r?.new_status || '',
            validated_by: r?.validated_by || 0,
            role: r?.role || '',
            librairie_lieu_id: r?.librairie_lieu_id,
            succursale_label: r?.succursale_label,
            message: r?.message,
        };
    },

    teamGetPackageDetail: async (packageId: number): Promise<{
        package: any;
        livres: any[];
        destinataire: any;
        checklist: Array<{ titre: string; matiere: string; classe: string; etat: string; a_verifier: boolean }>;
        instructions: string;
    }> => {
        const response = await apiGet<any>(
            `/api/bourse-livre/v2/libraire/team/package/${packageId}/detail`
        );
        const r = response.data as any;
        return {
            package: r?.package || {},
            livres: r?.livres || [],
            destinataire: r?.destinataire || null,
            checklist: r?.checklist || [],
            instructions: r?.instructions || '',
        };
    },

    // ============================
    // COURSIER: ITINÉRAIRE AVEC QR CONTEXTUEL
    // ============================

    courierGetMyStops: async (): Promise<{
        stops: Array<{
            ordre: number;
            stop_type: 'pickup' | 'delivery';
            action: string;
            user: { id: number; nom: string; telephone: string; photo_url?: string } | null;
            gps: string | null;
            adresse: string | null;
            package_ids: number[];
            package_refs: string[];
            livres_count: number;
            livres: Array<{ titre: string; matiere?: string; valeur?: number; package_ref: string }>;
            qr_code: string;
            qr_code_url: string;
            instruction: string;
        }>;
        total_stops: number;
        total_packages: number;
    }> => {
        const response = await apiGet<any>('/api/bourse-livre/v2/courier/my-stops');
        const r = response.data as any;
        return {
            stops: r?.stops || [],
            total_stops: r?.total_stops || 0,
            total_packages: r?.total_packages || 0,
        };
    },

    // ============================
    // CHANGEMENT DE LIEU (récupération / livraison)
    // ============================

    updateLocation: async (params: {
        package_id?: number;
        purchase_id?: number;
        livre_id?: number;
        gps: string;
        adresse?: string;
    }): Promise<{
        updated_count: number;
        notifications_sent: number;
        new_gps: string;
        new_adresse?: string;
        message: string;
    }> => {
        const response = await apiPatch<any>(
            '/api/bourse-livre/v2/update-location',
            params
        );
        const r = response.data as any;
        return {
            updated_count: r?.updated_count || 0,
            notifications_sent: r?.notifications_sent || 0,
            new_gps: r?.new_gps || params.gps,
            new_adresse: r?.new_adresse,
            message: r?.message || '',
        };
    },
};

// ============================================================================
// SUPER LIBRAIRIE — API ADMIN
// ============================================================================

export const superLibraireApi = {
    // Dashboard commandes (admin ou super libraire)
    getDashboard: async (params?: { limit?: number; offset?: number }): Promise<{
        commandes: any[];
        total: number;
    }> => {
        const { apiGet } = await import('./api');
        const qs = params ? `?limit=${params.limit ?? 50}&offset=${params.offset ?? 0}` : '';
        const response = await apiGet<any>(`/api/librairie-network/super-librairie/commandes${qs}`);
        const r = response.data as any;
        return { commandes: r?.commandes || [], total: r?.total || 0 };
    },

    // Libérer manuellement une commande
    libererCommande: async (commandeId: string, motif?: string, rayonKm?: number): Promise<void> => {
        const { apiPost } = await import('./api');
        await apiPost(`/api/librairie-network/super-librairie/liberer/${commandeId}`, {
            motif,
            rayon_km: rayonKm,
        });
    },

    // Liste des membres de l'équipe
    listTeam: async (): Promise<{ librairie_id: string; members: any[]; total: number }> => {
        const { apiGet } = await import('./api');
        const response = await apiGet<any>('/api/librairie-network/super-librairie/team');
        const r = response.data as any;
        return { librairie_id: r?.librairie_id || '', members: r?.members || [], total: r?.total || 0 };
    },

    // Inviter un membre
    inviteTeam: async (telephone: string, role: 'manager' | 'preparer' | 'cashier', nom?: string): Promise<any> => {
        const { apiPost } = await import('./api');
        const response = await apiPost<any>('/api/librairie-network/super-librairie/team/invite', {
            telephone, role, nom,
        });
        return (response.data as any);
    },

    // Retirer un membre
    removeTeamMember: async (memberId: number): Promise<void> => {
        const { apiDelete } = await import('./api');
        await apiDelete(`/api/librairie-network/super-librairie/team/${memberId}`);
    },
};
