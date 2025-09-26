import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Ajout de l'import manquant

const DashboardSelector: React.FC = () => {
  return (
    <div className="p-4">
      <h2>DashboardSelector</h2>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className=""
        >
          Découvrir d'autres services
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
          Contacter l'équipe Yukpomnang
        </a>
      </div>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </div>
  );
};

export default DashboardSelector;