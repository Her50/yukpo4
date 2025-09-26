import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

interface Message {
  user_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function ChatPanel() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [response, setResponse] = useState("");

  const handleChat = async () => {
    const userMessage: Message = {
      user_id: "u1",
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await axios.post("/chat", { history: [...history, userMessage] });
      const assistantMessage: Message = {
        user_id: "bot",
        role: "assistant",
        content: res.data,
        timestamp: new Date().toISOString(),
      };

      setHistory((prev) => [...prev, userMessage, assistantMessage]);
      setResponse(res.data);
      setInput("");
    } catch (err) {
      setResponse("❌ Erreur lors de la communication avec l'IA.");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Assistant IA Yukpomnang</h1>
      <div className="bg-gray-100 p-4 mb-2 rounded h-64 overflow-y-scroll">
        {history.map((m, i) => (
          <div key={i} className="mb-2">
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>

      <div className="flex">
        <input
          className="border p-2 w-3/4 mr-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tapez votre message..."
        />
        <button
          className=""
          onClick={handleChat}
        >
          Envoyer
        </button>
      </div>

      {response && (
        <div className="mt-4 text-green-700 font-semibold">{response}</div>
      )}
    </div>
  );
}