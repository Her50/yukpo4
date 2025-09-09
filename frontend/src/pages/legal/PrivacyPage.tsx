import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";

const PrivacyPage: React.FC = () => {
  return (
    <ResponsiveContainer>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">🔐 Politique de confidentialité</h2>
        <p className="text-gray-700 mb-2">
          Yukpo s'engage à protéger votre vie privée. Aucune donnée personnelle n'est vendue à des tiers.
        </p>
        <p className="text-gray-700 mb-2">
          Les informations collectées sont utilisées uniquement pour améliorer votre expérience utilisateur, fournir les services demandés et assurer la sécurité.
        </p>
        <p className="text-gray-700 mb-2">
          Vous pouvez demander la suppression de vos données à tout moment en contactant : <strong>rgpd@yukpo.com</strong>
        </p>
        <p className="text-gray-700">
          Pour en savoir plus sur vos droits, veuillez consulter les textes du RGPD disponibles sur le site de la CNIL.
        </p>
      </div>
    </ResponsiveContainer>
  );
};

export default PrivacyPage;
