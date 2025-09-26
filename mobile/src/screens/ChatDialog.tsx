// 📁 frontend/src/pages/ChatDialog.tsx
import AppLayout from '@/components/layout/AppLayout';
import {
  Check,
  CheckCheck,
  File,
  Mic,
  MoreVertical,
  Send,
  Smile,
  Video,
  X
} from 'lucide-react';
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Text, TouchableOpacity, View } from 'react-native';
import { useLocation, useNavigation, useParams } from 'react-router-dom';
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
  const { prestataireId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigation();
  const location = useLocation();

  // Récupérer les données du service depuis l'état de navigation
  const serviceData = location.state as any;
  const serviceId = serviceData?.serviceId;
  const serviceTitle = serviceData?.serviceTitle || 'Service';

  // L'utilisateur connecté est le client, le prestataireId est le destinataire
  const client_id = user?.id?.toString() || 'unknown';
  const prestataire_id = prestataireId || 'unknown';

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

  // Charger les informations du prestataire
  useEffect(() => {
    const loadPrestataireInfo = async () => {
      try {
        // Simuler les données du prestataire (à remplacer par un vrai appel API)
        setPrestataireInfo({
          id: parseInt(prestataire_id),
          name: `Prestataire ${prestataire_id}`,
          avatar: `https://ui-avatars.com/api/?name=Prestataire&background=random`,
          isOnline: Math.random() > 0.5, // Simuler le statut en ligne
          lastSeen: new Date()
        });
        setIsOnline(Math.random() > 0.5);
      } catch (error) {
        console.error('Erreur chargement prestataire:', error);
      }
    };

    if (prestataire_id) {
      loadPrestataireInfo();
    }
  }, [prestataire_id]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = getWebSocketUrl('chat', client_id);
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connecté');
      // Message de bienvenue automatique
      const welcome: Message = {
        id: Date.now().toString(),
        from: 'prestataire',
        content: 'Bonjour 👋, je suis votre prestataire Yukpo. Que puis-je faire pour vous ?',
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
        toast.success(
          `Nouveau message de ${prestataireInfo?.name || 'Prestataire'}`
        );
      }
    };

    ws.onclose = () => {
      console.log('WebSocket déconnecté');
    };

    return () => {
      ws.close();
    };
  }, [client_id, prestataireInfo?.name]);

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
        return <Check style="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck style="h-3 w-3 text-gray-400" />;
      case 'read':
        return <CheckCheck style="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const renderMessage = (msg: Message) => {
    const isOwn = msg.from === 'client';

    return (
      <View
        key={msg.id}
        style={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <View style={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
          {!isOwn && (
            <View style="flex items-center mb-1">
              <img
                src={prestataireInfo?.avatar}
                alt={prestataireInfo?.name}
                style="w-6 h-6 rounded-full mr-2"
              />
              <Text style="text-xs text-gray-500">{prestataireInfo?.name}</Text>
            </View>
          )}

          <View style={`rounded-lg px-3 py-2 ${isOwn
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-800'
            }`}>
            {msg.type === 'image' && msg.fileUrl && (
              <img
                src={msg.fileUrl}
                alt="Image"
                style="max-w-full rounded mb-1"
              />
            )}

            {msg.type === 'file' && (
              <View style="flex items-center mb-1">
                <File style="h-4 w-4 mr-1" />
                <Text style="text-sm">{msg.fileName}</Text>
              </View>
            )}

            <Text style="text-sm">{msg.content}</Text>

            <View style={`flex items-center justify-between mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'
              }`}>
              <Text style="text-xs">{formatTime(msg.timestamp)}</Text>
              {isOwn && getStatusIcon(msg.status)}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <AppLayout>
      <View style="flex flex-col h-screen max-w-4xl mx-auto">
        {/* Header */}
        <View style="bg-white border-b px-4 py-3 flex items-center justify-between">
          <View style="flex items-center">
            <TouchableOpacity
              onPress={() => navigation.navigate(-1)}
              style="mr-3 text-gray-500 hover:text-gray-700"
            >
              <X style="h-5 w-5" />
            </TouchableOpacity>

            <View style="flex items-center">
              <img
                src={prestataireInfo?.avatar}
                alt={prestataireInfo?.name}
                style="w-10 h-10 rounded-full mr-3"
              />
              <View>
                <Text style="font-semibold">{prestataireInfo?.name || 'Prestataire'}</Text>
                <View style="flex items-center text-sm text-gray-500">
                  <View style={`w-2 h-2 rounded-full mr-1 ${isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </View>
              </View>
            </View>
          </View>

          <View style="flex items-center space-x-2">
            <TouchableOpacity variant="outline" size="sm">
              <Texthone style="h-4 w-4" />
            </TouchableOpacity>
            <TouchableOpacity variant="outline" size="sm">
              <Video style="h-4 w-4" />
            </TouchableOpacity>
            <TouchableOpacity variant="outline" size="sm">
              <MoreVertical style="h-4 w-4" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <View style="flex-1 overflow-y-auto p-4 bg-gray-50">
          <View style="space-y-2">
            {messages.map(renderMessage)}
            <View ref={messagesEndRef} />
          </View>

          {isTyping && (
            <View style="flex justify-start mb-3">
              <View style="bg-gray-200 rounded-lg px-3 py-2">
                <View style="flex space-x-1">
                  <View style="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                  <View style="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <View style="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Input */}
        <View style="bg-white border-t p-4">
          <View style="flex items-center space-x-2">
            <TouchableOpacity
              variant="outline"
              size="sm"
              onPress={() => fileInputRef.current?.click()}
            >
              <Textaperclip style="h-4 w-4" />
            </TouchableOpacity>

            <TouchableOpacity
              variant="outline"
              size="sm"
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile style="h-4 w-4" />
            </TouchableOpacity>

            <View style="flex-1 relative">
              <TextInput
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tapez votre message..."
                style="pr-12"
              />

              <TouchableOpacity
                onPress={handleAudioRecord}
                variant="outline"
                size="sm"
                style={`absolute right-2 top-1/2 transform -translate-y-1/2 ${isRecording ? 'text-red-500' : ''
                  }`}
              >
                <Mic style="h-4 w-4" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={sendMessage}
              disabled={!newMessage.trim()}
              style="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Send style="h-4 w-4" />
            </TouchableOpacity>
          </View>

          {/* Emoji picker (simplifié) */}
          {showEmojiPicker && (
            <View style="mt-2 p-2 bg-gray-100 rounded">
              <Text style="text-sm text-gray-600">Emoji picker à implémenter</Text>
            </View>
          )}
        </View>

        {/* Hidden file input */}
        <TextInput
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          accept="image/*,.pdf,.doc,.docx"
          style="hidden"
        />
      </View>
    </AppLayout>
  );
};

export default ChatDialog;





