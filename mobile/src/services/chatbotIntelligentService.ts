// @ts-nocheck
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
        },
        type: 'chatbot',
        language: lang || i18n.language || 'fr',
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
            { icon: 'package', label: t('chatbot.products'), color: '#6366f1' },
            { icon: 'truck', label: t('chatbot.delivery'), color: '#10b981' },
          ],
          quickReplies: [t('chatbot.orderProduct'), t('chatbot.seePrices'), t('chatbot.availability')],
        };
      }
      return {
        message: t('chatbot.noProductCatalog', { name }),
        icons: [{ icon: 'message-circle', label: t('chatbot.contact'), color: '#6366f1' }],
        quickReplies: [t('chatbot.contactProvider')],
      };
    }

    if (match(['prix', 'price', 'tarif', 'cout', 'cost', 'combien', 'how much', 'precio', 'preis', 'bei', 'farashi', 'kudi'])) {
      const priceInfo = price
        ? t('chatbot.priceShown', { name, price })
        : t('chatbot.noPriceShown', { name });
      return {
        message: `${priceInfo}\n\n${t('chatbot.canNegotiate')}`,
        icons: [
          { icon: 'tag', label: t('chatbot.negotiate'), color: '#f59e0b' },
          { icon: 'credit-card', label: t('chatbot.payment'), color: '#6366f1' },
        ],
        quickReplies: [t('chatbot.negotiatePrice'), t('chatbot.paymentMethods'), productsSummary ? t('chatbot.seeProducts') : ''].filter(Boolean),
      };
    }

    if (match(['negoci', 'negoti', 'rabais', 'discount', 'marchander', 'bargain', 'descuento', 'verhandeln', 'punguza'])) {
      return {
        message: t('chatbot.negotiateSteps', { name }),
        icons: [{ icon: 'tag', label: t('chatbot.negotiate'), color: '#f59e0b' }],
        quickReplies: [t('chatbot.currentPrice'), t('chatbot.contactProvider')],
      };
    }

    if (match(['appel', 'call', 'telephone', 'phone', 'llamar', 'anrufen', 'piga simu', 'kira'])) {
      return {
        message: t('chatbot.callSteps'),
        icons: [
          { icon: 'phone', label: t('chatbot.audioCall'), color: '#10b981' },
          { icon: 'video', label: t('chatbot.videoCall'), color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.callNow'), t('chatbot.sendMessage')],
      };
    }

    if (match(['livr', 'deliver', 'command', 'order', 'ship', 'suivi', 'tracking', 'pedido', 'lieferung', 'oda'])) {
      return {
        message: t('chatbot.deliverySteps'),
        icons: [
          { icon: 'truck', label: t('chatbot.delivery'), color: '#10b981' },
          { icon: 'map-pin', label: t('chatbot.tracking'), color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.seeProducts'), t('chatbot.deliveryFees'), t('chatbot.deliveryTime')],
      };
    }

    if (match(['video', 'vidéo', 'reel', 'tiktok', 'story', 'pub video', 'publicite video', 'publicité vidéo'])) {
      return {
        message: t('chatbot.productVideoSteps', { name: name || 'ce produit' }),
        icons: [
          { icon: 'video', label: t('chatbot.videoCreation'), color: '#3b82f6' },
          { icon: 'sparkles', label: t('chatbot.aiAssistant'), color: '#6366f1' },
        ],
        quickReplies: [
          t('chatbot.videoForThisProduct'),
          t('chatbot.howToShareVideo'),
          t('chatbot.videoCost'),
        ],
      };
    }

    if (match(['paiement', 'payment', 'payer', 'pay', 'momo', 'orange money', 'carte', 'credit card', 'pago', 'zahlung', 'malipo'])) {
      return {
        message: t('chatbot.paymentInfo'),
        icons: [
          { icon: 'credit-card', label: t('chatbot.card'), color: '#6366f1' },
          { icon: 'smartphone', label: 'Mobile Money', color: '#f59e0b' },
        ],
        quickReplies: [t('chatbot.howToPay'), t('chatbot.securePayment')],
      };
    }

    if (match(['localis', 'locat', 'itineraire', 'direction', 'adresse', 'address', 'where is', 'gps', 'carte', 'map', 'donde', 'mahali', 'ina wapi'])) {
      return {
        message: t('chatbot.locationSteps'),
        icons: [
          { icon: 'map-pin', label: t('chatbot.locate'), color: '#ef4444' },
          { icon: 'navigation', label: t('chatbot.directions'), color: '#3b82f6' },
        ],
        quickReplies: [t('chatbot.viewOnMap'), t('chatbot.distance')],
      };
    }

    if (match(['bonjour', 'hello', 'hi ', 'salut', 'bonsoir', 'hey', 'hola', 'hallo', 'jambo', 'habari', 'sannu', 'bawo', 'sawubona'])) {
      return {
        message: t('intelligentChat.welcomeChat', { name: name || 'Yukpo' }),
        icons: [],
        quickReplies: [t('chatbot.describeService'), t('chatbot.negotiatePrice'), t('chatbot.chatFeatures'), t('chatbot.seeProducts')],
      };
    }

    // Contextual default: build response from available service data
    const serviceName = name || 'Yukpo';
    const parts: string[] = [];
    if (desc) parts.push(desc.substring(0, 200));
    if (price) parts.push(t('chatbot.price', { price }));
    if (productsSummary) parts.push(`${t('chatbot.products')} :\n${productsSummary}`);
    parts.push(t('chatbot.howCanIHelp'));

    return {
      message: parts.length > 1
        ? `${t('chatbot.defaultAssistant', { name: serviceName })}\n${parts.join('\n')}`
        : t('chatbot.defaultAssistant', { name: serviceName }),
      icons: name ? [
        { icon: 'info', label: t('chatbot.details'), color: '#6366f1' },
        { icon: 'message-circle', label: t('chatbot.contact'), color: '#10b981' },
      ] : [],
      quickReplies: [t('chatbot.describeService'), t('chatbot.negotiatePrice'), t('chatbot.seeProducts'), t('chatbot.chatFeatures')],
    };
  }

  private matchAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }
}

export const chatbotIntelligentService = new ChatbotIntelligentService();
export default chatbotIntelligentService;
