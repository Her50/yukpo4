import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Card, Title, Paragraph, Button, IconButton, Avatar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../services/api';
import { theme } from '../theme/theme';

interface ChatMessage {
  id: string;
  clientId: string;
  prestataireId: string;
  message: string;
  timestamp: Date;
  isFromClient: boolean;
  messageType: 'text' | 'image' | 'audio' | 'file';
  metadata?: any;
}

interface ChatHistory {
  id: string;
  clientId: string;
  prestataireId: string;
  clientName: string;
  prestataireName: string;
  clientPhoto?: string;
  prestatairePhoto?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isActive: boolean;
  serviceTitle?: string;
  status: 'active' | 'completed' | 'cancelled';
}

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (chatId: string) => void;
}

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  isOpen,
  onClose,
  onOpenChat
}) => {
  const { user } = useAuth();
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedChat, setSelectedChat] = useState<ChatHistory | null>(null);
  const [showChatMessages, setShowChatMessages] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadChatHistories();
    }
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (selectedChat) {
      loadChatMessages(selectedChat.id);
    }
  }, [selectedChat]);

  const loadChatHistories = async () => {
    setLoading(true);
    try {
      // Simuler la récupération des historiques de chat
      // En production, vous feriez un appel API ici
      // const response = await notificationsApi.getChatHistory();
      
      // Données simulées pour l'instant
      const mockHistories: ChatHistory[] = [
        {
          id: '1',
          clientId: 'client1',
          prestataireId: user?.id || 'prestataire1',
          clientName: 'Marie Dupont',
          prestataireName: user?.name || 'Prestataire',
          clientPhoto: 'https://via.placeholder.com/50',
          lastMessage: 'Merci pour votre aide !',
          lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
          unreadCount: 0,
          isActive: true,
          serviceTitle: 'Réparation plomberie',
          status: 'completed'
        },
        {
          id: '2',
          clientId: 'client2',
          prestataireId: user?.id || 'prestataire1',
          clientName: 'Jean Martin',
          prestataireName: user?.name || 'Prestataire',
          lastMessage: 'Quand pourriez-vous venir ?',
          lastMessageTime: new Date(Date.now() - 30 * 60 * 1000), // 30min ago
          unreadCount: 2,
          isActive: true,
          serviceTitle: 'Installation électrique',
          status: 'active'
        },
        {
          id: '3',
          clientId: 'client3',
          prestataireId: user?.id || 'prestataire1',
          clientName: 'Sophie Leroy',
          prestataireName: user?.name || 'Prestataire',
          lastMessage: 'Parfait, à demain !',
          lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1j ago
          unreadCount: 0,
          isActive: false,
          serviceTitle: 'Peinture intérieure',
          status: 'completed'
        }
      ];

      setChatHistories(mockHistories);
    } catch (error) {
      console.error('Erreur chargement historique chat:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique des conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      // Simuler la récupération des messages d'un chat
      // En production, vous feriez un appel API ici
      // const response = await notificationsApi.getChatMessages(chatId);
      
      // Données simulées
      const mockMessages: ChatMessage[] = [
        {
          id: '1',
          clientId: 'client2',
          prestataireId: user?.id || 'prestataire1',
          message: 'Bonjour, j\'ai besoin d\'aide pour une installation électrique',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          isFromClient: true,
          messageType: 'text'
        },
        {
          id: '2',
          clientId: 'client2',
          prestataireId: user?.id || 'prestataire1',
          message: 'Bonjour ! Je peux vous aider. Pouvez-vous me décrire le problème ?',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
          isFromClient: false,
          messageType: 'text'
        },
        {
          id: '3',
          clientId: 'client2',
          prestataireId: user?.id || 'prestataire1',
          message: 'J\'ai des prises qui ne fonctionnent plus dans ma cuisine',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000),
          isFromClient: true,
          messageType: 'text'
        },
        {
          id: '4',
          clientId: 'client2',
          prestataireId: user?.id || 'prestataire1',
          message: 'Quand pourriez-vous venir ?',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          isFromClient: true,
          messageType: 'text'
        }
      ];

      setChatMessages(mockMessages);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || sendingMessage) return;

    setSendingMessage(true);
    try {
      // Simuler l'envoi du message
      // En production, vous feriez un appel API ici
      // await notificationsApi.sendMessage(selectedChat.id, newMessage);
      
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        clientId: selectedChat.clientId,
        prestataireId: selectedChat.prestataireId,
        message: newMessage,
        timestamp: new Date(),
        isFromClient: false,
        messageType: 'text'
      };

      setChatMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setSendingMessage(false);
    }
  };

  const filteredChatHistories = chatHistories
    .filter(chat => {
      const matchesSearch = chat.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           chat.serviceTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || chat.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return `${days}j`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'completed': return '#2196F3';
      case 'cancelled': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'En cours';
      case 'completed': return 'Terminé';
      case 'cancelled': return 'Annulé';
      default: return 'Inconnu';
    }
  };

  const unreadTotalCount = chatHistories.reduce((total, chat) => total + chat.unreadCount, 0);

  if (showChatMessages && selectedChat) {
    return (
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowChatMessages(false);
          setSelectedChat(null);
          onClose();
        }}
      >
        <KeyboardAvoidingView 
          style={styles.chatContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowChatMessages(false)}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.chatHeaderInfo}>
              <Avatar.Text 
                size={40} 
                label={selectedChat.clientName.charAt(0)} 
                style={styles.chatAvatar}
              />
              <View style={styles.chatHeaderText}>
                <Text style={styles.chatClientName}>{selectedChat.clientName}</Text>
                <Text style={styles.chatServiceTitle}>{selectedChat.serviceTitle}</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.chatMenuButton}
              onPress={() => {
                Alert.alert(
                  'Options du chat',
                  'Que souhaitez-vous faire ?',
                  [
                    { text: 'Voir le profil', onPress: () => {} },
                    { text: 'Marquer comme terminé', onPress: () => {} },
                    { text: 'Annuler', style: 'cancel' }
                  ]
                );
              }}
            >
              <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {chatMessages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.isFromClient ? styles.clientMessage : styles.prestataireMessage
                ]}
              >
                <View style={[
                  styles.messageBubble,
                  message.isFromClient ? styles.clientBubble : styles.prestataireBubble
                ]}>
                  <Text style={[
                    styles.messageText,
                    message.isFromClient ? styles.clientText : styles.prestataireText
                  ]}>
                    {message.message}
                  </Text>
                  <Text style={[
                    styles.messageTime,
                    message.isFromClient ? styles.clientTime : styles.prestataireTime
                  ]}>
                    {formatTime(message.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Message Input */}
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Tapez votre message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newMessage.trim() || sendingMessage) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sendingMessage}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={(!newMessage.trim() || sendingMessage) ? '#9E9E9E' : 'white'} 
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Title style={styles.headerTitle}>
              💬 Historique des conversations
            </Title>
            {unreadTotalCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadTotalCount}</Text>
              </View>
            )}
          </View>
          
          <IconButton
            icon="close"
            size={24}
            onPress={onClose}
            iconColor={theme.colors.text}
          />
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.colors.primary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une conversation..."
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
              onPress={() => setFilterStatus('all')}
            >
              <Text style={[styles.filterChipText, filterStatus === 'all' && styles.filterChipTextActive]}>
                Toutes
              </Text>
            </TouchableOpacity>
            
            {['active', 'completed', 'cancelled'].map(status => (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, filterStatus === status && styles.filterChipActive]}
                onPress={() => setFilterStatus(status)}
              >
                <Text style={[styles.filterChipText, filterStatus === status && styles.filterChipTextActive]}>
                  {getStatusText(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Liste des conversations */}
        <ScrollView style={styles.chatList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : filteredChatHistories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#9E9E9E" />
              <Text style={styles.emptyText}>Aucune conversation trouvée</Text>
            </View>
          ) : (
            filteredChatHistories.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                style={[
                  styles.chatCard,
                  chat.unreadCount > 0 && styles.unreadChatCard
                ]}
                onPress={() => {
                  setSelectedChat(chat);
                  setShowChatMessages(true);
                }}
              >
                <Avatar.Text 
                  size={50} 
                  label={chat.clientName.charAt(0)} 
                  style={styles.chatAvatar}
                />
                
                <View style={styles.chatInfo}>
                  <View style={styles.chatHeader}>
                    <Text style={[
                      styles.chatClientName,
                      chat.unreadCount > 0 && styles.unreadText
                    ]}>
                      {chat.clientName}
                    </Text>
                    <Text style={styles.chatTime}>
                      {formatTime(chat.lastMessageTime)}
                    </Text>
                  </View>
                  
                  <Text style={styles.chatServiceTitle}>
                    {chat.serviceTitle}
                  </Text>
                  
                  <Text style={[
                    styles.chatLastMessage,
                    chat.unreadCount > 0 && styles.unreadText
                  ]}>
                    {chat.lastMessage}
                  </Text>
                  
                  <View style={styles.chatFooter}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(chat.status) }
                    ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(chat.status)}
                      </Text>
                    </View>
                    
                    {chat.unreadCount > 0 && (
                      <View style={styles.unreadCountBadge}>
                        <Text style={styles.unreadCountText}>{chat.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 12,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.colors.text,
  },
  filterChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  chatList: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  unreadChatCard: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  chatAvatar: {
    backgroundColor: theme.colors.primary,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatClientName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  chatTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  chatServiceTitle: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  chatLastMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  unreadCountBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Chat Messages Styles
  chatContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  chatMenuButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  clientMessage: {
    alignItems: 'flex-start',
  },
  prestataireMessage: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  clientBubble: {
    backgroundColor: '#E0E0E0',
    borderBottomLeftRadius: 4,
  },
  prestataireBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  clientText: {
    color: theme.colors.text,
  },
  prestataireText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  clientTime: {
    color: theme.colors.textSecondary,
  },
  prestataireTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: theme.colors.text,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
});

export default ChatHistoryModal;


