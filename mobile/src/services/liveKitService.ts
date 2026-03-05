/**
 * Service LiveKit pour chat live et streaming temps réel
 * Intégration avec le backend LiveKit existant
 * ✅ INTÉGRÉ: SDK LiveKit React Native
 */

import { apiGet, apiPost } from './api';

// ✅ CORRIGÉ: Import conditionnel pour livekit-client (SDK browser incompatible avec Hermes)
let Room: any = null;
let RoomEvent: any = null;
let DataPacket_Kind: any = null;
let RemoteParticipant: any = null;
try {
    const livekitClient = require('livekit-client');
    Room = livekitClient.Room;
    RoomEvent = livekitClient.RoomEvent;
    DataPacket_Kind = livekitClient.DataPacket_Kind;
    RemoteParticipant = livekitClient.RemoteParticipant;
} catch (error) {
    console.warn('[LiveKitService] livekit-client non disponible, mode fallback');
}

// ✅ INTÉGRÉ: Import conditionnel pour livekit-react-native
let setAudioSession: any = null;
let AudioSession: any = null;
try {
    const livekitRN = require('livekit-react-native');
    setAudioSession = livekitRN.setAudioSession;
    AudioSession = livekitRN.AudioSession;
} catch (error) {
    console.warn('[LiveKitService] livekit-react-native non disponible, mode fallback');
}

export interface LiveKitTokenResponse {
    token: string;
    url: string;
    room_name: string;
    participant_identity: string;
}

export interface LiveKitChatMessage {
    id: string;
    participant_identity: string;
    message: string;
    timestamp: number;
    type?: 'text' | 'emoji' | 'gift' | 'reaction';
    metadata?: Record<string, any>;
}

class LiveKitService {
    private room: Room | null = null;
    private roomName: string | null = null;
    private participantIdentity: string | null = null;
    private onMessageCallbacks: Array<(message: LiveKitChatMessage) => void> = [];
    private onParticipantJoinCallbacks: Array<(identity: string) => void> = [];
    private onParticipantLeaveCallbacks: Array<(identity: string) => void> = [];

    /**
     * Récupère un token LiveKit pour rejoindre une session
     */
    async getJoinToken(sessionId: string, userId: number): Promise<LiveKitTokenResponse> {
        try {
            const response = await apiGet<{ data: LiveKitTokenResponse }>(
                `/api/live/${sessionId}/join?viewer_user_id=${userId}&allow_publish=false`
            );

            if (response.data) {
                return response.data;
            }

            throw new Error('Token LiveKit non disponible');
        } catch (error) {
            console.error('[LiveKitService] Erreur récupération token:', error);
            throw error;
        }
    }

    /**
     * Rejoint une room LiveKit pour chat et streaming
     * ✅ INTÉGRÉ: Utilise le SDK LiveKit React Native
     */
    async joinRoom(
        sessionId: string,
        userId: number,
        onMessage?: (message: LiveKitChatMessage) => void,
        onParticipantJoin?: (identity: string) => void,
        onParticipantLeave?: (identity: string) => void
    ): Promise<void> {
        try {
            // Récupérer le token
            const tokenData = await this.getJoinToken(sessionId, userId);
            this.roomName = tokenData.room_name;
            this.participantIdentity = tokenData.participant_identity;

            // Enregistrer les callbacks
            if (onMessage) {
                this.onMessageCallbacks.push(onMessage);
            }
            if (onParticipantJoin) {
                this.onParticipantJoinCallbacks.push(onParticipantJoin);
            }
            if (onParticipantLeave) {
                this.onParticipantLeaveCallbacks.push(onParticipantLeave);
            }

            // ✅ INTÉGRÉ: Configurer la session audio pour React Native
            if (setAudioSession && AudioSession) {
                try {
                    await setAudioSession({
                        category: AudioSession.Category.Playback,
                        mode: AudioSession.Mode.Default,
                    });
                } catch (error) {
                    console.warn('[LiveKitService] Erreur configuration audio session:', error);
                }
            }

            // ✅ INTÉGRÉ: Créer et rejoindre la room LiveKit
            this.room = new Room();

            // Écouter les événements de données (chat)
            this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
                try {
                    const messageData = JSON.parse(new TextDecoder().decode(payload));
                    const chatMessage: LiveKitChatMessage = {
                        id: `${Date.now()}-${Math.random()}`,
                        participant_identity: participant?.identity || messageData.participant_identity || 'unknown',
                        message: messageData.message || '',
                        timestamp: Date.now(),
                        type: messageData.type || 'text',
                        metadata: messageData.metadata,
                    };

                    // Appeler tous les callbacks
                    this.onMessageCallbacks.forEach(callback => callback(chatMessage));
                } catch (error) {
                    console.error('[LiveKitService] Erreur parsing message:', error);
                }
            });

            // Écouter les participants qui rejoignent
            this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
                this.onParticipantJoinCallbacks.forEach(callback => callback(participant.identity));
            });

            // Écouter les participants qui partent
            this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
                this.onParticipantLeaveCallbacks.forEach(callback => callback(participant.identity));
            });

            // Rejoindre la room
            await this.room.connect(tokenData.url, tokenData.token);

            console.log('[LiveKitService] Room joinée:', tokenData.room_name);
        } catch (error) {
            console.error('[LiveKitService] Erreur join room:', error);
            throw error;
        }
    }

    /**
     * Envoie un message dans le chat live
     * ✅ INTÉGRÉ: Utilise le SDK LiveKit pour envoyer des données
     */
    async sendChatMessage(message: string, type: 'text' | 'emoji' | 'gift' | 'reaction' = 'text'): Promise<void> {
        if (!this.room || !this.roomName || !this.participantIdentity) {
            throw new Error('Pas connecté à une room');
        }

        try {
            // ✅ INTÉGRÉ: Envoyer via LiveKit Data Channel
            const messageData = {
                participant_identity: this.participantIdentity,
                message,
                type,
                timestamp: Date.now(),
            };

            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(messageData));

            await this.room.localParticipant?.publishData(data, DataPacket_Kind.RELIABLE);

            // Fallback: Envoyer aussi via API backend pour persistance
            try {
                await apiPost(`/api/live/${this.roomName}/chat`, messageData);
            } catch (apiError) {
                console.warn('[LiveKitService] Erreur API fallback (non critique):', apiError);
            }
        } catch (error) {
            console.error('[LiveKitService] Erreur envoi message:', error);
            throw error;
        }
    }

    /**
     * Envoie un gift/don dans le live
     */
    async sendGift(giftId: string, amount: number): Promise<void> {
        if (!this.roomName || !this.participantIdentity) {
            throw new Error('Pas connecté à une room');
        }

        try {
            await apiPost(`/api/live/${this.roomName}/gift`, {
                participant_identity: this.participantIdentity,
                gift_id: giftId,
                amount,
            });
        } catch (error) {
            console.error('[LiveKitService] Erreur envoi gift:', error);
            throw error;
        }
    }

    /**
     * Quitte la room
     * ✅ INTÉGRÉ: Déconnexion propre du SDK LiveKit
     */
    async leaveRoom(): Promise<void> {
        if (this.room) {
            try {
                await this.room.disconnect();
            } catch (error) {
                console.error('[LiveKitService] Erreur déconnexion:', error);
            }
            this.room = null;
        }

        this.roomName = null;
        this.participantIdentity = null;
        this.onMessageCallbacks = [];
        this.onParticipantJoinCallbacks = [];
        this.onParticipantLeaveCallbacks = [];
    }
}

export const liveKitService = new LiveKitService();

