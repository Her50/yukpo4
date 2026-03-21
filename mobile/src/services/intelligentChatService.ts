import { ActionDescriptor, ScreenContext } from '../hooks/useScreenContext';
import i18n from '../i18n';
import { apiCall } from './api';

const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type: 'text' | 'action_suggestion' | 'navigation_help' | 'visual_guide';
  suggestedActions?: ActionDescriptor[];
  visualElements?: VisualElement[];
  nextSteps?: string[];
  metadata?: any;
}

export interface VisualElement {
  id: string;
  type: 'button' | 'icon' | 'input' | 'card';
  label: string;
  icon?: string;
  position?: { x: number; y: number };
  description: string;
  action?: ActionDescriptor;
}

export interface ChatResponse {
  message: string;
  type: 'text' | 'action_suggestion' | 'navigation_help' | 'visual_guide';
  suggestedActions?: ActionDescriptor[];
  visualElements?: VisualElement[];
  nextSteps?: string[];
  confidence?: number;
}

class IntelligentChatService {
  private contextCache: Map<string, ScreenContext> = new Map();
  private static readonly MAX_CONTEXT_PROMPT_LENGTH = 9000;

  private isBackendErrorResponse(data: any, rawResponse?: any): boolean {
    const status = Number(data?.status ?? rawResponse?.status ?? 0);
    const success = rawResponse?.success;
    const text = String(data?.message || data?.error || rawResponse?.error || '').toLowerCase();

    if (success === false) return true;
    if (status >= 400) return true;
    if (/(erreur\s*500|internal server error|api openai|erreur de l'?api|api error)/i.test(text)) {
      return true;
    }
    return false;
  }

  private trimPrompt(prompt: string): string {
    if (!prompt) return prompt;
    if (prompt.length <= IntelligentChatService.MAX_CONTEXT_PROMPT_LENGTH) return prompt;
    return `${prompt.slice(0, IntelligentChatService.MAX_CONTEXT_PROMPT_LENGTH)}\n\n[Context truncated for stability]`;
  }

  /**
   * Détecter si l'utilisateur corrige ou recadre une réponse précédente
   */
  private detectCorrectionOrRecadrage(userMessage: string, history: ChatMessage[]): {
    isCorrection: boolean;
    isRecadrage: boolean;
    lastAssistantMessage?: ChatMessage;
    confidence: number;
    emotion?: 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'neutral';
    emotionConfidence: number;
  } {
    const q = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Toujours détecter les émotions, même sans historique
    const emotionResult = this.detectEmotion(q);

    // Pour la correction/recadrage, il faut au moins 2 messages
    const lastAssistantMsg = history.length >= 2
      ? history.slice().reverse().find(m => !m.isUser)
      : undefined;
    if (!lastAssistantMsg) {
      return {
        isCorrection: false, isRecadrage: false, confidence: 0,
        emotion: emotionResult.emotion, emotionConfidence: emotionResult.confidence,
        lastAssistantMessage: undefined,
      };
    }

    // Mots-clés de correction
    const CORRECTION_KEYWORDS = [
      'non', 'pas', 'ce n\'est pas', 'ce nest pas', 'incorrect', 'faux', 'erreur', 'trompé',
      'mauvais', 'c\'est faux', 'ce n\'est pas ça', 'ce n\'est pas cela', 'pas ça',
      'wrong', 'incorrect', 'mistake', 'not right', 'no', 'that\'s wrong', 'incorrect',
      'non, ce n\'est pas', 'non pas', 'ce n\'est pas du tout', 'absolument pas',
      'tu te trompes', 'vous vous trompez', 't\'as tort', 'tu as tort',
      'sorry', 'pardon', 'excuse', 'désolé', 'dommage', 'non non',
    ];

    // Mots-clés de recadrage
    const RECADRAGE_KEYWORDS = [
      'en fait', 'plutôt', 'je voulais dire', 'je veux dire', 'ce que je veux',
      'plus précisément', 'pour être clair', 'clarifions', 'précisons',
      'en réalité', 'en vérité', 'pour info', 'information',
      'actually', 'rather', 'i mean', 'to be clear', 'clarify', 'precisely',
      'let me clarify', 'what i meant was', 'to clarify', 'more specifically',
      'ce que je cherche', 'mon objectif est', 'ce dont j\'ai besoin',
    ];

    const matchCorrection = CORRECTION_KEYWORDS.some(k => q.includes(k));
    const matchRecadrage = RECADRAGE_KEYWORDS.some(k => q.includes(k));

    // Calcul de confiance correction/recadrage
    let confidence = 0;
    if (matchCorrection) confidence += 0.7;
    if (matchRecadrage) confidence += 0.6;
    if (q.match(/^(non|pas|ce n'est|ce nest|wrong|incorrect|no)/)) confidence += 0.3;
    if (q.includes('ta reponse') || q.includes('votre reponse') || q.includes('your answer')) confidence += 0.2;

    return {
      isCorrection: matchCorrection,
      isRecadrage: matchRecadrage,
      lastAssistantMessage: lastAssistantMsg,
      confidence: Math.min(confidence, 1),
      emotion: emotionResult.emotion,
      emotionConfidence: emotionResult.confidence,
    };
  }

  /**
   * Détecter l'émotion dominante dans un texte normalisé (lowercase, sans accents).
   * Retourne l'émotion et un score de confiance [0–1].
   */
  private detectEmotion(normalizedText: string): {
    emotion: 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'neutral';
    confidence: number;
  } {
    const EMOTION_KEYWORDS: Record<string, string[]> = {
      frustration: [
        'frustre', 'enerve', 'agace', 'marre', 'ras le bol', 'ca marche pas', 'incomprehensible',
        'je suis perdu', 'je comprends pas', 'c\'est pas clair', 's\'il vous plait aidez',
        'frustrating', 'annoying', 'confusing', 'i don\'t understand', 'help me', 'nothing works',
        'ca ne marche pas', 'ca fonctionne pas', 'impossible', 'nul', 'horrible',
        'galere', 'c\'est comment', 'on fait comment', 'ca va pas', 'relou', 'chaud', 'c\'est grave',
      ],
      gratitude: [
        'merci', 'bravo', 'genial', 'parfait', 'excellent', 'bien fait', 'helpful',
        'c\'est gentil', 'je vous remercie', 'merci beaucoup', 'awesome', 'great', 'thank you',
        'thanks', 'perfect', 'well done', 'appreciate', 'formidable', 'magnifique',
        'chapeau', 'top', 'nickel', 'impeccable',
        'dieu merci', 'walahi', 'trop fort', 'c\'est bon', 'la force', 'on est ensemble',
      ],
      confusion: [
        'je comprends pas', 'c\'est pas clair', 'comment faire', 'perdu', 'ou trouver',
        'je ne vois pas', 'expliquez moi', 'i don\'t get it',
        'how to', 'where is', 'explain', 'unclear', 'confused', 'c\'est quoi',
        'je suis confus', 'pas compris', 'pas clair',
        'je capte pas', 'j\'ai pas compris', 'c\'est flou', 'ca veut dire quoi',
      ],
      excitement: [
        'genial', 'wow', 'incroyable', 'fantastique', 'trop bien', 'excellent',
        'amazing', 'fantastic', 'cool', 'awesome', 'love it', 'wahou',
        'enorme', 'dingue', 'ouf', 'exceptionnel',
        'c\'est chaud', 'grave bien', 'trop trop bien', 'la classe', 'magique',
      ],
    };

    let bestEmotion: 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'neutral' = 'neutral';
    let bestScore = 0;

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      const matches = keywords.filter(k => normalizedText.includes(k)).length;
      if (matches > bestScore) {
        bestScore = matches;
        bestEmotion = emotion as any;
      }
    }

    return { emotion: bestEmotion, confidence: Math.min(bestScore * 0.3, 1) };
  }

  /**
   * Générer un préfixe émotionnel adapté au sentiment détecté dans le message
   * Couvre: correction, recadrage, frustration, gratitude, confusion, excitement, follow-up
   */
  private generateEmotionalPrefix(
    sentiment: 'correction' | 'recadrage' | 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'follow_up' | 'neutral',
    lang: string
  ): string {
    if (sentiment === 'neutral') return '';
    const activeLang = lang || 'fr';

    const prefixes: Record<string, Record<string, string[]>> = {
      fr: {
        correction: [
          "Toutes mes excuses, vous avez raison. ",
          "Merci pour la correction, j'étais dans l'erreur. ",
          "Vous avez tout à fait raison, désolé pour la confusion. ",
          "Au temps pour moi, merci de m'avoir corrigé. ",
          "Effectivement, je me suis trompé. Merci pour votre précision. ",
        ],
        recadrage: [
          "Je vois mieux maintenant ce que vous cherchez. ",
          "Merci pour cette précision, c'est plus clair. ",
          "Ah je comprends mieux votre besoin. ",
          "Merci de clarifier, je vais ajuster ma réponse. ",
          "C'est plus clair maintenant, laissez-moi vous aider correctement. ",
        ],
        frustration: [
          "Je comprends votre frustration et je m'en excuse. Reprenons calmement. ",
          "Désolé pour le désagrément, je vais faire mieux. ",
          "Je vois que ce n'est pas clair, prenons les choses étape par étape. ",
          "Pardon pour la confusion. Laissez-moi simplifier. ",
          "Je comprends que c'est agaçant, je vais être plus précis cette fois. ",
        ],
        gratitude: [
          "Merci beaucoup, ça me fait plaisir d'aider ! 😊 ",
          "C'est gentil ! Ravi de pouvoir vous accompagner. ",
          "Merci pour vos encouragements ! N'hésitez pas à me solliciter. ",
          "Content que ça vous aide ! ",
          "Avec plaisir ! Je suis là pour ça. 😊 ",
        ],
        confusion: [
          "Pas de souci, je vais réexpliquer plus simplement. ",
          "C'est normal, laissez-moi détailler étape par étape. ",
          "Je vais essayer d'être plus clair cette fois. ",
          "Bonne question ! Voici comment ça fonctionne. ",
          "Je comprends la confusion. Voici une explication simplifiée. ",
        ],
        excitement: [
          "Super, vous avez raison d'être enthousiaste ! 🎉 ",
          "Génial ! Content de voir votre enthousiasme ! ",
          "C'est effectivement impressionnant ! ",
          "Trop bien, n'est-ce pas ? 😄 ",
          "Oui c'est une fonctionnalité vraiment top ! ",
        ],
        follow_up: [
          "Pour revenir sur ce dont on parlait, ",
          "Suite à notre échange précédent, ",
          "En continuant sur le même sujet, ",
          "Pour approfondir ce point, ",
          "Bonne question de suivi ! ",
        ],
      },
      en: {
        correction: [
          "My apologies, you're absolutely right. ",
          "Thank you for the correction, I was mistaken. ",
          "You're completely right, sorry for the confusion. ",
          "My mistake, thank you for correcting me. ",
          "Indeed, I got that wrong. Thanks for your precision. ",
        ],
        recadrage: [
          "I see better now what you're looking for. ",
          "Thank you for this clarification, it's much clearer. ",
          "Ah, I better understand your need now. ",
          "Thanks for clarifying, let me adjust my response. ",
          "It's clearer now, let me help you properly. ",
        ],
        frustration: [
          "I understand your frustration, and I apologize. Let's go step by step. ",
          "Sorry about the inconvenience, I'll do better. ",
          "I see it's not clear, let me simplify things. ",
          "My apologies for the confusion. Let me break it down. ",
          "I get that it's frustrating, I'll be more precise this time. ",
        ],
        gratitude: [
          "Thank you so much, happy to help! 😊 ",
          "That's kind of you! Glad I could help. ",
          "Thanks for the kind words! Don't hesitate to ask more. ",
          "Glad that was helpful! ",
          "My pleasure! That's what I'm here for. 😊 ",
        ],
        confusion: [
          "No worries, let me explain it more simply. ",
          "That's totally normal, let me walk you through it step by step. ",
          "I'll try to be clearer this time. ",
          "Great question! Here's how it works. ",
          "I understand the confusion. Here's a simpler explanation. ",
        ],
        excitement: [
          "Awesome, right?! 🎉 ",
          "Great to see your enthusiasm! ",
          "It's really impressive, isn't it? ",
          "I know, it's amazing! 😄 ",
          "Yes, that feature is truly fantastic! ",
        ],
        follow_up: [
          "Going back to what we were discussing, ",
          "Following up on our previous exchange, ",
          "To continue on the same topic, ",
          "To dig deeper on that point, ",
          "Great follow-up question! ",
        ],
      },
    };

    const langPrefixes = prefixes[activeLang] || prefixes.fr;
    const pool = langPrefixes[sentiment] || [];
    if (pool.length === 0) return '';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Construire un résumé compact des messages précédents pour donner
   * de la mémoire à l'IA au-delà de la fenêtre glissante de 5 messages.
   * Format court pour ne pas gonfler le prompt.
   */
  private buildConversationSummary(history: ChatMessage[]): string {
    if (history.length <= 6) return '';

    const olderMessages = history.slice(0, -5);
    const topics = new Set<string>();
    const userQuestions: string[] = [];

    for (const msg of olderMessages) {
      if (msg.isUser) {
        const shortText = msg.text.length > 80
          ? msg.text.substring(0, 80) + '...'
          : msg.text;
        userQuestions.push(shortText);

        const q = msg.text.toLowerCase();
        if (q.includes('prix') || q.includes('price') || q.includes('coût') || q.includes('tarif')) topics.add('pricing');
        if (q.includes('comment') || q.includes('how')) topics.add('how-to');
        if (q.includes('pourquoi') || q.includes('why')) topics.add('explanation');
        if (q.includes('itinéraire') || q.includes('route') || q.includes('gps')) topics.add('navigation');
        if (q.includes('livraison') || q.includes('delivery')) topics.add('delivery');
        if (q.includes('produit') || q.includes('product')) topics.add('products');
        if (q.includes('paiement') || q.includes('payment') || q.includes('wallet')) topics.add('payment');
      }
    }

    const parts: string[] = [];
    if (topics.size > 0) {
      parts.push(`Topics discussed earlier: ${Array.from(topics).join(', ')}`);
    }
    if (userQuestions.length > 0) {
      const recent3 = userQuestions.slice(-3);
      parts.push(`Earlier user questions: ${recent3.map(q => `"${q}"`).join(' → ')}`);
    }

    return parts.length > 0
      ? `\nCONVERSATION MEMORY (older messages summary):\n${parts.join('\n')}\n`
      : '';
  }

  /**
   * Détecter si l'utilisateur demande à approfondir ou continuer un sujet précédent
   */
  private detectFollowUp(userMessage: string, history: ChatMessage[]): boolean {
    if (history.length < 2) return false;
    const q = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const FOLLOW_UP_KEYWORDS = [
      'et aussi', 'de plus', 'en plus', 'encore', 'aussi', 'donne moi plus',
      'plus de details', 'approfondi', 'approfondis', 'continue', 'vas-y',
      'detaille', 'detailles', 'explique encore', 'dis m\'en plus', 'elabore',
      'par rapport a', 'concernant', 'a propos de', 'sur ce point', 'reviens sur',
      'and also', 'furthermore', 'moreover', 'tell me more', 'go on',
      'elaborate', 'more details', 'expand on', 'about that', 'regarding',
      'can you explain more', 'what about', 'how about',
      'tu disais', 'vous disiez', 'comme tu as dit', 'comme vous avez dit',
      'you mentioned', 'you said', 'as you said', 'going back to',
    ];

    return FOLLOW_UP_KEYWORDS.some(k => q.includes(k));
  }

  /**
   * Générer une réponse contextuelle basée sur l'écran courant
   */
  async generateContextualResponse(
    userMessage: string,
    screenContext: ScreenContext,
    conversationHistory: ChatMessage[] = [],
    lang?: string,
  ): Promise<ChatResponse> {
    try {
      const activeLang = lang || i18n.language || 'fr';

      // ═══ 1. Analyse sentimentale complète du message ═══
      const correction = this.detectCorrectionOrRecadrage(userMessage, conversationHistory);
      const isFollowUp = this.detectFollowUp(userMessage, conversationHistory);

      // Déterminer le sentiment dominant pour le préfixe émotionnel
      let dominantSentiment: 'correction' | 'recadrage' | 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'follow_up' | 'neutral' = 'neutral';
      if (correction.confidence > 0.6 && correction.isCorrection) {
        dominantSentiment = 'correction';
      } else if (correction.confidence > 0.6 && correction.isRecadrage) {
        dominantSentiment = 'recadrage';
      } else if (correction.emotionConfidence > 0.2 && correction.emotion && correction.emotion !== 'neutral') {
        dominantSentiment = correction.emotion;
      } else if (isFollowUp) {
        dominantSentiment = 'follow_up';
      }

      // ═══ 2. Générer le préfixe émotionnel (excuses, remerciements, empathie…) ═══
      const emotionalPrefix = this.generateEmotionalPrefix(dominantSentiment, activeLang);

      // Le message envoyé au backend inclut le préfixe pour guider le ton de la réponse
      const contextualUserMessage = emotionalPrefix
        ? `[ASSISTANT_TONE_PREFIX: ${emotionalPrefix.trim()}]\n${userMessage}`
        : userMessage;

      console.log('[IntelligentChat] Sentiment analysis:', {
        dominant: dominantSentiment,
        correctionConf: correction.confidence,
        emotion: correction.emotion,
        emotionConf: correction.emotionConfidence,
        isFollowUp,
        prefix: emotionalPrefix.trim() || '(none)',
      });

      // ═══ 3. Construire la mémoire conversationnelle (résumé des anciens messages) ═══
      const conversationSummary = this.buildConversationSummary(conversationHistory);

      // ═══ 4. Construire le contexte complet pour l'IA ═══
      const contextPrompt = this.trimPrompt(
        this.buildContextPrompt(screenContext, conversationHistory, lang, userMessage),
      );

      const requestType = this.detectRequestType(userMessage, screenContext);

      // Backend (Rust) exposes AI routes without the `/api` prefix: POST /ai/chat
      // No retry on /ai/chat: avoids rapid duplicate failures when backend returns 500.
      let response = await apiCall<any>(
        '/ai/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            message: contextualUserMessage,
            context: {
              screen: screenContext.screenName,
              screen_type: screenContext.screenType,
              available_actions: (Array.isArray(screenContext.availableActions) ? screenContext.availableActions : []).map(a => a.label).slice(0, 10),
              visible_elements: (Array.isArray(screenContext.visibleElements) ? screenContext.visibleElements : []).map(e => e.label).slice(0, 8),
              user_role: screenContext.userData?.role || 'guest',
              service_data: screenContext.serviceData || null,
              context_prompt: contextPrompt,
              conversation_summary: conversationSummary || undefined,
              conversation_history: conversationHistory.slice(-8).map(m => ({
                role: m.isUser ? 'user' : 'assistant',
                content: m.text,
              })),
              sentiment_context: {
                dominant_sentiment: dominantSentiment,
                is_correction: correction.isCorrection,
                is_recadrage: correction.isRecadrage,
                correction_confidence: correction.confidence,
                emotion: correction.emotion,
                emotion_confidence: correction.emotionConfidence,
                is_follow_up: isFollowUp,
                emotional_prefix: emotionalPrefix.trim() || null,
                last_assistant_message: correction.lastAssistantMessage?.text || null,
                conversation_turn_count: conversationHistory.length,
              },
            },
            type: requestType,
            language: activeLang,
          }),
        },
        false,
      );

      const data = response?.data || response;
      if (this.isBackendErrorResponse(data, response)) {
        console.warn('[IntelligentChat] Backend AI error detected, using local fallback', {
          status: data?.status ?? response?.status,
          message: data?.message ?? response?.error,
        });
        return this.generateEmotionalLocalFallback(userMessage, screenContext, dominantSentiment, activeLang);
      }

      if (data?.message) {
        const parsed = this.parseAIResponse(data, screenContext);
        // Ne PAS doubler le préfixe : le backend reçoit déjà le tone hint via
        // [ASSISTANT_TONE_PREFIX] et le sentiment_context — il intègre le ton
        // dans sa réponse. On ne prépend que si la réponse est très courte
        // (fallback basique sans ton) et que le sentiment est fort.
        if (
          emotionalPrefix &&
          parsed.message &&
          dominantSentiment !== 'neutral' &&
          dominantSentiment !== 'follow_up' &&
          parsed.message.length < 60 &&
          !parsed.message.startsWith(emotionalPrefix.trim().substring(0, 8))
        ) {
          parsed.message = emotionalPrefix + parsed.message;
        }
        return parsed;
      }

      return this.generateEmotionalLocalFallback(userMessage, screenContext, dominantSentiment, activeLang);
    } catch (error) {
      console.error('[IntelligentChat] Erreur génération réponse:', error);
      return this.generateEmotionalLocalFallback(userMessage, screenContext, 'neutral', lang || i18n.language || 'fr');
    }
  }

  /**
   * Fallback local enrichi avec intelligence émotionnelle.
   * Préfixe la réponse du fallback classique avec le ton adapté au sentiment.
   */
  private generateEmotionalLocalFallback(
    userMessage: string,
    screenContext: ScreenContext,
    sentiment: 'correction' | 'recadrage' | 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'follow_up' | 'neutral',
    lang: string,
  ): ChatResponse {
    const baseFallback = this.generateLocalFallback(userMessage, screenContext, lang);
    const prefix = this.generateEmotionalPrefix(sentiment, lang);

    if (prefix && baseFallback.message) {
      baseFallback.message = prefix + baseFallback.message;
    }

    return baseFallback;
  }

  private detectRequestType(userMessage: string, context: ScreenContext): string {
    const q = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const NAV_KEYWORDS = [
      'aller', 'acceder', 'ou est', 'comment aller', 'navigate', 'go to', 'open',
      'ouvrir', 'where is', 'como ir', 'wohin', 'nenda', 'ina', 'zuwa',
    ];
    const ACTION_KEYWORDS = [
      'cliquer', 'appuyer', 'bouton', 'comment faire', 'click', 'tap', 'button',
      'how to', 'press', 'como hacer', 'wie', 'bonyeza', 'tekan',
    ];
    const HELP_KEYWORDS = [
      'aide', 'comment', 'expliquer', 'presenter', 'help', 'how', 'explain',
      'what is', 'c\'est quoi', 'ayuda', 'hilfe', 'msaada', 'taimako',
    ];
    const SEARCH_KEYWORDS = [
      'trouver', 'chercher', 'recherche', 'find', 'search', 'look for',
      'buscar', 'suchen', 'tafuta', 'nemo',
    ];
    const CREATE_KEYWORDS = [
      'creer', 'ajouter', 'nouveau', 'publier', 'create', 'add', 'new', 'publish',
      'crear', 'erstellen', 'unda', 'kirkiro',
    ];

    const matchAny = (kws: string[]) => kws.some(k => q.includes(k));

    if (matchAny(NAV_KEYWORDS)) return 'navigation';
    if (matchAny(ACTION_KEYWORDS)) return 'action_guide';
    if (matchAny(HELP_KEYWORDS)) return 'help';
    if (matchAny(SEARCH_KEYWORDS)) return 'search';
    if (matchAny(CREATE_KEYWORDS)) return 'creation';

    return 'general';
  }

  /**
   * Construire le prompt de contexte pour l'IA
   */
  private buildContextPrompt(screenContext: ScreenContext, history: ChatMessage[], lang?: string, userMessage?: string): string {
    const { screenName, screenType, userData, serviceData, guideText } = screenContext;
    const availableActions = Array.isArray(screenContext.availableActions) ? screenContext.availableActions : [];
    const visibleElements = Array.isArray(screenContext.visibleElements) ? screenContext.visibleElements : [];

    const activeLang = lang || i18n.language || 'fr';
    const langInstr = `MANDATORY: Respond ONLY in the user's language (code: ${activeLang}). Adapt tone and expressions to that language/culture.`;
    const userRole = userData?.role || 'guest';
    const userName = userData?.name || userData?.email?.split('@')[0] || '';

    // Résumé mémoire conversationnelle (messages au-delà de la fenêtre glissante)
    const conversationMemory = this.buildConversationSummary(history);

    // Nombre de tours de conversation pour adapter le ton
    const turnCount = history.length;
    const conversationPhase = turnCount === 0 ? 'first_message'
      : turnCount <= 2 ? 'opening'
        : turnCount <= 8 ? 'mid_conversation'
          : 'long_conversation';

    // Instructions de continuité conversationnelle
    const continuityInstructions = `
CONVERSATION CONTINUITY & EMOTIONAL INTELLIGENCE:

1. MEMORY & CONTEXT:
- This is turn #${turnCount + 1} of the conversation (phase: ${conversationPhase})
- ALWAYS reference and build upon previous exchanges — never answer as if this is the first message
- If user references something discussed earlier, acknowledge it ("Comme on en parlait...", "Pour revenir à votre question sur...")
- When the conversation is long (8+ turns), periodically summarize what was covered to show you remember
${conversationMemory}

2. CORRECTION & RECADRAGE HANDLING:
- If user corrects you: START with a sincere apology, THEN give the corrected answer. Never skip the apology.
- If user recadrages: START with acknowledgment ("Je comprends mieux..."), THEN adjust
- NEVER repeat the same wrong information after being corrected
- If uncertain after correction, ask a clarifying question rather than guessing again

3. EMOTIONAL RESPONSE (adapt tone to user sentiment):
- **Frustration/Anger** ("frustré", "marre", "ça marche pas", "incompréhensible"): 
  → Acknowledge feelings, apologize sincerely, simplify into numbered steps, offer specific action
- **Gratitude/Compliments** ("merci", "bravo", "super", "génial", "parfait", "excellent"):
  → Respond warmly, show genuine appreciation, encourage further exploration of features
- **Confusion** ("je comprends pas", "c'est pas clair", "perdu", "comment"):
  → Empathize, re-explain with numbered steps, use analogies, offer to break down further
- **Excitement** ("wow!", "incroyable", "trop bien", "génial!"):
  → Match their enthusiasm, share energy, suggest related amazing features
- **Follow-up** ("et aussi", "dis m'en plus", "détaille", "continue", "approfondi"):
  → Acknowledge continuity ("Pour approfondir ce point..."), expand without repeating what was said
- **Neutral**: respond naturally with your warm Yukpo Assistant personality

4. TONE PROGRESSION:
- First message: welcoming, introduce yourself briefly
- Opening (turns 1-2): helpful, set expectations
- Mid-conversation (turns 3-8): more familiar, reference previous answers, deeper details
- Long conversation (8+): conversational, use "on" / "nous" / "we", summarize progress

5. EXAMPLES:
User: "Non, ce n'est pas ça"
→ "Toutes mes excuses, je comprends mieux maintenant. Ce que vous cherchez est..."

User: "Merci beaucoup!"
→ "Avec plaisir ! 😊 Si vous voulez explorer d'autres fonctionnalités, je suis là."

User: "Je comprends rien, c'est trop compliqué"
→ "Je comprends votre frustration, et je m'en excuse. Reprenons étape par étape : 1. ..."

User: "Dis m'en plus sur ce dont on parlait"
→ "Bonne question de suivi ! Pour approfondir ce qu'on disait sur [topic]..."

User: "Wow c'est génial cette fonctionnalité!"
→ "Content que ça vous plaise ! 🎉 Et vous n'avez pas encore vu [related feature]..."
`;

    const onNavigationScreen = screenName === 'Navigation';
    const onProductHubScreen = screenName === 'Services' || screenName === 'MesServices';
    const onMesProduitsScreen = screenName === 'MesProduits';
    const onBookExchangeHome = screenName === 'LivreScolaireHome' || screenName === 'BourseLivre';
    const onTicketVoyageHome = screenName === 'TicketVoyageHome';
    const onBusTicketSearch = screenName === 'BusTicketSearch';
    const onCovoiturageHome = screenName === 'CovoiturageHome';
    const onTaxiHome = screenName === 'TaxiHome';
    const onSupermarketHome = screenName === 'SupermarketHome';
    const onOffresEmploiHome = screenName === 'OffresEmploiHome';
    const onOffresEmploiHub = screenName === 'OffresEmploiHub';

    const normalizePartnerTypeEmploi = (pt: string | undefined) =>
      String(pt || '')
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '');
    const isPartnerEmployerEmploi =
      userRole === 'partenaire' &&
      ['offreemploi', 'offresemploi', 'recruteur', 'employeur'].includes(
        normalizePartnerTypeEmploi(userData?.partner_type)
      );

    const onBloodTransfusionScreen =
      screenName === 'BanqueSangSearch' ||
      screenName === 'BanqueSangList' ||
      screenName === 'BanqueSangDetails' ||
      screenName === 'BloodBankDetails' ||
      screenName === 'BloodDonation' ||
      screenName === 'BloodDonationRequest' ||
      screenName === 'BloodDonationMatches' ||
      screenName === 'MyBloodDonations' ||
      screenName === 'BanqueSangForm' ||
      screenName === 'BloodGroupManagement';

    const onLaboratoryModule =
      screenName === 'LaboratoireSearch' ||
      screenName === 'LaboratoireList' ||
      screenName === 'LaboratoireDetails' ||
      screenName === 'LaboratoireHome' ||
      screenName === 'LaboratoireForm' ||
      screenName === 'MyLabExaminations' ||
      screenName === 'LabAnalytics' ||
      screenName === 'LabAIAnalysis';

    /** Partenaire agence de voyage : dashboard **AgenceVoyageForm** + scan QR ouvert depuis l’onglet Tickets */
    const onTravelAgencyPartnerModule =
      screenName === 'AgenceVoyageForm' || screenName === 'BusTicketQRScanner';

    const onCourierDashboard = screenName === 'CourierDashboard';
    const onDeliveryOrderModule =
      screenName === 'DeliveryHome' ||
      screenName === 'DeliveryParcelFlowNew' ||
      screenName === 'DeliveryShoppingFlowNew' ||
      screenName === 'ShoppingBasket' ||
      screenName === 'ShoppingBudget' ||
      screenName === 'ShoppingSummary' ||
      screenName === 'DeliveryShoppingTracking' ||
      screenName === 'DeliveryProof';
    const onFleetDashboard = screenName === 'FleetDashboard';
    /** Partenaire **automobile** (stock véhicules / annonces) — **≠** **FleetDashboard** (coursiers). */
    const onAutomobilePartnerDashboard = screenName === 'AutomobileDashboard';
    const onAutoServicesSearch = screenName === 'AutoServicesSearch';
    const onAutoServicesResults = screenName === 'AutoServicesResults';
    const onAutoMarketplaceModule = onAutoServicesSearch || onAutoServicesResults;

    const mobilityDriverValidated = (ud: any, role: string): boolean => {
      const pt = String(ud?.partner_type || '').toLowerCase().trim();
      const ds = String(ud?.driver_status || '').toLowerCase();
      return (
        role === 'driver' ||
        ud?.is_driver === true ||
        ds === 'validated' ||
        ds === 'approved' ||
        (role === 'partenaire' && ['chauffeur', 'taxi', 'covoiturage'].includes(pt))
      );
    };

    const onHealthServicesHubScreen =
      screenName === 'HealthServicesHub' || screenName === 'MedicalServicesList';

    /** Flux patient / RDV / fiches — **sans** le dashboard partenaire **HopitalForm** (traité à part). */
    const onHospitalModule =
      screenName === 'HopitalHome' ||
      screenName === 'HopitalSearch' ||
      screenName === 'HopitalList' ||
      screenName === 'HopitalDetails' ||
      screenName === 'BookAppointment' ||
      screenName === 'MyConsultations' ||
      screenName === 'HospitalAIRecommendations' ||
      screenName === 'HospitalAnalytics';

    const onHospitalPartnerDashboard = screenName === 'HopitalForm';

    const onPharmacyModule =
      screenName === 'PharmacieHome' ||
      screenName === 'PharmacieSearch' ||
      screenName === 'PharmacieList' ||
      screenName === 'PharmacieDetails' ||
      screenName === 'PharmacieForm' ||
      screenName === 'MyPharmacyOrders' ||
      screenName === 'PharmacyAnalytics' ||
      screenName === 'PharmacyAIInteractions';

    /** Résultats recherche Yukpo globale — **ResultatBesoinScreen** ; **RechercheBesoin** = même composant (alias navigateur). */
    const onSearchResultsScreen = screenName === 'ResultatBesoin' || screenName === 'RechercheBesoin';

    const onImmobilierModule =
      screenName === 'ImmobilierHome' ||
      screenName === 'ImmobilierSearch' ||
      screenName === 'ImmobilierList' ||
      screenName === 'ImmobilierDetails' ||
      screenName === 'ImmobilierForm' ||
      screenName === 'ImmobilierBooking' ||
      screenName === 'ImmobilierCompare' ||
      screenName === 'ImmobilierPriceAlerts' ||
      screenName === 'HotelMeubleHome' ||
      screenName === 'HotelSearch' ||
      screenName === 'MeubleSearch' ||
      screenName === 'HotelBooking' ||
      screenName === 'HotelDashboard';

    /** Plan menus / recettes / liste de courses (module « menu alimentaire » Yukpo). */
    const onMenuPlanningModule =
      screenName === 'MenuPlanningHub' ||
      screenName === 'MenuWeekCalendar' ||
      screenName === 'ShoppingList' ||
      screenName === 'FamilyProfile' ||
      screenName === 'RecipeSearch';

    /** Parcours élève / famille — **sans** **OrientationPartnerDashboard** (traité à part). Inclut alias navigateur + **CreateEtablissement** (partagé avec partenaires). */
    const ORIENTATION_STUDENT_ROUTE_NAMES = new Set([
      'OrientationScolaireHub',
      'OrientationScolaireHome',
      'ProfilEtudiant',
      'OrientationAIProfileAnalysis',
      'OrientationAIRecommendations',
      'OrientationAIComparePrograms',
      'EtablissementSearch',
      'EtablissementDetails',
      'ProgrammesScolaires',
      'ProgrammesList',
      'ConcoursEntree',
      'ConcoursList',
      'ConferencesLives',
      'ConferencesList',
      'FournituresScolaires',
      'FournituresList',
      'ExperiencesEtudiants',
      'ExperiencesList',
      'CreateEtablissement',
    ]);
    const onOrientationStudentModule = ORIENTATION_STUDENT_ROUTE_NAMES.has(screenName);
    const onOrientationPartnerDashboard = screenName === 'OrientationPartnerDashboard';

    const yukpoCatalogBlock = onNavigationScreen
      ? `YUKPO (brief reminder only — detailed UI is in NAVIGATION_GPS_DETAIL below):
Yukpo is the all-in-one super-app (health, transport, delivery, jobs, education, wallet, e‑commerce…). The user is on the **Navigation GPS** module right now; answer using that module's real controls, not generic assumptions.`
      : onProductHubScreen
        ? `YUKPO (brief reminder only — detailed UI is in MES_SERVICES_PRODUCT_HUB_DETAIL below):
Yukpo is the all-in-one super-app for commerce, services, wallet, delivery, video, promos… The user is on **Mes services / Produits** (prestataire). Answer with the **real buttons and flows of this hub**, not a generic tour of the whole app.`
        : onMesProduitsScreen
          ? `YUKPO (brief reminder only — detailed UI is in MES_PRODUITS_DETAIL below):
Yukpo connects sellers and buyers. The user is on **Mes produits** (catalog management). Prioritize **MES_PRODUITS_DETAIL** over generic Yukpo marketing.`
          : onBookExchangeHome
            ? `YUKPO (brief reminder only — detailed UI is in BOURSE_DU_LIVRE_HOME_DETAIL below):
Yukpo is the all-in-one super-app (health, education, wallet, delivery, e‑commerce…). The user is on the **Bourse du Livre home** (**LivreScolaireHomeScreen**, routes **LivreScolaireHome** or **BourseLivre**). Prioritize **BOURSE_DU_LIVRE_HOME_DETAIL**; **do not** describe the deprecated **BourseLivreScreen** (search bar + filter panel + purple "Recommandations IA" header buttons) as the current UI.`
            : onTicketVoyageHome
              ? `YUKPO (brief reminder only — detailed UI is in TICKET_VOYAGE_HOME_DETAIL below):
Transport & voyage. The user is on **TicketVoyageHome** (**TicketVoyageHomeScreen**): bus ticket search with **LocationSelector**, **busTicketService.searchBusTickets**, tri & filtres. Prioritize **TICKET_VOYAGE_HOME_DETAIL** — not a generic “all transport” pitch.`
              : onBusTicketSearch
                ? `YUKPO (brief reminder only — detailed UI is in BUS_TICKET_SEARCH_DETAIL below):
The user is on **BusTicketSearch** (**BusTicketSearchScreen**): **CityAutocomplete** + **GET /api/bus-tickets/search** + filtres **SearchFilters**. This is a **different** layout from **TicketVoyageHome**; do not merge the two.`
                : onCovoiturageHome
                  ? `YUKPO (brief reminder only — detailed UI is in COVOITURAGE_HOME_DETAIL below):
Mobility — **covoiturage**. The user is on **CovoiturageHome** (**CovoiturageHomeScreen**). Prioritize **COVOITURAGE_HOME_DETAIL** (LocationSelector, **covoiturageService.searchCovoiturages**, publish → **CovoiturageForm**).`
                  : onTaxiHome
                    ? `YUKPO (brief reminder only — detailed UI is in TAXI_HOME_DETAIL below):
Mobility — **taxi**. The user is on **TaxiHome** (**TaxiHomeScreen**). Prioritize **TAXI_HOME_DETAIL** (GPS pré-rempli au départ, reco IA, prédiction demande, **taxiService.searchTaxis**).`
                    : onSupermarketHome
                      ? `YUKPO (brief reminder only — detailed UI is in SUPERMARKET_HOME_DETAIL below):
Supermarchés & catalogue. The user is on **SupermarketHome** (**SupermarketHomeScreen**): 4 modes (magasins, produits, comparer, promos) via **supermarketService** / **GET /api/services/nearby**. Prioritize **SUPERMARKET_HOME_DETAIL**. **No** in-screen navigation to **MenuPlanningHub** or **DeliveryShoppingFlowNew** — mention them only as **other Yukpo modules** if the user asks.`
                      : onOffresEmploiHome
                        ? `YUKPO (brief reminder only — detailed UI is in OFFRES_EMPLOI_HOME_DETAIL below):
Emploi — **recherche d’emploi** (vue candidat). The user is on **OffresEmploiHome** (**OffresEmploiHomeScreen**). Prioritize **OFFRES_EMPLOI_HOME_DETAIL** (\`offreEmploiService.searchOffres\`, matching, raccourcis vers **AICVAnalysis** / **AISalaryPrediction** / **AISuggestFormations**).`
                        : onOffresEmploiHub
                          ? `YUKPO (brief reminder only — detailed UI is in OFFRES_EMPLOI_HUB_DETAIL below):
Emploi — **hub** (**OffresEmploiHub** / **OffresEmploiHubScreen**): dashboard stats + actions (employeur vs candidat). Prioritize **OFFRES_EMPLOI_HUB_DETAIL**.`
                          : onBloodTransfusionScreen
                            ? `YUKPO (brief reminder only — detailed UI is in BLOOD_TRANSFUSION_MODULE_DETAIL below):
Santé — **banque de sang / transfusion / don**. The user is in the **blood transfusion module**. Prioritize **BLOOD_TRANSFUSION_MODULE_DETAIL**; do not substitute a generic “health app” pitch.`
                            : onLaboratoryModule
                              ? `YUKPO (brief reminder only — detailed UI is in LABORATORY_MODULE_DETAIL below):
Santé — **laboratoires d’analyses & imagerie**. The user is in the **laboratory vertical**. Prioritize **LABORATORY_MODULE_DETAIL**; do not describe **Pharmacie** or **Hôpital** flows unless the user explicitly asks to switch.`
                              : onTravelAgencyPartnerModule
                                ? `YUKPO (brief reminder only — detailed UI is in TRAVEL_AGENCY_PARTNER_DETAIL below):
Transport — **dashboard partenaire agence de voyage** (**AgenceVoyageForm**) ou **scanner QR bus** (**BusTicketQRScanner**). Prioritize **TRAVEL_AGENCY_PARTNER_DETAIL**; do not describe **TicketVoyageHome** / **BusTicketSearch** (flux **client** billet) sauf si l’utilisateur demande explicitement l’entrée voyageur.`
                                : onCourierDashboard
                                  ? `YUKPO (brief reminder only — detailed UI is in COURIER_DASHBOARD_DETAIL below):
Livraison — **coursier individuel** (**CourierDashboard** / **CourierDashboardScreen**) : livraisons actives, stats API, sous-dashboard **Bourse du livre** coursier. Prioritize **COURIER_DASHBOARD_DETAIL**; **ne pas** décrire **FleetDashboard** (gérant de flotte) sauf demande explicite.`
                                  : onDeliveryOrderModule
                                    ? `YUKPO (brief reminder only — detailed UI is in DELIVERY_ORDER_MODULE_DETAIL below):
Livraison — **commande et suivi** (colis / courses). The user is in a delivery ordering/tracking screen. Prioritize **DELIVERY_ORDER_MODULE_DETAIL** with real steps and practical guidance.`
                                    : onFleetDashboard
                                      ? `YUKPO (brief reminder only — detailed UI is in FLEET_PARTNER_DASHBOARD_DETAIL below):
Livraison & mobilité — **dashboard partenaire gérant une flotte** (**FleetDashboard** / **FleetDashboardScreen**) : entreprises de **livraison**, **transport**, **chauffeurs**, **déménagement**, **courses marché** (types **getPartnerDashboardScreen**). Prioritize **FLEET_PARTNER_DASHBOARD_DETAIL**; **ne pas** décrire **CourierDashboard** (coursier **solo** / livraisons actives) sauf demande explicite.`
                                      : onAutomobilePartnerDashboard
                                        ? `YUKPO (brief reminder only — detailed UI is in AUTOMOBILE_PARTNER_DASHBOARD_DETAIL below):
Automobile — **dashboard partenaire véhicules** (**AutomobileDashboard**) : **GET /api/specialized-services/user?type=automobile** ; ajout = **Alert** → formulaire intelligent. Prioritize **AUTOMOBILE_PARTNER_DASHBOARD_DETAIL**; **ne pas** confondre avec **AutoServicesSearch** (client) ni **FleetDashboard** (coursiers).`
                                        : onAutoMarketplaceModule
                                          ? `YUKPO (brief reminder only — detailed UI is in AUTO_MARKETPLACE_MODULE_DETAIL below):
Automobile — **catalogue client** (**AutoServicesSearch** / **AutoServicesResults**) : **GET /api/auto/filters** + **GET /api/auto/search**. Prioritize **AUTO_MARKETPLACE_MODULE_DETAIL**; UI **véhicule** ; **pièces** via **q** ou règles SQL backend — pas d’onglet pièces dédié.`
                                          : onHealthServicesHubScreen
                                            ? `YUKPO (brief reminder only — detailed UI is in HEALTH_SERVICES_HUB_DETAIL below):
Cross-health **launcher** (pharmacy, hospital, lab, blood bank) + unified search. Prioritize **HEALTH_SERVICES_HUB_DETAIL**; do not collapse to one vertical.`
                                            : onHospitalPartnerDashboard
                                              ? `YUKPO (brief reminder only — detailed UI is in HOSPITAL_PARTNER_DASHBOARD_DETAIL below):
Santé — **dashboard partenaire hôpital / clinique** (**HopitalForm**). Prioritize **HOSPITAL_PARTNER_DASHBOARD_DETAIL**; do not describe **HopitalHome** / **HopitalSearch** (parcours **patient**) sauf demande explicite.`
                                              : onHospitalModule
                                                ? `YUKPO (brief reminder only — detailed UI is in HOSPITAL_MODULE_DETAIL below):
Hospitals & clinics — **patient**: **HopitalHome**, **HopitalSearch**, **HopitalList**, **HopitalDetails**, **BookAppointment**, **MyConsultations**, **HospitalAIRecommendations**, **HospitalAnalytics**. Prioritize **HOSPITAL_MODULE_DETAIL**.`
                                                : onMenuPlanningModule
                                                  ? `YUKPO (brief reminder only — detailed UI is in MENU_PLANNING_MODULE_DETAIL below):
Alimentation & foyer — **menus IA, profil famille, calendrier, liste de courses** (**MenuPlanningHub** et écrans liés). Prioritize **MENU_PLANNING_MODULE_DETAIL**; **do not** describe **SupermarketHome** (retail catalog) as this module.`
                                                  : onOrientationPartnerDashboard
                                                    ? `YUKPO (brief reminder only — detailed UI is in ORIENTATION_PARTNER_DASHBOARD_DETAIL below):
Éducation — **dashboard partenaire établissement scolaire** (**OrientationPartnerDashboard**). Prioritize **ORIENTATION_PARTNER_DASHBOARD_DETAIL**; **ne pas** confondre avec **OrientationScolaireHub** / **OrientationScolaireHome** (parcours **élève / famille**).`
                                                    : onOrientationStudentModule
                                                      ? `YUKPO (brief reminder only — detailed UI is in ORIENTATION_SCOLAIRE_MODULE_DETAIL below):
Éducation — **orientation scolaire** (élève / famille) : hub, catalogue, profil, IA. Prioritize **ORIENTATION_SCOLAIRE_MODULE_DETAIL**; **ne pas** décrire **OrientationPartnerDashboard** sauf demande explicite.`
                                                      : onPharmacyModule
                                                        ? `YUKPO (brief reminder only — detailed UI is in PHARMACY_MODULE_DETAIL below):
Santé Yukpo couvre pharmacies, hôpitaux, laboratoires… L'utilisateur est dans le **module Pharmacie** (catalogue produits et/ou fiches officines). Prioritize **PHARMACY_MODULE_DETAIL**; do not replace it with a generic super-app pitch.`
                                                        : onSearchResultsScreen
                                                          ? `YUKPO (brief reminder only — detailed UI is in RESULTAT_BESOIN_DETAIL below):
Global **AI search results** (**ResultatBesoinScreen**). Stack routes **ResultatBesoin** and **RechercheBesoin** point to the **same** screen. Prioritize **RESULTAT_BESOIN_DETAIL**; **do not** describe a dedicated **map of results** on this screen, and **do not** claim **ServiceDetail** as the default card tap target (cards open **PrestataireBoutique**).`
                                                          : `YUKPO — THE DIGITAL REVOLUTION:
Yukpo is the FIRST all-in-one super-app that digitalizes daily life across Africa and beyond:
• 🏥 Health: Pharmacies (stock search, ordering), Hospitals (AI triage, appointments), Labs, Blood banks
• 🏨 Real Estate: Hotels, furnished rentals, property management with AI pricing
• 🚗 Transport: Taxi (AI dynamic pricing), Carpooling, Bus tickets (seat selection, QR boarding)
• 📦 Delivery: Parcels, grocery shopping, fleet management, real-time tracking
• 💼 Jobs: AI CV analysis, salary prediction, training suggestions, smart matching
• 🎓 Education: School orientation AI, book exchange (Bourse du Livre with AI matching & trocchains)
• 🗺️ Smart Navigation: GPS with voice guidance, speed cameras, POI, community alerts, **in-app walking stats & Coach IA**
• 🎬 Video: AI video creation, ads, lives
• 🛒 E-commerce: Products, negotiations, promotions, comparisons
• 🍽️ Menu Planning: AI meal plans, recipes, shopping lists
• 💰 Wallet: Multi-method payments (MTN MoMo, Orange Money, Wave, Visa, PayPal...), bonuses
• And much more: Insurance, Supermarkets, Restaurants, Travel agencies...`;

    let prompt = `${langInstr}
${continuityInstructions}

You are **Yukpo Assistant** — the intelligent concierge of Yukpo, a revolutionary all-in-one digital platform for Africa and the world.

YOUR PERSONALITY:
- You are warm, enthusiastic and professional — like a knowledgeable friend who LOVES what Yukpo offers
- Your answers are CONCISE (2-4 sentences max), IMPACTFUL and designed to make users want to explore
- Use a marketing-savvy tone: highlight VALUE and BENEFITS, not just features
- When presenting Yukpo's services, convey the REVOLUTION: "First platform to digitize X in Africa", "AI-powered", "Unique in the market"
- Use short, punchy sentences. No walls of text. Think of each response as a mini pitch.
- Add relevant emojis sparingly for visual appeal (1-3 per response max)
${onNavigationScreen ? `
NAVIGATION_SCREEN_MODE:
- **Prioritize** the NAVIGATION_GPS_DETAIL block below over any generic service list.
- Walking / fitness / performance / calories / "stats" questions: Yukpo shows them **inside this screen** (Statistics & Coach IA + free walk). **Do not** push third-party fitness apps unless the user explicitly asks for external alternatives.
` : ''}
${onProductHubScreen ? `
MES_SERVICES_HUB_MODE:
- **Prioritize** MES_SERVICES_PRODUCT_HUB_DETAIL below over generic Yukpo lists.
- **Critical naming:** the **modern** product hub is **MesServicesScreen**, reached via pile route **MesServices** or bottom tab **Services** (same component). Route pile **ServicesActivity** = legacy **ServicesScreen** (“Mon activité”) — **do not** present it as the main “Mes services” experience.
` : ''}
${onMesProduitsScreen ? `
MES_PRODUITS_MODE:
- **Prioritize** MES_PRODUITS_DETAIL below. This screen is the **dense product catalog**; the tab hub **Services** / **MesServices** is the **summary** view with cards and quick actions.
` : ''}
${onBookExchangeHome ? `
BOURSE_DU_LIVRE_HOME_MODE:
- **Prioritize** **BOURSE_DU_LIVRE_HOME_DETAIL** below over generic Yukpo education bullets or the legacy **BourseLivreScreen** story.
- The live home UI is **LivreScolaireHomeScreen** (stack names **LivreScolaireHome** or **BourseLivre** — same component).
` : ''}
${onTicketVoyageHome ? `
TICKET_VOYAGE_HOME_MODE:
- **Prioritize** **TICKET_VOYAGE_HOME_DETAIL** below.
- Distinguish from **BusTicketSearch** (autocomplete villes + autre API client).
` : ''}
${onBusTicketSearch ? `
BUS_TICKET_SEARCH_MODE:
- **Prioritize** **BUS_TICKET_SEARCH_DETAIL** below.
- Do not describe **TicketVoyageHome** (LocationSelector compact header) as this screen.
` : ''}
${onCovoiturageHome ? `
COVOITURAGE_HOME_MODE:
- **Prioritize** **COVOITURAGE_HOME_DETAIL** below over generic “carpool app” talk.
- Publishing a trip uses **CovoiturageForm** from the header when chauffeur validé — not a separate stack route **CovoiturageSearch** on this home.
` : ''}
${onTaxiHome ? `
TAXI_HOME_MODE:
- **Prioritize** **TAXI_HOME_DETAIL** below.
- Before first search, the list shows **IA recommendations** + **demand prediction** when GPS + user id exist.
` : ''}
${onSupermarketHome ? `
SUPERMARKET_HOME_MODE:
- **Prioritize** **SUPERMARKET_HOME_DETAIL** below.
- **Produits / Comparer / Promos** tabs exist in code but are **hidden** until the user selects a supermarket — only **Magasins** is shown first.
- Store list load requires **GPS** (\`LocationContext\` coords); no in-screen links to **MenuPlanningHub** or **DeliveryShoppingFlowNew**.
` : ''}
${onOffresEmploiHome ? `
OFFRES_EMPLOI_HOME_MODE:
- **Prioritize** **OFFRES_EMPLOI_HOME_DETAIL** below.
- Liste principale = **GET /api/offres-emploi/search** via \`offreEmploiService.searchOffres\` (pas l’écran **OffreSearch** — celui-ci est un formulaire de filtres → **OffreList**).
- Filtres **CDI/CDD/Stage/Freelance** sur l’accueil = **filtrage client** sur la page déjà chargée ; signets = **état local** (\`Set\`), pas une API persistante dans ce fichier.
` : ''}
${onOffresEmploiHub ? `
OFFRES_EMPLOI_HUB_MODE:
- **Prioritize** **OFFRES_EMPLOI_HUB_DETAIL** below.
- L’UI **employeur** s’affiche si \`partner_type\` recruteur (normalisé : \`offre_emploi\`, \`offreemploi\`, \`recruteur\`, \`employeur\`) **ou** si l’app détecte des offres déjà publiées (\`getMesOffres\` / stats) — le chat ne voit pas toujours cette seconde condition.
` : ''}
${onBloodTransfusionScreen ? `
BLOOD_TRANSFUSION_MODULE_MODE:
- **Prioritize** **BLOOD_TRANSFUSION_MODULE_DETAIL** below.
- **Medical safety:** Yukpo = information & logistics — **never** replace **SAMU / urgences** ; saignement vital → **appeler les secours** tout de suite.
- **BloodDonation** (hub donneur + mur des demandes) ≠ **BloodDonationRequest** (formulaire **publier** une demande).
` : ''}
${onTravelAgencyPartnerModule ? `
TRAVEL_AGENCY_PARTNER_MODE:
- **Prioritize** **TRAVEL_AGENCY_PARTNER_DETAIL** below.
- **Scope:** outils **prestataire** (fiche agence, horaires lignes, produits bus Yukpo, tickets vendus, embarquement) — pas le parcours **achat** billet (**TicketVoyageHome** / **BusTicketSearch**).
- **IA conseils** dashboard = **POST** \`/ai/chat\` avec \`context: 'travel_agency_partner_dashboard'\` — recommandations business, pas un contrat de résultat.
` : ''}
${onCourierDashboard ? `
COURIER_DASHBOARD_MODE:
- **Prioritize** **COURIER_DASHBOARD_DETAIL** below.
- **Stats « détaillées »** = **Alert** avec chiffres déjà en mémoire (**pas** de route dédiée).
- **Livraisons** : suivi = **DeliveryShoppingTracking** ; code vérif prestataire = **CourierVerificationCode** (par \`deliveryId\`).
- **Bourse du livre (coursier)** : **BookCourierSubDashboard** + **bourseLivreV2Api** — distinct des livraisons **deliveryApi**.
` : ''}
${onDeliveryOrderModule ? `
DELIVERY_ORDER_MODULE_MODE:
- **Prioritize** **DELIVERY_ORDER_MODULE_DETAIL** below over generic Yukpo lists.
- Explain concrete steps the user can execute now (pickup/dropoff, basket, budget, confirmation, tracking).
- If user asks benefits, highlight: gain de temps, délégation des courses, suivi temps réel, contact coursier, preuve de livraison.
` : ''}
${onFleetDashboard ? `
FLEET_PARTNER_DASHBOARD_MODE:
- **Prioritize** **FLEET_PARTNER_DASHBOARD_DETAIL** below.
- **Métier:** **gérant / entreprise** avec **plusieurs coursiers ou chauffeurs** — stats agrégées, **validation des candidatures**, **suspendre / réactiver** des comptes. **≠** coursier **individuel** (**CourierDashboard** : livraisons actives, suivi, sous-dashboard livres).
- **Entrée:** **PartnerDashboardTab** → **getPartnerDashboardScreen** (**AppNavigator.optimized.tsx**) → **FleetDashboard** pour **chauffeur**, **fleet**, **livraison**, **livraison_courses_marche**, **demenagement**, **transport**.
- **Libellé sous-titre:** **fleetLabel** = map **PARTNER_TYPE_LABELS** dans **FleetDashboardScreen** (**Chauffeurs**, **Coursiers Livraison**, **Coursiers Marche**, **Equipe Demenagement**, **Transporteurs**) ou **« Flotte »** si le type n’y figure pas (**cas \`partner_type === 'fleet'\`** : route **FleetDashboard** mais clé absente de **PARTNER_TYPE_LABELS**).
- **Onglets:** **Apercu** (orthographe fichier) | **{fleetLabel}** | **Candidatures** (badge **rouge** si candidatures en attente) | **Analytics** (données **locales**).
- **APIs:** **GET** \`/api/partners/me/fleet/stats\`, **/couriers**, **/applications?status=\`submitted|approved|rejected|all\`** ; **POST** \`.../applications/{id}/approve\` (\`{}\`), **reject** (\`reason\` optionnel), **couriers/{id}/toggle** \`{ action: 'suspend' | 'activate' }\`.
- **Hors scope écran:** pas de **GET /api/deliveries/active**, pas de **DeliveryShoppingTracking** depuis ce dashboard.
` : ''}
${onAutomobilePartnerDashboard ? `
AUTOMOBILE_PARTNER_DASHBOARD_MODE:
- **Prioritize** **AUTOMOBILE_PARTNER_DASHBOARD_DETAIL** below.
- **Données** : **GET** \`/api/specialized-services/user?type=automobile\` → annonces **véhicules** du partenaire ; **pas** de CRUD inline (bouton ajout = **Alert** → formulaire intelligent).
- **Pièces détachées** : publication **e-commerce** (**catégorie \`pieces_auto\`**, **catalogue produits** / **formulaire intelligent**) — **pas** ce dashboard ; peuvent toutefois apparaître dans **/api/auto/search** si le **service** correspond aux règles backend (**pièces auto**, etc.).
` : ''}
${onAutoMarketplaceModule ? `
AUTO_MARKETPLACE_MODULE_MODE:
- **Prioritize** **AUTO_MARKETPLACE_MODULE_DETAIL** below (sections **Search** vs **Results** selon l’écran).
- **Filtres** : **GET** \`/api/auto/filters\` ; résultats : **GET** \`/api/auto/search\` (**pagination** \`page\`, \`limit\` 20).
- **Pièces / accessoires** : pas d’onglet « pièces » dédié dans l’UI — recherche texte **\`q\`** + produits dont catégorie service / produit matche l’auto (backend inclut **pièces auto** dans certains **LIKE**).
- **Limite connue** : **ville / quartier** saisis sur **AutoServicesSearch** ne sont **pas** envoyés dans la query **/api/auto/search** par **AutoServicesResultsScreen** (le **backend** **AutoSearchQuery** n’expose pas non plus \`ville\` / \`quartier\` en query) — le **géofiltre** utile = **GPS + rayon**.
` : ''}
${onHospitalPartnerDashboard ? `
HOSPITAL_PARTNER_DASHBOARD_MODE:
- **Prioritize** **HOSPITAL_PARTNER_DASHBOARD_DETAIL** below.
- **Scope:** **prestataire** établissement de santé (fiche, créneaux/prestations, stats internes, équipe) — pas la recherche patient (**HopitalList** / **HopitalDetails**).
- **Urgence réelle:** l’app **ne remplace pas** le **15 / SAMU** ; l’IA (**HospitalAIRecommendations**) = aide à l’orientation, **pas** diagnostic.
` : ''}
${onHealthServicesHubScreen ? `
HEALTH_SERVICES_HUB_MODE:
- **Prioritize** **HEALTH_SERVICES_HUB_DETAIL** below. Cover **all** hub entry points (pharmacy, hospital, lab, blood bank) + unified search + duty pharmacy, not a single service.
` : ''}
${onHospitalModule ? `
HOSPITAL_MODULE_MODE:
- **Prioritize** **HOSPITAL_MODULE_DETAIL** below over generic “all health” marketing.
- **Emergency safety:** in-app IA / wait times are **not** a substitute for **real emergencies** — use official emergency numbers; hub exposes **119** quick call where implemented.
` : ''}
${onMenuPlanningModule ? `
MENU_PLANNING_MODULE_MODE:
- **Prioritize** **MENU_PLANNING_MODULE_DETAIL** below over generic “meal app” talk.
- **Health / nutrition:** IA + profils = **aide à la planification** — **not** a substitute for a **dietitian or doctor** for medical diets, severe allergies, or therapeutic nutrition; encourage professional advice when in doubt.
- **MenuWeekCalendar** expects **\`route.params.menu\`** (\`WeeklyMenu\`). If the user sees endless “Chargement du menu…”, they likely opened the calendar **without** that object (e.g. history row from the Hub only passes \`weekStart\` today).
` : ''}
${onOrientationPartnerDashboard ? `
ORIENTATION_PARTNER_DASHBOARD_MODE:
- **Prioritize** **ORIENTATION_PARTNER_DASHBOARD_DETAIL** below.
- **Métier:** gestionnaire d’**établissement scolaire** partenaire — **pas** le parcours recherche élève (**EtablissementSearch**).
` : ''}
${onOrientationStudentModule ? `
ORIENTATION_SCOLAIRE_MODULE_MODE:
- **Prioritize** **ORIENTATION_SCOLAIRE_MODULE_DETAIL** below over generic “education app” bullets.
- **IA orientation:** aide à la réflexion — **pas** décision d’inscription, pas substitut à un **conseiller d’orientation** ou à l’administration d’un établissement ; en cas de doute médical / handicap scolaire, orienter vers des professionnels.
- **Deux familles d’API:** catalogue **\`/api/orientation-scolaire/*\`** vs profil / IA **\`/api/orientation/*\`** (voir détail).
` : ''}
${onPharmacyModule ? `
PHARMACY_MODULE_MODE:
- **Prioritize** PHARMACY_MODULE_DETAIL below over generic health marketing bullets.
- **Medical safety:** IA = information / education only — **never** replace a clinician; for dosage, emergencies, pregnancy, children, or serious illness, direct to **doctor or pharmacist**.
` : ''}
${screenName === 'LaboratoireForm' ? `
LABORATOIRE_PARTNER_DASHBOARD_MODE:
- **Prioritize** **LABORATOIRE_PARTNER_DASHBOARD_DETAIL** below (after LABORATORY_MODULE_DETAIL) over generic **client** lab search/booking story.
- **LaboratoireFormScreen** = **prestataire** (dashboard + fiche service) **ou** parcours **création** sans dashboard ; ne pas décrire **LaboratoireList** / **LaboratoireDetails** comme cet écran.
- **Catalogue examens (modal)** : dans le code actuel, ajout/édition = **état local uniquement** — **pas** d’appel API de persistance dans le handler du modal ; dire clairement si l’utilisateur demande « sauvegarder les examens ».
- **Medical / IA:** analyse IA des résultats = **LabAIAnalysis** côté **patient** (\`examinationId\`) ; le bouton **IA Analyse** du dashboard = **Alert** pédagogique seulement.
` : ''}
${onImmobilierModule ? `
IMMOBILIER_MODULE_MODE:
- **Prioritize** IMMOBILIER_MODULE_DETAIL below over generic Yukpo service lists.
- **Distinguish flows:** **ImmobilierHome** quick “Visite” uses an **in-place Alert + bookVisit** (fixed slot), while **ImmobilierDetails** opens **ImmobilierBooking** or **HotelBooking** for hôtel/meublé — do not merge them.
- **IA disclaimer:** price estimates and investment text are **indicative**, not legal/financial advice.
` : ''}
${yukpoCatalogBlock}

CURRENT SCREEN: "${screenName}" (type: ${screenType})
USER: ${userRole}${userName ? ` (${userName})` : ''}

SCREEN GUIDE: ${guideText || 'Management screen.'}

VISIBLE ELEMENTS ON SCREEN:
${visibleElements.map(el => `- [${el.type}] "${el.label}" ${el.icon ? `(icon: ${el.icon})` : ''} ${el.actionable ? '✅ actionable' : ''}`).join('\n')}

AVAILABLE ACTIONS (the user can do these right now):
${availableActions.map(action => `- "${action.label}" → ${action.description || action.route || 'action'} (icon: ${action.icon})`).join('\n')}
`;

    if (screenName === 'Navigation') {
      prompt += `

=== NAVIGATION_GPS_DETAIL (authoritative — follow this for every answer on this screen) ===

**What this screen is:** Intelligent GPS inside Yukpo: route planning, live/off-app tracking hooks, **community alerts** (radars, controls, hazards), **POI** along the route, **token/wallet** debits for some features, **Statistics & Coach IA** (distance, sessions, calories, duration, health score, streaks, badges, tips, CO₂/fuel savings, challenges, records, habits), and **free walk** GPS sessions.

**Payment Model (IMPORTANT - many features are PAID):**
- **Free period:** Until March 31, 2026 - ALL navigation features are FREE
- **After free period:** Micro-payment system with tokens/wallet debits
- **PAID features:** POI search (170-510 XAF per category), route search (35 XAF), community alerts per unique checkpoint (100 XAF), AI Coach (10 XAF per request), coaching monthly subscription (1000 XAF)
- **FREE features:** Route calculation, security/police POI, activity statistics, CO₂ tracking, gamification, checkpoint reporting
- **Trial offers:** 7-day free trial for coaching subscription, 3 unpaid uses allowed before suspension
- **Currency:** Prices adapt to user's location (XAF, XOF, EUR, USD, etc.)

**Header (top):**
- **Left — compass / navigation emoji button (🧭):** acts as **Back**. If the user opened **Statistics & Coach IA** or **Alert history**, the first tap closes that panel and returns to the main navigation UI; from the main UI it leaves the Navigation screen. Subtitle under the title shows the current mode (smart routes, tracking, free walk, stats, alerts).
- **Right — small icon buttons (Lucide-style in app, often shown with emoji in marketing copy):**
  1. **Walking / running emoji (🚶 / 🏃) + optional green dot:** **Free walk**. Starts a GPS walking session when idle. **While free walk is active**, tapping opens **statistics** with **free-walk / filtered session** context (distance, time, speed, comparisons).
  2. **AlertTriangle:** **Community alerts** panel (history list, badge count). Users can **confirm / dispute** alerts and open **comments** per alert. **Note:** Accessing alert history costs 35 XAF after free period.
  3. **BarChart3** (histogram icon in header): **ACCESS #1 to Statistics & Coach IA**. Opens the full fitness/activity dashboard. When stats are open the icon becomes a Compass to return to map.
  4. **Car + Users composite icon:** shortcut to **Covoiturage** (Yukpo carpool).

**ACCESS #2 to Statistics & Coach IA:** The **Coach IA FAB** (floating button at bottom-right of the screen, only visible when not in stats/alerts panels). Tapping it opens the AI assistant chat, but from the main scroll, the **Score Santé & Coach IA** preview card (when logged in) also opens the stats dashboard directly.

**Below header:** **Balance / free-navigation period** chip — tap to **recharge Navigation tokens**.

**═══ STATISTICS & FITNESS DASHBOARD (detailed — used for ALL stats-related answers) ═══**

The dashboard is a scrollable panel replacing the map. It is opened via **BarChart3 icon** (header) OR via the **Coach IA preview card** on the main scroll.

**Period filter** (top bar, left chip — tap to open modal):
- **Aujourd'hui** (Today): shows only today's activities. Ideal right after a free walk to see the session in context of the day. Automatically selected when a free walk ends.
- **Semaine** (Week): current rolling 7 days — default period.
- **Mois** (Month): current calendar month.
- **Trimestre** (Quarter): last 3 months.
- **Semestre** (Semester): last 6 months.
- **Année** (Year): last 12 months.

**Modality filter** (top bar, right chip — tap to open modal):
- **Tout combiné** (All combined): aggregates ALL travel modes (walking + cycling + transit + driving + auto-detected). Shows breakdown by mode, best session, performance trend, CO₂ saved, top visited places, favorite POI types.
- **Détection auto** (Auto detection): shows ONLY passively auto-detected activities (background movement tracking). Useful to see how much the user moves without explicitly starting a session.
- **Marche libre** (Free walk): shows ONLY free walk sessions. Useful to track walking fitness progress specifically. When active, the dashboard highlights walking-specific metrics and comparisons.

**How to read each stats section (guide for users):**
1. **Summary tiles** (top): 📏 total km | 🏃 total sessions | 🔥 total calories | ⏱ total minutes — these are aggregates for the selected period + modality.
2. **Filtered free-walk session card** (only after stopping a free walk): shows the time window of the session just completed, with **3 comparison chips**: "vs dernière" (vs last walk), "vs 2 dernières" (vs average of last 2), "vs ce mois" (vs monthly average). Each metric (distance, duration, calories) shows a **% delta** with ↑ green (improvement) or ↓ red (decline) or → grey (stable).
3. **Évolution détaillée** (Detailed evolution table — only after stopping a free walk): a 4-column table: metric name | 🏃 **Actuelle** (current session) | ⏪ **Dernière** (last recorded walk) | 🏅 **Record** (best session ever). Shows distance, duration, quality with exact values + % gap for each. If the current session beats the record → 🎉 **"Nouveau record de distance !"** banner.
4. **Best session** 🏅 (only in "All combined" mode): the single best session in the period — date, distance, duration, quality score. Tag 🚶 if it was a free walk.
5. **By travel mode** 🚀 (only in "All combined"): breakdown per mode (🚶 walk, 🚲 bike, 🚌 transit, 🚗 car) with session count + total km.
6. **Performance & progression** 🌿 (only in "All combined"): compares recent half of the period vs previous half — shows % improvement/decline in distance. Also shows **estimated CO₂ saved** from walking/cycling.
7. **Share button** 📤: generates a text message with all stats + evolution comparisons (if after a free walk) + gap to best session + Yukpo download link. Easy to share via WhatsApp, SMS, etc.
8. **Top visited places** 📍 (only in "All combined"): ranked list of most visited locations with visit count. 🏆/🥈/🥉 for top 3.
9. **Coach IA** section: 🫀 Health score (/100 with breakdown: activity, quality, streak, eco), AI tips, gamification (streak 🔥, record 🏆, points ⭐, badges), challenges, personal records, habitual routes, fuel/CO₂ savings, coaching notification history.

**Free walk end-of-session experience:**
When the user taps **"Arrêter la marche"** (stop button):
1. The session is saved to the server.
2. The stats dashboard opens **automatically** with period set to **"Aujourd'hui"** and modality set to **"Marche libre"**.
3. The filtered session card appears with comparisons vs last walk.
4. The **detailed evolution table** shows current vs last vs best with % gaps.
5. A **TTS audio recap** plays immediately (in the user's language): announces distance, duration, calories, then compares vs last walk (±% distance, ±% calories), and announces gap to best session or congratulates on a new record. The audio is contextual and motivational.
6. The **share button** is prominent for sharing the performance with contacts.

**Main navigation UI (when not in stats/alerts-only panels):**
- **"Signaler une alerte"** row (chevron): expands **horizontal chips** to **report** checkpoint types (radar, police/control, accident, etc.). **Note:** Reporting alerts is FREE, but accessing community alerts history costs 35 XAF.
- **Destination / origin inputs** (LocationSelector), **Search route** / primary CTA (may trigger micro-payment of 35 XAF after free period).
- **Favorite places** chips, **travel mode** row (driving, walking, transit, bicycle), **route preferences** chips (avoid tolls/highways…).
- **Waypoints** list, **recalculate** route.
- **Route cards:** distance, duration, traffic level, optional fare; select one, **share route**, **Open in Maps** (Google Maps / Apple Plans) — user can return to Yukpo for alerts/coach.
- **Map** area (preview / tracking), **POI category** selector: Health 🏥, Food 🍞, Fuel ⛽, Finance/Bank & ATM 🏧, Auto & parking 🚗, Religion 🕌, Hotel 🏨, Security 🚔 — **Each selected category costs 170-510 XAF** after free period (Health: 340 XAF, Food: 510 XAF, Fuel: 170 XAF, Finance: 170 XAF, Auto: 510 XAF, Religion: 340 XAF, Hotel: 170 XAF, Security: FREE). Results can be added as **waypoints** (+).
- **Free walk** panel when session active: live **km**, **minutes**, **speed**, controls to end session.
- **Off-route / deviation** banner: tap to **recalculate**.

**Chat quick actions (bottom of Assistant IA modal):**
- **Retour** often uses a **help-circle / question style icon in the UI** but means **navigate back** in the app (e.g. Home) — not "destination entry".
- **Recherche** = Yukpo **global service search** (RechercheBesoin), **not** the blue **route search** button on this screen.

**Hard rules:**
- Questions about **walking performance, stats, calories, health score, VO2-style insights, progression, streaks, badges, Coach IA**: guide the user to **Statistics & Coach IA** via either the **BarChart3 icon in the header** (ACCESS #1) or the **Coach IA preview card** on the main scroll (ACCESS #2). Mention **period filter** (Aujourd'hui for recent, Semaine for weekly view, etc.) and **modality filter** (Marche libre for walking-only stats, Tout combiné for full overview, Détection auto for passive tracking). **Never** claim Yukpo has no walking stats here.
- When explaining **how to read stats**: explain that ↑ green = improvement, ↓ red = decline, → grey = stable. The **% deltas** compare the current value against the baseline (last walk, average of last 2, or monthly average depending on selected comparison chip). The **evolution table** (after a free walk) shows 3 columns: current session, last recorded walk, all-time best — with % gap to each.
- When explaining **free walk flow**: mention the automatic dashboard opening, the TTS audio recap, and the share feature. Emphasize that the user doesn't need to navigate anywhere — it all opens automatically.
- Questions about **notifications / sound / Coach IA reminders**: **Settings → Notifications** (Coach IA section) and optional **home bell** history for per-type mute — use the dedicated action if present.
- **Pricing transparency:** Always mention costs when suggesting PAID features after March 31, 2026. Be clear about what's FREE vs PAID.
- **Free period reminder:** Until March 31, 2026, mention that ALL features are currently free as a special offer.
- **Coaching subscription:** AI Coach requests cost 10 XAF each after free period, or 1000 XAF/month for unlimited access with 7-day free trial.
- **Suspension policy:** After 3 unpaid uses, features may be suspended until debt is paid.
- **Currency adaptation:** Prices automatically convert to user's local currency (XAF, XOF, EUR, USD, etc.).
`;
    }

    if (onProductHubScreen) {
      prompt += `

=== MES_SERVICES_PRODUCT_HUB_DETAIL (authoritative — MesServicesScreen, routes **Services** tab or **MesServices** stack) ===

**What this screen is:** Prestataire hub to manage **products/offers** tied to **GET /api/prestataire/services**, with **ServiceCardModern** list, **stats** (totals, actifs, inactifs, vues), **filters** (Tous / Actif / Inactif), **pull to refresh**, and **DeviceEventEmitter** refresh on \`service:refresh\`, \`product:created\`, \`product:updated\`.

**Header / bandeau:**
- **Menu ☰ (SidebarNavigation):** création produit, galerie médias, équipe (par service), stats, mes pubs, nouvelle pub, création vidéo, flash promo, promos actives, live, analytiques vidéo, réglages, rafraîchir — aligné sur les entrées du menu latéral dans le code.
- **Boutons + rapides:** intro **vidéo**, **Flash promo** (sélection produits → CreateFlashPromo), **livraison globale** (sélection → GlobalDeliveryConfigModal), **sélection multiple** + barre d’actions bulk (activer/désactiver/supprimer).
- **Ajouter un produit:** si un service existe → **formulaire d'ajout rapide avec suggestions IA** ; sinon → **formulaire intelligent complet** pour créer votre activité et vos produits.
- **Fil d’Ariane / accueil:** retour **Home** selon UI.

**Cartes produit (ServiceCardModern):** modifier fiche service (**formulaire intelligent complet**), promos (flash / promotion), **partage** (lien yukpomnang.com/service/{id}), **activer/désactiver** (coût éventuel réactivation **jetons** / solde — messaging UI), **suppression** (bloquée côté API si plusieurs produits selon règles métier).

**Pied de liste / cartes vides:** accès **catalogue détaillé produits**, **statistiques avancées**, **retour accueil**.

**Hard rules:**
- To open this hub from code or deep links, use **MesServices** or the tab **Services**, **never** confuse with **ServicesActivity** (legacy ServicesScreen).
- If the user asks “où sont mes produits / gérer catalogue”, describe **this** screen + mention **MesProduits** as the **advanced** list view.
`;
    }

    if (onMesProduitsScreen) {
      prompt += `

=== MES_PRODUITS_DETAIL (authoritative — MesProduitsScreen) ===

**Role:** Detailed **product catalog** for the prestataire: **NavigatorToolbar** titre « Produits », **mini stats** horizontales, **filtres** Tous / Actifs / En pause, liste de **cartes** avec actions.

**Header:** **+** → création (**AjouterProduitSimple** ou **FormulaireYukpoIntelligent** selon contexte) ; **graphique** → **ProductStats** global ; **⋮** → menu modal : **Créer une vidéo**, **Galerie médias** (ServiceMediaGallery), **Mes Publicités** → PubliciteDashboard, **Flash Promo** → CreateFlashPromo (produit actif), **Promo Black Friday** → GlobalPromoSubmission, **Configuration livraison** (premier produit filtré) → ProductDeliveryConfigModal, **Gérer les membres** → ServiceTeamManager modal, **Mes vidéos** → VideoFeed, **Éditer service** → FormulaireYukpoIntelligent.

**Sur chaque carte:** **Modifier**, **Activer / Mettre en pause**, **Partager** (externe), **Envoyer** (InternalShareButton / interne Yukpo), **Plus** → feuille : **Promouvoir**, **Statistiques** (produit), **Dupliquer**, **Livraison** (modal livraison unitaire), **Supprimer**.

**Retour au hub synthèse:** route **MesServices** (même UI que l’onglet **Services**).

**Hard rules:** Ne pas inventer d’**import CSV** sur cet écran (non présent dans MesProduitsScreen). Ne pas confondre avec **ServicesActivity**.
`;
    }

    if (onBookExchangeHome) {
      prompt += `

=== BOURSE_DU_LIVRE_HOME_DETAIL (authoritative — LivreScolaireHomeScreen, routes LivreScolaireHome or BourseLivre) ===

**What this screen is:** Hub **Bourse du Livre** (V2): découvre des annonces **à proximité**, suit **achats / paquets / trocs / besoins**, et lance les deux parcours métier principaux — **mettre ses livres en circulation** ou **composer sa liste au programme officiel**.

**Header (dégradé orange):**
- **Gauche — flèche retour:** \`navigation.goBack()\`.
- **Titre:** libellé type « Bourse du Livre » (i18n).
- **Droite — bouton librairie:** si \`partner_type\` ∈ {librairie, libraire, livrescolaire, livre_scolaire} → **LivreScolaireForm** (« Ma librairie », icône type tableau de bord) ; sinon → **LibrairieRegistration** (« Devenir libraire », icône store).

**Deux cartes d’action principales (sous l’en-tête):**
1. **Verte — « Mettez vos livres en circulation »** (icône **camera**): → **BookUploadV2**. Sous-texte: vente, troc ou don ; le don se précise à l’étape suivante du flux.
2. **Bleue — « Trouvez votre liste scolaire »** (icône **book-check** / list-checks): → **ProgrammeBesoinsSelector**. Cocher les manuels au **programme officiel**, arbitrer **neuf vs occasion**.

**Bloc « Dashboard des opérations »:**
- Compteurs (API agrégée): **achats en cours**, **paquets à recevoir**, **paquets à envoyer**, **trocs en cours**, **besoins actifs** (\`bourseLivreV2Api.getUserBookDashboard\`, demandes de dons, \`/api/troc-livres/my-trocs\`).
- **Icône QR** → **QRCodeShare** avec \`{ mode: 'scan' }\` (scan pour valider l’arrivée du coursier).
- **Refresh** recharge ces compteurs.
- **Trois boutons de suivi:** **Suivre mes paquets** → **BookPackages** ; **Suivre mes trocs** → **MesTrocs** ; **Mes besoins** → **MesBesoinsLivres**.
- **Texte d’aide** sous le bloc: rappel de **scanner le QR du coursier** à l’arrivée.

**Liste principale:**
- **FlatList** de livres: \`livreScolaireService.searchLivres\` avec **limit 20**, offset 0 ; si GPS dispo → \`gps_lat\`, \`gps_lon\`, **rayon_km = 20**.
- **Pull to refresh** recharge la liste.
- **Tap carte** → **LivreScolaireDetails** (\`livreId\`). Chaque carte: image, titre, auteur, classe actuelle → souhaitée, matière, ville/quartier, distance formatée, état.

**Hard rules:**
- **Ne pas** décrire une **barre de recherche + panneau filtres + bouton violet « Recommandations IA »** en tête: c’est l’ancien **BourseLivreScreen** (fichier déprécié), pas l’écran monté par la navigation actuelle.
- Pour « comment vendre / troquer / donner »: pointer **carte verte** → **BookUploadV2**.
- Pour « liste de classe / manuels officiels »: pointer **carte bleue** → **ProgrammeBesoinsSelector**.
- Pour livraison / QR / paquets: **dashboard** + **BookPackages** + rappel QR.
`;
    }

    if (screenName === 'LivreScolaireDetails') {
      prompt += `

=== LIVRE_SCOLAIRE_DETAILS_DETAIL (authoritative — LivreScolaireDetailsScreen) ===

**Data:** GET \`/api/bourse-livre/{livreId}\` (détails annonce).

**Visitor (non propriétaire, livre disponible):**
- Actions rapides / bas de page: **Partager** (Share API), **Troquer** / **Trouver un troc** → POST \`/api/troc-livres/match\` avec \`livre_id\`, \`include_chaines\`, \`max_participants\` → navigation **TrocMatching** avec matchings.
- **Pas** de boutons « Acheter », « Contacter le vendeur », « Estimation prix IA » sur cet écran dans le code actuel.

**Owner:**
- **Modifier** → **LivreScolaireForm** (\`livreId\`, \`mode: 'edit'\`).
- **Marquer disponible / indisponible** → PATCH \`/api/bourse-livre/{id}/availability\`.

**UI:** bandeau hero orange, galerie photos, cartes Infos / État / Localisation / Vidéo si présente.

**Hard rule:** Ne pas inventer de bouton d’achat direct sur cette fiche ; l’achat/troc suite se fait via **TrocMatching**, **BookBuyDirect**, ou autres écrans du module selon le parcours.
`;
    }

    if (onTicketVoyageHome) {
      prompt += `

=== TICKET_VOYAGE_HOME_DETAIL (authoritative — TicketVoyageHomeScreen, route TicketVoyageHome) ===

**Role:** Recherche de **produits / lignes de bus** (billets) avec **LocationSelector** (départ + arrivée, \`scope="all"\`, \`enrichWithBackend\`), date & heure optionnelles, nom d’agence optionnel, **aller-retour** (switch + date retour).

**Données:** \`busTicketService.searchBusTickets\` → agrège filtres (\`BusTicketSearchFilters\`: \`radius_km\` défaut 50, \`min_seats\`, GPS utilisateur injecté depuis **LocationContext**). **Pas de chargement auto** au montage : l’utilisateur doit renseigner départ + arrivée puis lancer la recherche (\`loadTickets\` / bouton).

**Header:** retour ; titre i18n type « Tickets de voyage » ; **icône ticket** → **MyBusTickets** ; **sliders** ouvre panneau filtres avec **badge** = \`activeFiltersCount\`.

**Tri:** modal **sortBy** — pertinence, prix ↑/↓, heure départ, date (tri aussi côté client sur les résultats).

**Filtres rapides:** aujourd’hui / demain / week-end (date) ; **Proche de moi** ajuste \`radius_km\` (ex. 20) puis relance.

**Carte résultat:** appui → **BusTicketDetails** (\`ticketId: product_id\`, \`agencyId\`). Réservation directe → **BusTicketBooking** (\`productId\`, \`ticketData\` enrichi, \`isRoundTrip\`, \`returnDate\`) si places > 0.

**Hard rules:** Ne pas confondre avec **BusTicketSearch** (écran séparé, **CityAutocomplete** + \`/api/bus-tickets/search\`). Ne pas affirmer que les billets se chargent tout seuls à l’ouverture sans critères.
`;
    }

    if (onBusTicketSearch) {
      prompt += `

=== BUS_TICKET_SEARCH_DETAIL (authoritative — BusTicketSearchScreen, route BusTicketSearch) ===

**Role:** Formulaire **scroll** avec en-tête gradient orange « Rechercher un trajet », **CityAutocomplete** (villes texte) pour départ & arrivée, **date** (DateTimePicker), **aller-retour** (Switch + date retour + heure retour optionnelle HH:MM).

**Recherche:** \`GET /api/bus-tickets/search\` avec \`URLSearchParams\`: \`departure_city\`, \`arrival_city\`, \`departure_date\` (YYYY-MM-DD), GPS optionnel (\`user_lat\`, \`user_lng\`), \`radius_km: 100\`, \`min_seats: 1\`, filtres **SearchFilters** (\`min_price\`, \`max_price\`, \`time_range\`, \`company\`, \`sort_by\`, \`sort_order\`). Tri client supplémentaire sur prix / heure.

**UI:** section **Recherches rapides** (aujourd’hui, demain, week-end) ; bouton **Filtres** ouvre \`SearchFiltersComponent\` ; bouton **Rechercher** désactivé si villes vides.

**Résultat:** tap carte → **BusTicketBooking** (\`productId\`, \`ticketData\`, \`isRoundTrip\`, \`returnDate\`, \`returnTime\`).

**Hard rules:** Cet écran **n’utilise pas** \`busTicketService.searchBusTickets\` ni les **LocationSelector** du hub **TicketVoyageHome**. Expliquer les deux entrées si l’utilisateur compare les parcours.
`;
    }

    if (onCovoiturageHome) {
      prompt += `

=== COVOITURAGE_HOME_DETAIL (authoritative — CovoiturageHomeScreen, route CovoiturageHome) ===

**Chauffeur reconnu:** \`user.role === 'driver'\` OU \`is_driver\` / \`driver_status\` validated|approved OU partenaire avec \`partner_type\` ∈ {chauffeur, taxi, covoiturage} ; sinon appel **GET /api/users/{id}/driver-status** au montage.

**Header barre:** si non chauffeur → **Devenir chauffeur** → **CourierRegistration** (\`applicationType: 'driver'\`). **Publier un trajet** : si non validé → toast avertissement ; si validé → **CovoiturageForm** (\`mode: 'create'\`) — pas le formulaire inline \`CreateTrajetForm\` (code présent mais \`viewMode\` reste \`'search'\` dans le flux actuel).

**Recherche:** \`viewMode === 'search'\` — **LocationSelector** départ & destination (\`enrichWithBackend\`), **date** trajet, bouton **Rechercher** → \`covoiturageService.searchCovoiturages\` avec \`depart\`, \`destination\`, \`date_depart\`, pagination, et si GPS : \`lat\`, \`lng\`, \`radius_km: 100\`. **Aucune recherche auto** au premier rendu : état vide invite à remplir départ/destination.

**Liste:** pull refresh appelle \`loadNearbyTrips\` (proximité + date). Carte trajet : ouvrir **CovoiturageDetails** ; **Réserver** → **CovoiturageBooking** ; icônes **téléphone** / **WhatsApp** si \`onContact\` (appel direct).

**Création trajet (API):** \`covoiturageService.createCovoiturage\` exige \`service_id\` — sinon alerte « créer un service » → **GestionServicesSpecialises**.

**Hard rules:** Ne pas promettre un onglet « créer » visible sur cet écran si l’utilisateur ne voit que la recherche : la création passe par le bouton **Publier** → **CovoiturageForm**. Ne pas inventer d’autre portail **CovoiturageSearch** obligatoire depuis cet accueil.
`;
    }

    if (onTaxiHome) {
      prompt += `

=== TAXI_HOME_DETAIL (authoritative — TaxiHomeScreen, route TaxiHome) ===

**Chauffeur reconnu:** même logique que covoiturage + **GET /api/users/{id}/driver-status**.

**Header:** **Devenir chauffeur** → **CourierRegistration** (\`applicationType: 'driver'\`) ; **Publier un service** → **TaxiForm** (\`mode: 'create'\`) si profil chauffeur validé, sinon toast.

**Départ auto-GPS:** au montage, si **LocationContext** a des coords et champ départ vide, \`getLocationAddress\` remplit un **LocationObject** (ou « Ma position actuelle »). Bouton **Ma position** sous le départ pour ré-injecter GPS.

**Recherche:** **LocationSelector** départ & destination ; chip **Taxis disponibles uniquement** bascule \`availableOnly\` (filtre client sur \`is_available\`). Bouton **Rechercher** → \`taxiService.searchTaxis\` : priorité coords du **départ** (\`lat\`/\`lng\`, \`radius_km: 20\`), sinon ville/quartier parsés, sinon fallback position GPS utilisateur.

**Avant la première recherche (\`!hasSearched\`):** **FlatList** affiche **recommandations IA** (\`taxiService.getPersonalizedRecommendations\` — max 5) et carte **prédiction de demande** (\`taxiService.predictDemand\` avec tranche matin/après-midi/soir). **loadIARecommendations** si \`user.id\` + GPS.

**Carte taxi:** **TaxiDetails** ; appel **tel:** ; **Réserver** → **TaxiBooking** (\`taxiId\`, texte départ/destination selon contexte). Après recherche, liste = résultats filtrés.

**Hard rules:** Ne pas dire que l’utilisateur doit obligatoirement passer par **TaxiSearch** ou **TaxiIntelligentSearch** pour commander : l’accueil **TaxiHome** est déjà le hub principal refondu. Mentionner **TaxiTracking** seulement pour le suivi post-réservation si pertinent.
`;
    }

    if (onSupermarketHome) {
      prompt += `

=== SUPERMARKET_HOME_DETAIL (authoritative — SupermarketHomeScreen, route SupermarketHome) ===

**Role:** Single-screen hub with **four internal modes** (\`viewMode\`): **select** (magasins), **products**, **compare**, **promotions** — driven by **supermarketService** + **LocationContext**.

**GPS & liste magasins:** \`loadSupermarkets\` runs on mount. If **no** \`location.coords\` → alert (activate location). Else → \`supermarketService.listSupermarkets(lat, lng, 20)\` → **GET /api/services/nearby** (\`type: 'supermarche'\`, radius in meters, limit 50) then **client-side** keyword filter (supermarket / chain names, épicerie, etc.). Local **search** filters the in-memory list by name/address (no extra API).

**Deep link / entrées:** \`route.params.supermarketId\` + liste chargée → auto-select that store, \`viewMode = 'products'\`, \`loadProducts\`. \`fromBayamSelam\` or route **BayamSelamSearch** tweaks header title (\`isBayamSelam\`).

**Header back:** if \`viewMode === 'select'\` **or** no \`selectedSupermarket\` → \`navigation.goBack()\`. Else → return to **select**, clear \`selectedSupermarket\` (does **not** open Menu Planning / livraison).

**Tabs:** \`availableTabs\` = full **TAB_ITEMS** only when \`selectedSupermarket\` is set; otherwise **only** the **Magasins** tab row is shown (\`filter(t => t.key === 'select')\`). **Changer de magasin** (repeat icon) forces **select** mode.

**Produits:** \`getSupermarketProducts(supermarketId, { query, category, on_promotion, page: 1, limit: 50 })\` → **GET /api/supermarkets/:id/products**. Categories via **GET /api/supermarkets/:id/categories**. UI: horizontal **category chips** + toggle **Promotions uniquement** (\`on_promotion\`). Product search **debounced ~500 ms** on text change (\`loadProducts\`).

**Comparer:** **free-text product name** only (placeholder comparaison) — **no** barcode scanner on this screen. Submit → \`supermarketService.compareProductPrices(trimmedName, undefined, lat, lng, 20)\` → **POST /api/supermarkets/compare-prices** (\`product_name\`, optional \`product_id\`, \`lat\`/\`lng\`, \`radius_km\`). Success sets \`priceComparison\` and switches to **compare** mode; cheapest / average / range from API payload.

**Promotions:** \`loadPromotions\` — if **store selected** → **GET /api/supermarkets/:id/promotions** (\`active_only: true\`). If **no** store but GPS → **GET /api/supermarkets/promotions/nearby** (\`getNearbyPromotions\`).

**Devise:** prices formatted with **useCurrencyDetection** when product currency omitted.

**Hard rules:** Do **not** describe **code-barre** or **trigram** similarity on this screen — comparison is **by product name** via \`compareProductPrices\`. Do **not** list **MenuPlanningHub**, **ShoppingList**, or **DeliveryShoppingFlowNew** as buttons on **SupermarketHome**; cite them only as **other Yukpo modules** if the user asks. Do not claim all four tabs are visible before a supermarket is chosen.
`;
    }

    if (onOffresEmploiHome) {
      prompt += `

=== OFFRES_EMPLOI_HOME_DETAIL (authoritative — OffresEmploiHomeScreen, route OffresEmploiHome) ===

**Role:** Candidate-oriented **job discovery** home: list + search bar + quick links to AI tools and profile.

**Data load:** On mount, \`loadOffres(true)\` builds \`SearchOffresFilters\` (\`limit: 20\`, \`page: 1\`) and calls \`offreEmploiService.searchOffres\` → **GET /api/offres-emploi/search** with optional \`lat\`/\`lng\` + \`rayon_km: 50\` from **LocationContext** (proximity when GPS exists) and optional \`query\` from the header text field. Pull-to-refresh recalls \`loadOffres\`.

**Search field:** \`onSubmitEditing\` / explicit search triggers another \`searchOffres\` — **not** navigation to **OffreSearch** (that screen is a separate filter form).

**Contract chips (Tous / CDI / CDD / Stage / Freelance):** filter **only the in-memory** \`offres\` array (\`type_contrat\` string match) — they do **not** change API params on this screen.

**Header + (publish):** navigates to **CreateOffre** (full-screen form for logged-in publishers — distinct from partner **OffresEmploiForm** used from the hub FAB).

**Quick action row:** **ProfilCandidat** ; **AICVAnalysis** ; **AISalaryPrediction** ; **AISuggestFormations** ; **AlertesEmploi** — each is **navigation** to its route (no \`setShowAIModal(true)\` in this file; the legacy **AIModal** is effectively unused).

**“Offres recommandées”:** \`offreEmploiService.getMatchingOffres(60, 10)\` → **GET /api/offres-emploi/matching/offres** ; on success → **OffreList** with \`{ offres, title }\` ; if empty/error → alert suggesting **ProfilCandidat**.

**Cards:** tap or **Postuler** → **OffreDetails** with \`offreId\`. Per-card row: **Sauvegarder** toggles local \`savedOffers\` **Set** (session state). **Estimer salaire** uses **useAIWithFallback** \`predictSalary\` (3-level fallback) with poste/secteur/expérience fixe \`3\` ans + \`lieu_travail\` or default city — **not** necessarily the same as **AISalaryPrediction** screen or **GET /api/offres-emploi/ai/salary-prediction** directly.

**Hard rules:** Do **not** say the home screen opens an IA modal for CV/salaire/formations — it **navigates** to dedicated screens. Distinguish **CreateOffre** (from this home +) vs **OffresEmploiForm** (hub / recruteur form with \`LocationSelector\`, \`serviceId\`, etc.).
`;
    }

    if (onOffresEmploiHub) {
      prompt += `

=== OFFRES_EMPLOI_HUB_DETAIL (authoritative — OffresEmploiHubScreen, route OffresEmploiHub) ===

**Role:** Entry **dashboard** after quick access / deep links: stats grid, quick actions, horizontal **Outils IA**, optional **Espace employeur** strip, FAB.

**Employer detection (code):** \`isPartnerEmployer\` = \`user.role === 'partenaire'\` and \`partner_type\` normalized (remove spaces/underscores) ∈ {\`offreemploi\` from \`offre_emploi\` or \`offreemploi\`, \`recruteur\`, \`employeur\`}. **Additionally** \`hasPublishedOffers\` is set if \`getMesOffres(1,1)\` shows \`total > 0\` or employer dashboard stats show active offers — then \`isEmployer\` = partner **or** \`hasPublishedOffers\`, switching quick actions and gradient.

**Stats:** Logged-in users load **GET /api/offres-emploi/dashboard/employeur** or **GET /api/offres-emploi/dashboard/candidat** depending on \`useEmployerDashboard\`.

**Search bar (header):** navigates to **OffreSearch** (placeholder text differs employer vs candidat).

**Quick actions (employer):** **OffresEmploiForm** (nouvelle offre), **MesOffres** (also used for “Candidatures” / “Matching IA” shortcuts — same destination in code), **AISalaryPrediction**, **OffresEmploiHome** (Explorer). **Quick actions (candidate):** **OffresEmploiHome**, **OffreCandidatures**, **ProfilCandidat**, **AlertesEmploi**, **MesOffres**.

**Outils IA:** horizontal cards → **AICVAnalysis**, **AISalaryPrediction**, **AISuggestFormations**.

**Espace employeur (when \`!isEmployer\`):** card **Publier une offre** → **OffresEmploiForm** ; secondary rows → **MesOffres**.

**FAB (+):** always **OffresEmploiForm** (both branches identical in code).

**Hard rules:** Tell users the hub uses **OffresEmploiForm** + **MesOffres** for publishing/management from here; **CreateOffre** is the alternate full form opened from **OffresEmploiHome** (+). Do not invent separate routes for “Matching IA” on the hub — it maps to **MesOffres** in \`buildEmployerQuickActions\`.
`;
    }

    if (onBloodTransfusionScreen) {
      prompt += `

=== BLOOD_TRANSFUSION_MODULE_DETAIL (authoritative — align on **CURRENT SCREEN** name) ===

**Entry (user):** Accueil → **YukpoServicesQuickAccess** carte **Transfusion** (\`banque_sang\`) ou hub santé → **BanqueSangSearch** (**BanqueSangSearchScreen**).

### BanqueSangSearch
- **GPS requis** pour lancer : coords **LocationContext** ou **ModernGPSModal** ; sinon alerte.
- **Distance** 5–200 km.
- Si **connecté** : **GET** \`/api/blood-donation/donor/blood-groups\` ; compat **GET** \`/api/blood-donation/compatibility/{groupe}\` ; enregistrement **POST** \`/api/blood-donation/donor/blood-group\` avec **\`groupe_sanguin\`**.
- **Recherche** : si \`user && userBloodGroup\` → **BloodDonation** + \`searchParams\` ; sinon → **BanqueSangList** (\`available_only\`, \`check_stocks\`, groupe optionnel).
- **Cœur header** (sans groupe) → **BloodDonation**.

### BanqueSangList
- **GET** \`/api/banques-sang/search\` + \`route.params.filters\` ; pagination 20 ; tap → **BanqueSangDetails** (\`banqueId\`).

### BanqueSangDetails / BloodBankDetails
- **GET** \`/api/banques-sang/:id\` ; notes **GET** \`/api/specialized-services/:service_id/ratings/stats\`.
- Actions : appel, WhatsApp, **ChatModalMobile**, **Don** → **BloodDonation** (code actuel), email, urgence ; stocks ; avis **ProductCommentsSection**.

### BloodDonation
- Onglets demandes / profil groupe / compatibilité ; **bloodDonationService** ; réponse à demande → **notifyDonorsForRequest**.

### BloodDonationRequest
- Formulaire **création de demande** — distinct du bouton « Don » sur la fiche banque.

### BanqueSangForm (partenaire)
- Onglets overview / service / stocks ; **POST** \`/api/banques-sang\` ; stocks **POST** \`/api/banques-sang/:id/stocks\`.

**Hard rules:** Urgence vitale → **secours** + \`telephone_urgence\` sur la fiche si présent. Pas de bouton itinéraire dédié ici → module **Navigation** global si besoin.
`;
    }

    if (onLaboratoryModule) {
      prompt += `

=== LABORATORY_MODULE_DETAIL (authoritative — align on **CURRENT SCREEN** name) ===

**User entry points:** grille d’accueil (**LaboratoireSearch**), hub santé (**HealthServicesHub** → tuile **LaboratoireSearch**), éventuellement **LaboratoireHome** (hub examens + IA / dispo).

### LaboratoireSearch (**LaboratoireSearchScreen**)
- **GPS:** **LocationContext** préremplit \`gpsData\` ; sinon **ModernGPSModal** (\`handleGPSSelect\`).
- **Filtres:** ville/quartier (champs), type de prestation texte \`serviceType\`, **distance max** (\`maxDistance\`, défaut 50 km), switches **RDV en ligne** (\`rdv_en_ligne\`), **disponibles** (\`available_only\`, défaut true), **types d’examens** multi (\`selectedTypesExamens\`), texte **prestation / analyse** (\`prestationAnalyse\`), filtres avancés repliables.
- **Rechercher:** si \`selectedTypesExamens.length > 0\` **ou** \`prestationAnalyse\` non vide → **LaboratoireList** avec \`{ filters }\` (inclut \`types_examens\`, \`prestation_analyse\`, lat/lng, \`max_distance_km\`, flags) ; sinon → **LaboratoireList** avec filtres « labo » (\`service_type\`, GPS, distance, RDV, \`available_only\`).
- **Bandeau « Mes examens »** → **MyLabExaminations** (connexion requise sur l’écran liste).
- **Quick searches:** « Plus proche » (rayon 15 km + dispo), « RDV en ligne », « Résultats en ligne » (intention UI ; filtre backend \`resultats_en_ligne\` commenté côté recherche).

### LaboratoireList (**LaboratoireListScreen**)
- **GET** \`/api/laboratoires/search\` : \`ville\`, \`quartier\`, \`lat\`, \`lng\`, \`max_distance_km\`, \`type_laboratoire\`, \`service_type\`, \`prestation_analyse\` (depuis \`filters.analyse\` **ou** \`filters.prestation_analyse\`), \`types_examens\` (répété par valeur si tableau), \`rdv_en_ligne\`, \`imagerie\`, \`available_only\`, \`page\`, \`limit\` (20), infinite scroll.
- Tap carte → **LaboratoireDetails** avec \`laboratoryId: laboratoire.id\`.

### LaboratoireDetails (**LaboratoireDetailsScreen**)
- **GET** \`/api/laboratoires/{laboratoryId}\` ; types d’examens **GET** \`/api/laboratoires/{id}/examination-types\` via **\`labService.getExaminationTypes\`**.
- **Actions rapides:** appel, WhatsApp, **Chat Yukpo** (**ChatModalMobile**), **RDV** → **POST** \`/api/laboratoires/{id}/book\` (notes fixes « Réservation depuis l’application mobile »), email, site, partage natif.
- **Liste « Types d’examens »:** tap ligne → réservation examen **\`labService.bookExamination\`** → **POST** \`/api/laboratoires/{id}/book-examination\` (modal notes + \`examination_type_id\`).
- **Bloc IA symptômes:** chips symptômes → **\`labService.searchPathology(symptoms)\`** → **POST** \`/api/laboratoires/ai/search-pathology\` (urgence, examens suggérés, pathologies possibles — **indicatif**).
- **Boutons pleine largeur:** « Réserver un rendez-vous » (même **POST** \`/book\` ; désactivé si fermé), **Mes examens** → **MyLabExaminations**, **Analytics** (propriétaire) → **LabAnalytics** avec \`laboratoryId\`.
- **Avis:** **GET** \`/api/specialized-services/{service_id}/ratings/stats\` + **ProductCommentsSection**.

### LaboratoireHome (**LaboratoireHomeScreen**)
- Autocomplete **\`laboratoryService.searchExaminationTypes\`** → **GET** \`/api/laboratoires/examinations/autocomplete\`.
- Si **dispo + GPS** (\`useAvailability\` + **LocationContext**): **\`laboratoryService.searchWithAvailability\`** → **GET** \`/api/search/scheduling\` (query + lat/lng + \`max_distance\`).
- Sinon navigation vers **LaboratoireList** avec param \`examinationType\` (texte) — la liste principale attend surtout \`filters\` ; en cas d’écart, orienter l’utilisateur vers **LaboratoireSearch** pour des critères complets.
- Raccourcis **LaboratoireSearch** / **MyLabExaminations** ; modales IA pathologie / image via **laboratoryService** (\`/api/laboratoires/ai/search-pathology\`, \`/api/laboratoires/examinations/analyze-image\`).

### MyLabExaminations (**MyLabExaminationsScreen**)
- **GET** \`/api/laboratoires/my-examinations\` via **\`labService.getMyExaminations\`** (pagination 20, filtres statut UI).
- Examen **completed** → **Voir résultats** / **Analyser avec IA** → **LabAIAnalysis** avec \`examinationId\`.

### LabAIAnalysis (**LabAIAnalysisScreen**)
- Param **\`examinationId\`** (obligatoire pour le flux standard) : **\`labService.getExaminationResults\`**, puis **\`labService.analyzeExamination\`** → **POST** \`/api/laboratoires/examinations/{id}/analyze\`.

### LabAnalytics (**LabAnalyticsScreen**)
- Param route **\`laboratoryId\`** : vérif propriétaire **\`labService.getLaboratoryDetails\`** (\`user.id === laboratory.user_id\`), sinon **Alert** + retour.
- Puis **\`labService.getAnalytics(laboratoryId)\`** → **GET** \`/api/laboratoires/{id}/analytics\` (**sans** query \`period\` dans le client actuel).
- UI : sélecteur **7j / 30j / 90j** relance \`loadAnalytics\` au changement, mais l’appel API reste le même ; affichage des champs \`total_examinations\`, \`examinations_7d\`, \`examinations_30d\`, \`completed_count\`, \`examination_types_count\`, etc.

### LaboratoireForm (**LaboratoireFormScreen** — prestataire / création)
- Détail : **LABORATOIRE_PARTNER_DASHBOARD_DETAIL** lorsque \`CURRENT SCREEN\` = **LaboratoireForm**.

**Hard rules:** Ne pas confondre **POST** \`/book\` (RDV générique labo) et **POST** \`/book-examination\` (créneau/type d’examen structuré). Pas de bouton **Navigation / itinéraire** sur **LaboratoireDetails** dans le code actuel → module **Navigation** global si l’utilisateur demande l’itinéraire.
`;
    }

    if (screenName === 'LaboratoireForm') {
      prompt += `

=== LABORATOIRE_PARTNER_DASHBOARD_DETAIL (LaboratoireFormScreen — authoritative) ===

**Double rôle:** (1) **Dashboard partenaire** (\`isDashboardMode\` ou \`partenaire && serviceId\`) avec **5 onglets** ; (2) **Formulaire création** (header « Enregistrer un laboratoire » + \`renderServiceForm\` seul) si hors dashboard.

**Init partenaire** (\`role === 'partenaire'\` && \`partner_type === 'laboratoire'\`): **GET** \`/api/partners/me\` → préremplit \`formData\` (nom, adresse, téléphone, email, ville). **GET** \`/api/laboratoires\` → utilise **\`labs[0]\`** comme \`labData\` ; si présent : \`setLabData\`, \`isDashboardMode(true)\`, \`service_id\` depuis la fiche, **\`loadExamTypes(lab.id || lab.service_id)\`** → **GET** \`/api/laboratoires/{lid}/examination-types\`. Si la réponse est vide, **fallback** = concaténation locale des chips **analyses** / **imagerie** (\`selectedAnalyses\` / \`selectedImagerie\`).

**Dashboard:** affiché si \`isDashboardMode || (partenaire && serviceId)\`. **Pas de FAB IntelligentChat** dans ce fichier.

### Onglets (header gradient)
1. **Accueil (\`overview\`):** **4 stats** calculées depuis \`examinationTypes\` (total, analyses, imagerie, avec prix). **Actions rapides:** **Ajouter examen** → bascule **Examens** + ouverture **modal** (timeout) ; **IA Analyse** → **Alert** (orientation patient / \`examinationId\` / **MyLabExaminations**) ; **Statistiques** → **LabAnalytics** avec \`laboratoryId: labData.id\` — **Alert** si pas d’\`id\` ; **Mon service** → onglet Service ; **Portefeuille** → **WalletFinancial** ; **Sortir** → **Alert** + \`logout\`. Infos horaires / 24h, **RDV requis**, **résultats en ligne**. **4 derniers** examens + **Tout voir** → Examens. **Pull-to-refresh** → \`handleRefresh\` = **seulement** \`loadExamTypes\` (**ne** recharge pas \`labData\` via **GET** \`/api/laboratoires\`).

2. **Service:** \`renderServiceForm\` — si **partenaire**, champs **nom, adresse, téléphone, WhatsApp, email** **masqués**. Restent type (3 chips), **ModernGPSModal**, **LocationSelector** quartier, **SimplePrestationSelector** (analyses + imagerie), horaires, switches 24h / RDV / résultats en ligne. **Mettre à jour / Enregistrer** → \`handleSubmit\` : **\`servicesApi.createService\`** si besoin, puis **POST** \`/api/laboratoires\` avec \`service_id\` et payload (gps, listes, contacts null si vides).

3. **Examens:** liste + recherche locale ; modal ajout/édition — au **Valider**, le code ne fait que **\`setExaminationTypes\`** (**état React**) : **aucune** requête **POST/PUT** vers \`/examination-types\` dans ce fichier → **pas de persistance serveur** de ce flux modal dans l’implémentation actuelle.

4. **Stats (onglet \`analytics\` in-app):** compteurs **catalogue** depuis \`examinationTypes\` + texte **IA résultats** statique — **≠** écran **LabAnalytics** (API + contrôle propriétaire).

5. **Équipe:** **ServiceTeamManager** \`serviceId={serviceId?.toString()}\` (ID **service Yukpo**, pas \`laboratoryId\`).

**Mode création** (sans barre d’onglets): \`renderServiceForm\` + GPS + même modal examens.

**Hard rules:** Ne pas confondre onglet **Stats** du formulaire et **LabAnalytics** ; ne pas affirmer que la modal examens **enregistre** côté API ; **Statistiques** (navigation) dépend de **\`labData.id\`**.
`;
    }

    if (onTravelAgencyPartnerModule) {
      prompt += `

=== TRAVEL_AGENCY_PARTNER_DETAIL (authoritative — **AgenceVoyageFormScreen** / **BusTicketQRScannerScreen**) ===

**Route principale partenaire:** **AgenceVoyageForm** (\`usePartnerData(..., 'agencevoyage')\`). Accès aussi **Services spécialisés** / hub (\`agence_voyage\` → même écran).

### Chargement initial (rôle **partenaire**)
- **GET** \`/api/partners/me\` → préremplit nom, adresse, téléphone, email, ville (**partenaire**).
- **GET** \`/api/agences-voyage\` → liste ; le code prend **\`agencies[0]\`** comme \`agencyData\`, fixe \`service_id\` si manquant, puis **\`loadSchedules\`** + **\`loadAgencyTickets\`**.
- **Création service Yukpo:** si besoin, **\`servicesApi.createService\`** (\`category: 'transport'\`, titre = nom agence).

### Modes d’affichage
- **Dashboard** si agence existante **ou** (\`partenaire\` **et** \`serviceId\`) : header gradient bleu, **6 onglets** — **overview** | **service** | **schedules** | **bus** | **tickets** | **team**.
- **Formulaire création** (non partenaire ou sans dashboard) : header + **\`renderServiceForm\`** (pas d’onglets bus/tickets dans ce mode).

### Onglet **Service** (fiche agence)
- **POST** \`/api/agences-voyage\` (création / mise à jour même handler \`handleSubmit\`) : \`service_id\`, \`nom_agence\`, \`adresse\`, \`quartier\`, \`gps\` (**ModernGPSModal** ou coords **LocationContext**), \`services_voyage\` (chips : Billetterie bus/avion, Organisation voyages, Visa), \`compagnies_bus\`, \`destinations\` (**LocationSelector**), horaires ouverture/fermeture, \`jours_ouverture\` (**WeekDaysSelector**), contacts, \`peut_emettre_tickets_bus\`, \`compagnies_affiliees\` (si switch actif), \`devise\`.
- **Partenaire:** champs **nom agence, adresse brute, téléphone, WhatsApp, email** sont **masqués** dans l’UI (\`user?.role !== 'partenaire'\`) — le partenaire édite surtout **GPS, quartier, services, compagnies, destinations, horaires, switch billetterie**.

### Onglet **Horaires** (lignes / créneaux agence)
- Liste : **GET** \`/api/bus-tickets/agencies/schedules\`.
- Création : **POST** \`/api/bus-tickets/agencies/schedules\` (villes départ/arrivée, \`departure_times[]\`, \`day_of_week\` optionnel, \`notes\`).
- Édition : **PUT** \`/api/bus-tickets/agencies/schedules/{id}\`.
- Suppression : **DELETE** \`/api/bus-tickets/agencies/schedules/{id}\`.

### Onglet **Bus** (modèles / produit billet Yukpo)
- **BusModelForm** : nouveau modèle → **POST** \`/api/bus-tickets/create-product\` (\`service_id\`, \`name\`, \`type: 'ticket_voyage'\`, sièges, \`bus_configuration\`, \`seat_map\`, \`price_cents\`, \`currency\`) puis si \`agencyData.id\` → **POST** \`/api/bus-tickets/link\` (\`agency_id\`, \`product_id\`, \`nom_modele\`, \`classe\`, \`equipements\`).
- **Modification / suppression** d’un modèle **déjà listé** : mise à jour **state local** \`busModels\` — **pas** d’appel API dédié dans ce fichier pour éditer un produit existant (hors création initiale).

### Onglet **Tickets** (ventes & embarquement)
- Liste : **GET** \`/api/bus-tickets/agency/tickets\`.
- Sélection d’une vente : **GET** \`/api/bus-tickets/boarding/{productId}/summary\` + **GET** \`/api/bus-tickets/boarding/{productId}/passengers\`.
- **Valider** manuellement un passager : **POST** \`/api/bus-tickets/validate/manual\` \`{ reservation_id }\`.
- Bouton **Scanner QR** → **BusTicketQRScanner** : voir section scanner ci-dessous.

### Onglet **Équipe**
- **ServiceTeamManager** avec \`serviceId\` (string).

### Accueil (**overview**)
- Stats : destinations, compagnies, horaires, tickets (compteurs locaux).
- Actions rapides : nouvel horaire (modal), **Service**, **Bus**, **Conseils IA** (\`handleAISuggest\`), **Portefeuille** (**WalletFinancial**), déconnexion.
- **IA conseils:** **POST** \`/ai/chat\` — message métier + \`context: 'travel_agency_partner_dashboard'\` + \`language\` (langue active).

### BusTicketQRScanner (**BusTicketQRScannerScreen**, route **BusTicketQRScanner**)
- Scan : **POST** \`/api/bus-tickets/validate\` avec **\`{ qr_code_data }\`** uniquement dans **\`handleScan\`** (pas de \`product_id\` dans ce fichier).
- **Note d’implémentation:** **AgenceVoyageForm** ouvre le scanner avec des **params** (\`onValidate\`, \`product_id\`) pour une validation enrichie, mais **l’écran scanner actuel ne lit pas \`route.params\`** — en cas d’échec ou de besoin de contexte trajet, orienter vers **sélection d’une ligne** dans l’onglet Tickets puis support / évolution produit.

**Hard rules:** Ne pas confondre ce dashboard avec **AgenceVoyageSearch** / **AgenceVoyageList** / **AgenceVoyageDetails** (**client** qui cherche une agence). Ne pas promettre la synchro API des modèles bus **édités** après création si ce n’est pas reflété dans le code ci-dessus.
`;
    }

    if (onCourierDashboard) {
      prompt += `

=== COURIER_DASHBOARD_DETAIL (authoritative — **CourierDashboardScreen**, route **CourierDashboard**) ===

**Rôle:** tableau de bord **coursier / livreur**. **≠** **FleetDashboard** (gérant d’entreprise de livraison).

### Accès navigation
- Route pile **CourierDashboard** ; onglet barre affiché lorsque le profil indique coursier (**\`is_courier\`** chargé côté **AppNavigator**, ex. depuis données utilisateur).

### Chargement & cycle de vie
- **\`useFocusEffect\`** : \`notificationSoundService.initialize()\` ; **\`loadData\`** immédiat ; **intervalle 15 s** qui rappelle \`loadData\` (nettoyage au blur).
- **\`loadData\`** : **\`deliveryApi.listActiveDeliveries()\`** → **GET** \`/api/deliveries/active\` ; parse \`data.deliveries\` ou \`data\` (tableau) ; si \`length > lastDeliveryCount\` **et** \`lastDeliveryCount > 0\` → \`playSoundWithVibration('delivery_request')\`.
- **Stats** : **\`deliveryApi.getCourierStats()\`** → **GET** \`/api/delivery/courier/stats\` ; erreur → \`console.warn\` uniquement (pas d’écran d’erreur dédié).
- **Pull-to-refresh** sur le **ScrollView** → \`handleRefresh\`.

### UI
- **\`CourierStatsChart\`** : livraisons complétées, gains totaux / mois, temps moyen, taux de réussite (nombres sécurisés côté écran).
- **\`BookCourierSubDashboard\`** : **Bourse du livre V2** coursier — **\`bourseLivreV2Api.getCourierBookDashboard\`**, accepter paquet, **\`updatePackageStatus\`** (workflow **distinct** des livraisons **delivery**).
- **Livraisons actives** : carte → **\`DeliveryShoppingTracking\`** (\`deliveryId\`) ; bouton **code vérification** → **\`CourierVerificationCode\`** (\`deliveryId\`).
- **Actions rapides** : **« Voir mes statistiques »** = **\`Alert.alert\`** avec texte (pas de route) ; **« Mon portefeuille »** → **\`WalletFinancial\`**.

**Hard rules:** Ne pas promettre **Historique** / **Revenus** comme écrans séparés depuis cet écran. Ne pas décrire candidatures / suspension de coursiers (**FleetDashboard**).
`;
    }

    if (onFleetDashboard) {
      prompt += `

=== FLEET_PARTNER_DASHBOARD_DETAIL (authoritative — **FleetDashboardScreen**, route **FleetDashboard**) ===

**Rôle:** tableau de bord **partenaire entreprise / flotte** (livraison, courses marché, déménagement, transport, chauffeurs — selon **\`partner_type\`** normalisé en minuscules). **Usage métier courant:** gérant d’**équipe de coursiers** ou de **chauffeurs / véhicules** (dont **flotte automobile** au sens transport). L’utilisateur **ne pilote pas** ici une livraison comme sur **CourierDashboard** (**DeliveryShoppingTracking**, livraisons actives).

### Navigation Yukpo → cet écran
- **\`getPartnerDashboardScreen(partnerType)\`** (**AppNavigator.optimized.tsx**) retourne **\`FleetDashboard\`** pour : **chauffeur**, **fleet**, **livraison**, **livraison_courses_marche**, **demenagement**, **transport**.
- **\`PartnerDashboardTab\`** monte l’écran retourné (onglet partenaire).
- **\`fleetLabel\`** (**sous-titre header**) : **\`PARTNER_TYPE_LABELS[partnerType]\`** dans **FleetDashboardScreen** — clés **chauffeur** → *Chauffeurs*, **livraison** → *Coursiers Livraison*, **livraison_courses_marche** → *Coursiers Marche*, **demenagement** → *Equipe Demenagement*, **transport** → *Transporteurs*. Si **absent** (ex. **\`partner_type === 'fleet'\`**) → **« Flotte »** (fallback chaîne dans le code).

### Modèle de données affiché (aligné interfaces fichier)
- **FleetStats** (GET stats) : \`total_couriers\`, \`pending_applications\`, \`completed_deliveries_30d\`, \`active_deliveries\`, \`avg_rating\`, \`monthly_revenue_cents\`.
- **FleetCourier** : \`courier_id\`, \`user_id\`, \`name\`, \`email\`, \`phone\`, \`status\`, \`courier_type\`, \`deliveries_30d\`, \`rating\`.
- **FleetApplication** : \`id\`, \`user_id\`, \`name\`, \`status\`, \`submitted_at\`, \`phone\`, \`city\`, \`vehicle_type\`, \`courier_type\`, \`has_documents\`.
- **Types coursier affichés** (**\`COURIER_TYPE_LABELS\`**) : **classic** → Coursier, **market_shopping** → Courses Marche, **taxi** → Chauffeur Taxi, **carpooling** → Covoiturage, **moving** → Demenagement.

### Chargement & rafraîchissement
- **useEffect** montage : **\`loadAll(false)\`** = **Promise.all**(\`loadStats\`, \`loadCouriers\`, \`loadApplications\`) puis \`setLoading(false)\`.
- **loadStats** : **GET** \`/api/partners/me/fleet/stats\` ; si \`res.data.data\` → **setStats(data.data)** (enveloppe **apiGet**).
- **loadCouriers** : **GET** \`/api/partners/me/fleet/couriers\` ; liste **\`data.data\`** ou \`[]\`.
- **loadApplications** : **GET** \`/api/partners/me/fleet/applications?status=\${appFilter}\` ; \`appFilter\` **submitted** | **approved** | **rejected** | **all**.
- **useEffect** \`[appFilter]\` : **uniquement** \`loadApplications()\` (pas recharger stats/coursiers).
- **onRefresh** / header **refresh-cw** / **RefreshControl** sur overview, couriers, applications, analytics : **\`loadAll(true)\`** (\`setRefreshing(true)\` puis **stats + coursiers + candidatures**).

### UI — header
- **SafeNativeView** ; titre i18n **fleetDashboard.gestionDeFlotte** + sous-titre **fleetLabel**.
- Bouton **refresh-cw** : même **loadAll(true)** que le pull.

### Barre d’onglets (4)
- **overview** — libellé **Apercu** (sans accent, en dur), icône **layout-dashboard**.
- **couriers** — libellé = **fleetLabel**, icône **users**.
- **applications** — **Candidatures**, icône **user-plus** ; si \`stats.pending_applications > 0\` : badge **\`#ef4444\`** avec le nombre.
- **analytics** — **Analytics**, icône **bar-chart-2**.

### Onglet **overview**
- Titre section **en dur** : **« Tableau de bord — {fleetLabel} »**.
- **Grille 4 cartes** — libellés **en dur** (FR) sauf **En cours** : **Coursiers actifs** (\`total_couriers\`), **Candidatures** (\`pending_applications\`), **Courses (30j)** (\`completed_deliveries_30d\`), **En cours** (\`active_deliveries\`, i18n **fleetDashboard.enCours**).
- **Deux cartes larges** : note **\`avg_rating\` /5** (i18n **fleetDashboard.noteMoyenneFlotte**) ; **revenus** \`formatCurrency(monthly_revenue_cents)\` = **\`Math.round(cents/100)\` + « XAF »** (i18n libellé **fleetDashboard.revenusCeMois**).
- **Bandeau orange** si \`pending_applications > 0\` : texte **en dur** (*« N candidature(s) en attente de validation »*) → **setActiveTab('applications')**.
- **Actions rapides** (libellés **en dur**) : **Candidatures**, **Coursiers**, **Analytics** → changement d’onglet ; **Portefeuille** → **navigate('WalletFinancial')** ; **Sortir** → **Alert** + **logout** (i18n **common**).
- **Meilleurs coursiers** : tri **deliveries_30d** desc, **top 3** ; **voir tous** (i18n **fleetDashboard.voirTous**) → onglet **couriers**.

### Onglet **couriers**
- Titre **« Mes {fleetLabel} (count) »** ; **FlatList** ou vide (**fleetDashboard.aucunCoursier** + texte **en dur** sur inscription entreprise).
- **Suspendre / Reactiver** : si \`currentStatus === 'approved'\` → action **suspend**, sinon **activate** ; libellés bouton **Suspendre** / **Reactiver** **en dur** ; Alert secondaire réactivation **en dur** (*courses*). **POST** \`/api/partners/me/fleet/couriers/{courier_id}/toggle\` **\`{ action: 'suspend' | 'activate' }\`** ; succès → **loadCouriers** + **loadStats** (pas **loadAll**).

### Onglet **applications**
- Chips : **En attente** / **Approuvees** / **Rejetees** / **Toutes** ↔ **submitted** / **approved** / **rejected** / **all**.
- Carte : **Approuver** + **Rejeter** **uniquement** si \`item.status === 'submitted'\`. **Approuver** → Alert i18n puis **POST** \`.../applications/{id}/approve\` **\`{}\`** → **loadAll(true)**. **Rejeter** → modal ; **POST** \`.../reject\` **\`{ reason }\`** (\`undefined\` si vide) → **loadAll(true)**.
- Date **Soumis le** : **toLocaleDateString('fr-FR')** **en dur**.

### Modal **rejeter**
- Titres / placeholder **en dur** : **Rejeter la candidature**, **Motif du refus...** ; **Annuler** : ferme modal + **rejectTarget** null (**rejectReason** non effacé sur Annuler — réinitialisé à l’ouverture suivante via **setRejectReason('')**).

### Onglet **analytics**
- **Aucune route analytics dédiée** : **même** \`stats\` + **top 5** coursiers (\`deliveries_30d\`), barres proportionnelles, carte revenus, **Metriques cles** (libellés **en dur** : *Livraisons (30j)*, etc.).

**Hard rules:** Ne pas décrire **CourierDashboard** (livraisons actives, **deliveryApi** liste coursier) comme cet écran. Ne pas inventer d’API ou filtres hors **submitted / approved / rejected / all**. **PARTNER_TYPE_LABELS** ne contient **pas** la clé **fleet** : dire **« Flotte »** pour ce cas. Pas de **FAB** chat dans **FleetDashboardScreen.tsx** (chat accessible ailleurs dans l’app).
`;
    }

    if (onAutomobilePartnerDashboard) {
      prompt += `

=== AUTOMOBILE_PARTNER_DASHBOARD_DETAIL (authoritative — **AutomobileDashboardScreen**, route **AutomobileDashboard**) ===

**Rôle:** tableau de bord **partenaire** vente / stock **véhicules** (concessionnaire, garage catalogue). **Entrée:** **\`getPartnerDashboardScreen('automobile')\`** → **AutomobileDashboard** (**AppNavigator.optimized.tsx** — **PartnerDashboardTab**). **≠** parcours **client** **AutoServicesSearch** / **AutoServicesResults**.

### Données
- **\`loadData\`** (**\`useFocusEffect\`**) : **GET** \`/api/specialized-services/user?type=automobile\` ; liste **\`(resp as any).data.services\`** → état **\`vehicles\`**.
- **Stats** (calcul **client** sur le tableau) : **total** ; **active** = \`is_active !== false\` ; **occasion** = \`is_occasion === true\` ; **neuf** = \`is_occasion !== true\`.
- **Devise affichée** : **\`getCurrencyIntelligently()\`** ou **\`FCFA\`**.

### Structure UI
- **Header** gradient orange : retour **goBack** ; titre / sous-titre i18n **automobileDashboard** + nom utilisateur.
- **3 onglets** (\`TabType\`) : **overview** (libellé i18n accueil), **vehicles** (i18n véhicules), **analytics** (libellé **en dur** **« Stats »** dans **TABS**).

### Onglet **overview**
- **4 cartes stats** : total véhicules, en ligne, **Occasion** / **Neufs** (libellés **Occasion** / **Neufs** **en dur** pour deux d’entre elles).
- **Actions rapides** : **Ajouter véhicule** → **setActiveTab('vehicles')** ; **Recherche** → **navigate('AutoServicesSearch')** ; **Statistiques** → onglet analytics ; **Portefeuille** → **WalletFinancial** ; **Sortir** → **Alert** + **logout**.
- **« Par type »** : grille **\`TYPES_VEHICULE\`** (berline, suv, pickup, utilitaire, moto, camion) — comptage **\`vehicles.filter(v => v.type_vehicule === key).length\`** (**affichage seulement**, pas de navigation par type).
- **Véhicules récents** : **slice(0, 4)** ; **Tout voir** → onglet **vehicles**. Carte : marque, modèle, année, occasion/neuf, prix ; point vert/rouge **\`is_active\`**.

### Onglet **vehicles**
- Bouton **« Ajouter un véhicule »** : **\`Alert.alert('Info', …)\`** (i18n **automobileDashboardScreen.utilisezLeFormulaireIntelligentPourAjouter**) — **aucune** navigation vers **FormulaireYukpoIntelligent** depuis ce handler.
- Liste : même carte info + statut ; **pas** de bouton éditer / désactiver / supprimer dans ce fichier.

### Onglet **analytics**
- Carte **résumé du stock** (i18n titre) : mêmes 4 agrégats que l’accueil.

**Pièces détachées:** la catégorie produit **\`pieces_auto\`** (champs référence, compatibilité, etc.) vit dans le **flux e-commerce général** (**ProductManagerMobile**, **MesProduits**, **FormulaireYukpoIntelligent**) — **pas** dans **AutomobileDashboardScreen**. Le **marché auto** public (**/api/auto/search**) peut toutefois **inclure** des annonces pièces si **service** ou métadonnées matchent les motifs SQL backend (**pièces auto**, **accessoires auto**, etc.).

**Hard rules:** Ne pas promettre d’**ajout véhicule** complet depuis ce dashboard (seulement **Alert** + renvoi conceptuel vers formulaire intelligent). Ne pas décrire **GET /api/auto/search** comme source du stock partenaire ici (**source = specialized-services user**).
`;
    }

    if (onAutoServicesSearch || onAutoServicesResults) {
      prompt += `

=== AUTO_MARKETPLACE_MODULE_DETAIL (authoritative — **AutoServicesSearchScreen** / **AutoServicesResultsScreen**) ===

**Contexte:** parcours **acheteur / chercheur** de **véhicules** et d’**annonces cataloguées** par le moteur **auto** backend. L’UI est **orientée véhicule** (marque, type, année, carburant…). Les **pièces détachées** et accessoires peuvent **remonter** dans les résultats si le **backend** les classe comme produits auto (ex. catégories service **pièces auto** — voir **\`auto_search_routes.rs\`**).

### A) **AutoServicesSearch** (route **AutoServicesSearch**)
- **GET** \`/api/auto/filters\` → facettes **marques**, **types_vehicule**, **carburants**, **transmissions**, **couleurs**, **etats**, plages **prix** / **année**, **total_products**.
- **Barre recherche** : texte **\`q\`** (soumission **handleSearch** ou bouton flèche).
- **Recherches rapides** → **navigate('AutoServicesResults', { filters })** : **tout voir** \`{}\` ; **Occasion** \`{ etat: 'Occasion' }\` ; **Neuf** \`{ etat: 'Neuf' }\` ; **moins cher** \`{ sort: 'price_asc' }\` ; **proche** (si **GPS**) \`{ gps_lat, gps_lon, rayon_km: 10, sort: 'distance' }\`.
- **Filtres principaux** : chips dynamiques + **prix min/max**, **année min/max** ; section **avancée** (dépliable) : carburant, transmission, couleur, **LocationSelector** « ville », **ModernGPSModal**, **rayon** 5 / 10 / 20 / 50 km si **gpsData**.
- **Bouton recherche** : **\`handleSearch\`** construit **\`SearchFilters\`** (inclut **ville** / **quartier** / **gps** / **rayon** quand renseignés) → **navigation** vers **AutoServicesResults**.

**Écart d’implémentation (à respecter pour l’IA):** **AutoServicesResultsScreen** **n’ajoute pas** \`ville\`, \`quartier\` (ni **km_max** du search si jamais ajouté) aux **query params** de **GET /api/auto/search** dans **\`loadResults\`** — seuls **q, marque, type_vehicule, carburant, transmission, couleur, etat, prix_*, annee_*, gps_*, rayon_km, sort, page, limit** sont passés tels que dans le code client. Le struct **\`AutoSearchQuery\`** côté **Rust** **ne définit pas** \`ville\` / \`quartier\`. Pour filtrer **géographiquement**, utiliser **GPS + rayon** (et **tri distance** côté quick search).

### B) **AutoServicesResults** (route **AutoServicesResults**)
- **Params** : **\`route.params.filters\`** (objet initial figé dans **\`initialFilters\`** via **\`useRoute\`** — changement de filtres **sans** nouveau navigate **ne** met **pas** à jour **\`initialFilters\`**).
- **GET** \`/api/auto/search?\` + **\`page\`** (0-based), **\`limit\` = 20**, **\`sort\`** = **\`currentSort\`** (défaut **\`initialFilters.sort\`** ou **\`recent\`**).
- **Tris UI** (**\`SORT_OPTIONS\`**) : **recent**, **price_asc**, **price_desc**, **year_desc** — le **backend** accepte aussi **year_asc** et **distance** (si GPS) même s’ils ne sont pas tous dans le menu.
- **Liste** : **FlatList** ; **infinite scroll** **\`page+1\`** si **\`hasMore\`** (\`newProducts.length >= 20\`).
- **Carte produit** : tap → **ServiceDetail** \`{ serviceId }\` ; nom vendeur → **PrestataireBoutique** si **\`vendeur_user_id\`**.
- **Communication** : **Chat** → **ServiceDetail** \`openChat: true\` (connexion requise) ; **WhatsApp** / **Appel** → **Linking** + **POST** \`/api/notifications\` best-effort ; **Partager** → **Share** + **generateSmartShareLink**.
- **Avis** : section repliable **ProductCommentsSection** (mode inline) ; **onOpenChat** repasse par **ServiceDetail** avec chat.

### C) Lien avec **pièces détachées**
- **Vendeur** : créer une fiche **pièce** = flux **produit** Yukpo (**\`pieces_auto\`**, etc.), pas **AutomobileDashboard**.
- **Acheteur** : pas d’écran **« uniquement pièces »** dans l’app ; utiliser **recherche texte** sur **AutoServicesSearch** ou filtres **marque** si la donnée est exposée en facettes.

**Hard rules:** Ne pas affirmer que **ville** / **quartier** du formulaire de recherche **filtrent** l’API **telle qu’implémentée** (mobile + query Rust). Ne pas présenter **AutomobileDashboard** comme le même écran que **AutoServicesSearch**.
`;
    }

    if (onHealthServicesHubScreen) {
      prompt += `

=== HEALTH_SERVICES_HUB_DETAIL (HealthServicesHubScreen — routes **HealthServicesHub** or **MedicalServicesList**, same component) ===

**Role:** Cross-health **launcher**: pharmacy, hospital/clinic, laboratory, blood bank — plus **unified search** and optional **nearby duty pharmacy** strip.

**Header (pink gradient):** back ; title/subtitle santé ; **119** (or fallback **112**) **emergency call** button → \`Linking.openURL(tel:)\`.

**Unified search bar:** free text ; **onSubmit** \`handleSearch\` routes by keywords → **PharmacieSearch**, **HopitalSearch**, **LaboratoireSearch**, **BanqueSangSearch**, or default **HopitalSearch**.

**Tiles (horizontal cards):** each opens a dedicated search route — **PharmacieSearch**, **HopitalSearch**, **LaboratoireSearch**, **BanqueSangSearch** (counts from \`servicesCounts\` when loaded).

**Duty pharmacy block:** loads via **GET** \`/api/pharmacies/products/search\` with \`query: 'garde'\`, optional GPS + radius ; tap can call pharmacy phone.

**Note:** \`MedicalServicesList\` is a **navigation alias** to this screen. The component **does not** read \`route.params.filters\` today — service-led filters from **HopitalSearch** that target **MedicalServicesList** are **not** applied inside this hub in current code; use **HopitalList** / **HopitalHome** flows for structured hospital/service discovery.

**Hard rules:** Do not describe this hub as **PharmacieHome** (product catalog) or as **HopitalHome** (medical services availability list) — it is the **entry hub** only.
`;
    }

    if (onHospitalPartnerDashboard) {
      prompt += `

=== HOSPITAL_PARTNER_DASHBOARD_DETAIL (authoritative — **HopitalFormScreen**, route **HopitalForm**) ===

**Rôle:** tableau de bord **partenaire** hôpital / clinique / centre de santé (\`usePartnerData(..., 'hopital')\`). Distinct des écrans **patient** (**HopitalHome**, **HopitalSearch**, **HopitalList**, **HopitalDetails**).

### Accès & chargement
- Init si \`user.role === 'partenaire'\` **et** \`user.partner_type === 'hopital'\` : **GET** \`/api/partners/me\` (préremplit nom, adresse, téléphone, email, ville) ; **GET** \`/api/hopitaux\` — le code retient **\`hospitals[0]\`** comme \`hospitalData\`, active le dashboard, fixe \`service_id\` Yukpo si besoin, puis **\`loadAnalytics(hid)\`**, **\`loadConsultations()\`**, **\`loadEmergency(hid)\`** avec \`hid = hospitalData.id || hospitalData.service_id\`.
- Mode **\`edit\` + \`specializedServiceId\`** : **GET** \`/api/hopitaux/{specializedServiceId}\` pour préremplir le formulaire + \`planning_prestations\`.
- **Création service Yukpo:** effet si \`!serviceId\` et \`formData.nom\` → **\`servicesApi.createService\`** (\`category: 'sante'\`).

### Modes d’affichage
- **Dashboard** si agence chargée **ou** (\`partenaire\` **et** \`serviceId\`) : header gradient rouge, **5 onglets** — **overview** | **service** | **slots** | **analytics** | **team**.
- **Création** (sinon) : en-tête + **\`renderServiceForm\`** uniquement (pas d’onglets créneaux/stats/équipe).

### Onglet **Service**
- **POST** \`/api/hopitaux\` via \`handleSubmit\` : \`service_id\`, \`nom\`, \`type_etablissement\`, \`adresse\`, \`quartier\`, \`gps\` (**ModernGPSModal** ou **LocationContext**), \`prestations_medicales\`, \`planning_prestations\` (sélection **PrestationSelectorWithSchedule**), \`urgences_disponible\`, \`rdv_en_ligne\`, contacts.
- **Partenaire:** champs **nom, adresse, téléphone, urgence, WhatsApp, email** sont **masqués** (\`user?.role !== 'partenaire'\`) — édition surtout **type**, **GPS**, **quartier**, **switches** urgences / RDV en ligne.

### Onglet **Créneaux** (\`slots\`)
- **PrestationSelectorWithSchedule** : liste \`PRESTATIONS_OPTIONS\` + planning par prestation (\`scheduleByDay\` / \`timeSlots\`), \`allowCustom\`.

### Onglet **Stats** (in-app)
- Affiche \`analyticsData\` issu de **GET** \`/api/hopitaux/{hid}/analytics\` (champs utilisés : \`total_consultations\`, \`consultations_7d\`, \`avg_wait_time_min\`, \`occupancy_rate\`).
- Carte « IA » : bouton **HospitalAIRecommendations** avec **\`hospitalId\`** si résolu (\`resolveHospitalEntityId()\`) + \`serviceId\` optionnel.

### Onglet **Équipe**
- **ServiceTeamManager** (\`serviceId\` string).

### Accueil (**overview**)
- Stats calculées : prestations, créneaux, **GET** \`/api/hopitaux/my-consultations\` (compteur + aperçu), temps d’attente depuis \`analyticsData\`.
- **GET** \`/api/hopitaux/{hid}/emergency-status\` → carte statut urgences (affichage basé sur \`formData.urgences_disponible\` + RDV ligne).
- **Identifiant API hôpital** : \`resolveHospitalEntityId()\` = \`Number(hospitalData?.id ?? hospitalData?.service_id)\` si fini ; utilisé pour analytics / urgence / navigation **HospitalAnalytics** / **HospitalAIRecommendations**.
- Actions rapides : onglet créneaux, **HospitalAIRecommendations** (\`hospitalId\` si dispo + \`serviceId\`), **HospitalAnalytics** (\`hospitalId\` obligatoire — **Alert** si fiche non résolue), **Service**, **WalletFinancial**, déconnexion.

### Écrans liés (navigation depuis le dashboard)
- **HospitalAnalyticsScreen** : param **\`hospitalId\`** pour **GET** \`/api/hopitaux/{hospitalId}/analytics\` — le dashboard passe **\`hospitalId: resolveHospitalEntityId()\`** depuis l’overview (quick action **Statistiques**).
- **HospitalAIRecommendationsScreen** : symptômes + \`hospitalService.getAIRecommendations\` ; \`hospitalId\` / \`serviceId\` en params quand connus ; bouton **géoloc** = **TODO** (Alerte placeholder).

**Hard rules:** Ne pas confondre **\`service_id\`** (service Yukpo) et **\`id\`** hôpital API pour les routes **\`/api/hopitaux/{id}/…\`**. Pour « comment un patient prend RDV », renvoyer vers **HopitalDetails** / **BookAppointment**, pas ce dashboard.
`;
    }

    if (onHospitalModule) {
      prompt += `

=== HOSPITAL_MODULE_DETAIL (authoritative — match **CURRENT SCREEN** name) ===

**Flow map (user confusion):**
- **HopitalHome** = **live medical offerings** near the user when **GPS + internal availability path**: \`hospitalService.searchAvailableMedicalServices\` (list of establishments with \`available_services\`, distance, 24h, blood bank flag). **Without** GPS (or when not using that path), search can **navigate** to **HopitalList** with \`serviceType\` text (list screen primarily expects \`filters\` object — align UX with **HopitalSearch** for reliable establishment filters).
- **HopitalSearch** = **filters form** (ville/quartier optional in types, **GPS** \`ModernGPSModal\`, distance, type établissement, prestation, urgences, disponible, **advanced**: spécialités multi, banque sang, urgences 24h, RDV en ligne, assurances). If **prestation** or first **spécialité** is set → navigate **MedicalServicesList** (same screen as **HealthServicesHub**) with \`{ filters }\` (hub UI ignores params in current code). Else → **HopitalList** with \`filters\` → **GET** \`/api/hopitaux/search\`.
- **HopitalList** = cards (nom, type, dispo, **urgences** badge, ville, distance, téléphones) → **HopitalDetails** (\`hospitalId\`).
- **HopitalDetails** = full **Doctolib-style** fiche: hero (badges ouvert, urgences, banque sang, RDV en ligne, vérifié, notes), quick actions (appel, WhatsApp, **Chat Yukpo**, **RDV** if \`rdv_en_ligne\` → \`handleBook\` **POST** \`/api/hopitaux/{id}/book\`, email, site), **urgences** phone + **emergencyStatus** + **waitTimes** (\`hospitalService\`), prestations chips, **IA symptômes** (\`hospitalService.searchPathology\`), full buttons **Réserver RDV** (if online booking), **Recommandations IA** → **HospitalAIRecommendations** (\`hospitalId\`), **Mes consultations** → **MyConsultations**, **Analytics** if owner → **HospitalAnalytics** (\`hospitalId\`), **ProductCommentsSection** + **ChatModalMobile**.

### HopitalHome (prestations / disponibilité)
- Header gradient **red/orange**: back ; title **Hôpitaux** + subtitle **Recherche de prestations médicales** ; **brain** button opens **AIModal** (pathology mode).
- **Search + autocomplete** (debounced): \`hospitalService.searchMedicalServices\` ; select row or submit: if **useAvailability** (state, default true) **and** **GPS** → \`searchAvailableMedicalServices\` (50 km) ; else → **HopitalList** + \`serviceType\`.
- Quick actions: **Analyser image** → \`imageAnalysisService.analyzeHospitalImage\` (JPEG via **expo-image-manipulator**) inside **AIModal** ; **Recherche pathologie** opens same modal.
- **AIModal:** pathology text → \`aiSearchPathology\` (**useAIWithFallback**) ; optional **Évaluer / triage** style flow via \`hospitalService.getAIRecommendations\` from inline handler (**Alert**).
- **Sort** bar → modal (pertinence, prix, distance, nom).
- **Result cards** (\`MedicalServiceAvailability\`): **Prendre RDV** → \`hospitalService.bookAppointment\` ; **Attente** → \`getWaitTimes\`.

### HopitalSearch & HopitalList
- See flow map above ; establishment search API **\`/api/hopitaux/search\`** with query params built from \`filters\`.

### Partner: HopitalFormScreen
- When the user is **on** **HopitalForm**, use **HOSPITAL_PARTNER_DASHBOARD_DETAIL** (authoritative). This bullet is for readers on **other** hospital screens only: partner dashboard has 5 tabs (**overview**, **service**, **slots**, **analytics**, **team**), **PrestationSelectorWithSchedule**, **ServiceTeamManager**, **ModernGPSModal**, toggles, consultations; navigation to **HospitalAnalytics** / **HospitalAIRecommendations** uses **\`hospitalId\`** from \`hospitalData.id ?? hospitalData.service_id\` when available.

### BookAppointmentScreen
- Params: \`serviceId\`, \`serviceType\` **hopital** | **laboratoire** ; loads **GET** \`/api/hopitaux/{id}/available-slots?date=\` (or lab equivalent) ; user picks slot, patient fields, confirms booking via API.

### MyConsultationsScreen
- Logged-in list: \`hospitalService.getMyConsultations\` with **status filters**, pagination, pull refresh ; **navigate** to **HopitalDetails** from a row when relevant.

### HospitalAIRecommendationsScreen
- Symptoms text (+ optional location fields) ; **login required** ; \`hospitalService.getAIRecommendations\` ; results may link to **HopitalDetails** ; **GPS button** in UI is placeholder (TODO).

### HospitalAnalyticsScreen
- **GET** \`/api/hopitaux/{hospitalId}/analytics\` ; requires login ; partner/owner context expected.

**Hard rules:**
- **RDV** on **HopitalDetails** is primarily **in-place booking** (\`POST .../book\`) when \`rdv_en_ligne\` ; **BookAppointment** is the **slot-picker** flow when navigated with params — do not merge the two UIs.
- **Recommandations IA** on the detail screen is a **separate** full screen (**HospitalAIRecommendations**), not the same modal as **HopitalHome** pathology search.
- For “liste des hôpitaux avec filtres”, point to **HopitalSearch** → **HopitalList**, not **HopitalHome** alone.
`;
    }

    if (onMenuPlanningModule) {
      prompt += `

=== MENU_PLANNING_MODULE_DETAIL (authoritative — menu / meal planning vertical) ===

**Client API:** \`menuPlanningService\` (\`mobile/src/services/menuPlanningService.ts\`). Types: \`FamilyProfile\`, \`WeeklyMenu\`, \`DailyMeal\` (\`petit_dejeuner\`, \`repas_du_jour\` fusion midi/soir, legacy \`dejeuner\`/\`diner\`), \`ShoppingList\`, \`GeneratedRecipe\`.

### Endpoints used in app code
- **POST** \`/api/menus/ai/generate-week\` — body: \`week_start\` (date string), \`profile_override\` (partial profile), optional \`current_gps\` (**\`"lat,lng"\`** string).
- **GET** \`/api/menus/my-week\` optional \`?week_start=\`.
- **GET** + **PUT** \`/api/menus/family-profile\`.
- **POST** \`/api/menus/ai/generate-recipe\` — \`recipe_name\`, \`servings\` (default 4 in service).
- **POST** \`/api/menus/shopping-list\` + **GET** \`/api/menus/shopping-list\` — \`week_start\`.
- **POST** \`/api/menus/ai/generate-shopping-list\` — \`meal_items\` (recipeName, times, servings, day, mealType), \`family_members\`, \`adults_count\`, \`children_count\`.
- **GET** \`/api/menus/history\` — optional \`?limit=\` (Hub uses **10**).
- **POST** \`/api/menus/ai/suggest-recipes\` — implemented in **service only**; **no screen calls it** in current codebase.

### MenuPlanningHub (**MenuPlanningHubScreen**, route **MenuPlanningHub**)
- **On focus:** load **GET** family profile + **GET** \`my-week\` + **GET** \`history(10)\`; pull-to-refresh repeats profile + history.
- **Generate menu:** **blocked** without family profile → Alert → **FamilyProfile**. Builds **Monday of current week** as \`week_start\`; sends profile fields + optional **live GPS** from \`getCurrentLocation\` / \`LocationContext\`.
- **UI period** (\`1_week\` | \`2_weeks\` | \`1_month\`): used for **labels** and passed as \`period\` to **MenuWeekCalendar** after success — **not** sent in **\`generateWeeklyMenu\`** payload (backend always receives the computed week start only).
- After generation: Alert → open **MenuWeekCalendar** with \`{ menu, period }\`; if a menu is already in state, card buttons → **MenuWeekCalendar** \`{ menu }\`, **ShoppingList** \`{ weekStart: menu.week_start }\`.
- **Recipe quick action:** **modal** + **useAIWithFallback** (\`cuisine_recette\`) wrapping **generateRecipe**; local stub recipe if IA unavailable; PDF via \`recipePdfGenerator\` (share / download helpers in screen).
- **Other quick actions:** **ShoppingList** (no params), **FamilyProfile**.
- **Header** profile shortcut → **FamilyProfile** (badge = \`total_members\` when > 0).
- **History lists:** tap **menu** row → **MenuWeekCalendar** with **\`weekStart\` only** — screen code still requires **\`params.menu\`** for the main UI (**spinner** if missing). Tap **shopping list** row → **ShoppingList** \`{ weekStart }\`.

### MenuWeekCalendar (**MenuWeekCalendarScreen**, route **MenuWeekCalendar**)
- **Params:** \`menu\` (**WeeklyMenu**) required for the implemented UI path.
- **Layout:** **table** vs **list**; rows = days; columns **petit_dejeuner** + **repas_du_jour** (cost for \`repas_du_jour\` already covers **midi + soir** in totals).
- **Cell / card tap:** opens recipe modal prefilled → **generateRecipe** (**no** \`useAIWithFallback\` here).
- **Export:** **generateAndDownloadMenuPDF** + **shareMenuPDF** (WhatsApp-oriented share).
- **Intelligent shopping list:** modal to review **mealItems** (editable counts / custom lines) → **generateIntelligentShoppingList** → editable list + **order** flow: check **userApi.getTokensBalance**; fees = subtotal + **15% service (cap 2000)** + **500** delivery estimate; **must** pick **market** (Google Places / \`LocationSelector\`); **deliveryApi.createDeliveryRequest** with \`parcel.type: 'shopping'\`, \`metadata.order_type: 'menu_shopping'\`; insufficient balance → **RechargeTokens**; success → **DeliveryShoppingTracking** \`{ deliveryId }\`.
- **Shopping list screen shortcut:** **ShoppingList** \`{ weekStart: menu.week_start }\`.
- **History icon:** navigates back to **MenuPlanningHub**.

### ShoppingList (**ShoppingListScreen**, route **ShoppingList**)
- **Params:** optional \`weekStart\`.
- Load: **getShoppingList(weekStart)**; if none, **generateShoppingList(weekStart)**.
- **Check item:** toggles **local state** only (**TODO** persist API in code comments).
- **Organize by store / aisle:** **local toggles** (**TODO** reorder API).
- **“Passer une commande marché”:** requires **GPS** → **deliveryApi.listSupermarkets** (10 km) → on success navigate **DeliveryShoppingFlow** with \`basketItems\` from list rows; else alerts.

### FamilyProfile (**FamilyProfileScreen**, route **FamilyProfile**)
- Load/save via **getFamilyProfile** / **updateFamilyProfile**; validation: **≥1** member, **≥1** adult, **≥1** cuisine style before save; chips for preferences, allergies, restrictions, cuisines, cooking level, budget, time available.

### RecipeSearch (**RecipeSearchScreen**, route **RecipeSearch**)
- Standalone recipe search: **generateRecipe** with client **~95s** timeout; recipe detail modal + recipe PDF helpers — **different** resilience story than Hub (no \`useAIWithFallback\`).

**Hard rules:** Do **not** merge this module with **SupermarketHome** / product catalog. Do **not** claim **2-week / 1-month** plans change the **generate-week** API contract until the app sends a period field. Mention **suggest-recipes** only as **unused** in UI today. For medical nutrition or severe allergy management, stay **informational** and recommend a **health professional**.
`;
    }

    if (onOrientationStudentModule) {
      prompt += `

=== ORIENTATION_SCOLAIRE_MODULE_DETAIL (authoritative — élève / famille ; **CURRENT SCREEN** name) ===

**Service client catalogue:** \`orientationScolaireService\` (\`mobile/src/services/orientationScolaireService.ts\`) → préfixe **\`/api/orientation-scolaire/\`**. **Profil / IA / analytics** : **\`/api/orientation/my-profile\`**, **\`/api/orientation/ai/*\`**, **\`/api/orientation/analytics\`**. L’écran **OrientationAIRecommendations** utilise en parallèle **\`orientationScolaireApi\`** (\`orientationScolaireApi.ts\`) pour profil + recommandations — mêmes concepts, couche API différente.

### Catalogue (endpoints alignés code)
- **Établissements:** **GET** \`/api/orientation-scolaire/etablissements/search\` (params: \`type_etablissement\`, \`ville\`, \`region\`, \`filiere\`, \`search\`, \`gps_lat\` / \`gps_lon\`, \`rayon_km\`, pagination) ; **GET** \`.../suggest\` ; **GET** \`.../{id}\` ; **GET** \`.../{id}/programmes\` ; **GET** \`.../{id}/fournitures\`.
- **Programmes:** **GET** \`/api/orientation-scolaire/programmes/search\` ; liste par établissement via route ci-dessus.
- **Concours:** **GET** \`/api/orientation-scolaire/concours/actifs\` ; **GET** \`/api/orientation-scolaire/concours/search\` ; **GET** \`.../concours/{id}\`.
- **Conférences:** **GET** \`/api/orientation-scolaire/conferences/programmees\` ; **GET** \`.../conferences/search\` ; **GET** \`.../conferences/{id}\`.
- **Rejoindre une conférence:** le **service** expose **POST** \`/api/orientation-scolaire/conferences/{id}/join\` (\`joinConference\`) ; l’écran **ConferencesLives** appelle en pratique **GET** \`.../conferences/{id}/join\` — ne pas affirmer une seule méthode sans vérifier l’écran.
- **Fournitures:** **GET** \`/api/orientation-scolaire/fournitures/search\` ; **GET** \`.../etablissements/{id}/fournitures\`.

### Profil étudiant
- **GET** \`/api/orientation/my-profile\` — **OrientationScolaireHub** (\`apiGet\`) et **ProfilEtudiant** / **Home** via \`getMyProfile\`.
- **POST** \`/api/orientation/my-profile\` — persistance profil : méthode exportée **\`createOrUpdateMyProfile\`** dans le service ; **ProfilEtudiantScreen** invoque encore **\`createOrUpdateProfile\`** via cast (\`(orientationScolaireService as any)\`) — même endpoint métier, nom legacy côté écran.

### IA orientation (backend \`/api/orientation/ai/\`)
- **POST** \`analyze-profile\` — body \`{ profile_id }\` (**Hub** et écrans qui passent l’id chargé).
- **POST** \`recommendations\` — **Home** : \`student_profile_id\`, \`type_etablissement\` (dérivé de \`selectedType\` ou défaut **superieur**), filtres optionnels budget / localisation.
- **POST** \`compare-programs\` — **OrientationAIComparePrograms** (deux établissements + filières / spécialités).
- **POST** \`academic-search\` — **Home** : question libre + contexte ; **useAIWithFallback** (\`orientation_academic\`) avec repli texte local si IA indisponible.
- **POST** \`generate-recommendation\` — appelé depuis **ProfilEtudiantScreen** après saisie (flux distinct des autres écrans).

### OrientationScolaireHub (**OrientationScolaireHubScreen**)
- **Profil:** **GET** \`/api/orientation/my-profile\` au focus ; cartes IA **analyse** → **POST** \`/api/orientation/ai/analyze-profile\` (succès → **Alert**).
- **Recommandations** (bouton) : **pas** d’appel API direct — navigation vers **EtablissementSearch** si profil présent.
- **Comparer** → **OrientationAIComparePrograms** si profil.
- Tuiles **primaire / secondaire / supérieur** → **EtablissementSearch** avec \`params.type\`.
- Raccourcis **ConcoursList** / **ConferencesList** / **ProgrammesList** / **FournituresList** (= alias vers **ConcoursEntree**, **ConferencesLives**, **ProgrammesScolaires**, **FournituresScolaires**).

### OrientationScolaireHome (**OrientationScolaireHomeScreen**)
- **5 onglets:** \`etablissements\` | \`programmes\` | \`concours\` | \`conferences\` | \`fournitures\` — chaque onglet recharge via le service (search / listes).
- **Onglet établissements:** **GET** \`.../etablissements/search\` avec **\`partner_type: 'etablissementscolaire'\`**, \`search\` texte optionnel, **GPS** → \`rayon_km: 50\` quand position dispo.
- **Modal / en-tête IA:** analyse profil, recommandations (**POST** recommendations), comparaison (navigation ou modal selon UI), **recherche académique** (**academicSearch** + fallback).
- **Transcription audio profil:** **ProfilEtudiant** → **POST** \`/api/ia/transcribe\` (hors module orientation pur).

### EtablissementSearch (**EtablissementSearchScreen**)
- **GET** \`/api/orientation-scolaire/etablissements/search\` avec query params (\`type_etablissement\` depuis \`route.params.type\`, ville, région, filière, pagination) — **sans** le filtre \`partner_type\` du **Home** (parcours hub / type scolaire).

### CreateEtablissement (**CreateEtablissementScreen**)
- **Écran partagé:** parcours **partenaire** (ex. depuis **OrientationPartnerDashboard**) **et** création fiche établissement côté orientation ; décrire les **actions visibles** plutôt que « uniquement élève » ou « uniquement partenaire ».

**Hard rules:** **Ne pas** confondre **OrientationPartnerDashboard** avec ce module. **Ne pas** prétendre que le hub envoie **POST recommendations** sur le bouton « recommandations » — c’est une **navigation**. Pour **join** conférence, citer la **dualité GET écran / POST service** si l’utilisateur parle d’API.
`;
    }

    if (onOrientationPartnerDashboard) {
      prompt += `

=== ORIENTATION_PARTNER_DASHBOARD_DETAIL (authoritative — partenaire établissement scolaire) ===

**Écran:** **OrientationPartnerDashboardScreen**, route **OrientationPartnerDashboard** (\`AppNavigator.optimized.tsx\` — partenaire \`etablissementscolaire\` / alias config).

### Données
- **GET** \`/api/orientation/etablissements/mine\` — corps réponse attendu : programmes (\`programs\` ou \`formations\`), **\`inscriptions_count\`** pour la tuile inscriptions.

### UI (code)
- **Onglets:** **overview** | **programs** | **students** | **analytics** (libellés FR dans l’UI : accueil, Programmes, Étudiants, Stats).
- **Overview:** grille stats (nombre de programmes, actifs, places disponibles agrégées, inscriptions) ; **actions rapides** — **CreateEtablissement** (\`mode: 'edit'\` ou création), **OrientationScolaireHub** (hub **public / élève**), **OrientationAIRecommendations**, **ProgrammesList**, **WalletFinancial**, déconnexion.
- **Programs:** liste des programmes retournés par **mine** ; bouton ajout → **CreateEtablissement** avec \`tab: 'programs'\`.
- **Students / Analytics:** onglets présents dans le fichier ; détail des API dédiées = vérifier l’implémentation écran si l’utilisateur pose une question précise (ne pas inventer d’endpoints non lus dans le code).

**Hard rule:** Le hub **OrientationScolaireHub** ouvert depuis ce dashboard reste le **même écran** que pour un élève — l’utilisateur **change de contexte de navigation**, pas de « mode partenaire » automatique sur le hub.
`;
    }

    if (onPharmacyModule) {
      prompt += `

=== PHARMACY_MODULE_DETAIL (authoritative — follow per current screen name) ===

**Critical distinction (user confusion):**
- **PharmacieHome** = **multi-pharmacy product catalog** (search \`pharmacyProductService.searchProducts\`: text query, GPS radius, availability, price filters). Users browse **medications/products** with distance/stock context — **not** a plain list of pharmacy shop names only.
- **PharmacieSearch → PharmacieList** = **pharmacy establishment search** (API \`/api/pharmacies/search\` from the app list screen): filters like **on duty**, **available**, optional **product_search** in navigation params, GPS + **max distance** in the UI, advanced chips (type, services, delivery). Tap row → **PharmacieDetails**.

### PharmacieHome (catalog)
- **Header:** back ; title **Pharmacie** ; subtitle = **count of available medications** when loaded ; **filter** icon (**sliders**) with **badge** = number of active advanced filters (price min/max, radius < default, “only available”).
- **Main search row:** text field **search medications** + **submit search** (magnifier) + clear **X** when non-empty.
- **Quick chips:** **Near me** (radius 10 km), **Available** (stock filter), **Lowest price** (sets sort to ascending price).
- **Sort row:** opens **modal** — relevance, price ↑/↓, nearest (**distance_km** on cards), name A–Z (client-side sort).
- **“Assistant IA Pharmacie”** (expandable): **Analyze medication photo** (camera/gallery → \`imageAnalysisService.analyzePharmacyImage\`, result shown as IA reply) ; **suggestion chips** (tap fills question + send) ; **free-text question** + send → \`askPharmacyQuestion\` with context from **first visible product names** ; **IA response** area + **new question** reset.
- **Product cards:** open **detail modal** ; on card: **Posologie IA** (\`getDosageRecommendation\`), **Interactions** (\`checkDrugInteractions\` for that product), **check availability / reserve** for the **linked pharmacy** (\`checkAvailability\`, \`reserveMedication\`).
- **Modals:** advanced **filters**, **sort**, medication **details**, **dosage**, **interactions**.

### PharmacieSearch (find establishments / refine product-led search)
- **Gradient header** + back.
- **AI features banner** → opens **PharmacyAIFeatures** (explains IA aids: interactions, dosage, budget-oriented product help, etc.).
- **Quick search cards:** product-oriented shortcut (opens advanced section), **on-duty pharmacy** preset, **near me** preset (tightens distance + availability).
- **Primary form:** **product / medication name** field (priority path) ; optional **GPS** via **ModernGPSModal** ; **max distance** stepper ; toggles **on duty only**, **pharmacies with available stock** ; expandable **advanced filters** (pharmacy type classic/guard/24h, service tags e.g. vaccination, **home delivery** switch).
- **Search CTA** → **PharmacieList** with \`route.params.filters\` (product-led branch sets \`product_search\` when filled).

### PharmacieList
- **FlatList** of pharmacy **cards**: name, **Disponible / Indisponible**, **De garde** badge, city/quarter, optional **distance** and **phone**.
- Tap → **PharmacieDetails** (\`pharmacieId\`). Empty state → back / **new search**.

### PharmacieDetails (single pharmacy)
- **Hero:** back, **share**, name, description, badges **open/closed**, **on duty**, **verified**, **24/7**, **rating** + review count, address line.
- **Quick actions** (when data exists): **Call**, **WhatsApp**, **Chat** (in-app **ChatModalMobile**, login required), **Email**, **Website**.
- **Hours** + on-duty notice ; **emergency phone** row if set ; **services** chips.
- **Search medication in this pharmacy:** field + modal → **checkAvailability** → if available: stock, price, **prescription required** flag, **Reserve**.
- **IA block:** **Interactions** modal (add several drug names → **checkInteractions**, severity + alternatives) ; **Conseils santé** (**contextual AI tips** for this pharmacy).
- **Mes commandes** → **MyPharmacyOrders** (logged-in). If **owner** → **PharmacyAnalytics** entry.
- **Reviews:** **ProductCommentsSection** inline.

### PharmacieForm (partner)
- **Existing pharmacy:** dashboard tabs **overview**, **service**, **products**, **analytics**, **team** — manage pharmacy profile (GPS, hours, guard days, services), **product/stock** CRUD, **bulk import**, orders, **ServiceTeamManager**, stats.
- **Creation / edit mode** (route \`mode\`): guided form with autosave, **LocationSelector**, **GuardDaysSelector**, prestations.

### MyPharmacyOrders / PharmacyAnalytics
- **MyPharmacyOrders:** client **order history** for pharmacy purchases (\`pharmacyService.getMyOrders\`), filters by status, pull to refresh, pagination.
- **PharmacyAnalytics:** **owner-only** analytics for a given \`pharmacyId\` (authorization checked against pharmacy **user_id**), periods 7d/30d/90d.

### PharmacyAIInteractions (stack — mainly partner)
- Full-screen **interactions / dosage** tooling (not the same as the **modals** on **PharmacieDetails**). Typically opened from **PharmacieForm** (quick action **IA Interactions** or test buttons with optional \`serviceId\`).

**Hard rules for answers:**
- “Where is on-duty pharmacy / pharmacy near me (shop, not product)?” → **PharmacieSearch** (on-duty toggle + GPS/distance) then **PharmacieList**, not only **PharmacieHome**.
- “Where to find medicine X near me / who has stock?” → **PharmacieHome** product search + **near me** / sort by distance **and/or** product-led flow from **PharmacieSearch**.
- Never invent buttons (e.g. a separate **PharmacyAIInteractions** route on details) — interactions are **modals on PharmacieHome cards** and **PharmacieDetails** section.
`;
    }

    if (onImmobilierModule) {
      prompt += `

=== IMMOBILIER_MODULE_DETAIL (authoritative — match **CURRENT SCREEN** name) ===

**API client (shared):** \`immobilierService\` → **GET** \`/api/immobilier/biens\` (\`searchProperties\`), **GET** \`/api/immobilier/biens/:id\`, **POST** \`/api/immobilier/biens/:id/book-visit\`, **POST** \`/api/immobilier/biens/:id/simulate-loan\`, **POST** \`/api/immobilier/ai/price-estimate\`, **POST** \`/api/immobilier/ai/recommendations\`, **POST** \`/api/immobilier/compare\`, favorites, **GET** \`/api/immobilier/my-alerts\`, etc. Hôtellerie client: **HotelBookingScreen** uses hotel booking APIs (e.g. \`bookHotelStay\` — see code).

### ImmobilierHome (**ImmobilierHomeScreen**)
- **Not** the same as **ImmobilierSearch** (no point/zone/quartier modes here). This is the **main catalog**: **search bar** + **submit**, **quick filter chips** (statut, distance, “récent” → sort), **advanced FiltersModal**, **SortModal**, **list/grid** toggle.
- **Data:** \`immobilierService.searchProperties\` with pagination (\`page\`, \`limit\` 20), filters from state (types alignés formulaire: maison, appartement, terrain, bureau, local_commercial, **hotel**, **meuble**), \`initialFilter\` from \`route.params\` can pre-set e.g. hôtel/meublé.
- **Header:** back ; title reflects \`filters.type_bien\` (Hôtels / Meublés / Immobilier) ; **+** → **ImmobilierForm** (\`mode: 'create'\`) ; **sliders** → filters modal (badge = active filter count).
- **Per-card actions:** **Favori** (\`addToFavorites\` / \`removeFromFavorites\` + AsyncStorage mirror) ; **Estimer** → **useAIWithFallback** \`estimatePropertyPrice\` → **Alert** (not the same code path as **ImmobilierDetails** \`estimatePrice\`) ; **Visite** → **Alert** then **bookVisit** with **next day** date, **10:00**, type **\`en_personne\`** (no navigation to **ImmobilierBooking**) ; **Partager** → \`shareProperty\` + system Share ; **Simuler prêt** (if \`prix_vente\`) → **local modal** \`calculateLoan\` (duration/rate chips) — **not** \`simulateLoan\` API used on this screen.
- Tap card → **ImmobilierDetails** (\`propertyId\`) + \`trackPropertyView\` (\`source: 'search'\`).

### ImmobilierSearch → ImmobilierList
- **ImmobilierSearch:** modes **point GPS**, **zone carte** (\`search_zone\` polygon string), **quartiers** multiples ; **ModernGPSModal**, **RealEstateAIFeatures** ; search navigates to **ImmobilierList** with \`route.params.filters\`.
- **ImmobilierList:** **GET** liste via \`searchProperties(filters)\` from params. **Sélection** max **5** biens → bar **Comparer** → **ImmobilierCompare** (\`propertyIds\` array). Tap card (sans mode sélection) → **ImmobilierDetails**. Pull to refresh.

### ImmobilierDetails
- Load **\`getPropertyDetails\`**, favoris, optional **virtual tours** API.
- **Hotel / meublé** (\`type_bien\` **hotel** ou **meuble**): primary CTA **Réserver un séjour** → **HotelBooking** ; sinon **Réserver une visite** → **ImmobilierBooking**.
- Quick actions: **call / WhatsApp** if numbers ; favoris ; **ShareServiceModal**.
- **Simuler un prêt** (if \`prix_vente\`): modal → **\`simulateLoan\`** API (apport %, durée, revenu optionnel).
- **Estimation IA:** **\`estimatePrice\`** API (card “Obtenir estimation IA”).
- **Recommandations IA:** **\`getAIRecommendations\`** (budget derived from price).
- **ProductCommentsSection** ; **IntelligentChat** FAB. **trackPropertyView** on open.

### ImmobilierBooking
- Params: \`propertyId\`, optional \`propertyName\`. Fields: date, heure, **type visite** **Physique** / **Virtuelle** (strings) → **\`bookVisit\`**.

### ImmobilierCompare
- Params: \`propertyIds\` (required), \`comparisonName\`. **\`compareProperties\`** POST → horizontal comparison table ; column tap → **ImmobilierDetails**.

### ImmobilierPriceAlerts
- **\`getMyPriceAlerts\`** on focus. Toggle/delete actions currently **Alert placeholders** (backend toggle/delete not wired in UI — say “à venir” if asked).

### ImmobilierForm
- Partenaire / annonce : types & statuts alignés backend, médias, GPS / Places, création service (**\`servicesApi.createService\`** path in screen).

### Hôtel / meublé — **HotelMeubleHomeScreen** (routes **HotelMeubleHome**, **HotelSearch**, **MeubleSearch**)
- \`mode\` **hotel** | **meuble** from \`route.params.mode\` or \`initialFilter.type_bien\`.
- **\`searchProperties\`** with \`type_bien: mode\`, \`limit\` 20, optional **GPS** \`max_distance_km: 50\`, text **query**, ville, standing chips, \`prix_max\`, \`nb_chambres_min\`.
- Card tap → **ImmobilierDetails** ; **Réserver** → **HotelBooking** (dates **not** on this list — only on **HotelBooking**).

### HotelBooking
- **Séjour** pour un bien déjà choisi : dates, occupants, contact → **bookHotelStay** (see **HotelBookingScreen**). Optional **Payer maintenant** after success when applicable.

### HotelDashboard
- **Partenaire uniquement** — détail opérationnel : bloc **HOTEL_PARTNER_DASHBOARD_DETAIL** (ajouté au prompt quand \`CURRENT SCREEN\` = **HotelDashboard**).

**Hard rules:**
- Do **not** claim **ImmobilierHome** has buttons to **ImmobilierSearch**, **ImmobilierCompare**, or **ImmobilierPriceAlerts** unless another entry point (e.g. Home grid) is explicitly in scope — those are **separate routes**.
- **Visite** on **ImmobilierHome** ≠ **ImmobilierBooking** screen (different UX).
- **Estimation** on **ImmobilierHome** (\`estimatePropertyPrice\` hook) ≠ **ImmobilierDetails** (\`immobilierService.estimatePrice\`) — same domain, different implementation.
`;
    }

    if (screenName === 'HotelDashboard') {
      prompt += `

=== HOTEL_PARTNER_DASHBOARD_DETAIL (HotelDashboardScreen — partenaire hôtel / meublé — authoritative) ===

**Role:** Tableau de bord **gérant** pour biens **type_bien** hôtel ou meublé : chargement des biens et réservations, actions accueil, équipe limitée au **premier** \`service_id\` si plusieurs biens.

**Data load (focus / refresh):** en parallèle \`immobilierService.getMyHotelProperties()\` → **GET** \`/api/hotel/my-properties\` et \`getMyHotelReservations()\` → **GET** \`/api/hotel/reservations/my\`. Pull-to-refresh sur onglets **Réservations** et **Mes biens**.

**Header:** retour ; titre dashboard (libellé **hôtel** vs **meublé** selon \`user.partner_type\`) ; sous-titre = nombre de biens · clients **en séjour** ; bouton **scan** (droite) → **HotelQRScanner** (raccourci identique à l’action rapide Scanner).

**5 onglets (barre sous le header):** \`overview\` | \`reservations\` | \`properties\` | \`ai\` | \`team\`.

### Vue d’ensemble (\`overview\`)
- **Stats (4 cartes):** nombre de propriétés ; nombre total de réservations chargées ; **en séjour** = réservations avec \`checked_in_at\` renseigné et sans \`checked_out_at\` ; **revenus** = **somme des \`prix_total\`** sur **toutes** les réservations de la liste (pas de filtre période dans le code).
- **Actions rapides (grille):** **Ajouter un bien** → **ImmobilierForm** \`mode: 'create'\`, \`initialTypeBien\` = **meuble** si \`partner_type === 'meuble'\` sinon **hotel** ; **Nouvelle réservation** → ouvre **modal** (pas une route) ; **Scanner QR** → **HotelQRScanner** ; **IA Insights** → bascule onglet **IA** ; **Portefeuille** → **WalletFinancial** ; **Sortir** → **Alert** confirmation puis \`logout\` (**AuthContext**).
- **Arrivées en attente:** réservations avec \`reservation_status === 'confirmed'\` **et** pas de \`checked_in_at\` ; max 3 cartes puis lien **voir toutes** → onglet **Réservations**.
- **Clients en séjour:** liste des réservations \`checked_in_at\` && !\`checked_out_at\`.
- **État vide sans biens:** carte invitant à **Ajouter un bien**.

### Réservations (onglet \`reservations\`)
- **FlatList** de toutes les réservations ; carte = client, téléphone, badges **séjour** (terminé / en séjour / confirmé / annulé / en attente selon champs) et **paiement** (\`paid\` / \`fully_paid\` / \`partial\` / \`advance_paid\` / \`pending\` / défaut).
- **Check-in:** visible seulement si **\`reservation_status === 'confirmed'\`** et **pas** de \`checked_in_at\` → **POST** \`/api/hotel/reservations/{id}/check-in\` (\`checkInReservation\`).
- **Check-out:** si en séjour (\`checked_in_at\` && !\`checked_out_at\`) → confirmation **Alert** puis **POST** \`/api/hotel/reservations/{id}/check-out\` (\`checkOutReservation\`).
- **QR:** **HotelReservationQR** avec \`reservationId\`, \`propertyName\`.
- **Payer:** si statut paiement ≠ \`paid\` et ≠ \`fully_paid\` → **HotelBookingPayment** avec \`reservationId\`, \`montantTotal\` (\`prix_total\`), \`propertyName\`.

### Mes biens (\`properties\`)
- Carte par propriété : badge hôtel/meublé, **disponible / complet** (\`is_available_now\`), adresse, chambres, prix nuit ou vente.
- **Modifier** → **ImmobilierForm** \`mode: 'edit'\`, \`propertyId\`, \`serviceId\`.
- **IA tarifs** (libellé UI) → **\`getPropertyAIInsights(propertyId)\`** — **GET** \`/api/hotel/properties/{propertyId}/ai-insights\` — **not** \`getAIPropertyPricing\` / \`getAIUnitPricing\` on this screen.

### IA (\`ai\`)
- Texte d’intro puis liste des biens ; appui → même **\`getPropertyAIInsights\`** ; affichage si succès : blocs **pricing_suggestion**, **occupancy_forecast**, **recommendations** (sinon JSON brut / stringify).
- Si **aucun bien**, message invitant à ajouter un bien d’abord.

### Équipe (\`team\`)
- **ServiceTeamManager** avec \`serviceId={properties[0]?.service_id?.toString()}\` — **un seul** service (celui du **premier** bien listé). Si **0 bien**, \`serviceId\` est **indéfini** : l’onglet équipe n’est pas utilisable pour rattacher une équipe tant qu’aucun bien n’existe.

### Modal « Nouvelle réservation »
- Ouverture depuis action rapide ou état vide réservations. **Obligatoire:** choisir une **propriété** (chips), nom + téléphone client, dates **arrivée / départ** (format saisi type AAAA-MM-JJ dans les placeholders), adultes / enfants / chambres, **prix par nuit**, notes optionnelles, email optionnel.
- **\`prix_total\`** / \`montant_total\` calculés client-side : **nuits** × **prix_nuitee** × **nombre_chambres** (\`manual_reservation_source: 'dashboard'\`).
- Envoi : **POST** \`/api/hotel/reservations/manual\` via \`createManualReservation\`.

**APIs hôtel présentes dans \`immobilierService\` mais sans écran de blocage dans ce fichier:** \`createManualBlockage\`, \`listManualBlockages\`, \`deleteBlockage\` — **ne pas** les présenter comme accessibles depuis **HotelDashboardScreen** actuel.

**IntelligentChat:** FAB masqué si la modal nouvelle réservation est ouverte ; contexte envoie \`userData\` (role, partner_type, name) et \`serviceData\` agrégé depuis les biens.

**Hard rules for answers:**
- Ne pas confondre **demande client** (\`/api/hotel/reservations/request\`, **HotelBooking**) avec **réservation manuelle gérant** (\`/api/hotel/reservations/manual\`).
- **Check-in** n’apparaît pas pour les réservations simplement « en attente » non confirmées — le code exige **\`confirmed\`** sans check-in.
`;
    }

    if (screenName === 'Home' || screenName === 'HomeScreen') {
      prompt += `

=== HOME_SCREEN_DETAIL (authoritative for Yukpo Home / Accueil) ===

**Role of this screen:** Central hub for **AI search** (needs login), **creating products/services** as a provider (photo/text via AI), **quick entry to every specialized service** (always **user** flows: Search / Hub / Home — never partner Form/Dashboard from here), **promotions**, and shortcuts in the header.

**Header (fixed):**
- **Avatar:** opens **UserAvatarMenu** (profile navigation, **credits balance**, optional **weather** when a location is set).
- **Navigation icon:** opens **Navigation** (GPS Yukpo).
- **Center:** Yukpo wordmark.
- **Bike / delivery icon:** opens **Delivery** module (same as route \`Delivery\`).
- **Message bubble:** opens **ChatHistoryModal** (conversation list → **ChatModalMobile**). Red badge = unread count from **GET /api/chat/conversations** (plus refresh on focus / app resume / notification event).
- **Bell:** opens **NotificationHistoryModal**. Badge = server unread + **Coach IA** local reminders from **coachingNotificationService**.

**Mode switch (below header):**
- **🔍 Rechercher (default on every focus):** primary mode after each visit to Home.
- **Créer (product/service):** switches **ChatInputMobile** to creation placeholders and submit handler.

**ChatInputMobile (main block):**
- **Search mode:** user describes a need (text; images/media optional). Submit calls **rechercherServices** → navigates to **ResultatBesoin** with normalized results. **Not** the standalone **RechercheBesoin** screen. Errors surface as localized **Alert** (timeout, network, auth, HTTP).
- **Create mode:** submit calls **genererSuggestionsService**. If **GET /api/prestataire/services** found an existing active service → **AjouterProduitSimple** with **suggestionIA** + media/GPS payloads. If **no** service yet → **FormulaireYukpoIntelligent** with full **suggestion** object (service_data path preferred for rich product fields). User must be logged in.
- **GPS:** **onGPSPress** / location controls open **ModernGPSModal** (point or **zone** selection) feeding **gps_mobile / gps_fixe** into payloads and **selectedLocation** for header weather.

**Offres spéciales (gift button):** dropdown with horizontal cards → **FlashPromosActive**, **GlobalPromoCatalog**, **LivesList** (icons zap / bag / video).

**YukpoServicesQuickAccess:** six categories (Santé, Transport, Vie pratique, Bourse du livre, Assurance, Immobilier) covering **17 services**. Taps use **searchRoutes** mapping, e.g. Pharmacie→**PharmacieSearch**, Hôpital→**HopitalSearch**, Taxi→**TaxiSearch**, Covoiturage→**CovoiturageSearch**, Bourse du livre→**LivreScolaireHome**, Emploi→**OffresEmploiHub**, Menu→**MenuPlanningHub**, BayamSelam→**BayamSelamSearch**, Immobilier→**ImmobilierSearch**, Hôtel→**HotelSearch** with \`{ mode: 'hotel' }\`, Meublé→**MeubleSearch** with \`{ mode: 'meuble' }\`, etc. **Never** route casual users from Home into partner-only management screens.

**Assistant IA FAB:** rendered in **AppNavigator** (global). Quick actions like **Retour** / **Recherche** refer to stack/tab navigation, not internal Home controls.

**Answering guidelines:** Match explanations to the **actual** buttons/modals above. If user asks “how to search”, describe **mode Rechercher + send in ChatInputMobile + ResultatBesoin**. If “how to publish a product”, describe **mode Créer + existing vs new service split**. For “where are taxis/pharmacy”, point to **quick access grid** and the **Search** route names.

**Home + creation priorities:**
- When user asks how to create a **product or service/prestation**, always start with: go to **HomeScreen** and switch to **Create mode**.
- Explain this path is easier because AI guides form filling step by step from user input (text/media/GPS).
- Recommend **\`variation_prix\`** as default for variants (weight, volume, shoe size, package, duration, level of service, etc.) to avoid duplicate listings.
`;
    }

    if (screenName === 'Services' || screenName === 'MesServices') {
      prompt += `

=== MES_SERVICES_PRODUCTS_DETAIL (MesServicesScreen — authoritative) ===

**Route names (clarification):** The **bottom tab** label is “Mes services” but the React Navigation route is **\`Services\`**. The same component (**MesServicesScreen**) can also open via stack route **\`MesServices\`**. Tell users: *onglet Mes services en bas* = **Services**. Do **not** confuse with **ServicesDashboard** (autre écran tableau de bord création).

**What the screen shows:** A **product-first** dashboard: each row is a **product** from \`productsService.getProductsByService(serviceId)\` (Phase 4), with fallback parsing of legacy \`service.data.produits\`. Header title **“Produits”**. API: \`GET /api/prestataire/services\` then parallel product fetches. Cache 5 min + invalidation on \`service:refresh\`, \`product:created\`, \`product:updated\`.

**Header actions:** (1) **+** → ouvre directement le sélecteur vidéo local (**MesServices** avec \`openVideoSelector\`, modal-first). (2) **⚡** → pick product(s) → **CreateFlashPromo** (single or multi). (3) **Bike** → pick products → **GlobalDeliveryConfigModal**. (4) **Checkbox icon** → **bulk selection** + **BulkActionsBar** (mass activate/deactivate/delete). (5) **☰** → **SidebarNavigation** (same entries as legacy global menu: create product, media gallery, team via **ServiceProductSelector**, analytics **AnalyticsDashboard**, ads **PubliciteDashboard** / **CreatePublicite**, **VideoFeed**, **StartLive**, **VideoAnalytics**, **GlobalPromoSubmission**, flash promo selector, **Settings**, etc.).

**Body:** **Breadcrumbs** Home → Produits. **StatsCard** strip (totals / active / inactive / views) filters list. **Chips** Tous | Actif | Inactif. **FlashList** of **ServiceCardModern** cards: view/edit service (**FormulaireYukpoIntelligent** with \`fromMesServices\`), share (link \`yukpomnang.com/service/{id}\`), toggle status (**PATCH** toggle; reactivation may charge **1000 FCFA** tokens), delete (**DELETE**; blocked if backend reports multiple products rule), promotions (alert → **CreateFlashPromo** or form with \`focusPromotion\`), “voir produits” navigates to **MesProduits**. Footer buttons: **AnalyticsDashboard**, **MesProduits**, **Home**.

**Related screen:** **MesProduits** = **MesProduitsScreen** — deeper per-product tools (gallery, delivery modal, etc.). It **complements** this tab; the **primary** “Mes services” hub is here.

**Creation priority rule (very important):**
- For creating a new product/service, guide users first to **HomeScreen** in **Create mode** (ChatInputMobile), because it offers the easiest intelligent assistance.
- In creation guidance, explicitly recommend **\`variation_prix\`** for variants (weight, volume, size, shoe size, packaging, etc.) to avoid duplicate product sheets.
- Preferred strategy: **one product sheet + variants**, instead of many near-identical products.

**Hard rules:** When the user asks where to manage products after publishing, point to the **Mes services** tab (internal name **Services**, component **MesServicesScreen**) or pile route **MesServices**. **Do not** tell them to use pile route **ServicesActivity** (legacy ServicesScreen). Never claim the tab opens **RechercheBesoin** or **PharmacieHome**.
`;
    }

    if (onDeliveryOrderModule) {
      prompt += `

=== DELIVERY_ORDER_MODULE_DETAIL (authoritative — order/tracking delivery screens) ===

**Scope:** user flow for parcel and shopping delivery: **DeliveryHome**, **DeliveryParcelFlowNew**, **DeliveryShoppingFlowNew**, **ShoppingBasket**, **ShoppingBudget**, **ShoppingSummary**, **DeliveryShoppingTracking**, **DeliveryProof**.

**Practical orientation by screen:**
- **DeliveryHome:** choose between parcel flow and shopping flow.
- **DeliveryParcelFlowNew:** set parcel type + weight/dimensions + pickup/dropoff + optional insurance, then confirm.
- **DeliveryShoppingFlowNew:** choose store, build basket, set budget and delivery address, then summary/confirm.
- **ShoppingBasket / ShoppingBudget / ShoppingSummary:** iterative order preparation and validation.
- **DeliveryShoppingTracking:** real-time progress timeline, courier contact/call, basket review.
- **DeliveryProof:** delivery proof capture/confirmation (photo/signature as configured).

**How to explain “smart delivery config” benefits:**
- faster order preparation with guided steps;
- better budget control before confirmation;
- transparent tracking with courier contact;
- fewer delivery errors thanks to structured address and proof flow.

**Hard rules:** do not confuse **customer delivery order** screens with **CourierDashboard** or **FleetDashboard** partner operations.
`;
    }

    if (serviceData) {
      const sName = serviceData.nom || serviceData.name || serviceData.titre || '';
      const sPrice = serviceData.prix || serviceData.price || '';
      const sDesc = serviceData.description || '';
      const products = serviceData.products || serviceData.produits || [];
      if (sName || sDesc || products.length > 0) {
        prompt += `\nSERVICE/PRODUCT DATA:\n`;
        if (sName) prompt += `Name: ${sName}\n`;
        if (sPrice) prompt += `Price: ${sPrice} FCFA\n`;
        if (sDesc) prompt += `Description: ${sDesc.substring(0, 200)}\n`;
        if (products.length > 0) {
          prompt += `Products (${products.length}): ${products.slice(0, 5).map((p: any) => `${p.nom || p.name}${p.prix ? ` (${p.prix} FCFA)` : ''}`).join(', ')}\n`;
        }
      }
    }

    if (history.length > 0) {
      prompt += `\nRECENT CONVERSATION:\n${history.slice(-3).map(msg => `${msg.isUser ? 'USER' : 'ASSISTANT'}: ${msg.text}`).join('\n')}`;
    }

    // Creation / management (Home-specific onboarding is in HOME_SCREEN_DETAIL — keep this for form & catalog screens)
    const homeCreationScreens = ['formulaire intelligent', 'ajout rapide produit', 'catalogue produits', 'services', 'mes services', 'dashboard prestataire', 'gestion produits', 'accueil'];
    if (homeCreationScreens.some(s => screenName.includes(s))) {
      prompt += `\n\nPRODUCT/SERVICE CREATION & MANAGEMENT CONTEXT:

FROM HOME (summary — details in HOME_SCREEN_DETAIL if screen is Home):
- Toggle **Create** mode → **ChatInputMobile** → AI suggestions → either **formulaire intelligent complet** (first business) or **formulaire d'ajout rapide** (existing service).
- This HomeScreen flow is the **recommended default** for users because it guides form filling more intelligently and simply.

FIRST-TIME BUSINESS (formulaire intelligent complet):
- Google Business auto-import when available; multi-step intelligent form: general info → contacts → GPS → products (variants) → visual identity (logo/banner) → payment methods (MoMo, Orange Money, card, cash…).

SUBSEQUENT PRODUCTS (formulaire d'ajout rapide):
- Photo/text → AI pre-fill; variants supported.
- Promote **\`variation_prix\`** (weight, volume, shoe size, packaging, etc.) to manage variants without duplicating products.

CATALOG MANAGEMENT:
- **Onglet Services (hub produits moderne):** liste produits moderne, cartes, bulk, sidebar, flash/livraison/vidéo — hub principal "Mes services".
- **Catalogue détaillé par produit:** catalogue détaillé par produit (filtres, stats mini, cartes, menu ⋮) — **pas d’import CSV sur cet écran**.
- Edit, variants, activate/deactivate, duplicate, bulk import, stats, orders, promos.

IMPORTANT: On **Home**, do not tell users to open **ServicesDashboard** or **RechercheBesoin** as the primary flows — search uses **ChatInputMobile → ResultatBesoin**; creation uses the **Create** toggle + forms above. The **Mes services** tab route is **\`Services\`**, not \`MesProduits\` alone.`;
    }

    const hotelMeubleUserHubScreens = ['HotelMeubleHome', 'HotelSearch', 'MeubleSearch'];
    if (hotelMeubleUserHubScreens.includes(screenName)) {
      prompt += `

=== HOTEL_MEUBLE_USER_HUB_DETAIL (HotelMeubleHomeScreen — liste recherche, autoritaire) ===

**Même composant** pour les routes **HotelMeubleHome**, **HotelSearch**, **MeubleSearch** (alias dans le navigateur). Mode **hotel** vs **meuble** : \`route.params.mode\` ou \`initialFilter.type_bien\`, défaut \`hotel\`.

**Ce que l’écran ne fait pas :** aucun calendrier ni dates de séjour sur cette liste. Les **dates** (format attendu sur **HotelBooking**) et le détail des **occupants** se saisissent sur **HotelBooking** après le bouton **Réserver** sur une carte.

**API :** \`immobilierService.searchProperties\` → **GET /api/immobilier/biens** avec \`type_bien\` \`hotel\` ou \`meuble\`, \`limit\` 20, \`page\` 1, filtres optionnels \`query\`, \`ville\`, \`standing\`, \`prix_max\`, \`nb_chambres_min\`. Si la position Yukpo (**LocationContext**) est disponible : \`lat\`, \`lng\`, \`max_distance_km: 50\`.

**UI :** barre recherche (validation clavier recherche) ; filtres en-tête : ville, chambres minimum, budget max ; chips standing : Tous, Économique, Standard, Bon standing, Haut standing, Luxe / Prestige. **FlatList** avec pull-to-refresh : appui sur la carte → **ImmobilierDetails** (\`propertyId\`) ; CTA **Réserver** → **HotelBooking** (\`propertyId\`, \`propertyName\`, \`typeBien\`, \`prixNuitee\`, \`ville\`).

**Règles pour l’IA :** ne pas inventer de filtres par dates sur cet écran ; ne pas affirmer que l’utilisateur choisit les voyageurs ici — tout ça est sur **HotelBooking**. Distinguer ce hub (client) du **HotelDashboard** (partenaire / gérant).
`;
    }

    if (screenName === 'HotelBooking') {
      prompt += `

=== HOTEL_BOOKING_DETAIL (HotelBookingScreen — formulaire client, autoritaire) ===

**Rôle :** demande de réservation pour **un bien déjà choisi** (arrivée depuis la liste hôtel/meublé ou équivalent). Paramètres route : \`propertyId\` (obligatoire), \`propertyName\`, \`typeBien\` (\`hotel\` / \`meuble\`), \`prixNuitee\`, \`ville\`.

**Champs UI :** deux champs texte **arrivée / départ** (placeholder AAAA-MM-JJ) — parsés avec \`new Date()\` : doivent être valides et départ **strictement après** arrivée. **Adultes** (minimum 1), **enfants** (minimum 0), **chambres** (minimum 1) via **steppers +/-**. **Nom** et **téléphone** obligatoires à l’envoi ; **email** et **notes** optionnels. Bloc **estimation** affiché seulement si \`prixNuitee > 0\` et nuits calculées : \`prixNuitee × nombre de nuits × nombre de chambres\` (nuits = différence en jours, minimum 1).

**Soumission :** bouton **Envoyer la demande** → \`immobilierService.bookHotelStay\` → **POST /api/hotel/reservations/request** (property_id, date_arrivee, date_depart, nombre_adultes, nombre_enfants, nombre_chambres, nom_client, telephone_client, email optionnel, prix_nuitee/prix_total optionnels, notes optionnelles).

**Après succès :** alerte de confirmation ; bouton **Payer maintenant** vers **HotelBookingPayment** **uniquement si** la réponse fournit un \`reservationId\` (ou id réservation) **et** \`prixTotal > 0\`. Sinon l’utilisateur ferme avec OK. **Ne pas** promettre un paiement systématique avant envoi réussi.

**Règles IA :** il n’y a **pas** de sélecteur de chambre catalogue sur cet écran — un seul bien (\`propertyId\`). Ne pas confondre avec **ImmobilierBooking** (visite bien classique). Tarification IA / QR gérant = **HotelDashboard** (partenaire), pas cet écran.
`;
    }

    if (screenName === 'AssuranceDashboard') {
      const sid =
        serviceData?.service_id ??
        serviceData?.serviceId ??
        (typeof serviceData?.service_id === 'number' ? serviceData.service_id : undefined);
      const sidLine =
        sid !== undefined && sid !== null && String(sid) !== ''
          ? `**service_id (route)** transmis au chat : \`${sid}\` — utilisé à la création produit (\`createProduct\`). Si la valeur est 0, le comportement exact côté API doit rester prudent dans les réponses.`
          : '**service_id** : lu depuis \`route.params.serviceId\` ou \`service_id\` — nécessaire pour rattacher un **nouveau produit** au service partenaire.';

      prompt += `

=== ASSURANCE_PARTNER_DASHBOARD_DETAIL (AssuranceDashboardScreen — partenaire, autoritaire) ===

**Rôle :** tableau de bord **prestataire assurance** (gestion produits, polices émises, traitement sinistres, stats). **Ce n’est pas** l’écran **client** (**MesPolicesAssurance**, **DeclarationSinistre**, recherche catalogue **InsuranceServicesSearch**).

**Chargement (useFocusEffect) :** \`Promise.allSettled\` sur **GET** \`/api/assurance/products\`, **GET** \`/api/assurance/policies\`, **GET** \`/api/assurance/claims\`, **GET** \`/api/assurance/dashboard/stats\` (\`assuranceService.listProducts\`, \`listPolicies\`, \`listClaims\`, \`getDashboardStats\`). Un échec partiel vide la liste concernée sans bloquer les autres.

**5 onglets :** Accueil | Produits | Polices | Sinistres | Stats (libellés UI traduits partiellement).

**Accueil :** cartes stats (produits actifs, polices actives, sinistres ouverts = déclarés + en instruction + en expertise, souscriptions). Bannières cliquables : polices **à renouveler** → onglet Polices ; sinistres **déclarés** en attente → onglet Sinistres. **Actions rapides :** ouvrir modal nouveau produit ; aller onglet Polices / Sinistres ; **InsuranceQuoteRequest** (« Devis IA ») ; **WalletFinancial** ; déconnexion (logout). Aperçus des 3 derniers sinistres / polices.

**Produits :** **POST** \`/api/assurance/products\` (\`createProduct\`) avec \`service_id\` + \`nom_produit\` obligatoire (alerte sinon) ; champs optionnels (type, sous-catégorie, compagnie, description, primes, couverture max, franchise, âges, durée mois). **POST** \`/api/assurance/products/{id}/toggle\` pour actif/inactif. Pas d’édition inline liste dans ce fichier (seulement toggle + création).

**Polices :** liste **GET** \`/api/assurance/policies\`. Si statut **active** uniquement : boutons **Suspendre** / **Résilier** → **PUT** \`/api/assurance/policies/{id}/status\` avec \`statut\` \`suspendue\` ou \`resiliee\` (motif texte pour résiliation). **Pas** de formulaire « émettre police » sur cet écran — le raccourci « Émettre police » ne fait que changer d’onglet.

**Sinistres :** **Analyse IA** → **POST** \`/api/assurance/claims/{id}/ai-analyze\` (\`aiAnalyzeClaim\`) ; alerte avec score fraude, action recommandée, justification. **Instruire** (si statut \`declare\`) → **PUT** \`/api/assurance/claims/{id}/status\` → \`en_cours_instruction\`. Si \`en_cours_instruction\` ou \`expertise_en_cours\` : **Approuver** → \`approuve\` ; **Refuser** → \`refuse\` avec \`motif_refus\` (Alert.prompt si dispo, sinon alerte avec motif par défaut traduit). Si \`approuve\` : **Indemniser** → \`indemnise\` avec \`montant_indemnise\` = parseFloat(\`montant_reclame\`) ou 0.

**Stats :** réutilise \`dashStats\` (produits, polices dont \`ca_total\` optionnel, sinistres + totaux réclamé/indemnisé si présents).

**En-tête :** icône **recherche** → navigation **InsuranceServicesSearch** (parcours utilisateur / marché), pas la gestion interne partenaire.

${sidLine}

**Règles IA :** ne pas décrire ce dashboard comme « mes polices assuré » ou « déclarer mon sinistre » par défaut — réservé au **partenaire**. Pour « trouver une assurance », orienter vers **InsuranceServicesSearch** ou la grille accueil. Distinguer APIs **partenaire** (products/policies/claims/dashboard) des APIs **IA devis** (\`/api/assurance/ai/*\`) et **search** **GET** \`/api/assurance/search\` (catalogue public).
`;
    }

    // Covoiturage-specific context for driver AND passenger
    const covoiturageScreens = ['CovoiturageHome', 'CovoiturageForm', 'CovoiturageDetails', 'CovoiturageBooking', 'CovoiturageSearch', 'CovoiturageList', 'CovoiturageIntelligentSearch', 'MesReservationsCovoiturage', 'MyTrips'];
    if (covoiturageScreens.some(s => screenName.includes(s) || screenName.includes('Covoiturage'))) {
      const isDriver = mobilityDriverValidated(userData, userRole);
      const homeNote = onCovoiturageHome
        ? `**CovoiturageHome** layout is authoritative in **COVOITURAGE_HOME_DETAIL** above. Cross-screen module context:\n\n`
        : '';
      prompt += `\n\nCOVOITURAGE SERVICE CONTEXT:
${homeNote}Role: ${isDriver ? 'DRIVER/PARTNER (validated driver profile — can publish via CovoiturageForm)' : 'PASSENGER (searches & books trips)'}
${isDriver ? `DRIVER / PUBLISHER (code-aligned):
- **CovoiturageForm** (\`mode: 'create' | 'edit'\`): publish or edit a trip ; requires **service_id** linked to user (otherwise redirect **GestionServicesSpecialises**).
- **CourierRegistration** with \`applicationType: 'driver'\` when becoming a driver from home header.
- Trip fields include places, price per seat, vehicle info, baggage/pets/smoking/AC flags (see \`CreateCovoiturageRequest\`).
- After successful **createCovoiturage**, UI returns to search mode on home.` : `PASSENGER (code-aligned):
- **CovoiturageHome**: LocationSelector depart/destination + date → **searchCovoiturages** → cards → **CovoiturageDetails** or **CovoiturageBooking**.
- **CovoiturageBooking**: optional **InsuranceSelector** (basic / premium / full) → POST \`/api/reservations/{id}/insurance\` when selected ; commission line shown in UI (e.g. 10% Yukpo).
- **MesReservationsCovoiturage**: track reservations.`}
Other routes: **CovoiturageSearch** / **CovoiturageList** / **CovoiturageIntelligentSearch** — alternate entry points, not the same UI as **CovoiturageHome**.
Payment: follow **CovoiturageBooking** (wallet / methods shown in-app).`;
    }

    // Taxi-specific context for driver AND passenger
    const taxiScreens = ['TaxiHome', 'TaxiForm', 'TaxiDetails', 'TaxiBooking', 'TaxiSearch', 'TaxiList', 'TaxiIntelligentSearch', 'TaxiTracking', 'TaxiAvailability', 'MesTaxis'];
    if (taxiScreens.some(s => screenName.includes(s) || screenName.includes('Taxi'))) {
      const isDriver = mobilityDriverValidated(userData, userRole);
      const homeNote = onTaxiHome
        ? `**TaxiHome** layout is authoritative in **TAXI_HOME_DETAIL** above. Cross-screen module context:\n\n`
        : '';
      prompt += `\n\nTAXI SERVICE CONTEXT:
${homeNote}Role: ${isDriver ? 'DRIVER/PARTNER (validated — can manage service via TaxiForm)' : 'PASSENGER (searches & books rides)'}
${isDriver ? `DRIVER / PRESTATAIRE (code-aligned):
- **TaxiForm** (\`mode: 'create' | 'edit'\`): vehicle, tariffs (\`tarif_base\`, \`tarif_par_km\`), payments flags (cash, mobile money, card), AC/WiFi, zone, GPS courant.
- Requires **service_id** ; otherwise alert → **GestionServicesSpecialises**.
- **CourierRegistration** for new drivers from home.` : `PASSENGER (code-aligned):
- **TaxiHome**: GPS-filled depart when possible, IA **recommendations** + **demandPrediction** before first search, then **searchTaxis** with depart coords / ville, filter **availableOnly**.
- **TaxiBooking**: pickup/destination context, optional **InsuranceSelector** (basic/premium/full) same pattern as covoiturage booking API.
- **TaxiDetails** from cards ; **tel:** via **Linking**.
- **TaxiTracking** for live follow-up after booking.`}
Do **not** claim every screen has 3-tab TaxiForm unless user is on **TaxiForm** — verify current route.`;
    }

    const busTicketFollowupScreens = ['BusTicketBooking', 'BusTicketPayment', 'BusTicketDetails', 'MyBusTickets', 'BusTicketQR', 'BusTicketCredits', 'BusReturnRequests', 'BusReturnRequestForm'];
    if (busTicketFollowupScreens.includes(screenName)) {
      prompt += `\n\nBUS TICKET FLOW (suite — hors écrans recherche):
- **BusTicketBooking**: plan sièges (\`seat_map\` / sélection), récap, puis paiement.
- **BusTicketPayment**: tokens / mobile money / autres moyens selon UI.
- **BusTicketDetails**: fiche ligne/agence depuis **TicketVoyageHome** (ids produit/agence).
- **MyBusTickets**: billets achetés ; **BusTicketQR**: QR embarquement ; **BusTicketCredits** / retours (**BusReturnRequests**) : parcours annexes.
Prioriser l’écran courant ; la recherche se fait sur **TicketVoyageHome** ou **BusTicketSearch**.`;
    }

    // Emploi/Job-specific context for employer AND candidate (align with offreEmploiService + screens)
    const emploiScreens = [
      'OffresEmploiHome',
      'OffresEmploiHub',
      'OffresEmploiForm',
      'CreateOffre',
      'OffreDetails',
      'OffreList',
      'OffreSearch',
      'MesOffres',
      'OffreCandidatures',
      'AlertesEmploi',
      'ProfilCandidat',
      'AICVAnalysis',
      'AnalyseCV',
      'AISalaryPrediction',
      'AISuggestFormations',
    ];
    if (
      emploiScreens.includes(screenName) ||
      screenName.includes('OffreEmploi') ||
      (screenName.includes('Offre') &&
        !screenName.includes('BusTicket') &&
        !screenName.includes('AgenceVoyage'))
    ) {
      const isEmployer = isPartnerEmployerEmploi;
      prompt += `\n\nJOB/EMPLOYMENT SERVICE CONTEXT (code-aligned):
Employer flag in this prompt: **partenaire** with normalized \`partner_type\` ∈ {\`offre_emploi\` / \`offreemploi\`, \`recruteur\`, \`employeur\`} (also \`offres_emploi\` → \`offresemploi\`). The app **hub** can still show employer UI if the user has already published offers (API) — not inferred here.
${isEmployer ? `EMPLOYER / RECRUTEUR (APIs):
- Publish: **OffresEmploiForm** (hub/FAB) or **CreateOffre** (home +) — two different screens in code.
- **POST /api/offres-emploi** \`createOffre\` ; **GET /api/offres-emploi** \`getMesOffres\` ; **PATCH /api/offres-emploi/:id/close** ; **GET /api/offres-emploi/:id/candidatures** ; **PATCH /api/offres-emploi/candidatures/:id/statut** ; **GET /api/offres-emploi/:id/matching/candidats** ; **GET /api/offres-emploi/:id/stats**.
- Dashboard employeur: **GET /api/offres-emploi/dashboard/employeur**.
- **CreateOffre** IA pré-remplissage: **POST /api/yukpo** with \`type: 'creation_offre_emploi'\` + \`texte\` (natural language).` : `CANDIDAT (APIs):
- Search: **GET /api/offres-emploi/search** (\`searchOffres\`) — query, secteur, contrat, lieu, salaire, remote, GPS + \`rayon_km\`, pagination.
- Détail: **GET /api/offres-emploi/:id** ; matching list for score card: **GET /api/offres-emploi/matching/offres** (\`getMatchingOffres\`).
- Postuler: **POST /api/offres-emploi/candidatures** (\`createCandidature\`) — **OffreDetails** vérifie **GET /api/offres-emploi/profil** + \`cv_url\` avant envoi.
- Profil: **GET/POST /api/offres-emploi/profil** ; alertes: **GET/POST /api/offres-emploi/alertes**.
- IA: **POST /api/offres-emploi/ai/analyze-cv** ; **GET /api/offres-emploi/ai/salary-prediction** ; **POST /api/offres-emploi/ai/suggest-formations** ; **POST /api/offres-emploi/ai/matching** ; + fallbacks **useAIWithFallback** on some flows.
- Dashboard candidat: **GET /api/offres-emploi/dashboard/candidat**.`}
**Parcours écrans:** **OffresEmploiHub** (stats + raccourcis) ; **OffresEmploiHome** (liste + matching → **OffreList**) ; **OffreSearch** (filtres → **OffreList**) ; **OffreDetails** (score matching + postuler + lien **ProfilCandidat**) ; **MesOffres** / **OffreCandidatures** ; **AICVAnalysis** / **AnalyseCV** ; **AISalaryPrediction** ; **AISuggestFormations**.
${onOffresEmploiHome ? `**Current screen:** prioritize **OFFRES_EMPLOI_HOME_DETAIL** above.` : ''}${onOffresEmploiHub ? `**Current screen:** prioritize **OFFRES_EMPLOI_HUB_DETAIL** above.` : ''}`;
    }

    // Menu planning: MENU_PLANNING_MODULE_DETAIL + MENU_PLANNING_MODULE_MODE (onMenuPlanningModule).
    // Orientation scolaire: ORIENTATION_SCOLAIRE_MODULE_* (onOrientationStudentModule) + ORIENTATION_PARTNER_DASHBOARD_* (onOrientationPartnerDashboard).

    // Hotel/Meublé-specific context for partner AND user
    const hotelScreens = ['HotelDashboard', 'HotelMeubleHome', 'HotelSearch', 'MeubleSearch', 'HotelBooking', 'HotelBookingPayment', 'HotelQRScanner', 'HotelReservationQR', 'ImmobilierForm', 'ImmobilierDetails', 'ImmobilierSearch'];
    if (hotelScreens.some(s => screenName.includes(s) || screenName.includes('Hotel') || screenName.includes('Immobilier'))) {
      const isPartner = userRole === 'partenaire' || userData?.partner_type === 'hotel' || userData?.partner_type === 'meuble';
      prompt += `\n\nHOTEL/MEUBLÉ SERVICE CONTEXT:
Role: ${isPartner ? 'PARTNER/MANAGER (manages properties & reservations)' : 'USER/GUEST (searches & books accommodations)'}
${isPartner ? `PARTNER — HotelDashboardScreen (if user is on this route, full UI = HOTEL_PARTNER_DASHBOARD_DETAIL in main prompt):
- Parallel load: GET /api/hotel/my-properties + GET /api/hotel/reservations/my
- Tabs: overview | reservations | properties | ai | team
- Overview: 4 stat cards; quick actions (+ bien → ImmobilierForm create with initialTypeBien; nouvelle réservation → modal → POST /api/hotel/reservations/manual; scan → HotelQRScanner; IA tab; WalletFinancial; Sortir → logout)
- “Arrivées en attente” = confirmed && !checked_in_at; check-in only in that case; check-out after check-in; QR → HotelReservationQR; pay → HotelBookingPayment if not paid/fully_paid
- Property card “IA tarifs” + IA tab: getPropertyAIInsights (GET .../ai-insights), not getAIPropertyPricing in this screen
- Team: ServiceTeamManager serviceId = first property’s service_id only; no calendar blockage UI in HotelDashboardScreen (state showBlockageModal unused)
` : `USER/GUEST FEATURES:
- SEARCH HUB (HotelMeubleHome / HotelSearch / MeubleSearch — same HotelMeubleHomeScreen): text query + ville + min chambres + budget max + standing chips (Économique, Standard, Bon standing, Haut standing, Luxe / Prestige). Optional GPS: lat/lng + max_distance_km 50. **No date filters on this list** (full detail in HOTEL_MEUBLE_USER_HUB_DETAIL when that block is in the prompt).
- PROPERTY CARDS: title, location, rooms, standing, distance if returned, price/night, rating, disponible badge when applicable
- BOOKING (HotelBooking): stay dates (AAAA-MM-JJ placeholders), adults/children/rooms (+/-), contact (name+phone required), optional email/notes; submit → POST /api/hotel/reservations/request via bookHotelStay; price estimate = prixNuitee × nights × rooms when nightly price known
- PAYMENT: Optional immediate navigation to HotelBookingPayment from success alert only when reservation id returned and total > 0; otherwise manager confirmation flow — HotelBookingPayment supports MTN MoMo, Orange Money, Visa/Mastercard (see payment screen)
- DETAILS: tap listing card → ImmobilierDetails (propertyId)`}
Payment methods: MTN MoMo, Orange Money, Visa/Mastercard, Cash. Commission: 5% on transactions.
Key screens: HotelMeubleHome / HotelSearch / MeubleSearch (user listing), HotelBooking, HotelBookingPayment, HotelDashboard (partner), ImmobilierForm, HotelQRScanner (QR verification)`;
    }

    // Bourse du Livre / Coursier Livres context
    const bookScreens = ['BookPackages', 'BookUploadV2', 'BookRecapV2', 'BookBuyDirect', 'LivreScolaireHome', 'LivreScolaireSearch', 'LivreScolaireDetails', 'LivreScolaireForm', 'LivreScolaireList', 'MesLivres', 'MesBesoinsLivres', 'ProgrammeBesoinsSelector', 'MesTrocs', 'TrocMatching', 'TrocDetails', 'TrocLiveValidation', 'NewBooks', 'AdminProgrammeUpload', 'AdminDonations', 'BourseLivre'];
    if (bookScreens.some(s => screenName.includes(s) || screenName.includes('Livre') || screenName.includes('Troc') || screenName.includes('BookPackage') || screenName.includes('Bourse'))) {
      const isCourier = userRole === 'coursier' || userData?.is_courier || screenName.includes('courier') || screenName === 'BookPackages';
      const isLibraire =
        ['librairie', 'libraire', 'livrescolaire', 'livre_scolaire'].includes(
          String(userData?.partner_type || '').toLowerCase(),
        ) || screenName.includes('AdminProgramme');
      prompt += `\n\nBOURSE DU LIVRE / TROC SCOLAIRE CONTEXT:
Role: ${isCourier ? 'COURSIER (livre les paquets de livres scolaires)' : isLibraire ? 'LIBRAIRE/PARTENAIRE (vend des livres neufs, gère une équipe)' : 'UTILISATEUR (troc, achat, vente de livres scolaires)'}

${isCourier ? `COURSIER — GUIDE COMPLET DE LIVRAISON LIVRES:

\uD83D\uDE9A TON DASHBOARD (BookPackages mode courier):
- Onglet "Paquets": tous tes paquets actifs avec référence (ex: BL-A1B2), statut, livres
- Chaque paquet a un bouton d'action pour avancer le statut: constitué → en_route → livré → confirmé
- Les adresses expéditeur/destinataire sont affichées sur chaque carte

\uD83D\uDCCD MES STOPS (courier/my-stops):
- Vue itinéraire groupée par ARRÊT (lieu physique)
- Chaque stop = 1 personne à visiter, avec:
  * Son nom et téléphone
  * L'adresse GPS
  * La liste des PAQUETS à récupérer/livrer (groupés par référence)
  * Le QR CODE contextuel à montrer/scanner
  * Instructions précises: "Montrez ce QR à [Nom] pour récupérer 3 paquet(s)"
- Les stops PICKUP (récupération) viennent en premier, puis les DELIVERY (livraison)

\uD83D\uDCE6 IDENTIFICATION DES PAQUETS:
- Chaque paquet a une RÉFÉRENCE unique (ex: BL-A1B2, CH42-3-7-20260318)
- Le QR code contient la référence + liste des livres → le libraire scanne et voit immédiatement quel paquet préparer
- Pour identifier un paquet physique: chercher l'étiquette avec la référence BL-XXXX

\uD83D\uDD04 WORKFLOW DE LIVRAISON:
1. Ouvrir "Mes stops" → voir l'itinéraire complet
2. Stop PICKUP: aller chez l'expéditeur/libraire → montrer le QR → récupérer les paquets
3. Vérifier: nombre de livres correspond au paquet? Référence correcte?
4. Stop DELIVERY: aller chez le destinataire → faire scanner le QR → remettre les paquets
5. Le statut se met à jour automatiquement après scan QR

⛓️ CHAÎNES DE TROC:
- Une chaîne = plusieurs transferts entre utilisateurs (A→B, B→C, C→A)
- Vue chaîne: voir tous les paquets avec QR pickup + QR delivery
- Route optimisée: les stops sont ordonnés pour minimiser le trajet

\uD83D\uDCB0 GAINS:
- Commission livraison: 80% des frais de livraison (Yukpo prend 20%)
- Gains visibles dans le dashboard coursier
- Paiement crédité au wallet après confirmation par le destinataire

❓ SI TU ES PERDU:
- "Quel est mon prochain stop?" → regarde le premier stop non-complété dans "Mes stops"
- "C'est quoi ce paquet BL-XXXX?" → cherche la référence dans tes paquets actifs
- "Combien de livres dans ce paquet?" → ouvre le détail du paquet, les livres sont listés
- "Le libraire ne trouve pas le paquet" → montre-lui le QR, il contient la référence et la liste des livres` :

          isLibraire ? `LIBRAIRE — GESTION D'ÉQUIPE ET COMMANDES:

\uD83D\uDC65 ÉQUIPE:
- Inviter des membres par téléphone: gestionnaire, préparateur, caissier
- Chaque membre peut scanner les QR des coursiers
- Les préparateurs reçoivent les notifications de nouvelles commandes
- Vue "Paquets en attente": liste des paquets à constituer physiquement

\uD83D\uDCE6 CONSTITUTION DES PAQUETS:
- Quand une commande arrive, elle apparaît dans "Paquets en attente" (statut: à_constituer)
- Ouvrir le détail du paquet: checklist des livres avec images recto/verso, titre, matière, classe
- Préparer physiquement les livres → marquer "constitué"
- Quand le coursier arrive, scanner son QR → le paquet passe en "en_route"

\uD83D\uDCDA LIVRES NEUFS:
- Publier des livres neufs en lot via "Publier livres neufs"
- Les livres apparaissent dans le catalogue public
- Comparaison prix neuf vs occasion automatique

\uD83D\uDCB0 COMMISSIONS: 5% sur chaque vente/troc` :

            `${onBookExchangeHome ? `NOTE — Sur l’accueil **LivreScolaireHome** / **BourseLivre**, la structure réelle est dans **BOURSE_DU_LIVRE_HOME_DETAIL** ; ce qui suit décrit les **autres** parcours (upload, troc, achat, dons, programme).\n\n` : ''}UTILISATEUR — TROC ET ACHAT DE LIVRES (flux du module):

\uD83D\uDCF8 ENVOYER DES LIVRES (BookUploadV2):
1. Activer le GPS (obligatoire — c'est le lieu de récupération par défaut)
2. Photographier RECTO puis VERSO de chaque livre
3. L'IA analyse automatiquement: titre, classe, matière, état, prix
4. Répéter pour chaque livre (max 20 par session)
5. Récapitulatif: choisir mode par livre (troc/vente/don)
6. Finaliser la session

\uD83D\uDD04 TROC:
- Matching automatique: l'IA trouve des livres qui correspondent à tes besoins
- Troc direct (2 personnes) ou chaîne (3+ personnes via algorithme DAG)
- Soulte: si les livres n'ont pas la même valeur, la différence est payée via wallet
- Commission Yukpo: 5% de la valeur reçue

\uD83D\uDED2 ACHAT DIRECT (BookBuyDirect):
- Parcourir les livres par classe/matière
- Acheter sans avoir de livre à échanger
- GPS livraison OBLIGATOIRE (utiliser la carte)
- Paiement: wallet, mobile money, ou espèces

\uD83C\uDF81 DONS:
- Certains livres sont en mode "don" → demander gratuitement avec un motif
- Validation par l'admin avant attribution

\uD83D\uDCCA PROGRAMMES SCOLAIRES:
- Vérifier si un livre est au programme officiel
- Comparer prix neuf vs occasion vs programme officiel`}

KEY SCREENS: LivreScolaireHome (accueil bourse), BookUploadV2 (envoyer livres), BookRecapV2 (récap session), BookPackages (paquets), MesLivres (mes livres), TrocMatching (matching), BookBuyDirect (achat direct), NewBooks (catalogue neufs)`;
    }

    // Financial / Recharge / Wallet context for users AND partners
    const financialScreens = ['RechargeTokens', 'WalletFinancial', 'SoldeDetail', 'PlatformPaymentSettings', 'PaymentHistory'];
    if (financialScreens.some(s => screenName.includes(s) || screenName.includes('Recharge') || screenName.includes('Wallet') || screenName.includes('Solde') || screenName.includes('Payment'))) {
      const isPartner = userRole === 'partenaire';
      prompt += `\n\nFINANCIAL / WALLET / RECHARGE CONTEXT:
Role: ${isPartner ? 'PARTNER (receives payments from customers, tracks revenue)' : 'USER (recharges account, pays for services)'}

${isPartner ? `PARTNER FINANCIAL FEATURES:
- WalletFinancial screen: Complete financial dashboard with KPIs (balance, credits, debits, refunds, net income), daily bar chart, transaction history with filters (7/30/90 days, credit/debit/refund)
- Revenue sources: Product sales (5% commission deducted), delivery earnings (20% commission), service bookings
- Payout: Earnings auto-credited to wallet after delivery confirmation or service completion
- Each transaction shows: type (credit/debit/refund), amount, date, description, trace ID, balance after
- Quick action: "Recharge" button → RechargeTokens screen
- Track: commissions, refunds, payouts, net income per period
- Tips: Increase sales by adding quality photos, competitive pricing, fast response times
- Wallet balance = sum of all credits minus all debits (real-time)` :

          `USER RECHARGE & WALLET FEATURES:
- RechargeTokens screen: 3-step wizard (1. Select amount → 2. Payment method → 3. Confirm)
- Predefined amounts: 1000 (no bonus), 2500 (+5% bonus = 125 extra), 5000 (+10% = 500 extra), 10000 (+20% = 2000 extra) XAF
- Custom amount: Enter any amount ≥ 100 XAF
- Payment methods (14 available):
  * Mobile Money Africa: MTN MoMo, Orange Money, Wave, Moov Money, Airtel Money, M-Pesa, Vodafone Cash, Free Money, Tigo Pesa, EcoCash
  * Cards: Visa/Mastercard (via CinetPay for Africa, Stripe for international)
  * International: PayPal, Stripe (Apple Pay, Google Pay)
  * Bank transfer (1-2 days processing)
- For Mobile Money: enter your phone number → confirm payment on your phone → tokens credited automatically
- For Cards/PayPal: redirected to secure payment page → tokens credited after confirmation
- Status check: "Vérifier le statut" button polls the server for payment confirmation
- Debt enforcement: If you have unpaid usage, minimum recharge = debt amount
- History: "\uD83D\uDCCA Historique" button → SoldeDetail screen (full transaction log)
- WalletFinancial: Detailed financial overview with charts, filters, period selection
- Balance displayed at the top of the screen in real-time`}

HOW TO RECHARGE (step by step):
1. Open RechargeTokens (via profile or when prompted)
2. Select a predefined amount OR enter a custom amount
3. Tap "Continuer" to choose payment method
4. Select your payment method (MTN, Orange, Wave, Visa, etc.)
5. For Mobile Money: enter your phone number
6. Tap "Continuer" then "Confirmer le paiement"
7. For Mobile Money: approve the payment on your phone when prompted
8. Tokens are credited automatically (with bonus if applicable)
9. Check "\uD83D\uDCCA Historique" to see all your transactions`;
    }

    prompt += `\n\nCRITICAL RULES:
- ${langInstr}
- CONCISE & IMPACTFUL: 2-4 sentences max, then suggest actions. No long paragraphs.
- MARKETING TONE: Present features as exciting innovations, not boring descriptions
- When mentioning a button/element, use its EXACT label
- Propose 2-3 concrete actions the user can do RIGHT NOW on this screen
- If the user asks "What is Yukpo?" or similar discovery questions, give a compelling 2-sentence pitch then suggest exploring key services via action buttons
- If the user seems lost, proactively explain the screen's purpose with enthusiasm
- NEVER say "I cannot see your screen" — you DO know what's on screen via the context above
- For partner/prestataire users, focus on business growth and revenue opportunities
- For regular users, focus on the WOW factor and unique value of each feature
- When suggesting navigation, always include the exact route so action buttons work
- RESPOND IN: ${activeLang} — this is mandatory, not optional
- ANTICIPATE the user's next logical questions and include them as follow-ups

GENERAL KNOWLEDGE & SMALL TALK:
- You are a REAL conversational partner, not a feature-only bot. If the user asks general questions (culture, geography, cooking, math, sports, news, life advice...), answer them NATURALLY with your full knowledge — like a smart friend would.
- After answering a general question, you MAY briefly bridge to a relevant Yukpo feature IF it fits naturally (e.g. "D'ailleurs, Yukpo a un module Menu qui peut t'aider à planifier tes repas 🍽️"). But NEVER force the bridge if it's unrelated.
- For greetings and small talk ("Salut", "Ça va?", "Comment tu t'appelles?"), respond warmly and humanly. You're Yukpo Assistant — you have a personality, opinions, and warmth. Don't jump straight into features.
- For emotional messages with no clear question ("Je suis triste", "J'ai passé une mauvaise journée"), show genuine empathy first. Only mention Yukpo if the user asks.
- NEVER say "Je suis une IA, je ne peux pas..." or "En tant qu'assistant Yukpo, je ne traite que...". You CAN answer anything.

RESPONSE FORMAT (JSON):
{
  "message": "Your concise, impactful response text here",
  "type": "text|action_suggestion|navigation_help|visual_guide",
  "suggested_actions": [{"id": "unique_id", "label": "Button Label", "icon": "icon-name", "route": "ScreenName", "category": "navigation|action|search|creation"}],
  "next_steps": ["Anticipated follow-up question 1?", "Anticipated follow-up question 2?", "Anticipated follow-up question 3?"],
  "confidence": 0.95
}`;

    // ═══ CROSS-SCREEN CONTEXT INJECTION ═══
    // When the user asks about a specific module from ANY screen, inject that module's
    // context so the AI can answer precisely — even from HomeScreen or unrelated screens.
    const crossScreenQuery = (userMessage || '') + ' ' + history.slice(-3).map(m => m.isUser ? m.text : '').join(' ');
    const cq = crossScreenQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const injectedScreens = new Set<string>();
    // Track which screens already have their DETAIL block injected
    if (onNavigationScreen) injectedScreens.add('Navigation');
    if (onProductHubScreen) injectedScreens.add('MesServices');
    if (onMesProduitsScreen) injectedScreens.add('MesProduits');
    if (onBookExchangeHome) injectedScreens.add('BourseLivre');
    if (onTicketVoyageHome) injectedScreens.add('TicketVoyage');
    if (onCovoiturageHome) injectedScreens.add('Covoiturage');
    if (onTaxiHome) injectedScreens.add('Taxi');
    if (onSupermarketHome) injectedScreens.add('Supermarket');
    if (onOffresEmploiHome || onOffresEmploiHub) injectedScreens.add('Emploi');
    if (onBloodTransfusionScreen) injectedScreens.add('BloodBank');
    if (onLaboratoryModule) injectedScreens.add('Laboratory');
    if (onHospitalModule || onHospitalPartnerDashboard) injectedScreens.add('Hospital');
    if (onPharmacyModule) injectedScreens.add('Pharmacy');
    if (onDeliveryOrderModule) injectedScreens.add('Delivery');
    if (onCourierDashboard) injectedScreens.add('Courier');
    if (onMenuPlanningModule) injectedScreens.add('MenuPlanning');
    if (onOrientationStudentModule || onOrientationPartnerDashboard) injectedScreens.add('Orientation');
    if (onAutoMarketplaceModule || onAutomobilePartnerDashboard) injectedScreens.add('Auto');
    if (onFleetDashboard) injectedScreens.add('Fleet');
    if (onSearchResultsScreen) injectedScreens.add('SearchResults');

    // Keyword → screen mapping for cross-screen detection
    const CROSS_SCREEN_RULES: Array<{ keywords: string[]; screen: string; label: string }> = [
      { keywords: ['navigation', 'gps', 'itineraire', 'marche libre', 'free walk', 'marche', 'walking', 'statistiques marche', 'stats marche', 'calories', 'coach ia', 'health score', 'score sante', 'fitness', 'checkpoint', 'radar', 'alerte communautaire', 'poi', 'vitesse', 'km parcourus', 'sessions marche'], screen: 'Navigation', label: 'Navigation GPS & Fitness' },
      { keywords: ['mes services', 'mes produits', 'produit', 'service', 'vendre', 'prestataire', 'ajouter produit', 'flash promo', 'promo', 'publicite', 'video creation', 'galerie media'], screen: 'MesServices', label: 'Mes Services / Produits' },
      { keywords: ['catalogue produit', 'gerer produits', 'mes produits', 'dupliquer produit', 'livraison produit'], screen: 'MesProduits', label: 'Catalogue Produits' },
      { keywords: ['livre scolaire', 'bourse du livre', 'troc livre', 'manuel scolaire', 'programme scolaire', 'librairie'], screen: 'BourseLivre', label: 'Bourse du Livre' },
      { keywords: ['bus', 'billet', 'ticket voyage', 'agence voyage', 'trajet bus', 'voyage interurbain'], screen: 'TicketVoyage', label: 'Tickets Voyage' },
      { keywords: ['covoiturage', 'trajet partage', 'partager trajet', 'conducteur covoiturage'], screen: 'Covoiturage', label: 'Covoiturage' },
      { keywords: ['taxi', 'commander taxi', 'course taxi', 'chauffeur taxi'], screen: 'Taxi', label: 'Taxi' },
      { keywords: ['supermarche', 'bayamselam', 'courses marche', 'comparer prix', 'catalogue supermarche'], screen: 'Supermarket', label: 'Supermarchés' },
      { keywords: ['emploi', 'offre emploi', 'cv', 'salaire', 'formation', 'recrutement', 'candidature', 'embauche'], screen: 'Emploi', label: 'Offres Emploi' },
      { keywords: ['sang', 'don de sang', 'transfusion', 'banque de sang', 'groupe sanguin', 'donneur'], screen: 'BloodBank', label: 'Banque de Sang' },
      { keywords: ['laboratoire', 'analyse', 'examen medical', 'imagerie', 'prise de sang', 'resultats labo'], screen: 'Laboratory', label: 'Laboratoires' },
      { keywords: ['hopital', 'clinique', 'medecin', 'rendez-vous medical', 'consultation', 'urgence', 'triage'], screen: 'Hospital', label: 'Hôpitaux' },
      { keywords: ['pharmacie', 'medicament', 'ordonnance', 'garde pharmacie', 'stock medicament'], screen: 'Pharmacy', label: 'Pharmacies' },
      { keywords: ['livraison', 'colis', 'envoyer colis', 'suivi livraison', 'course commission', 'panier courses'], screen: 'Delivery', label: 'Livraison' },
      { keywords: ['coursier', 'dashboard coursier', 'livraisons actives', 'devenir coursier'], screen: 'Courier', label: 'Dashboard Coursier' },
      { keywords: ['menu', 'repas', 'recette', 'planifier repas', 'liste de courses', 'regime', 'nutrition', 'famille repas'], screen: 'MenuPlanning', label: 'Menu Planning' },
      { keywords: ['orientation', 'ecole', 'inscription scolaire', 'choix ecole', 'etablissement scolaire', 'filiere'], screen: 'Orientation', label: 'Orientation Scolaire' },
      { keywords: ['automobile', 'voiture', 'vehicule', 'acheter voiture', 'piece auto', 'parking', 'garage'], screen: 'Auto', label: 'Automobile' },
      { keywords: ['flotte', 'gerer flotte', 'fleet', 'chauffeurs', 'demenagement'], screen: 'Fleet', label: 'Gestion Flotte' },
    ];

    const detectedCrossScreens: string[] = [];
    for (const rule of CROSS_SCREEN_RULES) {
      if (injectedScreens.has(rule.screen)) continue;
      if (rule.keywords.some(kw => cq.includes(kw))) {
        detectedCrossScreens.push(rule.screen);
        injectedScreens.add(rule.screen);
      }
    }

    if (detectedCrossScreens.length > 0) {
      prompt += `

=== CROSS-SCREEN CONTEXT (the user is asking about modules they are NOT currently on — use these DETAIL blocks to answer precisely) ===
NOTE: The user is currently on **${screenName}** but their question relates to: ${detectedCrossScreens.join(', ')}. Use the relevant DETAIL block(s) below to give a precise, authoritative answer as if you were on that screen. If the module has specific UI elements, buttons, or flows, describe them accurately. Also mention HOW to navigate to that screen from the current one.
`;

      if (detectedCrossScreens.includes('Navigation') && screenName !== 'Navigation') {
        prompt += `
=== NAVIGATION_GPS_DETAIL (cross-screen — user asked about Navigation/GPS/Fitness from ${screenName}) ===
**What this screen is:** Intelligent GPS inside Yukpo with route planning, community alerts, POI, Statistics & Fitness Dashboard, and free walk GPS sessions.
**How to access:** Tab bar → or search "Navigation" → NavigationScreen.
**2 access points to Stats:** (1) BarChart3 icon in header, (2) Coach IA preview card on main scroll.
**Period filters:** Aujourd'hui, Semaine, Mois, Trimestre, Semestre, Année.
**Modality filters:** Tout combiné (all modes), Détection auto (passive tracking), Marche libre (free walk only).
**Stats sections:** Summary tiles (km, sessions, cal, min) → Filtered session card (after free walk, with comparison chips: vs dernière, vs 2 dernières, vs ce mois) → Évolution détaillée table (Actuelle vs Dernière vs Record with % gaps) → Best session 🏅 → By travel mode → Performance & progression → Share button → Top visited places → Coach IA (health score, tips, gamification, records, challenges).
**Free walk end-of-session:** Auto-opens dashboard (period=Aujourd'hui, modality=Marche libre), shows evolution table, plays TTS audio recap (distance/duration/calories + comparison vs last + gap to best), share button prominent.
**Reading stats:** ↑ green = improvement, ↓ red = decline, → grey = stable. % deltas compare current vs baseline.
`;
      }

      if (detectedCrossScreens.includes('MesServices') && screenName !== 'Services' && screenName !== 'MesServices') {
        prompt += `
=== MES_SERVICES_PRODUCT_HUB_DETAIL (cross-screen — user asked about products/services from ${screenName}) ===
**What this screen is:** Prestataire hub to manage products/offers. ServiceCardModern list, stats (totals, actifs, inactifs, vues), filters (Tous/Actif/Inactif).
**How to access:** Tab bar "Services" or navigate to MesServices.
**Key actions:** Menu ☰ (sidebar with all options), + buttons (video, flash promo, delivery, bulk), add product (auto-detect if service exists).
**Product cards:** edit, promote, share, activate/deactivate, delete. Promotion creates flash promos or standard promotions.
`;
      }

      if (detectedCrossScreens.includes('MesProduits') && screenName !== 'MesProduits') {
        prompt += `
=== MES_PRODUITS_DETAIL (cross-screen — user asked about product catalog from ${screenName}) ===
**What this screen is:** Detailed product catalog for prestataire. Mini stats, filters (Tous/Actifs/En pause), action cards.
**How to access:** From MesServices footer → "Gérer mes produits" or via navigation.
**Per-card actions:** Modifier, Activer/Pause, Partager, Envoyer (interne), Plus → Promouvoir, Statistiques, Dupliquer, Livraison, Supprimer.
`;
      }

      if (detectedCrossScreens.includes('BourseLivre')) {
        prompt += `
=== BOURSE_DU_LIVRE_DETAIL (cross-screen — user asked about book exchange from ${screenName}) ===
**What this screen is:** Hub Bourse du Livre: sell/trade/donate school books, find official program lists.
**How to access:** Navigate to LivreScolaireHome or BourseLivre.
**Key flows:** (1) Green card "Mettez vos livres en circulation" → BookUploadV2, (2) Blue card "Trouvez votre liste scolaire" → ProgrammeBesoinsSelector.
**Dashboard:** track purchases, packages, trades, needs. QR scan for courier delivery validation.
`;
      }

      if (detectedCrossScreens.includes('Emploi')) {
        prompt += `
=== OFFRES_EMPLOI_DETAIL (cross-screen — user asked about jobs from ${screenName}) ===
**What this screen is:** Job search (candidate view) with AI-powered matching, CV analysis, salary prediction, training suggestions.
**How to access:** Navigate to OffresEmploiHome or OffresEmploiHub.
**Key features:** Search offers, AI matching score, apply, AI CV Analysis, AI Salary Prediction, AI Training Suggestions.
`;
      }

      if (detectedCrossScreens.includes('Delivery')) {
        prompt += `
=== DELIVERY_DETAIL (cross-screen — user asked about delivery from ${screenName}) ===
**What this screen is:** Order and track deliveries (parcels or shopping commissions).
**How to access:** Navigate to DeliveryHome.
**Flows:** Parcel delivery (DeliveryParcelFlowNew), Shopping commission (DeliveryShoppingFlowNew), real-time tracking, proof of delivery.
`;
      }

      if (detectedCrossScreens.includes('MenuPlanning')) {
        prompt += `
=== MENU_PLANNING_DETAIL (cross-screen — user asked about meal planning from ${screenName}) ===
**What this screen is:** AI-powered meal planning for families: menus, recipes, shopping lists, dietary profiles.
**How to access:** Navigate to MenuPlanningHub.
**Key features:** Family profile setup, AI menu generation, recipe details, shopping list generation, budget optimization.
`;
      }

      if (detectedCrossScreens.includes('Hospital')) {
        prompt += `
=== HOSPITAL_DETAIL (cross-screen — user asked about hospitals from ${screenName}) ===
**What this screen is:** Hospital/clinic module: search, AI triage, book appointments, consultations history, AI recommendations.
**How to access:** Navigate to HopitalSearch or HopitalHome.
`;
      }

      if (detectedCrossScreens.includes('Pharmacy')) {
        prompt += `
=== PHARMACY_DETAIL (cross-screen — user asked about pharmacies from ${screenName}) ===
**What this screen is:** Pharmacy module: search pharmacies, check stock, order medications, find pharmacies de garde.
**How to access:** Navigate to PharmacieSearch or PharmacieHome.
`;
      }

      if (detectedCrossScreens.includes('Taxi')) {
        prompt += `
=== TAXI_DETAIL (cross-screen — user asked about taxi from ${screenName}) ===
**What this screen is:** Taxi booking with AI dynamic pricing, GPS pre-filled origin, demand prediction.
**How to access:** Navigate to TaxiSearch or TaxiHome.
`;
      }

      if (detectedCrossScreens.includes('Covoiturage')) {
        prompt += `
=== COVOITURAGE_DETAIL (cross-screen — user asked about carpooling from ${screenName}) ===
**What this screen is:** Carpooling: search/offer rides, LocationSelector, publish via CovoiturageForm.
**How to access:** Navigate to CovoiturageSearch or CovoiturageHome.
`;
      }

      if (detectedCrossScreens.includes('Supermarket')) {
        prompt += `
=== SUPERMARKET_DETAIL (cross-screen — user asked about supermarkets from ${screenName}) ===
**What this screen is:** Supermarket catalog: 4 modes (stores, products, compare prices, promos).
**How to access:** Navigate to SupermarketHome or BayamSelamSearch.
`;
      }

      if (detectedCrossScreens.includes('BloodBank')) {
        prompt += `
=== BLOOD_BANK_DETAIL (cross-screen — user asked about blood bank from ${screenName}) ===
**What this screen is:** Blood donation & transfusion: search blood banks, register as donor, request blood, match donors.
**How to access:** Navigate to BanqueSangSearch.
`;
      }

      if (detectedCrossScreens.includes('Laboratory')) {
        prompt += `
=== LABORATORY_DETAIL (cross-screen — user asked about labs from ${screenName}) ===
**What this screen is:** Medical labs: search labs, book analyses, track results, AI analysis interpretation.
**How to access:** Navigate to LaboratoireSearch or LaboratoireHome.
`;
      }

      if (detectedCrossScreens.includes('Orientation')) {
        prompt += `
=== ORIENTATION_DETAIL (cross-screen — user asked about school orientation from ${screenName}) ===
**What this screen is:** School orientation AI: student profile, school catalog, AI recommendations, compare schools.
**How to access:** Navigate to OrientationScolaireHub or OrientationScolaireHome.
`;
      }

      if (detectedCrossScreens.includes('Auto')) {
        prompt += `
=== AUTO_DETAIL (cross-screen — user asked about automobile from ${screenName}) ===
**What this screen is:** Auto marketplace: search vehicles, parts, compare, filters (brand, price, type).
**How to access:** Navigate to AutoServicesSearch.
`;
      }

      if (detectedCrossScreens.includes('TicketVoyage')) {
        prompt += `
=== TICKET_VOYAGE_DETAIL (cross-screen — user asked about bus tickets from ${screenName}) ===
**What this screen is:** Bus ticket search & booking: LocationSelector, seat selection, QR boarding pass.
**How to access:** Navigate to TicketVoyageHome or BusTicketSearch.
`;
      }
    }

    return prompt;
  }

  /**
   * Parser la réponse de l'IA
   */
  private parseAIResponse(aiData: any, screenContext: ScreenContext): ChatResponse {
    const response: ChatResponse = {
      message: aiData.message || t('intelligentChat.error'),
      type: aiData.type || 'text',
      confidence: aiData.confidence || 0.8,
    };

    if (aiData.suggested_actions && Array.isArray(aiData.suggested_actions)) {
      response.suggestedActions = aiData.suggested_actions
        .map((action: any) => this.mapActionFromAI(action, screenContext))
        .filter(Boolean) as ActionDescriptor[];
    }

    if (aiData.visual_elements && Array.isArray(aiData.visual_elements)) {
      response.visualElements = aiData.visual_elements
        .map((element: any) => this.mapVisualElementFromAI(element, screenContext))
        .filter(Boolean) as VisualElement[];
    }

    if (aiData.next_steps && Array.isArray(aiData.next_steps)) {
      response.nextSteps = aiData.next_steps;
    } else if (aiData.nextSteps && Array.isArray(aiData.nextSteps)) {
      response.nextSteps = aiData.nextSteps;
    } else if (aiData.follow_up_questions && Array.isArray(aiData.follow_up_questions)) {
      response.nextSteps = aiData.follow_up_questions;
    }

    return response;
  }

  /**
   * Mapper une action depuis la réponse IA
   */
  private mapActionFromAI(aiAction: any, screenContext: ScreenContext): ActionDescriptor | null {
    // Chercher l'action correspondante dans le contexte
    const matchedAction = screenContext.availableActions.find(action =>
      action.label.toLowerCase().includes(aiAction.label?.toLowerCase()) ||
      action.id === aiAction.id
    );

    if (matchedAction) {
      return matchedAction;
    }

    // Action générique si non trouvée
    if (aiAction.route) {
      return {
        id: aiAction.id || 'custom',
        label: aiAction.label,
        icon: aiAction.icon || 'arrow-right',
        route: aiAction.route,
        params: aiAction.params,
        category: 'navigation',
        description: aiAction.description,
      };
    }

    return null;
  }

  /**
   * Mapper un élément visuel depuis la réponse IA
   */
  private mapVisualElementFromAI(aiElement: any, screenContext: ScreenContext): VisualElement | null {
    const matchedElement = screenContext.visibleElements.find(element =>
      element.label.toLowerCase().includes(aiElement.label?.toLowerCase()) ||
      element.id === aiElement.id
    );

    if (matchedElement) {
      // Filter UIElement.type to match VisualElement.type union
      const validType = ['button', 'icon', 'input', 'card'].includes(matchedElement.type)
        ? matchedElement.type as 'button' | 'icon' | 'input' | 'card'
        : 'card'; // fallback to 'card' for unsupported types like 'tab', 'modal', 'fab'

      return {
        id: matchedElement.id,
        type: validType,
        label: matchedElement.label,
        icon: matchedElement.icon,
        description: aiElement.description || matchedElement.label,
        position: aiElement.position,
      };
    }

    return null;
  }

  private generateLocalFallback(userMessage: string, screenContext: ScreenContext, lang?: string): ChatResponse {
    const q = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const { screenName, availableActions, serviceData, guideText, screenType } = screenContext;

    const MULTILINGUAL_KEYWORDS: Record<string, string[]> = {
      greeting: ['bonjour', 'salut', 'hello', 'hi ', 'hey', 'bonsoir', 'good', 'hola', 'hallo', 'jambo', 'habari', 'sannu', 'bawo'],
      product: ['produit', 'product', 'article', 'catalogue', 'stock', 'item', 'producto', 'produkt', 'bidhaa', 'kayan'],
      price: ['prix', 'price', 'tarif', 'cout', 'cost', 'combien', 'how much', 'precio', 'preis', 'bei', 'farashi', 'kudi'],
      help: ['aide', 'help', 'comment', 'how', 'expliquer', 'guide', 'tuto', 'quoi faire', 'ayuda', 'hilfe', 'msaada', 'taimako'],
      navigate: ['aller', 'acceder', 'ou est', 'comment aller', 'navigate', 'go to', 'ouvrir', 'trouver', 'where', 'donde', 'wohin', 'nenda', 'zuwa'],
      create: ['creer', 'ajouter', 'nouveau', 'publier', 'create', 'add', 'new', 'publish', 'crear', 'erstellen', 'unda', 'kirkiro'],
      manage: ['gerer', 'gestion', 'manage', 'modifier', 'edit', 'supprimer', 'delete', 'activer', 'desactiver', 'dupliquer', 'duplicate', 'import', 'csv', 'excel', 'mes produits', 'my products', 'catalog', 'gestionar', 'verwalten'],
      search: ['recherche', 'cherche', 'trouver', 'search', 'find', 'buscar', 'suchen', 'tafuta', 'nemo'],
      description: ['description', 'detail', 'info', 'c\'est quoi', 'what is', 'present', 'que es', 'was ist', 'nini'],
      negotiate: ['negoci', 'negoti', 'marchand', 'bargain', 'rabais', 'discount', 'descuento', 'verhandeln'],
      yukpo: ['yukpo', 'application', 'app', 'fonctionnalit', 'feature', 'quoi faire', 'tout'],
    };

    const match = (kws: string[]) => kws.some(k => q.includes(k));
    const matchGroup = (group: string) => match(MULTILINGUAL_KEYWORDS[group] || []);

    const sName = serviceData?.nom || serviceData?.name || serviceData?.titre || '';
    const sPrice = serviceData?.prix || serviceData?.price || '';
    const products: any[] = serviceData?.products || serviceData?.produits || [];
    const sDesc = serviceData?.description || '';

    const actionsByCategory = (cat: string) => availableActions.filter(a => a.category === cat);
    const topActions = (n = 3) => availableActions.filter(a => a.id !== 'home' && a.id !== 'profile' && a.id !== 'services').slice(0, n);
    const getMesServicesAction = (): ActionDescriptor => {
      const preferred = availableActions.find((a) => a.id === 'tab-services')
        || availableActions.find((a) => a.id === 'services')
        || availableActions.find((a) => a.route === 'MesServices')
        || availableActions.find((a) => a.route === 'Services');
      return preferred || {
        id: 'services',
        label: t('useScreenContext.services') || 'Mes Services',
        icon: 'briefcase',
        route: 'MesServices',
        category: 'navigation',
        description: 'Ouvrir le hub produits moderne (MesServicesScreen)',
      };
    };

    // === Navigation GPS — stats / marche / Coach IA / notifications ===
    if (screenName === 'Navigation') {
      const statsPerfKw = [
        'statist', 'perform', 'perf ', 'performance', 'marche', 'walking', 'walk', 'calor', 'calorie',
        'distance', 'duree', ' kilomet', ' km', 'sante', 'santé', 'health', 'vo2', 'progress', 'streak',
        'badge', 'gamification', 'score', 'graphique', 'courbe', 'activit', 'activité', 'session',
        'fitness', 'pas ', 'footing', 'course ', 'brule', 'brûl',
      ];
      if (statsPerfKw.some(k => q.includes(k))) {
        return {
          message:
            t('intelligentChat.navigation.statsPerformanceBody') ||
            'Tes **stats de marche et de performance** sont dans Yukpo : appuie sur l’icône **graphique** (Statistiques & Coach IA) en haut à droite, ou sur la carte **Score Santé & Coach IA** sur l’écran principal. Tu peux choisir la **période** et la vue **Tout / Détection auto / Marche libre**. Pour une session en cours, l’icône **piéton** 🚶 rouvre l’écran stats filtré. **Ne quitte pas Yukpo** pour ça.',
          type: 'navigation_help',
          suggestedActions: [],
        };
      }
      const coachNotifKw = [
        'coach', 'coaching', 'notif', 'notification', 'cloche', 'bell',
        'son', 'sound', 'silenc', 'mute', 'vibrat', 'vibre', 'parametr', 'reglage', 'réglage',
      ];
      if (coachNotifKw.some(k => q.includes(k))) {
        return {
          message:
            t('intelligentChat.navigation.coachNotifBody') ||
            'Le **Coach IA** de la Navigation envoie des rappels motivation (matin, midi, soir). Tu peux couper le **son** dans *Réglages → Notifications* (section Coach IA), ou **sans son pour un type** depuis l’historique de la **cloche** sur l’accueil. En mode silencieux, tu gardes l’**affichage** et la **vibration**.',
          type: 'action_suggestion',
          suggestedActions: [
            {
              id: 'open-settings-coach',
              label: t('intelligentChat.navigation.openNotifSettings') || 'Ouvrir les notifications (réglages)',
              icon: 'settings',
              route: 'Settings',
              params: { initialSection: 'notifications' },
              category: 'navigation',
              description: '',
            },
          ],
        };
      }
    }

    // === Home — align fallback with HomeScreen.tsx ===
    if (screenName === 'Home') {
      const homeChatKw = ['conversation', 'messagerie', 'message non lu', 'mes messages', 'chat ', 'discussion'];
      if (homeChatKw.some(k => q.includes(k))) {
        return {
          message: t('intelligentChat.home.chatHint') || '',
          type: 'navigation_help',
          suggestedActions: [],
        };
      }
      const homeNotifKw = ['notif', 'cloche', 'alerte yukpo'];
      if (homeNotifKw.some(k => q.includes(k))) {
        return {
          message: t('intelligentChat.home.notifHint') || '',
          type: 'navigation_help',
          suggestedActions: [],
        };
      }
      // ✅ PRIORITÉ HAUTE: Création de produit/service - TOUJOURS recommander HomeScreen Create mode en premier
      const homeCreateKw = [
        'creer un service', 'creer un produit', 'publier un produit', 'vendre sur',
        'devenir prestataire', 'ajouter un produit', 'nouveau produit', 'créer une prestation',
        'ajouter une prestation', 'nouvelle prestation', 'proposer un service',
        'offrir un service', 'mettre en vente', 'vendre mes produits', 'créer ma boutique',
        'lancer mon activité', 'commencer à vendre', 'devenir vendeur'
      ];
      if (homeCreateKw.some(k => q.includes(k))) {
        return {
          message:
            '🚀 **La façon la plus simple** : reste sur l\'**accueil**, passe en mode **📝 Créer** (le bouton en haut du champ), décris ton produit/service avec texte ou photo, puis envoie.\n\n' +
            '🤖 L\'IA va te guider étape par étape :\n' +
            '• Si tu as déjà une boutique → **Ajouter un produit** avec suggestions IA\n' +
            '• Si c\'est ton premier service → **Formulaire intelligent** complet\n\n' +
            '💡 **Conseil** : Utilise `variation_prix` pour les variantes (poids, taille, durée, etc.) et évite de créer plusieurs fiches similaires.\n\n' +
            '📋 **Alternative** : Si tu préfères gérer un catalogue existant, tu peux aussi aller dans l\'onglet **Services** en bas.',
          type: 'navigation_help',
          suggestedActions: [
            {
              id: 'switch-to-create-mode',
              label: '📝 Passer en mode Créer',
              icon: 'plus-circle',
              category: 'action',
              description: 'Bascule automatiquement en mode création sur l\'accueil'
            },
            getMesServicesAction() // Option 2 : gestion catalogue
          ],
        };
      }
      const homeManageProductsKw = [
        'mes services',
        'management produit',
        'gestion produit',
        'gerer mes produits',
        'gérer mes produits',
        'dashboard produits',
        'tableau de bord produits',
        'publicite',
        'publicité',
        'video produit',
      ];
      if (homeManageProductsKw.some(k => q.includes(k))) {
        return {
          message:
            'Pour **gérer** tes produits existants, vidéos, publicités et voir tes stats, ouvre **Mes services** (hub moderne `MesServicesScreen`). C\'est l\'onglet du bas **Services**.\n\n' +
            '📊 **Ce que tu peux faire là** :\n' +
            '• Modifier, activer/mettre en pause tes produits\n' +
            '• Voir les statistiques et les vues\n' +
            '• Gérer tes publicités et vidéos\n' +
            '• Accéder aux paramètres avancés\n\n' +
            '💡 **Pour créer un NOUVEAU produit** : utilise plutôt le mode **📝 Créer** sur l\'accueil, c\'est plus simple !',
          type: 'navigation_help',
          suggestedActions: [getMesServicesAction()],
        };
      }
      const homeSearchKw = ['comment cherch', 'lancer une recherche', 'resultat besoin', 'rechercher un service', 'recherche sur accueil', 'barre du haut'];
      if (homeSearchKw.some(k => q.includes(k))) {
        return {
          message: t('intelligentChat.home.searchHint') || '',
          type: 'navigation_help',
          suggestedActions: [],
        };
      }
      const homeDeliveryKw = ['livraison', 'delivery', 'coursier', 'commander livraison', 'envoyer colis', 'courses marche'];
      if (homeDeliveryKw.some(k => q.includes(k))) {
        return {
          message: 'Depuis Home, utilise le bouton **Livraison** (icône vélo/coursier en haut) pour accéder aux flux colis et courses avec suivi temps réel. Tu peux préparer ton panier, fixer ton budget, puis suivre le coursier et confirmer la livraison.',
          type: 'navigation_help',
          suggestedActions: [
            { id: 'go-delivery-home', label: '📦 Commander une livraison', icon: 'truck', route: 'DeliveryHome', category: 'navigation', description: '' },
          ],
        };
      }
    }

    // === CROSS-SCREEN: Product/service data queries ===
    if (matchGroup('product')) {
      if (products.length > 0) {
        const list = products.slice(0, 5).map((p: any) => {
          const n = p.nom || p.name || '?';
          const pr = p.prix || p.price || '';
          return `• ${n}${pr ? ` — ${pr} FCFA` : ''}`;
        }).join('\n');
        return {
          message: t('intelligentChat.fallback.productsAvailable', { list }) || `${list}`,
          type: 'visual_guide',
          suggestedActions: availableActions.filter(a => a.id === 'contact-provider' || a.id === 'negotiate').slice(0, 2),
        };
      }
      return {
        message: t('intelligentChat.fallback.noProducts') || 'No product catalog on this screen.',
        type: 'text',
        suggestedActions: [{ id: 'search', label: t('intelligentChat.fallback.search') || 'Search', icon: 'search', route: 'RechercheBesoin', category: 'search', description: '' }],
      };
    }

    if (matchGroup('price')) {
      const priceMsg = sPrice
        ? t('intelligentChat.fallback.priceIs', { name: sName, price: sPrice })
        : sName
          ? t('intelligentChat.fallback.priceNotShown', { name: sName })
          : t('intelligentChat.fallback.selectService');
      return {
        message: `${priceMsg}\n\n${t('intelligentChat.fallback.canNegotiate')}`,
        type: 'action_suggestion',
        suggestedActions: availableActions.filter(a => a.id === 'negotiate' || a.id === 'contact-provider').slice(0, 2),
      };
    }

    if (matchGroup('description')) {
      if (sName || sDesc) {
        const parts: string[] = [];
        if (sName) parts.push(`**${sName}**`);
        if (sDesc) parts.push(sDesc.substring(0, 300));
        if (sPrice) parts.push(`${t('intelligentChat.fallback.priceLabel') || 'Price'} : ${sPrice} FCFA`);
        if (products.length > 0) parts.push(`${products.length} ${t('intelligentChat.fallback.productsCount') || 'product(s)'}`);
        return { message: parts.join('\n\n'), type: 'text', suggestedActions: topActions(3) };
      }
      return { message: guideText || `${t('intelligentChat.fallback.youAreOn', { screen: screenName })} ${this.getScreenDescription(screenName)}`, type: 'text', suggestedActions: topActions(4) };
    }

    // === CROSS-SCREEN: "What is Yukpo?" / Discovery ===
    if (matchGroup('yukpo')) {
      return {
        message: t('intelligentChat.fallback.yukpoDiscovery') ||
          `🌟 **YUKPO — LA RÉVOLUTION DIGITALE AFRICAINE** 🌟
          
Yukpo n'est pas une application comme les autres. C'est la **PREMIÈRE SUPER-APP AFRICAINE** qui transforme radicalement votre quotidien avec l'intelligence artificielle !

🚀 **L'INNOVATION EXCLUSIVE YUKPO :**

🏥 **SANTÉ RÉVOLUTIONNAIRE**
• Pharmacies avec stock en temps réel
• Hôpitaux avec triage IA intelligent  
• Laboratoires et banques de sang intégrés
• Prise de RDV en 1 clic

🚗 **MOBILITÉ 2.0 SMART**
• Taxi avec tarification dynamique IA
• Covoiturage intelligent avec matching
• Billets bus avec sélection de siège
• Navigation GPS avec alertes communautaires

📦 **LIVRAISON MAGIQUE**
• Colis et courses en temps réel
• Tracking GPS précis au mètre
• Multi-coursiers optimisés
• Payment à la livraison sécurisé

💼 **CARRIÈRE FUTURE**
• Analyse CV IA avec score /100
• Prédiction salaire par IA
• Matching intelligent candidats-offres
• Formations personnalisées IA

🎓 **ÉDUCATION INNOVANTE**
• Orientation scolaire IA personnalisée
• Bourse du livre avec troc intelligent
• Chaînes d'échange DAG algorithmiques
• Programme scolaire officiel intégré

🏨 **IMMOBILIER PREMIUM**
• Hôtels avec tarification IA
• Meublés et résidences de luxe
• Visites virtuelles 360°
• Gestion complète pour propriétaires

🛒 **E-COMMERCE SMART**
• Création de service en 1 photo
• Négociation de prix en temps réel
• Galerie médias avancée
• Commentaires et notation

💰 **FINANCE INCLUSIVE**
• 14 méthodes de paiement (MTN, Orange, Wave, Visa...)
• Wallet multi-devises
• Recharges avec bonus jusqu'à +20%
• Transactions sécurisées instantanées

🔥 **CE QUI REND YUKPO UNIQUE AU MONDE :**
✅ Première super-app 100% africaine
✅ IA intégrée dans TOUS les services
✅ 62 langues africaines supportées
✅ Offline-first pour zones mal connectées
✅ Multi-paiements adaptés à l'Afrique
✅ Écosystème complet en 1 seule app

🌍 **L'AFRIQUE ENTRE DANS L'ÈRE DIGITALE AVEC YUKPO !** 🌍

Explorez l'avenir dès maintenant ! 👇`,
        type: 'text',
        suggestedActions: this.getDiscoveryActions(),
        nextSteps: this.getDiscoveryNextSteps(),
      };
    }

    if (match(['bonjour', 'salut', 'hello', 'hi ', 'hey', 'bonsoir', 'good', 'hola', 'jambo', 'habari', 'sannu', 'yo ', 'coucou', 'wesh', 'ca va', 'comment ca va', 'how are you'])) {
      const isHomeScreen = screenName === 'Home' || screenName === 'HomeScreen';
      const greetings = [
        `Salut ! 😊 Ravi de te voir. Je suis l'Assistant Yukpo — ton compagnon intelligent. Pose-moi n'importe quelle question, que ce soit sur l'app ou sur la vie en général !`,
        `Hey ! 👋 Comment ça va ? Je suis là pour toi — que tu aies besoin d'aide sur Yukpo ou juste envie de discuter. Qu'est-ce qui te ferait plaisir ?`,
        `Bienvenue ! 🌟 Moi c'est l'Assistant Yukpo, ton ami digital. Je connais l'app sur le bout des doigts, mais je peux aussi parler de tout et de rien. À toi !`,
        `Coucou ! 😄 Ça fait plaisir. Dis-moi ce dont tu as besoin — aide sur l'app, question de culture générale, ou juste un échange sympa !`,
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];

      return {
        message: isHomeScreen ? greeting : greeting + `\n\nTu es sur **${screenName}** — je connais cet écran par cœur, demande-moi n'importe quoi ! 💡`,
        type: 'text',
        suggestedActions: isHomeScreen ? this.getDiscoveryActions() : topActions(4),
        nextSteps: this.getDiscoveryNextSteps().slice(0, 5),
      };
    }

    // === CROSS-SCREEN: Navigation requests ===
    if (matchGroup('navigate')) {
      const navTarget = this.detectNavigationTarget(q);
      if (navTarget) {
        return {
          message: t('intelligentChat.fallback.navigateTo', { label: navTarget.label }) ||
            `Tap below to go to "${navTarget.label}":`,
          type: 'navigation_help',
          suggestedActions: [navTarget],
        };
      }
      return {
        message: t('intelligentChat.fallback.availableDestinations') || 'Available destinations:',
        type: 'navigation_help',
        suggestedActions: actionsByCategory('navigation').slice(0, 5),
      };
    }

    // === CROSS-SCREEN: Help / How-to ===
    if (matchGroup('help')) {
      const productHubHelpActions = (screenName === 'Services' || screenName === 'MesServices')
        ? availableActions.filter(a =>
          ['ms-add-product', 'ms-video-intro', 'ms-publicite', 'ms-analytics', 'ms-mesproduits'].includes(a.id)
        ).slice(0, 5)
        : [];
      return {
        message: `${guideText || t('intelligentChat.fallback.youAreOn', { screen: screenName })}\n\n${t('intelligentChat.fallback.availableActions') || 'Available actions:'}`,
        type: 'text',
        suggestedActions: productHubHelpActions.length > 0 ? productHubHelpActions : topActions(5),
        nextSteps: [
          'Comment lancer une pub pour booster mes ventes ?',
          'Comment créer une vidéo produit qui vend ?',
          'Comment activer la livraison globale sur mes produits ?',
        ],
      };
    }

    // === CROSS-SCREEN: Product/Service management ===
    if (matchGroup('manage') && (matchGroup('product') || match(['produit', 'product', 'service', 'boutique', 'catalog']))) {
      return {
        message: t('intelligentChat.fallback.manageGuide') ||
          '📦 Gestion produit façon commerçant terrain.\n\n'
          + '✅ Pour créer vite et bien, commence sur **HomeScreen** en mode **Créer** (guidage IA plus simple).\n\n'
          + '• Modifie ton produit à tout moment: nom, prix, photos, description\n'
          + '• **variation_prix**: un seul produit, plusieurs variantes\n'
          + '  Exemples concrets:\n'
          + '  - riz: 1kg / 5kg / 25kg\n'
          + '  - chaussure: 41 / 42 / 43\n'
          + '  - huile: 0.5L / 1L / 5L\n'
          + '• Active/désactive un produit en 1 clic\n'
          + '• Duplique une fiche pour gagner du temps\n'
          + '• Importe ton catalogue en lot (CSV/Excel)\n'
          + '• Suis tes stats: vues, commandes, ventes\n\n'
          + 'Retrouve tout dans **Mes services** et **Mon catalogue**.',
        type: 'action_suggestion',
        suggestedActions: [
          { id: 'go-home-create', label: '✨ Créer mon produit (accueil)', icon: 'home', route: 'Home', category: 'creation', description: '' },
          { id: 'mes-services-hub', label: '🧭 Gérer mes produits', icon: 'briefcase', route: 'MesServices', category: 'navigation', description: '' },
          { id: 'my-products', label: t('intelligentChat.fallback.myProducts') || '📦 Voir mon catalogue', icon: 'package', route: 'MesProduits', category: 'navigation', description: '' },
          { id: 'add-product', label: t('intelligentChat.fallback.addProduct') || '➕ Ajouter un produit', icon: 'plus', route: 'AjouterProduitSimple', category: 'creation', description: '' },
          { id: 'dashboard', label: t('intelligentChat.fallback.dashboard_nav') || '📊 Voir mes stats', icon: 'bar-chart-3', route: 'AnalyticsDashboard', category: 'navigation', description: '' },
          { id: 'ads-dashboard', label: '📣 Publicités', icon: 'megaphone', route: 'PubliciteDashboard', category: 'navigation', description: '' },
        ],
        nextSteps: [
          'Comment lancer une pub pour mon produit ?',
          'Comment créer une vidéo produit ?',
          'Comment activer la livraison globale ?',
          'Comment configurer variation_prix (1kg/5kg/25kg, 41/42/43...) ?',
        ],
      };
    }

    // === CROSS-SCREEN: Creation requests (product/service) ===
    if (matchGroup('create')) {
      const isOnHome = screenName === 'Home' || screenName === 'HomeScreen';
      const isOnDashboard = screenType === 'dashboard';
      const creationActions = actionsByCategory('creation');

      if (isOnHome || match(['produit', 'product', 'service', 'boutique', 'shop', 'prestation', 'catalog', 'vendre', 'sell'])) {
        return {
          message: t('intelligentChat.fallback.createGuide') ||
            '🚀 Créer sur Yukpo, c’est simple et rapide.\n\n'
            + '🏠 Commence sur **HomeScreen** en mode **Créer**: c’est le parcours le plus facile.\n\n'
            + '📸 Envoie une photo ou un texte — l’IA propose nom, catégorie, prix et pré-remplit le formulaire.\n\n'
            + '🧩 Utilise **variation_prix** pour éviter les doublons.\n'
            + 'Exemples terrain:\n'
            + '• riz: 1kg / 5kg / 25kg\n'
            + '• chaussure: 41 / 42 / 43\n'
            + '• huile: 0.5L / 1L / 5L\n'
            + '👉 Un seul produit, plusieurs prix selon format/poids/pointure.\n\n'
            + '🏪 Première mise en place: l’app enregistre aussi les infos de ta boutique (nom, contacts, logo, moyens de paiement).',
          type: 'action_suggestion',
          suggestedActions: [
            { id: 'go-home-create', label: t('intelligentChat.fallback.goCreate') || '✨ Créer maintenant', icon: 'plus', route: 'Home', category: 'creation', description: '' },
            { id: 'my-products', label: t('intelligentChat.fallback.myProducts') || '📦 Voir mon catalogue', icon: 'package', route: 'MesProduits', category: 'navigation', description: '' },
            { id: 'dashboard', label: t('intelligentChat.fallback.dashboard_nav') || '📊 Voir mes stats', icon: 'bar-chart-3', route: 'DashboardPrestataire', category: 'navigation', description: '' },
          ],
          nextSteps: [
            'Comment gérer mes produits après création ?',
            'Comment lancer une pub depuis Mes services ?',
            'Comment créer une vidéo produit depuis Mes services ?',
            'Comment activer la livraison globale pour tous mes produits ?',
          ],
        };
      }

      if (creationActions.length > 0) {
        return {
          message: t('intelligentChat.fallback.createOptions') || 'Here\'s what you can create:',
          type: 'action_suggestion',
          suggestedActions: creationActions.slice(0, 3),
          nextSteps: [
            'Comment créer à partir d’une simple photo ?',
            'Que se passe-t-il lors de la première création ?',
            'Comment lancer une pub ensuite ?',
          ],
        };
      }
      return {
        message: t('intelligentChat.fallback.createNotAvailable') || 'Creation is not available on this screen. Go to Home to create.',
        type: 'navigation_help',
        suggestedActions: [
          { id: 'go-home', label: t('intelligentChat.nav.home') || 'Home', icon: 'home', route: 'Home', category: 'navigation', description: '' },
          { id: 'create-service', label: t('intelligentChat.nav.createService') || 'Create Service', icon: 'plus', route: 'ServicesDashboard', category: 'creation', description: '' },
        ],
      };
    }

    // === CROSS-SCREEN: Search requests ===
    if (matchGroup('search')) {
      const searchActions = actionsByCategory('search');
      if (searchActions.length > 0) {
        return { message: t('intelligentChat.fallback.useSearch') || 'Use the search:', type: 'action_suggestion', suggestedActions: searchActions.slice(0, 3) };
      }
      return {
        message: t('intelligentChat.fallback.globalSearch') || 'Use the global search:',
        type: 'action_suggestion',
        suggestedActions: [{ id: 'search', label: t('intelligentChat.fallback.search') || 'Search', icon: 'search', route: 'RechercheBesoin', category: 'search', description: '' }],
      };
    }

    const navTarget = this.detectNavigationTarget(q);
    if (navTarget) {
      return {
        message: `${navTarget.label} →`,
        type: 'navigation_help',
        suggestedActions: [navTarget],
      };
    }

    if (matchGroup('negotiate')) {
      const negotiateAction = availableActions.find(a => a.id === 'negotiate' || a.id === 'negotiate-price');
      const searchAction = { id: 'search', label: t('intelligentChat.fallback.search') || 'Search', icon: 'search', route: 'RechercheBesoin', category: 'search' as const, description: '' };
      return {
        message: t('intelligentChat.fallback.negotiateInfo') || 'Yukpo lets you negotiate prices directly with providers!',
        type: 'action_suggestion',
        suggestedActions: [negotiateAction, searchAction].filter(Boolean).slice(0, 2) as any[],
      };
    }

    // === GENERAL QUESTION / SMALL TALK FALLBACK ===
    // If nothing matched above, the user is likely asking a general question
    // (culture, cooking, math, life advice, etc.) or making small talk.
    // The local fallback can't answer these — acknowledge and explain that
    // the full AI can, while still being warm and helpful.
    const isLikelyQuestion = q.includes('?') || q.length > 20 ||
      match(['pourquoi', 'comment', 'quand', 'combien', 'qui est', 'qu est', 'what', 'why', 'when', 'how', 'who', 'where',
        'est ce que', 'is it', 'can you', 'peux tu', 'tu connais', 'do you know', 'raconte', 'tell me', 'explain',
        'donne moi', 'give me', 'parle moi', 'c est quoi', 'define', 'definis']);

    if (isLikelyQuestion) {
      return {
        message: `Bonne question ! 🤔 Je suis en mode local pour l'instant (l'IA complète n'a pas pu répondre), mais je note ta question. Réessaie dans quelques secondes — l'assistant IA complet pourra te répondre sur tout : culture générale, conseils, calculs, recettes, et bien sûr toutes les fonctionnalités Yukpo ! 💡`,
        type: 'text',
        suggestedActions: topActions(3),
        nextSteps: [
          'C\'est quoi Yukpo ?',
          'Comment créer un produit ?',
          'Quels services sont disponibles ?',
        ],
      };
    }

    return this.buildContextualFallback(q, screenContext);
  }

  private buildContextualFallback(query: string, ctx: ScreenContext): ChatResponse {
    const { screenName, screenType, availableActions, visibleElements, guideText, serviceData } = ctx;
    const topActions = availableActions
      .filter(a => a.id !== 'home' && a.id !== 'profile' && a.id !== 'services')
      .slice(0, 4);

    const sName = serviceData?.nom || serviceData?.name || serviceData?.titre || '';
    const sPrice = serviceData?.prix || serviceData?.price || '';

    if (sName && screenType === 'detail') {
      const parts: string[] = [`« ${sName} »`];
      if (sPrice) parts.push(`${sPrice} FCFA`);
      const contactAction = availableActions.find(a => a.id === 'contact-provider' || a.id === 'contact');
      const negotiateAction = availableActions.find(a => a.id === 'negotiate' || a.id === 'negotiate-price');
      return {
        message: guideText || `${t('intelligentChat.fallback.detailOf', { name: sName }) || sName}\n\n${parts.join(' — ')}`,
        type: 'text',
        suggestedActions: [contactAction, negotiateAction, ...topActions].filter(Boolean).slice(0, 4) as any[],
      };
    }

    if (screenType === 'dashboard') {
      return {
        message: guideText || t('intelligentChat.fallback.dashboard', { screen: screenName }) || `Dashboard "${screenName}".`,
        type: 'text',
        suggestedActions: topActions,
      };
    }

    if (screenType === 'form') {
      return {
        message: guideText || t('intelligentChat.fallback.form', { screen: screenName }) || `Form "${screenName}".`,
        type: 'text',
        suggestedActions: topActions,
      };
    }

    if (screenType === 'search' || screenType === 'list') {
      const searchActions = availableActions.filter(a => a.category === 'search').slice(0, 2);
      return {
        message: guideText || t('intelligentChat.fallback.searchScreen', { screen: screenName }) || `Search & results on "${screenName}".`,
        type: 'text',
        suggestedActions: [...searchActions, ...topActions].slice(0, 4),
      };
    }

    return {
      message: guideText || t('intelligentChat.fallback.genericHelp', { screen: screenName }) || `You're on "${screenName}". I can guide you through all available features here.`,
      type: 'text',
      suggestedActions: topActions,
    };
  }

  // ✅ FIX BUG 5: Shared action packs to eliminate duplication between yukpo/greeting fallbacks
  private getDiscoveryActions(): ActionDescriptor[] {
    return [
      { id: 'pack-health', label: t('intelligentChat.pack.health') || '🏥 Santé & Bien-être', icon: 'heart', route: 'PharmacieHome', category: 'navigation', description: t('intelligentChat.pack.healthDesc') || 'Pharmacies · Hôpitaux · Labo · Don de sang · Triage IA' },
      { id: 'pack-mobility', label: t('intelligentChat.pack.mobility') || '🚗 Mobilité & Transport', icon: 'car', route: 'TaxiHome', category: 'navigation', description: t('intelligentChat.pack.mobilityDesc') || 'Taxi IA · Covoiturage · Bus/Tickets · GPS Navigation' },
      { id: 'pack-delivery', label: t('intelligentChat.pack.delivery') || '📦 Livraison & Courses', icon: 'truck', route: 'DeliveryHome', category: 'navigation', description: t('intelligentChat.pack.deliveryDesc') || 'Colis · Courses · Suivi temps réel · Coursiers' },
      { id: 'pack-commerce', label: t('intelligentChat.pack.commerce') || '🛒 Commerce & Services', icon: 'shopping-cart', route: 'RechercheBesoin', category: 'search', description: t('intelligentChat.pack.commerceDesc') || 'E-commerce · BayamSelam · Supermarché · Restaurant' },
      { id: 'pack-career', label: t('intelligentChat.pack.career') || '💼 Carrière & Éducation', icon: 'briefcase', route: 'OffresEmploiHome', category: 'navigation', description: t('intelligentChat.pack.careerDesc') || 'Emploi · CV IA · Orientation scolaire · Livres/Troc' },
      { id: 'pack-realestate', label: t('intelligentChat.pack.realestate') || '🏠 Immobilier', icon: 'building-2', route: 'ImmobilierSearch', category: 'navigation', description: t('intelligentChat.pack.realestateDesc') || 'Vente, location, annonces — ImmobilierSearch. Hôtels & meublés : raccourci « Hôtel / Meublé ».' },
      { id: 'pack-creative', label: t('intelligentChat.pack.creative') || '🎬 Créativité & IA', icon: 'video', route: 'Home', category: 'creation', description: t('intelligentChat.pack.creativeDesc') || 'Vidéo IA · Création en 1 photo · Menu IA · Recettes' },
      { id: 'pack-finance', label: t('intelligentChat.pack.finance') || '💰 Finance & Paiement', icon: 'wallet', route: 'WalletFinancial', category: 'navigation', description: t('intelligentChat.pack.financeDesc') || 'Wallet · Recharge · 14 paiements · Historique' },
      { id: 'solo-gps', label: t('intelligentChat.solo.gps') || '🗺️ Navigation Intelligente Yukpo', icon: 'map', route: 'Navigation', category: 'navigation', description: t('intelligentChat.solo.gpsDesc') || 'Guidage vocal · Radars · Alertes · POI · Santé · Marche · CO2 · Performances · Coach IA' },
      { id: 'solo-books', label: t('intelligentChat.solo.books') || '📚 Bourse du Livre Yukpo / Troc', icon: 'book-open', route: 'BourseLivre', category: 'navigation', description: t('intelligentChat.solo.booksDesc') || 'Troc intelligent · Achat/Vente · Chaînes DAG · Dons' },
      { id: 'solo-bus', label: t('intelligentChat.solo.bus') || '🎫 Tickets de Bus Yukpo', icon: 'bus', route: 'TicketVoyageHome', category: 'navigation', description: t('intelligentChat.solo.busDesc') || 'Réservation · Sélection siège · QR boarding · Agences' },
      { id: 'solo-carpooling', label: t('intelligentChat.solo.carpooling') || '🚗 Covoiturage Yukpo', icon: 'users', route: 'CovoiturageHome', category: 'navigation', description: t('intelligentChat.solo.carpoolingDesc') || 'Trajets partagés · Matching IA · Récurrent · QR ticket' },
      { id: 'solo-hotel', label: t('intelligentChat.solo.hotel') || '🏨 Hôtel / Meublé Yukpo', icon: 'building', route: 'HotelSearch', params: { mode: 'hotel' }, category: 'navigation', description: t('intelligentChat.solo.hotelDesc') || 'Liste et filtres ; dates et occupants sur HotelBooking après Réserver' },
      { id: 'solo-supermarket', label: t('intelligentChat.solo.supermarket') || '🛒 Supermarché Yukpo', icon: 'shopping-cart', route: 'SupermarketHome', category: 'navigation', description: t('intelligentChat.solo.supermarketDesc') || 'Magasins · Produits · Comparaison IA · Livraison' },
    ];
  }

  private getDiscoveryNextSteps(): string[] {
    return [
      t('intelligentChat.followUp.whatIsYukpo') || "Qu'est-ce qui rend Yukpo unique ?",
      t('intelligentChat.followUp.detailHealth') || 'Détaille-moi le pack Santé (Pharmacie, Hôpital, Labo...)',
      t('intelligentChat.followUp.detailMobility') || 'Comment fonctionne Taxi IA + Covoiturage + Bus ?',
      t('intelligentChat.followUp.detailGps') || 'Parle-moi de la Navigation GPS intelligente',
      t('intelligentChat.followUp.detailBooks') || 'Comment fonctionne la Bourse du Livre et le Troc ?',
      t('intelligentChat.followUp.detailCommerce') || "Qu'est-ce que BayamSelam, Supermarché, Restaurant ?",
      t('intelligentChat.followUp.detailFinance') || 'Quels sont les 14 modes de paiement ?',
      t('intelligentChat.followUp.detailCreative') || 'Comment créer un service ou une vidéo IA ?',
      t('intelligentChat.followUp.whyUnique') || 'Pourquoi Yukpo est unique au monde ?',
    ];
  }

  private static readonly NAV_MAP: Array<{ keywords: string[]; action: ActionDescriptor }> = [
    { keywords: ['accueil', 'home', 'nyumbani', 'gida'], action: { id: 'home', label: 'Accueil', icon: 'home', route: 'Home', category: 'navigation', description: '' } },
    { keywords: ['pharmacie', 'pharmacy', 'duka la dawa', 'kantin magani'], action: { id: 'pharmacy', label: 'Pharmacie', icon: 'pill', route: 'PharmacieHome', category: 'navigation', description: '' } },
    { keywords: ['hopital', 'hospital', 'clinique', 'clinic', 'hospitali', 'asibiti'], action: { id: 'hospital', label: 'Hôpital', icon: 'building', route: 'HopitalHome', category: 'navigation', description: '' } },
    { keywords: ['sante', 'health', 'salud', 'gesundheit', 'afya', 'lafiya'], action: { id: 'health', label: 'Santé', icon: 'heart', route: 'HopitalHome', category: 'navigation', description: '' } },
    { keywords: ['urgence', 'emergency', 'dharura', 'gaggawa'], action: { id: 'emergency', label: 'Urgences', icon: 'alert-circle', route: 'HopitalHome', category: 'navigation', description: '' } },
    { keywords: ['medecin', 'doctor', 'daktari', 'likita'], action: { id: 'doctor', label: 'Médecin', icon: 'stethoscope', route: 'HopitalHome', category: 'navigation', description: '' } },
    { keywords: ['consultation', 'rendez-vous', 'rdv', 'appointment', 'miadi'], action: { id: 'appointment', label: 'Rendez-vous', icon: 'calendar', route: 'HopitalHome', category: 'navigation', description: '' } },
    { keywords: ['meuble', 'meublé', 'furnished rental'], action: { id: 'meuble-search', label: 'Meublés', icon: 'building', route: 'MeubleSearch', params: { mode: 'meuble' }, category: 'navigation', description: '' } },
    { keywords: ['hotel', 'hebergement', 'hébergement', 'accommodation', 'hoteli', 'otal', 'logement hotel'], action: { id: 'hotel-search', label: 'Hôtels', icon: 'building', route: 'HotelSearch', params: { mode: 'hotel' }, category: 'navigation', description: '' } },
    { keywords: ['taxi', 'cab', 'teksi'], action: { id: 'taxi', label: 'Taxi', icon: 'car', route: 'TaxiHome', category: 'navigation', description: '' } },
    { keywords: ['covoiturage', 'carpooling', 'ride share', 'kushiriki safari'], action: { id: 'covoit', label: 'Covoiturage', icon: 'users', route: 'CovoiturageHome', category: 'navigation', description: '' } },
    { keywords: ['livraison', 'delivery', 'entrega', 'lieferung', 'uwasilishaji', 'isarwa'], action: { id: 'delivery', label: 'Livraison', icon: 'truck', route: 'DeliveryHome', category: 'navigation', description: '' } },
    { keywords: ['emploi', 'travail', 'job', 'work', 'kazi', 'aiki'], action: { id: 'emploi', label: 'Emploi', icon: 'briefcase', route: 'OffresEmploiHome', category: 'navigation', description: 'Offres d\'emploi et CV IA' } },
    { keywords: ['orientation', 'ecole', 'school', 'shule', 'makaranta'], action: { id: 'orientation', label: 'Orientation scolaire', icon: 'graduation-cap', route: 'OrientationScolaireHome', category: 'navigation', description: 'Orientation et établissements' } },
    { keywords: ['livre', 'book', 'kitabu', 'littafi'], action: { id: 'livres', label: 'Livres', icon: 'book-open', route: 'LivreScolaireHome', category: 'navigation', description: 'Bourse du livre et école' } },
    { keywords: ['navigation', 'gps', 'itineraire', 'route', 'chemin', 'marche', 'sport', 'coach ia', 'statistique'], action: { id: 'navigation', label: 'Navigation intelligente', icon: 'map', route: 'Navigation', category: 'navigation', description: 'GPS IA + Coach sport + Alertes' } },
    { keywords: ['mes services', 'my services', 'gestion produits', 'catalogue prestataire', 'mes produits vendeur', 'onglet services'], action: { id: 'services-tab', label: 'Mes services (Produits)', icon: 'briefcase', route: 'MesServices', category: 'navigation', description: 'Gestion produits et catalogue' } },
    { keywords: ['profil', 'profile', 'wasifu', 'bayanan'], action: { id: 'profile', label: 'Profil', icon: 'user', route: 'Profile', category: 'navigation', description: '' } },
    { keywords: ['parametre', 'reglage', 'settings', 'mipangilio'], action: { id: 'settings', label: 'Paramètres', icon: 'settings', route: 'EnhancedSettings', category: 'navigation', description: '' } },
    { keywords: ['immobilier', 'real estate', 'mali isiyohamishika'], action: { id: 'immo', label: 'Immobilier', icon: 'building-2', route: 'ImmobilierHome', category: 'navigation', description: '' } },
    { keywords: ['mes polices assurance', 'polices assurance client', 'mes assurances souscrites'], action: { id: 'assurance-my-policies', label: 'Mes polices assurance', icon: 'shield', route: 'MesPolicesAssurance', category: 'navigation', description: '' } },
    { keywords: ['suivi sinistre', 'suivi des sinistres', 'mes sinistres assurance'], action: { id: 'assurance-claims-track', label: 'Suivi sinistres', icon: 'alert-triangle', route: 'SuiviSinistre', category: 'navigation', description: '' } },
    { keywords: ['devis assurance ia', 'devis assurance intelligent'], action: { id: 'assurance-quote-ia', label: 'Devis assurance IA', icon: 'file-text', route: 'InsuranceQuoteRequest', category: 'navigation', description: '' } },
    { keywords: ['dashboard assurance', 'assurance partenaire', 'prestataire assurance', 'espace assureur', 'tableau assurance partenaire', 'gestion assurance yukpo', 'assureur yukpo'], action: { id: 'assurance-partner', label: 'Tableau assurance partenaire', icon: 'shield', route: 'AssuranceDashboard', category: 'navigation', description: '' } },
    { keywords: ['assurance', 'insurance', 'bima', 'inshora'], action: { id: 'assurance', label: 'Recherche assurance', icon: 'shield', route: 'InsuranceServicesSearch', category: 'navigation', description: '' } },
    { keywords: ['laboratoire', 'labo', 'laboratory', 'lab', 'maabara'], action: { id: 'lab', label: 'Laboratoire', icon: 'activity', route: 'LaboratoireHome', category: 'navigation', description: '' } },
    { keywords: ['sang', 'blood', 'damu', 'jini'], action: { id: 'blood', label: 'Don de sang', icon: 'droplet', route: 'BloodDonation', category: 'navigation', description: '' } },
    { keywords: ['bus', 'autobus', 'basi'], action: { id: 'bus', label: 'Bus', icon: 'bus', route: 'TicketVoyageHome', category: 'navigation', description: '' } },
    { keywords: ['supermarche', 'supermarket', 'duka kubwa'], action: { id: 'supermarket', label: 'Supermarché', icon: 'shopping-cart', route: 'SupermarketHome', category: 'navigation', description: '' } },
    { keywords: ['menu', 'repas', 'meal', 'mlo'], action: { id: 'menu', label: 'Menu', icon: 'calendar', route: 'MenuPlanningHub', category: 'navigation', description: '' } },
    { keywords: ['video', 'clip'], action: { id: 'video', label: 'Vidéo', icon: 'video', route: 'MesServices', params: { openVideoSelector: true }, category: 'navigation', description: 'Ouvre le sélecteur vidéo local (modal-first)' } },
    { keywords: ['navigation', 'gps', 'carte', 'map', 'ramani'], action: { id: 'nav', label: 'Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' } },
    { keywords: ['bourse', 'troc', 'exchange', 'kubadilishana'], action: { id: 'bourse', label: 'Bourse du Livre', icon: 'book-open', route: 'BourseLivre', category: 'navigation', description: '' } },
    { keywords: ['radar', 'speed camera'], action: { id: 'radar', label: 'Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' } },
    { keywords: ['colis', 'parcel', 'package', 'kifurushi'], action: { id: 'parcel', label: 'Envoyer Colis', icon: 'package', route: 'DeliveryParcelFlowNew', category: 'navigation', description: '' } },
    { keywords: ['courses', 'shopping', 'ununuzi'], action: { id: 'shopping', label: 'Courses', icon: 'shopping-cart', route: 'DeliveryShoppingFlowNew', category: 'navigation', description: '' } },
    { keywords: ['coursier', 'courier', 'mjumbe'], action: { id: 'courier', label: 'Dashboard Coursier', icon: 'truck', route: 'CourierDashboard', category: 'navigation', description: '' } },
    { keywords: ['flotte', 'fleet', 'flotte livraison', 'gestion flotte'], action: { id: 'fleet', label: 'Gestion Flotte', icon: 'users', route: 'FleetDashboard', category: 'navigation', description: 'Dashboard partenaire : stats /api/partners/me/fleet/*, coursiers, candidatures (approve-reject), analytics local' } },
    { keywords: ['restaurant', 'mkahawa'], action: { id: 'restaurant', label: 'Restaurant', icon: 'utensils', route: 'RestaurantDashboard', category: 'navigation', description: '' } },
    { keywords: ['agence', 'voyage', 'travel', 'safari'], action: { id: 'agence', label: 'Agence de Voyage', icon: 'plane', route: 'AgenceVoyageSearch', category: 'navigation', description: '' } },
    { keywords: ['ticket', 'billet', 'tikiti'], action: { id: 'bus-ticket', label: 'Tickets Bus', icon: 'bus', route: 'BusTicketSearch', category: 'navigation', description: '' } },
    { keywords: ['automobile', 'voiture', 'car', 'gari', 'véhicule', 'vehicule', 'occasion auto'], action: { id: 'auto', label: 'Recherche auto', icon: 'car', route: 'AutoServicesSearch', category: 'navigation', description: 'Catalogue client : /api/auto/filters + /api/auto/search — pas le dashboard partenaire' } },
    { keywords: ['pièce auto', 'pieces auto', 'pièces détachées', 'spare parts', 'accessoires auto'], action: { id: 'auto-parts', label: 'Recherche auto (pièces)', icon: 'wrench', route: 'AutoServicesSearch', category: 'navigation', description: 'Pas d’écran pièces seul : recherche texte + moteur /api/auto/search (backend inclut pièces auto)' } },
    { keywords: ['recette', 'recipe', 'mapishi'], action: { id: 'recipe', label: 'Recettes', icon: 'book-open', route: 'RecipeSearch', category: 'navigation', description: '' } },
    { keywords: ['bayam', 'marche', 'market', 'soko', 'kasuwa'], action: { id: 'bayam', label: 'BayamSelam', icon: 'tag', route: 'BayamSelamSearch', category: 'navigation', description: '' } },
    { keywords: ['favoris', 'favorites', 'vipendwa'], action: { id: 'favs', label: 'Favoris', icon: 'heart', route: 'MyFavorites', category: 'navigation', description: '' } },
    { keywords: ['recharge', 'topup', 'top up', 'jaza'], action: { id: 'recharge', label: 'Recharger mon solde', icon: 'plus-circle', route: 'RechargeTokens', category: 'navigation', description: '' } },
    { keywords: ['solde', 'balance', 'salio'], action: { id: 'balance', label: 'Mon solde', icon: 'wallet', route: 'WalletFinancial', category: 'navigation', description: '' } },
    { keywords: ['portefeuille', 'wallet', 'mkoba'], action: { id: 'wallet', label: 'Portefeuille', icon: 'wallet', route: 'WalletFinancial', category: 'navigation', description: '' } },
    { keywords: ['paiement', 'payment', 'malipo', 'biya'], action: { id: 'payment', label: 'Paiement', icon: 'credit-card', route: 'RechargeTokens', category: 'navigation', description: '' } },
    { keywords: ['token'], action: { id: 'tokens', label: 'Recharger tokens', icon: 'plus-circle', route: 'RechargeTokens', category: 'navigation', description: '' } },
    { keywords: ['transaction', 'muamala'], action: { id: 'transactions', label: 'Transactions', icon: 'list', route: 'WalletFinancial', category: 'navigation', description: '' } },
    { keywords: ['historique', 'history', 'historia'], action: { id: 'history', label: 'Historique', icon: 'clock', route: 'SoldeDetail', category: 'navigation', description: '' } },
    { keywords: ['finance', 'fedha'], action: { id: 'finance', label: 'Finances', icon: 'bar-chart-3', route: 'WalletFinancial', category: 'navigation', description: '' } },
  ];

  private static normalizeText(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private detectNavigationTarget(query: string): ActionDescriptor | null {
    const normalized = IntelligentChatService.normalizeText(query);
    for (const entry of IntelligentChatService.NAV_MAP) {
      for (const keyword of entry.keywords) {
        if (normalized.includes(IntelligentChatService.normalizeText(keyword))) {
          const translatedLabel = t(`intelligentChat.navLabel.${entry.action.id}`);
          const label = (translatedLabel && !translatedLabel.startsWith('intelligentChat.navLabel.'))
            ? translatedLabel
            : entry.action.label;
          return { ...entry.action, label };
        }
      }
    }
    return null;
  }

  private getScreenDescription(screenName: string): string {
    const i18nKey = `screenDescriptions.${screenName}`;
    const translated = t(i18nKey);
    if (translated && !translated.startsWith('screenDescriptions.')) {
      return translated;
    }

    const descriptions: Record<string, string> = {
      'Home': t('intelligentChat.screenDesc.home') || 'Page d\'accueil — accédez à tous les services Yukpo.',
      'Services': t('intelligentChat.screenDesc.servicesTab') || 'Onglet Mes services : gestion produits (MesServicesScreen).',
      'MesServices': t('intelligentChat.screenDesc.servicesTab') || 'Onglet Mes services : gestion produits (MesServicesScreen).',
      'HotelMeubleHome': t('intelligentChat.screenDesc.hotelMeubleHub') || 'Liste hôtels/meublés : filtres sans dates sur place ; réserver ouvre HotelBooking.',
      'HotelSearch': t('intelligentChat.screenDesc.hotelMeubleHub') || 'Liste hôtels/meublés : filtres sans dates sur place ; réserver ouvre HotelBooking.',
      'MeubleSearch': t('intelligentChat.screenDesc.hotelMeubleHub') || 'Liste hôtels/meublés : filtres sans dates sur place ; réserver ouvre HotelBooking.',
      'HotelBooking': t('intelligentChat.screenDesc.hotelBooking') || 'Demande de séjour : dates, occupants, coordonnées ; envoi API réservation ; paiement optionnel selon réponse.',
      'RechercheBesoin': t('intelligentChat.screenDesc.search') || 'Recherchez services et produits. Filtrez et négociez.',
      'ServiceDetail': t('intelligentChat.screenDesc.serviceDetail') || 'Détails d\'un service. Contactez, appelez, itinéraire.',
      'Profile': t('intelligentChat.screenDesc.profile') || 'Votre profil. Infos, paramètres, portefeuille.',
      'PharmacieHome': t('intelligentChat.screenDesc.pharmacy') || 'Pharmacies et médicaments proches.',
      'HopitalHome': t('intelligentChat.screenDesc.hospital') || 'Hôpitaux, cliniques, RDV, IA triage.',
      'HotelDashboard': t('intelligentChat.screenDesc.hotel') || 'Gestion hôtel : chambres, réservations, tarifs.',
      'TaxiHome': t('intelligentChat.screenDesc.taxi') || 'Taxi avec tarification IA dynamique.',
      'DeliveryHome': t('intelligentChat.screenDesc.delivery') || 'Colis et courses avec livraison.',
      'CovoiturageHome': t('intelligentChat.screenDesc.carpooling') || 'Covoiturage : trouvez ou proposez.',
      'OffresEmploiHome': t('intelligentChat.screenDesc.jobs') || 'Emplois : recherche et publication.',
      'OrientationScolaireHome': t('intelligentChat.screenDesc.orientation') || 'Orientation scolaire avec IA.',
      'LivreScolaireHome': t('intelligentChat.screenDesc.books') || 'Livres scolaires : achat, vente, troc.',
      'Navigation': t('intelligentChat.screenDesc.navigation') || 'GPS avec guidage vocal et alertes.',
      'RechargeTokens': t('intelligentChat.screenDesc.recharge') || 'Rechargez votre solde. Bonus jusqu\'à +20%.',
      'WalletFinancial': t('intelligentChat.screenDesc.wallet') || 'Suivi financier détaillé.',
      'SupermarketHome': t('intelligentChat.screenDesc.supermarket') || 'Supermarché : magasins, produits, comparaison IA.',
      'AssuranceDashboard': t('intelligentChat.screenDesc.assurancePartner') || 'Partenaire assurance : produits, polices, sinistres, stats ; loupe = marché utilisateur.',
      'InsuranceServicesSearch': t('intelligentChat.screenDesc.insuranceSearch') || 'Recherche / catalogue assurance utilisateur (API search, devis IA).',
      'InsuranceServicesResults': t('intelligentChat.screenDesc.insuranceResults') || 'Résultats GET /api/assurance/search ; carte → ServiceDetail.',
      'InsuranceQuoteRequest': t('intelligentChat.screenDesc.insuranceQuoteUser') || 'Devis IA : POST /api/assurance/ai/quote (type obligatoire).',
      'MesPolicesAssurance': t('intelligentChat.screenDesc.mesPolicesAssurance') || 'Polices client : GET /api/assurance/policies/client.',
      'DeclarationSinistre': t('intelligentChat.screenDesc.declarationSinistre') || 'Déclaration sinistre : policy requise, createClaim.',
      'SuiviSinistre': t('intelligentChat.screenDesc.suiviSinistre') || 'Suivi sinistres client : GET claims/client, lecture seule.',
      'CourierDashboard': t('intelligentChat.screenDesc.courierDashboard') || 'Coursier : livraisons actives (GET /api/deliveries/active), stats, bourse du livre coursier, portefeuille.',
      'FleetDashboard': t('intelligentChat.screenDesc.fleetDashboard') || 'Partenaire flotte : stats GET /api/partners/me/fleet/*, coursiers, candidatures, analytics (données locales).',
      'AutomobileDashboard': t('intelligentChat.screenDesc.automobileDashboard') || 'Partenaire auto : stock GET /api/specialized-services/user?type=automobile ; ajout = Alert formulaire intelligent.',
      'AutoServicesSearch': t('intelligentChat.screenDesc.autoServicesSearch') || 'Recherche véhicules : GET /api/auto/filters, puis résultats /api/auto/search (GPS+rayon ; ville non envoyée au backend).',
      'AutoServicesResults': t('intelligentChat.screenDesc.autoServicesResults') || 'Liste auto : GET /api/auto/search, ServiceDetail, chat/WhatsApp/appel, avis inline.',
    };
    return descriptions[screenName] || t('intelligentChat.fallback.genericHelp', { screen: screenName }) || `Écran « ${screenName} ». Je peux vous guider ici.`;
  }

  /**
   * Mettre en cache le contexte d'écran
   */
  cacheScreenContext(route: string, context: ScreenContext): void {
    this.contextCache.set(route, context);
  }

  /**
   * Obtenir le contexte mis en cache
   */
  getCachedContext(route: string): ScreenContext | undefined {
    return this.contextCache.get(route);
  }

  /**
   * Nettoyer le cache
   */
  clearCache(): void {
    this.contextCache.clear();
  }

  /**
   * Détecter si une question du HomeScreen est contextuelle et doit déléguer à un module spécialisé
   * Retourne le contexte cible ou null si la question reste générale
   */
  detectContextualDelegation(userMessage: string): {
    targetScreen: string;
    confidence: number;
    contextualPrompt: string;
    suggestedActions: ActionDescriptor[];
  } | null {
    const q = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Mots-clés par module avec seuil de confiance
    const contextualKeywords = [
      {
        screen: 'Navigation',
        keywords: [
          'itineraire', 'itinéraire', 'route', 'chemin', 'direction', 'gps', 'navigation', 'marche', 'sport', 'coach',
          'alerte', 'point', 'interet', 'poi', 'adresse', 'destination', 'origine', 'distance', 'temps',
          'walking', 'running', 'cycling', 'velo', 'step', 'fitness', 'activite', 'statistique', 'calories'
        ],
        contextualPrompt: 'Navigation intelligente : itinéraires GPS, alertes communautaires, points d\'intérêt, marche libre, coaching sportif et statistiques d\'activité.',
        suggestedActions: [
          { id: 'nav-route', label: 'Calculer itinéraire', icon: 'map', route: 'Navigation', category: 'navigation' as const, description: 'Obtenir un itinéraire GPS' },
          { id: 'nav-poi', label: 'Points d\'intérêt', icon: 'map-pin', route: 'Navigation', category: 'navigation' as const, description: 'Trouver des lieux à proximité' },
          { id: 'nav-walk', label: 'Marche libre', icon: 'activity', route: 'Navigation', category: 'navigation' as const, description: 'Commencer une marche' }
        ]
      },
      {
        screen: 'MesServices',
        keywords: [
          'mes services', 'mon service', 'produit', 'catalogue', 'vendre', 'ajouter produit', 'gestion',
          'mes produits', 'vendeur', 'prestataire', 'mon catalogue', 'modifier produit', 'supprimer produit'
        ],
        contextualPrompt: 'Gestion produits : catalogue vendeur, ajout/modification/suppression de produits, statistiques ventes, configuration service.',
        suggestedActions: [
          { id: 'services-add', label: 'Ajouter produit', icon: 'plus', route: 'MesServices', category: 'action' as const, description: 'Ajouter un nouveau produit' },
          { id: 'services-manage', label: 'Gérer catalogue', icon: 'briefcase', route: 'MesServices', category: 'action' as const, description: 'Voir tous mes produits' },
          { id: 'services-stats', label: 'Statistiques', icon: 'bar-chart-3', route: 'MesServices', category: 'action' as const, description: 'Voir les performances' }
        ]
      },
      {
        screen: 'PharmacieHome',
        keywords: [
          'medicament', 'pharmacie', 'ordonnance', 'dosage', 'traitement', 'medic', 'pharma',
          'sante', 'maladie', 'symptome', 'ordonnance', 'posologie', 'effet secondaire'
        ],
        contextualPrompt: 'Pharmacie : recherche médicaments, ordonnances IA, dosage recommandé, effets secondaires, pharmacies de garde.',
        suggestedActions: [
          { id: 'pharma-search', label: 'Rechercher médicament', icon: 'pill', route: 'PharmacieHome', category: 'navigation' as const, description: 'Trouver un médicament' },
          { id: 'pharma-nearby', label: 'Pharmacies nearby', icon: 'map-pin', route: 'PharmacieHome', category: 'navigation' as const, description: 'Pharmacies à proximité' },
          { id: 'pharma-ia', label: 'Analyse ordonnance', icon: 'scan', route: 'PharmacieHome', category: 'action' as const, description: 'Scanner une ordonnance' }
        ]
      },
      {
        screen: 'HopitalHome',
        keywords: [
          'hopital', 'hospital', 'clinique', 'urgence', 'medecin', 'docteur', 'consultation',
          'rdv', 'rendez-vous', 'sante', 'maladie', 'symptome', 'triage', 'analyse'
        ],
        contextualPrompt: 'Hôpital : urgences, rendez-vous, IA triage médical, spécialistes, consultations, analyses de laboratoire.',
        suggestedActions: [
          { id: 'hosp-urgent', label: 'Urgences', icon: 'alert-triangle', route: 'HopitalHome', category: 'navigation' as const, description: 'Trouver les urgences' },
          { id: 'hosp-rdv', label: 'Prendre RDV', icon: 'calendar', route: 'HopitalHome', category: 'action' as const, description: 'Rendez-vous médical' },
          { id: 'hosp-ia', label: 'IA Triage', icon: 'stethoscope', route: 'HopitalHome', category: 'action' as const, description: 'Analyse symptômes' }
        ]
      },
      {
        screen: 'OffresEmploiHome',
        keywords: [
          'emploi', 'travail', 'job', 'cv', 'recrutement', 'postuler', 'salaire', 'entretien',
          'carriere', 'professionnel', 'embauche', 'chercheur', 'candidat', 'entreprise'
        ],
        contextualPrompt: 'Emploi : offres d\'emploi, CV IA, salaire estimé, entretiens, carrières, recrutement intelligent.',
        suggestedActions: [
          { id: 'job-search', label: 'Rechercher emploi', icon: 'briefcase', route: 'OffresEmploiHome', category: 'navigation' as const, description: 'Trouver un emploi' },
          { id: 'job-cv', label: 'Analyser CV', icon: 'file-text', route: 'OffresEmploiHome', category: 'action' as const, description: 'Optimiser mon CV' },
          { id: 'job-salary', label: 'Estimer salaire', icon: 'dollar-sign', route: 'OffresEmploiHome', category: 'action' as const, description: 'Estimation salaire' }
        ]
      },
      {
        screen: 'LivreScolaireHome',
        keywords: [
          'livre', 'ecole', 'education', 'etude', 'cours', 'manuel', 'bourse', 'troc', 'achat',
          'eleve', 'etudiant', 'classe', 'matiere', 'scolaire', 'universitaire'
        ],
        contextualPrompt: 'Bourse du livre : troc intelligent, analyse livres IA, programmes scolaires, estimation prix, livraison.',
        suggestedActions: [
          { id: 'book-exchange', label: 'Troc livres', icon: 'book-open', route: 'LivreScolaireHome', category: 'navigation' as const, description: 'Échanger des livres' },
          { id: 'book-scan', label: 'Analyser livre', icon: 'scan', route: 'LivreScolaireHome', category: 'action' as const, description: 'Scanner un livre' },
          { id: 'book-price', label: 'Estimer prix', icon: 'tag', route: 'LivreScolaireHome', category: 'action' as const, description: 'Estimer la valeur' }
        ]
      }
    ];

    // Calculer le score pour chaque contexte
    let bestMatch: typeof contextualKeywords[0] | null = null;
    let bestScore = 0;
    let matchedKeywords: string[] = [];

    for (const context of contextualKeywords) {
      let score = 0;
      let contextMatches: string[] = [];

      for (const keyword of context.keywords) {
        const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Recherche exacte
        if (q.includes(normalizedKeyword)) {
          score += 3;
          contextMatches.push(keyword);
        }
        // Recherche partielle (mot complet)
        else if (q.split(' ').some(word => word.length >= 3 && normalizedKeyword.includes(word))) {
          score += 1;
          contextMatches.push(keyword);
        }
        // Similarité approximative
        else if (this.calculateSimilarity(q, normalizedKeyword) > 0.7) {
          score += 2;
          contextMatches.push(keyword);
        }
      }

      // Ajustement du score basé sur la longueur et la spécificité
      if (contextMatches.length > 0) {
        score = score / Math.sqrt(context.keywords.length); // Normaliser par la taille du dictionnaire

        if (score > bestScore) {
          bestScore = score;
          bestMatch = context;
          matchedKeywords = contextMatches;
        }
      }
    }

    // Seuil de confiance minimum pour déléguer
    if (bestMatch && bestScore >= 1.5) {
      return {
        targetScreen: bestMatch.screen,
        confidence: Math.min(bestScore / 3, 1), // Normaliser entre 0 et 1
        contextualPrompt: bestMatch.contextualPrompt,
        suggestedActions: bestMatch.suggestedActions
      };
    }

    return null;
  }

  /**
   * Calculer la similarité entre deux chaînes (algorithme de Jaccard simplifié)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ').filter(w => w.length >= 2);
    const words2 = str2.split(' ').filter(w => w.length >= 2);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Générer une réponse de délégation contextuelle pour le HomeScreen
   */
  generateContextualDelegationResponse(
    userMessage: string,
    delegation: ReturnType<typeof this.detectContextualDelegation>
  ): ChatResponse {
    if (!delegation) {
      return this.generateFallbackResponse(userMessage);
    }

    const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

    return {
      message: `${t('intelligentChat.contextual.prefix') || 'Je vois que votre question concerne'} **${delegation.targetScreen}**. ${delegation.contextualPrompt}`,
      type: 'action_suggestion',
      suggestedActions: delegation.suggestedActions,
      nextSteps: [
        t('intelligentChat.contextual.action1') || 'Naviguer vers le module spécialisé',
        t('intelligentChat.contextual.action2') || 'Utiliser le chat contextuel du module',
        t('intelligentChat.contextual.action3') || 'Revenir ici pour d\'autres questions'
      ],
      confidence: delegation.confidence
    };
  }

  /**
   * Générer une réponse de fallback pour les questions générales
   */
  generateFallbackResponse(userMessage: string): ChatResponse {
    const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

    return {
      message: t('intelligentChat.fallback.general') || 'Je suis votre assistant IA sur l\'accueil. Je peux vous aider avec la recherche de services, la création de votre activité, ou vous orienter vers les modules spécialisés. Que souhaitez-vous faire ?',
      type: 'action_suggestion',
      suggestedActions: [
        { id: 'search', label: 'Rechercher un service', icon: 'search', route: 'Home', category: 'navigation' as const, description: 'Trouver des services ou produits' },
        { id: 'create', label: 'Créer un service', icon: 'plus', route: 'Home', category: 'action' as const, description: 'Démarrer votre activité' },
        { id: 'discover', label: 'Découvrir Yukpo', icon: 'rocket', route: 'Home', category: 'help' as const, description: 'Explorer toutes les fonctionnalités' }
      ],
      confidence: 0.5
    };
  }

  /**
   * Obtenir une réponse contextuelle (pour compatibilité avec HomeIntelligentChat)
   */
  async getContextualResponse(
    userMessage: string,
    screenName: string,
    screenType: string,
    history: ChatMessage[],
    user: any
  ): Promise<ChatResponse> {
    // Pour le HomeScreen, détecter et utiliser les contextes spécialisés
    if (screenName === 'Home') {
      const delegation = this.detectContextualDelegation(userMessage);
      if (delegation) {
        // 🎯 NOUVEAU: Utiliser directement le contexte du module spécialisé
        return this.getContextualResponseFromModule(userMessage, delegation.targetScreen, history, user);
      }
    }

    // Sinon, utiliser la logique existante ou le fallback
    try {
      return this.generateFallbackResponse(userMessage);
    } catch (error) {
      console.error('[IntelligentChatService] Erreur dans getContextualResponse:', error);
      return this.generateFallbackResponse(userMessage);
    }
  }

  /**
   * 🎯 NOUVEAU: Obtenir une réponse contextuelle COMME SI on était dans le module spécialisé
   */
  private async getContextualResponseFromModule(
    userMessage: string,
    targetScreen: string,
    history: ChatMessage[],
    user: any
  ): Promise<ChatResponse> {
    const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

    console.log(`[IntelligentChatService] 🎯 Contextual response from ${targetScreen} for HomeScreen`);

    try {
      // Simuler le contexte du module spécialisé
      const moduleContext = this.getModuleContext(targetScreen);

      // Utiliser l'API backend avec le contexte du module
      const response = await this.callBackendWithContext(userMessage, moduleContext, user);

      // Enrichir la réponse avec les actions du module
      return {
        ...response,
        suggestedActions: this.getModuleActions(targetScreen)
      };

    } catch (error) {
      console.error(`[IntelligentChatService] Erreur contexte ${targetScreen}:`, error);

      // Fallback au contexte spécialisé local
      return this.getSpecializedFallback(userMessage, targetScreen);
    }
  }

  /**
   * 🎯 NOUVEAU: Obtenir le contexte d'un module spécialisé
   */
  private getModuleContext(screenName: string): {
    screenName: string;
    screenType: string;
    contextData: any;
    availableFeatures: string[];
  } {
    const contexts: Record<string, any> = {
      'Navigation': {
        screenName: 'Navigation',
        screenType: 'specialized',
        contextData: {
          features: ['gps', 'itineraires', 'alertes', 'poi', 'marche', 'sport', 'coach_ia'],
          userLocation: 'current', // Le backend récupérera la position réelle
          preferences: 'driving' // Mode par défaut
        },
        availableFeatures: ['route_planning', 'poi_search', 'community_alerts', 'free_walk', 'ai_coach']
      },
      'PharmacieHome': {
        screenName: 'PharmacieHome',
        screenType: 'specialized',
        contextData: {
          features: ['medicaments', 'ordonnances', 'dosage', 'pharmacies', 'ia_scan'],
          userLocation: 'current',
          searchType: 'medicament'
        },
        availableFeatures: ['medicament_search', 'ordonnance_scan', 'dosage_checker', 'pharmacy_finder']
      },
      'HopitalHome': {
        screenName: 'HopitalHome',
        screenType: 'specialized',
        contextData: {
          features: ['urgences', 'rendez_vous', 'specialistes', 'triage_ia'],
          userLocation: 'current',
          medicalHistory: 'available'
        },
        availableFeatures: ['emergency_finder', 'appointment_booking', 'specialist_search', 'ai_triage']
      },
      'OffresEmploiHome': {
        screenName: 'OffresEmploiHome',
        screenType: 'specialized',
        contextData: {
          features: ['offres', 'cv_ia', 'salaire', 'entretiens', 'carriere'],
          userProfile: 'candidate', // ou 'employer'
          location: 'current'
        },
        availableFeatures: ['job_search', 'cv_analysis', 'salary_prediction', 'interview_prep']
      },
      'LivreScolaireHome': {
        screenName: 'LivreScolaireHome',
        screenType: 'specialized',
        contextData: {
          features: ['troc', 'vente', 'scan_livre', 'programmes', 'estimation'],
          educationLevel: 'all', // primaire, secondaire, supérieur
          location: 'current'
        },
        availableFeatures: ['book_exchange', 'book_scan', 'price_estimation', 'program_check']
      },
      'MesServices': {
        screenName: 'MesServices',
        screenType: 'dashboard',
        contextData: {
          features: ['catalogue', 'produits', 'statistiques', 'commandes'],
          userRole: 'prestataire',
          hasProducts: true // Le backend vérifiera
        },
        availableFeatures: ['product_management', 'catalog_view', 'sales_stats', 'order_tracking']
      }
    };

    return contexts[screenName] || {
      screenName: 'Home',
      screenType: 'home',
      contextData: {},
      availableFeatures: []
    };
  }

  /**
   * 🎯 NOUVEAU: Appeler le backend avec le contexte du module
   */
  private async callBackendWithContext(
    userMessage: string,
    moduleContext: any,
    user: any
  ): Promise<ChatResponse> {
    const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

    try {
      // Appeler l'API backend avec le contexte enrichi
      const prompt = this.buildContextualPrompt(userMessage, moduleContext);

      // Simulation de réponse backend (remplacer par vrai appel API)
      const backendResponse = await this.simulateBackendResponse(prompt, moduleContext);

      return backendResponse;

    } catch (error) {
      console.error('[IntelligentChatService] Erreur appel backend contextuel:', error);
      throw error;
    }
  }

  /**
   * 🎯 NOUVEAU: Construire un prompt contextuel pour le backend
   */
  private buildContextualPrompt(userMessage: string, moduleContext: any): string {
    const contextInfo = `
Contexte: ${moduleContext.screenName} (${moduleContext.screenType})
Fonctionnalités disponibles: ${moduleContext.availableFeatures.join(', ')}
Données utilisateur: ${JSON.stringify(moduleContext.contextData)}

Question utilisateur: "${userMessage}"

Répondez COMME SI vous étiez l'assistant spécialisé du module ${moduleContext.screenName}.
Soyez précis, utilisez les fonctionnalités disponibles, et donnez des réponses pratiques.
    `.trim();

    return contextInfo;
  }

  /**
   * 🎯 NOUVEAU: Simuler une réponse backend contextuelle (remplacer par vrai appel API)
   */
  private async simulateBackendResponse(prompt: string, moduleContext: any): Promise<ChatResponse> {
    const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;
    const screenName = moduleContext.screenName;

    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 800));

    // Réponses contextuelles précises selon le module
    const contextualResponses: Record<string, (prompt: string) => ChatResponse> = {
      'Navigation': (p) => ({
        message: this.getNavigationResponse(p),
        type: 'action_suggestion',
        suggestedActions: this.getNavigationActions(),
        confidence: 0.9
      }),
      'PharmacieHome': (p) => ({
        message: this.getPharmacyResponse(p),
        type: 'action_suggestion',
        suggestedActions: this.getPharmacyActions(),
        confidence: 0.9
      }),
      'HopitalHome': (p) => ({
        message: this.getHospitalResponse(p),
        type: 'action_suggestion',
        suggestedActions: this.getHospitalActions(),
        confidence: 0.9
      }),
      'OffresEmploiHome': (p) => ({
        message: this.getEmploiResponse(p),
        type: 'action_suggestion',
        suggestedActions: this.getEmploiActions(),
        confidence: 0.9
      }),
      'LivreScolaireHome': (p) => ({
        message: this.getLivreResponse(p),
        type: 'action_suggestion',
        suggestedActions: this.getLivreActions(),
        confidence: 0.9
      }),
      'MesServices': (p) => ({
        message: this.getServicesResponse(p),
        type: 'action_suggestion',
        suggestedActions: this.getServicesActions(),
        confidence: 0.9
      })
    };

    const responseGenerator = contextualResponses[screenName];
    if (responseGenerator) {
      return responseGenerator(prompt);
    }

    // Fallback générique
    return {
      message: t('intelligentChat.fallback.genericHelp', { screen: screenName }) || `Je suis l'assistant spécialisé pour ${screenName}. Comment puis-je vous aider ?`,
      type: 'text',
      confidence: 0.5
    };
  }

  /**
   * 🎯 Réponses contextuelles Navigation
   */
  private getNavigationResponse(prompt: string): string {
    const q = prompt.toLowerCase();

    if (q.includes('itinéraire') || q.includes('route') || q.includes('chemin')) {
      return "🗺️ **Calcul d'itinéraire intelligent**\n\nJe peux calculer le meilleur itinéraire pour vous en tenant compte du trafic, des alertes communautaires et de votre mode de transport préféré.\n\n**Comment procéder :**\n1. Dites-moi votre destination (ex: \"itinéraire vers Douala\")\n2. Choisissez le mode : 🚗 Voiture, 🚶 Marche, 🚌 Transport, 🚴 Vélo\n3. Je vous donnerai le trajet optimal avec temps réel\n\n**Fonctionnalités disponibles :**\n• ⚡ Itinéraires en temps réel\n• ⚠️ Alertes sécurité et radars\n• 📍 Points d'intérêt sur le trajet\n• 🎯 Coach IA pour optimiser votre parcours";
    }

    if (q.includes('marche') || q.includes('sport') || q.includes('coach')) {
      return "🏃‍♂️ **Coach IA Sport et Marche**\n\nJe suis votre coach personnel pour optimiser vos activités physiques et vos déplacements à pied.\n\n**Ce que je peux faire :**\n• 📊 Analyser vos performances (distance, calories, rythme)\n• 🎯 Fixer des objectifs personnalisés\n• 💡 Donner des conseils d'entraînement\n• 🗺️ Suggérer des itinéraires de marche sécurisés\n• 📈 Suivre vos progrès sur la semaine/mois/année\n\n**Pour commencer :** Dites-moi \"commencer une marche\" ou \"voir mes statistiques\"";
    }

    if (q.includes('alerte') || q.includes('sécurité') || q.includes('danger')) {
      return "⚠️ **Alertes Communautaires et Sécurité**\n\nJe vous informe en temps réel des dangers et points d'intérêt sur votre parcours grâce à la communauté Yukpo.\n\n**Types d'alertes :**\n• 🚔 Contrôles routiers et radars\n• ⚠️ Zones dangereuses ou travaux\n• 🏥 Urgences et services médicaux\n• 🛡️ Points de sécurité recommandés\n• 📍 Lieux sûrs pour pause/repos\n\n**Signalement :** Vous pouvez aussi signaler des alertes pour aider la communauté. Dites \"signaler alerte [description]\"";
    }

    return "🧭 **Navigation Intelligente Yukpo**\n\nJe suis votre assistant GPS IA pour tous vos déplacements au Cameroun et en Afrique.\n\n**Mes fonctionnalités :**\n• 🗺️ Itinéraires optimisés avec trafic réel\n• 🚶‍♂️ Coach sportif personnel\n• ⚠️ Alertes sécurité communautaires\n• 📍 Points d'intérêt (pharmacies, hôpitaux, stations-service)\n• 📊 Statistiques détaillées de vos déplacements\n\n**Comment puis-je vous aider aujourd'hui ?**\n• Calculer un itinéraire ?\n• Commencer une marche ?\n• Trouver un lieu à proximité ?\n• Voir vos statistiques ?";
  }

  /**
   * 🎯 Actions contextuelles Navigation
   */
  private getNavigationActions(): ActionDescriptor[] {
    return [
      { id: 'nav-plan-route', label: 'Calculer itinéraire', icon: 'map', route: 'Navigation', category: 'action', description: 'Obtenir un itineraire GPS optimise' },
      { id: 'nav-start-walk', label: 'Commencer marche', icon: 'activity', route: 'Navigation', category: 'action', description: 'Demarrer une marche avec coach IA' },
      { id: 'nav-find-poi', label: 'Points d interet', icon: 'map-pin', route: 'Navigation', category: 'action', description: 'Trouver des lieux a proximite' },
      { id: 'nav-alerts', label: 'Voir alertes', icon: 'alert-triangle', route: 'Navigation', category: 'action', description: 'Consulter les alertes securite' },
      { id: 'nav-stats', label: 'Statistiques', icon: 'bar-chart-3', route: 'Navigation', category: 'action', description: 'Voir vos performances' }
    ];
  }

  /**
   * 🎯 Réponses contextuelles Pharmacie
   */
  private getPharmacyResponse(prompt: string): string {
    const q = prompt.toLowerCase();

    if (q.includes('médicament') || q.includes('medicament') || q.includes('traitement')) {
      return "💊 **Recherche de Médicaments**\n\nJe peux vous aider à trouver rapidement les médicaments dont vous avez besoin avec informations complètes.\n\n**Recherche disponible :**\n• 🔍 Par nom de médicament (ex: \"paracétamol\")\n• 🏪 Disponibilité en pharmacies proches\n• 💰 Prix comparés entre pharmacies\n• ⚠️ Contre-indications et effets secondaires\n• 📋 Posologie recommandée\n\n**Comment utiliser :** Dites-moi le nom du médicament ou votre symptôme (ex: \"trouver paracétamol\" ou \"mal de tête\")";
    }

    if (q.includes('ordonnance') || q.includes('ordonnance') || q.includes('prescription')) {
      return "📋 **Analyse d'Ordonnance par IA**\n\nScannez votre ordonnance et je vous aide à comprendre et gérer votre traitement.\n\n**Fonctionnalités IA :**\n• 📸 Scan automatique des médicaments\n• 💊 Vérification des interactions médicamenteuses\n• ⏰ Rappels de prise automatiques\n• 🏪 Pharmacies avec stock disponible\n• 💰 Estimation du coût total\n\n**Pour commencer :** Prenez une photo de votre ordonnance ou dites \"scanner ordonnance\"";
    }

    if (q.includes('pharmacie') || q.includes('pharmacie') || q.includes('garde')) {
      return "🏥 **Pharmacies de Garde et Proches**\n\nJe vous trouve les pharmacies ouvertes 24/7 et les plus proches de votre position.\n\n**Informations disponibles :**\n• ⏰ Horaires d'ouverture (y compris de garde)\n• 📍 Distance et temps de trajet\n• 📞 Numéro de téléphone\n• 💰 Services disponibles (livraison, ordonnances)\n• ⭐ Avis et notes des patients\n\n**Recherche :** Dites-moi \"pharmacie proche\" ou \"pharmacie de garde\"";
    }

    return "🏥 **Assistant Pharmacie Yukpo**\n\nJe suis votre spécialiste de la santé pour tous vos besoins pharmaceutiques.\n\n**Services disponibles :**\n• 💊 Recherche de médicaments\n• 📋 Analyse IA d'ordonnances\n• 🏪 Pharmacies de garde et proches\n• 💡 Conseils posologie et interactions\n• 🚗 Livraison à domicile\n\n**Comment puis-je vous aider ?**\n• Trouver un médicament ?\n• Scanner une ordonnance ?\n• Pharmacie de garde ?";
  }

  /**
   * 🎯 Actions contextuelles Pharmacie
   */
  private getPharmacyActions(): ActionDescriptor[] {
    return [
      { id: 'pharma-search', label: 'Rechercher medicament', icon: 'pill', route: 'PharmacieHome', category: 'action', description: 'Trouver un medicament specifique' },
      { id: 'pharma-scan', label: 'Scanner ordonnance', icon: 'scan', route: 'PharmacieHome', category: 'action', description: 'Analyser une ordonnance avec IA' },
      { id: 'pharma-nearby', label: 'Pharmacies proches', icon: 'map-pin', route: 'PharmacieHome', category: 'action', description: 'Trouver pharmacies autour' },
      { id: 'pharma-garde', label: 'Pharmacies de garde', icon: 'clock', route: 'PharmacieHome', category: 'action', description: 'Pharmacies ouvertes 24/7' },
      { id: 'pharma-delivery', label: 'Livraison', icon: 'truck', route: 'PharmacieHome', category: 'action', description: 'Livraison a domicile' }
    ];
  }

  /**
   * 🎯 Réponses contextuelles Hôpital
   */
  private getHospitalResponse(prompt: string): string {
    const q = prompt.toLowerCase();

    if (q.includes('urgence') || q.includes('urgence') || q.includes('emergency')) {
      return "🚨 **Urgences Médicales**\n\nJe vous aide rapidement à trouver les services d'urgence les plus proches et adaptés à votre situation.\n\n**Services d'urgence :**\n• 🏥 Hôpitaux avec urgences 24/7\n• 🚑 SAMU et numéros d'urgence\n• ⚠️ Temps d'attente estimé\n• 📍 Distance et itinéraire le plus rapide\n• 📞 Contact direct des services\n\n**En cas d'urgence vitale :** Appelez le 1510 (SAMU) ou dites \"urgence vitale\" pour les coordonnées immédiates.";
    }

    if (q.includes('rendez-vous') || q.includes('rdv') || q.includes('consultation')) {
      return "📅 **Prise de Rendez-vous Médical**\n\nJe vous aide à prendre rendez-vous avec les spécialistes et services médicaux disponibles.\n\n**Disponibilités :**\n• 👨‍⚕️ Médecins généralistes et spécialistes\n• 🏥 Hôpitaux et cliniques\n• ⏰ Créneaux disponibles en temps réel\n• 📋 Préparation automatique des documents\n• 🔔 Rappels de rendez-vous\n\n**Comment procéder :** Dites-moi le type de consultation (ex: \"rendez-vous cardiologue\")";
    }

    if (q.includes('symptôme') || q.includes('symptome') || q.includes('maladie')) {
      return "🔬 **Triage IA et Analyse de Symptômes**\n\nDécrivez vos symptômes et je vous aide à évaluer la gravité et à orienter vers le bon service.\n\n**Fonctionnalités IA :**\n• 🤖 Analyse intelligente des symptômes\n• ⚠️ Évaluation du niveau d'urgence\n• 🏥 Orientation vers le service approprié\n• 📋 Questions complémentaires si besoin\n• 🚨 Alertes si urgence détectée\n\n**Confidentialité :** Vos données médicales sont protégées et ne sont partagées qu'avec votre consentement.";
    }

    return "🏥 **Assistant Hôpital Yukpo**\n\nJe suis votre guide médical pour tous vos besoins de santé.\n\n**Services disponibles :**\n• 🚨 Urgences 24/7\n• 📅 Prise de rendez-vous\n• 🔬 Triage IA des symptômes\n• 👨‍⚕️ Répertoire des spécialistes\n• 📊 Historique médical\n\n**Comment puis-je vous aider ?**\n• Urgence médicale ?\n• Prendre rendez-vous ?\n• Analyser des symptômes ?";
  }

  /**
   * 🎯 Actions contextuelles Hôpital
   */
  private getHospitalActions(): ActionDescriptor[] {
    return [
      { id: 'hosp-urgent', label: 'Urgences', icon: 'alert-triangle', route: 'HopitalHome', category: 'action', description: 'Services d urgence 24/7' },
      { id: 'hosp-rdv', label: 'Prendre RDV', icon: 'calendar', route: 'HopitalHome', category: 'action', description: 'Rendez-vous medical' },
      { id: 'hosp-triage', label: 'IA Triage', icon: 'stethoscope', route: 'HopitalHome', category: 'action', description: 'Analyser symptomes' },
      { id: 'hosp-specialists', label: 'Specialistes', icon: 'users', route: 'HopitalHome', category: 'action', description: 'Trouver un specialiste' },
      { id: 'hosp-history', label: 'Historique', icon: 'file-text', route: 'HopitalHome', category: 'action', description: 'Voir historique medical' }
    ];
  }

  /**
   * 🎯 Réponses contextuelles Emploi
   */
  private getEmploiResponse(prompt: string): string {
    const q = prompt.toLowerCase();

    if (q.includes('cv') || q.includes('cv') || q.includes('resume')) {
      return "📄 **Analyse et Optimisation de CV par IA**\n\nJe vous aide à créer un CV parfait qui vous démarquera auprès des recruteurs.\n\n**Fonctionnalités IA :**\n• 📝 Analyse automatique de votre CV\n• 💡 Suggestions d'amélioration personnalisées\n• 🎯 Optimisation pour chaque offre d'emploi\n• 📊 Score de matching avec les offres\n• 🔄 Génération de plusieurs versions\n\n**Comment utiliser :** Uploadez votre CV ou dites \"analyser mon CV\" pour commencer.";
    }

    if (q.includes('salaire') || q.includes('salaire') || q.includes('revenu')) {
      return "💰 **Estimation de Salaire par IA**\n\nJ'estime votre salaire potentiel selon votre profil, expérience et le marché actuel.\n\n**Facteurs analysés :**\n• 🎓 Formation et compétences\n• 💼 Expérience professionnelle\n• 📍 Localisation géographique\n• 🏢 Secteur d'activité\n• 📈 Tendances du marché\n\n**Précision :** Mes estimations sont basées sur des milliers d'offres réelles et sont mises à jour en temps réel.";
    }

    if (q.includes('entretien') || q.includes('entretien') || q.includes('interview')) {
      return "🎯 **Préparation aux Entretiens**\n\nJe vous prépare à réussir vos entretiens avec des simulations et conseils personnalisés.\n\n**Préparation complète :**\n• ❓ Questions fréquentes par secteur\n• 🎭 Simulation d'entretien IA\n• 💡 Conseils de présentation\n• 📝 Réponses types à adapter\n• 🏢 Culture d'entreprise\n\n**Secteurs couverts :** Tech, santé, finance, commerce, et bien d'autres.";
    }

    return "💼 **Assistant Emploi Yukpo**\n\nJe suis votre coach carrière pour trouver l'emploi parfait et optimiser votre profil.\n\n**Services disponibles :**\n• 🔍 Recherche d'offres intelligentes\n• 📄 Analyse IA de CV\n• 💰 Estimation de salaire\n• 🎯 Préparation entretiens\n• 📊 Suivi des candidatures\n\n**Comment puis-je vous aider ?**\n• Trouver un emploi ?\n• Analyser votre CV ?\n• Estimer votre salaire ?";
  }

  /**
   * 🎯 Actions contextuelles Emploi
   */
  private getEmploiActions(): ActionDescriptor[] {
    return [
      { id: 'job-search', label: 'Rechercher emploi', icon: 'briefcase', route: 'OffresEmploiHome', category: 'action', description: 'Trouver des offres d emploi' },
      { id: 'job-cv', label: 'Analyser CV', icon: 'file-text', route: 'OffresEmploiHome', category: 'action', description: 'Optimiser votre CV avec IA' },
      { id: 'job-salary', label: 'Estimer salaire', icon: 'dollar-sign', route: 'OffresEmploiHome', category: 'action', description: 'Calculer votre salaire potentiel' },
      { id: 'job-interview', label: 'Preparer entretien', icon: 'users', route: 'OffresEmploiHome', category: 'action', description: 'Simulation d entretien IA' },
      { id: 'job-applications', label: 'Mes candidatures', icon: 'list', route: 'OffresEmploiHome', category: 'action', description: 'Suivre vos candidatures' }
    ];
  }

  /**
   * 🎯 Réponses contextuelles Livres
   */
  private getLivreResponse(prompt: string): string {
    const q = prompt.toLowerCase();

    if (q.includes('troc') || q.includes('troc') || q.includes('échange')) {
      return "🔄 **Troc Intelligent de Livres Scolaires**\n\nJe vous aide à trouver le partenaire de troc parfait pour vos livres scolaires avec notre algorithme DAG.\n\n**Comment ça marche :**\n• 📸 Scannez vos livres (recto/verso)\n• 🤖 IA analyse état et valeur\n• 🔗 Chainage intelligent avec d'autres utilisateurs\n• 📦 Livraison sécurisée par coursiers\n• ✅ Validation à réception\n\n**Avantages :** Économisez jusqu'à 80% sur les livres scolaires !";
    }

    if (q.includes('scan') || q.includes('scanner') || q.includes('photo')) {
      return "📸 **Scan et Analyse de Livres par IA**\n\nScannez vos livres et je vous donne instantanément toutes les informations.\n\n**Fonctionnalités IA :**\n• 📖 Reconnaissance automatique du titre/auteur\n• 🎓 Détection du niveau scolaire\n• 💰 Estimation précise de la valeur\n• 📊 État du livre (bon/acceptable/rejeté)\n• 🔍 Vérification des programmes scolaires\n\n**Qualité garantie :** 95% de précision sur les livres standards camerounais.";
    }

    if (q.includes('prix') || q.includes('valeur') || q.includes('coût')) {
      return "💰 **Estimation de Prix de Livres**\n\nJ'estime la valeur de vos livres selon l'état, la demande et les prix du marché.\n\n**Facteurs d'estimation :**\n• 📚 Éat général (bon/acceptable/rejeté)\n• 🎓 Niveau scolaire et matière\n• 📅 Année d'édition\n• 🏪 Demande du marché local\n• 📊 Prix moyens des librairies\n\n**Précision :** Mes estimations vous permettent de vendre au meilleur prix ou trouver les meilleures offres de troc.";
    }

    return "📚 **Bourse du Livre Yukpo**\n\nJe suis votre spécialiste pour tous vos besoins en livres scolaires.\n\n**Services disponibles :**\n• 🔄 Troc intelligent avec algorithmes DAG\n• 📸 Scan IA de livres\n• 💰 Estimation de prix précise\n• 📦 Livraison par coursiers\n• 🎓 Vérification programmes scolaires\n\n**Comment puis-je vous aider ?**\n• Troquer des livres ?\n• Scanner un livre ?\n• Estimer la valeur ?";
  }

  /**
   * 🎯 Actions contextuelles Livres
   */
  private getLivreActions(): ActionDescriptor[] {
    return [
      { id: 'book-exchange', label: 'Troc livres', icon: 'book-open', route: 'LivreScolaireHome', category: 'action', description: 'Echanger des livres scolaires' },
      { id: 'book-scan', label: 'Scanner livre', icon: 'scan', route: 'LivreScolaireHome', category: 'action', description: 'Analyser un livre avec IA' },
      { id: 'book-price', label: 'Estimer prix', icon: 'tag', route: 'LivreScolaireHome', category: 'action', description: 'Connaitre la valeur d un livre' },
      { id: 'book-delivery', label: 'Livraison', icon: 'truck', route: 'LivreScolaireHome', category: 'action', description: 'Livraison par coursiers' },
      { id: 'book-program', label: 'Verifier programme', icon: 'graduation-cap', route: 'LivreScolaireHome', category: 'action', description: 'Verifier programme scolaire' }
    ];
  }

  /**
   * 🎯 Réponses contextuelles MesServices
   */
  private getServicesResponse(prompt: string): string {
    const q = prompt.toLowerCase();

    if (q.includes('produit') || q.includes('ajout') || q.includes('cré')) {
      return "📦 **Gestion de Produits et Catalogue**\n\nJe vous aide à gérer votre catalogue de produits de manière intelligente.\n\n**Fonctionnalités :**\n• ➕ Ajout rapide avec suggestions IA\n• 📝 Modification en masse\n• 📊 Statistiques de ventes\n• 🏷️ Gestion des prix et promotions\n• 📸 Photos et descriptions optimisées\n\n**Comment ajouter :** Dites \"ajouter produit [nom]\" ou utilisez le formulaire IA pour des suggestions automatiques.";
    }

    if (q.includes('statistique') || q.includes('vente') || q.includes('performance')) {
      return "📊 **Statistiques et Performance**\n\nJe vous donne une vue complète de vos performances commerciales.\n\n**Métriques disponibles :**\n• 💰 Chiffre d'affaires par période\n• 📈 Tendance des ventes\n• 🏆 Produits les plus vendus\n• 👥 Profil des clients\n• 🎯 Objectifs et prévisions\n\n**Périodes :** Jour, semaine, mois, année avec comparatifs.";
    }

    if (q.includes('commande') || q.includes('livraison') || q.includes('client')) {
      return "🛒 **Gestion des Commandes et Livraisons**\n\nJe vous aide à suivre et optimiser vos ventes.\n\n**Suivi complet :**\n• 📋 Statut des commandes en temps réel\n• 🚦 Tracking des livraisons\n• 👥 Communication avec clients\n• ⭐ Gestion des avis\n• 💰 Paiements et facturation\n\n**Automatisation :** Notifications automatiques pour chaque étape de la commande.";
    }

    return "🏪 **Assistant Services Yukpo**\n\nJe suis votre gestionnaire commercial intelligent.\n\n**Services disponibles :**\n• 📦 Gestion complète du catalogue\n• 📊 Statistiques et performances\n• 🛒 Suivi des commandes\n• 🤖 IA pour optimiser vos ventes\n• 💰 Gestion des revenus\n\n**Comment puis-je vous aider ?**\n• Ajouter un produit ?\n• Voir les statistiques ?\n• Suivre une commande ?";
  }

  /**
   * 🎯 Actions contextuelles MesServices
   */
  private getServicesActions(): ActionDescriptor[] {
    return [
      { id: 'services-add', label: 'Ajouter produit', icon: 'plus', route: 'MesServices', category: 'action', description: 'Ajouter un nouveau produit' },
      { id: 'services-catalog', label: 'Voir catalogue', icon: 'briefcase', route: 'MesServices', category: 'action', description: 'Gerer tous vos produits' },
      { id: 'services-stats', label: 'Statistiques', icon: 'bar-chart-3', route: 'MesServices', category: 'action', description: 'Voir vos performances' },
      { id: 'services-orders', label: 'Commandes', icon: 'shopping-cart', route: 'MesServices', category: 'action', description: 'Suivre les commandes' },
      { id: 'services-promo', label: 'Promotions', icon: 'tag', route: 'MesServices', category: 'action', description: 'Creer des promotions' }
    ];
  }

  /**
   * 🎯 Fallback spécialisé si le backend échoue
   */
  private getSpecializedFallback(userMessage: string, targetScreen: string): ChatResponse {
    const fallbacks: Record<string, ChatResponse> = {
      'Navigation': {
        message: "🧭 Je suis votre assistant Navigation. Je peux vous aider avec les itinéraires GPS, les alertes sécurité, et le coach sportif. Dites-moi ce que vous cherchez !",
        type: 'text',
        suggestedActions: this.getNavigationActions(),
        confidence: 0.7
      },
      'PharmacieHome': {
        message: "💊 Je suis votre assistant Pharmacie. Je peux trouver des médicaments, analyser des ordonnances, et localiser les pharmacies. Comment puis-je vous aider ?",
        type: 'text',
        suggestedActions: this.getPharmacyActions(),
        confidence: 0.7
      },
      'HopitalHome': {
        message: "🏥 Je suis votre assistant Hôpital. Je peux aider avec les urgences, prendre rendez-vous, et analyser les symptômes. Que souhaitez-vous savoir ?",
        type: 'text',
        suggestedActions: this.getHospitalActions(),
        confidence: 0.7
      },
      'OffresEmploiHome': {
        message: "💼 Je suis votre coach Emploi. Je peux analyser votre CV, estimer votre salaire, et préparer les entretiens. Comment puis-je vous aider ?",
        type: 'text',
        suggestedActions: this.getEmploiActions(),
        confidence: 0.7
      },
      'LivreScolaireHome': {
        message: "📚 Je suis votre spécialiste Livres. Je peux aider avec le troc, scanner des livres, et estimer leur valeur. Que cherchez-vous ?",
        type: 'text',
        suggestedActions: this.getLivreActions(),
        confidence: 0.7
      },
      'MesServices': {
        message: "🏪 Je suis votre gestionnaire Services. Je peux aider avec les produits, les statistiques, et les commandes. Comment puis-je vous aider ?",
        type: 'text',
        suggestedActions: this.getServicesActions(),
        confidence: 0.7
      }
    };

    return fallbacks[targetScreen] || this.generateFallbackResponse(userMessage);
  }

  /**
   * 🎯 Obtenir les actions d'un module spécialisé
   */
  private getModuleActions(screenName: string): ActionDescriptor[] {
    const actions: Record<string, ActionDescriptor[]> = {
      'Navigation': this.getNavigationActions(),
      'PharmacieHome': this.getPharmacyActions(),
      'HopitalHome': this.getHospitalActions(),
      'OffresEmploiHome': this.getEmploiActions(),
      'LivreScolaireHome': this.getLivreActions(),
      'MesServices': this.getServicesActions()
    };

    return actions[screenName] || [];
  }
}

export const intelligentChatService = new IntelligentChatService();
export default intelligentChatService;
