import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const SummaryDashboard: React.FC = () => {
  const [summaries, setSummaries] = useState<string[]>([]);

  const fetchSummaries = () => {
    fetch("/api/admin/summarize-all", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setSummaries(data.split("\n")));
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const sendToEmail = () => {
    alert("📤 Fonction email simulée.");
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <div className="flex justify-between mb-4 items-center">
        <h1 className="text-xl font-bold">🧠 Résumés automatiques</h1>
        <button
          className=""
          onClick={sendToEmail}
        >
          📤 Envoyer à mon email
        </button>
      </div>

      <div className="space-y-2">
        {summaries.map((line, i) => {
          const url = line.split("(")[1]?.replace(")", "") || "#";
          return (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                {line}
              </a>
            </div>
          );
        })}
      </div>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-10 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className=""
        >
          découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className=""
        >
          contacter l'équipe yukpomnang
        </a>
      </div>
    </div>
  );
};

export default SummaryDashboard;