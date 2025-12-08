// Remplacement des Ionicons par des emojis pour éviter les crashes
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar, IconButton, Title } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { theme } from '../theme/theme';
import ChatModalMobile from './ChatModalMobile';

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
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedPrestataire, setSelectedPrestataire] = useState<any>(null);
  const [showChatMessages, setShowChatMessages] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const loadChatHistories = useCallback(async () => {
    setLoading(true);
    try {
      // Charger les vraies conversations depuis l'API
      if (!user?.id) {
        console.log('[ChatHistoryModal] Aucun utilisateur connecté');
        setChatHistories([]);
        return;
      }

      // ✅ CORRIGÉ: Utilise apiGet au lieu de fetch hardcodé
      const response = await apiGet('/api/chat/conversations');

      if (response.success && response.data) {
        const conversations = Array.isArray(response.data) ? response.data : [];
        console.log('[ChatHistoryModal] Conversations chargées:', conversations);
        setChatHistories(conversations);
      } else {
        console.warn('[ChatHistoryModal] Endpoint conversations non disponible, affichage liste vide');
        setChatHistories([]);
      }
    } catch (error) {
      console.error('[ChatHistoryModal] Erreur chargement historique chat:', error);
      setChatHistories([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadChatMessages = useCallback(async (chatId: string) => {
    try {
      // Charger les vrais messages depuis l'API
      if (!user?.id || !selectedChat) {
        setChatMessages([]);
        return;
      }

      // ✅ CORRIGÉ: Utilise l'API pour charger l'historique des messages
      const response = await apiGet(`/api/chat/messages/${chatId}`);

      if (response.success && response.data && Array.isArray(response.data)) {
        // Mapper les messages de l'API au format attendu
        const mappedMessages: ChatMessage[] = response.data.map((msg: any) => ({
          id: msg.id || String(Date.now()),
          clientId: msg.client_id || selectedChat.clientId,
          prestataireId: msg.prestataire_id || selectedChat.prestataireId,
          message: msg.content || msg.message,
          timestamp: new Date(msg.created_at || msg.timestamp),
          isFromClient: msg.from === 'client' || msg.is_from_client,
          messageType: msg.type || 'text',
          metadata: msg.metadata
        }));
        setChatMessages(mappedMessages);
      } else {
        // Si l'API n'est pas encore prête, afficher message vide
        setChatMessages([]);
      }

      console.log('[ChatHistoryModal] Messages chargés pour chat:', chatId);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      setChatMessages([]);
    }
  }, [user?.id, selectedChat]);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadChatHistories();
    }
  }, [isOpen, user?.id, loadChatHistories]);

  useEffect(() => {
    if (selectedChat) {
      loadChatMessages(selectedChat.id);
    }
  }, [selectedChat, loadChatMessages]);

  const loadChatMessagesOLD = async (chatId: string) => {
    try {
      // ANCIEN CODE AVEC DONNÉES FICTIVES - DÉSACTIVÉ
      const mockMessages_OLD: ChatMessage[] = [
        {
          id: '1',
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

  const handleOpenChatModal = (chat: ChatHistory) => {
    // Créer un objet service simulé pour le ChatModal
    const serviceData = {
      id: chat.id,
      titre: chat.serviceTitle || 'Service',
      description: `Conversation avec ${chat.clientName}`,
      user_id: chat.prestataireId,
      data: {
        titre_service: chat.serviceTitle || 'Service',
        description: `Conversation avec ${chat.clientName}`,
        nom_prestataire: chat.prestataireName
      }
    };

    // Créer un objet prestataire simulé
    const prestataireData = {
      id: chat.prestataireId,
      name: chat.prestataireName,
      email: '',
      avatar: chat.prestatairePhoto,
      isOnline: true
    };

    setSelectedService(serviceData);
    setSelectedPrestataire(prestataireData);
    setShowChatModal(true);
    setShowChatMessages(false); // Fermer l'interface intégrée
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
              <Text style={styles.backIcon}>←</Text>
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
                    { text: 'Voir le profil', onPress: () => { } },
                    { text: 'Marquer comme terminé', onPress: () => { } },
                    { text: 'Annuler', style: 'cancel' }
                  ]
                );
              }}
            >
              <Text style={styles.menuIcon}>⋮</Text>
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
              <Text style={styles.sendIcon}>📤</Text>
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
            <Text style={styles.searchIcon}>🔍</Text>
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
              <Text style={styles.emptyIcon}>💬</Text>
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
                  handleOpenChatModal(chat);
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

      {/* ChatModalMobile avec WebSocket intégré */}
      <ChatModalMobile
        visible={showChatModal}
        service={selectedService}
        prestataireInfo={selectedPrestataire}
        user={user}
        onClose={() => {
          setShowChatModal(false);
          setSelectedService(null);
          setSelectedPrestataire(null);
        }}
      />
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
    fontSize: 20,
    marginRight: 8,
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.text,
  },
  menuIcon: {
    fontSize: 24,
    color: theme.colors.text,
  },
  sendIcon: {
    fontSize: 20,
  },
  emptyIcon: {
    fontSize: 48,
    textAlign: 'center',
    opacity: 0.5,
    marginBottom: 16,
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






