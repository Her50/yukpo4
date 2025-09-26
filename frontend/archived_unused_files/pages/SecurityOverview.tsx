import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';


interface Entry {
  user: string;
  reason: string;
  timestamp: string;
}

const SecurityOverview: React.FC = () => {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    fetch("/admin/security-overrides")
      .then((r) => r.text())
      .then((text) => {
        const lines = text
          .trim()
          .split("\n")
          .map((j) => JSON.parse(j));
        setEntries(lines.reverse());
      })
      .catch((err) => {
        console.error("Erreur lors du chargement des logs :", err);
      });
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">🔐 Détection IA d’activités anormales</h2>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Utilisateur</th>
            <th className="p-2 border">Motif</th>
            <th className="p-2 border">Heure</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-t">
              <td className="p-2 border">{e.user}</td>
              <td className="p-2 border">{e.reason}</td>
              <td className="p-2 border">{new Date(e.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SecurityOverview;