import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const PartnerReviewPanel: React.FC = () => {
  const [nom, setNom] = useState("");
  const [domaine, setDomaine] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ statut: string; id: string } | null>(null);

  const handleSubmit = async () => {
    try {
      const res = await axios.post("/api/prestataires/add", {
        nom,
        domaine,
        localisation,
        email,
      });
      setResult(res.data);
    } catch (error) {
      console.error("Erreur lors de l'ajout du prestataire :", error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">🙏 Ajouter un partenaire / prestataire</h2>
      <input
        className="border p-2 mb-2 w-full"
        placeholder="Nom"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
      />
      <input
        className="border p-2 mb-2 w-full"
        placeholder="Domaine"
        value={domaine}
        onChange={(e) => setDomaine(e.target.value)}
      />
      <input
        className="border p-2 mb-2 w-full"
        placeholder="Localisation"
        value={localisation}
        onChange={(e) => setLocalisation(e.target.value)}
      />
      <input
        className="border p-2 mb-4 w-full"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className=""
        onClick={handleSubmit}
      >
        Valider
      </button>

      {result && (
        <div className="mt-4 text-green-700">
          <p className="font-semibold">✅ {result.statut}</p>
          <p>ID attribué : <strong>{result.id}</strong></p>
        </div>
      )}
    </div>
  );
};

export default PartnerReviewPanel;