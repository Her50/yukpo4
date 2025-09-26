import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Button } from "@/components/ui/buttons";

type AuthLog = {
  timestamp: string;
  user: string;
  ip: string;
  event: string;
  status: string;
};

const AuthLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/auth_activity.json")
      .then((res) => res.text())
      .then((text) => {
        const lines = text.trim().split("\n");
        const parsed = lines.map((line) => JSON.parse(line));
        setLogs(parsed);
      });
  }, []);

  const filtered = logs.filter(
    (log) =>
      !filter ||
      log.user.toLowerCase().includes(filter.toLowerCase()) ||
      log.status.toLowerCase().includes(filter.toLowerCase())
  );

  const exportCSV = () => {
    const rows = [
      "timestamp,user,ip,event,status",
      ...filtered.map(
        (log) =>
          `${log.timestamp},${log.user},${log.ip},${log.event},${log.status}`
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auth_log.csv";
    a.click();
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">🔐 Connexions Admin</h2>

      <div className="flex items-center gap-4 mb-4">
        <input
          className="border p-2 rounded"
          placeholder="Filtrer par utilisateur ou statut..."
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button onClick={exportCSV}>📥 Export CSV</Button>
      </div>

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Date</th>
            <th className="border p-2">User</th>
            <th className="border p-2">IP</th>
            <th className="border p-2">Event</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="border p-2">{log.timestamp}</td>
              <td className="border p-2">{log.user}</td>
              <td className="border p-2">{log.ip}</td>
              <td className="border p-2">{log.event}</td>
              <td className="border p-2">{log.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuthLogViewer;