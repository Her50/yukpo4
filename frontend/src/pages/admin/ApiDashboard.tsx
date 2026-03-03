// src/pages/ApiDashboard.tsx
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import React from "react";

const ApiDashboard: React.FC = () => {
  return (
    <ResponsiveContainer className="py-10">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">🧩 API Dashboard</h1>
      <p className="text-gray-600">
        Ce tableau de bord affiche les statistiques d’utilisation des API, les performances, et les appels récents.
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-8 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES} className="text-sm text-blue-600 hover:underline">
          Découvrir d'autres services
        </a>
        <a href={ROUTES.PLANS} className="text-sm text-blue-600 hover:underline">
          Voir les formules
        </a>
        <a href={ROUTES.CONTACT} className="text-sm text-blue-600 hover:underline">
          Contacter l'équipe{" "}
          <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 bg-clip-text text-transparent font-semibold">
            Yukpo
          </span>
        </a>
      </div>
    </ResponsiveContainer>
  );
};

export default ApiDashboard;
