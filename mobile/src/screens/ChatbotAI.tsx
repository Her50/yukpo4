import * as React from "react";
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
// import { API_BASE_URL } from '@/config/api';
// import ResponsiveContainer from '@/components/layout/ResponsiveContainer';


export default function ChatbotAI() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");

  const handleAsk = async () => {
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com'}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setReply(data.reply || "Aucune rÃ©ponse.");
    } catch (error) {
      setReply("âŒ Une erreur est survenue.");
    }
  };

  return (
    <View style="p-4">
      <Text style="text-xl font-bold mb-4">ðŸ¤– Chatbot Yukpomnang</Text>
      <TextInput
        style="border p-2 w-full mb-2"
        placeholder="Posez votre question"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <TouchableOpacity
        style=""
        onPress={handleAsk}
      >
        Demander
      </TouchableOpacity>
      {reply && (
        <View style="mt-4 bg-gray-100 p-3 rounded">
          {reply}
        </View>
      )}
    </View>
  );
}





