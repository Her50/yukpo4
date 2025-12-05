// 📁 frontend/src/pages/ChatDialog.tsx
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/useUser';
import {
  Check,
  CheckCheck,
  File,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Send,
  Smile,
  Video,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getWebSocketUrl } from '../config/websocket';

interface Message {
  id: string;
  from: 'client' | 'prestataire';
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'file' | 'audio';
  fileUrl?: string;
  fileName?: string;
}

interface UserInfo {
  id: number;
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
}

const ChatDialog: React.FC = () => {
  const { prestataireId, etablissementId } = useParams<{ prestataireId?: string; etablissementId?: string }>();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // Récupérer les données du service depuis l'état de navigation
  const serviceData = location.state as any;
  const serviceId = serviceData?.serviceId;
  const serviceTitle = serviceData?.serviceTitle || serviceData?.etablissementName || 'Service';
  const chatType = serviceData?.type || (etablissementId ? 'etablissement' : 'prestataire');

  // L'utilisateur connecté est le client, le prestataireId/etablissementId est le destinataire
  const client_id = user?.id?.toString() || 'unknown';
  const prestataire_id = prestataireId || etablissementId || 'unknown';

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [prestataireInfo, setPrestataireInfo] = useState<UserInfo | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto-scroll vers le bas
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Charger les informations du prestataire ou établissement
  useEffect(() => {
    const loadContactInfo = async () => {
      try {
        if (chatType === 'etablissement' && etablissementId) {
          // Charger les infos de l'établissement
          const response = await fetch(`/api/orientation-scolaire/etablissements/${etablissementId}`);
          const data = await response.json();

          if (data.success && data.data) {
            setPrestataireInfo({
              id: parseInt(etablissementId),
              name: data.data.nom_etablissement || `Établissement ${etablissementId}`,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.data.nom_etablissement || 'Etablissement')}&background=10B981`,
              isOnline: true, // Les établissements sont toujours disponibles
              lastSeen: new Date()
            });
            setIsOnline(true);
          }
        } else {
          // Simuler les données du prestataire (à remplacer par un vrai appel API)
          setPrestataireInfo({
            id: parseInt(prestataire_id),
            name: `Prestataire ${prestataire_id}`,
            avatar: `https://ui-avatars.com/api/?name=Prestataire&background=random`,
            isOnline: Math.random() > 0.5, // Simuler le statut en ligne
            lastSeen: new Date()
          });
          setIsOnline(Math.random() > 0.5);
        }
      } catch (error) {
        console.error('Erreur chargement contact:', error);
      }
    };

    if (prestataire_id) {
      loadContactInfo();
    }
  }, [prestataire_id, etablissementId, chatType]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = getWebSocketUrl('chat', client_id);
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connecté');
      // Message de bienvenue automatique
      const welcomeMessage = chatType === 'etablissement'
        ? `Bonjour 👋, bienvenue à ${serviceTitle}. Comment pouvons-nous vous aider dans votre orientation scolaire ?`
        : 'Bonjour 👋, je suis votre prestataire Yukpo. Que puis-je faire pour vous ?';

      const welcome: Message = {
        id: Date.now().toString(),
        from: 'prestataire',
        content: welcomeMessage,
        timestamp: new Date(),
        status: 'read',
        type: 'text'
      };
      setMessages([welcome]);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newMsg: Message = {
        id: Date.now().toString(),
        from: data.from,
        content: data.content,
        timestamp: new Date(),
        status: 'delivered',
        type: data.type || 'text',
        fileUrl: data.fileUrl,
        fileName: data.fileName
      };

      setMessages(prev => [...prev, newMsg]);
      setUnreadCount(prev => prev + 1);

      // Notification toast
      if (data.from === 'prestataire') {
        const contactName = chatType === 'etablissement'
          ? prestataireInfo?.name || 'Établissement'
          : prestataireInfo?.name || 'Prestataire';
        toast.success(`Nouveau message de ${contactName}`);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket déconnecté');
    };

    return () => {
      ws.close();
    };
  }, [client_id, prestataireInfo?.name, chatType]);

  const sendMessage = useCallback(() => {
    if (wsRef.current && newMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        from: 'client',
        content: newMessage,
        timestamp: new Date(),
        status: 'sent',
        type: 'text'
      };

      wsRef.current.send(JSON.stringify({
        content: newMessage,
        type: 'text'
      }));

      setMessages(prev => [...prev, message]);
      setNewMessage('');
      setUnreadCount(0);
    }
  }, [newMessage]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simuler l'upload (à remplacer par un vrai upload)
    const fileMessage: Message = {
      id: Date.now().toString(),
      from: 'client',
      content: `Fichier: ${file.name}`,
      timestamp: new Date(),
      status: 'sent',
      type: file.type.startsWith('image/') ? 'image' : 'file',
      fileUrl: URL.createObjectURL(file),
      fileName: file.name
    };

    setMessages(prev => [...prev, fileMessage]);
    toast.success(`Fichier "${file.name}" envoyé`);
  };

  const handleAudioRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      toast.success('Enregistrement audio démarré');
      // Ici on ajouterait la logique d'enregistrement audio
    } else {
      setIsRecording(false);
      toast.success('Enregistrement audio terminé');
      // Ici on enverrait l'audio
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const renderMessage = (msg: Message) => {
    const isOwn = msg.from === 'client';

    return (
      <div
        key={msg.id}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
          {!isOwn && (
            <div className="flex items-center mb-1">
              <img
                src={prestataireInfo?.avatar}
                alt={prestataireInfo?.name}
                className="w-6 h-6 rounded-full mr-2"
              />
              <span className="text-xs text-gray-500">{prestataireInfo?.name}</span>
            </div>
          )}

          <div className={`rounded-lg px-3 py-2 ${isOwn
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-800'
            }`}>
            {msg.type === 'image' && msg.fileUrl && (
              <img
                src={msg.fileUrl}
                alt="Image"
                className="max-w-full rounded mb-1"
              />
            )}

            {msg.type === 'file' && (
              <div className="flex items-center mb-1">
                <File className="h-4 w-4 mr-1" />
                <span className="text-sm">{msg.fileName}</span>
              </div>
            )}

            <p className="text-sm">{msg.content}</p>

            <div className={`flex items-center justify-between mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'
              }`}>
              <span className="text-xs">{formatTime(msg.timestamp)}</span>
              {isOwn && getStatusIcon(msg.status)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-screen max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-3 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center">
              <img
                src={prestataireInfo?.avatar}
                alt={prestataireInfo?.name}
                className="w-10 h-10 rounded-full mr-3"
              />
              <div>
                <h2 className="font-semibold">{prestataireInfo?.name || 'Prestataire'}</h2>
                <div className="flex items-center text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full mr-1 ${isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="space-y-2">
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>

          {isTyping && (
            <div className="flex justify-start mb-3">
              <div className="bg-gray-200 rounded-lg px-3 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-white border-t p-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-4 w-4" />
            </Button>

            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tapez votre message..."
                className="pr-12"
              />

              <Button
                onClick={handleAudioRecord}
                variant="outline"
                size="sm"
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${isRecording ? 'text-red-500' : ''
                  }`}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Emoji picker (simplifié) */}
          {showEmojiPicker && (
            <div className="mt-2 p-2 bg-gray-100 rounded">
              <p className="text-sm text-gray-600">Emoji picker à implémenter</p>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
        />
      </div>
    </AppLayout>
  );
};

export default ChatDialog;
