import React, { useEffect, useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from "axios";

type AlerteData = {
  alerte?: boolean;
  erreur?: boolean;
};

function SignalementAlerte() {
  const [alerte, setAlerte] = useState<AlerteData | null>(null);

  useEffect(() => {
    axios
      .get("/api/reports/analyze")
      .then((res) => setAlerte(res.data))
      .catch(() => setAlerte({ erreur: true }));
  }, []);

  return (
    <ResponsiveContainer className="py-6">
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">🚨 Alerte de Signalements</h2>

        {alerte?.erreur ? (
          <div className="text-yellow-600 font-semibold">
            ⚠️ Erreur de chargement des données.
          </div>
        ) : alerte?.alerte ? (
          <div className="text-red-600 font-bold text-lg">
            🚨 Niveau Critique détecté sur la plateforme
          </div>
        ) : (
          <div className="text-green-600 font-medium">
            ✅ Aucun signalement critique détecté.
          </div>
        )}
      </div>
    </ResponsiveContainer>
  );
}

export default SignalementAlerte;
