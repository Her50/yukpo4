/**
 * Service pour la gestion des crédits et reports de tickets de bus
 * Gère le report de tickets non-validés, l'utilisation de crédits pour nouveaux voyages,
 * et le suivi des crédits actifs/utilisés/expirés
 */

import { apiGet, apiPost } from '../utils/api';

// ============================================================================
// TYPES
// ============================================================================

export interface TicketCredit {
    credit_id: string;
    original_payment_id: string;
    net_credit_amount: number;
    penalty_amount: number;
    penalty_percentage: string;
    original_amount: number;
    original_departure_city: string;
    original_arrival_city: string;
    original_departure_date: string;
    original_departure_time: string;
    original_ticket_price: number;
    original_number_of_tickets: number;
    status: 'active' | 'used' | 'expired' | 'cancelled';
    reason: string;
    expires_at: string;
    days_until_expiry: number;
    created_at: string;
    supplement_amount?: number;
    refund_amount?: number;
    used_for_payment_id?: string;
    used_at?: string;
}

export interface DeferTicketResponse {
    success: boolean;
    data?: {
        credit_id: string;
        original_amount: number;
        penalty_amount: number;
        penalty_percentage: number;
        net_credit_amount: number;
        agency_penalty_received: number;
        expires_at: string;
        message: string;
    };
    message?: string;
}

export interface ApplyCreditResponse {
    success: boolean;
    payment_id?: string;
    product_name?: string;
    credit_applied?: number;
    new_ticket_price?: number;
    supplement_paid?: number;
    refund_amount?: number;
    total_amount?: number;
    agency_payout?: number;
    yukpo_commission?: number;
    escrow_status?: string;
    message?: string;
    // Si recharge nécessaire
    needs_recharge?: boolean;
    shortfall?: number;
    supplement_required?: number;
    current_balance?: number;
}

export interface UserCreditsResponse {
    success: boolean;
    credits: TicketCredit[];
    active_total: number;
    count: number;
}

export interface CreditDetailsResponse {
    success: boolean;
    credit: TicketCredit & {
        agency_name?: string;
    };
}

// ============================================================================
// API CALLS
// ============================================================================

/**
 * Reporter un ticket non-validé (defer)
 * Crée un crédit avec pénalité de 10% reversée à l'agence
 */
export async function deferTicket(
    paymentId: string,
    reason?: string
): Promise<DeferTicketResponse> {
    const response = await apiPost<DeferTicketResponse>('/api/bus-tickets/defer', {
        payment_id: paymentId,
        reason: reason || 'user_request',
    });

    if (response.success && response.data) {
        return response.data as unknown as DeferTicketResponse;
    }

    return {
        success: false,
        message: (response as any)?.message || 'Erreur lors du report du ticket',
    };
}

/**
 * Utiliser un crédit pour un nouveau voyage
 * Gère automatiquement le supplément ou le remboursement
 */
export async function applyCreditToNewTrip(
    creditId: string,
    productId: string,
    reservationIds: string[],
    newTicketPrice: number,
    numberOfTickets: number,
    bookingFee?: number
): Promise<ApplyCreditResponse> {
    const response = await apiPost<ApplyCreditResponse>('/api/bus-tickets/apply-credit', {
        credit_id: creditId,
        product_id: productId,
        reservation_ids: reservationIds,
        new_ticket_price: newTicketPrice,
        number_of_tickets: numberOfTickets,
        booking_fee: bookingFee || 500,
    });

    if (response.success && response.data) {
        return response.data as unknown as ApplyCreditResponse;
    }

    // Retourner la réponse telle quelle (peut contenir needs_recharge)
    return response as unknown as ApplyCreditResponse;
}

/**
 * Récupérer tous les crédits de l'utilisateur
 */
export async function getUserCredits(): Promise<UserCreditsResponse> {
    const response = await apiGet<UserCreditsResponse>('/api/bus-tickets/credits');

    if (response.success && response.data) {
        return response.data as unknown as UserCreditsResponse;
    }

    return {
        success: false,
        credits: [],
        active_total: 0,
        count: 0,
    };
}

/**
 * Récupérer les détails d'un crédit spécifique
 */
export async function getCreditDetails(creditId: string): Promise<CreditDetailsResponse> {
    const response = await apiGet<CreditDetailsResponse>(`/api/bus-tickets/credits/${creditId}`);

    if (response.success && response.data) {
        return response.data as unknown as CreditDetailsResponse;
    }

    return {
        success: false,
        credit: {} as any,
    };
}

/**
 * Récupérer uniquement les crédits actifs (non expirés, non utilisés)
 */
export async function getActiveCredits(): Promise<TicketCredit[]> {
    const result = await getUserCredits();
    if (result.success && result.credits) {
        return result.credits.filter(
            (c) => c.status === 'active' && c.days_until_expiry > 0
        );
    }
    return [];
}

/**
 * Vérifier si l'utilisateur a des crédits applicables pour un trajet donné
 */
export async function getApplicableCredits(): Promise<{
    credits: TicketCredit[];
    total: number;
}> {
    const activeCredits = await getActiveCredits();
    const total = activeCredits.reduce((sum, c) => sum + c.net_credit_amount, 0);
    return { credits: activeCredits, total };
}

/**
 * Formater le montant en XAF
 */
export function formatCreditAmount(amount: number): string {
    return `${amount.toLocaleString('fr-FR')} XAF`;
}

/**
 * Calculer la différence entre un crédit et un nouveau prix
 */
export function calculateCreditDifference(
    creditAmount: number,
    newPrice: number
): {
    difference: number;
    isRefund: boolean;
    isSupplement: boolean;
    isExact: boolean;
    label: string;
} {
    const diff = creditAmount - newPrice;
    if (diff > 0) {
        return {
            difference: diff,
            isRefund: true,
            isSupplement: false,
            isExact: false,
            label: `Excédent de ${formatCreditAmount(diff)} à restituer`,
        };
    } else if (diff < 0) {
        return {
            difference: Math.abs(diff),
            isRefund: false,
            isSupplement: true,
            isExact: false,
            label: `Supplément de ${formatCreditAmount(Math.abs(diff))} à payer`,
        };
    }
    return {
        difference: 0,
        isRefund: false,
        isSupplement: false,
        isExact: true,
        label: 'Montant exact couvert par le crédit',
    };
}
