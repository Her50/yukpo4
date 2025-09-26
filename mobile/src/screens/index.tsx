// @ts-check
import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

const Index: React.FC = () => {
  return (
    <ResponsiveContainer>
      <View style="p-4">
        <Text style="text-2xl font-bold mb-4">Bienvenue sur Yukpomnang</Text>
        <Text style="text-gray-700">Cette page d’index peut servir de redirection intelligente selon le rôle ou les préférences utilisateur.</Text>
      </View>
    </ResponsiveContainer>
  );
};

export default Index;





