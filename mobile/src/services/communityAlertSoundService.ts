// ✅ NOUVEAU 2026-03-16: Service de notifications sonores pour alertes communautaires
// Architecture: Son + vibration + facturation par notification (15 XAF)
// Intégré au système de paiement existant via useNavigationPayment

import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';
import i18n from 'i18next';
import { useNavigationPayment } from '../hooks/useNavigationPayment';
import { getMicroFeaturePrice, formatPriceInCurrency } from './navigationPricing';

export type CommunityAlertType = 
    | 'new_checkpoint'      // Nouveau point de contrôle signalé
    | 'speed_alert'         // Alerte vitesse/radar
    | 'danger_zone'         // Zone dangereuse
    | 'traffic_jam'         // Embouteillage
    | 'accident_report'     // Accident signalé
    | 'police_control'      // Contrôle police
    | 'road_work'           // Travaux routiers
    | 'weather_alert';       // Alerte météo (pluie, verglas)

interface CommunityAlertSound {
    type: CommunityAlertType;
    titleKey: string;
    bodyKey: string;
    emoji: string;
    sound: boolean;
    vibrate: boolean;
    priority: 'high' | 'default';
}

const COMMUNITY_ALERT_SOUNDS: Record<CommunityAlertType, CommunityAlertSound[]> = {
    new_checkpoint: [
        { titleKey: 'communityAlert.newCheckpointTitle', bodyKey: 'communityAlert.newCheckpointBody', emoji: '🚨', sound: true, vibrate: true, priority: 'high' },
    ],
    speed_alert: [
        { titleKey: 'communityAlert.speedAlertTitle', bodyKey: 'communityAlert.speedAlertBody', emoji: '⚡', sound: true, vibrate: true, priority: 'high' },
    ],
    danger_zone: [
        { titleKey: 'communityAlert.dangerZoneTitle', bodyKey: 'communityAlert.dangerZoneBody', emoji: '⚠️', sound: true, vibrate: true, priority: 'high' },
    ],
    traffic_jam: [
        { titleKey: 'communityAlert.trafficJamTitle', bodyKey: 'communityAlert.trafficJamBody', emoji: '🚗', sound: true, vibrate: false, priority: 'default' },
    ],
    accident_report: [
        { titleKey: 'communityAlert.accidentTitle', bodyKey: 'communityAlert.accidentBody', emoji: '💥', sound: true, vibrate: true, priority: 'high' },
    ],
    police_control: [
        { titleKey: 'communityAlert.policeTitle', bodyKey: 'communityAlert.policeBody', emoji: '👮', sound: true, vibrate: true, priority: 'high' },
    ],
    road_work: [
        { titleKey: 'communityAlert.roadWorkTitle', bodyKey: 'communityAlert.roadWorkBody', emoji: '🚧', sound: true, vibrate: false, priority: 'default' },
    ],
    weather_alert: [
        { titleKey: 'communityAlert.weatherTitle', bodyKey: 'communityAlert.weatherBody', emoji: '🌧️', sound: true, vibrate: true, priority: 'high' },
    ],
};

class CommunityAlertSoundService {
    private static instance: CommunityAlertSoundService;
    private isInitialized = false;

    private constructor() {
        this.initialize();
    }

    public static getInstance(): CommunityAlertSoundService {
        if (!CommunityAlertSoundService.instance) {
            CommunityAlertSoundService.instance = new CommunityAlertSoundService();
        }
        return CommunityAlertSoundService.instance;
    }

    private async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Configurer le canal Android pour les alertes communautaires
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('community_alerts', {
                    name: 'Alertes Communautaires',
                    description: 'Notifications sonores des alertes communautaires',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 200, 100, 200],
                    lightColor: '#EF4444',
                    sound: 'default',
                });
            }

            this.isInitialized = true;
            console.log('[CommunityAlertSound] ✅ Service initialisé');
        } catch (error) {
            console.error('[CommunityAlertSound] ❌ Erreur initialisation:', error);
        }
    }

    /**
     * Envoyer une notification sonore d'alerte communautaire (avec facturation)
     * @param type Type d'alerte
     * @param extraData Données additionnelles (position, description, etc.)
     * @param paymentHook Hook de paiement pour débiter 15 XAF
     */
    async sendAlertSound(
        type: CommunityAlertType,
        extraData?: Record<string, any>,
        paymentHook?: ReturnType<typeof useNavigationPayment>
    ): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Récupérer le prix de l'alerte sonore
        const cost = getMicroFeaturePrice('community_alerts_sound');
        const userCurrency = paymentHook?.userCurrency || 'XAF';
        const costFormatted = formatPriceInCurrency(cost, userCurrency);

        // Vérifier le paiement si hook fourni
        if (paymentHook && cost > 0) {
            const hasEnoughBalance = paymentHook.hasEnoughBalance(cost);
            if (!hasEnoughBalance) {
                console.warn('[CommunityAlertSound] ⚠️ Solde insuffisant pour alerte sonore');
                return false;
            }

            // Débiter le compte
            const debitResult = await paymentHook.debitAccount(cost, `Alerte sonore communautaire: ${type}`);
            if (!debitResult.success) {
                console.warn('[CommunityAlertSound] ❌ Échec débit compte pour alerte sonore');
                return false;
            }

            console.log(`[CommunityAlertSound] 💰 ${cost} XAF débités pour alerte sonore ${type}`);
        }

        try {
            const soundConfig = COMMUNITY_ALERT_SOUNDS[type]?.[0];
            if (!soundConfig) {
                console.warn(`[CommunityAlertSound] ⚠️ Type d'alerte inconnu: ${type}`);
                return false;
            }

            // Construire le message
            let title = `${soundConfig.emoji} ${i18n.t(soundConfig.titleKey)}`;
            let body = i18n.t(soundConfig.bodyKey);

            // Remplacer les placeholders dynamiques
            if (extraData) {
                Object.entries(extraData).forEach(([key, value]) => {
                    title = title.replace(`{{${key}}}`, String(value));
                    body = body.replace(`{{${key}}}`, String(value));
                });
            }

            // Vibration
            if (soundConfig.vibrate) {
                try { 
                    Vibration.vibrate([0, 200, 100, 200]); 
                } catch { }
            }

            // Notification locale immédiate
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { type: 'community_alert_sound', subtype: type, ...extraData },
                    sound: soundConfig.sound,
                    ...(Platform.OS === 'android' ? { channelId: 'community_alerts' } : {}),
                },
                trigger: null, // Immédiat
            });

            console.log(`[CommunityAlertSound] 🔔 Alert sonore envoyée: ${type}`);
            return true;

        } catch (error) {
            console.error(`[CommunityAlertSound] ❌ Erreur envoi alert sonore ${type}:`, error);
            
            // Rembourser si le débit a été fait mais la notification a échoué
            if (paymentHook && cost > 0) {
                try {
                    await paymentHook.debitAccount(-cost, `Remboursement alerte sonore échouée: ${type}`);
                    console.log(`[CommunityAlertSound] 💸 Remboursement ${cost} XAF effectué`);
                } catch (refundError) {
                    console.error('[CommunityAlertSound] ❌ Erreur remboursement:', refundError);
                }
            }
            
            return false;
        }
    }

    /**
     * Envoyer une alerte sonore sans facturation (pour les tests ou alertes gratuites)
     */
    async sendFreeAlertSound(
        type: CommunityAlertType,
        extraData?: Record<string, any>
    ): Promise<boolean> {
        return this.sendAlertSound(type, extraData, undefined);
    }

    /**
     * Obtenir le prix d'une alerte sonore
     */
    getAlertSoundPrice(): number {
        return getMicroFeaturePrice('community_alerts_sound');
    }

    /**
     * Obtenir le prix formaté dans la devise utilisateur
     */
    getAlertSoundPriceFormatted(currency: string): string {
        const cost = this.getAlertSoundPrice();
        return formatPriceInCurrency(cost, currency);
    }
}

export const communityAlertSoundService = new CommunityAlertSoundService();
