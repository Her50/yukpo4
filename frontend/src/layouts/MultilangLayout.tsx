// @ts-check
import React from "react";
import { Outlet } from "react-router-dom";
import HeaderController from "@/components/HeaderController";
import FloatingHelpButton from "@/components/FloatingHelpButton";

const MultilangLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* En-tête multilingue */}
      <HeaderController />

      {/* Contenu injecté */}
      <main className="flex-1 bg-gray-50 pt-24 px-4">
        <Outlet />
      </main>

      {/* Pied de page */}
      

      {/* Assistance IA ou contact */}
      <FloatingHelpButton />
    </div>
  );
};

export default MultilangLayout;
