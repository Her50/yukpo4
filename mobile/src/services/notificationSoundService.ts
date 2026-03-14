/**
 * Service de notifications sonores pour l'application
 * Utilise expo-av pour jouer des sons de notification
 * + Speech/TTS contextuel pour les événements coursier
 */

import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';

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
    // ── NOTIFICATIONS CONTEXTUELLES VOCALES (Speech/TTS) ────────────────
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Génère un message vocal contextuel pour un événement de livraison
     */
    private getDeliveryContextualMessage(
        eventType: string,
        details?: { courierName?: string; etaMinutes?: number; distance?: string; itemCount?: number; destination?: string }
    ): string {
        const courier = details?.courierName || 'un coursier';
        const eta = details?.etaMinutes;
        const dest = details?.destination || 'votre destination';

        switch (eventType) {
            case 'courier_found':
                return eta
                    ? `Bonne nouvelle ! ${courier} a accepté votre course. Il sera là dans environ ${eta} minutes.`
                    : `Bonne nouvelle ! ${courier} a accepté votre course et est en route vers vous.`;
            case 'courier_searching':
                return 'Recherche d\'un coursier disponible près de vous. Veuillez patienter.';
            case 'courier_en_route_pickup':
                return eta
                    ? `${courier} est en route vers le point de collecte. Arrivée estimée dans ${eta} minutes.`
                    : `${courier} est en route vers le point de collecte.`;
            case 'courier_arrived_pickup':
                return `${courier} est arrivé au point de collecte et récupère votre colis.`;
            case 'courier_picked_up':
                return `Votre colis a été récupéré par ${courier}. Il est maintenant en route vers ${dest}.`;
            case 'courier_en_route_delivery':
                return eta
                    ? `${courier} est en route vers vous avec votre livraison. Arrivée dans environ ${eta} minutes.`
                    : `${courier} est en route vers vous avec votre livraison.`;
            case 'courier_arrived_destination':
                return `${courier} est arrivé à destination. Veuillez récupérer votre livraison.`;
            case 'delivery_completed':
                return 'Votre livraison est terminée avec succès. Merci d\'utiliser Yukpo !';
            case 'shopping_in_progress':
                return details?.itemCount
                    ? `${courier} fait vos courses. ${details.itemCount} article${details.itemCount > 1 ? 's' : ''} à trouver.`
                    : `${courier} est en train de faire vos courses au marché.`;
            case 'shopping_completed':
                return `Les courses sont terminées. ${courier} va maintenant se diriger vers vous.`;
            case 'delivery_cancelled':
                return 'Votre livraison a été annulée. Vous pouvez en créer une nouvelle.';
            case 'new_delivery_available':
                return details?.distance
                    ? `Nouvelle livraison disponible à ${details.distance}. Consultez l'application pour accepter.`
                    : 'Nouvelle livraison disponible près de vous. Consultez l\'application pour accepter.';
            default:
                return `Mise à jour de votre livraison : ${eventType}`;
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
                    language: 'fr-FR',
                    pitch: 1.0,
                    rate: 0.9,
                    onError: (e) => console.warn('[NotificationSoundService] TTS erreur:', e),
                });
            }, 1500);
        }

        // 4. Notification push locale (visible même app fermée / en arrière-plan)
        if (opts.pushNotification) {
            const titleMap: Record<string, string> = {
                courier_found: '🏍️ Coursier trouvé !',
                courier_searching: '🔍 Recherche coursier...',
                courier_en_route_pickup: '📦 Coursier en route',
                courier_arrived_pickup: '📍 Coursier arrivé au retrait',
                courier_picked_up: '📦 Colis récupéré',
                courier_en_route_delivery: '🚀 En route vers vous',
                courier_arrived_destination: '🏁 Coursier arrivé !',
                delivery_completed: '✅ Livraison terminée',
                shopping_in_progress: '🛒 Courses en cours',
                shopping_completed: '✅ Courses terminées',
                delivery_cancelled: '❌ Livraison annulée',
                new_delivery_available: '📦 Nouvelle livraison !',
            };

            try {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: titleMap[eventType] || '📦 Mise à jour livraison',
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

