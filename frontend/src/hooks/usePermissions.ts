// src/hooks/usePermissions.ts
// @ts-check
import { useUser } from "./useUser";
import { useUserPlan } from "./useUserPlan";

export interface Permissions {
  canRead: boolean;
  canWrite: boolean;
  canAccessAI: boolean;
  canModerate: boolean;
  canAccessBackoffice: boolean;
  canChangeRole: boolean;
  canExportPDF: boolean;
  canViewStats: boolean;
  canAccessAdminTools: boolean;
}

export const usePermissions = (): Permissions => {
  const { user } = useUser();
  const { plan } = useUserPlan();

  const role = user?.role || "public";

  const isAdmin = role === "admin";
  const isClient = role === "client";
  const isPro = plan === "pro" || plan === "enterprise";

  return {
    canRead: !!user,
    canWrite: isClient || isAdmin,
    canAccessAI: isPro || isAdmin,
    canModerate: isAdmin,
    canAccessBackoffice: isAdmin || (isClient && plan === "enterprise"),
    canChangeRole: isAdmin || isClient,
    canExportPDF: plan === "pro" || plan === "enterprise",
    canViewStats: isAdmin || isPro,
    canAccessAdminTools: isAdmin,
  };
};
