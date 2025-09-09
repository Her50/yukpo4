// src/components/auth/RequireRole.tsx

import React, { ReactNode } from "react";
import { useUserContext } from "@/context/UserContext";
import type { Role } from "@/types/roles"; // ✅ correction : type Role correctement importé

interface RequireRoleProps {
  role: Role;
  children: ReactNode;
  fallback?: ReactNode;
}

const RequireRole: React.FC<RequireRoleProps> = ({ role, children, fallback = null }) => {
  const { user } = useUserContext();
  const roles: string[] = user?.roles || [];

  const hasRole = roles.includes(role);

  if (!user || !hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RequireRole;
