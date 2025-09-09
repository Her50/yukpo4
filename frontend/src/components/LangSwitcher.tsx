// src/components/LangSwitcher.tsx
// @ts-check
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

  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem("preferred_lang", lang);
  }, [lang, i18n]);

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="border text-sm rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label="Sélecteur de langue"
    >
      {languages.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
};

export default LangSwitcher;
