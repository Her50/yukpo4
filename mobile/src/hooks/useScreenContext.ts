// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';

export interface ActionDescriptor {
  id: string;
  label: string;
  icon: string;
  route?: string;
  params?: any;
  category: 'navigation' | 'action' | 'creation' | 'help' | 'search';
  description?: string;
  screenTarget?: string;
}

export interface UIElement {
  id: string;
  type: 'button' | 'input' | 'card' | 'tab' | 'modal' | 'fab';
  label: string;
  icon?: string;
  position?: { x: number; y: number };
  actionable: boolean;
  route?: string;
  params?: any;
}

export interface ScreenContext {
  screenName: string;
  screenType: 'home' | 'search' | 'form' | 'detail' | 'dashboard' | 'chat' | 'list' | 'specialized';
  availableActions: ActionDescriptor[];
  visibleElements: UIElement[];
  userData: any;
  serviceData?: any;
  currentRoute?: string;
  breadcrumbs?: string[];
  previousScreen?: string;
  guideText?: string;
}

const LUCIDE_ICONS: Record<string, string> = {
  'home': 'home',
  'search': 'search',
  'menu': 'menu',
  'back': 'chevron-left',
  'forward': 'chevron-right',
  'settings': 'settings',
  'profile': 'user',
  'add': 'plus',
  'edit': 'edit',
  'delete': 'trash-2',
  'save': 'save',
  'share': 'share-2',
  'favorite': 'heart',
  'call': 'phone',
  'message': 'message-circle',
  'location': 'map-pin',
  'camera': 'camera',
  'shopping-cart': 'shopping-cart',
  'credit-card': 'credit-card',
  'calendar': 'calendar',
  'tag': 'tag',
  'package': 'package',
  'truck': 'truck',
  'hospital': 'building',
  'pharmacy': 'pill',
  'hotel': 'building',
  'car': 'car',
  'bus': 'bus',
  'plane': 'plane',
  'users': 'users',
  'user-plus': 'user-plus',
  'comments': 'message-square',
  'like': 'thumbs-up',
  'star': 'star',
  'check': 'check',
  'x': 'x',
  'alert': 'alert-triangle',
  'info': 'info',
  'help': 'help-circle',
  'book': 'book-open',
  'briefcase': 'briefcase',
  'video': 'video',
  'map': 'map',
  'list': 'list',
  'file': 'file-text',
  'clipboard': 'clipboard',
  'dollar': 'dollar-sign',
  'shield': 'shield',
  'droplet': 'droplet',
  'utensils': 'utensils',
  'graduation': 'graduation-cap',
  'building2': 'building-2',
  'activity': 'activity',
  'refresh': 'refresh-cw',
  'download': 'download',
  'upload': 'upload',
  'eye': 'eye',
  'filter': 'sliders',
  'bell': 'bell',
  'clock': 'clock',
  'award': 'award',
};

const GLOBAL_ACTIONS: ActionDescriptor[] = [
  {
    id: 'home',
    label: 'Accueil',
    icon: LUCIDE_ICONS.home,
    route: 'Home',
    category: 'navigation',
    description: 'Retourner à la page d\'accueil',
  },
  {
    id: 'search',
    label: 'Recherche',
    icon: LUCIDE_ICONS.search,
    route: 'RechercheBesoin',
    category: 'search',
    description: 'Rechercher des services ou produits',
  },
  {
    id: 'profile',
    label: 'Mon Profil',
    icon: LUCIDE_ICONS.profile,
    route: 'Profile',
    category: 'navigation',
    description: 'Voir et modifier mon profil',
  },
  {
    id: 'services',
    label: 'Mes Services',
    icon: LUCIDE_ICONS.menu,
    route: 'MesServices',
    category: 'navigation',
    description: 'Accéder à tous les services',
  },
];

const SCREEN_CONFIGS: Record<string, {
  type: ScreenContext['screenType'];
  actions: ActionDescriptor[];
  elements: UIElement[];
  guide: string;
}> = {
  Home: {
    type: 'home',
    actions: [
      { id: 'quick-search', label: 'Recherche Rapide', icon: LUCIDE_ICONS.search, route: 'RechercheBesoin', category: 'search', description: 'Trouver rapidement ce dont vous avez besoin' },
      { id: 'create-service', label: 'Créer Service', icon: LUCIDE_ICONS.add, route: 'ServicesDashboard', category: 'creation', description: 'Ajouter un nouveau service' },
      { id: 'pharmacy', label: 'Pharmacie', icon: LUCIDE_ICONS.pharmacy, route: 'PharmacieHome', category: 'navigation', description: 'Accéder aux services pharmaceutiques' },
      { id: 'hospital', label: 'Hôpital', icon: LUCIDE_ICONS.hospital, route: 'HopitalHome', category: 'navigation', description: 'Services médicaux et urgences' },
      { id: 'hotel', label: 'Hôtel', icon: LUCIDE_ICONS.hotel, route: 'HotelDashboard', category: 'navigation', description: 'Réservations hôtelières' },
      { id: 'taxi', label: 'Taxi', icon: LUCIDE_ICONS.car, route: 'TaxiHome', category: 'navigation', description: 'Commander un taxi' },
      { id: 'delivery', label: 'Livraison', icon: LUCIDE_ICONS.truck, route: 'DeliveryHome', category: 'navigation', description: 'Service de livraison' },
      { id: 'covoiturage', label: 'Covoiturage', icon: LUCIDE_ICONS.users, route: 'CovoiturageHome', category: 'navigation', description: 'Trouver un covoiturage' },
    ],
    elements: [
      { id: 'search-bar', type: 'input', label: 'Barre de recherche', actionable: true },
      { id: 'quick-actions', type: 'card', label: 'Actions rapides', actionable: true },
      { id: 'promotions', type: 'card', label: 'Promotions en cours', actionable: true },
      { id: 'services-grid', type: 'card', label: 'Grille des services', actionable: true },
    ],
    guide: 'Écran d\'accueil principal. Recherche rapide, accès aux services spécialisés (pharmacie, hôpital, hôtel, taxi, livraison, covoiturage), promotions, création de services.',
  },

  RechercheBesoin: {
    type: 'search',
    actions: [
      { id: 'filter-results', label: 'Filtrer', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Affiner les résultats de recherche' },
      { id: 'negotiate', label: 'Négocier Prix', icon: LUCIDE_ICONS.tag, category: 'action', description: 'Négocier le prix d\'un service' },
      { id: 'sort-results', label: 'Trier', icon: LUCIDE_ICONS.list, category: 'action', description: 'Trier par prix, distance ou pertinence' },
    ],
    elements: [
      { id: 'search-input', type: 'input', label: 'Recherche', actionable: true },
      { id: 'filter-button', type: 'button', label: 'Filtres', icon: LUCIDE_ICONS.filter, actionable: true },
      { id: 'results-list', type: 'card', label: 'Résultats', actionable: true },
    ],
    guide: 'Recherche de services et produits. Filtrez par catégorie, prix, distance. Négociez directement les prix avec les prestataires.',
  },
  ResultatBesoin: {
    type: 'search',
    actions: [
      { id: 'filter-results', label: 'Filtrer', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Affiner les résultats' },
      { id: 'negotiate', label: 'Négocier Prix', icon: LUCIDE_ICONS.tag, category: 'action', description: 'Négocier le prix' },
      { id: 'contact-provider', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Envoyer un message au prestataire' },
    ],
    elements: [
      { id: 'results-list', type: 'card', label: 'Résultats', actionable: true },
      { id: 'map-toggle', type: 'button', label: 'Voir sur la carte', icon: LUCIDE_ICONS.map, actionable: true },
    ],
    guide: 'Résultats de recherche. Consultez les détails, contactez les prestataires, négociez les prix ou filtrez davantage.',
  },

  ServiceDetail: {
    type: 'detail',
    actions: [
      { id: 'contact-provider', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Envoyer un message au prestataire' },
      { id: 'call-provider', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appeler directement le prestataire' },
      { id: 'navigate', label: 'Itinéraire', icon: LUCIDE_ICONS.location, category: 'navigation', description: 'Obtenir l\'itinéraire vers le service' },
      { id: 'share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager ce service' },
      { id: 'favorite', label: 'Favori', icon: LUCIDE_ICONS.favorite, category: 'action', description: 'Ajouter aux favoris' },
    ],
    elements: [
      { id: 'service-info', type: 'card', label: 'Informations du service', actionable: false },
      { id: 'contact-btn', type: 'button', label: 'Contacter', icon: LUCIDE_ICONS.message, actionable: true },
      { id: 'call-btn', type: 'button', label: 'Appeler', icon: LUCIDE_ICONS.call, actionable: true },
      { id: 'itinerary-btn', type: 'button', label: 'Itinéraire', icon: LUCIDE_ICONS.location, actionable: true },
    ],
    guide: 'Détail d\'un service. Contactez le prestataire (message ou appel), consultez l\'itinéraire, partagez ou ajoutez aux favoris.',
  },

  // === PHARMACIE ===
  PharmacieHome: {
    type: 'specialized',
    actions: [
      { id: 'search-pharmacy', label: 'Chercher Pharmacie', icon: LUCIDE_ICONS.search, route: 'PharmacieSearch', category: 'search', description: 'Rechercher une pharmacie' },
      { id: 'pharmacy-list', label: 'Liste Pharmacies', icon: LUCIDE_ICONS.list, route: 'PharmacieList', category: 'navigation', description: 'Voir toutes les pharmacies' },
      { id: 'my-orders', label: 'Mes Commandes', icon: LUCIDE_ICONS.clipboard, route: 'MyPharmacyOrders', category: 'navigation', description: 'Suivi de commandes médicaments' },
    ],
    elements: [
      { id: 'pharmacy-search', type: 'input', label: 'Recherche médicaments', actionable: true },
      { id: 'pharmacy-categories', type: 'card', label: 'Catégories', actionable: true },
    ],
    guide: 'Accueil Pharmacie. Recherchez des médicaments, trouvez les pharmacies proches, suivez vos commandes. L\'IA peut analyser vos ordonnances.',
  },
  PharmacieForm: {
    type: 'form',
    actions: [
      { id: 'add-product', label: 'Ajouter Médicament', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Ajouter un nouveau médicament à votre stock' },
      { id: 'view-stock', label: 'Voir Stock', icon: LUCIDE_ICONS.package, category: 'action', description: 'Consulter l\'état du stock' },
      { id: 'ai-analysis', label: 'Analyse IA', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Analyser une ordonnance avec l\'IA' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'PharmacyAnalytics', category: 'navigation', description: 'Voir les statistiques' },
    ],
    elements: [
      { id: 'product-form', type: 'input', label: 'Formulaire médicament', actionable: true },
      { id: 'stock-list', type: 'card', label: 'Liste du stock', actionable: true },
    ],
    guide: 'Gestion de votre pharmacie. Ajoutez des médicaments, gérez le stock, analysez des ordonnances avec l\'IA, consultez les statistiques de vente.',
  },
  PharmacieSearch: {
    type: 'search',
    actions: [
      { id: 'search-med', label: 'Rechercher', icon: LUCIDE_ICONS.search, category: 'search', description: 'Rechercher un médicament' },
      { id: 'filter-location', label: 'Proximité', icon: LUCIDE_ICONS.location, category: 'action', description: 'Filtrer par proximité' },
    ],
    elements: [
      { id: 'search-input', type: 'input', label: 'Nom du médicament', actionable: true },
    ],
    guide: 'Recherche de pharmacies. Trouvez une pharmacie par nom de médicament, proximité ou spécialité.',
  },

  // === HÔPITAL ===
  HopitalHome: {
    type: 'specialized',
    actions: [
      { id: 'search-hospital', label: 'Chercher Hôpital', icon: LUCIDE_ICONS.search, route: 'HopitalSearch', category: 'search', description: 'Rechercher un hôpital' },
      { id: 'hospital-list', label: 'Liste Hôpitaux', icon: LUCIDE_ICONS.list, route: 'HopitalList', category: 'navigation', description: 'Tous les hôpitaux' },
      { id: 'book-appointment', label: 'Prendre RDV', icon: LUCIDE_ICONS.calendar, route: 'BookAppointment', category: 'action', description: 'Réserver une consultation' },
      { id: 'my-consultations', label: 'Mes Consultations', icon: LUCIDE_ICONS.clipboard, route: 'MyConsultations', category: 'navigation', description: 'Historique de consultations' },
      { id: 'ai-reco', label: 'Recommandations IA', icon: LUCIDE_ICONS.activity, route: 'HospitalAIRecommendations', category: 'help', description: 'Recommandations santé par IA' },
    ],
    elements: [
      { id: 'hospital-search', type: 'input', label: 'Recherche hôpitaux', actionable: true },
      { id: 'specialties', type: 'card', label: 'Spécialités médicales', actionable: true },
    ],
    guide: 'Accueil Santé. Trouvez des hôpitaux, prenez rendez-vous, consultez l\'historique de vos consultations. L\'IA peut recommander des spécialistes.',
  },
  HopitalForm: {
    type: 'form',
    actions: [
      { id: 'manage-slots', label: 'Gérer Créneaux', icon: LUCIDE_ICONS.calendar, route: 'SlotManagement', category: 'action', description: 'Gérer les créneaux de consultation' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'HospitalAnalytics', category: 'navigation', description: 'Statistiques hospitalières' },
    ],
    elements: [
      { id: 'hospital-form', type: 'input', label: 'Formulaire hôpital', actionable: true },
    ],
    guide: 'Gestion de votre hôpital. Configurez vos spécialités, gérez les créneaux de rendez-vous et consultez les statistiques.',
  },

  // === HÔTEL ===
  HotelDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'add-room', label: 'Ajouter Chambre', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Ajouter une nouvelle chambre' },
      { id: 'manage-reservations', label: 'Réservations', icon: LUCIDE_ICONS.calendar, route: 'MesReservations', category: 'action', description: 'Gérer les réservations' },
      { id: 'check-pricing', label: 'Tarifs', icon: LUCIDE_ICONS['credit-card'], category: 'action', description: 'Modifier les tarifs' },
      { id: 'qr-scanner', label: 'Scanner QR', icon: LUCIDE_ICONS.camera, route: 'HotelQRScanner', category: 'action', description: 'Scanner un QR code de réservation' },
    ],
    elements: [
      { id: 'rooms-list', type: 'card', label: 'Chambres disponibles', actionable: true },
      { id: 'reservations-overview', type: 'card', label: 'Réservations du jour', actionable: true },
    ],
    guide: 'Tableau de bord hôtelier. Gérez vos chambres, tarifs, réservations. Scannez les QR codes à l\'arrivée des clients.',
  },
  HotelMeubleHome: {
    type: 'specialized',
    actions: [
      { id: 'search-hotel', label: 'Chercher Hôtel', icon: LUCIDE_ICONS.search, category: 'search', description: 'Rechercher un hôtel ou meublé' },
      { id: 'book-hotel', label: 'Réserver', icon: LUCIDE_ICONS.calendar, route: 'HotelBooking', category: 'action', description: 'Réserver une chambre' },
    ],
    elements: [
      { id: 'hotel-search', type: 'input', label: 'Recherche hôtel', actionable: true },
      { id: 'hotel-list', type: 'card', label: 'Hôtels disponibles', actionable: true },
    ],
    guide: 'Recherche d\'hébergement. Trouvez un hôtel ou meublé, comparez les prix, réservez directement.',
  },

  // === IMMOBILIER ===
  ImmobilierHome: {
    type: 'specialized',
    actions: [
      { id: 'search-property', label: 'Chercher Bien', icon: LUCIDE_ICONS.search, route: 'ImmobilierSearch', category: 'search', description: 'Rechercher un bien immobilier' },
      { id: 'compare', label: 'Comparer', icon: LUCIDE_ICONS.list, route: 'ImmobilierCompare', category: 'action', description: 'Comparer des biens' },
      { id: 'price-alerts', label: 'Alertes Prix', icon: LUCIDE_ICONS.bell, route: 'ImmobilierPriceAlerts', category: 'action', description: 'Configurer des alertes de prix' },
      { id: 'add-property', label: 'Publier Annonce', icon: LUCIDE_ICONS.add, route: 'ImmobilierForm', category: 'creation', description: 'Publier une annonce immobilière' },
    ],
    elements: [
      { id: 'property-search', type: 'input', label: 'Recherche immobilière', actionable: true },
    ],
    guide: 'Immobilier. Recherchez, comparez et réservez des biens. Configurez des alertes de prix. Publiez vos annonces.',
  },

  // === TAXI ===
  TaxiHome: {
    type: 'specialized',
    actions: [
      { id: 'book-taxi', label: 'Commander Taxi', icon: LUCIDE_ICONS.car, route: 'TaxiBooking', category: 'action', description: 'Commander un taxi maintenant' },
      { id: 'search-taxi', label: 'Chercher Taxi', icon: LUCIDE_ICONS.search, route: 'TaxiSearch', category: 'search', description: 'Rechercher un taxi' },
      { id: 'ai-search', label: 'Recherche IA', icon: LUCIDE_ICONS.activity, route: 'TaxiIntelligentSearch', category: 'search', description: 'Recherche intelligente de taxi' },
      { id: 'my-taxis', label: 'Mes Taxis', icon: LUCIDE_ICONS.list, route: 'MesTaxis', category: 'navigation', description: 'Historique de courses' },
    ],
    elements: [
      { id: 'destination-input', type: 'input', label: 'Où allez-vous ?', actionable: true },
    ],
    guide: 'Service Taxi. Commandez un taxi, suivez votre course en temps réel, consultez l\'historique.',
  },
  TaxiForm: {
    type: 'form',
    actions: [
      { id: 'toggle-availability', label: 'Disponibilité', icon: LUCIDE_ICONS.check, category: 'action', description: 'Activer/Désactiver la disponibilité' },
      { id: 'view-trips', label: 'Courses', icon: LUCIDE_ICONS.car, category: 'action', description: 'Voir l\'historique des courses' },
    ],
    elements: [
      { id: 'availability-toggle', type: 'button', label: 'Disponibilité', actionable: true },
    ],
    guide: 'Gestion taxi. Activez/désactivez votre disponibilité, consultez vos courses.',
  },

  // === COVOITURAGE ===
  CovoiturageHome: {
    type: 'specialized',
    actions: [
      { id: 'search-ride', label: 'Chercher Trajet', icon: LUCIDE_ICONS.search, route: 'CovoiturageSearch', category: 'search', description: 'Rechercher un covoiturage' },
      { id: 'create-ride', label: 'Proposer Trajet', icon: LUCIDE_ICONS.add, route: 'CovoiturageForm', category: 'creation', description: 'Proposer un trajet en covoiturage' },
      { id: 'ai-search', label: 'Recherche IA', icon: LUCIDE_ICONS.activity, route: 'CovoiturageIntelligentSearch', category: 'search', description: 'Recherche intelligente' },
      { id: 'my-reservations', label: 'Mes Réservations', icon: LUCIDE_ICONS.clipboard, route: 'MesReservationsCovoiturage', category: 'navigation', description: 'Mes réservations de covoiturage' },
    ],
    elements: [
      { id: 'ride-search', type: 'input', label: 'Départ → Arrivée', actionable: true },
    ],
    guide: 'Covoiturage. Trouvez ou proposez un trajet partagé. L\'IA optimise les correspondances.',
  },

  // === LIVRAISON ===
  DeliveryHome: {
    type: 'specialized',
    actions: [
      { id: 'send-parcel', label: 'Envoyer Colis', icon: LUCIDE_ICONS.package, route: 'DeliveryParcelFlowNew', category: 'action', description: 'Envoyer un colis' },
      { id: 'shopping-delivery', label: 'Courses & Livraison', icon: LUCIDE_ICONS['shopping-cart'], route: 'DeliveryShoppingFlowNew', category: 'action', description: 'Commander des courses avec livraison' },
      { id: 'become-courier', label: 'Devenir Coursier', icon: LUCIDE_ICONS.truck, route: 'CourierRegistration', category: 'navigation', description: 'S\'inscrire comme coursier' },
    ],
    elements: [
      { id: 'delivery-options', type: 'card', label: 'Options de livraison', actionable: true },
    ],
    guide: 'Service de livraison. Envoyez un colis, commandez des courses avec livraison, ou devenez coursier.',
  },
  CourierDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'active-deliveries', label: 'Livraisons Actives', icon: LUCIDE_ICONS.truck, category: 'action', description: 'Voir les livraisons en cours' },
      { id: 'delivery-history', label: 'Historique', icon: LUCIDE_ICONS.clock, category: 'navigation', description: 'Historique des livraisons' },
      { id: 'earnings', label: 'Revenus', icon: LUCIDE_ICONS.dollar, category: 'navigation', description: 'Consulter les revenus' },
    ],
    elements: [
      { id: 'delivery-list', type: 'card', label: 'Livraisons en cours', actionable: true },
      { id: 'earnings-card', type: 'card', label: 'Résumé des revenus', actionable: false },
    ],
    guide: 'Tableau de bord coursier. Gérez vos livraisons actives, consultez l\'historique et vos revenus.',
  },

  // === LABORATOIRE ===
  LaboratoireHome: {
    type: 'specialized',
    actions: [
      { id: 'search-lab', label: 'Chercher Labo', icon: LUCIDE_ICONS.search, route: 'LaboratoireSearch', category: 'search', description: 'Rechercher un laboratoire' },
      { id: 'my-exams', label: 'Mes Examens', icon: LUCIDE_ICONS.clipboard, route: 'MyLabExaminations', category: 'navigation', description: 'Historique d\'examens' },
      { id: 'ai-analysis', label: 'Analyse IA', icon: LUCIDE_ICONS.activity, route: 'LabAIAnalysis', category: 'help', description: 'Analyse de résultats par IA' },
    ],
    elements: [
      { id: 'lab-search', type: 'input', label: 'Recherche laboratoire', actionable: true },
    ],
    guide: 'Laboratoires d\'analyses. Trouvez un labo, consultez vos résultats, l\'IA peut aider à interpréter les analyses.',
  },

  // === BANQUE DE SANG ===
  BloodDonation: {
    type: 'specialized',
    actions: [
      { id: 'donate', label: 'Donner du Sang', icon: LUCIDE_ICONS.droplet, route: 'BloodDonationRequest', category: 'action', description: 'Faire un don de sang' },
      { id: 'find-blood', label: 'Chercher Sang', icon: LUCIDE_ICONS.search, route: 'BanqueSangSearch', category: 'search', description: 'Rechercher du sang compatible' },
      { id: 'my-donations', label: 'Mes Dons', icon: LUCIDE_ICONS.clipboard, route: 'MyBloodDonations', category: 'navigation', description: 'Historique de dons' },
    ],
    elements: [
      { id: 'blood-type-selector', type: 'button', label: 'Groupe sanguin', actionable: true },
    ],
    guide: 'Don de sang. Faites un don, cherchez du sang compatible, consultez l\'historique de vos dons.',
  },

  // === ASSURANCE ===
  AssuranceDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'my-policies', label: 'Mes Polices', icon: LUCIDE_ICONS.shield, route: 'MesPolicesAssurance', category: 'navigation', description: 'Consulter mes polices' },
      { id: 'declare-claim', label: 'Déclarer Sinistre', icon: LUCIDE_ICONS.alert, route: 'DeclarationSinistre', category: 'action', description: 'Déclarer un sinistre' },
      { id: 'get-quote', label: 'Demander Devis', icon: LUCIDE_ICONS.file, route: 'InsuranceQuoteRequest', category: 'action', description: 'Obtenir un devis d\'assurance' },
    ],
    elements: [
      { id: 'policies-overview', type: 'card', label: 'Mes polices', actionable: true },
    ],
    guide: 'Assurance. Gérez vos polices, déclarez un sinistre, obtenez des devis. Suivez l\'état de vos dossiers.',
  },

  // === AUTOMOBILE ===
  AutomobileDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'search-auto', label: 'Chercher Service Auto', icon: LUCIDE_ICONS.search, route: 'AutoServicesSearch', category: 'search', description: 'Rechercher un service automobile' },
    ],
    elements: [
      { id: 'auto-services', type: 'card', label: 'Services automobiles', actionable: true },
    ],
    guide: 'Services automobiles. Trouvez des garages, concessionnaires et services de maintenance.',
  },

  // === OFFRES D\'EMPLOI ===
  OffresEmploiHome: {
    type: 'specialized',
    actions: [
      { id: 'search-jobs', label: 'Chercher Emploi', icon: LUCIDE_ICONS.search, route: 'OffreSearch', category: 'search', description: 'Rechercher des offres d\'emploi' },
      { id: 'my-offers', label: 'Mes Offres', icon: LUCIDE_ICONS.briefcase, route: 'MesOffres', category: 'navigation', description: 'Voir mes offres publiées' },
      { id: 'cv-analysis', label: 'Analyse CV', icon: LUCIDE_ICONS.file, route: 'AICVAnalysis', category: 'help', description: 'Analyser un CV avec l\'IA' },
      { id: 'salary-predict', label: 'Prédiction Salaire', icon: LUCIDE_ICONS.dollar, route: 'AISalaryPrediction', category: 'help', description: 'Prédire un salaire avec l\'IA' },
      { id: 'suggest-formations', label: 'Formations IA', icon: LUCIDE_ICONS.graduation, route: 'AISuggestFormations', category: 'help', description: 'Suggestions de formations par IA' },
      { id: 'alerts', label: 'Alertes Emploi', icon: LUCIDE_ICONS.bell, route: 'AlertesEmploi', category: 'action', description: 'Configurer des alertes emploi' },
    ],
    elements: [
      { id: 'job-search', type: 'input', label: 'Recherche emploi', actionable: true },
    ],
    guide: 'Offres d\'emploi. Recherchez des offres, analysez votre CV avec l\'IA, prédisez votre salaire, recevez des suggestions de formations.',
  },
  OffresEmploiHub: {
    type: 'dashboard',
    actions: [
      { id: 'create-offer', label: 'Publier Offre', icon: LUCIDE_ICONS.add, route: 'CreateOffre', category: 'creation', description: 'Publier une offre d\'emploi' },
      { id: 'manage-candidatures', label: 'Candidatures', icon: LUCIDE_ICONS.users, category: 'action', description: 'Gérer les candidatures' },
    ],
    elements: [],
    guide: 'Hub employeur. Publiez des offres d\'emploi et gérez les candidatures reçues.',
  },

  // === ORIENTATION SCOLAIRE ===
  OrientationScolaireHome: {
    type: 'specialized',
    actions: [
      { id: 'search-school', label: 'Chercher Établissement', icon: LUCIDE_ICONS.search, route: 'EtablissementSearch', category: 'search', description: 'Rechercher un établissement' },
      { id: 'ai-profile', label: 'Analyse Profil IA', icon: LUCIDE_ICONS.activity, route: 'OrientationAIProfileAnalysis', category: 'help', description: 'Analyser votre profil avec l\'IA' },
      { id: 'ai-reco', label: 'Recommandations IA', icon: LUCIDE_ICONS.activity, route: 'OrientationAIRecommendations', category: 'help', description: 'Recommandations IA de filières' },
      { id: 'concours', label: 'Concours d\'Entrée', icon: LUCIDE_ICONS.award, route: 'ConcoursEntree', category: 'navigation', description: 'Concours et examens d\'entrée' },
      { id: 'fournitures', label: 'Fournitures', icon: LUCIDE_ICONS.package, route: 'FournituresScolaires', category: 'navigation', description: 'Fournitures scolaires' },
    ],
    elements: [
      { id: 'school-search', type: 'input', label: 'Recherche établissement', actionable: true },
    ],
    guide: 'Orientation scolaire. Trouvez un établissement, l\'IA analyse votre profil et recommande des filières. Accédez aux concours et fournitures.',
  },

  // === LIVRES SCOLAIRES / BOURSE DU LIVRE ===
  LivreScolaireHome: {
    type: 'specialized',
    actions: [
      { id: 'search-book', label: 'Chercher Livre', icon: LUCIDE_ICONS.search, route: 'LivreScolaireSearch', category: 'search', description: 'Rechercher un livre scolaire' },
      { id: 'sell-book', label: 'Vendre Livre', icon: LUCIDE_ICONS.add, route: 'LivreScolaireForm', category: 'creation', description: 'Mettre en vente un livre' },
      { id: 'my-books', label: 'Mes Livres', icon: LUCIDE_ICONS.book, route: 'MesLivres', category: 'navigation', description: 'Mes livres en vente' },
      { id: 'book-bourse', label: 'Bourse du Livre', icon: LUCIDE_ICONS.dollar, route: 'BourseLivre', category: 'navigation', description: 'Bourse d\'échange de livres' },
    ],
    elements: [
      { id: 'book-search', type: 'input', label: 'Recherche livre', actionable: true },
    ],
    guide: 'Livres scolaires. Achetez, vendez ou échangez des livres. Accédez à la bourse du livre pour des échanges avantageux.',
  },

  // === BUS / TICKETS DE VOYAGE ===
  TicketVoyageHome: {
    type: 'specialized',
    actions: [
      { id: 'search-ticket', label: 'Chercher Billet', icon: LUCIDE_ICONS.search, route: 'BusTicketSearch', category: 'search', description: 'Rechercher un billet de bus' },
      { id: 'my-tickets', label: 'Mes Billets', icon: LUCIDE_ICONS.clipboard, route: 'MyBusTickets', category: 'navigation', description: 'Mes billets de voyage' },
      { id: 'my-trips', label: 'Mes Voyages', icon: LUCIDE_ICONS.map, route: 'MyTrips', category: 'navigation', description: 'Historique de voyages' },
    ],
    elements: [
      { id: 'ticket-search', type: 'input', label: 'Départ → Arrivée', actionable: true },
    ],
    guide: 'Tickets de voyage. Réservez des billets de bus, consultez vos billets et l\'historique de voyages.',
  },

  // === SUPERMARCHÉ / RESTAURANT ===
  SupermarketHome: {
    type: 'specialized',
    actions: [
      { id: 'browse-products', label: 'Parcourir', icon: LUCIDE_ICONS['shopping-cart'], category: 'search', description: 'Parcourir les produits' },
      { id: 'menu-planning', label: 'Menu Semaine', icon: LUCIDE_ICONS.calendar, route: 'MenuPlanningHub', category: 'navigation', description: 'Planifier les repas de la semaine' },
      { id: 'shopping-list', label: 'Liste de Courses', icon: LUCIDE_ICONS.list, route: 'ShoppingList', category: 'action', description: 'Ma liste de courses' },
    ],
    elements: [],
    guide: 'Supermarché. Parcourez les produits, planifiez vos repas de la semaine, gérez votre liste de courses.',
  },

  // === AGENCE DE VOYAGE ===
  AgenceVoyageForm: {
    type: 'form',
    actions: [
      { id: 'manage-trips', label: 'Gérer Voyages', icon: LUCIDE_ICONS.map, category: 'action', description: 'Gérer les voyages proposés' },
      { id: 'schedules', label: 'Horaires', icon: LUCIDE_ICONS.clock, route: 'ManageAgencySchedules', category: 'action', description: 'Gérer les horaires de départ' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'AgencyAnalyticsDashboard', category: 'navigation', description: 'Statistiques de l\'agence' },
    ],
    elements: [],
    guide: 'Gestion agence de voyage. Configurez vos voyages, gérez les horaires et consultez les statistiques.',
  },

  // === VIDÉO ===
  VideoCreationIntro: {
    type: 'form',
    actions: [
      { id: 'create-video', label: 'Créer Vidéo', icon: LUCIDE_ICONS.video, route: 'VideoCreationWizard', category: 'creation', description: 'Créer une vidéo de promotion' },
      { id: 'my-analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'VideoAnalytics', category: 'navigation', description: 'Statistiques de mes vidéos' },
    ],
    elements: [],
    guide: 'Création vidéo. Créez des vidéos promotionnelles pour vos services avec l\'assistant IA.',
  },
  VideoCreationWizard: {
    type: 'form',
    actions: [
      { id: 'select-product', label: 'Choisir Produit', icon: LUCIDE_ICONS.package, category: 'action', description: 'Sélectionner le produit à mettre en avant' },
      { id: 'select-media', label: 'Choisir Médias', icon: LUCIDE_ICONS.camera, category: 'action', description: 'Choisir les photos/vidéos du produit' },
      { id: 'edit-script', label: 'Script IA', icon: LUCIDE_ICONS.file, category: 'action', description: 'Ajuster le script généré par l\'IA' },
      { id: 'preview-video', label: 'Prévisualiser', icon: LUCIDE_ICONS.eye, category: 'action', description: 'Prévisualiser le montage vidéo' },
      { id: 'export-video', label: 'Exporter', icon: LUCIDE_ICONS.download, category: 'action', description: 'Exporter ou partager la vidéo générée' },
    ],
    elements: [
      { id: 'steps-header', type: 'card', label: 'Étapes de création vidéo', actionable: false },
      { id: 'product-selector', type: 'card', label: 'Sélection du produit', actionable: true },
      { id: 'media-grid', type: 'card', label: 'Médias du produit et du service', actionable: true },
      { id: 'script-editor', type: 'input', label: 'Script / texte de la vidéo', actionable: true },
      { id: 'timeline-preview', type: 'card', label: 'Aperçu du storyboard', actionable: true },
    ],
    guide: 'Assistant de création vidéo produit. Choisissez le produit, laissez l’IA proposer un script et un montage, ajustez les médias et le texte, puis générez une vidéo prête à être partagée sur les réseaux sociaux.',
  },
  VideoFeed: {
    type: 'list',
    actions: [
      { id: 'create-video', label: 'Créer Vidéo', icon: LUCIDE_ICONS.video, route: 'VideoCreationIntro', category: 'creation', description: 'Créer une nouvelle vidéo' },
      { id: 'live', label: 'Voir Lives', icon: LUCIDE_ICONS.video, route: 'LivesList', category: 'navigation', description: 'Voir les diffusions en direct' },
    ],
    elements: [
      { id: 'video-list', type: 'card', label: 'Flux vidéo', actionable: true },
    ],
    guide: 'Flux vidéo. Parcourez les vidéos, créez du contenu, ou regardez les diffusions en direct.',
  },

  // === PROFIL ===
  Profile: {
    type: 'dashboard',
    actions: [
      { id: 'edit-profile', label: 'Modifier Profil', icon: LUCIDE_ICONS.edit, category: 'action', description: 'Modifier vos informations' },
      { id: 'settings', label: 'Paramètres', icon: LUCIDE_ICONS.settings, route: 'EnhancedSettings', category: 'navigation', description: 'Paramètres de l\'application' },
      { id: 'wallet', label: 'Portefeuille', icon: LUCIDE_ICONS.dollar, route: 'WalletFinancial', category: 'navigation', description: 'Gérer votre portefeuille' },
      { id: 'my-favorites', label: 'Favoris', icon: LUCIDE_ICONS.favorite, route: 'MyFavorites', category: 'navigation', description: 'Mes services favoris' },
      { id: 'change-password', label: 'Mot de passe', icon: LUCIDE_ICONS.shield, route: 'ChangePassword', category: 'action', description: 'Changer le mot de passe' },
    ],
    elements: [
      { id: 'profile-card', type: 'card', label: 'Informations personnelles', actionable: true },
      { id: 'settings-list', type: 'card', label: 'Paramètres', actionable: true },
    ],
    guide: 'Votre profil. Modifiez vos informations, gérez votre portefeuille, paramètres, favoris, mot de passe.',
  },

  // === PROMOTIONS ===
  FlashPromosActive: {
    type: 'list',
    actions: [
      { id: 'create-promo', label: 'Créer Promo', icon: LUCIDE_ICONS.add, route: 'CreateFlashPromo', category: 'creation', description: 'Créer une promotion flash' },
      { id: 'global-promos', label: 'Catalogue Promos', icon: LUCIDE_ICONS.list, route: 'GlobalPromoCatalog', category: 'navigation', description: 'Voir toutes les promotions' },
    ],
    elements: [],
    guide: 'Promotions flash. Créez et gérez des promotions temporaires pour booster vos ventes.',
  },

  // === MENU / RECETTES ===
  MenuPlanningHub: {
    type: 'specialized',
    actions: [
      { id: 'week-calendar', label: 'Calendrier Semaine', icon: LUCIDE_ICONS.calendar, route: 'MenuWeekCalendar', category: 'navigation', description: 'Planning des repas de la semaine' },
      { id: 'search-recipe', label: 'Chercher Recette', icon: LUCIDE_ICONS.search, route: 'RecipeSearch', category: 'search', description: 'Rechercher une recette' },
      { id: 'shopping-list', label: 'Liste Courses', icon: LUCIDE_ICONS.list, route: 'ShoppingList', category: 'action', description: 'Générer la liste de courses' },
    ],
    elements: [],
    guide: 'Planning des repas. Planifiez vos menus, trouvez des recettes, générez automatiquement la liste de courses.',
  },

  // === TROC ===
  TrocMatching: {
    type: 'specialized',
    actions: [
      { id: 'my-trocs', label: 'Mes Trocs', icon: LUCIDE_ICONS.refresh, route: 'MesTrocs', category: 'navigation', description: 'Mes échanges en cours' },
      { id: 'validate-troc', label: 'Valider Échange', icon: LUCIDE_ICONS.check, route: 'TrocLiveValidation', category: 'action', description: 'Valider un échange en direct' },
    ],
    elements: [],
    guide: 'Troc. Échangez des biens et services avec d\'autres utilisateurs. Validation en direct.',
  },

  // === DASHBOARD PRESTATAIRE ===
  DashboardPrestataire: {
    type: 'dashboard',
    actions: [
      { id: 'my-products', label: 'Mes Produits', icon: LUCIDE_ICONS.package, route: 'MesProduits', category: 'navigation', description: 'Gérer mes produits' },
      { id: 'add-product', label: 'Ajouter Produit', icon: LUCIDE_ICONS.add, route: 'AjouterProduitSimple', category: 'creation', description: 'Ajouter un produit' },
      { id: 'orders', label: 'Commandes', icon: LUCIDE_ICONS.clipboard, route: 'ProviderOrderManagement', category: 'navigation', description: 'Gérer les commandes' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'ProductStats', category: 'navigation', description: 'Statistiques de vente' },
      { id: 'pub', label: 'Publicité', icon: LUCIDE_ICONS.eye, route: 'PubliciteDashboard', category: 'navigation', description: 'Gérer la publicité' },
    ],
    elements: [],
    guide: 'Espace prestataire. Gérez vos produits, commandes, statistiques et publicité.',
  },

  // === AI HUB ===
  AIHub: {
    type: 'specialized',
    actions: [
      { id: 'ai-chat', label: 'Chat IA', icon: LUCIDE_ICONS.message, route: 'AIChat', category: 'navigation', description: 'Discuter avec l\'IA' },
    ],
    elements: [],
    guide: 'Hub IA Yukpo. Accédez à tous les outils d\'intelligence artificielle de la plateforme.',
  },

  // === NAVIGATION GPS ===
  Navigation: {
    type: 'specialized',
    actions: [
      { id: 'set-destination', label: 'Définir Destination', icon: LUCIDE_ICONS.location, category: 'action', description: 'Saisir ou sélectionner une destination sur la carte' },
      { id: 'start-navigation', label: 'Démarrer Navigation', icon: LUCIDE_ICONS.forward, category: 'action', description: 'Lancer le guidage GPS en temps réel' },
      { id: 'change-mode', label: 'Mode Transport', icon: LUCIDE_ICONS.car, category: 'action', description: 'Changer le mode : voiture, à pied, transport, vélo' },
      { id: 'report-checkpoint', label: 'Signaler', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Signaler un radar, contrôle, accident ou danger sur la route' },
      { id: 'search-poi', label: 'Points d\'Intérêt', icon: LUCIDE_ICONS.search, category: 'search', description: 'Chercher pharmacies, stations-service, restaurants etc. sur le trajet' },
      { id: 'share-route', label: 'Partager Trajet', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager votre itinéraire avec un contact' },
      { id: 'voice-guidance', label: 'Guidage Vocal', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Activer/désactiver le guidage vocal' },
    ],
    elements: [
      { id: 'map-view', type: 'card', label: 'Carte GPS', actionable: true },
      { id: 'destination-input', type: 'input', label: 'Saisie destination', actionable: true },
      { id: 'route-options', type: 'card', label: 'Options d\'itinéraire', actionable: true },
      { id: 'travel-mode-tabs', type: 'tab', label: 'Voiture / À pied / Transport / Vélo', actionable: true },
      { id: 'checkpoint-reports', type: 'card', label: 'Signalements route (radars, contrôles)', actionable: true },
      { id: 'poi-categories', type: 'button', label: 'Catégories POI (santé, alimentation, carburant...)', actionable: true },
    ],
    guide: 'Navigation GPS complète. Saisissez une destination, choisissez votre mode de transport (voiture, à pied, transport en commun, vélo), lancez le guidage vocal en temps réel. Signalez des radars, contrôles de police/Mintransport, accidents ou dangers sur la route. Découvrez les points d\'intérêt à proximité (pharmacies, stations-service, hôtels, restaurants). Estimation du coût de transport et du temps de trajet. Alertes vocales automatiques à l\'approche des signalements.',
  },

  // === BOURSE DU LIVRE ===
  BourseLivre: {
    type: 'specialized',
    actions: [
      { id: 'search-book', label: 'Chercher Livre', icon: LUCIDE_ICONS.search, category: 'search', description: 'Rechercher un livre par titre, auteur ou matière' },
      { id: 'filter-books', label: 'Filtrer', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Filtrer par classe, matière, niveau, état du livre, ville' },
      { id: 'ai-recommendations', label: 'Recommandations IA', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Obtenir des recommandations de livres par l\'IA selon la classe et la matière' },
      { id: 'ai-price', label: 'Estimation Prix IA', icon: LUCIDE_ICONS.dollar, category: 'help', description: 'Obtenir une estimation de prix par l\'IA pour un livre' },
      { id: 'sell-book', label: 'Vendre un Livre', icon: LUCIDE_ICONS.add, route: 'LivreScolaireForm', category: 'creation', description: 'Mettre un livre en vente sur la bourse' },
      { id: 'upload-v2', label: 'Publier Livre V2', icon: LUCIDE_ICONS.upload, route: 'BookUploadV2', category: 'creation', description: 'Publier un livre avec le formulaire avancé' },
      { id: 'book-packages', label: 'Packages Livres', icon: LUCIDE_ICONS.package, route: 'BookPackages', category: 'navigation', description: 'Voir les packages de livres par niveau' },
      { id: 'buy-direct', label: 'Achat Direct', icon: LUCIDE_ICONS['shopping-cart'], route: 'BookBuyDirect', category: 'action', description: 'Acheter un livre directement' },
      { id: 'my-books', label: 'Mes Livres', icon: LUCIDE_ICONS.book, route: 'MesLivres', category: 'navigation', description: 'Voir mes livres mis en vente' },
      { id: 'new-books', label: 'Livres Neufs', icon: LUCIDE_ICONS.star, route: 'NewBooks', category: 'navigation', description: 'Découvrir les livres neufs disponibles' },
    ],
    elements: [
      { id: 'search-input', type: 'input', label: 'Recherche par titre ou auteur', actionable: true },
      { id: 'filter-panel', type: 'button', label: 'Filtres (classe, matière, état)', icon: LUCIDE_ICONS.filter, actionable: true },
      { id: 'books-grid', type: 'card', label: 'Grille de livres disponibles', actionable: true },
      { id: 'ai-reco-button', type: 'button', label: 'Recommandations IA', icon: LUCIDE_ICONS.activity, actionable: true },
      { id: 'ai-price-button', type: 'button', label: 'Estimation prix IA', icon: LUCIDE_ICONS.dollar, actionable: true },
    ],
    guide: 'Bourse du Livre — marché d\'échange et de vente de livres scolaires. Recherchez par titre, auteur, classe ou matière. Filtrez par niveau (primaire, collège, lycée), état du livre (neuf, très bon, bon, acceptable) et localisation. L\'IA peut recommander les livres adaptés à votre classe et estimer le prix juste d\'un livre. Achetez directement, explorez les packages par niveau, ou mettez vos anciens livres en vente. Contactez les vendeurs pour négocier.',
  },

  // === CHAT MODAL MOBILE (chatbot prestataire) ===
  ChatModalMobile: {
    type: 'chat',
    actions: [
      { id: 'send-message', label: 'Envoyer Message', icon: LUCIDE_ICONS.message, category: 'action', description: 'Envoyer un message texte au prestataire' },
      { id: 'send-photo', label: 'Envoyer Photo', icon: LUCIDE_ICONS.camera, category: 'action', description: 'Prendre ou choisir une photo à envoyer' },
      { id: 'send-audio', label: 'Message Vocal', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Enregistrer et envoyer un message vocal' },
      { id: 'send-file', label: 'Envoyer Fichier', icon: LUCIDE_ICONS.file, category: 'action', description: 'Envoyer un document (PDF, etc.)' },
      { id: 'audio-call', label: 'Appel Audio', icon: LUCIDE_ICONS.call, category: 'action', description: 'Passer un appel audio au prestataire' },
      { id: 'video-call', label: 'Appel Vidéo', icon: LUCIDE_ICONS.video, category: 'action', description: 'Passer un appel vidéo au prestataire' },
      { id: 'negotiate-price', label: 'Négocier Prix', icon: LUCIDE_ICONS.tag, category: 'action', description: 'Proposer un prix au prestataire' },
      { id: 'order-delivery', label: 'Commander Livraison', icon: LUCIDE_ICONS.truck, category: 'action', description: 'Commander un produit avec livraison' },
      { id: 'view-products', label: 'Voir Produits', icon: LUCIDE_ICONS.package, category: 'action', description: 'Voir le catalogue produits du prestataire' },
      { id: 'mention-user', label: 'Mentionner @', icon: LUCIDE_ICONS.users, category: 'action', description: 'Mentionner un participant dans le chat' },
      { id: 'add-participant', label: 'Inviter', icon: LUCIDE_ICONS['user-plus'], category: 'action', description: 'Inviter un participant au chat' },
      { id: 'view-comments', label: 'Commentaires Produit', icon: LUCIDE_ICONS.comments, category: 'action', description: 'Voir les avis et commentaires sur le produit' },
      { id: 'share-service', label: 'Partager Service', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager le service avec un contact' },
      { id: 'open-chatbot', label: 'Assistant IA', icon: LUCIDE_ICONS.help, category: 'help', description: 'Ouvrir l\'assistant IA pour aide sur le chat et les produits' },
    ],
    elements: [
      { id: 'message-input', type: 'input', label: 'Saisie de message', actionable: true },
      { id: 'send-button', type: 'button', label: 'Envoyer', icon: LUCIDE_ICONS.message, actionable: true },
      { id: 'media-buttons', type: 'button', label: 'Photo / Audio / Fichier', actionable: true },
      { id: 'call-buttons', type: 'button', label: 'Appel audio / vidéo', actionable: true },
      { id: 'ai-button', type: 'button', label: 'Assistant IA (icône ?)', icon: LUCIDE_ICONS.help, actionable: true },
      { id: 'product-gallery', type: 'card', label: 'Galerie produits du prestataire', actionable: true },
      { id: 'emoji-picker', type: 'button', label: 'Emojis', actionable: true },
      { id: 'participants-list', type: 'card', label: 'Liste des participants', actionable: true },
    ],
    guide: 'Chat avec un prestataire. Envoyez des messages texte, photos, fichiers ou messages vocaux. Passez des appels audio/vidéo. Négociez le prix directement dans le chat. Commandez un produit avec livraison. Mentionnez d\'autres participants avec @. L\'assistant IA intégré (bouton ?) répond à vos questions sur le service, les produits, les prix et les fonctionnalités du chat.',
  },

  // =========================================================================
  // PARTNER DASHBOARDS — Écrans de gestion des prestataires
  // =========================================================================

  SupermarketPartnerDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'manage-catalog', label: 'Catalogue', icon: LUCIDE_ICONS.package, category: 'action', description: 'Gérer le catalogue produits et stocks' },
      { id: 'manage-orders', label: 'Commandes', icon: LUCIDE_ICONS.clipboard, category: 'action', description: 'Traiter les commandes en cours' },
      { id: 'create-promo', label: 'Créer Promo', icon: LUCIDE_ICONS.tag, category: 'creation', description: 'Créer une promotion' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, category: 'navigation', description: 'Voir les statistiques de vente' },
      { id: 'verify-courier', label: 'Vérifier Coursier', icon: LUCIDE_ICONS.check, category: 'action', description: 'Vérifier un coursier pour la livraison' },
    ],
    elements: [
      { id: 'overview-tab', type: 'tab', label: 'Vue d\'ensemble', actionable: true },
      { id: 'catalog-tab', type: 'tab', label: 'Catalogue', actionable: true },
      { id: 'orders-tab', type: 'tab', label: 'Commandes', actionable: true },
      { id: 'promos-tab', type: 'tab', label: 'Promotions', actionable: true },
      { id: 'analytics-tab', type: 'tab', label: 'Statistiques', actionable: true },
    ],
    guide: 'Dashboard Supermarché. 5 onglets : vue d\'ensemble, catalogue (produits, stocks), commandes à traiter, promotions, statistiques. Vérifiez les coursiers pour la livraison.',
  },

  RestaurantDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'manage-menu', label: 'Menu', icon: LUCIDE_ICONS.utensils, category: 'action', description: 'Gérer le menu du restaurant' },
      { id: 'manage-orders', label: 'Commandes', icon: LUCIDE_ICONS.clipboard, category: 'action', description: 'Traiter les commandes' },
      { id: 'set-hours', label: 'Horaires', icon: LUCIDE_ICONS.clock, category: 'action', description: 'Définir les horaires d\'ouverture' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, category: 'navigation', description: 'Statistiques du restaurant' },
    ],
    elements: [
      { id: 'overview-tab', type: 'tab', label: 'Vue d\'ensemble', actionable: true },
      { id: 'menu-tab', type: 'tab', label: 'Menu', actionable: true },
      { id: 'orders-tab', type: 'tab', label: 'Commandes', actionable: true },
      { id: 'analytics-tab', type: 'tab', label: 'Statistiques', actionable: true },
    ],
    guide: 'Dashboard Restaurant. Gérez votre menu, traitez les commandes, définissez vos horaires et consultez les statistiques.',
  },

  FleetDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'manage-couriers', label: 'Mes Coursiers', icon: LUCIDE_ICONS.users, category: 'action', description: 'Gérer l\'équipe de coursiers' },
      { id: 'view-candidatures', label: 'Candidatures', icon: LUCIDE_ICONS['user-plus'], category: 'action', description: 'Voir les candidatures de coursiers' },
      { id: 'fleet-stats', label: 'Statistiques Flotte', icon: LUCIDE_ICONS.activity, category: 'navigation', description: 'Statistiques de la flotte' },
      { id: 'active-deliveries', label: 'Livraisons Actives', icon: LUCIDE_ICONS.truck, category: 'action', description: 'Suivre les livraisons en cours' },
    ],
    elements: [
      { id: 'couriers-list', type: 'card', label: 'Liste des coursiers', actionable: true },
      { id: 'stats-overview', type: 'card', label: 'Statistiques flotte', actionable: false },
    ],
    guide: 'Dashboard Flotte de livraison. Gérez vos coursiers (chauffeurs, livreurs, déménageurs), traitez les candidatures, suivez les livraisons en cours et consultez les statistiques.',
  },

  OrientationPartnerDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'manage-programs', label: 'Programmes', icon: LUCIDE_ICONS.book, category: 'action', description: 'Gérer les programmes scolaires' },
      { id: 'manage-students', label: 'Étudiants', icon: LUCIDE_ICONS.users, category: 'action', description: 'Gérer les inscriptions étudiants' },
      { id: 'events', label: 'Événements', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Gérer les événements (portes ouvertes, etc.)' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, category: 'navigation', description: 'Statistiques de l\'établissement' },
    ],
    elements: [],
    guide: 'Dashboard Établissement scolaire. Gérez vos programmes, inscriptions, événements et statistiques.',
  },

  LaboratoireForm: {
    type: 'form',
    actions: [
      { id: 'manage-exams', label: 'Examens', icon: LUCIDE_ICONS.clipboard, category: 'action', description: 'Gérer le catalogue d\'examens' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'LabAnalytics', category: 'navigation', description: 'Statistiques du laboratoire' },
      { id: 'ai-analysis', label: 'Analyse IA', icon: LUCIDE_ICONS.activity, route: 'LabAIAnalysis', category: 'help', description: 'Outils IA d\'analyse' },
    ],
    elements: [],
    guide: 'Gestion de votre laboratoire. Configurez vos examens, tarifs, horaires. L\'IA peut assister l\'analyse des résultats.',
  },

  BanqueSangForm: {
    type: 'form',
    actions: [
      { id: 'manage-stock', label: 'Stock Sanguin', icon: LUCIDE_ICONS.droplet, category: 'action', description: 'Gérer le stock de poches de sang' },
      { id: 'manage-groups', label: 'Groupes Sanguins', icon: LUCIDE_ICONS.list, route: 'BloodGroupManagement', category: 'action', description: 'Gérer les groupes sanguins disponibles' },
      { id: 'donation-matches', label: 'Correspondances', icon: LUCIDE_ICONS.users, route: 'BloodDonationMatches', category: 'action', description: 'Voir les correspondances donneur/receveur' },
    ],
    elements: [],
    guide: 'Gestion de votre banque de sang. Gérez le stock, les groupes sanguins disponibles et les correspondances donneur/receveur.',
  },

  CovoiturageForm: {
    type: 'form',
    actions: [
      { id: 'create-trip', label: 'Nouveau Trajet', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Proposer un nouveau trajet' },
      { id: 'my-trips', label: 'Mes Trajets', icon: LUCIDE_ICONS.list, category: 'navigation', description: 'Voir mes trajets proposés' },
      { id: 'reservations', label: 'Réservations', icon: LUCIDE_ICONS.clipboard, route: 'MesReservationsCovoiturage', category: 'action', description: 'Gérer les réservations passagers' },
      { id: 'stats', label: 'Statistiques', icon: LUCIDE_ICONS.activity, category: 'navigation', description: 'Statistiques de covoiturage' },
    ],
    elements: [],
    guide: 'Gestion covoiturage. Proposez des trajets, gérez les réservations des passagers et consultez vos statistiques.',
  },

  ImmobilierForm: {
    type: 'form',
    actions: [
      { id: 'add-property', label: 'Publier Annonce', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Publier une annonce immobilière' },
      { id: 'my-properties', label: 'Mes Biens', icon: LUCIDE_ICONS.list, category: 'navigation', description: 'Gérer mes biens en ligne' },
      { id: 'reservations', label: 'Réservations', icon: LUCIDE_ICONS.calendar, route: 'PrestataireReservations', category: 'action', description: 'Gérer les réservations' },
    ],
    elements: [],
    guide: 'Gestion immobilière. Publiez des annonces, gérez vos biens et les réservations des locataires.',
  },

  OffresEmploiForm: {
    type: 'form',
    actions: [
      { id: 'create-offer', label: 'Publier Offre', icon: LUCIDE_ICONS.add, route: 'CreateOffre', category: 'creation', description: 'Publier une offre d\'emploi' },
      { id: 'manage-candidatures', label: 'Candidatures', icon: LUCIDE_ICONS.users, category: 'action', description: 'Gérer les candidatures reçues' },
    ],
    elements: [],
    guide: 'Gestion offres d\'emploi. Publiez des offres et gérez les candidatures des candidats.',
  },

  GestionServicesSpecialises: {
    type: 'dashboard',
    actions: [
      { id: 'add-service', label: 'Ajouter Service', icon: LUCIDE_ICONS.add, route: 'CreationService', category: 'creation', description: 'Créer un nouveau service' },
      { id: 'filter-services', label: 'Filtrer', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Filtrer mes services par catégorie' },
      { id: 'map-view', label: 'Vue Carte', icon: LUCIDE_ICONS.map, category: 'action', description: 'Voir mes services sur la carte' },
    ],
    elements: [],
    guide: 'Liste de vos services spécialisés. Filtrez, triez et gérez tous vos services. Mode carte ou liste.',
  },

  // =========================================================================
  // USER-FACING — Écrans de recherche et consommation de services
  // =========================================================================

  PharmacieDetails: {
    type: 'detail',
    actions: [
      { id: 'order-meds', label: 'Commander', icon: LUCIDE_ICONS['shopping-cart'], category: 'action', description: 'Commander des médicaments' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter la pharmacie' },
      { id: 'call', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appeler la pharmacie' },
      { id: 'itinerary', label: 'Itinéraire', icon: LUCIDE_ICONS.location, route: 'Navigation', category: 'navigation', description: 'Se rendre à la pharmacie' },
      { id: 'ai-analysis', label: 'Analyse IA', icon: LUCIDE_ICONS.activity, route: 'PharmacyAIInteractions', category: 'help', description: 'Analyse IA des médicaments (dosage, interactions)' },
    ],
    elements: [],
    guide: 'Détails d\'une pharmacie. Commandez des médicaments, contactez la pharmacie, obtenez l\'itinéraire. L\'IA analyse les dosages et interactions.',
  },

  HopitalDetails: {
    type: 'detail',
    actions: [
      { id: 'book-appointment', label: 'Prendre RDV', icon: LUCIDE_ICONS.calendar, route: 'BookAppointment', category: 'action', description: 'Prendre rendez-vous' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter l\'hôpital' },
      { id: 'call', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appeler l\'hôpital' },
      { id: 'itinerary', label: 'Itinéraire', icon: LUCIDE_ICONS.location, route: 'Navigation', category: 'navigation', description: 'Se rendre à l\'hôpital' },
    ],
    elements: [],
    guide: 'Détails d\'un hôpital. Prenez rendez-vous, consultez les spécialités, contactez directement ou obtenez l\'itinéraire.',
  },

  LaboratoireDetails: {
    type: 'detail',
    actions: [
      { id: 'book-exam', label: 'Réserver Examen', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Réserver un examen' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter le laboratoire' },
      { id: 'itinerary', label: 'Itinéraire', icon: LUCIDE_ICONS.location, route: 'Navigation', category: 'navigation', description: 'Se rendre au laboratoire' },
    ],
    elements: [],
    guide: 'Détails d\'un laboratoire. Réservez un examen, consultez les tarifs, contactez ou obtenez l\'itinéraire.',
  },

  BanqueSangDetails: {
    type: 'detail',
    actions: [
      { id: 'donate', label: 'Donner du Sang', icon: LUCIDE_ICONS.droplet, route: 'BloodDonationRequest', category: 'action', description: 'Faire un don de sang' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter la banque de sang' },
      { id: 'itinerary', label: 'Itinéraire', icon: LUCIDE_ICONS.location, route: 'Navigation', category: 'navigation', description: 'Se rendre à la banque de sang' },
    ],
    elements: [],
    guide: 'Détails d\'une banque de sang. Faites un don, vérifiez la compatibilité, contactez ou obtenez l\'itinéraire.',
  },

  TaxiBooking: {
    type: 'form',
    actions: [
      { id: 'confirm-booking', label: 'Confirmer Course', icon: LUCIDE_ICONS.check, category: 'action', description: 'Confirmer la réservation du taxi' },
      { id: 'change-destination', label: 'Modifier Destination', icon: LUCIDE_ICONS.edit, category: 'action', description: 'Changer l\'adresse de destination' },
    ],
    elements: [
      { id: 'pickup-input', type: 'input', label: 'Adresse de départ', actionable: true },
      { id: 'dropoff-input', type: 'input', label: 'Adresse d\'arrivée', actionable: true },
    ],
    guide: 'Réservation de taxi. Saisissez votre départ et destination, confirmez pour commander un taxi.',
  },

  TaxiTracking: {
    type: 'detail',
    actions: [
      { id: 'contact-driver', label: 'Contacter Chauffeur', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appeler le chauffeur' },
      { id: 'cancel-ride', label: 'Annuler Course', icon: LUCIDE_ICONS.x, category: 'action', description: 'Annuler la course en cours' },
      { id: 'share-location', label: 'Partager Position', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager votre position en temps réel' },
    ],
    elements: [
      { id: 'map-tracking', type: 'card', label: 'Carte de suivi temps réel', actionable: false },
    ],
    guide: 'Suivi de votre course en temps réel. Suivez le chauffeur sur la carte, contactez-le ou annulez la course.',
  },

  CovoiturageDetails: {
    type: 'detail',
    actions: [
      { id: 'book-seat', label: 'Réserver Place', icon: LUCIDE_ICONS.check, route: 'CovoiturageBooking', category: 'action', description: 'Réserver une place' },
      { id: 'contact-driver', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter le conducteur' },
    ],
    elements: [],
    guide: 'Détails d\'un trajet de covoiturage. Réservez une place, contactez le conducteur, consultez l\'itinéraire.',
  },

  CovoiturageBooking: {
    type: 'form',
    actions: [
      { id: 'confirm', label: 'Confirmer Réservation', icon: LUCIDE_ICONS.check, category: 'action', description: 'Confirmer la réservation' },
    ],
    elements: [],
    guide: 'Confirmation de réservation covoiturage. Vérifiez les détails et confirmez votre place.',
  },

  AgenceVoyageDetails: {
    type: 'detail',
    actions: [
      { id: 'book-trip', label: 'Réserver Voyage', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Réserver un voyage' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter l\'agence' },
      { id: 'view-schedules', label: 'Horaires', icon: LUCIDE_ICONS.clock, category: 'navigation', description: 'Voir les horaires' },
    ],
    elements: [],
    guide: 'Détails d\'une agence de voyage. Réservez un voyage, consultez les horaires et contactez l\'agence.',
  },

  HotelBooking: {
    type: 'form',
    actions: [
      { id: 'confirm-booking', label: 'Confirmer Réservation', icon: LUCIDE_ICONS.check, category: 'action', description: 'Confirmer la réservation' },
      { id: 'payment', label: 'Payer', icon: LUCIDE_ICONS['credit-card'], route: 'HotelBookingPayment', category: 'action', description: 'Procéder au paiement' },
    ],
    elements: [
      { id: 'date-picker', type: 'input', label: 'Dates de séjour', actionable: true },
      { id: 'room-selector', type: 'card', label: 'Choix de chambre', actionable: true },
    ],
    guide: 'Réservation hôtelière. Choisissez vos dates, sélectionnez une chambre et procédez au paiement.',
  },

  ImmobilierDetails: {
    type: 'detail',
    actions: [
      { id: 'book-visit', label: 'Réserver Visite', icon: LUCIDE_ICONS.calendar, route: 'ImmobilierBooking', category: 'action', description: 'Réserver une visite' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter le propriétaire' },
      { id: 'compare', label: 'Comparer', icon: LUCIDE_ICONS.list, route: 'ImmobilierCompare', category: 'action', description: 'Ajouter à la comparaison' },
      { id: 'alert', label: 'Alerte Prix', icon: LUCIDE_ICONS.bell, route: 'ImmobilierPriceAlerts', category: 'action', description: 'Créer une alerte de prix' },
    ],
    elements: [],
    guide: 'Détails d\'un bien immobilier. Réservez une visite, contactez le propriétaire, comparez avec d\'autres biens ou créez une alerte de prix.',
  },

  BusTicketBooking: {
    type: 'form',
    actions: [
      { id: 'select-seat', label: 'Choisir Place', icon: LUCIDE_ICONS.check, category: 'action', description: 'Sélectionner un siège' },
      { id: 'pay', label: 'Payer', icon: LUCIDE_ICONS['credit-card'], route: 'BusTicketPayment', category: 'action', description: 'Payer le billet' },
    ],
    elements: [
      { id: 'trip-selector', type: 'card', label: 'Sélection du voyage', actionable: true },
      { id: 'seat-map', type: 'card', label: 'Plan des sièges', actionable: true },
    ],
    guide: 'Réservation de billet de bus. Sélectionnez le voyage, choisissez votre siège et procédez au paiement.',
  },

  BusTicketQR: {
    type: 'detail',
    actions: [
      { id: 'share-ticket', label: 'Partager Billet', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager le QR code du billet' },
    ],
    elements: [
      { id: 'qr-code', type: 'card', label: 'QR Code du billet', actionable: false },
    ],
    guide: 'Votre QR code de billet de bus. Présentez-le à l\'embarquement. Vous pouvez le partager.',
  },

  OffreDetails: {
    type: 'detail',
    actions: [
      { id: 'apply', label: 'Postuler', icon: LUCIDE_ICONS.check, category: 'action', description: 'Postuler à cette offre' },
      { id: 'cv-analysis', label: 'Analyse CV', icon: LUCIDE_ICONS.file, route: 'AICVAnalysis', category: 'help', description: 'Analyser la compatibilité de votre CV' },
      { id: 'share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager l\'offre' },
    ],
    elements: [],
    guide: 'Détails d\'une offre d\'emploi. Postulez directement, analysez la compatibilité de votre CV avec l\'IA, ou partagez l\'offre.',
  },

  EtablissementDetails: {
    type: 'detail',
    actions: [
      { id: 'ai-compare', label: 'Comparer IA', icon: LUCIDE_ICONS.activity, route: 'OrientationAIComparePrograms', category: 'help', description: 'Comparer les programmes avec l\'IA' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter l\'établissement' },
      { id: 'student-xp', label: 'Expériences', icon: LUCIDE_ICONS.users, route: 'ExperiencesEtudiants', category: 'navigation', description: 'Lire les expériences d\'étudiants' },
    ],
    elements: [],
    guide: 'Détails d\'un établissement scolaire. Comparez les programmes avec l\'IA, contactez l\'établissement, lisez les expériences d\'étudiants.',
  },

  LivreScolaireDetails: {
    type: 'detail',
    actions: [
      { id: 'buy', label: 'Acheter', icon: LUCIDE_ICONS['shopping-cart'], category: 'action', description: 'Acheter ce livre' },
      { id: 'contact-seller', label: 'Contacter Vendeur', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter le vendeur' },
      { id: 'ai-price', label: 'Prix IA', icon: LUCIDE_ICONS.dollar, category: 'help', description: 'Vérifier le juste prix avec l\'IA' },
    ],
    elements: [],
    guide: 'Détails d\'un livre scolaire. Achetez, contactez le vendeur ou vérifiez le prix avec l\'IA.',
  },

  TrocDetails: {
    type: 'detail',
    actions: [
      { id: 'propose-exchange', label: 'Proposer Échange', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Proposer un échange' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter le propriétaire' },
    ],
    elements: [],
    guide: 'Détails d\'un objet à troquer. Proposez un échange ou contactez le propriétaire.',
  },

  RecipeDetails: {
    type: 'detail',
    actions: [
      { id: 'add-to-menu', label: 'Ajouter au Menu', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Ajouter cette recette au menu de la semaine' },
      { id: 'shopping-list', label: 'Liste Courses', icon: LUCIDE_ICONS.list, route: 'ShoppingList', category: 'action', description: 'Ajouter les ingrédients à la liste de courses' },
    ],
    elements: [],
    guide: 'Détails d\'une recette. Ajoutez-la au menu de la semaine ou générez la liste de courses des ingrédients.',
  },

  // Écrans de recherche/liste avec fonctionnalités spécifiques
  BayamSelamSearch: {
    type: 'search',
    actions: [
      { id: 'compare-prices', label: 'Comparer', icon: LUCIDE_ICONS.list, category: 'action', description: 'Comparer les prix entre marchés' },
    ],
    elements: [
      { id: 'search-input', type: 'input', label: 'Recherche produit', actionable: true },
    ],
    guide: 'BayamSelam — Comparez les prix des produits entre différents marchés et supermarchés pour trouver le meilleur prix.',
  },

  HealthServicesHub: {
    type: 'specialized',
    actions: [
      { id: 'pharmacy', label: 'Pharmacie', icon: LUCIDE_ICONS.pharmacy, route: 'PharmacieSearch', category: 'navigation', description: 'Rechercher des pharmacies' },
      { id: 'hospital', label: 'Hôpital', icon: LUCIDE_ICONS.hospital, route: 'HopitalSearch', category: 'navigation', description: 'Rechercher des hôpitaux' },
      { id: 'lab', label: 'Laboratoire', icon: LUCIDE_ICONS.activity, route: 'LaboratoireSearch', category: 'navigation', description: 'Rechercher des laboratoires' },
    ],
    elements: [],
    guide: 'Hub Santé. Accédez à toutes les catégories de soins : pharmacies, hôpitaux et laboratoires d\'analyses.',
  },

  // =========================================================================
  // DELIVERY / COURSES — Écrans de livraison et commande de courses
  // =========================================================================

  DeliveryParcelFlowNew: {
    type: 'form',
    actions: [
      { id: 'select-type', label: 'Type de Colis', icon: LUCIDE_ICONS.package, category: 'action', description: 'Choisir le type : document, colis, déménagement, gâteau' },
      { id: 'set-pickup', label: 'Adresse Récupération', icon: LUCIDE_ICONS.location, category: 'action', description: 'Définir l\'adresse de récupération' },
      { id: 'set-dropoff', label: 'Adresse Livraison', icon: LUCIDE_ICONS.location, category: 'action', description: 'Définir l\'adresse de livraison' },
      { id: 'add-insurance', label: 'Assurance', icon: LUCIDE_ICONS.shield, category: 'action', description: 'Ajouter une assurance colis' },
      { id: 'confirm', label: 'Confirmer Envoi', icon: LUCIDE_ICONS.check, category: 'action', description: 'Confirmer l\'envoi du colis' },
    ],
    elements: [
      { id: 'parcel-type-selector', type: 'button', label: 'Type de colis (document, package, déménagement, gâteau)', actionable: true },
      { id: 'weight-input', type: 'input', label: 'Poids et dimensions', actionable: true },
      { id: 'address-inputs', type: 'input', label: 'Adresses pickup/dropoff', actionable: true },
    ],
    guide: 'Envoi de colis. Choisissez le type de colis, renseignez le poids et les dimensions, définissez les adresses de récupération et livraison. Option aller-retour et assurance disponibles.',
  },

  DeliveryShoppingFlowNew: {
    type: 'form',
    actions: [
      { id: 'select-store', label: 'Choisir Magasin', icon: LUCIDE_ICONS.building2, category: 'action', description: 'Sélectionner le supermarché' },
      { id: 'build-basket', label: 'Composer Panier', icon: LUCIDE_ICONS['shopping-cart'], route: 'ShoppingBasket', category: 'action', description: 'Composer votre panier de courses' },
      { id: 'set-budget', label: 'Définir Budget', icon: LUCIDE_ICONS.dollar, route: 'ShoppingBudget', category: 'action', description: 'Définir votre budget maximum' },
      { id: 'set-address', label: 'Adresse Livraison', icon: LUCIDE_ICONS.location, route: 'ShoppingPickupDrop', category: 'action', description: 'Définir l\'adresse de livraison' },
      { id: 'confirm', label: 'Confirmer Commande', icon: LUCIDE_ICONS.check, route: 'ShoppingSummary', category: 'action', description: 'Confirmer et envoyer la commande' },
    ],
    elements: [
      { id: 'store-selector', type: 'card', label: 'Sélection du magasin', actionable: true },
      { id: 'basket-preview', type: 'card', label: 'Aperçu du panier', actionable: true },
    ],
    guide: 'Commande de courses avec livraison. Sélectionnez un supermarché, composez votre panier, définissez votre budget et adresse de livraison. Un coursier fera vos courses et les livrera chez vous.',
  },

  ShoppingBasket: {
    type: 'form',
    actions: [
      { id: 'add-item', label: 'Ajouter Article', icon: LUCIDE_ICONS.add, category: 'action', description: 'Ajouter un article au panier' },
      { id: 'clear-basket', label: 'Vider Panier', icon: LUCIDE_ICONS.delete, category: 'action', description: 'Vider le panier' },
      { id: 'proceed', label: 'Continuer', icon: LUCIDE_ICONS.forward, category: 'action', description: 'Passer à l\'étape suivante' },
    ],
    elements: [
      { id: 'items-list', type: 'card', label: 'Articles du panier', actionable: true },
      { id: 'total', type: 'card', label: 'Total estimé', actionable: false },
    ],
    guide: 'Composition du panier de courses. Ajoutez des articles avec quantités. Suggestions automatiques de produits.',
  },

  ShoppingBudget: {
    type: 'form',
    actions: [
      { id: 'set-budget', label: 'Définir Budget', icon: LUCIDE_ICONS.dollar, category: 'action', description: 'Saisir le budget maximum' },
      { id: 'proceed', label: 'Continuer', icon: LUCIDE_ICONS.forward, category: 'action', description: 'Passer à l\'étape suivante' },
    ],
    elements: [
      { id: 'budget-input', type: 'input', label: 'Budget maximum (FCFA)', actionable: true },
      { id: 'comment-input', type: 'input', label: 'Commentaire pour le coursier', actionable: true },
    ],
    guide: 'Définition du budget. Saisissez le montant maximum que le coursier peut dépenser. Ajoutez un commentaire si besoin.',
  },

  ShoppingSummary: {
    type: 'detail',
    actions: [
      { id: 'confirm-order', label: 'Confirmer Commande', icon: LUCIDE_ICONS.check, category: 'action', description: 'Confirmer et envoyer la commande' },
      { id: 'edit-basket', label: 'Modifier Panier', icon: LUCIDE_ICONS.edit, category: 'action', description: 'Retourner modifier le panier' },
    ],
    elements: [
      { id: 'order-summary', type: 'card', label: 'Récapitulatif de la commande', actionable: false },
    ],
    guide: 'Récapitulatif de commande de courses. Vérifiez le panier, le budget, les adresses et confirmez.',
  },

  DeliveryShoppingTracking: {
    type: 'detail',
    actions: [
      { id: 'contact-courier', label: 'Contacter Coursier', icon: LUCIDE_ICONS.message, category: 'action', description: 'Envoyer un message au coursier' },
      { id: 'call-courier', label: 'Appeler Coursier', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appeler le coursier' },
      { id: 'view-basket', label: 'Voir Panier', icon: LUCIDE_ICONS['shopping-cart'], category: 'action', description: 'Consulter le contenu du panier' },
    ],
    elements: [
      { id: 'tracking-timeline', type: 'card', label: 'Timeline de suivi', actionable: false },
      { id: 'courier-info', type: 'card', label: 'Informations coursier', actionable: true },
    ],
    guide: 'Suivi de votre commande de courses. Suivez l\'avancement en temps réel, contactez le coursier, consultez le panier.',
  },

  CourierRegistration: {
    type: 'form',
    actions: [
      { id: 'submit', label: 'S\'inscrire', icon: LUCIDE_ICONS.check, category: 'action', description: 'Soumettre la candidature de coursier' },
    ],
    elements: [
      { id: 'registration-form', type: 'input', label: 'Formulaire d\'inscription coursier', actionable: true },
    ],
    guide: 'Inscription coursier. Renseignez vos informations et véhicule pour devenir coursier Yukpo.',
  },

  DeliveryProof: {
    type: 'form',
    actions: [
      { id: 'take-photo', label: 'Prendre Photo', icon: LUCIDE_ICONS.camera, category: 'action', description: 'Photographier la livraison comme preuve' },
      { id: 'confirm-delivery', label: 'Confirmer Livraison', icon: LUCIDE_ICONS.check, category: 'action', description: 'Confirmer que la livraison est effectuée' },
    ],
    elements: [],
    guide: 'Preuve de livraison. Prenez une photo et/ou obtenez la signature du client pour confirmer la livraison.',
  },

  // =========================================================================
  // SEARCH / LIST generics (many screens follow this pattern)
  // =========================================================================

  PharmacieList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'PharmacieSearch', category: 'search', description: 'Affiner la recherche' }], elements: [{ id: 'list', type: 'card', label: 'Liste des pharmacies', actionable: true }], guide: 'Liste des pharmacies. Sélectionnez une pharmacie pour voir ses détails, produits et contacter.' },
  HopitalList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'HopitalSearch', category: 'search', description: 'Affiner la recherche' }], elements: [{ id: 'list', type: 'card', label: 'Liste des hôpitaux', actionable: true }], guide: 'Liste des hôpitaux. Sélectionnez un hôpital pour voir ses détails et prendre rendez-vous.' },
  LaboratoireList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'LaboratoireSearch', category: 'search', description: 'Affiner la recherche' }], elements: [{ id: 'list', type: 'card', label: 'Liste des laboratoires', actionable: true }], guide: 'Liste des laboratoires. Sélectionnez un laboratoire pour réserver un examen.' },
  BanqueSangList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'BanqueSangSearch', category: 'search', description: 'Affiner la recherche' }], elements: [{ id: 'list', type: 'card', label: 'Liste des banques de sang', actionable: true }], guide: 'Liste des banques de sang. Vérifiez la disponibilité des groupes sanguins.' },
  TaxiList: { type: 'list', actions: [{ id: 'book', label: 'Réserver', icon: LUCIDE_ICONS.car, route: 'TaxiBooking', category: 'action', description: 'Réserver un taxi' }], elements: [{ id: 'list', type: 'card', label: 'Taxis disponibles', actionable: true }], guide: 'Liste des taxis disponibles. Sélectionnez un taxi pour réserver une course.' },
  CovoiturageList: { type: 'list', actions: [{ id: 'book', label: 'Réserver', icon: LUCIDE_ICONS.users, category: 'action', description: 'Réserver une place' }], elements: [{ id: 'list', type: 'card', label: 'Trajets disponibles', actionable: true }], guide: 'Liste des trajets de covoiturage. Réservez une place auprès d\'un conducteur.' },
  AgenceVoyageList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'AgenceVoyageSearch', category: 'search', description: 'Affiner la recherche' }], elements: [{ id: 'list', type: 'card', label: 'Agences de voyage', actionable: true }], guide: 'Liste des agences de voyage. Consultez les offres et réservez.' },
  ImmobilierList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'ImmobilierSearch', category: 'search', description: 'Affiner la recherche' }, { id: 'compare', label: 'Comparer', icon: LUCIDE_ICONS.list, route: 'ImmobilierCompare', category: 'action', description: 'Comparer des biens' }], elements: [{ id: 'list', type: 'card', label: 'Biens immobiliers', actionable: true }], guide: 'Liste des biens immobiliers. Comparez les prix, réservez une visite.' },
  LivreScolaireList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'LivreScolaireSearch', category: 'search', description: 'Rechercher un livre' }], elements: [{ id: 'list', type: 'card', label: 'Livres scolaires', actionable: true }], guide: 'Liste des livres scolaires disponibles. Achetez ou contactez le vendeur.' },
  OffreList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'OffreSearch', category: 'search', description: 'Rechercher une offre' }], elements: [{ id: 'list', type: 'card', label: 'Offres d\'emploi', actionable: true }], guide: 'Liste des offres d\'emploi. Postulez directement ou analysez la compatibilité de votre CV.' },
};

export const useScreenContext = (currentRouteName?: string, routeParams?: any): ScreenContext => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguageSafe();

  const screenName = currentRouteName || 'Unknown';

  const getScreenType = useCallback((): ScreenContext['screenType'] => {
    const config = SCREEN_CONFIGS[screenName];
    if (config) return config.type;

    if (screenName.includes('Home') || screenName === 'Home') return 'home';
    if (screenName.includes('Search') || screenName.includes('Recherche') || screenName.includes('List')) return 'search';
    if (screenName.includes('Form') || screenName.includes('Create') || screenName.includes('Creation') || screenName.includes('Register')) return 'form';
    if (screenName.includes('Detail') || screenName.includes('Details')) return 'detail';
    if (screenName.includes('Dashboard') || screenName.includes('Gestion') || screenName.includes('Management') || screenName.includes('Admin')) return 'dashboard';
    if (screenName.includes('Chat')) return 'chat';
    if (screenName.includes('Pharmacie') || screenName.includes('Hopital') ||
      screenName.includes('Hotel') || screenName.includes('Taxi') ||
      screenName.includes('Covoiturage') || screenName.includes('Laboratoire') ||
      screenName.includes('Assurance') || screenName.includes('Immobilier') ||
      screenName.includes('Bus') || screenName.includes('Blood') ||
      screenName.includes('Orientation') || screenName.includes('Emploi')) return 'specialized';
    return 'home';
  }, [screenName]);

  const getScreenSpecificActions = useCallback((): ActionDescriptor[] => {
    const config = SCREEN_CONFIGS[screenName];
    return config?.actions || [];
  }, [screenName]);

  const getVisibleElements = useCallback((): UIElement[] => {
    const config = SCREEN_CONFIGS[screenName];
    const base: UIElement[] = [
      { id: 'header-back', type: 'button', label: 'Retour', icon: LUCIDE_ICONS.back, actionable: true },
    ];
    return [...base, ...(config?.elements || [])];
  }, [screenName]);

  const getGuideText = useCallback((): string => {
    const config = SCREEN_CONFIGS[screenName];
    return config?.guide || `Écran ${screenName}. Demandez-moi comment utiliser les fonctionnalités disponibles ici.`;
  }, [screenName]);

  const screenType = useMemo(() => getScreenType(), [getScreenType]);
  const specificActions = useMemo(() => getScreenSpecificActions(), [getScreenSpecificActions]);
  const visibleElements = useMemo(() => getVisibleElements(), [getVisibleElements]);
  const guideText = useMemo(() => getGuideText(), [getGuideText]);

  const context: ScreenContext = useMemo(() => ({
    screenName,
    screenType,
    availableActions: [...GLOBAL_ACTIONS, ...specificActions],
    visibleElements,
    userData: user,
    serviceData: routeParams,
    currentRoute: currentRouteName,
    guideText,
  }), [screenName, screenType, specificActions, visibleElements, user, routeParams, currentRouteName, guideText]);

  return context;
};
