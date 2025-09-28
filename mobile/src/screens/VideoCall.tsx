import { useState, useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
        // Note: Blob, URL.createObjectURL, document.createElement n'existent pas en React Native
        // Dans React Native, on utiliserait react-native-fs ou expo-file-system pour sauvegarder
        console.log('Enregistrement terminé - fonctionnalité non disponible sur mobile');
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
    // Note: window.close() n'existe pas en React Native
    // On utiliserait navigation.goBack() ou navigation.navigate()
  };

  return (
    <View style="min-h-screen bg-gray-900 text-white p-4">
      <View style="max-w-6xl mx-auto">
        {/* Header */}
        <View style="flex justify-between items-center mb-6">
          <View>
            <Text style="text-2xl font-bold">Appel vidéo</Text>
            <Text style="text-gray-400">
              Service: {serviceId} | Utilisateur: {userId}
            </Text>
          </View>
          
          <View style="flex items-center gap-2">
            <Text style={`px-3 py-1 rounded-full text-sm ${
              isConnected ? 'bg-green-600' : 'bg-yellow-600'
            }`}>
              {isConnected ? 'Connecté' : 'En attente...'}
            </Text>
          </View>
        </View>

        {/* Vidéos */}
        <View style="grid grid-cols-2 gap-4 mb-6">
          {/* Vidéo locale */}
          <View style="relative">
            <Text style="text-sm font-medium mb-2">Vous</Text>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style="w-full h-64 bg-gray-800 rounded-lg object-cover"
            />
            {isMuted && (
              <View style="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                <MicOff style="w-4 h-4" />
              </View>
            )}
            {isVideoOff && (
              <View style="absolute top-2 left-2 bg-red-600 rounded-full p-1">
                <VideoOff style="w-4 h-4" />
              </View>
            )}
          </View>

          {/* Vidéo distante */}
          <View style="relative">
            <Text style="text-sm font-medium mb-2">Prestataire</Text>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style="w-full h-64 bg-gray-800 rounded-lg object-cover"
            />
            {!isConnected && (
              <View style="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
                <View style="text-center">
                  <View style="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2"></View>
                  <Text style="text-gray-400">En attente de connexion...</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Contrôles */}
        <View style="flex justify-center items-center gap-4">
          <TouchableOpacity
            onPress={toggleMute}
            style={`rounded-full p-4 ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isMuted ? 'Activer le micro' : 'Désactiver le micro'}
          >
            {isMuted ? <MicOff style="w-6 h-6" /> : <Mic style="w-6 h-6" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleVideo}
            style={`rounded-full p-4 ${
              isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isVideoOff ? 'Activer la caméra' : 'Désactiver la caméra'}
          >
            {isVideoOff ? <VideoOff style="w-6 h-6" /> : <VideoIcon style="w-6 h-6" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={startRecording}
            disabled={isRecording}
            style={`rounded-full p-4 ${
              isRecording ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isRecording ? 'Enregistrement en cours...' : 'Démarrer l\'enregistrement'}
          >
            <View style="w-6 h-6">
              {isRecording ? (
                <View style="w-6 h-6 bg-red-600 rounded-full animate-pulse"></View>
              ) : (
                <View style="w-6 h-6 bg-white rounded-full"></View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={endCall}
            style="bg-red-600 hover:bg-red-700 rounded-full p-4"
            title="Terminer l'appel"
          >
            <Texthone style="w-6 h-6 rotate-90" />
          </TouchableOpacity>
        </View>

        {/* Informations de connexion */}
        <View style="mt-6 text-center text-sm text-gray-400">
          <Text>Appel vidéo sécurisé via WebRTC</Text>
          <Text>Votre connexion est chiffrée de bout en bout</Text>
        </View>
      </View>
    </View>
  );
};

export default VideoCall; 




