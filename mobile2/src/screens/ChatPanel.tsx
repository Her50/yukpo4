import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">Assistant IA Yukpomnang</Text>
      <View style="bg-gray-100 p-4 mb-2 rounded h-64 overflow-y-scroll">
        {history.map((m, i) => (
          <View key={i} style="mb-2">
            <strong>{m.role}:</strong> {m.content}
          </View>
        ))}
      </View>

      <View style="flex">
        <TextInput
          style="border p-2 w-3/4 mr-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tapez votre message..."
        />
        <TouchableOpacity
          style=""
          onPress={handleChat}
        >
          Envoyer
        </TouchableOpacity>
      </View>

      {response && (
        <View style="mt-4 text-green-700 font-semibold">{response}</View>
      )}
    </View>
  );
}




