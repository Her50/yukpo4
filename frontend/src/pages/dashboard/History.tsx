// @ts-check
import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const History: React.FC = () => {
  return (
    <ResponsiveContainer className="py-8">
      <h2 className="text-2xl font-bold mb-4">📜 Historique</h2>
      <p className="text-gray-600">
        Consultez ici les actions récentes, parcours utilisateurs ou événements notables liés à votre activité sur{" "}
        <span className="text-primary font-semibold">Yukpo</span>.
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

export default History;
