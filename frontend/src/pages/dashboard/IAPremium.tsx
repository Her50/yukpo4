// @ts-check
import RequireAccess from "@/components/auth/RequireAccess";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import React from "react";

const IAPremium: React.FC = () => {
  return (
    <RequireAccess plan="enterprise">
      <ResponsiveContainer className="py-10">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🧠{" "}
          <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 bg-clip-text text-transparent">
            Yukpo Premium
          </span>
        </h1>

        <p className="text-lg text-center text-gray-700 max-w-2xl mx-auto">
          Accédez aux fonctionnalités exclusives d'intelligence artificielle : génération automatique,
          prédictions intelligentes, suggestions IA, matching vocal et bien plus encore.
        </p>

        {/* 🚀 CONTEXTUAL BUTTONS */}
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
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
    </RequireAccess>
  );
};

export default IAPremium;
