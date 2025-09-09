import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useDebounce } from '@/hooks/useDebounce';

const LivePredictField: React.FC = () => {
  const [texte, setTexte] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debouncedTexte = useDebounce(texte, 600);

  const handleVoice = () => {
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setTexte(result);
    };
    recognition.start();
  };

  useEffect(() => {
    if (debouncedTexte.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchPredictions = async () => {
      try {
        const res = await axios.post('/api/ia/predict-keywords', { texte: debouncedTexte });
        setSuggestions(res.data.suggestions || []);
      } catch (err) {
        console.warn('Erreur IA prédiction:', err);
      }
    };

    fetchPredictions();
  }, [debouncedTexte]);

  return (
    <Card className="p-4 space-y-3 w-full max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Décrivez votre besoin..."
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          className="flex-1"
        />
        <button onClick={handleVoice} className="text-blue-600 text-lg">🎤</button>
      </div>
      {suggestions.length > 0 && (
        <ul className="text-sm text-gray-700">
          {suggestions.map((s, idx) => (
            <li key={idx}>🔍 {s}</li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default LivePredictField;
