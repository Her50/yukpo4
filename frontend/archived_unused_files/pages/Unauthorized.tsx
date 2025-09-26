import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(ROUTES.LOGIN);
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="">
      <div className="">
        <h1 className="text-4xl font-bold text-red-600 mb-4">⛔ Accès refusé</h1>
        <p className="text-gray-700 mb-6">
          Vous n'avez pas les autorisations nécessaires pour accéder à cette page.
        </p>
        <p className="text-sm text-gray-500">
          Redirection automatique vers la page de connexion dans 5 secondes...
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;