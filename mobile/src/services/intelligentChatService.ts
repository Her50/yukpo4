import { ActionDescriptor, ScreenContext } from '../hooks/useScreenContext';
import i18n from '../i18n';
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
    const langInstr = `MANDATORY: Respond ONLY in the user's language (code: ${activeLang}). Adapt tone and expressions to that language/culture.`;
    const userRole = userData?.role || 'guest';
    const userName = userData?.name || userData?.email?.split('@')[0] || '';

    let prompt = `${langInstr}

You are **Yukpo Assistant** — the intelligent concierge of Yukpo, a revolutionary all-in-one digital platform for Africa and the world.

YOUR PERSONALITY:
- You are warm, enthusiastic and professional — like a knowledgeable friend who LOVES what Yukpo offers
- Your answers are CONCISE (2-4 sentences max), IMPACTFUL and designed to make users want to explore
- Use a marketing-savvy tone: highlight VALUE and BENEFITS, not just features
- When presenting Yukpo's services, convey the REVOLUTION: "First platform to digitize X in Africa", "AI-powered", "Unique in the market"
- Use short, punchy sentences. No walls of text. Think of each response as a mini pitch.
- Add relevant emojis sparingly for visual appeal (1-3 per response max)

YUKPO — THE DIGITAL REVOLUTION:
Yukpo is the FIRST all-in-one super-app that digitalizes daily life across Africa and beyond:
• 🏥 Health: Pharmacies (stock search, ordering), Hospitals (AI triage, appointments), Labs, Blood banks
• 🏨 Real Estate: Hotels, furnished rentals, property management with AI pricing
• 🚗 Transport: Taxi (AI dynamic pricing), Carpooling, Bus tickets (seat selection, QR boarding)
• 📦 Delivery: Parcels, grocery shopping, fleet management, real-time tracking
• 💼 Jobs: AI CV analysis, salary prediction, training suggestions, smart matching
• 🎓 Education: School orientation AI, book exchange (Bourse du Livre with AI matching & trocchains)
• 🗺️ Smart Navigation: GPS with voice guidance, speed cameras, POI, community alerts
• 🎬 Video: AI video creation, ads, lives
• 🛒 E-commerce: Products, negotiations, promotions, comparisons
• 🍽️ Menu Planning: AI meal plans, recipes, shopping lists
• 💰 Wallet: Multi-method payments (MTN MoMo, Orange Money, Wave, Visa, PayPal...), bonuses
• And much more: Insurance, Supermarkets, Restaurants, Travel agencies...

CURRENT SCREEN: "${screenName}" (type: ${screenType})
USER: ${userRole}${userName ? ` (${userName})` : ''}

SCREEN GUIDE: ${guideText || 'Management screen.'}

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

    // Home / Creation / Management context
    const homeCreationScreens = ['Home', 'HomeScreen', 'FormulaireYukpoIntelligent', 'AjouterProduitSimple', 'MesProduits', 'DashboardPrestataire', 'ProductManagerMobile'];
    if (homeCreationScreens.some(s => screenName.includes(s))) {
      prompt += `\n\nPRODUCT/SERVICE CREATION & MANAGEMENT CONTEXT:

HOW TO CREATE (revolutionary simplicity):
1. On Home screen, switch to "Create" mode (toggle button)
2. Submit a PHOTO of your product/service OR type a description — AI does the rest!
3. AI analyzes the image/text and auto-fills: name, category, description, price suggestion

FIRST-TIME CREATION (captures business info):
- Google Business auto-import (name, address, phone, website, photos)
- 6-step intelligent form: General Info → Contacts → Location GPS → Products (with price variants) → Visual Identity (logo + banner) → Payment Methods (MTN MoMo, Orange Money, Visa, cash...)
- All business info is saved — subsequent creations skip this!

SUBSEQUENT PRODUCT ADDITIONS (simplified):
- Just a photo + quick adjustments → product added to existing catalog
- AI pre-fills everything from the image
- Price variants (sizes, colors, options) support

PRODUCT MANAGEMENT (MesProduits screen):
- Edit: modify name, price, photos, description, stock anytime
- Price Variants: add sizes/colors/options with different prices
- Activate/Deactivate: toggle product visibility instantly
- Duplicate: clone a product to create similar ones fast
- Bulk Import: upload up to 500 products via CSV/Excel
- Stats: track views, orders, revenue per product
- Orders: manage incoming orders from customers
- Advertising: create promotional campaigns for products

IMPORTANT: When user asks about creation/management, be specific about WHICH step they need. Always suggest relevant follow-up actions.`;
    }

    // Covoiturage-specific context for driver AND passenger
    const covoiturageScreens = ['CovoiturageHome', 'CovoiturageForm', 'CovoiturageDetails', 'CovoiturageBooking', 'CovoiturageSearch', 'CovoiturageList', 'MesReservationsCovoiturage', 'MyTrips'];
    if (covoiturageScreens.some(s => screenName.includes(s) || screenName.includes('Covoiturage'))) {
      const isDriver = userRole === 'partenaire' || userRole === 'driver' || userData?.partner_type === 'covoiturage' || userData?.partner_type === 'chauffeur';
      prompt += `\n\nCOVOITURAGE SERVICE CONTEXT:
Role: ${isDriver ? 'DRIVER/PARTNER (manages trips)' : 'PASSENGER (searches & books trips)'}
${isDriver ? `DRIVER FEATURES:
- Create trips: CovoiturageForm screen (set departure, destination, date, time, seats, price, vehicle info, recurring options)
- My trips dashboard: view all published trips, stats, bookings count
- Confirm departure: triggers automatic payout to wallet (10% commission deducted)
- Recurring trips: daily, weekly (select days), monthly — auto-republished
- Vehicle photo upload, baggage/pets/smoking/AC options
- Revenue tracking via Stats tab` : `PASSENGER FEATURES:
- Search trips: by departure city + destination city + date
- Book seats: choose number of places, pay via Yukpo Wallet
- Insurance options: basic, premium, full coverage
- QR code ticket after booking
- Driver verification badge
- Reviews after trip completion
- My reservations: track all bookings`}
Payment: Yukpo Wallet (primary), Stripe/PayPal (coming soon). 10% commission on each booking.
Key screens: CovoiturageHome (search+create), CovoiturageForm (driver dashboard), CovoiturageBooking (passenger booking+payment), CovoiturageDetails (trip info+reviews)`;
    }

    // Taxi-specific context for driver AND passenger
    const taxiScreens = ['TaxiHome', 'TaxiForm', 'TaxiDetails', 'TaxiBooking', 'TaxiSearch', 'TaxiList', 'TaxiTracking', 'TaxiAvailability', 'MesTaxis'];
    if (taxiScreens.some(s => screenName.includes(s) || screenName.includes('Taxi'))) {
      const isDriver = userRole === 'partenaire' || userRole === 'driver' || userData?.partner_type === 'taxi' || userData?.partner_type === 'chauffeur';
      prompt += `\n\nTAXI SERVICE CONTEXT:
Role: ${isDriver ? 'DRIVER/PARTNER (manages taxi service)' : 'PASSENGER (searches & books taxis)'}
${isDriver ? `DRIVER FEATURES:
- Dashboard: TaxiForm screen with 3 tabs (Overview / Service / Stats)
- Availability toggle: go online/offline for clients
- Vehicle info: type, make/model, registration, color, year, photo
- Pricing: base rate + per-km rate, dynamic pricing via AI
- Payment methods: cash, mobile money, bank card
- Options: AC, WiFi
- GPS position for proximity matching
- Zone d'intervention management
- AI demand prediction and revenue analytics` : `PASSENGER FEATURES:
- Search taxis: by location (GPS auto-detected), destination, availability filter
- AI recommendations: personalized taxi suggestions based on location
- Real-time demand prediction: high/normal/low demand indicator
- Dynamic pricing: AI-calculated price with surge factor
- Book taxi: select pickup/dropoff GPS, insurance options, QR code ticket
- Call or WhatsApp driver directly from the card
- Real-time tracking: live driver position on map, ETA, status updates
- Price estimation: base + per-km calculation with distance`}
Payment: Cash, Mobile Money, Bank Card. AI dynamic pricing adjusts based on demand/supply.
Key screens: TaxiHome (search+recommendations), TaxiForm (driver dashboard), TaxiBooking (passenger booking), TaxiTracking (live tracking), TaxiDetails (driver info+reviews)`;
    }

    // Emploi/Job-specific context for employer AND candidate
    const emploiScreens = ['OffresEmploiHome', 'OffresEmploiHub', 'CreateOffre', 'OffreDetails', 'OffreList', 'OffreSearch', 'MesOffres', 'OffreCandidatures', 'AlertesEmploi', 'ProfilCandidat', 'AICVAnalysis', 'AISalaryPrediction', 'AISuggestFormations'];
    if (emploiScreens.some(s => screenName.includes(s) || screenName.includes('Offre') || screenName.includes('Emploi'))) {
      const isEmployer = userRole === 'partenaire' || userData?.partner_type === 'offres_emploi' || userData?.partner_type === 'recruteur' || userData?.partner_type === 'employeur';
      prompt += `\n\nJOB/EMPLOYMENT SERVICE CONTEXT:
Role: ${isEmployer ? 'EMPLOYER/RECRUITER (publishes & manages job offers)' : 'CANDIDATE (searches & applies to jobs)'}
${isEmployer ? `EMPLOYER FEATURES:
- Create job offers: CreateOffre screen (title, description, sector, contract type, location, salary, skills, remote)
- AI form filling: describe the job in natural language → AI fills all fields
- My offers dashboard: MesOffres with candidature count per offer
- Candidature management: view applicants, update status (pending/shortlisted/accepted/rejected)
- AI matching: find best candidates for an offer based on skills + experience
- Offer stats: views, applications, conversion rate
- Close/mark as filled` : `CANDIDATE FEATURES:
- Search jobs: by title, sector, skills, GPS proximity, contract type (CDI/CDD/Stage/Freelance)
- AI CV Analysis: score /100, strengths, weaknesses, improvement suggestions
- AI Salary Prediction: estimate based on role, sector, experience, location
- AI Formation Suggestions: trainings to fill skill gaps
- AI Job Matching: personalized recommendations based on profile
- Apply: one-click with profile + CV
- Job alerts: notifications for matching offers
- Candidate profile: CV, skills, experience, languages, salary expectations
- Save/bookmark offers`}
AI: CV analysis, salary prediction, formation suggestions, job matching — all with 3-level fallback.
Key screens: OffresEmploiHome (search+AI), CreateOffre (employer form+AI), OffreDetails (apply+score), MesOffres (employer), ProfilCandidat (candidate)`;
    }

    // Menu planning / food menu context
    const menuScreens = ['MenuPlanningHub', 'MenuWeekCalendar', 'ShoppingList', 'FamilyProfile'];
    if (menuScreens.some(s => screenName.includes(s) || screenName.includes('MenuPlanning') || screenName.includes('MenuWeek'))) {
      prompt += `\n\nMENU PLANNING SERVICE CONTEXT:
Goal: generate a periodic meal plan + recipes + shopping lists, using AI with safe fallbacks.
Key screens:
- MenuPlanningHub: entry point to generate a menu (1 week / 15 days / 1 month), access family profile, recipes, history.
- FamilyProfile: configure household (members, adults/children, preferences, allergies, restrictions, budget, cuisines, cooking level, time available).
- MenuWeekCalendar: view the menu as table/list, add/edit meals, export PDF, generate recipe details, build shopping list / courier order flow.
- ShoppingList: view items, check/uncheck, optionally organize by store/aisle.
Main backend endpoints:
- POST /api/menus/ai/generate-week (creates a menu plan, uses user GPS context)
- POST /api/menus/ai/generate-recipe
- POST /api/menus/ai/generate-shopping-list
- GET/POST /api/menus/shopping-list
- GET/PUT /api/menus/family-profile
- GET /api/menus/history
Common user questions you can help with: how to configure profile, generate a menu, adjust period, export/share PDF, create a shopping list, and what to do if AI is unavailable.`;
    }

    // Orientation scolaire context
    const orientationScreens = ['OrientationScolaireHub', 'OrientationScolaireHome', 'ProfilEtudiant', 'OrientationAIProfileAnalysis', 'OrientationAIRecommendations', 'OrientationAIComparePrograms', 'OrientationAICompareProgramsScreen', 'OrientationAIRecommendationsScreen', 'OrientationAIProfileAnalysisScreen'];
    if (orientationScreens.some(s => screenName.includes(s) || screenName.includes('Orientation'))) {
      prompt += `\n\nSCHOOL ORIENTATION SERVICE CONTEXT:
Goal: help students/parents find schools, programs, entrance exams (concours), conferences, supplies, and use AI for profile analysis and guidance.
Key screens:
- OrientationScolaireHub: quick entry by school type + AI shortcuts.
- OrientationScolaireHome: tabs (schools/programs/concours/conferences/supplies) + search + AI academic Q&A.
Main backend endpoints:
- GET /api/orientation-scolaire/etablissements/search|suggest|{id}|{id}/programmes|{id}/fournitures
- GET /api/orientation-scolaire/programmes/search
- GET /api/orientation-scolaire/concours/actifs|search|{id}
- GET /api/orientation-scolaire/conferences/programmees|search|{id}
- POST /api/orientation-scolaire/conferences/{id}/join
- GET/POST /api/orientation/my-profile, GET /api/orientation/analytics
- POST /api/orientation/ai/analyze-profile|recommendations|compare-programs|academic-search
AI features: profile analysis, recommendations, program comparison, academic search Q&A (with local fallback when AI is down).`;
    }

    // Hotel/Meublé-specific context for partner AND user
    const hotelScreens = ['HotelDashboard', 'HotelMeubleHome', 'HotelBooking', 'HotelBookingPayment', 'HotelQRScanner', 'HotelReservationQR', 'ImmobilierForm', 'ImmobilierDetails', 'ImmobilierSearch'];
    if (hotelScreens.some(s => screenName.includes(s) || screenName.includes('Hotel') || screenName.includes('Immobilier'))) {
      const isPartner = userRole === 'partenaire' || userData?.partner_type === 'hotel' || userData?.partner_type === 'meuble';
      prompt += `\n\nHOTEL/MEUBLÉ SERVICE CONTEXT:
Role: ${isPartner ? 'PARTNER/MANAGER (manages properties & reservations)' : 'USER/GUEST (searches & books accommodations)'}
${isPartner ? `PARTNER DASHBOARD FEATURES (HotelDashboard):
- 5 TABS: Vue d'ensemble (overview stats + quick actions + pending arrivals + checked-in clients), Réservations (full list with check-in/out/QR/payment), Mes biens (properties with availability + edit + AI pricing), IA (AI insights: pricing suggestions, occupancy forecast, recommendations per property), Équipe (team management)
- QUICK ACTIONS: Ajouter un bien → ImmobilierForm, Nouvelle réservation → modal form, Scanner QR → HotelQRScanner, IA Insights → AI tab, Portefeuille → WalletFinancial
- RESERVATION MANAGEMENT: Create manual reservations (client name, phone, dates, rooms, price per night), Check-in button (on confirmed reservations), Check-out button (on checked-in guests), View QR codes, Record payments (advance or full)
- PROPERTY MANAGEMENT: Add/edit properties via ImmobilierForm (title, description, type, location with GPS + Google Places photos import, characteristics, pricing, media upload, virtual tour 360°)
- AI FEATURES: Pricing suggestions per property, occupancy forecasts, optimization recommendations
- FINANCIAL: Revenue tracking, payment status (paid/advance/pending), Wallet access
- QR SYSTEM: Each reservation gets a QR code. Scan at reception to verify guest. Generate guest QR for co-occupants
- TEAM: Manage staff members via ServiceTeamManager` : `USER/GUEST FEATURES:
- SEARCH (HotelMeubleHome): Search by name, filter by ville (city), nombre de chambres (rooms), budget max, standing (Économique/Standard/Confort/Premium/Luxe)
- PROPERTY CARDS: Show title, location, rooms, standing, distance, price per night, rating
- BOOKING (HotelBooking): Enter dates (AAAA-MM-JJ format), adults/children/rooms count with +/- steppers, contact info, notes. Price auto-calculated (price × nights × rooms)
- PAYMENT: After booking confirmation by manager, pay via HotelBookingPayment screen (MTN MoMo, Orange Money, Visa/Mastercard)
- DETAILS: View full property details, photos, description, amenities on ImmobilierDetails screen`}
Payment methods: MTN MoMo, Orange Money, Visa/Mastercard, Cash. Commission: 5% on transactions.
Key screens: HotelMeubleHome (user search), HotelBooking (user reservation form), HotelBookingPayment (payment), HotelDashboard (partner management), ImmobilierForm (property creation/edit), HotelQRScanner (QR verification)`;
    }

    // Bourse du Livre / Coursier Livres context
    const bookScreens = ['BookPackages', 'BookUploadV2', 'BookRecapV2', 'BookBuyDirect', 'LivreScolaireHome', 'LivreScolaireSearch', 'LivreScolaireDetails', 'LivreScolaireForm', 'LivreScolaireList', 'MesLivres', 'MesBesoinsLivres', 'MesTrocs', 'TrocMatching', 'TrocDetails', 'TrocLiveValidation', 'NewBooks', 'AdminProgrammeUpload', 'AdminDonations', 'BourseLivre'];
    if (bookScreens.some(s => screenName.includes(s) || screenName.includes('Livre') || screenName.includes('Troc') || screenName.includes('BookPackage') || screenName.includes('Bourse'))) {
      const isCourier = userRole === 'coursier' || userData?.is_courier || screenName.includes('courier') || screenName === 'BookPackages';
      const isLibraire = userData?.partner_type === 'librairie' || userData?.partner_type === 'livrescolaire' || screenName.includes('AdminProgramme');
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

            `UTILISATEUR — TROC ET ACHAT DE LIVRES:

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

RESPONSE FORMAT (JSON):
{
  "message": "Your concise, impactful response text here",
  "type": "text|action_suggestion|navigation_help|visual_guide",
  "suggested_actions": [{"id": "unique_id", "label": "Button Label", "icon": "icon-name", "route": "ScreenName", "category": "navigation|action|search|creation"}],
  "next_steps": ["Anticipated follow-up question 1?", "Anticipated follow-up question 2?", "Anticipated follow-up question 3?"],
  "confidence": 0.95
}`;

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

    if (match(['bonjour', 'salut', 'hello', 'hi ', 'hey', 'bonsoir', 'good', 'hola', 'jambo', 'habari', 'sannu'])) {
      const isHomeScreen = screenName === 'Home' || screenName === 'HomeScreen';
      const welcomeMessage = isHomeScreen
        ? `🌟 **Bienvenue sur Yukpo !** 

La super-app qui simplifie votre quotidien.

Commencez dès maintenant ! 👇`
        : t('intelligentChat.fallback.greeting', { screen: screenName, guide: guideText || '' }) ||
        `Welcome to Yukpo! You're on "${screenName}". Here's what you can do:`;

      return {
        message: welcomeMessage,
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
      return {
        message: `${guideText || t('intelligentChat.fallback.youAreOn', { screen: screenName })}\n\n${t('intelligentChat.fallback.availableActions') || 'Available actions:'}`,
        type: 'text',
        suggestedActions: topActions(5),
        nextSteps: [
          t('intelligentChat.fallback.tapAction') || 'Tap an action above to execute it',
          t('intelligentChat.fallback.askSpecific') || 'Ask a more specific question for step-by-step guidance',
          t('intelligentChat.fallback.askWhere') || 'Ask "where is..." to navigate to a screen',
        ],
      };
    }

    // === CROSS-SCREEN: Product/Service management ===
    if (matchGroup('manage') && (matchGroup('product') || match(['produit', 'product', 'service', 'boutique', 'catalog']))) {
      return {
        message: t('intelligentChat.fallback.manageGuide') ||
          '📦 Product Management on Yukpo gives you full control!\n\n'
          + '• Edit products: change name, price, photos, description anytime\n'
          + '• Price variants: add sizes, colors, options with different prices\n'
          + '• Activate/Deactivate: control product visibility instantly\n'
          + '• Duplicate: clone a product to create similar ones fast\n'
          + '• Bulk Import: upload up to 500 products via CSV/Excel\n'
          + '• Stats: track views, orders and revenue per product\n\n'
          + 'Access your products from the Dashboard or "My Products".',
        type: 'action_suggestion',
        suggestedActions: [
          { id: 'my-products', label: t('intelligentChat.fallback.myProducts') || '📦 My Products', icon: 'package', route: 'MesProduits', category: 'navigation', description: '' },
          { id: 'add-product', label: t('intelligentChat.fallback.addProduct') || '➕ Add Product', icon: 'plus', route: 'AjouterProduitSimple', category: 'creation', description: '' },
          { id: 'dashboard', label: t('intelligentChat.fallback.dashboard_nav') || '📊 Dashboard', icon: 'bar-chart-3', route: 'DashboardPrestataire', category: 'navigation', description: '' },
          { id: 'orders', label: t('intelligentChat.fallback.orders') || '📋 Orders', icon: 'clipboard-list', route: 'ProviderOrderManagement', category: 'navigation', description: '' },
        ],
        nextSteps: [
          t('intelligentChat.followUp.howCreateProduct') || 'How do I create a product?',
          t('intelligentChat.followUp.howImportCSV') || 'Can I import products in bulk?',
          t('intelligentChat.followUp.howTrackSales') || 'How to track my sales?',
          t('intelligentChat.followUp.howSetPricing') || 'How to set up price variants?',
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
            '🚀 Creating on Yukpo is revolutionary!\n\n'
            + '📸 Just take a PHOTO of your product — AI auto-fills everything (name, price, category)!\n\n'
            + '🏪 First time? The app captures your business info (name, contacts, logo, banner, payment methods). After that, adding products is even faster!\n\n'
            + 'On the Home screen, switch to "Create" mode and submit a photo or description.',
          type: 'action_suggestion',
          suggestedActions: [
            { id: 'go-home-create', label: t('intelligentChat.fallback.goCreate') || '✨ Create Now', icon: 'plus', route: 'Home', category: 'creation', description: '' },
            { id: 'my-products', label: t('intelligentChat.fallback.myProducts') || '📦 My Products', icon: 'package', route: 'MesProduits', category: 'navigation', description: '' },
            { id: 'dashboard', label: t('intelligentChat.fallback.dashboard_nav') || '📊 Dashboard', icon: 'bar-chart-3', route: 'DashboardPrestataire', category: 'navigation', description: '' },
          ],
          nextSteps: [
            t('intelligentChat.followUp.howManageProducts') || 'How do I manage my products?',
            t('intelligentChat.followUp.howAddVariants') || 'How to add price variants?',
            t('intelligentChat.followUp.howImportCSV') || 'Can I import products in bulk?',
          ],
        };
      }

      if (creationActions.length > 0) {
        return {
          message: t('intelligentChat.fallback.createOptions') || 'Here\'s what you can create:',
          type: 'action_suggestion',
          suggestedActions: creationActions.slice(0, 3),
          nextSteps: [
            t('intelligentChat.followUp.howCreateFromImage') || 'Can I create from just a photo?',
            t('intelligentChat.followUp.whatHappensFirst') || 'What happens on first creation?',
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
      { id: 'pack-realestate', label: t('intelligentChat.pack.realestate') || '🏨 Immobilier & Séjour', icon: 'building', route: 'HotelMeubleHome', category: 'navigation', description: t('intelligentChat.pack.realestateDesc') || 'Hôtels · Meublés · Immobilier · Assurance' },
      { id: 'pack-creative', label: t('intelligentChat.pack.creative') || '🎬 Créativité & IA', icon: 'video', route: 'Home', category: 'creation', description: t('intelligentChat.pack.creativeDesc') || 'Vidéo IA · Création en 1 photo · Menu IA · Recettes' },
      { id: 'pack-finance', label: t('intelligentChat.pack.finance') || '💰 Finance & Paiement', icon: 'wallet', route: 'WalletFinancial', category: 'navigation', description: t('intelligentChat.pack.financeDesc') || 'Wallet · Recharge · 14 paiements · Historique' },
      { id: 'solo-gps', label: t('intelligentChat.solo.gps') || '🗺️ Navigation Intelligente Yukpo', icon: 'map', route: 'Navigation', category: 'navigation', description: t('intelligentChat.solo.gpsDesc') || 'Guidage vocal · Radars · Alertes · POI · Santé · Marche · CO2 · Performances · Coach IA' },
      { id: 'solo-books', label: t('intelligentChat.solo.books') || '📚 Bourse du Livre Yukpo / Troc', icon: 'book-open', route: 'BourseLivre', category: 'navigation', description: t('intelligentChat.solo.booksDesc') || 'Troc intelligent · Achat/Vente · Chaînes DAG · Dons' },
      { id: 'solo-bus', label: t('intelligentChat.solo.bus') || '🎫 Tickets de Bus Yukpo', icon: 'bus', route: 'TicketVoyageHome', category: 'navigation', description: t('intelligentChat.solo.busDesc') || 'Réservation · Sélection siège · QR boarding · Agences' },
      { id: 'solo-carpooling', label: t('intelligentChat.solo.carpooling') || '🚗 Covoiturage Yukpo', icon: 'users', route: 'CovoiturageHome', category: 'navigation', description: t('intelligentChat.solo.carpoolingDesc') || 'Trajets partagés · Matching IA · Récurrent · QR ticket' },
      { id: 'solo-hotel', label: t('intelligentChat.solo.hotel') || '🏨 Hôtel / Meublé Yukpo', icon: 'building', route: 'HotelMeubleHome', category: 'navigation', description: t('intelligentChat.solo.hotelDesc') || 'Réservation · Tarification IA · QR check-in · 360°' },
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
    { keywords: ['hotel', 'meuble', 'hebergement', 'accommodation', 'hoteli', 'otal'], action: { id: 'hotel', label: 'Hôtel', icon: 'building', route: 'HotelMeubleHome', category: 'navigation', description: '' } },
    { keywords: ['taxi', 'cab', 'teksi'], action: { id: 'taxi', label: 'Taxi', icon: 'car', route: 'TaxiHome', category: 'navigation', description: '' } },
    { keywords: ['covoiturage', 'carpooling', 'ride share', 'kushiriki safari'], action: { id: 'covoit', label: 'Covoiturage', icon: 'users', route: 'CovoiturageHome', category: 'navigation', description: '' } },
    { keywords: ['livraison', 'delivery', 'entrega', 'lieferung', 'uwasilishaji', 'isarwa'], action: { id: 'delivery', label: 'Livraison', icon: 'truck', route: 'DeliveryHome', category: 'navigation', description: '' } },
    { keywords: ['emploi', 'travail', 'job', 'work', 'kazi', 'aiki'], action: { id: 'emploi', label: 'Emploi', icon: 'briefcase', route: 'OffresEmploiHome', category: 'navigation', description: '' } },
    { keywords: ['orientation', 'ecole', 'school', 'shule', 'makaranta'], action: { id: 'orientation', label: 'Orientation scolaire', icon: 'graduation-cap', route: 'OrientationScolaireHome', category: 'navigation', description: '' } },
    { keywords: ['livre', 'book', 'kitabu', 'littafi'], action: { id: 'livres', label: 'Livres', icon: 'book-open', route: 'LivreScolaireHome', category: 'navigation', description: '' } },
    { keywords: ['profil', 'profile', 'wasifu', 'bayanan'], action: { id: 'profile', label: 'Profil', icon: 'user', route: 'Profile', category: 'navigation', description: '' } },
    { keywords: ['parametre', 'reglage', 'settings', 'mipangilio'], action: { id: 'settings', label: 'Paramètres', icon: 'settings', route: 'EnhancedSettings', category: 'navigation', description: '' } },
    { keywords: ['immobilier', 'real estate', 'mali isiyohamishika'], action: { id: 'immo', label: 'Immobilier', icon: 'building-2', route: 'ImmobilierHome', category: 'navigation', description: '' } },
    { keywords: ['assurance', 'insurance', 'bima', 'inshora'], action: { id: 'assurance', label: 'Assurance', icon: 'shield', route: 'AssuranceDashboard', category: 'navigation', description: '' } },
    { keywords: ['laboratoire', 'labo', 'laboratory', 'lab', 'maabara'], action: { id: 'lab', label: 'Laboratoire', icon: 'activity', route: 'LaboratoireHome', category: 'navigation', description: '' } },
    { keywords: ['sang', 'blood', 'damu', 'jini'], action: { id: 'blood', label: 'Don de sang', icon: 'droplet', route: 'BloodDonation', category: 'navigation', description: '' } },
    { keywords: ['bus', 'autobus', 'basi'], action: { id: 'bus', label: 'Bus', icon: 'bus', route: 'TicketVoyageHome', category: 'navigation', description: '' } },
    { keywords: ['supermarche', 'supermarket', 'duka kubwa'], action: { id: 'supermarket', label: 'Supermarché', icon: 'shopping-cart', route: 'SupermarketHome', category: 'navigation', description: '' } },
    { keywords: ['menu', 'repas', 'meal', 'mlo'], action: { id: 'menu', label: 'Menu', icon: 'calendar', route: 'MenuPlanningHub', category: 'navigation', description: '' } },
    { keywords: ['video', 'clip'], action: { id: 'video', label: 'Vidéo', icon: 'video', route: 'VideoCreationIntro', category: 'navigation', description: '' } },
    { keywords: ['navigation', 'gps', 'carte', 'map', 'ramani'], action: { id: 'nav', label: 'Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' } },
    { keywords: ['bourse', 'troc', 'exchange', 'kubadilishana'], action: { id: 'bourse', label: 'Bourse du Livre', icon: 'book-open', route: 'BourseLivre', category: 'navigation', description: '' } },
    { keywords: ['radar', 'speed camera'], action: { id: 'radar', label: 'Navigation GPS', icon: 'map', route: 'Navigation', category: 'navigation', description: '' } },
    { keywords: ['colis', 'parcel', 'package', 'kifurushi'], action: { id: 'parcel', label: 'Envoyer Colis', icon: 'package', route: 'DeliveryParcelFlowNew', category: 'navigation', description: '' } },
    { keywords: ['courses', 'shopping', 'ununuzi'], action: { id: 'shopping', label: 'Courses', icon: 'shopping-cart', route: 'DeliveryShoppingFlowNew', category: 'navigation', description: '' } },
    { keywords: ['coursier', 'courier', 'mjumbe'], action: { id: 'courier', label: 'Dashboard Coursier', icon: 'truck', route: 'CourierDashboard', category: 'navigation', description: '' } },
    { keywords: ['flotte', 'fleet'], action: { id: 'fleet', label: 'Gestion Flotte', icon: 'users', route: 'FleetDashboard', category: 'navigation', description: '' } },
    { keywords: ['restaurant', 'mkahawa'], action: { id: 'restaurant', label: 'Restaurant', icon: 'utensils', route: 'RestaurantDashboard', category: 'navigation', description: '' } },
    { keywords: ['agence', 'voyage', 'travel', 'safari'], action: { id: 'agence', label: 'Agence de Voyage', icon: 'plane', route: 'AgenceVoyageSearch', category: 'navigation', description: '' } },
    { keywords: ['ticket', 'billet', 'tikiti'], action: { id: 'bus-ticket', label: 'Tickets Bus', icon: 'bus', route: 'BusTicketSearch', category: 'navigation', description: '' } },
    { keywords: ['automobile', 'voiture', 'car', 'gari'], action: { id: 'auto', label: 'Automobile', icon: 'car', route: 'AutoServicesSearch', category: 'navigation', description: '' } },
    { keywords: ['recette', 'recipe', 'mapishi'], action: { id: 'recipe', label: 'Recettes', icon: 'book-open', route: 'RecipeSearch', category: 'navigation', description: '' } },
    { keywords: ['bayam', 'marche', 'market', 'soko', 'kasuwa'], action: { id: 'bayam', label: 'BayamSelam', icon: 'tag', route: 'BayamSelamSearch', category: 'navigation', description: '' } },
    { keywords: ['mes services', 'my services'], action: { id: 'services', label: 'Mes Services', icon: 'grid', route: 'GestionServicesSpecialises', category: 'navigation', description: '' } },
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
}

export const intelligentChatService = new IntelligentChatService();
export default intelligentChatService;
