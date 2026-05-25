import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import fr from "@/locales/fr.json";
import en from "@/locales/en.json";
import ff from "@/locales/ff.json";
import pt from "@/locales/pt.json";
import ar from "@/locales/ar.json";
import { BOURSE_TRANSLATIONS, SUPPORTED_LNGS } from "./bourse_etablissement";
import { PHARMACIE_TRANSLATIONS } from "./pharmacie";

// Fusionne les ressources Bourse (clés `bourse.*`, `etabAdmin.*`, `common.*`)
// + Pharmacie (clés `pharmacie.*`) dans les ressources existantes de chaque
// langue. Utilisable depuis toute l'app via useTranslation().
const mergeResources = () => {
  const base: Record<string, { translation: any }> = {
    fr: { translation: { ...fr, ...BOURSE_TRANSLATIONS.fr, ...PHARMACIE_TRANSLATIONS.fr } },
    en: { translation: { ...en, ...BOURSE_TRANSLATIONS.en, ...PHARMACIE_TRANSLATIONS.en } },
    pt: { translation: { ...pt, ...BOURSE_TRANSLATIONS.pt, ...PHARMACIE_TRANSLATIONS.pt } },
    ar: { translation: { ...ar, ...BOURSE_TRANSLATIONS.ar, ...PHARMACIE_TRANSLATIONS.ar } },
    ff: { translation: { ...ff, ...BOURSE_TRANSLATIONS.ff, ...PHARMACIE_TRANSLATIONS.ff } },
  };
  return base;
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LNGS,
    resources: mergeResources(),
    detection: {
      // Ordre de détection : préférence utilisateur > langue système téléphone
      // > balise HTML. Compatible Android/iOS via navigator.languages.
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "yukpo_lang",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
