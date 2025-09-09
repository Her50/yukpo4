import { useState, useRef, useCallback, useEffect } from 'react';
// TODO: Fix import path if necessary
// import { useToast } from '@/hooks/use-toast';

interface CallState {
  isIncoming: boolean;
  isOutgoing: boolean;
  isConnected: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
}

interface UseCallProps {
  onCallEnd?: () => void;
  onCallAccept?: () => void;
  onCallReject?: () => void;
}

export const useCall = ({ onCallEnd, onCallAccept, onCallReject }: UseCallProps = {}) => {
  const [callState, setCallState] = useState<CallState>({
    isIncoming: false,
    isOutgoing: false,
    isConnected: false,
    isMuted: false,
    isVideoEnabled: true,
    remoteStream: null,
    localStream: null
  });

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Configuration WebRTC
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // TODO: Uncomment and fix the import path if useToast is available
  // import { useToast } from '@/hooks/use-toast';
  // const { toast } = useToast();
  const toast = ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
    // Placeholder: Replace with your toast implementation
    const prefix = variant === 'destructive' ? '❌' : 'ℹ️';
    console.log(`${prefix} ${title}: ${description}`);
  };

  const initializePeerConnection = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    peerConnection.current = new RTCPeerConnection(rtcConfig);

    peerConnection.current.ontrack = (event) => {
      setCallState(prev => ({
        ...prev,
        remoteStream: event.streams[0]
      }));
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        // Envoyer le candidat ICE au pair distant via le serveur de signalisation
        console.log('ICE candidate:', event.candidate);
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current?.connectionState === 'connected') {
        setCallState(prev => ({ ...prev, isConnected: true }));
        toast({
          title: "Appel connecté",
          description: "La connexion est établie"
        });
      } else if (peerConnection.current?.connectionState === 'disconnected') {
        endCall();
      }
    };
  }, []);

  const startCall = useCallback(async (isVideo: boolean = true) => {
    try {
      setCallState(prev => ({ ...prev, isOutgoing: true, isVideoEnabled: isVideo }));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
      });

      setCallState(prev => ({ ...prev, localStream: stream }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      initializePeerConnection();

      if (peerConnection.current) {
        stream.getTracks().forEach(track => {
          peerConnection.current?.addTrack(track, stream);
        });
      }

      toast({
        title: "Appel en cours",
        description: "Connexion en cours..."
      });

    } catch (error) {
      console.error('Erreur lors du démarrage de l\'appel:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'accéder à la caméra/microphone",
        variant: "destructive"
      });
      endCall();
    }
  }, [initializePeerConnection]);

  const acceptCall = useCallback(async () => {
    try {
      setCallState(prev => ({ ...prev, isIncoming: false, isConnected: true }));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callState.isVideoEnabled
      });

      setCallState(prev => ({ ...prev, localStream: stream }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      initializePeerConnection();

      if (peerConnection.current) {
        stream.getTracks().forEach(track => {
          peerConnection.current?.addTrack(track, stream);
        });
      }

      onCallAccept?.();
      toast({
        title: "Appel accepté",
        description: "Connexion établie"
      });

    } catch (error) {
      console.error('Erreur lors de l\'acceptation de l\'appel:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'accepter l'appel",
        variant: "destructive"
      });
      endCall();
    }
  }, [callState.isVideoEnabled, initializePeerConnection, onCallAccept]);

  const rejectCall = useCallback(() => {
    setCallState(prev => ({ ...prev, isIncoming: false }));
    onCallReject?.();
    toast({
      title: "Appel refusé",
      description: "L'appel a été refusé"
    });
  }, [onCallReject]);

  const endCall = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (callState.localStream) {
      callState.localStream.getTracks().forEach(track => track.stop());
    }

    setCallState({
      isIncoming: false,
      isOutgoing: false,
      isConnected: false,
      isMuted: false,
      isVideoEnabled: true,
      remoteStream: null,
      localStream: null
    });

    onCallEnd?.();
    toast({
      title: "Appel terminé",
      description: "L'appel a été terminé"
    });
  }, [callState.localStream, onCallEnd]);

  const toggleMute = useCallback(() => {
    if (callState.localStream) {
      const audioTrack = callState.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setCallState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, [callState.localStream]);

  const toggleVideo = useCallback(() => {
    if (callState.localStream) {
      const videoTrack = callState.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCallState(prev => ({ ...prev, isVideoEnabled: videoTrack.enabled }));
      }
    }
  }, [callState.localStream]);

  const incomingCall = useCallback((isVideo: boolean = true) => {
    setCallState(prev => ({ 
      ...prev, 
      isIncoming: true, 
      isVideoEnabled: isVideo 
    }));
  }, []);

  // Nettoyage à la fermeture
  useEffect(() => {
    return () => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      if (callState.localStream) {
        callState.localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [callState.localStream]);

  return {
    callState,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    incomingCall
  };
}; 