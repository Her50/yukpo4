// src/components/LangSwitcher.tsx
// @ts-check
import TranslationService from "@/services/translationService";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const languages = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "ff", label: "🌍 Fula" },
];

const LangSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("preferred_lang") || i18n.language;
  });
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem("preferred_lang", lang);
    
    // Traduction automatique pour toutes les langues
    handleAutoTranslation(lang);
  }, [lang, i18n]);

  const handleAutoTranslation = async (targetLanguage: string) => {
    setIsTranslating(true);
    try {
      const translationService = TranslationService.getInstance();
      await translationService.translateFullPage(targetLanguage);
    } catch (error) {
      console.error('Erreur traduction automatique:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="border text-sm rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Sélecteur de langue"
        disabled={isTranslating}
      >
        {languages.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      {isTranslating && (
        <div className="flex items-center gap-1 text-xs text-blue-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          <span>Traduction...</span>
        </div>
      )}
    </div>
  );
};

export default LangSwitcher;
