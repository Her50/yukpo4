// src/components/LangFlagSwitcher.tsx
// @ts-check
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "fr", label: "🇫🇷" },
  { code: "en", label: "🇬🇧" },
  { code: "pt", label: "🇵🇹" },
  { code: "ar", label: "🇸🇦" },
  { code: "ff", label: "🌍" },
];

const LangFlagSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const browserLang = navigator.language.split("-")[0];
  const fallbackLang = LANGUAGES.some(l => l.code === browserLang) ? browserLang : "fr";

  const [lang, setLang] = useState(() => {
    return localStorage.getItem("preferred_lang") || fallbackLang;
  });

  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem("preferred_lang", lang);
  }, [lang, i18n]);

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="text-sm border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
      aria-label="Sélecteur de langue (icônes uniquement)"
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
};

export default LangFlagSwitcher;
