// src/pages/dashboard/MesOpportunites.tsx
import React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/buttons";
import { Link } from "react-router-dom";

const MesOpportunitesPage: React.FC = () => {
  return (
    <AppLayout>
      <section className="py-16 px-4 max-w-4xl mx-auto text-center font-sans">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          🌍 Explorer mes opportunités
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">
          Retrouvez ici les opportunités qui correspondent le mieux à vos besoins. Vous pouvez filtrer, explorer et enregistrer vos préférences pour les retrouver plus facilement.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/services">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
              🔍 Parcourir les services disponibles
            </Button>
          </Link>
          <Link to="/match">
            <Button variant="outline">
              🤝 Voir mes correspondances intelligentes
            </Button>
          </Link>
        </div>
      </section>
    </AppLayout>
  );
};

export default MesOpportunitesPage;
