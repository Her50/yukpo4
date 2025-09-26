import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const VoicePanel: React.FC = () => {
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState("");

  const handleSendCommand = async () => {
    try {
      const res = await axios.post("/api/voice", { command });
      setResponse(res.data.response);
    } catch (error) {
      setResponse("Erreur lors de l'envoi de la commande.");
      console.error(error);
    }
  };

  return (
    <div className="">
      <h2 className="text-xl font-bold mb-4">🎙️ Assistant vocal IA</h2>
      <div className="flex gap-2 mb-4">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="border p-2 flex-1 rounded"
          placeholder="Dites quelque chose..."
        />
        <button
          onClick={handleSendCommand}
          className=""
        >
          ▶ Envoyer
        </button>
      </div>
      {response && (
        <p className="mt-4 bg-gray-100 p-4 rounded text-gray-800">{response}</p>
      )}
    </div>
  );
};

export default VoicePanel;