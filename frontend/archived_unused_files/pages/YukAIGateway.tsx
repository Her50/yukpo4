import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

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
      setResult("❌ Une erreur est survenue lors de l'appel à l'API.");
    }
  };

  return (
    <div className="">
      <h1 className="text-2xl font-bold mb-4">🔗 YukAI Gateway</h1>

      <label className="block mb-2 font-semibold">Service cible :</label>
      <select
        className="border p-2 mb-4 w-full"
        value={service}
        onChange={(e) => setService(e.target.value)}
      >
        <option value="gpt">🧠 GPT</option>
        <option value="dalle">🖼️ DALL·E</option>
        <option value="translate">🌐 Traduction</option>
      </select>

      <label className="block mb-2 font-semibold">Entrée (payload) :</label>
      <textarea
        className="border w-full p-2 mb-4"
        rows={4}
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        placeholder="Ex : Bonjour, peux-tu me décrire une maison en bord de mer ?"
      />

      <button
        className=""
        onClick={handleSubmit}
      >
        🚀 Envoyer
      </button>

      {result && (
        <pre className="bg-gray-100 mt-6 p-4 rounded whitespace-pre-wrap text-sm text-gray-800">
          {result}
        </pre>
      )}
    </div>
  );
};

export default YukAIGateway;