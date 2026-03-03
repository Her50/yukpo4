// @ts-check
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import React from "react";

const MonitoringDashboard: React.FC = () => {
  return (
    <ResponsiveContainer className="py-8">
      <h2 className="text-2xl font-bold mb-4">
        📊 Monitoring Dashboard
      </h2>

      <p className="text-gray-700 mb-6">
        Visualisez ici les données de surveillance, alertes et performances du système{" "}
        <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 bg-clip-text text-transparent font-bold">Yukpo</span>.
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES} className="text-blue-600 hover:underline">
          Découvrir d'autres services
        </a>
        <a href={ROUTES.PLANS} className="text-blue-600 hover:underline">
          Voir les formules
        </a>
        <a href={ROUTES.CONTACT} className="text-blue-600 hover:underline">
          Contacter l'équipe Yukpo
        </a>
      </div>
    </ResponsiveContainer>
  );
};

export default MonitoringDashboard;
