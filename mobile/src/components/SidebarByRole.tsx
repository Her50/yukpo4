// @ts-check
import * as React from "react";
import ResponsiveSidebar from "./ResponsiveSidebar";
import ClientSidebar from "./ClientSidebar";
import UserSidebar from "./UserSidebar";
import { useAuth } from "../contexts/AuthContext";

const SidebarByRole: React.FC = () => {
  const { user } = useAuth();

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





