import * as React from "react";
import { useState } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
    <View style="max-w-xl mx-auto flex flex-col gap-4 p-4">
      <Text style="text-xl font-bold text-center">{t('form.describe_need')}</Text>

      <Textarea
        placeholder={t('form.describe_need')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <View style="flex items-center gap-4">
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          style="border px-3 py-1 rounded"
        >
          <option value="fr">🇫🇷 Français</option>
          <option value="en">🇬🇧 English</option>
          <option value="pt">🇵🇹 Português</option>
          <option value="ar">🇸🇦 العربية</option>
          <option value="ff">🌍 Fulfulde</option>
        </select>

        <TouchableOpacity onPress={handleTranslate} disabled={loading}>
          {loading ? t('status.loading') : t('form.send')}
        </TouchableOpacity>
      </View>

      {translated && (
        <View style="bg-gray-100 dark:bg-gray-800 p-4 rounded shadow">
          <Text style="font-semibold mb-2">{t('matching.similar_results')}:</Text>
          <Text style="text-gray-700 dark:text-gray-100">{translated}</Text>
        </View>
      )}
    </View>
  );
};

export default MultilingualForm;





