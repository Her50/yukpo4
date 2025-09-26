import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const SummaryDashboard: React.FC = () => {
  const [summaries, setSummaries] = useState<string[]>([]);

  const fetchSummaries = () => {
    fetch("/api/admin/summarize-all", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setSummaries(data.split("\n")));
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const sendToEmail = () => {
    alert("📤 Fonction email simulée.");
  };

  return (
    <View style="p-4 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <View style="flex justify-between mb-4 items-center">
        <Text style="text-xl font-bold">🧠 Résumés automatiques</Text>
        <TouchableOpacity
          style=""
          onPress={sendToEmail}
        >
          📤 Envoyer à mon email
        </TouchableOpacity>
      </View>

      <View style="space-y-2">
        {summaries.map((line, i) => {
          const url = line.split("(")[1]?.replace(")", "") || "#";
          return (
            <View key={i} style="bg-gray-100 dark:bg-gray-800 p-2 rounded">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style="text-blue-600 hover:underline"
              >
                {line}
              </a>
            </View>
          );
        })}
      </View>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <View style="mt-10 flex flex-wrap gap-4 justify-center">
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

export default SummaryDashboard;




