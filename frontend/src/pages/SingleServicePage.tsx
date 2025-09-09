// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { useParams } from "react-router-dom";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import VariationAlert from "@/components/variation/VariationAlert";
import RequireAccess from "@/components/auth/RequireAccess";

const SingleServicePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const parsedId = Number(id);

  if (!id || isNaN(parsedId)) {
    return (
      <ResponsiveContainer>
        <div className="p-6 text-red-600 font-medium text-center">
          ⚠️ Identifiant de service invalide ou manquant dans l’URL.
        </div>
      </ResponsiveContainer>
    );
  }

  return (
    <RequireAccess role="user" plan="pro">
      <ResponsiveContainer>
        <div className="pt-24 pb-12">
          <h1 className="text-2xl font-bold mb-4 text-gray-800">
            🧩 Détail du service #{parsedId}
          </h1>

          <VariationAlert serviceId={parsedId} />

          {/* 🚀 CONTEXTUAL BUTTONS */}
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
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
              Contacter l’équipe{" "}
              <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
                Yukpo
              </span>
            </a>
          </div>
        </div>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default SingleServicePage;
