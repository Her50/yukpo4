// ✅ Fonction utilitaire pour générer une route dynamique
export const getServiceDetailRoute = (id: string | number): string => `/services/${id}`;
export const getLiveViewRoute = (sessionId: string | number): string => `/live/${sessionId}`;

// ✅ Constante globale des routes utilisées dans App.tsx
export const ROUTES = {
  // 🌐 Zones publiques essentielles
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  CONFIRMATION: "/register/confirmation",
  // 🛠 Création manuelle et intelligente
  SERVICE_CREATE: "/creation/service",
  CREATION_PAGE: "/creation",                    // Page d'entrée rapide
  CREATION_SMART_SERVICE: "/creation-smart-service",
  FORMULAIRE_YUKPO_INTELLIGENT: "/formulaire-yukpo-intelligent",
  FORMULAIRE_SERVICE_MODERNE: "/formulaire-service-moderne",  // Nouvelle page moderne
  AJOUTER_PRODUIT_SIMPLE: "/ajouter-produit-simple",  // ✅ NOUVEAU: Page création simple de produit
  IMMERSIVE_VIDEO_WIZARD: "/immersive-video",

  // 🔍 Recherche intelligente de service
  RECHERCHE_BESOIN: "/recherche-besoin",
  YUKPO_IA_HUB: "/ia-hub",

  // 💬 Chat IA
  CHAT_DIALOG: "/chat/:client_id",

  // 💰 Solde et historique IA
  MON_SOLDE: "/mon-solde", // Ajouté pour la page de solde
  RECHARGE_TOKENS: "/recharge-tokens", // Page de recharge de tokens

  // 🚩 Ajout des routes manquantes pour DesktopMenu et autres composants
  SERVICES: "/services",
  CATALOGUE: "/catalogue",
  CONTACT: "/contact",
  ABOUT: "/about",
  ESPACE: "/espace",
  LIVES: "/lives",
  LIVE_GO_LIVE: "/live/go-live",
  LIVE_VIEW: "/live/:sessionId",
  DASHBOARD_ADMIN_AUDIT: "/admin/audit",
  MES_SERVICES: "/dashboard/mes-services", // ✅ Correction : route complète pour correspondre à la configuration imbriquée
  MES_PRODUITS: "/dashboard/mes-produits", // ✅ Route pour la gestion des produits
  ANALYTICS_DASHBOARD: "/dashboard/analytics", // ✅ Phase 10 - Analytics Dashboard
  DASHBOARD: "/dashboard",
  DASHBOARD_ADMIN_API: "/admin/api",
  ADMIN_KYC_VERIFICATION: "/admin/kyc-verification", // ✅ NOUVEAU 2025-01-29: Vérification KYC
  PLANS: "/plans",
  DELIVERY_HOME: "/delivery",
  DELIVERY_SHOPPING_BASKET: "/delivery/shopping/basket",
  DELIVERY_SHOPPING_BUDGET: "/delivery/shopping/budget",
  DELIVERY_SHOPPING_PICKUP_DROP: "/delivery/shopping/pickup-drop",
  DELIVERY_SHOPPING_SUMMARY: "/delivery/shopping/summary",
  DELIVERY_SHOPPING_FLOW: "/delivery/shopping/flow", // ✅ Nouveau : Flux shopping simplifié
  DELIVERY_PARCEL_FLOW: "/delivery/parcel/flow", // ✅ Nouveau : Flux colis
  DELIVERY_TRACKING: "/delivery/:deliveryId/tracking",
  DELIVERY_COURIER_DASHBOARD: "/delivery/:deliveryId/courier",
  DELIVERY_STORAGE_LOCATIONS: "/delivery/storage-locations", // ✅ Phase 9 - Amélioration 32

  // 🛒 Gestion commandes et produits similaires
  SIMILAR_PRODUCTS: "/similar-products", // Produits similaires (quand produit non disponible)
  ORDER_MANAGEMENT: "/orders/management", // Gestion des commandes (prestataire)
  PROVIDER_ANALYTICS: "/provider/analytics", // Analytics prestataire

  // ✅ NOUVEAU Phase 2-4: Services spécialisés
  SPECIALIZED_SERVICES_HUB: "/specialized/hub", // Hub unifié services spécialisés
  SPECIALIZED_SEARCH: "/search/specialized", // Recherche avancée services spécialisés
  SPECIALIZED_GESTION: "/specialized/gestion", // Gestion services spécialisés
  SPECIALIZED_DASHBOARD: "/specialized/dashboard", // ✅ Phase 5.4: Dashboard statistiques
  SPECIALIZED_RESERVATION: "/specialized/reservation/:serviceId/:serviceType", // ✅ NOUVEAU: Création réservation
  MES_RESERVATIONS: "/mes-reservations", // ✅ NOUVEAU: Liste réservations client
  PRESTATAIRE_RESERVATIONS: "/prestataire/reservations", // ✅ NOUVEAU: Liste réservations prestataire
  SERVICE_DETAIL_SPECIALIZED: "/services/:serviceId/detail", // ✅ NOUVEAU: Détails service spécialisé

  // ✅ NOUVEAU: Routes banque de sang
  BLOOD_DONATION_REQUEST: "/blood-donation/request", // Créer demande de don
  BLOOD_DONATION_MATCHES: "/blood-donation/matches/:requestId", // Liste matches
  MY_BLOOD_DONATIONS: "/blood-donation/my-donations", // Historique dons

  // ✅ NOUVEAU: Routes tickets bus
  BUS_TICKET_SEARCH: "/bus-tickets/search", // Recherche trajets
  BUS_TICKET_BOOKING: "/bus-tickets/booking/:productId", // Réservation places
  BUS_TICKET_DETAILS: "/bus-tickets/details/:paymentId", // Détails ticket avec QR
  // ✅ NOUVEAU: Routes retour bus (aller-retour)
  BUS_RETURN_REQUESTS: "/bus-tickets/return-requests", // Liste demandes retour
  BUS_RETURN_REQUEST_FORM: "/bus-tickets/return-request/create/:paymentId?", // Créer demande retour

  // ✅ NOUVEAU: Routes taxi
  TAXI_FORM: "/specialized/taxi/form/:serviceId?", // Formulaire création/édition taxi

  // ✅ NOUVEAU: Routes covoiturage
  COVOITURAGE_FORM: "/specialized/covoiturage/form/:serviceId?", // Formulaire création/édition covoiturage

  // ✅ NOUVEAU: Routes services spécialisés - Formulaires
  PHARMACIE_FORM: "/specialized/pharmacie/form/:serviceId?", // Formulaire création/édition pharmacie
  HOPITAL_FORM: "/specialized/hopital/form/:serviceId?", // Formulaire création/édition hôpital
  LABORATOIRE_FORM: "/specialized/laboratoire/form/:serviceId?", // Formulaire création/édition laboratoire
  AGENCE_VOYAGE_FORM: "/specialized/agence-voyage/form/:serviceId?", // Formulaire création/édition agence de voyage
  BANQUE_SANG_FORM: "/specialized/banque-sang/form/:serviceId?", // Formulaire création/édition banque de sang

  // ✅ NOUVEAU 2025-01-28: Routes Bourse du livre scolaire
  LIVRES_SCOLAIRES_SEARCH: "/livres-scolaires/search", // Recherche de livres
  LIVRES_SCOLAIRES_LIST: "/livres-scolaires/list", // Liste résultats
  LIVRES_SCOLAIRES_DETAILS: "/livres-scolaires/:livreId", // Détails livre
  LIVRES_SCOLAIRES_FORM: "/livres-scolaires/:livreId/edit", // Édition livre
  LIVRES_SCOLAIRES_NEW: "/livres-scolaires/new", // Création livre
  MES_LIVRES: "/livres-scolaires/mes-livres", // Mes livres
  TROC_MATCHING: "/livres-scolaires/:livreId/match", // Résultats matching
  TROC_DETAILS: "/trocs/:trocId", // Détails troc
  TROC_LIVE_VALIDATION: "/trocs/:trocId/live-validation", // ✅ Phase 3: Validation Live/Video
  MES_TROCS: "/trocs/mes-trocs", // Mes trocs
} as const;
