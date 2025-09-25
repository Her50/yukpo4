import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const TrendExplorer: React.FC = () => {
  const [keyword, setKeyword] = useState("");
  const [trends, setTrends] = useState<string[]>([]);

  const fetchTrends = async () => {
    try {
      const res = await axios.post("/api/trends", { keyword });
      setTrends(res.data.trends || []);
    } catch (error) {
      console.error("Erreur lors de la récupération des tendances :", error);
      setTrends([]);
    }
  };

  return (
    <View style="p-6">
      <h2 style="text-xl font-bold mb-4">📡 Explorer les tendances virales</h2>
      <View style="flex items-center gap-2">
        <TextInput
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style="border p-2 rounded w-full"
          placeholder="Mot-clé (ex: logement Douala)"
        />
        <TouchableOpacity
          onClick={fetchTrends}
          style=""
        >
          🔍 Lancer l’analyse
        </TouchableOpacity>
      </View>

      <ul style="mt-6 list-disc pl-6">
        {trends.map((trend, i) => (
          <li key={i}>{trend}</li>
        ))}
      </ul>
    </View>
  );
};

export default TrendExplorer;
