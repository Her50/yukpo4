// src/components/LangSwitcher.tsx
// @ts-check
import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

const languages = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "ff", label: "🌍 Fula" },
];

const LangSwitcher: React.FC = () => {
  const { currentLanguage, isTranslating, changeLanguage } = useTranslation();

  const handleLanguageChange = (languageCode: string) => {
    changeLanguage(languageCode);
  };

  return (
    <View style="flex items-center gap-2">
      <select
        value={currentLanguage}
        onChange={(e) => handleLanguageChange(e.target.value)}
        style="border text-sm rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
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
        <View style="flex items-center gap-1 text-xs text-blue-600">
          <View style="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></View>
          <Text>Traduction...</Text>
        </View>
      )}
    </View>
  );
};

export default LangSwitcher;

