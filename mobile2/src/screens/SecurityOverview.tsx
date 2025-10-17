import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
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
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">🔐 Détection IA d’activités anormales</Text>
      <table style="w-full border text-sm">
        <thead style="bg-gray-100">
          <tr>
            <th style="p-2 border">Utilisateur</th>
            <th style="p-2 border">Motif</th>
            <th style="p-2 border">Heure</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} style="border-t">
              <td style="p-2 border">{e.user}</td>
              <td style="p-2 border">{e.reason}</td>
              <td style="p-2 border">{new Date(e.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
};

export default SecurityOverview;




