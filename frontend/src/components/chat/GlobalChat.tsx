import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/buttons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, Video, Mic, Image, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';
import MessageEditor from './MessageEditor';

// Import des hooks WebSocket existants
import { usePrestataireStatus } from '@/hooks/useWebSocket';
import { useNotificationsWebSocket } from '@/hooks/useWebSocket';
import { usePrestataireInfo } from '@/hooks/usePrestataireInfo';

interface Service {
  id: number;
  user_id: number;
  data?: any;
  score?: number;
}

interface GlobalChatProps {
  serviceId?: number;
  prestataireId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalChat: React.FC<GlobalChatProps> = ({ 
  serviceId, 
  prestataireId, 
  isOpen, 
  onClose 
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { toast } = useToast();
  
  // États du chat (copiés de ResultatBesoin)
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // États pour la gestion des fichiers
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [prestataireGallery, setPrestataireGallery] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // États pour l'enregistrement audio
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);

  // WebSocket et statut (copiés de ResultatBesoin)
  const userId = user?.id ? parseInt(user.id, 10) : 0;
  const { isConnected: wsConnected, checkUserStatus, userStatus } = usePrestataireStatus(
    isNaN(userId) ? 0 : userId
  );
  const { isConnected: notificationsConnected, notifications } = useNotificationsWebSocket(
    isNaN(userId) ? 0 : userId
  );
  const { prestataires, fetchPrestatairesBatch } = usePrestataireInfo();

  // État pour les indicateurs de frappe et métriques WebSocket
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [wsMetrics, setWsMetrics] = useState({
    connectionTime: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastPing: 0,
    latency: 0
  });

  // État pour le mode hors ligne
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineMessages, setOfflineMessages] = useState<Array<{
    id: string;
    serviceId: number;
    content: string;
    timestamp: Date;
    type: 'text' | 'audio';
    audioBlob?: Blob;
  }>>([]);

  // État pour l'édition des messages
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Références
  const fileInputImagesRef = useRef<HTMLInputElement>(null);
  const fileInputDocumentsRef = useRef<HTMLInputElement>(null);

  // Initialiser le chat si un service est fourni
  useEffect(() => {
    if (serviceId && prestataireId && isOpen) {
      initializeChat();
    }
  }, [serviceId, prestataireId, isOpen]);

  // Initialiser le chat
  const initializeChat = () => {
    if (!prestataireId) return;
    
    // Récupérer les informations du prestataire
    const prestataireInfo = prestataires.get(prestataireId);
    const nomPrestataire = prestataireInfo?.nom_complet || `Prestataire #${prestataireId}`;
    
    // Message de bienvenue
    const welcomeMessage = {
      id: Date.now().toString(),
      from: 'prestataire',
      content: `Bonjour 👋, je suis ${nomPrestataire}. Que puis-je faire pour vous ?`,
      timestamp: new Date(),
      status: 'read',
      type: 'text'
    };
    
    setChatMessages([welcomeMessage]);
    
    // Activer les WebSockets
    if (wsConnected) {
      checkUserStatus(prestataireId);
      handleTypingIndicator(serviceId || 0, true);
      updateWsMetrics('sent');
      
      toast({
        title: "Chat activé",
        description: `Connexion WebSocket établie avec ${nomPrestataire}`,
        type: "success"
      });
    }
  };

  // Gestion des indicateurs de frappe WebSocket
  const handleTypingIndicator = (serviceId: number, isTyping: boolean) => {
    if (isTyping) {
      setTypingUsers(prev => new Set([...prev, serviceId]));
      setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(serviceId);
          return newSet;
        });
      }, 3000);
    } else {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serviceId);
        return newSet;
      });
    }
  };

  // Mettre à jour les métriques WebSocket
  const updateWsMetrics = (type: 'sent' | 'received' | 'ping', value?: number) => {
    setWsMetrics(prev => {
      switch (type) {
        case 'sent':
          return { ...prev, messagesSent: prev.messagesSent + 1 };
        case 'received':
          return { ...prev, messagesReceived: prev.messagesReceived + 1 };
        case 'ping':
          return { ...prev, lastPing: value || Date.now() };
        default:
          return prev;
      }
    });
  };

  // Démarrer l'enregistrement audio
  const startAudioRecording = () => {
    if (isRecording) return;
    
    setHoldStartTime(Date.now());
    
    const timer = setTimeout(async () => {
      try {
        setRecordingSeconds(0);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          const audioMessage = {
            id: Date.now().toString(),
            type: 'audio',
            content: '🎵 Message audio',
            timestamp: new Date().toISOString(),
            sender: 'client',
            from: 'client',
            isLocal: true,
            audioBlob: audioBlob,
            audioUrl: audioUrl
          };
          
          setChatMessages(prev => [...prev, audioMessage]);
          setAudioChunks([]);
          stream.getTracks().forEach(track => track.stop());
          setRecordingSeconds(0);
          
          // Envoyer via l'API en arrière-plan
          sendAudioMessageInBackground(audioBlob, audioMessage.id);
        };
        
        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        
        // Démarrer le compteur
        const interval = setInterval(() => {
          setRecordingSeconds(prev => prev + 1);
        }, 1000);
        setRecordingTimer(interval);
        
      } catch (error) {
        console.error('Erreur enregistrement audio:', error);
        toast({
          title: "Erreur audio",
          description: "Impossible d'accéder au microphone",
          type: "error"
        });
      }
    }, 300);
    
    setHoldStartTime(Date.now());
  };

  // Arrêter l'enregistrement audio
  const stopAudioRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setHoldStartTime(null);
      
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
    }
  };

  // Annuler l'enregistrement
  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setHoldStartTime(null);
      
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
      
      // Nettoyer le stream
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  // Envoyer le message audio en arrière-plan
  const sendAudioMessageInBackground = async (audioBlob: Blob, messageId: string) => {
    try {
      // Convertir en base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result as string;
        
        // Envoyer via l'API
        const response = await fetch('/api/chat/send-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            serviceId,
            prestataireId,
            audioData: base64Audio,
            messageId
          })
        });
        
        if (response.ok) {
          // Marquer comme envoyé
          setChatMessages(prev => 
            prev.map(msg => 
              msg.id === messageId 
                ? { ...msg, status: 'sent' }
                : msg
            )
          );
          updateWsMetrics('sent');
        }
      };
      reader.readAsDataURL(audioBlob);
      
    } catch (error) {
      console.error('Erreur envoi audio:', error);
      // Garder le message en local
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'error' }
            : msg
        )
      );
    }
  };

  // Envoyer un message texte
  const sendChatMessage = () => {
    if (!newMessage.trim() || !serviceId || !prestataireId) return;
    
    const message = {
      id: Date.now().toString(),
      from: 'client',
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent',
      type: 'text'
    };
    
    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
    updateWsMetrics('sent');
    
    // Envoyer via l'API
    sendTextMessageInBackground(message);
  };

  // Envoyer le message texte en arrière-plan
  const sendTextMessageInBackground = async (message: any) => {
    try {
      const response = await fetch('/api/chat/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          serviceId,
          prestataireId,
          content: message.content,
          messageId: message.id
        })
      });
      
      if (response.ok) {
        // Marquer comme livré
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === message.id 
              ? { ...msg, status: 'delivered' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      // Garder le message en local
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === message.id 
            ? { ...msg, status: 'error' }
            : msg
        )
      );
    }
  };

  // Gérer les fichiers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const fileMessage = {
          id: Date.now().toString() + Math.random(),
          from: 'client',
          type,
          fileName: file.name,
          fileSize: file.size,
          fileUrl: reader.result as string,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };
        
        setChatMessages(prev => [...prev, fileMessage]);
        updateWsMetrics('sent');
        
        // Envoyer le fichier en arrière-plan
        sendFileInBackground(file, fileMessage);
      };
      reader.readAsDataURL(file);
    });
    
    // Réinitialiser l'input
    event.target.value = '';
  };

  // Envoyer le fichier en arrière-plan
  const sendFileInBackground = async (file: File, message: any) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('serviceId', serviceId?.toString() || '');
      formData.append('prestataireId', prestataireId?.toString() || '');
      formData.append('messageId', message.id);
      
      const response = await fetch('/api/chat/send-file', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (response.ok) {
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === message.id 
              ? { ...msg, status: 'delivered' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Erreur envoi fichier:', error);
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === message.id 
            ? { ...msg, status: 'error' }
            : msg
        )
      );
    }
  };

  // Gérer les appels
  const handleCall = (service: Service) => {
    const phone = service.data?.telephone;
    if (phone && phone !== 'Non spécifié') {
      window.open(`tel:${phone}`, '_blank');
    } else {
      toast({
        title: "Téléphone non disponible",
        description: "Le prestataire n'a pas fourni de numéro de téléphone",
        type: "warning"
      });
    }
  };

  // Gérer les appels vidéo
  const handleVideoCall = (service: Service) => {
    toast({
      title: "Appel vidéo",
      description: "Fonctionnalité d'appel vidéo en cours de développement",
      type: "info"
    });
  };

  // Supprimer un message
  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch('/api/chat/delete-message', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ messageId })
      });

      if (response.ok) {
        setChatMessages(prev => prev.filter(msg => msg.id !== messageId));
        return true;
      } else {
        console.error('Erreur suppression message');
        return false;
      }
    } catch (error) {
      console.error('Erreur suppression message:', error);
      return false;
    }
  };

  // Modifier un message
  const editMessage = async (messageId: string, newContent: string) => {
    try {
      const response = await fetch('/api/chat/edit-message', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          messageId,
          newContent
        })
      });

      if (response.ok) {
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  content: newContent,
                  isEdited: true,
                  editTimestamp: new Date()
                }
              : msg
          )
        );
        return true;
      } else {
        console.error('Erreur modification message');
        return false;
      }
    } catch (error) {
      console.error('Erreur modification message:', error);
      return false;
    }
  };

  // Gérer l'édition des messages
  const handleStartEdit = (messageId: string) => {
    setEditingMessageId(messageId);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
  };

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    const success = await editMessage(messageId, newContent);
    if (success) {
      setEditingMessageId(null);
    }
    return success;
  };

  // Formater le temps des messages
  const formatMessageTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString();
  };

  // Récupérer la valeur d'un champ de service
  const getServiceFieldValue = (field: any) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (field.valeur) return field.valeur;
    if (field.value) return field.value;
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl h-96 flex flex-col">
        {/* Header du chat */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-blue-500 text-white text-sm">
                {prestataireId?.toString().charAt(0).toUpperCase() || 'P'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">
                {prestataireId ? `Prestataire #${prestataireId}` : 'Chat global'}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {/* Statut WebSocket - SUPPRIMÉ */}
                {/* {wsConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-green-500" />
                    <span className="text-green-600">En ligne</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-500">Hors ligne</span>
                  </>
                )} */}
                {serviceId && (
                  <>
                    <span>Service #{serviceId}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Boutons d'action */}
          <div className="flex items-center gap-2">
            {/* Appel audio */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => serviceId && handleCall({ id: serviceId, user_id: prestataireId || 0, data: {} })}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              title="Appel audio"
            >
              <Phone className="w-4 h-4" />
            </Button>
            
            {/* Appel vidéo */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => serviceId && handleVideoCall({ id: serviceId, user_id: prestataireId || 0, data: {} })}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              title="Appel vidéo"
            >
              <Video className="w-4 h-4" />
            </Button>
            
            {/* Fermer */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </Button>
          </div>
        </div>
        
        {/* Zone des messages */}
        <div className="flex-1 p-4 bg-gray-50 overflow-y-auto space-y-3">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>Aucun message pour le moment</p>
              <p className="text-sm">Commencez la conversation !</p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.from === 'client' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg ${
                    message.from === 'client'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 border'
                  }`}
                >
                  {/* Affichage selon le type de message */}
                  {message.type === 'audio' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🎵</span>
                      <audio 
                        controls 
                        className="max-w-full"
                        src={message.audioUrl || (message.audioBlob ? URL.createObjectURL(message.audioBlob) : '')}
                      >
                        Votre navigateur ne supporte pas l'élément audio.
                      </audio>
                    </div>
                  ) : message.type === 'image' ? (
                    <div className="space-y-2">
                      <img 
                        src={message.fileUrl} 
                        alt={message.fileName || 'Image'}
                        className="max-w-full rounded-lg shadow-sm"
                      />
                      <div className="text-xs opacity-70">
                        🖼️ {message.fileName || 'Image'}
                      </div>
                    </div>
                  ) : message.type === 'video' ? (
                    <div className="space-y-2">
                      <video 
                        controls 
                        className="max-w-full rounded-lg shadow-sm"
                        src={message.fileUrl}
                      >
                        Votre navigateur ne supporte pas l'élément vidéo.
                      </video>
                      <div className="text-xs opacity-70">
                        🎥 {message.fileName || 'Vidéo'}
                      </div>
                    </div>
                  ) : message.type === 'document' ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{message.fileName || 'Document'}</p>
                        <p className="text-xs text-gray-500">
                          {message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Document'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(message.fileUrl, '_blank')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ouvrir
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                  
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-70">
                      {formatMessageTime(message.timestamp)}
                      {message.isEdited && (
                        <span className="ml-2 text-blue-500">(modifié)</span>
                      )}
                    </span>
                    {message.from === 'client' && (
                      <div className="flex items-center gap-1">
                        {message.status === 'sent' && <Eye className="w-3 h-3" />}
                        {message.status === 'delivered' && <Eye className="w-3 h-3" />}
                        {message.status === 'read' && <EyeOff className="w-3 h-3" />}
                        
                        {/* Éditeur de message */}
                        <MessageEditor
                          message={message}
                          isEditing={editingMessageId === message.id}
                          onStartEdit={() => handleStartEdit(message.id)}
                          onCancelEdit={handleCancelEdit}
                          onSaveEdit={handleSaveEdit}
                          onDelete={deleteMessage}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Zone de saisie */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            {/* Bouton audio intelligent */}
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={startAudioRecording}
              onMouseUp={stopAudioRecording}
              onMouseLeave={cancelRecording}
              onTouchStart={startAudioRecording}
              onTouchEnd={stopAudioRecording}
              onTouchCancel={cancelRecording}
              className={`${
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg scale-110' 
                  : holdStartTime && !isRecording
                  ? 'bg-yellow-400 text-white hover:bg-yellow-500 shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-0'
              } transition-all duration-200 rounded-full w-12 h-12 p-0 flex items-center justify-center relative`}
              title={
                isRecording 
                  ? "🎙️ Relâchez pour arrêter et envoyer" 
                  : holdStartTime && !isRecording
                  ? "🎙️ Continuez à maintenir pour enregistrer..."
                  : "🎙️ Maintenez enfoncé pour enregistrer, relâchez pour envoyer"
              }
            >
              {isRecording ? (
                <div className="flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                </div>
              ) : holdStartTime && !isRecording ? (
                <div className="flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
                </div>
              ) : (
                <Mic className="w-5 h-5" />
              )}
              
              {/* Compteur de secondes */}
              {isRecording && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                  {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </div>
              )}
              
              {/* Indicateur "Maintenez enfoncé" */}
              {!isRecording && !holdStartTime && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-600 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap opacity-80">
                  Maintenez
                </div>
              )}
              
              {/* Indicateur "Continuez à maintenir" pendant le délai */}
              {holdStartTime && !isRecording && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                  Continuez...
                </div>
              )}
            </Button>

            {/* Bouton d'envoi d'images et vidéos */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputImagesRef.current?.click()}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
              title="Envoyer des images ou vidéos"
            >
              <Image className="w-5 h-5" />
            </Button>

            {/* Bouton d'envoi de fichiers */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputDocumentsRef.current?.click()}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
              title="Envoyer des documents (PDF, Word, Excel, etc.)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </Button>
            
            {/* Indicateur d'enregistrement en cours */}
            {isRecording && (
              <div className="flex items-center gap-3 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-full border border-red-200">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                </div>
                <span className="font-medium">🎙️ Enregistrement...</span>
              </div>
            )}
            
            {/* Zone de saisie de texte */}
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              placeholder="Tapez votre message..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
            />
            
            {/* Bouton d'envoi */}
            <Button 
              onClick={sendChatMessage}
              disabled={!newMessage.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Inputs cachés pour les fichiers */}
        <input
          ref={fileInputImagesRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => handleFileUpload(e, 'image')}
          className="hidden"
        />
        <input
          ref={fileInputDocumentsRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          multiple
          onChange={(e) => handleFileUpload(e, 'document')}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default GlobalChat; 