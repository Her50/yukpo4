import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";

const ApiPortalDev: React.FC = () => (
  <main className="p-10 text-center">
    <ResponsiveContainer>
      <h1 className="text-2xl font-bold mb-4">🛠️ Portail API – Développement</h1>
      <p className="text-gray-600">
        Cette page de{" "}
        <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
          Yukpo
        </span>{" "}
        est en construction intelligente.
      </p>
    </ResponsiveContainer>
  </main>
);

export default ApiPortalDev;
