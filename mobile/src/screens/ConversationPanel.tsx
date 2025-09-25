import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ConversationPanel() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSendMessage = async () => {
    try {
      const res = await axios.post("/api/chat", {
        user_id: 1,
        prompt,
      });
      setMessages(res.data.updated_history);
      setPrompt("");
    } catch (err) {
      console.error("Erreur lors de l'envoi du message :", err);
    }
  };

  return (
    <View style="p-4">
      <h2 style="text-xl font-bold mb-4">💬 Chat IA Yukpomnang</h2>
      <View style="border rounded p-4 h-64 overflow-y-scroll bg-white shadow">
        {messages.map((msg, idx) => (
          <View key={idx} style={msg.role === "user" ? "text-right" : "text-left"}>
            <Text>
              <strong>{msg.role}</strong>: {msg.content}
            </Text>
          </View>
        ))}
      </View>
      <View style="flex mt-4">
        <TextInput
          style="border flex-grow p-2 mr-2"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Votre message..."
        />
        <TouchableOpacity
          onClick={handleSendMessage}
          style=""
        >
          Envoyer
        </TouchableOpacity>
      </View>
    </View>
  );
}
