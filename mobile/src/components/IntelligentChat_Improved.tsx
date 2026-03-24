import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { ChatMessage, ChatResponse, intelligentChatService, VisualElement } from '../services/intelligentChatService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface IntelligentChatProps {
  visible: boolean;
  onClose: () => void;
  initialMessage?: string;
  screenContext?: any;
}

const IntelligentChatImproved: React.FC<IntelligentChatProps> = ({
  visible,
  onClose,
  initialMessage,
  screenContext,
}) => {
  const { t } = useLanguageSafe();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // ✅ AMÉLIORATION UX: Message d'accueil amélioré
  const welcomeMessage: ChatMessage = useMemo(() => ({
    id: 'welcome',
    text: t('ai.welcomeMessage') || 'Bonjour ! Je suis votre assistant IA Yukpo. Comment puis-je vous aider aujourd\'hui ?',
    isUser: false,
    timestamp: new Date(),
    type: 'text',
  }), [t]);

  // ✅ AMÉLIORATION UX: Rendu des messages avec design moderne
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.isUser;
    const messageTime = item.timestamp instanceof Date 
      ? item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.aiMessage]}>
        {/* Avatar IA seulement pour les messages de l'assistant */}
        {!isUser && (
          <View style={styles.avatarContainer}>
            <SafeIcon name="bot" size={16} color="#6366f1" />
          </View>
        )}
        
        <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
          {/* Bulle de message avec design amélioré */}
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
            {/* Contenu du message */}
            <View style={styles.messageContent}>
              <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
                {item.text}
              </Text>
            </View>
            
            {/* Attachements (images, fichiers, audio) */}
            {isUser && item.userAttachments && item.userAttachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {item.userAttachments.map((att, idx) => {
                  if (att.kind === 'image' && att.data_base64) {
                    const uri = `data:${att.mime || 'image/jpeg'};base64,${att.data_base64}`;
                    return (
                      <Image
                        key={`${item.id}-ua-${idx}`}
                        source={{ uri }}
                        style={styles.attachmentImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (att.kind === 'audio') {
                    return (
                      <View key={`${item.id}-ua-${idx}`} style={styles.attachmentBadge}>
                        <SafeIcon name="mic" size={14} color="#6366f1" />
                        <Text style={styles.attachmentBadgeText} numberOfLines={1}>
                          {att.name || 'Audio'}
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View key={`${item.id}-ua-${idx}`} style={styles.attachmentBadge}>
                      <SafeIcon name="paperclip" size={14} color="#6366f1" />
                      <Text style={styles.attachmentBadgeText} numberOfLines={1}>
                        {att.name || 'Fichier'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            
            {/* Attachements de l'IA */}
            {!isUser && item.attachments && item.attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {item.attachments.map((att) => (
                  <TouchableOpacity
                    key={att.id}
                    style={styles.attachmentChip}
                    onPress={() => console.log('Download attachment:', att.url)}
                  >
                    <SafeIcon name="paperclip" size={14} color="#6366f1" />
                    <Text style={styles.attachmentChipText} numberOfLines={1}>
                      {att.filename}
                    </Text>
                    <SafeIcon name="external-link" size={12} color={modernColors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {/* Informations de facturation */}
            {!isUser && item.metadata?.billing?.enabled && item.metadata?.billing?.tokens_charged > 0 && (
              <View style={styles.billingInfoContainer}>
                <Text style={styles.billingText}>
                  {item.metadata.billing.from_free_quota
                    ? `Gratuit: ${item.metadata.billing.tokens_charged} jetons utilisés (${item.metadata.billing.daily_free_remaining ?? '?'} restants)`
                    : `Payant: ${item.metadata.billing.tokens_charged} jetons utilisés`
                  }
                </Text>
              </View>
            )}
            
            {/* Actions suggérées */}
            {item.suggestedActions && item.suggestedActions.length > 0 && (
              <View style={styles.actionsContainer}>
                {item.suggestedActions.slice(0, 4).map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.actionButton}
                    onPress={() => console.log('Action pressed:', action.label)}
                  >
                    {action.icon && (
                      <SafeIcon name={action.icon} size={14} color="#6366f1" />
                    )}
                    <Text style={styles.actionButtonText}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Timestamp avec style amélioré */}
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  }, []);

  // ✅ AMÉLIORATION UX: Styles modernes et lisibles
  const styles = StyleSheet.create({
    messageContainer: {
      flexDirection: 'row',
      marginBottom: 16,
      gap: 10,
    },
    userMessage: {
      justifyContent: 'flex-end',
    },
    aiMessage: {
      justifyContent: 'flex-start',
    },
    avatarContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#eef2ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    messageBubble: {
      maxWidth: '85%',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    userBubble: {
      backgroundColor: '#6366f1',
      borderBottomRightRadius: 6,
    },
    aiBubble: {
      backgroundColor: modernColors.card,
      borderBottomLeftRadius: 6,
      borderWidth: 1,
      borderColor: modernColors.border,
    },
    messageContent: {
      marginBottom: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
    },
    userText: {
      color: '#FFFFFF',
    },
    aiText: {
      color: modernColors.text,
    },
    timestamp: {
      fontSize: 11,
      marginTop: 4,
      marginHorizontal: 8,
      fontWeight: '500',
    },
    userTimestamp: {
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'right',
    },
    aiTimestamp: {
      color: modernColors.textSecondary,
      textAlign: 'left',
    },
    attachmentsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    attachmentImage: {
      width: 80,
      height: 80,
      borderRadius: 12,
      backgroundColor: '#f3f4f6',
    },
    attachmentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: 180,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    attachmentBadgeText: {
      fontSize: 13,
      color: '#6366f1',
      marginLeft: 6,
      fontWeight: '500',
    },
    attachmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: 'rgba(99, 102, 241, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.1)',
      gap: 6,
    },
    attachmentChipText: {
      fontSize: 12,
      color: '#6366f1',
      fontWeight: '500',
    },
    billingInfoContainer: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: 'rgba(99, 102, 241, 0.05)',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.1)',
    },
    billingText: {
      fontSize: 12,
      color: '#6366f1',
      fontWeight: '500',
    },
    actionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.2)',
      gap: 6,
    },
    actionButtonText: {
      fontSize: 13,
      color: '#6366f1',
      fontWeight: '500',
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <SafeIcon name="x" size={20} color={modernColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assistant IA</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Écrivez votre message..."
            style={styles.textInput}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={() => console.log('Send message')}
            disabled={!inputText.trim() || loading}
            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <SafeIcon name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: modernColors.border,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: modernColors.text,
  },
  headerSpacer: {
    width: 36,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: '#F8F9FA',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
});

export default IntelligentChatImproved;
