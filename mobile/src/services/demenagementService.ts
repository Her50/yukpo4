// ✅ Service API pour Déménagement
import { apiGet, apiPost } from './api';

export interface MovingCompany {
    id: number;
    service_id: number;
    nom: string;
    ville?: string;
    telephone?: string;
    whatsapp?: string;
}

export interface MovingQuote {
    id: number;
    service_id: number;
    adresse_depart: string;
    adresse_arrivee: string;
    date_demenagement: string;
    prix_estime?: number;
    status: string;
}

export interface MovingBooking {
    id: number;
    quote_id?: number;
    service_id: number;
    adresse_depart: string;
    adresse_arrivee: string;
    date_demenagement: string;
    prix_final: number;
    status: string;
}

export interface MovingTracking {
    id: number;
    booking_id: number;
    gps: string;
    timestamp: string;
    etape?: string;
}

export const demenagementService = {
    // ✅ Recherche d'entreprises déménagement
    searchCompanies: async (filters: any) => {
        const response = await apiGet<{ success: boolean; data: MovingCompany[] }>(
            '/api/demenagement/entreprises',
            filters
        );
        return response;
    },

    // ✅ Demander un devis
    requestQuote: async (
        serviceId: number,
        adresseDepart: string,
        adresseArrivee: string,
        dateDemenagement: string,
        volumeM3?: number,
        nbPieces?: number,
        servicesAdditionnels?: any
    ) => {
        const response = await apiPost<{ success: boolean; quote: MovingQuote }>(
            '/api/demenagement/quote',
            {
                service_id: serviceId,
                adresse_depart: adresseDepart,
                adresse_arrivee: adresseArrivee,
                date_demenagement: dateDemenagement,
                volume_m3: volumeM3,
                nb_pieces: nbPieces,
                services_additionnels: servicesAdditionnels,
            }
        );
        return response;
    },

    // ✅ Réserver un déménagement
    bookMoving: async (
        quoteId: number | null,
        serviceId: number,
        adresseDepart: string,
        adresseArrivee: string,
        dateDemenagement: string,
        prixFinal: number
    ) => {
        const response = await apiPost<{ success: boolean; booking: MovingBooking }>(
            '/api/demenagement/book',
            {
                quote_id: quoteId,
                service_id: serviceId,
                adresse_depart: adresseDepart,
                adresse_arrivee: adresseArrivee,
                date_demenagement: dateDemenagement,
                prix_final: prixFinal,
            }
        );
        return response;
    },

    // ✅ Mes déménagements
    getMyMoves: async () => {
        const response = await apiGet<{ success: boolean; data: MovingBooking[] }>(
            '/api/demenagement/my-moves'
        );
        return response;
    },

    // ✅ Suivi GPS temps réel
    getTracking: async (bookingId: number) => {
        const response = await apiGet<{ success: boolean; tracking: MovingTracking[] }>(
            `/api/demenagement/tracking/${bookingId}`
        );
        return response;
    },
};

