/**
 * Service de fonctionnalités sociales avancées
 * Duet, Remix, Stitch, Réactions avancées
 */

import { apiGet, apiPost } from './api';

export interface DuetVideo {
    id: string;
    originalVideoId: string;
    duetVideoUrl: string;
    thumbnail?: string;
    creatorId: number;
    creatorName: string;
    likes: number;
    createdAt: string;
}

export interface RemixVideo {
    id: string;
    originalVideoId: string;
    remixVideoUrl: string;
    effects: string[];
    thumbnail?: string;
    creatorId: number;
    likes: number;
}

export interface StitchVideo {
    id: string;
    originalVideoId: string;
    stitchedVideoUrl: string;
    startTime: number; // Secondes
    endTime: number;
    thumbnail?: string;
    creatorId: number;
    likes: number;
}

export interface Reaction {
    id: string;
    type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
    userId: number;
    userName: string;
    timestamp: number;
}

class SocialFeaturesService {
    /**
     * Créer un Duet (vidéo côte à côte)
     */
    async createDuet(
        originalVideoId: string,
        duetVideoUrl: string,
        userId: number
    ): Promise<DuetVideo> {
        const response = await apiPost('/api/duets', {
            original_video_id: originalVideoId,
            duet_video_url: duetVideoUrl,
            user_id: userId,
        });

        if (response.success && response.data) {
            return response.data as DuetVideo;
        }

        throw new Error('Erreur création duet');
    }

    /**
     * Créer un Remix (vidéo avec effets)
     */
    async createRemix(
        originalVideoId: string,
        remixVideoUrl: string,
        effects: string[],
        userId: number
    ): Promise<RemixVideo> {
        const response = await apiPost('/api/duets', {
            original_video_id: originalVideoId,
            remix_video_url: remixVideoUrl,
            effects,
            user_id: userId,
            type: 'remix',
        });

        if (response.success && response.data) {
            return response.data as RemixVideo;
        }

        throw new Error('Erreur création remix');
    }

    /**
     * Créer un Stitch (clip d'une vidéo)
     */
    async createStitch(
        originalVideoId: string,
        stitchedVideoUrl: string,
        startTime: number,
        endTime: number,
        userId: number
    ): Promise<StitchVideo> {
        const response = await apiPost('/api/stitches', {
            original_video_id: originalVideoId,
            stitched_video_url: stitchedVideoUrl,
            start_time: startTime,
            end_time: endTime,
            user_id: userId,
        });

        if (response.success && response.data) {
            return response.data as StitchVideo;
        }

        throw new Error('Erreur création stitch');
    }

    /**
     * Ajouter une réaction avancée
     */
    async addReaction(
        videoId: string,
        reactionType: Reaction['type'],
        userId: number
    ): Promise<Reaction> {
        const response = await apiPost(`/api/videos/${videoId}/reactions`, {
            type: reactionType,
            user_id: userId,
        });

        if (response.success && response.data) {
            return response.data as Reaction;
        }

        throw new Error('Erreur ajout réaction');
    }

    /**
     * Récupérer les réactions d'une vidéo
     */
    async getReactions(videoId: string): Promise<Reaction[]> {
        const response = await apiGet(`/api/videos/${videoId}/reactions`);

        if (response.success && Array.isArray(response.data)) {
            return response.data as Reaction[];
        }

        return [];
    }

    /**
     * Récupérer les Duets d'une vidéo
     */
    async getDuets(originalVideoId: string): Promise<DuetVideo[]> {
        const response = await apiGet('/api/duets', {
            original_video_id: originalVideoId,
        });

        if (response.success && Array.isArray(response.data)) {
            return response.data as DuetVideo[];
        }

        return [];
    }

    /**
     * Récupérer les Remix d'une vidéo
     */
    async getRemixes(originalVideoId: string): Promise<RemixVideo[]> {
        const response = await apiGet('/api/duets', {
            original_video_id: originalVideoId,
            type: 'remix',
        });

        if (response.success && Array.isArray(response.data)) {
            return response.data as RemixVideo[];
        }

        return [];
    }
}

export const socialFeaturesService = new SocialFeaturesService();

