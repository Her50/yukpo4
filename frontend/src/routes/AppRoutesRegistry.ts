// ✅ Fonction utilitaire pour générer une route dynamique
export const getServiceDetailRoute = (id: string | number): string => `/services/${id}`;

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
  DASHBOARD_ADMIN_AUDIT: "/admin/audit",
  MES_SERVICES: "/dashboard/mes-services", // ✅ Correction : route complète pour correspondre à la configuration imbriquée
  DASHBOARD: "/dashboard",
  DASHBOARD_ADMIN_API: "/admin/api",
  PLANS: "/plans",
} as const;
