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
  'list-checks': 'list-checks',
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
  'repeat': 'repeat',
  'download': 'download',
  'upload': 'upload',
  'eye': 'eye',
  'filter': 'sliders',
  'bell': 'bell',
  'clock': 'clock',
  'award': 'award',
};

const getGlobalActions = (t: (key: string) => string): ActionDescriptor[] => [
  {
    id: 'home',
    label: t('useScreenContext.home') || 'Accueil',
    icon: LUCIDE_ICONS.home,
    route: 'Home',
    category: 'navigation',
    description: t('useScreenContext.homeDesc') || 'Retourner à la page d\'accueil',
  },
  {
    id: 'search',
    label: t('useScreenContext.search') || 'Recherche',
    icon: LUCIDE_ICONS.search,
    route: 'RechercheBesoin',
    category: 'search',
    description: t('useScreenContext.searchDesc') || 'Rechercher des services ou produits',
  },
  {
    id: 'profile',
    label: t('useScreenContext.profile') || 'Mon Profil',
    icon: LUCIDE_ICONS.profile,
    route: 'Profile',
    category: 'navigation',
    description: t('useScreenContext.profileDesc') || 'Voir et modifier mon profil',
  },
  {
    id: 'services',
    label: t('useScreenContext.services') || 'Mes Services',
    icon: LUCIDE_ICONS.briefcase,
    route: 'MesServices',
    category: 'navigation',
    description: t('useScreenContext.servicesDesc') || 'Hub produits moderne (MesServicesScreen) — route pile **MesServices** ou onglet **Services** ; pas la route **ServicesActivity** (ancien écran).',
  },
];

/** MesServicesScreen : onglet `Services` (barre du bas) = même UI que la route pile `MesServices`. */
const MES_SERVICES_TAB_CONFIG: {
  type: ScreenContext['screenType'];
  actions: ActionDescriptor[];
  elements: UIElement[];
  guide: string;
} = {
  type: 'dashboard',
  actions: [
    { id: 'ms-sidebar', label: 'Menu latéral (☰)', icon: LUCIDE_ICONS.menu, category: 'action', description: 'SidebarNavigation : créer produit, galerie médias, équipe, stats, pub, vidéos, live, promos, réglages' },
    { id: 'ms-video-intro', label: 'Intro création vidéo', icon: LUCIDE_ICONS.add, route: 'VideoCreationIntro', category: 'creation', description: 'Premier bouton + du bandeau : parcours vidéo' },
    { id: 'ms-flash-header', label: 'Flash promo (éclair)', icon: 'zap', category: 'action', description: 'Sélection produits puis CreateFlashPromo (un ou plusieurs)' },
    { id: 'ms-delivery-header', label: 'Config livraison globale', icon: LUCIDE_ICONS.truck, category: 'action', description: 'Sélection produits → GlobalDeliveryConfigModal' },
    { id: 'ms-bulk', label: 'Sélection multiple', icon: LUCIDE_ICONS.check, category: 'action', description: 'Mode bulk + BulkActionsBar (activer/désactiver/supprimer en masse)' },
    { id: 'ms-add-product', label: 'Ajouter un produit', icon: LUCIDE_ICONS.add, category: 'creation', description: 'handleAddProduct : si service existe → AjouterProduitSimple ; sinon → FormulaireYukpoIntelligent (focus produit)' },
    { id: 'ms-mesproduits', label: 'Gérer produits (écran détaillé)', icon: LUCIDE_ICONS.package, route: 'MesProduits', category: 'navigation', description: 'Bouton pied de liste / carte — MesProduitsScreen (catalogue avancé, médias, livraison unitaire)' },
    { id: 'ms-analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'AnalyticsDashboard', category: 'navigation', description: 'Dashboard analytique' },
    { id: 'ms-publicite', label: 'Mes publicités', icon: LUCIDE_ICONS.eye, route: 'PubliciteDashboard', category: 'navigation', description: 'Campagnes pub' },
    { id: 'ms-new-ad', label: 'Nouvelle publicité', icon: LUCIDE_ICONS.add, route: 'CreatePublicite', category: 'creation', description: 'Création pub' },
    { id: 'ms-video-feed', label: 'Mes vidéos', icon: LUCIDE_ICONS.video, route: 'VideoFeed', category: 'navigation', description: 'Fil vidéos créées (navigation parent si besoin)' },
    { id: 'ms-live', label: 'Démarrer un live', icon: LUCIDE_ICONS.video, route: 'StartLive', category: 'creation', description: 'Live streaming' },
    { id: 'ms-video-analytics', label: 'Analytiques vidéos', icon: LUCIDE_ICONS.activity, route: 'VideoAnalytics', category: 'navigation', description: 'Stats vidéo' },
    { id: 'ms-black-friday', label: 'Promo Black Friday', icon: LUCIDE_ICONS.star, route: 'GlobalPromoSubmission', category: 'navigation', description: 'Soumission promo globale' },
    { id: 'ms-flash-active', label: 'Flash promos actifs', icon: 'zap', route: 'FlashPromosActive', category: 'navigation', description: 'Voir flashs en cours' },
    { id: 'ms-settings', label: 'Paramètres', icon: LUCIDE_ICONS.settings, route: 'Settings', category: 'navigation', description: 'Réglages app' },
    { id: 'ms-home', label: 'Accueil', icon: LUCIDE_ICONS.home, route: 'Home', category: 'navigation', description: 'Fil d’Ariane / bouton retour accueil' },
    { id: 'ms-team', label: 'Équipe (par service)', icon: LUCIDE_ICONS.users, category: 'action', description: 'ServiceTeamModal après sélection produits (serviceId parent)' },
    { id: 'ms-gallery', label: 'Galerie médias produits', icon: LUCIDE_ICONS.camera, category: 'action', description: 'ProductGalleryModal' },
    { id: 'ms-card-edit', label: 'Carte produit — modifier service', icon: LUCIDE_ICONS.edit, route: 'FormulaireYukpoIntelligent', category: 'action', description: 'ServiceCardModern → FormulaireYukpoIntelligent mode edit (fromMesServices)' },
    { id: 'ms-card-promo', label: 'Carte — promotions', icon: LUCIDE_ICONS.tag, category: 'action', description: 'Alerte CreateFlashPromo ou Formulaire focus promotion' },
    { id: 'ms-share', label: 'Partager fiche', icon: LUCIDE_ICONS.share, category: 'action', description: 'Share natif lien yukpomnang.com/service/{id}' },
    { id: 'ms-toggle-status', label: 'Activer / désactiver', icon: LUCIDE_ICONS.check, category: 'action', description: 'apiPatch toggle-status ; réactivation peut coûter 1000 FCFA (solde)' },
    { id: 'ms-delete', label: 'Supprimer', icon: LUCIDE_ICONS.delete, category: 'action', description: 'apiDelete ; bloqué si ≥2 produits (backend)' },
  ],
  elements: [
    { id: 'ms-header-gradient', type: 'card', label: 'En-tête gradient « Produits »', actionable: false },
    { id: 'ms-breadcrumbs', type: 'card', label: 'Fil d’Ariane Accueil → Produits', actionable: true },
    { id: 'ms-stats-cards', type: 'card', label: 'StatsCard (total, actifs, inactifs, vues)', actionable: true },
    { id: 'ms-filter-chips', type: 'tab', label: 'Filtres Tous / Actif / Inactif', actionable: true },
    { id: 'ms-flashlist', type: 'card', label: 'FlashList ServiceCardModern (cartes produit)', actionable: true },
    { id: 'ms-pull-refresh', type: 'button', label: 'Tirer pour rafraîchir', icon: LUCIDE_ICONS.refresh, actionable: true },
    { id: 'ms-modals', type: 'modal', label: 'Modales : équipe, sélecteur produits, livraison globale, vidéo, galerie', actionable: true },
  ],
  guide: '**Mes services (Produits)** = `MesServicesScreen`. L’onglet barre du bas s’appelle **`Services`** (c’est l’écran enrichi moderne). La route pile **`MesServices`** ouvre la même UI. **Ne pas** utiliser la route **`ServicesActivity`** (ancien `ServicesScreen`). Données : `GET /api/prestataire/services` puis produits par `productsService.getProductsByService` (fallback parsing JSON legacy). Rafraîchissement sur `service:refresh`, `product:created`, `product:updated`. L’écran **`MesProduits`** est un complément (vue catalogue détaillée) accessible depuis le pied de liste ou la carte, pas l’onglet principal.',
};

/** Liste utilisateur hôtels / meublés — `HotelMeubleHomeScreen` (routes `HotelMeubleHome`, `HotelSearch`, `MeubleSearch`). */
const HOTEL_MEUBLE_USER_HUB_CONFIG: {
  type: ScreenContext['screenType'];
  actions: ActionDescriptor[];
  elements: UIElement[];
  guide: string;
} = {
  type: 'specialized',
  actions: [
    { id: 'hm-run-search', label: 'Lancer la recherche', icon: LUCIDE_ICONS.search, category: 'search', description: 'Barre texte + touche Rechercher / retour clavier : recharge la liste via immobilierService.searchProperties' },
    { id: 'hm-filter-ville', label: 'Filtrer par ville', icon: LUCIDE_ICONS['map-pin'], category: 'action', description: 'Champ ville dans le bandeau gradient ; envoyé comme filtre API `ville`' },
    { id: 'hm-filter-chambres', label: 'Chambres minimum', icon: LUCIDE_ICONS.list, category: 'action', description: 'Saisie numérique min chambres → `nb_chambres_min`' },
    { id: 'hm-filter-budget', label: 'Budget max (nuit)', icon: LUCIDE_ICONS['credit-card'], category: 'action', description: 'Budget maximum → `prix_max` (API)' },
    { id: 'hm-filter-standing', label: 'Filtrer par standing', icon: LUCIDE_ICONS.star, category: 'action', description: 'Chips : Tous, Économique, Standard, Bon standing, Haut standing, Luxe / Prestige → paramètre `standing` (sauf Tous)' },
    { id: 'hm-refresh', label: 'Tirer pour rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Pull-to-refresh sur la FlatList' },
    { id: 'hm-open-details', label: 'Fiche du bien', icon: LUCIDE_ICONS.info, route: 'ImmobilierDetails', category: 'navigation', description: 'Appui sur une carte → ImmobilierDetails avec propertyId' },
    { id: 'hm-book', label: 'Réserver', icon: LUCIDE_ICONS.calendar, route: 'HotelBooking', category: 'action', description: 'Bouton Réserver sur la carte → HotelBooking (propertyId, propertyName, typeBien, prixNuitee, ville) — dates saisies sur cet écran, pas sur la liste' },
    { id: 'hm-gps-radius', label: 'Tri / périmètre GPS', icon: LUCIDE_ICONS.location, category: 'help', description: 'Si LocationContext a des coordonnées : lat, lng et max_distance_km=50 envoyés à l’API ; distance affichée sur les cartes si renvoyée' },
  ],
  elements: [
    { id: 'hm-header-back', type: 'button', label: 'Retour (header)', icon: LUCIDE_ICONS.back, actionable: true },
    { id: 'hm-header-title', type: 'card', label: 'Titre Hôtels ou Meublés + sous-titre résultats', actionable: false },
    { id: 'hm-search-bar', type: 'input', label: 'Recherche texte (query API)', actionable: true },
    { id: 'hm-quick-filters', type: 'input', label: 'Ligne filtres : ville, chambres min, budget max', actionable: true },
    { id: 'hm-standing-chips', type: 'tab', label: 'Chips standing (scroll horizontal)', actionable: true },
    { id: 'hm-property-list', type: 'card', label: 'FlatList cartes (titre, lieu, chambres, standing, distance, prix/nuit, note, badge dispo)', actionable: true },
    { id: 'hm-fab-chat', type: 'fab', label: 'Assistant IA (FAB)', actionable: true },
  ],
  guide: '**Hôtel / meublé (utilisateur)** — `HotelMeubleHomeScreen`, routes **`HotelMeubleHome`**, **`HotelSearch`**, **`MeubleSearch`** (même écran). Mode **`hotel`** vs **`meuble`** : `route.params.mode` ou `initialFilter.type_bien`, défaut `hotel`. **Aucune saisie de dates sur cette liste** : calendrier et occupants sur **`HotelBooking`** après **Réserver**. Données : **`immobilierService.searchProperties`** → **GET /api/immobilier/biens** avec `type_bien`, `limit` 20, `page` 1, filtres optionnels `query`, `ville`, `standing`, `prix_max`, `nb_chambres_min` ; si position Yukpo : `lat`, `lng`, `max_distance_km: 50`. UI : recherche texte, filtres en-tête, chips standing, liste ; carte → **ImmobilierDetails** ; **Réserver** → **HotelBooking**.',
};

const SCREEN_CONFIGS: Record<string, {
  type: ScreenContext['screenType'];
  actions: ActionDescriptor[];
  elements: UIElement[];
  guide: string;
}> = {
  Home: {
    type: 'home',
    actions: [
      { id: 'home-ai-search', label: 'Recherche (ChatInputMobile)', icon: LUCIDE_ICONS.search, category: 'search', description: 'Mode 🔍 Rechercher : saisie texte + médias optionnels ; envoi → API rechercherServices puis écran ResultatBesoin (pas l’écran RechercheBesoin). Connexion requise.' },
      { id: 'home-create-mode', label: 'Créer produit / service (mode)', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Basculer sur le mode Création puis envoyer photo/texte dans ChatInputMobile. Si le prestataire a déjà un service → AjouterProduitSimple + suggestion IA ; sinon → FormulaireYukpoIntelligent (création complète).' },
      { id: 'home-gps-modal', label: 'GPS / zone (modal)', icon: LUCIDE_ICONS.location, category: 'action', description: 'Bouton localisation sur ChatInputMobile ou en-tête : ModernGPSModal (point ou zone), alimente la recherche / création et la météo du menu avatar.' },
      { id: 'header-navigation', label: 'Navigation GPS', icon: LUCIDE_ICONS.map, route: 'Navigation', category: 'navigation', description: 'Icône navigation à gauche : écran Navigation Yukpo.' },
      { id: 'header-delivery', label: 'Livraison', icon: LUCIDE_ICONS.truck, route: 'Delivery', category: 'navigation', description: 'Icône vélo/livraison à droite : module Livraison (Delivery).' },
      { id: 'header-chat-list', label: 'Mes conversations', icon: LUCIDE_ICONS.message, category: 'action', description: 'Bulles message : ChatHistoryModal (liste puis ouverture ChatModalMobile). Badge = messages non lus (API conversations).' },
      { id: 'header-notifications', label: 'Notifications', icon: LUCIDE_ICONS.bell, category: 'action', description: 'Cloche : NotificationHistoryModal. Badge = non lues API + compteur Coach IA local.' },
      { id: 'header-avatar-menu', label: 'Menu profil (avatar)', icon: LUCIDE_ICONS.profile, category: 'navigation', description: 'UserAvatarMenu : profil, solde crédits, raccourcis navigation, météo si position choisie.' },
      { id: 'promo-flash', label: 'Promos flash', icon: 'zap', route: 'FlashPromosActive', category: 'navigation', description: 'Menu Offres spéciales (cadeau) : promos flash.' },
      { id: 'promo-catalog', label: 'Catalogue promos', icon: LUCIDE_ICONS['shopping-cart'], route: 'GlobalPromoCatalog', category: 'navigation', description: 'Offres spéciales → catalogue global (ex. Black Friday).' },
      { id: 'promo-lives', label: 'Lives', icon: LUCIDE_ICONS.video, route: 'LivesList', category: 'navigation', description: 'Offres spéciales → liste des lives.' },
      { id: 'svc-pharmacie', label: 'Pharmacie (accès rapide)', icon: LUCIDE_ICONS.pharmacy, route: 'PharmacieSearch', category: 'navigation', description: 'Grille Yukpo : recherche utilisateur PharmacieSearch.' },
      { id: 'svc-hopital', label: 'Hôpital', icon: LUCIDE_ICONS.hospital, route: 'HopitalSearch', category: 'navigation', description: 'HopitalSearch.' },
      { id: 'svc-labo', label: 'Laboratoire', icon: LUCIDE_ICONS.activity, route: 'LaboratoireSearch', category: 'navigation', description: 'LaboratoireSearch.' },
      { id: 'svc-banque-sang', label: 'Banque de sang', icon: LUCIDE_ICONS.droplet, route: 'BanqueSangSearch', category: 'navigation', description: 'BanqueSangSearch.' },
      { id: 'svc-bus', label: 'Billets / voyage', icon: LUCIDE_ICONS.bus, route: 'BusTicketSearch', category: 'navigation', description: 'BusTicketSearch (ticket voyage).' },
      { id: 'svc-covoit', label: 'Covoiturage', icon: LUCIDE_ICONS.users, route: 'CovoiturageSearch', category: 'navigation', description: 'CovoiturageSearch.' },
      { id: 'svc-taxi', label: 'Taxi', icon: LUCIDE_ICONS.car, route: 'TaxiSearch', category: 'navigation', description: 'TaxiSearch.' },
      { id: 'svc-auto', label: 'Automobile', icon: LUCIDE_ICONS.car, route: 'AutoServicesSearch', category: 'navigation', description: 'AutoServicesSearch.' },
      { id: 'svc-assurance', label: 'Assurance', icon: LUCIDE_ICONS.shield, route: 'InsuranceServicesSearch', category: 'navigation', description: 'InsuranceServicesSearch.' },
      { id: 'svc-orientation', label: 'Orientation scolaire', icon: LUCIDE_ICONS.book, route: 'OrientationScolaireHub', category: 'navigation', description: 'OrientationScolaireHub.' },
      { id: 'svc-livres', label: 'Bourse du livre', icon: LUCIDE_ICONS.book, route: 'LivreScolaireHome', category: 'navigation', description: 'LivreScolaireHome.' },
      { id: 'svc-menu', label: 'Menu / repas (IA)', icon: LUCIDE_ICONS.utensils, route: 'MenuPlanningHub', category: 'navigation', description: 'MenuPlanningHub.' },
      { id: 'svc-bayamselam', label: 'BayamSelam (prix)', icon: LUCIDE_ICONS.activity, route: 'BayamSelamSearch', category: 'navigation', description: 'BayamSelamSearch (supermarché / comparatif).' },
      { id: 'svc-emploi', label: 'Offres d’emploi', icon: LUCIDE_ICONS.briefcase, route: 'OffresEmploiHub', category: 'navigation', description: 'OffresEmploiHub.' },
      { id: 'svc-immo', label: 'Immobilier', icon: LUCIDE_ICONS.building2, route: 'ImmobilierSearch', category: 'navigation', description: 'ImmobilierSearch.' },
      { id: 'svc-hotel', label: 'Hôtels', icon: LUCIDE_ICONS.hotel, route: 'HotelSearch', params: { mode: 'hotel' }, category: 'navigation', description: 'HotelSearch mode=hôtel.' },
      { id: 'svc-meuble', label: 'Meublés', icon: LUCIDE_ICONS.building2, route: 'MeubleSearch', params: { mode: 'meuble' }, category: 'navigation', description: 'MeubleSearch mode=meublé.' },
      { id: 'tab-services', label: 'Onglet Mes services', icon: LUCIDE_ICONS.briefcase, route: 'MesServices', category: 'navigation', description: 'Barre d’onglets : nom interne **Services** → composant MesServicesScreen ; navigation explicite **MesServices** (éviter **ServicesActivity** = ancien écran).' },
    ],
    elements: [
      { id: 'header-brand', type: 'card', label: 'Logo Yukpo (Yuk / po)', actionable: false },
      { id: 'header-avatar', type: 'button', label: 'Avatar & menu utilisateur', icon: LUCIDE_ICONS.profile, actionable: true },
      { id: 'header-nav-shortcut', type: 'button', label: 'Raccourci Navigation GPS', icon: LUCIDE_ICONS.map, actionable: true },
      { id: 'header-delivery-btn', type: 'button', label: 'Livraison', icon: LUCIDE_ICONS.truck, actionable: true },
      { id: 'header-chat-btn', type: 'button', label: 'Conversations (badge)', icon: LUCIDE_ICONS.message, actionable: true },
      { id: 'header-bell-btn', type: 'button', label: 'Notifications (badge)', icon: LUCIDE_ICONS.bell, actionable: true },
      { id: 'mode-toggle-search', type: 'tab', label: 'Mode 🔍 Rechercher', actionable: true },
      { id: 'mode-toggle-create', type: 'tab', label: 'Mode Créer produit/service', actionable: true },
      { id: 'chat-input-main', type: 'input', label: 'ChatInputMobile (texte, photo, audio, vidéo, docs, logo/bannière création)', actionable: true },
      { id: 'promo-special-offers', type: 'button', label: 'Offres spéciales (menu déroulant)', icon: 'gift', actionable: true },
      { id: 'services-categories', type: 'card', label: 'YukpoServicesQuickAccess — 6 catégories / 17 services (Santé, Transport, Vie pratique, Bourse du livre, Assurance, Immobilier)', actionable: true },
      { id: 'fab-assistant-ia', type: 'fab', label: 'Assistant IA (bulle, hors HomeScreen — AppNavigator)', actionable: true },
    ],
    guide: 'Accueil Yukpo (HomeScreen) : en-tête fixe (avatar/solde/météo, Navigation, marque, Livraison, conversations avec badge, notifications avec badge). Double mode Rechercher vs Créer : ChatInputMobile envoie soit vers ResultatBesoin (recherche IA connectée), soit vers création (FormulaireYukpoIntelligent si premier service, sinon AjouterProduitSimple + suggestions). GPS via modal. Offres spéciales → FlashPromos, catalogue promos, Lives. Grille services ouvre toujours des écrans **utilisateur** (Search/Hub/Home dédiés), jamais les formulaires partenaires. Au focus, le mode repasse sur Rechercher. Assistant IA flottant est global (AppNavigator). L’onglet **Mes services** en bas = onglet interne **Services** (composant MesServicesScreen) ; la même UI est accessible par la route pile **MesServices**. La route pile **ServicesActivity** est un ancien écran « Mon activité » — ne pas la confondre.',
  },

  /** Onglet barre du bas + route pile MesServices : **MesServicesScreen** (hub moderne). */
  Services: MES_SERVICES_TAB_CONFIG,
  MesServices: MES_SERVICES_TAB_CONFIG,

  /** Ancien **ServicesScreen** (« Mon activité ») — route pile dédiée pour éviter collision avec l’onglet Services. */
  ServicesActivity: {
    type: 'dashboard',
    actions: [
      { id: 'sa-open-modern', label: 'Hub produits moderne', icon: LUCIDE_ICONS.package, route: 'MesServices', category: 'navigation', description: 'MesServicesScreen (recommandé)' },
      { id: 'sa-edit', label: 'Modifier un service', icon: LUCIDE_ICONS.edit, category: 'action', description: 'Carte service → FormulaireYukpoIntelligent (fromServicesScreen)' },
    ],
    elements: [
      { id: 'sa-list', type: 'card', label: 'Liste / cartes services (legacy)', actionable: true },
    ],
    guide: 'Écran legacy **ServicesScreen** (route pile `ServicesActivity`). Le hub enrichi pour gérer produits, promos, vidéos et stats est **MesServicesScreen** (`MesServices` ou onglet **Services**).',
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
      { id: 'filters', label: 'Filtres avancés', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Prix min/max, rayon GPS, uniquement disponibles (badge = filtres actifs)' },
      { id: 'sort', label: 'Trier', icon: 'arrow-up-down', category: 'action', description: 'Modal: pertinence, prix, distance, nom A–Z' },
      { id: 'ai-expand', label: 'Assistant IA Pharmacie', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Photo médicament, suggestions, question → askPharmacyQuestion' },
      { id: 'ai-dosage-card', label: 'Posologie IA (carte)', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Sur chaque médicament de la liste' },
      { id: 'ai-interactions-card', label: 'Interactions IA (carte)', icon: LUCIDE_ICONS.alert, category: 'help', description: 'Sur chaque médicament de la liste' },
      { id: 'reserve', label: 'Disponibilité / Réserver', icon: LUCIDE_ICONS['shopping-cart'], category: 'action', description: 'Vérifier stock chez la pharmacie liée au produit puis réserver' },
    ],
    elements: [
      { id: 'search-medicaments', type: 'input', label: 'Recherche médicaments / produits (barre + loupe)', actionable: true },
      { id: 'chip-proche', type: 'card', label: 'Chip Proche de moi', actionable: true },
      { id: 'chip-dispo', type: 'card', label: 'Chip Disponibles', actionable: true },
      { id: 'chip-prix-bas', type: 'card', label: 'Chip Prix bas', actionable: true },
      { id: 'liste-medicaments', type: 'card', label: 'Liste de cartes médicaments (détail, posologie, interactions)', actionable: true },
    ],
    guide: 'Catalogue multi-pharmacies: recherche produits via pharmacyProductService.searchProducts (texte, GPS, rayon, dispo, prix). En-tête filtre avec pastille. Chips rapides, tri modal. Bloc repliable Assistant IA: analyse photo (imageAnalysisService), suggestions, chat askPharmacyQuestion. Chaque carte: fiche modal, Posologie IA, Interactions IA, vérif stock/réservation. Pour lister des officines (garde, adresse), orienter vers PharmacieSearch → PharmacieList — pas sur cet écran.',
  },
  PharmacieForm: {
    type: 'dashboard',
    actions: [
      { id: 'add-product', label: 'Ajouter Médicament', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Onglet Produits: nouveau produit / stock' },
      { id: 'bulk-import', label: 'Import produits', icon: LUCIDE_ICONS.upload, category: 'action', description: 'Import en masse (texte) avec option écraser' },
      { id: 'guard-days', label: 'Jours de garde', icon: LUCIDE_ICONS.clock, category: 'action', description: 'GuardDaysSelector / modal jours de garde' },
      { id: 'gps', label: 'GPS / Adresse', icon: LUCIDE_ICONS.location, category: 'action', description: 'LocationSelector + ModernGPSModal' },
      { id: 'team', label: 'Équipe', icon: LUCIDE_ICONS.users, category: 'action', description: 'Onglet Équipe: ServiceTeamManager' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'PharmacyAnalytics', category: 'navigation', description: 'Onglet Stats + lien analytics détaillé si besoin' },
      { id: 'ai-interactions-screen', label: 'IA Interactions (écran dédié)', icon: LUCIDE_ICONS.activity, route: 'PharmacyAIInteractions', category: 'help', description: 'Depuis overview / tests: écran interactions & dosage avancé partenaire' },
    ],
    elements: [
      { id: 'tabs', type: 'tab', label: 'Onglets: Accueil (overview), Mon service, Produits, Stats (analytics), Équipe', actionable: true },
      { id: 'product-form', type: 'input', label: 'Formulaire médicament / produit (modal édition)', actionable: true },
      { id: 'stock-list', type: 'card', label: 'Liste du stock avec recherche locale filtrée', actionable: true },
      { id: 'orders', type: 'card', label: 'Commandes clients (overview / intégration dashboard)', actionable: true },
      { id: 'analytics-strip', type: 'card', label: 'Indicateurs analytics (onglet Stats)', actionable: false },
    ],
    guide: 'Partenaire pharmacie: mode dashboard si officine existante (GET /api/pharmacies). 5 onglets — overview, service (infos, horaires, garde, prestations, contacts), products (CRUD, import bulk, recherche), analytics (KPI), team (ServiceTeamManager). Raccourcis overview vers PharmacyAIInteractions (tests interactions IA). Mode création (route mode) = formulaire guidé avec autosave. CRUD pharmacie, produits, commandes, garde.',
  },
  PharmacieSearch: {
    type: 'search',
    actions: [
      { id: 'ai-features', label: 'Fonctionnalités IA', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Bandeau → modal PharmacyAIFeatures (interactions, dosage, budget produits)' },
      { id: 'quick-garde', label: 'Recherche rapide garde', icon: LUCIDE_ICONS.clock, category: 'search', description: 'Carte rapide: pharmacies de garde' },
      { id: 'quick-near', label: 'Recherche rapide proximité', icon: LUCIDE_ICONS.location, category: 'search', description: 'Carte rapide: rayon 10 km + dispo' },
      { id: 'gps-modal', label: 'Position GPS', icon: LUCIDE_ICONS.map, category: 'action', description: 'ModernGPSModal (optionnel)' },
      { id: 'launch-search', label: 'Lancer la recherche', icon: LUCIDE_ICONS.search, category: 'search', description: 'Navigate PharmacieList avec filters (produit prioritaire ou établissements)' },
    ],
    elements: [
      { id: 'product-search', type: 'input', label: 'Nom produit / médicament (prioritaire)', actionable: true },
      { id: 'distance-stepper', type: 'input', label: 'Distance max (km)', actionable: true },
      { id: 'toggle-garde', type: 'card', label: 'Switch De garde uniquement', actionable: true },
      { id: 'toggle-dispo', type: 'card', label: 'Switch Pharmacies avec stock disponible', actionable: true },
      { id: 'advanced-filters', type: 'card', label: 'Type officine, services, livraison', actionable: true },
    ],
    guide: 'Recherche d\'officines et produits: priorité champ produit/médicament + GPS optionnel + distance. Recherches rapides (garde, proche). Filtres avancés: type pharmacie, services, livraison. Basculer garde/dispo. CTA → PharmacieList (params.filters). Bandeau IA → PharmacyAIFeatures.',
  },

  // === HÔPITAL ===
  HopitalHome: {
    type: 'specialized',
    actions: [
      { id: 'ai-modal', label: 'IA (pathologie)', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Header brain + modal: recherche pathologie / image hôpital' },
      { id: 'search-prestation', label: 'Recherche prestation', icon: LUCIDE_ICONS.search, category: 'search', description: 'Autocomplete hospitalService.searchMedicalServices + loupe' },
      { id: 'image-ia', label: 'Analyser image', icon: LUCIDE_ICONS.camera, category: 'help', description: 'Quick action → analyzeHospitalImage dans AIModal' },
      { id: 'pathologie-ia', label: 'Recherche pathologie', icon: LUCIDE_ICONS.search, category: 'help', description: 'Quick action → AIModal + aiSearchPathology' },
      { id: 'sort', label: 'Trier', icon: 'arrow-up-down', category: 'action', description: 'Modal pertinence, prix, distance, nom' },
      { id: 'book-slot', label: 'Prendre RDV (carte)', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Sur carte disponibilité: hospitalService.bookAppointment' },
      { id: 'wait-time', label: 'Temps d\'attente', icon: LUCIDE_ICONS.clock, category: 'action', description: 'getWaitTimes sur service_id' },
    ],
    elements: [
      { id: 'autocomplete', type: 'input', label: 'Liste déroulante autocomplete prestations', actionable: true },
      { id: 'availability-cards', type: 'card', label: 'Cartes établissements + services disponibles + distance', actionable: true },
    ],
    guide: 'Hub **prestations / disponibilité** (pas la liste filtrée HopitalList): avec GPS, searchAvailableMedicalServices (50 km) ; sans GPS ou hors chemin dispo → navigation HopitalList avec serviceType. Autocomplete searchMedicalServices. AIModal: pathologie (useAIWithFallback) + image (imageAnalysisService.analyzeHospitalImage). Cartes: RDV bookAppointment, bouton Attente getWaitTimes. Pour filtres établissements (ville, urgences, spécialités) → HopitalSearch.',
  },
  HopitalSearch: {
    type: 'search',
    actions: [
      { id: 'gps', label: 'GPS', icon: LUCIDE_ICONS.map, category: 'action', description: 'ModernGPSModal' },
      { id: 'distance', label: 'Distance max', icon: LUCIDE_ICONS.location, category: 'action', description: 'Stepper km' },
      { id: 'quick-urgences', label: 'Recherche rapide Urgences', icon: LUCIDE_ICONS.alert, category: 'search', description: 'Carte rapide' },
      { id: 'quick-proche', label: 'Plus proche', icon: LUCIDE_ICONS.location, category: 'search', description: 'Réduit rayon + dispo' },
      { id: 'advanced', label: 'Filtres avancés', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Spécialités, banque sang, urgences 24h, RDV ligne, assurances' },
      { id: 'launch', label: 'Lancer recherche', icon: LUCIDE_ICONS.search, category: 'search', description: 'MedicalServicesList si prestation/spécialité sinon HopitalList' },
    ],
    elements: [
      { id: 'prestation', type: 'input', label: 'Prestation / spécialité (prioritaire)', actionable: true },
      { id: 'type-etablissement', type: 'card', label: 'Type Hôpital / Clinique / …', actionable: true },
      { id: 'switches', type: 'card', label: 'Urgences only, Disponible, RDV en ligne (selon UI)', actionable: true },
    ],
    guide: 'Formulaire recherche établissements et services: GPS, distance, type, prestation, toggles. Si prestation ou spécialité renseignée → navigate MedicalServicesList {filters} (alias même écran que HealthServicesHub — params non lus par le composant actuellement). Sinon → HopitalList {filters} → GET /api/hopitaux/search.',
  },
  HopitalForm: {
    type: 'dashboard',
    actions: [
      { id: 'manage-slots', label: 'Gérer Créneaux', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Gérer les créneaux de consultation par prestation et par jour (onglet Créneaux)' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'HospitalAnalytics', category: 'navigation', description: 'Consulter les statistiques hospitalières : consultations totales, temps d\'attente, taux d\'occupation (onglet Stats)' },
      { id: 'edit-service', label: 'Modifier Service', icon: LUCIDE_ICONS.edit, category: 'action', description: 'Modifier les infos de l\'établissement : nom, type, adresse, GPS, prestations, urgences, RDV en ligne (onglet Service)' },
      { id: 'ai-triage', label: 'IA Triage', icon: LUCIDE_ICONS.activity, route: 'HospitalAIRecommendations', category: 'help', description: 'Accéder au triage IA pour évaluer la sévérité des patients et orienter les urgences' },
      { id: 'team', label: 'Équipe', icon: LUCIDE_ICONS.users, category: 'action', description: 'Gérer les membres de votre équipe médicale (onglet Équipe)' },
      { id: 'toggle-urgences', label: 'Urgences On/Off', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Activer ou désactiver le service d\'urgences' },
      { id: 'toggle-rdv', label: 'RDV en ligne', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Activer ou désactiver la prise de RDV en ligne' },
      { id: 'wallet', label: 'Portefeuille', icon: LUCIDE_ICONS['credit-card'], route: 'WalletFinancial', category: 'navigation', description: 'Consulter les revenus et transactions financières' },
    ],
    elements: [
      { id: 'stats-grid', type: 'card', label: 'Grille de statistiques (prestations, créneaux, consultations, temps attente)', actionable: false },
      { id: 'quick-actions', type: 'button', label: 'Actions rapides (Gérer créneaux, IA Triage, Statistiques, Mon service, Déconnexion)', actionable: true },
      { id: 'emergency-card', type: 'card', label: 'Carte urgences (activées/désactivées, RDV en ligne)', actionable: true },
      { id: 'consultations-list', type: 'card', label: 'Consultations récentes (patient, prestation, date, statut)', actionable: true },
      { id: 'hospital-info', type: 'card', label: 'Informations de l\'établissement (adresse, téléphone, type)', actionable: false },
      { id: 'tabs', type: 'tab', label: 'Onglets: Accueil, Service, Créneaux, Stats, Équipe', actionable: true },
    ],
    guide: 'Tableau de bord hôpital/clinique complet. 5 onglets : Accueil (stats, actions rapides, statut urgences, consultations récentes, infos), Service (modifier nom, type d\'établissement, adresse, GPS, prestations, urgences, RDV en ligne, contacts), Créneaux (PrestationSelectorWithSchedule), Stats, Équipe (ServiceTeamManager). Init partenaire : GET /api/partners/me + GET /api/hopitaux (première fiche), puis analytics/consultations/urgence avec id fiche API. Raccourcis overview : HospitalAIRecommendations (hospitalId + serviceId si connus), HospitalAnalytics (hospitalId requis — alerte si fiche non chargée).',
  },

  // === HÔTEL ===
  HotelDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'add-property', label: 'Ajouter un bien', icon: LUCIDE_ICONS.add, route: 'ImmobilierForm', category: 'creation', description: 'Ajouter un hôtel ou meublé' },
      { id: 'new-reservation', label: 'Nouvelle réservation', icon: LUCIDE_ICONS.calendar, category: 'creation', description: 'Créer une réservation manuelle pour un client' },
      { id: 'manage-reservations', label: 'Réservations', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Voir et gérer toutes les réservations (onglet Réservations)' },
      { id: 'check-in', label: 'Check-in', icon: LUCIDE_ICONS.check, category: 'action', description: 'Enregistrer l\'arrivée d\'un client (bouton Check-in sur la réservation confirmée)' },
      { id: 'check-out', label: 'Check-out', icon: LUCIDE_ICONS.check, category: 'action', description: 'Enregistrer le départ d\'un client (bouton Check-out sur la réservation en séjour)' },
      { id: 'qr-scanner', label: 'Scanner QR', icon: LUCIDE_ICONS.camera, route: 'HotelQRScanner', category: 'action', description: 'Scanner le QR code d\'un client à la réception pour vérifier sa réservation' },
      { id: 'ai-insights', label: 'IA Insights', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Obtenir des suggestions de tarifs et prévisions de remplissage par l\'IA (onglet IA)' },
      { id: 'team', label: 'Équipe', icon: LUCIDE_ICONS.list, category: 'action', description: 'Gérer les membres de votre équipe (onglet Équipe)' },
      { id: 'wallet', label: 'Portefeuille', icon: LUCIDE_ICONS['credit-card'], route: 'WalletFinancial', category: 'navigation', description: 'Accéder au portefeuille pour suivre les revenus' },
      { id: 'payment', label: 'Paiement réservation', icon: LUCIDE_ICONS['credit-card'], route: 'HotelBookingPayment', category: 'action', description: 'Enregistrer un paiement (avance ou solde) pour une réservation' },
    ],
    elements: [
      { id: 'stats-grid', type: 'card', label: 'Statistiques (propriétés, réservations, en séjour, revenus)', actionable: false },
      { id: 'quick-actions', type: 'button', label: 'Actions rapides (ajouter bien, réservation, scanner QR, IA, portefeuille)', actionable: true },
      { id: 'pending-arrivals', type: 'card', label: 'Arrivées en attente (réservations confirmées non check-in)', actionable: true },
      { id: 'checked-in-clients', type: 'card', label: 'Clients en séjour actuellement', actionable: true },
      { id: 'tabs', type: 'button', label: 'Onglets: Vue d\'ensemble, Réservations, Mes biens, IA, Équipe', actionable: true },
    ],
    guide: 'Tableau de bord hôtel/meublé complet. 5 onglets : Vue d\'ensemble (stats + actions rapides + arrivées en attente + clients en séjour), Réservations (liste complète avec check-in/out/QR/paiement), Mes biens (propriétés avec disponibilité + modifier + IA tarifs), IA (insights tarification et remplissage par propriété), Équipe (gestion du personnel). Actions clés : ajouter un bien → ImmobilierForm, créer réservation manuelle → modal, scanner QR client → HotelQRScanner, voir QR réservation, paiement réservation → HotelBookingPayment, portefeuille → WalletFinancial. Le partenaire peut demander de l\'aide sur n\'importe quelle fonctionnalité.',
  },
  HotelMeubleHome: HOTEL_MEUBLE_USER_HUB_CONFIG,
  HotelSearch: HOTEL_MEUBLE_USER_HUB_CONFIG,
  MeubleSearch: HOTEL_MEUBLE_USER_HUB_CONFIG,
  HotelBooking: {
    type: 'form',
    actions: [
      { id: 'submit-booking', label: 'Envoyer la réservation', icon: LUCIDE_ICONS.check, category: 'action', description: 'POST /api/hotel/reservations/request (bookHotelStay) — demande au gérant' },
      { id: 'pay-now', label: 'Payer maintenant', icon: LUCIDE_ICONS['credit-card'], route: 'HotelBookingPayment', category: 'action', description: 'Proposé dans l’alerte après succès si id réservation + montant > 0 ; sinon paiement plus tard selon confirmation' },
    ],
    elements: [
      { id: 'dates-input', type: 'input', label: 'Dates arrivée/départ (AAAA-MM-JJ, validées Date)', actionable: true },
      { id: 'occupants', type: 'input', label: 'Adultes (min 1), enfants, chambres (min 1) — steppers +/-', actionable: true },
      { id: 'contact-info', type: 'input', label: 'Nom et téléphone obligatoires ; email optionnel', actionable: true },
      { id: 'notes-special', type: 'input', label: 'Notes / demandes spéciales (optionnel)', actionable: true },
      { id: 'price-estimate', type: 'card', label: 'Estimation si prix/nuit connu : nuit × chambres × prix/nuit', actionable: false },
    ],
    guide: 'Réservation **HotelBookingScreen** pour un **seul** bien (\`propertyId\` en params). Dates, occupants, coordonnées ; envoi via **bookHotelStay**. Paiement immédiat seulement si l’alerte de succès propose **Payer maintenant** (réservation id + total > 0). Pas de choix de chambre type catalogue — le bien est déjà fixé.',
  },
  ImmobilierForm: {
    type: 'form',
    actions: [
      { id: 'publish-property', label: 'Publier le bien', icon: LUCIDE_ICONS.check, category: 'action', description: 'Publier ou modifier l\'annonce immobilière' },
      { id: 'select-gps', label: 'Sélectionner GPS', icon: LUCIDE_ICONS['map-pin'], category: 'action', description: 'Choisir la localisation sur la carte' },
      { id: 'add-photos', label: 'Ajouter photos/vidéos', icon: LUCIDE_ICONS.camera, category: 'action', description: 'Ajouter des médias au bien' },
      { id: 'virtual-tour', label: 'Visite virtuelle 360°', icon: LUCIDE_ICONS.video, category: 'action', description: 'Ajouter une visite virtuelle (mode édition uniquement)' },
    ],
    elements: [
      { id: 'property-form', type: 'input', label: 'Formulaire bien: titre, description, type, statut, localisation, caractéristiques, prix', actionable: true },
      { id: 'type-selector', type: 'button', label: 'Type de bien: maison, appartement, terrain, bureau, local commercial, hôtel, meublé', actionable: true },
      { id: 'status-selector', type: 'button', label: 'Statut: vente, location, les deux', actionable: true },
    ],
    guide: 'Formulaire de création/modification d\'un bien immobilier. Sections: Informations (titre, description), Type & Statut (7 types + 3 statuts), Localisation (ville, quartier, adresse avec import photos Google), Caractéristiques (superficie, chambres, SDB, standing, état), Prix (vente et/ou location selon statut), Médias (photos + vidéos), Visite virtuelle 360° (en mode édition).',
  },

  // === IMMOBILIER ===
  ImmobilierHome: {
    type: 'specialized',
    actions: [
      { id: 'submit-search', label: 'Lancer la recherche', icon: LUCIDE_ICONS.search, category: 'search', description: 'Barre texte + bouton loupe / retour clavier → immobilierService.searchProperties (pagination 20)' },
      { id: 'filters-modal', label: 'Filtres avancés', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Icône sliders en-tête → FiltersModal (types, statuts, standing, prix, surface, chambres, GPS)' },
      { id: 'sort-modal', label: 'Trier', icon: LUCIDE_ICONS['arrow-up-down'], category: 'action', description: 'SortModal : pertinence, prix, date, superficie' },
      { id: 'quick-filters', label: 'Filtres rapides', icon: LUCIDE_ICONS.zap, category: 'action', description: 'Chips vente / location / proche / nouveautés' },
      { id: 'view-toggle', label: 'Liste ou grille', icon: LUCIDE_ICONS.list, category: 'action', description: 'Basculer vue liste / grille' },
      { id: 'add-property', label: 'Publier une annonce', icon: LUCIDE_ICONS.add, route: 'ImmobilierForm', category: 'creation', description: 'Bouton + en-tête → ImmobilierForm mode create' },
      { id: 'open-details', label: 'Fiche bien', icon: LUCIDE_ICONS.info, route: 'ImmobilierDetails', category: 'navigation', description: 'Carte → ImmobilierDetails (propertyId) + trackPropertyView source search' },
      { id: 'card-favorite', label: 'Favori (carte)', icon: LUCIDE_ICONS.heart, category: 'action', description: 'addToFavorites / removeFromFavorites + miroir AsyncStorage' },
      { id: 'card-estimate-ia', label: 'Estimer (IA)', icon: LUCIDE_ICONS.activity, category: 'action', description: 'useAIWithFallback estimatePropertyPrice → Alert (≠ estimatePrice sur ImmobilierDetails)' },
      { id: 'card-visite', label: 'Visite (carte)', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Alert puis bookVisit demain 10h en_personne — pas ImmobilierBooking' },
      { id: 'card-share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'shareProperty + partage système' },
      { id: 'card-pret-modal', label: 'Simuler prêt (carte)', icon: LUCIDE_ICONS['credit-card'], category: 'action', description: 'Si prix_vente : modal calculateLoan local (durée/taux) — pas simulateLoan API' },
    ],
    elements: [
      { id: 'header-gradient', type: 'card', label: 'En-tête : retour, titre (Immobilier / Hôtels / Meublés), + création, filtres', actionable: true },
      { id: 'property-search', type: 'input', label: 'Recherche texte bien / quartier / ville', actionable: true },
      { id: 'results-list', type: 'card', label: 'FlatList ImmobilierResultCard + actions par carte', actionable: true },
      { id: 'loan-modal', type: 'modal', label: 'Modal simulation prêt (client-side)', actionable: true },
    ],
    guide: '**ImmobilierHomeScreen** : hub catalogue **sans** les 3 modes de **ImmobilierSearch**. Données : **immobilierService.searchProperties** (page/limit 20), filtres **FiltersModal**, tri **SortModal**, chips rapides, liste/grille. **Pas** de navigation directe vers ImmobilierCompare / ImmobilierPriceAlerts / ImmobilierSearch depuis cet écran. Sur chaque carte : favoris serveur, estimation **useAIWithFallback.estimatePropertyPrice** (Alert), visite via **Alert + bookVisit** (créneau fixe), partage **shareProperty**, prêt **modal locale** si vente. **+** → **ImmobilierForm** create. Comparaison / recherche carte avancée / alertes : autres routes Yukpo.',
  },
  ImmobilierSearch: {
    type: 'search',
    actions: [
      { id: 'search', label: 'Lancer la recherche', icon: LUCIDE_ICONS.search, category: 'action', description: 'Rechercher des biens avec les filtres configurés' },
      { id: 'ai-features', label: 'Fonctionnalités IA', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Estimation prix IA, recommandations, comparaison assistée' },
      { id: 'select-gps', label: 'Sélectionner GPS', icon: LUCIDE_ICONS['map-pin'], category: 'action', description: 'Choisir un point ou une zone sur la carte' },
    ],
    elements: [
      { id: 'search-mode', type: 'button', label: 'Mode de recherche: Point GPS, Zone carte, Quartiers', actionable: true },
      { id: 'location-inputs', type: 'input', label: 'Ville + Quartier + Point GPS', actionable: true },
      { id: 'type-chips', type: 'button', label: 'Types: Appartement, Villa, Studio, Duplex, Triplex, Maison, Bureau, Commerce', actionable: true },
      { id: 'status-chips', type: 'button', label: 'Statut: À vendre, À louer bail, À louer meublé, Location courte durée, Colocation', actionable: true },
      { id: 'price-range', type: 'input', label: 'Fourchette de prix min/max', actionable: true },
      { id: 'characteristics', type: 'input', label: 'Superficie, chambres minimum, standing', actionable: true },
    ],
    guide: 'Recherche immobilière avancée. 3 modes: Point GPS (ville+quartier+coordonnées), Zone carte (délimiter une zone polygonale), Quartiers (sélection multiple de quartiers populaires). Filtres: type de bien (8 types), statut (5 options), prix min/max, superficie, chambres minimum, standing (5 niveaux), distance maximum. Fonctionnalités IA: estimation prix, recommandations, comparaison assistée.',
  },
  ImmobilierDetails: {
    type: 'detail',
    actions: [
      { id: 'book-visit', label: 'Réserver une visite', icon: LUCIDE_ICONS.calendar, route: 'ImmobilierBooking', category: 'action', description: 'Réserver une visite physique ou virtuelle du bien' },
      { id: 'simulate-loan', label: 'Simuler un prêt', icon: LUCIDE_ICONS['credit-card'], category: 'action', description: 'Calculer les mensualités d\'un prêt immobilier' },
      { id: 'ai-estimate', label: 'Estimation IA', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Obtenir une estimation du prix par l\'IA' },
      { id: 'ai-recommendations', label: 'Recommandations IA', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Obtenir des recommandations d\'investissement et d\'analyse' },
      { id: 'toggle-favorite', label: 'Favoris', icon: LUCIDE_ICONS.heart, category: 'action', description: 'Ajouter ou retirer des favoris' },
      { id: 'share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager le bien par WhatsApp, SMS, lien' },
    ],
    elements: [
      { id: 'property-hero', type: 'card', label: 'En-tête avec titre, localisation, type, standing, prix', actionable: false },
      { id: 'photo-gallery', type: 'card', label: 'Galerie photos + visites virtuelles 360°', actionable: true },
      { id: 'characteristics', type: 'card', label: 'Caractéristiques: type, superficie, chambres, salles de bain', actionable: false },
      { id: 'ai-price-estimate', type: 'card', label: 'Estimation IA du prix (fourchette, prix/m², confiance)', actionable: true },
      { id: 'ai-recommendations', type: 'card', label: 'Recommandations IA (budget, localisation, potentiel investissement)', actionable: true },
      { id: 'comments', type: 'card', label: 'Section commentaires/avis', actionable: true },
    ],
    guide: 'Détails complets d\'un bien immobilier. En haut: titre, localisation, badges (statut, type, standing), prix. Galerie photos avec visites virtuelles 360°. Actions rapides: appeler, WhatsApp, favoris, partager. Caractéristiques détaillées. Estimation IA du prix avec fourchette et confiance. Recommandations IA (budget, localisation, investissement). Boutons: réserver une visite ou simuler un prêt. Section commentaires en bas.',
  },
  ImmobilierCompare: {
    type: 'specialized',
    actions: [
      { id: 'view-details', label: 'Voir détails', icon: LUCIDE_ICONS.info, route: 'ImmobilierDetails', category: 'navigation', description: 'Voir les détails complets d\'un bien' },
    ],
    elements: [
      { id: 'comparison-table', type: 'card', label: 'Tableau comparatif: prix, superficie, chambres, standing, localisation', actionable: true },
    ],
    guide: 'Comparaison de biens immobiliers côte à côte (jusqu\'à 5 biens). Comparez prix, superficie, chambres, standing, localisation. Cliquez sur un bien pour voir ses détails.',
  },
  ImmobilierBooking: {
    type: 'form',
    actions: [
      { id: 'submit-visit', label: 'Réserver la visite', icon: LUCIDE_ICONS.check, category: 'action', description: 'Confirmer la demande de visite' },
    ],
    elements: [
      { id: 'visit-type', type: 'button', label: 'Type de visite: Physique ou Virtuelle', actionable: true },
      { id: 'date-time', type: 'input', label: 'Date et heure de visite', actionable: true },
    ],
    guide: 'Réservation de visite immobilière. Choisissez le type (physique ou virtuelle), la date (AAAA-MM-JJ), l\'heure. La demande sera envoyée au propriétaire/agent.',
  },
  ImmobilierPriceAlerts: {
    type: 'list',
    actions: [
      { id: 'toggle-alert', label: 'Activer/Désactiver', icon: LUCIDE_ICONS.bell, category: 'action', description: 'UI : Alert « bientôt disponible » (pas d’API toggle branchée)' },
      { id: 'delete-alert', label: 'Supprimer', icon: LUCIDE_ICONS.trash, category: 'action', description: 'UI : confirmation puis message suppression à implémenter' },
    ],
    elements: [
      { id: 'alerts-list', type: 'card', label: 'Liste immobilierService.getMyPriceAlerts (GET /api/immobilier/my-alerts)', actionable: true },
    ],
    guide: '**ImmobilierPriceAlertsScreen** : chargement **getMyPriceAlerts** au focus. L’activation/désactivation et la suppression sont pour l’instant des **Alert** placeholder (backend non branché dans ces handlers). Ne pas promettre une gestion complète tant que le code TODO n’est pas fait.',
  },

  // === TAXI ===
  TaxiHome: {
    type: 'specialized',
    actions: [
      { id: 'back', label: 'Retour', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'Flèche en-tête' },
      { id: 'register-driver', label: 'Devenir chauffeur', icon: LUCIDE_ICONS.user, route: 'CourierRegistration', category: 'navigation', description: 'Si non chauffeur validé — params applicationType driver' },
      { id: 'publish-service', label: 'Publier un service', icon: LUCIDE_ICONS.add, route: 'TaxiForm', category: 'creation', description: 'Chauffeur validé → TaxiForm mode create ; sinon toast' },
      { id: 'depart-selector', label: 'Départ', icon: LUCIDE_ICONS.location, category: 'action', description: 'LocationSelector — prérempli par GPS / adresse si dispo' },
      { id: 'destination-selector', label: 'Destination', icon: LUCIDE_ICONS.location, category: 'action', description: 'LocationSelector adresse précise' },
      { id: 'available-only', label: 'Taxis disponibles uniquement', icon: LUCIDE_ICONS.check, category: 'action', description: 'Chip filtre client is_available' },
      { id: 'search-taxis', label: 'Rechercher', icon: LUCIDE_ICONS.search, category: 'search', description: 'taxiService.searchTaxis (coords départ ou ville, radius 20 km)' },
      { id: 'open-taxi', label: 'Fiche taxi', icon: LUCIDE_ICONS.car, route: 'TaxiDetails', category: 'navigation', description: 'Carte résultat ou recommandation IA' },
      { id: 'book-taxi', label: 'Réserver', icon: LUCIDE_ICONS['credit-card'], route: 'TaxiBooking', category: 'action', description: 'TaxiBooking avec taxiId + départ/destination' },
    ],
    elements: [
      { id: 'ia-demand-card', type: 'card', label: 'Prédiction demande (forte/normale/faible) avant 1re recherche', actionable: false },
      { id: 'ia-recommendations', type: 'card', label: 'Liste recommandations IA (getPersonalizedRecommendations)', actionable: true },
      { id: 'results-list', type: 'card', label: 'Liste taxis après recherche', actionable: true },
    ],
    guide: 'TaxiHomeScreen (hub refondu). Départ auto depuis GPS possible ; avant recherche : recommandations IA + prédiction demande ; recherche par LocationSelector + filtre disponibilité ; publier service → TaxiForm ; devenir chauffeur → CourierRegistration. Routes alternatives : TaxiSearch, TaxiIntelligentSearch — pas obligatoires depuis cet accueil.',
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
      { id: 'back', label: 'Retour', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'Flèche en-tête' },
      { id: 'register-driver', label: 'Devenir chauffeur', icon: LUCIDE_ICONS.user, route: 'CourierRegistration', category: 'navigation', description: 'Si non profil chauffeur validé' },
      { id: 'publish-trip', label: 'Publier un trajet', icon: LUCIDE_ICONS.add, route: 'CovoiturageForm', category: 'creation', description: 'Chauffeur validé → CovoiturageForm mode create' },
      { id: 'depart-selector', label: 'Départ', icon: LUCIDE_ICONS.location, category: 'action', description: 'LocationSelector lieu départ' },
      { id: 'destination-selector', label: 'Destination', icon: LUCIDE_ICONS.location, category: 'action', description: 'LocationSelector destination' },
      { id: 'date-trip', label: 'Date du trajet', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'DatePicker trajet' },
      { id: 'search-covoit', label: 'Rechercher', icon: LUCIDE_ICONS.search, category: 'search', description: 'covoiturageService.searchCovoiturages (départ, destination, date, GPS optionnel)' },
      { id: 'open-trajet', label: 'Détails trajet', icon: LUCIDE_ICONS.car, route: 'CovoiturageDetails', category: 'navigation', description: 'Appui carte' },
      { id: 'reserve', label: 'Réserver', icon: LUCIDE_ICONS.check, route: 'CovoiturageBooking', category: 'action', description: 'CovoiturageBooking avec covoiturageId' },
    ],
    elements: [
      { id: 'empty-state', type: 'card', label: 'État initial : remplir départ & destination avant recherche', actionable: false },
      { id: 'trajet-cards', type: 'card', label: 'Cartes trajets (téléphone, WhatsApp, Réserver)', actionable: true },
    ],
    guide: 'CovoiturageHomeScreen. Recherche inline LocationSelector + date — pas de résultats au montage. Publier un trajet : bouton header → CovoiturageForm (chauffeur validé). Création API nécessite service_id (sinon GestionServicesSpecialises). CovoiturageSearch / CovoiturageIntelligentSearch = autres entrées.',
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
      { id: 'open-delivery-tracking', label: 'Ouvrir une livraison', icon: LUCIDE_ICONS.truck, category: 'navigation', description: 'Carte livraison → **DeliveryShoppingTracking** (`deliveryId`)' },
      { id: 'verification-code', label: 'Code de vérification', icon: LUCIDE_ICONS.shield, category: 'navigation', description: 'Bouton sur carte → **CourierVerificationCode** (`deliveryId`)' },
      { id: 'stats-alert', label: 'Statistiques (Alert)', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Bouton actions rapides → **Alert** texte (pas d’écran dédié)' },
      { id: 'wallet', label: 'Portefeuille', icon: LUCIDE_ICONS.wallet, route: 'WalletFinancial', category: 'navigation', description: '**WalletFinancial**' },
      { id: 'book-courier-packages', label: 'Bourse du livre (paquets)', icon: LUCIDE_ICONS.book, category: 'action', description: '**BookCourierSubDashboard** : **bourseLivreV2Api** (accepter / statuts paquets)' },
    ],
    elements: [
      { id: 'stats-chart', type: 'card', label: 'CourierStatsChart (stats API)', actionable: false },
      { id: 'book-subdashboard', type: 'card', label: 'Sous-dashboard livres scolaires (coursier)', actionable: true },
      { id: 'delivery-list', type: 'card', label: 'Livraisons actives (GET /api/deliveries/active)', actionable: true },
    ],
    guide: '**CourierDashboardScreen** : au focus **notificationSoundService** + **loadData** ; polling **15 s** ; **deliveryApi.listActiveDeliveries** + **getCourierStats** (GET `/api/delivery/courier/stats`) ; graphiques **CourierStatsChart** ; **BookCourierSubDashboard** (Bourse livre V2) ; carte livraison → **DeliveryShoppingTracking** ; code vérif → **CourierVerificationCode** ; actions rapides = **Alert** stats + **WalletFinancial**. Pas d’entrée Historique / Revenus dédiée dans ce fichier.',
  },

  // === LABORATOIRE ===
  LaboratoireHome: {
    type: 'specialized',
    actions: [
      { id: 'search-lab', label: 'Chercher Labo', icon: LUCIDE_ICONS.search, route: 'LaboratoireSearch', category: 'search', description: 'Rechercher un laboratoire' },
      { id: 'my-exams', label: 'Mes Examens', icon: LUCIDE_ICONS.clipboard, route: 'MyLabExaminations', category: 'navigation', description: 'Historique d\'examens' },
      { id: 'ai-analysis', label: 'Analyse IA (modal)', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Modale IA : pathologie texte + image (**laboratoryService**), pas **LabAIAnalysis**' },
    ],
    elements: [
      { id: 'lab-search', type: 'input', label: 'Recherche + autocomplete examens', actionable: true },
    ],
    guide: '**LaboratoireHomeScreen** : autocomplete **GET** `/api/laboratoires/examinations/autocomplete` ; si GPS + dispo → **GET** `/api/search/scheduling` ; sinon **LaboratoireList** avec `examinationType` (texte). Modales IA pathologie / image. Raccourcis **LaboratoireSearch** et **MyLabExaminations**.',
  },

  // === BANQUE DE SANG / TRANSFUSION (utilisateur) ===
  BanqueSangSearch: {
    type: 'search',
    actions: [
      { id: 'bs-back', label: 'Retour', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'Flèche en-tête' },
      { id: 'bs-gps', label: 'Choisir localisation GPS', icon: LUCIDE_ICONS.location, category: 'action', description: 'ModernGPSModal — obligatoire avant recherche' },
      { id: 'bs-distance', label: 'Distance max (5–200 km)', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Stepper − / +' },
      { id: 'bs-unified-search', label: 'Recherche intelligente / Lancer la recherche', icon: LUCIDE_ICONS.search, category: 'search', description: 'Si connecté **et** groupe chargé → **BloodDonation** avec searchParams ; sinon → **BanqueSangList** (filters available_only, check_stocks, groupe optionnel)' },
      { id: 'bs-banner-group', label: 'Bandeau groupe sanguin', icon: LUCIDE_ICONS.droplet, category: 'action', description: 'GET `/api/blood-donation/donor/blood-groups` ; affiche compatibles via GET `/api/blood-donation/compatibility/{groupe}`' },
      { id: 'bs-save-group', label: 'Enregistrer groupe (modal)', icon: LUCIDE_ICONS.add, category: 'action', description: 'POST `/api/blood-donation/donor/blood-group` avec **groupe_sanguin** (pas blood_group)' },
      { id: 'bs-heart-header', label: 'Devenir donneur (cœur animé)', icon: LUCIDE_ICONS.heart, route: 'BloodDonation', category: 'navigation', description: 'Visible seulement si pas encore de groupe enregistré' },
      { id: 'bs-open-blood-app', label: 'Espace don / matching', icon: LUCIDE_ICONS.users, route: 'BloodDonation', category: 'navigation', description: 'Même route que bouton cœur — profil donneur + demandes urgentes' },
    ],
    elements: [
      { id: 'bs-header-gradient', type: 'card', label: 'En-tête gradient (titre Transfusion / banque de sang)', actionable: false },
      { id: 'bs-info-card', type: 'card', label: 'Bon à savoir (dons, urgence téléphone, stocks)', actionable: false },
    ],
    guide: '**BanqueSangSearchScreen** : accueil utilisateur « Transfusion » (grille Yukpo). Prérequis **GPS** (contexte Location ou modal). Connecté : chargement groupe via API donneur ; recherche unifiée bascule vers **BloodDonation** (matching) si `user && userBloodGroup`, sinon liste classique **BanqueSangList** avec filtres géo. Ne pas confondre avec **BloodDonationRequest** (formulaire de **demande** de sang).',
  },

  BloodDonation: {
    type: 'specialized',
    actions: [
      { id: 'bd-tab-requests', label: 'Onglet Demandes urgentes', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Liste `bloodDonationService.listActiveRequests` — badges urgence critical/urgent/normal' },
      { id: 'bd-tab-profile', label: 'Onglet Profil donneur', icon: LUCIDE_ICONS.user, category: 'action', description: 'Groupe(s) via `getMyBloodGroups` ; sélecteur + `createOrUpdateBloodGroup`' },
      { id: 'bd-tab-compat', label: 'Onglet Compatibilité', icon: LUCIDE_ICONS.list, category: 'action', description: '`getBloodGroupCompatibility` pour le groupe sélectionné' },
      { id: 'bd-respond', label: 'Répondre à une demande', icon: LUCIDE_ICONS.check, category: 'action', description: 'Modal puis `notifyDonorsForRequest(request.id)`' },
      { id: 'find-banks', label: 'Rechercher des banques', icon: LUCIDE_ICONS.search, route: 'BanqueSangSearch', category: 'search', description: 'Retour au flux carte / liste banques' },
      { id: 'new-blood-request', label: 'Créer une demande de sang (formulaire)', icon: LUCIDE_ICONS.add, route: 'BloodDonationRequest', category: 'creation', description: 'Écran dédié **BloodDonationRequest** (pas l’onglet Profil)' },
      { id: 'my-donations', label: 'Historique dons / demandes', icon: LUCIDE_ICONS.clipboard, route: 'MyBloodDonations', category: 'navigation', description: 'MyBloodDonationsScreen' },
    ],
    elements: [
      { id: 'bd-tabs', type: 'tab', label: 'Segments Demandes / Profil / Compatibilité', actionable: true },
      { id: 'bd-requests-list', type: 'card', label: 'Cartes demandes (répondre)', actionable: true },
    ],
    guide: '**BloodDonationScreen** : espace donneur + mur des **demandes actives**. Trois onglets (demandes, profil groupe sanguin, compatibilité). Les boutons « Faire une demande de don / Devenir donneur » sur **BanqueSangDetails** ouvrent souvent **BloodDonation** (pas directement BloodDonationRequest). Pour **publier** une demande structurée : **BloodDonationRequest**.',
  },

  BloodDonationRequest: {
    type: 'form',
    actions: [
      { id: 'select-bank', label: 'Choisir Banque', icon: LUCIDE_ICONS.droplet, category: 'action', description: 'Sélectionner la banque de sang' },
      { id: 'select-group', label: 'Choisir Groupe', icon: LUCIDE_ICONS.list, category: 'action', description: 'Sélectionner le groupe sanguin requis' },
      { id: 'set-urgency', label: 'Urgence', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Activer une demande urgente et définir le niveau' },
      { id: 'submit-request', label: 'Créer la Demande', icon: LUCIDE_ICONS.check, category: 'creation', description: 'Créer la demande de don de sang' },
    ],
    elements: [
      { id: 'bank-selector', type: 'card', label: 'Sélection banque de sang', actionable: true },
      { id: 'blood-group-grid', type: 'button', label: 'Choix groupe sanguin requis', actionable: true },
      { id: 'quantity', type: 'input', label: 'Quantité + unité', actionable: true },
      { id: 'urgency-switch', type: 'button', label: 'Switch demande urgente', actionable: true },
      { id: 'notes', type: 'input', label: 'Informations additionnelles (patient, hôpital, notes)', actionable: true },
      { id: 'submit', type: 'button', label: 'Bouton créer la demande', actionable: true },
    ],
    guide: 'Créer une demande de don de sang. Choisissez une banque, le groupe requis, la quantité, le niveau d\'urgence, et (optionnel) patient/hôpital/notes. Après création, vous pouvez voir les correspondances et notifier des donneurs compatibles.',
  },

  BloodDonationMatches: {
    type: 'list',
    actions: [
      { id: 'refresh', label: 'Actualiser', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Rafraîchir la liste des correspondances' },
      { id: 'contact', label: 'Contacter', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter un donneur ou une banque (appel/WhatsApp)' },
    ],
    elements: [
      { id: 'matches-list', type: 'card', label: 'Liste des correspondances (donneurs compatibles)', actionable: true },
    ],
    guide: 'Correspondances don de sang. Consultez les donneurs compatibles trouvés pour une demande, contactez-les et suivez leur statut (notifié, accepté, refusé, complété).',
  },

  MyBloodDonations: {
    type: 'list',
    actions: [
      { id: 'refresh', label: 'Actualiser', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Rafraîchir l\'historique' },
      { id: 'new-request', label: 'Nouvelle Demande', icon: LUCIDE_ICONS.add, route: 'BloodDonationRequest', category: 'creation', description: 'Créer une nouvelle demande' },
    ],
    elements: [
      { id: 'donations-history', type: 'card', label: 'Historique des dons et demandes', actionable: true },
    ],
    guide: 'Historique don de sang. Consultez vos dons enregistrés et vos demandes de sang (statuts, dates, banque associée).',
  },

  // === ASSURANCE ===
  AssuranceDashboard: {
    type: 'dashboard',
    actions: [
      { id: 'tab-overview', label: 'Onglet Accueil', icon: LUCIDE_ICONS.list, category: 'action', description: 'Vue d’ensemble : stats (produits actifs, polices actives, sinistres ouverts, souscriptions), bannières renouvellement / sinistres, actions rapides, derniers sinistres et polices' },
      { id: 'tab-products', label: 'Onglet Produits', icon: LUCIDE_ICONS.package, category: 'action', description: 'Liste des produits assurance du partenaire ; bascule actif/inactif (toggle) ; bouton ajouter → modal création' },
      { id: 'tab-policies', label: 'Onglet Polices', icon: LUCIDE_ICONS.file, category: 'action', description: 'Polices émises ; si statut **active** : Suspendre ou Résilier (confirmation) — pas de formulaire d’émission sur cet écran (quick action bascule seulement vers cet onglet)' },
      { id: 'tab-claims', label: 'Onglet Sinistres', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Traitement sinistres : Analyse IA ; Instruire ; Approuver / Refuser ; Indemniser (montant = montant réclamé si présent)' },
      { id: 'tab-analytics', label: 'Onglet Stats', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Synthèse produits, polices (CA total si renvoyé), sinistres (totaux réclamé/indemnisé si renvoyés)' },
      { id: 'new-product-modal', label: 'Nouveau produit (modal)', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Modal : nom obligatoire ; type / sous-catégorie ; compagnie, description, primes, couverture max, franchise, âges, durée mois — POST création avec service_id des params route' },
      { id: 'toggle-product', label: 'Activer / désactiver produit', icon: LUCIDE_ICONS.check, category: 'action', description: 'POST /api/assurance/products/{id}/toggle' },
      { id: 'search-market', label: 'Recherche marché assurance', icon: LUCIDE_ICONS.search, route: 'InsuranceServicesSearch', category: 'search', description: 'Icône loupe en-tête — catalogue / recherche utilisateur (pas la gestion partenaire)' },
      { id: 'ai-quote', label: 'Devis IA', icon: LUCIDE_ICONS.activity, route: 'InsuranceQuoteRequest', category: 'navigation', description: 'Action rapide — écran devis / IA assurance côté flux utilisateur' },
      { id: 'wallet', label: 'Portefeuille', icon: LUCIDE_ICONS['credit-card'], route: 'WalletFinancial', category: 'navigation', description: 'Revenus et solde Yukpo' },
      { id: 'logout', label: 'Déconnexion', icon: LUCIDE_ICONS.x, category: 'action', description: 'Action rapide — confirmation puis logout (AuthContext)' },
      { id: 'client-polices', label: 'Mes polices (client)', icon: LUCIDE_ICONS.shield, route: 'MesPolicesAssurance', category: 'navigation', description: 'Hors de cet écran — réservé aux assurés ; ne pas présenter comme action principale du dashboard partenaire' },
      { id: 'client-declare-sinistre', label: 'Déclarer sinistre (client)', icon: LUCIDE_ICONS.alert, route: 'DeclarationSinistre', category: 'navigation', description: 'Hors dashboard partenaire — écran client' },
    ],
    elements: [
      { id: 'tabs', type: 'tab', label: 'Onglets : Accueil, Produits, Polices, Sinistres, Stats', actionable: true },
      { id: 'stats-overview', type: 'card', label: 'Grille statistiques (vue Accueil)', actionable: false },
      { id: 'banners', type: 'card', label: 'Bannières polices à renouveler / sinistres en attente', actionable: true },
      { id: 'quick-actions', type: 'button', label: 'Actions rapides (nouveau produit, polices, sinistres, Devis IA, portefeuille, déconnexion)', actionable: true },
      { id: 'product-modal', type: 'modal', label: 'Modal création produit', actionable: true },
      { id: 'pull-refresh', type: 'button', label: 'Tirer pour rafraîchir (tous onglets scroll)', actionable: true },
    ],
    guide: '**AssuranceDashboardScreen** : tableau de bord **partenaire / assureur** Yukpo. Chargement au focus : **listProducts**, **listPolicies**, **listClaims**, **getDashboardStats** (échecs partiels tolérés). Cinq onglets : Accueil (stats + bannières + actions rapides + aperçus), Produits (liste + toggle actif + modal création), Polices (liste + suspendre/résilier si active), Sinistres (workflow + **aiAnalyzeClaim**), Stats (agrégats dashboard). L’icône recherche en-tête ouvre **InsuranceServicesSearch** (marché), pas le CRUD partenaire. Les écrans **MesPolicesAssurance** / **DeclarationSinistre** sont des parcours **client**, pas ce dashboard.',
  },

  InsuranceServicesSearch: {
    type: 'search',
    actions: [
      { id: 'quick-type', label: 'Recherches rapides', icon: 'zap', category: 'action', description: 'Cartes Auto / Santé / Habitation — pré-remplissent le type (chips)' },
      { id: 'chips-type', label: 'Type d’assurance (chips)', icon: LUCIDE_ICONS.shield, category: 'action', description: 'Liste fixe : Auto, Santé, Habitation, Vie, Voyage, Professionnelle, Responsabilité civile' },
      { id: 'chips-compagnie', label: 'Compagnie', icon: LUCIDE_ICONS.building2, category: 'action', description: 'Saisie libre + chips (AXA, Allianz, Sanlam, …)' },
      { id: 'loc-ville', label: 'Ville', icon: LUCIDE_ICONS.location, category: 'action', description: '**LocationSelector** (scope all, enrichWithBackend)' },
      { id: 'loc-quartier', label: 'Quartier', icon: LUCIDE_ICONS.location, category: 'action', description: '**LocationSelector** optionnel avec **cityContext** depuis la ville' },
      { id: 'gps-modal', label: 'GPS', icon: LUCIDE_ICONS.location, category: 'action', description: '**ModernGPSModal** ; sinon remplissage auto depuis **LocationContext** au montage' },
      { id: 'rayon', label: 'Rayon (km)', icon: LUCIDE_ICONS.activity, category: 'action', description: '1–50 km si coordonnées GPS valides' },
      { id: 'prix-range', label: 'Prime annuelle min/max', icon: LUCIDE_ICONS.dollar, category: 'action', description: 'Champs numériques optionnels → filtres API' },
      { id: 'run-search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'InsuranceServicesResults', category: 'search', description: 'Navigation **InsuranceServicesResults** avec `{ filters }` construit (type, compagnie, ville, quartier, gps, rayon, prix) — **sans** appel API sur cet écran' },
      { id: 'request-quote', label: 'Demander un devis', icon: LUCIDE_ICONS.file, route: 'InsuranceQuoteRequest', category: 'navigation', description: '**InsuranceQuoteRequest** avec `typeAssurance`, `compagnie`, `ville`, `quartier` — ne lance pas la recherche catalogue' },
    ],
    elements: [
      { id: 'header', type: 'card', label: 'En-tête gradient + retour', actionable: true },
      { id: 'form-card', type: 'input', label: 'Formulaire filtres + deux boutons (Rechercher / Demander un devis)', actionable: true },
    ],
    guide: '**InsuranceServicesSearchScreen** : entrée **utilisateur** assurance (grille accueil → cette route). Construit un objet filtres puis soit **navigate InsuranceServicesResults** (recherche), soit **navigate InsuranceQuoteRequest** (devis IA). Pas d’appel **searchInsurance** ici.',
  },

  InsuranceServicesResults: {
    type: 'list',
    actions: [
      { id: 'refresh', label: 'Tirer pour rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Relance **GET /api/assurance/search** avec les mêmes filtres (params route)' },
      { id: 'open-service', label: 'Ouvrir la fiche', icon: LUCIDE_ICONS.info, route: 'ServiceDetail', category: 'navigation', description: 'Carte → **ServiceDetail** avec `serviceId: item.id` (id résultat recherche)' },
      { id: 'back-edit', label: 'Modifier la recherche', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'État vide : retour arrière pour changer critères' },
    ],
    elements: [
      { id: 'flatlist', type: 'card', label: 'Liste résultats (titre, type, adresse, distance km, prix ou « Sur devis »)', actionable: true },
    ],
    guide: '**InsuranceServicesResultsScreen** : au montage, **assuranceService.searchInsurance** → **GET /api/assurance/search** avec filtres issus de `route.params.filters`. Mapping champs backend (`titre`, `ville`, `telephone`, `prix`, `distance_km`, …). Pas de comparaison IA ni **compareProducts** sur cet écran.',
  },

  InsuranceQuoteRequest: {
    type: 'form',
    actions: [
      { id: 'pick-type', label: 'Type d’assurance *', icon: LUCIDE_ICONS.shield, category: 'action', description: 'Obligatoire pour générer ; même liste de types que la recherche' },
      { id: 'fill-profile', label: 'Profil', icon: LUCIDE_ICONS.profile, category: 'action', description: 'Âge, nb personnes, profession, ville (texte), situation familiale (chips), budget mensuel — tous optionnels sauf type' },
      { id: 'auto-fields', label: 'Champs Auto', icon: LUCIDE_ICONS.car, category: 'action', description: 'Si type = Auto : type véhicule, valeur' },
      { id: 'home-fields', label: 'Champs Habitation', icon: LUCIDE_ICONS.home, category: 'action', description: 'Si type = Habitation : type bien, valeur' },
      { id: 'generate', label: 'Générer devis IA', icon: LUCIDE_ICONS.activity, category: 'action', description: '**POST /api/assurance/ai/quote** via **generateQuote(type, profile)**' },
      { id: 'new-quote', label: 'Nouveau devis', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Après résultat : `setShowResults(false)` pour revenir au formulaire' },
    ],
    elements: [
      { id: 'results-view', type: 'card', label: 'Vue résultat : primes, score adéquation (%), couvertures, franchises, avantages, justification', actionable: false },
    ],
    guide: '**InsuranceQuoteRequestScreen** : devis **IA** uniquement (**generateQuote**). Paramètres route optionnels `typeAssurance`, `compagnie`, `ville`, `quartier` depuis **InsuranceServicesSearch** — le formulaire n’exploite pas `compagnie`/`quartier` dans le state initial (seulement type et ville si passés). Pas de **compareProducts** / **getRecommendations** dans l’UI.',
  },

  MesPolicesAssurance: {
    type: 'list',
    actions: [
      { id: 'filter-chips', label: 'Filtres', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Toutes, Actives, Suspendues, Expirées — filtre client sur la liste chargée' },
      { id: 'refresh', label: 'Rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Pull-to-refresh → **getClientPolicies**' },
      { id: 'declare-claim', label: 'Déclarer un sinistre', icon: LUCIDE_ICONS.alert, route: 'DeclarationSinistre', category: 'navigation', description: 'Uniquement si statut **active** — passe `{ policy }`' },
      { id: 'track-claims', label: 'Mes sinistres', icon: LUCIDE_ICONS.eye, route: 'SuiviSinistre', category: 'navigation', description: 'Si **active** — **SuiviSinistre** avec `{ policy_id }`' },
      { id: 'find-insurance', label: 'Rechercher une assurance', icon: LUCIDE_ICONS.search, route: 'InsuranceServicesSearch', category: 'search', description: 'État vide : bouton vers le formulaire de recherche marché' },
    ],
    elements: [
      { id: 'expiry-banner', type: 'card', label: 'Bannière si expiration dans 30 jours', actionable: false },
      { id: 'policy-cards', type: 'card', label: 'Cartes police : numéro, produit, dates, prime, couverture max, renouvellement auto', actionable: true },
    ],
    guide: '**MesPolicesAssuranceScreen** : **GET /api/assurance/policies/client** (**getClientPolicies**). Compteur polices actives ; alerte **30 jours** avant expiration. Actions réservées aux polices **active**. Ce n’est **pas** le dashboard partenaire (**AssuranceDashboard**).',
  },

  DeclarationSinistre: {
    type: 'form',
    actions: [
      { id: 'step1', label: 'Étape 1', icon: LUCIDE_ICONS['list-checks'], category: 'action', description: 'Type de sinistre (grille) + date AAAA-MM-JJ * + lieu optionnel' },
      { id: 'step2', label: 'Étape 2', icon: LUCIDE_ICONS.file, category: 'action', description: 'Description * (min 20 caractères), circonstances, témoins' },
      { id: 'step3', label: 'Étape 3', icon: LUCIDE_ICONS.dollar, category: 'action', description: 'Dommages estimés, montant réclamé, récapitulatif' },
      { id: 'submit', label: 'Soumettre', icon: LUCIDE_ICONS.check, category: 'action', description: '**POST /api/assurance/claims** (**createClaim**) ; exige `route.params.policy` sinon erreur' },
    ],
    elements: [
      { id: 'policy-context', type: 'card', label: 'Police préchargée depuis Mes polices', actionable: false },
    ],
    guide: '**DeclarationSinistreScreen** : déclaration **assuré**. **policy** obligatoire via navigation depuis **MesPolicesAssurance** (police active). Workflow 3 étapes puis **createClaim** ; succès → alerte avec **numero_sinistre**.',
  },

  SuiviSinistre: {
    type: 'list',
    actions: [
      { id: 'refresh', label: 'Rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Pull-to-refresh → **getClientClaims**' },
      { id: 'expand-card', label: 'Détail sinistre', icon: LUCIDE_ICONS.eye, category: 'action', description: 'Appui carte pour replier/déplier (état local)' },
    ],
    elements: [
      { id: 'timeline', type: 'card', label: 'Progression statuts (lecture seule)', actionable: false },
    ],
    guide: '**SuiviSinistreScreen** : **GET /api/assurance/claims/client** ; si `policy_id` en params, filtre **côté app**. Affichage des dossiers et statuts — **aucune** action métier (pas d’approbation / indemnisation : côté partenaire).',
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
      { id: 'back', label: 'Retour', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'Flèche en-tête' },
      { id: 'create-offre-header', label: 'Publier (+)', icon: LUCIDE_ICONS.add, route: 'CreateOffre', category: 'creation', description: 'Création d’offre (écran CreateOffreScreen) — distinct du formulaire partenaire OffresEmploiForm' },
      { id: 'run-search', label: 'Lancer recherche', icon: LUCIDE_ICONS.search, category: 'search', description: 'Barre titre/secteur → onSubmit / recherche : offreEmploiService.searchOffres (GET /api/offres-emploi/search), pas navigation vers OffreSearch' },
      { id: 'profil-cv', label: 'Mon CV / Profil', icon: LUCIDE_ICONS.profile, route: 'ProfilCandidat', category: 'navigation', description: 'Raccourci en-tête' },
      { id: 'cv-analysis', label: 'Analyse CV', icon: LUCIDE_ICONS.file, route: 'AICVAnalysis', category: 'help', description: 'Navigation vers écran dédié (pas de modal IA ouverte depuis ce fichier)' },
      { id: 'salary-predict', label: 'Salaire IA', icon: LUCIDE_ICONS.dollar, route: 'AISalaryPrediction', category: 'help', description: 'Écran prédiction salaire' },
      { id: 'suggest-formations', label: 'Formations IA', icon: LUCIDE_ICONS.graduation, route: 'AISuggestFormations', category: 'help', description: 'Suggestions formations' },
      { id: 'alerts', label: 'Alertes', icon: LUCIDE_ICONS.bell, route: 'AlertesEmploi', category: 'action', description: 'Alertes emploi' },
      { id: 'matching-suggestions', label: 'Offres recommandées', icon: LUCIDE_ICONS.star, category: 'search', description: 'getMatchingOffres(60,10) → OffreList { offres, title } ou alerte profil' },
      { id: 'open-details', label: 'Détails / Postuler', icon: LUCIDE_ICONS.briefcase, route: 'OffreDetails', category: 'navigation', description: 'Carte offre → OffreDetails { offreId }' },
    ],
    elements: [
      { id: 'job-search', type: 'input', label: 'Champ recherche (query API)', actionable: true },
      { id: 'contract-chips', type: 'button', label: 'Filtres contrat (client-side sur liste chargée)', actionable: true },
      { id: 'bookmark-local', type: 'button', label: 'Sauvegarder (état local Set, session)', actionable: true },
      { id: 'estimate-inline', type: 'button', label: 'Estimer salaire carte (useAIWithFallback.predictSalary)', actionable: true },
    ],
    guide: 'OffresEmploiHomeScreen : liste via searchOffres (page 1, limit 20, GPS + rayon_km 50 si dispo, query optionnelle). Filtres CDI/CDD/Stage/Freelance = filtrage client. Signets = mémoire locale. Bouton + → CreateOffre. Raccourcis IA = navigation AICVAnalysis / AISalaryPrediction / AISuggestFormations. Recommandations = matching/offres → OffreList. Distinguer CreateOffre et OffresEmploiForm (hub).',
  },
  OffresEmploiHub: {
    type: 'dashboard',
    actions: [
      { id: 'search-bar', label: 'Barre recherche', icon: LUCIDE_ICONS.search, route: 'OffreSearch', category: 'search', description: 'Ouvre OffreSearch (filtres avancés)' },
      { id: 'fab-create', label: 'FAB +', icon: LUCIDE_ICONS.add, route: 'OffresEmploiForm', category: 'creation', description: 'Toujours OffresEmploiForm (formulaire partenaire / service)' },
      { id: 'dashboard-api', label: 'Stats', icon: LUCIDE_ICONS.activity, category: 'action', description: 'dashboard/candidat ou dashboard/employeur selon détection' },
      { id: 'mes-offres', label: 'Mes offres / Candidatures', icon: LUCIDE_ICONS.briefcase, route: 'MesOffres', category: 'navigation', description: 'Plusieurs raccourcis hub pointent vers MesOffres' },
      { id: 'explorer-home', label: 'Explorer offres', icon: LUCIDE_ICONS.search, route: 'OffresEmploiHome', category: 'navigation', description: 'Liste recherche moderne' },
    ],
    elements: [
      { id: 'stats-grid', type: 'card', label: 'Grille stats (offres, candidatures, attente, matchings)', actionable: false },
      { id: 'ai-tools-row', type: 'card', label: 'Outils IA (AICVAnalysis, AISalaryPrediction, AISuggestFormations)', actionable: true },
    ],
    guide: 'OffresEmploiHubScreen : employeur si partenaire (partner_type offre_emploi / offreemploi / recruteur / employeur, normalisé) ou si offres déjà publiées détectées via API. Stats GET dashboard employeur|candidat. FAB → OffresEmploiForm. Carte « Publier » candidat → OffresEmploiForm. Quick actions employeur : nouvelle offre OffresEmploiForm ; MesOffres réutilisé pour candidatures/matching dans le code.',
  },

  CreateOffre: {
    type: 'form',
    actions: [
      { id: 'ai-fill', label: 'Remplir par IA', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Modal : POST /api/yukpo type creation_offre_emploi + texte' },
      { id: 'gps-current', label: 'Position GPS', icon: LUCIDE_ICONS.location, category: 'action', description: 'Remplit champ gps depuis LocationContext' },
      { id: 'submit', label: 'Publier', icon: LUCIDE_ICONS.check, category: 'creation', description: 'offreEmploiService.createOffre → POST /api/offres-emploi' },
    ],
    elements: [
      { id: 'contract-skills', type: 'input', label: 'Contrat, secteur, compétences, tags, salaire, télétravail…', actionable: true },
    ],
    guide: 'CreateOffreScreen : formulaire texte classique + compétences/tags. IA = orchestration Yukpo (creation_offre_emploi). Connexion requise. Différent d’OffresEmploiForm.',
  },

  OffreSearch: {
    type: 'search',
    actions: [
      { id: 'run-filters', label: 'Rechercher', icon: LUCIDE_ICONS.search, category: 'search', description: 'Navigate OffreList avec { filters } (secteur, types_contrat[], salaire_min, lieu, remote)' },
    ],
    elements: [
      { id: 'secteur-chips', type: 'button', label: 'Secteur (grille)', actionable: true },
      { id: 'contrat-chips', type: 'button', label: 'Types de contrat multi-sélection', actionable: true },
    ],
    guide: 'OffreSearchScreen : pas de carte GPS ici ; filtres → OffreList puis searchOffres avec params.',
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
  // LivreScolaireHome et BourseLivre → même composant LivreScolaireHomeScreen (AppNavigator.optimized).
  LivreScolaireHome: {
    type: 'specialized',
    actions: [
      { id: 'back', label: 'Retour', icon: LUCIDE_ICONS.arrowLeft, category: 'navigation', description: 'Flèche en-tête — revenir à l’écran précédent' },
      { id: 'libraire-header', label: 'Ma librairie / Devenir libraire', icon: LUCIDE_ICONS.store, category: 'navigation', description: 'Bouton en-tête à droite : partenaire librairie → LivreScolaireForm ; sinon → LibrairieRegistration' },
      { id: 'sell-troquer', label: 'Mettez vos livres en circulation', icon: LUCIDE_ICONS.camera, route: 'BookUploadV2', category: 'creation', description: 'Carte verte : photo recto/verso, session V2, vente / troc / don à l’étape suivante' },
      { id: 'buy-programme', label: 'Trouvez votre liste scolaire', icon: LUCIDE_ICONS['list-checks'], route: 'ProgrammeBesoinsSelector', category: 'navigation', description: 'Carte bleue : classe + manuels au programme officiel, neuf vs occasion' },
      { id: 'track-packages', label: 'Suivre mes paquets', icon: LUCIDE_ICONS.package, route: 'BookPackages', category: 'navigation', description: 'Livraisons / paquets livres (coursier, QR)' },
      { id: 'track-trocs', label: 'Suivre mes trocs', icon: LUCIDE_ICONS.refresh, route: 'MesTrocs', category: 'navigation', description: 'Échanges en cours' },
      { id: 'mes-besoins', label: 'Mes besoins', icon: LUCIDE_ICONS['list-checks'], route: 'MesBesoinsLivres', category: 'navigation', description: 'Demandes de dons / besoins actifs' },
      { id: 'qr-scan', label: 'Scanner QR', icon: LUCIDE_ICONS.camera, route: 'QRCodeShare', category: 'action', description: 'Icône QR du dashboard — mode scan pour valider arrivée coursier' },
      { id: 'refresh-ops', label: 'Rafraîchir le tableau de bord', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Recharge compteurs (achats, paquets, trocs, besoins)' },
      { id: 'open-book-detail', label: 'Ouvrir fiche livre', icon: LUCIDE_ICONS.book, route: 'LivreScolaireDetails', category: 'navigation', description: 'Appui sur une carte de la liste → détails + troc' },
    ],
    elements: [
      { id: 'header-gradient', type: 'card', label: 'En-tête Bourse du Livre (dégradé orange)', actionable: false },
      { id: 'ops-dashboard', type: 'card', label: 'Dashboard des opérations (compteurs + QR + refresh)', actionable: true },
      { id: 'nearby-list', type: 'card', label: 'Liste livres à proximité (GPS ~20 km, pull to refresh)', actionable: true },
    ],
    guide: 'Accueil Bourse du Livre (V2). Deux entrées principales : **Mettez vos livres en circulation** → BookUploadV2 (photos, analyse IA, vente/troc/don) ; **Trouvez votre liste scolaire** → ProgrammeBesoinsSelector. Le dashboard résume achats en cours, paquets à recevoir/envoyer, trocs en cours, besoins actifs ; raccourcis paquets / trocs / besoins ; astuce QR coursier. La liste charge les annonces proches via la position.',
  },

  // === BUS / TICKETS DE VOYAGE ===
  TicketVoyageHome: {
    type: 'specialized',
    actions: [
      { id: 'back', label: 'Retour', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'Flèche en-tête' },
      { id: 'my-tickets-header', label: 'Mes billets', icon: LUCIDE_ICONS.clipboard, route: 'MyBusTickets', category: 'navigation', description: 'Icône ticket en-tête' },
      { id: 'filters-panel', label: 'Filtres / tri', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Sliders + badge filtres actifs' },
      { id: 'search-run', label: 'Lancer recherche', icon: LUCIDE_ICONS.search, category: 'search', description: 'busTicketService.searchBusTickets après départ+arrivée' },
      { id: 'open-details', label: 'Détails offre', icon: LUCIDE_ICONS.bus, route: 'BusTicketDetails', category: 'navigation', description: 'Tap carte → product_id / agency' },
      { id: 'book-seat', label: 'Réserver', icon: LUCIDE_ICONS['credit-card'], route: 'BusTicketBooking', category: 'action', description: 'Si places disponibles → BusTicketBooking' },
    ],
    elements: [
      { id: 'location-departure', type: 'input', label: 'LocationSelector départ', actionable: true },
      { id: 'location-arrival', type: 'input', label: 'LocationSelector arrivée', actionable: true },
      { id: 'sort-modal', type: 'modal', label: 'Tri (prix, heure, pertinence…)', actionable: true },
      { id: 'quick-filters', type: 'button', label: 'Puces Aujourd’hui / Demain / Week-end / Proche', actionable: true },
    ],
    guide: 'TicketVoyageHomeScreen — hub moderne bus. LocationSelector départ/arrivée, date, aller-retour, filtres, tri client. Pas de chargement sans critères. Données via busTicketService.searchBusTickets. Autre parcours recherche : écran BusTicketSearch (CityAutocomplete + GET /api/bus-tickets/search).',
  },

  // === SUPERMARCHÉ / RESTAURANT ===
  SupermarketHome: {
    type: 'specialized',
    actions: [
      { id: 'back', label: 'Retour', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'Depuis Magasins sans magasin → goBack ; sinon retour liste magasins + désélection' },
      { id: 'select-supermarket', label: 'Choisir Magasin', icon: LUCIDE_ICONS.building2, category: 'navigation', description: 'Liste via supermarketService.listSupermarkets (GET /api/services/nearby + filtre client) — GPS requis' },
      { id: 'change-supermarket', label: 'Changer de magasin', icon: LUCIDE_ICONS.repeat, category: 'navigation', description: 'Icône repeat en-tête → onglet Magasins' },
      { id: 'browse-products', label: 'Parcourir Produits', icon: LUCIDE_ICONS['shopping-cart'], category: 'search', description: 'Après sélection : GET produits + catégories ; recherche debouncée ; chips catégorie + toggle promos uniquement' },
      { id: 'compare-prices', label: 'Comparer Prix', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Nom du produit (texte) → POST /api/supermarkets/compare-prices (compareProductPrices) — pas de scan code-barres sur cet écran' },
      { id: 'view-promotions', label: 'Promotions', icon: LUCIDE_ICONS.tag, category: 'navigation', description: 'Magasin choisi : promos du magasin ; sinon à proximité (nearby) si GPS' },
    ],
    elements: [
      { id: 'tab-magasins', type: 'tab', label: 'Magasins (seul onglet visible tant qu’aucun magasin n’est sélectionné)', actionable: true },
      { id: 'tab-produits', type: 'tab', label: 'Produits (après sélection magasin)', actionable: true },
      { id: 'tab-comparer', type: 'tab', label: 'Comparer (après sélection — compare tout de même par nom via API)', actionable: true },
      { id: 'tab-promos', type: 'tab', label: 'Promos (après sélection magasin)', actionable: true },
      { id: 'search-bar', type: 'input', label: 'Recherche contextuelle (magasin / produit / nom à comparer selon l’onglet)', actionable: true },
      { id: 'category-filter', type: 'button', label: 'Chips catégorie + bascule « promotions uniquement » (mode Produits)', actionable: true },
    ],
    guide: 'SupermarketHomeScreen : flux Magasins → (optionnel) Produits / Comparer / Promos. Onglets Produits-Comparer-Promos n’apparaissent qu’après choix d’un supermarché. Chargement magasins = GPS obligatoire, listSupermarkets → /api/services/nearby. Produits = /api/supermarkets/:id/products + categories. Comparaison = nom produit, compareProductPrices (POST compare-prices), pas de trigram/code-barre côté UI. Promos = magasin sélectionné ou nearby. Pas de navigation in-screen vers MenuPlanningHub / liste courses / livraison — autres modules Yukpo.',
  },

  // === AGENCE DE VOYAGE ===
  AgenceVoyageForm: {
    type: 'dashboard',
    actions: [
      { id: 'add-schedule', label: 'Ajouter Horaire', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Modal → POST ou PUT `/api/bus-tickets/agencies/schedules`' },
      { id: 'manage-schedules', label: 'Horaires', icon: LUCIDE_ICONS.clock, category: 'action', description: 'Onglet Horaires : GET `/api/bus-tickets/agencies/schedules`, édition/suppression' },
      { id: 'bus-models', label: 'Modèles Bus', icon: LUCIDE_ICONS.truck, category: 'action', description: 'Nouveau → POST `/api/bus-tickets/create-product` + `/api/bus-tickets/link` ; édition locale seulement après création' },
      { id: 'sold-tickets', label: 'Tickets Vendus', icon: LUCIDE_ICONS['credit-card'], category: 'action', description: 'GET `/api/bus-tickets/agency/tickets` ; tap → boarding summary + passengers' },
      { id: 'scan-qr', label: 'Scanner QR', icon: LUCIDE_ICONS.camera, route: 'BusTicketQRScanner', category: 'action', description: '**BusTicketQRScanner** : POST `/api/bus-tickets/validate` avec `qr_code_data` (params `product_id` du formulaire non lus par l’écran scanner actuel)' },
      { id: 'edit-service', label: 'Mon Service', icon: LUCIDE_ICONS.settings, category: 'action', description: 'POST `/api/agences-voyage` ; **partenaire** : nom/adresse/tél/email masqués dans l’UI' },
      { id: 'team', label: 'Équipe', icon: LUCIDE_ICONS.users, category: 'action', description: '**ServiceTeamManager** (`serviceId`)' },
      { id: 'ai-suggest', label: 'Conseils IA', icon: LUCIDE_ICONS.activity, category: 'help', description: 'POST `/ai/chat` + `context: travel_agency_partner_dashboard`' },
    ],
    elements: [
      { id: 'stats-grid', type: 'card', label: 'Statistiques (destinations, compagnies, horaires, tickets)', actionable: false },
      { id: 'quick-actions', type: 'button', label: 'Actions rapides', actionable: true },
      { id: 'ai-card', type: 'card', label: 'Recommandations IA', actionable: true },
      { id: 'schedules-list', type: 'card', label: 'Horaires récents', actionable: true },
      { id: 'tabs', type: 'tab', label: 'Onglets: overview | service | schedules | bus | tickets | team', actionable: true },
    ],
    guide: '**AgenceVoyageFormScreen** partenaire : init **GET** `/api/partners/me` + **GET** `/api/agences-voyage` (première agence). Dashboard 6 onglets ; création fiche **POST** `/api/agences-voyage` + **servicesApi.createService** si besoin. Horaires bus-tickets agencies ; tickets **GET** `/api/bus-tickets/agency/tickets` ; embarquement **GET** boarding summary/passengers, **POST** `/api/bus-tickets/validate/manual`. Conseils IA = `/ai/chat`. Flux **client** recherche agence = **AgenceVoyageSearch**, pas cet écran.',
  },
  BusTicketQRScanner: {
    type: 'specialized',
    actions: [
      { id: 'bts-scan', label: 'Scanner un QR', icon: LUCIDE_ICONS.camera, category: 'action', description: '**QRCodeScanner** → **POST** `/api/bus-tickets/validate` `{ qr_code_data }`' },
      { id: 'bts-again', label: 'Scanner un autre', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Réinitialise le flux après résultat' },
    ],
    elements: [
      { id: 'bts-header', type: 'card', label: 'Titre scanner + compteur tickets validés', actionable: false },
    ],
    guide: '**BusTicketQRScannerScreen** : validation **POST** `/api/bus-tickets/validate` avec **`qr_code_data`** seul (pas de `product_id` dans ce fichier). Ouvert depuis l’onglet Tickets du dashboard agence ; params passés par **AgenceVoyageForm** non consommés ici.',
  },
  AgenceVoyageSearch: {
    type: 'search',
    actions: [
      { id: 'search-agencies', label: 'Chercher Agences', icon: LUCIDE_ICONS.search, category: 'search', description: 'Rechercher des agences de voyage par ville ou proximité' },
      { id: 'search-tickets', label: 'Chercher Tickets', icon: LUCIDE_ICONS['credit-card'], route: 'BusTicketSearch', category: 'search', description: 'Rechercher des billets de bus disponibles' },
      { id: 'my-tickets', label: 'Mes Billets', icon: LUCIDE_ICONS.clipboard, route: 'MyBusTickets', category: 'navigation', description: 'Voir mes billets achetés' },
    ],
    elements: [
      { id: 'mode-selector', type: 'button', label: 'Mode: Agences ou Tickets', actionable: true },
      { id: 'departure-input', type: 'input', label: 'Ville de départ', actionable: true },
      { id: 'arrival-input', type: 'input', label: 'Ville d\'arrivée', actionable: true },
      { id: 'quick-searches', type: 'card', label: 'Recherches rapides', actionable: true },
    ],
    guide: 'Recherche voyage. Deux modes : « Agences » (trouver une agence par proximité/destination) et « Tickets » (trouver un billet de bus par ville départ/arrivée/date). Utilisez les recherches rapides pour accéder rapidement à vos billets.',
  },
  AgenceVoyageDetails: {
    type: 'detail',
    actions: [
      { id: 'book-ticket', label: 'Réserver Billet', icon: LUCIDE_ICONS['credit-card'], route: 'BusTicketSearch', category: 'action', description: 'Réserver un billet de bus avec cette agence' },
      { id: 'call', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appeler l\'agence par téléphone' },
      { id: 'whatsapp', label: 'WhatsApp', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contacter l\'agence sur WhatsApp' },
      { id: 'share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager cette agence' },
      { id: 'ai-tips', label: 'Conseils IA', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Obtenir des recommandations de voyage personnalisées par l\'IA' },
    ],
    elements: [
      { id: 'agency-header', type: 'card', label: 'Nom, adresse, note, statut', actionable: false },
      { id: 'quick-actions', type: 'button', label: 'Réserver / Appeler / WhatsApp / Site web', actionable: true },
      { id: 'schedules', type: 'card', label: 'Horaires de départ', actionable: true },
      { id: 'services', type: 'card', label: 'Services proposés', actionable: false },
      { id: 'destinations', type: 'card', label: 'Destinations desservies', actionable: false },
    ],
    guide: 'Détails d\'une agence de voyage. Consultez les horaires de départ, services, destinations. Réservez un billet, appelez ou contactez via WhatsApp. L\'IA peut recommander les meilleurs trajets.',
  },
  BusTicketSearch: {
    type: 'search',
    actions: [
      { id: 'quick-dates', label: 'Recherches rapides', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Aujourd’hui, demain, week-end — ajuste date départ' },
      { id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, category: 'search', description: 'GET /api/bus-tickets/search + params (GPS optionnel, radius 100 km, filtres SearchFilters)' },
      { id: 'filters', label: 'Filtres', icon: LUCIDE_ICONS.filter, category: 'action', description: 'SearchFiltersComponent (prix, créneau horaire, compagnie, tri)' },
      { id: 'round-trip', label: 'Aller-retour', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Switch + date retour + heure retour optionnelle' },
      { id: 'pick-result', label: 'Choisir trajet', icon: LUCIDE_ICONS.bus, route: 'BusTicketBooking', category: 'action', description: 'Carte résultat → BusTicketBooking (productId, ticketData, isRoundTrip, returnDate/Time)' },
    ],
    elements: [
      { id: 'departure-city', type: 'input', label: 'CityAutocomplete ville départ', actionable: true },
      { id: 'arrival-city', type: 'input', label: 'CityAutocomplete ville arrivée', actionable: true },
      { id: 'date-picker', type: 'input', label: 'Date de départ', actionable: true },
      { id: 'results-list', type: 'card', label: 'Cartes trajets (prix, places, agence)', actionable: true },
    ],
    guide: 'BusTicketSearchScreen — formulaire scroll distinct du hub TicketVoyageHome. CityAutocomplete + apiGet /api/bus-tickets/search. Ne pas confondre avec LocationSelector du TicketVoyageHome.',
  },
  BusTicketBooking: {
    type: 'form',
    actions: [
      { id: 'select-seats', label: 'Choisir Places', icon: LUCIDE_ICONS.list, category: 'action', description: 'Sélectionner vos places dans le bus (carte interactive des sièges)' },
      { id: 'pay', label: 'Payer', icon: LUCIDE_ICONS['credit-card'], route: 'BusTicketPayment', category: 'action', description: 'Procéder au paiement après sélection des places' },
    ],
    elements: [
      { id: 'trip-info', type: 'card', label: 'Infos trajet (agence, villes, date, prix)', actionable: false },
      { id: 'seat-selector', type: 'card', label: 'Carte des sièges du bus', actionable: true },
      { id: 'trip-map', type: 'card', label: 'Carte du trajet', actionable: false },
    ],
    guide: 'Réservation de billet de bus. Visualisez le trajet sur la carte, sélectionnez vos places sur le plan du bus (vert=disponible, rouge=pris), puis procédez au paiement. Une caution est prélevée à la réservation.',
  },
  BusTicketPayment: {
    type: 'form',
    actions: [
      { id: 'pay-tokens', label: 'Payer avec Tokens', icon: LUCIDE_ICONS.dollar, category: 'action', description: 'Payer avec votre solde de tokens Yukpo' },
      { id: 'pay-mobile', label: 'Mobile Money', icon: LUCIDE_ICONS['credit-card'], category: 'action', description: 'Payer par Mobile Money (MTN, Orange)' },
      { id: 'recharge', label: 'Recharger', icon: LUCIDE_ICONS.add, route: 'RechargeTokens', category: 'navigation', description: 'Recharger votre solde de tokens' },
    ],
    elements: [
      { id: 'summary', type: 'card', label: 'Résumé (places, prix unitaire, sous-total, frais, total)', actionable: false },
      { id: 'payment-methods', type: 'button', label: 'Méthodes de paiement', actionable: true },
    ],
    guide: 'Paiement du billet de bus. Résumé de la réservation avec détail des coûts (prix × places + frais de réservation). Payez avec vos tokens Yukpo ou par Mobile Money. Si solde insuffisant, rechargez.',
  },
  MyBusTickets: {
    type: 'list',
    actions: [
      { id: 'view-ticket', label: 'Voir Billet', icon: LUCIDE_ICONS.eye, category: 'action', description: 'Consulter les détails d\'un billet (QR code, places, horaires)' },
      { id: 'search-new', label: 'Nouveau Billet', icon: LUCIDE_ICONS.search, route: 'BusTicketSearch', category: 'search', description: 'Rechercher un nouveau billet' },
    ],
    elements: [
      { id: 'tickets-list', type: 'card', label: 'Liste de mes billets', actionable: true },
    ],
    guide: 'Mes billets de bus. Consultez tous vos billets achetés avec statut de paiement, QR code pour l\'embarquement, et détails du trajet. Appuyez sur un billet pour voir les détails.',
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

  // === MES PRODUITS (Product Management) ===
  MesProduits: {
    type: 'dashboard',
    actions: [
      { id: 'back-services-tab', label: 'Retour hub Mes services', icon: LUCIDE_ICONS.briefcase, route: 'MesServices', category: 'navigation', description: 'MesServicesScreen (même UI que l’onglet Services)' },
      { id: 'header-add', label: 'Ajouter (en-tête +)', icon: LUCIDE_ICONS.add, category: 'creation', description: 'handleCreateNewProduct → AjouterProduitSimple ou FormulaireYukpoIntelligent selon contexte' },
      { id: 'header-stats', label: 'Statistiques globales', icon: LUCIDE_ICONS.activity, route: 'ProductStats', category: 'navigation', description: 'handleViewGlobalStats — stats catalogue' },
      { id: 'header-menu', label: 'Menu ⋮', icon: LUCIDE_ICONS.menu, category: 'action', description: 'Modale : Créer une vidéo, Galerie médias, Mes Publicités, Flash Promo, Promo Black Friday, Configuration livraison, Gérer les membres, Mes vidéos, Éditer service' },
      { id: 'card-modifier', label: 'Carte — Modifier', icon: LUCIDE_ICONS.edit, category: 'action', description: 'Édition rapide fiche produit' },
      { id: 'card-pause', label: 'Carte — Activer / Mettre en pause', icon: LUCIDE_ICONS.check, category: 'action', description: 'handleToggleProduct' },
      { id: 'card-share', label: 'Carte — Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partage externe (lien / message)' },
      { id: 'card-internal-share', label: 'Carte — Envoyer (interne)', icon: LUCIDE_ICONS.message, category: 'action', description: 'InternalShareButton (partage interne Yukpo)' },
      { id: 'card-more', label: 'Carte — Plus', icon: 'more-vertical', category: 'action', description: 'Feuille : Promouvoir, Statistiques produit, Dupliquer, Livraison (ProductDeliveryConfigModal), Supprimer' },
      { id: 'filter-chips', label: 'Filtres Tous / Actifs / En pause', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Chips sous l’en-tête' },
      { id: 'delivery-modal', label: 'Livraison par produit', icon: LUCIDE_ICONS.truck, category: 'action', description: 'ProductDeliveryConfigModal (serviceId + product_index)' },
      { id: 'video-modal', label: 'Vidéo produit', icon: LUCIDE_ICONS.video, category: 'action', description: 'ProductVideoCreationModal + navigateToVideoWizard' },
      { id: 'team-modal', label: 'Équipe / membres', icon: LUCIDE_ICONS.users, category: 'action', description: 'ServiceTeamManager en modal' },
      { id: 'media-gallery', label: 'Galerie médias', icon: LUCIDE_ICONS.camera, category: 'action', description: 'ServiceMediaGallery (service sélectionné)' },
      { id: 'dashboard-presta', label: 'Dashboard prestataire', icon: LUCIDE_ICONS.clipboard, route: 'DashboardPrestataire', category: 'navigation', description: 'Raccourci depuis flux existant' },
    ],
    elements: [
      { id: 'mp-toolbar', type: 'card', label: 'NavigatorToolbar « Produits » + compteur', actionable: false },
      { id: 'mp-mini-stats', type: 'card', label: 'Rangée mini cartes stats (scroll horizontal)', actionable: true },
      { id: 'mp-filter-chips', type: 'tab', label: 'Filtres tous / actif / inactif', actionable: true },
      { id: 'mp-product-cards', type: 'card', label: 'Cartes produit NativeCard (actions primaires + secondaires)', actionable: true },
      { id: 'mp-pull-refresh', type: 'button', label: 'Tirer pour rafraîchir', icon: LUCIDE_ICONS.refresh, actionable: true },
    ],
    guide: '**MesProduitsScreen** : catalogue produits « dense » (filtres, stats mini, cartes avec Modifier / Pause / Partager / Envoyer / Plus). Menu ⋮ : vidéo, galerie médias, publicités, flash promo, Black Friday, livraison (1er produit filtré), membres, VideoFeed, édition service (FormulaireYukpoIntelligent). Feuille **Plus** sur une carte : promouvoir, stats produit (ProductStats), dupliquer (mode duplicate), livraison unitaire, supprimer. **Rapport avec MesServicesScreen** : l’onglet barre du bas **Services** et la route **MesServices** = hub moderne principal ; **MesProduits** est l’écran complémentaire (bouton « Gérer les produits » / pied de liste). Ne pas confondre avec **ServicesActivity** (legacy).',
  },

  // === FORMULAIRE CRÉATION SERVICE (First-time) ===
  FormulaireYukpoIntelligent: {
    type: 'form',
    actions: [
      { id: 'fill-with-ai', label: 'IA Remplissage', icon: LUCIDE_ICONS.sparkles, category: 'action', description: 'L\'IA pré-remplit le formulaire à partir de votre description ou photo' },
      { id: 'google-business', label: 'Google Business', icon: LUCIDE_ICONS.search, category: 'action', description: 'Importer les infos de votre entreprise depuis Google' },
      { id: 'add-logo', label: 'Logo & Bannière', icon: LUCIDE_ICONS.image, category: 'action', description: 'Ajouter le logo et la bannière de votre structure' },
      { id: 'set-payment', label: 'Paiement', icon: LUCIDE_ICONS.money, category: 'action', description: 'Configurer les moyens de paiement acceptés' },
      { id: 'add-product', label: 'Ajouter Produit', icon: LUCIDE_ICONS.add, category: 'creation', description: 'Ajouter un produit au service en cours de création' },
      { id: 'submit', label: 'Publier', icon: LUCIDE_ICONS.check, category: 'action', description: 'Publier le service pour le rendre visible aux clients' },
    ],
    elements: [
      { id: 'general-block', type: 'card', label: 'Informations générales (titre, catégorie, description)', actionable: true },
      { id: 'contact-block', type: 'card', label: 'Contacts (téléphone, WhatsApp, email, site web)', actionable: true },
      { id: 'location-block', type: 'card', label: 'Localisation (GPS, adresse, zone)', actionable: true },
      { id: 'products-block', type: 'card', label: 'Produits (nom, prix, variantes, caractéristiques)', actionable: true },
      { id: 'media-block', type: 'card', label: 'Identité visuelle (logo, bannière, photos produit)', actionable: true },
      { id: 'payment-block', type: 'card', label: 'Moyens de paiement (Mobile Money, carte, espèces)', actionable: true },
    ],
    guide: 'Formulaire intelligent de création de service/boutique. L\'IA analyse votre description ou photo et pré-remplit automatiquement les champs. 6 étapes : 1) Infos générales (titre, catégorie, description) 2) Contacts (téléphone, WhatsApp, email) 3) Localisation GPS 4) Produits (nom, prix avec variantes, caractéristiques) 5) Identité visuelle (logo, bannière, photos) 6) Moyens de paiement. À la première création, Google Business peut importer automatiquement les infos de votre entreprise. Naviguez entre les blocs avec les boutons en haut.',
  },

  // === AJOUT PRODUIT SIMPLIFIÉ (Subsequent) ===
  AjouterProduitSimple: {
    type: 'form',
    actions: [
      { id: 'take-photo', label: 'Prendre Photo', icon: LUCIDE_ICONS.camera, category: 'action', description: 'Photographier le produit — l\'IA détecte automatiquement le nom, la catégorie et le prix' },
      { id: 'gallery', label: 'Galerie', icon: LUCIDE_ICONS.image, category: 'action', description: 'Choisir une photo existante du produit' },
      { id: 'fill-with-ai', label: 'IA Auto-remplissage', icon: LUCIDE_ICONS.sparkles, category: 'action', description: 'L\'IA analyse la photo et pré-remplit les champs du produit' },
      { id: 'add-variants', label: 'Variantes Prix', icon: LUCIDE_ICONS.tag, category: 'action', description: 'Ajouter des variantes de prix (tailles, couleurs, options)' },
      { id: 'submit', label: 'Publier Produit', icon: LUCIDE_ICONS.check, category: 'action', description: 'Publier le produit pour le rendre visible' },
      { id: 'my-products', label: 'Mes Produits', icon: LUCIDE_ICONS.package, route: 'MesProduits', category: 'navigation', description: 'Voir tous mes produits' },
    ],
    elements: [
      { id: 'product-form', type: 'card', label: 'Formulaire produit (nom, prix, description)', actionable: true },
      { id: 'media-upload', type: 'card', label: 'Photos et médias du produit', actionable: true },
      { id: 'ai-suggestion', type: 'card', label: 'Suggestions IA', actionable: false },
    ],
    guide: 'Ajout rapide de produit à votre catalogue existant. Prenez simplement une photo de votre produit — l\'IA analyse l\'image et pré-remplit automatiquement le nom, la catégorie, la description et le prix suggéré. Vous pouvez aussi ajouter des variantes de prix (tailles, couleurs, options). Le formulaire est simplifié car votre boutique/service est déjà configurée.',
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
      { id: 'open-stats-coach', label: 'Statistiques & Coach IA', icon: 'bar-chart-3', category: 'action', description: 'Panneau complet : km, sessions, calories, score santé, série, badges, défis, CO₂, historique Coach IA (icône graphique en-tête)' },
      { id: 'free-walk', label: 'Marche libre', icon: 'activity', category: 'action', description: 'Démarrer/arrêter une session GPS marche ; en cours : rouvrir les stats filtrées marche libre (icône piéton 🚶/🏃 en-tête)' },
      { id: 'community-alerts', label: 'Alertes communautaires', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Historique des alertes, confirmer/infirmer, commentaires (icône triangle alerte en-tête)' },
      { id: 'report-alert-bar', label: 'Signaler une alerte', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Bandeau dépliable puis puces horizontales (radar, contrôle, accident…)' },
      { id: 'set-destination', label: 'Saisie destination', icon: LUCIDE_ICONS.location, category: 'action', description: 'Champ destination / sélecteur de lieux + recherche d\'itinéraire (bouton principal bleu)' },
      { id: 'search-route', label: 'Recherche itinéraire', icon: LUCIDE_ICONS.search, category: 'search', description: 'Calcul d\'itinéraire (peut débiter des jetons Navigation)' },
      { id: 'start-navigation', label: 'Ouvrir dans Maps / Suivi', icon: LUCIDE_ICONS.forward, category: 'action', description: 'Lancer guidage dans Google Maps ou Apple Plans ; revenir sur Yukpo pour alertes et coach' },
      { id: 'change-mode', label: 'Mode de transport', icon: LUCIDE_ICONS.car, category: 'action', description: 'Voiture, à pied, transports, vélo' },
      { id: 'waypoints', label: 'Étapes & recalcul', icon: LUCIDE_ICONS.map, category: 'action', description: 'Ajouter des étapes POI et recalculer l\'itinéraire' },
      { id: 'share-route', label: 'Partager l\'itinéraire', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager le trajet sélectionné' },
      { id: 'share-stats', label: 'Partager mes stats', icon: LUCIDE_ICONS.share, category: 'action', description: 'Depuis le panneau statistiques : partage des performances de navigation/marche' },
      { id: 'recharge-nav-tokens', label: 'Solde / recharger', icon: LUCIDE_ICONS.dollar, category: 'action', description: 'Pastille sous l\'en-tête : jetons Navigation et période offerte' },
      { id: 'carpool-shortcut', label: 'Covoiturage Yukpo', icon: LUCIDE_ICONS.users, route: 'CovoiturageHome', category: 'navigation', description: 'Raccourci voiture+personnes dans l\'en-tête' },
      { id: 'coach-notif-settings', label: 'Notifications Coach IA', icon: LUCIDE_ICONS.settings, route: 'Settings', params: { initialSection: 'notifications' }, category: 'navigation', description: 'Réglages son/vibration des rappels motivation' },
    ],
    elements: [
      { id: 'header-back-compass', type: 'button', label: 'Retour (boussole 🧭)', icon: 'compass', actionable: true },
      { id: 'header-subtitle', type: 'card', label: 'Sous-titre mode (itinéraires / suivi / marche libre / stats / alertes)', actionable: false },
      { id: 'map-view', type: 'card', label: 'Carte GPS', actionable: true },
      { id: 'destination-input', type: 'input', label: 'Saisie destination & origine', actionable: true },
      { id: 'route-options', type: 'card', label: 'Cartes d\'itinéraires (trafic, durée, péage)', actionable: true },
      { id: 'travel-mode-tabs', type: 'tab', label: 'Voiture / À pied / Transport / Vélo', actionable: true },
      { id: 'prefs-chips', type: 'button', label: 'Préférences trajet (éviter péages, autoroutes…)', actionable: true },
      { id: 'favorites-chips', type: 'card', label: 'Favoris / lieux enregistrés', actionable: true },
      { id: 'checkpoint-reports', type: 'card', label: 'Signalements & alertes communautaires', actionable: true },
      { id: 'poi-categories', type: 'button', label: 'POI : Santé, Alimentation, Carburant, DAB, Parking, Culte, Hôtel, Police', actionable: true },
      { id: 'health-coach-preview', type: 'card', label: 'Aperçu Score Santé & Coach IA (carte violette)', actionable: true },
      { id: 'stats-period-modality', type: 'tab', label: 'Stats : période (semaine…année) & vue (tout / auto / marche libre)', actionable: true },
      { id: 'fab-chat', type: 'fab', label: 'Assistant IA (bulle flottante)', actionable: true },
    ],
    guide: 'Navigation Yukpo : planification d\'itinéraire (destination, modes, étapes, POI), suivi, alertes communautaires, marche libre GPS, jetons. **Les statistiques de marche et performances** (distance, durée, calories, sessions, score santé, série, badges, conseils, CO₂, défis) sont dans **Statistiques & Coach IA** (icône graphique en-tête) et via **Marche libre** (icône piéton). Ne pas renvoyer vers une app fitness externe pour ces données.',
  },

  // === BOURSE DU LIVRE === (route legacy : même écran que LivreScolaireHome)
  BourseLivre: {
    type: 'specialized',
    actions: [
      { id: 'back', label: 'Retour', icon: LUCIDE_ICONS.arrowLeft, category: 'navigation', description: 'Flèche en-tête — revenir à l’écran précédent' },
      { id: 'libraire-header', label: 'Ma librairie / Devenir libraire', icon: LUCIDE_ICONS.store, category: 'navigation', description: 'Bouton en-tête à droite : partenaire librairie → LivreScolaireForm ; sinon → LibrairieRegistration' },
      { id: 'sell-troquer', label: 'Mettez vos livres en circulation', icon: LUCIDE_ICONS.camera, route: 'BookUploadV2', category: 'creation', description: 'Carte verte : photo recto/verso, session V2, vente / troc / don à l’étape suivante' },
      { id: 'buy-programme', label: 'Trouvez votre liste scolaire', icon: LUCIDE_ICONS['list-checks'], route: 'ProgrammeBesoinsSelector', category: 'navigation', description: 'Carte bleue : classe + manuels au programme officiel, neuf vs occasion' },
      { id: 'track-packages', label: 'Suivre mes paquets', icon: LUCIDE_ICONS.package, route: 'BookPackages', category: 'navigation', description: 'Livraisons / paquets livres (coursier, QR)' },
      { id: 'track-trocs', label: 'Suivre mes trocs', icon: LUCIDE_ICONS.refresh, route: 'MesTrocs', category: 'navigation', description: 'Échanges en cours' },
      { id: 'mes-besoins', label: 'Mes besoins', icon: LUCIDE_ICONS['list-checks'], route: 'MesBesoinsLivres', category: 'navigation', description: 'Demandes de dons / besoins actifs' },
      { id: 'qr-scan', label: 'Scanner QR', icon: LUCIDE_ICONS.camera, route: 'QRCodeShare', category: 'action', description: 'Icône QR du dashboard — mode scan pour valider arrivée coursier' },
      { id: 'refresh-ops', label: 'Rafraîchir le tableau de bord', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Recharge compteurs (achats, paquets, trocs, besoins)' },
      { id: 'open-book-detail', label: 'Ouvrir fiche livre', icon: LUCIDE_ICONS.book, route: 'LivreScolaireDetails', category: 'navigation', description: 'Appui sur une carte de la liste → détails + troc' },
    ],
    elements: [
      { id: 'header-gradient', type: 'card', label: 'En-tête Bourse du Livre (dégradé orange)', actionable: false },
      { id: 'ops-dashboard', type: 'card', label: 'Dashboard des opérations (compteurs + QR + refresh)', actionable: true },
      { id: 'nearby-list', type: 'card', label: 'Liste livres à proximité (GPS ~20 km, pull to refresh)', actionable: true },
    ],
    guide: 'Même accueil que LivreScolaireHome (LivreScolaireHomeScreen). Ne pas décrire l’ancien écran avec barre de recherche + filtres + boutons « Recommandations IA » en tête — ce n’est plus cette UI.',
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
      { id: 'add-product', label: 'Ajouter Produit', icon: LUCIDE_ICONS.add, route: 'FormulaireYukpoIntelligent', category: 'creation', description: 'Ajouter un nouveau produit au catalogue (via formulaire IA avec photo)' },
      { id: 'bulk-import', label: 'Import en Masse', icon: LUCIDE_ICONS.upload, category: 'action', description: 'Importer jusqu\'à 500 produits d\'un coup via CSV (copier-coller depuis Excel) ou JSON. Format CSV: nom;prix;stock;categorie;marque;unite.' },
      { id: 'manage-catalog', label: 'Catalogue', icon: LUCIDE_ICONS.package, route: 'MesProduits', category: 'action', description: 'Gérer le catalogue : voir tous les produits, modifier prix/stock, activer/désactiver, ajouter images' },
      { id: 'manage-orders', label: 'Commandes', icon: LUCIDE_ICONS.clipboard, category: 'action', description: 'Traiter les commandes en cours — voir les commandes des clients, vérifier le coursier, remettre les produits' },
      { id: 'verify-courier', label: 'Vérifier Coursier', icon: LUCIDE_ICONS.check, route: 'ProviderCourierVerification', category: 'action', description: 'Scanner le QR ou saisir le code PIN du coursier pour vérifier son identité avant de remettre les produits' },
      { id: 'create-promo', label: 'Créer Promo', icon: LUCIDE_ICONS.tag, route: 'CreateFlashPromo', category: 'creation', description: 'Créer une promotion flash pour attirer les clients' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, category: 'navigation', description: 'Voir les statistiques : total produits, en stock, en promo, valeur du stock' },
      { id: 'wallet', label: 'Portefeuille', icon: LUCIDE_ICONS.dollar, route: 'WalletFinancial', category: 'navigation', description: 'Accéder au portefeuille financier — voir solde, historique transactions, retirer des fonds' },
    ],
    elements: [
      { id: 'overview-tab', type: 'tab', label: 'Accueil (stats, alertes commandes, actions rapides, catégories, produits récents)', actionable: true },
      { id: 'catalog-tab', type: 'tab', label: 'Catalogue (ajouter produit, gérer produits, import en masse CSV/JSON)', actionable: true },
      { id: 'orders-tab', type: 'tab', label: 'Commandes (commandes en attente de pickup, vérification coursier)', actionable: true },
      { id: 'promos-tab', type: 'tab', label: 'Promotions (créer promo flash, voir promos actives)', actionable: true },
      { id: 'analytics-tab', type: 'tab', label: 'Statistiques (résumé produits, stock, promotions, valeur)', actionable: true },
      { id: 'stats-grid', type: 'card', label: 'Grille statistiques (produits, en stock, en promo, valeur stock)', actionable: false },
      { id: 'alert-banner', type: 'card', label: 'Alerte commandes en attente de pickup', actionable: true },
    ],
    guide: 'Dashboard Supermarché partenaire. 5 onglets :\n- Accueil : stats (produits, stock, promos, valeur), alertes commandes, 5 actions rapides (ajouter produit, import masse, mes produits, commandes, portefeuille), catégories, produits récents.\n- Catalogue : ajouter un produit via formulaire IA, gérer les produits existants (Mes Produits), import en masse CSV/JSON (jusqu\'à 500 produits, copier-coller depuis Excel).\n- Commandes : commandes clients en attente de pickup par le coursier. Vérifier l\'identité du coursier (QR ou PIN) avant de remettre les produits.\n- Promotions : créer des promotions flash, voir les produits actuellement en promo.\n- Statistiques : résumé total produits, stock, promos, valeur du stock.\nAccès rapide au portefeuille financier pour suivre les revenus.',
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
    type: 'dashboard',
    actions: [
      { id: 'manage-exams', label: 'Examens', icon: LUCIDE_ICONS.clipboard, category: 'action', description: 'Onglet Examens : catalogue types (analyse / imagerie), prix, durée, préparation' },
      { id: 'analytics', label: 'Statistiques', icon: LUCIDE_ICONS.activity, route: 'LabAnalytics', category: 'navigation', description: '**LabAnalytics** avec `laboratoryId` = id fiche labo (`labData.id`)' },
      { id: 'ai-analysis', label: 'IA Analyse (info)', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Alerte : **LabAIAnalysis** nécessite `examinationId` (flux patient Mes examens)' },
    ],
    elements: [
      { id: 'tabs', type: 'tab', label: 'Onglets: overview | service | exams | analytics | team', actionable: true },
      { id: 'exam-catalog', type: 'card', label: 'Catalogue examens (analyses, imagerie, prix, délais)', actionable: true },
      { id: 'overview-quick', type: 'card', label: 'Vue d’ensemble : stats + actions rapides (examens, IA info, stats, service, wallet)', actionable: true },
    ],
    guide: '**LaboratoireFormScreen** partenaire : dashboard **overview | service | exams | analytics | team** ; création **POST** `/api/laboratoires` avec `service_id`. **Statistiques** → **LabAnalytics** (`laboratoryId`). Raccourci **IA Analyse** = message d’information (pas d’`examinationId` côté dashboard).',
  },

  BanqueSangForm: {
    type: 'dashboard',
    actions: [
      { id: 'tab-overview', label: 'Onglet Accueil (overview)', icon: LUCIDE_ICONS.home, category: 'action', description: 'Résumé stocks + stats `GET /api/banques-sang/:id/statistics`' },
      { id: 'tab-service', label: 'Onglet Service', icon: LUCIDE_ICONS.settings, category: 'action', description: 'Nom, adresse, LocationSelector / ModernGPSModal, Switch accepte_dons, accepte_demandes, urgence_24h, contacts' },
      { id: 'tab-stocks', label: 'Onglet Stocks', icon: LUCIDE_ICONS.droplet, category: 'action', description: 'Saisie quantités par groupe (GROUPES_SANGUINS) puis **POST** `/api/banques-sang/:id/stocks` body `{ stocks_groupes_sanguins }`' },
      { id: 'submit-bank', label: 'Enregistrer la banque (création)', icon: LUCIDE_ICONS.check, category: 'creation', description: '**POST** `/api/banques-sang` avec service_id (création service `servicesApi.createService` si besoin), gps, flags, contacts' },
      { id: 'manage-groups', label: 'Groupes (écran dédié)', icon: LUCIDE_ICONS.list, route: 'BloodGroupManagement', category: 'navigation', description: 'Si utilisé dans votre build' },
      { id: 'donation-matches', label: 'Correspondances dons', icon: LUCIDE_ICONS.users, route: 'BloodDonationMatches', category: 'navigation', description: 'Liste correspondances' },
    ],
    elements: [
      { id: 'tabs', type: 'tab', label: 'Onglets: overview | service | stocks', actionable: true },
      { id: 'partner-prefill', type: 'card', label: 'Préremplissage partenaire GET `/api/partners/me` + banque GET `/api/banques-sang`', actionable: false },
    ],
    guide: '**BanqueSangFormScreen** (partenaire **banquesang**) : mode **dashboard** si banque existante (`GET /api/banques-sang`), sinon formulaire création. Données persistantes auto-save `@banque_sang_form`. Mise à jour stocks via endpoint dédié (voir onglet Stocks). Distinct de l’écran **utilisateur** **BanqueSangSearch**.',
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
      { id: 'submit-offer', label: 'Soumettre offre', icon: LUCIDE_ICONS.check, category: 'creation', description: 'Formulaire partenaire : LocationSelector, serviceId, auto-save, confirmation — flux distinct de CreateOffreScreen' },
      { id: 'gps-lieu', label: 'Lieu / GPS', icon: LUCIDE_ICONS.location, category: 'action', description: 'ModernGPSModal + LocationSelector pour lieu_travail' },
    ],
    elements: [],
    guide: 'OffresEmploiFormScreen : création/édition recruteur (params serviceId, offreId, mode). Pas la même UI que CreateOffre (+ depuis OffresEmploiHome).',
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
      { id: 'share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager la fiche pharmacie' },
      { id: 'call', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appel téléphonique (si numéro renseigné)' },
      { id: 'whatsapp', label: 'WhatsApp', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contact WhatsApp (si renseigné)' },
      { id: 'chat-yukpo', label: 'Chat Yukpo', icon: 'message-square', category: 'action', description: 'ChatModalMobile in-app (connexion requise)' },
      { id: 'email', label: 'Email', icon: 'mail', category: 'action', description: 'Si email renseigné' },
      { id: 'website', label: 'Site web', icon: 'globe', category: 'action', description: 'Si URL renseignée' },
      { id: 'check-med', label: 'Disponibilité médicament', icon: LUCIDE_ICONS.search, category: 'action', description: 'Recherche dans cette pharmacie → checkAvailability → réserver si stock' },
      { id: 'ia-interactions', label: 'Interactions médicamenteuses', icon: LUCIDE_ICONS.alert, category: 'help', description: 'Modal: plusieurs noms → pharmacyService.checkInteractions' },
      { id: 'ia-conseils', label: 'Conseils santé IA', icon: LUCIDE_ICONS.activity, category: 'help', description: 'Conseils contextualisés (handleAISuggest)' },
      { id: 'my-orders', label: 'Mes commandes', icon: LUCIDE_ICONS.clipboard, route: 'MyPharmacyOrders', category: 'navigation', description: 'Suivi commandes client' },
      { id: 'itinerary', label: 'Itinéraire', icon: LUCIDE_ICONS.location, route: 'Navigation', category: 'navigation', description: 'GPS Yukpo vers la pharmacie' },
      { id: 'analytics-owner', label: 'Analytics', icon: LUCIDE_ICONS.activity, route: 'PharmacyAnalytics', category: 'navigation', description: 'Uniquement si user = propriétaire (user_id)' },
    ],
    elements: [
      { id: 'hero-badges', type: 'card', label: 'Ouvert/Fermé, De garde, Vérifié, 24h/24', actionable: false },
      { id: 'hours', type: 'card', label: 'Horaires + urgence téléphone', actionable: false },
      { id: 'reviews', type: 'card', label: 'Avis ProductCommentsSection', actionable: true },
    ],
    guide: 'Fiche officine: hero (badges, note, adresse), actions rapides conditionnelles (appel, WhatsApp, chat Yukpo, email, site), horaires/urgences, services en chips, recherche médicament dans cette pharmacie (modal + dispo + réservation), bloc IA (interactions multi-médicaments en modal, conseils santé), Mes commandes, Analytics si propriétaire, avis. Pas de navigation directe vers PharmacyAIInteractions depuis cet écran (IA intégrée ici en modals).',
  },

  HopitalDetails: {
    type: 'detail',
    actions: [
      { id: 'share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Share API fiche établissement' },
      { id: 'call', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Téléphone standard' },
      { id: 'whatsapp', label: 'WhatsApp', icon: LUCIDE_ICONS.message, category: 'action', description: 'wa.me' },
      { id: 'chat-yukpo', label: 'Chat Yukpo', icon: 'message-square', category: 'action', description: 'ChatModalMobile — connexion requise' },
      { id: 'rdv-quick', label: 'RDV (quick)', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Si rdv_en_ligne: quick action handleBook' },
      { id: 'email', label: 'Email', icon: 'mail', category: 'action', description: 'mailto si renseigné' },
      { id: 'website', label: 'Site web', icon: 'globe', category: 'action', description: 'Si URL renseignée' },
      { id: 'urgence-call', label: 'Urgences (tél)', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Si telephone_urgence' },
      { id: 'book-inline', label: 'Réserver RDV (plein bouton)', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'POST /api/hopitaux/{hospitalId}/book si rdv_en_ligne' },
      { id: 'ia-symptomes', label: 'IA symptômes / pathologie', icon: LUCIDE_ICONS.activity, category: 'help', description: 'searchPathology sur place' },
      { id: 'ia-reco', label: 'Recommandations IA', icon: LUCIDE_ICONS.activity, route: 'HospitalAIRecommendations', category: 'help', description: 'Écran dédié avec hospitalId' },
      { id: 'my-consultations', label: 'Mes consultations', icon: LUCIDE_ICONS.clipboard, route: 'MyConsultations', category: 'navigation', description: 'Liste client' },
      { id: 'analytics-owner', label: 'Analytics', icon: LUCIDE_ICONS.activity, route: 'HospitalAnalytics', category: 'navigation', description: 'Si propriétaire (user_id)' },
      { id: 'itinerary', label: 'Itinéraire', icon: LUCIDE_ICONS.location, route: 'Navigation', category: 'navigation', description: 'GPS Yukpo' },
    ],
    elements: [
      { id: 'hero-badges', type: 'card', label: 'Ouvert, Urgences, Banque sang, RDV ligne, Vérifié', actionable: false },
      { id: 'wait-times', type: 'card', label: 'Temps d\'attente par spécialité (getWaitTimes)', actionable: false },
      { id: 'emergency-status', type: 'card', label: 'Statut urgences (getEmergencyStatus)', actionable: false },
      { id: 'prestations-chips', type: 'card', label: 'Prestations médicales', actionable: false },
      { id: 'reviews', type: 'card', label: 'Avis ProductCommentsSection', actionable: true },
    ],
    guide: 'Fiche hôpital refonte: hero bleu, actions rapides conditionnelles, ligne urgence + stats si urgences_disponible, temps d\'attente, prestations, bloc IA symptômes (searchPathology), bouton réserver (POST book), Recommandations IA → écran séparé, Mes consultations, Analytics propriétaire, avis. BookAppointment (créneaux) est un autre flux — non ouvert automatiquement depuis cette fiche dans le code actuel.',
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
      { id: 'bsd-back-share', label: 'Retour / Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Hero : retour + partage natif (message + tel + urgence 24h)' },
      { id: 'bsd-call', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Linking tel — si `telephone`' },
      { id: 'bsd-whatsapp', label: 'WhatsApp', icon: LUCIDE_ICONS.message, category: 'action', description: 'wa.me depuis whatsapp ou téléphone' },
      { id: 'bsd-chat', label: 'Chat Yukpo', icon: 'message-square', category: 'action', description: 'ChatModalMobile — connexion requise ; service type banque_sang' },
      { id: 'bsd-don-quick', label: 'Don (raccourci)', icon: LUCIDE_ICONS.heart, route: 'BloodDonation', category: 'navigation', description: 'Même logique que « Faire une demande » / devenir donneur : **BloodDonation**' },
      { id: 'bsd-email', label: 'Email', icon: 'mail', category: 'action', description: 'mailto si renseigné' },
      { id: 'bsd-urgence-tel', label: 'Urgence (téléphone)', icon: LUCIDE_ICONS.alert, category: 'action', description: 'Si `telephone_urgence`' },
      { id: 'bsd-request-donation', label: 'Faire une demande de don', icon: LUCIDE_ICONS.heart, route: 'BloodDonation', category: 'navigation', description: 'Bouton pleine largeur — **BloodDonation**, login si besoin' },
      { id: 'bsd-become-donor', label: 'Devenir donneur', icon: LUCIDE_ICONS.droplet, route: 'BloodDonation', category: 'navigation', description: 'Si `accepte_dons` — **BloodDonation**' },
      { id: 'itinerary', label: 'Itinéraire GPS Yukpo', icon: LUCIDE_ICONS.location, route: 'Navigation', category: 'navigation', description: 'À proposer si l’utilisateur demande le trajet — pas un bouton dédié sur cet écran' },
    ],
    elements: [
      { id: 'bsd-hero', type: 'card', label: 'Hero gradient : nom, badges Ouvert/Fermé, Urgence 24h, Dons acceptés, Vérifié, note', actionable: false },
      { id: 'bsd-stocks', type: 'card', label: 'Grille stocks par groupe (seuils high/medium/low)', actionable: false },
      { id: 'bsd-comments', type: 'card', label: 'ProductCommentsSection (avis) si service_id', actionable: true },
    ],
    guide: '**BanqueSangDetailsScreen** : fiche `GET /api/banques-sang/:banqueId` ; stats notes `GET /api/specialized-services/:service_id/ratings/stats`. Stocks depuis `stocks_groupes_sanguins` (quantité objet) ou `stocks` plat. **Ne pas** dire que « Don » ouvre **BloodDonationRequest** : le code ouvre **BloodDonation** (sauf création de demande via autre écran). Chat = **ChatModalMobile**.',
  },

  /** Alias navigateur (`BloodBankDetails` → même composant que BanqueSangDetails) */
  BloodBankDetails: {
    type: 'detail',
    actions: [
      { id: 'bsd-back-share', label: 'Retour / Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Hero' },
      { id: 'bsd-call', label: 'Appeler', icon: LUCIDE_ICONS.call, category: 'action', description: 'Téléphone principal' },
      { id: 'bsd-whatsapp', label: 'WhatsApp', icon: LUCIDE_ICONS.message, category: 'action', description: 'Contact WhatsApp' },
      { id: 'bsd-chat', label: 'Chat Yukpo', icon: 'message-square', category: 'action', description: 'ChatModalMobile' },
      { id: 'bsd-don', label: 'Don / demande donneur', icon: LUCIDE_ICONS.heart, route: 'BloodDonation', category: 'navigation', description: '**BloodDonation**' },
      { id: 'bsd-urgence-tel', label: 'Ligne urgence', icon: LUCIDE_ICONS.alert, category: 'action', description: 'telephone_urgence' },
    ],
    elements: [
      { id: 'bsd-stocks', type: 'card', label: 'Stocks par groupe sanguin', actionable: false },
      { id: 'bsd-comments', type: 'card', label: 'Avis (ProductCommentsSection)', actionable: true },
    ],
    guide: 'Même écran que **BanqueSangDetails** (route alias **BloodBankDetails**). Voir guide BanqueSangDetails pour le détail.',
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
      { id: 'apply', label: 'Postuler', icon: LUCIDE_ICONS.check, category: 'action', description: 'createCandidature après contrôle profil + cv_url (getProfil)' },
      { id: 'profil-cv-link', label: 'Mettre à jour mon CV', icon: LUCIDE_ICONS.edit, route: 'ProfilCandidat', category: 'navigation', description: 'Lien sous le bouton postuler' },
    ],
    elements: [
      { id: 'matching-card', type: 'card', label: 'Score matching (getMatchingOffres si connecté)', actionable: false },
    ],
    guide: 'OffreDetailsScreen : GET offre par offreId ; carte score depuis liste matching/offres ; postuler POST candidatures ; pas de bouton partager ni navigation AICVAnalysis dans ce fichier.',
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
      { id: 'share', label: 'Partager', icon: LUCIDE_ICONS.share, category: 'action', description: 'Partager la fiche (message + titre / matière / lieu)' },
      { id: 'troquer', label: 'Troquer / Trouver un troc', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'POST /api/troc-livres/match puis navigation TrocMatching (si non propriétaire et livre disponible)' },
      { id: 'edit-owner', label: 'Modifier', icon: LUCIDE_ICONS.edit, route: 'LivreScolaireForm', category: 'action', description: 'Propriétaire uniquement : LivreScolaireForm avec livreId + mode edit' },
      { id: 'toggle-availability', label: 'Marquer disponible / indisponible', icon: LUCIDE_ICONS.check, category: 'action', description: 'Propriétaire : PATCH /api/bourse-livre/{id}/availability' },
    ],
    elements: [
      { id: 'hero', type: 'card', label: 'Bandeau orange : titre, auteur, badges disponibilité et état, viz classe → classe souhaitée', actionable: false },
      { id: 'gallery', type: 'card', label: 'Carrousel photos', actionable: true },
      { id: 'info-cards', type: 'card', label: 'Cartes Informations, État, Localisation, Vidéo si présente', actionable: false },
    ],
    guide: 'Fiche livre refonte 2026. Visiteur : **Partager**, **Troquer** (matching chaînes / TrocMatching). Propriétaire : **Modifier** (LivreScolaireForm), basculer **disponible / indisponible**. Pas de boutons « Acheter » ni « Contacter » ni « Prix IA » sur cet écran dans le code actuel — achat direct / chat passent par d’autres parcours (ex. TrocMatching, BookBuyDirect selon contexte).',
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
      { id: 'emergency-119', label: 'Urgence 119', icon: LUCIDE_ICONS.call, category: 'action', description: 'Appel rapide 119 / fallback 112' },
      { id: 'pharmacy', label: 'Pharmacie', icon: LUCIDE_ICONS.pharmacy, route: 'PharmacieSearch', category: 'navigation', description: 'Tuile hub' },
      { id: 'hospital', label: 'Hôpital', icon: LUCIDE_ICONS.hospital, route: 'HopitalSearch', category: 'navigation', description: 'Tuile hub' },
      { id: 'lab', label: 'Laboratoire', icon: LUCIDE_ICONS.activity, route: 'LaboratoireSearch', category: 'navigation', description: 'Tuile hub' },
      { id: 'blood', label: 'Banque de sang', icon: LUCIDE_ICONS.droplet, route: 'BanqueSangSearch', category: 'navigation', description: 'Tuile hub' },
    ],
    elements: [
      { id: 'unified-search', type: 'input', label: 'Recherche unifiée (routing mots-clés)', actionable: true },
      { id: 'duty-pharmacy', type: 'card', label: 'Pharmacie de garde proche (API products search garde)', actionable: true },
    ],
    guide: 'Hub santé rose: barre recherche intelligente (pharmacie/hôpital/labo/sang), 4 tuiles, bandeau pharmacie de garde (GET /api/pharmacies/products/search query garde + GPS). **MedicalServicesList** = alias même composant — params filtres non lus actuellement.',
  },

  MedicalServicesList: {
    type: 'specialized',
    actions: [],
    elements: [],
    guide: 'Alias stack → **HealthServicesHubScreen** (identique à HealthServicesHub). HopitalSearch y navigue avec {filters} si prestation/spécialité ; l\'écran n\'applique pas ces params — pour liste hôpitaux filtrée utiliser **HopitalList**.',
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

  PharmacieList: {
    type: 'list',
    actions: [
      { id: 'search', label: 'Affiner la recherche', icon: LUCIDE_ICONS.search, route: 'PharmacieSearch', category: 'search', description: 'Retour au formulaire (produit, garde, GPS, filtres)' },
    ],
    elements: [
      { id: 'list', type: 'card', label: 'Cartes pharmacie (Disponible, De garde, ville, distance, téléphone)', actionable: true },
    ],
    guide: 'Résultats depuis PharmacieSearch: params.filters (produit, garde, GPS, distance…). Chargement GET /api/pharmacies/search avec pagination (page/limit). Tap carte → PharmacieDetails (pharmacieId). Infinite scroll. État vide → retour / nouvelle recherche.',
  },
  MyPharmacyOrders: {
    type: 'list',
    actions: [
      { id: 'filter-all', label: 'Tous', icon: LUCIDE_ICONS.list, category: 'action', description: 'Afficher toutes les commandes' },
      { id: 'filter-pending', label: 'En attente', icon: LUCIDE_ICONS.clock, category: 'action', description: 'Statut pending / en_attente' },
      { id: 'filter-processing', label: 'En traitement', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Statut processing / en_traitement' },
      { id: 'filter-ready', label: 'Prêtes', icon: LUCIDE_ICONS.check, category: 'action', description: 'Statut ready / prête' },
      { id: 'filter-delivered', label: 'Livrées', icon: LUCIDE_ICONS.truck, category: 'action', description: 'Statut delivered / livrée' },
      { id: 'voir-pharmacie', label: 'Voir la pharmacie', icon: LUCIDE_ICONS.pharmacy, route: 'PharmacieDetails', category: 'navigation', description: 'Carte commande → PharmacieDetails(pharmacieId)' },
      { id: 'empty-search-pharma', label: 'Rechercher une pharmacie', icon: LUCIDE_ICONS.search, route: 'PharmacieSearch', category: 'navigation', description: 'Bouton si liste vide' },
    ],
    elements: [
      { id: 'filters-row', type: 'card', label: 'Filtres: Tous, En attente, En traitement, Prêtes, Livrées', actionable: true },
      { id: 'orders-list', type: 'card', label: 'Liste commandes (pharmacyService.getMyOrders)', actionable: true },
    ],
    guide: 'Client connecté: historique commandes pharmacie, pagination, filtres statut, pull refresh, infinite scroll. Tap carte ou « voir détails » → PharmacieDetails(pharmacieId). Vide → CTA PharmacieSearch. Sans compte → alerte et retour.',
  },
  PharmacyAnalytics: {
    type: 'dashboard',
    actions: [
      { id: 'period-7', label: 'Période 7 jours', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Vue courte' },
      { id: 'period-30', label: 'Période 30 jours', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Vue par défaut' },
      { id: 'period-90', label: 'Période 90 jours', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Vue longue' },
    ],
    elements: [
      { id: 'kpi-scroll', type: 'card', label: 'Indicateurs / graphiques analytics pharmacie', actionable: false },
    ],
    guide: 'Écran partenaire: nécessite pharmacyId en params + vérification propriétaire (user.id = pharmacy.user_id). Sélecteur 7d/30d/90d, refresh. Accès refusé si non propriétaire.',
  },
  PharmacyAIInteractions: {
    type: 'specialized',
    actions: [
      { id: 'add-med', label: 'Ajouter médicament', icon: LUCIDE_ICONS.add, category: 'action', description: 'Liste de noms avant analyse' },
      { id: 'add-condition', label: 'Ajouter pathologie', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Contexte optionnel pour checkInteractions' },
      { id: 'verify', label: 'Vérifier les interactions', icon: LUCIDE_ICONS.check, category: 'help', description: 'pharmacyService.checkInteractions (âge optionnel)' },
    ],
    elements: [
      { id: 'age-input', type: 'input', label: 'Âge (optionnel)', actionable: true },
      { id: 'result-card', type: 'card', label: 'Résultat gravité + description + recommandations', actionable: false },
    ],
    guide: 'Écran dédié interactions IA: saisie de plusieurs médicaments, âge et pathologies optionnels, bouton vérifier → résultat (gravité, alternatives). Connexion requise. Accès typique depuis PharmacieForm (partenaire), distinct des modals PharmacieDetails.',
  },
  HopitalList: {
    type: 'list',
    actions: [
      { id: 'search', label: 'Affiner la recherche', icon: LUCIDE_ICONS.search, route: 'HopitalSearch', category: 'search', description: 'Retour au formulaire filtres' },
    ],
    elements: [
      { id: 'cards', type: 'card', label: 'Cartes nom, type, Disponible, badge Urgences, ville, distance, tél', actionable: true },
    ],
    guide: 'GET /api/hopitaux/search avec params.filters (GPS, distance, type, prestation, urgences_only, available_only…). Pagination page/limit. Tap → HopitalDetails(hospitalId). Peut recevoir serviceType depuis HopitalHome sans être typé dans HopitalListScreenParams — préférer filters complets.',
  },
  BookAppointment: {
    type: 'form',
    actions: [
      { id: 'pick-date', label: 'Choisir date', icon: LUCIDE_ICONS.calendar, category: 'action', description: 'Dates avec créneaux disponibles' },
      { id: 'pick-slot', label: 'Choisir créneau', icon: LUCIDE_ICONS.clock, category: 'action', description: 'Slot available + remaining' },
      { id: 'confirm', label: 'Confirmer RDV', icon: LUCIDE_ICONS.check, category: 'action', description: 'POST réservation avec motif / notes' },
    ],
    elements: [
      { id: 'patient-fields', type: 'input', label: 'Nom patient, motif, notes', actionable: true },
    ],
    guide: 'Params: serviceId, serviceType hopital | laboratoire. GET available-slots par date pour hôpital ou labo. Réservation créneau avec formulaire patient.',
  },
  MyConsultations: {
    type: 'list',
    actions: [
      { id: 'filter-status', label: 'Filtrer par statut', icon: LUCIDE_ICONS.filter, category: 'action', description: 'Chips statut consultation' },
      { id: 'open-hospital', label: 'Voir l\'hôpital', icon: LUCIDE_ICONS.hospital, route: 'HopitalDetails', category: 'navigation', description: 'Depuis une ligne si applicable' },
    ],
    elements: [
      { id: 'consultations', type: 'card', label: 'Liste hospitalService.getMyConsultations', actionable: true },
    ],
    guide: 'Client connecté: historique consultations hôpital, filtres, pagination, pull refresh. Sans compte → alerte et retour.',
  },
  HospitalAIRecommendations: {
    type: 'specialized',
    actions: [
      { id: 'symptoms', label: 'Symptômes', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Texte obligatoire' },
      { id: 'submit-ia', label: 'Obtenir recommandations', icon: LUCIDE_ICONS.check, category: 'help', description: 'hospitalService.getAIRecommendations — connexion requise' },
      { id: 'view-hospital', label: 'Voir un hôpital', icon: LUCIDE_ICONS.hospital, route: 'HopitalDetails', category: 'navigation', description: 'Liens depuis résultats' },
    ],
    elements: [
      { id: 'location-fields', type: 'input', label: 'Localisation texte (GPS bouton TODO)', actionable: true },
    ],
    guide: 'Triage / recommandations IA: symptômes, option localisation, getAIRecommendations. Param hospitalId optionnel depuis HopitalDetails. Bouton géoloc non implémenté (placeholder).',
  },
  HospitalAnalytics: {
    type: 'dashboard',
    actions: [
      { id: 'refresh', label: 'Rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Pull refresh analytics' },
    ],
    elements: [
      { id: 'kpi', type: 'card', label: 'RDV, revenus, satisfaction, top services', actionable: false },
    ],
    guide: 'Partenaire: GET /api/hopitaux/{hospitalId}/analytics. Params route hospitalId. Connexion requise.',
  },
  LaboratoireSearch: {
    type: 'search',
    actions: [
      { id: 'ls-gps', label: 'GPS / carte', icon: LUCIDE_ICONS.location, category: 'action', description: 'ModernGPSModal + LocationContext' },
      { id: 'ls-submit', label: 'Rechercher', icon: LUCIDE_ICONS.search, category: 'search', description: '→ **LaboratoireList** avec `filters` (types_examens, prestation_analyse, lat/lng, distance, rdv_en_ligne, available_only, service_type…)' },
      { id: 'ls-my-exams', label: 'Mes examens', icon: LUCIDE_ICONS.clipboard, route: 'MyLabExaminations', category: 'navigation', description: 'Bandeau haut' },
    ],
    elements: [
      { id: 'ls-header', type: 'card', label: 'En-tête gradient indigo « Rechercher un laboratoire »', actionable: false },
      { id: 'ls-filters', type: 'input', label: 'Types d’examens, prestation, distance, chips rapides', actionable: true },
    ],
    guide: '**LaboratoireSearchScreen** : formulaire filtres → **LaboratoireList** ; bandeau **MyLabExaminations**.',
  },
  LaboratoireList: {
    type: 'list',
    actions: [
      { id: 'll-refine', label: 'Affiner la recherche', icon: LUCIDE_ICONS.search, route: 'LaboratoireSearch', category: 'search', description: 'Retour critères' },
      { id: 'll-open', label: 'Ouvrir fiche labo', icon: LUCIDE_ICONS.activity, category: 'action', description: 'Tap → **LaboratoireDetails** `laboratoryId`' },
    ],
    elements: [
      { id: 'll-cards', type: 'card', label: 'Cartes : nom, type, dispo, ville, distance, tel, analyses/imagerie chips', actionable: true },
    ],
    guide: '**LaboratoireListScreen** : GET `/api/laboratoires/search` à partir de `route.params.filters` (ville, lat/lng, max_distance_km, type_laboratoire, service_type, prestation_analyse, types_examens[], rdv_en_ligne, imagerie, available_only), page/limit 20.',
  },
  MyLabExaminations: {
    type: 'list',
    actions: [
      { id: 'mle-results', label: 'Voir résultats / Analyser IA', icon: LUCIDE_ICONS.activity, route: 'LabAIAnalysis', category: 'navigation', description: 'Si statut **completed** → **LabAIAnalysis** + `examinationId`' },
    ],
    elements: [{ id: 'mle-list', type: 'card', label: 'Liste examens paginée', actionable: true }],
    guide: '**MyLabExaminationsScreen** : **labService.getMyExaminations** GET `/api/laboratoires/my-examinations`. Connexion obligatoire.',
  },
  LabAIAnalysis: {
    type: 'specialized',
    actions: [{ id: 'lai-run', label: 'Lancer analyse IA', icon: LUCIDE_ICONS.activity, category: 'help', description: '**labService.analyzeExamination** sur `examinationId`' }],
    elements: [],
    guide: '**LabAIAnalysisScreen** : param **`examinationId`** — chargement résultats puis analyse POST `/api/laboratoires/examinations/{id}/analyze`.',
  },
  LabAnalytics: {
    type: 'dashboard',
    actions: [{ id: 'la-refresh', label: 'Rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Pull refresh ; boutons 7j/30j/90j relancent loadAnalytics mais getAnalytics() n’envoie pas de param période' }],
    elements: [{ id: 'la-kpi', type: 'card', label: 'KPI : total_examinations, examinations_7d/30d, completed_count, examination_types_count', actionable: false }],
    guide: '**LabAnalyticsScreen** : param **`laboratoryId`** ; **getLaboratoryDetails** puis comparaison **user.id** / **laboratory.user_id** ; **labService.getAnalytics** GET `/api/laboratoires/{id}/analytics` sans query period côté client.',
  },
  BanqueSangList: {
    type: 'list',
    actions: [
      { id: 'bsl-back', label: 'Retour', icon: LUCIDE_ICONS.back, category: 'navigation', description: 'Nouvelle recherche via retour' },
      { id: 'bsl-refresh', label: 'Tirer pour rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'RefreshControl' },
      { id: 'bsl-open', label: 'Ouvrir fiche banque', icon: LUCIDE_ICONS.droplet, category: 'action', description: 'Tap carte → **BanqueSangDetails** avec `banqueId`' },
      { id: 'bsl-search-again', label: 'Modifier critères', icon: LUCIDE_ICONS.search, route: 'BanqueSangSearch', category: 'search', description: 'Retour écran filtres' },
    ],
    elements: [
      { id: 'bsl-cards', type: 'card', label: 'Cartes : nom, badge Disponible/Indisponible, ville, distance_km, tel, stocks (4+…)', actionable: true },
    ],
    guide: '**BanqueSangListScreen** : `GET /api/banques-sang/search` avec query params depuis `route.params.filters` (lat, lng, max_distance_km, groupe_sanguin, available_only, ville, quartier). Pagination page/limit 20, `onEndReached`. États vides → bouton retour. **Pas** d’itinéraire intégré ici — ouvrir la fiche puis GPS si besoin.',
  },
  TaxiList: { type: 'list', actions: [{ id: 'book', label: 'Réserver', icon: LUCIDE_ICONS.car, route: 'TaxiBooking', category: 'action', description: 'Réserver un taxi' }], elements: [{ id: 'list', type: 'card', label: 'Taxis disponibles', actionable: true }], guide: 'Liste des taxis disponibles. Sélectionnez un taxi pour réserver une course.' },
  CovoiturageList: { type: 'list', actions: [{ id: 'book', label: 'Réserver', icon: LUCIDE_ICONS.users, category: 'action', description: 'Réserver une place' }], elements: [{ id: 'list', type: 'card', label: 'Trajets disponibles', actionable: true }], guide: 'Liste des trajets de covoiturage. Réservez une place auprès d\'un conducteur.' },
  AgenceVoyageList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'AgenceVoyageSearch', category: 'search', description: 'Affiner la recherche' }], elements: [{ id: 'list', type: 'card', label: 'Agences de voyage', actionable: true }], guide: 'Liste des agences de voyage. Consultez les offres et réservez.' },
  ImmobilierList: {
    type: 'list',
    actions: [
      { id: 'select-for-compare', label: 'Sélectionner (max 5)', icon: LUCIDE_ICONS.check, category: 'action', description: 'Cases à cocher sur cartes ; max 5 sinon Alert' },
      { id: 'compare-selected', label: 'Comparer la sélection', icon: LUCIDE_ICONS.list, route: 'ImmobilierCompare', category: 'action', description: 'Barre Comparer si ≥2 sélectionnés → ImmobilierCompare avec propertyIds' },
      { id: 'open-details', label: 'Ouvrir fiche', icon: LUCIDE_ICONS.info, route: 'ImmobilierDetails', category: 'navigation', description: 'Tap carte si pas en mode sélection → ImmobilierDetails' },
      { id: 'refresh', label: 'Rafraîchir', icon: LUCIDE_ICONS.refresh, category: 'action', description: 'Pull-to-refresh → searchProperties(filters)' },
    ],
    elements: [
      { id: 'list', type: 'card', label: 'FlatList résultats (route.params.filters)', actionable: true },
    ],
    guide: '**ImmobilierListScreen** : **searchProperties** avec **route.params.filters** (souvent depuis **ImmobilierSearch**). Sélection **jusqu’à 5** biens → **ImmobilierCompare** (\`propertyIds\`). Sinon tap → **ImmobilierDetails**. Pas de CTA « retour recherche » codé en dur — retour navigation.',
  },
  LivreScolaireList: { type: 'list', actions: [{ id: 'search', label: 'Rechercher', icon: LUCIDE_ICONS.search, route: 'LivreScolaireSearch', category: 'search', description: 'Rechercher un livre' }], elements: [{ id: 'list', type: 'card', label: 'Livres scolaires', actionable: true }], guide: 'Liste des livres scolaires disponibles. Achetez ou contactez le vendeur.' },
  OffreList: {
    type: 'list',
    actions: [
      { id: 'search', label: 'Affiner (OffreSearch)', icon: LUCIDE_ICONS.search, route: 'OffreSearch', category: 'search', description: 'Formulaire filtres' },
      { id: 'open-offre', label: 'Ouvrir offre', icon: LUCIDE_ICONS.briefcase, route: 'OffreDetails', category: 'navigation', description: 'Tap carte → OffreDetails' },
    ],
    elements: [{ id: 'list', type: 'card', label: 'Liste (searchOffres ou offres passées en params)', actionable: true }],
    guide: 'OffreListScreen : searchOffres avec route.params.filters OU liste préremplie (ex. matching depuis OffresEmploiHome). Pagination limit 20.',
  },
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
    availableActions: [...getGlobalActions(t), ...specificActions],
    visibleElements,
    userData: user,
    serviceData: routeParams,
    currentRoute: currentRouteName,
    guideText,
  }), [screenName, screenType, specificActions, visibleElements, user, routeParams, currentRouteName, guideText]);

  return context;
};
