import React, { useEffect, useState } from "react";
import axios from "axios";
import AppLayout from "@/components/layout/AppLayout";

interface KeywordStat {
  keyword: string;
  count: number;
}

const IADashboardPanel: React.FC = () => {
  const [data, setData] = useState<KeywordStat[]>([]);

  useEffect(() => {
    axios.get("/api/tags/frequent")
      .then(res => {
        const raw = res.data?.top_keywords || [];
        const cleaned: KeywordStat[] = raw.map(([keyword, count]: [string, number]) => ({
          keyword,
          count
        }));
        setData(cleaned);
      })
      .catch(err => console.error("Erreur chargement stats IA", err));
  }, []);

  return (
    <AppLayout padding>
      <div className="max-w-5xl mx-auto py-10">
        <h1 className="text-2xl font-bold text-center mb-6">📊 Dashboard IA : Mots-clés fréquents</h1>
        <table className="w-full text-sm border border-gray-200 shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">🔑 Mot-clé</th>
              <th className="p-2 border">🔢 Occurrences</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                <td className="p-2 border font-medium">{item.keyword}</td>
                <td className="p-2 border text-center">{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default IADashboardPanel;
