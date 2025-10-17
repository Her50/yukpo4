import * as React from "react";
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import styled, { keyframes } from "styled-components";

const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.75; }
  100% { transform: scale(1); opacity: 1; }
`;

const PulseBox = styled.div`
  animation: ${pulse} 2s infinite;
`;

const BourseLivrePage: React.FC = () => {
  const [titre, setTitre] = useState("");
  const [auteur, setAuteur] = useState("");
  const [description, setDescription] = useState("");
  const [etat, setEtat] = useState("neuf");
  const [fichier, setFichier] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const iaResponse = "Voici un résumé généré pour ce livre.";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { titre, auteur, description, fichier };
    console.log("📚 Livre soumis :", data);
    alert("📤 Envoi au backend à connecter");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);

      // Simulation Yukpomnang
      setTimeout(() => {
        setResult({
          titre: "Exemple Yukpomnang",
          auteur: "Auteur Yukpomnang",
          etat: "Bon état (estimé)",
        });
      }, 1000);
    };
    reader.readAsDataURL(file);
  };

  return (
    <View style="">
      <Text style="text-3xl font-bold mb-6">📘 Publier un livre (Bourse du Livre)</Text>

      <form onSubmit={handleSubmit} style="">
        <label style="block font-semibold mt-4">
          Titre du livre :
          <TextInput
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            style="w-full p-2 border rounded mt-1"
            required
          />
        </label>

        <label style="block font-semibold mt-4">
          Auteur :
          <TextInput
            type="text"
            value={auteur}
            onChange={(e) => setAuteur(e.target.value)}
            style="w-full p-2 border rounded mt-1"
            required
          />
        </label>

        <label style="block font-semibold mt-4">
          Description :
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style="w-full p-2 border rounded mt-1"
            rows={4}
          />
        </label>

        <label style="block font-semibold mt-4">
          État du livre :
          <select
            value={etat}
            onChange={(e) => setEtat(e.target.value)}
            style="w-full p-2 border rounded mt-1"
          >
            <option value="neuf">Neuf</option>
            <option value="bon">Bon état</option>
            <option value="acceptable">Acceptable</option>
            <option value="abîmé">Abîmé</option>
          </select>
        </label>

        <label style="block font-semibold mt-4">
          Fichier PDF ou photo couverture :
          <TextInput
            type="file"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            style="w-full p-2 border rounded mt-1"
          />
        </label>

        <label style="block font-semibold mt-6">
          📷 Charger la couverture du livre :
          <TextInput
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style="block mt-2"
          />
        </label>

        {preview && (
          <View style="mt-6">
            <img src={preview} alt="Prévisualisation" style="" />
          </View>
        )}

        {result && (
          <View style="mt-6 bg-gray-100 p-4 rounded">
            <Text style="font-bold mb-2">📖 Résultat Yukpomnang :</Text>
            <Text><strong>Titre :</strong> {result.titre}</Text>
            <Text><strong>Auteur :</strong> {result.auteur}</Text>
            <Text><strong>État estimé :</strong> {result.etat}</Text>
          </View>
        )}

        <TouchableOpacity
          type="submit"
          style=""
        >
          ➕ Ajouter ce livre
        </TouchableOpacity>
      </form>

      <View style={{}}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>🧠 Résumé Yukpomnang :</Text>
        <Text>{iaResponse}</Text>
      </View>
    </View>
  );
};

export default BourseLivrePage;




