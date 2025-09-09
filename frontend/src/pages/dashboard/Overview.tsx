// @ts-check
import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const Overview: React.FC = () => {
  return (
    <ResponsiveContainer className="pt-24 pb-12">
      <h2 className="text-2xl font-bold mb-4">📊 Vue d’ensemble</h2>
      <p className="text-gray-600">
        Bienvenue sur le tableau de bord de suivi global de{" "}
        <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
          Yukpo
        </span>.
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES} className="text-blue-600 hover:underline">
          Découvrir d'autres services
        </a>
        <a href={ROUTES.PLANS} className="text-blue-600 hover:underline">
          Voir les formules
        </a>
        <a href={ROUTES.CONTACT} className="text-blue-600 hover:underline">
          Contacter l'équipe <span className="font-semibold">Yukpo</span>
        </a>
      </div>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </ResponsiveContainer>
  );
};

export default Overview;
