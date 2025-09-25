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
    <View style="p-6">
      <h2 style="text-xl font-semibold mb-4">🌍 Synchronisation Multi-Zone IA</h2>
      <TouchableOpacity style="mb-4" onClick={fetchData}>
        🔄 Forcer la synchronisation
      </TouchableOpacity>

      <table style="w-full border text-sm text-left">
        <thead>
          <tr style="bg-gray-200">
            <th style="">Région</th>
            <th style="">Incidents</th>
            <th style="">Sévérité</th>
            <th style="">Propagation (%)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((z, i) => (
            <tr key={i} style="border-t">
              <td style="">{z.region}</td>
              <td style="">{z.incidents}</td>
              <td style="">{z.severity}</td>
              <td style={`px-2 py-1 ${riskColor(z.propagation_score)}`}>
                {Math.round(z.propagation_score * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
};

export default GeoSyncPanel;
