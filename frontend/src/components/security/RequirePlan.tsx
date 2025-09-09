// src/components/security/RequirePlan.tsx
// @ts-check
import React from "react";
import { useUser } from "@/hooks/useUser";

interface RequirePlanProps {
  plan: "free" | "pro" | "enterprise";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const RequirePlan: React.FC<RequirePlanProps> = ({ plan, children, fallback = null }) => {
  const { user } = useUser();

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

  if (!effectiveUser || effectiveUser.plan !== plan) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RequirePlan;
