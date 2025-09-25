import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Button } from "@/components/ui/buttons";

interface LogEntry {
  timestamp: string;
  user: string;
  action: string;
  module: string;
  status: string;
}

const ActivityLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/activity_log.json")
      .then((res) => res.text())
      .then((text) => {
        const lines = text.trim().split("\n");
        const parsed: LogEntry[] = [];
        for (const line of lines) {
          try {
            parsed.push(JSON.parse(line));
          } catch (err) {
            console.warn("⚠️ Ligne ignorée (JSON invalide) :", line);
          }
        }
        setLogs(parsed);
      })
      .catch((err) => console.error("Erreur chargement logs :", err));
  }, []);

  const filtered = logs.filter((l) =>
    filter ? l.action.includes(filter) || l.module.includes(filter) : true
  );

  return (
    <ResponsiveContainer style="py-8">
      <h2 style="text-xl font-bold mb-4">🧾 Historique des actions admin</h2>

      <TextInput
        placeholder="Filtrer par action/module"
        style="p-2 border border-gray-300 mb-4 w-full"
        onChange={(e) => setFilter(e.target.value)}
      />

      <table style="w-full text-left border border-collapse">
        <thead style="bg-gray-100">
          <tr>
            <th style="p-2 border">📅 Date</th>
            <th style="p-2 border">👤 Utilisateur</th>
            <th style="p-2 border">⚙️ Action</th>
            <th style="p-2 border">📦 Module</th>
            <th style="p-2 border">✅ Statut</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((log, i) => (
              <tr key={i} style="border-t">
                <td style="p-2 border">{log.timestamp}</td>
                <td style="p-2 border">{log.user}</td>
                <td style="p-2 border">{log.action}</td>
                <td style="p-2 border">{log.module}</td>
                <td style="p-2 border">{log.status}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style="text-center text-gray-500 py-4">
                Aucun log trouvé.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ResponsiveContainer>
  );
};

export default ActivityLogViewer;

