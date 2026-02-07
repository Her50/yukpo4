import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { isAdminUser } from "@/utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

interface Props {
  children: ReactNode;
}

const AdminOnlyRoute: React.FC<Props> = ({ children }) => {
  const { user } = useUser();

  if (!user || !isAdminUser(user)) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};

export default AdminOnlyRoute;
