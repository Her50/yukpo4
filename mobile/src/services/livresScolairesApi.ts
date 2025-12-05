// ✅ Service API TypeScript pour Livres Scolaires

import { apiDelete, apiGet, apiPost, apiPut } from './api';

// Types
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
    images_urls: string[];
    video_url?: string;
    gps?: string;
    ville?: string;
    quartier?: string;
    is_available: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    distance_km?: number;
}

export interface CreateLivreScolaireRequest {
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

export interface UpdateLivreScolaireRequest {
    titre?: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe_actuelle?: string;
    classe_souhaitee?: string;
    matiere?: string;
    niveau?: string;
    etat_livre?: string;
    description_etat?: string;
    images_urls?: string[];
    video_url?: string;
    gps?: string;
    ville?: string;
    quartier?: string;
    is_available?: boolean;
    is_active?: boolean;
}

export interface SearchLivresScolairesRequest {
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
    search?: string;
    limit?: number;
    offset?: number;
}

export interface LivreScolaireWithDistance extends LivreScolaire {
    distance_km?: number;
}

// API Functions
export const livresScolairesApi = {
    // Rechercher des livres
    search: async (params: SearchLivresScolairesRequest): Promise<LivreScolaireWithDistance[]> => {
        const response = await apiGet<{ livres: LivreScolaireWithDistance[] }>(
            '/api/livres-scolaires/search',
            { params }
        );
        return response.livres || response.data?.livres || [];
    },

    // Obtenir les détails d'un livre
    getDetails: async (id: number): Promise<LivreScolaire> => {
        const response = await apiGet<{ livre: LivreScolaire }>(
            `/api/livres-scolaires/${id}`
        );
        return response.livre || response.data?.livre || response;
    },

    // Créer un livre
    create: async (data: CreateLivreScolaireRequest): Promise<LivreScolaire> => {
        const response = await apiPost<{ livre: LivreScolaire }>(
            '/api/livres-scolaires',
            data
        );
        return response.livre || response.data?.livre || response;
    },

    // Mettre à jour un livre
    update: async (id: number, data: UpdateLivreScolaireRequest): Promise<LivreScolaire> => {
        const response = await apiPut<{ livre: LivreScolaire }>(
            `/api/livres-scolaires/${id}`,
            data
        );
        return response.livre || response.data?.livre || response;
    },

    // Supprimer un livre
    delete: async (id: number): Promise<void> => {
        await apiDelete(`/api/livres-scolaires/${id}`);
    },

    // Obtenir mes livres
    getMyLivres: async (): Promise<LivreScolaire[]> => {
        const response = await apiGet<{ livres: LivreScolaire[] }>(
            '/api/livres-scolaires/mes-livres'
        );
        return response.livres || response.data?.livres || [];
    },

    // Mettre à jour la disponibilité
    updateAvailability: async (id: number, is_available: boolean): Promise<LivreScolaire> => {
        const response = await apiPost<{ livre: LivreScolaire }>(
            `/api/livres-scolaires/${id}/availability`,
            { is_available }
        );
        return response.livre || response.data?.livre || response;
    },
};

