// @ts-check
import * as React from "react";
import { useEffect, useState } from "react";
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';

interface Props {
  onSuccess: () => void;
}

const CaptchaChallenge: React.FC<Textrops> = ({ onSuccess }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    fetch("/api/captcha")
      .then((r) => r.json())
      .then((d) => setQuestion(d.question));
  }, []);

  const handleSubmit = () => {
    if (answer.trim() === "7") {
      onSuccess(); // Simulation
    } else {
      alert("Réponse incorrecte");
    }
  };

  return (
    <View style="p-4 border rounded">
      <Text style="mb-2">{question}</Text>
      <TextInput
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        style="border p-1 rounded"
        placeholder="Votre réponse"
      />
      <TouchableOpacity
        onPress={handleSubmit}
        style="ml-2 px-2 py-1 bg-blue-600 text-white rounded"
      >
        Valider
      </TouchableOpacity>
    </View>
  );
};

export default CaptchaChallenge;





