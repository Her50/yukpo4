import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import fr from "@/locales/fr.json";
import en from "@/locales/en.json";
import ff from "@/locales/ff.json";
import pt from "@/locales/pt.json";
import ar from "@/locales/ar.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "fr",
    supportedLngs: ["fr", "en", "pt", "ar", "ff"],
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      pt: { translation: pt },
      ar: { translation: ar },
      ff: { translation: ff },
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
