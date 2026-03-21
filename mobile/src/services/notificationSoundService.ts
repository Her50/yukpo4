/**
 * Service de notifications sonores pour l'application
 * Utilise expo-av pour jouer des sons de notification
 * + Speech/TTS contextuel pour les événements coursier
 */

import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import i18n from 'i18next';

export type NotificationSoundType = 'order' | 'courier' | 'ready' | 'delivery_request';

class NotificationSoundService {
    private sounds: Map<NotificationSoundType, Audio.Sound | null> = new Map();
    private isInitialized = false;

    /**
     * Initialise le service audio
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Configurer le mode audio pour les notifications
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true, // ✅ Activer pour les coursiers
                shouldDuckAndroid: true,
            });

            this.isInitialized = true;
            console.log('[NotificationSoundService] ✅ Service initialisé');
        } catch (error) {
            console.error('[NotificationSoundService] ❌ Erreur initialisation:', error);
        }
    }

    /**
     * Charge un son de notification avec fallback en ligne si le fichier local manque
     */
    private async loadSound(type: NotificationSoundType): Promise<Audio.Sound | null> {
        // Vérifier si le son est déjà chargé
        if (this.sounds.has(type) && this.sounds.get(type)) {
            return this.sounds.get(type)!;
        }

        try {
            await this.initialize();

            let soundSource: any;

            try {
                // Essayer de charger le fichier local d'abord
                soundSource = require('../../assets/sounds/delivery_alert.mp3');
            } catch (localError) {
                // Fallback: utiliser une URL en ligne (son plus court et instantané)
                console.warn('[NotificationSoundService] ⚠️ Fichier local absent, fallback en ligne');
                soundSource = {
                    uri: 'https://actions.google.com/sounds/v1/notifications/notification_simple.ogg'
                };
            }

            // Créer le son avec volume plus élevé pour la bienvenue
            const { sound } = await Audio.Sound.createAsync(
                soundSource,
                {
                    shouldPlay: false,
                    volume: type === 'ready' ? 0.8 : 0.7, // Volume plus élevé pour bienvenue
                    isLooping: false,
                },
                (status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        // Son terminé, replacer au début pour prochaine utilisation
                        sound.setPositionAsync(0).catch(() => { });
                    }
                }
            );

            this.sounds.set(type, sound);
            console.log(`[NotificationSoundService] ✅ Son ${type} chargé avec succès`);
            return sound;
        } catch (error) {
            console.error(`[NotificationSoundService] ❌ Erreur chargement son ${type}:`, error);
            return null;
        }
    }

    /**
     * Joue un son de notification
     */
    async playSound(type: NotificationSoundType): Promise<void> {
        try {
            const sound = await this.loadSound(type);

            if (!sound) {
                console.warn(`[NotificationSoundService] ⚠️ Son ${type} non disponible`);
                return;
            }

            // Réinitialiser la position si le son a déjà été joué
            await sound.setPositionAsync(0);

            // Jouer le son
            await sound.playAsync();

            console.log(`[NotificationSoundService] \uD83D\uDD0A Son ${type} joué`);
        } catch (error) {
            console.error(`[NotificationSoundService] ❌ Erreur lecture son ${type}:`, error);
        }
    }

    /**
     * Arrête un son en cours
     */
    async stopSound(type: NotificationSoundType): Promise<void> {
        try {
            const sound = this.sounds.get(type);
            if (sound) {
                await sound.stopAsync();
                await sound.setPositionAsync(0);
            }
        } catch (error) {
            console.error(`[NotificationSoundService] ❌ Erreur arrêt son ${type}:`, error);
        }
    }

    /**
     * Nettoie tous les sons chargés
     */
    async cleanup(): Promise<void> {
        try {
            for (const [type, sound] of this.sounds.entries()) {
                if (sound) {
                    try {
                        await sound.stopAsync();
                        await sound.unloadAsync();
                    } catch (error) {
                        // Ignorer les erreurs de nettoyage
                    }
                }
            }
            this.sounds.clear();
            console.log('[NotificationSoundService] \uD83E\uDDF9 Sons nettoyés');
        } catch (error) {
            console.error('[NotificationSoundService] ❌ Erreur nettoyage:', error);
        }
    }

    /**
     * Précharge tous les sons pour une lecture plus rapide + préchauffage TTS
     */
    async preloadAllSounds(): Promise<void> {
        try {
            await this.initialize();
            await Promise.all([
                this.loadSound('order'),
                this.loadSound('courier'),
                this.loadSound('ready'),
                this.loadSound('delivery_request'),
            ]);

            // Préchauffer TTS pour un démarrage instantané de la bienvenue
            await this.warmupTTS();

            console.log('[NotificationSoundService] ✅ Tous les sons préchargés + TTS prêt');
        } catch (error) {
            console.error('[NotificationSoundService] ❌ Erreur préchargement:', error);
        }
    }

    /**
     * ✅ FIX 2026-03-03: Joue un son de notification avec vibration
     * Utile pour les alertes critiques (nouvelle livraison, coursier trouvé)
     */
    async playSoundWithVibration(type: NotificationSoundType): Promise<void> {
        try {
            // Vibrer d'abord pour attirer l'attention
            const { Vibration } = require('react-native');
            Vibration.vibrate([0, 300, 100, 300]); // pattern: pause, vibrate, pause, vibrate
        } catch (vibError) {
            console.warn('[NotificationSoundService] Vibration non disponible:', vibError);
        }
        // Puis jouer le son
        await this.playSound(type);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── MESSAGE DE BIENVENUE (première ouverture après installation) ─────
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Retourne le message de bienvenue dans la langue de l'utilisateur.
     * Message simplifié, impactant, orienté innovation + assistant IA.
     * IMPORTANT: version internationale (sans référence régionale).
     */
    private getWelcomeMessage(lang: string): string {
        const normalized = String(lang || 'en').toLowerCase().split('-')[0];
        const fallbackAlias: Record<string, string> = {
            // African language variants / low-resource locales -> closest available voice translation
            ewo: 'fr', dua: 'fr', bas: 'fr', bbj: 'fr', bum: 'fr', bci: 'fr', dyu: 'fr', bet: 'fr',
            mos: 'fr', dje: 'fr', ee: 'fr', kbp: 'fr', sar: 'fr', sg: 'fr', kg: 'fr', lua: 'fr',
            fan: 'fr', st: 'en', rn: 'fr', srr: 'fr', af: 'en', bm: 'fr',
            // Caribbean / regional fallbacks
            pap: 'es', pcm: 'en',
            // Generic safe fallback
            ms: 'en', tl: 'en', vi: 'en', th: 'en', bn: 'en', tr: 'en', uk: 'en', pl: 'en',
            it: 'it', nl: 'nl',
        };
        const key = fallbackAlias[normalized] || normalized;

        const messages: Record<string, string> = {
            fr: 'Bienvenue sur Yukpo. Je suis là pour vous aider.',
            en: 'Welcome to Yukpo. I am here to help you.',
            de: 'Willkommen bei Yukpo. Ich bin hier, um zu helfen.',
            es: 'Bienvenido a Yukpo. Estoy aquí para ayudarte.',
            pt: 'Bem-vindo ao Yukpo. Estou aqui para ajudar.',
            it: 'Benvenuto su Yukpo. Sono qui per aiutarti.',
            nl: 'Welkom bij Yukpo. Ik ben hier om te helpen.',
            pl: 'Witamy w Yukpo. Jestem tutaj, aby pomóc.',
            uk: 'Ласкаво просимо до Yukpo. Я тут, щоб допомогти.',
            tr: 'Yukpo\'ya hoş geldiniz. Yardım etmek için buradayım.',
            ru: 'Добро пожаловать в Yukpo. Я здесь, чтобы помочь.',
            zh: '欢迎来到Yukpo。我在这里帮助您。',
            ja: 'Yukpoへようこそ。お手伝いするためにここにいます。',
            ko: 'Yukpo에 오신 것을 환영합니다. 도와드리기 위해 여기에 있습니다.',
            hi: 'Yukpo में आपका स्वागत है। मैं आपकी मदद के लिए यहाँ हूँ।',
            ar: 'مرحبًا بك في Yukpo. أنا هنا لمساعدتك.',
            sw: 'Karibu Yukpo. Niko hapa kukusaidia.',
            ha: 'Barka da zuwa Yukpo. Ina nan taimaka muku.',
            yo: 'Kaabo si Yukpo. Wa nibi lati ran lowọ ẹ.',
            ig: 'Nnọọ na Yukpo. A m ebe a iji nyere gị aka.',
            am: 'ወደ Yukpo እንኳን ደህና መጡ። እኔ እርዳታ ለመስጠን እዚህ ነኝ።',
            zu: 'Siyakwamukela ku-Yukpo. Ngingakho ukukusiza.',
            wo: 'Dalal ak jàmm ci Yukpo. Ma ngi nii ngir leeral sa.',
            ln: 'Boyei malamu na Yukpo. Nazali wana kokamba yo.',
            ff: 'A jaaraama e Yukpo. Mi nan e ngam wallude ma.',
            rw: 'Murakaza neza kuri Yukpo. Ndi hano kugufasha.',
            sn: 'Mauya kuYukpo. Ndiri pano kukubatsiridza.',
            so: 'Ku soo dhawoow Yukpo. Waan halkan kaa caawin lahayada.',
            mg: 'Tongasoa eto amin'i Yukpo.Eto no hanampy anao.',
            ht: 'Byenveni sou Yukpo. Mwen la pou ede w.',
        };
        return messages[key] || messages['en'];
    }

    /**
     * Préchauffe le moteur TTS pour un démarrage instantané
     */
    async warmupTTS(): Promise<void> {
        try {
            // Préchauffage TTS avec un message très court
            await Speech.speak('', {
                language: this.getTTSLanguage(),
                pitch: 1.0,
                rate: 1.0,
                volume: 0.0, // Volume muet pour le préchauffage
            });
            console.log('[NotificationSoundService] 🔥 TTS préchauffé');
        } catch (error) {
            // Le préchauffage peut échouer, ce n'est pas critique
            console.log('[NotificationSoundService] ⚠️ Préchauffage TTS ignoré');
        }
    }

    /**
     * Joue la notification de bienvenue unique au premier lancement.
     * Son de bienvenue + message TTS dans la langue de l'utilisateur.
     */
    async playWelcomeMessage(): Promise<void> {
        try {
            await this.initialize();

            console.log('[NotificationSoundService] 🎉 Lecture message de bienvenue');

            // 1. Préchauffer TTS PENDANT le son de bienvenue
            this.warmupTTS(); // Non bloquant

            // 2. Jouer un son de bienvenue (réutilise le son 'ready' comme chime)
            await this.playSound('ready').catch(() => { });

            // 3. Message TTS très court pour démarrage instantané
            const lang = i18n.language || 'fr';
            const message = this.getWelcomeMessage(lang);
            const ttsLang = this.getTTSLanguage();

            // Démarrer TTS immédiatement après le son (pas d'attente)
            Speech.speak(message, {
                language: ttsLang,
                pitch: 1.05,
                rate: 0.85, // Légèrement plus lent pour la bienvenue
                volume: 0.8, // Volume plus clair pour la bienvenue
                onError: (e) => console.warn('[NotificationSoundService] TTS bienvenue erreur:', e),
                onDone: () => console.log('[NotificationSoundService] ✅ Message de bienvenue terminé'),
            });
        } catch (error) {
            console.error('[NotificationSoundService] ❌ Erreur message bienvenue:', error);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── NOTIFICATIONS CONTEXTUELLES VOCALES (Speech/TTS) ────────────────
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Mappe le code langue i18n vers un code BCP-47 compatible Speech/TTS
     */
    private getTTSLanguage(): string {
        const langMap: Record<string, string> = {
            fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', pt: 'pt-BR',
            zh: 'zh-CN', ja: 'ja-JP', hi: 'hi-IN', ar: 'ar-SA', ru: 'ru-RU',
            sw: 'sw-KE', ha: 'ha-NG', yo: 'yo-NG', am: 'am-ET', wo: 'wo-SN',
            zu: 'zu-ZA', ig: 'ig-NG', ln: 'ln-CD', ff: 'ff-GN', rw: 'rw-RW',
            sn: 'sn-ZW', so: 'so-SO', ti: 'ti-ER', mg: 'mg-MG',
            ht: 'ht-HT', pap: 'es-ES',
            // broader app-language coverage with practical fallbacks
            af: 'en-ZA', bm: 'fr-FR', bas: 'fr-FR', bbj: 'fr-FR', bci: 'fr-FR', bet: 'fr-FR',
            bum: 'fr-FR', dje: 'fr-FR', dua: 'fr-FR', dyu: 'fr-FR', ee: 'fr-FR', ewo: 'fr-FR',
            fan: 'fr-FR', kbp: 'fr-FR', kg: 'fr-FR', ko: 'ko-KR', lua: 'fr-FR', mos: 'fr-FR',
            ms: 'en-US', nl: 'nl-NL', pcm: 'en-US', pl: 'pl-PL', rn: 'fr-FR', sar: 'fr-FR',
            sg: 'fr-FR', srr: 'fr-FR', st: 'en-US', th: 'th-TH', tl: 'en-US', tr: 'tr-TR',
            uk: 'uk-UA', vi: 'vi-VN', xh: 'en-ZA',
        };
        const current = i18n.language || 'fr';
        const normalized = String(current).toLowerCase().split('-')[0];
        return langMap[normalized] || 'en-US';
    }

    /**
     * Génère un message vocal contextuel pour un événement de livraison
     * Utilise les traductions i18n dans la langue choisie par l'utilisateur
     */
    private getDeliveryContextualMessage(
        eventType: string,
        details?: { courierName?: string; etaMinutes?: number; distance?: string; itemCount?: number; destination?: string }
    ): string {
        const t = i18n.t.bind(i18n);
        const courier = details?.courierName || t('menu.user');
        const eta = details?.etaMinutes;
        const dest = details?.destination || '';

        switch (eventType) {
            case 'courier_found':
                return eta
                    ? t('delivery_notifications.courier_found', { courier, eta })
                    : t('delivery_notifications.courier_found_no_eta', { courier });
            case 'courier_searching':
                return t('delivery_notifications.courier_searching');
            case 'courier_en_route_pickup':
                return eta
                    ? t('delivery_notifications.courier_en_route_pickup', { courier, eta })
                    : t('delivery_notifications.courier_en_route_pickup_no_eta', { courier });
            case 'courier_arrived_pickup':
                return t('delivery_notifications.courier_arrived_pickup', { courier });
            case 'courier_picked_up':
                return t('delivery_notifications.courier_picked_up', { courier, dest });
            case 'courier_en_route_delivery':
                return eta
                    ? t('delivery_notifications.courier_en_route_delivery', { courier, eta })
                    : t('delivery_notifications.courier_en_route_delivery_no_eta', { courier });
            case 'courier_arrived_destination':
                return t('delivery_notifications.courier_arrived_destination', { courier });
            case 'delivery_completed':
                return t('delivery_notifications.delivery_completed');
            case 'shopping_in_progress':
                return details?.itemCount
                    ? t('delivery_notifications.shopping_in_progress', { courier, count: details.itemCount })
                    : t('delivery_notifications.shopping_in_progress_no_count', { courier });
            case 'shopping_completed':
                return t('delivery_notifications.shopping_completed', { courier });
            case 'delivery_cancelled':
                return t('delivery_notifications.delivery_cancelled');
            case 'new_delivery_available':
                return details?.distance
                    ? t('delivery_notifications.new_delivery_available', { distance: details.distance })
                    : t('delivery_notifications.new_delivery_available_no_distance');
            default:
                return t('delivery_notifications.default', { event: eventType });
        }
    }

    /**
     * Notification vocale contextuelle pour les événements de livraison.
     * Joue un son + parole TTS + notification push locale.
     * Fonctionne même en arrière-plan grâce à la notification push locale.
     */
    async notifyDeliveryEvent(
        eventType: string,
        details?: { courierName?: string; etaMinutes?: number; distance?: string; itemCount?: number; destination?: string },
        options?: { playSound?: boolean; speak?: boolean; pushNotification?: boolean }
    ): Promise<void> {
        const opts = { playSound: true, speak: true, pushNotification: true, ...options };
        const message = this.getDeliveryContextualMessage(eventType, details);

        console.log(`[NotificationSoundService] \uD83D\uDD14 Événement livraison: ${eventType} → "${message}"`);

        // 1. Vibration
        try {
            const { Vibration } = require('react-native');
            Vibration.vibrate([0, 300, 100, 300]);
        } catch { }

        // 2. Son contextuel
        if (opts.playSound) {
            const soundType: NotificationSoundType =
                eventType === 'courier_found' || eventType === 'courier_searching' ? 'courier'
                    : eventType === 'delivery_completed' || eventType === 'shopping_completed' ? 'ready'
                        : eventType === 'new_delivery_available' ? 'delivery_request'
                            : 'order';
            await this.playSound(soundType).catch(e => console.warn('[NotificationSoundService] Son:', e));
        }

        // 3. Parole TTS contextuelle (avec délai pour laisser le son finir)
        if (opts.speak) {
            setTimeout(() => {
                Speech.speak(message, {
                    language: this.getTTSLanguage(),
                    pitch: 1.0,
                    rate: 0.9,
                    onError: (e) => console.warn('[NotificationSoundService] TTS erreur:', e),
                });
            }, 1500);
        }

        // 4. Notification push locale (visible même app fermée / en arrière-plan)
        if (opts.pushNotification) {
            const t = i18n.t.bind(i18n);
            const titleMap: Record<string, string> = {
                courier_found: t('delivery_notifications.push_courier_found'),
                courier_searching: t('delivery_notifications.push_courier_searching'),
                courier_en_route_pickup: t('delivery_notifications.push_courier_en_route_pickup'),
                courier_arrived_pickup: t('delivery_notifications.push_courier_arrived_pickup'),
                courier_picked_up: t('delivery_notifications.push_courier_picked_up'),
                courier_en_route_delivery: t('delivery_notifications.push_courier_en_route_delivery'),
                courier_arrived_destination: t('delivery_notifications.push_courier_arrived_destination'),
                delivery_completed: t('delivery_notifications.push_delivery_completed'),
                shopping_in_progress: t('delivery_notifications.push_shopping_in_progress'),
                shopping_completed: t('delivery_notifications.push_shopping_completed'),
                delivery_cancelled: t('delivery_notifications.push_delivery_cancelled'),
                new_delivery_available: t('delivery_notifications.push_new_delivery_available'),
            };

            try {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: titleMap[eventType] || t('delivery_notifications.push_default'),
                        body: message,
                        sound: true,
                        data: { type: 'delivery_event', eventType, ...details },
                    },
                    trigger: null, // Immédiat
                });
            } catch (e) {
                console.warn('[NotificationSoundService] Push locale:', e);
            }
        }
    }
}

// Instance singleton
export const notificationSoundService = new NotificationSoundService();

