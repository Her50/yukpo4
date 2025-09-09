// @ts-check
/**
 * Registre d’accès par rôle et plan
 */

export interface AccessRule {
  component: string;
  role: "admin" | "client" | "user";
  plan: "free" | "pro" | "enterprise";
}

export const ACCESS_REGISTRY: AccessRule[] = [
  {
    component: "DashboardSelector",
    role: "admin",
    plan: "enterprise",
  },
  {
    component: "PredictionDashboard",
    role: "admin",
    plan: "pro",
  },
  {
    component: "PartnerReviewPanel",
    role: "client",
    plan: "pro",
  },
  {
    component: "AutoMarketingPanel",
    role: "user",
    plan: "free",
  },
];
