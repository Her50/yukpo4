// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';
import { ROUTES } from '@/routes/AppRoutesRegistry';

const DashboardPage: React.FC = () => (
  <RequireAccess role="user" plan="pro">
    <ResponsiveContainer>
      <div className="pt-24 px-4 sm:pt-32 md:pt-32 lg:pt-32 xl:pt-32 2xl:pt-32">
        <h2 className="text-3xl font-bold mb-6">📍 Tableau de bord utilisateur</h2>
        <p>Composants Yukpomnang et données utilisateur à venir ici...</p>

        {/* 🚀 CONTEXTUAL BUTTONS START */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <a
            href={ROUTES.SERVICES}
            className="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl hover:bg-blue-200 transition"
          >
            Découvrir d'autres services
          </a>
          <a
            href={ROUTES.PLANS}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 transition"
          >
            Voir les formules
          </a>
          <a
            href={ROUTES.CONTACT}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition"
          >
            Contacter l'équipe Yukpomnang
          </a>
        </div>
        {/* 🚀 CONTEXTUAL BUTTONS END */}
      </div>
    </ResponsiveContainer>
  </RequireAccess>
);

export default DashboardPage;
