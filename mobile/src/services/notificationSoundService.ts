/**
 * Service de notifications sonores pour l'application
 * Utilise expo-av pour jouer des sons de notification
 */

import { Audio } from 'expo-av';

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
            // ✅ FIX 2026-03-03: Utiliser delivery_alert.mp3 (seul fichier existant) comme source principale
            // pour tous les types de notifications, avec fallback en ligne
            let soundSource: any;

            try {
                // Fichier local existant : delivery_alert.mp3
                soundSource = require('../../assets/sounds/delivery_alert.mp3');
            } catch {
                // Fallback en ligne si le fichier local n'est pas trouvé
                switch (type) {
                    case 'order':
                    case 'delivery_request':
                        soundSource = { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' };
                        break;
                    case 'courier':
                    case 'ready':
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
}

// Instance singleton
export const notificationSoundService = new NotificationSoundService();

// Initialiser au démarrage de l'app (optionnel)
// notificationSoundService.initialize().catch(console.error);

