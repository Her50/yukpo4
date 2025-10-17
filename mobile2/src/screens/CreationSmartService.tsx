// src/pages/CreationSmartService.tsx
import * as React from "react";
import { useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { useNavigation } from 'react-router-dom';
import { detectServiceType } from '@/utils/serviceClassifier'; // À créer si besoin
import { Loader } from '@/components/ui/loader';

const CreationSmartService = () => {
  const navigate = useNavigation();

  useEffect(() => {
    const simulateDetection = async () => {
      const type = await detectServiceType(); // Simule détection de service
      if (type === 'immobilier') {
        navigation.navigate('/create/immobilier');
      } else if (type === 'livre') {
        navigation.navigate('/create/livre');
      } else if (type === 'transport') {
        navigation.navigate('/create/transport');
      } else {
        navigation.navigate('/create/autre');
      }
    };
    simulateDetection();
  }, [navigate]);

  return (
    <View style="flex flex-col items-center justify-center min-h-screen">
      <Loader />
      <Text style="mt-4 text-gray-600">Analyse du type de service en cours…</Text>
    </View>
  );
};

export default CreationSmartService;





