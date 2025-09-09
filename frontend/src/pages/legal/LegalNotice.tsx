import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";

const LegalNotice: React.FC = () => {
  return (
    <ResponsiveContainer>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">📜 Mentions légales</h2>
        <p className="text-gray-700 mb-2">
          Cette plateforme est éditée par Yukpo, société spécialisée dans la mise en relation intelligente de services.
        </p>
        <p className="text-gray-700 mb-2">
          Responsable de publication : Yukpo S.A.
        </p>
        <p className="text-gray-700 mb-2">
          Contact : contact@yukpo.com
        </p>
        <p className="text-gray-700">
          Hébergement : Infrastructure cloud sécurisée, conforme RGPD.
        </p>
      </div>
    </ResponsiveContainer>
  );
};

export default LegalNotice;
