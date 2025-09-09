// 📁 src/components/SmartLangSwitcher.tsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "ff", label: "🌍 Fula" },
];

const SmartLangSwitcher: React.FC = () => {
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
    <div className="inline-flex items-center gap-2">
      <label htmlFor="lang-select" className="text-sm text-gray-600">
        🌍 Langue
      </label>
      <select
        id="lang-select"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="text-sm border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Sélecteur de langue intelligent"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label} ({code})
          </option>
        ))}
      </select>
    </div>
  );
};

export default SmartLangSwitcher;
