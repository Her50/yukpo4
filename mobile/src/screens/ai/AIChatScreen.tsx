// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, Card, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { aiService } from '../../services/api';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const AIChatScreen: React.FC = () => {
  const { t } = useLanguageSafe();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Set welcome message with translation
    setMessages([{
      id: '1',
      text: t('ai.welcomeMessage'),
      isUser: false,
      timestamp: new Date(),
    }]);
  }, [t]);

  useEffect(() => {
    navigation.setOptions({
      title: t('ai.chatTitle'),
    });
  }, [navigation, t]);

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await aiService.chat(inputText);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: (response.data as any)?.message || t('ai.errorProcessing'),
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: t('ai.errorGeneric'),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <Avatar.Text
        size={32}
        label={item.isUser ? 'U' : 'AI'}
        style={[
          styles.avatar,
          item.isUser ? styles.userAvatar : styles.aiAvatar
        ]}
      />
      <Card style={[
        styles.messageCard,
        item.isUser ? styles.userMessageCard : styles.aiMessageCard
      ]}>
        <Card.Content style={styles.messageContent}>
          <Text style={[
            styles.messageText,
            item.isUser ? styles.userMessageText : styles.aiMessageText
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.timestamp,
            item.isUser ? styles.userTimestamp : styles.aiTimestamp
          ]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );

  return (
    <KeyboardAwareScreen style={styles.container}>
      <View style={styles.contentWrapper}>
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
            placeholder={t('ai.inputPlaceholder')}
            mode="outlined"
            multiline
            style={styles.textInput}
            disabled={loading}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
            style={styles.sendButton}
          >
            <Text style={{ color: "#000" }}>{t('ai.send')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentWrapper: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    marginHorizontal: 8,
  },
  userAvatar: {
    backgroundColor: '#FFD700',
  },
  aiAvatar: {
    backgroundColor: '#4ECDC4',
  },
  messageCard: {
    maxWidth: '80%',
    elevation: 2,
  },
  userMessageCard: {
    backgroundColor: '#FFD700',
  },
  aiMessageCard: {
    backgroundColor: '#fff',
  },
  messageContent: {
    padding: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#000',
  },
  aiMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  userTimestamp: {
    color: '#666',
  },
  aiTimestamp: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    marginRight: 12,
    maxHeight: 100,
  },
  sendButton: {
    minWidth: 80,
  },
});

export default AIChatScreen;




























