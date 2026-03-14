/**
 * Service de programme de fidélité
 * Points, réductions, niveaux, récompenses
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../utils/safeStorage';
import { analytics } from './analytics';
import { apiGet, apiPost } from './api';

interface LoyaltyPoints {
    total_points: number;
    available_points: number;
    used_points: number;
    level: 'bronze' | 'silver' | 'gold' | 'platinum';
    next_level_points: number;
    points_until_next: number;
}

interface LoyaltyTransaction {
    id: string;
    type: 'earned' | 'redeemed' | 'expired';
    points: number;
    description: string;
    timestamp: number;
    expiry_date?: number;
}

interface LoyaltyReward {
    id: string;
    name: string;
    description: string;
    points_cost: number;
    discount_percent?: number;
    discount_amount?: number;
    category: 'discount' | 'free_ticket' | 'upgrade' | 'cashback';
    available: boolean;
}

class LoyaltyProgramService {
    private readonly STORAGE_KEY = 'loyalty_points';
    private readonly REWARDS_KEY = 'loyalty_rewards';

    /**
     * Obtenir les points de fidélité de l'utilisateur
     */
    async getLoyaltyPoints(userId: number): Promise<LoyaltyPoints> {
        try {
            const response = await apiGet(`/api/loyalty/points?user_id=${userId}`);

            if (response.success && response.data) {
                await this.cachePoints(response.data as any);
                return response.data as any;
            }

            // Fallback: charger depuis cache
            const cached = await this.getCachedPoints();
            return cached || this.getDefaultPoints();
        } catch (error) {
            console.error('[Loyalty] Erreur récupération points:', error);
            const cached = await this.getCachedPoints();
            return cached || this.getDefaultPoints();
        }
    }

    /**
     * Calculer les points gagnés pour une réservation
     */
    calculatePointsForBooking(amount: number): number {
        // 1 point pour chaque 100 FCFA dépensés
        return Math.floor(amount / 100);
    }

    /**
     * Ajouter des points après une réservation
     */
    async addPoints(userId: number, points: number, reason: string): Promise<boolean> {
        try {
            const response = await apiPost('/api/loyalty/add-points', {
                user_id: userId,
                points,
                reason,
            });

            if (response.success) {
                analytics.track('loyalty_points_earned', { points, reason });
                await this.refreshPoints(userId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Loyalty] Erreur ajout points:', error);
            return false;
        }
    }

    /**
     * Utiliser des points pour une réduction
     */
    async redeemPoints(userId: number, points: number, rewardId: string): Promise<boolean> {
        try {
            const response = await apiPost('/api/loyalty/redeem', {
                user_id: userId,
                points,
                reward_id: rewardId,
            });

            if (response.success) {
                analytics.track('loyalty_points_redeemed', { points, reward_id: rewardId });
                await this.refreshPoints(userId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Loyalty] Erreur utilisation points:', error);
            return false;
        }
    }

    /**
     * Obtenir l'historique des transactions
     */
    async getTransactionHistory(userId: number, limit: number = 50): Promise<LoyaltyTransaction[]> {
        try {
            const response = await apiGet(`/api/loyalty/transactions?user_id=${userId}&limit=${limit}`);

            if (response.success && response.transactions) {
                return response.transactions;
            }
            return [];
        } catch (error) {
            console.error('[Loyalty] Erreur historique:', error);
            return [];
        }
    }

    /**
     * Obtenir les récompenses disponibles
     */
    async getAvailableRewards(): Promise<LoyaltyReward[]> {
        try {
            const response = await apiGet('/api/loyalty/rewards');

            if (response.success && response.rewards) {
                await this.cacheRewards(response.rewards);
                return response.rewards;
            }

            // Fallback: récompenses par défaut
            return this.getDefaultRewards();
        } catch (error) {
            console.error('[Loyalty] Erreur récompenses:', error);
            return this.getDefaultRewards();
        }
    }

    /**
     * Calculer le niveau de fidélité
     */
    calculateLevel(totalPoints: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
        if (totalPoints >= 10000) return 'platinum';
        if (totalPoints >= 5000) return 'gold';
        if (totalPoints >= 1000) return 'silver';
        return 'bronze';
    }

    /**
     * Obtenir les points nécessaires pour le prochain niveau
     */
    getNextLevelPoints(currentLevel: string): number {
        const thresholds: { [key: string]: number } = {
            bronze: 1000,
            silver: 5000,
            gold: 10000,
            platinum: Infinity,
        };
        return thresholds[currentLevel] || Infinity;
    }

    /**
     * Calculer la réduction basée sur les points
     */
    calculateDiscount(points: number, amount: number): { discount: number; pointsUsed: number } {
        // 100 points = 5% de réduction, max 20%
        const maxDiscountPercent = Math.min(20, Math.floor(points / 20) * 5);
        const discount = Math.floor(amount * (maxDiscountPercent / 100));
        const pointsUsed = Math.floor(discount / 5) * 20; // 20 points par 5% de réduction

        return {
            discount: Math.min(discount, amount),
            pointsUsed: Math.min(pointsUsed, points),
        };
    }

    /**
     * Rafraîchir les points depuis le serveur
     */
    private async refreshPoints(userId: number) {
        await this.getLoyaltyPoints(userId);
    }

    /**
     * Mettre en cache les points
     */
    private async cachePoints(points: LoyaltyPoints) {
        try {
            await SafeStorage.setItem(this.STORAGE_KEY, JSON.stringify(points));
        } catch (error) {
            console.error('[Loyalty] Erreur cache points:', error);
        }
    }

    /**
     * Récupérer les points depuis le cache
     */
    private async getCachedPoints(): Promise<LoyaltyPoints | null> {
        try {
            const cached = await SafeStorage.getItem(this.STORAGE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Mettre en cache les récompenses
     */
    private async cacheRewards(rewards: LoyaltyReward[]) {
        try {
            await SafeStorage.setItem(this.REWARDS_KEY, JSON.stringify(rewards));
        } catch (error) {
            console.error('[Loyalty] Erreur cache récompenses:', error);
        }
    }

    /**
     * Points par défaut
     */
    private getDefaultPoints(): LoyaltyPoints {
        return {
            total_points: 0,
            available_points: 0,
            used_points: 0,
            level: 'bronze',
            next_level_points: 1000,
            points_until_next: 1000,
        };
    }

    /**
     * Récompenses par défaut
     */
    private getDefaultRewards(): LoyaltyReward[] {
        return [
            {
                id: 'discount_5',
                name: 'Réduction 5%',
                description: '5% de réduction sur votre prochaine réservation',
                points_cost: 100,
                discount_percent: 5,
                category: 'discount',
                available: true,
            },
            {
                id: 'discount_10',
                name: 'Réduction 10%',
                description: '10% de réduction sur votre prochaine réservation',
                points_cost: 200,
                discount_percent: 10,
                category: 'discount',
                available: true,
            },
            {
                id: 'discount_15',
                name: 'Réduction 15%',
                description: '15% de réduction sur votre prochaine réservation',
                points_cost: 300,
                discount_percent: 15,
                category: 'discount',
                available: true,
            },
            {
                id: 'free_ticket',
                name: 'Ticket gratuit',
                description: 'Un ticket gratuit jusqu\'à 5000 FCFA',
                points_cost: 500,
                discount_amount: 5000,
                category: 'free_ticket',
                available: true,
            },
        ];
    }
}

export const loyaltyProgram = new LoyaltyProgramService();
export default loyaltyProgram;


