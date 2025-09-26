import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const DevisPanel: React.FC = () => {
  const [besoin, setBesoin] = useState("");
  const [categorie, setCategorie] = useState("");
  const [result, setResult] = useState<null | {
    message: string;
    prix: number;
    prestataire_id: string;
  }>(null);

  const handleGenerateDevis = async () => {
    try {
      const res = await axios.post("/api/devis", { besoin, categorie });
      setResult(res.data);
    } catch (err) {
      console.error("Erreur lors de la génération du devis :", err);
    }
  };

  return (
    <View style="p-6">
      <Text style="text-2xl font-bold mb-4">📄 Génération automatique de devis</Text>

      <TextInput
        style="border p-2 mb-2 w-full"
        placeholder="Votre besoin"
        value={besoin}
        onChange={(e) => setBesoin(e.target.value)}
      />
      <TextInput
        style="border p-2 mb-2 w-full"
        placeholder="Catégorie"
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
      />

      <TouchableOpacity style="bg-blue-600 text-white p-2 rounded" onPress={handleGenerateDevis}>
        Générer Devis
      </TouchableOpacity>

      {result && (
        <View style="mt-4 bg-gray-100 p-4 rounded">
          <Text>💬 {result.message}</Text>
          <Text>💰 Prix estimé : {result.prix} FCFA</Text>
          <Text>🧑‍💼 Prestataire suggéré ID : {result.prestataire_id}</Text>
        </View>
      )}
    </View>
  );
};

export default DevisPanel;




