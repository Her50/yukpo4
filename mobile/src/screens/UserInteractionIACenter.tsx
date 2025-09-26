// @ts-check
import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
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
        <Text style="text-3xl font-bold mb-8">🧠 Interactions IA</Text>

        <ul style="space-y-6">
          {logs.map((log, index) => (
            <li key={index} style="border-b pb-4">
              <Text style="font-semibold">{log.action}</Text>
              <Text style="text-sm text-gray-500">{log.time}</Text>

              {log.plan === 'enterprise' && (
                <RequireAccess plan="enterprise">
                  <Text style="mt-2 text-orange-600">🔒 Accès réservé aux comptes Premium</Text>
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





