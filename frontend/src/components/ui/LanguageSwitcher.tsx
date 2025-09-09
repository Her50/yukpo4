// ✅ 📁 src/components/ui/LangSwitcher.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const LANGUAGES = [
  { code: 'fr', label: '🇫🇷' },
  { code: 'en', label: '🇬🇧' },
  { code: 'pt', label: '🇵🇹' },
  { code: 'ar', label: '🇸🇦' },
  { code: 'ff', label: '🌍' },
];

const LangSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const fallbackLang = LANGUAGES.some(l => l.code === navigator.language.split('-')[0])
    ? navigator.language.split('-')[0]
    : 'fr';

  const [lang, setLang] = useState(() => localStorage.getItem('preferred_lang') || fallbackLang);

  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem('preferred_lang', lang);
  }, [lang, i18n]);

  return (
    <motion.select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="text-sm bg-white dark:bg-gray-900 border rounded px-2 py-1 focus:outline-none focus:ring ring-blue-400"
      aria-label="Choisir une langue"
      whileTap={{ scale: 0.95 }}
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </motion.select>
  );
};

export default LangSwitcher;
