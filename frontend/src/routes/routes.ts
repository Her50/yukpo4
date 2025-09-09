// @ts-check
import React from 'react';

// ✅ Composants associés à certaines routes
import AdminAccessAudit from '@/pages/admin/AdminAccessAudit';
import ApiDashboardPage from '@/pages/ApiDashboardPage';
import SingleServicePage from '@/pages/SingleServicePage';
import MesOpportunitesPage from '@/pages/dashboard/MesOpportunites';
import MesServicesPage from '@/pages/dashboard/MesServices';
import CataloguePage from '@/pages/CataloguePage';

import TranslateTestPanel from '@/pages/TranslateTestPanel';
import TranslateTestAdmin from '@/pages/admin/TranslateTestAdmin';
import ModerationPanel from '@/pages/admin/ModerationPanel';
import LoadTestDashboard from '@/pages/admin/LoadTestDashboard';
import PaiementPlanPage from '@/pages/PaiementPlanPage';
import CreationService from '@/pages/CreationService'; // ✅ À ajouter en haut


export enum ROUTES {
  ABOUT = "/about",
  ADMINANALYTICSPANEL = "/adminanalyticspanel",
  ADMINPANEL = "/adminpanel",
  BIEN = "/bien",
  BOURSELIVRE = "/bourselivre",
  COMMUNICATIONPANEL = "/communicationpanel",
  CONTACT = "/contact",
  CONTACTENTERPRISE = "/contactenterprise",
  CREATION_STORIES = "/creation.stories",
  CREATION = "/creation",
  DASHBOARD = "/dashboard",
  DASHBOARDIA = "/dashboardia",
  HOME = "/",
  INDEX = "/",
  LOGIN = "/login",
  MATCH = "/match",
  MATCHING = "/matching",
  MATCHINGRESULTSIA = "/matchingresultsia",
  NOTFOUND = "/notfound",
  OUTILS = "/outils",
  PAIEMENTPRO = "/paiementpro",
  PREDICTIONDASHBOARD = "/predictiondashboard",
  PROFILE = "/dashboard/mon-profil",
  SERVICES = "/services",
  SERVICE_DETAIL = "/services/:id",
  CATALOGUE = "/catalogue",
  STRATEGICRECOPANEL = "/strategicrecopanel",
  TICKET = "/ticket",
  UPGRADE = "/upgrade",
  USERINTERACTIONIACENTER = "/userinteractioniacenter",
  USERSTATSIADASHBOARD = "/userstatsiadashboard",  
  SERVICE_CREATE = "/CreationService",

  // Admin
  ADMIN_AUDIT_ACCESS = "/admin/audit-access",
  ADMIN_API_DASHBOARD = "/admin/api-dashboard",

  // Dashboard
  MES_OPPORTUNITES = "/dashboard/mes-opportunites",
  MES_SERVICES = "/dashboard/mes-services",

  // Nouvelles routes IA
  PAYMENT_PLAN = "/paiement-plan",
  TRANSLATE_TEST = "/translate/test",
  TRANSLATE_TEST_ADMIN = "/admin/translate/test",
  ADMIN_MODERATION = "/admin/moderation",
  ADMIN_LOAD_TEST = "/admin/load-test",
}

export type Role = "public" | "user" | "admin" | "client";

export interface RouteMeta {
  label: string;
  path: ROUTES | string;
  roles: Role[];
  component?: React.FC;
  plan?: "free" | "pro" | "enterprise";
}

export const ROUTES_CONFIG: RouteMeta[] = [
  { label: "À propos", path: ROUTES.ABOUT, roles: ["public"] },
  { label: "Admin Analytics Panel", path: ROUTES.ADMINANALYTICSPANEL, roles: ["admin"] },
  { label: "Admin Panel", path: ROUTES.ADMINPANEL, roles: ["admin"] },
  { label: "Bien", path: ROUTES.BIEN, roles: [] },
  { label: "Bourse Livre", path: ROUTES.BOURSELIVRE, roles: [] },
  { label: "Communication Panel", path: ROUTES.COMMUNICATIONPANEL, roles: [] },
  { label: "Contact", path: ROUTES.CONTACT, roles: ["public"] },
  { label: "Contact Entreprise", path: ROUTES.CONTACTENTERPRISE, roles: [] },
  { label: "Création Stories", path: ROUTES.CREATION_STORIES, roles: [] },
  { label: "Création", path: ROUTES.CREATION, roles: [] },
  { label: "Dashboard", path: ROUTES.DASHBOARD, roles: ["user", "client", "admin"] },
  { label: "Dashboard IA", path: ROUTES.DASHBOARDIA, roles: ["user", "client"] },
  { label: "Accueil", path: ROUTES.HOME, roles: ["public"] },
  { label: "Index", path: ROUTES.INDEX, roles: ["public"] },
  { label: "Connexion", path: ROUTES.LOGIN, roles: ["public"] },
  { label: "Matching", path: ROUTES.MATCHING, roles: [] },
  { label: "Matching Résultats IA", path: ROUTES.MATCHINGRESULTSIA, roles: [] },
  { label: "Match", path: ROUTES.MATCH, roles: ["user", "client"] },
  { label: "NotFound", path: ROUTES.NOTFOUND, roles: [] },
  { label: "Outils", path: ROUTES.OUTILS, roles: [] },
  { label: "Paiement Pro", path: ROUTES.PAIEMENTPRO, roles: ["user", "client"] },
  { label: "Prédiction Dashboard", path: ROUTES.PREDICTIONDASHBOARD, roles: [] },
  { label: "Services", path: ROUTES.SERVICES, roles: ["public"] },

  {
    label: "Détail Service",
    path: ROUTES.SERVICE_DETAIL,
    roles: ["public"],
    component: SingleServicePage,
    plan: "free",
  },
  {
    label: "Catalogue",
    path: ROUTES.CATALOGUE,
    roles: ["public"],
    component: CataloguePage,
  },
  { label: "Strategic Reco Panel", path: ROUTES.STRATEGICRECOPANEL, roles: [] },
  { label: "Ticket", path: ROUTES.TICKET, roles: [] },
  { label: "Upgrade", path: ROUTES.UPGRADE, roles: [] },
  { label: "User Interaction Center", path: ROUTES.USERINTERACTIONIACENTER, roles: [] },
  { label: "Stats IA", path: ROUTES.USERSTATSIADASHBOARD, roles: [] },

  {
    label: "Audit des accès",
    path: ROUTES.ADMIN_AUDIT_ACCESS,
    roles: ["admin"],
    component: AdminAccessAudit,
    plan: "enterprise",
  },
  {
    label: "API Dashboard",
    path: ROUTES.ADMIN_API_DASHBOARD,
    roles: ["admin"],
    component: ApiDashboardPage,
    plan: "enterprise",
  },
  {
    label: "Mes opportunités",
    path: ROUTES.MES_OPPORTUNITES,
    roles: ["admin", "user", "client"],
    component: MesOpportunitesPage,
    plan: "pro",
  },
  {
    label: "Mes services",
    path: ROUTES.MES_SERVICES,
    roles: ["user", "client"],
    component: MesServicesPage,
    plan: "free",
  },
  {
    label: "Paiement Plan",
    path: ROUTES.PAYMENT_PLAN,
    roles: ["user", "client"],
    component: PaiementPlanPage,
  },
  {
    label: "Traduction IA",
    path: ROUTES.TRANSLATE_TEST,
    roles: ["user", "client"],
    component: TranslateTestPanel,
  },
  {
    label: "Test Traduction Admin",
    path: ROUTES.TRANSLATE_TEST_ADMIN,
    roles: ["admin"],
    plan: "enterprise",
    component: TranslateTestAdmin,
  },
  {
    label: "Modération IA",
    path: ROUTES.ADMIN_MODERATION,
    roles: ["admin"],
    plan: "enterprise",
    component: ModerationPanel,
  },
  {
    label: "Monitoring IA",
    path: ROUTES.ADMIN_LOAD_TEST,
    roles: ["admin"],
    plan: "enterprise",
    component: LoadTestDashboard,
  },
  {
    label: "Création service",
    path: ROUTES.SERVICE_CREATE,
    roles: ["user", "client", "admin"], // ou selon ton besoin
    component: CreationService,
    plan: "free", // ou autre si tu veux limiter aux plans pro
  },
  
];
