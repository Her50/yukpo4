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
    <div className="">
      <h2 className="text-xl font-bold mb-4">🪟 Générer votre vitrine Yukpomnang</h2>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="ID du prestataire"
        className="border p-2 w-full mb-4"
      />
      <button onClick={handleGenerate} className="">
        Générer
      </button>

      {link && (
        <div className="mt-6">
          <p>
            🔗 Votre vitrine :{" "}
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              {link}
            </a>
          </p>
          <img
            src={`data:image/png;base64,${qr}`}
            alt="QR Code"
            className="mt-4 w-40 h-40 border"
          />
        </div>
      )}
    </div>
  );
};

export default VitrineGenerator;