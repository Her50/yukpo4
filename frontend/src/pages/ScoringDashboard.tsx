import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const ScoringDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Tableau de scoring IA</h1>
      <p className="text-sm text-gray-600 mb-6">
        Comparaison des prestataires, clients et services...
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className=""
        >
          découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className=""
        >
          contacter l'équipe yukpomnang
        </a>
      </div>
    </div>
  );
};

export default ScoringDashboard;