// @ts-check
import * as React from "react";
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import useSpeechRecognition from "@/hooks/useSpeechRecognition";

const VoiceButton: React.FC = () => {
  const transcript = useSpeechRecognition();

  return (
    <View style="text-center my-4">
      <TouchableOpacity style="px-4 py-2 bg-indigo-600 text-white rounded shadow">
        🎙️ Parlez
      </TouchableOpacity>

      {transcript && (
        <Text style="mt-2 text-sm text-gray-700">
          🔊 {transcript}
        </Text>
      )}
    </View>
  );
};

export default VoiceButton;





