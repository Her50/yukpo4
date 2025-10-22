import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { theme } from '../theme/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Message {
  id: string;
  from: 'client' | 'prestataire';
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'audio' | 'image' | 'video';
  editable?: boolean;
}

interface ChatModalAdvancedProps {
  visible: boolean;
  service: any;
  prestataire?: any;
  user?: any;
  onClose: () => void;
  onSendMessage?: (message: string) => void;
}

const ChatModalAdvanced: React.FC<ChatModalAdvancedProps> = ({
  visible,
  service,
  prestataire,
  user,
  onClose,
  onSendMessage
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const scrollViewRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Émojis populaires
  const popularEmojis = ['😊', '😂', '❤️', '👍', '👎', '😍', '🤔', '😢', '😮', '🔥', '💯', '🎉', '👏', '🙏', '💪'];

  // Fonction utilitaire pour extraire la valeur d'un champ
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
    }
    return 'Non spécifié';
  };

  // Initialiser le WebSocket
  useEffect(() => {
    if (visible && service) {
      initializeWebSocket();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [visible, service]);

  // Initialiser le chat avec un message de bienvenue
  useEffect(() => {
    if (visible && service && prestataire) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        from: 'prestataire',
        content: `Bonjour 👋, je suis ${prestataire.name || `Prestataire #${service.user_id}`} pour le service "${getServiceFieldValue(service.data?.titre_service) || 'Service'}". Que puis-je faire pour vous ?`,
        timestamp: new Date(),
        status: 'read',
        type: 'text',
        editable: false
      };
      setMessages([welcomeMessage]);
    }
  }, [visible, service, prestataire]);

  // Auto-scroll vers le bas
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const initializeWebSocket = () => {
    try {
      // URL WebSocket - à adapter selon votre configuration
      const wsUrl = `${process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws'}/chat`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket Chat connecté');
        setWsConnected(true);

        // Envoyer un message de connexion
        if (wsRef.current && service && user) {
          wsRef.current.send(JSON.stringify({
            type: 'join_chat',
            service_id: service.id,
            user_id: user.id,
            prestataire_id: service.user_id
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Erreur parsing message WebSocket:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('❌ WebSocket Chat déconnecté');
        setWsConnected(false);

        // Tentative de reconnexion après 3 secondes
        setTimeout(() => {
          if (visible) {
            initializeWebSocket();
          }
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('Erreur WebSocket Chat:', error);
        setWsConnected(false);
      };
    } catch (error) {
      console.error('Erreur initialisation WebSocket:', error);
      setWsConnected(false);
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'new_message':
        const newMsg: Message = {
          id: data.message_id || Date.now().toString(),
          from: data.from_user_id === user?.id ? 'client' : 'prestataire',
          content: data.content,
          timestamp: new Date(data.timestamp || Date.now()),
          status: 'delivered',
          type: data.message_type || 'text'
        };
        setMessages(prev => [...prev, newMsg]);
        break;

      case 'typing':
        setIsTyping(data.is_typing);
        break;

      case 'message_status':
        setMessages(prev => prev.map(msg =>
          msg.id === data.message_id
            ? { ...msg, status: data.status }
            : msg
        ));
        break;

      case 'user_online':
        // Mettre à jour le statut en ligne du prestataire
        break;

      default:
        console.log('Message WebSocket non géré:', data);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      from: 'client',
      content: newMessage,
      timestamp: new Date(),
      status: 'sent',
      type: 'text',
      editable: true
    };

    setMessages(prev => [...prev, message]);

    // Envoyer via WebSocket
    if (wsRef.current && wsConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        service_id: service.id,
        to_user_id: service.user_id,
        content: newMessage,
        message_type: 'text'
      }));
    }

    // Callback parent
    onSendMessage?.(newMessage);

    setNewMessage('');
  };

  const sendEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const startRecording = () => {
    setIsRecording(true);
    // TODO: Implémenter l'enregistrement audio avec Expo Audio
    Alert.alert('Enregistrement audio', 'Fonctionnalité à implémenter avec Expo Audio');
  };

  const stopRecording = () => {
    setIsRecording(false);
    // TODO: Envoyer l'audio enregistré
  };

  const renderMessage = (message: Message, index: number) => {
    const isClient = message.from === 'client';
    const isLastMessage = index === messages.length - 1;

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isClient ? styles.clientMessage : styles.prestataireMessage
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isClient ? styles.clientBubble : styles.prestataireBubble
          ]}
        >
          <Text style={[
            styles.messageText,
            isClient ? styles.clientText : styles.prestataireText
          ]}>
            {message.content}
          </Text>

          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isClient ? styles.clientTime : styles.prestataireTime
            ]}>
              {message.timestamp.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>

            {isClient && (
              <Text style={styles.messageStatus}>
                {message.status === 'sent' ? '✓' :
                  message.status === 'delivered' ? '✓✓' :
                    message.status === 'read' ? '✓✓' : ''}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmojiPicker = () => {
    if (!showEmojiPicker) return null;

    return (
      <View style={styles.emojiPicker}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {popularEmojis.map((emoji, index) => (
            <TouchableOpacity
              key={index}
              style={styles.emojiButton}
              onPress={() => sendEmoji(emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {prestataire?.name?.charAt(0) || 'P'}
              </Text>
              <View style={[
                styles.onlineIndicator,
                { backgroundColor: wsConnected ? '#4CAF50' : '#9E9E9E' }
              ]} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.prestataireName}>
                {prestataire?.name || `Prestataire #${service.user_id}`}
              </Text>
              <Text style={styles.serviceTitle} numberOfLines={1}>
                {getServiceFieldValue(service.data?.titre_service) || 'Service'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Text style={styles.headerButtonText}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Text style={styles.headerButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message, index) => renderMessage(message, index))}

          {isTyping && (
            <View style={[styles.messageContainer, styles.prestataireMessage]}>
              <View style={[styles.messageBubble, styles.prestataireBubble]}>
                <Text style={styles.typingText}>Prestataire en train d'écrire...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Emoji Picker */}
        {renderEmojiPicker()}

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Text style={styles.inputButtonText}>😊</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Tapez votre message..."
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={styles.inputButton}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Text style={styles.inputButtonText}>
                {isRecording ? '⏹️' : '🎤'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <Text style={styles.sendButtonText}>📤</Text>
            </TouchableOpacity>
          </View>

          {/* Status WebSocket */}
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {wsConnected ? '🟢 Connecté' : '🔴 Déconnecté'}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarText: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    color: 'white',
    textAlign: 'center',
    lineHeight: 40,
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  headerText: {
    flex: 1,
  },
  prestataireName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  serviceTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerButtonText: {
    fontSize: 16,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },
  clientMessage: {
    alignItems: 'flex-end',
  },
  prestataireMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  clientBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  prestataireBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  clientText: {
    color: 'white',
  },
  prestataireText: {
    color: theme.colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  clientTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  prestataireTime: {
    color: theme.colors.textSecondary,
  },
  messageStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  typingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  emojiPicker: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
  },
  emojiButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  emojiText: {
    fontSize: 24,
  },
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  inputButtonText: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  sendButtonText: {
    fontSize: 18,
    color: 'white',
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});

export default ChatModalAdvanced;



