// ✅ Service API pour Tickets de Bus/Voyage
import { apiGet, apiPatch, apiPost } from './api';

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
            { params: filters }
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

    // ============================================================================
    // FONCTIONNALITÉS BACKEND MANQUANTES CÔTÉ MOBILE
    // ============================================================================

    // ✅ Créer une réservation
    createReservation: async (reservationData: {
        product_id: string;
        seats: number[];
        passenger_name: string;
        passenger_phone: string;
        passenger_email?: string;
    }) => {
        const response = await apiPost<{ success: boolean; reservation_id: string; message: string }>(
            '/api/bus-tickets/reservations',
            reservationData
        );
        return response;
    },

    // ✅ Annuler une réservation
    cancelReservation: async (reservationId: string) => {
        const response = await apiPatch<{ success: boolean; message: string }>(
            `/api/bus-tickets/reservations/${reservationId}/cancel`,
            {}
        );
        return response;
    },

    // ✅ Payer un ticket
    processPayment: async (paymentData: {
        reservation_id: string;
        payment_method: string;
        phone_number?: string;
    }) => {
        const response = await apiPost<{ success: boolean; payment_id: string; ticket_url?: string }>(
            '/api/bus-tickets/payment',
            paymentData
        );
        return response;
    },

    // ✅ Mes tickets achetés
    getMyTickets: async () => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            '/api/bus-tickets/my-tickets'
        );
        return response;
    },

    // ✅ Détails d'un ticket
    getTicketDetails: async (paymentId: string) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/bus-tickets/ticket/${paymentId}`
        );
        return response;
    },

    // ✅ Valider un ticket par QR code
    validateTicketQR: async (qrData: string) => {
        const response = await apiPost<{ success: boolean; message: string; passenger?: any }>(
            '/api/bus-tickets/validate/qr',
            { qr_code_data: qrData }
        );
        return response;
    },

    // ✅ Validation manuelle d'un passager
    validatePassengerManual: async (reservationId: string) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            '/api/bus-tickets/validate/manual',
            { reservation_id: reservationId }
        );
        return response;
    },

    // ✅ Résumé d'embarquement
    getBoardingSummary: async (productId: string) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/bus-tickets/${productId}/boarding-summary`
        );
        return response;
    },

    // ✅ Liste des passagers d'un bus
    getBusPassengers: async (productId: string) => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            `/api/bus-tickets/${productId}/passengers`
        );
        return response;
    },

    // ✅ Demande de retour (aller-retour)
    createReturnRequest: async (requestData: {
        original_payment_id: string;
        return_date: string;
        notes?: string;
    }) => {
        const response = await apiPost<{ success: boolean; request_id: number }>(
            '/api/bus-tickets/return-request',
            requestData
        );
        return response;
    },

    // ✅ Lister les demandes de retour
    listReturnRequests: async () => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            '/api/bus-tickets/return-requests'
        );
        return response;
    },

    // ✅ Détails d'une demande de retour
    getReturnRequestDetails: async (requestId: number) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/bus-tickets/return-request/${requestId}`
        );
        return response;
    },

    // ✅ Confirmer une demande de retour
    confirmReturnRequest: async (requestId: number) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            `/api/bus-tickets/return-request/${requestId}/confirm`,
            {}
        );
        return response;
    },

    // ✅ Bloquer un siège
    blockSeat: async (productId: string, seatNumber: number, reason?: string) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            '/api/bus-tickets/seats/block',
            { product_id: productId, seat_number: seatNumber, reason }
        );
        return response;
    },

    // ✅ Débloquer un siège
    unblockSeat: async (productId: string, seatNumber: number) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            '/api/bus-tickets/seats/unblock',
            { product_id: productId, seat_number: seatNumber }
        );
        return response;
    },

    // ✅ Sièges bloqués
    getBlockedSeats: async (productId: string) => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            `/api/bus-tickets/seats/${productId}/blocks`
        );
        return response;
    },

    // ✅ Disponibilité avec blocs
    getSeatAvailabilityWithBlocks: async (productId: string) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/bus-tickets/seats/${productId}/availability`
        );
        return response;
    },

    // ✅ Tickets d'une agence
    getAgencyTickets: async () => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            '/api/bus-tickets/agency/tickets'
        );
        return response;
    },

    // ✅ Créer un horaire d'agence
    createSchedule: async (scheduleData: any) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            '/api/bus-tickets/agencies/schedules',
            scheduleData
        );
        return response;
    },

    // ✅ Mettre à jour un horaire
    updateSchedule: async (scheduleId: number, scheduleData: any) => {
        const { apiPut } = await import('./api');
        const response = await apiPut<{ success: boolean; data: any }>(
            `/api/bus-tickets/agencies/schedules/${scheduleId}`,
            scheduleData
        );
        return response;
    },

    // ✅ Supprimer un horaire
    deleteSchedule: async (scheduleId: number) => {
        const { apiDelete } = await import('./api');
        const response = await apiDelete<{ success: boolean }>(
            `/api/bus-tickets/agencies/schedules/${scheduleId}`
        );
        return response;
    },

    // ✅ Créer un produit bus (bus virtuel avec plan de sièges)
    createBusProduct: async (productData: {
        service_id: number;
        name: string;
        type: string;
        total_seats: number;
        bus_configuration: any;
        seat_map: any[];
        price_cents?: number;
        currency?: string;
    }) => {
        const response = await apiPost<{ success: boolean; id: string }>(
            '/api/bus-tickets/products',
            productData
        );
        return response;
    },

    // ✅ Lier un produit bus à une agence
    linkBusProductToAgency: async (linkData: {
        agency_id: number;
        product_id: string;
        nom_modele: string;
        classe?: string;
        equipements?: string[];
    }) => {
        const response = await apiPost<{ success: boolean }>(
            '/api/bus-tickets/products/link-agency',
            linkData
        );
        return response;
    },
};

