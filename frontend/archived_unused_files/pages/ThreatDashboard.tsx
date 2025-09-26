import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const ThreatDashboard: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/admin/threats")
      .then((res) => res.json())
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  const chartData = logs.map((l) => ({
    date: l.detected_at?.split("T")[0] || "N/A",
    level: l.level === "high" ? 3 : l.level === "medium" ? 2 : 1,
  }));

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">🛡️ Menaces IA détectées</h1>

        <LineChart data={chartData}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="level" stroke="#ff0000" />
        </LineChart>

      <table className="w-full mt-4 text-sm border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">User</th>
            <th className="p-2 border">IP</th>
            <th className="p-2 border">Niveau</th>
            <th className="p-2 border">Date</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i} className="border-t">
              <td className="p-2 border">{l.user_id}</td>
              <td className="p-2 border">{l.ip}</td>
              <td className="p-2 border">{l.level}</td>
              <td className="p-2 border">{l.detected_at}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-10 flex flex-wrap gap-4 justify-center">
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
          Contacter l'équipe yukpomnang
        </a>
      </div>
    </div>
  );
};

export default ThreatDashboard;