import React, { useState } from 'react';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const TranslateBox = () => {
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setLoading(true);

    try {
      const res = await axios.post('/api/translate', {
        text,
        target_lang: targetLang
      });
      setTranslated(res.data.translated_text);
    } catch (err) {
      console.error('Translation error', err);
      setTranslated('Erreur de traduction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Textarea
        placeholder="Texte à traduire"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center gap-4">
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="border px-3 py-1 rounded"
        >
          <option value="en">🇬🇧 English</option>
          <option value="fr">🇫🇷 Français</option>
          <option value="pt">🇵🇹 Português</option>
          <option value="ar">🇸🇦 العربية</option>
          <option value="ff">🌍 Fulfulde</option>
        </select>

        <Button onClick={handleTranslate} disabled={loading}>
          {loading ? '🔄...' : 'Traduire'}
        </Button>
      </div>

      {translated && (
        <div className="bg-gray-100 p-4 rounded shadow text-gray-800 dark:bg-gray-800 dark:text-white">
          {translated}
        </div>
      )}
    </div>
  );
};

export default TranslateBox;
