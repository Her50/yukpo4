// @ts-nocheck
/**
 * Composant d'appels vidéo/audio WebRTC
 * IMPORTANT: Nécessite l'installation de react-native-webrtc
 * Voir WEBRTC_SETUP.md pour les instructions d'installation
 */
import { Audio } from 'expo-av'; // ✅ Pour la sonnerie d'appel
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

// Import WebRTC - Package installé
import { mediaDevices, MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, RTCView } from 'react-native-webrtc';

const { width, height } = Dimensions.get('window');

interface WebRTCCallModalProps {
    visible: boolean;
    onClose: () => void;
    callType: 'audio' | 'video';
    recipientName: string;
    recipientId: string;
    currentUserId: string;
    serviceId?: string;
}

const WebRTCCallModal: React.FC<WebRTCCallModalProps> = ({
    visible,
    onClose,
    callType,
    recipientName,
    recipientId,
    currentUserId,
    serviceId
}) => {
    const [callState, setCallState] = useState<'connecting' | 'ringing' | 'active' | 'ended'>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const [callDuration, setCallDuration] = useState(0);

    // États WebRTC
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const ws = useRef<WebSocket | null>(null);

    // ✅ NOUVEAU: Sonnerie d'appel
    const [ringSound, setRingSound] = useState<Audio.Sound | null>(null);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const callTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && callState === 'connecting') {
            // Initialiser la connexion WebRTC
            initializeWebRTC();
        }

        return () => {
            cleanup();
        };
    }, [visible]);

    useEffect(() => {
        if (callState === 'active') {
            callTimer.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);

            // ✅ Arrêter la sonnerie quand l'appel est accepté
            stopRingTone();
        }

        return () => {
            if (callTimer.current) {
                clearInterval(callTimer.current);
            }
        };
    }, [callState]);

    // ✅ NOUVEAU: Jouer la sonnerie quand l'état passe à 'ringing'
    useEffect(() => {
        if (callState === 'ringing') {
            playRingTone();

            // ✅ Animation de pulse pendant la sonnerie
            const pulseAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseAnimation.start();

            return () => {
                pulseAnimation.stop();
                pulseAnim.setValue(1);
            };
        } else if (callState === 'active' || callState === 'ended') {
            stopRingTone();
            pulseAnim.setValue(1);
        }

        return () => {
            stopRingTone();
        };
    }, [callState]);

    // Initialisation WebRTC
    const initializeWebRTC = async () => {
        try {
            console.log('[WebRTC] Initialisation...');

            // Configuration ICE servers (STUN pour le NAT traversal)
            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            };

            // Créer la connexion peer
            peerConnection.current = new RTCPeerConnection(configuration);

            // Obtenir les streams locaux (caméra/micro)
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: callType === 'video' ? {
                    facingMode: isFrontCamera ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } : false
            });
            setLocalStream(stream);

            // Ajouter les tracks à la connexion
            stream.getTracks().forEach(track => {
                peerConnection.current?.addTrack(track, stream);
            });

            // Gérer les ICE candidates
            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignalingMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        to: recipientId
                    });
                }
            };

            // Gérer le stream distant
            peerConnection.current.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
                setCallState('active');
            };

            // Connecter au serveur de signaling
            connectToSignalingServer();

            console.log('[WebRTC] Initialisation terminée');
        } catch (error) {
            console.error('[WebRTC] Erreur initialisation:', error);
            Alert.alert('Erreur', 'Impossible d\'initialiser l\'appel. Vérifiez les permissions caméra/micro.');
            onClose();
        }
    };

    // Connexion au serveur de signaling
    const connectToSignalingServer = () => {
        // WebSocket pour le signaling
        ws.current = new WebSocket('wss://yukpomnang.onrender.com/ws/webrtc');

        ws.current.onopen = () => {
            console.log('[WebRTC] Connecté au serveur de signaling');

            // ✅ NOUVEAU: Envoyer une push notification au destinataire
            sendCallPushNotification();

            // Envoyer l'offre d'appel
            createOffer();
        };

        ws.current.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            await handleSignalingMessage(message);
        };

        ws.current.onerror = (error) => {
            console.error('[WebRTC] Erreur WebSocket:', error);
            Alert.alert('Erreur', 'Impossible de se connecter au serveur');
        };

        ws.current.onclose = () => {
            console.log('[WebRTC] Déconnecté du serveur de signaling');
        };
    };

    // Créer une offre SDP
    const createOffer = async () => {
        try {
            const offer = await peerConnection.current?.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video'
            });

            await peerConnection.current?.setLocalDescription(offer);

            sendSignalingMessage({
                type: 'offer',
                sdp: offer,
                to: recipientId,
                from: currentUserId,
                callType
            });

            setCallState('ringing');
        } catch (error) {
            console.error('[WebRTC] Erreur création offer:', error);
        }
    };

    // Gérer les messages de signaling
    const handleSignalingMessage = async (message: any) => {
        switch (message.type) {
            case 'answer':
                await peerConnection.current?.setRemoteDescription(
                    new RTCSessionDescription(message.sdp)
                );
                break;

            case 'ice-candidate':
                if (message.candidate) {
                    await peerConnection.current?.addIceCandidate(
                        new RTCIceCandidate(message.candidate)
                    );
                }
                break;

            case 'call-rejected':
                Alert.alert('Appel refusé', `${recipientName} a refusé l'appel`);
                onClose();
                break;

            case 'call-ended':
                endCall();
                break;
        }
    };

    // Envoyer un message de signaling
    const sendSignalingMessage = (message: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
        }
    };


    const toggleMute = () => {
        // Toggle audio track
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
        setIsMuted(!isMuted);
    };

    const toggleVideo = () => {
        // Toggle video track
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
        setIsVideoEnabled(!isVideoEnabled);
    };

    const switchCamera = () => {
        // Switch camera
        if (localStream) {
            localStream.getVideoTracks().forEach((track: any) => {
                track._switchCamera();
            });
        }
        setIsFrontCamera(!isFrontCamera);
    };

    const endCall = () => {
        setCallState('ended');
        cleanup();
        setTimeout(() => {
            onClose();
        }, 1000);
    };

    const cleanup = () => {
        if (callTimer.current) {
            clearInterval(callTimer.current);
        }

        // ✅ Arrêter la sonnerie
        stopRingTone();

        // Nettoyer les ressources WebRTC
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }
        if (ws.current) {
            ws.current.close();
        }
    };

    // ✅ NOUVEAU: Jouer la sonnerie d'appel
    const playRingTone = async () => {
        try {
            console.log('[WebRTC] 🔔 Démarrage sonnerie...');

            // Configurer le mode audio
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: false,
            });

            // Créer et jouer un son de sonnerie simple avec expo-av
            const { sound } = await Audio.Sound.createAsync(
                // Utiliser un son système par défaut ou générer un bip
                { uri: 'https://www.soundjay.com/phone/sounds/phone-calling-1.mp3' },
                { shouldPlay: true, isLooping: true, volume: 0.5 }
            );

            setRingSound(sound);
            console.log('[WebRTC] ✅ Sonnerie démarrée');
        } catch (error) {
            console.error('[WebRTC] Erreur sonnerie:', error);
            // Fallback : vibration ou pas de son
        }
    };

    // ✅ NOUVEAU: Arrêter la sonnerie
    const stopRingTone = async () => {
        try {
            if (ringSound) {
                console.log('[WebRTC] 🔕 Arrêt sonnerie');
                await ringSound.stopAsync();
                await ringSound.unloadAsync();
                setRingSound(null);
            }
        } catch (error) {
            console.error('[WebRTC] Erreur arrêt sonnerie:', error);
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // ✅ NOUVEAU: Envoyer une notification push d'appel au destinataire
    const sendCallPushNotification = async () => {
        try {
            console.log('[WebRTC] 📲 Envoi notification push d\'appel à:', recipientId);

            // Note: Le backend devrait avoir un endpoint pour envoyer des push notifications
            // Pour l'instant, on utilise le WebSocket qui notifiera le serveur
            // Le serveur enverra automatiquement la push notification via Expo Push API

            const response = await fetch('https://yukpomnang.onrender.com/api/webrtc/notify-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipient_id: recipientId,
                    caller_id: currentUserId,
                    caller_name: 'Utilisateur', // TODO: Récupérer le vrai nom
                    call_type: callType,
                    service_id: serviceId
                })
            });

            if (response.ok) {
                console.log('[WebRTC] ✅ Notification push envoyée');
            } else {
                console.warn('[WebRTC] ⚠️ Erreur envoi push notification:', response.status);
            }
        } catch (error) {
            console.error('[WebRTC] ❌ Erreur notification push:', error);
            // Ne pas bloquer l'appel si la notification échoue
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={endCall}
        >
            <View style={styles.container}>
                {/* Vue vidéo distante */}
                {callType === 'video' && callState === 'active' && (
                    <View style={styles.remoteVideoContainer}>
                        {/* Afficher le stream distant */}
                        {remoteStream ? (
                            <RTCView
                                streamURL={remoteStream.toURL()}
                                style={styles.remoteVideo}
                                objectFit="cover"
                            />
                        ) : (
                            <View style={styles.videoPlaceholder}>
                                <SafeIcon name="user" size={80} color="rgba(255, 255, 255, 0.5)" />
                                <Text style={styles.placeholderText}>
                                    En attente de {recipientName}...
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Vue vidéo locale (picture-in-picture) */}
                {callType === 'video' && callState === 'active' && isVideoEnabled && (
                    <View style={styles.localVideoContainer}>
                        {/* Afficher le stream local */}
                        {localStream && (
                            <RTCView
                                streamURL={localStream.toURL()}
                                style={styles.localVideo}
                                objectFit="cover"
                                mirror={isFrontCamera}
                            />
                        )}
                    </View>
                )}

                {/* Informations d'appel */}
                <View style={styles.callInfo}>
                    <Animated.View style={{ transform: [{ scale: callState === 'ringing' ? pulseAnim : 1 }] }}>
                        <View style={styles.avatarContainer}>
                            <SafeIcon
                                name="user"
                                size={60}
                                color={modernColors.primary}
                            />
                        </View>
                    </Animated.View>

                    <Text style={styles.recipientName}>{recipientName}</Text>

                    <Text style={styles.callStatus}>
                        {callState === 'connecting' && 'Connexion...'}
                        {callState === 'ringing' && '🔔 Sonnerie en cours...'}
                        {callState === 'active' && formatDuration(callDuration)}
                        {callState === 'ended' && 'Appel terminé'}
                    </Text>

                    {/* ✅ Indicateur sonore pendant ringing */}
                    {callState === 'ringing' && (
                        <View style={styles.ringingIndicator}>
                            <Text style={styles.ringingText}>🔊 Appel en cours</Text>
                            <View style={styles.soundWaves}>
                                <Animated.View style={[styles.soundWave, { opacity: pulseAnim }]} />
                                <Animated.View style={[styles.soundWave, { opacity: pulseAnim, animationDelay: 200 }]} />
                                <Animated.View style={[styles.soundWave, { opacity: pulseAnim, animationDelay: 400 }]} />
                            </View>
                        </View>
                    )}

                    {callType === 'video' && callState === 'active' && (
                        <Text style={styles.callType}>Appel vidéo</Text>
                    )}
                    {callType === 'audio' && callState === 'active' && (
                        <Text style={styles.callType}>Appel audio</Text>
                    )}
                </View>

                {/* Contrôles d'appel */}
                {callState === 'active' && (
                    <View style={styles.controls}>
                        <View style={styles.controlsRow}>
                            {/* Mute/Unmute */}
                            <TouchableOpacity
                                style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                                onPress={toggleMute}
                            >
                                <SafeIcon
                                    name={isMuted ? "mic-off" : "mic"}
                                    size={28}
                                    color="#FFFFFF"
                                />
                            </TouchableOpacity>

                            {/* Vidéo on/off (si appel vidéo) */}
                            {callType === 'video' && (
                                <TouchableOpacity
                                    style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
                                    onPress={toggleVideo}
                                >
                                    <SafeIcon
                                        name={isVideoEnabled ? "video" : "video-off"}
                                        size={28}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            )}

                            {/* Switch caméra (si appel vidéo) */}
                            {callType === 'video' && (
                                <TouchableOpacity
                                    style={styles.controlButton}
                                    onPress={switchCamera}
                                >
                                    <SafeIcon
                                        name="repeat"
                                        size={28}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            )}

                            {/* Speaker on/off */}
                            <TouchableOpacity
                                style={[styles.controlButton, isSpeaker && styles.controlButtonActive]}
                                onPress={() => setIsSpeaker(!isSpeaker)}
                            >
                                <SafeIcon
                                    name={isSpeaker ? "volume-2" : "volume-1"}
                                    size={28}
                                    color="#FFFFFF"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Bouton raccrocher */}
                        <TouchableOpacity
                            style={styles.endCallButton}
                            onPress={endCall}
                        >
                            <SafeIcon name="phone-off" size={32} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ✅ NOUVEAU: Bouton raccrocher pendant connecting/ringing */}
                {(callState === 'connecting' || callState === 'ringing') && (
                    <View style={styles.controlsConnecting}>
                        <TouchableOpacity
                            style={styles.endCallButtonLarge}
                            onPress={endCall}
                        >
                            <SafeIcon name="phone-off" size={40} color="#FFFFFF" />
                            <Text style={styles.endCallText}>Annuler l'appel</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Status de connexion */}
                {callState === 'connecting' && (
                    <View style={styles.demoNote}>
                        <Text style={styles.demoNoteText}>
                            🔄 Connexion en cours...
                        </Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    remoteVideoContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    remoteVideo: {
        flex: 1,
    },
    videoPlaceholder: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 16,
        marginTop: 16,
    },
    localVideoContainer: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 120,
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: modernColors.primary,
        backgroundColor: '#000',
    },
    localVideo: {
        flex: 1,
    },
    localVideoPlaceholder: {
        flex: 1,
        backgroundColor: '#2a2a2a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    callInfo: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: modernColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 3,
        borderColor: modernColors.primary,
    },
    recipientName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    callStatus: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    callType: {
        fontSize: 14,
        color: modernColors.primary,
    },
    controls: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 30,
    },
    controlButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlButtonActive: {
        backgroundColor: modernColors.error,
    },
    endCallButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: modernColors.error,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    // ✅ NOUVEAU: Contrôles pendant connecting/ringing
    controlsConnecting: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    endCallButtonLarge: {
        width: 180,
        height: 70,
        borderRadius: 35,
        backgroundColor: modernColors.error,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 12,
    },
    endCallText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    // ✅ NOUVEAU: Indicateur de sonnerie
    ringingIndicator: {
        marginTop: 20,
        alignItems: 'center',
        gap: 12,
    },
    ringingText: {
        color: modernColors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    soundWaves: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    soundWave: {
        width: 4,
        height: 30,
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    demoNote: {
        position: 'absolute',
        top: 16,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.9)',
        padding: 12,
        borderRadius: 8,
    },
    demoNoteText: {
        color: '#FFFFFF',
        fontSize: 12,
        textAlign: 'center',
    },
});

export default WebRTCCallModal;


