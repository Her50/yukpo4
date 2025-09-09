// ✅ Fonction utilitaire pour générer une route dynamique
export const getServiceDetailRoute = (id: string | number): string => `/services/${id}`;

// ✅ Constante globale des routes
export const ROUTES = {
  // 🌐 Zones publiques
  HOME: "/",
  LANDING: "/landing",
  LANDING_FR: "/landing/fr",
  LANDING_EN: "/landing/en",
  LANDING_FF: "/landing/ff",
  ABOUT: "/about",
  CONTACT: "/contact",
  CONTACTENTERPRISE: "/contactenterprise",
  SERVICES: "/services",
  SERVICE_CREATE: "/services/create",
  SERVICE_DETAIL: "/services/:id",
  PLANS: "/plans",
  LOGIN: "/login",
  REGISTER: "/register",
  CONFIRMATION: "/register/confirmation",

  // 💡 IA & outils intelligents
  START: "/start",
  CREATION_SMART_SERVICE: "/creation-smart-service",
  RECHERCHE_BESOIN: "/recherche-besoin",
  YUKPO_IA_HUB: "/ia-hub",
  VOICE_ASSISTANT: "/voice-assistant",
  MATCH: "/match",
  MATCHING: "/matching",
  MATCHINGRESULTSIA: "/matchingresultsia",
  SUGGESTIONS_TEST: "/suggestions-test",
  CATALOGUE: "/catalogue",

  // ⚙️ Espace utilisateur connecté
  DASHBOARD: "/dashboard",
  PROFILE: "/dashboard/mon-profil",
  MES_OPPORTUNITES: "/dashboard/mes-opportunites",
  MES_SERVICES: "/dashboard/mes-services",
  ESPACE: "/espace",
  PAIEMENTPRO: "/paiementpro",
  PAYMENT_PLAN: "/paiement-plan",

  // ✅ Plans
  PLAN_FREE: "/plans/free",
  PLAN_PRO: "/plans/pro",
  PLAN_ENTERPRISE: "/plans/enterprise",

  // 🔒 Zones admin
  ADMINANALYTICSPANEL: "/adminanalyticspanel",
  ADMINPANEL: "/adminpanel",
  DASHBOARD_ADMIN_API: "/admin/api-dashboard",
  DASHBOARD_ADMIN_AUDIT: "/admin/audit-access",
  ADMIN_MATCHING_HISTORY: "/admin/matching-history",
  ADMIN_TAGS_TOP: "/admin/tags/top",
  ADMIN_ACTIONS: "/admin/actions",
  ADMIN_IA_DASHBOARD: "/admin/ia/dashboard",
  ADMIN_IA_TEST: "/admin/ia/test",
  ADMIN_IA_STATUS: "/admin/ia/status",
  ADMIN_USERS_PLAN: "/admin/users/plan",
  ADMIN_EXPIRATIONS: "/admin/expirations",
  TRANSLATE_TEST_ADMIN: "/admin/translate/test",
  ADMIN_MODERATION: "/admin/moderation",
  ADMIN_LOAD_TEST: "/admin/load-test",

  // 🧠 IA utilisateur
  TRANSLATE_TEST: "/translate/test",

  // 💬 Chat IA
  CHAT_DIALOG: "/chat/:client_id",

  // 📄 Légal & documentation
  LEGAL_NOTICE: "/legal/notice",
  PRIVACY: "/legal/privacy",
  COOKIES: "/legal/cookies",
  DOCS: "/docs",
  VIDEO_INTELLIGENCE: "/video-intelligence",
} as const;
