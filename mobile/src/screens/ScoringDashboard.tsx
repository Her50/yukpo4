import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const ScoringDashboard: React.FC = () => {
  return (
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">Tableau de scoring IA</Text>
      <Text style="text-sm text-gray-600 mb-6">
        Comparaison des prestataires, clients et services...
      </Text>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <View style="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          style=""
        >
          découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          style=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          style=""
        >
          contacter l'équipe yukpomnang
        </a>
      </View>
    </View>
  );
};

export default ScoringDashboard;




