import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const AutoMarketingPanel: React.FC = () => {
  const [platform, setPlatform] = useState("tiktok");
  const [language, setLanguage] = useState("fr");
  const [serviceName, setServiceName] = useState("");
  const [response, setResponse] = useState<{ generated_text: string; image_prompt: string } | null>(null);

  const handleGenerate = async () => {
    try {
      const res = await axios.post("/marketing/AutoMarketingPanel", {
        platform,
        language,
        service_name: serviceName,
      });
      setResponse(res.data);
    } catch (err) {
      alert("❌ Erreur lors de la génération");
      console.error(err);
    }
  };

  return (
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">🧠 Génération de contenu marketing auto</Text>

      <TextInput
        style="border p-2 w-full mb-2"
        placeholder="Nom du service"
        value={serviceName}
        onChange={(e) => setServiceName(e.target.value)}
      />

      <select
        style="border p-2 mb-2 w-full"
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
      >
        <option value="tiktok">TikTok</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="linkedin">LinkedIn</option>
      </select>

      <select
        style="border p-2 mb-4 w-full"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
        <option value="ff">Pulaar</option>
      </select>

      <TouchableOpacity
        onPress={handleGenerate}
        style=""
      >
        Générer
      </TouchableOpacity>

      {response && (
        <View style="mt-4 bg-gray-100 p-4 rounded">
          <Text><strong>Texte :</strong> {response.generated_text}</Text>
          <Text><strong>Prompt image :</strong> {response.image_prompt}</Text>
        </View>
      )}
    </View>
  );
};

export default AutoMarketingPanel;




