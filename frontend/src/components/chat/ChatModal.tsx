import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { apiGet, apiPost } from '@/lib/api';
import { Service } from '@/types/service';
import {
  Image,
  Images,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Smile,
  Star,
  UserMinus,
  UserPlus,
  Users,
  Video,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import UserMentionPicker from '../ui/UserMentionPicker';

// Fonction utilitaire pour extraire la valeur d'un champ de service
const getServiceFieldValue = (field: any): string => {
  if (!field) return 'Non spécifié';

  if (typeof field === 'string') return field;

  if (field && typeof field === 'object') {
    if (field.valeur !== undefined) {
      const value = field.valeur;
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
      if (typeof value === 'number') return value.toString();
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    }

    if (Object.keys(field).length > 0) {
      const possibleValues = ['value', 'content', 'text', 'data', 'info'];
      for (const key of possibleValues) {
        if (field[key] !== undefined) {
          const value = field[key];
          if (typeof value === 'string') return value;
          if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
          if (typeof value === 'number') return value.toString();
        }
      }
    }
  }

  if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
  if (typeof field === 'number') return field.toString();

  return 'Non spécifié';
};

interface ChatModalProps {
  service: Service;
  prestataires: Map<number, any>;
  user: any;
  wsConnected: boolean;
  onClose: () => void;
}

interface Participant {
  user_id: number;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  role: string;
  invited_by?: number;
  joined_at: string;
  can_remove: boolean;
}

const ChatModal: React.FC<ChatModalProps> = ({
  service,
  prestataires,
  user,
  wsConnected,
  onClose
}) => {
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // États audio simplifiés
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const [showGallery, setShowGallery] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ✅ NOUVEAU: États pour @mention
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<number[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showParticipantsList, setShowParticipantsList] = useState(false);

  // ✅ NOUVEAU: État pour le système de réponse/citation
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Informations du prestataire
  const prestataireInfo = prestataires.get(service.user_id);
  const nomPrestataire = prestataireInfo?.nom_complet || `Prestataire #${service.user_id}`;
  const titreService = getServiceFieldValue(service.data?.titre_service);
  const categorieService = getServiceFieldValue(service.data?.category);

  // Liste d'émojis populaires
  const popularEmojis = ['😊', '😂', '❤️', '👍', '👎', '😍', '🤔', '😢', '😮', '🔥', '💯', '🎉', '👏', '🙏', '💪'];

  // Récupérer le numéro de téléphone réel du prestataire
  const getPhoneNumber = () => {
    const serviceTel = getServiceFieldValue(service.data?.telephone);
    if (serviceTel && serviceTel !== 'Non spécifié') return serviceTel;

    const serviceWhatsapp = getServiceFieldValue(service.data?.whatsapp);
    if (serviceWhatsapp && serviceWhatsapp !== 'Non spécifié') return serviceWhatsapp;

    if (prestataireInfo?.telephone) return prestataireInfo.telephone;

    return null;
  };

  // Initialiser le chat avec un message de bienvenue
  useEffect(() => {
    const welcomeMessage = {
      id: Date.now().toString(),
      from: 'prestataire',
      content: `Bonjour 👋, je suis ${nomPrestataire} pour le service "${titreService || 'Service'}"${categorieService ? ` (${categorieService})` : ''}. Que puis-je faire pour vous ?`,
      timestamp: new Date(),
      status: 'read',
      type: 'text',
      editable: false
    };
    setChatMessages([welcomeMessage]);
  }, [service, prestataires]);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ✅ NOUVEAU: Charger les participants au montage
  useEffect(() => {
    loadParticipants();
  }, [service.id]);

  const loadParticipants = async () => {
    if (!service?.id) return;

    try {
      const response = await apiGet<Participant[]>(`/api/conversations/${service.id}/participants`);
      if (response.success && response.data) {
        setParticipants(response.data);
        console.log('[ChatModal] Participants chargés:', response.data);
      }
    } catch (error) {
      console.error('[ChatModal] Erreur chargement participants:', error);
    }
  };

  // ✅ NOUVEAU: Inviter un utilisateur
  const inviteUser = async (userId: number, context?: string) => {
    if (!service?.id) return;

    try {
      const response = await apiPost(`/api/conversations/${service.id}/invite`, {
        user_id: userId,
        context
      });

      if (response.success) {
        toast({
          title: "✅ Utilisateur invité",
          description: "L'utilisateur a été ajouté à la conversation.",
        });
        loadParticipants();
      }
    } catch (error) {
      console.error('[ChatModal] Erreur invitation:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible d'inviter cet utilisateur",
      });
    }
  };

  // ✅ NOUVEAU: Retirer un participant
  const removeParticipant = async (userId: number) => {
    if (!service?.id) return;

    if (!confirm('Êtes-vous sûr de vouloir retirer cette personne de la conversation ?')) return;

    try {
      await apiPost(`/api/conversations/${service.id}/participants/${userId}`, {});
      loadParticipants();
      toast({
        title: "✅ Participant retiré",
        description: "Le participant a été retiré de la conversation",
      });
    } catch (error) {
      console.error('[ChatModal] Erreur retrait participant:', error);
    }
  };

  // ✅ NOUVEAU: Gérer la saisie avec détection @
  const handleTyping = (text: string, cursorPos?: number) => {
    setNewMessage(text);
    if (cursorPos !== undefined) setCursorPosition(cursorPos);

    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1 && (cursorPos === undefined || cursorPos > lastAtIndex)) {
      const query = text.substring(lastAtIndex + 1, cursorPos || text.length);

      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentionPicker(true);
      } else {
        setShowMentionPicker(false);
      }
    } else {
      setShowMentionPicker(false);
    }
  };

  // ✅ NOUVEAU: Insérer une mention
  const insertMention = (user: any) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    if (lastAtIndex === -1) return;

    const before = newMessage.substring(0, lastAtIndex);
    const mention = `@${user.nom_complet} `;
    const after = newMessage.substring(cursorPosition);

    const newText = before + mention + after;
    setNewMessage(newText);

    if (!mentionedUsers.includes(user.id)) {
      setMentionedUsers([...mentionedUsers, user.id]);
    }

    inviteUser(user.id, 'mention');

    setShowMentionPicker(false);
    setMentionQuery('');
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      from: 'client',
      content: newMessage,
      timestamp: new Date(),
      status: 'sent',
      type: 'text',
      editable: true,
      mentioned_users: mentionedUsers.length > 0 ? mentionedUsers : undefined,
      reply_to_id: replyingTo?.id || undefined
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
    setMentionedUsers([]);
    setReplyingTo(null); // Réinitialiser la réponse
  };

  // Système audio complètement revu
  const startAudioRecording = async () => {
    try {
      console.log('🎤 [ChatModal] Démarrage enregistrement audio...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        console.log('📊 [ChatModal] Chunk audio reçu:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log('⏹️ [ChatModal] Enregistrement arrêté, chunks:', chunks.length);
        stream.getTracks().forEach(track => track.stop());

        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setRecordedAudioUrl(audioUrl);
          console.log('✅ [ChatModal] Audio blob créé:', audioBlob.size, 'bytes');

          toast({
            title: "✅ Audio enregistré",
            description: "Cliquez 'Envoyer' pour envoyer votre message vocal",
            type: "success"
          });
        }
      };

      setMediaRecorder(recorder);
      setIsRecording(true);
      recorder.start(1000); // Enregistrer par chunks de 1 seconde

      toast({
        title: "🎤 Enregistrement en cours",
        description: "Parlez maintenant, cliquez 'Arrêter' quand vous avez fini",
        type: "success"
      });

    } catch (error) {
      console.error('❌ [ChatModal] Erreur enregistrement audio:', error);
      toast({
        title: "❌ Erreur microphone",
        description: "Veuillez autoriser l'accès au microphone",
        type: "error"
      });
    }
  };

  const stopAudioRecording = () => {
    console.log('⏹️ [ChatModal] Arrêt enregistrement...');
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const sendAudioMessage = () => {
    console.log('📤 [ChatModal] Envoi message audio...');
    if (recordedAudioUrl) {
      const audioMessage = {
        id: Date.now().toString(),
        from: 'client',
        content: '🎤 Message vocal',
        timestamp: new Date(),
        status: 'sent',
        type: 'audio',
        audioUrl: recordedAudioUrl,
        editable: true
      };

      setChatMessages(prev => [...prev, audioMessage]);
      setRecordedAudioUrl(null);

      toast({
        title: "🎵 Message vocal envoyé",
        description: "Votre message vocal a été envoyé avec succès",
        type: "success"
      });
    }
  };

  const cancelAudioRecording = () => {
    console.log('❌ [ChatModal] Annulation audio...');
    setRecordedAudioUrl(null);
    setIsRecording(false);
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, content: newContent, edited: true, editedAt: new Date() }
        : msg
    ));
    setEditingMessageId(null);
    setEditingContent('');

    toast({
      title: "✅ Message modifié",
      description: "Votre message a été mis à jour",
      type: "success"
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    setChatMessages(prev => prev.filter(msg => msg.id !== messageId));

    toast({
      title: "🗑️ Message supprimé",
      description: "Le message a été supprimé de la conversation",
      type: "success"
    });
  };

  const startEditing = (message: any) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleCall = () => {
    const phoneNumber = getPhoneNumber();

    if (phoneNumber) {
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      console.log(`📞 [ChatModal] Appel vers le numéro: ${cleanPhone}`);

      window.open(`tel:${cleanPhone}`, '_self');

      toast({
        title: "📞 Appel en cours",
        description: `Appel vers ${nomPrestataire} (${phoneNumber})`,
        type: "success"
      });
    } else {
      toast({
        title: "❌ Numéro non disponible",
        description: "Aucun numéro de téléphone n'est renseigné pour ce prestataire",
        type: "error"
      });
    }
  };

  const handleVideoCall = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(() => {
          const videoCallUrl = `/video-call?service=${service.id}&prestataire=${service.user_id}&client=${user?.id}`;
          const videoWindow = window.open(
            videoCallUrl,
            'video-call',
            'width=1200,height=800,scrollbars=no,resizable=yes,location=no,menubar=no,toolbar=no'
          );

          if (videoWindow) {
            toast({
              title: "🎥 Appel vidéo démarré",
              description: `Connexion vidéo avec ${nomPrestataire}`,
              type: "success"
            });
          } else {
            toast({
              title: "❌ Erreur",
              description: "Impossible d'ouvrir la fenêtre d'appel vidéo. Vérifiez les popups.",
              type: "error"
            });
          }
        })
        .catch((error) => {
          console.error('Erreur permissions média:', error);
          toast({
            title: "❌ Permissions requises",
            description: "Veuillez autoriser l'accès à la caméra et au microphone pour les appels vidéo",
            type: "error"
          });
        });
    } else {
      toast({
        title: "❌ Non supporté",
        description: "Votre navigateur ne supporte pas les appels vidéo",
        type: "error"
      });
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const openGallery = () => {
    setShowGallery(true);
  };

  const formatMessageTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return '--:--';
      }
      return dateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '--:--';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header du chat */}
        <div className="flex justify-between items-center p-3 sm:p-6 border-b bg-gray-50">
          <div className="flex items-center gap-2 sm:gap-4">
            <Avatar className="w-8 h-8 sm:w-12 sm:h-12 ring-2 ring-blue-200">
              <AvatarImage
                src={prestataireInfo?.avatar || prestataireInfo?.photo_profil}
                alt="Avatar prestataire"
              />
              <AvatarFallback className="bg-blue-500 text-white font-semibold text-xs sm:text-base">
                {nomPrestataire.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-xl font-bold text-gray-900 truncate">
                {nomPrestataire}
              </h3>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                {wsConnected ? (
                  <div className="flex items-center gap-1">
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 font-medium">En ligne</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <WifiOff className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Hors ligne</span>
                  </div>
                )}
                <span className="text-gray-300">•</span>
                <span className="text-gray-600">{titreService || 'Service'}</span>
                {categorieService && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-blue-600 font-medium">{categorieService}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-3">
            {/* ✅ NOUVEAU: Bouton WhatsApp (prioritaire si disponible) */}
            {(prestataireInfo?.whatsapp || service.data?.whatsapp?.valeur || service.data?.whatsapp || prestataireInfo?.telephone) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const whatsappNumber = prestataireInfo?.whatsapp ||
                    service.data?.whatsapp?.valeur ||
                    service.data?.whatsapp ||
                    prestataireInfo?.telephone;

                  if (!whatsappNumber) {
                    toast({
                      title: "WhatsApp",
                      description: "Numéro WhatsApp non disponible",
                      type: "error"
                    });
                    return;
                  }

                  const phoneNumber = whatsappNumber.replace(/\s+/g, '').replace(/\+/g, '');
                  const serviceName = titreService || 'votre service';
                  const message = encodeURIComponent(`Bonjour ${nomPrestataire}, je souhaite discuter de ${serviceName}.`);
                  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="text-white bg-green-600 hover:bg-green-700 hover:text-white rounded-xl relative"
                title="Contacter sur WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                  WA
                </span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={openGallery}
              className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl"
              title="Voir la galerie"
            >
              <Images className="w-5 h-5" />
            </Button>

            {/* ✅ Bouton liste des participants */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowParticipantsList(true)}
              className={`rounded-xl relative ${participants.length > 2
                ? 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50'
                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                }`}
              title={`Participants (${participants.length})`}
            >
              <Users className="w-5 h-5" />
              {participants.length > 2 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {participants.length}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCall}
              disabled={!getPhoneNumber()}
              className={`rounded-xl ${getPhoneNumber()
                ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                : 'text-gray-400 cursor-not-allowed'
                }`}
              title={getPhoneNumber() ? `Appeler ${getPhoneNumber()}` : "Numéro non disponible"}
            >
              <Phone className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleVideoCall}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl"
              title="Appel vidéo"
            >
              <Video className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-xl"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Zone des messages */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50">
          <div className="space-y-2 sm:space-y-4">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.from === 'client' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-4 rounded-2xl shadow-sm group relative ${message.from === 'client'
                    ? 'bg-white border-2 border-blue-200 text-gray-900'
                    : 'bg-gray-100 border border-gray-200 text-gray-900'
                    }`}
                >
                  {/* Contenu du message ou mode édition */}
                  {editingMessageId === message.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full p-3 text-sm border border-gray-300 rounded-lg resize-none text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleEditMessage(message.id, editingContent)}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm font-medium"
                        >
                          ✅ Sauver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEditing}
                          className="px-4 py-2 text-sm"
                        >
                          ❌ Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ✅ NOUVEAU: Afficher le message cité si présent */}
                      {message.reply_to && (
                        <div className="mb-3 p-3 bg-gray-50 border-l-4 border-blue-500 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-semibold text-blue-600">
                              ↩️ Réponse à {message.reply_to.sender_name || 'Message'}
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 italic line-clamp-2">
                            {message.reply_to.content_type === 'text' && message.reply_to.content}
                            {message.reply_to.content_type === 'audio' && '🎤 Message audio'}
                            {message.reply_to.content_type === 'image' && '🖼️ Image'}
                            {message.reply_to.content_type === 'file' && '📄 Fichier'}
                            {message.reply_to.content_type === 'video' && '🎥 Vidéo'}
                          </p>
                        </div>
                      )}

                      {/* Message audio */}
                      {message.type === 'audio' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                              <Mic className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-800">🎤 Message vocal</div>
                              <div className="text-xs text-gray-500">Cliquez pour écouter</div>
                            </div>
                          </div>
                          <audio controls className="w-full rounded-lg">
                            <source src={message.audioUrl} type="audio/webm" />
                            <source src={message.audioUrl} type="audio/wav" />
                            Votre navigateur ne supporte pas l'audio.
                          </audio>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-gray-500 font-medium">
                            {formatMessageTime(message.timestamp)}
                            {message.edited && (
                              <span className="ml-2 text-blue-600">(modifié)</span>
                            )}
                          </div>

                          {/* ✅ NOUVEAU: Bouton Répondre (toujours visible) */}
                          <button
                            onClick={() => setReplyingTo({
                              id: message.id,
                              sender_name: message.from === 'client' ? user?.name : nomPrestataire,
                              content: message.content,
                              content_type: message.type || 'text',
                              audioUrl: message.audioUrl
                            })}
                            className="text-xs text-gray-500 hover:text-blue-600 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <span>↩️</span>
                            <span>Répondre</span>
                          </button>
                        </div>

                        {/* Actions sur les messages du client - ICÔNES VISIBLES */}
                        {message.from === 'client' && message.editable && message.type !== 'audio' && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(message)}
                              className="p-2 h-8 w-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 shadow-sm border border-blue-200"
                              title="Modifier ce message"
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMessage(message.id)}
                              className="p-2 h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 shadow-sm border border-red-200"
                              title="Supprimer ce message"
                            >
                              🗑️
                            </Button>
                          </div>
                        )}

                        {/* Action suppression pour les messages audio */}
                        {message.from === 'client' && message.editable && message.type === 'audio' && (
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMessage(message.id)}
                              className="p-2 h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 shadow-sm border border-red-200"
                              title="Supprimer ce message vocal"
                            >
                              🗑️
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">En train d'écrire...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Zone de saisie moderne */}
        <div className="p-2 sm:p-4 border-t bg-white">
          {/* Interface audio complètement revue */}
          {isRecording && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-red-700 font-bold text-lg">🔴 Enregistrement en cours</div>
                    <div className="text-red-600 text-sm">Parlez clairement dans votre microphone</div>
                  </div>
                </div>
                <Button
                  onClick={stopAudioRecording}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg"
                >
                  ⏹️ Arrêter
                </Button>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-red-700 font-bold">🎤 REC</span>
                  <div className="flex-1 bg-red-200 rounded-full h-3 overflow-hidden">
                    <div className="w-full h-full bg-red-500 animate-pulse"></div>
                  </div>
                  <span className="text-red-700 text-sm font-medium">En cours d'enregistrement...</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview audio après enregistrement */}
          {recordedAudioUrl && !isRecording && (
            <div className="mb-4 bg-green-50 border-2 border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Mic className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-green-700 font-bold text-lg">✅ Audio prêt à envoyer</div>
                  <div className="text-green-600 text-sm">Écoutez votre message puis envoyez-le</div>
                </div>
              </div>

              <div className="bg-green-100 rounded-lg p-3 mb-3">
                <audio controls className="w-full">
                  <source src={recordedAudioUrl} type="audio/webm" />
                  <source src={recordedAudioUrl} type="audio/wav" />
                  Votre navigateur ne supporte pas l'audio.
                </audio>
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={sendAudioMessage}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg"
                >
                  📤 Envoyer l'audio
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelAudioRecording}
                  className="px-6 py-3 rounded-xl font-medium text-sm border-2"
                >
                  🗑️ Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Sélecteur d'émojis */}
          {showEmojiPicker && (
            <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="grid grid-cols-8 gap-2">
                {popularEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-2xl hover:bg-yellow-100 rounded-lg p-2 transition-colors transform hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Boutons d'attachement */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl p-2"
                title="Joindre une image"
              >
                <Image className="w-5 h-5" />
              </Button>

              {/* Bouton audio simplifié */}
              <Button
                variant="ghost"
                size="sm"
                onClick={startAudioRecording}
                disabled={isRecording || recordedAudioUrl !== null}
                className={`rounded-xl p-2 transition-all duration-300 ${isRecording || recordedAudioUrl
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                  }`}
                title="Enregistrer un message vocal"
              >
                <Mic className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl p-2"
                title="Joindre un fichier"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
            </div>

            {/* ✅ NOUVEAU: Bandeau de citation */}
            {replyingTo && (
              <div className="mb-2 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-600">
                      ↩️ Réponse à {replyingTo.sender_name || 'Message'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 italic line-clamp-2">
                    {replyingTo.content_type === 'text' && replyingTo.content}
                    {replyingTo.content_type === 'audio' && '🎤 Message audio'}
                    {replyingTo.content_type === 'image' && '🖼️ Image'}
                    {replyingTo.content_type === 'file' && '📄 Fichier'}
                    {replyingTo.content_type === 'video' && '🎥 Vidéo'}
                  </p>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Zone de saisie */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  handleTyping(target.value, target.selectionStart);
                }}
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  setCursorPosition(target.selectionStart);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isRecording ? "🎤 Enregistrement en cours..." : replyingTo ? "Tapez votre réponse..." : "Tapez votre message... (@ pour mentionner)"}
                className={`w-full p-2 sm:p-3 pr-10 sm:pr-12 border-2 rounded-xl focus:ring-2 resize-none max-h-24 text-xs sm:text-sm transition-all font-medium ${isRecording
                  ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                rows={1}
                style={{ minHeight: '48px' }}
                disabled={isRecording}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-2 bottom-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg p-1"
                title="Émojis"
                disabled={isRecording}
              >
                <Smile className="w-5 h-5" />
              </Button>
            </div>

            {/* Bouton d'envoi */}
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isRecording}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg font-bold"
            >
              📤
            </Button>
          </div>

          {/* Indicateur de statut */}
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {wsConnected ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Connexion sécurisée</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Mode hors ligne</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {getPhoneNumber() && (
                <span className="text-green-600 font-medium">📞 {getPhoneNumber()}</span>
              )}
              <span className="font-medium">Entrée pour envoyer • Shift+Entrée pour nouvelle ligne</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal galerie */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold">🖼️ Galerie - {titreService}</h3>
              <Button
                variant="ghost"
                onClick={() => setShowGallery(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="text-center text-gray-500">
                Galerie du service - À implémenter avec ServiceMediaGallery
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NOUVEAU: Modal @mention */}
      <UserMentionPicker
        visible={showMentionPicker}
        onClose={() => setShowMentionPicker(false)}
        onSelectUser={insertMention}
        currentQuery={mentionQuery}
      />

      {/* ✅ NOUVEAU: Modal liste des participants */}
      {showParticipantsList && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowParticipantsList(false)}
          />

          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users size={20} />
                Participants ({participants.length})
              </h2>
              <button
                onClick={() => setShowParticipantsList(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {participants.map((participant) => (
                <div
                  key={participant.user_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2 border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {participant.user_avatar ? (
                        <img
                          src={participant.user_avatar}
                          alt={participant.user_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                          <span className="text-white text-lg font-semibold">
                            {participant.user_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {participant.role === 'owner' && (
                        <div className="absolute bottom-0 right-0 w-5 h-5 bg-white rounded-full flex items-center justify-center border-2 border-white">
                          <Star size={12} className="text-yellow-500 fill-current" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{participant.user_name}</p>
                      <p className="text-sm text-gray-500">
                        {participant.role === 'owner' ? '👑 Propriétaire' :
                          participant.invited_by ? '👤 Invité' : '👥 Participant'}
                      </p>
                    </div>
                  </div>

                  {participant.can_remove && participant.user_id !== user?.id && (
                    <button
                      onClick={() => removeParticipant(participant.user_id)}
                      className="p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      title="Retirer ce participant"
                    >
                      <UserMinus size={18} className="text-red-600" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowParticipantsList(false);
                  setShowMentionPicker(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
              >
                <UserPlus size={20} />
                Inviter quelqu'un
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModal; 
