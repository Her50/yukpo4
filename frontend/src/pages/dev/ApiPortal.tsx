import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const ApiPortal: React.FC = () => {
  return (
    <ResponsiveContainer className="p-4">
      <h2 className="text-2xl font-bold mb-4">🧪 Portail API</h2>
      <p className="text-gray-700 mb-6">
        Accédez à la documentation, testez vos appels API et gérez vos clés d'accès ici pour{" "}
        <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
          Yukpo
        </span>
        .
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES} className="">Découvrir d'autres services</a>
        <a href={ROUTES.PLANS} className="">Voir les formules</a>
        <a href={ROUTES.CONTACT} className="">Contacter l'équipe Yukpo</a>
      </div>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </ResponsiveContainer>
  );
};

export default ApiPortal;
