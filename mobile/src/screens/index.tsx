// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

const Index: React.FC = () => {
  return (
    <ResponsiveContainer>
      <View style="p-4">
        <h2 style="text-2xl font-bold mb-4">Bienvenue sur Yukpomnang</h2>
        <p style="text-gray-700">Cette page d’index peut servir de redirection intelligente selon le rôle ou les préférences utilisateur.</Text>
      </View>
    </ResponsiveContainer>
  );
};

export default Index;

