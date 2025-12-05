import { apiGet, apiPost } from './api';

export interface FlashSaleReservationTicket {
    ticket_id: string;
    status: 'pending' | 'confirmed' | 'failed' | 'out_of_stock';
    estimated_wait_time_seconds?: number;
    message?: string;
    flash_sale_id?: string;
    quantity?: number;
    created_at?: string;
    updated_at?: string;
}

export interface LiveFlashSale {
    id: string;
    live_session_id: string;
    service_id: number;
    promo_price_cfa: number;
    stock_target: number;
    reserved_quantity: number;
    start_at: string;
    end_at: string;
    status: string;
    commentary_mode: 'host' | 'ai_voice';
    commentary_interval_seconds: number;
    ai_voice_profile?: string | null;
    last_commentary_sent_at?: string | null;
    metadata?: Record<string, unknown>;
    linked_service?: {
        id: number;
        title?: string;
        short_description?: string;
        cover_media?: string;
        gallery?: string[];
        price?: string;
    };
    recent_commentaries?: LiveFlashSaleCommentary[];
}

export interface LiveFlashSaleCommentary {
    id: string;
    flash_sale_id: string;
    created_by: 'host' | 'ai_voice';
    message: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

export interface LiveFlashSaleReservation {
    user_id: number;
    quantity: number;
    reserved_at: string;
    user_name?: string | null;
}

interface ApiResponse<T> {
    success?: boolean;
    data?: T;
    message?: string;
    error?: string;
}

/**
 * Récupère la liste des flash sales actifs
 */
export const fetchActiveFlashSales = async (): Promise<LiveFlashSale[]> => {
    try {
        const response = await apiGet<ApiResponse<LiveFlashSale[]>>('/api/live/flash-sales');
        const payload = response.data || response;
        if (payload.success === false) {
            throw new Error(payload.error || payload.message || 'Erreur lors de la récupération des flash sales');
        }
        return payload.data || [];
    } catch (error: any) {
        console.error('[flashSaleService] Erreur fetchActiveFlashSales:', error);
        throw error;
    }
};

/**
 * Récupère les flash sales d'une session live
 */
export const fetchFlashSalesBySession = async (sessionId: string): Promise<LiveFlashSale[]> => {
    try {
        const response = await apiGet<ApiResponse<LiveFlashSale[]>>(`/api/live/${sessionId}/flash-sales`);
        const payload = response.data || response;
        if (payload.success === false) {
            throw new Error(payload.error || payload.message || 'Erreur lors de la récupération des flash sales');
        }
        return payload.data || [];
    } catch (error: any) {
        console.error('[flashSaleService] Erreur fetchFlashSalesBySession:', error);
        throw error;
    }
};

/**
 * Soumet une réservation pour un flash sale (retourne un ticket)
 */
export const reserveFlashSaleSlot = async (
    flashSaleId: string,
    quantity: number = 1
): Promise<FlashSaleReservationTicket> => {
    try {
        const response = await apiPost<ApiResponse<FlashSaleReservationTicket>>(
            `/api/live/flash-sales/${flashSaleId}/reservations`,
            { quantity }
        );
        const payload = response.data || response;
        if (payload.success === false) {
            throw new Error(payload.error || payload.message || 'Erreur lors de la réservation');
        }
        return payload.data!;
    } catch (error: any) {
        console.error('[flashSaleService] Erreur reserveFlashSaleSlot:', error);
        throw error;
    }
};

/**
 * Vérifie le statut d'un ticket de réservation
 */
export const getFlashSaleTicketStatus = async (ticketId: string): Promise<FlashSaleReservationTicket> => {
    try {
        const response = await apiGet<ApiResponse<FlashSaleReservationTicket>>(
            `/api/live/flash-sales/tickets/${ticketId}`
        );
        const payload = response.data || response;
        if (payload.success === false) {
            throw new Error(payload.error || payload.message || 'Erreur lors de la vérification du ticket');
        }
        if (!payload.data) {
            throw new Error('Ticket introuvable');
        }
        return payload.data;
    } catch (error: any) {
        console.error('[flashSaleService] Erreur getFlashSaleTicketStatus:', error);
        throw error;
    }
};

/**
 * Récupère les réservations d'un flash sale
 */
export const fetchFlashSaleReservations = async (
    flashSaleId: string
): Promise<LiveFlashSaleReservation[]> => {
    try {
        const response = await apiGet<ApiResponse<LiveFlashSaleReservation[]>>(
            `/api/live/flash-sales/${flashSaleId}/reservations`
        );
        const payload = response.data || response;
        if (payload.success === false) {
            throw new Error(payload.error || payload.message || 'Erreur lors de la récupération des réservations');
        }
        return payload.data || [];
    } catch (error: any) {
        console.error('[flashSaleService] Erreur fetchFlashSaleReservations:', error);
        throw error;
    }
};

/**
 * Récupère les commentaires d'un flash sale
 */
export const fetchFlashSaleCommentaries = async (
    flashSaleId: string,
    limit: number = 20
): Promise<LiveFlashSaleCommentary[]> => {
    try {
        const response = await apiGet<ApiResponse<LiveFlashSaleCommentary[]>>(
            `/api/live/flash-sales/${flashSaleId}/commentaries`,
            { limit }
        );
        const payload = response.data || response;
        if (payload.success === false) {
            throw new Error(payload.error || payload.message || 'Erreur lors de la récupération des commentaires');
        }
        return payload.data || [];
    } catch (error: any) {
        console.error('[flashSaleService] Erreur fetchFlashSaleCommentaries:', error);
        throw error;
    }
};

