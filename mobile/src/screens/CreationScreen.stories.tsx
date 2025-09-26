import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

﻿// src/pages/CreationPage.tsx
import autoFillFields from "@/utils/autoFillFields";

export function CreationPage() {
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState("");
  const [extraFields, setExtraFields] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const mock = localStorage.getItem("mock_description");
    if (mock) {
      setDescription(mock);
      const { categorie, extraFields } = autoFillFields(mock);
      setCategorie(categorie);
      setExtraFields(extraFields);
      setFormData({ description: mock, ...extraFields });
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Formulaire soumis avec :", formData);
    // Tu peux ici faire un POST vers l’API si besoin
  };

  return (
    <View style="">
      <Text style="text-2xl font-bold mb-4">Création intelligente</Text>
      <form onSubmit={handleSubmit} style="space-y-4">
        <textarea
          name="description"
          value={formData.description || ""}
          onChange={handleChange}
          style="w-full border p-2 rounded"
          placeholder="Décrivez votre besoin..."
        />
        {Object.entries(extraFields).map(([field, _]) => (
          <TextInput
            key={field}
            name={field}
            value={formData[field] || ""}
            onChange={handleChange}
            style="w-full border p-2 rounded"
            placeholder={`Entrer ${field}`}
          />
        ))}
        <TouchableOpacity type="submit" style="">
          Soumettre
        </TouchableOpacity>
      </form>
      {categorie && (
        <View style="mt-4 text-gray-600">
          <strong>Catégorie détectée :</strong> {categorie}
        </View>
      )}
    </View>
  );
}

export default CreationPage;




