/**
 * Service de recommandations ML pour Video Feed
 * Algorithme de personnalisation basé sur interactions utilisateur
 */

import { apiGet, apiPost } from './api';
import { mlRecommendationService } from './mlRecommendationService';

interface UserInteraction {
    contentId: string;
    action: 'like' | 'save' | 'share' | 'comment' | 'view' | 'skip';
    timestamp: number;
    duration?: number; // Temps de visionnage en secondes
}

interface VideoRecommendation {
    contentId: string;
    score: number;
    reason: string;
    category?: string;
}

interface RecommendationResponse {
    recommendations: VideoRecommendation[];
    userProfile: {
        preferredCategories: string[];
        engagementScore: number;
        watchTime: number;
    };
}

class VideoRecommendationService {
    private interactionHistory: UserInteraction[] = [];
    private userProfile: RecommendationResponse['userProfile'] | null = null;
    private lastUpdate = 0;
    private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

    /**
     * Enregistre une interaction utilisateur
     */
    async trackInteraction(
        contentId: string,
        action: UserInteraction['action'],
        duration?: number
    ): Promise<void> {
        const interaction: UserInteraction = {
            contentId,
            action,
            timestamp: Date.now(),
            duration,
        };

        this.interactionHistory.push(interaction);

        // Garder seulement les 100 dernières interactions
        if (this.interactionHistory.length > 100) {
            this.interactionHistory = this.interactionHistory.slice(-100);
        }

        // ✅ NOUVEAU: Tracker aussi dans ML on-device (instantané, pas de réseau)
        mlRecommendationService.trackInteraction(contentId, action, duration).catch(() => {
            // Ignorer erreurs silencieusement
        });

        // Envoyer au backend pour analyse ML (en arrière-plan)
        try {
            await apiPost('/api/video/track-interaction', {
                content_id: contentId,
                action,
                duration,
                timestamp: interaction.timestamp,
            });
        } catch (error) {
            console.warn('[VideoRecommendationService] Erreur tracking interaction backend:', error);
            // Pas critique - ML on-device fonctionne sans backend
        }
    }

    /**
     * Récupère les recommandations personnalisées
     */
    async getRecommendations(
        userId: number,
        currentFeed: any[],
        limit: number = 25
    ): Promise<VideoRecommendation[]> {
        // Vérifier si on doit mettre à jour le profil
        const now = Date.now();
        if (!this.userProfile || now - this.lastUpdate > this.UPDATE_INTERVAL) {
            await this.updateUserProfile(userId);
        }

        try {
            // Appel API backend pour recommandations ML
            const response = await apiGet('/api/content/ml-recommendations', {
                user_id: userId,
                limit,
                interactions: this.interactionHistory.slice(-20), // 20 dernières interactions
            });

            if (response.success && Array.isArray(response.data?.recommendations)) {
                return response.data.recommendations as VideoRecommendation[];
            }

            // Fallback : Recommandations basiques basées sur catégories préférées
            return this.getBasicRecommendations(currentFeed);
        } catch (error) {
            console.warn('[VideoRecommendationService] Erreur recommandations ML:', error);
            // Fallback : Recommandations basiques
            return this.getBasicRecommendations(currentFeed);
        }
    }

    /**
     * Met à jour le profil utilisateur
     */
    private async updateUserProfile(userId: number): Promise<void> {
        try {
            const response = await apiGet('/api/video/user-profile', {
                user_id: userId,
            });

            if (response.success && response.data) {
                this.userProfile = response.data.userProfile;
                this.lastUpdate = Date.now();
            }
        } catch (error) {
            console.warn('[VideoRecommendationService] Erreur mise à jour profil:', error);
        }
    }

    /**
     * Recommandations basiques basées sur catégories préférées
     */
    private getBasicRecommendations(currentFeed: any[]): VideoRecommendation[] {
        // Analyser les interactions pour déterminer catégories préférées
        const categoryScores: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};

        this.interactionHistory.forEach(interaction => {
            const item = currentFeed.find(f => f.contentId === interaction.contentId);
            if (item && item.category) {
                const category = item.category;
                categoryScores[category] = (categoryScores[category] || 0) +
                    (interaction.action === 'like' ? 2 :
                        interaction.action === 'save' ? 3 :
                            interaction.action === 'view' && interaction.duration && interaction.duration > 10 ? 1 : 0);
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            }
        });

        // Calculer scores moyens par catégorie
        const categoryAverages: Record<string, number> = {};
        Object.keys(categoryScores).forEach(category => {
            categoryAverages[category] = categoryScores[category] / (categoryCounts[category] || 1);
        });

        // Trier par score
        const sortedCategories = Object.entries(categoryAverages)
            .sort((a, b) => b[1] - a[1])
            .map(([category]) => category);

        // Générer recommandations
        const recommendations: VideoRecommendation[] = currentFeed
            .filter(item => {
                if (!item.category) return false;
                return sortedCategories.includes(item.category);
            })
            .map(item => ({
                contentId: item.contentId,
                score: categoryAverages[item.category] || 0.5,
                reason: `Basé sur vos préférences pour ${item.category}`,
                category: item.category,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 25);

        return recommendations;
    }

    /**
     * Réordonne le feed selon les recommandations
     * ✅ AMÉLIORÉ: Combine ML on-device + backend pour recommandations hybrides
     */
    async reorderFeedByRecommendations(
        userId: number,
        feed: any[]
    ): Promise<any[]> {
        // 1. Réordonner avec ML on-device (instantané, pas de réseau)
        const mlReordered = await mlRecommendationService.reorderFeedByML(feed);

        // 2. En parallèle, récupérer recommandations backend (si réseau disponible)
        try {
            const recommendations = await this.getRecommendations(userId, feed);

            // Combiner scores ML on-device + backend
            const scoreMap = new Map<string, number>();

            // Scores ML on-device (poids 40%)
            mlReordered.forEach((item, index) => {
                const mlScore = item.mlScore?.score || 0;
                const normalizedScore = (mlReordered.length - index) / mlReordered.length;
                scoreMap.set(item.contentId || item.id, mlScore * 0.4 + normalizedScore * 0.4);
            });

            // Scores backend (poids 60%)
            recommendations.forEach(rec => {
                const currentScore = scoreMap.get(rec.contentId) || 0;
                scoreMap.set(rec.contentId, currentScore + rec.score * 0.6);
            });

            // Réordonner avec scores combinés
            const reordered = [...feed].sort((a, b) => {
                const scoreA = scoreMap.get(a.contentId || a.id) || 0;
                const scoreB = scoreMap.get(b.contentId || b.id) || 0;
                return scoreB - scoreA;
            });

            return reordered;
        } catch (error) {
            // Fallback: utiliser uniquement ML on-device si backend indisponible
            console.warn('[VideoRecommendationService] Erreur backend, utilisation ML on-device uniquement:', error);
            return mlReordered;
        }
    }

    /**
     * Réinitialise l'historique (pour tests)
     */
    reset(): void {
        this.interactionHistory = [];
        this.userProfile = null;
        this.lastUpdate = 0;
    }
}

export const videoRecommendationService = new VideoRecommendationService();

