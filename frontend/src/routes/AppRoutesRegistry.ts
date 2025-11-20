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
  ANALYTICS_DASHBOARD: "/dashboard/analytics", // ✅ Phase 10 - Analytics Dashboard
  DASHBOARD: "/dashboard",
  DASHBOARD_ADMIN_API: "/admin/api",
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
} as const;
