import * as React from "react";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  onSuccess: () => void;
}

const CaptchaChallenge: React.FC<Props> = ({ onSuccess }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    fetch("/api/captcha")
      .then((r) => r.json())
      .then((d) => setQuestion(d.question))
      .catch(() => setQuestion("Quelle est la somme de 3 + 4?"));
  }, []);

  const handleSubmit = () => {
    if (answer.trim() === "7") {
      onSuccess(); // Simulation
    } else {
      Alert.alert("Erreur", "Réponse incorrecte");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{question}</Text>
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        style={styles.input}
        placeholder="Votre réponse"
        keyboardType="numeric"
      />
      <TouchableOpacity
        onPress={handleSubmit}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Valider</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  question: {
    marginBottom: 8,
    fontSize: 16,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default CaptchaChallenge;





