// 📁 src/components/SmartLangSwitcher.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGES = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "ff", label: "🌍 Fula" },
];

const SmartLangSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  // En React Native, nous utilisons une langue par défaut ou récupérons depuis les paramètres système
  const browserLang = 'fr'; // Par défaut français
  const fallbackLang = LANGUAGES.some(l => l.code === browserLang) ? browserLang : "fr";

  const [lang, setLang] = useState(fallbackLang);

  useEffect(() => {
    i18n.changeLanguage(lang);
    AsyncStorage.setItem("preferred_lang", lang);
  }, [lang, i18n]);

  // Charger la langue sauvegardée au démarrage
  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem("preferred_lang");
        if (savedLang) {
          setLang(savedLang);
        }
      } catch (error) {
        console.warn('Erreur chargement langue:', error);
      }
    };
    loadSavedLanguage();
  }, []);

  return (
    <View style="inline-flex items-center gap-2">
      <label htmlFor="lang-select" style="text-sm text-gray-600">
        🌍 Langue
      </label>
      <select
        id="lang-select"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        style="text-sm border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Sélecteur de langue intelligent"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label} ({code})
          </option>
        ))}
      </select>
    </View>
  );
};

export default SmartLangSwitcher;





