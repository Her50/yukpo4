import i18n from '../i18n';
import { apiPost } from './api';

export interface IconReference {
  icon: string;
  label: string;
  color?: string;
}

export interface ChatbotResponse {
  message: string;
  icons?: IconReference[];
  quickReplies?: string[];
  suggestedActions?: Array<{ id: string; label: string; icon: string; route?: string; category: string }>;
  nextSteps?: string[];
}

const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

class ChatbotIntelligentService {

  /**
   * Détecter l'émotion dominante dans un message (version légère pour le fallback)
   */
  private detectEmotion(text: string): 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'correction' | 'neutral' {
    const q = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const kw: Record<string, string[]> = {
      correction: ['non', 'pas ca', 'ce nest pas', 'faux', 'erreur', 'trompe', 'wrong', 'incorrect', 'mistake', 'tu te trompes'],
      frustration: ['frustre', 'enerve', 'marre', 'ras le bol', 'ca marche pas', 'incomprehensible', 'nul', 'horrible', 'impossible'],
      gratitude: ['merci', 'bravo', 'genial', 'parfait', 'excellent', 'top', 'nickel', 'chapeau', 'thank', 'awesome', 'great'],
      confusion: ['je comprends pas', 'pas clair', 'comment faire', 'perdu', 'expliquez', 'confused', 'unclear'],
      excitement: ['wow', 'incroyable', 'trop bien', 'genial', 'amazing', 'fantastic', 'dingue', 'wahou'],
    };
    let best: 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'correction' | 'neutral' = 'neutral';
    let bestN = 0;
    for (const [emo, words] of Object.entries(kw)) {
      const n = words.filter(w => q.includes(w)).length;
      if (n > bestN) { bestN = n; best = emo as any; }
    }
    return best;
  }

  /**
   * Générer un préfixe émotionnel court pour le fallback local
   */
  private emotionalPrefix(emotion: string, lang: string): string {
    if (emotion === 'neutral') return '';
    const fr: Record<string, string[]> = {
      correction: ["Toutes mes excuses, vous avez raison. ", "Au temps pour moi. ", "Merci de me corriger. "],
      frustration: ["Je comprends votre frustration, désolé. ", "Pardon pour la confusion. Reprenons. ", "Je m'excuse, simplifions. "],
      gratitude: ["Merci beaucoup ! 😊 ", "C'est un plaisir ! ", "Ravi d'aider ! "],
      confusion: ["Pas de souci, je réexplique. ", "Laissez-moi clarifier. ", "Bonne question ! "],
      excitement: ["Super, content que ça vous plaise ! 🎉 ", "Génial n'est-ce pas ! ", "Oui c'est top ! "],
    };
    const en: Record<string, string[]> = {
      correction: ["My apologies, you're right. ", "My mistake. ", "Thanks for the correction. "],
      frustration: ["I understand your frustration, sorry. ", "Apologies for the confusion. Let's retry. ", "Sorry, let me simplify. "],
      gratitude: ["Thank you! 😊 ", "Happy to help! ", "Glad I could assist! "],
      confusion: ["No worries, let me re-explain. ", "Let me clarify. ", "Great question! "],
      excitement: ["Awesome, glad you like it! 🎉 ", "Amazing right?! ", "Yes it's great! "],
    };
    const pool = (lang === 'en' ? en : fr)[emotion] || [];
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : '';
  }

  private buildServicePrompt(service: any, lang: string, recentMessages: any[] = []): string {
    const name = this.getServiceName(service);
    const price = this.getServicePrice(service);
    const desc = this.getServiceDescription(service);
    const products = this.getProducts(service);
    const category = service?.category || service?.categorie || 'general';
    const activeLang = lang || i18n.language || 'fr';
    const turnCount = recentMessages.length;

    return `You are the AI sales assistant for "${name || 'this service'}" on Yukpo, Africa's #1 super-app.

YOUR ROLE: You help prospects understand this service, answer questions about products/prices, guide them to take action (buy, negotiate, call, order delivery). You are warm, professional, and persuasive — like the best salesperson who genuinely wants to help.

MANDATORY: Respond ONLY in language code "${activeLang}". Adapt tone and cultural expressions.

SERVICE INFO:
- Name: ${name || 'N/A'}
- Category: ${category}
- Price: ${price || 'Contact provider'}
- Description: ${desc ? desc.substring(0, 400) : 'N/A'}
- Products: ${products.length > 0 ? products.slice(0, 8).map((p: any) => `${p.nom || p.name || '?'}${p.prix ? ` (${p.prix} FCFA)` : ''}`).join(', ') : 'No catalog yet'}

CHAT FEATURES YOU CAN GUIDE USERS TO:
- 💬 Text messages, photos, files, voice messages
- 💰 Price negotiation (dedicated button)
- 📞 Audio/video calls (in-app, free)
- 🚚 Delivery ordering (truck icon)
- ⭐ Leave reviews
- 📍 Get directions to provider
- 📸 Send product gallery photos
- @ Mention participants

CONVERSATION CONTINUITY & EMOTIONAL INTELLIGENCE:
- This is message #${turnCount + 1} of the conversation. ALWAYS build on previous messages.
- If user corrects you ("non", "pas", "wrong"): START with a sincere apology, THEN give corrected answer.
- If user thanks you ("merci", "bravo", "super"): respond warmly, show appreciation, suggest next actions.
- If user is frustrated ("marre", "ça marche pas"): acknowledge feelings, apologize, simplify into steps.
- If user is confused ("je comprends pas", "comment"): empathize, re-explain with numbered steps.
- If user is excited ("wow", "génial!"): match their energy, suggest related features.
- If user says "dis m'en plus", "continue", "détaille": expand WITHOUT repeating previous content.
- NEVER answer as if the conversation just started — reference previous exchanges.
- Adapt tone: more formal when user is frustrated, more casual when user is happy.

RULES:
- Be CONCISE (2-4 sentences max), then suggest quick actions
- Always suggest 2-3 relevant quick replies
- If user asks about price, mention negotiation is possible
- If user seems interested, guide them to order/contact
- If user asks general questions about Yukpo, briefly explain then refocus on this service
- NEVER say you can't help — always guide toward an action
- Anticipate logical next questions`;
  }

  async generateChatbotResponse(
    query: string,
    service: any,
    recentMessages: any[] = [],
    lang?: string,
  ): Promise<ChatbotResponse> {
    try {
      const serviceName = this.getServiceName(service);
      const servicePrice = this.getServicePrice(service);
      const serviceDesc = this.getServiceDescription(service);
      const products = this.getProducts(service);
      const productsSummary = products.slice(0, 5).map((p: any) => `${p.nom || p.name || '?'}${p.prix ? ` (${p.prix} FCFA)` : ''}`).join(', ');
      const activeLang = lang || i18n.language || 'fr';

      // Détection émotionnelle du message utilisateur
      const emotion = this.detectEmotion(query);
      const prefix = this.emotionalPrefix(emotion, activeLang);
      const contextualMessage = prefix
        ? `[ASSISTANT_TONE_PREFIX: ${prefix.trim()}]\n${query}`
        : query;

      // Backend expose AI routes sans préfixe `/api` : POST /ai/chat
      const res = await apiPost<any>('/ai/chat', {
        message: contextualMessage,
        context: {
          category: service?.category || service?.categorie || 'general',
          service_name: serviceName,
          service_price: servicePrice,
          service_description: serviceDesc?.substring(0, 300),
          products_summary: productsSummary,
          products_count: products.length,
          recent_messages: recentMessages.slice(-8).map((m: any) => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text || m.content || '',
          })),
          mode: 'chatbot_service',
          system_prompt: this.buildServicePrompt(service, activeLang, recentMessages),
          sentiment_context: {
            emotion,
            emotional_prefix: prefix.trim() || null,
            conversation_turn_count: recentMessages.length,
          },
        },
        type: 'chatbot',
        language: activeLang,
      });

      const data = res?.data || res;
      if (data?.message) {
        let message = data.message;
        // Prépendre le préfixe émotionnel si le backend ne l'a pas intégré
        if (prefix && message && !message.startsWith(prefix.trim().substring(0, 10))) {
          message = prefix + message;
        }
        return {
          message,
          icons: data.icons || [],
          quickReplies: data.quick_replies || data.suggestions || [],
          suggestedActions: data.suggested_actions || [],
          nextSteps: data.next_steps || data.nextSteps || [],
        };
      }
      return this.localFallback(query, service, activeLang);
    } catch {
      return this.localFallback(query, service, lang || i18n.language || 'fr');
    }
  }

  private getServiceName(s: any): string {
    if (!s) return '';
    return s.nom || s.name || s.titre || s.title || '';
  }

  private getServicePrice(s: any): string {
    if (!s) return '';
    const p = s.prix || s.price || s.tarif || s.amount;
    if (!p) return '';
    return typeof p === 'number' ? `${p} FCFA` : String(p);
  }

  private getServiceDescription(s: any): string {
    if (!s) return '';
    return s.description || s.desc || s.details || '';
  }

  private getProducts(s: any): any[] {
    if (!s) return [];
    return s.products || s.produits || s.items || [];
  }

  private getProductsSummary(s: any): string {
    const products = this.getProducts(s);
    if (products.length === 0) return '';
    const lines = products.slice(0, 5).map((p: any, i: number) => {
      const name = p.nom || p.name || `#${i + 1}`;
      const price = p.prix || p.price || '';
      return `• ${name}${price ? ` — ${price} FCFA` : ''}`;
    });
    const more = products.length > 5
      ? `\n${t('chatbot.moreProducts', { count: products.length - 5 })}`
      : '';
    return lines.join('\n') + more;
  }

  private localFallback(query: string, service: any, lang?: string): ChatbotResponse {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const name = this.getServiceName(service);
    const price = this.getServicePrice(service);
    const desc = this.getServiceDescription(service);
    const productsSummary = this.getProductsSummary(service);
    const match = (kws: string[]) => kws.some(k => q.includes(k));

    // Détecter l'émotion et préparer un préfixe pour les réponses fallback
    const emotion = this.detectEmotion(query);
    const prefix = this.emotionalPrefix(emotion, lang || 'fr');
    const prefixMsg = (msg: string) => prefix ? prefix + msg : msg;

    if (match(['produit', 'product', 'article', 'item', 'catalogue', 'stock', 'producto', 'produkt', 'bidhaa', 'kayan', 'mazao', 'kayayyaki', 'oja', 'umkhiqizo', 'prodotto', 'produto', 'produk', 'товар'])) {
      if (productsSummary) {
        return {
          message: prefixMsg(t('chatbot.productsAvailable', { name, list: productsSummary })),
          icons: [
            { icon: 'package', label: t('chatbot.products') || 'Products', color: '#6366f1' },
            { icon: 'truck', label: t('chatbot.delivery') || 'Delivery', color: '#10b981' },
          ],
          quickReplies: [t('chatbot.orderProduct') || 'Order', t('chatbot.seePrices') || 'Prices', t('chatbot.availability') || 'Availability'],
          nextSteps: [t('chatbot.askDeliveryFees') || 'What are the delivery fees?', t('chatbot.askNegotiation') || 'Can I negotiate the price?'],
        };
      }
      return {
        message: prefixMsg(t('chatbot.noProductCatalog', { name })),
        icons: [{ icon: 'message-circle', label: t('chatbot.contact') || 'Contact', color: '#6366f1' }],
        quickReplies: [t('chatbot.contactProvider') || 'Contact provider'],
        nextSteps: [t('chatbot.askAboutService') || 'Tell me about this service', t('chatbot.askHowToCall') || 'How do I call the provider?'],
      };
    }

    if (match(['prix', 'price', 'tarif', 'cout', 'cost', 'combien', 'how much', 'precio', 'preis', 'bei', 'farashi', 'kudi', 'nawa', 'nkap', 'ntalu', 'arama', 'wari', 'sika', 'valor', 'prezzo', 'harga', 'цена'])) {
      const priceInfo = price
        ? t('chatbot.priceShown', { name, price })
        : t('chatbot.noPriceShown', { name });
      return {
        message: prefixMsg(`${priceInfo}\n\n${t('chatbot.canNegotiate')}`),
        icons: [
          { icon: 'tag', label: t('chatbot.negotiate') || 'Negotiate', color: '#f59e0b' },
          { icon: 'credit-card', label: t('chatbot.payment') || 'Payment', color: '#6366f1' },
        ],
        quickReplies: [t('chatbot.negotiatePrice') || 'Negotiate', t('chatbot.paymentMethods') || 'Payment methods', productsSummary ? (t('chatbot.seeProducts') || 'Products') : ''].filter(Boolean),
        nextSteps: [t('chatbot.askHowToOrder') || 'How do I order?', t('chatbot.askDeliveryTime') || 'How long for delivery?'],
      };
    }

    if (match(['negoci', 'negoti', 'rabais', 'discount', 'marchander', 'bargain', 'descuento', 'verhandeln', 'punguza'])) {
      return {
        message: prefixMsg(t('chatbot.negotiateSteps', { name })),
        icons: [{ icon: 'tag', label: t('chatbot.negotiate') || 'Negotiate', color: '#f59e0b' }],
        quickReplies: [t('chatbot.currentPrice') || 'Current price', t('chatbot.contactProvider') || 'Contact'],
      };
    }

    if (match(['appel', 'call', 'telephone', 'phone', 'llamar', 'anrufen', 'piga simu', 'kira', 'telefonar', 'chiamare', 'bellen', 'simu', 'waya', 'fonou', 'rele', 'звонить'])) {
      return {
        message: prefixMsg(t('chatbot.callSteps')),
        icons: [
          { icon: 'phone', label: t('chatbot.audioCall') || 'Audio call', color: '#10b981' },
          { icon: 'video', label: t('chatbot.videoCall') || 'Video call', color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.callNow') || 'Call now', t('chatbot.sendMessage') || 'Send message'],
      };
    }

    if (match(['livr', 'deliver', 'command', 'order', 'ship', 'suivi', 'tracking', 'pedido', 'lieferung', 'oda', 'entrega', 'consegna', 'bezorging', 'peleka', 'aika', 'jigilar', 'firansu', 'доставка'])) {
      return {
        message: prefixMsg(t('chatbot.deliverySteps')),
        icons: [
          { icon: 'truck', label: t('chatbot.delivery') || 'Delivery', color: '#10b981' },
          { icon: 'map-pin', label: t('chatbot.tracking') || 'Tracking', color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.seeProducts') || 'Products', t('chatbot.deliveryFees') || 'Delivery fees', t('chatbot.deliveryTime') || 'Delivery time'],
        suggestedActions: [
          { id: 'delivery-home', label: t('chatbot.goDelivery') || '🚚 Delivery', icon: 'truck', route: 'DeliveryHome', category: 'navigation' },
        ],
        nextSteps: [t('chatbot.askPaymentMethods') || 'What payment methods?', t('chatbot.askInsurance') || 'Is there delivery insurance?'],
      };
    }

    if (match(['video', 'vidéo', 'reel', 'tiktok', 'story', 'pub video', 'publicite video', 'publicité vidéo'])) {
      return {
        message: prefixMsg(t('chatbot.productVideoSteps', { name: name || 'this product' })),
        icons: [
          { icon: 'video', label: t('chatbot.videoCreation') || 'Video', color: '#3b82f6' },
          { icon: 'sparkles', label: t('chatbot.aiAssistant') || 'AI', color: '#6366f1' },
        ],
        quickReplies: [
          t('chatbot.videoForThisProduct') || 'Create video',
          t('chatbot.howToShareVideo') || 'Share video',
          t('chatbot.videoCost') || 'Video cost',
        ],
      };
    }

    if (match(['paiement', 'payment', 'payer', 'pay', 'momo', 'orange money', 'carte', 'credit card', 'pago', 'zahlung', 'malipo', 'biya', 'sisan', 'sara', 'kufuta', 'pagamento', 'betaling', 'bayar', 'оплата'])) {
      return {
        message: prefixMsg(t('chatbot.paymentInfo')),
        icons: [
          { icon: 'credit-card', label: t('chatbot.card') || 'Card', color: '#6366f1' },
          { icon: 'smartphone', label: 'Mobile Money', color: '#f59e0b' },
        ],
        quickReplies: [t('chatbot.howToPay') || 'How to pay', t('chatbot.securePayment') || 'Secure payment'],
      };
    }

    if (match(['localis', 'locat', 'itineraire', 'direction', 'adresse', 'address', 'where is', 'gps', 'carte', 'map', 'donde', 'mahali', 'ina wapi', 'ramani', 'taswirar', 'mapa', 'kaart', 'peta', 'карта'])) {
      return {
        message: prefixMsg(t('chatbot.locationSteps')),
        icons: [
          { icon: 'map-pin', label: t('chatbot.locate') || 'Locate', color: '#ef4444' },
          { icon: 'navigation', label: t('chatbot.directions') || 'Directions', color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.viewOnMap') || 'View on map', t('chatbot.distance') || 'Distance'],
      };
    }

    if (match(['bonjour', 'hello', 'hi ', 'salut', 'bonsoir', 'hey', 'hola', 'hallo', 'jambo', 'habari', 'sannu', 'bawo', 'sawubona', 'ola', 'ciao', 'hoi', 'mbote', 'nnoo', 'barka', 'salaam', 'salam', 'привет', 'merhaba', 'namaste'])) {
      return {
        message: t('intelligentChat.welcomeChat', { name: name || 'Yukpo' }),
        icons: [],
        quickReplies: [t('chatbot.describeService') || 'About this service', t('chatbot.negotiatePrice') || 'Negotiate', t('chatbot.chatFeatures') || 'Chat features', t('chatbot.seeProducts') || 'Products'],
      };
    }

    // === "What is Yukpo" / discovery in service chatbot ===
    if (match(['yukpo', 'application', 'app', 'fonctionnalit', 'feature', 'quoi faire', 'what can'])) {
      return {
        message: t('chatbot.yukpoInChat') ||
          '🚀 Yukpo is the all-in-one digital revolution! Besides chatting with this provider, you can:\n\n'
          + '• Negotiate prices directly\n'
          + '• Order with home delivery\n'
          + '• Make audio/video calls\n'
          + '• Leave reviews\n'
          + '• Share the service\n\n'
          + 'Yukpo also offers: health, transport, jobs, education, GPS navigation & more!',
        icons: [
          { icon: 'sparkles', label: 'Yukpo', color: '#6366f1' },
          { icon: 'zap', label: t('chatbot.chatFeatures') || 'Features', color: '#f59e0b' },
        ],
        quickReplies: [t('chatbot.chatFeatures') || 'Chat features', t('chatbot.describeService') || 'About service', t('chatbot.seeProducts') || 'Products'],
      };
    }

    const serviceName = name || 'Yukpo';
    const parts: string[] = [];
    if (desc) parts.push(desc.substring(0, 200));
    if (price) parts.push(`${t('chatbot.price', { price }) || price}`);
    if (productsSummary) parts.push(`${t('chatbot.products') || 'Products'} :\n${productsSummary}`);
    parts.push(t('chatbot.howCanIHelp') || 'How can I help?');

    return {
      message: prefixMsg(parts.length > 1
        ? `${t('chatbot.defaultAssistant', { name: serviceName })}\n${parts.join('\n')}`
        : t('chatbot.defaultAssistant', { name: serviceName })),
      icons: name ? [
        { icon: 'info', label: t('chatbot.details') || 'Details', color: '#6366f1' },
        { icon: 'message-circle', label: t('chatbot.contact') || 'Contact', color: '#10b981' },
      ] : [],
      quickReplies: [t('chatbot.describeService') || 'About service', t('chatbot.negotiatePrice') || 'Negotiate', t('chatbot.seeProducts') || 'Products', t('chatbot.chatFeatures') || 'Features'],
      nextSteps: [
        t('chatbot.askAboutProducts') || 'What products are available?',
        t('chatbot.askAboutPrice') || 'What is the price?',
        t('chatbot.askHowToOrder') || 'How do I order?',
        t('chatbot.askAboutDelivery') || 'Do you deliver?',
      ],
    };
  }

  private matchAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }
}

export const chatbotIntelligentService = new ChatbotIntelligentService();
export default chatbotIntelligentService;
