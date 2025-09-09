import React, { useEffect, useState } from 'react';
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from 'axios';
import { Button } from "@/components/ui/buttons";

type Report = {
  id: number;
  reason: string;
  user_id: number;
};

const ReportModeration: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    axios.get('/reports')
      .then((res) => setReports(res.data.reports))
      .catch((err) => console.error("Erreur chargement signalements :", err));
  }, []);

  const blockUser = (id: number) => {
    axios.get(`/reports/block/${id}`)
      .then(() => alert('✅ Utilisateur bloqué'))
      .catch(() => alert('❌ Erreur lors du blocage'));
  };

  return (
    <ResponsiveContainer className="py-10">
      <h2 className="text-xl font-bold mb-6 text-gray-800">📨 Signalements reçus</h2>

      {reports.length === 0 ? (
        <p className="text-gray-500 mt-4 text-center">Aucun signalement en attente.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li
              key={r.id}
              className="border border-gray-200 rounded p-4 flex justify-between items-center"
            >
              <span className="text-gray-700">{r.reason}</span>
              <Button
                variant="destructive"
                onClick={() => blockUser(r.user_id)}
              >
                Bloquer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </ResponsiveContainer>
  );
};

export default ReportModeration;
