// @ts-check
import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { useUserServices } from '@/hooks/useUserServices';
import { useUser } from '@/hooks/useUser';
import { List } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useUser();
  const { hasServices, loading } = useUserServices();

  // Debug logs
  console.log('[Dashboard] Debug - user:', !!user, 'loading:', loading, 'hasServices:', hasServices);
  console.log('[Dashboard] Condition check:', user && !loading && hasServices);

  return (
    <ResponsiveContainer>
      {/* Barre supérieure avec bouton MesServices - toujours visible */}
      {user && !loading && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <List className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-medium">Gestion de vos services</span>
            </div>
            <Link
              to={ROUTES.MES_SERVICES}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <List className="w-4 h-4" />
              <span>Mes Services</span>
            </Link>
          </div>
        </div>
      )}

      {/* Debug info - à supprimer après test */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
          <p>Debug: user={!!user}, loading={loading}, hasServices={hasServices}</p>
          <p>Condition: {user && !loading && hasServices ? 'TRUE' : 'FALSE'}</p>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-6">
        📊 Tableau de bord Yukpomnang
      </h1>

      <ul className="space-y-2">
        <RequireAccess plan="enterprise">
          <li>
            <Link to={ROUTES.DASHBOARD} className="text-blue-600 underline">
              Accès Yukpomnang Premium
            </Link>
          </li>
        </RequireAccess>
      </ul>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <Link
          to={ROUTES.SERVICES}
          className="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl hover:bg-blue-200 transition"
        >
          Découvrir d'autres services
        </Link>
        <Link
          to={ROUTES.PLANS}
          className="px-4 py-2 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 transition"
        >
          Voir les formules
        </Link>
        <Link
          to={ROUTES.CONTACT}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition"
        >
          Contacter l'équipe Yukpomnang
        </Link>
      </div>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </ResponsiveContainer>
  );
};

export default Dashboard;
