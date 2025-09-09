import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";

const LandingPage_fr: React.FC = () => {
  return (
    <ResponsiveContainer>
      <div className="p-4">
        <h2 className="text-2xl font-bold text-primary mb-2">Bienvenue sur Yukpo</h2>
        <p className="text-gray-600">
          Une plateforme intelligente pour connecter vos besoins aux meilleures opportunités, avec l’assistance de l’IA.
        </p>
      </div>
    </ResponsiveContainer>
  );
};

export default LandingPage_fr;
