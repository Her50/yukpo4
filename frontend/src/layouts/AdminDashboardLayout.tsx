// @ts-check
import React from "react";
import { Outlet } from "react-router-dom";
import ResponsiveSidebar from "@/components/ResponsiveSidebar";
import { useUser } from "@/hooks/useUser";
import { useUserPlan } from "@/hooks/useUserPlan";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Ajout nécessaire

const AdminDashboardLayout: React.FC = () => {
  const { user } = useUser();
  const { plan } = useUserPlan();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR FIXE OU RESPONSIVE */}
      <ResponsiveSidebar />

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 p-6 md:p-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Tableau de bord Admin</h1>
          {user && (
            <div className="flex gap-2">
              <span className="bg-gray-300 text-sm px-3 py-1 rounded-full">
                🧑‍💼 Rôle : {user.role}
              </span>
              <span className="bg-blue-200 text-sm px-3 py-1 rounded-full">
                💼 Plan : {plan}
              </span>
            </div>
          )}
        </div>

        {/* INJECTION DES PAGES */}
        <Outlet />

        {/* 🚀 CONTEXTUAL BUTTONS */}
        <div className="mt-12 flex flex-wrap gap-4 justify-center border-t pt-6">
          <a
            href={ROUTES.SERVICES}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
          >
            Découvrir d'autres services
          </a>
          <a
            href={ROUTES.PLANS}
            className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
          >
            Voir les formules
          </a>
          <a
            href={ROUTES.CONTACT}
            className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
          >
            Contacter l'équipe Yukpomnang
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardLayout;
