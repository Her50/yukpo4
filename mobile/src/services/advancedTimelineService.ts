// @ts-nocheck
// ✅ NOUVEAU Phase 2: Service frontend pour timelines multi-pistes avancées

import { AdvancedTimeline } from '../types/AdvancedTimeline';
import { apiCall } from './api';

export interface AdvancedTimelineResponse {
    success: boolean;
    timeline: AdvancedTimelineRow;
    message?: string;
}

export interface AdvancedTimelineRow {
    id: number;
    timeline_id: string;
    user_id: number;
    name: string;
    timeline_data: AdvancedTimeline;
    duration: number;
    fps?: number;
    resolution_width?: number;
    resolution_height?: number;
    created_at: string;
    updated_at: string;
}

export interface TimelineListResponse {
    success: boolean;
    timelines: AdvancedTimelineRow[];
    total: number;
    limit: number;
    offset: number;
}

export interface CreateTimelineRequest {
    name: string;
    timeline: AdvancedTimeline;
}

export const advancedTimelineService = {
    /**
     * Crée une nouvelle timeline avancée
     */
    async createTimeline(request: CreateTimelineRequest): Promise<AdvancedTimelineRow> {
        const response = await apiCall<AdvancedTimelineResponse>('/api/timelines', {
            method: 'POST',
            body: JSON.stringify(request),
        });
        return response.timeline;
    },

    /**
     * Récupère une timeline par ID
     */
    async getTimeline(timelineId: string): Promise<AdvancedTimelineRow | null> {
        try {
            const response = await apiCall<{ success: boolean; timeline: AdvancedTimelineRow }>(
                `/api/timelines/${encodeURIComponent(timelineId)}`
            );
            return response.timeline || null;
        } catch (error) {
            console.error(`[AdvancedTimelineService] Erreur récupération timeline ${timelineId}:`, error);
            return null;
        }
    },

    /**
     * Liste les timelines de l'utilisateur
     */
    async listTimelines(limit?: number, offset?: number): Promise<TimelineListResponse> {
        const queryParams = new URLSearchParams();
        if (limit) queryParams.append('limit', String(limit));
        if (offset) queryParams.append('offset', String(offset));

        const queryString = queryParams.toString();
        const url = `/api/timelines${queryString ? `?${queryString}` : ''}`;

        const response = await apiCall<TimelineListResponse>(url);
        return response;
    },

    /**
     * Met à jour une timeline
     */
    async updateTimeline(
        timelineId: string,
        request: CreateTimelineRequest
    ): Promise<AdvancedTimelineRow> {
        const response = await apiCall<AdvancedTimelineResponse>(
            `/api/timelines/${encodeURIComponent(timelineId)}`,
            {
                method: 'PUT',
                body: JSON.stringify(request),
            }
        );
        return response.timeline;
    },

    /**
     * Supprime une timeline
     */
    async deleteTimeline(timelineId: string): Promise<boolean> {
        try {
            const response = await apiCall<{ success: boolean; message?: string }>(
                `/api/timelines/${encodeURIComponent(timelineId)}`,
                {
                    method: 'DELETE',
                }
            );
            return response.success;
        } catch (error) {
            console.error(`[AdvancedTimelineService] Erreur suppression timeline ${timelineId}:`, error);
            return false;
        }
    },
};

