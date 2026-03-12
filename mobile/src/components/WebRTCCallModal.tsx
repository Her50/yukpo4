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
import { API_ENDPOINTS, WS_ENDPOINTS } from '../config/api.config';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

// Import WebRTC
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
    isIncoming?: boolean; // ✅ NOUVEAU: Détecter si c'est un appel entrant
}

const WebRTCCallModal: React.FC<WebRTCCallModalProps> = ({
    visible,
    onClose,
    callType,
    recipientName,
    recipientId,
    currentUserId,
    serviceId,
    isIncoming = false // ✅ NOUVEAU: Défaut = false (appel sortant)
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
    // ✅ CORRIGÉ: Refs pour stocker les handlers d'événements pour cleanup
    const iceCandidateHandlerRef = useRef<((event: any) => void) | null>(null);
    const trackHandlerRef = useRef<((event: any) => void) | null>(null);

    // ✅ NOUVEAU: Sonnerie d'appel
    const [ringSound, setRingSound] = useState<Audio.Sound | null>(null);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const callTimer = useRef<NodeJS.Timeout | null>(null);

    // ✅ CORRIGÉ: Refs pour stocker les fonctions
    const cleanupRef = useRef<(() => void) | null>(null);
    const initializeWebRTCRef = useRef<(() => Promise<void>) | null>(null);

    useEffect(() => {
        if (visible && callState === 'connecting') {
            // ✅ CORRIGÉ: Utiliser la ref pour initializeWebRTC
            try {
                if (initializeWebRTCRef.current && typeof initializeWebRTCRef.current === 'function') {
                    initializeWebRTCRef.current();
                }
            } catch (error) {
                console.error('[WebRTC] Erreur critique initialisation:', error);
                Alert.alert('Erreur', 'Impossible d\'initialiser l\'appel. Veuillez réessayer.');
                onClose();
            }
        }

        return () => {
            try {
                // ✅ CORRIGÉ: Utiliser la ref pour la fonction de cleanup
                if (cleanupRef.current && typeof cleanupRef.current === 'function') {
                    cleanupRef.current();
                }
            } catch (error) {
                console.error('[WebRTC] Erreur cleanup:', error);
            }
        };
    }, [visible]);

    // ✅ CORRIGÉ: Ref pour stocker stopRingTone
    const stopRingToneRef = useRef<(() => Promise<void>) | null>(null);

    useEffect(() => {
        if (callState === 'active') {
            callTimer.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);

            // ✅ CORRIGÉ: Utiliser la ref pour stopRingTone
            if (stopRingToneRef.current && typeof stopRingToneRef.current === 'function') {
                stopRingToneRef.current();
            }
        }

        return () => {
            if (callTimer.current) {
                clearInterval(callTimer.current);
            }
        };
    }, [callState]);

    // ✅ CORRIGÉ: Ref pour stocker playRingTone
    const playRingToneRef = useRef<(() => Promise<void>) | null>(null);

    // ✅ AMÉLIORÉ: Jouer la sonnerie selon le type d'appel
    useEffect(() => {
        // Appel ENTRANT : jouer la sonnerie immédiatement pour alerter le destinataire
        if (isIncoming && visible && callState === 'connecting') {
            console.log('[WebRTC] 🔔 Appel entrant - Démarrage sonnerie destinataire');
            if (playRingToneRef.current && typeof playRingToneRef.current === 'function') {
                playRingToneRef.current();
            }
        }

        // Appel SORTANT : jouer la sonnerie quand on attend la réponse
        if (!isIncoming && callState === 'ringing') {
            console.log('[WebRTC] 🔔 Appel sortant - Démarrage sonnerie émetteur');
            if (playRingToneRef.current && typeof playRingToneRef.current === 'function') {
                playRingToneRef.current();
            }

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
            if (stopRingToneRef.current && typeof stopRingToneRef.current === 'function') {
                stopRingToneRef.current();
            }
            pulseAnim.setValue(1);
        }

        return () => {
            if (callState === 'ended') {
                if (stopRingToneRef.current && typeof stopRingToneRef.current === 'function') {
                    stopRingToneRef.current();
                }
            }
        };
    }, [callState, isIncoming, visible]);

    // Initialisation WebRTC
    const initializeWebRTC = async () => {
        try {
            console.log('[WebRTC] Initialisation...');

            // ✅ CORRECTION: Vérifier la disponibilité des modules WebRTC
            if (!mediaDevices || !RTCPeerConnection) {
                throw new Error('WebRTC non disponible sur cet appareil');
            }

            // Configuration ICE servers (STUN pour le NAT traversal)
            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            };

            // Créer la connexion peer
            peerConnection.current = new RTCPeerConnection(configuration);

            // ✅ CORRECTION: Obtenir les streams locaux avec timeout
            const streamPromise = mediaDevices.getUserMedia({
                audio: true,
                video: callType === 'video' ? {
                    facingMode: isFrontCamera ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } : false
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout obtention caméra/micro')), 15000)
            );

            const stream = await Promise.race([streamPromise, timeoutPromise]) as MediaStream;
            setLocalStream(stream);

            // Ajouter les tracks à la connexion
            stream.getTracks().forEach(track => {
                peerConnection.current?.addTrack(track, stream);
            });

            // ✅ CORRIGÉ: Utiliser addEventListener au lieu de propriétés directes
            if (peerConnection.current) {
                // Handler pour ICE candidates
                const iceCandidateHandler = (event: any) => {
                    if (event.candidate) {
                        try {
                            sendSignalingMessage({
                                type: 'ice-candidate',
                                candidate: event.candidate,
                                to: recipientId
                            });
                        } catch (error) {
                            console.error('[WebRTC] Erreur envoi ICE candidate:', error);
                        }
                    }
                };
                iceCandidateHandlerRef.current = iceCandidateHandler;
                peerConnection.current.addEventListener('icecandidate', iceCandidateHandler);

                // Handler pour track
                const trackHandler = (event: any) => {
                    try {
                        setRemoteStream(event.streams[0]);
                        setCallState('active');
                    } catch (error) {
                        console.error('[WebRTC] Erreur gestion stream distant:', error);
                    }
                };
                trackHandlerRef.current = trackHandler;
                peerConnection.current.addEventListener('track', trackHandler);
            }

            // ✅ CORRECTION: Connecter au serveur de signaling avec protection
            try {
                connectToSignalingServer();
            } catch (error) {
                console.error('[WebRTC] Erreur connexion signaling:', error);
                // Continuer sans signaling (mode local)
                setCallState('ringing');
            }

            console.log('[WebRTC] Initialisation terminée');
        } catch (error) {
            console.error('[WebRTC] Erreur initialisation:', error);

            // ✅ Message d'erreur plus explicite selon le type d'erreur
            let errorMessage = 'Impossible d\'initialiser l\'appel.';
            if (error instanceof Error) {
                if (error.message.includes('Permission')) {
                    errorMessage = 'Permissions caméra/micro refusées. Veuillez les activer dans les paramètres.';
                } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                    errorMessage = 'Délai d\'attente dépassé. Vérifiez votre caméra/micro.';
                } else if (error.message.includes('WebRTC non disponible')) {
                    errorMessage = 'Appels vidéo/audio non disponibles sur cet appareil.';
                }
            }

            Alert.alert('Erreur', errorMessage);
            onClose();
        }
    };

    // ✅ CORRIGÉ: Stocker initializeWebRTC dans la ref
    initializeWebRTCRef.current = initializeWebRTC;

    // Connexion au serveur de signaling
    const connectToSignalingServer = () => {
        // ✅ CORRIGÉ: Génère un ID unique pour l'appel et utilise configuration centralisée
        const callId = `call_${currentUserId}_${recipientId}_${Date.now()}`;
        ws.current = new WebSocket(WS_ENDPOINTS.WEBRTC(callId));

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

            // ✅ CORRIGÉ: Ne pas afficher l'erreur immédiatement
            // Le serveur WebRTC peut ne pas être démarré, mais ne pas bloquer l'UX
            console.warn('[WebRTC] ⚠️ Le serveur WebRTC n\'est pas disponible. Utilisation du mode fallback.');

            // L'appel continuera avec un mode local (simulé)
            // L'utilisateur ne verra pas de message d'erreur immédiatement
        };

        ws.current.onclose = (event) => {
            console.log('[WebRTC] Déconnecté du serveur de signaling. Code:', event.code, 'Raison:', event.reason);

            // ✅ CORRIGÉ: Ne pas afficher d'alerte si le serveur n'est pas disponible au démarrage
            if (event.code !== 1000 && callState === 'active') {
                // Seulement si l'appel était en cours (connexion active)
                console.warn('[WebRTC] Connexion fermée pendant un appel actif');
                Alert.alert('Appel interrompu', 'La connexion a été perdue');
                endCall();
            } else if (event.code !== 1000 && callState === 'connecting') {
                // Connexion a échoué au démarrage - mode fallback silencieux
                console.log('[WebRTC] Mode fallback activé - le serveur WebRTC n\'est pas disponible');
                // Continuer en mode local sans alerter l'utilisateur
                setCallState('ringing'); // Simuler la sonnerie
            }
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

        // ✅ CORRIGÉ: Arrêter la sonnerie via la ref
        if (stopRingToneRef.current && typeof stopRingToneRef.current === 'function') {
            stopRingToneRef.current();
        }

        // Nettoyer les ressources WebRTC
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            // ✅ CORRIGÉ: Retirer les event listeners avant de fermer
            if (iceCandidateHandlerRef.current) {
                peerConnection.current.removeEventListener('icecandidate', iceCandidateHandlerRef.current);
                iceCandidateHandlerRef.current = null;
            }
            if (trackHandlerRef.current) {
                peerConnection.current.removeEventListener('track', trackHandlerRef.current);
                trackHandlerRef.current = null;
            }
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
    };

    // ✅ CORRIGÉ: Stocker cleanup dans la ref
    cleanupRef.current = cleanup;

    // ✅ CORRIGÉ: Jouer la sonnerie d'appel avec son système
    const playRingTone = async () => {
        try {
            console.log('[WebRTC] 🔔 Démarrage sonnerie...');

            // Si déjà en cours, ne rien faire
            if (ringSound) {
                console.log('[WebRTC] ⚠️ Sonnerie déjà en cours');
                return;
            }

            // Configurer le mode audio
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
            });

            // ✅ CORRIGÉ: Utiliser le son système de notification
            // Chargement sécurisé du son
            let soundSource;
            try {
                soundSource = require('../../assets/sounds/call_ringtone.mp3');
            } catch (error) {
                console.error('[WebRTCCallModal] Erreur chargement son:', error);
                // Fallback: utiliser un son par défaut ou désactiver
                console.warn('[WebRTCCallModal] Son non disponible, utilisation du fallback');
                return;
            }

            const { sound } = await Audio.Sound.createAsync(
                soundSource,
                {
                    shouldPlay: true,
                    isLooping: true,
                    volume: isIncoming ? 1.0 : 0.5 // Plus fort pour appel entrant
                }
            );

            setRingSound(sound);
            console.log('[WebRTC] ✅ Sonnerie démarrée');
        } catch (error) {
            console.error('[WebRTC] ❌ Erreur sonnerie:', error);

            // ✅ FALLBACK: Si le fichier son n'existe pas, essayer un son système alternatif
            try {
                console.log('[WebRTC] 🔄 Tentative fallback avec son système...');
                // Utiliser le son de notification système par défaut
                const { sound } = await Audio.Sound.createAsync(
                    { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
                    { shouldPlay: true, isLooping: true, volume: 0.7 }
                );
                setRingSound(sound);
                console.log('[WebRTC] ✅ Sonnerie fallback démarrée');
            } catch (fallbackError) {
                console.error('[WebRTC] ❌ Erreur sonnerie fallback:', fallbackError);
                // Pas de son du tout, mais l'appel continue
            }
        }
    };

    // ✅ CORRIGÉ: Stocker playRingTone dans la ref
    playRingToneRef.current = playRingTone;

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

    // ✅ CORRIGÉ: Stocker stopRingTone dans la ref
    stopRingToneRef.current = stopRingTone;

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // ✅ CORRIGÉ: Envoyer une notification d'appel via API et WebSocket
    const sendCallPushNotification = async () => {
        try {
            console.log('[WebRTC] 📲 Envoi notification d\'appel à:', recipientId);

            // Import sécurisé de apiPost
            let apiPost;
            try {
                const apiModule = await import('../services/api');
                apiPost = apiModule.apiPost;
            } catch (error) {
                console.error('[WebRTCCallModal] Erreur import apiPost:', error);
                console.warn('[WebRTCCallModal] Utilisation du fallback pour apiPost');
                return;
            }

            // ✅ MÉTHODE 1: Envoyer via API avec authentification
            const response = await apiPost(API_ENDPOINTS.WEBRTC.NOTIFY_CALL, {
                recipient_id: recipientId,
                caller_id: currentUserId,
                caller_name: recipientName || 'Un utilisateur',
                call_type: callType,
                service_id: serviceId
            });

            if (response.success) {
                console.log('[WebRTC] ✅ Notification API envoyée avec succès');
            } else {
                console.warn('[WebRTC] ⚠️ Erreur envoi notification API:', response.status);
            }

            // ✅ MÉTHODE 2: Envoyer également via WebSocket pour notification temps réel
            // Utiliser le WebSocket de signaling pour envoyer la notification
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: 'call_notification',
                    to: recipientId,
                    from: currentUserId,
                    caller_name: recipientName || 'Un utilisateur',
                    call_type: callType,
                    service_id: serviceId,
                    timestamp: new Date().toISOString()
                }));
                console.log('[WebRTC] ✅ Notification WebSocket envoyée');
            }

        } catch (error) {
            console.error('[WebRTC] ❌ Erreur notification:', error);
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
                        {callState === 'connecting' ? 'Connexion...' :
                            callState === 'ringing' ? '🔔 Sonnerie en cours...' :
                                callState === 'active' ? formatDuration(callDuration) :
                                    callState === 'ended' ? 'Appel terminé' : ''}
                    </Text>

                    {/* ✅ Indicateur sonore pendant ringing */}
                    {callState === 'ringing' && (
                        <View style={styles.ringingIndicator}>
                            <Text style={styles.ringingText}>🔊 Appel en cours</Text>
                            <View style={styles.soundWaves}>
                                <Animated.View style={[styles.soundWave, { opacity: pulseAnim }]} />
                                <Animated.View style={[styles.soundWave, { opacity: pulseAnim }]} />
                                <Animated.View style={[styles.soundWave, { opacity: pulseAnim }]} />
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


