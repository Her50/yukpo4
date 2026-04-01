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

// ─── Détection catégorie service ─────────────────────────────────────────────

export type ServiceCategory =
  | 'pharmacie' | 'hopital' | 'laboratoire' | 'sante'
  | 'taxi' | 'covoiturage' | 'bus' | 'transport'
  | 'hotel' | 'immobilier' | 'hebergement'
  | 'restaurant' | 'alimentation'
  | 'livraison' | 'coursier'
  | 'supermarche' | 'epicerie'
  | 'emploi' | 'rh'
  | 'education' | 'orientation'
  | 'assurance'
  | 'automobile' | 'garage'
  | 'livre' | 'librairie'
  | 'general';

const CATEGORY_KEYWORDS: Record<ServiceCategory, string[]> = {
  pharmacie: ['pharmac', 'medic', 'medicament', 'drug', 'sante', 'health', 'ordonnance', 'prescription'],
  hopital: ['hopital', 'clinique', 'hospital', 'clinic', 'medecin', 'doctor', 'urgence', 'emergency', 'specialist'],
  laboratoire: ['labora', 'analyse', 'examen', 'bilan', 'test', 'result'],
  sante: ['sante', 'health', 'medical', 'soins', 'care', 'infirm'],
  taxi: ['taxi', 'cab', 'vtc', 'chauffeur', 'driver', 'moto', 'mototaxi'],
  covoiturage: ['covoit', 'carpooling', 'covoitur', 'trajet', 'trip', 'passager', 'passenger'],
  bus: ['bus', 'car', 'voyage', 'agence voyage', 'ticket', 'billet', 'transport inter'],
  transport: ['transport', 'deplacement', 'move', 'mobilit'],
  hotel: ['hotel', 'chambre', 'room', 'hebergement', 'pension', 'reservation', 'booking', 'nuit', 'night'],
  immobilier: ['immo', 'appartement', 'maison', 'locat', 'vente', 'propriet', 'terrain', 'studio'],
  hebergement: ['hebergement', 'logement', 'meuble', 'furnished'],
  restaurant: ['restaurant', 'resto', 'manger', 'plat', 'menu', 'repas', 'meal', 'food', 'cuisine', 'nourriture'],
  alimentation: ['alimentat', 'food', 'nourriture'],
  livraison: ['livraison', 'livrer', 'delivery', 'colis', 'coursier', 'courier', 'paquet', 'package', 'envoi', 'send'],
  coursier: ['coursier', 'courier', 'livreur', 'rider'],
  supermarche: ['supermarche', 'supermarket', 'epicerie', 'grocery', 'marche', 'market', 'courses'],
  epicerie: ['epicerie', 'boutique', 'shop', 'magasin'],
  emploi: ['emploi', 'travail', 'job', 'recrutement', 'cv', 'offre emploi', 'carriere', 'career'],
  rh: ['ressources humaines', 'rh', 'hr', 'recruteur', 'recruiter'],
  education: ['educati', 'ecole', 'universite', 'cours', 'formation', 'school', 'university', 'etudiant'],
  orientation: ['orientation', 'etude', 'programme', 'filiere', 'diplome'],
  assurance: ['assurance', 'insurance', 'sinistre', 'police', 'couverture', 'coverage'],
  automobile: ['auto', 'voiture', 'car', 'garage', 'mecanic', 'mecano', 'reparation', 'vehicule'],
  garage: ['garage', 'atelier', 'repair', 'reparation'],
  livre: ['livre', 'scolaire', 'book', 'manuel', 'textbook', 'troc livre'],
  librairie: ['librairie', 'bookstore', 'papeterie'],
  general: [],
};

const t = (key: string, params?: Record<string, any>): string => i18n.t(key, params) as string;

class ChatbotIntelligentService {

  // ─── Détection catégorie ────────────────────────────────────────────────────

  detectServiceCategory(service: any): ServiceCategory {
    const raw = [
      service?.category, service?.categorie, service?.type,
      service?.data?.category, service?.data?.type,
      this.getServiceName(service), this.getServiceDescription(service),
    ].filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ServiceCategory, string[]][]) {
      if (cat === 'general') continue;
      if (keywords.some(k => raw.includes(k))) return cat;
    }
    return 'general';
  }

  // ─── Prompts spécialisés par catégorie ─────────────────────────────────────

  buildCategoryPrompt(category: ServiceCategory, service: any, lang: string, turnCount: number): string {
    const name = this.getServiceName(service);
    const price = this.getServicePrice(service);
    const desc = this.getServiceDescription(service);
    const products = this.getProducts(service);
    const productsList = products.length > 0
      ? products.slice(0, 8).map((p: any) => `• ${p.nom || p.name || '?'}${p.prix ? ` — ${p.prix} XAF` : ''}`).join('\n')
      : 'Aucun catalogue listé';

    const base = `MANDATORY: Respond ONLY in language "${lang}". Be warm, empathetic, professional. Message #${turnCount + 1}.\n`;
    const continuity = `CONTINUITY: Always build on previous exchanges. Never restart as if conversation just began.\n`;

    const categoryBlocks: Partial<Record<ServiceCategory, string>> = {
      pharmacie: `You are Yukpo Pharmacie AI — knowledgeable pharmacy assistant.
${base}${continuity}
PHARMACY: "${name}" | Price/consultation: ${price || 'consult'}
${desc ? `Description: ${desc.substring(0, 300)}` : ''}
Medications/products: ${productsList}

RULES:
- NEVER give medical diagnosis or prescribe medications
- ALWAYS recommend consulting a healthcare professional for prescriptions
- CAN give general medication info (common uses, typical dosage, interactions to watch for)
- Guide users: search medications → find pharmacy on duty → order → track
- If AI prescription analysis: explain photo feature → AI identifies medications
- Payment: MTN MoMo, Orange Money, Visa, cash on delivery
- Suggest quick_replies: ["Trouver de garde", "Commander un médicament", "Analyser ordonnance", "Prix d'un médicament"]`,

      hopital: `You are Yukpo Santé AI — hospital and healthcare assistant.
${base}${continuity}
HOSPITAL/CLINIC: "${name}"
${desc ? `Specialties/info: ${desc.substring(0, 300)}` : ''}

RULES:
- NEVER diagnose illnesses
- Help users: find specialist → book appointment → describe symptoms for AI recommendation
- Guide through: AI specialist suggestion (describe symptoms → get suggested specialty)
- Emergency: always recommend calling local emergency or going to nearest ER
- Appointments: BookAppointment screen → choose doctor → choose date → confirm
- Suggest quick_replies: ["Prendre RDV", "Trouver un spécialiste", "Urgences proches", "Résultats d'examens"]`,

      taxi: `You are Yukpo Taxi AI — ride-booking assistant.
${base}${continuity}
TAXI/VTC SERVICE: "${name}" | Tarif: ${price || 'selon trajet'}
${desc ? `Info: ${desc.substring(0, 200)}` : ''}

HELP WITH:
1. Booking: set pickup address → set destination → confirm → driver accepts → real-time tracking
2. Pricing: tarif based on distance, time of day, vehicle type
3. Tracking: live map showing driver position
4. Safety: driver profile, vehicle details, trip sharing
5. Payment: MoMo, Orange Money, cash
6. Rating driver after trip
Suggest quick_replies: ["Réserver maintenant", "Estimer le prix", "Suivre mon trajet", "Contacter le chauffeur"]`,

      covoiturage: `You are Yukpo Covoiturage AI — carpooling assistant.
${base}${continuity}
CARPOOLING: "${name}" | Price: ${price || 'voir annonce'}

HELP WITH:
1. Finding rides: search by departure/destination/date → browse available trips
2. Booking a seat: select trip → book → pay → get contact details
3. Offering a ride: create ride → set departure/destination/date/seats/price
4. AI matching: describe your trip → AI suggests best matches
5. Managing reservations: MesReservationsCovoiturage
6. Rating: after trip, rate driver/passenger
Suggest quick_replies: ["Trouver un trajet", "Proposer un trajet", "Mes réservations", "Comment ça marche"]`,

      bus: `You are Yukpo Bus/Voyage AI — transport tickets assistant.
${base}${continuity}
TRAVEL AGENCY/BUS: "${name}" | Tarif: ${price || 'voir horaires'}
${desc ? `Routes/info: ${desc.substring(0, 200)}` : ''}

HELP WITH:
1. Search routes: departure → destination → date → available buses
2. Book ticket: select bus → choose seat → pay → get QR boarding pass
3. Schedules: view departure times, stops, duration
4. Track bus: live position during trip
5. QR boarding: show QR at gate → validated
6. Cancellation/refund policy
Suggest quick_replies: ["Voir les horaires", "Réserver un billet", "Vérifier mon billet QR", "Prix des billets"]`,

      hotel: `You are Yukpo Hôtel AI — accommodation booking assistant.
${base}${continuity}
HOTEL/MEUBLÉ: "${name}" | Tarif: ${price || 'selon chambre'}
${desc ? `Amenities/info: ${desc.substring(0, 300)}` : ''}
Rooms: ${productsList}

HELP WITH:
1. Room selection: browse types (standard, deluxe, suite) → filter by price/availability
2. Booking: choose dates → select room → pay → get confirmation
3. Check-in: QR code check-in available (no queue)
4. Amenities: list available facilities
5. Cancellation: explain policy
6. Payment: MoMo, Orange Money, Visa, cash on arrival
Suggest quick_replies: ["Voir les chambres", "Réserver une nuit", "Check-in QR", "Équipements disponibles"]`,

      restaurant: `You are Yukpo Restaurant AI — food & dining assistant.
${base}${continuity}
RESTAURANT: "${name}"
${desc ? `Cuisine/info: ${desc.substring(0, 300)}` : ''}
Menu/dishes: ${productsList}

HELP WITH:
1. Menu: browse dishes by category (entrées, plats, desserts, boissons)
2. Ordering: add to cart → choose type (sur place / à emporter / livraison) → confirm
3. Table reservation: ReserveTable modal → date/time/persons
4. Delivery: order sent to delivery system
5. Opening hours: view per day
6. Special instructions: add notes when ordering
Suggest quick_replies: ["Voir le menu", "Commander un plat", "Réserver une table", "Horaires d'ouverture"]`,

      livraison: `You are Yukpo Livraison AI — delivery assistant.
${base}${continuity}
DELIVERY SERVICE: "${name}" | Tarif: ${price || 'selon distance'}
${desc ? `Info: ${desc.substring(0, 200)}` : ''}

DELIVERY TYPES:
- DOCUMENT: Enveloppes légères, rapide
- STANDARD: Colis jusqu'à 30kg
- DÉMÉNAGEMENT: Gros objets, mobilier
- GÂTEAU/FRAGILE: Manipulation spéciale
- SHOPPING: Coursier fait vos courses en supermarché

FLOW: Create request → AI matches nearest courier → accept → real-time tracking → proof delivery photo
Payment: MoMo, Orange Money, cash on delivery
Suggest quick_replies: ["Envoyer un colis", "Faire mes courses", "Suivre une livraison", "Tarifs livraison"]`,

      supermarche: `You are Yukpo Supermarché AI — grocery shopping assistant.
${base}${continuity}
SUPERMARKET: "${name}"
${desc ? `Info: ${desc.substring(0, 200)}` : ''}
Products: ${productsList}

HELP WITH:
1. Browse catalog: search products → filter by category/price
2. Shopping delivery: compose basket → set budget → add delivery address → courier shops for you
3. Flash promos: current promotions and discounts
4. Availability: in-stock vs out-of-stock
5. Price comparison: BayamSelam feature for price comparison
6. Payment: MoMo, Orange Money, Visa, cash
Suggest quick_replies: ["Voir les produits", "Commander avec livraison", "Promotions en cours", "Comparer les prix"]`,

      emploi: `You are Yukpo Emploi AI — jobs and careers assistant.
${base}${continuity}
JOB/HR SERVICE: "${name}"
${desc ? `Info: ${desc.substring(0, 200)}` : ''}

HELP WITH:
1. Finding jobs: search by title/sector/location → filter → apply
2. AI CV analysis: upload CV → get score, strengths, improvement tips
3. AI salary prediction: title + sector + experience + city → salary estimate
4. Application: apply directly in app → track status
5. Training suggestions: for missing skills
6. Employer features: post offers, manage applications, AI candidate matching
Suggest quick_replies: ["Chercher un emploi", "Analyser mon CV (IA)", "Prédire mon salaire", "Postuler maintenant"]`,

      assurance: `You are Yukpo Assurance AI — insurance assistant.
${base}${continuity}
INSURANCE SERVICE: "${name}"
${desc ? `Info: ${desc.substring(0, 200)}` : ''}

HELP WITH:
1. Browse policies: view available insurance types
2. Get a quote: describe needs → AI calculates estimate
3. Declare a claim (sinistre): describe incident → upload photos → submit
4. Track claim: view status and updates
5. Policy management: view active policies
IMPORTANT: Always recommend reading full policy terms before signing
Suggest quick_replies: ["Obtenir un devis", "Déclarer un sinistre", "Mes polices", "Comment fonctionne l'assurance"]`,

      automobile: `You are Yukpo Automobile AI — car service assistant.
${base}${continuity}
GARAGE/AUTO SERVICE: "${name}" | Tarif: ${price || 'selon service'}
${desc ? `Services: ${desc.substring(0, 300)}` : ''}

HELP WITH:
1. Book appointment: describe problem → choose date → confirm
2. Services offered: list repairs, maintenance, diagnostics
3. Pricing: estimates for common repairs
4. Tracking: repair status updates
5. Warranty: explain any guarantees offered
6. Get directions to garage
Suggest quick_replies: ["Prendre RDV", "Services disponibles", "Tarif d'une réparation", "Itinéraire"]`,

      education: `You are Yukpo Éducation AI — school orientation and training assistant.
${base}${continuity}
EDUCATION SERVICE: "${name}"
${desc ? `Programs/info: ${desc.substring(0, 300)}` : ''}

HELP WITH:
1. Find programs: search by field/level → filter by score requirements
2. AI profile analysis: student profile → recommended programs
3. Compare schools: side-by-side comparison
4. Application process: explain steps, documents needed
5. Scholarships and funding: mention available options
6. Events: open days, orientation events
Suggest quick_replies: ["Chercher une école", "Analyser mon profil", "Comparer les établissements", "S'inscrire"]`,

      livre: `You are Yukpo Livre Scolaire AI — textbook exchange assistant.
${base}${continuity}
BOOKSTORE/LIBRAIRIE: "${name}"
${desc ? `Info: ${desc.substring(0, 200)}` : ''}
Books available: ${productsList}

HELP WITH:
1. Buy a book: search by title/author/level/class → buy directly
2. Sell a book: upload your book → AI estimates price → list it
3. Exchange (troc): find matching books → propose exchange → agree
4. Price comparison: compare across sellers
5. AI price estimation: book condition → suggested price
6. Classes supported: from CP to university level
Suggest quick_replies: ["Chercher un livre", "Vendre mon livre", "Faire un troc", "Prix estimé"]`,
    };

    const specializedPrompt = categoryBlocks[category];
    if (specializedPrompt) return specializedPrompt;

    // General service prompt
    return `You are the AI sales assistant for "${name || 'this service'}" on Yukpo, Africa's #1 super-app.
${base}${continuity}
SERVICE INFO:
- Name: ${name || 'N/A'}
- Category: ${service?.category || service?.categorie || 'general'}
- Price: ${price || 'Contact provider'}
- Description: ${desc ? desc.substring(0, 400) : 'N/A'}
- Products: ${productsList}

CHAT FEATURES YOU CAN GUIDE USERS TO:
- 💬 Text/photos/files/voice messages
- 💰 Price negotiation (tap Negotiate button)
- 📞 Free audio/video calls (in-app)
- 🚚 Delivery ordering
- ⭐ Leave reviews
- 📍 Get directions

RULES:
- Be CONCISE (2-4 sentences), then suggest quick actions
- Always suggest 2-3 relevant quick replies
- Anticipate logical next questions
- NEVER say you can't help — always guide toward an action
Suggest quick_replies: ["Présenter ce service", "Voir les produits", "Négocier le prix", "Passer commande"]`;
  }

  // ─── Émotion ───────────────────────────────────────────────────────────────

  private detectEmotion(text: string): 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'correction' | 'neutral' {
    const q = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const kw: Record<string, string[]> = {
      correction: ['non', 'pas ca', 'ce nest pas', 'faux', 'erreur', 'trompe', 'wrong', 'incorrect', 'mistake'],
      frustration: ['frustre', 'enerve', 'marre', 'ras le bol', 'ca marche pas', 'nul', 'horrible', 'impossible'],
      gratitude: ['merci', 'bravo', 'genial', 'parfait', 'excellent', 'top', 'nickel', 'thank', 'awesome', 'great'],
      confusion: ['je comprends pas', 'pas clair', 'comment faire', 'perdu', 'expliquez', 'confused', 'unclear'],
      excitement: ['wow', 'incroyable', 'trop bien', 'amazing', 'fantastic', 'dingue', 'wahou'],
    };
    let best: 'frustration' | 'gratitude' | 'confusion' | 'excitement' | 'correction' | 'neutral' = 'neutral';
    let bestN = 0;
    for (const [emo, words] of Object.entries(kw)) {
      const n = words.filter(w => q.includes(w)).length;
      if (n > bestN) { bestN = n; best = emo as any; }
    }
    return best;
  }

  private emotionalPrefix(emotion: string, lang: string): string {
    if (emotion === 'neutral') return '';
    const fr: Record<string, string[]> = {
      correction: ['Toutes mes excuses, vous avez raison. ', 'Au temps pour moi. ', 'Merci de me corriger. '],
      frustration: ['Je comprends votre frustration, désolé. ', 'Pardon pour la confusion. Reprenons. ', 'Je m\'excuse, simplifions. '],
      gratitude: ['Merci beaucoup ! 😊 ', 'C\'est un plaisir ! ', 'Ravi d\'aider ! '],
      confusion: ['Pas de souci, je réexplique. ', 'Laissez-moi clarifier. ', 'Bonne question ! '],
      excitement: ['Super, content que ça vous plaise ! 🎉 ', 'Génial n\'est-ce pas ! ', 'Oui c\'est top ! '],
    };
    const en: Record<string, string[]> = {
      correction: ['My apologies, you\'re right. ', 'My mistake. ', 'Thanks for the correction. '],
      frustration: ['I understand your frustration, sorry. ', 'Apologies for the confusion. Let\'s retry. '],
      gratitude: ['Thank you! 😊 ', 'Happy to help! ', 'Glad I could assist! '],
      confusion: ['No worries, let me re-explain. ', 'Let me clarify. ', 'Great question! '],
      excitement: ['Awesome, glad you like it! 🎉 ', 'Amazing right?! '],
    };
    const pool = (lang === 'en' ? en : fr)[emotion] || [];
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : '';
  }

  // ─── Welcome message par catégorie ─────────────────────────────────────────

  getWelcomeConfig(service: any, lang: string): {
    message: string;
    quickReplies: string[];
    icons: IconReference[];
  } {
    const name = this.getServiceName(service) || 'ce service';
    const category = this.detectServiceCategory(service);

    const configs: Partial<Record<ServiceCategory, { message: string; quickReplies: string[]; icons: IconReference[] }>> = {
      pharmacie: {
        message: lang === 'en'
          ? `👋 Hello! I'm your Yukpo Pharmacy AI for **${name}**. I can help you find medications, check availability, understand your prescription, or guide you to the nearest pharmacy on duty.`
          : `👋 Bonjour ! Je suis votre assistant IA pour la pharmacie **${name}**. Je peux vous aider à trouver vos médicaments, vérifier leur disponibilité, analyser votre ordonnance, ou trouver la pharmacie de garde la plus proche.`,
        quickReplies: ['Trouver un médicament', 'Pharmacie de garde', 'Analyser mon ordonnance', 'Commander'],
        icons: [
          { icon: 'activity', label: 'Santé', color: '#10b981' },
          { icon: 'package', label: 'Médicaments', color: '#6366f1' },
        ],
      },
      hopital: {
        message: lang === 'en'
          ? `👋 Hello! I'm your Yukpo Health AI for **${name}**. I can help you book an appointment, find the right specialist, or guide you through available health services.`
          : `👋 Bonjour ! Je suis votre assistant santé pour **${name}**. Je peux vous aider à prendre rendez-vous, trouver le bon spécialiste, ou vous orienter vers les services disponibles.`,
        quickReplies: ['Prendre RDV', 'Trouver un spécialiste', 'Urgences', 'Services disponibles'],
        icons: [
          { icon: 'heart', label: 'Santé', color: '#ef4444' },
          { icon: 'calendar', label: 'RDV', color: '#6366f1' },
        ],
      },
      taxi: {
        message: lang === 'en'
          ? `🚕 Hey! I'm your Yukpo ride assistant for **${name}**. Tell me where you're going and I'll help you book a ride, estimate the price, or track your driver.`
          : `🚕 Bonjour ! Je suis votre assistant course pour **${name}**. Dites-moi où vous allez et je vous aide à réserver, estimer le prix ou suivre votre chauffeur.`,
        quickReplies: ['Réserver maintenant', 'Estimer le prix', 'Suivre mon chauffeur', 'Contacter le prestataire'],
        icons: [
          { icon: 'map-pin', label: 'Trajet', color: '#f59e0b' },
          { icon: 'navigation', label: 'Navigation', color: '#6366f1' },
        ],
      },
      hotel: {
        message: lang === 'en'
          ? `🏨 Hello! I'm your Yukpo accommodation AI for **${name}**. I can help you choose a room, check availability, book with QR check-in, or answer questions about amenities.`
          : `🏨 Bonjour ! Je suis votre assistant hébergement pour **${name}**. Je peux vous aider à choisir une chambre, vérifier les disponibilités, réserver avec check-in QR, ou répondre à vos questions.`,
        quickReplies: ['Voir les chambres', 'Réserver', 'Équipements disponibles', 'Check-in QR'],
        icons: [
          { icon: 'home', label: 'Chambres', color: '#8b5cf6' },
          { icon: 'star', label: 'Services', color: '#f59e0b' },
        ],
      },
      restaurant: {
        message: lang === 'en'
          ? `🍽️ Hello! I'm your food AI for **${name}**. I can help you browse the menu, order a dish, reserve a table, or check opening hours.`
          : `🍽️ Bonjour ! Je suis votre assistant culinaire pour **${name}**. Je peux vous présenter le menu, vous aider à commander, réserver une table ou vérifier les horaires.`,
        quickReplies: ['Voir le menu', 'Commander', 'Réserver une table', 'Horaires'],
        icons: [
          { icon: 'coffee', label: 'Menu', color: '#f59e0b' },
          { icon: 'clock', label: 'Horaires', color: '#6366f1' },
        ],
      },
      livraison: {
        message: lang === 'en'
          ? `📦 Hello! I'm your Yukpo delivery AI for **${name}**. I can help you send a parcel, track a delivery, calculate fees, or order your groceries delivered.`
          : `📦 Bonjour ! Je suis votre assistant livraison pour **${name}**. Je peux vous aider à envoyer un colis, suivre une livraison, calculer les frais ou commander vos courses.`,
        quickReplies: ['Envoyer un colis', 'Suivre ma livraison', 'Faire mes courses', 'Tarifs'],
        icons: [
          { icon: 'truck', label: 'Livraison', color: '#10b981' },
          { icon: 'map-pin', label: 'Suivi', color: '#3b82f6' },
        ],
      },
      supermarche: {
        message: lang === 'en'
          ? `🛒 Hello! I'm your shopping AI for **${name}**. Tell me what you need and I'll help you find products, check prices, or order for delivery.`
          : `🛒 Bonjour ! Je suis votre assistant courses pour **${name}**. Dites-moi ce dont vous avez besoin et je vous aide à trouver les produits, comparer les prix ou commander en livraison.`,
        quickReplies: ['Voir les produits', 'Commander en livraison', 'Promotions', 'Comparer les prix'],
        icons: [
          { icon: 'shopping-cart', label: 'Courses', color: '#10b981' },
          { icon: 'tag', label: 'Promos', color: '#f59e0b' },
        ],
      },
      emploi: {
        message: lang === 'en'
          ? `💼 Hello! I'm your Yukpo careers AI. I can help you search for jobs, analyse your CV with AI, predict your salary, or guide you through applying.`
          : `💼 Bonjour ! Je suis votre assistant emploi Yukpo. Je peux vous aider à chercher un poste, analyser votre CV avec l'IA, prédire votre salaire ou vous guider dans votre candidature.`,
        quickReplies: ['Chercher un emploi', 'Analyser mon CV', 'Prédire mon salaire', 'Postuler'],
        icons: [
          { icon: 'briefcase', label: 'Emploi', color: '#6366f1' },
          { icon: 'trending-up', label: 'Carrière', color: '#10b981' },
        ],
      },
      covoiturage: {
        message: lang === 'en'
          ? `🚗 Hello! I'm your Yukpo carpooling AI. I can help you find a ride, offer one, or manage your reservations.`
          : `🚗 Bonjour ! Je suis votre assistant covoiturage Yukpo. Je peux vous aider à trouver un trajet, en proposer un, ou gérer vos réservations.`,
        quickReplies: ['Trouver un trajet', 'Proposer un trajet', 'Mes réservations', 'Comment ça marche'],
        icons: [
          { icon: 'users', label: 'Covoiturage', color: '#3b82f6' },
          { icon: 'map', label: 'Trajets', color: '#f59e0b' },
        ],
      },
      bus: {
        message: lang === 'en'
          ? `🚌 Hello! I'm your Yukpo travel assistant. I can help you search routes, book tickets, or check your boarding pass.`
          : `🚌 Bonjour ! Je suis votre assistant voyage Yukpo. Je peux vous aider à chercher des trajets, réserver des billets ou vérifier votre carte d'embarquement.`,
        quickReplies: ['Voir les horaires', 'Réserver un billet', 'Mon billet QR', 'Tarifs'],
        icons: [
          { icon: 'navigation', label: 'Voyage', color: '#3b82f6' },
          { icon: 'ticket', label: 'Billets', color: '#6366f1' },
        ],
      },
      assurance: {
        message: lang === 'en'
          ? `🛡️ Hello! I'm your Yukpo insurance AI for **${name}**. I can help you get a quote, declare a claim, or manage your policies.`
          : `🛡️ Bonjour ! Je suis votre assistant assurance pour **${name}**. Je peux vous aider à obtenir un devis, déclarer un sinistre ou gérer vos polices.`,
        quickReplies: ['Obtenir un devis', 'Déclarer un sinistre', 'Mes polices', 'Comment ça marche'],
        icons: [
          { icon: 'shield', label: 'Assurance', color: '#6366f1' },
          { icon: 'file-text', label: 'Police', color: '#10b981' },
        ],
      },
      automobile: {
        message: lang === 'en'
          ? `🔧 Hello! I'm your Yukpo auto service AI for **${name}**. I can help you book a repair appointment, check services or get directions to the garage.`
          : `🔧 Bonjour ! Je suis votre assistant garage pour **${name}**. Je peux vous aider à prendre un rendez-vous, voir les services disponibles ou trouver l'itinéraire.`,
        quickReplies: ['Prendre RDV', 'Services disponibles', 'Itinéraire', 'Tarif réparation'],
        icons: [
          { icon: 'tool', label: 'Réparation', color: '#f59e0b' },
          { icon: 'map-pin', label: 'Localiser', color: '#ef4444' },
        ],
      },
      immobilier: {
        message: lang === 'en'
          ? `🏠 Hello! I'm your Yukpo real estate AI. I can help you search properties, get price estimates, or set up price alerts.`
          : `🏠 Bonjour ! Je suis votre assistant immobilier Yukpo. Je peux vous aider à chercher un bien, obtenir une estimation de prix ou créer des alertes prix.`,
        quickReplies: ['Chercher un bien', 'Estimer un prix', 'Créer une alerte', 'Comparer des biens'],
        icons: [
          { icon: 'home', label: 'Immobilier', color: '#8b5cf6' },
          { icon: 'trending-up', label: 'Prix', color: '#10b981' },
        ],
      },
      education: {
        message: lang === 'en'
          ? `🎓 Hello! I'm your Yukpo education AI for **${name}**. I can help you find programs, analyse your student profile, or compare schools.`
          : `🎓 Bonjour ! Je suis votre assistant éducation pour **${name}**. Je peux vous aider à trouver des programmes, analyser votre profil étudiant ou comparer des établissements.`,
        quickReplies: ['Chercher une école', 'Analyser mon profil', 'Comparer', 'S\'inscrire'],
        icons: [
          { icon: 'book-open', label: 'Éducation', color: '#6366f1' },
          { icon: 'award', label: 'Diplômes', color: '#f59e0b' },
        ],
      },
      livre: {
        message: lang === 'en'
          ? `📚 Hello! I'm your Yukpo bookstore AI for **${name}**. I can help you find a textbook, estimate your selling price, or set up an exchange.`
          : `📚 Bonjour ! Je suis votre assistant librairie pour **${name}**. Je peux vous aider à trouver un livre scolaire, estimer son prix de revente ou organiser un troc.`,
        quickReplies: ['Chercher un livre', 'Vendre mon livre', 'Organiser un troc', 'Prix estimé'],
        icons: [
          { icon: 'book', label: 'Livres', color: '#8b5cf6' },
          { icon: 'refresh-cw', label: 'Troc', color: '#10b981' },
        ],
      },
    };

    const config = configs[category];
    if (config) return config;

    // General fallback
    return {
      message: t('intelligentChat.welcomeChat', { name }) ||
        `👋 Bonjour ! Je suis votre assistant IA pour **${name}**. Je connais ce service, ses produits et ses tarifs. Comment puis-je vous aider ?`,
      quickReplies: [
        t('chatbot.describeService') || 'Présenter ce service',
        t('chatbot.seeProducts') || 'Voir les produits',
        t('chatbot.negotiatePrice') || 'Négocier le prix',
        t('chatbot.chatFeatures') || 'Fonctionnalités du chat',
      ],
      icons: [
        { icon: 'info', label: t('chatbot.details') || 'Détails', color: '#6366f1' },
        { icon: 'message-circle', label: t('chatbot.contact') || 'Contact', color: '#10b981' },
      ],
    };
  }

  // ─── Appel backend ──────────────────────────────────────────────────────────

  async generateChatbotResponse(
    query: string,
    service: any,
    recentMessages: any[] = [],
    lang?: string,
  ): Promise<ChatbotResponse> {
    const activeLang = lang || i18n.language || 'fr';
    const category = this.detectServiceCategory(service);
    const serviceName = this.getServiceName(service);
    const servicePrice = this.getServicePrice(service);
    const serviceDesc = this.getServiceDescription(service);
    const products = this.getProducts(service);
    const productsSummary = products.slice(0, 6).map((p: any) =>
      `${p.nom || p.name || '?'}${p.prix ? ` (${p.prix} XAF)` : ''}`
    ).join(', ');

    const emotion = this.detectEmotion(query);
    const prefix = this.emotionalPrefix(emotion, activeLang);
    const contextualMessage = prefix
      ? `[ASSISTANT_TONE_PREFIX: ${prefix.trim()}]\n${query}`
      : query;

    try {
      const res = await apiPost<any>('/ai/chat', {
        message: contextualMessage,
        context: {
          mode: 'chatbot_service',
          category: service?.category || service?.categorie || category,
          service_name: serviceName,
          service_price: servicePrice,
          service_description: serviceDesc?.substring(0, 300),
          products_summary: productsSummary,
          products_count: products.length,
          recent_messages: recentMessages.slice(-8).map((m: any) => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text || m.content || '',
          })),
          system_prompt: this.buildCategoryPrompt(category, service, activeLang, recentMessages.length),
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
      return this.localFallback(query, service, activeLang, category);
    } catch {
      return this.localFallback(query, service, activeLang, category);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private getServiceName(s: any): string {
    if (!s) return '';
    return s.nom || s.name || s.titre || s.title ||
      s.data?.titre_service?.valeur || s.data?.titre_service || '';
  }

  private getServicePrice(s: any): string {
    if (!s) return '';
    const p = s.prix || s.price || s.tarif || s.amount ||
      s.data?.prix?.valeur || s.data?.prix;
    if (!p) return '';
    return typeof p === 'number' ? `${p} XAF` : String(p);
  }

  private getServiceDescription(s: any): string {
    if (!s) return '';
    return s.description || s.desc || s.details ||
      s.data?.description?.valeur || s.data?.description || '';
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
      return `• ${name}${price ? ` — ${price} XAF` : ''}`;
    });
    return lines.join('\n') + (products.length > 5 ? `\n...et ${products.length - 5} autres` : '');
  }

  // ─── Fallback local enrichi par catégorie ───────────────────────────────────

  private localFallback(query: string, service: any, lang: string, category: ServiceCategory): ChatbotResponse {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const name = this.getServiceName(service);
    const price = this.getServicePrice(service);
    const desc = this.getServiceDescription(service);
    const productsSummary = this.getProductsSummary(service);
    const match = (kws: string[]) => kws.some(k => q.includes(k));

    const emotion = this.detectEmotion(query);
    const prefix = this.emotionalPrefix(emotion, lang);
    const prefixMsg = (msg: string) => prefix ? prefix + msg : msg;

    // Greetings
    if (match(['bonjour', 'bonsoir', 'salut', 'hello', 'hi ', 'hey', 'hola', 'jambo', 'sannu', 'sawubona'])) {
      const welcome = this.getWelcomeConfig(service, lang);
      return { message: prefixMsg(welcome.message), icons: welcome.icons, quickReplies: welcome.quickReplies };
    }

    // Yukpo general
    if (match(['yukpo', 'application', 'app', 'fonctionnalit', 'feature', 'quoi faire', 'what can'])) {
      return {
        message: prefixMsg(t('chatbot.yukpoInChat') ||
          '🚀 Yukpo est la super-app africaine ! En plus de ce chat, vous pouvez : négocier les prix, commander avec livraison, passer des appels gratuits, laisser des avis et accéder à des dizaines de services (santé, transport, emploi, GPS…)'),
        icons: [
          { icon: 'sparkles', label: 'Yukpo', color: '#6366f1' },
          { icon: 'zap', label: 'Fonctionnalités', color: '#f59e0b' },
        ],
        quickReplies: ['Fonctionnalités du chat', 'À propos de ce service', 'Voir les produits'],
      };
    }

    // Products
    if (match(['produit', 'product', 'article', 'item', 'catalogue', 'stock', 'quoi vend', 'what do you sell'])) {
      if (productsSummary) {
        return {
          message: prefixMsg(t('chatbot.productsAvailable', { name, list: productsSummary }) ||
            `Voici ce que propose **${name}** :\n\n${productsSummary}`),
          icons: [
            { icon: 'package', label: 'Produits', color: '#6366f1' },
            { icon: 'truck', label: 'Livraison', color: '#10b981' },
          ],
          quickReplies: ['Commander', 'Négocier le prix', 'Livraison disponible ?'],
          nextSteps: ['Quel est le délai de livraison ?', 'Puis-je négocier le prix ?'],
        };
      }
      return {
        message: prefixMsg(`${name} n'a pas encore de catalogue listé ici. Envoyez un message au prestataire directement pour connaître sa gamme de produits.`),
        icons: [{ icon: 'message-circle', label: 'Contact', color: '#6366f1' }],
        quickReplies: ['Contacter le prestataire', 'Fonctionnalités du chat'],
      };
    }

    // Price
    if (match(['prix', 'price', 'tarif', 'cout', 'combien', 'how much', 'nkap', 'wari'])) {
      const priceInfo = price
        ? `Le tarif de **${name}** est de **${price}**.`
        : `${name} n'affiche pas encore ses tarifs ici. Vous pouvez demander directement ou négocier.`;
      return {
        message: prefixMsg(`${priceInfo}\n\n💡 La négociation de prix est disponible — tapez sur le bouton Négocier !`),
        icons: [
          { icon: 'tag', label: 'Négocier', color: '#f59e0b' },
          { icon: 'credit-card', label: 'Paiement', color: '#6366f1' },
        ],
        quickReplies: ['Négocier le prix', 'Modes de paiement', productsSummary ? 'Voir les produits' : 'Contacter'].filter(Boolean),
        nextSteps: ['Comment commander ?', 'Livraison disponible ?'],
      };
    }

    // Negotiation
    if (match(['negoci', 'negoti', 'rabais', 'discount', 'marchander', 'bargain', 'reduire'])) {
      return {
        message: prefixMsg('Pour négocier le prix :\n1️⃣ Tapez l\'icône **💰 Négocier** dans le chat\n2️⃣ Entrez votre prix proposé\n3️⃣ Le prestataire accepte, refuse ou contre-propose\n4️⃣ Une fois accepté, le prix est mis à jour pour votre commande !'),
        icons: [{ icon: 'tag', label: 'Négocier', color: '#f59e0b' }],
        quickReplies: ['Prix actuel', 'Comment commander', 'Contacter le prestataire'],
      };
    }

    // Calls
    if (match(['appel', 'call', 'telephone', 'phone', 'video', 'audio', 'waya', 'fonou'])) {
      return {
        message: prefixMsg('📞 Les appels sont **gratuits et intégrés** dans Yukpo !\n• Appel audio : tapez l\'icône téléphone en haut\n• Appel vidéo : maintenez l\'icône téléphone\nPas besoin de numéro — fonctionne directement via l\'app.'),
        icons: [
          { icon: 'phone', label: 'Appel audio', color: '#10b981' },
          { icon: 'video', label: 'Appel vidéo', color: '#3b82f6' },
        ],
        quickReplies: ['Appeler maintenant', 'Envoyer un message'],
      };
    }

    // Delivery
    if (match(['livr', 'deliver', 'command', 'order', 'envoi', 'colis', 'ship'])) {
      return {
        message: prefixMsg('🚚 Pour commander avec livraison :\n1️⃣ Tapez l\'icône **grille** pour voir les produits\n2️⃣ Sélectionnez un produit\n3️⃣ Tapez **Commander avec livraison**\n4️⃣ Entrez votre adresse\n5️⃣ Confirmez — un coursier est automatiquement assigné !'),
        icons: [
          { icon: 'truck', label: 'Livraison', color: '#10b981' },
          { icon: 'map-pin', label: 'Suivi', color: '#3b82f6' },
        ],
        quickReplies: ['Voir les produits', 'Frais de livraison', 'Temps de livraison'],
        suggestedActions: [
          { id: 'delivery', label: '🚚 Livraison Yukpo', icon: 'truck', route: 'DeliveryHome', category: 'navigation' },
        ],
      };
    }

    // Payment
    if (match(['paiement', 'payment', 'payer', 'pay', 'momo', 'orange money', 'carte', 'credit', 'sisan'])) {
      return {
        message: prefixMsg('💳 Modes de paiement acceptés sur Yukpo :\n• **MTN MoMo** — numéro → confirmation USSD\n• **Orange Money** — numéro → confirmation USSD\n• **Visa/Mastercard** — saisie carte → 3DS\n• **Livraison contre paiement** — payer à la réception\nToutes les transactions sont sécurisées.'),
        icons: [
          { icon: 'credit-card', label: 'Carte', color: '#6366f1' },
          { icon: 'smartphone', label: 'Mobile Money', color: '#f59e0b' },
        ],
        quickReplies: ['Comment payer', 'Paiement sécurisé'],
      };
    }

    // Location / directions
    if (match(['localis', 'locat', 'itineraire', 'direction', 'adresse', 'address', 'where is', 'gps', 'map'])) {
      return {
        message: prefixMsg('📍 Pour trouver **' + (name || 'ce prestataire') + '** :\n1. Tapez l\'icône **carte** dans le chat\n2. Ou allez dans la Navigation Yukpo GPS\n3. Saisissez le nom du prestataire\n4. Obtenez l\'itinéraire en temps réel (voiture, marche, vélo)'),
        icons: [
          { icon: 'map-pin', label: 'Localiser', color: '#ef4444' },
          { icon: 'navigation', label: 'Itinéraire', color: '#3b82f6' },
        ],
        quickReplies: ['Voir sur la carte', 'Calculer la distance'],
        suggestedActions: [
          { id: 'navigation', label: '🗺️ GPS Navigation', icon: 'navigation', route: 'Navigation', category: 'navigation' },
        ],
      };
    }

    // ─── Category-aware default — répond selon le type de service ────────────
    const categoryDefaults: Partial<Record<ServiceCategory, ChatbotResponse>> = {
      pharmacie: {
        message: prefixMsg(`💊 **${name}** est là pour vous aider !\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}Voici ce que je peux faire pour vous :\n• 🔍 Trouver un médicament et vérifier sa disponibilité\n• 🌙 Localiser la pharmacie de garde la plus proche\n• 📋 Analyser votre ordonnance (photo)\n• 💳 Commander et payer (MoMo, Orange Money, Visa)`),
        icons: [{ icon: 'activity', label: 'Santé', color: '#10b981' }, { icon: 'package', label: 'Médicaments', color: '#6366f1' }],
        quickReplies: ['Trouver un médicament', 'Pharmacie de garde', 'Analyser ordonnance', 'Commander'],
      },
      hopital: {
        message: prefixMsg(`🏥 **${name}** — votre santé est notre priorité.\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}Je peux vous aider à :\n• 📅 Prendre rendez-vous avec le bon spécialiste\n• 🤖 Analyser vos symptômes (IA) pour recommander une spécialité\n• 🚨 Trouver les urgences les plus proches\n• 📂 Accéder à vos résultats d'examens`),
        icons: [{ icon: 'heart', label: 'Santé', color: '#ef4444' }, { icon: 'calendar', label: 'RDV', color: '#6366f1' }],
        quickReplies: ['Prendre RDV', 'Trouver un spécialiste', 'Urgences proches', 'Résultats examens'],
      },
      taxi: {
        message: prefixMsg(`🚕 **${name}** — prêt à vous conduire !\n\n${price ? `Tarif indicatif : **${price}**\n\n` : ''}Voici comment ça marche :\n1️⃣ Définissez votre adresse de départ\n2️⃣ Entrez votre destination\n3️⃣ Le chauffeur accepte en quelques secondes\n4️⃣ Suivez-le en temps réel sur la carte\n5️⃣ Payez à l'arrivée (MoMo, cash)`),
        icons: [{ icon: 'map-pin', label: 'Trajet', color: '#f59e0b' }, { icon: 'navigation', label: 'Suivi', color: '#6366f1' }],
        quickReplies: ['Réserver maintenant', 'Estimer le prix', 'Suivre mon chauffeur', 'Contacter le prestataire'],
      },
      covoiturage: {
        message: prefixMsg(`🚗 **${name}** — covoiturez et économisez !\n\nDeux options s'offrent à vous :\n\n🔍 **Trouver un trajet** : entrez départ + destination + date → parcourez les annonces disponibles\n📢 **Proposer un trajet** : indiquez votre itinéraire + places disponibles + prix → les passagers vous contactent`),
        icons: [{ icon: 'users', label: 'Covoiturage', color: '#3b82f6' }, { icon: 'map', label: 'Trajets', color: '#f59e0b' }],
        quickReplies: ['Trouver un trajet', 'Proposer un trajet', 'Mes réservations', 'Comment ça marche'],
      },
      bus: {
        message: prefixMsg(`🚌 **${name}** — voyagez sereinement !\n\n${desc ? desc.substring(0, 120) + '\n\n' : ''}Je peux vous aider à :\n• 🗓️ Consulter les horaires de départ\n• 🎫 Réserver et payer votre billet (QR code embarquement)\n• 📍 Suivre le bus en temps réel\n• ❌ Comprendre la politique d'annulation`),
        icons: [{ icon: 'navigation', label: 'Voyage', color: '#3b82f6' }, { icon: 'ticket', label: 'Billets', color: '#6366f1' }],
        quickReplies: ['Voir les horaires', 'Réserver un billet', 'Mon billet QR', 'Suivi bus'],
      },
      hotel: {
        message: prefixMsg(`🏨 **${name}** — bienvenue !\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}${productsSummary ? `Chambres disponibles :\n${productsSummary}\n\n` : ''}✨ Fonctionnalités exclusives :\n• ✅ Check-in QR (sans file d'attente !)\n• 📅 Réservez en 2 minutes\n• 💳 Payez MoMo, Visa ou à l'arrivée`),
        icons: [{ icon: 'home', label: 'Chambres', color: '#8b5cf6' }, { icon: 'star', label: 'Services', color: '#f59e0b' }],
        quickReplies: ['Voir les chambres', 'Réserver', 'Check-in QR', 'Équipements'],
      },
      restaurant: {
        message: prefixMsg(`🍽️ **${name}** — bon appétit !\n\n${productsSummary ? `Au menu :\n${productsSummary}\n\n` : desc ? desc.substring(0, 150) + '\n\n' : ''}Je peux vous aider à :\n• 📖 Parcourir le menu complet\n• 🛵 Commander en livraison\n• 🪑 Réserver une table\n• ⏰ Vérifier les horaires d'ouverture`),
        icons: [{ icon: 'coffee', label: 'Menu', color: '#f59e0b' }, { icon: 'clock', label: 'Horaires', color: '#6366f1' }],
        quickReplies: ['Voir le menu', 'Commander', 'Réserver une table', 'Horaires'],
      },
      livraison: {
        message: prefixMsg(`📦 **${name}** — vos colis livrés rapidement !\n\n${price ? `Tarif : **${price}**\n\n` : ''}Types de livraison disponibles :\n• 📄 Document/enveloppe\n• 📦 Colis standard (jusqu'à 30 kg)\n• 🛒 Shopping (le coursier fait vos courses)\n• 🎂 Fragile (manipulation spéciale)\n\nLe coursier le plus proche est automatiquement assigné.`),
        icons: [{ icon: 'truck', label: 'Livraison', color: '#10b981' }, { icon: 'map-pin', label: 'Suivi', color: '#3b82f6' }],
        quickReplies: ['Envoyer un colis', 'Faire mes courses', 'Suivre ma livraison', 'Tarifs livraison'],
      },
      supermarche: {
        message: prefixMsg(`🛒 **${name}** — vos courses livrées !\n\n${productsSummary ? `Produits disponibles :\n${productsSummary}\n\n` : ''}Comment commander :\n1️⃣ Composez votre panier (produits + budget)\n2️⃣ Ajoutez votre adresse de livraison\n3️⃣ Un coursier fait vos courses et vous livre\n\n🏷️ Consultez les promos et comparez les prix avec BayamSelam !`),
        icons: [{ icon: 'shopping-cart', label: 'Courses', color: '#10b981' }, { icon: 'tag', label: 'Promos', color: '#f59e0b' }],
        quickReplies: ['Voir les produits', 'Commander avec livraison', 'Promotions en cours', 'Comparer les prix'],
      },
      emploi: {
        message: prefixMsg(`💼 **${name}** — accélérez votre carrière !\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}Fonctionnalités IA disponibles :\n• 📄 **Analyse CV** : uploadez → score + points forts + axes d'amélioration\n• 💰 **Prédiction salaire** : poste + secteur + ville + expérience → estimation\n• 🔍 Recherche d'offres : filtrez par secteur, lieu, type de contrat\n• 📬 Candidature directe depuis l'app`),
        icons: [{ icon: 'briefcase', label: 'Emploi', color: '#6366f1' }, { icon: 'trending-up', label: 'Carrière', color: '#10b981' }],
        quickReplies: ['Chercher un emploi', 'Analyser mon CV (IA)', 'Prédire mon salaire', 'Postuler maintenant'],
      },
      assurance: {
        message: prefixMsg(`🛡️ **${name}** — protégez ce qui compte !\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}Je peux vous aider à :\n• 💬 Obtenir un devis personnalisé\n• 🚨 Déclarer un sinistre (photos + description)\n• 📋 Consulter vos polices actives\n• 📊 Suivre le statut de votre dossier\n\n⚠️ Pensez à lire les conditions générales avant de signer.`),
        icons: [{ icon: 'shield', label: 'Assurance', color: '#6366f1' }, { icon: 'file-text', label: 'Police', color: '#10b981' }],
        quickReplies: ['Obtenir un devis', 'Déclarer un sinistre', 'Mes polices', 'Suivre mon dossier'],
      },
      automobile: {
        message: prefixMsg(`🔧 **${name}** — votre garage de confiance !\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}${price ? `Tarif indicatif : **${price}**\n\n` : ''}Je peux vous aider à :\n• 📅 Prendre un rendez-vous de réparation\n• 🛠️ Consulter les services disponibles (vidange, freins, diagnostic…)\n• 💰 Obtenir un devis pour une réparation\n• 📍 Obtenir l'itinéraire vers le garage`),
        icons: [{ icon: 'tool', label: 'Réparation', color: '#f59e0b' }, { icon: 'map-pin', label: 'Localiser', color: '#ef4444' }],
        quickReplies: ['Prendre RDV', 'Services disponibles', 'Tarif réparation', 'Itinéraire'],
      },
      education: {
        message: prefixMsg(`🎓 **${name}** — construisez votre avenir !\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}Fonctionnalités IA d'orientation :\n• 🤖 **Analyse de profil** : notes + intérêts → programmes recommandés\n• 🏫 Chercher par filière, niveau, localisation\n• 📊 Comparer des établissements côte à côte\n• 📝 Comprendre les étapes d'inscription`),
        icons: [{ icon: 'book-open', label: 'Éducation', color: '#6366f1' }, { icon: 'award', label: 'Diplômes', color: '#f59e0b' }],
        quickReplies: ['Chercher une école', 'Analyser mon profil', 'Comparer les établissements', 'S\'inscrire'],
      },
      livre: {
        message: prefixMsg(`📚 **${name}** — trouvez votre livre scolaire !\n\n${productsSummary ? `Livres disponibles :\n${productsSummary}\n\n` : ''}Options disponibles :\n• 🛒 **Acheter** : trouvez par titre, auteur, niveau ou classe\n• 💰 **Vendre** : l'IA estime le prix selon l'état du livre\n• 🔄 **Troc** : échangez un livre contre un autre\n• 📊 Comparez les prix entre vendeurs`),
        icons: [{ icon: 'book', label: 'Livres', color: '#8b5cf6' }, { icon: 'refresh-cw', label: 'Troc', color: '#10b981' }],
        quickReplies: ['Chercher un livre', 'Vendre mon livre', 'Organiser un troc', 'Prix estimé (IA)'],
      },
      immobilier: {
        message: prefixMsg(`🏠 **${name}** — trouvez le bien idéal !\n\n${desc ? desc.substring(0, 150) + '\n\n' : ''}Je peux vous aider à :\n• 🔍 Chercher : appartements, maisons, terrains, meublés\n• 💰 **Estimer le prix** d'un bien selon l'IA\n• 🔔 Créer des **alertes prix** (notifié dès qu'un bien correspond)\n• 📊 Comparer jusqu'à 5 biens simultanément`),
        icons: [{ icon: 'home', label: 'Immobilier', color: '#8b5cf6' }, { icon: 'trending-up', label: 'Prix IA', color: '#10b981' }],
        quickReplies: ['Chercher un bien', 'Estimer un prix', 'Créer une alerte', 'Comparer des biens'],
      },
    };

    const categoryResponse = categoryDefaults[category];
    if (categoryResponse) return categoryResponse;

    // Fallback générique final — use desc/price/products si disponibles
    const parts: string[] = [];
    if (desc) parts.push(desc.substring(0, 200));
    if (price) parts.push(`💰 Tarif : **${price}**`);
    if (productsSummary) parts.push(`📦 Catalogue :\n${productsSummary}`);

    const welcome = this.getWelcomeConfig(service, lang);
    return {
      message: prefixMsg(parts.length > 0
        ? `Voici ce que je sais sur **${name || 'ce service'}** :\n\n${parts.join('\n\n')}\n\nComment puis-je vous aider davantage ?`
        : welcome.message),
      icons: welcome.icons,
      quickReplies: welcome.quickReplies,
      nextSteps: [
        t('chatbot.askAboutProducts') || 'Quels produits sont disponibles ?',
        t('chatbot.askAboutPrice') || 'Quel est le prix ?',
        t('chatbot.askHowToOrder') || 'Comment commander ?',
      ],
    };
  }
}

export const chatbotIntelligentService = new ChatbotIntelligentService();
export default chatbotIntelligentService;
