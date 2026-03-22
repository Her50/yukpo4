// ✅ NOUVEAU 2026-03-16: Service de notifications push automatisées pour le Coaching IA
// Architecture: Push local planifié (expo-notifications) — pas de bouton manuel
// Fréquence: 3 notifications/jour (matin, midi, soir) + 1 résumé hebdomadaire
// Son + vibration + texte contextuel dans la langue de l'utilisateur
// Conditionné par l'abonnement coaching mensuel actif (prix défaut ~1000 FCFA dans navigationPricing.coaching_monthly)

import * as Notifications from 'expo-notifications';
import i18n from 'i18next';
import { Platform, Vibration } from 'react-native';
import { notificationUiPreferences } from './notificationUiPreferences';
import SafeStorage from '../utils/safeStorage';

// ══════════════════════════════════════════════════════════════════════
// TYPES DE NOTIFICATIONS COACHING
// ══════════════════════════════════════════════════════════════════════

export type CoachingNotificationType =
    | 'morning_motivation'    // \uD83C\uDF05 Motivation du matin (7h)
    | 'midday_activity'       // \uD83C\uDFC3 Rappel activité (12h30)
    | 'evening_summary'       // \uD83C\uDF19 Résumé du soir (19h)
    | 'weekly_recap'          // \uD83D\uDCCA Bilan hebdomadaire (dimanche 10h)
    | 'streak_reminder'       // \uD83D\uDD25 Rappel de série (si inactif depuis 24h)
    | 'health_alert'          // ❤️ Alerte santé (score < 50)
    | 'eco_milestone'         // \uD83C\uDF3F Jalon écologique (CO2 économisé)
    | 'challenge_progress'    // \uD83C\uDFC6 Progression défi
    | 'new_badge'             // \uD83C\uDF96️ Nouveau badge débloqué
    | 'speed_coaching';       // ⚡ Conseil vitesse en temps réel

// ══════════════════════════════════════════════════════════════════════
// MESSAGES CLÉS — attractifs et compétitifs (traduits via i18n)
// ══════════════════════════════════════════════════════════════════════

interface CoachingMessage {
    titleKey: string;
    bodyKey: string;
    emoji: string;
    sound: boolean;
    vibrate: boolean;
    priority: 'high' | 'default' | 'low';
}

const COACHING_MESSAGES: Record<CoachingNotificationType, CoachingMessage[]> = {
    morning_motivation: [
        { titleKey: 'coaching.morningTitle1', bodyKey: 'coaching.morningBody1', emoji: '\uD83C\uDF05', sound: true, vibrate: false, priority: 'default' },
        { titleKey: 'coaching.morningTitle2', bodyKey: 'coaching.morningBody2', emoji: '\uD83D\uDCAA', sound: true, vibrate: false, priority: 'default' },
        { titleKey: 'coaching.morningTitle3', bodyKey: 'coaching.morningBody3', emoji: '\uD83D\uDE80', sound: true, vibrate: false, priority: 'default' },
    ],
    midday_activity: [
        { titleKey: 'coaching.middayTitle1', bodyKey: 'coaching.middayBody1', emoji: '\uD83C\uDFC3', sound: true, vibrate: true, priority: 'default' },
        { titleKey: 'coaching.middayTitle2', bodyKey: 'coaching.middayBody2', emoji: '\uD83D\uDEB6', sound: true, vibrate: false, priority: 'default' },
        { titleKey: 'coaching.middayTitle3', bodyKey: 'coaching.middayBody3', emoji: '\uD83E\uDDD8', sound: true, vibrate: false, priority: 'default' },
    ],
    evening_summary: [
        { titleKey: 'coaching.eveningTitle1', bodyKey: 'coaching.eveningBody1', emoji: '\uD83C\uDF19', sound: true, vibrate: false, priority: 'default' },
        { titleKey: 'coaching.eveningTitle2', bodyKey: 'coaching.eveningBody2', emoji: '\uD83D\uDCCA', sound: true, vibrate: false, priority: 'default' },
    ],
    weekly_recap: [
        { titleKey: 'coaching.weeklyTitle1', bodyKey: 'coaching.weeklyBody1', emoji: '\uD83D\uDCC8', sound: true, vibrate: true, priority: 'high' },
    ],
    streak_reminder: [
        { titleKey: 'coaching.streakTitle1', bodyKey: 'coaching.streakBody1', emoji: '\uD83D\uDD25', sound: true, vibrate: true, priority: 'high' },
        { titleKey: 'coaching.streakTitle2', bodyKey: 'coaching.streakBody2', emoji: '⏰', sound: true, vibrate: true, priority: 'high' },
    ],
    health_alert: [
        { titleKey: 'coaching.healthTitle1', bodyKey: 'coaching.healthBody1', emoji: '❤️', sound: true, vibrate: true, priority: 'high' },
    ],
    eco_milestone: [
        { titleKey: 'coaching.ecoTitle1', bodyKey: 'coaching.ecoBody1', emoji: '\uD83C\uDF3F', sound: true, vibrate: false, priority: 'default' },
    ],
    challenge_progress: [
        { titleKey: 'coaching.challengeTitle1', bodyKey: 'coaching.challengeBody1', emoji: '\uD83C\uDFC6', sound: true, vibrate: false, priority: 'default' },
    ],
    new_badge: [
        { titleKey: 'coaching.badgeTitle1', bodyKey: 'coaching.badgeBody1', emoji: '\uD83C\uDF96️', sound: true, vibrate: true, priority: 'high' },
    ],
    speed_coaching: [
        { titleKey: 'coaching.speedTitle1', bodyKey: 'coaching.speedBody1', emoji: '⚡', sound: true, vibrate: true, priority: 'high' },
    ],
};

// ══════════════════════════════════════════════════════════════════════
// FRÉQUENCE DES NOTIFICATIONS PUSH
// ══════════════════════════════════════════════════════════════════════

// Heures de push planifié (heure locale)
const PUSH_SCHEDULE = {
    morning: { hour: 7, minute: 0 },     // 7h00 — Motivation du matin
    midday: { hour: 12, minute: 30 },     // 12h30 — Rappel activité
    evening: { hour: 19, minute: 0 },     // 19h00 — Résumé du soir
    weekly: { weekday: 1, hour: 10, minute: 0 }, // Dimanche 10h — Bilan hebdo
};

const COACHING_NOTIF_STORAGE_KEY = 'coaching_scheduled_ids';
const COACHING_LAST_ACTIVITY_KEY = 'coaching_last_activity_ts';
const COACHING_STATS_KEY = 'coaching_notification_stats';
const COACHING_HISTORY_KEY = 'coaching_notification_history'; // Historique pour lecture
const COACHING_ENABLED_KEY = 'coaching_notifications_enabled';

// ══════════════════════════════════════════════════════════════════════
// SERVICE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════

class CoachingNotificationService {
    private scheduledIds: string[] = [];
    private isActive = false;

    /**
     * Activer le coaching push automatique
     * Appelé quand l'abonnement mensuel est activé/renouvelé
     */
    async activate(): Promise<void> {
        // Demander les permissions
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
            const { status: newStatus } = await Notifications.requestPermissionsAsync();
            if (newStatus !== 'granted') {
                console.warn('[CoachingNotif] ⚠️ Permissions refusées');
                return;
            }
        }

        // Configurer le canal Android pour le coaching
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('coaching', {
                name: 'Coach IA Yukpo',
                description: 'Notifications automatiques du coach IA personnalisé',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 200, 100, 200],
                lightColor: '#7C3AED',
                sound: 'default',
            });
            await Notifications.setNotificationChannelAsync('coaching_quiet', {
                name: 'Coach IA Yukpo (sans son)',
                description: 'Visuel + vibration, sans son',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 120, 250, 120, 250],
                lightColor: '#7C3AED',
                enableVibrate: true,
                sound: null,
            });
        }

        // Planifier les 3 push quotidiens + 1 hebdo
        await this.scheduleAllNotifications();
        this.isActive = true;
        await SafeStorage.setItem(COACHING_ENABLED_KEY, 'true').catch(() => { });
        console.log('[CoachingNotif] ✅ Coaching push activé — 3 notifs/jour + 1 hebdo');
    }

    /**
     * Désactiver le coaching push (abonnement expiré ou suspendu)
     */
    async deactivate(): Promise<void> {
        await this.cancelAllScheduled();
        this.isActive = false;
        await SafeStorage.setItem(COACHING_ENABLED_KEY, 'false').catch(() => { });
        console.log('[CoachingNotif] ⛔ Coaching push désactivé');
    }

    /**
     * Restaurer automatiquement les notifications coaching au démarrage
     * si elles étaient explicitement activées avant fermeture/redémarrage.
     */
    async restoreFromPersistedFlag(): Promise<void> {
        try {
            const enabled = await SafeStorage.getItem(COACHING_ENABLED_KEY).catch(() => null);
            if (enabled === 'true') {
                await this.activate();
            }
        } catch {
            // noop
        }
    }

    /** Replanifier les créneaux Coach IA après changement des préférences son (paramètres / historique). */
    async refreshScheduleIfActive(): Promise<void> {
        if (!this.isActive) return;
        try {
            await this.scheduleAllNotifications();
        } catch {
            // noop
        }
    }

    private async resolveCoachSoundAndChannel(
        type: CoachingNotificationType,
        msg: CoachingMessage,
    ): Promise<{ playSound: boolean; channelId: string }> {
        const globalOn = await notificationUiPreferences.getCoachIaSoundFull();
        const subtypeMuted = await notificationUiPreferences.isCoachSubtypeSoundMuted(type);
        const playSound = globalOn && !subtypeMuted && !!msg.sound;
        return {
            playSound,
            channelId: playSound ? 'coaching' : 'coaching_quiet',
        };
    }

    /**
     * Planifier toutes les notifications récurrentes
     */
    private async scheduleAllNotifications(): Promise<void> {
        // Annuler les anciennes d'abord
        await this.cancelAllScheduled();

        const ids: string[] = [];

        // \uD83C\uDF05 Matin — motivation
        const morningId = await this.scheduleDaily(
            'morning_motivation',
            PUSH_SCHEDULE.morning.hour,
            PUSH_SCHEDULE.morning.minute,
        );
        if (morningId) ids.push(morningId);

        // \uD83C\uDFC3 Midi — rappel activité
        const middayId = await this.scheduleDaily(
            'midday_activity',
            PUSH_SCHEDULE.midday.hour,
            PUSH_SCHEDULE.midday.minute,
        );
        if (middayId) ids.push(middayId);

        // \uD83C\uDF19 Soir — résumé
        const eveningId = await this.scheduleDaily(
            'evening_summary',
            PUSH_SCHEDULE.evening.hour,
            PUSH_SCHEDULE.evening.minute,
        );
        if (eveningId) ids.push(eveningId);

        // \uD83D\uDCCA Dimanche — bilan hebdo
        const weeklyId = await this.scheduleWeekly(
            'weekly_recap',
            PUSH_SCHEDULE.weekly.weekday,
            PUSH_SCHEDULE.weekly.hour,
            PUSH_SCHEDULE.weekly.minute,
        );
        if (weeklyId) ids.push(weeklyId);

        this.scheduledIds = ids;
        await SafeStorage.setItem(COACHING_NOTIF_STORAGE_KEY, JSON.stringify(ids)).catch(() => { });
    }

    /**
     * Planifier une notification quotidienne
     */
    private async scheduleDaily(
        type: CoachingNotificationType,
        hour: number,
        minute: number,
    ): Promise<string | null> {
        try {
            const msg = this.pickRandomMessage(type);
            const title = `${msg.emoji} ${i18n.t(msg.titleKey)}`;
            const body = i18n.t(msg.bodyKey);
            const { playSound, channelId } = await this.resolveCoachSoundAndChannel(type, msg);

            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { type: 'coaching', subtype: type },
                    sound: playSound,
                    ...(Platform.OS === 'android' ? { channelId } : {}),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour,
                    minute,
                },
            });
            return id;
        } catch (e) {
            console.warn(`[CoachingNotif] ⚠️ Erreur planification ${type}:`, e);
            return null;
        }
    }

    /**
     * Planifier une notification hebdomadaire
     */
    private async scheduleWeekly(
        type: CoachingNotificationType,
        weekday: number,
        hour: number,
        minute: number,
    ): Promise<string | null> {
        try {
            const msg = this.pickRandomMessage(type);
            const title = `${msg.emoji} ${i18n.t(msg.titleKey)}`;
            const body = i18n.t(msg.bodyKey);
            const { playSound, channelId } = await this.resolveCoachSoundAndChannel(type, msg);

            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { type: 'coaching', subtype: type },
                    sound: playSound,
                    ...(Platform.OS === 'android' ? { channelId } : {}),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                    weekday,
                    hour,
                    minute,
                },
            });
            return id;
        } catch (e) {
            console.warn(`[CoachingNotif] ⚠️ Erreur planification hebdo ${type}:`, e);
            return null;
        }
    }

    /**
     * Annuler toutes les notifications planifiées
     */
    private async cancelAllScheduled(): Promise<void> {
        try {
            const stored = await SafeStorage.getItem(COACHING_NOTIF_STORAGE_KEY).catch(() => null);
            const ids = stored ? JSON.parse(stored) : this.scheduledIds;
            for (const id of ids) {
                await Notifications.cancelScheduledNotificationAsync(id).catch(() => { });
            }
            this.scheduledIds = [];
            await SafeStorage.setItem(COACHING_NOTIF_STORAGE_KEY, '[]').catch(() => { });
        } catch { }
    }

    /**
     * Choisir un message aléatoire pour un type donné
     */
    private pickRandomMessage(type: CoachingNotificationType): CoachingMessage {
        const messages = COACHING_MESSAGES[type];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    /**
     * Enregistrer une notification coaching reçue (push/background) dans l'historique visuel.
     */
    async recordFromNotification(
        subtype: CoachingNotificationType | string,
        title: string,
        body: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        let normalizedType = (String(subtype || '').trim() || 'midday_activity') as CoachingNotificationType;
        if (!COACHING_MESSAGES[normalizedType]) {
            normalizedType = 'midday_activity';
        }
        const msg = this.pickRandomMessage(normalizedType);
        const { playSound } = await this.resolveCoachSoundAndChannel(normalizedType, msg);
        await this.trackNotification(normalizedType, title || 'Coach IA', body || '', metadata, playSound);
    }

    // ══════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS INSTANTANÉES (déclenchées par des événements)
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Envoyer une notification coaching instantanée (événement temps réel)
     */
    async sendInstant(type: CoachingNotificationType, extraData?: Record<string, any>): Promise<void> {
        if (!this.isActive) return;

        const msg = this.pickRandomMessage(type);
        let title = `${msg.emoji} ${i18n.t(msg.titleKey)}`;
        let body = i18n.t(msg.bodyKey);

        // Remplacer les placeholders dynamiques
        if (extraData) {
            Object.entries(extraData).forEach(([key, value]) => {
                title = title.replace(`{{${key}}}`, String(value));
                body = body.replace(`{{${key}}}`, String(value));
            });
        }

        const { playSound, channelId } = await this.resolveCoachSoundAndChannel(type, msg);
        if (!playSound) {
            try { Vibration.vibrate([0, 250, 120, 250, 120, 250]); } catch { }
        } else if (msg.vibrate) {
            try { Vibration.vibrate([0, 200, 100, 200]); } catch { }
        }

        // Notification locale immédiate
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { type: 'coaching', subtype: type, ...extraData },
                    sound: playSound,
                    ...(Platform.OS === 'android' ? { channelId } : {}),
                },
                trigger: null, // Immédiat
            });
        } catch (e) {
            console.warn(`[CoachingNotif] ⚠️ Erreur notif instantanée ${type}:`, e);
        }

        // Tracker les stats + historique
        await this.trackNotification(type, title, body, undefined, playSound);
    }

    /**
     * Vérifier l'inactivité et envoyer un rappel de série
     */
    async checkStreakAndNotify(): Promise<void> {
        if (!this.isActive) return;
        try {
            const lastActivity = await SafeStorage.getItem(COACHING_LAST_ACTIVITY_KEY).catch(() => null);
            if (!lastActivity) return;
            const lastTs = parseInt(lastActivity, 10);
            const hoursSinceLast = (Date.now() - lastTs) / (1000 * 60 * 60);

            if (hoursSinceLast >= 24 && hoursSinceLast < 48) {
                await this.sendInstant('streak_reminder');
            }
        } catch { }
    }

    /**
     * Enregistrer une activité (met à jour le timestamp pour le streak)
     */
    async recordActivity(): Promise<void> {
        await SafeStorage.setItem(COACHING_LAST_ACTIVITY_KEY, String(Date.now())).catch(() => { });
    }

    /**
     * Tracker une notification envoyée (pour stats + historique)
     */
    private async trackNotification(
        type: CoachingNotificationType,
        title: string,
        body: string,
        metadata?: Record<string, any>,
        soundPlayed = true,
    ): Promise<void> {
        try {
            // Stats existantes
            const stored = await SafeStorage.getItem(COACHING_STATS_KEY).catch(() => null);
            const stats = stored ? JSON.parse(stored) : {};
            stats[type] = (stats[type] || 0) + 1;
            stats._total = (stats._total || 0) + 1;
            stats._lastSent = Date.now();
            await SafeStorage.setItem(COACHING_STATS_KEY, JSON.stringify(stats)).catch(() => { });

            // ✅ NOUVEAU: Historique pour lecture
            const historyStored = await SafeStorage.getItem(COACHING_HISTORY_KEY).catch(() => null);
            const history = historyStored ? JSON.parse(historyStored) : [];

            const notificationEntry = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type,
                title,
                body,
                timestamp: Date.now(),
                read: false, // Non lu par défaut
                soundPlayed,
                metadata: metadata || {},
            };

            // Garder seulement les 50 dernières notifications (limite de stockage)
            history.unshift(notificationEntry);
            if (history.length > 50) {
                history.splice(50);
            }

            await SafeStorage.setItem(COACHING_HISTORY_KEY, JSON.stringify(history)).catch(() => { });
        } catch { }
    }

    /**
     * Obtenir les stats de notifications envoyées
     */
    async getStats(): Promise<Record<string, number>> {
        try {
            const stored = await SafeStorage.getItem(COACHING_STATS_KEY).catch(() => null);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    }

    /**
     * ✅ NOUVEAU: Obtenir l'historique des notifications (pour lecture)
     */
    async getHistory(): Promise<Array<{
        id: string;
        type: CoachingNotificationType;
        title: string;
        body: string;
        timestamp: number;
        read: boolean;
        soundPlayed: boolean;
    }>> {
        try {
            const stored = await SafeStorage.getItem(COACHING_HISTORY_KEY).catch(() => null);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    /**
     * ✅ NOUVEAU: Marquer une notification comme lue
     */
    async markAsRead(notificationId: string): Promise<void> {
        try {
            const stored = await SafeStorage.getItem(COACHING_HISTORY_KEY).catch(() => null);
            const history = stored ? JSON.parse(stored) : [];

            const notification = history.find((n: any) => n.id === notificationId);
            if (notification) {
                notification.read = true;
                await SafeStorage.setItem(COACHING_HISTORY_KEY, JSON.stringify(history)).catch(() => { });
            }
        } catch { }
    }

    /**
     * ✅ NOUVEAU: Marquer toutes les notifications comme lues
     */
    async markAllAsRead(): Promise<void> {
        try {
            const stored = await SafeStorage.getItem(COACHING_HISTORY_KEY).catch(() => null);
            const history = stored ? JSON.parse(stored) : [];

            history.forEach((n: any) => n.read = true);
            await SafeStorage.setItem(COACHING_HISTORY_KEY, JSON.stringify(history)).catch(() => { });
        } catch { }
    }

    /**
     * ✅ NOUVEAU: Obtenir le nombre de notifications non lues
     */
    async getUnreadCount(): Promise<number> {
        try {
            const stored = await SafeStorage.getItem(COACHING_HISTORY_KEY).catch(() => null);
            const history = stored ? JSON.parse(stored) : [];
            return history.filter((n: any) => !n.read).length;
        } catch {
            return 0;
        }
    }

    async removeFromHistory(notificationId: string): Promise<void> {
        try {
            const stored = await SafeStorage.getItem(COACHING_HISTORY_KEY).catch(() => null);
            const history = stored ? JSON.parse(stored) : [];
            const filtered = (Array.isArray(history) ? history : []).filter((n: any) => n?.id !== notificationId);
            await SafeStorage.setItem(COACHING_HISTORY_KEY, JSON.stringify(filtered)).catch(() => { });
        } catch { }
    }

    /**
     * Vérifier si le coaching est actif
     */
    getIsActive(): boolean {
        return this.isActive;
    }
}

export const coachingNotificationService = new CoachingNotificationService();
