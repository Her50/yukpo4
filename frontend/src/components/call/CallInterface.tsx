import React, { useEffect } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { useCall } from '@/hooks/useCall';

interface CallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  prestataire: {
    id: string;
    nom: string;
    avatar?: string;
  };
  isIncoming?: boolean;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({
  isOpen,
  onClose,
  prestataire,
  isIncoming = false
}) => {
  const {
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
  } = useCall({
    onCallEnd: onClose,
    onCallAccept: () => console.log('Appel accepté'),
    onCallReject: () => console.log('Appel refusé')
  });

  useEffect(() => {
    if (isIncoming) {
      incomingCall(true);
    }
  }, [isIncoming, incomingCall]);

  if (!isOpen) return null;

  const handleStartCall = () => {
    startCall(true);
  };

  const handleAcceptCall = () => {
    acceptCall();
  };

  const handleRejectCall = () => {
    rejectCall();
    onClose();
  };

  const handleEndCall = () => {
    endCall();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="w-full h-full flex flex-col">
        {/* En-tête */}
        <div className="flex justify-between items-center p-4 bg-black/50 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              {prestataire.avatar ? (
                <img 
                  src={prestataire.avatar} 
                  alt={prestataire.nom}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-semibold">
                  {prestataire.nom.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold">{prestataire.nom}</h3>
              <div className="flex items-center gap-2">
                <Badge variant={callState.isConnected ? "default" : "secondary"}>
                  {callState.isConnected ? "Connecté" : "En cours..."}
                </Badge>
                {callState.isMuted && <Badge variant="destructive">Micro coupé</Badge>}
                {!callState.isVideoEnabled && <Badge variant="destructive">Caméra coupée</Badge>}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white">
            ×
          </Button>
        </div>

        {/* Zone vidéo */}
        <div className="flex-1 relative">
          {/* Vidéo distante (plein écran) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            muted={false}
          />
          
          {/* Vidéo locale (petite fenêtre) */}
          <div className="absolute top-4 right-4 w-48 h-36 bg-black rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!callState.isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-white" />
              </div>
            )}
          </div>

          {/* État de l'appel */}
          {callState.isIncoming && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <Card className="bg-white p-6 text-center">
                <CardContent className="p-0">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Appel entrant</h3>
                  <p className="text-gray-600 mb-4">{prestataire.nom} vous appelle</p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={handleAcceptCall}
                      className="bg-green-500 hover:bg-green-600"
                      size="lg"
                    >
                      <Phone className="w-5 h-5 mr-2" />
                      Accepter
                    </Button>
                    <Button 
                      onClick={handleRejectCall}
                      variant="destructive"
                      size="lg"
                    >
                      <PhoneOff className="w-5 h-5 mr-2" />
                      Refuser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {callState.isOutgoing && !callState.isConnected && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <Card className="bg-white p-6 text-center">
                <CardContent className="p-0">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Phone className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Appel en cours</h3>
                  <p className="text-gray-600 mb-4">Connexion à {prestataire.nom}...</p>
                  <Button 
                    onClick={handleEndCall}
                    variant="destructive"
                    size="lg"
                  >
                    <PhoneOff className="w-5 h-5 mr-2" />
                    Annuler
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Contrôles */}
        <div className="p-6 bg-black/50 flex justify-center">
          <div className="flex items-center gap-4">
            {/* Micro */}
            <Button
              onClick={toggleMute}
              variant={callState.isMuted ? "destructive" : "secondary"}
              size="lg"
              className="w-12 h-12 rounded-full"
            >
              {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            {/* Appel principal */}
            {callState.isIncoming ? (
              <Button
                onClick={handleAcceptCall}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600"
                size="lg"
              >
                <Phone className="w-6 h-6" />
              </Button>
            ) : callState.isConnected ? (
              <Button
                onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600"
                size="lg"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            ) : (
              <Button
                onClick={handleStartCall}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600"
                size="lg"
              >
                <Phone className="w-6 h-6" />
              </Button>
            )}

            {/* Caméra */}
            <Button
              onClick={toggleVideo}
              variant={!callState.isVideoEnabled ? "destructive" : "secondary"}
              size="lg"
              className="w-12 h-12 rounded-full"
            >
              {!callState.isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}; 