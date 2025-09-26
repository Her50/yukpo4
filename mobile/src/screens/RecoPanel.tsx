import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const RecoPanel: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [reco, setReco] = useState<string[]>([]);

  const fetchRecommendations = async () => {
    try {
      const res = await axios.post("/api/recommendations", { user_id: userId });
      setReco(res.data.suggestions || []);
    } catch (error) {
      console.error("Erreur lors de la récupération des recommandations :", error);
    }
  };

  return (
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">✨ Recommandations IA</Text>
      <TextInput
        style="border p-2 mr-2"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="User ID"
      />
      <TouchableOpacity
        style=""
        onPress={fetchRecommendations}
      >
        Voir Suggestions
      </TouchableOpacity>
      {reco.length > 0 && (
        <ul style="mt-4 list-disc pl-6">
          {reco.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </View>
  );
};

export default RecoPanel;




