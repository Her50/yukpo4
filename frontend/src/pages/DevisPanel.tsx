import React, { useState, useEffect } from 'react';
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
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📄 Génération automatique de devis</h2>

      <input
        className="border p-2 mb-2 w-full"
        placeholder="Votre besoin"
        value={besoin}
        onChange={(e) => setBesoin(e.target.value)}
      />
      <input
        className="border p-2 mb-2 w-full"
        placeholder="Catégorie"
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
      />

      <button className="bg-blue-600 text-white p-2 rounded" onClick={handleGenerateDevis}>
        Générer Devis
      </button>

      {result && (
        <div className="mt-4 bg-gray-100 p-4 rounded">
          <p>💬 {result.message}</p>
          <p>💰 Prix estimé : {result.prix} FCFA</p>
          <p>🧑‍💼 Prestataire suggéré ID : {result.prestataire_id}</p>
        </div>
      )}
    </div>
  );
};

export default DevisPanel;