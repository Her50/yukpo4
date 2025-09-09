import React, { useEffect, useState } from "react";
import axios from "axios";
import AppLayout from "@/components/layout/AppLayout";

interface ActionLog {
  id: string;
  user_id: string;
  action_type: string;
  action_target: string;
  created_at: string;
  metadata: Record<string, any>;
}

const AdminActionsPanel: React.FC = () => {
  const [logs, setLogs] = useState<ActionLog[]>([]);

  useEffect(() => {
    axios.get("/api/track/list")
      .then((res) => setLogs(res.data || []))
      .catch((err) => console.error("Erreur chargement actions:", err));
  }, []);

  return (
    <AppLayout padding>
      <div className="max-w-6xl mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6 text-center">📊 Historique des actions utilisateurs</h1>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">🧑 User ID</th>
              <th className="p-2 border">⚙️ Action</th>
              <th className="p-2 border">🎯 Cible</th>
              <th className="p-2 border">🕒 Horodatage</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-gray-50">
                <td className="p-2 border">{log.user_id}</td>
                <td className="p-2 border">{log.action_type}</td>
                <td className="p-2 border">{log.action_target}</td>
                <td className="p-2 border">{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default AdminActionsPanel;
