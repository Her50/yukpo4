// @ts-check
import * as React from "react";
import { Link, useLocation } from "@react-navigation/native";
import RequirePlan from "@/components/security/RequirePlan";

const Sidebar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) =>
    location.pathname === path ? "bg-orange-600 text-white font-bold" : "";

  return (
    <aside style="w-64 bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
      <Link to="/dashboard" style={`block px-4 py-2 rounded ${isActive("/dashboard")}`}>
        🏠 Accueil
      </Link>

      <RequirePlan plan="enterprise">
        <Link
          to="/dashboard/premium"
          style={`block px-4 py-2 rounded ${isActive("/dashboard/premium")}`}
        >
          🧠 Yukpomnang Premium
        </Link>
      </RequirePlan>
    </aside>
  );
};

export default Sidebar;





