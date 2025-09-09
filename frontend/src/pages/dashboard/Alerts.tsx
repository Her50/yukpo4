// @ts-check
import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const Alerts: React.FC = () => {
  return (
    <ResponsiveContainer className="py-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        📢 Alertes et notifications
      </h2>

      {/* ℹ️ Contenu principal à venir ici */}
      <p className="text-gray-600 mb-8">
        Cette section affichera les alertes critiques, notifications système et messages importants pour l’utilisateur.
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className="text-sm text-blue-600 underline"
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className="text-sm text-blue-600 underline"
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className="text-sm text-blue-600 underline"
        >
          Contacter l'équipe Yukpo
        </a>
      </div>
    </ResponsiveContainer>
  );
};

export default Alerts;
