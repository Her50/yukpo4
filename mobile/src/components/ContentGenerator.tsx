import * as React from "react";
import { useState } from "react";
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import axios from "axios";
import { useTranslation } from "react-i18next";

const ContentGenerator: React.FC = () => {
  const { i18n } = useTranslation();
  const [titre, setTitre] = useState("");
  const [desc, setDesc] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/ia/generate", {
        titre,
        description_brute: desc,
        langue: i18n.language,
      });
      setResult(response.data.content);
    } catch (err) {
      console.error(err);
      setResult("❌ Erreur de génération");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style="p-4 border rounded bg-white shadow">
      <Text style="text-lg font-semibold mb-2">🧠 Générateur IA multilingue</Text>

      <TextInput
        type="text"
        placeholder="Titre du bien"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        style="w-full mb-2 p-2 border rounded"
      />

      <textarea
        placeholder="Description brute"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        style="w-full mb-2 p-2 border rounded h-32"
      />

      <TouchableOpacity
        onPress={generate}
        disabled={loading}
        style="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? "Génération..." : "Générer"}
      </TouchableOpacity>

      {result && (
        <View style="mt-4 p-3 border bg-gray-50 rounded">
          <strong>📑 Résultat :</strong>
          <Text>{result}</Text>
        </View>
      )}
    </View>
  );
};

export default ContentGenerator;





