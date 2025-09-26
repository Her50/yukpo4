import * as React from "react";
import { useState } from 'react';
import { Text } from 'react-native';
import { TouchableOpacity } from 'react-native';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigation } from 'react-router-dom';

const VideoLangDetector = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ language: string; transcription: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigation();

  const handleSubmit = async () => {
    if (!videoFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('video', videoFile);

    try {
      const res = await axios.post('/api/detect-lang-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const language = res.data.language;
      const transcription = res.data.transcription;

      setResult({ language, transcription });

      // 🔎 Classification pour déterminer le bon formulaire
      const classifyRes = await axios.post('/api/classify-service-type', { texte: transcription });
      const type = classifyRes.data.type_service || 'general';

      navigation.navigate(`/formulaire/${type}`);
    } catch (err) {
      console.error('Erreur analyse vidéo', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style="p-6 space-y-4">
      <Text style="text-lg font-semibold">🎥 Analyse de la langue et redirection automatique</Text>

      <TextInput
        type="file"
        accept="video/*"
        onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
      />

      <TouchableOpacity onPress={handleSubmit} disabled={loading || !videoFile}>
        {loading ? 'Analyse en cours...' : 'Analyser et rediriger'}
      </TouchableOpacity>

      {result && (
        <Text style="text-md mt-2">
          🌍 Langue : <strong>{result.language}</strong> | 📄 Texte : {result.transcription}
        </Text>
      )}
    </Card>
  );
};

export default VideoLangDetector;





