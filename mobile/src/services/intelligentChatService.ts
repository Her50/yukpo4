// @ts-nocheck
import i18n from '../i18n';
import { ActionDescriptor, ScreenContext } from '../hooks/useScreenContext';
import { apiPost } from './api';

const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type: 'text' | 'action_suggestion' | 'navigation_help' | 'visual_guide';
  suggestedActions?: ActionDescriptor[];
  visualElements?: VisualElement[];
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
      // Construire le contexte pour l'IA
      const contextPrompt = this.buildContextPrompt(screenContext, conversationHistory, lang);

      const requestType = this.detectRequestType(userMessage, screenContext);
      const response = await apiPost<any>('/api/ai/chat', {
        message: userMessage,
        context: {
          screen: screenContext.screenName,
          screen_type: screenContext.screenType,
          available_actions: screenContext.availableActions.map(a => a.label).slice(0, 10),
          visible_elements: screenContext.visibleElements.map(e => e.label).slice(0, 8),
          user_role: screenContext.userData?.role || 'guest',
          service_data: screenContext.serviceData || null,
          context_prompt: contextPrompt,
          conversation_history: conversationHistory.slice(-5).map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text,
          })),
        },
        type: requestType,
        language: lang || i18n.language || 'fr',
      });

      const data = response?.data || response;
      if (data?.message) {
        return this.parseAIResponse(data, screenContext);
      }

      return this.generateLocalFallback(userMessage, screenContext, lang);
    } catch (error) {
      console.error('[IntelligentChat] Erreur génération réponse:', error);
      return this.generateLocalFallback(userMessage, screenContext, lang);
    }
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
  private buildContextPrompt(screenContext: ScreenContext, history: ChatMessage[], lang?: string): string {
    const { screenName, screenType, availableActions, visibleElements, userData, serviceData, guideText } = screenContext;

    const activeLang = lang || i18n.language || 'fr';
    const langInstr = `Respond in the user's language (${activeLang}).`;
    const userRole = userData?.role || 'guest';
    const userName = userData?.name || userData?.email?.split('@')[0] || '';

    let prompt = `${langInstr}
You are Yukpo Assistant — the built-in intelligent guide of the Yukpo mobile app.
Your role is to help users discover features, navigate the app, and accomplish their goals step-by-step.
You act like a knowledgeable friend who knows every feature of the app.

CURRENT SCREEN: "${screenName}" (type: ${screenType})
USER: ${userRole}${userName ? ` (${userName})` : ''}

SCREEN GUIDE: ${guideText || 'Écran de gestion.'}

VISIBLE ELEMENTS ON SCREEN:
${visibleElements.map(el => `- [${el.type}] "${el.label}" ${el.icon ? `(icon: ${el.icon})` : ''} ${el.actionable ? '✅ actionable' : ''}`).join('\n')}

AVAILABLE ACTIONS (the user can do these right now):
${availableActions.map(action => `- "${action.label}" → ${action.description || action.route || 'action'} (icon: ${action.icon})`).join('\n')}
`;

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

    prompt += `\n\nIMPORTANT RULES:
- ${langInstr} The user's language code is "${activeLang}".
- You are a USAGE GUIDE: explain HOW to use features, WHERE to find things, WHAT each button does
- When mentioning a button/element, use its EXACT label
- Propose 2-3 concrete actions the user can do RIGHT NOW on this screen
- Be warm, concise and practical — max 3-4 sentences then actions
- If the user seems lost, proactively explain the screen's purpose
- If you suggest navigation, mention the exact screen/route name
- If product/service data is available, reference it accurately
- NEVER say "I cannot see your screen" — you DO know what's on screen via the context above
- For partner/prestataire users, focus on business management features
- For regular users, focus on discovery and service consumption`;

    return prompt;
  }

  /**
   * Parser la réponse de l'IA
   */
  private parseAIResponse(aiData: any, screenContext: ScreenContext): ChatResponse {
    const response: ChatResponse = {
      message: aiData.message || 'Je ne comprends pas votre demande.',
      type: aiData.type || 'text',
      confidence: aiData.confidence || 0.8,
    };

    // Extraire les actions suggérées
    if (aiData.suggested_actions && Array.isArray(aiData.suggested_actions)) {
      response.suggestedActions = aiData.suggested_actions
        .map((action: any) => this.mapActionFromAI(action, screenContext))
        .filter(Boolean);
    }

    // Extraire les éléments visuels
    if (aiData.visual_elements && Array.isArray(aiData.visual_elements)) {
      response.visualElements = aiData.visual_elements
        .map((element: any) => this.mapVisualElementFromAI(element, screenContext))
        .filter(Boolean);
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
      return {
        id: matchedElement.id,
        type: matchedElement.type,
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

    // === CROSS-SCREEN: Product/service data queries ===
    if (matchGroup('product')) {
      if (products.length > 0) {
        const list = products.slice(0, 5).map((p: any) => {
          const n = p.nom || p.name || '?';
          const pr = p.prix || p.price || '';
          return `• ${n}${pr ? ` — ${pr} FCFA` : ''}`;
        }).join('\n');
        return {
          message: `Voici les produits disponibles :\n${list}`,
          type: 'visual_guide',
          suggestedActions: availableActions.filter(a => a.id === 'contact-provider' || a.id === 'negotiate').slice(0, 2),
        };
      }
      return { message: 'Aucun catalogue de produits disponible sur cet écran. Essayez la recherche pour trouver des produits.', type: 'text', suggestedActions: [{ id: 'search', label: 'Rechercher', icon: 'search', route: 'RechercheBesoin', category: 'search', description: '' }] };
    }

    if (matchGroup('price')) {
      const priceMsg = sPrice
        ? `Le prix de « ${sName} » est de ${sPrice} FCFA.`
        : sName ? `Le prix de « ${sName} » n'est pas affiché. Contactez le prestataire pour plus d'informations.` : 'Sélectionnez un service pour voir son prix.';
      return {
        message: `${priceMsg}\n\nVous pouvez négocier les prix directement avec les prestataires sur Yukpo !`,
        type: 'action_suggestion',
        suggestedActions: availableActions.filter(a => a.id === 'negotiate' || a.id === 'contact-provider').slice(0, 2),
      };
    }

    if (matchGroup('description')) {
      if (sName || sDesc) {
        const parts: string[] = [];
        if (sName) parts.push(`**${sName}**`);
        if (sDesc) parts.push(sDesc.substring(0, 300));
        if (sPrice) parts.push(`Prix : ${sPrice} FCFA`);
        if (products.length > 0) parts.push(`${products.length} produit(s) disponible(s)`);
        return { message: parts.join('\n\n'), type: 'text', suggestedActions: topActions(3) };
      }
      return { message: guideText || `Vous êtes sur l'écran « ${screenName} ». ${this.getScreenDescription(screenName)}`, type: 'text', suggestedActions: topActions(4) };
    }

    // === CROSS-SCREEN: Universal keywords ===
    if (matchGroup('yukpo')) {
      return {
        message: 'Yukpo est votre plateforme tout-en-un :\n\n'
          + '🏥 Santé : Pharmacies, hôpitaux, laboratoires\n'
          + '🏨 Hébergement : Hôtels, meublés, immobilier\n'
          + '🚕 Transport : Taxi, covoiturage, bus\n'
          + '📦 Livraison : Colis et courses\n'
          + '💼 Emploi : Offres, CV IA, prédiction salaire\n'
          + '🎓 Orientation scolaire : Établissements, IA\n'
          + '📚 Livres scolaires : Achat, vente, échange\n'
          + '🎬 Vidéo : Création, promotion, lives\n'
          + '🛒 Commerce : Produits, promotions, troc\n\n'
          + 'Que souhaitez-vous explorer ?',
        type: 'text',
        suggestedActions: [
          { id: 'pharmacy', label: 'Pharmacie', icon: 'pill', route: 'PharmacieHome', category: 'navigation', description: '' },
          { id: 'delivery', label: 'Livraison', icon: 'truck', route: 'DeliveryHome', category: 'navigation', description: '' },
          { id: 'emploi', label: 'Emploi', icon: 'briefcase', route: 'OffresEmploiHome', category: 'navigation', description: '' },
          { id: 'search', label: 'Rechercher', icon: 'search', route: 'RechercheBesoin', category: 'search', description: '' },
        ],
      };
    }

    if (match(['bonjour', 'salut', 'hello', 'hi ', 'hey', 'bonsoir', 'good'])) {
      return {
        message: `Bonjour ! Vous êtes sur « ${screenName} ». ${guideText || 'Comment puis-je vous aider ?'}\n\nVoici ce que vous pouvez faire ici :`,
        type: 'text',
        suggestedActions: topActions(4),
      };
    }

    // === CROSS-SCREEN: Navigation requests ===
    if (matchGroup('navigate')) {
      const navTarget = this.detectNavigationTarget(q);
      if (navTarget) {
        return {
          message: `Pour accéder à « ${navTarget.label} », appuyez sur le bouton ci-dessous :`,
          type: 'navigation_help',
          suggestedActions: [navTarget],
        };
      }
      return {
        message: 'Voici les destinations disponibles depuis cet écran :',
        type: 'navigation_help',
        suggestedActions: actionsByCategory('navigation').slice(0, 5),
      };
    }

    // === CROSS-SCREEN: Help / How-to ===
    if (matchGroup('help')) {
      return {
        message: `${guideText || `Vous êtes sur « ${screenName} ».`}\n\nVoici les actions disponibles :`,
        type: 'text',
        suggestedActions: topActions(5),
        nextSteps: [
          'Appuyez sur une action ci-dessus pour l\'exécuter',
          'Posez une question plus précise pour un guide étape par étape',
          'Demandez « où est... » pour naviguer vers un écran',
        ],
      };
    }

    // === CROSS-SCREEN: Creation requests ===
    if (matchGroup('create')) {
      const creationActions = actionsByCategory('creation');
      if (creationActions.length > 0) {
        return {
          message: 'Voici ce que vous pouvez créer depuis cet écran :',
          type: 'action_suggestion',
          suggestedActions: creationActions.slice(0, 3),
        };
      }
      return {
        message: 'La création n\'est pas disponible sur cet écran. Retournez à l\'accueil pour créer un service ou un produit.',
        type: 'navigation_help',
        suggestedActions: [
          { id: 'go-home', label: 'Accueil', icon: 'home', route: 'Home', category: 'navigation', description: '' },
          { id: 'create-service', label: 'Créer Service', icon: 'plus', route: 'ServicesDashboard', category: 'creation', description: '' },
        ],
      };
    }

    // === CROSS-SCREEN: Search requests ===
    if (matchGroup('search')) {
      const searchActions = actionsByCategory('search');
      if (searchActions.length > 0) {
        return { message: 'Utilisez la recherche disponible :', type: 'action_suggestion', suggestedActions: searchActions.slice(0, 3) };
      }
      return {
        message: 'Pour effectuer une recherche, utilisez la recherche globale :',
        type: 'action_suggestion',
        suggestedActions: [{ id: 'search', label: 'Recherche Globale', icon: 'search', route: 'RechercheBesoin', category: 'search', description: '' }],
      };
    }

    // Service-specific questions are handled dynamically by the AI via the API.
    // The fallback below only handles navigation intent using the NAV_MAP.
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
      const searchAction = { id: 'search', label: 'Rechercher', icon: 'search', route: 'RechercheBesoin', category: 'search' as const, description: '' };
      return {
        message: guideText || 'Yukpo vous permet de négocier les prix directement avec les prestataires.',
        type: 'action_suggestion',
        suggestedActions: [negotiateAction, searchAction].filter(Boolean).slice(0, 2) as any[],
      };
    }

    // === INTELLIGENT CONTEXTUAL FALLBACK ===
    // Instead of more keyword branches, use the screen context to generate a relevant response
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
        message: `${guideText || `Détails de ${sName}.`}\n\n${parts.join(' — ')}`,
        type: 'text',
        suggestedActions: [contactAction, negotiateAction, ...topActions].filter(Boolean).slice(0, 4) as any[],
      };
    }

    if (screenType === 'dashboard') {
      return {
        message: guideText || `Tableau de bord « ${screenName} ». Gérez vos services, consultez vos statistiques et traitez les demandes.`,
        type: 'text',
        suggestedActions: topActions,
      };
    }

    if (screenType === 'form') {
      return {
        message: guideText || `Formulaire « ${screenName} ». Remplissez les champs requis et validez.`,
        type: 'text',
        suggestedActions: topActions,
      };
    }

    if (screenType === 'search' || screenType === 'list') {
      const searchActions = availableActions.filter(a => a.category === 'search').slice(0, 2);
      return {
        message: guideText || `Recherche et résultats sur « ${screenName} ». Filtrez et explorez.`,
        type: 'text',
        suggestedActions: [...searchActions, ...topActions].slice(0, 4),
      };
    }

    return {
      message: guideText
        ? `${guideText}`
        : `Vous êtes sur « ${screenName} ». Je peux vous guider sur toutes les fonctionnalités disponibles ici.`,
      type: 'text',
      suggestedActions: topActions,
    };
  }

  private detectNavigationTarget(query: string): ActionDescriptor | null {
    const NAV_MAP: Record<string, ActionDescriptor> = {
      'accueil': { id: 'home', label: 'Accueil', icon: 'home', route: 'Home', category: 'navigation', description: '' },
      'pharmacie': { id: 'pharmacy', label: 'Pharmacie', icon: 'pill', route: 'PharmacieHome', category: 'navigation', description: '' },
      'hopital': { id: 'hospital', label: 'Hôpital', icon: 'building', route: 'HopitalHome', category: 'navigation', description: '' },
      'hotel': { id: 'hotel', label: 'Hôtel', icon: 'building', route: 'HotelMeubleHome', category: 'navigation', description: '' },
      'taxi': { id: 'taxi', label: 'Taxi', icon: 'car', route: 'TaxiHome', category: 'navigation', description: '' },
      'covoiturage': { id: 'covoit', label: 'Covoiturage', icon: 'users', route: 'CovoiturageHome', category: 'navigation', description: '' },
      'livraison': { id: 'delivery', label: 'Livraison', icon: 'truck', route: 'DeliveryHome', category: 'navigation', description: '' },
      'emploi': { id: 'emploi', label: 'Emploi', icon: 'briefcase', route: 'OffresEmploiHome', category: 'navigation', description: '' },
      'orientation': { id: 'orientation', label: 'Orientation', icon: 'graduation-cap', route: 'OrientationScolaireHome', category: 'navigation', description: '' },
      'livre': { id: 'livres', label: 'Livres', icon: 'book-open', route: 'LivreScolaireHome', category: 'navigation', description: '' },
      'profil': { id: 'profile', label: 'Profil', icon: 'user', route: 'Profile', category: 'navigation', description: '' },
      'parametre': { id: 'settings', label: 'Paramètres', icon: 'settings', route: 'EnhancedSettings', category: 'navigation', description: '' },
      'immobilier': { id: 'immo', label: 'Immobilier', icon: 'building-2', route: 'ImmobilierHome', category: 'navigation', description: '' },
      'assurance': { id: 'assurance', label: 'Assurance', icon: 'shield', route: 'AssuranceDashboard', category: 'navigation', description: '' },
      'laboratoire': { id: 'lab', label: 'Laboratoire', icon: 'activity', route: 'LaboratoireHome', category: 'navigation', description: '' },
      'sang': { id: 'blood', label: 'Don de sang', icon: 'droplet', route: 'BloodDonation', category: 'navigation', description: '' },
      'bus': { id: 'bus', label: 'Bus', icon: 'bus', route: 'TicketVoyageHome', category: 'navigation', description: '' },
      'supermarche': { id: 'supermarket', label: 'Supermarché', icon: 'shopping-cart', route: 'SupermarketHome', category: 'navigation', description: '' },
      'menu': { id: 'menu', label: 'Menu', icon: 'calendar', route: 'MenuPlanningHub', category: 'navigation', description: '' },
      'video': { id: 'video', label: 'Vidéo', icon: 'video', route: 'VideoCreationIntro', category: 'navigation', description: '' },
      'navigation': { id: 'nav', label: 'Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' },
      'gps': { id: 'nav', label: 'Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' },
      'bourse': { id: 'bourse', label: 'Bourse du Livre', icon: 'book-open', route: 'BourseLivre', category: 'navigation', description: '' },
      'radar': { id: 'nav', label: 'Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' },
      'colis': { id: 'parcel', label: 'Envoyer Colis', icon: 'package', route: 'DeliveryParcelFlowNew', category: 'navigation', description: '' },
      'courses': { id: 'shopping', label: 'Courses', icon: 'shopping-cart', route: 'DeliveryShoppingFlowNew', category: 'navigation', description: '' },
      'coursier': { id: 'courier', label: 'Dashboard Coursier', icon: 'truck', route: 'CourierDashboard', category: 'navigation', description: '' },
      'flotte': { id: 'fleet', label: 'Gestion Flotte', icon: 'users', route: 'FleetDashboard', category: 'navigation', description: '' },
      'restaurant': { id: 'restaurant', label: 'Restaurant', icon: 'utensils', route: 'RestaurantDashboard', category: 'navigation', description: '' },
      'automobile': { id: 'auto', label: 'Automobile', icon: 'car', route: 'AutoServicesSearch', category: 'navigation', description: '' },
      'recette': { id: 'recipe', label: 'Recettes', icon: 'book-open', route: 'RecipeSearch', category: 'navigation', description: '' },
      'troc': { id: 'troc', label: 'Troc', icon: 'refresh-cw', route: 'TrocMatching', category: 'navigation', description: '' },
      'bayam': { id: 'bayam', label: 'BayamSelam', icon: 'tag', route: 'BayamSelamSearch', category: 'navigation', description: '' },
      'mes services': { id: 'services', label: 'Mes Services', icon: 'grid', route: 'GestionServicesSpecialises', category: 'navigation', description: '' },
      'favoris': { id: 'favs', label: 'Favoris', icon: 'heart', route: 'MyFavorites', category: 'navigation', description: '' },
    };

    for (const [keyword, action] of Object.entries(NAV_MAP)) {
      if (query.includes(keyword)) return action;
    }
    return null;
  }

  private getScreenDescription(screenName: string): string {
    const descriptions: Record<string, string> = {
      'Home': 'C\'est votre page d\'accueil. Accédez à tous les services Yukpo d\'ici.',
      'RechercheBesoin': 'Recherchez des services et produits. Filtrez et négociez les prix.',
      'ResultatBesoin': 'Voici vos résultats de recherche. Contactez les prestataires ou négociez.',
      'ServiceDetail': 'Détails d\'un service. Contactez, appelez, ou obtenez l\'itinéraire.',
      'Profile': 'Votre profil. Modifiez vos infos, paramètres et portefeuille.',
      'PharmacieHome': 'Trouvez des pharmacies et médicaments proches de vous.',
      'HopitalHome': 'Trouvez des hôpitaux et prenez rendez-vous.',
      'HotelDashboard': 'Gérez votre hôtel : chambres, réservations et tarifs.',
      'TaxiHome': 'Commandez un taxi ou consultez vos courses.',
      'DeliveryHome': 'Envoyez des colis ou commandez des courses avec livraison.',
      'CovoiturageHome': 'Trouvez ou proposez un covoiturage.',
      'OffresEmploiHome': 'Recherchez des emplois ou publiez des offres.',
      'OrientationScolaireHome': 'Trouvez un établissement scolaire avec l\'aide de l\'IA.',
      'LivreScolaireHome': 'Achetez, vendez ou échangez des livres scolaires.',
      'Navigation': 'Navigation GPS avec guidage vocal, alertes radars/contrôles, points d\'intérêt.',
      'BourseLivre': 'Bourse du Livre — achetez, vendez et échangez des livres scolaires avec IA.',
      'ChatModalMobile': 'Chat avec un prestataire — messages, appels, négociation, commande.',
      'SupermarketPartnerDashboard': 'Gérez votre supermarché : catalogue, commandes, promotions, statistiques.',
      'RestaurantDashboard': 'Gérez votre restaurant : menu, commandes, horaires, statistiques.',
      'FleetDashboard': 'Gérez votre flotte de coursiers : équipe, candidatures, livraisons, stats.',
      'OrientationPartnerDashboard': 'Gérez votre établissement scolaire : programmes, étudiants, événements.',
      'GestionServicesSpecialises': 'Liste de vos services spécialisés. Filtrez et gérez vos services.',
      'DeliveryParcelFlowNew': 'Envoi de colis : type, poids, adresses, assurance.',
      'DeliveryShoppingFlowNew': 'Commande de courses avec livraison : magasin, panier, budget, adresse.',
      'ShoppingBasket': 'Composition de votre panier de courses.',
      'ShoppingSummary': 'Récapitulatif et confirmation de commande.',
      'DeliveryShoppingTracking': 'Suivi de votre commande de courses en temps réel.',
      'CourierDashboard': 'Dashboard coursier : livraisons actives, revenus, statistiques.',
      'CourierRegistration': 'Inscription comme coursier Yukpo.',
      'PharmacieDetails': 'Détails d\'une pharmacie. Commandez, contactez, itinéraire.',
      'HopitalDetails': 'Détails d\'un hôpital. Prenez rendez-vous.',
      'TaxiBooking': 'Réservation d\'un taxi.',
      'TaxiTracking': 'Suivi de votre course de taxi en temps réel.',
      'CovoiturageDetails': 'Détails d\'un trajet de covoiturage.',
      'ImmobilierDetails': 'Détails d\'un bien immobilier.',
      'OffreDetails': 'Détails d\'une offre d\'emploi.',
      'EtablissementDetails': 'Détails d\'un établissement scolaire.',
      'BayamSelamSearch': 'Comparatif des prix entre marchés.',
    };
    return descriptions[screenName] || 'Posez-moi une question pour vous guider.';
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
}

export const intelligentChatService = new IntelligentChatService();
export default intelligentChatService;
