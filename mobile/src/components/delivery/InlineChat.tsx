import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface InlineChatProps {
  deliveryId: string;
  currentUserId: string;
  messages: Array<{
    id: string;
    userId: string;
    message: string;
    timestamp: string;
  }>;
  onSendMessage: (message: string) => Promise<void>;
  style?: any;
}

const InlineChat: React.FC<InlineChatProps> = ({
  deliveryId,
  currentUserId,
  messages = [],
  onSendMessage,
  style,
}) => {
      const { t } = useLanguageSafe();
const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(messageText.trim());
      setMessageText('');
    } catch (error) {
      console.error('[InlineChat] Erreur envoi message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <SafeIcon name="message-circle" size={20} color={modernColors.primary} type="lucide" />
        <Text style={styles.headerText}>Chat de livraison</Text>
      </View>

      <View style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('inlineChat.aucunMessagePourLeMoment')}</Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === currentUserId;
            return (
              <View
                key={msg.id}
                style={[styles.messageBubble, isOwn ? styles.ownMessage : styles.otherMessage]}
              >
                <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
                  {msg.message}
                </Text>
                <Text style={[styles.timestamp, isOwn ? styles.ownTimestamp : styles.otherTimestamp]}>
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('inlineChat.tapezVotreMessage')}
          placeholderTextColor={modernColors.textSecondary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending || !messageText.trim()}
        >
          <SafeIcon
            name="send"
            size={20}
            color={sending || !messageText.trim() ? modernColors.textSecondary : '#FFF'}
            type="lucide"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: modernColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: modernColors.border,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
    marginLeft: 8,
  },
  messagesContainer: {
    minHeight: 100,
    maxHeight: 200,
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    fontStyle: 'italic',
  },
  messageBubble: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: modernColors.primary,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: modernColors.border,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFF',
  },
  otherMessageText: {
    color: modernColors.text,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: modernColors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: modernColors.background,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: modernColors.text,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: modernColors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: modernColors.border,
    opacity: 0.5,
  },
});

export default InlineChat;
