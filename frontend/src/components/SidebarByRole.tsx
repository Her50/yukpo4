// @ts-check
import React from "react";
import { useUser } from "@/hooks/useUser";
import ResponsiveSidebar from "@/components/ResponsiveSidebar";
import ClientSidebar from "@/components/ClientSidebar";
import UserSidebar from "@/components/UserSidebar";

const SidebarByRole: React.FC = () => {
  const { user } = useUser();

  if (!user) return null;

  return (
    <>
      {user.role === "admin" && <ResponsiveSidebar />}
      {user.role === "client" && <ClientSidebar />}
      {user.role === "user" && <UserSidebar />}
    </>
  );
};

export default SidebarByRole;
