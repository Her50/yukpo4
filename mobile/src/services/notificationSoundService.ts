/**
 * Service de notifications sonores pour l'application
 * Utilise expo-av pour jouer des sons de notification
 */

import { Audio } from 'expo-av';

export type NotificationSoundType = 'order' | 'courier' | 'ready';

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
                staysActiveInBackground: false,
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
            let soundSource: any;

            // Essayer d'abord de charger un fichier local, puis fallback en ligne
            switch (type) {
                case 'order':
                    // Essayer fichier local d'abord
                    try {
                        soundSource = require('../assets/sounds/order_notification.mp3');
                    } catch {
                        try {
                            soundSource = require('../assets/sounds/order_notification.wav');
                        } catch {
                            // Fallback : son en ligne
                            soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' };
                        }
                    }
                    break;
                case 'courier':
                    try {
                        soundSource = require('../assets/sounds/courier_assigned.mp3');
                    } catch {
                        try {
                            soundSource = require('../assets/sounds/courier_assigned.wav');
                        } catch {
                            soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' };
                        }
                    }
                    break;
                case 'ready':
                    try {
                        soundSource = require('../assets/sounds/order_ready.mp3');
                    } catch {
                        try {
                            soundSource = require('../assets/sounds/order_ready.wav');
                        } catch {
                            soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' };
                        }
                    }
                    break;
                default:
                    soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' };
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
            ]);
            console.log('[NotificationSoundService] ✅ Tous les sons préchargés');
        } catch (error) {
            console.error('[NotificationSoundService] ❌ Erreur préchargement:', error);
        }
    }
}

// Instance singleton
export const notificationSoundService = new NotificationSoundService();

// Initialiser au démarrage de l'app (optionnel)
// notificationSoundService.initialize().catch(console.error);

