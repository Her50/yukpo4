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
     * Charge un son de notification
     */
    private async loadSound(type: NotificationSoundType): Promise<Audio.Sound | null> {
        // Vérifier si le son est déjà chargé
        if (this.sounds.has(type) && this.sounds.get(type)) {
            return this.sounds.get(type)!;
        }

        try {
            await this.initialize();

            // Déterminer la source du son
            // ✅ FIX 2026-03-03: Utiliser delivery_alert.mp3 (seul fichier existant) comme source principale
            // pour tous les types de notifications, avec fallback en ligne
            let soundSource: any;

            try {
                // ✅ AMÉLIORATION: Utiliser des fichiers audio distincts pour chaque type
                switch (type) {
                    case 'order':
                        soundSource = require('../../assets/sounds/order_notification.mp3');
                        break;
                    case 'delivery_request':
                        soundSource = require('../../assets/sounds/delivery_request.mp3');
                        break;
                    case 'courier':
                        soundSource = require('../../assets/sounds/courier_alert.mp3');
                        break;
                    case 'ready':
                        soundSource = require('../../assets/sounds/ready_notification.mp3');
                        break;
                    default:
                        soundSource = require('../../assets/sounds/delivery_alert.mp3');
                        break;
                }
            } catch {
                // Fallback en ligne si les fichiers locaux ne sont pas trouvés
                switch (type) {
                    case 'order':
                        soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' };
                        break;
                    case 'delivery_request':
                        soundSource = { uri: 'https://actions.google.com/sounds/v1/notifications/ting.ogg' };
                        break;
                    case 'courier':
                        soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' };
                        break;
                    case 'ready':
                        soundSource = { uri: 'https://actions.google.com/sounds/v1/notifications/notification.ogg' };
                        break;
                    default:
                        soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' };
                        break;
                }
            }

            // Créer le son
            const { sound } = await Audio.Sound.createAsync(
                soundSource,
                {
                    shouldPlay: false,
                    volume: 0.7, // Volume modéré
                    isLooping: false,
                },
                (status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        // Son terminé, nettoyer si nécessaire
                        sound.unloadAsync().catch(() => {
                            // Ignorer les erreurs de nettoyage
                        });
                    }
                }
            );

            this.sounds.set(type, sound);
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

            console.log(`[NotificationSoundService] 🔊 Son ${type} joué`);
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
            console.log('[NotificationSoundService] 🧹 Sons nettoyés');
        } catch (error) {
            console.error('[NotificationSoundService] ❌ Erreur nettoyage:', error);
        }
    }

    /**
     * Précharge tous les sons pour une lecture plus rapide
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
            console.log('[NotificationSoundService] ✅ Tous les sons préchargés');
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
     * Messages pré-traduits pour garantir la qualité TTS.
     */
    private getWelcomeMessage(lang: string): string {
        const messages: Record<string, string> = {
            fr: 'Bienvenue sur Yukpo ! Votre assistant intelligent pour tous vos besoins. Nous sommes ravis de vous accueillir.',
            en: 'Welcome to Yukpo! Your smart assistant for all your needs. We are delighted to have you.',
            de: 'Willkommen bei Yukpo! Ihr intelligenter Assistent für alle Ihre Bedürfnisse. Wir freuen uns, Sie zu begrüßen.',
            es: '¡Bienvenido a Yukpo! Tu asistente inteligente para todas tus necesidades. Estamos encantados de recibirte.',
            pt: 'Bem-vindo ao Yukpo! Seu assistente inteligente para todas as suas necessidades. Estamos felizes em recebê-lo.',
            it: 'Benvenuto su Yukpo! Il tuo assistente intelligente per tutte le tue esigenze. Siamo felici di accoglierti.',
            nl: 'Welkom bij Yukpo! Uw slimme assistent voor al uw behoeften. Wij zijn blij u te verwelkomen.',
            pl: 'Witamy w Yukpo! Twój inteligentny asystent na każdą potrzebę. Cieszymy się, że jesteś z nami.',
            uk: 'Ласкаво просимо до Yukpo! Ваш розумний помічник для всіх потреб. Ми раді вітати вас.',
            tr: 'Yukpo\'ya hoş geldiniz! Tüm ihtiyaçlarınız için akıllı asistanınız. Sizi ağırlamaktan mutluluk duyuyoruz.',
            ru: 'Добро пожаловать в Yukpo! Ваш умный помощник для всех ваших нужд. Мы рады приветствовать вас.',
            zh: '欢迎来到Yukpo！您的智能助手，满足您的一切需求。我们很高兴欢迎您。',
            ja: 'Yukpoへようこそ！あらゆるニーズに応えるスマートアシスタントです。ようこそお越しくださいました。',
            ko: 'Yukpo에 오신 것을 환영합니다! 모든 필요를 위한 스마트 어시스턴트입니다. 환영합니다.',
            hi: 'Yukpo में आपका स्वागत है! आपकी सभी जरूरतों के लिए स्मार्ट सहायक। हमें आपका स्वागत करते हुए खुशी हो रही है।',
            ar: 'مرحبا بك في يوكبو! مساعدك الذكي لجميع احتياجاتك. يسعدنا استقبالك.',
            sw: 'Karibu kwenye Yukpo! Msaidizi wako mahiri kwa mahitaji yako yote. Tunafuraha kukukaribisha.',
            ha: 'Barka da zuwa Yukpo! Mai taimakon ka mai wayo don duk bukatunka. Muna farin cikin maraba da kai.',
            yo: 'Ẹ káàbọ̀ sí Yukpo! Olùrànlọ́wọ́ ọlọ́gbọ́n rẹ fún gbogbo àìní rẹ. A dúpẹ́ pé o wà.',
            ig: 'Nnọọ na Yukpo! Onye inyeaka gị mara ihe maka mkpa gị niile. Anyị nwere obi ụtọ ịnabata gị.',
            am: 'ወደ Yukpo እንኳን ደህና መጡ! ለሁሉም ፍላጎቶችዎ ዘመናዊ ረዳትዎ። እርስዎን በመቀበላችን ደስተኞች ነን።',
            zu: 'Siyakwamukela ku-Yukpo! Umsizi wakho ohlakaniphile kuzo zonke izidingo zakho.',
            wo: 'Dalal jàmm ci Yukpo! Sa ndimbal bu xaraal ngir sa soxla yépp. Bég nanu la yor.',
            ln: 'Boyei malamu na Yukpo! Mosungi na yo ya mayele mpo na bamposa na yo nyonso.',
            ff: 'Bisimilla e Yukpo! Ballo maa keewuɗo ngam haajuuji maa fof. Min ceyii jaɓɓaade ma.',
            rw: 'Murakaza neza kuri Yukpo! Umufasha wawe w\'ubwenge ku byo ukeneye byose.',
            sn: 'Titambire kuYukpo! Mubatsiri wako akangwara kune zvese zvaunoda.',
            so: 'Ku soo dhawoow Yukpo! Kaaliyahaaga caqliga leh ee loogu talagalay dhamaan baahidaada.',
            mg: 'Tongasoa eto amin\'ny Yukpo! Ny mpanampy maranitra ho an\'ny filànao rehetra.',
            ht: 'Byenveni sou Yukpo! Asistan entelijan ou pou tout bezwen ou yo. Nou kontan resevwa ou.',
            ewo: 'Mbolo a Yukpo! Mod a yëm a biyëdë bise bise boe.',
            dua: 'Mbolo na Yukpo! Muna ndutu na bwam na niè nyèsè.',
            bas: 'Sango a Yukpo! Mut a gwé mbok ni biniigà nyuu bisoŋ.',
            bm: 'I ni ce Yukpo kɔnɔ! I ka dɛmɛbaga hakilitigi.',
            pcm: 'Welcome to Yukpo! Your smart helper for all your needs. We dey happy to see you.',
        };
        return messages[lang] || messages['fr'];
    }

    /**
     * Joue la notification de bienvenue unique au premier lancement.
     * Son de bienvenue + message TTS dans la langue de l'utilisateur.
     */
    async playWelcomeMessage(): Promise<void> {
        try {
            await this.initialize();

            console.log('[NotificationSoundService] 🎉 Lecture message de bienvenue');

            // 1. Jouer un son de bienvenue (réutilise le son 'ready' comme chime)
            await this.playSound('ready').catch(() => { });

            // 2. Attendre que le son finisse, puis parler le message de bienvenue
            const lang = i18n.language || 'fr';
            const message = this.getWelcomeMessage(lang);
            const ttsLang = this.getTTSLanguage();

            setTimeout(() => {
                Speech.speak(message, {
                    language: ttsLang,
                    pitch: 1.05,
                    rate: 0.85,
                    onError: (e) => console.warn('[NotificationSoundService] TTS bienvenue erreur:', e),
                    onDone: () => console.log('[NotificationSoundService] ✅ Message de bienvenue terminé'),
                });
            }, 1200);
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
            ht: 'ht-HT', pap: 'nl-CW', // Papiamentu fallback to Dutch for TTS
        };
        const current = i18n.language || 'fr';
        return langMap[current] || `${current}-${current.toUpperCase()}`;
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

        console.log(`[NotificationSoundService] 🔔 Événement livraison: ${eventType} → "${message}"`);

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

