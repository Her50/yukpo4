// @ts-check
import React from "react";
import { useUser } from "@/hooks/useUser";
import ResponsiveSidebar from "@/components/ResponsiveSidebar";
import ClientSidebar from "@/components/ClientSidebar";
import UserSidebar from "@/components/UserSidebar";
import { isAdminRole } from "@/utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

const SidebarByRole: React.FC = () => {
  const { user } = useUser();

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
