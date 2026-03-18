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
}

const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

class ChatbotIntelligentService {

  private buildServicePrompt(service: any, lang: string): string {
    const name = this.getServiceName(service);
    const price = this.getServicePrice(service);
    const desc = this.getServiceDescription(service);
    const products = this.getProducts(service);
    const category = service?.category || service?.categorie || 'general';
    const activeLang = lang || i18n.language || 'fr';

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

      const res = await apiPost<any>('/api/ai/chat', {
        message: query,
        context: {
          category: service?.category || service?.categorie || 'general',
          service_name: serviceName,
          service_price: servicePrice,
          service_description: serviceDesc?.substring(0, 300),
          products_summary: productsSummary,
          products_count: products.length,
          recent_messages: recentMessages.slice(-5).map((m: any) => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text || m.content || '',
          })),
          mode: 'chatbot_service',
          system_prompt: this.buildServicePrompt(service, activeLang),
        },
        type: 'chatbot',
        language: activeLang,
      });

      const data = res?.data || res;
      if (data?.message) {
        return {
          message: data.message,
          icons: data.icons || [],
          quickReplies: data.quick_replies || data.suggestions || [],
        };
      }
      return this.localFallback(query, service);
    } catch {
      return this.localFallback(query, service);
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

  private localFallback(query: string, service: any): ChatbotResponse {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const name = this.getServiceName(service);
    const price = this.getServicePrice(service);
    const desc = this.getServiceDescription(service);
    const productsSummary = this.getProductsSummary(service);
    const match = (kws: string[]) => kws.some(k => q.includes(k));

    if (match(['produit', 'product', 'article', 'item', 'catalogue', 'stock', 'producto', 'produkt', 'bidhaa', 'kayan'])) {
      if (productsSummary) {
        return {
          message: t('chatbot.productsAvailable', { name, list: productsSummary }),
          icons: [
            { icon: 'package', label: t('chatbot.products') || 'Products', color: '#6366f1' },
            { icon: 'truck', label: t('chatbot.delivery') || 'Delivery', color: '#10b981' },
          ],
          quickReplies: [t('chatbot.orderProduct') || 'Order', t('chatbot.seePrices') || 'Prices', t('chatbot.availability') || 'Availability'],
        };
      }
      return {
        message: t('chatbot.noProductCatalog', { name }),
        icons: [{ icon: 'message-circle', label: t('chatbot.contact') || 'Contact', color: '#6366f1' }],
        quickReplies: [t('chatbot.contactProvider') || 'Contact provider'],
      };
    }

    if (match(['prix', 'price', 'tarif', 'cout', 'cost', 'combien', 'how much', 'precio', 'preis', 'bei', 'farashi', 'kudi'])) {
      const priceInfo = price
        ? t('chatbot.priceShown', { name, price })
        : t('chatbot.noPriceShown', { name });
      return {
        message: `${priceInfo}\n\n${t('chatbot.canNegotiate')}`,
        icons: [
          { icon: 'tag', label: t('chatbot.negotiate') || 'Negotiate', color: '#f59e0b' },
          { icon: 'credit-card', label: t('chatbot.payment') || 'Payment', color: '#6366f1' },
        ],
        quickReplies: [t('chatbot.negotiatePrice') || 'Negotiate', t('chatbot.paymentMethods') || 'Payment methods', productsSummary ? (t('chatbot.seeProducts') || 'Products') : ''].filter(Boolean),
      };
    }

    if (match(['negoci', 'negoti', 'rabais', 'discount', 'marchander', 'bargain', 'descuento', 'verhandeln', 'punguza'])) {
      return {
        message: t('chatbot.negotiateSteps', { name }),
        icons: [{ icon: 'tag', label: t('chatbot.negotiate') || 'Negotiate', color: '#f59e0b' }],
        quickReplies: [t('chatbot.currentPrice') || 'Current price', t('chatbot.contactProvider') || 'Contact'],
      };
    }

    if (match(['appel', 'call', 'telephone', 'phone', 'llamar', 'anrufen', 'piga simu', 'kira'])) {
      return {
        message: t('chatbot.callSteps'),
        icons: [
          { icon: 'phone', label: t('chatbot.audioCall') || 'Audio call', color: '#10b981' },
          { icon: 'video', label: t('chatbot.videoCall') || 'Video call', color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.callNow') || 'Call now', t('chatbot.sendMessage') || 'Send message'],
      };
    }

    if (match(['livr', 'deliver', 'command', 'order', 'ship', 'suivi', 'tracking', 'pedido', 'lieferung', 'oda'])) {
      return {
        message: t('chatbot.deliverySteps'),
        icons: [
          { icon: 'truck', label: t('chatbot.delivery') || 'Delivery', color: '#10b981' },
          { icon: 'map-pin', label: t('chatbot.tracking') || 'Tracking', color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.seeProducts') || 'Products', t('chatbot.deliveryFees') || 'Delivery fees', t('chatbot.deliveryTime') || 'Delivery time'],
      };
    }

    if (match(['video', 'vidéo', 'reel', 'tiktok', 'story', 'pub video', 'publicite video', 'publicité vidéo'])) {
      return {
        message: t('chatbot.productVideoSteps', { name: name || 'this product' }),
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

    if (match(['paiement', 'payment', 'payer', 'pay', 'momo', 'orange money', 'carte', 'credit card', 'pago', 'zahlung', 'malipo'])) {
      return {
        message: t('chatbot.paymentInfo'),
        icons: [
          { icon: 'credit-card', label: t('chatbot.card') || 'Card', color: '#6366f1' },
          { icon: 'smartphone', label: 'Mobile Money', color: '#f59e0b' },
        ],
        quickReplies: [t('chatbot.howToPay') || 'How to pay', t('chatbot.securePayment') || 'Secure payment'],
      };
    }

    if (match(['localis', 'locat', 'itineraire', 'direction', 'adresse', 'address', 'where is', 'gps', 'carte', 'map', 'donde', 'mahali', 'ina wapi'])) {
      return {
        message: t('chatbot.locationSteps'),
        icons: [
          { icon: 'map-pin', label: t('chatbot.locate') || 'Locate', color: '#ef4444' },
          { icon: 'navigation', label: t('chatbot.directions') || 'Directions', color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.viewOnMap') || 'View on map', t('chatbot.distance') || 'Distance'],
      };
    }

    if (match(['bonjour', 'hello', 'hi ', 'salut', 'bonsoir', 'hey', 'hola', 'hallo', 'jambo', 'habari', 'sannu', 'bawo', 'sawubona'])) {
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
      message: parts.length > 1
        ? `${t('chatbot.defaultAssistant', { name: serviceName })}\n${parts.join('\n')}`
        : t('chatbot.defaultAssistant', { name: serviceName }),
      icons: name ? [
        { icon: 'info', label: t('chatbot.details') || 'Details', color: '#6366f1' },
        { icon: 'message-circle', label: t('chatbot.contact') || 'Contact', color: '#10b981' },
      ] : [],
      quickReplies: [t('chatbot.describeService') || 'About service', t('chatbot.negotiatePrice') || 'Negotiate', t('chatbot.seeProducts') || 'Products', t('chatbot.chatFeatures') || 'Features'],
    };
  }

  private matchAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }
}

export const chatbotIntelligentService = new ChatbotIntelligentService();
export default chatbotIntelligentService;
