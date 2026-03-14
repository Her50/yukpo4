/**
 * Configuration i18next — Système d'internationalisation moderne
 * 
 * Utilise i18next + react-i18next (standard industriel React/React Native)
 * Compatible avec expo-localization pour détection automatique de la langue
 * 
 * Langues supportées: fr, en, de, es, pt, zh, ja, hi, ar, ru, sw, ha, yo, am, wo, zu, ig, ln, ff, rw, sn, so, ti, mg, ht, pap
 * Langue par défaut: fr (français)
 */
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import am from './locales/am.json';
import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import ff from './locales/ff.json';
import fr from './locales/fr.json';
import ha from './locales/ha.json';
import hi from './locales/hi.json';
import ht from './locales/ht.json';
import ig from './locales/ig.json';
import ja from './locales/ja.json';
import ln from './locales/ln.json';
import mg from './locales/mg.json';
import pap from './locales/pap.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import rw from './locales/rw.json';
import sn from './locales/sn.json';
import so from './locales/so.json';
import sw from './locales/sw.json';
import ti from './locales/ti.json';
import wo from './locales/wo.json';
import yo from './locales/yo.json';
import zh from './locales/zh.json';
import zu from './locales/zu.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    // 🌍 Langues africaines formalisées
    { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
    { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
    { code: 'yo', name: 'Yorùbá', flag: '🇳🇬' },
    { code: 'am', name: 'አማርኛ', flag: '🇪🇹' },
    { code: 'wo', name: 'Wolof', flag: '🇸🇳' },
    { code: 'zu', name: 'isiZulu', flag: '🇿🇦' },
    { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
    { code: 'ln', name: 'Lingála', flag: '🇨🇩' },
    { code: 'ff', name: 'Fulfulde', flag: '��🇳' },
    { code: 'rw', name: 'Kinyarwanda', flag: '🇷🇼' },
    { code: 'sn', name: 'chiShona', flag: '🇿🇼' },
    { code: 'so', name: 'Soomaali', flag: '🇸🇴' },
    { code: 'ti', name: 'ትግርኛ', flag: '🇪🇷' },
    { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
    // 🌴 Langues caraïbéennes
    { code: 'ht', name: 'Kreyòl Ayisyen', flag: '🇭🇹' },
    { code: 'pap', name: 'Papiamentu', flag: '🇨🇼' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = {
    fr: { translation: fr },
    en: { translation: en },
    de: { translation: de },
    es: { translation: es },
    pt: { translation: pt },
    zh: { translation: zh },
    ja: { translation: ja },
    hi: { translation: hi },
    ar: { translation: ar },
    ru: { translation: ru },
    sw: { translation: sw },
    ha: { translation: ha },
    yo: { translation: yo },
    am: { translation: am },
    wo: { translation: wo },
    zu: { translation: zu },
    ig: { translation: ig },
    ln: { translation: ln },
    ff: { translation: ff },
    rw: { translation: rw },
    sn: { translation: sn },
    so: { translation: so },
    ti: { translation: ti },
    mg: { translation: mg },
    ht: { translation: ht },
    pap: { translation: pap },
};

// Détecter la langue du device
const getDeviceLanguage = (): SupportedLanguage => {
    try {
        const locale = Localization.locale?.split('-')[0] || 'fr';
        const supported = SUPPORTED_LANGUAGES.map(l => l.code) as readonly string[];
        return supported.includes(locale) ? (locale as SupportedLanguage) : 'fr';
    } catch {
        return 'fr';
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'fr', // Langue par défaut — sera mise à jour par LanguageContext depuis SafeStorage
        fallbackLng: 'fr',
        compatibilityJSON: 'v4',
        interpolation: {
            escapeValue: false, // React gère déjà l'échappement XSS
        },
        react: {
            useSuspense: false, // Éviter les problèmes avec React Native
        },
        returnNull: false,
        returnEmptyString: false,
    });

export default i18n;
