// ✅ Service API pour Décoration d'Intérieur
import { apiGet, apiPost } from './api';

export interface DecorationProject {
    id: number;
    service_id: number;
    nom_projet: string;
    description?: string;
    type_projet: string;
    style?: string;
    budget_estime?: number;
    ville?: string;
    quartier?: string;
    portfolio?: any;
}

export interface DecorationSuggestions {
    style: string;
    color_palette: string[];
    furniture_suggestions: string[];
    decoration_items: string[];
    layout_suggestions: string;
    budget_breakdown: any;
    reasoning: string;
}

export const decorationService = {
    // ✅ Recherche de décorateurs
    searchDecorators: async (filters: any) => {
        const response = await apiGet<{ success: boolean; data: DecorationProject[] }>(
            '/api/decoration/decorateurs',
            filters
        );
        return response;
    },

    // ✅ Portfolio d'un décorateur
    getPortfolio: async (decoratorId: number) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/decoration/decorateurs/${decoratorId}/portfolio`
        );
        return response;
    },

    // ✅ Réserver une consultation
    bookConsultation: async (projectId: number, typeConsultation: string, date: string) => {
        const response = await apiPost<{ success: boolean; data: { id: number } }>(
            `/api/decoration/projects/${projectId}/book-consultation`,
            {
                type_consultation: typeConsultation,
                date_consultation: date,
            }
        );
        return response;
    },

    // ✅ Suggestions décoration IA
    getAISuggestions: async (
        style: string,
        budget: number,
        superficieM2: number,
        nbPieces: number,
        pieces: string[],
        preferences?: any
    ) => {
        const response = await apiPost<{ success: boolean; suggestions: DecorationSuggestions }>(
            '/api/decoration/ai/suggestions',
            {
                style,
                budget,
                superficie_m2: superficieM2,
                nb_pieces: nbPieces,
                pieces,
                preferences,
            }
        );
        return response;
    },

    // ✅ Visualisation 3D IA
    visualize3D: async (description: string, style: string, pieces: string[], dimensions?: any) => {
        const response = await apiPost<{ success: boolean; visualization: any }>(
            '/api/decoration/ai/visualize',
            {
                description,
                style,
                pieces,
                dimensions,
            }
        );
        return response;
    },

    // ✅ Mes projets
    getMyProjects: async () => {
        const response = await apiGet<{ success: boolean; data: DecorationProject[] }>(
            '/api/decoration/my-projects'
        );
        return response;
    },
};

