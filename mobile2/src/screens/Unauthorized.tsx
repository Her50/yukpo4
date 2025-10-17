import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useNavigation } from "@react-navigation/native";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const Unauthorized: React.FC = () => {
  const navigate = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate(ROUTES.LOGIN);
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <View style="">
      <View style="">
        <Text style="text-4xl font-bold text-red-600 mb-4">⛔ Accès refusé</Text>
        <Text style="text-gray-700 mb-6">
          Vous n'avez pas les autorisations nécessaires pour accéder à cette page.
        </Text>
        <Text style="text-sm text-gray-500">
          Redirection automatique vers la page de connexion dans 5 secondes...
        </Text>
      </View>
    </View>
  );
};

export default Unauthorized;




