// @ts-check
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Note: useSpeechRecognition doit être implémenté pour React Native
// Pour l'instant, on utilise un placeholder

const VoiceButton: React.FC = () => {
  const [transcript, setTranscript] = React.useState<string>('');

  // TODO: Implémenter useSpeechRecognition pour React Native
  // const transcript = useSpeechRecognition();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>🎙️ Parlez</Text>
      </TouchableOpacity>

      {transcript && (
        <Text style={styles.transcript}>
          🔊 {transcript}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
  transcript: {
    marginTop: 8,
    fontSize: 14,
    color: '#374151',
  },
});

export default VoiceButton;





