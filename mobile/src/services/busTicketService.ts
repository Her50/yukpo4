// ✅ Service API pour Tickets de Bus/Voyage
import { apiGet } from './api';

// Types pour les réponses (alignés avec le backend)
export interface BusTicketSearchResult {
    agency_id: number;
    agency_service_id: number;
    agency_nom: string;
    agency_adresse?: string;
    agency_quartier?: string;
    agency_ville?: string;
    agency_gps?: string;
    agency_telephone?: string;
    agency_whatsapp?: string;
    agency_email?: string;

    product_id: string;
    product_name: string;
    bus_model_name?: string;
    total_seats?: number;
    available_seats: number;
    reserved_seats: number;
    bus_number?: string;
    departure_city?: string;
    arrival_city?: string;
    departure_date?: string; // Format: YYYY-MM-DD
    departure_time?: string; // Format: HH:MM
    ticket_price?: number;
    currency?: string;
    bus_configuration?: any;
    seat_map?: any;

    distance_km?: number;
    relevance_score: number;
}

export interface BusTicketSearchFilters {
    departure_city?: string;
    arrival_city?: string;
    departure_date?: string; // Format: YYYY-MM-DD
    user_lat?: number;
    user_lng?: number;
    radius_km?: number;
    min_seats?: number;
    agency_name?: string;
}

export interface SeatAvailabilityResponse {
    success: boolean;
    availability?: any;
    error?: string;
}

export const busTicketService = {
    // ✅ Recherche de tickets bus
    searchBusTickets: async (filters: BusTicketSearchFilters) => {
        const response = await apiGet<{ results: BusTicketSearchResult[] }>(
            '/api/bus-tickets/search',
            filters
        );
        return response;
    },

    // ✅ Disponibilité des places
    getSeatAvailability: async (productId: string) => {
        const response = await apiGet<SeatAvailabilityResponse>(
            `/api/bus-tickets/${productId}/availability`
        );
        return response;
    },

    // ✅ Horaires d'une agence
    getAgencySchedules: async (agencyId: number) => {
        const response = await apiGet<any>(
            `/api/bus-tickets/agencies/${agencyId}/schedules`
        );
        return response;
    },
};

