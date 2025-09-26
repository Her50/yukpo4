// @ts-check
import React from 'react';
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
      <div className="pt-24 font-sans">
        <h1 className="text-3xl font-bold mb-6">🚀 Choisissez votre plan</h1>

        {plans.map((plan, index) => (
          <div
            key={index}
            className="mb-6 border p-4 rounded shadow-sm bg-white dark:bg-gray-800"
          >
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="text-gray-700">{plan.price}</p>
            <p className="mb-2 text-sm">{plan.description}</p>
            <ul className="list-disc pl-6 mb-2 text-gray-600">
              {plan.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
            <a
              href={plan.cta}
              className="inline-block text-blue-600 hover:underline"
            >
              En savoir plus
            </a>
          </div>
        ))}

        <RequireAccess plan="pro">
          <div className="mt-8 p-4 border rounded bg-green-50">
            <h2 className="text-xl font-bold text-green-800">🔥 Pro Plan</h2>
            <p className="mb-2">Accès complet à tous les services intelligents Yukpomnang.</p>
            <a
              href="/paiement/pro"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Souscrire au plan Pro
            </a>
          </div>
        </RequireAccess>
      </div>
    </ResponsiveContainer>
  );
};

export default UpgradePage;
