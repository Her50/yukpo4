import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";

type MatchStat = {
  mot_cle: string;
  total: number;
};

type IAStat = {
  type: "IA" | "Scraping";
  total: number;
};

const MatchingHistoryDashboard = () => {
  const [motsCles, setMotsCles] = useState<MatchStat[]>([]);
  const [origines, setOrigines] = useState<IAStat[]>([]);

  useEffect(() => {
    axios.get("/api/admin/matching_stats/motscles").then((res) => setMotsCles(res.data));
    axios.get("/api/admin/matching_stats/origines").then((res) => setOrigines(res.data));
  }, []);

  return (
    <AppLayout padding>
      <h1 className="text-2xl font-bold mb-6">📊 Statistiques Matching</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h2 className="font-semibold mb-2">🔑 Top mots-clés</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={motsCles}>
                <XAxis dataKey="mot_cle" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-semibold mb-2">⚙️ Origine des réponses</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={origines}>
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MatchingHistoryDashboard;
