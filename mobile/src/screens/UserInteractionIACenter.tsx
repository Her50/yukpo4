// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const logs = [
  { type: 'clic', action: "Clic sur bouton 'Créer un service'", time: '2025-05-01 14:23' },
  {
    type: 'vue',
    action: 'Visite de la page Yukpomnang Premium',
    time: '2025-05-01 14:25',
    plan: 'enterprise',
  },
];

const UserInteractionIACenter: React.FC = () => {
  return (
    <ResponsiveContainer>
      <View style="pt-24 font-sans">
        <h1 style="text-3xl font-bold mb-8">🧠 Interactions IA</h1>

        <ul style="space-y-6">
          {logs.map((log, index) => (
            <li key={index} style="border-b pb-4">
              <p style="font-semibold">{log.action}</Text>
              <p style="text-sm text-gray-500">{log.time}</Text>

              {log.plan === 'enterprise' && (
                <RequireAccess plan="enterprise">
                  <p style="mt-2 text-orange-600">🔒 Accès réservé aux comptes Premium</Text>
                </RequireAccess>
              )}
            </li>
          ))}
        </ul>
      </View>
    </ResponsiveContainer>
  );
};

export default UserInteractionIACenter;

