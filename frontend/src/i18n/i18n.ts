// 📁 frontend/src/i18n/i18n.ts

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend) // 🔁 Chargement dynamique depuis /public/locales/{{lng}}.json
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    debug: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'yukpo_lang',
      caches: ['localStorage']
    },
    backend: {
      loadPath: '/locales/{{lng}}.json' // ✅ Correspond à frontend/public/locales/
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
