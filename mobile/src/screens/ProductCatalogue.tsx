import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const ProductCatalogue: React.FC = () => {
  const [nom, setNom] = useState("");
  const [desc, setDesc] = useState("");
  const [prix, setPrix] = useState("");
  const [img, setImg] = useState("");
  const [cat, setCat] = useState("");
  const [result, setResult] = useState<{ statut: string; id: string } | null>(null);

  const handleSubmit = async () => {
    try {
      const res = await axios.post("/api/catalogue/add", {
        nom,
        description: desc,
        prix: parseFloat(prix),
        image_url: img,
        categorie: cat,
      });
      setResult(res.data);
    } catch (error) {
      console.error("Erreur lors de l'ajout :", error);
    }
  };

  return (
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">🛒 Ajouter un produit au catalogue</Text>
      <TextInput style="border p-2 mb-2 w-full" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
      <TextInput style="border p-2 mb-2 w-full" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <TextInput style="border p-2 mb-2 w-full" type="number" placeholder="Prix" value={prix} onChange={(e) => setPrix(e.target.value)} />
      <TextInput style="border p-2 mb-2 w-full" placeholder="URL image" value={img} onChange={(e) => setImg(e.target.value)} />
      <TextInput style="border p-2 mb-2 w-full" placeholder="Catégorie" value={cat} onChange={(e) => setCat(e.target.value)} />
      <TouchableOpacity style="" onPress={handleSubmit}>
        Ajouter
      </TouchableOpacity>

      {result && (
        <View style="mt-4 text-green-700">
          <Text>{result.statut}</Text>
          <Text>ID produit : {result.id}</Text>
        </View>
      )}
    </View>
  );
};

export default ProductCatalogue;




