// @ts-check
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { useUserPlan } from '@/hooks/useUserPlan';
import ProOnlyBanner from '@/components/ProOnlyBanner';
import { ROUTES } from '@/routes/AppRoutesRegistry'; // ✅ Import manquant corrigé

const DashboardLayout: React.FC = () => {
  const { plan } = useUserPlan();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6">
        {plan === "free" && <ProOnlyBanner />}
        <Outlet />

        {/* 🚀 CONTEXTUAL BUTTONS */}
        <div className="mt-12 flex flex-wrap gap-4 justify-center border-t pt-6">
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
      </main>
    </div>
  );
};

export default DashboardLayout;
