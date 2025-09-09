// @ts-check
import React from "react";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";

const VoiceButton: React.FC = () => {
  const transcript = useSpeechRecognition();

  return (
    <div className="text-center my-4">
      <button className="px-4 py-2 bg-indigo-600 text-white rounded shadow">
        🎙️ Parlez
      </button>

      {transcript && (
        <p className="mt-2 text-sm text-gray-700">
          🔊 {transcript}
        </p>
      )}
    </div>
  );
};

export default VoiceButton;
