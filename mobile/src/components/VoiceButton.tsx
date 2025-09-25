// @ts-check
import React from "react";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";

const VoiceButton: React.FC = () => {
  const transcript = useSpeechRecognition();

  return (
    <View style="text-center my-4">
      <TouchableOpacity style="px-4 py-2 bg-indigo-600 text-white rounded shadow">
        🎙️ Parlez
      </TouchableOpacity>

      {transcript && (
        <p style="mt-2 text-sm text-gray-700">
          🔊 {transcript}
        </Text>
      )}
    </View>
  );
};

export default VoiceButton;

