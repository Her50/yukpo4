// @ts-check
import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const plans = [
  {
    name: 'Free',
    price: '0 FCFA',
    description: 'Accès limité aux services de base.',
    features: ['Accès public', 'Support communautaire'],
    cta: '#',
  },
];

const UpgradePage: React.FC = () => {
  return (
    <ResponsiveContainer>
      <View style="pt-24 font-sans">
        <Text style="text-3xl font-bold mb-6">🚀 Choisissez votre plan</Text>

        {plans.map((plan, index) => (
          <View
            key={index}
            style="mb-6 border p-4 rounded shadow-sm bg-white dark:bg-gray-800"
          >
            <Text style="text-xl font-semibold">{plan.name}</Text>
            <Text style="text-gray-700">{plan.price}</Text>
            <Text style="mb-2 text-sm">{plan.description}</Text>
            <ul style="list-disc pl-6 mb-2 text-gray-600">
              {plan.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
            <a
              href={plan.cta}
              style="inline-block text-blue-600 hover:underline"
            >
              En savoir plus
            </a>
          </View>
        ))}

        <RequireAccess plan="pro">
          <View style="mt-8 p-4 border rounded bg-green-50">
            <Text style="text-xl font-bold text-green-800">🔥 Pro Plan</Text>
            <Text style="mb-2">Accès complet à tous les services intelligents Yukpomnang.</Text>
            <a
              href="/paiement/pro"
              style="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Souscrire au plan Pro
            </a>
          </View>
        </RequireAccess>
      </View>
    </ResponsiveContainer>
  );
};

export default UpgradePage;





