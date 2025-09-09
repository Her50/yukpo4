import React from "react";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import corrigé

const PopularServices: React.FC = () => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">⭐ Services populaires</h2>

      {/* 🚀 CONTEXTUAL BUTTONS intégrés correctement */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center border-t pt-6">
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
  );
};

export default PopularServices;
