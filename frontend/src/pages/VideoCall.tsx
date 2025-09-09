import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/buttons/Button';
import { Phone, Video, Mic, MicOff, VideoOff, Video as VideoIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const VideoCall = () => {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('service');
  const userId = searchParams.get('user');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    initializeCall();
    return () => {
      cleanupCall();
    };
  }, []);

  const initializeCall = async () => {
    try {
      // Obtenir l'accès à la caméra et au microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialiser la connexion WebRTC
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = peerConnection;

      // Ajouter le stream local
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Gérer les candidats ICE
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Envoyer le candidat ICE au prestataire via WebSocket
          console.log('Candidat ICE:', event.candidate);
        }
      };

      // Gérer le stream distant
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
        }
      };

      // Créer et envoyer l'offre
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Envoyer l'offre au prestataire
      console.log('Offre créée:', offer);

      toast({
        title: "Appel vidéo initialisé",
        description: "En attente de connexion avec le prestataire...",
        type: "default"
      });

    } catch (error) {
      console.error('Erreur initialisation appel:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'initialiser l'appel vidéo",
        type: "error"
      });
    }
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const startRecording = () => {
    if (localStreamRef.current && remoteStreamRef.current) {
      const combinedStream = new MediaStream([
        ...localStreamRef.current.getTracks(),
        ...remoteStreamRef.current.getTracks()
      ]);
      
      const mediaRecorder = new MediaRecorder(combinedStream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appel-video-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Arrêter l'enregistrement après 30 secondes (exemple)
      setTimeout(() => {
        mediaRecorder.stop();
        setIsRecording(false);
      }, 30000);
    }
  };

  const endCall = () => {
    cleanupCall();
    window.close();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Appel vidéo</h1>
            <p className="text-gray-400">
              Service: {serviceId} | Utilisateur: {userId}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm ${
              isConnected ? 'bg-green-600' : 'bg-yellow-600'
            }`}>
              {isConnected ? 'Connecté' : 'En attente...'}
            </span>
          </div>
        </div>

        {/* Vidéos */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Vidéo locale */}
          <div className="relative">
            <h3 className="text-sm font-medium mb-2">Vous</h3>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-64 bg-gray-800 rounded-lg object-cover"
            />
            {isMuted && (
              <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                <MicOff className="w-4 h-4" />
              </div>
            )}
            {isVideoOff && (
              <div className="absolute top-2 left-2 bg-red-600 rounded-full p-1">
                <VideoOff className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Vidéo distante */}
          <div className="relative">
            <h3 className="text-sm font-medium mb-2">Prestataire</h3>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-64 bg-gray-800 rounded-lg object-cover"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-gray-400">En attente de connexion...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contrôles */}
        <div className="flex justify-center items-center gap-4">
          <Button
            onClick={toggleMute}
            className={`rounded-full p-4 ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isMuted ? 'Activer le micro' : 'Désactiver le micro'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>

          <Button
            onClick={toggleVideo}
            className={`rounded-full p-4 ${
              isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isVideoOff ? 'Activer la caméra' : 'Désactiver la caméra'}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
          </Button>

          <Button
            onClick={startRecording}
            disabled={isRecording}
            className={`rounded-full p-4 ${
              isRecording ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isRecording ? 'Enregistrement en cours...' : 'Démarrer l\'enregistrement'}
          >
            <div className="w-6 h-6">
              {isRecording ? (
                <div className="w-6 h-6 bg-red-600 rounded-full animate-pulse"></div>
              ) : (
                <div className="w-6 h-6 bg-white rounded-full"></div>
              )}
            </div>
          </Button>

          <Button
            onClick={endCall}
            className="bg-red-600 hover:bg-red-700 rounded-full p-4"
            title="Terminer l'appel"
          >
            <Phone className="w-6 h-6 rotate-90" />
          </Button>
        </div>

        {/* Informations de connexion */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Appel vidéo sécurisé via WebRTC</p>
          <p>Votre connexion est chiffrée de bout en bout</p>
        </div>
      </div>
    </div>
  );
};

export default VideoCall; 