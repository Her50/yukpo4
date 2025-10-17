import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Ajout de l'import manquant

const DashboardSelector: React.FC = () => {
  return (
    <View style="p-4">
      <Text>DashboardSelector</Text>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <View style="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          style=""
        >
          Découvrir d'autres services
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
          Contacter l'équipe Yukpomnang
        </a>
      </View>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </View>
  );
};

export default DashboardSelector;




