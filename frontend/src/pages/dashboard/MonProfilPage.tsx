// @ts-check
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import React from "react";

const MonProfilPage: React.FC = () => (
  <main className="p-10 text-center bg-gray-50 min-h-screen">
    <ResponsiveContainer>
      <h1 className="text-2xl font-bold mb-4">👤 Mon Profil</h1>
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

export default MonProfilPage;
