// @ts-check
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import React from "react";

const StatsDashboard: React.FC = () => (
  <main className="p-10 text-center">
    <ResponsiveContainer>
      <h1 className="text-2xl font-bold mb-4">📈 Tableau de bord Statistiques</h1>
      <p className="text-gray-600">
        Cette page de{" "}
        <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 bg-clip-text text-transparent font-semibold">
          Yukpo
        </span>{" "}
        est en construction intelligente.
      </p>
    </ResponsiveContainer>
  </main>
);

export default StatsDashboard;
