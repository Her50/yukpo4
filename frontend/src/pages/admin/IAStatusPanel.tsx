import React, { useEffect, useState } from "react";
import axios from "axios";
import AppLayout from "@/components/layout/AppLayout";

interface IAStats {
  openai_hits: number;
  mistral_hits: number;
  local_hits: number;
  cache_hits: number;
}

const IAStatusPanel: React.FC = () => {
  const [stats, setStats] = useState<IAStats | null>(null);

  useEffect(() => {
    axios.get("/admin/ia/status").then((res) => setStats(res.data));
  }, []);

  if (!stats) return <AppLayout padding><p className="text-center py-10">Chargement des stats IA...</p></AppLayout>;

  return (
    <AppLayout padding>
      <div className="max-w-2xl mx-auto py-10 space-y-4">
        <h1 className="text-2xl font-bold text-center">📊 Suivi des appels IA</h1>
        <table className="w-full text-sm border border-gray-200 shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Source</th>
              <th className="p-2 border">Nombre d’appels</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="p-2 border">🧠 Cache Redis</td><td className="p-2 border">{stats.cache_hits}</td></tr>
            <tr><td className="p-2 border">🌍 OpenAI GPT</td><td className="p-2 border">{stats.openai_hits}</td></tr>
            <tr><td className="p-2 border">🔗 OpenRouter (Mistral)</td><td className="p-2 border">{stats.mistral_hits}</td></tr>
            <tr><td className="p-2 border">💻 IA locale (Ollama)</td><td className="p-2 border">{stats.local_hits}</td></tr>
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default IAStatusPanel;
