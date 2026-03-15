/**
 * Service de partage social
 * Partage trajets, tickets, promotions sur réseaux sociaux
 */

import { Linking, Platform, Share } from 'react-native';
import { analytics } from './analytics';

interface ShareOptions {
    title: string;
    message: string;
    url?: string;
    imageUrl?: string;
}

class SocialSharingService {
    /**
     * Partager un trajet
     */
    async shareTrip(trip: {
        departure: string;
        arrival: string;
        date: string;
        price: number;
        agency: string;
    }): Promise<boolean> {
        try {
            const message = `🚌 Voyage ${trip.departure} → ${trip.arrival}\n📅 ${trip.date}\n💰 ${trip.price.toLocaleString()} FCFA\n🏢 ${trip.agency}\n\nRéservez sur Yukpo !`;
            const url = `https://yukpomnang.com/trips/${trip.departure}-${trip.arrival}`;

            const result = await Share.share({
                message: `${message}\n${url}`,
                title: `Voyage ${trip.departure} → ${trip.arrival}`,
            });

            if (result.action === Share.sharedAction) {
                analytics.track('trip_shared', {
                    departure: trip.departure,
                    arrival: trip.arrival,
                    platform: result.activityType || 'unknown',
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('[SocialSharing] Erreur partage trajet:', error);
            return false;
        }
    }

    /**
     * Partager un ticket réservé
     */
    async shareTicket(ticket: {
        id: string;
        departure: string;
        arrival: string;
        date: string;
        seats: number;
    }): Promise<boolean> {
        try {
            const message = `✅ J'ai réservé ${ticket.seats} place(s) pour ${ticket.departure} → ${ticket.arrival} le ${ticket.date} sur Yukpo !`;
            const url = `https://yukpomnang.com/tickets/${ticket.id}`;

            const result = await Share.share({
                message: `${message}\n${url}`,
                title: 'Ma réservation Yukpo',
            });

            if (result.action === Share.sharedAction) {
                analytics.track('ticket_shared', {
                    ticket_id: ticket.id,
                    platform: result.activityType || 'unknown',
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('[SocialSharing] Erreur partage ticket:', error);
            return false;
        }
    }

    /**
     * Partager une promotion
     */
    async sharePromotion(promotion: {
        title: string;
        description: string;
        discount: number;
        code?: string;
    }): Promise<boolean> {
        try {
            const message = `🎉 ${promotion.title}\n${promotion.description}\n💰 Réduction de ${promotion.discount}%${promotion.code ? `\n🎫 Code: ${promotion.code}` : ''}\n\nProfitez-en sur Yukpo !`;
            const url = 'https://yukpomnang.com/promotions';

            const result = await Share.share({
                message: `${message}\n${url}`,
                title: promotion.title,
            });

            if (result.action === Share.sharedAction) {
                analytics.track('promotion_shared', {
                    promotion_title: promotion.title,
                    platform: result.activityType || 'unknown',
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('[SocialSharing] Erreur partage promotion:', error);
            return false;
        }
    }

    /**
     * Partager ses performances de navigation (stats, badges, CO2, records)
     */
    async shareNavigationPerformance(stats: {
        period: string;
        distanceKm: number;
        sessions: number;
        calories: number;
        healthScore: number;
        healthLabel: string;
        co2SavedKg: number;
        vo2max: number;
        fitnessLevel: string;
        streak: number;
        badgeCount: number;
        points: number;
        bestDistanceKm?: number;
        bestSpeedKmh?: number;
        userId?: number;
    }): Promise<boolean> {
        try {
            const lines = [
                `🏃 Mes performances Yukpo Navigation (${stats.period === 'week' ? 'cette semaine' : stats.period === 'month' ? 'ce mois' : 'cette année'})`,
                ``,
                `🫀 Score santé: ${stats.healthScore}/100 (${stats.healthLabel})`,
                `📏 Distance: ${stats.distanceKm.toFixed(1)} km · ${stats.sessions} session${stats.sessions > 1 ? 's' : ''}`,
                `🔥 Calories: ${Math.round(stats.calories)} kcal`,
                `🌱 CO₂ économisé: ${stats.co2SavedKg.toFixed(1)} kg`,
                `💪 VO₂max: ${Math.round(stats.vo2max)} ml/kg/min (${stats.fitnessLevel})`,
                `⚡ Série: ${stats.streak} jour${stats.streak > 1 ? 's' : ''} consécutif${stats.streak > 1 ? 's' : ''}`,
                `🏅 ${stats.badgeCount} badge${stats.badgeCount > 1 ? 's' : ''} · ${stats.points} points`,
            ];
            if (stats.bestDistanceKm) lines.push(`🏆 Record distance: ${stats.bestDistanceKm.toFixed(1)} km`);
            if (stats.bestSpeedKmh) lines.push(`⚡ Record vitesse: ${stats.bestSpeedKmh.toFixed(1)} km/h`);
            lines.push(``);
            lines.push(`Rejoins-moi sur Yukpo ! 🚀`);
            // URL de la page de partage backend (avec OG tags pour preview WhatsApp/Facebook + deep link + store fallback)
            if (stats.userId) {
                lines.push(`https://yukpomnang.com/navigation/share/${stats.userId}`);
            } else {
                lines.push(Platform.OS === 'ios'
                    ? 'https://apps.apple.com/app/yukpomnang'
                    : 'https://play.google.com/store/apps/details?id=com.yukpomnang');
            }

            const message = lines.join('\n');
            const result = await Share.share({
                message,
                title: 'Mes performances Yukpo Navigation',
            });

            if (result.action === Share.sharedAction) {
                analytics.track('navigation_performance_shared', {
                    health_score: stats.healthScore,
                    distance_km: stats.distanceKm,
                    platform: result.activityType || 'unknown',
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('[SocialSharing] Erreur partage performances navigation:', error);
            return false;
        }
    }

    /**
     * Partager l'application
     */
    async shareApp(): Promise<boolean> {
        try {
            const message = `🚀 Découvrez Yukpo, la meilleure plateforme de réservation de tickets de bus !\n\n✅ Réservation facile\n✅ Paiement sécurisé\n✅ Suivi en temps réel\n\nTéléchargez maintenant !`;
            const url = Platform.OS === 'ios'
                ? 'https://apps.apple.com/app/yukpomnang'
                : 'https://play.google.com/store/apps/details?id=com.yukpomnang';

            const result = await Share.share({
                message: `${message}\n${url}`,
                title: 'Yukpo - Réservation de tickets',
            });

            if (result.action === Share.sharedAction) {
                analytics.track('app_shared', {
                    platform: result.activityType || 'unknown',
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('[SocialSharing] Erreur partage app:', error);
            return false;
        }
    }

    /**
     * Ouvrir WhatsApp avec message
     */
    async shareViaWhatsApp(message: string, phoneNumber?: string): Promise<boolean> {
        try {
            const encodedMessage = encodeURIComponent(message);
            const url = phoneNumber
                ? `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`
                : `whatsapp://send?text=${encodedMessage}`;

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                analytics.track('shared_via_whatsapp', { has_phone: !!phoneNumber });
                return true;
            }
            return false;
        } catch (error) {
            console.error('[SocialSharing] Erreur WhatsApp:', error);
            return false;
        }
    }

    /**
     * Partager générique
     */
    async shareGeneric(options: ShareOptions): Promise<boolean> {
        try {
            const result = await Share.share({
                message: options.message,
                title: options.title,
                url: options.url,
            });

            if (result.action === Share.sharedAction) {
                analytics.track('generic_shared', {
                    title: options.title,
                    platform: result.activityType || 'unknown',
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('[SocialSharing] Erreur partage générique:', error);
            return false;
        }
    }
}

export const socialSharing = new SocialSharingService();
export default socialSharing;

