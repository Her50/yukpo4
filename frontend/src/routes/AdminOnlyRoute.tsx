import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";

interface Props {
  children: ReactNode;
}

const AdminOnlyRoute: React.FC<Props> = ({ children }) => {
  const { user } = useUser();

  if (!user || user.role !== "admin") {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};

export default AdminOnlyRoute;
