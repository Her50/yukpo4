// ✅ NOUVEAU 2026-03-16: Service de notifications sonores pour alertes communautaires
// Architecture: Son + vibration + facturation PAR ALERTE UNIQUE (pas par notification)
// ✅ FIX 2026-03-18: Facturation associée au checkpoint, pas au nombre de rappels
// Un même checkpoint n'est facturé qu'UNE SEULE FOIS par session de tracking
// (les seuils progressifs 10km→5km→2km→500m sont des rappels gratuits)
// Intégré au système de paiement existant via useNavigationPayment

import * as Notifications from 'expo-notifications';
import i18n from 'i18next';
import { Platform, Vibration } from 'react-native';
import { useNavigationPayment } from '../hooks/useNavigationPayment';
import { formatPriceInCurrency, getMicroFeaturePrice } from './navigationPricing';

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
        { titleKey: 'communityAlert.newCheckpointTitle', bodyKey: 'communityAlert.newCheckpointBody', emoji: '\uD83D\uDEA8', sound: true, vibrate: true, priority: 'high' },
    ],
    speed_alert: [
        { titleKey: 'communityAlert.speedAlertTitle', bodyKey: 'communityAlert.speedAlertBody', emoji: '⚡', sound: true, vibrate: true, priority: 'high' },
    ],
    danger_zone: [
        { titleKey: 'communityAlert.dangerZoneTitle', bodyKey: 'communityAlert.dangerZoneBody', emoji: '⚠️', sound: true, vibrate: true, priority: 'high' },
    ],
    traffic_jam: [
        { titleKey: 'communityAlert.trafficJamTitle', bodyKey: 'communityAlert.trafficJamBody', emoji: '\uD83D\uDE97', sound: true, vibrate: false, priority: 'default' },
    ],
    accident_report: [
        { titleKey: 'communityAlert.accidentTitle', bodyKey: 'communityAlert.accidentBody', emoji: '\uD83D\uDCA5', sound: true, vibrate: true, priority: 'high' },
    ],
    police_control: [
        { titleKey: 'communityAlert.policeTitle', bodyKey: 'communityAlert.policeBody', emoji: '\uD83D\uDC6E', sound: true, vibrate: true, priority: 'high' },
    ],
    road_work: [
        { titleKey: 'communityAlert.roadWorkTitle', bodyKey: 'communityAlert.roadWorkBody', emoji: '\uD83D\uDEA7', sound: true, vibrate: false, priority: 'default' },
    ],
    weather_alert: [
        { titleKey: 'communityAlert.weatherTitle', bodyKey: 'communityAlert.weatherBody', emoji: '\uD83C\uDF27️', sound: true, vibrate: true, priority: 'high' },
    ],
};

class CommunityAlertSoundService {
    private static instance: CommunityAlertSoundService;
    private isInitialized = false;
    // ✅ FIX 2026-03-18: Dedup par session — un checkpoint n'est facturé qu'une fois
    private billedCheckpointIds: Set<string> = new Set();

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
     * ✅ FIX 2026-03-18: Facturation PAR CHECKPOINT UNIQUE, pas par notification
     * Les rappels progressifs (seuils 10km→5km→2km→500m) sont gratuits
     * @param type Type d'alerte
     * @param checkpointId ID unique du checkpoint (pour dedup facturation)
     * @param extraData Données additionnelles (position, description, etc.)
     * @param paymentHook Hook de paiement pour débiter
     */
    async sendAlertSound(
        type: CommunityAlertType,
        extraData?: Record<string, any>,
        paymentHook?: ReturnType<typeof useNavigationPayment>,
        checkpointId?: string,
        notificationOverrides?: { sound?: boolean; vibrate?: boolean }
    ): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // ✅ FIX 2026-03-18: Ne facturer qu'une seule fois par checkpoint par session
        const alreadyBilled = checkpointId ? this.billedCheckpointIds.has(checkpointId) : false;

        // Récupérer le prix de l'alerte sonore
        const cost = getMicroFeaturePrice('community_alerts_sound');
        const userCurrency = paymentHook?.userCurrency || 'XAF';
        const costFormatted = formatPriceInCurrency(cost, userCurrency);

        // Facturer UNIQUEMENT si c'est la première notification pour ce checkpoint
        if (paymentHook && cost > 0 && !alreadyBilled) {
            const hasEnoughBalance = paymentHook.hasEnoughBalance(cost);
            if (!hasEnoughBalance) {
                console.warn('[CommunityAlertSound] ⚠️ Solde insuffisant pour alerte sonore');
                return false;
            }

            // Débiter le compte (une seule fois par checkpoint)
            const debitResult = await paymentHook.debitAccount(cost, `Alerte communautaire: ${type}`);
            if (!debitResult.success) {
                console.warn('[CommunityAlertSound] ❌ Échec débit compte pour alerte sonore');
                return false;
            }

            // Marquer ce checkpoint comme facturé pour cette session
            if (checkpointId) {
                this.billedCheckpointIds.add(checkpointId);
            }
            console.log(`[CommunityAlertSound] \uD83D\uDCB0 ${cost} XAF débités pour checkpoint ${checkpointId || type} (1ère notification)`);
        } else if (alreadyBilled) {
            console.log(`[CommunityAlertSound] ✅ Rappel gratuit pour checkpoint ${checkpointId} (déjà facturé cette session)`);
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
            const shouldVibrate = notificationOverrides?.vibrate ?? soundConfig.vibrate;
            if (shouldVibrate) {
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
                    sound: notificationOverrides?.sound ?? soundConfig.sound,
                    ...(Platform.OS === 'android' ? { channelId: 'community_alerts' } : {}),
                },
                trigger: null, // Immédiat
            });

            console.log(`[CommunityAlertSound] \uD83D\uDD14 Alert sonore envoyée: ${type}`);
            return true;

        } catch (error) {
            console.error(`[CommunityAlertSound] ❌ Erreur envoi alert sonore ${type}:`, error);

            // Rembourser si le débit a été fait mais la notification a échoué
            if (paymentHook && cost > 0) {
                try {
                    await paymentHook.debitAccount(-cost, `Remboursement alerte sonore échouée: ${type}`);
                    console.log(`[CommunityAlertSound] \uD83D\uDCB8 Remboursement ${cost} XAF effectué`);
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
        extraData?: Record<string, any>,
        notificationOverrides?: { sound?: boolean; vibrate?: boolean }
    ): Promise<boolean> {
        return this.sendAlertSound(type, extraData, undefined, undefined, notificationOverrides);
    }

    /**
     * ✅ FIX 2026-03-18: Réinitialiser la session de facturation
     * À appeler quand le tracking s'arrête (stopTracking / stopFreeWalking)
     */
    resetBillingSession(): void {
        const count = this.billedCheckpointIds.size;
        this.billedCheckpointIds.clear();
        console.log(`[CommunityAlertSound] \uD83D\uDD04 Session réinitialisée (${count} checkpoints facturés cette session)`);
    }

    /**
     * Vérifier si un checkpoint a déjà été facturé cette session
     */
    isCheckpointBilled(checkpointId: string): boolean {
        return this.billedCheckpointIds.has(checkpointId);
    }

    /**
     * Obtenir le prix d'une alerte sonore (par checkpoint unique, pas par notification)
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
