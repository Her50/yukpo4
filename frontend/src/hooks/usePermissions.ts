// src/hooks/usePermissions.ts
// @ts-check
import { useUser } from "./useUser";
import { useUserPlan } from "./useUserPlan";
import { isAdminRole } from "@/utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

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

  // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
  const isAdmin = isAdminRole(role);
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
