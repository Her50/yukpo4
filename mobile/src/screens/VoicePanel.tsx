import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
    <View style="">
      <Text style="text-xl font-bold mb-4">🎙️ Assistant vocal IA</Text>
      <View style="flex gap-2 mb-4">
        <TextInput
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          style="border p-2 flex-1 rounded"
          placeholder="Dites quelque chose..."
        />
        <TouchableOpacity
          onPress={handleSendCommand}
          style=""
        >
          ▶ Envoyer
        </TouchableOpacity>
      </View>
      {response && (
        <Text style="mt-4 bg-gray-100 p-4 rounded text-gray-800">{response}</Text>
      )}
    </View>
  );
};

export default VoicePanel;




