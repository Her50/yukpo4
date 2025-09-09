import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MultilingualForm = () => {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const [translated, setTranslated] = useState('');
  const [targetLang, setTargetLang] = useState(i18n.language || 'fr');
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
      console.error('Translation failed', err);
      setTranslated(t('status.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4 p-4">
      <h2 className="text-xl font-bold text-center">{t('form.describe_need')}</h2>

      <Textarea
        placeholder={t('form.describe_need')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center gap-4">
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="border px-3 py-1 rounded"
        >
          <option value="fr">🇫🇷 Français</option>
          <option value="en">🇬🇧 English</option>
          <option value="pt">🇵🇹 Português</option>
          <option value="ar">🇸🇦 العربية</option>
          <option value="ff">🌍 Fulfulde</option>
        </select>

        <Button onClick={handleTranslate} disabled={loading}>
          {loading ? t('status.loading') : t('form.send')}
        </Button>
      </div>

      {translated && (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded shadow">
          <h3 className="font-semibold mb-2">{t('matching.similar_results')}:</h3>
          <p className="text-gray-700 dark:text-gray-100">{translated}</p>
        </div>
      )}
    </div>
  );
};

export default MultilingualForm;
