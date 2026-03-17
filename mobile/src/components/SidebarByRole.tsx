// @ts-check
import * as React from "react";
import ResponsiveSidebar from "./ResponsiveSidebar";
import ClientSidebar from "./ClientSidebar";
import UserSidebar from "./UserSidebar";
import { useAuth } from "../contexts/AuthContext";
import { isAdminRole } from "../utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
import { useLanguageSafe } from '../contexts/LanguageContext';

const SidebarByRole: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      {/* ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin */}
      {isAdminRole(user.role) && <ResponsiveSidebar />}
      {user.role === "client" && <ClientSidebar />}
      {user.role === "user" && <UserSidebar />}
    </>
  );
};

export default SidebarByRole;





