// @ts-nocheck
/**
 * Composant d'appels vidéo/audio WebRTC
 * IMPORTANT: Nécessite l'installation de react-native-webrtc
 * Voir WEBRTC_SETUP.md pour les instructions d'installation
 */
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
import { RTCView, mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, MediaStream } from 'react-native-webrtc';

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
        }

        return () => {
            if (callTimer.current) {
                clearInterval(callTimer.current);
            }
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

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
                        {callState === 'ringing' && 'Appel en cours...'}
                        {callState === 'active' && formatDuration(callDuration)}
                        {callState === 'ended' && 'Appel terminé'}
                    </Text>

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


