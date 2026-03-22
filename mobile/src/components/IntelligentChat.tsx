import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
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
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import { useScreenContext } from '../hooks/useScreenContext';
import { navigateToMesServicesHub } from '../navigation/mesServicesNavigation';
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
  Services: 'Mes services (Produits)',
  MesServices: 'Mes services (Produits)',
  ServicesDashboard: 'Tableau de bord services',
  MesServices: 'Mes services',
  Services: 'Mes services (produits)',
  GestionServicesSpecialises: 'Services spécialisés',
  OffresEmploiHome: 'Offres d’emploi',
  HotelMeubleHome: 'Hôtels & meublés',
  HotelSearch: 'Recherche hôtels',
  MeubleSearch: 'Recherche meublés',
  HotelBooking: 'Réservation séjour',
  AssuranceDashboard: 'Assurance — espace partenaire',
  InsuranceServicesSearch: 'Recherche assurance',
  InsuranceServicesResults: 'Résultats assurance',
  InsuranceQuoteRequest: 'Devis assurance IA',
  MesPolicesAssurance: 'Mes polices d’assurance',
  DeclarationSinistre: 'Déclarer un sinistre',
  SuiviSinistre: 'Suivi des sinistres',
  TaxiHome: 'Taxi',
  DeliveryHome: 'Livraison',
  LivreScolaireHome: 'Bourse du livre',
  WalletFinancial: 'Portefeuille',
};

function getLeafRouteFromState(state: any): { name?: string; params?: any } {
  if (!state?.routes?.length) return {};
  const r = state.routes[state.index ?? 0];
  if (r?.state) return getLeafRouteFromState(r.state);
  return { name: r?.name, params: r?.params };
}

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

type InlineToken = { text: string; bold?: boolean; italic?: boolean };

const parseInlineMarkdown = (raw: string): InlineToken[] => {
  const source = String(raw || '');
  if (!source) return [{ text: '' }];

  // Support léger du markdown inline: **gras** et *italique*.
  // On ignore volontairement les cas complexes imbriqués pour rester stable.
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  const parts = source.split(pattern).filter(Boolean);

  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return { text: part.slice(2, -2), bold: true };
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
      return { text: part.slice(1, -1), italic: true };
    }
    return { text: part };
  });
};

type BlockToken = { type: 'bullet' | 'text'; content: string };

const parseBlockMarkdown = (raw: string): BlockToken[] => {
  const lines = String(raw || '').split('\n');
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && trimmed.length > 2) {
      return { type: 'bullet' as const, content: trimmed.slice(2).trim() };
    }
    return { type: 'text' as const, content: line };
  });
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
  const keyboardBottomInset = useKeyboardBottomInset();
  const navState = navigation.getState?.();
  const route = navState?.routes?.[navState?.index ?? 0];
  const leaf = getLeafRouteFromState(navState);
  const effectiveRouteName = externalContext?.screenName ?? leaf.name ?? route?.name;
  const effectiveRouteParams = externalContext?.routeParams !== undefined
    ? externalContext.routeParams
    : (leaf.params ?? route?.params);
  const inferredContext = useScreenContext(effectiveRouteName, effectiveRouteParams);
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
        ...((externalContext as any)?.routeParams &&
        typeof (externalContext as any).routeParams === 'object' &&
        !Array.isArray((externalContext as any).routeParams)
          ? (externalContext as any).routeParams
          : {}),
      },
      availableActions: (() => {
        const inf = inferredContext?.availableActions || [];
        const ext = externalContext?.availableActions;
        if (Array.isArray(ext) && ext.length > 0) {
          return dedupeActions([...inf, ...ext]);
        }
        return inf;
      })(),
      visibleElements: (() => {
        const inf = inferredContext?.visibleElements || [];
        const ext = externalContext?.visibleElements;
        if (Array.isArray(ext) && ext.length > 0) {
          const seen = new Set<string>();
          const out: any[] = [];
          for (const el of [...inf, ...ext]) {
            if (!el?.id) continue;
            if (seen.has(el.id)) continue;
            seen.add(el.id);
            out.push(el);
          }
          return out;
        }
        return inf;
      })(),
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
    if (keyboardBottomInset <= 0) return;
    const id = requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [keyboardBottomInset]);

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
        // Retire la mention "aujourd'hui" dans le texte d'accueil Home.
        greeting = greeting
          .replace(/aujourd[’']hui/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
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
        { id: 'hotel', label: t('intelligentChat.nav.hotel') || '🏨 Hôtels', icon: 'building', route: 'HotelSearch', params: { mode: 'hotel' }, category: 'navigation', description: '' },
        { id: 'books', label: t('intelligentChat.nav.books') || '📚 Livres', icon: 'book-open', route: 'LivreScolaireHome', category: 'navigation', description: '' },
        { id: 'services', label: t('intelligentChat.nav.myServices') || 'Mes services', icon: 'briefcase', route: 'MesServices', category: 'navigation', description: '' },
      ] : [];

      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        text: greeting,
        isUser: false,
        timestamp: new Date(),
        type: 'text',
        // Les actions restent dans le bloc "Actions rapides" du bas.
        // On masque ici les boutons attachés au message d'accueil.
        suggestedActions: undefined,
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
        : (Array.isArray(screenContext.availableActions) ? screenContext.availableActions : [])
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
    } else if (
      action.id === 'services' ||
      action.id === 'tab-services' ||
      action.route === 'MesServices' ||
      action.route === 'Services'
    ) {
      navigateToMesServicesHub(navigation as any);
      handleClose();
    } else if (action.route) {
      try {
        // @ts-ignore - dynamic route navigation
        if (action.params != null && typeof action.params === 'object') {
          navigation.navigate(action.route, action.params);
        } else {
          navigation.navigate(action.route);
        }
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
            <View style={styles.markdownBlockContainer}>
              {parseBlockMarkdown(item.text).map((block, blockIdx) => {
                if (block.type === 'bullet') {
                  return (
                    <View key={`${item.id}-block-${blockIdx}`} style={styles.bulletRow}>
                      <Text style={[styles.bulletSymbol, isUser ? styles.userText : styles.aiText]}>•</Text>
                      <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText, styles.bulletText]}>
                        {parseInlineMarkdown(block.content).map((token, idx) => (
                          <Text
                            key={`${item.id}-block-${blockIdx}-token-${idx}`}
                            style={[
                              token.bold ? styles.markdownBold : null,
                              token.italic ? styles.markdownItalic : null,
                            ]}
                          >
                            {token.text}
                          </Text>
                        ))}
                      </Text>
                    </View>
                  );
                }

                return (
                  <Text key={`${item.id}-block-${blockIdx}`} style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
                    {parseInlineMarkdown(block.content).map((token, idx) => (
                      <Text
                        key={`${item.id}-block-${blockIdx}-token-${idx}`}
                        style={[
                          token.bold ? styles.markdownBold : null,
                          token.italic ? styles.markdownItalic : null,
                        ]}
                      >
                        {token.text}
                      </Text>
                    ))}
                  </Text>
                );
              })}
            </View>

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

            {item.suggestedActions && item.suggestedActions.length > 0 && (() => {
              const navLinks = item.suggestedActions!.filter((a: any) => a.id?.startsWith('nav-'));
              const otherActions = item.suggestedActions!.filter((a: any) => !a.id?.startsWith('nav-'));
              return (
                <View style={styles.messageActions}>
                  {otherActions.slice(0, 6).map((action: any) => (
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
                  {navLinks.length > 0 && (
                    <>
                      <Text style={styles.navLinksLabel}>{t('intelligentChat.quickAccess')}</Text>
                      {navLinks.map((action: any) => (
                        <TouchableOpacity
                          key={action.id}
                          style={styles.navLinkBtn}
                          onPress={() => handleActionPress(action)}
                        >
                          {action.icon && <SafeIcon name={action.icon} size={14} color="#fff" />}
                          <Text style={styles.navLinkBtnText}>{action.label}</Text>
                          <SafeIcon name="chevron-right" size={14} color="#fff" />
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              );
            })()}

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
        <View style={[styles.container, { paddingBottom: keyboardBottomInset }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <SafeIcon name="x" size={22} color={modernColors.text} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerAiIconWrap}>
                  <SafeIcon name="sparkles" size={18} color="#6366f1" />
                  <View style={styles.headerAiDot} />
                </View>
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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
        </View>
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
  headerAiIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAiDot: {
    position: 'absolute',
    right: 0,
    top: 1,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#06b6d4',
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
  markdownBlockContainer: {
    gap: 2,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: modernColors.text,
  },
  markdownBold: {
    fontWeight: '700',
  },
  markdownItalic: {
    fontStyle: 'italic',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletSymbol: {
    fontSize: 14,
    lineHeight: 20,
    marginRight: 8,
    marginTop: 0,
  },
  bulletText: {
    flex: 1,
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
  navLinksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 10,
    marginBottom: 4,
    width: '100%',
  },
  navLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    width: '100%',
    marginBottom: 4,
  },
  navLinkBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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
