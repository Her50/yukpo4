import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import React from "react";

const ApiDocs: React.FC = () => {
  return (
    <ResponsiveContainer className="p-4">
      <h2 className="text-2xl font-bold mb-4">📚 Documentation API</h2>
      <p className="text-gray-700">
        Retrouvez ici toutes les informations nécessaires pour utiliser les API de{" "}
        <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 bg-clip-text text-transparent font-semibold">
          Yukpo
        </span>{" "}
        : endpoints, authentification, formats de réponses, etc.
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES} className="text-blue-600 underline hover:text-blue-800">
          Découvrir d'autres services
        </a>
        <a href={ROUTES.PLANS} className="text-blue-600 underline hover:text-blue-800">
          Voir les formules
        </a>
        <a href={ROUTES.CONTACT} className="text-blue-600 underline hover:text-blue-800">
          Contacter l'équipe{" "}
          <span className="text-yellow-600 font-semibold">Yukpo</span>
        </a>
      </div>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </ResponsiveContainer>
  );
};

export default ApiDocs;
