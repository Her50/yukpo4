// src/components/services/CardService.tsx
import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { ROUTES } from '@/routes/AppRoutesRegistry';

interface CardServiceProps {
  icon: string;
  title: string;
  description: string;
}

const CardService: React.FC<CardServiceProps> = ({ icon, title, description }) => (
  <View style="bg-white shadow-md rounded-lg p-5 text-center w-full max-w-xs">
    <View style="text-3xl mb-2">{icon}</View>
    <Text style="text-lg font-bold text-gray-800 mb-1">{title}</Text>
    <Text style="text-sm text-gray-600">{description}</Text>

    {/* 🚀 CONTEXTUAL BUTTONS */}
    <View style="mt-6 flex flex-wrap gap-4 justify-center">
      <a
        href={ROUTES.SERVICES}
        style="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
      >
        découvrir d'autres services
      </a>
      <a
        href={ROUTES.PLANS}
        style="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
      >
        Voir les formules
      </a>
      <a
        href={ROUTES.CONTACT}
        style="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
      >
        contacter l'équipe yukpomnang
      </a>
    </View>
  </View>
);

export default CardService;





