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
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📡 Explorer les tendances virales</h2>
      <div className="flex items-center gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="border p-2 rounded w-full"
          placeholder="Mot-clé (ex: logement Douala)"
        />
        <button
          onClick={fetchTrends}
          className=""
        >
          🔍 Lancer l’analyse
        </button>
      </div>

      <ul className="mt-6 list-disc pl-6">
        {trends.map((trend, i) => (
          <li key={i}>{trend}</li>
        ))}
      </ul>
    </div>
  );
};

export default TrendExplorer;