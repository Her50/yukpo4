import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

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
    <div className="">
      <h1 className="text-3xl font-bold mb-6">📘 Publier un livre (Bourse du Livre)</h1>

      <form onSubmit={handleSubmit} className="">
        <label className="block font-semibold mt-4">
          Titre du livre :
          <input
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            className="w-full p-2 border rounded mt-1"
            required
          />
        </label>

        <label className="block font-semibold mt-4">
          Auteur :
          <input
            type="text"
            value={auteur}
            onChange={(e) => setAuteur(e.target.value)}
            className="w-full p-2 border rounded mt-1"
            required
          />
        </label>

        <label className="block font-semibold mt-4">
          Description :
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded mt-1"
            rows={4}
          />
        </label>

        <label className="block font-semibold mt-4">
          État du livre :
          <select
            value={etat}
            onChange={(e) => setEtat(e.target.value)}
            className="w-full p-2 border rounded mt-1"
          >
            <option value="neuf">Neuf</option>
            <option value="bon">Bon état</option>
            <option value="acceptable">Acceptable</option>
            <option value="abîmé">Abîmé</option>
          </select>
        </label>

        <label className="block font-semibold mt-4">
          Fichier PDF ou photo couverture :
          <input
            type="file"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="w-full p-2 border rounded mt-1"
          />
        </label>

        <label className="block font-semibold mt-6">
          📷 Charger la couverture du livre :
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="block mt-2"
          />
        </label>

        {preview && (
          <div className="mt-6">
            <img src={preview} alt="Prévisualisation" className="" />
          </div>
        )}

        {result && (
          <div className="mt-6 bg-gray-100 p-4 rounded">
            <h3 className="font-bold mb-2">📖 Résultat Yukpomnang :</h3>
            <p><strong>Titre :</strong> {result.titre}</p>
            <p><strong>Auteur :</strong> {result.auteur}</p>
            <p><strong>État estimé :</strong> {result.etat}</p>
          </div>
        )}

        <button
          type="submit"
          className=""
        >
          ➕ Ajouter ce livre
        </button>
      </form>

      <PulseBox className="">
        <h2 className="text-lg font-bold mb-2">🧠 Résumé Yukpomnang :</h2>
        <p>{iaResponse}</p>
      </PulseBox>
    </div>
  );
};

export default BourseLivrePage;