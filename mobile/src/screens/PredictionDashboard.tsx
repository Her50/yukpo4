// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const chartData = [
  { month: "Jan", demandes: 20 },
  { month: "Fév", demandes: 35 },
  { month: "Mar", demandes: 50 },
  { month: "Avr", demandes: 65 },
  { month: "Mai", demandes: 80 },
  { month: "Juin", demandes: 95 },
  { month: "Juil", demandes: 120 },
];

const PredictionDashboard: React.FC = () => {
  return (
    <RequireAccess plan="pro">
      <ResponsiveContainer>
        <View style="pt-24 pb-32 font-sans">
          <h1 style="text-3xl font-bold text-center mb-10">📈 Analyse prédictive Yukpomnang</h1>

          <View style="max-w-4xl mx-auto">
            <View style="bg-gray-50 p-6 rounded-lg shadow-md mb-6">
              <h2 style="text-2xl font-semibold text-gray-800 mb-4">📊 Tendances des demandes</h2>
              <LineChart data={chartData} width={600} height={300}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="demandes" stroke="#FF5722" />
              </LineChart>
            </View>

            {/* 🚀 CONTEXTUAL BUTTONS */}
            <View style="mt-6 flex flex-wrap gap-4 justify-center">
              <a
                href={ROUTES.SERVICES}
                style="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
              >
                Découvrir d'autres services
              </a>
              <a
                href={ROUTES.PLANS}
                style="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
              >
                Voir les formules
              </a>
              <a
                href={ROUTES.CONTACT}
                style="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
              >
                Contacter l'équipe Yukpomnang
              </a>
            </View>
          </View>
        </View>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default PredictionDashboard;

