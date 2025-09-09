// @ts-check
import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

type UsageData = {
  last_updated: string;
  plans: {
    [plan: string]: {
      [key: string]: {
        used: number;
        limit: number;
      };
    };
  };
};

const QuotaDashboard: React.FC = () => {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/admin/quota-usage")
      .then((res) => res.json())
      .then(setUsage)
      .catch(console.error);
  }, []);

  if (!usage) return <p>Chargement...</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">📊 Suivi des quotas d’usage</h2>
      <p className="text-sm text-gray-500 mb-2">
        Dernière mise à jour : {usage.last_updated}
      </p>

      {Object.entries(usage.plans).map(([plan, quotas]) => (
        <div key={plan} className="border p-4 mb-4 rounded">
          <h3 className="font-semibold mb-2">{plan.toUpperCase()}</h3>
          <ul className="space-y-1">
            {Object.entries(quotas).map(([key, { used, limit }]) => {
              const percent = Math.round((used / limit) * 100);
              const color =
                percent > 90
                  ? "bg-red-500"
                  : percent > 70
                  ? "bg-yellow-500"
                  : "bg-green-500";

              return (
                <li key={key}>
                  <span className="font-medium">
                    {key} : {used} / {limit}
                  </span>
                  <div className="h-2 mt-1 w-full bg-gray-300 rounded">
                    <div
                      className={`${color} h-2 rounded`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <h3 className="text-lg mt-6 font-semibold">📈 Consommation simulée (IA)</h3>
      <p className="text-sm text-gray-500 mb-2">
        Simulation basée sur la moyenne actuelle
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={[
            { day: 1, free: 2, pro: 10, enterprise: 30 },
            { day: 2, free: 4, pro: 20, enterprise: 50 },
            { day: 3, free: 6, pro: 30, enterprise: 70 },
            { day: 4, free: 10, pro: 50, enterprise: 90 },
          ]}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="free" stroke="#8884d8" />
          <Line type="monotone" dataKey="pro" stroke="#82ca9d" />
          <Line type="monotone" dataKey="enterprise" stroke="#ff7300" />
        </LineChart>
      </ResponsiveContainer>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-12 flex flex-wrap gap-4 justify-center border-t pt-6">
        <a
          href={ROUTES.SERVICES}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
        >
          Contacter l'équipe Yukpomnang
        </a>
      </div>
    </div>
  );
};

export default QuotaDashboard;
