import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";

const CookiePage: React.FC = () => {
  return (
    <ResponsiveContainer>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">🍪 Politique de cookies</h2>
        <p className="text-gray-700">
          Nous utilisons des cookies pour améliorer votre expérience sur la plateforme Yukpo.
          En continuant à naviguer, vous acceptez leur utilisation.
        </p>
      </div>
    </ResponsiveContainer>
  );
};

export default CookiePage;
