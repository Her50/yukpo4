// @ts-check
import React from "react";
import { Link, useLocation } from "react-router-dom";
import RequirePlan from "@/components/security/RequirePlan";

const Sidebar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) =>
    location.pathname === path ? "bg-orange-600 text-white font-bold" : "";

  return (
    <aside className="w-64 bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
      <Link to="/dashboard" className={`block px-4 py-2 rounded ${isActive("/dashboard")}`}>
        🏠 Accueil
      </Link>

      <RequirePlan plan="enterprise">
        <Link
          to="/dashboard/premium"
          className={`block px-4 py-2 rounded ${isActive("/dashboard/premium")}`}
        >
          🧠 Yukpomnang Premium
        </Link>
      </RequirePlan>
    </aside>
  );
};

export default Sidebar;
