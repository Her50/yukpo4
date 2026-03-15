// ✅ Service API pour Livres Scolaires avec fonctionnalités IA
import { apiGet, apiPost } from './api';

// Types pour les livres scolaires
export interface LivreScolaire {
    id: number;
    service_id?: number;
    user_id: number;
    titre: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    description_etat?: string;
    images_urls?: string[];
    video_url?: string;
    gps?: string;
    ville?: string;
    quartier?: string;
    is_available: boolean;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    distance_km?: number;
    // V2 fields
    image_recto?: string;
    image_verso?: string;
    mode_listing?: string; // 'troc', 'vente', 'don'
    prix_detecte?: number;
    devise_detectee?: string;
    valeur_calculee?: number;
    ratio_etat?: number;
    etat_classification?: string; // 'bon', 'acceptable', 'rejete'
    programme_scolaire_id?: number;
    est_au_programme?: boolean;
    programme_match_details?: any;
    ia_analysis_status?: string;
    ia_analysis_result?: any;
    ia_confidence?: number;
    situation_troc?: string;
    offre_matchee?: boolean;
    upload_session_id?: string;
}

export interface BookImageAnalysis {
    titre: string;
    auteur?: string | null;
    editeur?: string | null;
    isbn?: string | null;
    classe_actuelle?: string | null;
    classe_souhaitee?: string | null;
    matiere?: string | null;
    niveau?: string | null;
    etat_livre: string;
    description_etat?: string;
    confidence: number;
    notes?: string;
}

export interface SearchLivresFilters {
    classe_actuelle?: string;
    classe_souhaitee?: string;
    matiere?: string;
    niveau?: string;
    etat_livre?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    limit?: number;
    offset?: number;
    // V2 filters
    mode_listing?: string;
    etat_classification?: string;
}

export interface CreateLivreRequest {
    service_id?: number;
    titre: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    description_etat?: string;
    images_urls?: string[];
    video_url?: string;
    gps?: string;
    ville?: string;
    quartier?: string;
}

export const livreScolaireService = {
    // ✅ Rechercher des livres scolaires
    searchLivres: async (filters: SearchLivresFilters) => {
        const response = await apiGet<{ success: boolean; livres: Array<{ livre: LivreScolaire; distance_km?: number }> }>(
            '/api/bourse-livre/search',
            { params: filters }
        );
        const r = response.data as any;
        return r || response;
    },

    // ✅ Obtenir les détails d'un livre
    getLivreDetails: async (livreId: number) => {
        const response = await apiGet<{ success: boolean; livre: LivreScolaire }>(
            `/api/bourse-livre/${livreId}`
        );
        const r = response.data as any;
        return r || response;
    },

    // ✅ Analyser une image de livre avec IA
    analyzeBookImage: async (imageBase64: string, userLat?: number, userLng?: number) => {
        // ✅ S'assurer que l'image est au format data URI
        const imageUri = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`;

        const response = await apiPost<{ success: boolean; book_info: BookImageAnalysis; image_uri: string }>(
            '/api/bourse-livre/ai/analyze-image',
            {
                image_uri: imageUri,
                user_lat: userLat,
                user_lng: userLng,
            }
        );
        const r = response.data as any;
        return r || response;
    },

    // ✅ Créer un livre scolaire
    createLivre: async (livre: CreateLivreRequest) => {
        const response = await apiPost<{ success: boolean; livre: LivreScolaire }>(
            '/api/bourse-livre',
            livre
        );
        const r = response.data as any;
        return r || response;
    },

    // ✅ Obtenir mes livres
    getMesLivres: async () => {
        const response = await apiGet<{ success: boolean; livres: LivreScolaire[] }>(
            '/api/bourse-livre/mes-livres'
        );
        const r = response.data as any;
        return r || response;
    },
};

