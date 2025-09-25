import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const VitrineGenerator: React.FC = () => {
  const [id, setId] = useState("");
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");

  const handleGenerate = async () => {
    try {
      const res = await axios.post("/vitrine/generate", { prestataire_id: id });
      setLink(res.data.url);
      setQr(res.data.qr_code_base64);
    } catch (error) {
      alert("Erreur lors de la génération de la vitrine.");
      console.error(error);
    }
  };

  return (
    <View style="">
      <h2 style="text-xl font-bold mb-4">🪟 Générer votre vitrine Yukpomnang</h2>
      <TextInput
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="ID du prestataire"
        style="border p-2 w-full mb-4"
      />
      <TouchableOpacity onClick={handleGenerate} style="">
        Générer
      </TouchableOpacity>

      {link && (
        <View style="mt-6">
          <Text>
            🔗 Votre vitrine :{" "}
            <a href={link} target="_blank" rel="noopener noreferrer" style="text-blue-600 underline">
              {link}
            </a>
          </Text>
          <img
            src={`data:image/png;base64,${qr}`}
            alt="QR Code"
            style="mt-4 w-40 h-40 border"
          />
        </View>
      )}
    </View>
  );
};

export default VitrineGenerator;
