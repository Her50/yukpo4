import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
import {
  buildExportBaseNameFromChat,
  exportChatTextAsPdf,
  exportChatTextAsWordDoc,
  exportJsonObjectAsFile,
  openOrDownloadRemoteFile,
  stripSimpleMarkdownForExport,
} from '../utils/chatExportUtils';
import { FormattedChatText } from '../utils/chatMarkdown';
import SafeStorage from '../utils/safeStorage';
import {
  cancelAudioRecording,
  pickDocumentForYukpoIa,
  pickImageForYukpoIa,
  startAudioRecordingForYukpoIa,
  stopAudioRecordingForYukpoIa,
  takePhotoForYukpoIa,
  type YukpoIaAttachmentPayload
} from '../utils/yukpoIaAttachments';
import GlobalShareModal, { GlobalSharePayload } from './GlobalShareModal';
import SafeIcon from './SafeIcon';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_SHARE_WEB = 'https://yukpomnang.com';
const YUKPO_IA_SESSION_STORAGE_KEY = 'yukpo_ia_active_session_id';
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏'] as const;

function mapYukpoSessionMessageToChat(m: {
  id: string;
  role: string;
  content: string;
  created_at: string;
}): ChatMessage {
  const normalizeSessionText = (raw: string) => {
    const src = String(raw || '');
    // Nettoyage défensif pour l'historique déjà stocké côté serveur.
    const trimmedJsonTail = src.replace(
      /\n\s*,?\s*"(?:type|confidence|suggested_actions|suggestedActions|visual_elements|visualElements)"\s*:[\s\S]*$/m,
      '',
    );
    return trimmedJsonTail
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  return {
    id: m.id,
    text: normalizeSessionText(m.content),
    isUser: m.role === 'user',
    timestamp: new Date(m.created_at),
    type: 'text',
    metadata: { serverCreatedAt: m.created_at },
  };
}

interface IntelligentChatProps {
  visible: boolean;
  onClose: () => void;
  initialMessage?: string;
  screenContext?: any;
  /** When set, replaces the default welcome text (use i18n from parent for multi-language UI). */
  welcomeMessageOverride?: string;
  /** Optional follow-up chips under the welcome bubble (non-home screens). */
  welcomeFollowUpQuestions?: string[];
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
  GestionServicesSpecialises: 'Services spécialisés',
  OffresEmploiHome: 'Offres d’emploi',
  HotelMeubleHome: 'Hôtels & meublés',
  HotelSearch: 'Recherche hôtels',
  MeubleSearch: 'Recherche meublés',
  HotelBooking: 'Réservation séjour',
  ProductVideoCreationModal: 'Studio vidéo Yukpo',
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

/** Max 3 boutons : recharge d’abord, puis nav, puis le reste. */
const orderAndCapAssistantActions = (
  actions: any[] | undefined,
  max = 3,
): { navLinks: any[]; otherActions: any[] } => {
  if (!actions?.length) return { navLinks: [], otherActions: [] };
  const recharge = actions.find((a) => a.id === 'yukpo-ia-recharge');
  const rest = actions.filter((a) => a.id !== 'yukpo-ia-recharge');
  const nav = rest.filter((a: any) => a.id?.startsWith('nav-'));
  const other = rest.filter((a: any) => !a.id?.startsWith('nav-'));
  const ordered = [...(recharge ? [recharge] : []), ...nav, ...other].slice(0, max);
  return {
    navLinks: ordered.filter((a: any) => a.id?.startsWith('nav-')),
    otherActions: ordered.filter((a: any) => !a.id?.startsWith('nav-')),
  };
};

function deriveSessionTitleFromUserMessage(raw: string): string {
  let s = String(raw || '')
    .replace(/^\[ASSISTANT_TONE_PREFIX:[\s\S]*?\]\s*/i, '')
    .replace(/\s*📎\s*×\s*\d+/g, '')
    .trim();
  s = s.replace(/\s+/g, ' ');
  if (s.length > 72) s = `${s.slice(0, 69).trim()}…`;
  if (!s) return 'Conversation Yukpo IA';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

/** Réponses IA / JSON : `icon` ou `route` non-string cassent SafeIcon / React Navigation. */
function sanitizeSuggestedActionsForUi(actions: any[] | undefined): any[] | undefined {
  if (!Array.isArray(actions) || actions.length === 0) return actions;
  return actions
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const out = { ...a };
      if (out.icon != null && typeof out.icon !== 'string') {
        if (typeof out.icon === 'number' || typeof out.icon === 'boolean') {
          out.icon = String(out.icon);
        } else {
          delete out.icon;
        }
      }
      if (out.route != null && typeof out.route !== 'string') {
        delete out.route;
      }
      if (out.params != null && (typeof out.params !== 'object' || Array.isArray(out.params))) {
        delete out.params;
      }
      return out;
    })
    .filter(Boolean);
}

function sanitizeVisualElementsForUi(
  elements: VisualElement[] | undefined,
): VisualElement[] | undefined {
  if (!Array.isArray(elements) || elements.length === 0) return elements;
  return elements.map((el) => {
    if (!el || typeof el !== 'object') return el;
    const out = { ...el };
    if (out.icon != null && typeof out.icon !== 'string') {
      delete out.icon;
    }
    return out;
  });
}

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
  welcomeMessageOverride,
  welcomeFollowUpQuestions,
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

  const latestScreenContextRef = useRef(screenContext);
  latestScreenContextRef.current = screenContext;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePayload, setSharePayload] = useState<GlobalSharePayload | null>(null);
  /** Réaction par id de message (affichage local) */
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [pendingAttachments, setPendingAttachments] = useState<YukpoIaAttachmentPayload[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);
  const [sessionsList, setSessionsList] = useState<Array<{ id: string; title: string | null; last_message_at?: string }>>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [longTermMemoryEnabled, setLongTermMemoryEnabled] = useState(true);
  /** Horodatage ISO du consentement mémoire long terme (null = jamais accepté). */
  const [longTermMemoryConsentAt, setLongTermMemoryConsentAt] = useState<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  const oldestBeforeRef = useRef<string | null>(null);
  const loadOlderCooldownRef = useRef(0);
  /** Évite scrollToEnd lorsqu'on préfixe d'anciens messages (préserve la position de lecture). */
  const prependingOlderRef = useRef(false);
  const autoTitledSessionIdRef = useRef<string | null>(null);

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
    if (!visible) return;

    let cancelled = false;
    let initialTimer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const ctx = latestScreenContextRef.current;
      const sessionScreen = ctx.screenName ?? effectiveRouteName;
      const screenLabel = humanizeScreenName(ctx.screenName);
      const userName = ctx.userData?.name || ctx.userData?.email?.split('@')[0] || '';
      const isHomeScreen = screenLabel === 'Accueil';

      let greeting: string;
      if (welcomeMessageOverride?.trim()) {
        greeting = welcomeMessageOverride.trim();
      } else if (isHomeScreen) {
        const homeKey = userName ? 'intelligentChat.welcomeHomeUser' : 'intelligentChat.welcomeHome';
        greeting = t(homeKey, { name: userName });
        if (!greeting || greeting.startsWith('intelligentChat.')) {
          greeting = userName
            ? `${userName}, bienvenue sur Yukpo ! 🚀 Je suis votre assistant IA. Santé, transport, livraison, emploi, éducation — demandez-moi tout !`
            : `Bienvenue sur Yukpo ! 🚀 La super-app qui révolutionne votre quotidien. Découvrez nos services — demandez ou appuyez ci-dessous !`;
        }
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
        { id: 'services', label: t('intelligentChat.nav.myServices') || 'Mes services', icon: 'briefcase', route: 'MesProduits', category: 'navigation', description: '' },
      ] : [];

      const contextActions = isHomeScreen
        ? welcomeActions.slice(0, 3)
        : (Array.isArray(ctx.availableActions) ? ctx.availableActions : [])
          .filter((a: any) => a.id !== 'home' && a.id !== 'profile' && a.id !== 'services')
          .slice(0, 3);

      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        text: greeting,
        isUser: false,
        timestamp: new Date(),
        type: 'text',
        suggestedActions: contextActions.length ? contextActions : undefined,
        metadata: isHomeScreen
          ? {
            nextSteps: [
              t('intelligentChat.followUp.whatIsYukpo') || "C'est quoi Yukpo ?",
              t('intelligentChat.followUp.howCreateProduct') || 'Comment créer un produit/service ?',
              t('intelligentChat.followUp.howPayment') || 'Quels moyens de paiement ?',
            ],
          }
          : welcomeFollowUpQuestions?.length
            ? { nextSteps: welcomeFollowUpQuestions }
            : undefined,
      };

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      try {
        const stored = await SafeStorage.getItem(YUKPO_IA_SESSION_STORAGE_KEY);
        if (stored) {
          const detail = await intelligentChatService.getYukpoIaSessionDetail(stored, { limit: 80 });
          if (!cancelled && detail?.session?.id) {
            setActiveSessionId(detail.session.id);
            if (detail.messages?.length) {
              const mapped: ChatMessage[] = detail.messages.map(mapYukpoSessionMessageToChat);
              setMessages(mapped);
              oldestBeforeRef.current = detail.messages[0]?.created_at ?? null;
              setHasMoreOlder(Boolean(detail.has_more));
            } else {
              setMessages([welcomeMessage]);
              oldestBeforeRef.current = null;
              setHasMoreOlder(false);
            }
            setLastFailedMessage(null);
            if (initialMessage) {
              initialTimer = setTimeout(() => {
                if (!cancelled) void handleSendMessage(initialMessage);
              }, 500);
            }
            return;
          }
          await SafeStorage.removeItem(YUKPO_IA_SESSION_STORAGE_KEY);
        }

        const created = await intelligentChatService.createYukpoIaSession({
          context_screen: sessionScreen,
          context_type: ctx.screenType || 'general',
        });
        if (!cancelled && created?.id) {
          setActiveSessionId(created.id);
          await SafeStorage.setItem(YUKPO_IA_SESSION_STORAGE_KEY, created.id);
        }
      } catch (e) {
        console.warn('[IntelligentChat] session bootstrap', e);
        const fallback = await intelligentChatService.createYukpoIaSession({
          context_screen: sessionScreen,
          context_type: ctx.screenType || 'general',
        });
        if (!cancelled && fallback?.id) {
          setActiveSessionId(fallback.id);
          await SafeStorage.setItem(YUKPO_IA_SESSION_STORAGE_KEY, fallback.id);
        }
      }

      if (cancelled) return;
      setMessages([welcomeMessage]);
      oldestBeforeRef.current = null;
      setHasMoreOlder(false);
      setLastFailedMessage(null);

      if (initialMessage) {
        initialTimer = setTimeout(() => {
          if (!cancelled) void handleSendMessage(initialMessage);
        }, 500);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (initialTimer) clearTimeout(initialTimer);
    };
  }, [visible, initialMessage, welcomeMessageOverride, welcomeFollowUpQuestions]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [onClose, slideAnim]);

  const openShareForAssistantMessage = useCallback(
    (item: ChatMessage) => {
      const body = stripSimpleMarkdownForExport(item.text).slice(0, 12000);
      setSharePayload({
        title: (t('intelligentChat.shareTitle') as string) || 'Réponse Yukpo IA',
        description: body,
        shareUrl: DEFAULT_SHARE_WEB,
        contentType: 'chat_message',
        extraData: { source: 'intelligent_chat', messageId: item.id },
      });
      setShareModalVisible(true);
    },
    [t],
  );

  const promptExportAssistantMessage = useCallback(
    (item: ChatMessage) => {
      const base = buildExportBaseNameFromChat(item.text, 'reponse-yukpo-ia');
      Alert.alert(
        (t('intelligentChat.exportTitle') as string) || 'Enregistrer la réponse',
        (t('intelligentChat.exportSubtitle') as string) || 'Choisissez le format de fichier.',
        [
          {
            text: (t('intelligentChat.exportPdf') as string) || 'PDF',
            onPress: () => {
              void exportChatTextAsPdf(item.text, base, { withYukpoIaFooter: true });
            },
          },
          {
            text: (t('intelligentChat.exportWord') as string) || 'Word (.doc)',
            onPress: () => {
              void exportChatTextAsWordDoc(item.text, base, { withYukpoIaFooter: true });
            },
          },
          { text: (t('message.cancel') as string) || 'Annuler', style: 'cancel' },
        ],
      );
    },
    [t],
  );

  const toggleMessageReaction = useCallback((messageId: string, emoji: string) => {
    setMessageReactions((prev) => {
      const next = { ...prev };
      if (next[messageId] === emoji) {
        delete next[messageId];
      } else {
        next[messageId] = emoji;
      }
      return next;
    });
  }, []);

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const raw = messageText ?? inputText.trim();
    const atts = [...pendingAttachments];
    const text = raw || (atts.length ? (t('yukpoIa.analyzeThis') as string) : '');
    if (!text || loading) return;

    const isFirstUserTurn = messages.filter((m) => m.isUser).length === 0;

    setLastFailedMessage(null);
    setPendingAttachments([]);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: atts.length ? `${text} \n📎×${atts.length}` : text,
      isUser: true,
      timestamp: new Date(),
      type: 'text',
      userAttachments: atts.length ? atts : undefined,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      let sessionIdForReq = activeSessionId;
      if (!sessionIdForReq) {
        const created = await intelligentChatService.createYukpoIaSession({
          context_screen: effectiveRouteName,
          context_type: screenContext.screenType || 'general',
        });
        if (created?.id) {
          sessionIdForReq = created.id;
          setActiveSessionId(created.id);
          await SafeStorage.setItem(YUKPO_IA_SESSION_STORAGE_KEY, created.id);
        }
      }

      const response: ChatResponse = await intelligentChatService.generateContextualResponse(
        text,
        screenContext,
        messages,
        language,
        atts.length
          ? { yukpoIaAttachments: atts, sessionId: sessionIdForReq }
          : { sessionId: sessionIdForReq },
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        isUser: false,
        timestamp: new Date(),
        type: response.type,
        suggestedActions: sanitizeSuggestedActionsForUi(response.suggestedActions),
        visualElements: sanitizeVisualElementsForUi(response.visualElements),
        attachments: response.attachments,
        metadata: {
          confidence: response.confidence,
          nextSteps: response.nextSteps,
          billing: response.billing,
          assistantBrand: response.assistantBrand,
        },
      };

      setMessages(prev => [...prev, aiMessage]);

      if (
        sessionIdForReq &&
        isFirstUserTurn &&
        autoTitledSessionIdRef.current !== sessionIdForReq
      ) {
        autoTitledSessionIdRef.current = sessionIdForReq;
        const title = deriveSessionTitleFromUserMessage(text);
        void (async () => {
          const ok = await intelligentChatService.patchYukpoIaSession(sessionIdForReq, { title });
          if (!ok) return;
          setSessionsList((prev) => {
            const i = prev.findIndex((s) => s.id === sessionIdForReq);
            if (i >= 0) {
              return prev.map((s) => (s.id === sessionIdForReq ? { ...s, title } : s));
            }
            return [
              {
                id: sessionIdForReq,
                title,
                last_message_at: new Date().toISOString(),
              },
              ...prev,
            ];
          });
        })();
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
  }, [inputText, loading, screenContext, messages, language, pendingAttachments, t, activeSessionId]);

  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      setMessages(prev => prev.filter(m => !(!m.isUser && m.id === prev[prev.length - 1]?.id && prev[prev.length - 1]?.text === (t('intelligentChat.error') || 'Désolé, une erreur est survenue. Réessayez.'))));
      handleSendMessage(lastFailedMessage);
    }
  }, [lastFailedMessage, handleSendMessage]);

  const openSessionsModal = useCallback(async () => {
    setSessionsModalVisible(true);
    setSessionsLoading(true);
    try {
      const [rows, prefs] = await Promise.all([
        intelligentChatService.listYukpoIaSessions({ limit: 40 }),
        intelligentChatService.getYukpoIaPreferences(),
      ]);
      setSessionsList(
        rows.map((s) => ({ id: s.id, title: s.title, last_message_at: s.last_message_at })),
      );
      if (prefs) {
        setLongTermMemoryConsentAt(
          typeof prefs.long_term_memory_consent_at === 'string' ? prefs.long_term_memory_consent_at : null,
        );
        setLongTermMemoryEnabled(
          typeof prefs.long_term_memory_active === 'boolean'
            ? prefs.long_term_memory_active
            : prefs.long_term_memory_enabled,
        );
      }
    } catch {
      setSessionsList([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const startNewSession = useCallback(async () => {
    const created = await intelligentChatService.createYukpoIaSession({
      context_screen: effectiveRouteName,
      context_type: screenContext.screenType || 'general',
    });
    if (!created?.id) {
      Alert.alert(
        (t('intelligentChat.newSessionErrorTitle') as string) || 'Conversation',
        (t('intelligentChat.newSessionErrorBody') as string) ||
        'Impossible de créer une conversation. Vérifiez votre connexion et que vous êtes connecté.',
      );
      return;
    }
    setActiveSessionId(created.id);
    await SafeStorage.setItem(YUKPO_IA_SESSION_STORAGE_KEY, created.id);
    setSessionsModalVisible(false);
    autoTitledSessionIdRef.current = null;
    oldestBeforeRef.current = null;
    setHasMoreOlder(false);
    const hint =
      (t('intelligentChat.newSessionHint') as string) ||
      'Nouvelle conversation YukpoIA — posez votre question.';
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        text: hint,
        isUser: false,
        timestamp: new Date(),
        type: 'text',
      },
    ]);
  }, [effectiveRouteName, screenContext.screenType, t]);

  const loadOlderMessages = useCallback(async () => {
    if (!activeSessionId || !oldestBeforeRef.current || !hasMoreOlder || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await intelligentChatService.listYukpoIaSessionMessagesPage(activeSessionId, {
        before: oldestBeforeRef.current,
        limit: 30,
      });
      if (!page?.messages?.length) {
        setHasMoreOlder(false);
        return;
      }
      const mapped = page.messages.map(mapYukpoSessionMessageToChat);
      setMessages((prev) => [...mapped, ...prev]);
      oldestBeforeRef.current = page.messages[0]?.created_at ?? oldestBeforeRef.current;
      setHasMoreOlder(page.has_more);
    } finally {
      setLoadingOlder(false);
      prependingOlderRef.current = false;
    }
  }, [activeSessionId, hasMoreOlder, loadingOlder]);

  const onChatScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (y > 48) return;
      const now = Date.now();
      if (now - loadOlderCooldownRef.current < 900) return;
      if (!hasMoreOlder || loadingOlder || !activeSessionId || !oldestBeforeRef.current) return;
      loadOlderCooldownRef.current = now;
      void loadOlderMessages();
    },
    [hasMoreOlder, loadingOlder, activeSessionId, loadOlderMessages],
  );

  const runGdprDelete = useCallback(() => {
    void (async () => {
      const r = await intelligentChatService.requestGdprDeleteYukpoIaData();
      if (r?.ok) {
        await SafeStorage.removeItem(YUKPO_IA_SESSION_STORAGE_KEY);
        setSessionsModalVisible(false);
        setActiveSessionId(null);
        oldestBeforeRef.current = null;
        setHasMoreOlder(false);
        void startNewSession();
      } else {
        Alert.alert('', t('intelligentChat.gdprError') as string || 'Échec de la suppression.');
      }
    })();
  }, [t, startNewSession]);

  const confirmGdprDelete = useCallback(() => {
    Alert.alert(
      (t('intelligentChat.gdprExportTitle') as string) || 'Copie de vos données',
      (t('intelligentChat.gdprExportBody') as string) ||
      'Exporter une copie JSON (sessions, messages, mémoire) avant suppression ?',
      [
        { text: t('message.cancel') as string, style: 'cancel' },
        {
          text: (t('intelligentChat.gdprExportSkip') as string) || 'Supprimer sans exporter',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              (t('intelligentChat.gdprTitle') as string) || 'Données YukpoIA',
              (t('intelligentChat.gdprBody') as string) ||
              'Toutes vos conversations YukpoIA et la mémoire long terme seront supprimées. Continuer ?',
              [
                { text: t('message.cancel') as string, style: 'cancel' },
                {
                  text: t('intelligentChat.gdprConfirm') as string || 'Supprimer',
                  style: 'destructive',
                  onPress: runGdprDelete,
                },
              ],
            );
          },
        },
        {
          text: (t('intelligentChat.gdprExportBtn') as string) || 'Exporter puis continuer',
          onPress: () => {
            void (async () => {
              const data = await intelligentChatService.exportGdprYukpoIaData();
              if (data) {
                try {
                  await exportJsonObjectAsFile(data, 'yukpo-ia-export');
                } catch {
                  /* utilisateur a annulé le partage */
                }
              } else {
                Alert.alert(
                  '',
                  (t('intelligentChat.gdprExportError') as string) || 'Export indisponible pour le moment.',
                );
              }
              Alert.alert(
                (t('intelligentChat.gdprTitle') as string) || 'Données YukpoIA',
                (t('intelligentChat.gdprBody') as string) ||
                'Toutes vos conversations YukpoIA et la mémoire long terme seront supprimées. Continuer ?',
                [
                  { text: t('message.cancel') as string, style: 'cancel' },
                  {
                    text: t('intelligentChat.gdprConfirm') as string || 'Supprimer',
                    style: 'destructive',
                    onPress: runGdprDelete,
                  },
                ],
              );
            })();
          },
        },
      ],
    );
  }, [t, runGdprDelete]);

  const selectSession = useCallback(
    async (sessionId: string) => {
      setSessionsLoading(true);
      try {
        const detail = await intelligentChatService.getYukpoIaSessionDetail(sessionId, { limit: 120 });
        if (!detail?.session?.id) return;
        setActiveSessionId(detail.session.id);
        await SafeStorage.setItem(YUKPO_IA_SESSION_STORAGE_KEY, detail.session.id);
        if (detail.messages?.length) {
          setMessages(detail.messages.map(mapYukpoSessionMessageToChat));
          oldestBeforeRef.current = detail.messages[0]?.created_at ?? null;
          setHasMoreOlder(Boolean(detail.has_more));
        } else {
          const hint =
            (t('intelligentChat.sessionEmpty') as string) ||
            'Session vide — envoyez un message pour continuer.';
          setMessages([
            {
              id: `welcome-${Date.now()}`,
              text: hint,
              isUser: false,
              timestamp: new Date(),
              type: 'text',
            },
          ]);
          oldestBeforeRef.current = null;
          setHasMoreOlder(false);
        }
        setSessionsModalVisible(false);
      } finally {
        setSessionsLoading(false);
      }
    },
    [t],
  );

  const handleActionPress = useCallback((action: any) => {
    if (action.id === 'discover') {
      const discoveryQuery = t('intelligentChat.discoveryQuery') || 'What is Yukpo? Show me all features';
      handleSendMessage(discoveryQuery);
    } else if (
      action.route === 'RechercheBesoin' ||
      action.route === 'ResultatBesoin' ||
      action.id === 'search_services' ||
      action.id === 'yukpo-home-search'
    ) {
      // Depuis l'accueil, la « recherche » = mode 🔍 + focus sur ChatInputMobile (pas l'écran résultats vide).
      try {
        (navigation as any).navigate('MainTabs', { screen: 'Home', params: { focusSearch: true } });
      } catch {
        try {
          (navigation as any).navigate('Home', { focusSearch: true });
        } catch {
          /* ignore */
        }
      }
      handleClose();
    } else if (action.route === 'Home' && action.params?.focusSearch) {
      try {
        (navigation as any).navigate('MainTabs', { screen: 'Home', params: { focusSearch: true } });
      } catch {
        try {
          (navigation as any).navigate('Home', { focusSearch: true });
        } catch {
          /* ignore */
        }
      }
      handleClose();
    } else if (action.route === 'Home' && action.params?.focusCreate) {
      try {
        (navigation as any).navigate('MainTabs', { screen: 'Home', params: { focusCreate: true } });
      } catch {
        try {
          (navigation as any).navigate('Home', { focusCreate: true });
        } catch {
          /* ignore */
        }
      }
      handleClose();
    } else if (
      action.id === 'services' ||
      action.id === 'tab-services' ||
      action.route === 'MesServices' ||
      action.route === 'Services'
    ) {
      navigateToMesServicesHub(navigation as any);
      handleClose();
    } else if (action.route === 'AIHub') {
      (navigation as any).navigate('AIChat');
      handleClose();
    } else if (action.route === 'HashtagDiscovery') {
      // Sans hashtag : l'écran affiche les tendances (plus de spinner infini).
      (navigation as any).navigate('HashtagDiscovery', { hashtag: action.params?.hashtag || '' });
      handleClose();
    } else if (action.route === 'MesProduits') {
      (navigation as any).navigate('MesProduits', action.params || undefined);
      handleClose();
    } else if (action.route) {
      const routeName = typeof action.route === 'string' ? action.route.trim() : '';
      if (!routeName) {
        if (action.label) handleSendMessage(String(action.label));
        return;
      }
      try {
        // @ts-ignore - dynamic route navigation
        if (action.params != null && typeof action.params === 'object') {
          navigation.navigate(routeName, action.params);
        } else {
          navigation.navigate(routeName);
        }
      } catch {
        // @ts-ignore - dynamic route navigation
        navigation.navigate(routeName);
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
    const messageTime = item.timestamp instanceof Date
      ? item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.aiMessage]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <SafeIcon name="bot" size={16} color="#6366f1" />
          </View>
        )}

        <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
          {/* Message bubble */}
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
            {/* Message content with improved formatting */}
            <View style={styles.messageContent}>
              {isUser ? (
                <Text style={[styles.messageText, styles.userText]}>{item.text}</Text>
              ) : (
                <FormattedChatText text={item.text} baseStyle={[styles.messageText, styles.aiText]} />
              )}
            </View>

            {/* User attachments */}
            {isUser && item.userAttachments && item.userAttachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {item.userAttachments.map((att, idx) => {
                  if (att.kind === 'image' && att.data_base64) {
                    const uri = `data:${att.mime || 'image/jpeg'};base64,${att.data_base64}`;
                    return (
                      <Image
                        key={`${item.id}-ua-${idx}`}
                        source={{ uri }}
                        style={styles.userAttachmentImage}
                        resizeMode="cover"
                      />
                    );
                  }
                  if (att.kind === 'audio') {
                    return (
                      <View key={`${item.id}-ua-${idx}`} style={styles.userAttachmentBadge}>
                        <SafeIcon name="mic" size={14} color="#6366f1" />
                        <Text style={styles.userAttachmentBadgeText} numberOfLines={1}>
                          {att.name || 'Audio'}
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View key={`${item.id}-ua-${idx}`} style={styles.userAttachmentBadge}>
                      <SafeIcon name="paperclip" size={14} color="#6366f1" />
                      <Text style={styles.userAttachmentBadgeText} numberOfLines={1}>
                        {att.name || 'Fichier'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Billing info for AI messages */}
            {!isUser && item.metadata?.billing?.enabled && item.metadata?.billing?.tokens_charged > 0 && !item.metadata?.billing?.insufficient_balance && (
              <View style={styles.attachmentsContainer}>
                <Text style={styles.billingChip}>
                  {item.metadata.billing.from_free_quota
                    ? t('yukpoIa.billingNoticeFree', { charged: item.metadata.billing.tokens_charged, remaining: (item.metadata.billing.monthly_free_remaining ?? item.metadata.billing.daily_free_remaining) ?? '?' })
                    : item.metadata.billing.units_from_wallet > 0
                      ? t('yukpoIa.billingNoticePaid', { charged: item.metadata.billing.tokens_charged, balance: item.metadata.billing.balance_after ?? '?' })
                      : t('yukpoIa.billingNoticeGeneric', { charged: item.metadata.billing.tokens_charged })
                      || String(item.metadata.billing.notice)}
                </Text>
              </View>
            )}

            {!isUser && item.attachments && item.attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {item.attachments.map((att) => (
                  <TouchableOpacity
                    key={att.id}
                    style={styles.attachmentChip}
                    onPress={() => void openOrDownloadRemoteFile(att.url, att.filename)}
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
              const { navLinks, otherActions } = orderAndCapAssistantActions(item.suggestedActions, 3);
              return (
                <View style={styles.messageActions}>
                  {otherActions.map((action: any) => (
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

            {!isUser && item.id !== 'welcome' && (
              <View style={styles.assistantMessageFooter}>
                <View style={styles.assistantToolbar}>
                  <TouchableOpacity
                    style={styles.toolbarBtn}
                    onPress={() => openShareForAssistantMessage(item)}
                    accessibilityLabel={t('intelligentChat.shareTitle') as string}
                  >
                    <SafeIcon name="share" size={16} color={modernColors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.toolbarBtn}
                    onPress={() => promptExportAssistantMessage(item)}
                    accessibilityLabel={t('intelligentChat.exportTitle') as string}
                  >
                    <SafeIcon name="download" size={16} color={modernColors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.reactionRow}>
                  <Text style={styles.reactionHint}>{t('intelligentChat.reactions')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.reactionScrollContent}
                    style={styles.reactionScroll}
                  >
                    {REACTION_EMOJIS.map((em) => {
                      const selected = messageReactions[item.id] === em;
                      return (
                        <TouchableOpacity
                          key={`${item.id}-r-${em}`}
                          style={[styles.reactionChip, selected && styles.reactionChipSelected]}
                          onPress={() => toggleMessageReaction(item.id, em)}
                          hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                        >
                          <Text style={styles.reactionEmoji}>{em}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}
          </View>

          <Text style={styles.timestamp}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  }, [t, handleActionPress, handleSendMessage, openShareForAssistantMessage, promptExportAssistantMessage, toggleMessageReaction, messageReactions]);

  return (
    <>
      <Modal visible={visible} animationType="none" transparent presentationStyle="overFullScreen">
        <Animated.View style={[styles.safeArea, { transform: [{ translateY: slideAnim }] }]}>
          <SafeAreaView style={styles.safeArea}>
            <View style={[styles.container, { paddingBottom: keyboardBottomInset }]}>
              <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <SafeIcon name="x" size={22} color={modernColors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent} pointerEvents="box-none">
                  <View style={styles.headerTitleRow}>
                    <View style={styles.headerAiIconWrap}>
                      <SafeIcon name="sparkles" size={18} color="#6366f1" />
                      <View style={styles.headerAiDot} />
                    </View>
                    <Text
                      style={styles.headerTitle}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {t('yukpoIa.brandName') || t('intelligentChat.title') || 'YukpoIA'}
                    </Text>
                  </View>
                  <View style={styles.headerStatusRow}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
                      {humanizeScreenName(screenContext.screenName)}
                    </Text>
                  </View>
                </View>
                <View style={styles.headerRightActions}>
                  <TouchableOpacity
                    onPress={() => void openSessionsModal()}
                    style={styles.headerIconBtn}
                    accessibilityLabel="Conversations"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <SafeIcon name="layers" size={20} color={modernColors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void startNewSession()}
                    style={styles.headerIconBtn}
                    accessibilityLabel="Nouvelle conversation"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <SafeIcon name="plus-circle" size={20} color="#6366f1" />
                  </TouchableOpacity>
                </View>
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
                ListHeaderComponent={
                  loadingOlder ? (
                    <View style={styles.loadOlderWrap}>
                      <ActivityIndicator size="small" color="#6366f1" />
                      <Text style={styles.loadOlderHint}>
                        {t('intelligentChat.loadingOlder') || 'Chargement…'}
                      </Text>
                    </View>
                  ) : null
                }
                ListFooterComponent={loading ? <TypingIndicator /> : null}
                onScroll={onChatScroll}
                scrollEventThrottle={16}
                maintainVisibleContentPosition={
                  Platform.OS === 'web'
                    ? undefined
                    : { minIndexForVisible: 0, autoscrollToTopThreshold: 80 }
                }
                onContentSizeChange={() => {
                  if (prependingOlderRef.current) return;
                  flatListRef.current?.scrollToEnd({ animated: true });
                }}
              />

              {lastFailedMessage && !loading && (
                <TouchableOpacity style={styles.retryBar} onPress={handleRetry}>
                  <SafeIcon name="refresh-cw" size={14} color="#ef4444" />
                  <Text style={styles.retryText}>{t('intelligentChat.retryMessage') || 'Réessayer'}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.inputContainer}>
                {pendingAttachments.length > 0 && (
                  <View style={styles.pendingAttWrap}>
                    <Text style={styles.pendingAttHint}>
                      📎 {pendingAttachments.length} — {t('yukpoIa.billingLabel')}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingAttScroll}>
                      {pendingAttachments.map((att, i) =>
                        att.kind === 'image' && att.data_base64 ? (
                          <Image
                            key={`pend-${i}`}
                            source={{ uri: `data:${att.mime || 'image/jpeg'};base64,${att.data_base64}` }}
                            style={styles.pendingThumb}
                          />
                        ) : (
                          <View key={`pend-${i}`} style={styles.pendingBadge}>
                            <SafeIcon name={att.kind === 'audio' ? 'mic' : 'paperclip'} size={14} color="#6366f1" />
                            <Text numberOfLines={1} style={styles.pendingBadgeTxt}>{att.name || att.kind}</Text>
                          </View>
                        ),
                      )}
                    </ScrollView>
                  </View>
                )}
                <View style={styles.mediaToolbar}>
                  <TouchableOpacity
                    style={styles.mediaToolBtn}
                    onPress={async () => {
                      const a = await pickImageForYukpoIa();
                      if (a) setPendingAttachments((p) => [...p, a]);
                    }}
                    disabled={loading}
                    accessibilityLabel="Galerie"
                  >
                    <SafeIcon name="image" size={20} color="#6366f1" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mediaToolBtn}
                    onPress={async () => {
                      const a = await takePhotoForYukpoIa();
                      if (a) setPendingAttachments((p) => [...p, a]);
                    }}
                    disabled={loading}
                    accessibilityLabel="Prendre une photo"
                  >
                    <SafeIcon name="camera" size={20} color="#6366f1" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mediaToolBtn}
                    onPress={async () => {
                      const a = await pickDocumentForYukpoIa();
                      if (a) setPendingAttachments((p) => [...p, a]);
                    }}
                    disabled={loading}
                  >
                    <SafeIcon name="paperclip" size={20} color="#6366f1" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mediaToolBtn, isRecording && { backgroundColor: '#fee2e2' }]}
                    onPress={async () => {
                      if (isRecording) {
                        const a = await stopAudioRecordingForYukpoIa();
                        setIsRecording(false);
                        if (a) setPendingAttachments((p) => [...p, a]);
                      } else {
                        const ok = await startAudioRecordingForYukpoIa();
                        setIsRecording(ok);
                      }
                    }}
                    onLongPress={() => {
                      if (isRecording) {
                        cancelAudioRecording();
                        setIsRecording(false);
                      }
                    }}
                    disabled={loading}
                  >
                    <SafeIcon name={isRecording ? 'square' : 'mic'} size={20} color={isRecording ? '#dc2626' : '#6366f1'} />
                  </TouchableOpacity>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={t('intelligentChat.placeholder') || 'Posez votre question...'}
                    placeholderTextColor={modernColors.textSecondary}
                    multiline
                    maxLength={4000}
                    editable={!loading}
                    onSubmitEditing={() => handleSendMessage()}
                    returnKeyType="send"
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      ((!inputText.trim() && pendingAttachments.length === 0) || loading) && styles.sendButtonDisabled,
                    ]}
                    onPress={() => handleSendMessage()}
                    disabled={(!inputText.trim() && pendingAttachments.length === 0) || loading}
                  >
                    <SafeIcon name="send" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {sessionsModalVisible ? (
                <View style={styles.sessionsOverlayRoot} pointerEvents="box-none">
                  <Pressable
                    style={StyleSheet.absoluteFillObject}
                    onPress={() => setSessionsModalVisible(false)}
                    accessibilityLabel={t('message.close') as string}
                  />
                  <View style={styles.sessionModalCard}>
                    <Text style={styles.sessionModalTitle}>
                      {t('intelligentChat.sessionsTitle') || 'Conversations YukpoIA'}
                    </Text>
                    <View style={styles.prefsRow}>
                      <Text style={styles.prefsLabel}>
                        {t('intelligentChat.longTermMemory') || 'Mémoire long terme (entre conversations)'}
                      </Text>
                      <Switch
                        value={longTermMemoryEnabled}
                        onValueChange={(v) => {
                          if (v && !longTermMemoryConsentAt) {
                            Alert.alert(
                              (t('intelligentChat.ltmConsentTitle') as string) || 'Mémoire long terme',
                              (t('intelligentChat.ltmConsentBody') as string) ||
                              'Yukpo peut mémoriser des faits utiles entre vos conversations pour personnaliser les réponses. Vous pouvez désactiver cette option à tout moment.',
                              [
                                { text: t('message.cancel') as string, style: 'cancel' },
                                {
                                  text: (t('intelligentChat.ltmConsentAccept') as string) || 'Accepter',
                                  onPress: () => {
                                    void (async () => {
                                      const p = await intelligentChatService.patchYukpoIaPreferences({
                                        long_term_memory_enabled: true,
                                        long_term_memory_consent_acknowledged: true,
                                      });
                                      setLongTermMemoryEnabled(true);
                                      if (p?.long_term_memory_consent_at) {
                                        setLongTermMemoryConsentAt(p.long_term_memory_consent_at);
                                      }
                                    })();
                                  },
                                },
                              ],
                            );
                            return;
                          }
                          setLongTermMemoryEnabled(v);
                          void intelligentChatService.patchYukpoIaPreferences({ long_term_memory_enabled: v });
                        }}
                        trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
                        thumbColor={longTermMemoryEnabled ? '#6366f1' : '#f4f4f5'}
                      />
                    </View>
                    <TouchableOpacity style={styles.gdprBtn} onPress={confirmGdprDelete} accessibilityRole="button">
                      <SafeIcon name="trash-2" size={16} color="#b91c1c" />
                      <Text style={styles.gdprBtnText}>
                        {t('intelligentChat.gdprButton') || 'Effacer mes données YukpoIA (RGPD)'}
                      </Text>
                    </TouchableOpacity>
                    {sessionsLoading ? (
                      <ActivityIndicator color="#6366f1" style={{ marginVertical: 16 }} />
                    ) : (
                      <FlatList
                        data={sessionsList}
                        keyExtractor={(it) => it.id}
                        style={{ maxHeight: SCREEN_HEIGHT * 0.4 }}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                          <Text style={styles.sessionEmptyText}>
                            {t('intelligentChat.noSessions') || 'Aucune session enregistrée.'}
                          </Text>
                        }
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.sessionRow,
                              item.id === activeSessionId && styles.sessionRowActive,
                            ]}
                            onPress={() => void selectSession(item.id)}
                          >
                            <Text style={styles.sessionRowTitle} numberOfLines={2}>
                              {item.title?.trim() || t('intelligentChat.untitledSession') || 'Conversation'}
                            </Text>
                            {item.last_message_at ? (
                              <Text style={styles.sessionRowMeta}>
                                {new Date(item.last_message_at).toLocaleString()}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        )}
                      />
                    )}
                    <TouchableOpacity style={styles.sessionModalClose} onPress={() => setSessionsModalVisible(false)}>
                      <Text style={styles.sessionModalCloseText}>{t('message.close') || 'Fermer'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </Animated.View>
      </Modal>
      <GlobalShareModal
        visible={shareModalVisible}
        onClose={() => {
          setShareModalVisible(false);
          setSharePayload(null);
        }}
        payload={sharePayload}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
    position: 'relative',
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
    minWidth: 0,
    marginHorizontal: 4,
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    zIndex: 20,
    ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
  },
  headerIconBtn: {
    padding: 8,
  },
  sessionsOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 100,
    elevation: 32,
  },
  sessionModalCard: {
    backgroundColor: modernColors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: modernColors.border,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    zIndex: 2,
  },
  sessionModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 8,
  },
  sessionEmptyText: {
    color: modernColors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  sessionRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: modernColors.border,
  },
  sessionRowActive: {
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  sessionRowTitle: {
    fontSize: 15,
    color: modernColors.text,
    fontWeight: '600',
  },
  sessionRowMeta: {
    fontSize: 11,
    color: modernColors.textSecondary,
    marginTop: 4,
  },
  sessionModalClose: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  sessionModalCloseText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  prefsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 4,
    gap: 8,
  },
  prefsLabel: {
    flex: 1,
    fontSize: 13,
    color: modernColors.text,
  },
  gdprBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
  },
  gdprBtnText: {
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
  loadOlderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  loadOlderHint: {
    fontSize: 12,
    color: modernColors.textSecondary,
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
  userAttachmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  userAttachmentImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  userAttachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    gap: 6,
  },
  userAttachmentBadgeText: {
    fontSize: 12,
    color: modernColors.text,
    flex: 1,
  },
  attachmentsContainer: {
    marginTop: 8,
    gap: 6,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: modernColors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: modernColors.border,
    maxWidth: '100%',
  },
  attachmentChipText: {
    flex: 1,
    fontSize: 12,
    color: modernColors.text,
  },
  assistantMessageFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
    gap: 8,
  },
  assistantToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: modernColors.background,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
    maxHeight: 34,
    gap: 4,
  },
  reactionScroll: {
    flex: 1,
    flexGrow: 1,
    maxHeight: 32,
  },
  reactionScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  reactionHint: {
    fontSize: 10,
    color: modernColors.textSecondary,
    marginRight: 2,
    flexShrink: 0,
  },
  reactionChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: modernColors.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionChipSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  reactionEmoji: {
    fontSize: 15,
    lineHeight: 18,
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
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
    backgroundColor: modernColors.card,
    gap: 8,
  },
  pendingAttWrap: {
    gap: 6,
  },
  pendingAttHint: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  pendingAttScroll: {
    maxHeight: 72,
  },
  pendingThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: modernColors.background,
    maxWidth: 160,
    gap: 6,
  },
  pendingBadgeTxt: {
    fontSize: 11,
    color: modernColors.text,
    flex: 1,
  },
  mediaToolbar: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaToolBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: modernColors.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  billingChip: {
    marginTop: 6,
    fontSize: 12,
    color: modernColors.textSecondary,
    fontStyle: 'italic',
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
