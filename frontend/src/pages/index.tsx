// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

const Index: React.FC = () => {
  return (
    <ResponsiveContainer>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Bienvenue sur Yukpomnang</h2>
        <p className="text-gray-700">Cette page d’index peut servir de redirection intelligente selon le rôle ou les préférences utilisateur.</p>
      </div>
    </ResponsiveContainer>
  );
};

export default Index;
