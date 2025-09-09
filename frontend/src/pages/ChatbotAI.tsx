import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';


export default function ChatbotAI() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");

  const handleAsk = async () => {
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setReply(data.reply || "Aucune réponse.");
    } catch (error) {
      setReply("❌ Une erreur est survenue.");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">🤖 Chatbot Yukpomnang</h2>
      <input
        className="border p-2 w-full mb-2"
        placeholder="Posez votre question"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        className=""
        onClick={handleAsk}
      >
        Demander
      </button>
      {reply && (
        <div className="mt-4 bg-gray-100 p-3 rounded">
          {reply}
        </div>
      )}
    </div>
  );
}