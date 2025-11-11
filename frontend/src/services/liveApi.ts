import axios from '@/config/axios';
import type {
    LiveFlashSale,
    LiveFlashSaleCommentary,
    LiveFlashSaleReservation,
    LiveJoinInformation,
    LiveSession,
    LiveSessionResponse,
} from '@/types/live';

export async function fetchUpcomingLives(limit = 10): Promise<LiveSession[]> {
    const response = await axios.get('/api/live/upcoming', {
        params: { limit },
    });
    return response.data?.data ?? [];
}

export async function fetchLiveSession(sessionId: string): Promise<LiveSessionResponse> {
    const response = await axios.get(`/api/live/${sessionId}`);
    return response.data?.data;
}

export async function fetchJoinInformation(
    sessionId: string,
    viewerUserId?: number,
    allowPublish = false,
): Promise<LiveJoinInformation> {
    const response = await axios.get(`/api/live/${sessionId}/join`, {
        params: {
            viewer_user_id: viewerUserId,
            allow_publish: allowPublish,
        },
    });
    return response.data;
}

interface StartLivePayload {
    title: string;
    description?: string;
    host_user_id: number;
    service_id?: number | null;
    linked_service_ids?: number[];
    scheduled_start: string;
    metadata?: Record<string, unknown>;
}

export async function startLiveSession(payload: StartLivePayload): Promise<LiveSessionResponse> {
    const response = await axios.post('/api/live/start', payload);
    return response.data?.data;
}

export interface FlashSaleInput {
    service_id: number;
    promo_price_cfa: number;
    stock_target: number;
    start_at: string;
    end_at: string;
    commentary_mode?: 'host' | 'ai_voice';
    commentary_interval_seconds?: number;
    ai_voice_profile?: string | null;
    metadata?: Record<string, unknown>;
}

export async function configureFlashSales(sessionId: string, items: FlashSaleInput[]): Promise<LiveFlashSale[]> {
    const response = await axios.post(`/api/live/${sessionId}/flash-sales`, {
        items,
    });
    return response.data?.data ?? [];
}

export async function fetchFlashSales(sessionId: string): Promise<LiveFlashSale[]> {
    const response = await axios.get(`/api/live/${sessionId}/flash-sales`);
    return response.data?.data ?? [];
}

export async function reserveFlashSaleSlot(flashSaleId: string, quantity = 1): Promise<LiveFlashSale> {
    const response = await axios.post(`/api/live/flash-sales/${flashSaleId}/reservations`, {
        quantity,
    });
    return response.data?.data;
}

export async function fetchFlashSaleReservations(flashSaleId: string): Promise<LiveFlashSaleReservation[]> {
    const response = await axios.get(`/api/live/flash-sales/${flashSaleId}/reservations`);
    return response.data?.data ?? [];
}

export async function fetchFlashSaleCommentaries(
    flashSaleId: string,
    limit = 20,
): Promise<LiveFlashSaleCommentary[]> {
    const response = await axios.get(`/api/live/flash-sales/${flashSaleId}/commentaries`, {
        params: { limit },
    });
    return response.data?.data ?? [];
}

export async function postFlashSaleCommentary(
    flashSaleId: string,
    message: string,
): Promise<LiveFlashSaleCommentary> {
    const response = await axios.post(`/api/live/flash-sales/${flashSaleId}/commentaries`, {
        message,
    });
    return response.data?.data;
}

