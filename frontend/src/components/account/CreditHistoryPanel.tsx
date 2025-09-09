import React, { useEffect, useState } from 'react';
import axios from 'axios';

type UsageRecord = {
  date: string;
  usage_type: string;
  montant: number;
  moteur: string;
};

const CreditHistoryPanel = ({ userId }: { userId: number }) => {
  const [logs, setLogs] = useState<UsageRecord[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) {
      axios.get(`/api/user/credit/history/${userId}`).then((res) => setLogs(res.data));
    }
  }, [show, userId]);

  return (
    <div className="my-4">
      <button
        className="text-blue-600 underline text-sm"
        onClick={() => setShow((prev) => !prev)}
      >
        🧾 Voir mon historique IA + crédit
      </button>

      {show && (
        <div className="mt-4 bg-white shadow p-4 rounded text-sm max-h-96 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-1">Date</th>
                <th>Type</th>
                <th>Moteur</th>
                <th>Coût</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-1">{new Date(log.date).toLocaleString()}</td>
                  <td>{log.usage_type}</td>
                  <td>{log.moteur}</td>
                  <td className="text-red-600 font-semibold">{log.montant.toFixed(2)} crédits</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CreditHistoryPanel;
