import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useScreenContext } from '../hooks/useScreenContext';
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

const FRIENDLY_SCREEN_NAMES: Record<string, string> = {
  MainTabs: 'Accueil',
  MainStack: 'Accueil',
  Home: 'Accueil',
  HomeScreen: 'Accueil',
  Profile: 'Compte',
  RechercheBesoin: 'Recherche',
  Navigation: 'Navigation GPS',
  ServicesDashboard: 'Tableau de bord services',
  GestionServicesSpecialises: 'Mes services',
  OffresEmploiHome: 'Offres d’emploi',
  HotelMeubleHome: 'Hôtels & meublés',
  TaxiHome: 'Taxi',
  DeliveryHome: 'Livraison',
  LivreScolaireHome: 'Bourse du livre',
  WalletFinancial: 'Portefeuille',
};

const humanizeScreenName = (rawName?: string): string => {
  if (!rawName) return 'Yukpo';
  if (FRIENDLY_SCREEN_NAMES[rawName]) return FRIENDLY_SCREEN_NAMES[rawName];

  // Convert technical route names into readable labels.
  const cleaned = rawName
    .replace(/Screen$/i, '')
    .replace(/Navigator$/i, '')
    .replace(/Stack$/i, '')
    .replace(/Tabs$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return cleaned || 'Yukpo';
};

const dedupeActions = (actions: any[]): any[] => {
  const seen = new Set<string>();
  const deduped: any[] = [];

  for (const action of actions || []) {
    if (!action) continue;
    const key = [
      String(action.id || '').toLowerCase().trim(),
      String(action.route || '').toLowerCase().trim(),
      String(action.label || '').toLowerCase().trim(),
      String(action.icon || '').toLowerCase().trim(),
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(action);
  }
  return deduped;
};

/** When `icon` is shown via SafeIcon, drop leading emoji from i18n labels ("🚗 Transport" → "Transport"). */
const actionDisplayLabel = (action: { label?: string; icon?: string | null }): string => {
  const label = String(action.label ?? '');
  if (!action.icon) return label;
  let s = label.trimStart();
  const leadingEmoji = /^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s*/u;
  for (let i = 0; i < 6 && leadingEmoji.test(s); i++) {
    s = s.replace(leadingEmoji, '');
  }
  return s.trimStart();
};

const TypingIndicator: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.ease, useNativeDriver: true }),
        ]),
      );
    const a1 = createDotAnimation(dot1, 0);
    const a2 = createDotAnimation(dot2, 150);
    const a3 = createDotAnimation(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={typingStyles.container}>
      <View style={typingStyles.bubble}>
        <SafeIcon name="bot" size={14} color="#6366f1" />
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[typingStyles.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  );
};

const typingStyles = StyleSheet.create({
  container: { alignItems: 'flex-start', marginBottom: 12, paddingLeft: 4 },
  bubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: modernColors.card, borderWidth: 1, borderColor: modernColors.border,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderBottomLeftRadius: 4,
  },
  dot: {
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#6366f1', marginLeft: 3,
  },
});

const IntelligentChat: React.FC<IntelligentChatProps> = ({
  visible,
  onClose,
  initialMessage,
  screenContext: externalContext,
}) => {
  const navigation = useNavigation();
  const { t, language } = useLanguageSafe();
  const navState = navigation.getState();
  const route = navState?.routes[navState?.index];
  const inferredContext = useScreenContext(route?.name, route?.params);
  const screenContext = useMemo(() => {
    if (!externalContext) return inferredContext;
    return {
      ...inferredContext,
      ...externalContext,
      userData: {
        ...(inferredContext?.userData || {}),
        ...(externalContext?.userData || {}),
      },
      serviceData: {
        ...(inferredContext?.serviceData || {}),
        ...(externalContext?.serviceData || {}),
      },
      availableActions: Array.isArray(externalContext?.availableActions) && externalContext.availableActions.length > 0
        ? externalContext.availableActions
        : inferredContext?.availableActions || [],
      visibleElements: Array.isArray(externalContext?.visibleElements) && externalContext.visibleElements.length > 0
        ? externalContext.visibleElements
        : inferredContext?.visibleElements || [],
      currentRoute: externalContext?.currentRoute || inferredContext?.currentRoute,
      breadcrumbs: externalContext?.breadcrumbs || inferredContext?.breadcrumbs,
      previousScreen: externalContext?.previousScreen || inferredContext?.previousScreen,
      guideText: externalContext?.guideText || inferredContext?.guideText,
    };
  }, [externalContext, inferredContext]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<any[]>([]);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !__DEV__) return;
    try {
      console.log('[ChatContext] open', {
        screenName: screenContext?.screenName,
        currentRoute: screenContext?.currentRoute,
        screenType: screenContext?.screenType,
        availableActions: Array.isArray(screenContext?.availableActions) ? screenContext.availableActions.length : 0,
        visibleElements: Array.isArray(screenContext?.visibleElements) ? screenContext.visibleElements.length : 0,
      });
    } catch { }
  }, [visible, screenContext]);

  useEffect(() => {
    if (visible) {
      const screenLabel = humanizeScreenName(screenContext.screenName);
      const userName = screenContext.userData?.name || screenContext.userData?.email?.split('@')[0] || '';
      const isHomeScreen = screenLabel === 'Accueil';

      let greeting: string;
      if (isHomeScreen) {
        const homeKey = userName ? 'intelligentChat.welcomeHomeUser' : 'intelligentChat.welcomeHome';
        greeting = t(homeKey, { name: userName });
        if (!greeting || greeting.startsWith('intelligentChat.')) {
          greeting = userName
            ? `${userName}, bienvenue sur Yukpo ! 🚀 Je suis votre assistant IA. Santé, transport, livraison, emploi, éducation — demandez-moi tout !`
            : `Bienvenue sur Yukpo ! 🚀 La super-app qui révolutionne votre quotidien. Découvrez nos services — demandez ou appuyez ci-dessous !`;
        }
      } else {
        const screenKey = userName ? 'intelligentChat.welcomeUser' : 'intelligentChat.welcomeScreen';
        greeting = t(screenKey, { name: userName, screen: screenLabel });
        if (!greeting || greeting.startsWith('intelligentChat.')) {
          greeting = `${userName ? `${userName}, ` : ''}Je suis votre assistant Yukpo sur « ${screenLabel} ». Comment puis-je vous aider ?`;
        }
      }

      const welcomeActions: any[] = isHomeScreen ? [
        { id: 'discover', label: t('intelligentChat.discover') || '🚀 Découvrir Yukpo', icon: 'sparkles', route: undefined, category: 'discovery', description: '' },
        { id: 'health', label: t('intelligentChat.nav.health') || '🏥 Santé', icon: 'heart', route: 'PharmacieHome', category: 'navigation', description: '' },
        { id: 'transport', label: t('intelligentChat.nav.transport') || '🚗 Transport', icon: 'car', route: 'TaxiHome', category: 'navigation', description: '' },
        { id: 'delivery', label: t('intelligentChat.nav.delivery') || '📦 Livraison', icon: 'truck', route: 'DeliveryHome', category: 'navigation', description: '' },
        { id: 'gps', label: t('intelligentChat.nav.gps') || '🗺️ Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' },
        { id: 'emploi', label: t('intelligentChat.nav.jobs') || '💼 Emploi', icon: 'briefcase', route: 'OffresEmploiHome', category: 'navigation', description: '' },
        { id: 'hotel', label: t('intelligentChat.nav.hotel') || '🏨 Hôtels', icon: 'building', route: 'HotelMeubleHome', category: 'navigation', description: '' },
        { id: 'books', label: t('intelligentChat.nav.books') || '📚 Livres', icon: 'book-open', route: 'LivreScolaireHome', category: 'navigation', description: '' },
      ] : [];

      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        text: greeting,
        isUser: false,
        timestamp: new Date(),
        type: 'text',
        suggestedActions: isHomeScreen ? welcomeActions : undefined,
        metadata: isHomeScreen ? {
          nextSteps: [
            t('intelligentChat.followUp.whatIsYukpo') || "C'est quoi Yukpo ?",
            t('intelligentChat.followUp.howCreateProduct') || 'Comment créer un produit/service ?',
            t('intelligentChat.followUp.howPayment') || 'Quels moyens de paiement ?',
          ],
        } : undefined,
      };
      setMessages([welcomeMessage]);
      setLastFailedMessage(null);

      const contextActions = isHomeScreen
        ? welcomeActions
        : screenContext.availableActions
          .filter((a: any) => a.id !== 'home' && a.id !== 'profile' && a.id !== 'services')
          .slice(0, 6);
      setSuggestedActions(dedupeActions(contextActions));

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      if (initialMessage) {
        setTimeout(() => {
          handleSendMessage(initialMessage);
        }, 500);
      }
    }
  }, [visible, screenContext.screenName, initialMessage]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [onClose, slideAnim]);

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || inputText.trim();
    if (!text || loading) return;

    setLastFailedMessage(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
      type: 'text',
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response: ChatResponse = await intelligentChatService.generateContextualResponse(
        text,
        screenContext,
        messages,
        language,
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        isUser: false,
        timestamp: new Date(),
        type: response.type,
        suggestedActions: response.suggestedActions,
        visualElements: response.visualElements,
        metadata: {
          confidence: response.confidence,
          nextSteps: response.nextSteps,
        },
      };

      setMessages(prev => [...prev, aiMessage]);

      if (response.suggestedActions && response.suggestedActions.length > 0) {
        setSuggestedActions(dedupeActions(response.suggestedActions));
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('[IntelligentChat] Error:', error);
      setLastFailedMessage(text);

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: t('intelligentChat.error') || 'Désolé, une erreur est survenue. Réessayez.',
        isUser: false,
        timestamp: new Date(),
        type: 'text',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, screenContext, messages, language]);

  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      setMessages(prev => prev.filter(m => !(!m.isUser && m.id === prev[prev.length - 1]?.id && prev[prev.length - 1]?.text === (t('intelligentChat.error') || 'Désolé, une erreur est survenue. Réessayez.'))));
      handleSendMessage(lastFailedMessage);
    }
  }, [lastFailedMessage, handleSendMessage]);

  const handleActionPress = useCallback((action: any) => {
    if (action.id === 'discover') {
      const discoveryQuery = t('intelligentChat.discoveryQuery') || 'What is Yukpo? Show me all features';
      handleSendMessage(discoveryQuery);
    } else if (action.route) {
      try {
        // @ts-ignore - dynamic route navigation
        navigation.navigate(action.route, action.params);
      } catch {
        // @ts-ignore - dynamic route navigation
        navigation.navigate(action.route);
      }
      handleClose();
    } else if (action.action && typeof action.action === 'function') {
      action.action();
    } else if (action.label) {
      handleSendMessage(action.label);
    }
  }, [navigation, handleClose, handleSendMessage, t]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.isUser;

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.aiMessage]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <SafeIcon name="bot" size={14} color="#6366f1" />
          </View>
        )}
        <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
              {item.text}
            </Text>

            {item.visualElements && item.visualElements.length > 0 && (
              <View style={styles.visualElementsContainer}>
                {item.visualElements.map((element: VisualElement) => (
                  <View key={element.id} style={styles.visualElement}>
                    <SafeIcon name={element.icon || 'help-circle'} size={16} color="#6366f1" />
                    <Text style={styles.visualElementText}>{element.label}</Text>
                    <Text style={styles.visualElementDesc}>{element.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {item.suggestedActions && item.suggestedActions.length > 0 && (
              <View style={styles.messageActions}>
                {item.suggestedActions.slice(0, 6).map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.messageActionButton}
                    onPress={() => handleActionPress(action)}
                  >
                    {action.icon && (
                      <SafeIcon name={action.icon} size={14} color="#6366f1" />
                    )}
                    <Text style={styles.messageActionText}>{actionDisplayLabel(action)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {item.metadata?.nextSteps && item.metadata.nextSteps.length > 0 && (
              <View style={styles.nextStepsContainer}>
                <Text style={styles.nextStepsTitle}>{t('intelligentChat.followUpTitle') || 'You might also ask:'}</Text>
                {item.metadata.nextSteps.map((step: string, idx: number) => (
                  <TouchableOpacity
                    key={`next-${idx}`}
                    style={styles.nextStepButton}
                    onPress={() => handleSendMessage(step)}
                  >
                    <SafeIcon name="message-circle" size={12} color="#8b5cf6" />
                    <Text style={styles.nextStepText}>{step}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }, [handleActionPress]);

  const renderSuggestedActions = useCallback(() => {
    if (suggestedActions.length === 0 || loading) return null;

    return (
      <View style={styles.suggestedActionsContainer}>
        <Text style={styles.suggestedActionsTitle}>{t('intelligentChat.quickActions') || 'Actions rapides'}</Text>
        <View style={styles.suggestedActionsGrid}>
          {suggestedActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.suggestedActionButton}
              onPress={() => handleActionPress(action)}
            >
              <SafeIcon name={action.icon || 'arrow-right'} size={16} color="#6366f1" />
              <Text style={styles.suggestedActionText} numberOfLines={1}>{actionDisplayLabel(action)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [suggestedActions, handleActionPress, loading]);

  return (
    <Modal visible={visible} animationType="none" transparent presentationStyle="overFullScreen">
      <Animated.View style={[styles.safeArea, { transform: [{ translateY: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <SafeIcon name="x" size={22} color={modernColors.text} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <View style={styles.headerTitleRow}>
                <SafeIcon name="bot" size={18} color="#6366f1" />
                <Text style={styles.headerTitle}>{t('intelligentChat.title') || 'Assistant IA'}</Text>
              </View>
              <View style={styles.headerStatusRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.headerSubtitle}>{humanizeScreenName(screenContext.screenName)}</Text>
              </View>
            </View>
            <View style={styles.headerPlaceholder} />
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={loading ? <TypingIndicator /> : null}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {lastFailedMessage && !loading && (
            <TouchableOpacity style={styles.retryBar} onPress={handleRetry}>
              <SafeIcon name="refresh-cw" size={14} color="#ef4444" />
              <Text style={styles.retryText}>{t('intelligentChat.retryMessage') || 'Réessayer'}</Text>
            </TouchableOpacity>
          )}

          {renderSuggestedActions()}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('intelligentChat.placeholder') || 'Posez votre question...'}
              placeholderTextColor={modernColors.textSecondary}
              multiline
              maxLength={500}
              editable={!loading}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || loading}
            >
              <SafeIcon name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.border,
    backgroundColor: modernColors.card,
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.text,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  headerSubtitle: {
    fontSize: 11,
    color: modernColors.textSecondary,
  },
  headerPlaceholder: {
    width: 38,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 4,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: modernColors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: modernColors.text,
  },
  timestamp: {
    fontSize: 10,
    color: modernColors.textSecondary,
    marginTop: 3,
    marginHorizontal: 4,
  },
  visualElementsContainer: {
    marginTop: 8,
    gap: 4,
  },
  visualElement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: modernColors.background,
    padding: 8,
    borderRadius: 8,
  },
  visualElementText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '500',
    color: modernColors.text,
  },
  visualElementDesc: {
    marginLeft: 8,
    fontSize: 11,
    color: modernColors.textSecondary,
    flex: 1,
  },
  messageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  nextStepsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
    gap: 4,
  },
  nextStepsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: modernColors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nextStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f5f3ff',
    gap: 6,
  },
  nextStepText: {
    fontSize: 12,
    color: '#8b5cf6',
    flex: 1,
  },
  messageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  messageActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366f1',
  },
  suggestedActionsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  suggestedActionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestedActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestedActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: modernColors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: modernColors.border,
    gap: 6,
  },
  suggestedActionText: {
    fontSize: 12,
    color: modernColors.text,
    maxWidth: 120,
  },
  retryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#fef2f2',
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
    backgroundColor: modernColors.card,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: modernColors.text,
    backgroundColor: modernColors.background,
    maxHeight: 100,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: modernColors.border,
  },
  safeArea: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
});

export default IntelligentChat;
