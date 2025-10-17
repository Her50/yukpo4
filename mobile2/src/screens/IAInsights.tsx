import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ ajout manquant
import BehaviorScoreCard from "@/components/BehaviorScoreCard"; // ✅ corrigé si component bien dans ce chemin

const IAInsights: React.FC = () => {
  const [data, setData] = useState<{ score: number; suspicious: boolean } | null>(null);

  const handleTest = async () => {
    try {
      const res = await fetch("/api/ia/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: "1.2.3.4", path: ROUTES.LOGIN, freq: 12 }),
      });
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("Erreur IA test :", error);
    }
  };

  return (
    <View style="p-4">
      <Text style="text-xl font-bold">🧠 Analyse IA comportementale</Text>
      <TouchableOpacity style="" onPress={handleTest}>
        Lancer un test IA
      </TouchableOpacity>

      {data && (
        <View style="mt-4">
          <BehaviorScoreCard score={data.score} suspicious={data.suspicious} />
        </View>
      )}
    </View>
  );
};

export default IAInsights;




