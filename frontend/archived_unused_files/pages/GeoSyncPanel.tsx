import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Button } from "@/components/ui/buttons";

interface ZoneData {
  region: string;
  incidents: number;
  severity: string;
  propagation_score: number;
}

const riskColor = (score: number) => {
  if (score > 0.8) return "bg-red-200";
  if (score > 0.5) return "bg-yellow-200";
  return "bg-green-200";
};

const GeoSyncPanel: React.FC = () => {
  const [data, setData] = useState<ZoneData[]>([]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/zones/risques");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Erreur lors de la récupération des données zones :", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">🌍 Synchronisation Multi-Zone IA</h2>
      <Button className="mb-4" onClick={fetchData}>
        🔄 Forcer la synchronisation
      </Button>

      <table className="w-full border text-sm text-left">
        <thead>
          <tr className="bg-gray-200">
            <th className="">Région</th>
            <th className="">Incidents</th>
            <th className="">Sévérité</th>
            <th className="">Propagation (%)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((z, i) => (
            <tr key={i} className="border-t">
              <td className="">{z.region}</td>
              <td className="">{z.incidents}</td>
              <td className="">{z.severity}</td>
              <td className={`px-2 py-1 ${riskColor(z.propagation_score)}`}>
                {Math.round(z.propagation_score * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GeoSyncPanel;