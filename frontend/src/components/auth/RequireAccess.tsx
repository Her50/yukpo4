// @ts-check
import React, { ReactNode } from "react";
import { useUser } from "@/hooks/useUser";

interface RequireAccessProps {
  role?: string;              // Exemple : "admin"
  anyOf?: string[];           // Exemple : ["admin", "client"]
  allOf?: string[];           // Exemple : ["client", "user"]
  not?: string;               // Exemple : "public"
  plan?: "free" | "pro" | "enterprise";
  children: ReactNode;
  fallback?: ReactNode;
}

const RequireAccess: React.FC<RequireAccessProps> = ({
  role,
  anyOf,
  allOf,
  not,
  plan,
  children,
  fallback = null,
}) => {
  const { user } = useUser();

  // ✅ Fallback automatique si en mode DEV et aucun token
  const effectiveUser = user || (
    import.meta.env.DEV
      ? {
          id: "dev-admin",
          email: "admin@yukpo.local",
          role: "admin",
          plan: "enterprise",
          isAdmin: true,
          isUser: false,
          name: "Admin Local",
          photo: "",
        }
      : null
  );

  if (!effectiveUser) return <>{fallback}</>;

  const roles: string[] = [effectiveUser.role];
  const currentPlan = effectiveUser.plan;

  // ❌ Vérifications cumulatives
  if (plan && currentPlan !== plan) return <>{fallback}</>;
  if (role && !roles.includes(role)) return <>{fallback}</>;
  if (anyOf && !anyOf.some((r) => roles.includes(r))) return <>{fallback}</>;
  if (allOf && !allOf.every((r) => roles.includes(r))) return <>{fallback}</>;
  if (not && roles.includes(not)) return <>{fallback}</>;

  return <>{children}</>;
};

export default RequireAccess;
