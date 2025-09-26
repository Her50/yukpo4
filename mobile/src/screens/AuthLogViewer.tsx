import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">🔐 Connexions Admin</Text>

      <View style="flex items-center gap-4 mb-4">
        <TextInput
          style="border p-2 rounded"
          placeholder="Filtrer par utilisateur ou statut..."
          onChange={(e) => setFilter(e.target.value)}
        />
        <TouchableOpacity onPress={exportCSV}>📥 Export CSV</TouchableOpacity>
      </View>

      <table style="w-full border text-sm">
        <thead style="bg-gray-100">
          <tr>
            <th style="border p-2">Date</th>
            <th style="border p-2">User</th>
            <th style="border p-2">IP</th>
            <th style="border p-2">Event</th>
            <th style="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log, i) => (
            <tr key={i} style="hover:bg-gray-50">
              <td style="border p-2">{log.timestamp}</td>
              <td style="border p-2">{log.user}</td>
              <td style="border p-2">{log.ip}</td>
              <td style="border p-2">{log.event}</td>
              <td style="border p-2">{log.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
};

export default AuthLogViewer;




