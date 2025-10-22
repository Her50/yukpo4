// @ts-nocheck
import * as React from "react";
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import axios from "axios";

const YukAIGateway: React.FC = () => {
  const [payload, setPayload] = useState("");
  const [service, setService] = useState("gpt");
  const [result, setResult] = useState("");

  const handleSubmit = async () => {
    try {
      const res = await axios.post(`/yukai/${service}`, { payload });
      setResult(JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error(err);
      setResult("? Une erreur est survenue lors de l'appel à l'API.");
    }
  };

  return (
    <View style="">
      <Text style="text-2xl font-bold mb-4">?? YukAI Gateway</Text>

      <label style="block mb-2 font-semibold">Service cible :</label>
      <select
        style="border p-2 mb-4 w-full"
        value={service}
        onChange={(e) => setService(e.target.value)}
      >
        <option value="gpt">?? GPT</option>
        <option value="dalle">??? DALL·E</option>
        <option value="translate">?? Traduction</option>
      </select>

      <label style="block mb-2 font-semibold">Entrée (payload) :</label>
      <textarea
        style="border w-full p-2 mb-4"
        rows={4}
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        placeholder="Ex : Bonjour, peux-tu me décrire une maison en bord de mer ?"
      />

      <TouchableOpacity
        style=""
        onPress={handleSubmit}
      >
        ?? Envoyer
      </TouchableOpacity>

      {result && (
        <Text style={{ backgroundColor: '#f3f4f6', marginTop: 24, padding: 16, borderRadius: 4, fontSize: 14, color: '#374151' }}>
          {result}
        </Text>
      )}
    </View>
  );
};

export default YukAIGateway;





