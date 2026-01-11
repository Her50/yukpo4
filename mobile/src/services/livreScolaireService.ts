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
            '/api/livres-scolaires/search',
            { params: filters }
        );
        return response;
    },

    // ✅ Obtenir les détails d'un livre
    getLivreDetails: async (livreId: number) => {
        const response = await apiGet<{ success: boolean; livre: LivreScolaire }>(
            `/api/livres-scolaires/${livreId}`
        );
        return response;
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
        return response;
    },

    // ✅ Créer un livre scolaire
    createLivre: async (livre: CreateLivreRequest) => {
        const response = await apiPost<{ success: boolean; livre: LivreScolaire }>(
            '/api/livres-scolaires',
            livre
        );
        return response;
    },

    // ✅ Obtenir mes livres
    getMesLivres: async () => {
        const response = await apiGet<{ success: boolean; livres: LivreScolaire[] }>(
            '/api/livres-scolaires/mes-livres'
        );
        return response;
    },
};

