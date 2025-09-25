import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Button } from "@/components/ui/buttons";

interface LogItem {
  user_id: string;
  reason: string;
}

const ReactionManager: React.FC = () => {
  const [log, setLog] = useState<LogItem[]>([]);

  const suspendUser = async (user_id: string) => {
    await fetch("/api/admin/react-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, reason: "Suspicion IA" }),
    });
    alert("Utilisateur suspendu !");
  };

  useEffect(() => {
    // Exemple : fetch fictif
    setLog([{ user_id: "user42", reason: "multi-comptes" }]);
  }, []);

  return (
    <View style="p-4">
      <h2 style="text-xl font-bold mb-4">🚫 Utilisateurs bloqués</h2>
      <table style="w-full text-sm border">
        <thead>
          <tr style="bg-gray-100">
            <th style="p-2 text-left">Utilisateur</th>
            <th style="p-2 text-left">Raison</th>
            <th style="p-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {log.map((l, i) => (
            <tr key={i} style="border-t">
              <td style="p-2">{l.user_id}</td>
              <td style="p-2">{l.reason}</td>
              <td style="p-2">
                <TouchableOpacity onClick={() => suspendUser(l.user_id)}>
                  Suspendre
                </TouchableOpacity>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
};

export default ReactionManager;
